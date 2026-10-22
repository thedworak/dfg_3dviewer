import { a as attribute, f as float, M as MeshBasicNodeMaterial, v as vec4, b as vec3, R as RenderPipeline, p as pass, m as mrt, n as normalView, c as ao, u as uniform, s as screenUV, d as builtinAOContext, e as mix } from './three-webgpu-DPPtmlIw.js';
import { c as core, A as AO_RADIUS, a as AO_THICKNESS } from './main-CAri1WFc.js';
import { t as RenderTarget, a1 as UnsignedByteType, b1 as NearestFilter } from './three-VOkZ5KBh.js';
import './model-thumbnail-CI4Bfr7S.js';
import './_commonjsHelpers-ChNyZfSg.js';

// Post-processing and ambient occlusion for the WebGPU renderer
// (renderer-backend.js): the same settings as the WebGL chain in
// rendering.js, built as a TSL render pipeline instead of an EffectComposer.
//
//   msaa / smaa / fxaa   the scene pass is multisampled (the renderer's own
//          samples): three's SMAA and FXAA nodes return an opaque image,
//          which would hide the page behind the transparent canvas, and
//          multisampling is the better of the three anyway
//   none   no multisampling
//   ao     three's GTAONode on a normal/depth pre-pass; the occlusion
//          darkens the indirect (ambient, environment) light only, as the
//          lighting model applies it (builtinAOContext), mixed in by the
//          intensity setting. GTAONode reads the logarithmic depth buffer
//          itself.
//
// Without post-processing and occlusion the renderer draws straight to the
// canvas (renderer.render), tone mapping as it goes.
//
// The pipeline's nodes are bound to a scene and a camera; it is rebuilt when
// either is replaced (perspective/orthographic switch, a new scene).

let state = null;

function dispose() {
  if (!state) return;
  // A pending state (no scene yet) has no pipeline.
  state.pipeline?.dispose();
  state.aoNode?.dispose?.();
  state = null;
}

function build(renderer, scene, camera, { antialias, ao: ao$1, aoIntensity }) {
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: antialias === "none" ? 0 : renderer.samples });
  let aoNode = null;
  let intensity = null;
  if (ao$1) {
    const prePass = pass(scene, camera, { samples: 0 });
    prePass.setMRT(mrt({ output: normalView }));
    aoNode = ao(prePass.getTextureNode("depth"), prePass.getTextureNode(), camera);
    intensity = uniform(aoIntensity);
    const occlusion = aoNode.getTextureNode().sample(screenUV).r;
    scenePass.contextNode = builtinAOContext(mix(float(1), occlusion, intensity));
  }
  pipeline.outputNode = scenePass;
  state = { pipeline, scene, camera, aoNode, intensity, key: `${antialias}|${ao$1}`, modelSize: 0 };
}

// Applies rendering settings' postprocessing part; returns whether a
// pipeline is now in use.
function applyWebGPURendering(renderer, postprocessing) {
  const { enabled, antialias, ao, aoIntensity } = postprocessing;
  if (!enabled && !ao) {
    dispose();
    return false;
  }
  const effectiveAntialias = enabled ? antialias : "msaa";
  const key = `${effectiveAntialias}|${ao}`;
  if (state && state.key === key && state.scene === core.scene && state.camera === core.camera) {
    if (state.intensity) state.intensity.value = aoIntensity;
    return true;
  }
  dispose();
  if (core.scene && core.camera) build(renderer, core.scene, core.camera, { antialias: effectiveAntialias, ao, aoIntensity });
  state ??= { pending: { antialias: effectiveAntialias, ao, aoIntensity }, key };
  return true;
}

function isWebGPUPipelineActive() {
  return Boolean(state);
}

function isWebGPUAmbientOcclusionActive() {
  return Boolean(state?.aoNode || state?.pending?.ao);
}

