import THREE from "./init.js";
import { core, setCore } from "./core.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

// What the model stands on (core.basicGrid). One of:
//   contact    soft contact shadow only, no visible floor (default)
//   mirror     glossy floor with a reflection fading out around the model
//   grid       technical grid without edges: 1/10 of the major step, axes
//              in colour, fading out with the distance
//   turntable  low disc under the model with a compass (N = -Z) and a scale
//              bar in the model's unit (measurements, editor/model-units.js)
//   spotlight  dark room, pool of warm light on the floor
//   dots       dot grid on "paper", fading out
// Chosen by, first wins: ?ground= (URL), the manifest (scenes[id].ground,
// scene.ground, globals.ground, AIM3DViewer viewer.ground), the toolbar
// (Background menu), viewer.ground (viewer-settings.json).
//
// Every preset keeps the shadow catcher for the directional light (the sun
// study draws its shadows on it) and the axes helper. With the WebGPU
// renderer the GLSL parts have no version: the contact shadow is a blurred
// blob, the mirror is that blob too and the grid is three's GridHelper.
export const GROUND_PRESETS = ["contact", "mirror", "grid", "turntable", "spotlight", "dots"];
export const DEFAULT_GROUND_PRESET = "contact";

const SPOTLIGHT_BACKGROUND = "radial-gradient(circle at 50% 62%, #2a2722 0%, #121214 55%, #0b0b0d 100%)";

const state = {
  preset: null,
  box: null,
  contact: null,
  reflector: null,
  savedBackground: null,
  spotlightBackground: null,
  signature: "",
  lastCapture: 0,
};

export function normalizeGroundPreset(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return GROUND_PRESETS.includes(key) ? key : null;
}

function readManifestGround(meta, sceneId) {
  return meta?.scenes?.[sceneId]?.ground
    ?? meta?.scene?.ground
    ?? meta?.globals?.ground
    ?? meta?.AIM3DViewer?.viewer?.ground
    ?? core.objectsConfig?.scenes?.[sceneId]?.ground
    ?? null;
}

// The manifest's choice is kept until the next model (setupCamera).
export function setManifestGround(meta, sceneId = core.activeScene) {
  setCore("groundPresetManifest", normalizeGroundPreset(readManifestGround(meta, sceneId)));
}

export function resolveGroundPreset() {
  return normalizeGroundPreset(window.Viewer?.urlOptions?.ground)
    ?? core.groundPresetManifest
    ?? core.groundPresetUser
    ?? normalizeGroundPreset(core.CONFIG?.viewer?.ground)
    ?? DEFAULT_GROUND_PRESET;
}

export function getGroundPreset() {
  return state.preset || resolveGroundPreset();
}

const isWebGPU = () => core.rendererBackend === "webgpu";

function modelRoots() {
  return (Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject])
    .flat()
    .filter((object) => object?.isObject3D);
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// White in the middle to black at `outer` (share of the radius), for alpha maps.
function radialAlphaMap(inner, outer) {
  return canvasTexture(256, 256, (g, w) => {
    const gradient = g.createRadialGradient(w / 2, w / 2, (w / 2) * inner, w / 2, w / 2, (w / 2) * outer);
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(1, "#000");
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, w);
  });
}

// Drawn among the opaque objects, before them (renderOrder) and without a
// depth test, blended as a transparent one: whatever stands on the floor is
// drawn over it. In the transparent pass the viewer's logarithmic depth
// buffer hides a decal lying on the floor.
const UNDERLAY_ORDER = { floor: -1001, shadow: -1000 };

function underlayMaterial(parameters) {
  return new THREE.MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    ...parameters,
  });
}

function overlayMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.noClipping = true;
  mesh.userData.isGround = true;
  return mesh;
}

// --- Contact shadow ---------------------------------------------------------
// The model seen from below the floor (as the three.js "contact shadows"
// example), darker the closer to the floor, blurred twice. The darkness comes
// from the height above the floor, not from the depth buffer: the viewer's
// logarithmic depth buffer leaves the example's shadow empty. Drawn again
// only when the model moves, its visible parts change or an animation plays
// (updateGround).

