// The ultralight viewer (ultra.html): a glTF / GLB model and nothing else -
// no menu, intro, gallery, metadata or editor. One bundle of its own
// (rollup.config.js), about a tenth of the full viewer's download. What only
// some models need comes later, only for them: the Draco, KTX2 (Basis) and
// Meshopt decoders, chunks in assets/ultra/ and the decoders in assets/.
//
//   ultra.html?model=<url of a .glb or .gltf>
//     &autorotate=1     turn the model slowly
//     &bg=<css color>   the page's background (default: the viewer's gradient)
//
// The lighting matches the lightweight viewer's: its lights, the neutral
// environment map (the 256x128 map in assets/maps/lite/, its RGBE bytes
// repacked as a lossless WebP by scripts/hdr-to-rgbe-webp.py) and tone mapping.
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  NearestFilter,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const params = new URLSearchParams(location.search);
const modelUrl = params.get("model") || params.get("src");
const container = document.getElementById("viewer");
const bar = document.getElementById("progress");
const assets = new URL("assets/", import.meta.url).href;

// document.body.dataset.state: "loading", then "loaded" or "error" (for
// the page that embeds this one, and the tests).
function setState(state) {
  document.body.dataset.state = state;
}

function fail(message) {
  setState("error");
  bar.hidden = true;
  const box = document.createElement("p");
  box.className = "error";
  box.textContent = message;
  container.append(box);
}

// The environment map: the WebP's left half holds the RGBE mantissas, its
// right half the exponents. Decoded on the GPU into a half-float equirect,
// which PMREMGenerator turns into the scene's environment.
async function loadEnvironment(renderer) {
  const response = await fetch(`${assets}maps/lite/neutral.rgbe.webp`);
  if (!response.ok) throw new Error(response.statusText);
  const bitmap = await createImageBitmap(await response.blob(), {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const packed = new Texture(bitmap);
  packed.minFilter = packed.magFilter = NearestFilter;
  packed.generateMipmaps = false;
  packed.flipY = false; // as WebGL does anyway for an ImageBitmap
  packed.needsUpdate = true;
  const target = new WebGLRenderTarget(bitmap.width / 2, bitmap.height, { type: HalfFloatType, depthBuffer: false });
  const quad = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      uniforms: { packed: { value: packed } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      // Row 0 of the image is the top of the sky: the target's top (v = 1).
      fragmentShader: `uniform sampler2D packed; varying vec2 vUv;
        void main() {
          vec2 uv = vec2(vUv.x * 0.5, 1.0 - vUv.y);
          vec3 mantissa = texture2D(packed, uv).rgb;
          float exponent = floor(texture2D(packed, uv + vec2(0.5, 0.0)).r * 255.0 + 0.5);
          gl_FragColor = vec4(exponent > 0.0 ? mantissa * exp2(exponent - 128.0) : vec3(0.0), 1.0);
        }`,
    })
  );
  renderer.setRenderTarget(target);
  renderer.render(quad, new PerspectiveCamera());
  renderer.setRenderTarget(null);
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(target.texture).texture;
  pmrem.dispose();
  target.dispose();
  packed.dispose();
  bitmap.close();
  quad.geometry.dispose();
  quad.material.dispose();
  return environment;
}

// GLTFLoader with the decoders loaded on demand: before parsing, it looks
// for the compression extensions in the model's JSON and imports only the
// loaders those need (separate chunks), so a plain model downloads none.
class UltraGLTFLoader extends GLTFLoader {
  constructor(renderer) {
    super();
    this.renderer = renderer;
  }

  parse(data, path, onLoad, onError) {
    let json = data;
    if (typeof data !== "string") {
      const view = new DataView(data);
      const glb = data.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67; // "glTF"
      json = new TextDecoder().decode(glb ? new Uint8Array(data, 20, view.getUint32(12, true)) : data);
    }
    const uses = (name) => json.includes(`"${name}"`);
    Promise.all([
      uses("KHR_draco_mesh_compression") &&
        import("three/examples/jsm/loaders/DRACOLoader.js").then(({ DRACOLoader }) =>
          this.setDRACOLoader(new DRACOLoader().setDecoderPath(`${assets}draco/gltf/`))
        ),
      uses("KHR_texture_basisu") &&
        import("three/examples/jsm/loaders/KTX2Loader.js").then(({ KTX2Loader }) =>
          this.setKTX2Loader(new KTX2Loader().setTranscoderPath(`${assets}basis/`).detectSupport(this.renderer))
        ),
      (uses("EXT_meshopt_compression") || uses("KHR_meshopt_compression")) &&
        import("three/examples/jsm/libs/meshopt_decoder.module.js").then(({ MeshoptDecoder }) =>
          this.setMeshoptDecoder(MeshoptDecoder)
        ),
    ])
      .then(() => super.parse(data, path, onLoad, onError))
      .catch(onError);
  }
}

function start() {
  setState("loading");
  if (params.get("bg")) document.body.style.background = params.get("bg");

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    fail("WebGL is not available in this browser.");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  container.append(renderer.domElement);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x444444));
  scene.add(new AmbientLight(0x404040));
  const sun = new DirectionalLight(0xffffff);
  sun.position.set(0, 100, 50);
  scene.add(sun);
  const camera = new PerspectiveCamera(45, 1, 0.01, 1000);
  // A soft light from the viewer's side, as in the full viewer.
  const headlight = new DirectionalLight(0xffffff, 0.3);
  camera.add(headlight);
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = ["1", "true", "yes", "on"].includes((params.get("autorotate") || "").toLowerCase());
  controls.autoRotateSpeed = 1;

  loadEnvironment(renderer)
    .then((texture) => {
      scene.environment = texture;
      scene.environmentIntensity = 0.5;
    })
    .catch(() => {}); // without it the lights alone light the model

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  if (!modelUrl) {
    fail("No model: add ?model=<url of a .glb or .gltf file> to the address.");
    return;
  }

  const loader = new UltraGLTFLoader(renderer);
  loader.load(
    modelUrl,
    (gltf) => {
      bar.hidden = true;
      const model = gltf.scene;
      scene.add(model);
      // Frame the model: centred, seen from the front and a little above.
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3()).length() || 1;
      controls.target.copy(center);
      camera.position.copy(center).add(new Vector3(-0.45, 0.3, 0.75).multiplyScalar(size * 1.25));
      camera.near = size / 1000;
      camera.far = size * 100;
      camera.updateProjectionMatrix();
      controls.update();
      setState("loaded");
    },
    (event) => {
      if (event.lengthComputable && event.total) {
        bar.style.transform = `scaleX(${event.loaded / event.total})`;
      }
    },
    (error) => fail(`The model could not be loaded: ${error?.message || error}`)
  );
}

start();
