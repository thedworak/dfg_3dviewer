import THREE from "./init.js";
// The material 3d-tiles-renderer's PointCloudEffectsPlugin gives streamed
// clouds (tiles.js), so a directly loaded cloud draws the same way: point
// size in world units with a minimum in pixels, square / round / sphere
// sprites and Eye-Dome Lighting. Not part of the package's public API (it is
// reached through its "./src/*" export) - check it when updating the package.
import { PointCloudMaterial } from "3d-tiles-renderer/src/three/plugins/pointcloud/PointCloudMaterial.js";

// Display of directly loaded point clouds (LAS, LAZ, XYZ, PCD - THREE.Points
// in the scene), used by the point cloud panel (editor/point-cloud-panel.js):
//
//   colours    by RGB, intensity, height or classification, chosen in the
//              shader by a uniform: switching never rewrites the buffers
//   size       "adaptive": in world units, from the cloud's estimated point
//              spacing, so points close the gaps between them at any
//              distance; "fixed": in screen pixels
//   EDL        Eye-Dome Lighting: a depth pre-pass of the cloud, against which
//              each point is shaded by how far it sits behind its neighbours
//   filters    classes switched off and a profile slab (a vertical slice
//              along a line) hide points in the vertex shader - for the
//              view, the EDL pre-pass and GPU picking alike
//   picking    a pass that writes each point's id instead of its colour
//              (pointcloud-picking.js)

export const COLOR_MODES = { rgb: 0, intensity: 1, height: 2, classification: 3 };

// ASPRS LAS standard classes (LAS 1.4, table 17).
export const CLASSIFICATION_COLORS = {
  0: 0x9e9e9e, 1: 0xbdbdbd, 2: 0xa1784f, 3: 0xb5e28c, 4: 0x6fbf4a, 5: 0x2e7d32,
  6: 0xe8743b, 7: 0xd500f9, 8: 0x7e57c2, 9: 0x2f80ed, 10: 0x795548, 11: 0x616161,
  12: 0xfdd835, 13: 0xffb300, 14: 0xffca28, 15: 0x8d6e63, 16: 0x90a4ae, 17: 0x5c6bc0,
  18: 0xff1744,
};
const CLASS_SLOTS = 32;
const OTHER_CLASS_COLOR = 0xeeeeee;

// World size of a point in "adaptive" mode, in point spacings: a little over
// one, so neighbouring points overlap rather than leave hairline gaps.
const ADAPTIVE_SPACING_FACTOR = 1.4;

const COLOR_VERTEX_DECLARATIONS = /* glsl */`
  attribute float intensity;
  attribute float classification;
  uniform int uColorMode;
  uniform vec2 uIntensityRange;
  uniform vec2 uHeightRange;
  uniform vec3 uClassColors[ ${CLASS_SLOTS} ];
  uniform vec3 uOtherClassColor;
  uniform float uClassVisible[ ${CLASS_SLOTS} ];
  uniform float uOtherClassVisible;
  uniform bool uProfileEnabled;
  uniform vec4 uProfilePlane;
  uniform float uProfileHalfWidth;
  uniform vec3 uProfileAxis;
  uniform vec2 uProfileRange;
  flat varying float vPickHigh;
  flat varying float vPickLow;

  vec3 pcHslToRgb( float h, float s, float l ) {
    vec3 rgb = clamp( abs( mod( h * 6.0 + vec3( 0.0, 4.0, 2.0 ), 6.0 ) - 3.0 ) - 1.0, 0.0, 1.0 );
    return l + s * ( rgb - 0.5 ) * ( 1.0 - abs( 2.0 * l - 1.0 ) );
  }
`;

// After three's color_vertex (vColor = the colour attribute): the other
// modes replace it. The same ramps the CPU colouring used before.
const COLOR_VERTEX_MAIN = /* glsl */`
  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
    if ( uColorMode == 1 ) {
      float span = max( uIntensityRange.y - uIntensityRange.x, 1e-6 );
      float t = clamp( ( intensity - uIntensityRange.x ) / span, 0.0, 1.0 );
      vColor.rgb = vec3( ( 40.0 + t * 215.0 ) / 255.0 );
    } else if ( uColorMode == 2 ) {
      // World height (Y), whatever the file's own up axis was.
      float y = ( modelMatrix * vec4( position, 1.0 ) ).y;
      float span = max( uHeightRange.y - uHeightRange.x, 1e-6 );
      float t = clamp( ( y - uHeightRange.x ) / span, 0.0, 1.0 );
      // Blue (low) through green to red (high).
      vColor.rgb = pcHslToRgb( ( 1.0 - t ) * 0.66, 0.85, 0.5 );
    } else if ( uColorMode == 3 ) {
      int index = int( classification + 0.5 );
      vColor.rgb = index < ${CLASS_SLOTS} ? uClassColors[ index ] : uOtherClassColor;
    }
  #endif
`;