// Point clouds, splats and streamed tiles have no depth to draw with a mesh
// material: they get the blob.
function needsBlobShadow(roots) {
  if (isWebGPU()) return true;
  let blob = false;
  roots.forEach((root) => root.traverse((object) => {
    if (object.isPoints || object.userData?.isTilesetBounds || /splat/i.test(object.type || object.constructor?.name || "")) blob = true;
  }));
  return blob;
}

function createBlobShadow(size, center) {
  const texture = canvasTexture(256, 256, (g, w) => {
    const gradient = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gradient.addColorStop(0, "rgba(0,0,0,0.55)");
    gradient.addColorStop(0.45, "rgba(0,0,0,0.3)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, w);
  });
  const mesh = overlayMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), underlayMaterial({ map: texture }));
  mesh.scale.set(Math.max(size.x, 1e-6) * 1.5, 1, Math.max(size.z, 1e-6) * 1.5);
  mesh.position.set(center.x, 0, center.z);
  mesh.renderOrder = UNDERLAY_ORDER.shadow;
  return { group: mesh, update: null, dispose: () => texture.dispose() };
}

function createContactShadow(size, center, opacity = 0.6) {
  const roots = modelRoots();
  if (needsBlobShadow(roots)) return createBlobShadow(size, center);

  const area = Math.max(Math.hypot(size.x, size.z) * 1.35, 1e-6);
  const height = Math.max(size.y, core.gridSize * 0.25, 1e-6);
  const resolution = 512;
  const target = new THREE.WebGLRenderTarget(resolution, resolution);
  const targetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
  target.texture.generateMipmaps = false;
  targetBlur.texture.generateMipmaps = false;

  const group = new THREE.Group();
  group.position.set(center.x, 0, center.z);
  group.userData.isGround = true;

  // Faces down (the camera's view); seen from above only.
  const plane = overlayMesh(
    new THREE.PlaneGeometry(area, area).rotateX(Math.PI / 2),
    underlayMaterial({ map: target.texture, opacity, side: THREE.BackSide })
  );
  plane.renderOrder = UNDERLAY_ORDER.shadow;
  group.add(plane);

  const camera = new THREE.OrthographicCamera(-area / 2, area / 2, area / 2, -area / 2, 0, height);
  camera.rotation.x = Math.PI / 2;
  group.add(camera);

  // Every fragment keeps the darkest value (max blending), in any order.
  const depthMaterial = new THREE.MeshDepthMaterial({
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
  });
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = { value: 1.5 };
    shader.uniforms.groundRange = { value: height * 0.6 };
    shader.vertexShader = `varying float vGroundHeight;\n${shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 groundPosition = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        groundPosition = batchingMatrix * groundPosition;
      #endif
      #ifdef USE_INSTANCING
        groundPosition = instanceMatrix * groundPosition;
      #endif
      vGroundHeight = ( modelMatrix * groundPosition ).y;`
    )}`;
    shader.fragmentShader = `uniform float darkness;\nuniform float groundRange;\nvarying float vGroundHeight;\n${shader.fragmentShader.replace(
      "gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
      "gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - clamp( vGroundHeight / groundRange, 0.0, 1.0 ) ) * darkness );"
    )}`;
  };
  const horizontalBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
  const verticalBlur = new THREE.ShaderMaterial(VerticalBlurShader);
  const quad = new FullScreenQuad();

  const blur = (amount) => {
    const renderer = core.renderer;
    quad.material = horizontalBlur;
    horizontalBlur.uniforms.tDiffuse.value = target.texture;
    horizontalBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(targetBlur);
    quad.render(renderer);
    quad.material = verticalBlur;
    verticalBlur.uniforms.tDiffuse.value = targetBlur.texture;
    verticalBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  };

  const update = () => {
    const renderer = core.renderer;
    const scene = core.scene;
    if (!renderer || !scene) return;
    // Only the model: every other child of the scene (lights stay, they do
    // not draw) is hidden while its depth is drawn.
    const keep = new Set();
    modelRoots().forEach((root) => {
      for (let node = root; node; node = node.parent) keep.add(node);
    });
    const hidden = [];
    const hide = (object) => {
      if (object.visible) {
        object.visible = false;
        hidden.push(object);
      }
    };
    scene.children.forEach((child) => {
      if (!keep.has(child) && !child.isLight) hide(child);
    });
    modelRoots().forEach((root) => root.traverse((object) => {
      if (object.isPoints || object.isLine || object.isSprite) hide(object);
    }));
    const previous = {
      background: scene.background,
      fog: scene.fog,
      override: scene.overrideMaterial,
      target: renderer.getRenderTarget(),
      clearAlpha: renderer.getClearAlpha(),
      clearColor: renderer.getClearColor(new THREE.Color()),
      shadowAutoUpdate: renderer.shadowMap.autoUpdate,
      xr: renderer.xr.enabled,
    };
    scene.background = null;
    scene.fog = null;
    depthMaterial.clippingPlanes = core.activeClippingPlanes || null;
    scene.overrideMaterial = depthMaterial;
    renderer.shadowMap.autoUpdate = false;
    renderer.xr.enabled = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = previous.override;
    blur(3.5);
    blur(1.4);
    renderer.setRenderTarget(previous.target);
    renderer.setClearColor(previous.clearColor, previous.clearAlpha);
    renderer.shadowMap.autoUpdate = previous.shadowAutoUpdate;
    renderer.xr.enabled = previous.xr;
    scene.background = previous.background;
    scene.fog = previous.fog;
    hidden.forEach((object) => { object.visible = true; });
  };

  const dispose = () => {
    target.dispose();
    targetBlur.dispose();
    depthMaterial.dispose();
    horizontalBlur.dispose();
    verticalBlur.dispose();
    quad.dispose();
  };

  return { group, update, dispose };
}

// --- Presets ----------------------------------------------------------------

function addShadowCatcher(group, extent, opacity = 0.25) {
  const plane = overlayMesh(
    new THREE.PlaneGeometry(extent, extent).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity, depthWrite: false })
  );
  plane.receiveShadow = true;
  group.add(plane);
  return plane;
}

const MirrorShader = {
  name: "GroundMirrorShader",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.35 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPosition;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vPosition = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      #include <logdepthbuf_vertex>
    }`,
  // CircleGeometry of radius 1, scaled: the reflection fades out to the rim.
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec4 vUv;
    varying vec2 vPosition;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec4 base = texture2DProj( tDiffuse, vUv );
      float fade = 1.0 - smoothstep( 0.05, 1.0, length( vPosition ) );
      gl_FragColor = vec4( base.rgb * color, base.a * fade * fade * strength );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

