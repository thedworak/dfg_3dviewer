import { S as SkyMesh, u as uniform, g as normalize, h as positionWorld, i as cameraPosition, j as select, k as max, l as smoothstep, v as vec4, e as mix, M as MeshBasicNodeMaterial, F as Fn, I as If, o as dot, b as vec3, q as min, r as viewportDepthTexture, s as screenUV, t as orthographicDepthToViewZ, w as cameraNear, x as cameraFar, y as logarithmicDepthToViewZ, z as perspectiveDepthToViewZ, f as float, A as fract, B as screenCoordinate, C as vec2, D as pow, L as Loop, E as exp, G as Break, a as attribute, H as length, J as cross, K as positionGeometry, N as step, O as varying, P as abs, Q as normalWorldGeometry, T as diffuseColor, U as materialRoughness, V as materialMetalness, W as sin, X as cos, Y as texture3D, Z as mod, _ as cameraProjectionMatrix, $ as texture } from './three-webgpu-DPPtmlIw.js';
import { C as Color, a_ as DoubleSide, u as BackSide } from './three-VOkZ5KBh.js';

// The weather (editor/weather.js) for three's WebGPU renderer: the same
// rain, splashes, snow, sky and surfaces as its GLSL, in TSL. Loaded with the
// renderer (renderer-backend.js), so the WebGL build does not carry TSL.
//
// WebGPU draws points one pixel wide: the snowflakes and the splashes are
// quads here (the snow turned to the camera, the splashes lying on the
// ground), drawn from the same seeds as the rain's.
//
// The uniforms are TSL uniform nodes, which have a `value` as the GLSL
// ones do: weather.js sets both alike (mesh.userData.uniforms).

// TSL uniforms with these first values (vectors and colours are cloned).
function createUniforms(spec) {
  return Object.fromEntries(Object.entries(spec).map(([key, value]) => [
    key,
    uniform(value?.clone ? value.clone() : value),
  ]));
}

// Where a drop or flake is (weather.js FALLING_PARS): from its seed, moved
// by time, wrapped into the cube that goes with the camera.
function fallen(u, seed, fall, drift = vec2(0)) {
  const travel = vec3(u.uWind.x.mul(u.uTime).add(drift.x), fall.negate().mul(u.uTime), u.uWind.y.mul(u.uTime).add(drift.y));
  return u.uBoxMin.add(mod(seed.xyz.mul(u.uBoxSize).add(travel).sub(u.uBoxMin), vec3(u.uBoxSize)));
}

function boxFade(u, p, width) {
  const f = p.sub(u.uBoxMin).div(u.uBoxSize);
  const e = min(f, f.oneMinus());
  return smoothstep(0, width, min(min(e.x, e.y), e.z));
}

// The size of a pixel at `range` from the camera.
function pixelAt(u, range) {
  return float(2).div(cameraProjectionMatrix.element(1).y.mul(u.uViewportHeight)).mul(mix(range, float(1), u.uOrthographic));
}

// `height`: the height map the vertex stage reads. three binds a texture
// only the vertex stage uses as nothing (seen with the WebGL 2 backend), so
// the fragment stage touches it too, to no effect on the result.
function precipitationMaterial(u, positionNode, opacityNode, colorNode = u.uColor, height = null) {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: true,
  });
  material.positionNode = positionNode;
  material.colorNode = colorNode;
  material.opacityNode = height ? opacityNode.mul(texture(height, vec2(0.5)).r.mul(1e-6).add(1)) : opacityNode;
  return material;
}

// The model's top (or the ground) under a place (weather.js SURFACE_PARS),
// read in the vertex stage; outside the height map, the ground.
function surfaceAt(u, height, xz) {
  const uv = xz.sub(u.uMapOrigin.xz).div(u.uMapSize.xz);
  const inside = step(0, uv.x).mul(step(uv.x, 1)).mul(step(0, uv.y)).mul(step(uv.y, 1));
  return u.uMapOrigin.y.add(texture(height, vec2(uv.x, uv.y.oneMinus())).level(0).r.mul(u.uMapSize.y).mul(inside));
}

