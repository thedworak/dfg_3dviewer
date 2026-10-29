import THREE from "./init.js";
import { core } from "./core.js";
import { dyno } from "@sparkjsdev/spark";

// Lighting of Gaussian splats (splats.js) by the scene's lights, the way the
// meshes next to them are lit: Lights > Gaussian splats (lights-panel.js),
// state in core.splatLighting ({ enabled, strength, occlusion }).
//
// A splat has no normal, but most splats of a capture lie flat on the
// surface they were fitted to: the normal is the shortest axis of the
// Gaussian, turned towards the camera. How flat the splat is (shortest
// against middle axis) says how far to trust it; round splats (foliage,
// merged LoD splats, noise) keep their colour.
//
// The colours of a capture already hold the light it was taken in, so the
// lights do not replace them, they scale them: the irradiance the splat
// gets from the scene's lights (three.js's terms: ambient, hemisphere,
// directional, point and spot, with their distance and cone falloff; the
// environment as ambient) divided by a reference, the irradiance a surface
// gets on average over all its turns at the middle of the model. With
// neutral lights the capture looks as it was; turning or dimming a light
// shades its relief. `strength` blends between the two. The renderer's
// exposure (Look > Exposure, a manifest's rendering.exposure) brightens
// them too, as it does the meshes; Spark draws splats without it.
//
// Uploads come with a voxel volume of their surface (<model>.light, built
// by the worker, worker/splat_volume.py), loaded next to the model when
// there is one. From it:
// - the normal: the main axis of the surface's structure tensor, found by
//   a few power iterations from the splat's own axis; smoother than the
//   splats', and trusted as far as the surface is flat there;
// - occlusion: the openness of the air beside the surface on the side the
//   camera sees, darkening what the ambient and sky lights reach;
// - soft shadows: from the lights that cast shadows (their Shadows switch),
//   by marching through the distance to the surface towards them.
// The volume is in the coordinates of the file; when its bounds match the
// splats' only with Y and Z turned (a decoder that converts the axes), it
// is turned likewise.
//
// It is a world modifier of the splat mesh, run on the GPU in Spark's
// generator for every splat; since the normal turns to the camera, it runs
// again when the camera moves, as the view-dependent colours already do.
// The lights are read from the scene once a frame, and the splats are
// regenerated only when they change.

const MAX_DIRECTIONAL = 4;
const MAX_LOCAL = 4;
// Diffuse wrapped round the terminator, so noisy normals do not go black.
const WRAP = 0.35;
// The share of a light a surface gets on average over all its turns: the
// mean of the wrapped diffuse over the sphere (the reference, and what a
// round splat gets), so the lights keep the capture as bright as it was.
const REFERENCE_SHARE = (1 + WRAP) / 4;
// Brightest a splat may get, against its captured colour.
const MAX_GAIN = 2.5;
// Below this ratio of shortest to middle axis a splat counts as flat.
const FLAT_RATIO = 0.35;
const LUMA = new THREE.Vector3(0.2126, 0.7152, 0.0722);

// The volume file (worker/splat_volume.py).
const VOLUME_MAGIC = "DFGV";
const VOLUME_HEADER_BYTES = 56;
const DISTANCE_RANGE = 16;
// Voxels off the surface where the openness is read, and where the shadow
// rays start - further, by up to EXIT_STEPS of 0.75, while still in the
// surface's voxels.
const SURFACE_OFFSET = 1.5;
const EXIT_STEPS = 8;
// Penumbra: higher is harder.
const SHADOW_SOFTNESS = 10;
const SHADOW_STEPS = 40;

const vec3 = () => dyno.dynoVec3(new THREE.Vector3());
const vec4 = () => dyno.dynoVec4(new THREE.Vector4());

// Shared by every splat mesh; filled from the scene by updateUniforms().
const uniforms = {
  strength: dyno.dynoFloat(0),
  // The renderer's tone mapping exposure, which Spark's splats do not get.
  exposure: dyno.dynoFloat(1),
  occlusion: dyno.dynoFloat(0),
  reference: dyno.dynoFloat(1),
  ambient: vec3(),
  sky: vec3(),
  ground: vec3(),
  // 1 for each light that casts shadows.
  dirShadow: vec4(),
  localShadow: vec4(),
  directional: Array.from({ length: MAX_DIRECTIONAL }, () => ({ direction: vec3(), color: vec3() })),
  // params: distance cutoff, decay, cone cosine, penumbra cosine (spot only;
  // a point light has cone cosine -2, everywhere inside).
  local: Array.from({ length: MAX_LOCAL }, () => ({ position: vec3(), color: vec3(), direction: vec3(), params: vec4() })),
};