function buildMirror(group, size, center) {
  if (isWebGPU()) return;
  const renderer = core.renderer;
  const drawing = renderer.getDrawingBufferSize(new THREE.Vector2());
  const radius = Math.max(size.x, size.y, size.z) * 2.2;
  const reflector = new Reflector(new THREE.CircleGeometry(1, 96), {
    shader: MirrorShader,
    color: 0xffffff,
    clipBias: 0.003,
    textureWidth: Math.max(256, Math.round(drawing.x * 0.5)),
    textureHeight: Math.max(256, Math.round(drawing.y * 0.5)),
  });
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.rotation.x = -Math.PI / 2;
  reflector.scale.setScalar(radius);
  reflector.position.set(center.x, -core.gridSize * 0.0005, center.z);
  reflector.userData.noClipping = true;
  reflector.userData.isGround = true;
  group.add(reflector);
  state.reflector = reflector;
}

// Major lines every power of ten below the model's size, minor at a tenth.
function buildGrid(group, size, center) {
  const major = Math.pow(10, Math.floor(Math.log10(Math.max(core.gridSize, 1e-6))));
  const fade = core.gridSize * 2.5;
  if (isWebGPU()) {
    const grid = new THREE.GridHelper(fade * 2, Math.round((fade * 2) / major), 0xaeaeae, 0x808080);
    grid.material.opacity = 0.12;
    grid.material.transparent = true;
    grid.userData.noClipping = true;
    group.add(grid);
    return;
  }
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      minor: { value: major / 10 },
      major: { value: major },
      fade: { value: fade },
      lineColor: { value: new THREE.Color(0x7f8a96) },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4( position, 1.0 );
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */`
      uniform float minor;
      uniform float major;
      uniform float fade;
      uniform vec3 lineColor;
      varying vec3 vWorld;
      float lines( float step, float width ) {
        vec2 coord = vWorld.xz / step;
        vec2 derivative = fwidth( coord );
        vec2 distance = abs( fract( coord - 0.5 ) - 0.5 ) / derivative;
        float line = 1.0 - min( min( distance.x, distance.y ) / width, 1.0 );
        // Lines closer than a few pixels fade out instead of shimmering.
        return line * ( 1.0 - smoothstep( 0.15, 0.45, max( derivative.x, derivative.y ) ) );
      }
      void main() {
        float distanceFade = 1.0 - smoothstep( 0.0, fade, length( vWorld.xz ) );
        float grid = max( lines( minor, 1.0 ) * 0.22, lines( major, 1.3 ) * 0.55 );
        vec2 axisDistance = abs( vWorld.xz ) / fwidth( vWorld.xz );
        float alongX = 1.0 - min( axisDistance.y / 1.5, 1.0 );
        float alongZ = 1.0 - min( axisDistance.x / 1.5, 1.0 );
        vec3 color = lineColor;
        color = mix( color, vec3( 0.85, 0.27, 0.27 ), alongX );
        color = mix( color, vec3( 0.25, 0.45, 0.9 ), alongZ );
        float alpha = max( grid, max( alongX, alongZ ) * 0.8 ) * distanceFade;
        if ( alpha < 0.002 ) discard;
        gl_FragColor = vec4( color, alpha );
        #include <colorspace_fragment>
      }`,
  });
  const plane = overlayMesh(new THREE.PlaneGeometry(fade * 2.2, fade * 2.2).rotateX(-Math.PI / 2), material);
  plane.position.y = -core.gridSize * 0.0002;
  group.add(plane);
}