// Corners: x across (-1..1), y along the streak (0 head, 1 tail). Gone once
// it has reached a roof or the ground.
function rainMaterial(u, height) {
  const seed = attribute("aSeed", "vec4");
  const fall = u.uFall.mul(seed.w.mul(0.3).add(0.85));
  const head = fallen(u, seed, fall);
  const axis = normalize(vec3(u.uWind.x, fall.negate(), u.uWind.y));
  const toCamera = cameraPosition.sub(head);
  const range = length(toCamera);
  const side = normalize(cross(axis, toCamera.div(max(range, 1e-6))));
  const pixel = pixelAt(u, range);
  const width = max(u.uWidth, pixel.mul(u.uMinPixels.x));
  const streak = max(u.uLength, pixel.mul(u.uMinPixels.y));
  const position = head.sub(axis.mul(positionGeometry.y).mul(streak)).add(side.mul(positionGeometry.x).mul(width));
  const sheltered = step(head.y, surfaceAt(u, height, head.xz));
  const near = smoothstep(u.uBoxSize.mul(0.015), u.uBoxSize.mul(0.05), range);
  const alpha = varying(boxFade(u, head, 0.12).mul(near).mul(sheltered.oneMinus()));
  const corner = varying(positionGeometry.xy);
  const opacity = u.uOpacity.mul(alpha).mul(abs(corner.x).oneMinus()).mul(corner.y.mul(0.7).oneMinus());
  return precipitationMaterial(u, position, opacity, u.uColor, height);
}

// Where a drop went below a roof or the ground, and the seconds since
// (negative while it has not).
function landing(u, height, seed) {
  const fall = u.uFall.mul(seed.w.mul(0.3).add(0.85));
  const p = fallen(u, seed, fall);
  const surface = surfaceAt(u, height, p.xz);
  return { ground: vec3(p.x, surface, p.z), since: surface.sub(p.y).div(fall) };
}

// Corners -1..1 lying on the surface: a ring widening after a drop lands.
function splashMaterial(u, height) {
  const seed = attribute("aSeed", "vec4");
  const { ground, since } = landing(u, height, seed);
  const progress = varying(select(since.greaterThanEqual(0), since.div(u.uDuration), float(2)));
  const fade = varying(boxFade(u, ground, 0.12));
  const center = ground.add(vec3(0, u.uPointSize.mul(0.02), 0));
  const pixel = pixelAt(u, length(cameraPosition.sub(center)));
  const radius = select(progress.lessThan(1), max(u.uPointSize.mul(0.5).mul(progress.add(0.35)), pixel.mul(0.75)), float(0));
  const position = center.add(vec3(positionGeometry.x, 0, positionGeometry.y).mul(radius));
  const corner = varying(positionGeometry.xy);
  const ring = smoothstep(0.35, 0, abs(length(corner).sub(progress))).mul(progress.oneMinus().max(0));
  return precipitationMaterial(u, position, u.uOpacity.mul(ring).mul(fade), u.uColor, height);
}

// Drops bouncing off where the rain lands: thrown up and out, back down
// within uDuration. Corners -1..1 turned to the camera.
function sprayMaterial(u, height) {
  const seed = attribute("aSeed", "vec4");
  const { ground, since } = landing(u, height, seed);
  const angle = fract(seed.x.mul(7.13).add(seed.z.mul(3.7))).mul(6.2832);
  const spread = vec2(cos(angle), sin(angle)).mul(u.uSpeed).mul(seed.w.mul(0.5).add(0.2));
  const rise = u.uSpeed.mul(seed.z.mul(0.5).add(0.8));
  const gravity = rise.mul(2).div(u.uDuration);
  const t = max(since, 0);
  const center = ground.add(vec3(spread.x.mul(t), rise.mul(t).sub(gravity.mul(0.5).mul(t).mul(t)), spread.y.mul(t)));
  const alive = varying(select(
    since.greaterThanEqual(0).and(since.lessThan(u.uDuration)),
    since.div(u.uDuration).oneMinus().mul(boxFade(u, ground, 0.12)),
    float(0),
  ));
  const pixel = pixelAt(u, length(cameraPosition.sub(center)));
  const radius = select(alive.greaterThan(0), max(u.uPointSize.mul(0.5), pixel.mul(0.75)), float(0));
  const position = center.add(u.uRight.mul(positionGeometry.x).add(u.uUp.mul(positionGeometry.y)).mul(radius));
  const corner = varying(positionGeometry.xy);
  return precipitationMaterial(u, position, u.uOpacity.mul(alive).mul(smoothstep(1, 0.3, length(corner))), u.uColor, height);
}