function volumeTexture(data, x, y, z) {
  const texture = new THREE.Data3DTexture(data, x, y, z);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

// Bound until a mesh has its own volume.
const NO_VOLUME = volumeTexture(new Uint8Array(4), 1, 1, 1);

const defineLighting = `
  float splatWrapDiffuse(float nl) {
    return clamp((nl + ${WRAP.toFixed(3)}) / ${(1 + WRAP).toFixed(3)}, 0.0, 1.0);
  }
  float splatDistanceFalloff(float d, float cutoff, float decay) {
    float falloff = 1.0 / max(pow(d, decay), 0.01);
    if (cutoff > 0.0) {
      float x = clamp(1.0 - pow(d / cutoff, 4.0), 0.0, 1.0);
      falloff *= x * x;
    }
    return falloff;
  }
  // Light reaching start (voxels, off the surface) from along dir, up to maxT
  // voxels: 0 behind the surface, soft towards its edges. The first voxel is
  // skipped, next to the splat's own surface.
  float splatVolumeShadow(sampler3D volume, vec3 dims, vec3 start, vec3 dir, float maxT) {
    float shade = 1.0;
    float t = 0.5;
    for (int i = 0; i < ${SHADOW_STEPS}; i++) {
      if (t > maxT) break;
      vec3 q = start + dir * t;
      if (any(lessThan(q, vec3(0.0))) || any(greaterThan(q, dims))) break;
      float d = texture(volume, q / dims).w * ${DISTANCE_RANGE.toFixed(1)};
      if (t > 1.0) {
        if (d < 0.35) return 0.0;
        shade = min(shade, ${SHADOW_SOFTNESS.toFixed(1)} * d / t);
      }
      t += max(d * 0.8, 0.5);
    }
    return clamp(shade, 0.0, 1.0);
  }
`;

function lightingDyno(gsplat, eye, volume) {
  const inTypes = {
    gsplat: dyno.Gsplat, eye: "vec3", strength: "float", exposure: "float", occlusion: "float", reference: "float",
    ambient: "vec3", sky: "vec3", ground: "vec3", dirShadow: "vec4", localShadow: "vec4",
    volumeA: "sampler3D", volumeB: "sampler3D", present: "float", dims: "vec3", worldToVoxel: "mat4", voxelToWorld: "mat3",
  };
  const inputs = {
    gsplat, eye, strength: uniforms.strength, exposure: uniforms.exposure, occlusion: uniforms.occlusion, reference: uniforms.reference,
    ambient: uniforms.ambient, sky: uniforms.sky, ground: uniforms.ground, dirShadow: uniforms.dirShadow, localShadow: uniforms.localShadow,
    volumeA: volume.a, volumeB: volume.b, present: volume.present, dims: volume.dims, worldToVoxel: volume.worldToVoxel, voxelToWorld: volume.voxelToWorld,
  };
  uniforms.directional.forEach((light, i) => {
    inTypes[`dirDirection${i}`] = "vec3";
    inTypes[`dirColor${i}`] = "vec3";
    inputs[`dirDirection${i}`] = light.direction;
    inputs[`dirColor${i}`] = light.color;
  });
  uniforms.local.forEach((light, i) => {
    Object.assign(inTypes, { [`localPosition${i}`]: "vec3", [`localColor${i}`]: "vec3", [`localDirection${i}`]: "vec3", [`localParams${i}`]: "vec4" });
    Object.assign(inputs, { [`localPosition${i}`]: light.position, [`localColor${i}`]: light.color, [`localDirection${i}`]: light.direction, [`localParams${i}`]: light.params });
  });
  return dyno.dyno({
    inTypes,
    outTypes: { gsplat: dyno.Gsplat },
    inputs,
    globals: () => [dyno.defineGsplat, dyno.defineGsplatNormal, defineLighting],
    statements: ({ inputs: i, outputs }) => {
      const g = outputs.gsplat;
      const lines = [
        `${g} = ${i.gsplat};`,
        `if (isGsplatActive(${g}.flags) && ${i.strength} > 0.0) {`,
        `  vec3 s = ${g}.scales;`,
        `  float sMin = min(s.x, min(s.y, s.z));`,
        `  float sMax = max(s.x, max(s.y, s.z));`,
        `  float sMid = s.x + s.y + s.z - sMin - sMax;`,
        `  float flatness = 1.0 - smoothstep(${(FLAT_RATIO * 0.5).toFixed(3)}, ${FLAT_RATIO.toFixed(3)}, sMin / max(sMid, 1e-9));`,
        `  vec3 n = gsplatNormal(s, ${g}.quaternion);`,
        `  vec3 p = ${g}.center;`,
        `  if (dot(n, ${i.eye} - p) < 0.0) n = -n;`,
        // The volume: voxel coordinates, normal, openness.
        `  float ao = 1.0;`,
        `  bool onVolume = false;`,
        `  vec3 vp = vec3(0.0);`,
        `  vec3 side = vec3(0.0);`,
        `  if (${i.present} > 0.5) {`,
        `    vp = (${i.worldToVoxel} * vec4(p, 1.0)).xyz;`,
        `    vec3 uvw = vp / ${i.dims};`,
        `    if (all(greaterThanEqual(uvw, vec3(0.0))) && all(lessThanEqual(uvw, vec3(1.0)))) {`,
        `      onVolume = true;`,
        `      mat3 toVoxel = mat3(${i.worldToVoxel});`,
        `      side = normalize(toVoxel * n);`,
        `      vec4 ta = texture(${i.volumeA}, uvw);`,
        `      vec3 tb = texture(${i.volumeB}, uvw).xyz - 0.5;`,
        `      float trace = ta.x + ta.y + ta.z;`,
        `      if (trace > 0.3) {`,
        `        mat3 tensor = mat3(ta.x, tb.x, tb.y, tb.x, ta.y, tb.z, tb.y, tb.z, ta.z) / trace;`,
        `        vec3 axis = side;`,
        `        for (int it = 0; it < 4; it++) axis = normalize(tensor * axis + 1e-6);`,
        `        float planar = clamp((dot(axis, tensor * axis) * 3.0 - 1.0) * 0.75, 0.0, 1.0);`,
        `        vec3 world = normalize(${i.voxelToWorld} * axis);`,
        `        if (dot(world, ${i.eye} - p) < 0.0) { world = -world; axis = -axis; }`,
        `        n = normalize(mix(n, world, planar));`,
        `        side = normalize(mix(side, axis, planar));`,
        `        flatness = max(flatness, planar);`,
        `      }`,
        `    }`,
        `  }`,
        // Out of the surface's voxels on the camera's side: where the
        // openness is read and the shadow rays start.
        `  vec3 start = vp + side * ${SURFACE_OFFSET.toFixed(2)};`,
        `  if (onVolume) {`,
        `    for (int e = 0; e < ${EXIT_STEPS}; e++) {`,
        `      if (texture(${i.volumeB}, start / ${i.dims}).w * ${DISTANCE_RANGE.toFixed(1)} > 0.75) break;`,
        `      start += side * 0.75;`,
        `    }`,
        `    ao = mix(1.0, texture(${i.volumeA}, start / ${i.dims}).w, ${i.occlusion});`,
        `  }`,
        `  float reach = length(${i.dims});`,
        // A round splat gets the reference share of every light.
        `  vec3 irr = ao * (${i.ambient} + mix(0.5 * (${i.sky} + ${i.ground}), mix(${i.ground}, ${i.sky}, 0.5 * n.y + 0.5), flatness));`,
      ];
      uniforms.directional.forEach((_light, k) => {
        const direction = i[`dirDirection${k}`];
        const color = i[`dirColor${k}`];
        lines.push(
          `  if (${color}.r + ${color}.g + ${color}.b > 0.0) {`,
          `    float shadow = 1.0;`,
          `    if (onVolume && ${i.dirShadow}[${k}] > 0.5) shadow = splatVolumeShadow(${i.volumeB}, ${i.dims}, start, normalize(mat3(${i.worldToVoxel}) * ${direction}), reach);`,
          `    irr += ${color} * shadow * mix(${REFERENCE_SHARE.toFixed(3)}, splatWrapDiffuse(dot(n, ${direction})), flatness);`,
          `  }`,
        );
      });
      uniforms.local.forEach((_light, k) => {
        const color = i[`localColor${k}`];
        const params = i[`localParams${k}`];
        const position = i[`localPosition${k}`];
        lines.push(
          `  if (${color}.r + ${color}.g + ${color}.b > 0.0) {`,
          `    vec3 l = ${position} - p;`,
          `    float d = max(length(l), 1e-6);`,
          `    l /= d;`,
          `    float cone = smoothstep(${params}.z, ${params}.w, dot(-l, ${i[`localDirection${k}`]}));`,
          `    float shadow = 1.0;`,
          `    if (onVolume && cone > 0.0 && ${i.localShadow}[${k}] > 0.5) {`,
          `      vec3 toLight = (${i.worldToVoxel} * vec4(${position}, 1.0)).xyz - start;`,
          `      shadow = splatVolumeShadow(${i.volumeB}, ${i.dims}, start, normalize(toLight), length(toLight));`,
          `    }`,
          `    irr += ${color} * shadow * splatDistanceFalloff(d, ${params}.x, ${params}.y) * cone * mix(${REFERENCE_SHARE.toFixed(3)}, splatWrapDiffuse(dot(n, l)), flatness);`,
          `  }`,
        );
      });
      lines.push(
        `  vec3 gain = min(irr / max(${i.reference}, 1e-6), vec3(${MAX_GAIN.toFixed(2)}));`,
        // The colours are sRGB; the gain is in linear light.
        `  gain = pow(mix(vec3(1.0), gain, ${i.strength}) * ${i.exposure}, vec3(1.0 / 2.2));`,
        `  ${g}.rgba.rgb *= gain;`,
        `}`,
      );
      return lines;
    },
  });
}

function makeModifier(mesh) {
  const { volume } = mesh.userData.splatLighting;
  return dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
    if (!gsplat) throw new Error("No gsplat input");
    return { gsplat: lightingDyno(gsplat, mesh.context.viewToWorld.translate, volume).outputs.gsplat };
  });
}

