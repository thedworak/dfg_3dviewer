import THREE from "./init.js";
import { core, setCore } from "./core.js";

// Which renderer draws the viewer: three's WebGLRenderer (the default, every
// feature) or its WebGPURenderer (opt-in). Chosen once, when the viewer
// starts, from
//   ?renderer=webgl|webgpu|auto      (URL, for trying it out)
//   viewer.renderer                  (viewer-settings.json, default "webgl")
// "webgpu" and "auto" use WebGPU where the browser has it and the model does
// not need WebGL (WEBGL_ONLY_EXTENSIONS); "auto" exists so a deployment can
// opt in without asking for it explicitly per page. Otherwise, and when the
// WebGPU device cannot be created, the WebGL renderer is used.
//
// With WebGPU, three converts the loader's materials to node materials as it
// draws them, and the viewer's GLSL patches (onBeforeCompile) do not apply:
//   - the dimmed direct specular of setupSingleMaterial() (loaders.js) is
//     done by the lighting model registered here instead;
//   - post-processing and ambient occlusion are a TSL render pipeline
//     (rendering.js);
//   - what has no WebGPU version is left out and says so: the custom GLSL
//     scan view, the face selection rectangle (ID buffer), the tone mapping
//     previews and WebXR.
// Point clouds draw 1 px points in WebGPU (no point size there) and
// Gaussian splats (Spark) need WebGL, so those formats keep WebGL.

export const RENDERER_PREFERENCES = ["webgl", "webgpu", "auto"];

// Point clouds and splat scenes. A PLY may be either (or a mesh): it stays
// on WebGL too.
export const WEBGL_ONLY_EXTENSIONS = ["las", "laz", "xyz", "pcd", "ply", "spz", "splat", "ksplat", "sog", "rad"];
// Streamed tilesets (3D Tiles, Potree), by file name.
const WEBGL_ONLY_FILES = ["tileset.json", "metadata.json"];

// The share of direct specular light kept (setupSingleMaterial, loaders.js).
export const DIRECT_SPECULAR_SCALE = 0.15;

function readUrlParam(name) {
  try {
    return new URL(window.location.href).searchParams.get(name);
  } catch (_error) {
    return null;
  }
}

function readUrlPreference() {
  return readUrlParam("renderer");
}

// For testing: ?renderer=webgpu&webgpuBackend=webgl2 runs three's WebGPU
// renderer - node materials, the TSL pipeline - on its WebGL 2 backend,
// where a browser (or a headless test runner) cannot present WebGPU.
function forcesWebGL2Backend() {
  return readUrlParam("webgpuBackend") === "webgl2";
}

export function resolveRendererPreference(config = core.CONFIG) {
  const candidates = [readUrlPreference(), config?.viewer?.renderer];
  const value = candidates.map((entry) => String(entry || "").trim().toLowerCase()).find((entry) => RENDERER_PREFERENCES.includes(entry));
  return value || "webgl";
}

