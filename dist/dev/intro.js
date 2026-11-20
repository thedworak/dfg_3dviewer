import { a1 as Matrix4, M as Matrix3, V as Vector3, aM as Group, Q as Vector2, am as BufferGeometry, a9 as BufferAttribute, h as Mesh, f1 as Points, fj as ShaderMaterial, c8 as AdditiveBlending, eJ as LineSegments, d5 as HemisphereLight, d2 as DirectionalLight, Y as Vector4, ai as DoubleSide, C as Color, aX as MeshLambertMaterial, bs as Quaternion, b0 as MeshStandardMaterial, en as InstancedMesh, B as BoxGeometry, fG as TextureLoader, bp as PlaneGeometry, aV as LineBasicMaterial, aW as MeshBasicMaterial, aU as LineDashedMaterial, bn as PerspectiveCamera, bb as SRGBColorSpace, g7 as WebGLRenderer, i as Scene, N as NormalBlending, fs as Spherical } from './assets/three-DQIwNvhE.js';
import { l as layoutSurroundings, h as hasNewShape, w as writeBlockShape, p as planSurroundingsLife, s as surroundingsSliderToYear, S as SURROUNDINGS_ERAS, a as surroundingsWaterDistance, b as lifeAt, c as surroundingsYearToSlider, d as SURROUNDINGS_SLIDER_STEPS, m as mergeGeometries, e as sunriseSunset, R as RAD, f as formatSunTime, g as solarPosition, i as sunTimestamp, H as HORIZON, j as loadIntroScene, k as sceneTexts, n as pickText, O as OrbitControls } from './assets/intro-scene-DHtgHyw4.js';
import { GLTFLoader } from './assets/GLTFLoader-CiHz-VdJ.js';
import { KTX2Loader } from './assets/KTX2Loader-DH_brhHp.js';
import { MeshoptDecoder } from './assets/meshopt_decoder.module-ddw5RWcg.js';

// The intro's second act (viewer/intro/intro.js): once the points stand,
// the real model takes their place - first its vertices light up, then its
// edges are drawn, then its faces grow out of their centres, glowing at
// their edges, and settle into the textured building.
//
// Everything is driven by createMeshReveal(...).update(stage, exit), where
// stage is the seconds since the act began (it runs backwards for "Assemble
// again"), so any moment can be shown again.

// Seconds into the act: [start, end] of each part.
const TIMING = {
  vertices: [0.2, 3.0],
  edges: [1.0, 5.0],
  faces: [3.2, 9.0],
  verticesOut: [6.0, 9.5],
  edgesOut: [8.0, 11.0],
  glowOut: [8.5, 11.5],
};

const ramp = (stage, [a, b]) => Math.min(1, Math.max(0, (stage - a) / (b - a)));

// The model, transformed like the points: (world - center) * scale.
async function createMeshReveal({ url, renderer, center, scale, transcoderPath }) {
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
    // The x-ray lens (intro.js): a sphere (centre, radius) at the pointer;
    // what is in it and in front of it is cut away, what is seen through it
    // is drawn as an x-ray of the mesh.
    uLens: { value: new Vector4(0, 0, 0, 0.3) },
    uLensOn: { value: 0 },
  };

  faceUniforms.uHeight.value.set(minY, heightRange);
  const meshes = [];
  const trianglePositions = [];
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

    trianglePositions.push(position);
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
  sun.shadow.bias = -4e-4;
  sun.shadow.normalBias = 0.02;
  group.add(hemisphere, sun);

  const grid = createTriangleGrid(trianglePositions);

  return {
    group,
    meshes,
    sun,
    hemisphere,
    uniforms: faceUniforms,
    timeTargets,
    // The distance along a ray (intro space, dir normalized) to the first
    // face it meets, or -1.
    raycast: (origin, dir) => grid.raycast(origin, dir),
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
        uniform vec4 uLens;
        uniform float uLensOn;
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
        if (uClipActive > 0.0 && sectionDistance < 0.0) discard;
        // The x-ray lens: cut away the sphere and the cone from the camera
        // to it, so its inside can always be seen.
        float lensRadius = uLens.w * uLensOn;
        vec3 lensRay = vTourPos - cameraPosition;
        float lensFar = length(uLens.xyz - cameraPosition);
        vec3 lensDir = (uLens.xyz - cameraPosition) / max(lensFar, 1e-4);
        float lensAlong = dot(lensRay, lensDir);
        float lensCone = length(lensRay - lensDir * lensAlong) / max(lensAlong, 1e-4) / max(lensRadius / lensFar, 1e-4);
        float lensDistance = length(vTourPos - uLens.xyz);
        if (uLensOn > 0.01 && (lensDistance < lensRadius || (lensCone < 1.0 && lensAlong < lensFar))) discard;`)
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
          // Seen through the lens: the mesh in x-ray - dimmed, cold, its
          // triangles' edges glowing; the lens's rim a ring of light.
          if (uLensOn > 0.01) {
            float inside = (1.0 - smoothstep(0.92, 1.0, lensCone)) * step(lensFar, lensAlong) * uLensOn;
            float hatchX = step(0.5, fract((vTourPos.x - vTourPos.y + vTourPos.z) * 36.0));
            vec3 xray = color * vec3(0.25, 0.35, 0.5) + vec3(0.02, 0.06, 0.14)
              + vec3(0.35, 0.68, 1.0) * line * 1.3
              + (gl_FrontFacing ? vec3(0.0) : vec3(0.05, 0.1, 0.18) * hatchX);
            color = mix(color, xray, inside * 0.9);
            float rim = exp(-abs(lensDistance - lensRadius) * 55.0)
              + exp(-abs(lensCone - 1.0) * 18.0) * step(lensAlong, lensFar);
            color += vec3(0.4, 0.72, 1.0) * min(rim, 1.0) * uLensOn * 1.2;
          }
          gl_FragColor.rgb = color;
        }`);
  };
  material.customProgramCacheKey = () => 'intro-reveal';
  return material;
}

// A uniform grid over the model's triangles, for finding what the pointer
// is over every frame (some 90 000 triangles: too many to test them all).
function createTriangleGrid(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const tris = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) { tris.set(chunk, offset); offset += chunk.length; }
  const count = tris.length / 9;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (tris[i + k] < min[k]) min[k] = tris[i + k];
      if (tris[i + k] > max[k]) max[k] = tris[i + k];
    }
  }
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const cell = extent / 48;
  const n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((max[k] - min[k]) / cell)));
  const cellOf = (value, k) => Math.min(n[k] - 1, Math.max(0, Math.floor((value - min[k]) / cell)));
  // Each triangle in every cell its bounding box touches.
  const counts = new Uint32Array(n[0] * n[1] * n[2] + 1);
  const each = (t, visit) => {
    const lo = [0, 1, 2].map((k) => cellOf(Math.min(tris[t * 9 + k], tris[t * 9 + 3 + k], tris[t * 9 + 6 + k]), k));
    const hi = [0, 1, 2].map((k) => cellOf(Math.max(tris[t * 9 + k], tris[t * 9 + 3 + k], tris[t * 9 + 6 + k]), k));
    for (let z = lo[2]; z <= hi[2]; z++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let x = lo[0]; x <= hi[0]; x++) visit(x + n[0] * (y + n[1] * z));
  };
  for (let t = 0; t < count; t++) each(t, (c) => counts[c + 1]++);
  for (let c = 1; c < counts.length; c++) counts[c] += counts[c - 1];
  const items = new Uint32Array(counts[counts.length - 1]);
  const fill = counts.slice(0, -1);
  for (let t = 0; t < count; t++) each(t, (c) => { items[fill[c]++] = t; });
  const tested = new Uint32Array(count);
  let stamp = 0;

  // Möller-Trumbore, both sides.
  function hit(t, o, d) {
    const i = t * 9;
    const e1x = tris[i + 3] - tris[i], e1y = tris[i + 4] - tris[i + 1], e1z = tris[i + 5] - tris[i + 2];
    const e2x = tris[i + 6] - tris[i], e2y = tris[i + 7] - tris[i + 1], e2z = tris[i + 8] - tris[i + 2];
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return -1;
    const inv = 1 / det;
    const sx = o.x - tris[i], sy = o.y - tris[i + 1], sz = o.z - tris[i + 2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) return -1;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
    if (v < 0 || u + v > 1) return -1;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return dist > 1e-5 ? dist : -1;
  }

  return {
    raycast(o, d) {
      const origin = [o.x, o.y, o.z];
      const dir = [d.x, d.y, d.z];
      // Into the grid's box.
      let t0 = 0;
      let t1 = Infinity;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(dir[k]) < 1e-12) {
          if (origin[k] < min[k] || origin[k] > max[k]) return -1;
          continue;
        }
        let a = (min[k] - origin[k]) / dir[k];
        let b = (max[k] - origin[k]) / dir[k];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
      }
      if (t0 > t1) return -1;
      // Then cell by cell along the ray (Amanatides & Woo).
      stamp++;
      const at = [0, 1, 2].map((k) => origin[k] + dir[k] * (t0 + 1e-6));
      const c = [0, 1, 2].map((k) => cellOf(at[k], k));
      const step = dir.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
      const next = [0, 1, 2].map((k) => (step[k] === 0 ? Infinity
        : (min[k] + (c[k] + (step[k] > 0 ? 1 : 0)) * cell - origin[k]) / dir[k]));
      const delta = dir.map((v) => (v === 0 ? Infinity : cell / Math.abs(v)));
      let best = Infinity;
      for (;;) {
        const index = c[0] + n[0] * (c[1] + n[1] * c[2]);
        for (let j = counts[index]; j < counts[index + 1]; j++) {
          const t = items[j];
          if (tested[t] === stamp) continue;
          tested[t] = stamp;
          const dist = hit(t, o, d);
          if (dist > 0 && dist < best) best = dist;
        }
        const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
        if (best <= next[k]) return best;
        if (next[k] > t1) return best < Infinity ? best : -1;
        c[k] += step[k];
        if (c[k] < 0 || c[k] >= n[k]) return best < Infinity ? best : -1;
        next[k] += delta[k];
      }
    },
  };
}

// The intro's sound (viewer/intro/intro.js), made on the fly with the Web
// Audio API - no audio files. Warm and calm rather than futuristic: a small
// ensemble in a hall, in D minor.
//
// - the music under it all: a slow string pad (Dm - B flat - F - C, a bar of
//   four seconds each), a soft bass, and a harp picking the chord's notes -
//   sparse while the cloud drifts, flowing once the building stands;
// - points arriving: harp notes of the chord, more of them as they come;
// - the last point: the strings swell and open, harp notes climb the scale
//   ever faster, a breath is drawn in; the landing is a deep, soft drum, a
//   bell and the full chord;
// - the model: high harp notes for the vertices, a quick ripple for the
//   edges, soft wooden knocks as the faces form, a bell when it stands;
// - the feature tour: a small bell for each chapter, a harp note between its
//   steps, a chord of bells when it is over;
// - "Assemble again": a breath drawn back; "Enter the viewer": the strings
//   swell into a last chord.
//
// Browsers let sound start only after a click or key press, so the page
// calls setEnabled(true) from one. update() runs every frame with where the
// intro is; the music follows it, the single sounds only play while it runs
// forward.

// Seconds per chord.
const BAR = 4;
// MIDI notes: the pad's voicing (in the middle, where a phone's speaker
// plays it), the bass (a cello's range, not a sub), the harp's notes.
const CHORDS = [
  { pad: [57, 62, 65, 69, 74], bass: 50, harp: [62, 65, 69, 74, 77, 81] }, // D minor
  { pad: [58, 62, 65, 70, 74], bass: 46, harp: [62, 65, 70, 74, 77, 82] }, // B flat
  { pad: [57, 60, 65, 69, 72], bass: 53, harp: [60, 65, 69, 72, 77, 81] }, // F
  { pad: [55, 60, 64, 67, 72], bass: 48, harp: [60, 64, 67, 72, 76, 79] }, // C
];
// D natural minor, for the climbing notes.
const SCALE = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function createIntroSound() {
  let ctx = null;
  let enabled = false;
  let v = null; // the shared nodes
  let last = null; // the previous frame's state
  const fired = new Set(); // one-off events of the current pass
  // The music's clock and how present it is now (from update()).
  let nextBar = 0;
  let barIndex = 0;
  let scheduler = 0;
  const level = { music: 0, harp: 0.35, swell: 0, exit: 0 };

  function build() {
    // A larger buffer than the default (made for live playing): a phone
    // busy drawing the building would otherwise miss it now and then - a
    // crackle. The intro does not need the low latency.
    const Context = window.AudioContext || window.webkitAudioContext;
    try {
      ctx = new Context({ latencyHint: 'playback' });
    } catch {
      ctx = new Context();
    }
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    // Nothing under 80 Hz: a rumble a small speaker cannot play, that
    // would only push the compressor.
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 80;
    master.connect(lowCut).connect(compressor).connect(ctx.destination);

    // A warm hall: a dark reverb (short enough for a phone to keep up).
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.2, 2.4);
    const reverbTone = ctx.createBiquadFilter();
    reverbTone.type = 'lowpass';
    reverbTone.frequency.value = 3800;
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 0.55;
    reverbIn.connect(reverb).connect(reverbTone).connect(master);

    // The strings: every chord's voices through one lowpass that opens as
    // the music swells.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 1400;
    padFilter.Q.value = 0.7;
    const pad = ctx.createGain();
    pad.gain.value = 0;
    padFilter.connect(pad);
    pad.connect(master);
    pad.connect(reverbIn);
    const noise = noiseBuffer(ctx, 3);
    v = { master, reverbIn, padFilter, pad, noise };
  }

  const now = () => ctx.currentTime;
  const running = () => enabled && v && ctx.state === 'running';

  // --- Voices -----------------------------------------------------------------

  // A string chord: two detuned saws a note, a slow swell in and out.
  function strings(chord, t0, length, gain) {
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 1.3);
    out.gain.setValueAtTime(gain, t0 + length - 0.2);
    out.gain.linearRampToValueAtTime(0, t0 + length + 1.6);
    out.connect(v.padFilter);
    // Each note a soft triangle; the middle note also a quieter saw a little
    // apart (an ensemble's width, few voices for a phone to play); the
    // outer voices quieter than the middle.
    const middle = Math.floor(chord.pad.length / 2);
    chord.pad.forEach((note, index) => {
      const voices = index === middle ? [['triangle', -5, 1], ['sawtooth', 6, 0.45]] : [['triangle', index % 2 ? 4 : -4, 1]];
      for (const [type, detune, level_] of voices) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = hz(note);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.06 * level_ * (index === 0 || index === chord.pad.length - 1 ? 0.7 : 1);
        osc.connect(g).connect(out);
        osc.start(t0);
        osc.stop(t0 + length + 1.8);
      }
    });
  }

  // The bass: a soft, round low note.
  function bass(note, t0, length, gain) {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz(note);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = hz(note) * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.4);
    g.gain.setTargetAtTime(gain * 0.6, t0 + 0.5, 1.2);
    g.gain.linearRampToValueAtTime(0, t0 + length + 0.6);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc.connect(g);
    osc2.connect(g2).connect(g);
    g.connect(v.master);
    osc.start(t0); osc2.start(t0);
    osc.stop(t0 + length + 0.7); osc2.stop(t0 + length + 0.7);
  }

  // A harp note: a few harmonics plucked, a quick bright start dying away.
  function harp(note, gain, pan = 0, when = 0, decay = 1.6) {
    const t0 = Math.max(now(), when || now());
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(v.master);
    panner.connect(v.reverbIn);
    // Two voices: the note (a triangle, soft) and its octave fading sooner.
    for (const [ratio, g] of [[1, 1], [2, 0.3]]) {
      const osc = ctx.createOscillator();
      osc.type = ratio === 1 ? 'triangle' : 'sine';
      osc.frequency.value = hz(note) * ratio;
      const level_ = ctx.createGain();
      level_.gain.value = g;
      osc.connect(level_).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }

  // A small bell: its partials (a church bell's ratios), a long decay.
  function bell(note, gain, pan = 0, when = 0, decay = 3.2) {
    const t0 = now() + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(v.master);
    panner.connect(v.reverbIn);
    for (const [ratio, g, d] of [[0.5, 0.35, 1], [1, 1, 1], [1.19, 0.3, 0.7], [2, 0.2, 0.5]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz(note) * ratio;
      const level_ = ctx.createGain();
      level_.gain.setValueAtTime(g, t0);
      level_.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * d);
      osc.connect(level_).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }

  // A soft wooden knock, or (low and long) a drum.
  function knock(gain, frequency = 180, decay = 0.18, when = 0) {
    const t0 = now() + when;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(frequency * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(frequency, t0 + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(g);
    g.connect(v.master);
    g.connect(v.reverbIn);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }

  // A breath: soft, low noise rising (drawn in) or falling.
  function breath(from, to, length, gain, reversed = false, when = 0) {
    const t0 = now() + when;
    const source = ctx.createBufferSource();
    source.buffer = v.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + length);
    const g = ctx.createGain();
    if (reversed) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + length);
      g.gain.linearRampToValueAtTime(0, t0 + length + 0.15);
    } else {
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + length * 0.3);
      g.gain.linearRampToValueAtTime(0, t0 + length);
    }
    source.connect(filter).connect(g);
    g.connect(v.master);
    g.connect(v.reverbIn);
    source.start(t0, Math.random() * 1.5);
    source.stop(t0 + length + 0.3);
  }

  // --- The music --------------------------------------------------------------

  const chordNow = () => CHORDS[((barIndex - 1) % CHORDS.length + CHORDS.length) % CHORDS.length];
  const randomNote = (notes) => notes[Math.floor(Math.random() * notes.length)];

  // Bars are scheduled ahead (a second and a half: a page busy loading the
  // model leaves no gap): the strings, the bass and the harp's pattern, as
  // present as the intro asks for at that moment.
  function schedule() {
    if (!running()) return;
    while (nextBar < now() + 1.5) {
      const chord = CHORDS[barIndex % CHORDS.length];
      const music = level.music * (1 - level.exit);
      if (music > 0.01) {
        strings(chord, nextBar, BAR, 0.5 * music);
        bass(chord.bass, nextBar, BAR, 0.05 * music);
        // The harp: a rising figure, eighths once the building stands.
        const busy = level.harp > 0.6;
        const steps = busy ? 8 : 3;
        for (let i = 0; i < steps; i++) {
          const note = chord.harp[(busy ? [0, 2, 1, 3, 2, 4, 3, 5][i] : [0, 2, 4][i])];
          harp(note, (busy ? 0.06 : 0.05) * music, (i % 2 ? 0.3 : -0.3), nextBar + i * (BAR / steps), 2.2);
        }
      }
      nextBar += BAR;
      barIndex++;
    }
  }

  // --- Following the intro ----------------------------------------------------

  const smooth = (param, value, time = 0.12) => param.setTargetAtTime(value, ctx.currentTime, time);
  const bump = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
  // Once per pass: crossing `threshold` forwards.
  const crossed = (key, value, previous, threshold) => value >= threshold && previous < threshold && !fired.has(key) && (fired.add(key), true);

  // state: { dt, forward, fade, progress, arrivedRate, flight, pan, landed,
  //          vertices, edges, faces, glowOut, exit }
  function update(state) {
    if (!running()) {
      last = state;
      return;
    }
    const { dt, forward } = state;
    const prev = last || state;
    if (state.flight < prev.flight || state.faces < prev.faces) fired.clear();

    // The music: in with the cloud, fuller once the building stands.
    level.music = state.fade;
    level.harp = state.landed ? 1 : 0.35;
    level.exit = state.exit;
    const flying = state.flight > 0 && !state.landed;
    level.swell = flying ? state.flight : Math.max(0, level.swell - dt * 0.8);
    smooth(v.pad.gain, (0.8 + level.swell * 0.7) * (1 - state.exit), 0.3);
    smooth(v.padFilter.frequency, 1300 + state.progress * 300 + level.swell * 1200 + state.faces * 300, 0.3);

    // Points arriving: harp notes of the chord, more as they come.
    if (forward && state.arrivedRate > 0) {
      const perSecond = Math.min(5, state.arrivedRate * 14);
      if (Math.random() < perSecond * dt) {
        harp(randomNote(chordNow().harp), 0.025 + Math.random() * 0.015, Math.random() * 1.6 - 0.8, 0, 1.2);
      }
    }

    // The last point: notes climbing the scale, faster as it nears.
    if (forward && flying) {
      [0.18, 0.36, 0.5, 0.62, 0.72, 0.8, 0.86, 0.91, 0.95, 0.98].forEach((at, i) => {
        if (crossed(`ping${i}`, state.flight, prev.flight, at)) harp(SCALE[i + 3], 0.05, state.pan, 0, 1.8);
      });
      if (crossed('swell', state.flight, prev.flight, 0.84)) breath(300, 2400, 0.6, 0.08, true);
    }
    if (forward && state.landed && !prev.landed) {
      knock(0.3, 92, 1.4);
      bell(74, 0.06, 0, 0, 4.5);
      for (const [i, note] of [50, 57, 62, 65, 69, 74].entries()) harp(note, 0.05, (i - 2.5) * 0.25, now() + i * 0.04, 3);
    }

    // Vertices: high harp notes now and then.
    if (forward && state.vertices > prev.vertices && state.vertices < 1) {
      const perSecond = Math.min(5, ((state.vertices - prev.vertices) / Math.max(dt, 1e-3)) * 12);
      if (Math.random() < perSecond * dt) harp(randomNote(chordNow().harp), 0.018, Math.random() * 1.8 - 0.9, 0, 1.2);
    }
    // Edges: a quick ripple of notes while they are drawn.
    if (forward && state.edges > 0 && state.edges < 1 && Math.random() < bump(state.edges) * 8 * dt) {
      harp(SCALE[Math.floor(state.edges * (SCALE.length - 1))], 0.025, Math.random() * 1.2 - 0.6, 0, 1.2);
    }
    // Faces: soft wooden knocks; a bell when it stands.
    if (forward && state.faces > prev.faces && state.faces < 1) {
      const perSecond = Math.min(5, ((state.faces - prev.faces) / Math.max(dt, 1e-3)) * 16);
      if (Math.random() < perSecond * dt) knock(0.05, 160 + Math.random() * 120);
    }
    if (forward && crossed('locked', state.faces, prev.faces, 1)) {
      knock(0.12, 90, 0.5);
      bell(74, 0.035, -0.2, 0.1);
    }
    last = state;
  }

  async function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
      // The music starts a moment from now, once update() has said how
      // present it is.
      if (nextBar < now()) nextBar = now() + 0.3;
      clearInterval(scheduler);
      scheduler = setInterval(schedule, 100);
      v.master.gain.cancelScheduledValues(ctx.currentTime);
      v.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    } else if (ctx) {
      clearInterval(scheduler);
      v.master.gain.cancelScheduledValues(ctx.currentTime);
      v.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { if (!enabled) ctx.suspend(); }, 800);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enabled) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume().then(() => { if (nextBar < now()) nextBar = now() + 0.1; });
  });

  return {
    get enabled() { return enabled; },
    setEnabled,
    update,
    // The feature tour (feature-tour.js): a small bell for a new chapter, a
    // harp note for a step within one, a chord of bells at the end.
    cue(kind) {
      if (!running()) return;
      const chord = chordNow();
      if (kind === 'end') {
        [62, 65, 69, 74].forEach((note, i) => bell(note, 0.03 - i * 0.004, (i - 1.5) * 0.3, i * 0.14, 4));
      } else if (kind === 'chapter') {
        bell(chord.harp[3], 0.03, 0, 0, 2.6);
        harp(chord.harp[0], 0.03, -0.2, now() + 0.06);
      } else {
        harp(randomNote(chord.harp), 0.03, Math.random() * 1.2 - 0.6);
      }
    },
    rewind() {
      if (!running()) return;
      fired.clear();
      breath(2400, 200, 2.4, 0.07, true);
    },
    // Into the viewer: the strings swell into a last chord, then quiet.
    enter(length) {
      if (!running()) return;
      breath(200, 1600, length * 0.7, 0.06, true);
      setTimeout(() => {
        if (!running()) return;
        knock(0.2, 92, 1.2);
        for (const [i, note] of [50, 57, 62, 65, 69, 74].entries()) harp(note, 0.045, (i - 2.5) * 0.25, now() + i * 0.05, 2.6);
      }, length * 700);
      v.master.gain.setTargetAtTime(0, ctx.currentTime + length * 0.9, length * 0.5);
      clearInterval(scheduler);
    },
  };
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