// Reading the scene's lights.

const worldPosition = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const color = new THREE.Color();
const center = new THREE.Vector3();
let frameStamp = -1;
let lightsKey = "";
let lightsVersion = 0;

function lightColor(light) {
  color.copy(light.color).multiplyScalar(light.intensity);
  return new THREE.Vector3(color.r, color.g, color.b);
}

function collectLights() {
  const lights = { ambient: new THREE.Vector3(), sky: new THREE.Vector3(), ground: new THREE.Vector3(), directional: [], local: [] };
  core.scene?.traverseVisible((object) => {
    if (!object.isLight || !(object.intensity > 0)) return;
    if (object.isAmbientLight) {
      lights.ambient.add(lightColor(object));
    } else if (object.isHemisphereLight) {
      lights.sky.add(lightColor(object));
      color.copy(object.groundColor).multiplyScalar(object.intensity);
      lights.ground.add(new THREE.Vector3(color.r, color.g, color.b));
    } else if (object.isDirectionalLight) {
      object.getWorldPosition(worldPosition);
      object.target.getWorldPosition(targetPosition);
      const direction = worldPosition.sub(targetPosition);
      if (direction.lengthSq() > 0) {
        lights.directional.push({ direction: direction.normalize().clone(), color: lightColor(object), shadow: object.castShadow ? 1 : 0 });
      }
    } else if (object.isPointLight || object.isSpotLight) {
      const light = {
        position: object.getWorldPosition(new THREE.Vector3()), color: lightColor(object), direction: new THREE.Vector3(0, -1, 0),
        params: new THREE.Vector4(object.distance, object.decay, -2, -1), shadow: object.castShadow ? 1 : 0,
      };
      if (object.isSpotLight) {
        object.target.getWorldPosition(targetPosition);
        light.direction.subVectors(targetPosition, light.position).normalize();
        light.params.z = Math.cos(object.angle);
        light.params.w = Math.cos(object.angle * (1 - object.penumbra));
      }
      lights.local.push(light);
    }
  });
  const environment = core.scene?.environment ? core.scene.environmentIntensity ?? 1 : 0;
  lights.ambient.addScalar(environment);
  // The strongest first, when there are more than fit.
  const strength = (light) => light.color.dot(LUMA);
  lights.directional.sort((a, b) => strength(b) - strength(a));
  lights.local.sort((a, b) => strength(b) - strength(a));
  return lights;
}