// Corners -1..1 turned to the camera (uRight, uUp): a soft flake, swaying,
// settled once on a roof or the ground.
function snowMaterial(u, height) {
  const seed = attribute("aSeed", "vec4");
  const fall = u.uFall.mul(seed.w.mul(0.6).add(0.7));
  const t = u.uTime.mul(seed.w.add(0.6)).add(seed.x.mul(40));
  const sway = vec2(sin(t), cos(t.mul(0.8).add(seed.z.mul(9)))).mul(u.uSway);
  const center = fallen(u, seed, fall, sway);
  const range = length(cameraPosition.sub(center));
  const pixel = pixelAt(u, range);
  const radius = max(u.uPointSize.mul(seed.w.mul(0.8).add(0.6)).mul(0.5), pixel);
  const position = center.add(u.uRight.mul(positionGeometry.x).add(u.uUp.mul(positionGeometry.y)).mul(radius));
  const settled = step(center.y, surfaceAt(u, height, center.xz));
  const near = smoothstep(u.uBoxSize.mul(0.01), u.uBoxSize.mul(0.04), range);
  const alpha = varying(boxFade(u, center, 0.12).mul(near).mul(settled.oneMinus()));
  const corner = varying(positionGeometry.xy);
  return precipitationMaterial(u, position, u.uOpacity.mul(alpha).mul(smoothstep(1, 0.25, length(corner))), u.uColor, height);
}

// The height map (weather.js HEIGHT_FRAGMENT): the model's height in the
// precipitation's box, 0..1.
function heightMaterial(u) {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  material.colorNode = vec4(positionWorld.y.sub(u.uGround).div(u.uTop.sub(u.uGround)).clamp(0, 1), 0, 0, 1);
  return material;
}

// The mist (weather.js MIST_FRAGMENT): raymarched through its box up to the
// scene's depth (the viewport's depth texture), clumps from the 3D noise.
function mistMaterial(u, noise, steps) {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: BackSide,
    fog: false,
  });
  const height = (p) => p.y.sub(u.uBoxMin.y).div(u.uBoxMax.y.sub(u.uBoxMin.y));
  const density = (p, fine) => {
    const q = p.mul(u.uScale);
    let n = texture3D(noise, q.add(u.uDrift)).r;
    if (fine) n = n.mul(0.65).add(texture3D(noise, q.mul(2.7).sub(u.uDrift.mul(1.6))).r.mul(0.35));
    const h = height(p);
    const center = u.uBoxMin.xz.add(u.uBoxMax.xz).mul(0.5);
    const r = length(p.xz.sub(center)).div(u.uBoxMax.x.sub(u.uBoxMin.x).mul(0.5));
    // Clumps or a blanket (weather.js mistDensity).
    const clumps = n.sub(u.uCoverage.oneMinus()).sub(h.mul(0.55)).mul(4).clamp(0, 1);
    const blanket = n.mul(0.75).add(0.25).mul(exp(h.mul(-3.5))).mul(smoothstep(0.75, 1, h).oneMinus());
    const d = mix(clumps, blanket.mul(0.3), u.uSpread);
    return d.mul(smoothstep(0, 0.04, h)).mul(smoothstep(0.6, 1, r).oneMinus());
  };
  material.colorNode = Fn(() => {
    const origin = cameraPosition.toVar();
    const direction = normalize(positionWorld.sub(cameraPosition)).toVar();
    If(u.uOrthographic.greaterThan(0.5), () => {
      direction.assign(u.uCameraForward);
      origin.assign(positionWorld.sub(direction.mul(dot(positionWorld.sub(cameraPosition), direction))));
    });
    const inverse = vec3(1).div(direction);
    const t0 = u.uBoxMin.sub(origin).mul(inverse);
    const t1 = u.uBoxMax.sub(origin).mul(inverse);
    const tMin = min(t0, t1);
    const tMax = max(t0, t1);
    const tNear = max(max(tMin.x, tMin.y), max(tMin.z, 0)).toVar();
    const tFar = min(min(tMax.x, tMax.y), tMax.z).toVar();

    // The scene in front: its depth, as far along the ray.
    const depth = viewportDepthTexture(screenUV).x;
    const viewDepth = select(
      u.uOrthographic.greaterThan(0.5),
      orthographicDepthToViewZ(depth, cameraNear, cameraFar).negate(),
      select(
        u.uLogDepth.greaterThan(0.5),
        logarithmicDepthToViewZ(depth, cameraNear, cameraFar).negate(),
        perspectiveDepthToViewZ(depth, cameraNear, cameraFar).negate(),
      ),
    );
    If(depth.lessThan(1), () => {
      tFar.assign(min(tFar, viewDepth.div(max(dot(direction, u.uCameraForward), 1e-4))));
    });
    tFar.assign(min(tFar, tNear.add(u.uMaxMarch)));

    const transmittance = float(1).toVar();
    const light = vec3(0).toVar();
    If(tFar.greaterThan(tNear), () => {
      const stepLength = tFar.sub(tNear).div(steps);
      // Interleaved gradient noise (as the GLSL).
      const jitter = fract(fract(dot(screenCoordinate, vec2(0.06711056, 0.00583715))).mul(52.9829189));
      const forward = pow(max(dot(direction, u.uSunDir), 0), 6).mul(1.3).add(0.25);
      Loop(steps, ({ i }) => {
        const p = origin.add(direction.mul(tNear.add(float(i).add(jitter).mul(stepLength))));
        const d = density(p, true).mul(u.uDensity);
        If(d.greaterThan(0.001), () => {
          const shade = exp(density(p.add(u.uSunDir.mul(u.uShadowReach)), false).mul(u.uDensity).mul(-2.5));
          const lit = u.uFogColor.mul(height(p).mul(0.35).add(0.72)).add(u.uSunColor.mul(shade).mul(forward));
          const a = exp(d.mul(u.uSigma).mul(stepLength).negate()).oneMinus();
          light.addAssign(transmittance.mul(a).mul(lit));
          transmittance.mulAssign(a.oneMinus());
        });
        If(transmittance.lessThan(0.02), () => {
          Break();
        });
      });
    });
    const alpha = transmittance.oneMinus();
    return vec4(light.div(max(alpha, 1e-4)), alpha);
  })();
  return material;
}

