import { gd as KTX2Loader, g7 as GLTFLoader, ge as MeshoptDecoder, a1 as Matrix4, M as Matrix3, V as Vector3, aM as Group, am as BufferGeometry, a9 as BufferAttribute, h as Mesh, f1 as Points, fj as ShaderMaterial, c8 as AdditiveBlending, eJ as LineSegments, d5 as HemisphereLight, d2 as DirectionalLight, Y as Vector4, Q as Vector2, ai as DoubleSide, bp as PlaneGeometry, aV as LineBasicMaterial, C as Color, g8 as WebGLRenderer, i as Scene, bn as PerspectiveCamera, gf as OrbitControls, N as NormalBlending } from './assets/three-Dhy7exgi.js';
import { s as sunriseSunset, f as formatSunTime, a as solarPosition, b as sunTimestamp, H as HORIZON, R as RAD } from './assets/sun-position-C35jyMtL.js';

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
  };

  const meshes = [];
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

  return {
    group,
    meshes,
    sun,
    hemisphere,
    uniforms: faceUniforms,
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
        varying float vReveal;
        varying vec3 vBary;
        varying vec3 vTourPos;
        varying vec3 vTourNormal;
        // The viewer's shading modes that keep the textures, in brief:
        // 0 textures, 1 toon, 2 raking light.
        vec3 introShade(float mode, vec3 base, vec3 albedo, vec3 soft, vec3 n, vec3 viewNormal) {
          if (mode < 0.5) return base;
          vec3 tone = pow(albedo, vec3(1.0 / 2.2));
          if (mode < 1.5) {
            // Toon: flat bands of light on the textures, ink along creases.
            float l = dot(n, normalize(vec3(0.5, 0.8, 0.3)));
            float band = l > 0.55 ? 1.0 : (l > 0.15 ? 0.74 : 0.5);
            // The texture's colour, blurred (a smaller mip level): patches,
            // not grain.
            vec3 paint = pow(soft, vec3(1.0 / 2.2));
            float crease = smoothstep(0.25, 0.6, length(fwidth(n)));
            return clamp(paint * band * 1.12, 0.0, 1.0) * (1.0 - crease * 0.85);
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

// The intro's sound (viewer/intro/intro.js), made on the fly with the Web
// Audio API - no audio files:
//
// - a low, slowly breathing drone and a little air under everything;
// - soft glassy plucks as the points click into place (a pentatonic scale,
//   higher as the building rises);
// - the last point: a thin, rising glass tone that follows it across the
//   screen; its landing: a quiet bell and a soft low thump;
// - the model: tiny sparks for the vertices, a brushed noise sweep while the
//   edges are drawn, a warm chord opening up as the faces form, and a last
//   bell when it stands;
// - the feature tour: a soft two-note cue for each chapter, ticks between;
// - "Assemble again" and "Enter the viewer": a whoosh.
//
// Browsers let sound start only after a click or key press, so the page
// calls setEnabled(true) from one. update() runs every frame with where the
// intro is; the continuous voices follow it (also backwards), the single
// sounds only play while it runs forward.

const PENTATONIC = [0, 3, 5, 7, 10]; // A minor pentatonic, semitones
const A4 = 440;
const note = (semitones) => A4 * Math.pow(2, semitones / 12);

function createIntroSound() {
  let ctx = null;
  let enabled = false;
  let voices = null;
  let last = null; // the previous frame's state

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    master.connect(compressor).connect(ctx.destination);

    // A soft room: a convolver with a decaying noise impulse.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.2, 2.6);
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 0.55;
    reverbIn.connect(reverb).connect(master);

    const noise = noiseBuffer(ctx, 3);

    // The drone: two low sines a fifth apart and a soft triangle, through a
    // lowpass that slowly breathes.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 420;
    droneFilter.Q.value = 0.6;
    droneFilter.connect(droneGain).connect(master);
    droneGain.connect(reverbIn);
    for (const [frequency, type, level, detune] of [[55, 'sine', 0.5, 0], [82.41, 'sine', 0.32, 0], [110, 'triangle', 0.12, 6]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(droneFilter);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 160;
    lfo.connect(lfoDepth).connect(droneFilter.frequency);
    lfo.start();
    // Air: quiet band-passed noise.
    const air = loopNoise(ctx, noise);
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 900;
    airFilter.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.18;
    air.connect(airFilter).connect(airGain).connect(droneGain);

    // The last point's glass tone.
    const glass = ctx.createOscillator();
    glass.type = 'sine';
    const glassOvertone = ctx.createOscillator();
    glassOvertone.type = 'triangle';
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.18;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.2;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 5; // cents
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(glass.detune);
    vibratoDepth.connect(glassOvertone.detune);
    const glassGain = ctx.createGain();
    glassGain.gain.value = 0;
    const glassPan = ctx.createStereoPanner();
    glass.connect(glassGain);
    glassOvertone.connect(overtoneGain).connect(glassGain);
    glassGain.connect(glassPan).connect(master);
    glassPan.connect(reverbIn);
    glass.start(); glassOvertone.start(); vibrato.start();

    // The edges being drawn: brushed noise, a band sweeping upwards.
    const brush = loopNoise(ctx, noise);
    const brushFilter = ctx.createBiquadFilter();
    brushFilter.type = 'bandpass';
    brushFilter.Q.value = 2.2;
    brushFilter.frequency.value = 400;
    const brushGain = ctx.createGain();
    brushGain.gain.value = 0;
    brush.connect(brushFilter).connect(brushGain).connect(master);
    brushGain.connect(reverbIn);

    // The faces: a warm A major 9 chord, its filter opening as they form.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 250;
    padFilter.Q.value = 0.8;
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padFilter.connect(padGain).connect(master);
    padGain.connect(reverbIn);
    for (const [semitones, level] of [[-24, 0.3], [-17, 0.22], [-12, 0.2], [-8, 0.14], [-5, 0.12], [-1, 0.08]]) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note(semitones);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = level * 0.5;
        osc.connect(g).connect(padFilter);
        osc.start();
      }
    }

    voices = {
      master, reverbIn, noise, droneGain, droneFilter,
      glass, glassOvertone, glassGain, glassPan,
      brushFilter, brushGain, padFilter, padGain,
    };
  }

  // --- Single sounds ---------------------------------------------------------

  function pluck(frequency, level, pan = 0, decay = 0.7) {
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(level, now + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(voices.master);
    panner.connect(voices.reverbIn);
    for (const [ratio, gain] of [[1, 1], [2, 0.25], [3.01, 0.08]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * ratio;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
  }

  // A bell: inharmonic partials, a long decay.
  function bell(frequency, level, decay = 3) {
    const now = ctx.currentTime;
    for (const [ratio, gain, length] of [[1, 1, 1], [2, 0.5, 0.8], [2.76, 0.35, 0.6], [4.07, 0.2, 0.4], [5.4, 0.12, 0.3]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(level * gain, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay * length);
      osc.connect(g);
      g.connect(voices.master);
      g.connect(voices.reverbIn);
      osc.start(now);
      osc.stop(now + decay + 0.1);
    }
  }

  function thump(level) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    osc.connect(g).connect(voices.master);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  // Noise through a band sweeping from one frequency to another.
  function whoosh(from, to, length, level) {
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = voices.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(to, now + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + length * 0.4);
    g.gain.linearRampToValueAtTime(0, now + length);
    source.connect(filter).connect(g);
    g.connect(voices.master);
    g.connect(voices.reverbIn);
    source.start(now);
    source.stop(now + length + 0.05);
  }

  // --- Following the intro ----------------------------------------------------

  const smooth = (param, value, time = 0.12) => param.setTargetAtTime(value, ctx.currentTime, time);
  const bump = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);

  // state: { dt, forward, fade, progress, arrivedRate, flight, pan, landed,
  //          vertices, edges, faces, glowOut, exit }
  function update(state) {
    if (!enabled || !voices || ctx.state !== 'running') {
      last = state;
      return;
    }
    const v = voices;
    const { dt, forward } = state;

    // The drone: there from the start, quieter once the building stands.
    smooth(v.droneGain.gain, state.fade * (0.16 - state.glowOut * 0.07) * (1 - state.exit), 0.4);
    smooth(v.droneFilter.frequency, 380 + state.progress * 220 + state.faces * 300, 0.6);

    // Points arriving: plucks, as many as are arriving (within reason).
    if (forward && state.arrivedRate > 0) {
      const perSecond = Math.min(11, state.arrivedRate * 32);
      if (Math.random() < perSecond * dt) {
        const octave = Math.floor(state.progress * 2.2 + Math.random() * 1.2);
        const step = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
        pluck(note(step + 12 * octave - 5), 0.035 + Math.random() * 0.025, Math.random() * 1.6 - 0.8, 0.5 + Math.random() * 0.6);
      }
    }

    // The last point: a glass tone, rising as it comes in.
    const flying = state.flight > 0 && !state.landed;
    const glassLevel = flying ? 0.045 * Math.min(1, state.flight * 5) : 0;
    smooth(v.glassGain.gain, glassLevel * (1 - state.exit), flying ? 0.3 : 0.08);
    const glassFrequency = 1046.5 * Math.pow(2, (state.flight * 7) / 12);
    smooth(v.glass.frequency, glassFrequency, 0.2);
    smooth(v.glassOvertone.frequency, glassFrequency * 2.003, 0.2);
    smooth(v.glassPan.pan, Math.max(-0.9, Math.min(0.9, state.pan)), 0.1);
    if (forward && state.landed && last && !last.landed) {
      bell(1318.5, 0.06, 3.2);
      bell(659.25, 0.045, 3.6);
      thump(0.22);
    }

    // Vertices: tiny sparks.
    if (forward && last && state.vertices > last.vertices && state.vertices < 1) {
      const perSecond = Math.min(18, ((state.vertices - last.vertices) / Math.max(dt, 1e-3)) * 40);
      if (Math.random() < perSecond * dt) {
        pluck(2000 + Math.random() * 3200, 0.008 + Math.random() * 0.01, Math.random() * 1.8 - 0.9, 0.12);
      }
    }

    // Edges: the brush, sweeping up while they are drawn.
    smooth(v.brushGain.gain, 0.05 * bump(state.edges) * (1 - state.exit), 0.2);
    smooth(v.brushFilter.frequency, 350 + state.edges * 3200, 0.2);

    // Faces: the chord swells and opens, then settles.
    const padLevel = (Math.min(1, state.faces * 1.6) * (1 - state.glowOut * 0.55)) * 0.07 * (1 - state.exit);
    smooth(v.padGain.gain, padLevel, 0.5);
    smooth(v.padFilter.frequency, 220 + state.faces * 2200 - state.glowOut * 1200, 0.5);
    if (forward && last && state.faces >= 1 && last.faces < 1) {
      bell(880, 0.045, 4);
      bell(1318.5, 0.03, 3.5);
    }
    last = state;
  }

  async function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
      voices.master.gain.cancelScheduledValues(ctx.currentTime);
      voices.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    } else if (ctx) {
      voices.master.gain.cancelScheduledValues(ctx.currentTime);
      voices.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { if (!enabled) ctx.suspend(); }, 800);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enabled) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    get enabled() { return enabled; },
    setEnabled,
    update,
    // The feature tour (feature-tour.js): a soft two-note cue for a new
    // chapter, a small tick for a step within one.
    cue(kind) {
      if (!enabled || !voices || ctx.state !== 'running') return;
      if (kind === 'chapter') {
        pluck(note(7), 0.045, -0.3, 1.1);
        setTimeout(() => { if (enabled) pluck(note(12), 0.04, 0.3, 1.3); }, 110);
      } else {
        pluck(note(19 + Math.floor(Math.random() * 3) * 2), 0.022, Math.random() * 1.2 - 0.6, 0.45);
      }
    },
    rewind() {
      if (enabled && voices && ctx.state === 'running') whoosh(3200, 300, 2.2, 0.08);
    },
    // Into the viewer: a whoosh, everything fading with the picture.
    enter(length) {
      if (!enabled || !voices || ctx.state !== 'running') return;
      whoosh(250, 4200, length, 0.1);
      voices.master.gain.setTargetAtTime(0, ctx.currentTime + length * 0.4, length * 0.3);
    },
  };
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function loopNoise(ctx, buffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
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

// The intro's third act (viewer/intro/intro.js): once the model stands, an
// express tour of what the viewer does with it, each chapter a few seconds
// with its name under the title:
//
//   1. sections      - a plane sweeps through the building, the cut glows
//   2. annotations   - pins with labels, and a height measurement
//   3. shading       - wipes through textures, toon, raking light
//   4. sun study     - the sun's real path over Wołpa on midsummer day, the
//                      sun itself and its track in the sky, a compass on the
//                      ground, shadows; the camera holds still meanwhile
//   5. seasons       - spring petals, summer, autumn leaves, winter snow
//
// Like the rest of the intro, update(tour) is a function of the tour's time
// only (it runs backwards for "Assemble again", ?at= holds it).

// Seconds into the tour.
const CHAPTERS = [
  { key: 'section', from: 0, to: 3.0 },
  { key: 'annotations', from: 3.0, to: 6.4 },
  { key: 'shading', from: 6.4, to: 10.0 },
  { key: 'sun', from: 10.0, to: 14.8 },
  { key: 'seasons', from: 14.8, to: 19.8 },
];
const TOUR_LENGTH = 20.4;
const START = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.key, chapter.from]));

// Shading: [from, to] modes, each step a wipe (see mesh-reveal.js introShade).
const SHADING_STEPS = [[0, 1], [1, 2], [2, 0]];
const SHADING_KEYS = ['textures', 'toon', 'raking'];
const SHADING_LENGTH = 3.6;

// The sun study: Wołpa (Voŭpa, Belarus), midsummer day, local time (UTC+3).
// The model's north is taken to be -Z (the viewer's default, AIM3DViewer
// location.north = 0): the model's files do not say where north is.
const SITE = { latitude: 53.37, longitude: 24.37, utcOffset: 3, north: 0, year: 2026, month: 6, day: 21 };
const SUN_LENGTH = 4.8;
// The sun's track around the building's middle, this far out (intro units).
const SUN_RADIUS = 2.5;
// The compass ring on the ground.
const COMPASS_RADIUS = 2.15;
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

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
 */
function createFeatureTour({ reveal, camera, renderer, root, texts, toIntro, heightLabel }) {
  const u = reveal.uniforms;
  const group = new Group();
  const tx = texts.tour;

  // --- Section plane ----------------------------------------------------------
  const planeMaterial = new ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        vec2 g = abs(fract(vUv * vec2(14.0, 10.0)) - 0.5);
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
  const plane = new Mesh(new PlaneGeometry(3.0, 1.95), planeMaterial);
  plane.rotation.y = Math.PI / 2; // facing x
  plane.renderOrder = 5;
  group.add(plane);

  // --- Annotations ------------------------------------------------------------
  const pins = [
    { key: 'roof', at: toIntro(300, 1361, -733), lift: 0.22, delay: 0 },
    { key: 'pavilion', at: toIntro(-943, 817, 645), lift: 0.42, delay: 0.45 },
  ];
  const measureBottom = toIntro(1340, 0, 1111);
  const measureTop = toIntro(1340, 1675, 1111);
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
  for (const pin of pins) pin.label = makeLabel(tx.labels[pin.key], pin.key === 'roof' ? 'is-annotation' : 'is-poi');
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
    uBottom: { value: toIntro(0, 0, 0).y },
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
  const groundY = toIntro(0, 0, 0).y;
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

  const project = new Vector3();
  function place(el, point, visible, offsetY = 0, centred = false) {
    project.copy(point).project(camera);
    const behind = project.z > 1;
    const x = (project.x * 0.5 + 0.5) * root.clientWidth;
    const y = (-project.y * 0.5 + 0.5) * root.clientHeight;
    el.style.transform = `translate(${x.toFixed(1)}px, ${(y + offsetY).toFixed(1)}px) translate(-50%, ${centred ? '-50%' : '-100%'})`;
    el.style.opacity = behind ? 0 : visible.toFixed(3);
  }

  let lastCue = '';
  const size = new Vector2();

  function hideAll() {
    for (const pin of pins) pin.label.style.opacity = 0;
    measureLabel.style.opacity = 0;
    chapter.classList.remove('is-on');
  }

  return {
    group,
    // The sun study wants the camera still: its shadows turn with the sun only.
    holdsCamera(tour) {
      return tour > START.sun - 0.3 && tour < START.sun + SUN_LENGTH;
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
     */
    update(tour, time, exit) {
      const active = tour > 0 && tour < TOUR_LENGTH && exit <= 0;
      group.visible = tour > 0 && exit < 1;
      u.uTourTime.value = time;
      dotUniforms.uTime.value = time;
      flakeUniforms.uTime.value = time;

      // 1. Section: in from the right, through, and back out.
      const sectionOn = window01(tour, 0, 3.0, 0.35);
      const sweep = smooth(tour / 1.6) - smooth((tour - 1.9) / 1.0);
      const cut = 1.75 - sweep * 1.95;
      u.uClip.value.set(-1, 0, 0, cut);
      u.uClipActive.value = sectionOn;
      plane.position.set(cut, 0.3, 0);
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

      // 4. Sun: midsummer day at Wołpa, from just before sunrise to just
      // after sunset, then night falls.
      const sunTime = (tour - START.sun) / SUN_LENGTH;
      let sunKey = '';
      let sunSub = '';
      const sunOn = sunTime > 0 && sunTime < 1 ? smooth(sunTime / 0.08) * (1 - smooth((sunTime - 0.9) / 0.1)) : 0;
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
        disc.position.copy(direction).multiplyScalar(SUN_RADIUS).add(sunCentre);
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
      for (const cardinal of cardinals) place(cardinal.label, cardinal.at, sunOn, 0, true);

      // 5. Seasons: a little over a second each; snow settles in winter.
      const seasonTime = tour - START.seasons;
      let seasonKey = '';
      const grade = [1, 1, 1];
      let snow = 0;
      if (seasonTime > 0 && seasonTime < 5.0) {
        const index = Math.min(3, Math.floor(seasonTime / 1.15));
        seasonKey = SEASON_KEYS[index];
        const season = SEASONS[seasonKey];
        const local = seasonTime - index * 1.15;
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
        const inSeason = smooth(local / 0.25) * (1 - smooth((local - 0.9) / 0.25));
        flakeUniforms.uAlpha.value = season.alpha * (index === 3 ? smooth(local / 0.25) * (1 - smooth((seasonTime - 4.6) / 0.4)) : inSeason);
        if (index === 3) snow = smooth(local / 0.8) * (1 - smooth((seasonTime - 4.6) / 0.4));
        // Back to the textures' own colours at the end.
        const out = smooth((seasonTime - 4.6) / 0.4);
        for (let k = 0; k < 3; k++) grade[k] += (1 - grade[k]) * out;
      } else {
        flakeUniforms.uAlpha.value = 0;
      }
      flakes.visible = flakeUniforms.uAlpha.value > 0.001;
      u.uGrade.value.set(grade[0], grade[1], grade[2]);
      u.uSnow.value = snow;

      // The chapter's title.
      const current = active ? CHAPTERS.find((c) => tour >= c.from && tour < c.to) : null;
      if (!current) {
        hideAll();
        if (!active) {
          for (const pin of pins) pin.label.style.opacity = 0;
          measureLabel.style.opacity = 0;
          for (const cardinal of cardinals) cardinal.label.style.opacity = 0;
        }
        lastCue = '';
        return '';
      }
      const number = CHAPTERS.indexOf(current) + 1;
      let sub = '';
      let step = '';
      if (current.key === 'shading') { sub = tx.shading[shadingKey]; step = shadingKey; }
      else if (current.key === 'sun') { sub = sunSub; step = sunKey; }
      else if (current.key === 'seasons' && seasonKey) { sub = tx.seasons[seasonKey]; step = seasonKey; }
      chapterIndex.textContent = `${number} / ${CHAPTERS.length}`;
      chapterTitle.textContent = tx.chapters[current.key];
      chapterSub.textContent = sub;
      chapter.classList.toggle('has-sub', Boolean(sub));
      chapter.classList.toggle('is-on', tour < current.to - 0.2);
      const cue = `${current.key}:${step}`;
      if (cue !== lastCue) {
        const kind = lastCue.split(':')[0] === current.key ? 'step' : 'chapter';
        lastCue = cue;
        return kind;
      }
      return '';
    },
  };
}

// The intro page (intro.html): a chaotic cloud of points that, like atoms,
// slowly settles into the Wolpa Synagogue. The very last point takes its
// time, and its landing sends a wave of light through the building; then
// the real model takes the points' place - vertices, edges, faces
// (mesh-reveal.js) - and a button leads into the viewer.
//
// The points come from viewer/intro/synagogue-points.bin, sampled from the
// textured model by scripts/build-intro-points.mjs. Everything moves in the
// vertex shader: per point a start in the cloud, a delay (lower parts of the
// building first) and a seed for its own drift and path.
//
// Page parameters: ?next=<same-origin URL> is where the button leads
// (default: the viewer with the synagogue), ?lang=pl|en|de, ?at=<seconds>
// holds the intro at that moment, ?sound=1 sound on by default (it starts
// with the first click or key press; the visitor's own choice wins),
// ?embedded=1 inside the viewer page (viewer/intro-overlay.js): the buttons
// tell the page instead of leaving it.
//
// Everything follows one clock, the intro's time T (timeline() below):
// "Assemble again" runs it backwards, ?at= stops it.

const POINTS_URL = 'assets/intro/synagogue-points.bin';
// The model the points become (also the one the viewer opens next, so it is
// in the browser's cache by then), and the KTX2 transcoder its textures need.
const MODEL_URL = 'examples/WolpaSynagogue-progressive.glb';
const TRANSCODER_PATH = 'assets/basis/';
// The directory's index page (index.html): `serve` and other static servers
// redirect index.html to ./ and lose the query on the way.
const DEFAULT_NEXT = './?model=./examples/WolpaSynagogue-progressive.glb';
// Seconds: the cloud fades in, then gathers into the building.
const FADE_IN = 1.4;
const ASSEMBLY = 9;
const ASSEMBLY_START = FADE_IN * 0.6;
// The last point: sets off late, takes its time, lands on the roof.
const LAST_START = ASSEMBLY_START + ASSEMBLY * 0.7;
const LAST_FLIGHT = 5.2;
const LANDING = LAST_START + LAST_FLIGHT;
const EXIT = 1.3;
// Assemble again: everything runs back into the cloud first.
const REWIND = 3.6;
// The feature tour (feature-tour.js): seconds into the model's act.
const TOUR_START = 11.0;

const TEXTS = {
  pl: {
    tagline: 'Dziedzictwo w trzech wymiarach — i w czasie',
    caption: 'Synagoga w Wołpie · rekonstrukcja cyfrowa',
    enter: 'Wejdź do viewera',
    skip: 'Pomiń intro',
    replay: 'Złóż ponownie',
    points: (n, total) => `${n} / ${total} punktów na miejscu`,
    mesh: (v, f) => `${v} wierzchołków · ${f} ścianek`,
    loading: 'Wczytywanie punktów…',
    error: 'Nie udało się wczytać intro.',
    hint: 'Przeciągnij, aby obrócić',
    tour: {
      chapters: {
        section: 'Przekroje',
        annotations: 'Adnotacje i punkty POI',
        shading: 'Cieniowanie',
        sun: 'Analiza nasłonecznienia',
        seasons: 'Pory roku i pogoda',
      },
      shading: { textures: 'tekstury', toon: 'toon', raking: 'światło boczne' },
      sun: { night: 'noc' },
      sunDate: 'Wołpa, 21 czerwca',
      compass: { N: 'N', E: 'E', S: 'S', W: 'W' },
      seasons: { spring: 'wiosna', summer: 'lato', autumn: 'jesień', winter: 'zima' },
      labels: { roof: 'Dach', pavilion: 'Narożny pawilon' },
      height: 'wysokość',
    },
    soundOn: 'Wyłącz dźwięk',
    soundOff: 'Włącz dźwięk',
  },
  en: {
    tagline: 'Heritage in three dimensions — and in time',
    caption: 'Wołpa Synagogue · digital reconstruction',
    enter: 'Enter the viewer',
    skip: 'Skip intro',
    replay: 'Assemble again',
    points: (n, total) => `${n} / ${total} points in place`,
    mesh: (v, f) => `${v} vertices · ${f} faces`,
    loading: 'Loading points…',
    error: 'The intro could not be loaded.',
    hint: 'Drag to rotate',
    tour: {
      chapters: {
        section: 'Sections',
        annotations: 'Annotations and POIs',
        shading: 'Shading',
        sun: 'Sun study',
        seasons: 'Seasons and weather',
      },
      shading: { textures: 'textures', toon: 'toon', raking: 'raking light' },
      sun: { night: 'night' },
      sunDate: 'Wołpa, 21 June',
      compass: { N: 'N', E: 'E', S: 'S', W: 'W' },
      seasons: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
      labels: { roof: 'Roof', pavilion: 'Corner pavilion' },
      height: 'height',
    },
    soundOn: 'Sound off',
    soundOff: 'Sound on',
  },
  de: {
    tagline: 'Kulturerbe in drei Dimensionen – und in der Zeit',
    caption: 'Synagoge von Wołpa · digitale Rekonstruktion',
    enter: 'Zum Viewer',
    skip: 'Intro überspringen',
    replay: 'Neu zusammensetzen',
    points: (n, total) => `${n} / ${total} Punkte an ihrem Platz`,
    mesh: (v, f) => `${v} Eckpunkte · ${f} Flächen`,
    loading: 'Punkte werden geladen…',
    error: 'Das Intro konnte nicht geladen werden.',
    hint: 'Ziehen zum Drehen',
    tour: {
      chapters: {
        section: 'Schnitte',
        annotations: 'Annotationen und POIs',
        shading: 'Schattierung',
        sun: 'Sonnenstudie',
        seasons: 'Jahreszeiten und Wetter',
      },
      shading: { textures: 'Texturen', toon: 'Toon', raking: 'Streiflicht' },
      sun: { night: 'Nacht' },
      sunDate: 'Wołpa, 21. Juni',
      compass: { N: 'N', E: 'O', S: 'S', W: 'W' },
      seasons: { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' },
      labels: { roof: 'Dach', pavilion: 'Eckpavillon' },
      height: 'Höhe',
    },
    soundOn: 'Ton aus',
    soundOff: 'Ton an',
  },
};

// From the query or the hash: the viewer page (intro-overlay.js) passes its
// in the hash, which survives a server's index.html -> ./ style redirect.
const params = new URLSearchParams(window.location.search);
for (const [key, value] of new URLSearchParams(window.location.hash.slice(1))) {
  if (!params.has(key)) params.set(key, value);
}
const lang = pickLanguage(params.get('lang'));
const t = TEXTS[lang];
const nextUrl = safeNextUrl(params.get('next'));
const embedded = params.get('embedded') === '1' && window.parent !== window;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const numberFormat = new Intl.NumberFormat(lang);

function pickLanguage(requested) {
  const candidates = [requested, ...(navigator.languages || [navigator.language])];
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
  caption: document.getElementById('intro-caption'),
  counter: document.getElementById('intro-counter'),
  enter: document.getElementById('intro-enter'),
  skip: document.getElementById('intro-skip'),
  replay: document.getElementById('intro-replay'),
  hint: document.getElementById('intro-hint'),
  status: document.getElementById('intro-status'),
  sound: document.getElementById('intro-sound'),
};

document.documentElement.lang = lang;
ui.tagline.textContent = t.tagline;
ui.caption.textContent = t.caption;
ui.enter.textContent = t.enter;
ui.skip.textContent = t.skip;
ui.replay.textContent = t.replay;
ui.replay.title = t.replay;
ui.hint.textContent = t.hint;
ui.status.textContent = t.loading;
ui.enter.href = nextUrl;
ui.skip.href = nextUrl;

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
const holdAt = Number.parseFloat(params.get('at'));
const pageStart = performance.now();
const now = () => (performance.now() - pageStart) / 1000;
let controls;
let cloud;
let dust;
let total = 0;
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
  controls.maxDistance = 11;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.62;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 0.12, 0);
  controls.addEventListener('start', () => {
    userTouched = true;
    ui.hint.classList.add('is-gone');
  });
  resize();
  window.addEventListener('resize', resize);
  ui.canvas.addEventListener('pointermove', (event) => {
    const rect = ui.canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    hoverTarget = event.pointerType === 'mouse' ? 1 : 0;
  });
  ui.canvas.addEventListener('pointerleave', () => { hoverTarget = 0; });
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

  // Centred on the ground's middle, about 3 units across.
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const scale = 2.9 / extent;
  const center = [(min[0] + max[0]) / 2, min[1] + (max[1] - min[1]) * 0.42, (min[2] + max[2]) / 2];
  const heightRange = max[1] - min[1];

  const target = new Float32Array(total * 3);
  const start = new Float32Array(total * 3);
  const seed = new Float32Array(total * 4);
  const delay = new Float32Array(total);
  const color = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);

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

  for (let i = 0; i < total; i++) {
    let height = 0;
    for (let k = 0; k < 3; k++) {
      const value = min[k] + (quantized[i * 3 + k] / 65535) * (max[k] - min[k]);
      target[i * 3 + k] = (value - center[k]) * scale;
      if (k === 1) height = (value - min[1]) / heightRange;
      color[i * 3 + k] = srgb[i * 3 + k] / 255;
      normal[i * 3 + k] = normals[i * 3 + k] / 127;
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
  for (let i = 1; i < total; i++) if (target[i * 3 + 1] > target[top * 3 + 1]) top = i;
  const last = total - 1;
  for (const [array, size] of [[target, 3], [start, 3], [seed, 4], [delay, 1], [color, 3], [normal, 3]]) {
    for (let k = 0; k < size; k++) {
      const tmp = array[top * size + k];
      array[top * size + k] = array[last * size + k];
      array[last * size + k] = tmp;
    }
  }
  lastPoint = createLastPoint(
    new Vector3(target[last * 3], target[last * 3 + 1], target[last * 3 + 2]),
    new Vector3(start[last * 3], start[last * 3 + 1], start[last * 3 + 2]),
  );
  scene.add(lastPoint.group);
  cloudUniforms.uFlashPos.value.copy(lastPoint.target);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < total; i++) {
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
  geometry.setDrawRange(0, total - 1);

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
  started = now();
  if (reducedMotion) {
    started -= FADE_IN + ASSEMBLY;
  }
  renderer.setAnimationLoop(frame);

  // The model, while the points gather. Without it the intro ends with the
  // points.
  createMeshReveal({ url: MODEL_URL, renderer, center, scale, transcoderPath: TRANSCODER_PATH })
    .then((reveal) => {
      meshReveal = reveal;
      // Late (after the landing): its act starts now. Held (?at=) or shown
      // whole: as if it had been there from the start.
      meshReadyAt = Number.isFinite(holdAt) || reducedMotion ? 0 : timeline(now());
      scene.add(reveal.group);
      // The model's height, from its ground (y = 0, in centimetres).
      const height = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(max[1] / 100);
      tour = createFeatureTour({
        reveal,
        camera,
        renderer,
        root: ui.root,
        texts: t,
        toIntro: (x, y, z) => new Vector3((x - center[0]) * scale, (y - center[1]) * scale, (z - center[2]) * scale),
        heightLabel: `${t.tour.height} ${height} m`,
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
  // Out at the edge of the cloud, so its way in is long.
  const from = start.clone();
  from.y = Math.min(Math.max(from.y, 0.2), 0.8);
  if (Math.hypot(from.x, from.z) < 4.2) {
    const angle = Math.atan2(from.z, from.x);
    from.x = Math.cos(angle) * 4.6;
    from.z = Math.sin(angle) * 4.6;
  }
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

  // The way in: a wide spiral, slowing down as it comes closer.
  const fromAngle = Math.atan2(from.z, from.x);
  const fromRadius = Math.hypot(from.x, from.z);
  const toAngle = Math.atan2(target.z, target.x);
  const toRadius = Math.hypot(target.x, target.z);
  // One and a quarter turns, in the direction that is the shorter way.
  let turn = toAngle - fromAngle;
  turn = turn - Math.round(turn / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2 * (turn >= 0 ? 1 : -1);
  const at = (u, out) => {
    const k = 1 - Math.pow(1 - u, 2.6);
    const angle = fromAngle + turn * k;
    const radius = fromRadius + (toRadius - fromRadius) * k;
    out.set(
      Math.cos(angle) * radius,
      from.y + (target.y - from.y) * k + Math.sin(k * Math.PI) * 0.45,
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
      at(flight, position);
      if (flight <= 0) {
        // Waiting at the edge of the cloud, drifting a little.
        position.x += Math.sin(time * 0.37) * 0.12;
        position.y += Math.sin(time * 0.29 + 1.3) * 0.1;
        position.z += Math.cos(time * 0.31) * 0.12;
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

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ray = { origin: new Vector3(), dir: new Vector3(), ndc: new Vector3() };
let lastCounter = '';
let rewindStart = -1;
let rewindFrom = 0;
let lastT = 0;
let lastTime = 0;
let lastArrived = 0;
let cameraTurn = 1;

// The intro's time T at the clock's time: running, held (?at=), shown whole
// (reduced motion) or running back ("Assemble again").
function timeline(time) {
  if (Number.isFinite(holdAt)) return holdAt;
  if (reducedMotion) return LANDING + TOUR_START + TOUR_LENGTH;
  if (rewindStart >= 0) {
    const r = Math.min(1, (time - rewindStart) / REWIND);
    return rewindFrom + (ASSEMBLY_START - rewindFrom) * easeInOut(r);
  }
  return time - started;
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
  const progress = easeInOut(Math.min(1, Math.max(0, (T - ASSEMBLY_START) / ASSEMBLY)));
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
    forward: T > lastT && !Number.isFinite(holdAt) && rewindStart < 0,
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
  if (tourCue && T > lastT && !Number.isFinite(holdAt) && rewindStart < 0) sound.cue(tourCue);
  lastT = T;
  lastTime = time;
  lastArrived = arrivedFraction;

  ui.root.classList.toggle('is-assembling', progress > 0.02);
  ui.root.classList.toggle('is-assembled', T >= LANDING - 0.3);

  // While gathering the camera circles faster, slowing as the building
  // forms; it holds still for the sun study (the shadows turn with the sun
  // only), easing out of and back into its turn.
  if (exitStarted < 0 && !userTouched) {
    const holding = tour?.holdsCamera(stage - TOUR_START) ?? false;
    cameraTurn += ((holding ? 0 : 1) - cameraTurn) * Math.min(1, dt * 3);
    controls.autoRotateSpeed = reducedMotion ? 0 : (0.4 + (1 - progress) * 1.4) * cameraTurn;
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

ui.replay.addEventListener('click', () => {
  if (!cloud || reducedMotion || exitStarted >= 0 || rewindStart >= 0 || Number.isFinite(holdAt)) return;
  rewindFrom = timeline(now());
  rewindStart = now();
  sound.rewind();
  userTouched = false;
});

// Prefetch the viewer while the intro plays (inside it, it is there already).
if (!embedded) {
  const prefetch = document.createElement('link');
  prefetch.rel = 'prefetch';
  prefetch.href = nextUrl;
  document.head.appendChild(prefetch);
}
// Inside the viewer, Escape skips the intro.
if (embedded) {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') ui.skip.click();
  });
  document.documentElement.classList.add('is-embedded');
}
//# sourceMappingURL=intro-ZPvG3rHU.js.map