// At the end of the vertex shader: hidden points go outside the clip volume
// (drawn nowhere, picked never); the point's index for the picking pass.
const FILTER_VERTEX_MAIN = /* glsl */`
  int pcClass = int( classification + 0.5 );
  float pcVisible = pcClass < ${CLASS_SLOTS} ? uClassVisible[ pcClass ] : uOtherClassVisible;
  bool pcHidden = pcVisible < 0.5;
  if ( uProfileEnabled ) {
    vec3 pcWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
    float pcAlong = dot( uProfileAxis, pcWorld );
    pcHidden = pcHidden
      || abs( dot( uProfilePlane.xyz, pcWorld ) - uProfilePlane.w ) > uProfileHalfWidth
      || pcAlong < uProfileRange.x || pcAlong > uProfileRange.y;
  }
  if ( pcHidden ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    gl_PointSize = 0.0;
  }
  vPickHigh = floor( float( gl_VertexID ) / 65536.0 );
  vPickLow = float( gl_VertexID ) - vPickHigh * 65536.0;
`;

const PICK_FRAGMENT_DECLARATIONS = /* glsl */`
  uniform bool uPickingPass;
  uniform float uPickId;
  flat varying float vPickHigh;
  flat varying float vPickLow;
`;

// Last in the fragment shader: object id and point index instead of colour.
const PICK_FRAGMENT_MAIN = /* glsl */`
  if ( uPickingPass ) gl_FragColor = vec4( uPickId, vPickHigh, vPickLow, 1.0 );
`;

// On for all clouds at once while pointcloud-picking.js renders its pass.
export const PICKING_PASS = { value: false };

export function createColorUniforms() {
  const classColors = Array.from({ length: CLASS_SLOTS }, (_, index) =>
    new THREE.Color(CLASSIFICATION_COLORS[index] ?? OTHER_CLASS_COLOR));
  return {
    uColorMode: { value: COLOR_MODES.rgb },
    uIntensityRange: { value: new THREE.Vector2(0, 1) },
    uHeightRange: { value: new THREE.Vector2(0, 1) },
    uClassColors: { value: classColors },
    uOtherClassColor: { value: new THREE.Color(OTHER_CLASS_COLOR) },
    uClassVisible: { value: new Array(CLASS_SLOTS).fill(1) },
    uOtherClassVisible: { value: 1 },
    uProfileEnabled: { value: false },
    uProfilePlane: { value: new THREE.Vector4(1, 0, 0, 0) },
    uProfileHalfWidth: { value: 1 },
    uProfileAxis: { value: new THREE.Vector3(0, 0, 1) },
    uProfileRange: { value: new THREE.Vector2(-Infinity, Infinity) },
  };
}