// What a surface gets at `at` on average over all its turns.
function reference(lights, at) {
  let total = lights.ambient.dot(LUMA) + 0.5 * (lights.sky.dot(LUMA) + lights.ground.dot(LUMA));
  lights.directional.slice(0, MAX_DIRECTIONAL).forEach((light) => {
    total += REFERENCE_SHARE * light.color.dot(LUMA);
  });
  lights.local.slice(0, MAX_LOCAL).forEach((light) => {
    const d = Math.max(light.position.distanceTo(at), 1e-6);
    let falloff = 1 / Math.max(d ** light.params.y, 0.01);
    if (light.params.x > 0) falloff *= Math.max(0, 1 - (d / light.params.x) ** 4) ** 2;
    const cos = targetPosition.subVectors(at, light.position).normalize().dot(light.direction);
    const cone = THREE.MathUtils.smoothstep(cos, light.params.z, light.params.w);
    total += REFERENCE_SHARE * light.color.dot(LUMA) * falloff * cone;
  });
  return Math.max(total, 1e-6);
}

function copy(uniform, value) {
  uniform.value.copy(value);
}

// Once a frame (any of the splat meshes asks): the lights into the
// uniforms; lightsVersion goes up when they changed.
function updateUniforms(stamp, renderer) {
  if (stamp === frameStamp) return;
  frameStamp = stamp;
  const state = core.splatLighting;
  const lights = collectLights();
  if (core.lightBounds?.center) center.copy(core.lightBounds.center);
  else center.set(0, 0, 0);
  const exposure = Number.isFinite(renderer?.toneMappingExposure) ? renderer.toneMappingExposure : 1;
  const key = JSON.stringify([state.strength, state.occlusion, exposure, center, lights]);
  if (key === lightsKey) return;
  lightsKey = key;
  lightsVersion += 1;
  uniforms.strength.value = THREE.MathUtils.clamp(Number(state.strength) || 0, 0, 1);
  uniforms.occlusion.value = THREE.MathUtils.clamp(Number(state.occlusion) || 0, 0, 1);
  uniforms.exposure.value = Math.max(exposure, 0);
  uniforms.reference.value = reference(lights, center);
  copy(uniforms.ambient, lights.ambient);
  copy(uniforms.sky, lights.sky);
  copy(uniforms.ground, lights.ground);
  uniforms.directional.forEach((slot, i) => {
    const light = lights.directional[i];
    copy(slot.direction, light?.direction ?? new THREE.Vector3(0, 1, 0));
    copy(slot.color, light?.color ?? new THREE.Vector3());
    uniforms.dirShadow.value.setComponent(i, light?.shadow ?? 0);
  });
  uniforms.local.forEach((slot, i) => {
    const light = lights.local[i];
    copy(slot.position, light?.position ?? new THREE.Vector3());
    copy(slot.color, light?.color ?? new THREE.Vector3());
    copy(slot.direction, light?.direction ?? new THREE.Vector3(0, -1, 0));
    copy(slot.params, light?.params ?? new THREE.Vector4(0, 2, -2, -1));
    uniforms.localShadow.value.setComponent(i, light?.shadow ?? 0);
  });
}