function syncPipeline(renderer) {
  if (!state) return null;
  if (state.pending || state.scene !== core.scene || state.camera !== core.camera) {
    const settings = state.pending || {
      antialias: state.key.split("|")[0],
      ao: Boolean(state.aoNode),
      aoIntensity: state.intensity?.value ?? 1,
    };
    dispose();
    if (!core.scene || !core.camera) return null;
    build(renderer, core.scene, core.camera, settings);
  }
  if (state.aoNode) {
    const size = core.gridSize || 1;
    if (size !== state.modelSize) {
      state.modelSize = size;
      state.aoNode.radius.value = size * AO_RADIUS;
      state.aoNode.thickness.value = size * AO_THICKNESS;
    }
  }
  return state.pipeline;
}

// One frame to the canvas (or to the renderer's current render target).
function renderWebGPUFrame(renderer) {
  const pipeline = syncPipeline(renderer);
  if (pipeline) pipeline.render();
  else renderer.render(core.scene, core.camera);
}

// The current view as an image, without the canvas: a WebGPU canvas can
// only be copied (toBlob, drawImage) while its frame is current, which
// some browsers do not allow. Drawn through a pipeline - the renderer tone
// maps and converts to sRGB only on its way to the canvas, a pipeline in its
// last pass - into an 8-bit target and read back. Resolves to a 2D canvas.
//
// Without effects a plain pipeline is used, kept so its programs are built
// once.
let capturePipeline = null;

function getCapturePipeline(renderer) {
  const pipeline = syncPipeline(renderer);
  if (pipeline) return pipeline;
  if (!capturePipeline || capturePipeline.scene !== core.scene || capturePipeline.camera !== core.camera) {
    capturePipeline?.pipeline.dispose();
    capturePipeline = {
      pipeline: new RenderPipeline(renderer, pass(core.scene, core.camera)),
      scene: core.scene,
      camera: core.camera,
    };
  }
  return capturePipeline.pipeline;
}

async function captureWebGPUFrame(renderer, width, height) {
  const target = new RenderTarget(width, height, { type: UnsignedByteType });
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    getCapturePipeline(renderer).render();
    renderer.setRenderTarget(previous);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // WebGPU textures start at the top row, WebGL ones at the bottom.
    const image = new ImageData(width, height);
    const rowLength = width * 4;
    const bottomUp = renderer.backend?.isWebGLBackend === true;
    for (let row = 0; row < height; row++) {
      const from = (bottomUp ? height - 1 - row : row) * rowLength;
      image.data.set(pixels.subarray(from, from + rowLength), row * rowLength);
    }
    canvas.getContext("2d").putImageData(image, 0, 0);
    return canvas;
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
  }
}

// ---- face ID buffer (editor/face-area-selection.js) ------------------------

// The WebGPU version of the picking material: draws the mesh's index or,
// with `encodeFace`, its triangle's index (the faceId attribute of the
// pick geometry, + 1) as a 24-bit colour; 0 is empty. Unlit, not tone
// mapped, and cut by the section planes like the model.
function createFaceIdMaterial({ objectId, encodeFace, side, clippingPlanes }) {
  const id = encodeFace ? attribute("faceId", "float").round().add(1) : float(objectId);
  const byte = (shift) => id.div(shift).floor().mod(256).div(255);
  const material = new MeshBasicNodeMaterial({ side });
  material.colorNode = vec4(vec3(byte(1), byte(256), byte(65536)), 1);
  material.toneMapped = false;
  material.clippingPlanes = clippingPlanes || null;
  return material;
}

function createIdTarget(width, height) {
  return new RenderTarget(width, height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    type: UnsignedByteType,
    depthBuffer: true,
  });
}

export { applyWebGPURendering, captureWebGPUFrame, createFaceIdMaterial, createIdTarget, isWebGPUAmbientOcclusionActive, isWebGPUPipelineActive, renderWebGPUFrame };
//# sourceMappingURL=rendering-webgpu-UQwt65OR.js.map