// A round length: 1, 2 or 5 times a power of ten, at most `meters`.
function niceLength(meters) {
  const power = Math.pow(10, Math.floor(Math.log10(meters)));
  const step = [5, 2, 1].find((factor) => factor * power <= meters) || 1;
  return step * power;
}

function formatLength(meters) {
  const units = [[1000, "km"], [1, "m"], [0.01, "cm"], [0.001, "mm"]];
  const [factor, unit] = units.find(([value]) => meters >= value) || units[units.length - 1];
  return `${Number((meters / factor).toPrecision(3))} ${unit}`;
}

function buildTurntable(group, size, center) {
  const radius = Math.max(Math.hypot(size.x, size.z) * 0.58, 1e-6);
  const thickness = core.gridSize * 0.025;
  const top = canvasTexture(2048, 2048, (g, w) => {
    const c = w / 2;
    g.fillStyle = "#c9c2b6";
    g.fillRect(0, 0, w, w);
    g.strokeStyle = "#4a4439";
    for (let degree = 0; degree < 360; degree += 5) {
      const angle = (degree * Math.PI) / 180;
      const length = degree % 30 === 0 ? 70 : 30;
      g.lineWidth = degree % 30 === 0 ? 6 : 2.5;
      g.beginPath();
      g.moveTo(c + Math.sin(angle) * (c - 24), c - Math.cos(angle) * (c - 24));
      g.lineTo(c + Math.sin(angle) * (c - 24 - length), c - Math.cos(angle) * (c - 24 - length));
      g.stroke();
    }
    g.lineWidth = 4;
    g.beginPath();
    g.arc(c, c, c - 130, 0, Math.PI * 2);
    g.stroke();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "bold 84px sans-serif";
    g.fillStyle = "#a83f2a";
    g.fillText("N", c, 190);
    g.font = "56px sans-serif";
    g.fillStyle = "#3d372d";
    g.fillText("E", w - 190, c);
    g.fillText("S", c, w - 190);
    g.fillText("W", 190, c);
  });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0xa69f93, roughness: 0.7 });
  const side = overlayMesh(new THREE.CylinderGeometry(radius, radius * 1.02, thickness, 128, 1, true), sideMaterial);
  side.position.set(center.x, -thickness / 2, center.z);
  side.receiveShadow = true;
  group.add(side);
  // CircleGeometry's v runs along +Y, which becomes -Z (north) once laid flat.
  const disc = overlayMesh(
    new THREE.CircleGeometry(radius, 128).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: top, color: 0x9d978d, roughness: 0.9 })
  );
  disc.position.set(center.x, 0, center.z);
  disc.receiveShadow = true;
  // Before the contact shadow, which lies on it.
  disc.renderOrder = UNDERLAY_ORDER.floor;
  group.add(disc);

  // Scale bar in front of the disc: five segments, in the measurement unit.
  const metersPerUnit = Number(window.Viewer?.resolveModelUnit?.()?.meters) || 1;
  const lengthMeters = niceLength(core.gridSize * 0.4 * metersPerUnit);
  const length = lengthMeters / metersPerUnit;
  const bar = new THREE.Group();
  const segment = new THREE.BoxGeometry(length / 5, thickness * 0.4, length / 25);
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  for (let index = 0; index < 5; index += 1) {
    const piece = overlayMesh(segment, index % 2 ? light : dark);
    piece.position.set(-length / 2 + (index + 0.5) * (length / 5), thickness * 0.2, 0);
    bar.add(piece);
  }
  const label = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = "#2d2a25";
    g.font = "bold 64px sans-serif";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText("0", 8, h / 2);
    g.textAlign = "right";
    g.fillText(formatLength(lengthMeters), w - 8, h / 2);
  });
  const labelMesh = overlayMesh(
    new THREE.PlaneGeometry(length, length / 4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: label, transparent: true, depthWrite: false, toneMapped: false })
  );
  labelMesh.position.set(0, thickness * 0.05, length / 6);
  bar.add(labelMesh);
  bar.position.set(center.x, 0, center.z + radius + length / 8);
  group.add(bar);
}