// The volume.

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// The volume at url (worker/splat_volume.py), or null.
export async function loadSplatVolume(url) {
  let bytes;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    bytes = new Uint8Array(await response.arrayBuffer());
    // Served with Content-Encoding: gzip, it arrives unpacked.
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes);
  } catch {
    return null;
  }
  if (bytes.length < VOLUME_HEADER_BYTES || new TextDecoder().decode(bytes.subarray(0, 4)) !== VOLUME_MAGIC) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const [nx, ny, nz] = [8, 10, 12].map((at) => view.getUint16(at, true));
  const floats = Array.from({ length: 10 }, (_v, k) => view.getFloat32(16 + k * 4, true));
  const voxels = nx * ny * nz;
  if (view.getUint32(4, true) !== 1 || bytes.length < VOLUME_HEADER_BYTES + voxels * 8) return null;
  const at = bytes.byteOffset + VOLUME_HEADER_BYTES;
  return {
    dims: new THREE.Vector3(nx, ny, nz),
    origin: new THREE.Vector3(floats[0], floats[1], floats[2]),
    voxel: floats[3],
    bounds: new THREE.Box3(new THREE.Vector3(floats[4], floats[5], floats[6]), new THREE.Vector3(floats[7], floats[8], floats[9])),
    a: volumeTexture(new Uint8Array(bytes.buffer, at, voxels * 4), nx, ny, nz),
    b: volumeTexture(new Uint8Array(bytes.buffer, at + voxels * 4, voxels * 4), nx, ny, nz),
  };
}

const TURN_YZ = new THREE.Matrix4().makeScale(1, -1, -1);