// three's SkyMesh, hazed towards (and below) the horizon in the fog colour;
// its uniforms gathered under the names of Sky's (weather.js sets them).
function createSky() {
  const sky = new SkyMesh();
  sky.cloudScale.value = 0.0003;
  const haze = uniform(0);
  const hazeColor = uniform(new Color());
  const gain = uniform(1);
  const base = sky.material.colorNode;
  const direction = normalize(positionWorld.sub(cameraPosition));
  const horizon = select(direction.y.lessThan(0), max(haze, 0.85), haze.mul(smoothstep(0, 0.5, direction.y).oneMinus()));
  sky.material.colorNode = vec4(mix(base.rgb.mul(gain), hazeColor, horizon), 1);
  sky.userData.uniforms = {
    turbidity: sky.turbidity,
    rayleigh: sky.rayleigh,
    mieCoefficient: sky.mieCoefficient,
    mieDirectionalG: sky.mieDirectionalG,
    sunPosition: sky.sunPosition,
    cloudScale: sky.cloudScale,
    cloudSpeed: sky.cloudSpeed,
    cloudCoverage: sky.cloudCoverage,
    cloudDensity: sky.cloudDensity,
    cloudElevation: sky.cloudElevation,
    showSunDisc: sky.showSunDisc,
    // SkyMesh runs on three's own clock.
    time: { value: 0 },
    weatherHaze: haze,
    weatherHazeColor: hazeColor,
    weatherSkyGain: gain,
  };
  return sky;
}

// ---- surfaces ----------------------------------------------------------------

// How wet the surfaces are and how much snow lies on them (weather.js); in
// every standard and physical material drawn, at no cost while both are 0.
const surfaceUniforms = { weatherWet: uniform(0), weatherSnow: uniform(0) };

// For the viewer's node materials (renderer-backend.js), before their own
// setupVariants: darker and glossier when wet, white where they face up
// under snow. Returns the roughness and metalness nodes to use. The
// geometry's normal: the material's own (normalWorld) is not set up yet.
function setupWeatherSurface(material) {
  const up = normalWorldGeometry.y;
  const cover = surfaceUniforms.weatherSnow.mul(smoothstep(0.3, 0.75, up));
  const wetness = surfaceUniforms.weatherWet.mul(up.clamp(0, 1).mul(0.45).add(0.55)).mul(cover.oneMinus());
  const color = mix(diffuseColor.rgb.mul(wetness.mul(0.45).oneMinus()), vec3(0.93, 0.95, 1.0), cover);
  diffuseColor.assign(vec4(color, diffuseColor.a));
  const roughness = material.roughnessNode ? float(material.roughnessNode) : materialRoughness;
  const metalness = material.metalnessNode ? float(material.metalnessNode) : materialMetalness;
  return {
    roughnessNode: mix(mix(roughness, 0.12, wetness.mul(0.85)), 0.85, cover),
    metalnessNode: mix(metalness, 0, cover),
  };
}

export { createSky, createUniforms, heightMaterial, mistMaterial, rainMaterial, setupWeatherSurface, snowMaterial, splashMaterial, sprayMaterial, surfaceUniforms };
//# sourceMappingURL=weather-webgpu-T1KqnN8E.js.map