function buildSpotlight(group, size, center) {
  const radius = Math.max(Math.hypot(size.x, size.z), 1e-6) * 1.3;
  const pool = canvasTexture(512, 512, (g, w) => {
    const gradient = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gradient.addColorStop(0, "rgba(255, 228, 186, 0.42)");
    gradient.addColorStop(0.45, "rgba(214, 186, 146, 0.22)");
    gradient.addColorStop(1, "rgba(120, 100, 80, 0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, w);
  });
  const floor = overlayMesh(new THREE.CircleGeometry(radius, 96).rotateX(-Math.PI / 2), underlayMaterial({ map: pool }));
  floor.position.set(center.x, 0, center.z);
  floor.renderOrder = UNDERLAY_ORDER.floor;
  group.add(floor);

  const canvas = core.mainCanvas;
  if (canvas) {
    state.savedBackground = canvas.style.getPropertyValue("background");
    canvas.style.setProperty("background", SPOTLIGHT_BACKGROUND);
    state.spotlightBackground = canvas.style.getPropertyValue("background");
  }
}

function buildDots(group, size, center) {
  const extent = core.gridSize * 5;
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(core.gridSize, 1e-6)))) / 2;
  const dots = canvasTexture(128, 128, (g, w) => {
    g.fillStyle = "rgba(118, 112, 100, 0.85)";
    g.beginPath();
    g.arc(w / 2, w / 2, 13, 0, Math.PI * 2);
    g.fill();
  });
  dots.wrapS = dots.wrapT = THREE.RepeatWrapping;
  dots.repeat.set(extent / step, extent / step);
  const plane = overlayMesh(
    new THREE.PlaneGeometry(extent, extent).rotateX(-Math.PI / 2),
    underlayMaterial({ map: dots, alphaMap: radialAlphaMap(0, 0.55) })
  );
  plane.renderOrder = UNDERLAY_ORDER.floor;
  group.add(plane);
}

// --- Lifecycle --------------------------------------------------------------