// File -> object coordinates of the volume: as they are, or with Y and Z
// turned, whichever puts its bounds on the splats'.
function fileToObject(volume, splatBounds) {
  if (!splatBounds || splatBounds.isEmpty()) return new THREE.Matrix4();
  const size = Math.max(splatBounds.getSize(new THREE.Vector3()).length(), 1e-9);
  const miss = (matrix) => {
    const box = volume.bounds.clone().applyMatrix4(matrix);
    return (box.min.distanceTo(splatBounds.min) + box.max.distanceTo(splatBounds.max)) / size;
  };
  const turned = miss(TURN_YZ) < miss(new THREE.Matrix4());
  if (Math.min(miss(TURN_YZ), miss(new THREE.Matrix4())) > 0.25) {
    console.warn("[splat-lighting] the surface volume does not match the splats' bounds");
  }
  return turned ? TURN_YZ.clone() : new THREE.Matrix4();
}

const worldToVoxel = new THREE.Matrix4();

// The mesh's volume uniforms for its place in the world; true when they
// changed.
function placeVolume(mesh) {
  const volume = mesh.userData.splatLighting.volume;
  if (!volume.data) return false;
  const { data } = volume;
  worldToVoxel.copy(mesh.matrixWorld).multiply(volume.fileToObject).invert()
    .premultiply(new THREE.Matrix4().makeTranslation(-data.origin.x, -data.origin.y, -data.origin.z))
    .premultiply(new THREE.Matrix4().makeScale(1 / data.voxel, 1 / data.voxel, 1 / data.voxel));
  if (worldToVoxel.equals(volume.worldToVoxel.value)) return false;
  volume.worldToVoxel.value.copy(worldToVoxel);
  volume.voxelToWorld.value.setFromMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).multiply(volume.fileToObject));
  return true;
}

// A paged .rad changes its splats while it loads; a generator built with
// the modifier before that stays stale (draws nothing), so it is built
// again when they change.
function setModifier(mesh, on) {
  const lighting = mesh.userData.splatLighting;
  const splats = on ? [mesh.context.splats, mesh.numSplats] : null;
  if (lighting.on === on && (!on || (splats[0] === lighting.splats[0] && splats[1] === lighting.splats[1]))) return;
  lighting.on = on;
  lighting.splats = splats;
  mesh.enableViewToWorld = on;
  mesh.worldModifier = on ? (lighting.modifier ??= makeModifier(mesh)) : undefined;
  mesh.updateGenerator();
}

// Lets the scene's lights light the splat mesh (while core.splatLighting
// says so), with the surface volume at volumeUrl when there is one there.
export function attachSplatLighting(mesh, { volumeUrl } = {}) {
  const volume = {
    data: null,
    fileToObject: new THREE.Matrix4(),
    a: dyno.dynoSampler3D(NO_VOLUME),
    b: dyno.dynoSampler3D(NO_VOLUME),
    present: dyno.dynoFloat(0),
    dims: dyno.dynoVec3(new THREE.Vector3(1, 1, 1)),
    worldToVoxel: dyno.dynoMat4(new THREE.Matrix4()),
    voxelToWorld: dyno.dynoMat3(new THREE.Matrix3()),
  };
  mesh.userData.splatLighting = { on: false, splats: null, modifier: null, version: -1, volume };
  if (volumeUrl) {
    loadSplatVolume(volumeUrl).then((data) => {
      if (!data) return;
      volume.data = data;
      volume.fileToObject = fileToObject(data, mesh.geometry?.boundingBox);
      volume.a.value = data.a;
      volume.b.value = data.b;
      volume.dims.value.copy(data.dims);
      volume.present.value = 1;
      mesh.userData.gaussianSplats = { ...mesh.userData.gaussianSplats, surfaceVolume: true };
      mesh.userData.splatLighting.version = -1;
      window.Viewer?.syncLightsPanelFields?.();
      window.Viewer?.render?.();
    });
  }
  // Before Spark's own update of the frame, which regenerates the splats:
  // the viewer renders on demand, so a change seen only after it (in
  // onFrame) would wait for a next frame that may not come.
  const update = mesh.update.bind(mesh);
  mesh.update = (frame) => {
    const lighting = mesh.userData.splatLighting;
    const state = core.splatLighting;
    const on = Boolean(state.enabled) && state.strength > 0;
    setModifier(mesh, on);
    if (on) {
      // Once a render, for all the meshes: Spark's time stands still
      // between renders on demand.
      updateUniforms(frame.renderer?.info?.render?.frame ?? performance.now(), frame.renderer);
      const moved = placeVolume(mesh);
      if (lighting.version !== lightsVersion || moved) {
        lighting.version = lightsVersion;
        mesh.updateVersion();
      }
    }
    update(frame);
  };
}