// The intro's surroundings through time (feature-tour.js, its last
// chapter): the viewer's generated surroundings (editor/surroundings-rules.js,
// docs/surroundings.md) round the model, through all the periods they cover
// (900-2025), a settlement of the scene's kind and region growing house by
// house, rebuilt where a new period begins. Then, seen from above, other
// kinds of place in other regions, in colour and with their life moving
// (people, carts, boats; editor/surroundings-life.js) - a glimpse of the
// realistic look and its life.
//
// The layouts are the viewer's own (the same rules, the same seeds); only
// the drawing is the intro's: light enough for a phone. Each house rises
// from the ground when it is built (a vertex shader scales it up from its
// foot); what a new period replaces sinks back, in a wave from the model
// outwards.
//
// Time runs on the viewer's slider of the periods (surroundingsYearToSlider):
// each period gets the same share, as on the slider - a century of the early
// Middle Ages changes about as much as a decade after 1945. Positions below
// are in periods (the slider's value / its steps per period).
//
// What is generated is a typical setting of a kind of place and its time,
// not a reconstruction of this place: the page says so while it shows, a
// comparison only.
//
// The layouts take a while (about 20 ms each, dozens of them), so they are
// worked out in the background a few at a time, long before the chapter.

// How far out it is drawn (metres): the settlement and its fields; the
// ground fades out before the generated hills begin.
const REACH = 260;
// The growth (0-1 of the houses) at the start of the first period shown,
// and at the start of each later one (the place is already there); the
// steps it is worked out at.
const FIRST_GROWTH = 0.35;
const LATER_GROWTH = 0.7;
const GROWTH_STEP = 0.1;
// Periods (positions) over which a house rises or sinks, and the wave's
// spread (from the model to the rim) where a period replaces the last.
const RISE = 0.07;
const SWAP_SPREAD = 0.22;

// The viewer's schematic colours (editor/surroundings.js PALETTE), summer.
const SCHEMATIC = {
  ground: 0xc9c7b8,
  fields: [0xd3cdb2, 0xc4c6a8, 0xbdb9a2],
  road: 0xdcd6c8,
  rail: 0x9a9488,
  walls: [0xd8d2c6],
  masonry: [0xcfc6b8],
  roofs: [0xb3a898],
  conifer: 0x9fae9b,
  broadleaf: 0xb1bda4,
  trunk: 0xb0a696};
// The realistic look, roughly: the building traditions' colours by region
// (as editor/surroundings-realistic.js has them), grass, crops, water.
const REGION_LOOK = {
  central: { walls: [0xe9e2d2, 0xd9cdb5, 0xc9b28c], masonry: [0xb5603f, 0xa65537], roofs: [0xa8462e, 0x8f3b28, 0xb0563a] },
  mediterranean: { walls: [0xeee3c9, 0xe5cfa4, 0xd9b98a], masonry: [0xd8c9a8, 0xcbb894], roofs: [0xc46a3d, 0xb85b33, 0xd27a48] },
  nordic: { walls: [0x8e2a1e, 0xa0381f, 0xc89a3a, 0xe8e2d4], masonry: [0xe8e6e0], roofs: [0x3b3b38, 0x5a4a3a, 0x4f6a3a] },
  british: { walls: [0xb8ad98, 0xa89f8c, 0x9c5a40], masonry: [0xb3aa96, 0xa39a86], roofs: [0x4a4e57, 0x3f434b, 0xb89a5a] },
  eastern: { walls: [0x7a5a3a, 0x8a6a48, 0x6a4c30], masonry: [0xe6e0d4, 0xd8cfbe], roofs: [0xa8905a, 0x8f7a4a, 0x6f8a6a] },
  // Japan: dark timber and white plaster, grey tiles or thatch; rice
  // fields. West Africa: mud walls, thatch; the savanna, millet.
  japanese: { walls: [0x5e4a36, 0xe6e1d6, 0x6e5a44], masonry: [0xe8e4da, 0xd9d4c8], roofs: [0x4a4f57, 0x55595f, 0x8e7b54],
    realistic: { paddy: 0x7fae4a, conifer: 0x2c4a2e, broadleaf: 0x5a7a34 } },
  african: { walls: [0xa8643c, 0xb87a4c, 0xc28c5c], masonry: [0xb47a4e, 0xa86c40], roofs: [0x9a8458, 0x8e7b54, 0xa8643c],
    realistic: { ground: 0x9a8f52, fields: [0xc9a85a, 0xb08850, 0xd4b870, 0xa88a4a], road: 0xb0704a, conifer: 0x6f7a3e, broadleaf: 0x6f7a3e } },
};
const REALISTIC = {
  ground: 0x5f7d3e,
  fields: [0xa8a04a, 0x7f9a45, 0xc2a75a, 0x8a7a42],
  road: 0xa89878,
  rail: 0x4a4238,
  conifer: 0x2f4f2a,
  broadleaf: 0x4f7a32,
  trunk: 0x5a4430,
  water: 0x2f5f7f,
};

const smooth$1 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const later = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A year as a position on the periods' slider (in periods). */
const positionOfYear = (year) => surroundingsYearToSlider(year) / SURROUNDINGS_SLIDER_STEPS;
/** A position (in periods) as a year. */
const yearOfPosition = (position) => surroundingsSliderToYear(position * SURROUNDINGS_SLIDER_STEPS);

/**
 * The periods (the viewer's eras) met between two years, each with its
 * positions shown: [{ period, from, to }] (positions, in periods).
 */
function surroundingsSpans(fromYear, toYear) {
  return SURROUNDINGS_ERAS
    .filter((era) => era.end > fromYear && era.start <= toYear)
    .map((era) => ({
      period: era.period,
      from: positionOfYear(Math.max(fromYear, era.start)),
      to: positionOfYear(Math.min(toYear, era.end)),
    }));
}

/** The dates for a timeline: the first year, each new period's, the last. */
function surroundingsDates(fromYear, toYear) {
  const dates = [fromYear, ...SURROUNDINGS_ERAS.map((era) => era.start).filter((year) => year > fromYear && year < toYear), toYear];
  return [...new Set(dates)];
}

// Collects triangles: positions, colours and, per vertex, the foot it rises
// from, the positions it stands between (born, gone) and its distance from
// the model.
function createWriter() {
  const position = [];
  const color = [];
  const foot = [];
  const life = [];
  const distance = [];
  let current = { foot: 0, born: -1e6, gone: 1e6, distance: 0 };
  const push = (p, c) => {
    position.push(p[0], p[1], p[2]);
    color.push(c.r, c.g, c.b);
    foot.push(current.foot);
    life.push(current.born, current.gone);
    distance.push(current.distance);
  };
  return {
    set(next) { current = { ...current, ...next }; },
    tri(a, b, c, col) { push(a, col); push(b, col); push(c, col); },
    quad(a, b, c, d, col) { push(a, col); push(b, col); push(c, col); push(a, col); push(c, col); push(d, col); },
    geometry() {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(color), 3));
      geometry.setAttribute('aFoot', new BufferAttribute(new Float32Array(foot), 1));
      const clamp = (v) => Math.max(-1e6, Math.min(1e6, v));
      geometry.setAttribute('aLife', new BufferAttribute(new Float32Array(life.map(clamp)), 2));
      geometry.setAttribute('aDist', new BufferAttribute(new Float32Array(distance), 1));
      geometry.computeVertexNormals();
      return geometry;
    },
  };
}

// A house, a church, a station: a box under its roof (as the viewer's
// writeBlock). `m` maps metres (x, y, z) to the intro's space.
function writeBlock(writer, block, m, wall, roof) {
  const cos = Math.cos(block.angle);
  const sin = Math.sin(block.angle);
  const at = (lx, ly, lz) => m(block.x + lx * cos - lz * sin, ly, block.z + lx * sin + lz * cos);
  // Japan's and West Africa's roofs, round houses (surroundings-shapes.js).
  if (hasNewShape(block)) {
    writeBlockShape((points, kind) => {
      const corners = points.map((point) => at(point[0], point[1], point[2]));
      const color = kind === 'wall' || kind === 'gable' ? wall : roof;
      for (let index = 1; index < corners.length - 1; index += 1) writer.tri(corners[0], corners[index], corners[index + 1], color);
    }, block);
    return;
  }
  const hw = block.w / 2;
  const hd = block.d / 2;
  const h = block.h;
  const base = [at(-hw, -0.5, -hd), at(hw, -0.5, -hd), at(hw, -0.5, hd), at(-hw, -0.5, hd)];
  const top = [at(-hw, h, -hd), at(hw, h, -hd), at(hw, h, hd), at(-hw, h, hd)];
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    writer.quad(base[next], base[side], top[side], top[next], wall);
  }
  const rise = h + (block.roofHeight || 0);
  if (block.roof === 'pyramid' || block.roof === 'onion') {
    const apex = at(0, rise, 0);
    for (let side = 0; side < 4; side += 1) writer.tri(top[(side + 1) % 4], top[side], apex, roof);
  } else if (block.roof === 'gable') {
    if (block.ridge === 'w') {
      const r0 = at(-hw, rise, 0);
      const r1 = at(hw, rise, 0);
      writer.quad(top[1], top[0], r0, r1, roof);
      writer.quad(top[3], top[2], r1, r0, roof);
      writer.tri(top[0], top[3], r0, wall);
      writer.tri(top[2], top[1], r1, wall);
    } else {
      const r0 = at(0, rise, -hd);
      const r1 = at(0, rise, hd);
      writer.quad(top[0], top[3], r1, r0, roof);
      writer.quad(top[2], top[1], r0, r1, roof);
      writer.tri(top[1], top[0], r0, wall);
      writer.tri(top[3], top[2], r1, wall);
    }
  } else {
    writer.quad(top[0], top[3], top[2], top[1], roof);
  }
}

// A tree: a cone (a conifer) or a double cone (a broadleaf) on a trunk.
function writeTree(writer, tree, m, crown, trunk) {
  const sides = 5;
  const conifer = tree.kind === 'conifer' || tree.kind === 'cypress';
  const ring = (share, height) => Array.from({ length: sides }, (_item, index) => {
    const angle = (index / sides) * Math.PI * 2 + tree.x;
    return m(tree.x + Math.cos(angle) * tree.r * share, tree.h * height, tree.z + Math.sin(angle) * tree.r * share);
  });
  const fan = (points, tip, tone) => {
    for (let side = 0; side < sides; side += 1) writer.tri(points[(side + 1) % sides], points[side], tip, tone);
  };
  const from = conifer ? 0.15 : 0.3;
  const stem = ring(0.12, 0);
  const stemTop = ring(0.12, from + 0.05);
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    writer.quad(stem[next], stem[side], stemTop[side], stemTop[next], trunk);
  }
  const apex = m(tree.x, tree.h, tree.z);
  if (conifer) {
    fan(ring(1, from), apex, crown);
    return;
  }
  const widest = ring(1, 0.55);
  fan(widest, m(tree.x, tree.h * from, tree.z), crown);
  fan(widest, apex, crown);
}

