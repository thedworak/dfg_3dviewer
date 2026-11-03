// The intro's second act (viewer/intro/intro.js): once the points stand,
// the real model takes their place - first its vertices light up, then its
// edges are drawn, then its faces grow out of their centres, glowing at
// their edges, and settle into the textured building.
//
// Everything is driven by createMeshReveal(...).update(stage, exit), where
// stage is the seconds since the act began (it runs backwards for "Assemble
// again"), so any moment can be shown again.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LineSegments,
  Matrix3,
  Matrix4,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Seconds into the act: [start, end] of each part.
export const TIMING = {
  vertices: [0.2, 3.0],
  edges: [1.0, 5.0],
  faces: [3.2, 9.0],
  verticesOut: [6.0, 9.5],
  edgesOut: [8.0, 11.0],
  glowOut: [8.5, 11.5],
};
export const ACT_LENGTH = 11.5;

const ramp = (stage, [a, b]) => Math.min(1, Math.max(0, (stage - a) / (b - a)));

// The model, transformed like the points: (world - center) * scale.
export async function createMeshReveal({ url, renderer, center, scale, transcoderPath }) {
  const ktx2 = new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  ktx2.dispose();

  const toIntro = new Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new Matrix4().makeTranslation(-center[0], -center[1], -center[2]));
  gltf.scene.updateMatrixWorld(true);

  // Every primitive, its triangles in the intro's space.
  const parts = [];
  let minY = Infinity;
  let maxY = -Infinity;
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const matrix = new Matrix4().multiplyMatrices(toIntro, object.matrixWorld);
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const geometry = object.geometry;
    const pos = geometry.getAttribute('position');
    const nor = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const positions = new Float32Array(pos.count * 3);
    const normals = new Float32Array(pos.count * 3);
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      positions.set([v.x, v.y, v.z], i * 3);
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
      if (nor) {
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        normals.set([v.x, v.y, v.z], i * 3);
      }
    }
    const uvs = uv ? new Float32Array(pos.count * 2) : null;
    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        uvs[i * 2] = uv.getX(i);
        uvs[i * 2 + 1] = uv.getY(i);
      }
    }
    const index = geometry.index
      ? Array.from({ length: geometry.index.count }, (_, i) => geometry.index.getX(i))
      : Array.from({ length: pos.count }, (_, i) => i);
    parts.push({ positions, normals: nor ? normals : null, uvs, index, material: object.material });
  });
  const heightRange = maxY - minY || 1;

  let seed = 0x2545f491;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  // Lower first, loosely.
  const delayAt = (y, spread) => Math.min(1, ((y - minY) / heightRange) * (1 - spread) + random() * spread);

  const vertexTotal = parts.reduce((sum, part) => sum + part.positions.length / 3, 0);
  const faceTotal = parts.reduce((sum, part) => sum + part.index.length / 3, 0);
  const group = new Group();
  const faceUniforms = {
    uFaces: { value: 0 },
    uEdgeGlow: { value: 1 },
    uExit: { value: 0 },
  };

  const vertexPositions = [];
  const vertexDelays = [];
  const edgePositions = [];
  const edgeDelays = [];
  const edgeEnds = [];

  for (const part of parts) {
    const { positions, normals, uvs, index } = part;
    const triangles = index.length / 3;
    const count = triangles * 3;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const uv = uvs ? new Float32Array(count * 2) : null;
    const centroid = new Float32Array(count * 3);
    const tri = new Float32Array(count * 2);
    const bary = new Float32Array(count * 3);
    const vertexCount = positions.length / 3;
    const seenEdges = new Set();
    for (let t = 0; t < triangles; t++) {
      const corners = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]];
      const c = [0, 0, 0];
      for (const i of corners) for (let k = 0; k < 3; k++) c[k] += positions[i * 3 + k] / 3;
      const delay = delayAt(c[1], 0.3);
      const r = random();
      corners.forEach((i, corner) => {
        const o = t * 3 + corner;
        for (let k = 0; k < 3; k++) {
          position[o * 3 + k] = positions[i * 3 + k];
          normal[o * 3 + k] = normals ? normals[i * 3 + k] : 0;
          centroid[o * 3 + k] = c[k];
          bary[o * 3 + k] = k === corner ? 1 : 0;
        }
        if (uv) { uv[o * 2] = uvs[i * 2]; uv[o * 2 + 1] = uvs[i * 2 + 1]; }
        tri[o * 2] = delay;
        tri[o * 2 + 1] = r;
      });
      // Its edges, each drawn from one end to the other; an edge two
      // triangles share, once.
      for (let e = 0; e < 3; e++) {
        const a = corners[e];
        const b = corners[(e + 1) % 3];
        const key = Math.min(a, b) * vertexCount + Math.max(a, b);
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        const midY = (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2;
        const d = delayAt(midY, 0.35);
        for (let k = 0; k < 3; k++) edgePositions.push(positions[a * 3 + k]);
        for (let k = 0; k < 3; k++) edgePositions.push(positions[b * 3 + k]);
        edgeDelays.push(d, d);
        edgeEnds.push(0, 1);
      }
    }
    for (let i = 0; i < positions.length / 3; i++) {
      vertexPositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      vertexDelays.push(delayAt(positions[i * 3 + 1], 0.45));
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('normal', new BufferAttribute(normal, 3));
    if (uv) geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    geometry.setAttribute('aCentroid', new BufferAttribute(centroid, 3));
    geometry.setAttribute('aTri', new BufferAttribute(tri, 2));
    geometry.setAttribute('aBary', new BufferAttribute(bary, 3));
    if (!normals) geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, revealMaterial(part.material, faceUniforms));
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // Vertices: sparks that flash up and settle into small dots.
  const vertexUniforms = { uVertices: { value: 0 }, uFade: { value: 1 }, uViewport: { value: 800 }, uTime: { value: 0 } };
  const vertexGeometry = new BufferGeometry();
  vertexGeometry.setAttribute('position', new BufferAttribute(new Float32Array(vertexPositions), 3));
  vertexGeometry.setAttribute('aDelay', new BufferAttribute(new Float32Array(vertexDelays), 1));
  const vertices = new Points(vertexGeometry, new ShaderMaterial({
    uniforms: vertexUniforms,
    vertexShader: /* glsl */ `
      uniform float uVertices;
      uniform float uFade;
      uniform float uViewport;
      attribute float aDelay;
      varying float vAlpha;
      varying float vFlash;
      void main() {
        float span = 0.2;
        float local = clamp((uVertices - aDelay * (1.0 - span)) / span, 0.0, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // A flash on arrival, then a small steady dot.
        vFlash = local > 0.0 ? exp(-local * 6.0) : 0.0;
        gl_PointSize = local > 0.0 ? max(1.5, (0.012 + vFlash * 0.07) * uViewport / -mvPosition.z) : 0.0;
        vAlpha = step(0.001, local) * uFade;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vFlash;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = dot(uv, uv);
        if (r > 1.0 || vAlpha <= 0.0) discard;
        float glow = exp(-r * 5.0);
        vec3 color = mix(vec3(0.55, 0.8, 1.0), vec3(1.0, 0.95, 0.85), vFlash);
        gl_FragColor = vec4(color * glow * vAlpha * (0.3 + vFlash * 0.9), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  vertices.frustumCulled = false;
  vertices.renderOrder = 2;
  group.add(vertices);

  // Edges: thin light lines, each drawn from one end to the other.
  const edgeUniforms = { uEdges: { value: 0 }, uFade: { value: 1 } };
  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(edgePositions), 3));
  edgeGeometry.setAttribute('aDelay', new BufferAttribute(new Float32Array(edgeDelays), 1));
  edgeGeometry.setAttribute('aEnd', new BufferAttribute(new Float32Array(edgeEnds), 1));
  const edges = new LineSegments(edgeGeometry, new ShaderMaterial({
    uniforms: edgeUniforms,
    vertexShader: /* glsl */ `
      uniform float uEdges;
      attribute float aDelay;
      attribute float aEnd;
      varying float vEnd;
      varying float vLocal;
      void main() {
        float span = 0.22;
        vLocal = clamp((uEdges - aDelay * (1.0 - span)) / span, 0.0, 1.0);
        vEnd = aEnd;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying float vEnd;
      varying float vLocal;
      void main() {
        if (vEnd > vLocal) discard;
        // The drawing tip is brightest.
        float tip = exp(-(vLocal - vEnd) * 14.0) * step(vLocal, 0.999);
        gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * (0.2 + tip * 1.0) * uFade, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  edges.frustumCulled = false;
  edges.renderOrder = 1;
  group.add(edges);

  const hemisphere = new HemisphereLight(0xdfe8ff, 0x3a2c20, 1.9);
  const sun = new DirectionalLight(0xffe2bf, 2.8);
  sun.position.set(4, 6, 3);
  group.add(hemisphere, sun);

  return {
    group,
    // How far the faces are (0..1): the points give way to them.
    faces: () => faceUniforms.uFaces.value,
    // How far each part is (0..1), for the sound.
    levels(stage) {
      return {
        vertices: ramp(stage, TIMING.vertices),
        edges: ramp(stage, TIMING.edges),
        faces: ramp(stage, TIMING.faces),
        glowOut: ramp(stage, TIMING.glowOut),
      };
    },
    // For the counter: how many of each have appeared.
    counts(stage) {
      return {
        vertices: Math.round(vertexTotal * ramp(stage, TIMING.vertices)),
        faces: Math.round(faceTotal * ramp(stage, TIMING.faces)),
      };
    },
    setViewport(viewport) {
      vertexUniforms.uViewport.value = viewport;
    },
    update(stage, exit) {
      const visible = stage > 0;
      group.visible = visible;
      if (!visible) return;
      vertexUniforms.uVertices.value = ramp(stage, TIMING.vertices);
      vertexUniforms.uFade.value = (1 - ramp(stage, TIMING.verticesOut) * 0.85) * (1 - exit);
      edgeUniforms.uEdges.value = ramp(stage, TIMING.edges);
      edgeUniforms.uFade.value = (1 - ramp(stage, TIMING.edgesOut)) * (1 - exit);
      faceUniforms.uFaces.value = ramp(stage, TIMING.faces);
      faceUniforms.uEdgeGlow.value = 1 - ramp(stage, TIMING.glowOut);
      faceUniforms.uExit.value = exit;
      vertices.visible = vertexUniforms.uFade.value > 0.001;
      edges.visible = edgeUniforms.uFade.value > 0.001;
    },
  };
}

// The model's own material, with faces that grow out of their centres and
// glow along their edges while forming.
function revealMaterial(source, uniforms) {
  const material = source.clone();
  material.side = DoubleSide; // the faces are seen from both sides while forming
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aCentroid;
        attribute vec2 aTri;
        attribute vec3 aBary;
        uniform float uFaces;
        uniform float uExit;
        varying float vReveal;
        varying vec3 vBary;`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float span = 0.16;
        float reveal = clamp((uFaces - aTri.x * (1.0 - span)) / span, 0.0, 1.0);
        float grow = reveal * reveal * (3.0 - 2.0 * reveal);
        transformed = aCentroid + (transformed - aCentroid) * grow
          + normal * (1.0 - grow) * (0.06 + aTri.y * 0.14);
        transformed += (normalize(aCentroid + vec3(0.0, 0.4, 0.0)) * (1.5 + aTri.y * 3.0)) * uExit * uExit;
        vReveal = reveal;
        vBary = aBary;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uEdgeGlow;
        uniform float uExit;
        varying float vReveal;
        varying vec3 vBary;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vReveal <= 0.001 || uExit >= 0.999) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float edge = min(min(vBary.x, vBary.y), vBary.z);
        float line = 1.0 - smoothstep(0.0, fwidth(edge) * 1.2 + 0.002, edge);
        float forming = 1.0 - smoothstep(0.35, 1.0, vReveal);
        totalEmissiveRadiance += vec3(0.3, 0.58, 1.0) * (forming * 0.75 + line * 0.55 * uEdgeGlow);
        diffuseColor.rgb *= mix(0.25, 1.0, smoothstep(0.4, 1.0, vReveal));`);
  };
  material.customProgramCacheKey = () => 'intro-reveal';
  return material;
}
