// The ultralight viewer (ultra.html): a glTF / GLB model and nothing else -
// no menu, intro, gallery, metadata or editor. One bundle of its own
// (rollup.config.js), about a tenth of the full viewer's download; the Draco
// and Basis decoders in assets/ are fetched only for models that need them.
//
//   ultra.html?model=<url of a .glb or .gltf>
//     &autorotate=1     turn the model slowly
//     &bg=<css color>   the page's background (default: the viewer's gradient)
//
// The lighting matches the lightweight viewer's: its lights, the neutral
// environment map (the 256x128 copy in assets/maps/lite/) and tone mapping.
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  EquirectangularReflectionMapping,
  HemisphereLight,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
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

  const pmrem = new PMREMGenerator(renderer);
  new HDRLoader().load(`${assets}maps/lite/neutral.hdr`, (texture) => {
    texture.mapping = EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(texture).texture;
    scene.environmentIntensity = 0.5;
    texture.dispose();
    pmrem.dispose();
  });

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

  const loader = new GLTFLoader()
    .setDRACOLoader(new DRACOLoader().setDecoderPath(`${assets}draco/gltf/`))
    .setKTX2Loader(new KTX2Loader().setTranscoderPath(`${assets}basis/`).detectSupport(renderer))
    .setMeshoptDecoder(MeshoptDecoder);

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