// A flat strip along a polyline (a road, the railway, a river), lifted a
// little over the ground.
function writeStrip(writer, points, width, lift, m, tone) {
  const half = width / 2;
  const edges = points.map(([x, z], index) => {
    const [px, pz] = points[Math.max(index - 1, 0)];
    const [nx, nz] = points[Math.min(index + 1, points.length - 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1;
    const ox = (-(nz - pz) / length) * half;
    const oz = ((nx - px) / length) * half;
    return [m(x + ox, lift, z + oz), m(x - ox, lift, z - oz)];
  });
  for (let index = 0; index < edges.length - 1; index += 1) {
    writer.quad(edges[index][0], edges[index + 1][0], edges[index + 1][1], edges[index][1], tone);
  }
}

const key = (block) => `${block.role}|${Math.round(block.x * 2)}|${Math.round(block.z * 2)}|${Math.round(block.w)}|${Math.round(block.d)}|${Math.round(block.h)}`;

// Rises from its foot in its time, sinks after it; the whole rises and
// sinks from the model outwards (uShow). Flat things fade instead.
// `tone` darkens the colours (the schematic look: a model town at night).
function riseMaterial(uniforms, { transparent = false, flat = false, tone = 0xffffff, name = '' } = {}) {
  // Both sides: the winding of the shapes is not relied on.
  const material = new MeshStandardMaterial({ color: tone, vertexColors: true, roughness: 1, metalness: 0, transparent, side: DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aFoot;
        attribute vec2 aLife;
        attribute float aDist;
        uniform float uAt;
        uniform float uShow;
        uniform float uSpan;
        varying float vRise;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float rise = smoothstep(aLife.x - ${RISE.toFixed(3)}, aLife.x, uAt)
          * (1.0 - smoothstep(aLife.y, aLife.y + ${RISE.toFixed(3)}, uAt));
        float wave = clamp(aDist / uSpan, 0.0, 1.0);
        rise *= smoothstep(wave * 0.65, wave * 0.65 + 0.35, uShow);
        vRise = rise;
        ${flat ? '' : 'transformed.y = aFoot + (transformed.y - aFoot) * rise;'}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRise;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vRise < 0.004) discard;
        ${flat ? 'diffuseColor.a *= vRise;' : ''}`);
  };
  material.customProgramCacheKey = () => `intro-surroundings-${flat ? 'flat' : 'built'}-${name}`;
  return material;
}

// The ground: a disc fading out at the rim (its colour's alpha); the
// water's colour where the layout has water (a port's sea, a pond).
function groundGeometry({ layout, colourOf, waterColour, toIntro, span }) {
  const ground = createWriter();
  const rings = 36;
  const segments = 96;
  const centre = toIntro(0, 0, 0);
  const at = (ring, segment) => {
    const r = REACH * 1.08 * (ring / rings) ** 1.2;
    const angle = (segment / segments) * Math.PI * 2;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  };
  const wet = (x, z) => layout && waterColour && surroundingsWaterDistance(layout, x, z) < 0;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const corners = [at(ring, segment), at(ring, segment + 1), at(ring + 1, segment + 1), at(ring + 1, segment)];
      const [mx, mz] = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2];
      ground.set({ distance: (span * Math.hypot(mx, mz)) / REACH });
      const tone = wet(mx, mz) ? waterColour : colourOf(mx, mz);
      const [a, b, c, d] = corners.map(([x, z]) => toIntro(x, 0, z));
      ground.quad(a, b, c, d, tone);
    }
  }
  const geometry = ground.geometry();
  const positions = geometry.getAttribute('position');
  const colours = geometry.getAttribute('color');
  const rgba = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i += 1) {
    const d = Math.hypot(positions.getX(i) - centre[0], positions.getZ(i) - centre[2]) / span;
    rgba[i * 4] = colours.getX(i);
    rgba[i * 4 + 1] = colours.getY(i);
    rgba[i * 4 + 2] = colours.getZ(i);
    rgba[i * 4 + 3] = 1 - smooth$1(0.62, 1.05, d);
  }
  geometry.setAttribute('color', new BufferAttribute(rgba, 4));
  return geometry;
}

function meshes(group, uniforms, { ground, flats, built }, look, name) {
  const tones = look === 'realistic' ? [0xb4b4b4, 0xd0d0d0, 0xe0e0e0] : [0x5c5c5c, 0x8a8a8a, 0xc8c8c8];
  const groundMesh = new Mesh(ground, riseMaterial(uniforms, { transparent: true, flat: true, tone: tones[0], name: `${name}-g` }));
  groundMesh.material.polygonOffset = true;
  groundMesh.material.polygonOffsetFactor = 2;
  groundMesh.material.polygonOffsetUnits = 2;
  groundMesh.renderOrder = -3;
  const flatsMesh = new Mesh(flats.geometry(), riseMaterial(uniforms, { transparent: true, flat: true, tone: tones[1], name: `${name}-f` }));
  flatsMesh.renderOrder = -2;
  const builtMesh = new Mesh(built.geometry(), riseMaterial(uniforms, { tone: tones[2], name: `${name}-b` }));
  for (const mesh of [groundMesh, flatsMesh, builtMesh]) {
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
  }
  group.add(groundMesh, flatsMesh, builtMesh);
}

// A deterministic pick from a list (a house keeps its colour).
const pickOf = (list, x, z) => list[Math.abs(Math.round(x * 7.31 + z * 3.17)) % list.length];

/**
 * The settlement through the periods (schematic, a model town).
 * @param {object} options
 *   params     the surroundings' parameters (kind, region, masonry, seed;
 *              editor/surroundings-rules.js normalizeSurroundings)
 *   from, to   the years shown
 *   radius     the model's footprint, its half-diagonal in metres
 *   toIntro    (x, y, z) in metres round the model's middle, y from its
 *              ground -> [x, y, z] in the intro's space
 * @returns {{ group, ready, spans, dates, from, to, update(position, show) }}
 *   positions in periods (positionOfYear); `ready` resolves once drawn
 */
function createIntroSurroundings({ params, from, to, radius, toIntro }) {
  const spans = surroundingsSpans(from, to);
  if (!spans.length) throw new Error(`no generated surroundings for ${from}-${to}`);
  const group = new Group();
  group.name = 'intro-surroundings';
  group.visible = false;
  const uniforms = { uAt: { value: spans[0].from }, uShow: { value: 0 }, uSpan: { value: 1 } };
  const centre = toIntro(0, 0, 0);
  const span = Math.hypot(toIntro(REACH, 0, 0)[0] - centre[0], toIntro(REACH, 0, 0)[2] - centre[2]);
  uniforms.uSpan.value = span;
  let built = false;

  const ready = (async () => {
    const colour = (hex) => new Color(hex);
    const wall = colour(SCHEMATIC.walls[0]);
    const masonry = colour(SCHEMATIC.masonry[0]);
    const roof = colour(SCHEMATIC.roofs[0]);
    const road = colour(SCHEMATIC.road);
    const rail = colour(SCHEMATIC.rail);
    const fields = SCHEMATIC.fields.map(colour);
    const builtWriter = createWriter();
    const flats = createWriter();
    const distanceOf = (x, z) => (Math.hypot(x, z) / REACH) * span;
    const m = (x, y, z) => toIntro(x, y, z);

    // The growth at a position within its period: a third of the houses at
    // the first period's start, most of them at a later period's.
    const growthAt = (s, index, at) => {
      const start = index === 0 ? FIRST_GROWTH : LATER_GROWTH;
      return start + (1 - start) * smooth$1(s.from, Math.max(s.from + 1e-3, s.to), at);
    };
    // Where in a period a growth is reached (the inverse, sampled).
    const positionOf = (s, index, growth) => {
      for (let at = s.from; at <= s.to; at += 0.005) if (growthAt(s, index, at) >= growth - 1e-6) return at;
      return s.to;
    };

    // What each period has, as items: one a period shares with the last
    // (the same house, the same road) stands on through the change instead
    // of sinking and rising again.
    let trees = null;
    let previous = new Map();
    const items = [];
    for (let index = 0; index < spans.length; index += 1) {
      const s = spans[index];
      const last = index === spans.length - 1;
      const year = Math.round((yearOfPosition(s.from) + yearOfPosition(s.to)) / 2);
      const base = { ...params, year, period: s.period, followTimeline: false };
      const firstGrowth = new Map();
      let full = null;
      for (let step = 0; ; step += 1) {
        const growth = Math.min(1, FIRST_GROWTH + step * GROWTH_STEP);
        full = layoutSurroundings({ ...base, growth }, { radius });
        for (const block of full.blocks) if (!firstGrowth.has(key(block))) firstGrowth.set(key(block), growth);
        await later(); // a frame between the layouts
        if (growth >= 1) break;
      }
      const goneAt = (x, z) => (last ? 1e6 : s.to + (Math.hypot(x, z) / REACH) * SWAP_SPREAD);
      const bornAt = (x, z, growth) => {
        const at = positionOf(s, index, growth);
        // A later period's first houses: just after the last period's went.
        return index > 0 && at <= s.from + 1e-3 ? s.from + (Math.hypot(x, z) / REACH) * SWAP_SPREAD + RISE : at;
      };
      const current = new Map();
      const add = (itemKey, kind, x, z, growth, draw) => {
        if (Math.hypot(x, z) > REACH) return;
        const gone = goneAt(x, z);
        const before = previous.get(itemKey);
        if (before) {
          before.gone = gone; // stands on
          current.set(itemKey, before);
          return;
        }
        const item = { kind, x, z, born: index === 0 && growth <= FIRST_GROWTH ? -1e6 : bornAt(x, z, growth), gone, draw };
        items.push(item);
        current.set(itemKey, item);
      };
      for (const block of full.blocks) {
        const timber = block.role === 'house' || block.role === 'barn' || block.role === 'farm';
        add(`b|${key(block)}`, 'built', block.x, block.z, firstGrowth.get(key(block)) ?? 1, () => {
          builtWriter.set({ foot: m(block.x, -0.5, block.z)[1] });
          writeBlock(builtWriter, block, m, timber ? wall : masonry, roof);
        });
      }
      for (const segment of full.walls || []) {
        const x = (segment.ax + segment.bx) / 2;
        const z = (segment.az + segment.bz) / 2;
        add(`w|${Math.round(x)}|${Math.round(z)}|${Math.round(segment.h)}`, 'built', x, z, FIRST_GROWTH, () => {
          builtWriter.set({ foot: m(x, 0, z)[1] });
          writeBlock(builtWriter, {
            x, z, w: Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t, d: segment.t, h: segment.h,
            angle: Math.atan2(segment.bz - segment.az, segment.bx - segment.ax), roof: 'none',
          }, m, masonry, masonry);
        });
      }
      for (const field of full.fields) {
        if (field.polygon || Math.hypot(field.x, field.z) > REACH * 0.95) continue;
        add(`f|${Math.round(field.x)}|${Math.round(field.z)}|${Math.round(field.w)}|${Math.round(field.d)}`, 'flat', field.x, field.z, FIRST_GROWTH, () => {
          writeField(flats, field, m, fields[field.tone % fields.length]);
        });
      }
      const strip = (prefix, points, width, lift, tone) => {
        const near = points.filter(([x, z]) => Math.hypot(x, z) < REACH * 1.05);
        if (near.length < 2) return;
        const [x, z] = near[Math.floor(near.length / 2)];
        const r = Math.min(Math.hypot(x, z), REACH - 1);
        const angle = Math.atan2(z, x);
        add(`${prefix}|${near.map(([px, pz]) => `${Math.round(px)},${Math.round(pz)}`).join(';')}`, 'flat', r * Math.cos(angle), r * Math.sin(angle), FIRST_GROWTH,
          () => writeStrip(flats, near, width, lift, m, tone));
      };
      for (const way of full.roads) strip('r', way.points, way.width, 0.3, road);
      if (full.railway) strip('rail', full.railway.points, 4.2, 0.45, rail);
      trees ??= full.trees;
      previous = current;
    }
    for (const item of items) {
      const writer = item.kind === 'built' ? builtWriter : flats;
      writer.set({ foot: 0, born: item.born, gone: item.gone, distance: distanceOf(item.x, item.z) });
      item.draw();
    }
    // The trees stand through it all, thinning out towards the rim.
    builtWriter.set({ born: -1e6, gone: 1e6 });
    writeTrees(builtWriter, trees, toIntro, distanceOf, colour(SCHEMATIC.conifer), colour(SCHEMATIC.broadleaf), colour(SCHEMATIC.trunk));
    const ground = groundGeometry({ layout: null, colourOf: () => colour(SCHEMATIC.ground), toIntro, span });
    meshes(group, uniforms, { ground, flats, built: builtWriter }, 'schematic', 'run');
    built = true;
  })();
  ready.catch((error) => console.warn('[intro] surroundings:', error));

  return {
    group,
    ready,
    spans,
    from: spans[0].from,
    to: spans.at(-1).to,
    dates: surroundingsDates(from, to),
    /** The period at a position: its key (SURROUNDINGS_ERAS). */
    periodAt(position) {
      return (spans.find((s, index) => position < s.to || index === spans.length - 1) || spans[0]).period;
    },
    /**
     * @param {number} position  where on the periods' slider (in periods)
     * @param {number} show      0..1: rising out of the ground from the
     *   model outwards (0: gone)
     */
    update(position, show) {
      uniforms.uAt.value = position;
      uniforms.uShow.value = show;
      group.visible = built && show > 0.001;
    },
  };
}

function writeField(writer, field, m, tone) {
  const cos = Math.cos(field.angle);
  const sin = Math.sin(field.angle);
  const corner = (lx, lz) => m(field.x + lx * cos - lz * sin, 0.15, field.z + lx * sin + lz * cos);
  const hw = field.w / 2;
  const hd = field.d / 2;
  writer.quad(corner(-hw, -hd), corner(-hw, hd), corner(hw, hd), corner(hw, -hd), tone);
}

function writeTrees(writer, trees, toIntro, distanceOf, conifer, broadleaf, trunk) {
  for (const tree of trees || []) {
    const distance = Math.hypot(tree.x, tree.z);
    const size = 1 - smooth$1(REACH * 0.7, REACH, distance);
    if (size < 0.25) continue;
    writer.set({ foot: toIntro(tree.x, 0, tree.z)[1], distance: distanceOf(tree.x, tree.z) });
    writeTree(writer, { ...tree, h: tree.h * size, r: tree.r * size }, toIntro,
      tree.kind === 'conifer' || tree.kind === 'cypress' ? conifer : broadleaf, trunk);
  }
}

// --- Other kinds of place, other regions: in colour, with their life --------

// The figures (as editor/surroundings-life-mesh.js), facing +Z; larger than
// life, so they show from above. White parts take the instance's colour.
const FIGURE_SCALE = 2.6;
function part(w, h, d, x, y, z, colour) {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  const value = new Color(colour);
  const colours = new Float32Array(geometry.attributes.position.count * 3);
  for (let index = 0; index < geometry.attributes.position.count; index += 1) value.toArray(colours, index * 3);
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  geometry.deleteAttribute('uv');
  return geometry;
}
const SHAPES = {
  person: () => mergeGeometries([part(0.46, 0.75, 0.3, 0, 1.12, 0, 0xffffff), part(0.4, 0.75, 0.26, 0, 0.38, 0, 0x5a5a5a), part(0.24, 0.26, 0.24, 0, 1.64, 0, 0xd9b49a)]),
  cart: () => mergeGeometries([part(1.4, 0.55, 2.4, 0, 0.95, 0, 0x7b5b3e), part(0.5, 0.9, 1.7, 0, 1.15, 2.2, 0x5a3e2a)]),
  car: () => mergeGeometries([part(1.7, 0.75, 4, 0, 0.6, 0, 0xffffff), part(1.5, 0.55, 2, 0, 1.25, -0.2, 0x2a3036)]),
  rowing: () => mergeGeometries([part(1.3, 0.45, 4.2, 0, 0.1, 0, 0x6a4a32), part(0.5, 0.9, 0.4, 0, 0.7, -0.4, 0xffffff)]),
  sail: () => mergeGeometries([part(2.2, 0.8, 7.5, 0, 0.2, 0, 0x5a3e2a), part(0.15, 6.5, 0.15, 0, 3.8, 0.5, 0x4a3424), part(0.06, 4.8, 3.2, 0, 4.2, -0.6, 0xeee6d2)]),
  motor: () => mergeGeometries([part(1.9, 0.6, 5.2, 0, 0.2, 0, 0xf2f2f2), part(1.4, 0.8, 1.6, 0, 0.9, -0.6, 0x2f5f8f)]),
};
const PAINT = [0x8a2f2f, 0x2f4f7a, 0xd8d8d0, 0x3f3f3f, 0x6f8f4f, 0xc9a24a];

// The life of a layout, moving: an instanced mesh a kind of figure, placed
// in the intro's space each frame. `scale`: intro units a metre.
function createLife(layout, toIntro, scale) {
  const plan = planSurroundingsLife(layout, { light: true });
  const group = new Group();
  const material = new MeshLambertMaterial({ vertexColors: true });
  const entries = [];
  const add = (shape, list, colourOf) => {
    const near = list.filter((agent) => agent.path.points.some(([x, z]) => Math.hypot(x, z) < REACH));
    if (!near.length) return;
    const mesh = new InstancedMesh(SHAPES[shape](), material, near.length);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    const colour = new Color();
    near.forEach((agent, index) => mesh.setColorAt(index, colour.set(colourOf(agent, index))));
    group.add(mesh);
    entries.push({ mesh, list: near });
  };
  add('person', plan.people, (agent) => agent.colour);
  add('cart', plan.vehicles.filter((agent) => agent.kind === 'cart'), () => 0xffffff);
  add('car', plan.vehicles.filter((agent) => agent.kind === 'car'), (_agent, index) => PAINT[index % PAINT.length]);
  for (const kind of ['rowing', 'sail', 'motor']) add(kind, plan.boats.filter((agent) => agent.kind === kind), () => 0x8a7b62);
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const position = new Vector3();
  const size = new Vector3().setScalar(scale * FIGURE_SCALE);
  return {
    group,
    count: entries.reduce((sum, entry) => sum + entry.list.length, 0),
    update(seconds) {
      for (const { mesh, list } of entries) {
        list.forEach((agent, index) => {
          // Walking faster than life, so it reads at this distance.
          const at = lifeAt(agent.path, agent.start + agent.speed * seconds * 3, agent.loop === true);
          const side = agent.side || 0;
          const x = at.x - Math.sin(at.heading) * side;
          const z = at.z + Math.cos(at.heading) * side;
          const [px, py, pz] = toIntro(x, 0.1, z);
          rotation.setFromAxisAngle(up, Math.PI / 2 - at.heading);
          mesh.setMatrixAt(index, matrix.compose(position.set(px, py, pz), rotation, size));
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

/**
 * Other kinds of place in other regions, one after another, in colour and
 * with their life moving.
 * @param {object} options
 *   variants   [{ kind, region, year, masonry? }]
 *   seed       the layouts' seed
 *   radius, toIntro  as createIntroSurroundings
 * @returns {{ group, ready, variants, update(index, show, seconds) }}
 */
function createSurroundingsShowcase({ variants, seed = 3, radius, toIntro }) {
  const group = new Group();
  group.name = 'intro-surroundings-showcase';
  group.visible = false;
  const centre = toIntro(0, 0, 0);
  const span = Math.hypot(toIntro(REACH, 0, 0)[0] - centre[0], toIntro(REACH, 0, 0)[2] - centre[2]);
  const scale = span / REACH;
  const built = [];
  const ready = (async () => {
    for (const [index, variant] of variants.entries()) {
      await later();
      const layout = layoutSurroundings({
        kind: variant.kind, region: variant.region, year: variant.year, seed: seed + index * 17,
        masonry: variant.masonry || (variant.region === 'central' || variant.region === 'eastern' ? 'brick' : 'stone'),
        style: 'realistic', growth: 1,
      }, { radius });
      const look = REGION_LOOK[variant.region] || REGION_LOOK.central;
      const colour = (hex) => new Color(hex);
      const tones = (list) => list.map(colour);
      const walls = tones(look.walls);
      const masonry = tones(look.masonry);
      const roofs = tones(look.roofs);
      const tone = { ...REALISTIC, ...(look.realistic || {}) };
      const fields = tones(tone.fields);
      const builtWriter = createWriter();
      const flats = createWriter();
      const distanceOf = (x, z) => (Math.hypot(x, z) / REACH) * span;
      for (const block of layout.blocks) {
        if (Math.hypot(block.x, block.z) > REACH) continue;
        const timber = block.role === 'house' || block.role === 'barn' || block.role === 'farm';
        builtWriter.set({ foot: toIntro(block.x, -0.5, block.z)[1], distance: distanceOf(block.x, block.z) });
        writeBlock(builtWriter, block, toIntro, pickOf(timber ? walls : masonry, block.x, block.z), pickOf(roofs, block.z, block.x));
      }
      for (const segment of layout.walls || []) {
        const x = (segment.ax + segment.bx) / 2;
        const z = (segment.az + segment.bz) / 2;
        if (Math.hypot(x, z) > REACH) continue;
        builtWriter.set({ foot: toIntro(x, 0, z)[1], distance: distanceOf(x, z) });
        writeBlock(builtWriter, {
          x, z, w: Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t, d: segment.t, h: segment.h,
          angle: Math.atan2(segment.bz - segment.az, segment.bx - segment.ax), roof: 'none',
        }, toIntro, masonry[0], masonry[0]);
      }
      writeTrees(builtWriter, layout.trees, toIntro, distanceOf, colour(tone.conifer), colour(tone.broadleaf), colour(tone.trunk));
      for (const field of layout.fields) {
        if (field.polygon || Math.hypot(field.x, field.z) > REACH * 0.95) continue;
        flats.set({ distance: distanceOf(field.x, field.z) });
        writeField(flats, field, toIntro, field.paddy && tone.paddy ? colour(tone.paddy) : fields[field.tone % fields.length]);
      }
      const strip = (points, width, lift, tone) => {
        const near = points.filter(([x, z]) => Math.hypot(x, z) < REACH * 1.05);
        if (near.length < 2) return;
        flats.set({ distance: distanceOf(...near[Math.floor(near.length / 2)]) });
        writeStrip(flats, near, width, lift, toIntro, tone);
      };
      for (const way of layout.roads) strip(way.points, way.width, 0.3, colour(tone.road));
      if (layout.railway) strip(layout.railway.points, 4.2, 0.45, colour(REALISTIC.rail));
      if (layout.water.river) strip(layout.water.river.points, layout.water.river.width, 0.25, colour(REALISTIC.water));
      const grass = colour(tone.ground);
      const ground = groundGeometry({ layout, colourOf: () => grass, waterColour: colour(tone.water), toIntro, span });
      const uniforms = { uAt: { value: 0 }, uShow: { value: 0 }, uSpan: { value: span } };
      const variantGroup = new Group();
      variantGroup.visible = false;
      meshes(variantGroup, uniforms, { ground, flats, built: builtWriter }, 'realistic', `v${index}`);
      const life = createLife(layout, toIntro, scale);
      variantGroup.add(life.group);
      group.add(variantGroup);
      built[index] = { group: variantGroup, uniforms, life };
    }
  })();
  ready.catch((error) => console.warn('[intro] surroundings, the other places:', error));
  return {
    group,
    ready,
    variants,
    /**
     * @param {number[]} shows  0..1 for each variant (rising and sinking)
     * @param {number} seconds  the clock, for the life's moving
     */
    update(shows, seconds) {
      let any = false;
      shows.forEach((show, index) => {
        const entry = built[index];
        if (!entry) return;
        entry.uniforms.uShow.value = show;
        entry.group.visible = show > 0.001;
        // The figures appear once their place has risen.
        entry.life.group.visible = show > 0.85;
        if (entry.life.group.visible) entry.life.update(seconds);
        any ||= entry.group.visible;
      });
      group.visible = any;
    },
  };
}

// The intro's third act (viewer/intro/intro.js): once the model stands, an
// express tour of what the viewer does with it, each chapter a few seconds
// with its name under the title:
//
//   1. sections      - a plane sweeps in from the front, the cut glows
//   2. annotations   - pins with labels, and a height measurement
//   3. shading       - wipes through textures, PBR (glossy), raking light
//   4. sun study     - the sun's real path over the site on midsummer day, the
//                      sun itself and its track in the sky, a compass on the
//                      ground, shadows; the camera holds still meanwhile
//   5. seasons       - spring petals, summer, autumn leaves, winter snow
//   6. cameras       - the scene's cameras as the viewer draws them
//                      (pyramids, as Blender does); one is chosen and its
//                      view opens in a frame beside the model
//   7. live          - cooperation mode: a phone with a second session of
//                      the scene; a finger turns the model on the phone and
//                      the screen follows, live
//   8. time travel   - the 4D model's stages (the pagoda: 1615 to 2025):
//                      back to the building's new timber and fresh paint,
//                      then year by year its ageing and repairs, a warm front sweeping up the walls
//                      at each stage, the year on a timeline of dates
//                      (textures from scripts/build-pagoda-examples.mjs)
//   9. surroundings  - the camera rises and draws back: the viewer's
//                      generated surroundings grow round the model through
//                      all the periods they cover, 900 to 2025
//                      (intro-surroundings.js), each period the same time,
//                      houses rising as the place grows, rebuilt where a
//                      period begins; the building's own stage follows the
//                      year, a timeline shows the periods' dates. Then other
//                      kinds of place in other regions, in colour and with
//                      their life moving. A badge says it is a comparison:
//                      how the building might look in other surroundings.
//
// Like the rest of the intro, update(tour) is a function of the tour's time
// only (it runs backwards for "Assemble again", ?at= holds it).

// Seconds into the tour.
const ALL_CHAPTERS = [
  { key: 'section', from: 0, to: 3.0 },
  { key: 'annotations', from: 3.0, to: 6.4 },
  { key: 'shading', from: 6.4, to: 10.0 },
  { key: 'sun', from: 10.0, to: 14.8 },
  { key: 'seasons', from: 14.8, to: 24.0 },
  { key: 'cameras', from: 24.0, to: 27.8 },
  { key: 'live', from: 27.8, to: 32.6 },
  { key: 'time', from: 32.6, to: 41.6 },
  { key: 'surroundings', from: 41.6, to: 71.0 },
];
const TAIL = 0.6; // after the last chapter, before 'end'

// The chapters for a scene (intro-scene.js): the time travel only with a
// 4D model's stages. { chapters, length } - the length in seconds.
// The surroundings only with the scene's (intro-scene.js `surroundings`).
// A chapter left out leaves no gap: the later ones move up.
function tourPlan({ time = true, surroundings = true } = {}) {
  const chapters = [];
  let shift = 0;
  for (const chapter of ALL_CHAPTERS) {
    if ((chapter.key === 'time' && !time) || (chapter.key === 'surroundings' && !surroundings)) {
      shift += chapter.to - chapter.from;
      continue;
    }
    chapters.push(shift ? { ...chapter, from: chapter.from - shift, to: chapter.to - shift } : chapter);
  }
  return { chapters, length: chapters.at(-1).to + TAIL };
}
tourPlan();

// The camera through the model's act (intro.js), a function of its time
// only - not of how many frames were drawn - so every run looks the same:
//   - it turns on from the landing and comes to the front for the sections
//     (the plane sweeps in from +Z), holding still while it cuts;
//   - it turns slowly on through the annotations and the shading, and holds
//     still again for the sun study (its shadows turn with the sun only);
//   - in cooperation mode it follows the phone's finger: a turn one way, a
//     pause, a shorter turn back (LIVE_SWIPES);
//   - for the time travel it starts at the front's right (seen from the
//     front, +X) and goes round in an arc towards the entrance in the middle
//     of the front, a little closer; then it turns on as before.
// Angles are Spherical.theta around the model (0: from +Z, +X at pi / 2).
const SECTION_THETA = 0;
const TIME_FROM_THETA = 0.95;
const TIME_TO_THETA = 0.08;
// The time travel's distance, of the camera's own.
const TIME_DOLLY = 0.84;
// The surroundings: how far out the camera draws back (of its own
// distance), how long it takes, and how far it turns meanwhile.
const SURROUNDINGS_DOLLY = 4.4;
const SURROUNDINGS_MOVE = 1.8;
const SURROUNDINGS_TURN = 1.3;
// Their chapter, seconds into it: rising out of the ground, the periods
// running (each the same time), a moment at the end, then the other places
// (each so long, overlapping the next by SHOWCASE_SWAP), sinking at the end.
const SURROUNDINGS_IN = 1.2;
const SURROUNDINGS_RUN = 14;
const SURROUNDINGS_HOLD = 0.8;
const SHOWCASE_EACH = 3.0;
const SHOWCASE_SWAP = 1.0;
const SURROUNDINGS_OUT = 1.2;
// The sun study's angle, and cooperation mode's before the finger turns it.
const SUN_THETA = 0.3;
const LIVE_THETA = 0.75;
// Cooperation mode: the finger's swipes on the phone, seconds into the
// chapter, and how far each turns the model (radians).
const LIVE_SWIPES = [
  { from: 0.7, to: 1.9, turn: 0.7 },
  { from: 2.3, to: 3.3, turn: -0.4 },
];

/**
 * @param {object} options
 *   plan       tourPlan()
 *   front      the angle at the landing (the scene's front)
 *   rate       radians a second it turns at the landing (and between holds)
 *   tourStart  seconds from the model's act to the tour's first chapter
 * @returns {(s: number) => { theta: number, dolly: number, tilt: number, sun: number }}
 *   at s seconds into the model's act: the angle, the distance as a share of
 *   the camera's own, and how far it looks down from above (0-1, the
 *   surroundings' overview), and how far into the sun study (0-1: a
 *   narrow screen draws back for it, intro.js).
 */
function tourCameraPath({ plan = tourPlan(), front = 0, rate, tourStart }) {
  const chapter = (key) => plan.chapters.find((c) => c.key === key);
  const nearest = (angle, to) => angle + Math.round((to - angle) / (2 * Math.PI)) * 2 * Math.PI;
  // [s, theta, slope]: a smooth (Hermite) curve through them.
  const keys = [[0, front, -rate]];
  const section = chapter('section');
  const sun = chapter('sun');
  const time = chapter('time');
  const live = chapter('live');
  const surroundings = chapter('surroundings');
  const last = plan.chapters.at(-1);
  const base = nearest(SECTION_THETA, front - rate * tourStart);
  if (section) {
    keys.push([tourStart + section.from - 0.3, base, 0], [tourStart + section.to - 0.2, base, 0]);
  }
  const moving = keys.at(-1)[0];
  // The sun study's angle: part of the way to the time travel's start.
  if (sun) {
    const sunFrom = tourStart + sun.from - 0.3;
    const sunTo = tourStart + sun.from + SUN_LENGTH;
    const end = time ? tourStart + time.from : tourStart + last.to;
    const share = (sunFrom - moving) / Math.max(1e-3, sunFrom - moving + end - sunTo);
    const sunTheta = base + (live ? SUN_THETA : (time ? TIME_FROM_THETA : 0.6) * share);
    keys.push([sunFrom, sunTheta, 0], [sunTo, sunTheta, 0]);
  }
  // Cooperation mode: still, then turned by the phone's finger.
  if (live) {
    let theta = base + LIVE_THETA;
    keys.push([tourStart + live.from + LIVE_SWIPES[0].from, theta, 0]);
    for (const swipe of LIVE_SWIPES) {
      theta += swipe.turn;
      keys.push([tourStart + live.from + swipe.to, theta, 0]);
    }
  }
  if (time) {
    keys.push([tourStart + time.from, base + TIME_FROM_THETA, 0], [tourStart + time.to, base + TIME_TO_THETA, -rate]);
  }
  if (surroundings) {
    // Turning on slowly while it draws back over the settlement.
    keys.push([tourStart + surroundings.to, keys.at(-1)[1] - SURROUNDINGS_TURN, -rate]);
  } else if (!time) {
    keys.push([tourStart + last.to, keys.at(-1)[1] + 0.6, rate]);
  }
  const timeDolly = (s) => (time ? 1 - (1 - TIME_DOLLY) * window01(s - tourStart, time.from, time.to + 1.5, 1.5) : 1);
  // The surroundings: up and back, and down again at the end.
  const overview = (s) => (surroundings ? window01(s - tourStart, surroundings.from + 0.1, surroundings.to - 0.2, SURROUNDINGS_MOVE) : 0);
  // The sun study (a narrow screen draws back a little for it).
  const sunWindow = (s) => (sun ? window01(s - tourStart, sun.from, sun.from + SUN_LENGTH, 0.8) : 0);
  const dollyAt = (s) => {
    const o = overview(s);
    return timeDolly(s) * (1 - o) + SURROUNDINGS_DOLLY * o;
  };
  return (s) => {
    let theta;
    if (s <= keys[0][0]) theta = keys[0][1] + keys[0][2] * (s - keys[0][0]);
    else if (s >= keys.at(-1)[0]) theta = keys.at(-1)[1] + keys.at(-1)[2] * (s - keys.at(-1)[0]);
    else {
      let i = 0;
      while (s > keys[i + 1][0]) i++;
      const [s0, p0, m0] = keys[i];
      const [s1, p1, m1] = keys[i + 1];
      const h = s1 - s0;
      const u = (s - s0) / h;
      const u2 = u * u;
      const u3 = u2 * u;
      theta = (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
    }
    return { theta, dolly: dollyAt(s), tilt: overview(s), sun: sunWindow(s) };
  };
}

// Shading: [from, to] modes, each step a wipe (see mesh-reveal.js introShade).
const SHADING_STEPS = [[0, 1], [1, 2], [2, 0]];
const SHADING_KEYS = ['textures', 'pbr', 'raking'];
const SHADING_LENGTH = 3.6;
// Seasons: each this long, then back to the textures' own colours.
const SEASON_LENGTH = 2.2;
const SEASONS_END = 4 * SEASON_LENGTH;

// The sun study without a scene's own site: Nara, midsummer day, local time
// (UTC+9) - the pagoda's (intro-scene.js DEFAULT_SCENE). The model's north
// is taken to be -Z (the viewer's default, AIM3DViewer location.north = 0).
const DEFAULT_SITE = { latitude: 34.68, longitude: 135.83, utcOffset: 9, north: 0, month: 6, day: 21 };
const SUN_LENGTH = 4.8;
// The sun's track around the building's middle, this far out (intro units).
const SUN_RADIUS = 2.5;
// The compass ring on the ground.
const COMPASS_RADIUS = 2.15;
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

// Time travel: the 4D model's stages (viewer/intro/time/time.json).
const DEFAULT_TIME_URL = 'assets/intro/time/';
// Back from today to the first stage, then each stage in turn, each step as
// long as the years it spans (at least TIME_MIN_STEP: a repair a year later
// still shows), all of them TIME_STEPS seconds; most of each step is the
// change itself.
const TIME_REWIND = 1.0;
const TIME_STEPS = 7.2;
const TIME_MIN_STEP = 0.4;
const TIME_SWEEP = 0.75;
// The steps for the stages: [{ start, length }] for step i (stage i - 1 to
// stage i, i >= 1), seconds after the rewind.
function timeSteps(stages) {
  const gaps = stages.slice(1).map((stage, i) => Math.max(0, stage.year - stages[i].year));
  const total = gaps.reduce((sum, gap) => sum + gap, 0) || 1;
  const spare = Math.max(0, TIME_STEPS - TIME_MIN_STEP * gaps.length);
  const steps = [null];
  let start = 0;
  for (const gap of gaps) {
    const length = TIME_MIN_STEP + (spare * gap) / total;
    steps.push({ start, length });
    start += length;
  }
  return steps;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const window01 = (x, a, b, fade) => smooth((x - a) / fade) * (1 - smooth((x - b + fade) / fade));

/**
 * @param {object} options
 *   reveal      the model (mesh-reveal.js)
 *   camera, renderer
 *   root        the page's #intro element (labels and the chapter title go in)
 *   texts       the page's texts: texts.tour.*
 *   toIntro     (x, y, z) in the model's units -> Vector3 in the intro's space
 *   heightLabel the measured height, formatted
 *   footprint   the model's footprint, its half-diagonal in metres
 *   bounds      { min, max }: the model's box in the intro's space (the
 *               section plane covers its front, a little beyond)
 */
function createFeatureTour({ reveal, camera, renderer, root, texts, toIntro, heightLabel, lang, scene = {}, plan = tourPlan(), footprint = 20, bounds = null }) {
  const u = reveal.uniforms;
  const group = new Group();
  const CHAPTERS = plan.chapters;
  const TOUR_LENGTH = plan.length;
  const START = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.key, chapter.from]));
  // A fixed year: the same sun on every run (stills, recordings).
  const SITE = { ...(scene.site || DEFAULT_SITE), year: 2026 };
  const TIME_URL = scene.time === undefined ? DEFAULT_TIME_URL : scene.time;
  const ground = scene.ground ?? 0;

  // --- Time travel: the stages and their textures, loaded in the background --
  let timeTravel = null; // { stages, parts: { part: { materials, fresh, mid } } }
  (async () => {
    if (!TIME_URL) return;
    const response = await fetch(`${TIME_URL}time.json`);
    if (!response.ok) throw new Error(`${TIME_URL}time.json: HTTP ${response.status}`);
    const data = await response.json();
    const loader = new TextureLoader();
    const parts = {};
    for (const [part, materialName] of Object.entries(data.parts)) {
      const materials = (reveal.timeTargets[materialName] || []).filter((m) => m.userData.originalMap);
      if (!materials.length) continue;
      const original = materials[0].userData.originalMap;
      const load = async (variant) => {
        const texture = await loader.loadAsync(`${TIME_URL}${part}_${variant}.webp`);
        texture.flipY = false; // glTF's convention, as the model's own
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = original.wrapS;
        texture.wrapT = original.wrapT;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        return texture;
      };
      const [fresh, mid] = await Promise.all([load('fresh'), load('mid')]);
      parts[part] = { materials, fresh, mid };
    }
    timeTravel = { stages: data.stages, parts, steps: timeSteps(data.stages) };
  })().catch((error) => console.warn('[intro] time travel:', error));

  // A stage's texture for a part ("old": the model's own).
  const textureFor = (part, variant) => (variant === 'fresh' ? part.fresh : variant === 'mid' ? part.mid : null);
  // Today (the model as it is): every part old.
  const TODAY = { parts: {} };
  function setTime(from, to, front, glow) {
    for (const [name, part] of Object.entries(timeTravel.parts)) {
      const a = from.parts[name] || 'old';
      const b = to.parts[name] || 'old';
      for (const material of part.materials) {
        material.map = textureFor(part, a) || material.userData.originalMap;
        material.userData.time.uMapNext.value = textureFor(part, b) || material.userData.originalMap;
        material.userData.time.uTimeChange.value = a === b ? 0 : 1;
      }
    }
    u.uTimeActive.value = 1;
    u.uTimeFront.value = front;
    u.uTimeGlow.value = glow;
  }
  function resetTime() {
    if (u.uTimeActive.value === 0 || !timeTravel) return;
    for (const part of Object.values(timeTravel.parts)) {
      for (const material of part.materials) {
        material.map = material.userData.originalMap;
        material.userData.time.uTimeChange.value = 0;
      }
    }
    u.uTimeActive.value = 0;
    u.uTimeGlow.value = 0;
  }
  const tx = texts.tour;

  // --- Section plane ----------------------------------------------------------
  const planeMaterial = new ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uCells: { value: new Vector2(14, 10) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform vec2 uCells;
      varying vec2 vUv;
      void main() {
        vec2 g = abs(fract(vUv * uCells) - 0.5);
        float grid = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
        float edge = 1.0 - smoothstep(0.0, 0.01, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        vec3 color = vec3(0.35, 0.65, 1.0) * (0.05 + grid * 0.12 + edge * 0.7);
        gl_FragColor = vec4(color * uAlpha, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  // Facing +z, the front: the camera looks at it nearly head-on. As wide and
  // as high as the model's box and a little more, from its foot to its top;
  // it sweeps from just in front of the model to just behind its middle.
  const box = bounds ?? { min: new Vector3(-1.8, -0.675, -1.75), max: new Vector3(1.8, 1.275, 1.75) };
  const boxSize = box.max.clone().sub(box.min);
  const plane = new Mesh(new PlaneGeometry(1, 1), planeMaterial);
  plane.scale.set(boxSize.x * 1.12, boxSize.y * 1.08, 1);
  // Square cells, 14 across.
  planeMaterial.uniforms.uCells.value.set(14, Math.max(1, Math.round((14 * plane.scale.y) / plane.scale.x)));
  const planeY = (box.min.y + box.max.y) / 2;
  const cutFrom = box.max.z + 0.05;
  const cutTo = (box.min.z + box.max.z) / 2 - boxSize.z * 0.06;
  plane.renderOrder = 5;
  group.add(plane);

  // --- Annotations ------------------------------------------------------------
  // The scene's pins (model units), one after another.
  const pins = (scene.pins || []).map((pin, index) => ({
    key: pin.key,
    kind: pin.kind,
    at: toIntro(...pin.at),
    lift: pin.lift,
    delay: index * 0.45,
  }));
  const measure = scene.measure;
  const measureBottom = toIntro(measure.x, measure.from, measure.z);
  const measureTop = toIntro(measure.x, measure.to, measure.z);
  const lineMaterial = new LineBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0, depthTest: false });
  const linePositions = [];
  for (const pin of pins) {
    pin.top = pin.at.clone().add(new Vector3(0, pin.lift, 0));
    linePositions.push(...pin.at.toArray(), ...pin.top.toArray());
  }
  const tick = 0.07;
  linePositions.push(
    ...measureBottom.toArray(), ...measureTop.toArray(),
    measureBottom.x - tick, measureBottom.y, measureBottom.z, measureBottom.x + tick, measureBottom.y, measureBottom.z,
    measureTop.x - tick, measureTop.y, measureTop.z, measureTop.x + tick, measureTop.y, measureTop.z,
  );
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', new BufferAttribute(new Float32Array(linePositions), 3));
  const lines = new LineSegments(lineGeometry, lineMaterial);
  lines.renderOrder = 6;
  group.add(lines);
  // The pins' heads: soft dots, drawn over everything.
  const dotGeometry = new BufferGeometry();
  dotGeometry.setAttribute('position', new BufferAttribute(new Float32Array(pins.flatMap((pin) => pin.at.toArray())), 3));
  const dotUniforms = { uAlpha: { value: 0 }, uViewport: { value: 800 }, uTime: { value: 0 } };
  const dots = new Points(dotGeometry, new ShaderMaterial({
    uniforms: dotUniforms,
    vertexShader: /* glsl */ `
      uniform float uViewport;
      uniform float uTime;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.07 + 0.015 * sin(uTime * 4.0)) * uViewport / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = dot(uv, uv);
        float ring = exp(-pow((sqrt(r) - 0.75) / 0.12, 2.0));
        float core = exp(-r * 18.0);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * (core + ring * 0.8) * uAlpha, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  dots.frustumCulled = false;
  dots.renderOrder = 7;
  group.add(dots);
  // Labels: HTML, placed at the leaders' tops every frame.
  const makeLabel = (text, extra) => {
    const el = document.createElement('div');
    el.className = `intro-label ${extra || ''}`;
    el.textContent = text;
    root.appendChild(el);
    return el;
  };
  for (const pin of pins) pin.label = makeLabel(tx.labels?.[pin.key] ?? '', pin.kind === 'poi' ? 'is-poi' : 'is-annotation');
  const measureLabel = makeLabel(heightLabel, 'is-measure');

  // --- Chapter title ----------------------------------------------------------
  const chapter = document.createElement('div');
  chapter.className = 'intro-chapter';
  chapter.innerHTML = '<span class="intro-chapter-index"></span><span class="intro-chapter-title"></span><span class="intro-chapter-sub"></span>';
  root.appendChild(chapter);
  const chapterIndex = chapter.children[0];
  const chapterTitle = chapter.children[1];
  const chapterSub = chapter.children[2];

  // --- Weather: petals, pollen, leaves, snow ------------------------------------
  const FLAKES = 2600;
  const flakePositions = new Float32Array(FLAKES * 3);
  const flakeSeeds = new Float32Array(FLAKES * 4);
  for (let i = 0; i < FLAKES; i++) {
    flakePositions[i * 3] = (Math.random() - 0.5) * 4.6;
    flakePositions[i * 3 + 1] = Math.random() * 3.2;
    flakePositions[i * 3 + 2] = (Math.random() - 0.5) * 4.6;
    for (let k = 0; k < 4; k++) flakeSeeds[i * 4 + k] = Math.random();
  }
  const flakeGeometry = new BufferGeometry();
  flakeGeometry.setAttribute('position', new BufferAttribute(flakePositions, 3));
  flakeGeometry.setAttribute('aSeed', new BufferAttribute(flakeSeeds, 4));
  const flakeUniforms = {
    uTime: { value: 0 },
    uAlpha: { value: 0 },
    uViewport: { value: 800 },
    uSpeed: { value: 0.3 },
    uSway: { value: 0.2 },
    uSize: { value: 0.03 },
    uColorA: { value: new Color() },
    uColorB: { value: new Color() },
    uFlat: { value: 0 },
    uBottom: { value: toIntro(0, ground, 0).y },
  };
  const flakes = new Points(flakeGeometry, new ShaderMaterial({
    uniforms: flakeUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uViewport;
      uniform float uSpeed;
      uniform float uSway;
      uniform float uSize;
      uniform float uBottom;
      attribute vec4 aSeed;
      varying vec4 vSeed;
      void main() {
        vec3 p = position;
        float fall = uTime * uSpeed * (0.7 + aSeed.x * 0.6);
        p.y = uBottom + mod(p.y - fall, 3.2);
        p.x += sin(uTime * (0.8 + aSeed.y) + aSeed.z * 20.0) * uSway;
        p.z += cos(uTime * (0.7 + aSeed.z) + aSeed.y * 20.0) * uSway;
        vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, uSize * (0.6 + aSeed.w * 0.8) * uViewport / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uFlat;
      varying vec4 vSeed;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        // Leaves and petals: a turning ellipse; snow and pollen: round.
        float a = uTime * (1.0 + vSeed.x * 2.0) + vSeed.y * 6.28;
        vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;
        r.y *= mix(1.0, 2.2, uFlat);
        float d = dot(r, r);
        if (d > 1.0) discard;
        float shape = mix(exp(-d * 2.5), 1.0 - smoothstep(0.7, 1.0, d), uFlat);
        vec3 color = mix(uColorA, uColorB, vSeed.z);
        gl_FragColor = vec4(color, shape * uAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  }));
  flakes.frustumCulled = false;
  flakes.renderOrder = 4;
  group.add(flakes);

  const SEASONS = {
    spring: { grade: [1.0, 1.05, 0.98], speed: 0.16, sway: 0.25, size: 0.035, a: 0xffc6d9, b: 0xfff0f4, flat: 1, alpha: 0.85 },
    summer: { grade: [1.08, 1.03, 0.92], speed: 0.04, sway: 0.15, size: 0.02, a: 0xffe9a8, b: 0xfff6d6, flat: 0, alpha: 0.5 },
    autumn: { grade: [1.08, 0.94, 0.8], speed: 0.3, sway: 0.3, size: 0.045, a: 0xd9662b, b: 0xf0b13c, flat: 1, alpha: 0.95 },
    winter: { grade: [0.9, 0.96, 1.1], speed: 0.22, sway: 0.12, size: 0.03, a: 0xffffff, b: 0xe6f0ff, flat: 0, alpha: 0.9 },
  };

  // --- Sun -------------------------------------------------------------------
  const sun = reveal.sun;
  const hemisphere = reveal.hemisphere;
  const defaultSun = { position: sun.position.clone(), color: sun.color.clone(), intensity: sun.intensity };
  const defaultHemisphere = hemisphere.intensity;
  const horizonColor = new Color(0xffa25e);
  const noonColor = new Color(0xfff4e2);
  const groundY = toIntro(0, ground, 0).y;
  const sunCentre = new Vector3(0, groundY, 0);
  const { sunrise, sunset } = sunriseSunset({ ...SITE });
  const dayStart = (sunrise ?? 240) - 25;
  const dayEnd = (sunset ?? 1320) + 25;
  const solarAt = (minutes) => solarPosition(sunTimestamp({ ...SITE, minutes }), SITE.latitude, SITE.longitude);
  // Towards the sun, in the scene (north = -Z turned by SITE.north).
  const toward = ({ elevation, azimuth }, target = new Vector3()) => {
    const bearing = (azimuth + SITE.north) * RAD;
    const height = elevation * RAD;
    return target.set(Math.cos(height) * Math.sin(bearing), Math.sin(height), -Math.cos(height) * Math.cos(bearing));
  };
  // The minute of solar noon (highest), for the sound's cue.
  let noonMinute = dayStart;
  for (let m = dayStart, best = -90; m <= dayEnd; m += 5) {
    const e = solarAt(m).elevation;
    if (e > best) { best = e; noonMinute = m; }
  }

  // The day's track: a dot every 5 minutes, larger on the hour.
  const trackPositions = [];
  const trackMinutes = [];
  const direction = new Vector3();
  for (let m = dayStart; m <= dayEnd; m += 5) {
    toward(solarAt(m), direction);
    trackPositions.push(...direction.clone().multiplyScalar(SUN_RADIUS).add(sunCentre).toArray());
    trackMinutes.push(m);
  }
  const trackGeometry = new BufferGeometry();
  trackGeometry.setAttribute('position', new BufferAttribute(new Float32Array(trackPositions), 3));
  trackGeometry.setAttribute('aMinute', new BufferAttribute(new Float32Array(trackMinutes), 1));
  const trackUniforms = { uAlpha: { value: 0 }, uNow: { value: 0 }, uViewport: { value: 800 } };
  const track = new Points(trackGeometry, new ShaderMaterial({
    uniforms: trackUniforms,
    vertexShader: /* glsl */ `
      uniform float uViewport;
      uniform float uNow;
      attribute float aMinute;
      varying float vPast;
      varying float vHour;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vHour = step(mod(aMinute + 0.5, 60.0), 5.0);
        vPast = step(aMinute, uNow);
        gl_PointSize = max(1.0, (0.018 + vHour * 0.022) * uViewport / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying float vPast;
      varying float vHour;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float d = dot(uv, uv);
        if (d > 1.0) discard;
        vec3 color = mix(vec3(0.55, 0.65, 0.85) * 0.5, vec3(1.0, 0.8, 0.45), vPast);
        gl_FragColor = vec4(color * exp(-d * 2.0) * uAlpha * (0.6 + vHour * 0.6), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  track.frustumCulled = false;
  track.renderOrder = 6;
  group.add(track);

  // The sun itself: a warm disc with a soft halo, always facing the camera.
  const discUniforms = { uAlpha: { value: 0 }, uWarm: { value: 0 } };
  const disc = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    uniforms: discUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform float uWarm;
      varying vec2 vUv;
      void main() {
        float d = length(vUv);
        float body = 1.0 - smoothstep(0.16, 0.2, d);
        float halo = exp(-d * d * 9.0) * 0.55;
        vec3 color = mix(vec3(1.0, 0.97, 0.88), vec3(1.0, 0.62, 0.3), uWarm);
        gl_FragColor = vec4(color * (body * 1.4 + halo) * uAlpha, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  disc.renderOrder = 7;
  group.add(disc);

  // The compass: a ring on the ground, ticks every 30°, longer at N, E, S, W.
  const compassPositions = [];
  for (let i = 0; i < 96; i++) {
    const a0 = (i / 96) * Math.PI * 2;
    const a1 = ((i + 1) / 96) * Math.PI * 2;
    compassPositions.push(Math.cos(a0) * COMPASS_RADIUS, groundY + 0.004, Math.sin(a0) * COMPASS_RADIUS);
    compassPositions.push(Math.cos(a1) * COMPASS_RADIUS, groundY + 0.004, Math.sin(a1) * COMPASS_RADIUS);
  }
  for (let deg = 0; deg < 360; deg += 30) {
    toward({ elevation: 0, azimuth: deg }, direction);
    const inner = COMPASS_RADIUS - (deg % 90 === 0 ? 0.16 : 0.07);
    compassPositions.push(direction.x * inner, groundY + 0.004, direction.z * inner);
    compassPositions.push(direction.x * COMPASS_RADIUS, groundY + 0.004, direction.z * COMPASS_RADIUS);
  }
  const compassGeometry = new BufferGeometry();
  compassGeometry.setAttribute('position', new BufferAttribute(new Float32Array(compassPositions), 3));
  const compassMaterial = new LineBasicMaterial({ color: 0xb8d4ff, transparent: true, opacity: 0, depthWrite: false });
  const compass = new LineSegments(compassGeometry, compassMaterial);
  compass.renderOrder = 6;
  group.add(compass);
  const cardinals = ['N', 'E', 'S', 'W'].map((letter, index) => {
    toward({ elevation: 0, azimuth: index * 90 }, direction);
    const at = new Vector3(direction.x * (COMPASS_RADIUS + 0.2), groundY + 0.01, direction.z * (COMPASS_RADIUS + 0.2));
    return { at, label: makeLabel(tx.compass[letter], 'is-compass') };
  });

  // --- Scene cameras ----------------------------------------------------------
  // Drawn as the viewer draws them (editor/camera-markers.js, as Blender
  // does): a pyramid from where the camera stands to the frame it sees, a
  // filled triangle over the frame's top edge for up, and a dashed line to
  // where it looks. They keep their size on screen and show through the
  // model; the chosen one turns gold and its view opens in a frame.
  const CAMERA_GOLD = new Color(0xf5a524);
  const CAMERA_WHITE = new Color(0xffffff);
  const groundLevel = toIntro(0, ground, 0).y;
  // Around the front (+Z, theta 0): its left, low before the entrance (the
  // chosen one), and high over the right, looking down.
  // A narrow (portrait) screen shows little to the sides and much above
  // and below: there they stand closer in, above and before the model.
  const cameraSpots = [
    { theta: -0.62, radius: 2.45, height: 0.75, look: 0.45, narrow: { theta: -0.2, radius: 1.2, height: 2.3, look: 0.6 } },
    { theta: 0.12, radius: 3.05, height: 0.5, look: 0.42, chosen: true, narrow: { theta: 0.62, radius: 2.7, height: 0.3, look: 0.4 } },
    { theta: 1.45, radius: 2.3, height: 2.1, look: 0.2, narrow: { theta: 1.2, radius: 1.1, height: 2.9, look: 0.3 } },
  ];
  const spotAt = (spot, wide, out = new Vector3()) => {
    const k = (key) => spot.narrow[key] + (spot[key] - spot.narrow[key]) * wide;
    const theta = k('theta');
    const radius = k('radius');
    return {
      position: out.set(Math.sin(theta) * radius, groundLevel + k('height'), Math.cos(theta) * radius),
      look: k('look'),
    };
  };
  const frustumLines = (() => {
    const w = 0.5;
    const h = 0.32;
    const corners = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => new Vector3(x, y, 1));
    const points = [];
    corners.forEach((corner, index) => points.push(0, 0, 0, ...corner.toArray(), ...corner.toArray(), ...corners[(index + 1) % 4].toArray()));
    return { points, w, h };
  })();
  const sceneCameras = cameraSpots.map((spot, index) => {
    const position = new Vector3(Math.sin(spot.theta) * spot.radius, groundLevel + spot.height, Math.cos(spot.theta) * spot.radius);
    const target = new Vector3(0, groundLevel + spot.look, 0);
    // Placed again for the screen's shape (update()).
    const marker = new Group();
    marker.position.copy(position);
    marker.lookAt(target);
    // Object3D.lookAt turns +Z towards the target for anything but a camera.
    const lineMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const frustumGeometry = new BufferGeometry();
    frustumGeometry.setAttribute('position', new BufferAttribute(new Float32Array(frustumLines.points), 3));
    const frustum = new LineSegments(frustumGeometry, lineMaterial);
    const { w, h } = frustumLines;
    const triangleGeometry = new BufferGeometry();
    triangleGeometry.setAttribute('position', new BufferAttribute(new Float32Array([
      -w * 0.6, h * 1.12, 1, w * 0.6, h * 1.12, 1, 0, h * 1.12 + w * 0.5, 1,
    ]), 3));
    const fillMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: DoubleSide });
    const triangle = new Mesh(triangleGeometry, fillMaterial);
    const glyph = new Group();
    glyph.add(frustum, triangle);
    marker.add(glyph);
    // The dashed line to where it looks, in the scene's own units.
    const dashGeometry = new BufferGeometry().setFromPoints([position, target]);
    const dashMaterial = new LineDashedMaterial({ color: 0xffffff, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const dash = new LineSegments(dashGeometry, dashMaterial);
    dash.computeLineDistances();
    for (const object of [frustum, triangle, dash]) object.renderOrder = 8;
    group.add(marker, dash);
    // What it sees: the pyramid's own frame (vertical field of view).
    const view = new PerspectiveCamera(2 * Math.atan(frustumLines.h) / RAD, frustumLines.w / frustumLines.h, 0.01, 100);
    return { ...spot, index, position, target, marker, glyph, frustum, triangle, dash, lineMaterial, fillMaterial, dashMaterial, view, delay: 0.25 + index * 0.3 };
  });
  const chosenCamera = sceneCameras.find((c) => c.chosen);
  // Where they stand for this screen: between the narrow and the wide
  // places by its shape. Only when that changes.
  let camerasWide = -1;
  function placeSceneCameras() {
    const wide = clamp01((camera.aspect - 0.6) / 0.7);
    if (Math.abs(wide - camerasWide) < 0.01) return;
    camerasWide = wide;
    for (const c of sceneCameras) {
      const { look } = spotAt(c, wide, c.position);
      c.target.set(0, groundLevel + look, 0);
      c.marker.position.copy(c.position);
      c.marker.lookAt(c.target);
      const line = c.dash.geometry.getAttribute('position');
      line.setXYZ(0, c.position.x, c.position.y, c.position.z);
      line.setXYZ(1, c.target.x, c.target.y, c.target.z);
      line.needsUpdate = true;
      c.dash.computeLineDistances();
    }
  }
  for (const camera_ of sceneCameras) {
    camera_.label = makeLabel(tx.cameras?.names?.[camera_.index] ?? '', 'is-camera');
  }
  // The chosen camera's view: a frame beside the model, the scene drawn
  // into it (intro.js draws the views() list after the main picture).
  const inset = document.createElement('div');
  inset.className = 'intro-inset';
  inset.innerHTML = '<span class="intro-inset-name"></span>';
  inset.firstChild.textContent = tx.cameras?.view ?? '';
  root.appendChild(inset);

  // --- Cooperation mode: a phone with a second session ------------------------
  // The phone is HTML (its body and its screen's overlay); the scene is drawn
  // into its screen from the main camera's place - the same view, live. A
  // finger swipes on it and the big picture turns with it.
  const phone = document.createElement('div');
  phone.className = 'intro-phone';
  phone.innerHTML = '<div class="intro-phone-screen"><span class="intro-phone-live"></span><span class="intro-phone-finger"></span></div><span class="intro-phone-signal" aria-hidden="true"><i></i><i></i><i></i></span><span class="intro-phone-name"></span>';
  root.appendChild(phone);
  const phoneScreen = phone.querySelector('.intro-phone-screen');
  const phoneFinger = phone.querySelector('.intro-phone-finger');
  phone.querySelector('.intro-phone-live').textContent = tx.live?.badge ?? 'LIVE';
  phone.querySelector('.intro-phone-name').textContent = tx.live?.phone ?? '';
  const phoneCamera = new PerspectiveCamera(camera.fov, 0.5, camera.near, camera.far);
  // The screen's own badge: two devices, one scene.
  const liveBadge = document.createElement('div');
  liveBadge.className = 'intro-live-badge';
  liveBadge.innerHTML = '<span class="intro-live-dot"></span><span></span>';
  liveBadge.lastChild.textContent = tx.live?.screen ?? '';
  root.appendChild(liveBadge);

  // --- Timelines: dates, a year running along them ----------------------------
  // One for the time travel's stages, one for the surroundings' periods.
  // Dates under the ticks; those too close to a shown one are left out,
  // the first and the last always.
  function createTimeline(extraClass = '') {
    const element = document.createElement('div');
    element.className = `intro-timeline ${extraClass}`;
    element.innerHTML = '<div class="intro-timeline-track"><span class="intro-timeline-fill"></span><span class="intro-timeline-marker"><span class="intro-timeline-year"></span></span></div><p class="intro-timeline-note"></p>';
    root.appendChild(element);
    const track = element.firstChild;
    const fill = element.querySelector('.intro-timeline-fill');
    const marker = element.querySelector('.intro-timeline-marker');
    const yearLabel = element.querySelector('.intro-timeline-year');
    const note = element.querySelector('.intro-timeline-note');
    let span = null;
    let ticks = [];
    return {
      element,
      get built() { return Boolean(span); },
      // years: the dates; shareOf(year): where a date stands (0-1), by
      // default evenly by the years.
      build(years, noteText = '', shareOf = null) {
        const first = years[0];
        const last = years.at(-1);
        span = shareOf || ((year) => (year - first) / Math.max(1, last - first));
        note.textContent = noteText;
        element.classList.toggle('has-note', Boolean(noteText));
        let lastShown = -Infinity;
        ticks = years.map((year, index) => {
          const share = span(year);
          const tick = document.createElement('span');
          tick.className = 'intro-timeline-tick';
          tick.style.left = `${(share * 100).toFixed(2)}%`;
          const isEnd = index === 0 || index === years.length - 1;
          const nextShare = index < years.length - 1 ? span(years[index + 1]) : 2;
          const roomy = share - lastShown >= 0.11 && (nextShare - share >= 0.04 || index === years.length - 1 || years[index + 1] - year > 1);
          if (isEnd || (roomy && 1 - share >= 0.12)) {
            const date = document.createElement('span');
            date.className = 'intro-timeline-date';
            date.textContent = year;
            tick.append(date);
            lastShown = share;
          }
          track.insertBefore(tick, fill);
          return { tick, year };
        });
      },
      // share: where the marker is (0-1; by default the year's own).
      show(year, visible, share = span ? span(year) : 0) {
        element.style.opacity = visible.toFixed(3);
        if (!span || visible <= 0) return;
        // Under the chapter's name, however many lines it takes.
        element.style.top = `${(chapter.offsetTop + chapter.offsetHeight + 10).toFixed(0)}px`;
        share = clamp01(share);
        fill.style.transform = `scaleX(${share.toFixed(4)})`;
        marker.style.left = `${(share * 100).toFixed(2)}%`;
        yearLabel.textContent = String(Math.round(year));
        for (const { tick, year: at } of ticks) tick.classList.toggle('is-past', at <= Math.round(year));
      },
      hide() { element.style.opacity = 0; },
      get bottom() { return element.offsetTop + element.offsetHeight; },
    };
  }
  const timeline = createTimeline();

  // A badge while the surroundings show: they are a comparison, not this
  // place. Under the timeline (or the chapter's name).
  // Short: its title and an "i"; the rest on hover, focus or a tap.
  const badge = document.createElement('div');
  badge.className = 'intro-badge';
  badge.tabIndex = 0;
  badge.setAttribute('role', 'button');
  badge.setAttribute('aria-expanded', 'false');
  badge.innerHTML = '<span class="intro-badge-head"><strong></strong><span class="intro-badge-info" aria-hidden="true">i</span></span><span class="intro-badge-text"></span>';
  const badgeTitle = badge.querySelector('strong');
  const badgeText = badge.querySelector('.intro-badge-text');
  const setBadgeOpen = (open) => {
    badge.classList.toggle('is-open', open);
    badge.setAttribute('aria-expanded', String(open));
  };
  badge.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') setBadgeOpen(true); });
  badge.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') setBadgeOpen(false); });
  badge.addEventListener('focus', () => setBadgeOpen(true));
  badge.addEventListener('blur', () => setBadgeOpen(false));
  // A tap (touch) opens and closes it; it does not turn the model.
  badge.addEventListener('pointerdown', (event) => event.stopPropagation());
  badge.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.pointerType !== 'mouse') setBadgeOpen(!badge.classList.contains('is-open'));
  });
  root.appendChild(badge);
  function showBadge(title, text, visible, under) {
    badge.style.opacity = visible.toFixed(3);
    badge.style.pointerEvents = visible > 0.5 ? 'auto' : 'none';
    if (visible <= 0) {
      if (badge.classList.contains('is-open') && document.activeElement !== badge) setBadgeOpen(false);
      return;
    }
    if (badgeTitle.textContent !== title) badgeTitle.textContent = title;
    if (badgeText.textContent !== text) {
      badgeText.textContent = text;
      badge.setAttribute('aria-label', `${title}. ${text}`);
    }
    badge.style.top = `${(under + 8).toFixed(0)}px`;
  }

  // --- Surroundings through time (intro-surroundings.js) ----------------------
  // In metres round the model's middle, y from its ground -> the intro's
  // space (toIntro is linear: its middle is where it maps x and z to 0).
  const unit = scene.unitInMeters || 1;
  const o = toIntro(0, 0, 0);
  const ex = toIntro(1, 0, 0).x - o.x;
  const ez = toIntro(0, 0, 1).z - o.z;
  const middle = [-o.x / ex, -o.z / ez];
  const metresToIntro = (x, y, z) => toIntro(middle[0] + x / unit, ground + y / unit, middle[1] + z / unit).toArray();
  let surroundings = null;
  let showcase = null;
  const surroundingsTimeline = createTimeline('is-surroundings');
  const SURROUNDINGS = CHAPTERS.find((c) => c.key === 'surroundings');
  if (SURROUNDINGS && scene.surroundings) {
    const { years, showcase: variants, ...params } = scene.surroundings;
    try {
      surroundings = createIntroSurroundings({ params, from: years[0], to: years[1], radius: footprint, toIntro: metresToIntro });
      group.add(surroundings.group);
      // The dates evenly by the periods, as on the viewer's slider.
      const { from, to } = surroundings;
      surroundingsTimeline.build(surroundings.dates, '', (year) => (positionOfYear(year) - from) / Math.max(1e-3, to - from));
      if (Array.isArray(variants) && variants.length) {
        showcase = createSurroundingsShowcase({ variants, seed: (params.seed || 1) + 2, radius: footprint, toIntro: metresToIntro });
        group.add(showcase.group);
      }
    } catch (error) {
      console.warn('[intro] surroundings:', error);
    }
  }
  // The position (in periods) at s seconds into the chapter: evenly through
  // the periods, eased at the ends.
  const surroundingsAt = (s) => {
    const { from, to } = surroundings;
    const u = clamp01((s - SURROUNDINGS_IN) / SURROUNDINGS_RUN);
    return from + (to - from) * (u < 0.04 ? smooth(u / 0.04) * 0.04 : u > 0.96 ? 0.96 + smooth((u - 0.96) / 0.04) * 0.04 : u);
  };
  const SHOWCASE_FROM = SURROUNDINGS_IN + SURROUNDINGS_RUN + SURROUNDINGS_HOLD;

  const project = new Vector3();
  function place(el, point, visible, offsetY = 0, centred = false, keepIn = false) {
    project.copy(point).project(camera);
    const behind = project.z > 1;
    let x = (project.x * 0.5 + 0.5) * root.clientWidth;
    // Kept on the screen (a name beside something near its edge).
    if (keepIn) {
      const half = el.offsetWidth / 2 + 8;
      x = Math.min(root.clientWidth - half, Math.max(half, x));
    }
    const y = (-project.y * 0.5 + 0.5) * root.clientHeight;
    el.style.transform = `translate(${x.toFixed(1)}px, ${(y + offsetY).toFixed(1)}px) translate(-50%, ${centred ? '-50%' : '-100%'})`;
    el.style.opacity = behind ? 0 : visible.toFixed(3);
  }

  let lastCue = '';
  // A stage's caption: the 4D model's own label (Polish), or the year with
  // the page's translation of it.
  function timeLabel(stage) {
    if (lang === 'pl') return stage.label;
    const note = tx.timeNotes?.[stage.year];
    return note ? `${stage.year} – ${note}` : String(stage.year);
  }
  const size = new Vector2();

  function hideAll() {
    for (const pin of pins) pin.label.style.opacity = 0;
    measureLabel.style.opacity = 0;
    chapter.classList.remove('is-on');
  }

  // The extra views drawn after the main picture (intro.js): the chosen
  // camera's, the phone's. Rectangles in CSS pixels from the top left.
  let views = [];
  const rectOf = (el) => {
    const box = el.getBoundingClientRect();
    const page = root.getBoundingClientRect();
    return { x: box.left - page.left, y: box.top - page.top, width: box.width, height: box.height };
  };

  return {
    group,
    /** The extra views to draw after the main picture: [{ camera, rect, hide }]. */
    views() {
      return views;
    },
    setViewport(viewport) {
      dotUniforms.uViewport.value = viewport;
      flakeUniforms.uViewport.value = viewport;
      trackUniforms.uViewport.value = viewport;
      renderer.getDrawingBufferSize(size);
      u.uResolution.value.set(size.x, size.y);
    },
    /**
     * @param {number} tour  seconds into the tour (negative: not yet)
     * @param {number} time  the clock, for things that only move
     * @param {number} exit  0..1 while leaving for the viewer
     * @returns {string} a cue for the sound when something new starts
     *   ('chapter', 'step'), or 'end' once the tour is over
     */
    update(tour, time, exit) {
      const active = tour > 0 && tour < TOUR_LENGTH && exit <= 0;
      group.visible = tour > 0 && exit < 1;
      u.uTourTime.value = time;
      dotUniforms.uTime.value = time;
      flakeUniforms.uTime.value = time;

      // 1. Section: in from the front (the camera's side, so the cut faces
      // it and the inside shows), through, and back out.
      const sectionOn = window01(tour, 0, 3.0, 0.35);
      const sweep = smooth(tour / 1.6) - smooth((tour - 1.9) / 1.0);
      const cut = cutFrom + (cutTo - cutFrom) * sweep;
      u.uClip.value.set(0, 0, -1, cut);
      u.uClipActive.value = sectionOn;
      plane.position.set(0, planeY, cut);
      planeMaterial.uniforms.uAlpha.value = sectionOn;
      plane.visible = sectionOn > 0.001;

      // 2. Annotations: pins one after another, then the measurement.
      const annotationsOn = window01(tour, 3.0, 6.4, 0.3);
      lineMaterial.opacity = annotationsOn * 0.85;
      dotUniforms.uAlpha.value = annotationsOn;
      lines.visible = dots.visible = annotationsOn > 0.001;
      pins.forEach((pin) => {
        const shown = annotationsOn * smooth((tour - 3.2 - pin.delay) / 0.3);
        place(pin.label, pin.top, shown);
      });
      const measureShown = annotationsOn * smooth((tour - 4.2) / 0.3);
      place(measureLabel, measureBottom.clone().lerp(measureTop, 0.5), measureShown, 0);

      // 3. Shading: wipe after wipe.
      let modeA = 0;
      let modeB = 0;
      let wipe = 0;
      let shadingKey = 'textures';
      const shadingTime = tour - START.shading;
      if (shadingTime > 0 && shadingTime < SHADING_LENGTH) {
        const stepLength = SHADING_LENGTH / SHADING_STEPS.length;
        const index = Math.min(SHADING_STEPS.length - 1, Math.floor(shadingTime / stepLength));
        const local = (shadingTime - index * stepLength) / stepLength;
        [modeA, modeB] = SHADING_STEPS[index];
        wipe = smooth(local / 0.55);
        shadingKey = SHADING_KEYS[wipe > 0.5 ? modeB : modeA];
      }
      u.uModeA.value = modeA;
      u.uModeB.value = modeB;
      u.uWipe.value = wipe;

      // 4. Sun: midsummer day at the site, from just before sunrise to just
      // after sunset, then night falls.
      const sunTime = (tour - START.sun) / SUN_LENGTH;
      let sunKey = '';
      let sunSub = '';
      const sunOn = sunTime > 0 && sunTime < 1 ? smooth(sunTime / 0.08) * (1 - smooth((sunTime - 0.9) / 0.1)) : 0;
      // A narrow screen: the sun's track and the compass drawn in at the
      // sides, so the sun stays in the picture from sunrise to sunset.
      const sunWide = clamp01((camera.aspect - 0.6) / 0.7);
      const sunSide = 0.7 + 0.3 * sunWide;
      track.scale.set(sunSide, 1, sunSide);
      const compassSide = 0.82 + 0.18 * sunWide;
      compass.scale.set(compassSide, 1, compassSide);
      if (sunTime > 0 && sunTime < 1) {
        const dayPart = clamp01((sunTime - 0.08) / 0.76);
        const minutes = dayStart + (dayEnd - dayStart) * dayPart;
        const position = solarAt(minutes);
        toward(position, direction);
        const daylight = clamp01((position.elevation - HORIZON) / 12);
        const night = smooth((sunTime - 0.86) / 0.08);
        sun.position.copy(direction).multiplyScalar(7);
        sun.color.copy(horizonColor).lerp(noonColor, clamp01(position.elevation / 30));
        sun.intensity = 3.2 * daylight * (1 - night);
        hemisphere.intensity = defaultHemisphere * (0.3 + 0.7 * daylight) * (1 - night * 0.55);
        disc.position.copy(direction).multiplyScalar(SUN_RADIUS);
        disc.position.x *= sunSide;
        disc.position.z *= sunSide;
        disc.position.add(sunCentre);
        disc.quaternion.copy(camera.quaternion);
        disc.scale.setScalar(0.5);
        discUniforms.uAlpha.value = sunOn * clamp01((position.elevation + 3) / 4) * (1 - night);
        discUniforms.uWarm.value = 1 - clamp01(position.elevation / 25);
        trackUniforms.uNow.value = minutes;
        sunSub = night > 0.5 ? tx.sun.night : `${tx.sunDate} · ${formatSunTime(minutes)}`;
        sunKey = night > 0.5 ? 'night' : minutes < (sunrise ?? 0) ? 'before' : minutes < noonMinute ? 'morning'
          : minutes < (sunset ?? 1440) ? 'afternoon' : 'after';
      } else {
        sun.position.copy(defaultSun.position);
        sun.color.copy(defaultSun.color);
        sun.intensity = defaultSun.intensity;
        hemisphere.intensity = defaultHemisphere;
        discUniforms.uAlpha.value = 0;
      }
      trackUniforms.uAlpha.value = sunOn;
      compassMaterial.opacity = sunOn * 0.55;
      track.visible = compass.visible = sunOn > 0.001;
      disc.visible = discUniforms.uAlpha.value > 0.001;
      for (const cardinal of cardinals) {
        place(cardinal.label, project.set(cardinal.at.x * compassSide, cardinal.at.y, cardinal.at.z * compassSide).clone(), sunOn, 0, true);
      }

      // 5. Seasons: a few seconds each; snow settles in winter.
      const seasonTime = tour - START.seasons;
      let seasonKey = '';
      const grade = [1, 1, 1];
      let snow = 0;
      if (seasonTime > 0 && seasonTime < SEASONS_END + 0.4) {
        const index = Math.min(3, Math.floor(seasonTime / SEASON_LENGTH));
        seasonKey = SEASON_KEYS[index];
        const season = SEASONS[seasonKey];
        const local = seasonTime - index * SEASON_LENGTH;
        const blend = smooth(local / 0.3);
        const previous = index > 0 ? SEASONS[SEASON_KEYS[index - 1]] : { grade: [1, 1, 1] };
        for (let k = 0; k < 3; k++) grade[k] = previous.grade[k] + (season.grade[k] - previous.grade[k]) * blend;
        flakeUniforms.uSpeed.value = season.speed;
        flakeUniforms.uSway.value = season.sway;
        flakeUniforms.uSize.value = season.size;
        flakeUniforms.uColorA.value.setHex(season.a);
        flakeUniforms.uColorB.value.setHex(season.b);
        flakeUniforms.uFlat.value = season.flat;
        // Each season's weather fades in and out with it.
        const inSeason = smooth(local / 0.25) * (1 - smooth((local - SEASON_LENGTH + 0.25) / 0.25));
        flakeUniforms.uAlpha.value = season.alpha * (index === 3 ? smooth(local / 0.25) * (1 - smooth((seasonTime - SEASONS_END) / 0.4)) : inSeason);
        if (index === 3) snow = smooth(local / 1.2) * (1 - smooth((seasonTime - SEASONS_END) / 0.4));
        // Back to the textures' own colours at the end.
        const out = smooth((seasonTime - SEASONS_END) / 0.4);
        for (let k = 0; k < 3; k++) grade[k] += (1 - grade[k]) * out;
      } else {
        flakeUniforms.uAlpha.value = 0;
      }
      flakes.visible = flakeUniforms.uAlpha.value > 0.001;
      u.uGrade.value.set(grade[0], grade[1], grade[2]);
      u.uSnow.value = snow;

      // 6. Time travel: back to the first stage, then forward stage by stage.
      const timeTime = tour - START.time;
      let timeSub = '';
      let timeStep = '';
      let timelineAt = null;
      const TIME_END = CHAPTERS.find((c) => c.key === 'time')?.to;
      if (timeTravel && timeTime > 0 && timeTime < TIME_END - START.time && exit <= 0) {
        const { stages } = timeTravel;
        const glowOf = (f) => Math.sin(Math.PI * clamp01(f)) * 1.4;
        if (timeTime < TIME_REWIND) {
          const f = smooth(timeTime / TIME_REWIND);
          setTime(TODAY, stages[0], f * 1.1 - 0.05, glowOf(f));
          timeSub = `${stages.at(-1).year} → ${stages[0].year}`;
          timeStep = 'rewind';
          timelineAt = stages.at(-1).year + (stages[0].year - stages.at(-1).year) * f;
        } else {
          const after = timeTime - TIME_REWIND;
          const { steps } = timeTravel;
          let index = 1;
          while (index < stages.length - 1 && after >= steps[index + 1].start) index++;
          const f = smooth((after - steps[index].start) / (steps[index].length * TIME_SWEEP));
          setTime(stages[index - 1], stages[index], f * 1.1 - 0.05, glowOf(f));
          const shown = stages[f > 0.5 ? index : index - 1];
          timeSub = timeLabel(shown);
          timeStep = String(shown.year);
          timelineAt = stages[index - 1].year + (stages[index].year - stages[index - 1].year) * f;
        }
      } else {
        resetTime();
        if (!timeTravel && !scene.custom && timeTime > 0 && timeTime < TIME_END - START.time) timeSub = '1615 → 2025';
      }
      const timeLength = TIME_END - START.time;
      const timelineOn = timelineAt === null ? 0
        : smooth(timeTime / 0.4) * (1 - smooth((timeTime - timeLength + 0.5) / 0.4));
      if (timelineAt !== null) timeline.show(timelineAt, timelineOn);
      else timeline.hide();

      // 9. Surroundings through time: rising round the model as the camera
      // draws back, the periods running; the building's stage follows the
      // year. Then the other places, one after another.
      const surroundingsTime = tour - (START.surroundings ?? Infinity);
      let surroundingsSub = '';
      let surroundingsStep = '';
      const surroundingsLength = SURROUNDINGS ? SURROUNDINGS.to - SURROUNDINGS.from : 0;
      const sx = tx.surroundings || {};
      if (surroundings && exit <= 0 && surroundingsTime > 0 && surroundingsTime < surroundingsLength) {
        const on = smooth(surroundingsTime / 0.6) * (1 - smooth((surroundingsTime - surroundingsLength + 0.5) / 0.5));
        const at = surroundingsAt(surroundingsTime);
        const year = yearOfPosition(at);
        // The settlement: up at the start, down when the other places come
        // (or at the end without them).
        const runEnd = showcase ? SHOWCASE_FROM : surroundingsLength - SURROUNDINGS_OUT;
        const runShow = smooth(surroundingsTime / SURROUNDINGS_IN) * (1 - smooth((surroundingsTime - runEnd) / SHOWCASE_SWAP));
        surroundings.update(at, runShow);
        // The other places: each rises as the last sinks.
        const shows = (showcase?.variants || []).map((_variant, i) => {
          const start = SHOWCASE_FROM + i * SHOWCASE_EACH;
          const end = i === showcase.variants.length - 1 ? surroundingsLength - SURROUNDINGS_OUT : start + SHOWCASE_EACH;
          return smooth((surroundingsTime - start) / SHOWCASE_SWAP) * (1 - smooth((surroundingsTime - end) / SHOWCASE_SWAP));
        });
        showcase?.update(shows, time);
        const shown = shows.findIndex((v, i) => v > 0.5 && (shows[i + 1] ?? 0) <= 0.5);
        if (shown >= 0) {
          const variant = showcase.variants[shown];
          surroundingsSub = [sx.kinds?.[variant.kind] ?? variant.kind, sx.regions?.[variant.region] ?? variant.region, variant.year].join(' · ');
          surroundingsStep = `place${shown}`;
          surroundingsTimeline.hide();
          showBadge(sx.badgeTitle ?? '', sx.showcase ?? '', on, chapter.offsetTop + chapter.offsetHeight);
        } else {
          const period = surroundings.periodAt(at);
          surroundingsSub = `${year} · ${sx.periods?.[period] ?? period}`;
          surroundingsStep = period;
          const lineOn = runShow * smooth((surroundingsTime - 0.3) / 0.4);
          surroundingsTimeline.show(year, lineOn, (at - surroundings.from) / Math.max(1e-3, surroundings.to - surroundings.from));
          showBadge(sx.badgeTitle ?? '', sx.badge ?? '', on, lineOn > 0.05 ? surroundingsTimeline.bottom : chapter.offsetTop + chapter.offsetHeight);
        }
        // The building as it was that year (before its first stage: its
        // first; the other places: as it is).
        if (timeTravel) {
          const { stages } = timeTravel;
          const stage = shown >= 0 ? stages.at(-1) : [...stages].reverse().find((st) => st.year <= year) ?? stages[0];
          setTime(stage, stage, 1, 0);
        }
      } else {
        surroundings?.update(surroundings.from, 0);
        showcase?.update(showcase.variants.map(() => 0), time);
        surroundingsTimeline.hide();
        badge.style.opacity = 0;
      }

      // 6. Scene cameras: one after another, then the chosen one's view.
      views = [];
      const camerasTime = tour - (START.cameras ?? Infinity);
      const camerasLength = CHAPTERS.find((c) => c.key === 'cameras')?.to - START.cameras;
      const camerasOn = exit <= 0 && camerasTime > 0 && camerasTime < camerasLength ? 1 - smooth((camerasTime - camerasLength + 0.35) / 0.35) : 0;
      const chosenOn = camerasOn * smooth((camerasTime - 1.35) / 0.35);
      if (camerasOn > 0) placeSceneCameras();
      for (const c of sceneCameras) {
        const shown = camerasOn * smooth((camerasTime - c.delay) / 0.3);
        const color = c.chosen ? CAMERA_WHITE.clone().lerp(CAMERA_GOLD, chosenOn) : CAMERA_WHITE;
        c.lineMaterial.color.copy(color);
        c.fillMaterial.color.copy(color);
        c.dashMaterial.color.copy(color);
        c.lineMaterial.opacity = shown * 0.95;
        c.fillMaterial.opacity = shown * 0.9;
        c.dashMaterial.opacity = shown * 0.55;
        c.marker.visible = c.dash.visible = shown > 0.001;
        // The same size on screen, whatever the distance.
        c.glyph.scale.setScalar(camera.position.distanceTo(c.position) * 0.075 * (1 + (c.chosen ? chosenOn * 0.25 : 0)));
        place(c.label, c.position, shown, -14, false, true);
        c.label.classList.toggle('is-chosen', c.chosen && chosenOn > 0.5);
      }
      // The chosen camera's view, opening like a shutter, moving in a little.
      const insetOpen = camerasOn * smooth((camerasTime - 1.5) / 0.45);
      inset.style.opacity = insetOpen.toFixed(3);
      inset.style.setProperty('--open', insetOpen.toFixed(3));
      if (insetOpen > 0.02) {
        const rect = rectOf(inset);
        const view = chosenCamera.view;
        view.aspect = rect.width / Math.max(1, rect.height);
        view.position.copy(chosenCamera.position).lerp(chosenCamera.target, 0.08 * smooth((camerasTime - 1.5) / 2.2));
        view.lookAt(chosenCamera.target);
        view.updateProjectionMatrix();
        // Opening from the middle: the drawn part grows with it.
        const height = rect.height * insetOpen;
        views.push({ camera: view, rect: { ...rect, y: rect.y + (rect.height - height) / 2, height }, hide: [group] });
      }

      // 7. Cooperation mode: the phone comes in, the finger swipes, the
      // picture follows; the phone shows the same view, live.
      const liveTime = tour - (START.live ?? Infinity);
      const liveLength = CHAPTERS.find((c) => c.key === 'live')?.to - START.live;
      const liveOn = exit <= 0 && liveTime > 0 && liveTime < liveLength
        ? smooth(liveTime / 0.4) * (1 - smooth((liveTime - liveLength + 0.4) / 0.4)) : 0;
      phone.style.opacity = liveOn.toFixed(3);
      phone.style.setProperty('--in', liveOn.toFixed(3));
      liveBadge.style.opacity = (liveOn * smooth((liveTime - 0.5) / 0.3)).toFixed(3);
      let fingerX = null;
      let fingerOn = 0;
      for (const swipe of LIVE_SWIPES) {
        const local = (liveTime - swipe.from) / (swipe.to - swipe.from);
        if (local > -0.25 && local < 1.25) {
          const a = swipe.turn > 0 ? 0.25 : 0.72;
          const b = swipe.turn > 0 ? 0.75 : 0.42;
          fingerX = a + (b - a) * smooth(local);
          fingerOn = smooth((local + 0.25) / 0.25) * (1 - smooth((local - 1) / 0.25));
        }
      }
      phoneFinger.style.opacity = (fingerOn * liveOn).toFixed(3);
      if (fingerX !== null) phoneFinger.style.left = `${(fingerX * 100).toFixed(1)}%`;
      phone.classList.toggle('is-touching', fingerOn > 0.5);
      if (liveOn > 0.02) {
        const rect = rectOf(phoneScreen);
        phoneCamera.position.copy(camera.position);
        phoneCamera.quaternion.copy(camera.quaternion);
        phoneCamera.fov = camera.fov;
        phoneCamera.aspect = rect.width / Math.max(1, rect.height);
        // As the page does for a narrow screen: further away, so it fits.
        phoneCamera.zoom = Math.min(1, phoneCamera.aspect / 0.9 + 0.25);
        phoneCamera.updateProjectionMatrix();
        views.push({ camera: phoneCamera, rect, hide: [] });
      }

      // 8. Time travel's timeline (the stages above).
      if (timeTravel && !timeline.built) timeline.build(timeTravel.stages.map((stage) => stage.year));

      // The chapter's title.
      const current = active ? CHAPTERS.find((c) => tour >= c.from && tour < c.to) : null;
      if (!current) {
        hideAll();
        if (!active) {
          for (const pin of pins) pin.label.style.opacity = 0;
          measureLabel.style.opacity = 0;
          for (const cardinal of cardinals) cardinal.label.style.opacity = 0;
          for (const c of sceneCameras) c.label.style.opacity = 0;
          inset.style.opacity = phone.style.opacity = liveBadge.style.opacity = 0;
          timeline.hide();
          surroundingsTimeline.hide();
          badge.style.opacity = 0;
          views = [];
        }
        // Everything done: once, right after the last chapter.
        const finished = exit <= 0 && tour >= CHAPTERS.at(-1).to && tour < TOUR_LENGTH + 1;
        if (finished && lastCue.startsWith(`${CHAPTERS.at(-1).key}:`)) {
          lastCue = 'end';
          return 'end';
        }
        if (!finished) lastCue = '';
        return '';
      }
      const number = CHAPTERS.indexOf(current) + 1;
      let sub = '';
      let step = '';
      if (current.key === 'shading') { sub = tx.shading[shadingKey]; step = shadingKey; }
      else if (current.key === 'sun') { sub = sunSub; step = sunKey; }
      else if (current.key === 'seasons' && seasonKey) { sub = tx.seasons[seasonKey]; step = seasonKey; }
      else if (current.key === 'time') { sub = timeSub; step = timeStep; }
      else if (current.key === 'cameras') { sub = chosenOn > 0.5 ? tx.cameras?.chosen ?? '' : ''; step = chosenOn > 0.5 ? 'chosen' : ''; }
      else if (current.key === 'live') { sub = tx.live?.sub ?? ''; step = fingerOn > 0.5 ? 'swipe' : ''; }
      else if (current.key === 'surroundings') { sub = surroundingsSub; step = surroundingsStep; }
      chapterIndex.textContent = `${number} / ${CHAPTERS.length}`;
      chapterTitle.textContent = tx.chapters[current.key];
      chapterSub.textContent = sub;
      chapter.classList.toggle('has-sub', Boolean(sub));
      chapter.classList.toggle('is-on', tour < current.to - 0.2);
      const cue = `${current.key}:${step}`;
      if (cue !== lastCue) {
        const kind = lastCue.split(':')[0] === current.key ? 'step' : 'chapter';
        lastCue = cue;
        // Time travel's stages go by quietly.
        return kind === 'step' && current.key === 'time' ? '' : kind;
      }
      return '';
    },
  };
}

// The intro page (intro.html): a chaotic cloud of points that, like atoms,
// slowly settles into the pagoda (the project's own model,
// scripts/build-pagoda-examples.mjs). The very last point takes its
// time, and its landing sends a wave of light through the building; then
// the real model takes the points' place - vertices, edges, faces
// (mesh-reveal.js) - and a button leads into the viewer.
//
// The model and what depends on it is the scene (intro-scene.js): the
// pagoda, or a deployment's own (viewer.intro.scene, docs/intro.md).
// The points come from viewer/intro/scenes/pagoda/points.bin, sampled from the
// textured model by scripts/build-intro-points.mjs. Everything moves in the
// vertex shader: per point a start in the cloud, a delay (lower parts of the
// building first) and a seed for its own drift and path.
//
// Page parameters: ?next=<same-origin URL> is where the button leads
// (default: the viewer with the pagoda), ?lang=pl|en|de, ?at=<seconds>
// holds the intro at that moment, ?sound=1 sound on by default (it starts
// with the first click or key press; the visitor's own choice wins),
// ?embedded=1 inside the viewer page (viewer/intro-overlay.js): the buttons
// tell the page instead of leaving it; ?insets=top,right,bottom,left the
// viewer page's safe area (an iframe gets none of its own); ?resume=<seconds>
// starts at that moment (the language switch reloads the page with it).
//
// Everything follows one clock, the intro's time T (timeline() below):
// "Assemble again" runs it backwards, ?at= stops it.

// The model and what depends on it (intro-scene.js): the pagoda,
// or the deployment's own (viewer.intro.scene in viewer-settings.json).
const { scene: SCENE, branding: BRANDING } = await loadIntroScene();
const POINTS_URL = SCENE.points;
// The model the points become (also the one the viewer opens next, so it is
// in the browser's cache by then), and the KTX2 transcoder its textures need.
const MODEL_URL = SCENE.model;
const TRANSCODER_PATH = 'assets/basis/';
// Where the button leads. The directory's index page (index.html): `serve`
// and other static servers redirect index.html to ./ and lose the query on
// the way.
const DEFAULT_NEXT = SCENE.next;
const PLAN = tourPlan({ time: Boolean(SCENE.time), surroundings: Boolean(SCENE.surroundings) });
const CHAPTERS = PLAN.chapters;
const TOUR_LENGTH = PLAN.length;
// Seconds: the cloud fades in, then gathers into the building.
const FADE_IN = 1.0;
// Only the cloud this long, then the points set off.
const ASSEMBLY_START = 1.5;
const ASSEMBLY = 5.2;
// Where the last point waits, of the camera's view when it sets off:
// radians to the side, out from the middle, and above the roof's top - on a
// narrow screen ([0]: closer in, higher; the sides are cut off) and a wide
// one ([1]: further out, lower; the logo is above).
const WAIT_SIDE = 1.9;
const WAIT_RADIUS = [1.0, 1.9];
const WAIT_ABOVE = [0.8, -0.1];
// The last point: sets off late, takes its time, lands on the roof.
const LAST_START = ASSEMBLY_START + ASSEMBLY * 0.72;
const LAST_FLIGHT = 3.8;
const LANDING = LAST_START + LAST_FLIGHT;
const EXIT = 1.3;
// Assemble again: everything runs back into the cloud first.
const REWIND = 3.6;
// The feature tour (feature-tour.js): seconds into the model's act.
const TOUR_START = 11.0;
const INTRO_END = LANDING + TOUR_START + TOUR_LENGTH;
// When the logo starts fading to a watermark (seconds of the intro).
const WATERMARK_AT = 2.5;
// How far a visitor may zoom out (the camera's path goes further for the
// surroundings' overview).
const MAX_DISTANCE = 11;
// The progress bar's parts: the cloud gathering, the mesh, the tour's chapters.
const SEGMENTS = [
  { key: 'cloud', from: 0, to: LANDING },
  { key: 'mesh', from: LANDING, to: LANDING + TOUR_START },
  ...CHAPTERS.map((chapter) => ({
    key: chapter.key,
    from: LANDING + TOUR_START + chapter.from,
    to: LANDING + TOUR_START + chapter.to,
  })),
];

const TEXTS = {
  pl: {
    tagline: 'Odkrywaj dziedzictwo w 4D',
    enter: 'Wejdź do viewera',
    skip: 'Pomiń intro',
    replay: 'Złóż ponownie',
    points: (n, total) => `${n} / ${total} punktów na miejscu`,
    mesh: (v, f) => `${v} wierzchołków · ${f} ścianek`,
    loading: 'Wczytywanie punktów…',
    error: 'Nie udało się wczytać intro.',
    hint: 'Najedź na pagodę, by zajrzeć do środka · przeciągnij, aby obrócić',
    hintTouch: 'Stuknij pagodę, by zajrzeć do środka · przeciągnij, aby obrócić',
    lensTip: 'Najedź kursorem – zajrzyj do środka',
    lensTipTouch: 'Stuknij – zajrzyj do środka',
    bar: {
      label: 'Etapy intro',
      cloud: 'Chmura punktów',
      mesh: 'Siatka',
      short: { cloud: 'Chmura', mesh: 'Siatka', section: 'Przekroje', annotations: 'Adnotacje', shading: 'Cieniowanie', sun: 'Słońce', seasons: 'Pory roku', cameras: 'Kamery', live: 'Live', time: '4D', surroundings: 'Otoczenie' },
    },
    tour: {
      chapters: {
        section: 'Przekroje',
        annotations: 'Adnotacje i punkty POI',
        shading: 'Cieniowanie',
        sun: 'Analiza nasłonecznienia',
        seasons: 'Pory roku i pogoda',
        cameras: 'Kamery sceny',
        live: 'Tryb współpracy',
        time: 'Podróż w czasie (4D)',
        surroundings: 'Otoczenie w czasie',
      },
      surroundings: {
        periods: {
          'early-medieval': 'wczesne średniowiecze', medieval: 'średniowiecze', 'early-modern': 'wczesna nowożytność',
          industrial: 'epoka przemysłowa · kolej', modern: 'XX wiek', postwar: 'po wojnie', contemporary: 'współcześnie',
        },
        badgeTitle: 'Wizualizacja porównawcza',
        badge: 'Jak obiekt mógłby wyglądać w innym otoczeniu w kolejnych epokach. Otoczenie wygenerowane, typowe dla rodzaju miejsca i czasu – nie odtworzenie tego miejsca.',
        showcase: 'Inne rodzaje miejsc i inne regiony – widok realistyczny, z życiem na ulicach. Wygenerowane, tylko do porównania.',
        kinds: { town: 'miasto', village: 'wieś', port: 'port', monastery: 'klasztor', castle: 'zamek', church: 'kościół', manor: 'dwór', 'manor-farm': 'folwark', shtetl: 'sztetl' },
        regions: { central: 'Europa Środkowa', mediterranean: 'Morze Śródziemne', nordic: 'Północ', british: 'Wyspy Brytyjskie', eastern: 'Europa Wschodnia', japanese: 'Japonia', african: 'Afryka Zachodnia' },
      },
      cameras: { names: ['Kamera 1', 'Kamera 2 · front', 'Kamera 3 · z góry'], chosen: 'widok z kamery 2', view: 'Kamera 2' },
      live: { badge: 'LIVE', phone: 'Telefon · druga sesja', screen: 'Na żywo · 2 urządzenia', sub: 'telefon steruje ekranem' },
      shading: { textures: 'tekstury', pbr: 'PBR: połysk i odbicia', raking: 'światło boczne' },
      sun: { night: 'noc' },
      sunDate: 'Nara, 21 czerwca',
      compass: { N: 'N', E: 'E', S: 'S', W: 'W' },
      seasons: { spring: 'wiosna', summer: 'lato', autumn: 'jesień', winter: 'zima' },
      labels: { brackets: 'Wsporniki (tokyō)', bell: 'Dzwonek wietrzny' },
      height: 'wysokość',
    },
    pause: 'Pauza (spacja)',
    play: 'Odtwórz (spacja)',
    soundOn: 'Wyłącz dźwięk',
    soundOff: 'Włącz dźwięk',
    language: 'Język',
  },
  en: {
    tagline: 'Explore heritage in 4D',
    enter: 'Enter the viewer',
    skip: 'Skip intro',
    replay: 'Assemble again',
    points: (n, total) => `${n} / ${total} points in place`,
    mesh: (v, f) => `${v} vertices · ${f} faces`,
    loading: 'Loading points…',
    error: 'The intro could not be loaded.',
    hint: 'Hover over the pagoda to look inside · drag to rotate',
    hintTouch: 'Tap the pagoda to look inside · drag to rotate',
    lensTip: 'Move the cursor here – look inside',
    lensTipTouch: 'Tap here – look inside',
    bar: {
      label: 'Intro chapters',
      cloud: 'Point cloud',
      mesh: 'Mesh',
      short: { cloud: 'Cloud', mesh: 'Mesh', section: 'Sections', annotations: 'Annotations', shading: 'Shading', sun: 'Sun', seasons: 'Seasons', cameras: 'Cameras', live: 'Live', time: '4D', surroundings: 'Surroundings' },
    },
    tour: {
      chapters: {
        section: 'Sections',
        annotations: 'Annotations and POIs',
        shading: 'Shading',
        sun: 'Sun study',
        seasons: 'Seasons and weather',
        cameras: 'Scene cameras',
        live: 'Cooperation mode',
        time: 'Time travel (4D)',
        surroundings: 'Surroundings through time',
      },
      surroundings: {
        periods: {
          'early-medieval': 'the early Middle Ages', medieval: 'the Middle Ages', 'early-modern': 'the early modern period',
          industrial: 'the industrial age · the railway', modern: 'the 20th century', postwar: 'after the war', contemporary: 'today',
        },
        badgeTitle: 'A comparative visualisation',
        badge: 'How the building might look in other surroundings through the ages. The surroundings are generated, typical of the kind of place and its time – not a reconstruction of this place.',
        showcase: 'Other kinds of place in other regions – the realistic look, with life in the streets. Generated, for comparison only.',
        kinds: { town: 'a town', village: 'a village', port: 'a port', monastery: 'a monastery', castle: 'a castle', church: 'a church', manor: 'a manor', 'manor-farm': 'a manor farm', shtetl: 'a shtetl' },
        regions: { central: 'Central Europe', mediterranean: 'the Mediterranean', nordic: 'the North', british: 'the British Isles', eastern: 'Eastern Europe', japanese: 'Japan', african: 'West Africa' },
      },
      cameras: { names: ['Camera 1', 'Camera 2 · front', 'Camera 3 · from above'], chosen: 'the view from camera 2', view: 'Camera 2' },
      live: { badge: 'LIVE', phone: 'Phone · second session', screen: 'Live · 2 devices', sub: 'the phone steers the screen' },
      shading: { textures: 'textures', pbr: 'PBR: gloss and reflections', raking: 'raking light' },
      timeNotes: {
        1615: 'built: new timber, fresh vermilion, gilt bronze',
        1640: 'the vermilion darkens',
        1685: 'paint worn, the bronze turns brown',
        1702: 'first repair: repainted, walls limed',
        1765: 'moss in the roof tiles',
        1830: 're-tiled, new doors; verdigris on the finial',
        1897: 'restoration: paint and plaster renewed',
        1952: 'post-war restoration, the roof re-laid',
        2025: 'today',
      },
      sun: { night: 'night' },
      sunDate: 'Nara, 21 June',
      compass: { N: 'N', E: 'E', S: 'S', W: 'W' },
      seasons: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
      labels: { brackets: 'Bracket sets (tokyō)', bell: 'Wind bell' },
      height: 'height',
    },
    pause: 'Pause (Space)',
    play: 'Play (Space)',
    soundOn: 'Sound off',
    soundOff: 'Sound on',
    language: 'Language',
  },
  de: {
    tagline: 'Kulturerbe in 4D entdecken',
    enter: 'Zum Viewer',
    skip: 'Intro überspringen',
    replay: 'Neu zusammensetzen',
    points: (n, total) => `${n} / ${total} Punkte an ihrem Platz`,
    mesh: (v, f) => `${v} Eckpunkte · ${f} Flächen`,
    loading: 'Punkte werden geladen…',
    error: 'Das Intro konnte nicht geladen werden.',
    hint: 'Mit der Maus über die Pagode fahren, um hineinzusehen · ziehen zum Drehen',
    hintTouch: 'Auf die Pagode tippen, um hineinzusehen · ziehen zum Drehen',
    lensTip: 'Mit der Maus hierher – hineinsehen',
    lensTipTouch: 'Hier tippen – hineinsehen',
    bar: {
      label: 'Kapitel des Intros',
      cloud: 'Punktwolke',
      mesh: 'Netz',
      short: { cloud: 'Wolke', mesh: 'Netz', section: 'Schnitte', annotations: 'Annotationen', shading: 'Schattierung', sun: 'Sonne', seasons: 'Jahreszeiten', cameras: 'Kameras', live: 'Live', time: '4D', surroundings: 'Umgebung' },
    },
    tour: {
      chapters: {
        section: 'Schnitte',
        annotations: 'Annotationen und POIs',
        shading: 'Schattierung',
        sun: 'Sonnenstudie',
        seasons: 'Jahreszeiten und Wetter',
        cameras: 'Szenenkameras',
        live: 'Kooperationsmodus',
        time: 'Zeitreise (4D)',
        surroundings: 'Umgebung im Wandel der Zeit',
      },
      surroundings: {
        periods: {
          'early-medieval': 'Frühmittelalter', medieval: 'Mittelalter', 'early-modern': 'Frühe Neuzeit',
          industrial: 'Industriezeitalter · Eisenbahn', modern: '20. Jahrhundert', postwar: 'Nachkriegszeit', contemporary: 'Gegenwart',
        },
        badgeTitle: 'Vergleichende Visualisierung',
        badge: 'Wie das Gebäude in einer anderen Umgebung durch die Epochen aussehen könnte. Die Umgebung ist generiert, typisch für die Art des Ortes und seine Zeit – keine Rekonstruktion dieses Ortes.',
        showcase: 'Andere Arten von Orten in anderen Regionen – realistische Ansicht, mit Leben auf den Straßen. Generiert, nur zum Vergleich.',
        kinds: { town: 'Stadt', village: 'Dorf', port: 'Hafen', monastery: 'Kloster', castle: 'Burg', church: 'Kirche', manor: 'Gutshaus', 'manor-farm': 'Gutshof', shtetl: 'Schtetl' },
        regions: { central: 'Mitteleuropa', mediterranean: 'Mittelmeerraum', nordic: 'Norden', british: 'Britische Inseln', eastern: 'Osteuropa', japanese: 'Japan', african: 'Westafrika' },
      },
      cameras: { names: ['Kamera 1', 'Kamera 2 · Front', 'Kamera 3 · von oben'], chosen: 'Blick aus Kamera 2', view: 'Kamera 2' },
      live: { badge: 'LIVE', phone: 'Handy · zweite Sitzung', screen: 'Live · 2 Geräte', sub: 'das Handy steuert den Bildschirm' },
      shading: { textures: 'Texturen', pbr: 'PBR: Glanz und Spiegelung', raking: 'Streiflicht' },
      timeNotes: {
        1615: 'Bau: neues Holz, frisches Zinnoberrot, vergoldete Bronze',
        1640: 'das Zinnoberrot dunkelt nach',
        1685: 'Farbe abgerieben, die Bronze wird braun',
        1702: 'erste Instandsetzung: neu gestrichen, Wände gekalkt',
        1765: 'Moos zwischen den Ziegeln',
        1830: 'neu gedeckt, neue Türen; Grünspan am Aufsatz',
        1897: 'Restaurierung: Farbe und Putz erneuert',
        1952: 'Restaurierung nach dem Krieg, Dach neu verlegt',
        2025: 'heute',
      },
      sun: { night: 'Nacht' },
      sunDate: 'Nara, 21. Juni',
      compass: { N: 'N', E: 'O', S: 'S', W: 'W' },
      seasons: { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' },
      labels: { brackets: 'Konsolen (Tokyō)', bell: 'Windglocke' },
      height: 'Höhe',
    },
    pause: 'Pause (Leertaste)',
    play: 'Abspielen (Leertaste)',
    soundOn: 'Ton aus',
    soundOff: 'Ton an',
    language: 'Sprache',
  },
};

// A deployment's own model (intro-scene.js): the texts above that name the
// pagoda, in neutral words; the scene's own texts come on top.
const GENERIC_TEXTS = {
  pl: {
    hint: 'Najedź na model, by zajrzeć do środka · przeciągnij, aby obrócić',
    hintTouch: 'Stuknij model, by zajrzeć do środka · przeciągnij, aby obrócić',
  },
  en: {
    hint: 'Hover over the model to look inside · drag to rotate',
    hintTouch: 'Tap the model to look inside · drag to rotate',
  },
  de: {
    hint: 'Mit der Maus über das Modell fahren, um hineinzusehen · ziehen zum Drehen',
    hintTouch: 'Auf das Modell tippen, um hineinzusehen · ziehen zum Drehen',
  },
};

// From the query or the hash: the viewer page (intro-overlay.js) passes its
// in the hash, which survives a server's index.html -> ./ style redirect.
const params = new URLSearchParams(window.location.search);
for (const [key, value] of new URLSearchParams(window.location.hash.slice(1))) {
  if (!params.has(key)) params.set(key, value);
}
const LANG_KEY = 'explora4d-intro-lang';
const lang = pickLanguage(params.get('lang'));
const t = sceneTexts(TEXTS[lang], GENERIC_TEXTS[lang], SCENE, lang);
const nextUrl = safeNextUrl(params.get('next'));
const embedded = params.get('embedded') === '1' && window.parent !== window;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const numberFormat = new Intl.NumberFormat(lang);

function pickLanguage(requested) {
  let stored = null;
  try {
    stored = localStorage.getItem(LANG_KEY);
  } catch {
    // no storage: the browser's
  }
  const candidates = [requested, stored, ...(navigator.languages || [navigator.language])];
  for (const candidate of candidates) {
    const code = String(candidate || '').slice(0, 2).toLowerCase();
    if (TEXTS[code]) return code;
  }
  return 'en';
}

// Only a page of this site: ?next= must not send visitors elsewhere.
function safeNextUrl(value) {
  if (!value) return DEFAULT_NEXT;
  try {
    const url = new URL(value, window.location.href);
    if (url.origin === window.location.origin) return url.href;
  } catch {
    // fall through
  }
  return DEFAULT_NEXT;
}

// --- Page --------------------------------------------------------------------

const ui = {
  root: document.getElementById('intro'),
  canvas: document.getElementById('intro-canvas'),
  tagline: document.getElementById('intro-tagline'),
  counter: document.getElementById('intro-counter'),
  enter: document.getElementById('intro-enter'),
  skip: document.getElementById('intro-skip'),
  replay: document.getElementById('intro-replay'),
  hint: document.getElementById('intro-hint'),
  status: document.getElementById('intro-status'),
  sound: document.getElementById('intro-sound'),
  pause: document.getElementById('intro-pause'),
  bar: document.getElementById('intro-bar'),
  lang: document.getElementById('intro-lang'),
};

document.documentElement.lang = lang;
applyHostInsets(params.get('insets'));
// Started again at a moment (the language switch): no entrance.
const resumeAt = Number.parseFloat(params.get('resume'));
const resumed = Number.isFinite(resumeAt) && resumeAt > 0;
if (resumed) ui.root.classList.add('is-instant');
applyBranding();
ui.tagline.textContent = t.tagline;
ui.enter.textContent = t.enter;
ui.skip.textContent = t.skip;
ui.replay.textContent = t.replay;
ui.replay.title = t.replay;
// A mouse or a finger: what the hints ask for.
const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true;
// A phone or tablet (a touch screen, also the app): every second point is
// drawn - the counter still counts them all - each a little larger, so the
// building stays as dense to the eye.
const POINT_STRIDE = window.matchMedia?.('(pointer: coarse)').matches ? 2 : 1;
ui.hint.textContent = canHover ? t.hint : t.hintTouch;
// The x-ray lens's tip, next to the lens while it shows itself.
ui.lensTip = document.createElement('p');
ui.lensTip.className = 'intro-lens-tip';
ui.lensTip.setAttribute('aria-hidden', 'true');
ui.lensTip.append(Object.assign(document.createElement('span'), { textContent: canHover ? t.lensTip : t.lensTipTouch }));
ui.root.append(ui.lensTip);
ui.status.textContent = t.loading;
ui.enter.href = nextUrl;
ui.skip.href = nextUrl;

// The deployment's name and logo (branding in viewer-settings.json,
// ../branding.js): the logo's version for dark backgrounds, the intro's.
function applyBranding() {
  const name = pickText(BRANDING.name, lang);
  if (name) document.title = name;
  const logo = BRANDING.logo;
  const image = document.querySelector('.intro-logo img');
  if (!image) return;
  if (logo === false || logo?.visible === false) {
    image.closest('.intro-logo').hidden = true;
    return;
  }
  const src = logo?.srcOnDark || logo?.src;
  if (typeof src !== 'string' || !src) return;
  try {
    const url = new URL(src, document.baseURI);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    image.src = url.href;
  } catch {
    return;
  }
  image.removeAttribute('width');
  image.removeAttribute('height');
  image.alt = (typeof logo.alt === 'string' && logo.alt) || name || '';
}

// The viewer page's safe area (viewer/intro-overlay.js), "top,right,bottom,left"
// in CSS pixels: an iframe gets none of its own, so the sound button and the
// title would sit under the app's status bar.
function applyHostInsets(value) {
  const sides = String(value || '').split(',').map(Number);
  if (sides.length !== 4 || sides.some((n) => !Number.isFinite(n) || n < 0 || n > 400)) return;
  ['top', 'right', 'bottom', 'left'].forEach((side, index) => {
    document.documentElement.style.setProperty(`--intro-host-${side}`, `${sides[index]}px`);
  });
}
if (embedded) {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type === 'explora4d-intro-host') applyHostInsets(event.data.insets);
  });
}

// --- Language ----------------------------------------------------------------

// Three words, the current one marked. A choice is remembered, the viewer
// page told (it switches too), and the intro loaded again in that language,
// from the same moment.
ui.lang?.setAttribute('aria-label', t.language);
for (const button of ui.lang?.querySelectorAll('button[data-lang]') || []) {
  button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  button.addEventListener('click', () => switchLanguage(button.dataset.lang));
}

function switchLanguage(code) {
  if (!TEXTS[code] || code === lang || exitStarted >= 0) return;
  try { localStorage.setItem(LANG_KEY, code); } catch { /* ignore */ }
  if (embedded) window.parent.postMessage({ type: 'explora4d-intro', action: 'lang', lang: code }, window.location.origin);
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  url.searchParams.delete('lang');
  url.searchParams.delete('resume');
  hash.set('lang', code);
  // Where it is now: held (?at=) stays held there; otherwise on from here.
  const T = started >= 0 ? timeline(now()) : 0;
  hash.delete('resume');
  if (isHeld()) {
    url.searchParams.delete('at');
    hash.set('at', heldAt.toFixed(2));
  } else if (T > 0.5 && rewindStart < 0) {
    hash.set('resume', T.toFixed(2));
  }
  url.hash = hash.toString();
  window.history.replaceState(null, '', url.href);
  window.location.reload();
}

// --- Progress bar ------------------------------------------------------------

// One button per part, equally wide; its fill shows how far the part is.
ui.bar.setAttribute('aria-label', t.bar.label);
const barParts = SEGMENTS.map((segment) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'intro-bar-part';
  const name = segment.key === 'cloud' || segment.key === 'mesh' ? t.bar[segment.key] : t.tour.chapters[segment.key];
  button.title = name;
  button.innerHTML = '<span class="intro-bar-track"><span class="intro-bar-fill"></span></span><span class="intro-bar-name"></span>';
  button.querySelector('.intro-bar-name').textContent = t.bar.short?.[segment.key] || name;
  // Until the points (and for the later parts, the model) are there.
  button.disabled = true;
  button.addEventListener('click', () => seek(segment.from + 0.01));
  ui.bar.appendChild(button);
  return { segment, button, fill: button.querySelector('.intro-bar-fill') };
});

// To that moment of the intro (seconds), at once.
function seek(T) {
  if (!cloud || exitStarted >= 0) return;
  rewindStart = -1;
  if (meshReveal) meshReadyAt = 0;
  if (isHeld()) heldAt = T;
  else started = now() - T;
  lastT = T; // a jump: no single sounds for what was skipped
  userTouched = false;
}

let lastBarState = '';
function showProgress(T) {
  // A model that came late starts its act late: the bar shows the act's own time.
  const late = meshReveal ? Math.max(0, meshReadyAt - LANDING) : 0;
  const shown = T > LANDING ? T - Math.min(late, T - LANDING) : T;
  let state = '';
  for (const part of barParts) {
    const { from, to } = part.segment;
    const amount = Math.min(1, Math.max(0, (shown - from) / (to - from)));
    const active = shown >= from && (shown < to || part === barParts.at(-1));
    // Parts after the cloud need the model.
    const ready = part.segment.key === 'cloud' || Boolean(meshReveal && tour);
    part.fill.style.transform = `scaleX(${amount.toFixed(3)})`;
    state += `${active ? 1 : 0}${ready ? 1 : 0}`;
    part.active = active;
    part.ready = ready;
  }
  if (state === lastBarState) return;
  lastBarState = state;
  for (const part of barParts) {
    part.button.classList.toggle('is-active', part.active);
    part.button.disabled = !part.ready;
    if (part.active) part.button.setAttribute('aria-current', 'step');
    else part.button.removeAttribute('aria-current');
  }
}

// --- Sound -------------------------------------------------------------------

const SOUND_KEY = 'explora4d-intro-sound';
const sound = createIntroSound();
let soundWanted = params.get('sound') === '1';
try {
  const stored = localStorage.getItem(SOUND_KEY);
  if (stored === '1' || stored === '0') soundWanted = stored === '1';
} catch {
  // no storage: the page's default
}

function showSoundState() {
  ui.sound.setAttribute('aria-pressed', String(soundWanted));
  ui.sound.title = soundWanted ? t.soundOn : t.soundOff;
  ui.sound.setAttribute('aria-label', ui.sound.title);
  ui.sound.classList.toggle('is-on', soundWanted);
}

function setSound(on, remember) {
  soundWanted = on;
  showSoundState();
  if (remember) {
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  }
  sound.setEnabled(on).catch((error) => console.warn('[intro] sound:', error));
}

showSoundState();
ui.sound.addEventListener('click', () => setSound(!soundWanted, true));
// Wanted from the start: on with the first gesture the browser allows it for.
if (soundWanted) {
  const start = (event) => {
    if (event.target === ui.sound) return; // the button's own click decides
    window.removeEventListener('pointerdown', start, true);
    window.removeEventListener('keydown', start, true);
    if (soundWanted && !sound.enabled) setSound(true, false);
  };
  window.addEventListener('pointerdown', start, true);
  window.addEventListener('keydown', start, true);
}

// Inside the viewer page: tell it (same origin only).
function tellViewer(action) {
  window.parent.postMessage({ type: 'explora4d-intro', action }, window.location.origin);
}

// One set of uniforms for both passes.
const cloudUniforms = {
  uTime: { value: 0 },
  uFade: { value: 0 },
  uProgress: { value: 0 },
  uExit: { value: 0 },
  uViewport: { value: 800 },
  uSize: { value: 0.016 },
  uRayOrigin: { value: new Vector3() },
  uRayDir: { value: new Vector3(0, 0, -1) },
  uHover: { value: 0 },
  uLight: { value: new Vector3(0.55, 0.75, 0.35).normalize() },
  // The last point's landing: where, and seconds since (negative: not yet).
  uFlashPos: { value: new Vector3() },
  uFlash: { value: -1 },
  // The model's faces (0..1) and the points' height range: a point gives
  // way once the faces at its height have formed.
  uFaces: { value: 0 },
  uYRange: { value: new Vector2(0, 1) },
};

// --- Scene -------------------------------------------------------------------

let renderer;
try {
  renderer = new WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  // No WebGL: the page still has its button into the viewer.
  showFallback();
}

const scene = new Scene();
const camera = new PerspectiveCamera(38, 1, 0.01, 100);
// Seconds since the page opened; ?at=<seconds> holds the intro at that
// moment (for stills and screen recordings).
// Held: ?at=, or reduced motion (the end, everything shown). The progress
// bar moves a held intro to another moment.
let heldAt = Number.parseFloat(params.get('at'));
const isHeld = () => Number.isFinite(heldAt);
const pageStart = performance.now();
const now = () => (performance.now() - pageStart) / 1000;
let controls;
// The camera's own distance (the path moves closer only for the time travel).
let cameraRadius = 0;
// Where the path put the camera last frame (null: not following it). A jump
// in the path (the progress bar, a late model, "Assemble again" after a
// drag) is eased out from there instead of cut.
let pathLast = null;
let pathStarted = false;
let cloud;
let dust;
let total = 0; // the points in the file: what the counter counts
let count = 0; // the points drawn (every second one on a phone)
let started = -1;
let meshReveal = null;
let tour = null;
let meshReadyAt = -1; // the intro time T when the model was ready
let lastPoint = null;
let exitStarted = -1;
let exitTarget = null;
const pointer = new Vector2(10, 10);
let hover = 0;
let hoverTarget = 0;
let userTouched = false;
// The x-ray lens. A mouse: it follows the pointer over the model. A finger
// (a drag turns the building): a tap pins it to the model where it touched,
// a tap beside the model takes it away. Until used it shows itself.
const lensPointer = new Vector2();
let lensPointerOn = false; // a mouse over the canvas
let lensMovedAt = -Infinity;
let lensUsedFor = 0;
let lensOn = 0;
const lensCentre = new Vector3();
const lensRay = { origin: new Vector3(), dir: new Vector3() };
let lensPin = null; // a tapped point on the model (intro space)
let lensTap = null; // a finger down that may be a tap: { x, y, at }
let lensTapAt = null; // a tap to place the lens with (ndc), next frame
const LENS_RADIUS = 0.3;
const TAP_MOVE = 10; // px
const TAP_TIME = 400; // ms
function hideHint() {
  if (userTouched && lensUsedFor > 0.6) ui.hint.classList.add('is-gone');
}

if (renderer) {
  renderer.setClearColor(new Color(0x05070d), 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; // the tour's sun study
  camera.position.set(3.75, 1.25, 4.7);
  controls = new OrbitControls(camera, ui.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = MAX_DISTANCE;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.62;
  // The camera's path turns it (frame()), not the controls.
  controls.autoRotate = false;
  controls.target.set(0, 0.12, 0);
  cameraRadius = camera.position.distanceTo(controls.target);
  controls.addEventListener('start', () => {
    userTouched = true;
    hideHint();
  });
  resize();
  window.addEventListener('resize', resize);
  const toNdc = (event, target) => {
    const rect = ui.canvas.getBoundingClientRect();
    return target.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };
  ui.canvas.addEventListener('pointermove', (event) => {
    toNdc(event, pointer);
    const mouse = event.pointerType === 'mouse';
    hoverTarget = mouse ? 1 : 0;
    lensMovedAt = now();
    if (mouse) {
      lensPointer.copy(pointer);
      lensPointerOn = true;
    } else if (lensTap && Math.hypot(event.clientX - lensTap.x, event.clientY - lensTap.y) > TAP_MOVE) {
      lensTap = null; // a drag: it turns the building
    }
  });
  let fingers = 0;
  ui.canvas.addEventListener('pointerdown', (event) => {
    lensMovedAt = now();
    if (event.pointerType === 'mouse') return;
    fingers++;
    lensTap = fingers === 1 ? { x: event.clientX, y: event.clientY, at: event.timeStamp } : null;
  });
  ui.canvas.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse') return;
    fingers = Math.max(0, fingers - 1);
    if (lensTap && event.timeStamp - lensTap.at < TAP_TIME) lensTapAt = toNdc(event, new Vector2());
    lensTap = null;
  });
  ui.canvas.addEventListener('pointercancel', (event) => {
    if (event.pointerType === 'mouse') return;
    fingers = Math.max(0, fingers - 1);
    lensTap = null;
  });
  ui.canvas.addEventListener('pointerleave', (event) => {
    hoverTarget = 0;
    if (event.pointerType === 'mouse') lensPointerOn = false;
  });
  load().catch((error) => {
    console.error('[intro]', error);
    ui.status.textContent = t.error;
    showFallback();
  });
}

function showFallback() {
  ui.root.classList.add('is-fallback', 'is-ready', 'is-assembled');
  if (embedded) tellViewer('ready');
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // A narrow (portrait) screen: further away, so the building fits across.
  camera.zoom = Math.min(1, camera.aspect / 1.15 + 0.15);
  camera.updateProjectionMatrix();
  // Point sizes follow the zoom, as the building does.
  const viewport = height * renderer.getPixelRatio() * camera.zoom;
  cloudUniforms.uViewport.value = viewport;
  if (dust) dust.material.uniforms.uViewport.value = viewport;
  meshReveal?.setViewport(viewport);
  tour?.setViewport(viewport);
}

// --- Data --------------------------------------------------------------------

async function load() {
  const response = await fetch(POINTS_URL);
  if (!response.ok) throw new Error(`${POINTS_URL}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== 'E4DP') throw new Error(`${POINTS_URL}: not an intro point file`);
  total = view.getUint32(4, true);
  const min = [0, 1, 2].map((k) => view.getFloat32(8 + k * 4, true));
  const max = [0, 1, 2].map((k) => view.getFloat32(20 + k * 4, true));
  const quantized = new Uint16Array(buffer, 32, total * 3);
  const srgb = new Uint8Array(buffer, 32 + total * 6, total * 3);
  const normals = new Int8Array(buffer, 32 + total * 9, total * 3);
  count = Math.ceil(total / POINT_STRIDE);
  if (POINT_STRIDE > 1) cloudUniforms.uSize.value *= Math.sqrt(POINT_STRIDE) * 0.95;

  // Centred on the ground's middle, about 3 units across.
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const scale = 2.9 / extent;
  const center = [(min[0] + max[0]) / 2, min[1] + (max[1] - min[1]) * 0.42, (min[2] + max[2]) / 2];
  const heightRange = max[1] - min[1];

  const target = new Float32Array(count * 3);
  const start = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const delay = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);

  let rand = 0x9e3779b9;
  const random = () => {
    rand ^= rand << 13; rand ^= rand >>> 17; rand ^= rand << 5;
    return (rand >>> 0) / 4294967296;
  };
  const gaussian = () => (random() + random() + random() - 1.5) / 1.5;

  // The cloud: a few swirling clumps, a nebula, and a thin haze between them.
  const clumps = Array.from({ length: 9 }, () => {
    const angle = random() * Math.PI * 2;
    const distance = 1.4 + random() * 3.2;
    return {
      x: Math.cos(angle) * distance,
      y: (random() - 0.4) * 2.4,
      z: Math.sin(angle) * distance,
      size: 0.5 + random() * 1.1,
    };
  });

  for (let i = 0; i < count; i++) {
    const j = i * POINT_STRIDE; // in the file
    let height = 0;
    for (let k = 0; k < 3; k++) {
      const value = min[k] + (quantized[j * 3 + k] / 65535) * (max[k] - min[k]);
      target[i * 3 + k] = (value - center[k]) * scale;
      if (k === 1) height = (value - min[1]) / heightRange;
      color[i * 3 + k] = srgb[j * 3 + k] / 255;
      normal[i * 3 + k] = normals[j * 3 + k] / 127;
    }
    const pick = random();
    if (pick < 0.62) {
      const clump = clumps[Math.floor(random() * clumps.length)];
      start[i * 3] = clump.x + gaussian() * clump.size;
      start[i * 3 + 1] = clump.y + gaussian() * clump.size * 0.7;
      start[i * 3 + 2] = clump.z + gaussian() * clump.size;
    } else if (pick < 0.88) {
      // A flat, turning disc - the arms of the nebula.
      const arm = Math.floor(random() * 3);
      const r = 0.6 + Math.pow(random(), 0.7) * 5.5;
      const angle = arm * (Math.PI * 2 / 3) + r * 0.85 + gaussian() * 0.35;
      start[i * 3] = Math.cos(angle) * r;
      start[i * 3 + 1] = gaussian() * 0.25 + 0.2;
      start[i * 3 + 2] = Math.sin(angle) * r;
    } else {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = 1 + Math.pow(random(), 0.5) * 6.5;
      start[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      start[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      start[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = random();
    // Foundations first, the roofs last - loosely, so it reads as gathering
    // rather than a scan line.
    delay[i] = Math.min(1, height * 0.62 + random() * 0.38);
  }

  // The last point: the highest one, the top of the roof. Moved to the end
  // of the arrays and left out of the cloud; it flies on its own.
  let top = 0;
  for (let i = 1; i < count; i++) if (target[i * 3 + 1] > target[top * 3 + 1]) top = i;
  const last = count - 1;
  for (const [array, size] of [[target, 3], [start, 3], [seed, 4], [delay, 1], [color, 3], [normal, 3]]) {
    for (let k = 0; k < size; k++) {
      const tmp = array[top * size + k];
      array[top * size + k] = array[last * size + k];
      array[last * size + k] = tmp;
    }
  }
  lastPoint = createLastPoint(
    new Vector3(target[last * 3], target[last * 3 + 1], target[last * 3 + 2]));
  scene.add(lastPoint.group);
  cloudUniforms.uFlashPos.value.copy(lastPoint.target);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < count; i++) {
    yMin = Math.min(yMin, target[i * 3 + 1]);
    yMax = Math.max(yMax, target[i * 3 + 1]);
  }
  cloudUniforms.uYRange.value.set(yMin, yMax);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(target, 3));
  geometry.setAttribute('aStart', new BufferAttribute(start, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  geometry.setAttribute('aDelay', new BufferAttribute(delay, 1));
  geometry.setAttribute('aColor', new BufferAttribute(color, 3));
  geometry.setAttribute('aNormal', new BufferAttribute(normal, 3));
  geometry.setDrawRange(0, count - 1);

  // Drawn twice: the points in flight as additive light, the points in
  // place as solid, lit discs.
  const solid = new Points(geometry, createCloudMaterial(false));
  const glow = new Points(geometry, createCloudMaterial(true));
  solid.frustumCulled = false;
  glow.frustumCulled = false;
  glow.renderOrder = 1;
  cloud = { solid, glow, uniforms: solid.material.uniforms };
  scene.add(solid, glow);

  dust = createDust(random);
  scene.add(dust);
  resize();

  ui.status.textContent = '';
  ui.root.classList.add('is-ready');
  if (embedded) tellViewer('ready');
  started = now() - (resumed ? resumeAt : 0);
  // Back in the URL without the moment: a reload starts from the beginning.
  if (resumed) {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    hash.delete('resume');
    url.hash = hash.toString();
    window.history.replaceState(null, '', url.href);
    requestAnimationFrame(() => requestAnimationFrame(() => ui.root.classList.remove('is-instant')));
  }
  // Reduced motion: held at the end, everything shown (the bar still moves it).
  if (reducedMotion && !isHeld()) heldAt = INTRO_END;
  showPauseState();
  renderer.setAnimationLoop(frame);

  // The model, while the points gather. Without it the intro ends with the
  // points.
  if (MODEL_URL) createMeshReveal({ url: MODEL_URL, renderer, center, scale, transcoderPath: TRANSCODER_PATH })
    .then((reveal) => {
      meshReveal = reveal;
      // Late (after the landing): its act starts now. Held (?at=) or shown
      // whole: as if it had been there from the start.
      meshReadyAt = isHeld() || resumed ? 0 : timeline(now());
      scene.add(reveal.group);
      // The scene's measurement, or the bounding box's height at its corner.
      const ground = SCENE.ground ?? min[1];
      const measure = SCENE.measure ?? { x: max[0], z: max[2], from: ground, to: max[1] };
      const height = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 })
        .format((measure.to - measure.from) * SCENE.unitInMeters);
      tour = createFeatureTour({
        reveal,
        camera,
        renderer,
        root: ui.root,
        texts: t,
        toIntro: (x, y, z) => new Vector3((x - center[0]) * scale, (y - center[1]) * scale, (z - center[2]) * scale),
        heightLabel: `${t.tour.height} ${height} m`,
        lang,
        scene: { ...SCENE, ground, measure },
        plan: PLAN,
        // Half the footprint's diagonal, in metres (the surroundings keep
        // clear of it).
        footprint: (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * SCENE.unitInMeters,
        // The model's box in the intro's space (the section plane's size).
        bounds: {
          min: new Vector3((min[0] - center[0]) * scale, (min[1] - center[1]) * scale, (min[2] - center[2]) * scale),
          max: new Vector3((max[0] - center[0]) * scale, (max[1] - center[1]) * scale, (max[2] - center[2]) * scale),
        },
      });
      scene.add(tour.group);
      resize();
    })
    .catch((error) => console.warn('[intro] the model could not be loaded:', error));
}

// --- Materials ---------------------------------------------------------------

const NOISE = /* glsl */ `
  // A smooth, cheap drift: sums of sines with per-point frequencies.
  vec3 drift(vec4 s, float time) {
    return vec3(
      sin(time * (0.21 + s.x * 0.35) + s.y * 6.2831) + 0.5 * sin(time * (0.53 + s.z * 0.4) + s.w * 12.0),
      sin(time * (0.17 + s.y * 0.3) + s.z * 6.2831) + 0.5 * sin(time * (0.47 + s.w * 0.4) + s.x * 12.0),
      sin(time * (0.19 + s.z * 0.33) + s.w * 6.2831) + 0.5 * sin(time * (0.59 + s.x * 0.4) + s.y * 12.0)
    );
  }
  vec3 rotateY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }
`;

function createCloudMaterial(glowPass) {
  return new ShaderMaterial({
    uniforms: cloudUniforms,
    defines: glowPass ? { GLOW_PASS: 1 } : {},
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFade;
      uniform float uProgress;
      uniform float uExit;
      uniform float uViewport;
      uniform float uSize;
      uniform vec3 uRayOrigin;
      uniform vec3 uRayDir;
      uniform float uHover;
      uniform vec3 uLight;
      uniform vec3 uFlashPos;
      uniform float uFlash;
      uniform float uFaces;
      uniform vec2 uYRange;
      attribute vec3 aStart;
      attribute vec4 aSeed;
      attribute float aDelay;
      attribute vec3 aColor;
      attribute vec3 aNormal;
      varying vec3 vColor;
      varying float vAlpha;
      ${NOISE}

      void main() {
        // This point's own share of the assembly: it sets off after its
        // delay and takes a while (longer for some) to arrive.
        float span = 0.32 + aSeed.x * 0.18;
        float local = clamp((uProgress - aDelay * (1.0 - span)) / span, 0.0, 1.0);
        float e = local * local * (3.0 - 2.0 * local);
        e = 1.0 - pow(1.0 - e, 2.2);
        float settle = smoothstep(0.6, 0.97, e);
        // Giving way to the model's faces, from the ground up.
        float h = (position.y - uYRange.x) / max(uYRange.y - uYRange.x, 1e-3);
        float gone = smoothstep(h * 0.59 + 0.1, h * 0.59 + 0.38, uFaces);

      #ifdef GLOW_PASS
        if (settle >= 0.999 && uExit <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
      #else
        if (settle <= 0.001 || gone >= 0.999) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
      #endif

        // In the cloud: drifting, the whole swarm slowly turning.
        vec3 chaos = rotateY(aStart, uTime * (0.04 + 0.08 / (1.0 + length(aStart.xz)))) + drift(aSeed, uTime) * 0.3;
        // On the way: a curve - a swirl around the building and a lift.
        vec3 path = mix(chaos, position, e);
        path = rotateY(path, (1.0 - e) * (1.5 + aSeed.z * 2.0) * (aSeed.w > 0.5 ? 1.0 : -1.0));
        path.y += sin(e * 3.14159) * (0.25 + aSeed.w * 0.6);
        // Arrived: a faint thermal tremble, like atoms in a lattice.
        path += drift(aSeed.yzwx, uTime * 3.0) * 0.002 * e;
        // The last point's landing: a wave of light through the building,
        // lifting the points a little as it passes.
        float flashDistance = length(position - uFlashPos);
        float wave = uFlash < 0.0 ? 0.0
          : exp(-pow((flashDistance - uFlash * 2.2) / 0.09, 2.0)) * exp(-uFlash * 0.9) * settle;
        path += aNormal * wave * 0.02;

        // The pointer pushes settled points aside.
        vec3 toPoint = path - uRayOrigin;
        vec3 closest = uRayOrigin + uRayDir * dot(toPoint, uRayDir);
        vec3 away = path - closest;
        float push = (1.0 - smoothstep(0.0, 0.42, length(away))) * uHover * e;
        path += normalize(away + 1e-5) * push * 0.18;

        // Leaving for the viewer: everything flies apart, outward and up.
        path += (normalize(path + vec3(0.0, 0.4, 0.0)) * (1.5 + aSeed.x * 3.0) + drift(aSeed, uTime) * 0.8) * uExit * uExit;

        vec4 mvPosition = modelViewMatrix * vec4(path, 1.0);
        gl_Position = projectionMatrix * mvPosition;

      #ifdef GLOW_PASS
        // Atoms in flight: larger, glowing, flickering; cold electric blue
        // and warm amber.
        float size = uSize * mix(2.2 + aSeed.y * 3.0, 1.4, e);
        vec3 energy = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.72, 0.38), step(0.62, aSeed.z));
        energy = mix(energy, aColor, smoothstep(0.3, 0.9, e));
        float flicker = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed.x * 3.5) + aSeed.y * 40.0);
        vColor = energy * flicker * (0.35 + 0.65 * aSeed.w) * 0.42;
        vAlpha = uFade * (1.0 - settle) * (1.0 - uExit) + uExit * (1.0 - uExit) * 1.5;
      #else
        // In place: lit by a low, warm light, both sides of thin walls.
        float size = uSize * (1.0 + push * 1.5 + wave * 0.35) * (1.0 - gone);
        vec3 n = normalize(mat3(modelMatrix) * aNormal);
        vec3 toCamera = normalize(cameraPosition - path);
        if (dot(n, toCamera) < 0.0) n = -n;
        float diffuse = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(n, toCamera), 0.0), 3.0);
        vec3 lit = aColor * (0.42 + 0.78 * diffuse) * vec3(1.04, 1.0, 0.95)
          + rim * vec3(0.25, 0.4, 0.7) * 0.6;
        vColor = lit + push * vec3(0.3, 0.5, 0.8) + wave * vec3(0.45, 0.65, 1.0) * 0.55;
        vAlpha = settle * (1.0 - uExit);
      #endif
        gl_PointSize = max(1.0, size * uViewport / -mvPosition.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = dot(uv, uv);
        if (r > 1.0) discard;
      #ifdef GLOW_PASS
        float glow = exp(-r * 4.0);
        gl_FragColor = vec4(vColor * glow * vAlpha, 1.0);
      #else
        if (vAlpha < 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0);
      #endif
      }
    `,
    transparent: glowPass,
    depthWrite: !glowPass,
    blending: glowPass ? AdditiveBlending : NormalBlending,
  });
}

// Faint motes around the building, there all the time.
function createDust(random) {
  const count = 2500;
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2;
    const radius = 2 + random() * 7;
    position[i * 3] = Math.cos(theta) * radius;
    position[i * 3 + 1] = (random() - 0.4) * 5;
    position[i * 3 + 2] = Math.sin(theta) * radius;
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uViewport: { value: 800 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uViewport;
      attribute vec4 aSeed;
      varying float vTwinkle;
      ${NOISE}
      void main() {
        vec3 p = rotateY(position, uTime * 0.012) + drift(aSeed, uTime * 0.4) * 0.4;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(1.0, (0.02 + aSeed.x * 0.03) * uViewport / -mvPosition.z);
        vTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed.y * 2.0) + aSeed.z * 30.0));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float glow = exp(-dot(uv, uv) * 4.0);
        gl_FragColor = vec4(vec3(0.55, 0.7, 1.0) * glow * vTwinkle * 0.45 * uFade, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

// --- The last point ------------------------------------------------------------

// A brighter atom with a short trail; on landing a flash and a ring.
function createLastPoint(target, start) {
  // Where it waits: beside the building and above it, a little behind it,
  // as the camera sees it when it sets off - in the picture on any screen
  // (a narrow one shows little to the sides), never between the camera and
  // the building.
  // Until then it keeps that place in the camera's view while the camera
  // circles (the camera's angle is a function of the intro's time too), so
  // it waits calmly instead of sweeping across the screen.
  // Spherical.theta (0: +Z) as an angle in x/z (atan2(z, x)).
  const waitAngle = (T) => {
    const before = Math.max(LAST_FLIGHT, LANDING - T);
    const cameraTheta = FRONT_THETA + LANDING_TURN_RATE * before + LANDING_TURN_EASE * before * before;
    return Math.PI / 2 - cameraTheta + WAIT_SIDE;
  };
  const wide = Math.min(1, Math.max(0, (camera.aspect - 0.6) / 0.7));
  const waitRadius = WAIT_RADIUS[0] + (WAIT_RADIUS[1] - WAIT_RADIUS[0]) * wide;
  const waitAbove = WAIT_ABOVE[0] + (WAIT_ABOVE[1] - WAIT_ABOVE[0]) * wide;
  const waitAt = (T, out) => out.set(Math.cos(waitAngle(T)) * waitRadius, target.y + waitAbove, Math.sin(waitAngle(T)) * waitRadius);
  const from = waitAt(LAST_START, new Vector3());
  const group = new Group();
  const glowUniforms = { uIntensity: { value: 1 }, uRing: { value: 0 }, uRingAlpha: { value: 0 }, uTime: { value: 0 } };
  const glow = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform float uRing;
      uniform float uRingAlpha;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float d = length(vUv);
        float core = exp(-d * d * 260.0);
        float halo = exp(-d * d * 22.0) * 0.2;
        // A soft four-pointed glint, slowly turning.
        float a = uTime * 0.25;
        vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * vUv;
        float glint = (exp(-abs(r.y) * 90.0) * exp(-abs(r.x) * 4.0) + exp(-abs(r.x) * 90.0) * exp(-abs(r.y) * 4.0)) * 0.25;
        float ring = exp(-pow((d - uRing) / 0.018, 2.0)) * uRingAlpha;
        vec3 color = vec3(1.0, 0.93, 0.8) * core * 1.4 + vec3(0.55, 0.75, 1.0) * (halo + glint) + vec3(0.6, 0.8, 1.0) * ring;
        gl_FragColor = vec4(color * uIntensity, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  glow.renderOrder = 10;
  group.add(glow);

  const TRAIL = 56;
  const trailGeometry = new BufferGeometry();
  trailGeometry.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const fadeAlong = new Float32Array(TRAIL);
  for (let i = 0; i < TRAIL; i++) fadeAlong[i] = 1 - i / TRAIL;
  trailGeometry.setAttribute('aFade', new BufferAttribute(fadeAlong, 1));
  const trailUniforms = { uViewport: cloudUniforms.uViewport, uAlpha: { value: 0 } };
  const trail = new Points(trailGeometry, new ShaderMaterial({
    uniforms: trailUniforms,
    vertexShader: /* glsl */ `
      uniform float uViewport;
      attribute float aFade;
      varying float vFade;
      void main() {
        vFade = aFade;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(1.0, (0.008 + 0.03 * aFade * aFade) * uViewport / -mvPosition.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying float vFade;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float glow = exp(-dot(uv, uv) * 4.0);
        gl_FragColor = vec4(mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.85, 0.6), vFade) * glow * vFade * uAlpha * 0.45, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  trail.frustumCulled = false;
  trail.renderOrder = 9;
  group.add(trail);

  // The way in: an arc down to the roof, a little round it, coming closer
  // from the first moment. It sets off gently (speeding up, fastest about a
  // third of the way, then slowing to land): never a jump.
  const fromAngle = Math.atan2(from.z, from.x);
  const fromRadius = Math.hypot(from.x, from.z);
  const toAngle = Math.atan2(target.z, target.x);
  const toRadius = Math.hypot(target.x, target.z);
  const departAngle = fromAngle;
  let turn = toAngle - departAngle;
  turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
  // The roof's top is near the middle: little way round to go; a little
  // more, away from the camera's side, so it does not cut straight across.
  turn += (turn >= 0 ? 1 : -1) * 0.6;
  // The share of the way at u (0..1): its speed rises from 0 as u, and
  // falls to 0 as (1 - u)^1.6 (the integral of u (1 - u)^1.6, normalised).
  const along = (u) => {
    const w = 1 - Math.min(1, Math.max(0, u));
    return 1 - 3.6 * Math.pow(w, 2.6) + 2.6 * Math.pow(w, 3.6);
  };
  // u <= 0: waiting at time T (turning with the cloud).
  const at = (u, out, T = LAST_START) => {
    if (u <= 0) return waitAt(T, out);
    const k = along(u);
    // Closer sooner than round: the radius leads the angle.
    const kr = 1 - Math.pow(1 - k, 1.6);
    const angle = departAngle + turn * k;
    const radius = fromRadius + (toRadius - fromRadius) * kr;
    out.set(
      Math.cos(angle) * radius,
      from.y + (target.y - from.y) * k + Math.sin(k * Math.PI) * 0.2,
      Math.sin(angle) * radius,
    );
    return out;
  };
  const position = new Vector3();
  const trailPositions = trailGeometry.getAttribute('position');

  return {
    group,
    target,
    position: glow.position,
    // T: the intro's time; time: the clock, for the glint.
    update(T, time, exit) {
      const flight = Math.min(1, Math.max(0, (T - LAST_START) / LAST_FLIGHT));
      const sinceLanding = T - LANDING;
      glowUniforms.uTime.value = time;
      at(flight, position, T);
      // Waiting at the edge of the cloud, drifting a little; the drift dies
      // away as it sets off, so it leaves from where it was.
      const drift = 1 - smoothstep01(flight / 0.18);
      if (drift > 0) {
        position.x += Math.sin(time * 0.37) * 0.12 * drift;
        position.y += Math.sin(time * 0.29 + 1.3) * 0.1 * drift;
        position.z += Math.cos(time * 0.31) * 0.12 * drift;
      }
      glow.position.copy(position);
      glow.quaternion.copy(camera.quaternion);
      const distance = camera.position.distanceTo(position);
      // On landing: a flash that fades; the ring spreads out.
      const flash = sinceLanding >= 0 ? Math.exp(-sinceLanding * 1.6) : 0;
      const breathe = 0.85 + 0.15 * Math.sin(time * 2.4);
      const fadeIn = Math.min(1, Math.max(0, (T - FADE_IN * 0.5) / FADE_IN));
      glowUniforms.uIntensity.value = (sinceLanding >= 0 ? flash * 1.3 : breathe * fadeIn * 0.75) * (1 - exit);
      glow.scale.setScalar(distance * (sinceLanding >= 0 ? 0.2 + (1 - flash) * 0.16 : 0.18));
      const ring = sinceLanding >= 0 ? Math.min(1, sinceLanding / 1.6) : 0;
      glowUniforms.uRing.value = ring * 0.95;
      glowUniforms.uRingAlpha.value = sinceLanding >= 0 ? (1 - ring) * 0.35 : 0;
      glow.visible = glowUniforms.uIntensity.value > 0.003;

      // The trail: where it was a moment ago.
      trailUniforms.uAlpha.value = flight > 0 && flight < 1 ? Math.min(1, flight * 8) : Math.max(0, 1 - sinceLanding * 3);
      trail.visible = trailUniforms.uAlpha.value > 0.003;
      if (trail.visible) {
        for (let i = 0; i < TRAIL; i++) {
          at(Math.max(0, flight - i * 0.0045), position);
          trailPositions.setXYZ(i, position.x, position.y, position.z);
        }
        trailPositions.needsUpdate = true;
      }
    },
  };
}

// --- Animation ---------------------------------------------------------------

function smoothstep01(x) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// The gathering: under way at once, slowing at the end.
const easeGather = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(x, 0.8));
const ray = { origin: new Vector3(), dir: new Vector3(), ndc: new Vector3() };
let lastCounter = '';
let rewindStart = -1;
let rewindFrom = 0;
let lastT = 0;
let lastTime = 0;
let lastArrived = 0;
// The camera's angle around the building at the landing: the front (the
// facade with the corner pavilions faces +Z), a little from the side. Before
// it, turning slower and slower to arrive there; after it, the tour's path
// (feature-tour.js tourCameraPath) - both functions of the intro's time, not
// of the frames drawn, so the sections always face the front.
const FRONT_THETA = SCENE.front;
const LANDING_TURN_RATE = (2 * Math.PI / 60) * 0.4;
const LANDING_TURN_EASE = 0.014;
const cameraPath = tourCameraPath({ plan: PLAN, front: FRONT_THETA, rate: LANDING_TURN_RATE, tourStart: TOUR_START });
const orbit = new Spherical();
// The surroundings' overview: the camera's polar angle there, and its own
// before it rose (null: not rising).
const OVERVIEW_PHI = 0.86;
let freePhi = null;
const orbitOffset = new Vector3();

// The intro's time T at the clock's time: running, held (?at=), shown whole
// (reduced motion) or running back ("Assemble again").
function timeline(time) {
  if (isHeld()) return heldAt;
  if (rewindStart >= 0) {
    const r = Math.min(1, (time - rewindStart) / REWIND);
    return rewindFrom + (ASSEMBLY_START - rewindFrom) * easeInOut(r);
  }
  return time - started;
}

const dt0 = (time) => Math.min(0.1, Math.max(0, time - lastTime));

// The x-ray lens over the standing model: it follows the pointer; until it
// has been used it shows itself, wandering over the front with a tip next
// to it (not while the tour's chapters play).
function updateLens(stage, time, dt, exit) {
  const uniforms = meshReveal?.uniforms;
  if (!uniforms) return;
  const standing = meshReveal.faces() >= 1 && exit <= 0 && rewindStart < 0;
  const tourTime = stage - TOUR_START;
  const cast = (x, y) => {
    lensRay.origin.copy(camera.position);
    lensRay.dir.set(x, y, 0.5).unproject(camera).sub(lensRay.origin).normalize();
    return meshReveal.raycast(lensRay.origin, lensRay.dir);
  };
  if (rewindStart >= 0) lensPin = null;
  // A tap: the lens pinned where it touched the model, or taken away.
  if (lensTapAt) {
    const tapped = standing ? cast(lensTapAt.x, lensTapAt.y) : -1;
    lensPin = tapped > 0 ? lensRay.dir.clone().multiplyScalar(tapped + LENS_RADIUS * 0.3).add(lensRay.origin) : null;
    if (lensPin) lensUsedFor = Math.max(lensUsedFor, 1);
    lensTapAt = null;
  }
  // The pointer's own lens, when it is over the model.
  let distance = standing && lensPointerOn ? cast(lensPointer.x, lensPointer.y) : -1;
  const pinned = !(distance > 0) && standing && lensPin !== null;
  const user = distance > 0 || pinned;
  // Otherwise, until used, the lens shows itself - once the pointer has
  // been still a moment, outside the chapters.
  const demo = !user && standing && lensUsedFor <= 0.6 && time - lensMovedAt > 1.2
    && (tourTime < 0 || tourTime > TOUR_LENGTH);
  if (demo) {
    distance = reducedMotion ? cast(0.1, 0.02)
      : cast(0.2 * Math.sin(time * 0.42), 0.02 + 0.12 * Math.sin(time * 0.29 + 1));
  }
  const hit = distance > 0 || pinned;
  if (hit) {
    const target = pinned ? lensPin : lensRay.dir.multiplyScalar(distance + LENS_RADIUS * 0.3).add(lensRay.origin);
    if (lensOn < 0.05) lensCentre.copy(target);
    else lensCentre.lerp(target, Math.min(1, dt * 18));
    if (user) {
      lensUsedFor += dt;
      hideHint();
    }
  }
  lensOn += ((hit ? 1 : 0) - lensOn) * Math.min(1, dt * 7);
  if (lensOn < 0.005) lensOn = 0;
  uniforms.uLens.value.set(lensCentre.x, lensCentre.y, lensCentre.z, LENS_RADIUS);
  uniforms.uLensOn.value = lensOn;
  // The tip, beside the lens while it shows itself.
  const tip = demo && hit && lensUsedFor <= 0.6 ? lensOn : 0;
  ui.lensTip.style.opacity = tip.toFixed(3);
  if (tip > 0) {
    ray.ndc.copy(lensCentre).project(camera);
    const rect = ui.canvas.getBoundingClientRect();
    const x = rect.left + (ray.ndc.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-ray.ndc.y * 0.5 + 0.5) * rect.height;
    ui.lensTip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    // On the left of the lens when it would not fit on its right.
    const width = ui.lensTip.firstChild.offsetWidth;
    ui.lensTip.classList.toggle('is-left', x + 56 + width > window.innerWidth - 16 && x - 56 - width > 16);
  }
}

function frame() {
  const time = now();
  if (rewindStart >= 0 && time - rewindStart >= REWIND) {
    // Back in the cloud: gather again from the start.
    started = time - ASSEMBLY_START;
    rewindStart = -1;
    if (meshReveal) meshReadyAt = 0;
  }
  const T = timeline(time);
  const fade = Math.min(1, T / FADE_IN);
  const progress = easeGather(Math.min(1, Math.max(0, (T - ASSEMBLY_START) / ASSEMBLY)));
  const exit = exitStarted < 0 ? 0 : Math.min(1, (time - exitStarted) / EXIT);
  // The model's act: from the landing, or from when the model was ready.
  const stage = meshReveal ? T - Math.max(LANDING, meshReadyAt) : 0;
  let tourCue = '';

  const uniforms = cloudUniforms;
  uniforms.uTime.value = time;
  uniforms.uFade.value = fade;
  uniforms.uProgress.value = progress;
  uniforms.uExit.value = exit;
  uniforms.uFlash.value = T >= LANDING ? T - LANDING : -1;
  dust.material.uniforms.uTime.value = time;
  dust.material.uniforms.uFade.value = fade * (1 - exit);
  lastPoint.update(T, time, exit);
  if (meshReveal) {
    meshReveal.update(stage, exit);
    if (tour) tourCue = tour.update(stage - TOUR_START, time, exit);
    uniforms.uFaces.value = meshReveal.faces();
  }

  updateLens(stage, time, dt0(time), exit);

  // The pointer's ray, for pushing points aside.
  hover += (hoverTarget - hover) * 0.08;
  uniforms.uHover.value = hover;
  ray.origin.copy(camera.position);
  ray.ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
  ray.dir.copy(ray.ndc).sub(ray.origin).normalize();
  uniforms.uRayOrigin.value.copy(ray.origin);
  uniforms.uRayDir.value.copy(ray.dir);

  // The counter: points in place (the shader's own timing; the last one
  // only when it lands), then the model's vertices and faces.
  let counter;
  if (meshReveal && stage > TIMING.vertices[0]) {
    const { vertices, faces } = meshReveal.counts(stage);
    counter = t.mesh(numberFormat.format(vertices), numberFormat.format(faces));
  } else {
    const arrived = T >= LANDING
      ? total
      : Math.min(total - 1, Math.round(total * Math.min(1, Math.max(0, (progress - 0.32) / 0.66))));
    counter = t.points(numberFormat.format(arrived), numberFormat.format(total));
  }
  if (counter !== lastCounter) {
    lastCounter = counter;
    ui.counter.textContent = counter;
  }
  // The sound follows the same moment.
  const arrivedFraction = T >= LANDING ? 1 : Math.min(1, Math.max(0, (progress - 0.32) / 0.66));
  const dt = Math.min(0.1, Math.max(0, time - lastTime));
  const levels = meshReveal && stage > 0 ? meshReveal.levels(stage) : null;
  ray.ndc.copy(lastPoint.position).project(camera);
  sound.update({
    dt,
    forward: T > lastT && T - lastT < 0.5 && !isHeld() && rewindStart < 0,
    fade,
    progress,
    arrivedRate: dt > 0 ? Math.max(0, arrivedFraction - lastArrived) / dt : 0,
    flight: Math.min(1, Math.max(0, (T - LAST_START) / LAST_FLIGHT)),
    pan: ray.ndc.x,
    landed: T >= LANDING,
    vertices: levels?.vertices ?? 0,
    edges: levels?.edges ?? 0,
    faces: levels?.faces ?? 0,
    glowOut: levels?.glowOut ?? 0,
    exit,
  });
  if (tourCue && T > lastT && T - lastT < 0.5 && !isHeld() && rewindStart < 0) sound.cue(tourCue);
  lastT = T;
  lastTime = time;
  lastArrived = arrivedFraction;

  showProgress(T);
  // The logo fades to a watermark once the points are under way.
  ui.root.classList.toggle('is-watermark', T > WATERMARK_AT);
  ui.root.classList.toggle('is-assembling', progress > 0.02);
  ui.root.classList.toggle('is-assembled', T >= LANDING - 0.3);

  // While gathering the camera circles faster, slowing as the building
  // forms, to face its front at the landing; then the tour's path. The
  // angle follows the intro's time, not how far it happened to turn (also
  // when held, jumped to or run backwards).
  if (exitStarted < 0 && !userTouched && !reducedMotion) {
    const before = LANDING - T;
    let theta;
    let dolly = 1;
    let tilt = 0;
    if (before > 0) {
      theta = FRONT_THETA + LANDING_TURN_RATE * before + LANDING_TURN_EASE * before * before;
    } else {
      // The model's act; without the model (yet), from the landing.
      let sunStudy;
      ({ theta, dolly, tilt, sun: sunStudy } = cameraPath(meshReveal ? stage : T - LANDING));
      // A narrow screen: back a little for the sun study, so the sun's way
      // from sunrise to sunset stays in the picture.
      dolly *= 1 + sunStudy * 0.3 * (1 - Math.min(1, Math.max(0, (camera.aspect - 0.6) / 0.7)));
    }
    const radius = cameraRadius * dolly;
    // Drawing back over the surroundings: further than a visitor may zoom.
    controls.maxDistance = Math.max(MAX_DISTANCE, radius * 1.05);
    orbit.setFromVector3(orbitOffset.copy(camera.position).sub(controls.target));
    // Looking down on the surroundings: from the camera's own height
    // (as it was when it began) towards OVERVIEW_PHI.
    if (tilt > 0.0005) {
      freePhi ??= orbit.phi;
      orbit.phi = freePhi + (OVERVIEW_PHI - freePhi) * tilt;
    } else if (freePhi !== null) {
      orbit.phi = freePhi;
      freePhi = null;
    }
    const wrap = (angle) => angle - Math.round(angle / (2 * Math.PI)) * 2 * Math.PI;
    // Off the path by as much as last frame, less a little.
    const from = pathLast ?? { theta, radius };
    // Held, or the intro's first frame: right on it.
    const ease = isHeld() || !pathStarted ? 0 : Math.exp(-dt * 3);
    pathStarted = true;
    const offTheta = wrap(orbit.theta - from.theta) * ease;
    const offRadius = (orbit.radius - from.radius) * ease;
    orbit.theta = theta + offTheta;
    orbit.radius = radius + offRadius;
    camera.position.setFromSpherical(orbit).add(controls.target);
    pathLast = pathLast ? Object.assign(pathLast, { theta, radius }) : { theta, radius };
  } else {
    pathLast = null;
  }
  if (exitStarted >= 0) {
    camera.position.lerp(exitTarget, 0.04);
    if (exit >= 1) {
      renderer.setAnimationLoop(null);
      if (embedded) tellViewer('done');
      else window.location.href = nextUrl;
      return;
    }
  }
  controls.update();
  renderer.render(scene, camera);
  const views = tour?.views() ?? [];
  if (views.length) renderViews(views);
}

// The tour's extra views (feature-tour.js views()): a scene camera's, the
// phone's - the scene again, into their rectangles (CSS pixels, top left).
const viewportSize = new Vector2();
function renderViews(views) {
  renderer.getSize(viewportSize);
  const lensOn = meshReveal.uniforms.uLensOn.value;
  meshReveal.uniforms.uLensOn.value = 0;
  renderer.setScissorTest(true);
  for (const view of views) {
    const { x, y, width, height } = view.rect;
    if (width < 2 || height < 2) continue;
    const bottom = viewportSize.y - y - height;
    renderer.setViewport(x, bottom, width, height);
    renderer.setScissor(x, bottom, width, height);
    const hidden = view.hide.filter((object) => object.visible);
    for (const object of hidden) object.visible = false;
    renderer.render(scene, view.camera);
    for (const object of hidden) object.visible = true;
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, viewportSize.x, viewportSize.y);
  meshReveal.uniforms.uLensOn.value = lensOn;
}

function leave(event) {
  if (embedded) {
    event.preventDefault();
    if (!renderer || !cloud || reducedMotion) {
      tellViewer('done');
      return;
    }
  } else {
    if (!renderer || !cloud || reducedMotion) return; // the plain link
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
  }
  if (exitStarted >= 0) return;
  exitStarted = now();
  exitTarget = camera.position.clone().multiplyScalar(0.55);
  ui.root.classList.add('is-leaving');
  sound.enter(EXIT);
  // Inside the viewer: it starts fading the intro out while it flies apart.
  if (embedded) tellViewer('leaving');
}

ui.enter.addEventListener('click', leave);
ui.skip.addEventListener('click', (event) => {
  if (!embedded) return;
  event.preventDefault();
  sound.setEnabled(false);
  tellViewer('done');
});

// Pause and play: paused, the intro is held at its moment (as ?at= holds
// it: the bar still moves it, the model can still be turned); play goes on
// from there - from a moment ?at= held too.
function showPauseState() {
  const paused = isHeld();
  ui.pause.classList.toggle('is-paused', paused);
  ui.pause.setAttribute('aria-pressed', String(paused));
  ui.pause.title = paused ? t.play : t.pause;
  ui.pause.setAttribute('aria-label', ui.pause.title);
}
function setPaused(paused) {
  if (!cloud || exitStarted >= 0 || paused === isHeld()) return;
  if (paused) {
    heldAt = timeline(now());
    rewindStart = -1;
  } else {
    started = now() - heldAt;
    lastT = heldAt; // no single sounds for the pause
    heldAt = Number.NaN;
  }
  showPauseState();
}
showPauseState();
ui.pause.addEventListener('click', () => setPaused(!isHeld()));
window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  // A focused button or link takes Space itself.
  if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
  event.preventDefault();
  setPaused(!isHeld());
});

ui.replay.addEventListener('click', () => {
  // Paused: it plays again, running back first.
  if (isHeld() && !reducedMotion) setPaused(false);
  if (!cloud || reducedMotion || exitStarted >= 0 || rewindStart >= 0 || isHeld()) return;
  rewindFrom = timeline(now());
  rewindStart = now();
  sound.rewind();
  userTouched = false;
});

// The viewer, fetched while the intro plays, so it opens ready: its page,
// then what the page loads first - its scripts, stylesheets and settings -
// into the browser's cache. The model is the intro's own (already there).
// Inside the viewer (embedded) the viewer loads underneath anyway.
function prefetchViewer() {
  const add = (href, as) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    if (as) link.as = as;
    link.href = href;
    document.head.appendChild(link);
  };
  fetch(nextUrl, { credentials: 'same-origin' })
    .then((response) => (response.ok ? response.text() : ''))
    .then((html) => {
      if (!html) return;
      const page = new DOMParser().parseFromString(html, 'text/html');
      const base = new URL(nextUrl, window.location.href);
      const sameSite = (value) => {
        try {
          const url = new URL(value, base);
          return url.origin === window.location.origin ? url.href : null;
        } catch {
          return null;
        }
      };
      page.querySelectorAll('script[src]').forEach((script) => {
        const href = sameSite(script.getAttribute('src'));
        if (href) add(href, 'script');
      });
      page.querySelectorAll('link[rel~="stylesheet"][href], link[rel~="modulepreload"][href]').forEach((link) => {
        const href = sameSite(link.getAttribute('href'));
        if (href) add(href, link.rel.includes('stylesheet') ? 'style' : 'script');
      });
      add(new URL('viewer-settings.json', base).href, 'fetch');
    })
    .catch(() => {});
}
if (!embedded) {
  // After the intro's own files: a few seconds in, when the points gather.
  setTimeout(prefetchViewer, 2500);
}
// Inside the viewer, Escape skips the intro.
if (embedded) {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') ui.skip.click();
  });
  document.documentElement.classList.add('is-embedded');
}
//# sourceMappingURL=intro-bzR_tfXL.js.map