// Adds the colour modes to a PointCloudMaterial (once). colorUniforms may be
// shared: the tiles of a streamed cloud all use the panel's one set, so a
// mode switch is a single uniform change.
export function addColorModes(material, colorUniforms) {
  if (material.userData.colorModes) return material;
  material.userData.colorModes = colorUniforms;
  // Per material: the picking pass tells the objects apart by it.
  const pickId = { value: 0 };
  Object.assign(material.uniforms, colorUniforms, { uPickId: pickId, uPickingPass: PICKING_PASS });
  const injectEffects = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    injectEffects.call(material, shader, renderer);
    Object.assign(shader.uniforms, colorUniforms, { uPickId: pickId, uPickingPass: PICKING_PASS });
    shader.vertexShader = shader.vertexShader
      .replace("uniform float size;", `uniform float size;\n${COLOR_VERTEX_DECLARATIONS}`)
      .replace("#include <color_vertex>", `#include <color_vertex>\n${COLOR_VERTEX_MAIN}`)
      .replace(/}\s*$/, `${FILTER_VERTEX_MAIN}\n}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("uniform float opacity;", `uniform float opacity;\n${PICK_FRAGMENT_DECLARATIONS}`)
      .replace(/}\s*$/, `${PICK_FRAGMENT_MAIN}\n}`);
  };
  material.needsUpdate = true;
  return material;
}

function createMaterial(params, colorUniforms = null) {
  const material = new PointCloudMaterial(params);
  return colorUniforms ? addColorModes(material, colorUniforms) : material;
}

// The cloud's material as a PointCloudMaterial with GPU colour modes (once;
// later calls return it). Keeps the colours, opacity and clipping planes of
// the material it replaces.
export function preparePointCloudMaterial(points) {
  if (points.material?.isPointCloudMaterial && points.material.userData.colorModes) return points.material;
  const previous = points.material;
  const params = {
    vertexColors: Boolean(points.geometry.getAttribute("color")) || previous?.vertexColors === true,
    size: 0,
    minPointSize: previous?.size || 2,
    transparent: previous?.transparent === true,
    opacity: previous?.opacity ?? 1,
    pointShape: "square",
  };
  if (previous?.color) params.color = previous.color;
  const material = createMaterial(params, createColorUniforms());
  material.clippingPlanes = previous?.clippingPlanes ?? null;
  material.clipIntersection = previous?.clipIntersection ?? false;
  points.material = material;
  previous?.dispose?.();
  attachEdlPass(points);
  return material;
}

export function setPointColorMode(points, mode) {
  const material = preparePointCloudMaterial(points);
  const uniforms = material.uniforms;
  uniforms.uColorMode.value = COLOR_MODES[mode] ?? COLOR_MODES.rgb;
  if (mode === "intensity") {
    const intensity = points.geometry.getAttribute("intensity");
    let max = 0;
    for (let i = 0; i < (intensity?.count ?? 0); i += 1) max = Math.max(max, intensity.getX(i));
    uniforms.uIntensityRange.value.set(0, max || 1);
  } else if (mode === "height") {
    const box = new THREE.Box3().setFromObject(points);
    uniforms.uHeightRange.value.set(box.min.y, box.max.y);
  }
}

// Average distance between neighbouring points, assuming they sample
// surfaces (scans): the area of the occupied cells of a coarse grid over the
// cloud, shared out among the points. Sampled, so a few ms for millions.
export function estimatePointSpacing(geometry) {
  const position = geometry.getAttribute("position");
  const count = position?.count ?? 0;
  if (!count) return 0;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const diagonal = size.length();
  if (!(diagonal > 0)) return 0;
  const cell = diagonal / 64;
  const cells = size.clone().divideScalar(cell).floor().addScalar(1);
  const stride = Math.max(1, Math.floor(count / 300_000));
  const occupied = new Set();
  for (let i = 0; i < count; i += stride) {
    const x = Math.min(cells.x - 1, Math.floor((position.getX(i) - box.min.x) / cell));
    const y = Math.min(cells.y - 1, Math.floor((position.getY(i) - box.min.y) / cell));
    const z = Math.min(cells.z - 1, Math.floor((position.getZ(i) - box.min.z) / cell));
    occupied.add(x + cells.x * (y + cells.y * z));
  }
  return Math.sqrt((occupied.size * cell * cell) / count);
}

// sizeMode "adaptive": world size from the point spacing (in the cloud's own
// units; the object's scale applies on top), never under 1 px; "fixed":
// pixels.
export function setPointSize(points, { sizeMode, scale, pixels }) {
  const material = preparePointCloudMaterial(points);
  const spacing = points.userData.pointSpacing ??= estimatePointSpacing(points.geometry);
  if (sizeMode === "adaptive" && spacing > 0) {
    material.size = spacing * ADAPTIVE_SPACING_FACTOR * scale;
    material.minPointSize = 1;
  } else {
    material.size = 0;
    material.minPointSize = pixels * scale;
  }
}

// --- Eye-Dome Lighting ---------------------------------------------------
//
// Before the cloud is drawn (its onBeforeRender), it is drawn once more into
// a float target holding log depth, with a material of its own: the main
// material then reads that target. A separate material because three keeps
// the uniforms of the material it drew last - the main one must be "new"
// to it again after the pre-pass. Adapted from PointCloudEffectsPlugin.

const drawingBufferSize = new THREE.Vector2();
const clearColor = new THREE.Color();
let edlTarget = null;
let edlPassActive = false;

function getEdlTarget(renderer) {
  edlTarget ??= new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RedFormat,
    type: THREE.FloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  renderer.getDrawingBufferSize(drawingBufferSize);
  if (edlTarget.width !== drawingBufferSize.x || edlTarget.height !== drawingBufferSize.y) {
    edlTarget.setSize(drawingBufferSize.x, drawingBufferSize.y);
  }
  return edlTarget;
}

function attachEdlPass(points) {
  const group = new THREE.Group();
  // The world matrices are up to date from the render in progress.
  group.matrixWorldAutoUpdate = false;
  let depthMaterial = null;

  points.onBeforeRender = (renderer, _scene, camera) => {
    const material = points.material;
    if (edlPassActive || PICKING_PASS.value || !material?.isPointCloudMaterial || material.edlStrength <= 0) return;
    if (!renderer.isWebGLRenderer || renderer.xr?.isPresenting) return;

    // With the cloud's filters (classes, profile), so hidden points cast no edges.
    depthMaterial ??= createMaterial({ size: 0 }, material.userData.colorModes);
    depthMaterial.pointShape = material.pointShape;
    depthMaterial.size = material.size;
    depthMaterial.minPointSize = material.minPointSize;
    depthMaterial.edlStrength = material.edlStrength;
    depthMaterial.clippingPlanes = material.clippingPlanes;
    depthMaterial.clipIntersection = material.clipIntersection;
    depthMaterial.uniforms.uEdlDepthPass.value = true;

    const target = getEdlTarget(renderer);
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);

    edlPassActive = true;
    points.material = depthMaterial;
    group.children.length = 0;
    group.children.push(points);
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(group, camera);
    } finally {
      group.children.length = 0;
      points.material = material;
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(clearColor, previousAlpha);
      edlPassActive = false;
    }

    material.uniforms.uEdlTexture.value = target.texture;
    material.uniforms.uEdlResolution.value.set(target.width, target.height);
    material.uniforms.uEdlRadius.value = 1.4 * renderer.getPixelRatio();
    material.uniforms.uEdlDepthPass.value = false;
  };
}

export function setPointEdl(points, strength) {
  preparePointCloudMaterial(points).edlStrength = strength;
}
