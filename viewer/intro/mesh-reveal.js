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
  Vector2,
  Vector3,
  Vector4,
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
    // The feature tour (feature-tour.js): shading modes A and B with a
    // wipe between them across the screen, a section plane, snow cover and
    // a colour grade for the seasons.
    uModeA: { value: 0 },
    uModeB: { value: 0 },
    uWipe: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uTourTime: { value: 0 },
    uClip: { value: new Vector4(-1, 0, 0, 100) },
    uClipActive: { value: 0 },
    uSnow: { value: 0 },
    uGrade: { value: new Vector3(1, 1, 1) },
    // Time travel (feature-tour.js): a front rising from the ground, behind
    // which each material shows its next texture (its own uMapNext).
    uTimeActive: { value: 0 },
    uTimeFront: { value: 0 },
    uTimeGlow: { value: 0 },
    uHeight: { value: new Vector2(0, 1) },
  };

  faceUniforms.uHeight.value.set(minY, heightRange);
  const meshes = [];
  // The materials by name, for the time travel's textures.
  const timeTargets = {};
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
    const material = revealMaterial(part.material, faceUniforms);
    (timeTargets[material.name] ||= []).push(material);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    meshes.push(mesh);
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
  // Shadows for the sun study (feature-tour.js); the model casts them only
  // once it stands (the depth pass knows nothing of the faces growing).
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -2.6;
  sun.shadow.camera.right = 2.6;
  sun.shadow.camera.top = 2.6;
  sun.shadow.camera.bottom = -2.6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  group.add(hemisphere, sun);

  return {
    group,
    meshes,
    sun,
    hemisphere,
    uniforms: faceUniforms,
    timeTargets,
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
      const standing = faceUniforms.uFaces.value >= 1 && exit <= 0;
      for (const mesh of meshes) mesh.castShadow = standing;
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
  // Its own: the texture time travel turns it into, and whether that differs.
  material.userData.time = { uMapNext: { value: null }, uTimeChange: { value: 0 } };
  material.userData.originalMap = material.map;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, material.userData.time);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aCentroid;
        attribute vec2 aTri;
        attribute vec3 aBary;
        uniform float uFaces;
        uniform float uExit;
        varying float vReveal;
        varying vec3 vBary;
        varying vec3 vTourPos;
        varying vec3 vTourNormal;`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float span = 0.16;
        float reveal = clamp((uFaces - aTri.x * (1.0 - span)) / span, 0.0, 1.0);
        float grow = reveal * reveal * (3.0 - 2.0 * reveal);
        transformed = aCentroid + (transformed - aCentroid) * grow
          + normal * (1.0 - grow) * (0.06 + aTri.y * 0.14);
        transformed += (normalize(aCentroid + vec3(0.0, 0.4, 0.0)) * (1.5 + aTri.y * 3.0)) * uExit * uExit;
        vReveal = reveal;
        vBary = aBary;
        vTourPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTourNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uEdgeGlow;
        uniform float uExit;
        uniform float uModeA;
        uniform float uModeB;
        uniform float uWipe;
        uniform vec2 uResolution;
        uniform float uTourTime;
        uniform vec4 uClip;
        uniform float uClipActive;
        uniform float uSnow;
        uniform vec3 uGrade;
        uniform float uTimeActive;
        uniform float uTimeFront;
        uniform float uTimeGlow;
        uniform vec2 uHeight;
        uniform sampler2D uMapNext;
        uniform float uTimeChange;
        varying float vReveal;
        varying vec3 vBary;
        varying vec3 vTourPos;
        varying vec3 vTourNormal;
        // The viewer's shading modes that keep the textures, in brief:
        // 0 textures, 1 PBR (glossy, reflecting), 2 raking light.
        vec3 introShade(float mode, vec3 base, vec3 albedo, vec3 soft, vec3 n, vec3 viewNormal) {
          if (mode < 0.5) return base;
          vec3 tone = pow(albedo, vec3(1.0 / 2.2));
          if (mode < 1.5) {
            // PBR: the same textures as glossy, physically based materials -
            // a sky reflected by Fresnel, a sharp highlight from the sun.
            vec3 V = normalize(cameraPosition - vTourPos);
            vec3 L = normalize(vec3(0.5, 0.8, 0.3));
            vec3 H = normalize(L + V);
            float NdL = max(dot(n, L), 0.0);
            float NdV = max(dot(n, V), 1e-3);
            float NdH = max(dot(n, H), 0.0);
            float a2 = 0.28 * 0.28 * 0.28 * 0.28;
            float ggx = a2 / (3.14159 * pow(NdH * NdH * (a2 - 1.0) + 1.0, 2.0));
            float fresnel = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
            vec3 R = reflect(-V, n);
            vec3 sky = mix(vec3(0.95, 0.78, 0.62), vec3(0.42, 0.6, 0.95), smoothstep(-0.05, 0.7, R.y));
            sky = mix(vec3(0.08, 0.07, 0.07), sky, smoothstep(-0.25, 0.0, R.y));
            vec3 tone = pow(albedo, vec3(1.0 / 2.2));
            vec3 diffuseLit = tone * (0.28 + 0.85 * NdL);
            vec3 specular = vec3(1.0, 0.96, 0.88) * ggx * fresnel * NdL * 0.9;
            return clamp(mix(diffuseLit, sky, fresnel * 0.85) + specular, 0.0, 1.0);
          }
          // Raking light on the textures: a low light circling.
          float a = uTourTime * 1.8;
          vec3 graze = normalize(vec3(cos(a), 0.38, sin(a)));
          float l = max(dot(n, graze), 0.0);
          return clamp(tone * (0.12 + pow(l, 1.15) * 1.45), 0.0, 1.0);
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vReveal <= 0.001 || uExit >= 0.999) discard;
        float sectionDistance = dot(vTourPos, uClip.xyz) + uClip.w;
        if (uClipActive > 0.0 && sectionDistance < 0.0) discard;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float timeHeight = (vTourPos.y - uHeight.x) / uHeight.y;
        #ifdef USE_MAP
          if (uTimeActive > 0.5 && uTimeChange > 0.5) {
            float grain = fract(sin(dot(floor(vTourPos.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453);
            float passed = step(timeHeight + grain * 0.04, uTimeFront);
            diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uMapNext, vMapUv).rgb * diffuse, passed);
          }
        #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float edge = min(min(vBary.x, vBary.y), vBary.z);
        float line = 1.0 - smoothstep(0.0, fwidth(edge) * 1.2 + 0.002, edge);
        float forming = 1.0 - smoothstep(0.35, 1.0, vReveal);
        totalEmissiveRadiance += vec3(0.3, 0.58, 1.0) * (forming * 0.75 + line * 0.55 * uEdgeGlow);
        diffuseColor.rgb *= mix(0.25, 1.0, smoothstep(0.4, 1.0, vReveal));`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          vec3 n = normalize(vTourNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 viewNormal = normalize(normal);
          vec3 base = gl_FragColor.rgb;
          vec3 soft = diffuseColor.rgb;
          #ifdef USE_MAP
            soft = texture2D(map, vMapUv, 4.0).rgb * diffuse;
          #endif
          float sx = gl_FragCoord.x / uResolution.x;
          vec3 color = mix(introShade(uModeA, base, diffuseColor.rgb, soft, n, viewNormal), introShade(uModeB, base, diffuseColor.rgb, soft, n, viewNormal), step(sx, uWipe));
          // The wipe's edge: a thin line of light.
          float wiping = step(0.001, uWipe) * step(uWipe, 0.999);
          color += vec3(0.45, 0.72, 1.0) * exp(-abs(sx - uWipe) * uResolution.x * 0.12) * wiping;
          // Snow on what faces up.
          float up = smoothstep(0.3, 0.75, n.y);
          float grain = fract(sin(dot(floor(vTourPos.xz * 90.0), vec2(12.9898, 78.233))) * 43758.5453);
          vec3 snow = vec3(0.92, 0.95, 1.0) * (0.72 + 0.28 * max(dot(n, normalize(vec3(0.3, 1.0, 0.2))), 0.0));
          color = mix(color, snow, uSnow * up * (0.78 + 0.22 * grain));
          color *= uGrade;
          // Time travel's front: a thin warm line rising.
          color += vec3(1.0, 0.72, 0.35) * exp(-abs(timeHeight - uTimeFront) * 90.0) * uTimeGlow;
          // The section: the cut glows, what is seen inside the walls is
          // filled like a drawing's section.
          if (uClipActive > 0.0) {
            color += vec3(0.3, 0.62, 1.0) * exp(-abs(sectionDistance) * 70.0) * uClipActive * 1.4;
            if (!gl_FrontFacing) {
              float hatch = step(0.5, fract((vTourPos.x + vTourPos.y + vTourPos.z) * 40.0));
              color = mix(color, vec3(0.42, 0.55, 0.7) * (0.85 + 0.15 * hatch), uClipActive * 0.9);
            }
          }
          gl_FragColor.rgb = color;
        }`);
  };
  material.customProgramCacheKey = () => 'intro-reveal';
  return material;
}