function disposeGround() {
  if (state.contact) {
    state.contact.dispose?.();
    state.contact = null;
  }
  if (state.reflector) {
    state.reflector.dispose?.();
    state.reflector = null;
  }
  // The dark room's background goes back, unless something set another since.
  const canvas = core.mainCanvas;
  if (canvas && state.savedBackground !== null && canvas.style.getPropertyValue("background") === state.spotlightBackground) {
    if (state.savedBackground) canvas.style.setProperty("background", state.savedBackground);
    else canvas.style.removeProperty("background");
  }
  state.savedBackground = null;
  state.spotlightBackground = null;
  const old = core.basicGrid;
  if (old?.isObject3D) {
    core.scene?.remove(old);
    old.traverse((object) => {
      if (object === core.axesHelper) return;
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        ["map", "alphaMap"].forEach((key) => material[key]?.dispose?.());
        material.dispose?.();
      });
    });
  }
}

// Builds core.basicGrid for the model in `boundingBox` (fitCameraToCenteredObject).
export function buildGround(boundingBox, preset = resolveGroundPreset()) {
  if (boundingBox) state.box = boundingBox.clone();
  const box = state.box;
  if (!box || box.isEmpty() || !core.scene) return;
  disposeGround();

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const extent = core.gridSize * 2.5;
  const group = new THREE.Group();
  group.name = "ground";
  group.userData.noClipping = true;
  group.userData.groundPreset = preset;
  core.basicGrid = group;
  state.preset = preset;

  core.axesHelper = new THREE.AxesHelper(core.gridSize);
  core.axesHelper.visible = false;
  group.add(core.axesHelper);

  // The turntable's disc takes the shadows itself.
  if (preset !== "turntable") addShadowCatcher(group, extent, preset === "spotlight" ? 0.45 : 0.25);
  if (preset === "mirror") buildMirror(group, size, center);
  if (preset === "grid") buildGrid(group, size, center);
  if (preset === "turntable") buildTurntable(group, size, center);
  if (preset === "spotlight") buildSpotlight(group, size, center);
  if (preset === "dots") buildDots(group, size, center);

  state.contact = createContactShadow(size, center, preset === "spotlight" ? 0.75 : 0.6);
  group.add(state.contact.group);

  core.scene.add(group);
  state.signature = "";
  state.lastCapture = 0;
  updateGround(true);
}

export function setGroundPreset(preset, { user = true } = {}) {
  const normalized = normalizeGroundPreset(preset);
  if (!normalized) return;
  if (user) {
    setCore("groundPresetUser", normalized);
    // A choice in the toolbar wins over the manifest until the next model.
    setCore("groundPresetManifest", null);
  }
  const visible = core.basicGrid?.visible !== false;
  buildGround(null, normalized);
  if (core.basicGrid) core.basicGrid.visible = visible;
}

// What the contact shadow depends on: the models' placement and their
// (direct) parts shown.
function modelSignature() {
  let signature = "";
  modelRoots().forEach((root) => {
    const e = root.matrixWorld.elements;
    signature += `${root.visible ? 1 : 0}:${e[0].toFixed(4)},${e[5].toFixed(4)},${e[10].toFixed(4)},${e[12].toFixed(4)},${e[13].toFixed(4)},${e[14].toFixed(4)},${e[2].toFixed(4)},${e[8].toFixed(4)}|`;
    root.children.forEach((child) => { signature += child.visible ? "1" : "0"; });
  });
  return signature;
}

// Per frame (Viewer.animate): draws the contact shadow again when needed;
// while an animation plays, at most 20 times a second.
export function updateGround(force = false) {
  const contact = state.contact;
  if (!contact?.update || !core.basicGrid?.visible) return;
  const now = performance.now();
  const animating = Boolean(window.Viewer?.mixer?._actions?.some?.((action) => action.isRunning()));
  const signature = modelSignature();
  const changed = signature !== state.signature;
  if (!force && !changed && !(animating && now - state.lastCapture > 50)) return;
  state.signature = signature;
  state.lastCapture = now;
  try {
    contact.update();
  } catch (error) {
    console.warn("Ground: contact shadow failed", error);
    contact.update = null;
  }
}