export function modelNeedsWebGL(fileName) {
  const name = String(fileName || "").split(/[?#]/)[0].split("/").pop().toLowerCase();
  if (!name) return false;
  if (WEBGL_ONLY_FILES.includes(name)) return true;
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return WEBGL_ONLY_EXTENSIONS.includes(extension);
}

export function isWebGPUBackend() {
  return core.rendererBackend === "webgpu";
}

// Three's MeshStandard/MeshPhysical node materials with the direct specular
// light scaled down, as the WebGL renderer's patched shader does, and taking
// the weather's wet and snow (editor/weather-webgpu.js). Registered for the
// plain material types, so the renderer's own conversion uses them.
function registerViewerMaterials(renderer, webgpu, weather) {
  const { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, PhysicalLightingModel } = webgpu;
  class DampedSpecularLightingModel extends PhysicalLightingModel {
    start(builder) {
      super.start(builder);
      builder.context.reflectedLight.directSpecular.mulAssign(DIRECT_SPECULAR_SCALE);
    }
  }
  // The weather's roughness and metalness for this build only: the
  // material keeps its own nodes.
  const withWeather = (material, setup) => {
    const { roughnessNode, metalnessNode } = material;
    Object.assign(material, weather.setupWeatherSurface(material));
    try {
      return setup();
    } finally {
      Object.assign(material, { roughnessNode, metalnessNode });
    }
  };
  class ViewerStandardNodeMaterial extends MeshStandardNodeMaterial {
    setupLightingModel() {
      return new DampedSpecularLightingModel();
    }
    setupVariants(builder) {
      return withWeather(this, () => super.setupVariants(builder));
    }
  }
  class ViewerPhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
    setupLightingModel() {
      return new DampedSpecularLightingModel(
        this.useClearcoat, this.useSheen, this.useIridescence, this.useAnisotropy,
        this.useTransmission, this.useDispersion, this.useRetroreflection
      );
    }
    setupVariants(builder) {
      return withWeather(this, () => super.setupVariants(builder));
    }
  }
  // addMaterial keeps a type already registered (three's own, here): taken
  // out first.
  [[ViewerStandardNodeMaterial, "MeshStandardMaterial"], [ViewerPhysicalNodeMaterial, "MeshPhysicalMaterial"]].forEach(([nodeClass, type]) => {
    renderer.library.materialNodes.delete(type);
    renderer.library.addMaterial(nodeClass, type);
  });
}

// three sets `swizzle: "rgba"` (the identity) on every texture view;
// browsers from before the string form of that member (Chromium 140 and
// older took a dictionary) reject the whole call. Left out, it means the
// same everywhere.
function dropIdentitySwizzle() {
  const proto = globalThis.GPUTexture?.prototype;
  if (!proto || proto.__viewerSwizzleShim) return;
  const createView = proto.createView;
  proto.createView = function (descriptor) {
    if (descriptor?.swizzle === "rgba") {
      const { swizzle, ...rest } = descriptor;
      return createView.call(this, rest);
    }
    return createView.call(this, descriptor);
  };
  proto.__viewerSwizzleShim = true;
}

async function createWebGPURenderer(options) {
  dropIdentitySwizzle();
  const [webgpu, webgpuRendering, weatherWebGPU] = await Promise.all([
    import("three/webgpu"),
    import("./rendering-webgpu.js"),
    import("./editor/weather-webgpu.js"),
  ]);
  const forceWebGL = forcesWebGL2Backend();
  const renderer = new webgpu.WebGPURenderer({
    forceWebGL,
    antialias: options.antialias,
    alpha: options.alpha,
    logarithmicDepthBuffer: options.logarithmicDepthBuffer,
    powerPreference: options.powerPreference,
  });
  await renderer.init();
  // init() falls back to WebGL 2 by itself when there is no WebGPU device;
  // the classic WebGL renderer does that better (every feature).
  if (!renderer.backend?.isWebGPUBackend && !forceWebGL) {
    renderer.dispose();
    throw new Error("No WebGPU device");
  }
  registerViewerMaterials(renderer, webgpu, weatherWebGPU);
  setCore("threeWebGPU", webgpu);
  setCore("weatherWebGPU", weatherWebGPU);
  // What the WebGPU renderer runs on: "webgpu", or "webgl2" when forced.
  setCore("rendererDevice", renderer.backend?.isWebGPUBackend ? "webgpu" : "webgl2");
  setCore("webgpuRendering", webgpuRendering);
  return renderer;
}

// Whether to try WebGPU for the model about to be opened (`fileName`, for
// WEBGL_ONLY_EXTENSIONS). Sets core.rendererPreference.
export function shouldTryWebGPU(fileName) {
  const preference = resolveRendererPreference();
  setCore("rendererPreference", preference);
  const available = typeof navigator !== "undefined" && (Boolean(navigator.gpu) || forcesWebGL2Backend());
  return preference !== "webgl" && available && !modelNeedsWebGL(fileName);
}

// The WebGPU renderer, or null when its device cannot be created. Sets
// core.rendererBackend on success.
export async function tryCreateWebGPURenderer(options) {
  try {
    const renderer = await createWebGPURenderer(options);
    setCore("rendererBackend", "webgpu");
    return renderer;
  } catch (error) {
    console.warn("[renderer] WebGPU unavailable, using WebGL:", error);
    return null;
  }
}

export function createWebGLRenderer(options) {
  const renderer = new THREE.WebGLRenderer(options);
  setCore("rendererBackend", "webgl");
  return renderer;
}
