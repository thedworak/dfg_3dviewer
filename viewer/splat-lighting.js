import THREE from "./init.js";
import { core } from "./core.js";
import { dyno } from "@sparkjsdev/spark";

// Lighting of Gaussian splats (splats.js) by the scene's lights, the way the
// meshes next to them are lit: Lights > Splat lighting (lights-panel.js),
// state in core.splatLighting ({ enabled, strength }).
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
// half turned to every light would get at the middle of the model. With
// neutral lights the capture looks as it was; turning or dimming a light
// shades its relief. `strength` blends between the two. Shadows are not
// cast (no geometry to cast them).
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
// The share of a light a surface gets on average (the reference).
const REFERENCE_SHARE = 0.5;
// Brightest a splat may get, against its captured colour.
const MAX_GAIN = 2.5;
// Below this ratio of shortest to middle axis a splat counts as flat.
const FLAT_RATIO = 0.35;
const LUMA = new THREE.Vector3(0.2126, 0.7152, 0.0722);

const vec3 = () => dyno.dynoVec3(new THREE.Vector3());
const vec4 = () => dyno.dynoVec4(new THREE.Vector4());

// Shared by every splat mesh; filled from the scene by updateUniforms().
const uniforms = {
  strength: dyno.dynoFloat(0),
  reference: dyno.dynoFloat(1),
  ambient: vec3(),
  sky: vec3(),
  ground: vec3(),
  directional: Array.from({ length: MAX_DIRECTIONAL }, () => ({ direction: vec3(), color: vec3() })),
  // params: distance cutoff, decay, cone cosine, penumbra cosine (spot only;
  // a point light has cone cosine -2, everywhere inside).
  local: Array.from({ length: MAX_LOCAL }, () => ({ position: vec3(), color: vec3(), direction: vec3(), params: vec4() })),
};

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
`;

function lightingDyno(gsplat, eye) {
  const inTypes = { gsplat: dyno.Gsplat, eye: "vec3", strength: "float", reference: "float", ambient: "vec3", sky: "vec3", ground: "vec3" };
  const inputs = { gsplat, eye, strength: uniforms.strength, reference: uniforms.reference, ambient: uniforms.ambient, sky: uniforms.sky, ground: uniforms.ground };
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
        // A round splat gets the reference share of every light.
        `  vec3 irr = ${i.ambient} + mix(0.5 * (${i.sky} + ${i.ground}), mix(${i.ground}, ${i.sky}, 0.5 * n.y + 0.5), flatness);`,
      ];
      uniforms.directional.forEach((_light, k) => {
        lines.push(`  irr += ${i[`dirColor${k}`]} * mix(${REFERENCE_SHARE.toFixed(3)}, splatWrapDiffuse(dot(n, ${i[`dirDirection${k}`]})), flatness);`);
      });
      uniforms.local.forEach((_light, k) => {
        const color = i[`localColor${k}`];
        const params = i[`localParams${k}`];
        lines.push(
          `  if (${color}.r + ${color}.g + ${color}.b > 0.0) {`,
          `    vec3 l = ${i[`localPosition${k}`]} - p;`,
          `    float d = max(length(l), 1e-6);`,
          `    l /= d;`,
          `    float cone = smoothstep(${params}.z, ${params}.w, dot(-l, ${i[`localDirection${k}`]}));`,
          `    irr += ${color} * splatDistanceFalloff(d, ${params}.x, ${params}.y) * cone * mix(${REFERENCE_SHARE.toFixed(3)}, splatWrapDiffuse(dot(n, l)), flatness);`,
          `  }`,
        );
      });
      lines.push(
        `  vec3 gain = min(irr / max(${i.reference}, 1e-6), vec3(${MAX_GAIN.toFixed(2)}));`,
        // The colours are sRGB; the gain is in linear light.
        `  gain = pow(mix(vec3(1.0), gain, ${i.strength}), vec3(1.0 / 2.2));`,
        `  ${g}.rgba.rgb *= gain;`,
        `}`,
      );
      return lines;
    },
  });
}

function makeModifier(mesh) {
  return dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
    if (!gsplat) throw new Error("No gsplat input");
    return { gsplat: lightingDyno(gsplat, mesh.context.viewToWorld.translate).outputs.gsplat };
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
      if (direction.lengthSq() > 0) lights.directional.push({ direction: direction.normalize().clone(), color: lightColor(object) });
    } else if (object.isPointLight || object.isSpotLight) {
      const light = { position: object.getWorldPosition(new THREE.Vector3()), color: lightColor(object), direction: new THREE.Vector3(0, -1, 0), params: new THREE.Vector4(object.distance, object.decay, -2, -1) };
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

// What a surface half turned to every light gets at `at`.
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
function updateUniforms(stamp) {
  if (stamp === frameStamp) return;
  frameStamp = stamp;
  const state = core.splatLighting;
  const lights = collectLights();
  if (core.lightBounds?.center) center.copy(core.lightBounds.center);
  else center.set(0, 0, 0);
  const key = JSON.stringify([state.strength, center, lights]);
  if (key === lightsKey) return;
  lightsKey = key;
  lightsVersion += 1;
  uniforms.strength.value = THREE.MathUtils.clamp(Number(state.strength) || 0, 0, 1);
  uniforms.reference.value = reference(lights, center);
  copy(uniforms.ambient, lights.ambient);
  copy(uniforms.sky, lights.sky);
  copy(uniforms.ground, lights.ground);
  uniforms.directional.forEach((slot, i) => {
    const light = lights.directional[i];
    copy(slot.direction, light?.direction ?? new THREE.Vector3(0, 1, 0));
    copy(slot.color, light?.color ?? new THREE.Vector3());
  });
  uniforms.local.forEach((slot, i) => {
    const light = lights.local[i];
    copy(slot.position, light?.position ?? new THREE.Vector3());
    copy(slot.color, light?.color ?? new THREE.Vector3());
    copy(slot.direction, light?.direction ?? new THREE.Vector3(0, -1, 0));
    copy(slot.params, light?.params ?? new THREE.Vector4(0, 2, -2, -1));
  });
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
// says so).
export function attachSplatLighting(mesh) {
  mesh.userData.splatLighting = { on: false, splats: null, modifier: null, version: -1 };
  const onFrame = mesh.onFrame;
  mesh.onFrame = (frame) => {
    onFrame?.(frame);
    const lighting = mesh.userData.splatLighting;
    const state = core.splatLighting;
    const on = Boolean(state.enabled) && state.strength > 0;
    setModifier(mesh, on);
    if (!on) return;
    updateUniforms(frame.time);
    if (lighting.version !== lightsVersion) {
      lighting.version = lightsVersion;
      mesh.updateVersion();
    }
  };
}
