import THREE from "../init.js";
import { core } from "../core.js";

// The material of the section fill (the cut faces, loaders.js): a flat
// colour, optionally hatched - thin diagonal lines in screen space, as on a
// drawn section (an architect's poché), the same density at any zoom.
//
// The WebGL renderer gets the hatch as a patch of the basic material's
// shader; the WebGPU renderer, whose node materials ignore such patches, as
// a colour node (TSL). Either way the style is changed through uniforms, so
// switching it does not rebuild the shader.

// CSS pixels between the lines, and their width.
const HATCH_SPACING = 7;
const HATCH_WIDTH = 1.1;

function hatchUniforms() {
  return {
    uHatch: { value: 0 },
    uHatchColor: { value: new THREE.Color(0x9a9ca3) },
    uHatchSpacing: { value: HATCH_SPACING },
    uHatchWidth: { value: HATCH_WIDTH },
    uPixelRatio: { value: 1 },
  };
}

function patchWebGL(material) {
  const uniforms = hatchUniforms();
  material.userData.hatch = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float uHatch;\nuniform vec3 uHatchColor;\nuniform float uHatchSpacing;\nuniform float uHatchWidth;\nuniform float uPixelRatio;\nvoid main() {"
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
	if ( uHatch > 0.5 ) {
		// 45 degree lines, uHatchSpacing CSS pixels apart.
		float spacing = uHatchSpacing * uPixelRatio;
		float d = ( gl_FragCoord.x + gl_FragCoord.y ) / spacing;
		float distanceToLine = abs( fract( d ) - 0.5 ) * spacing * 0.7071;
		float halfWidth = 0.5 * uHatchWidth * uPixelRatio;
		float line = 1.0 - smoothstep( halfWidth, halfWidth + uPixelRatio, distanceToLine );
		diffuseColor.rgb = mix( diffuseColor.rgb, uHatchColor, line );
	}`
      );
  };
  material.customProgramCacheKey = () => "section-fill-hatch";
}

function makeWebGPUMaterial(options) {
  const webgpu = core.threeWebGPU;
  const { TSL } = webgpu;
  const { Fn, uniform, screenCoordinate, fract, abs, smoothstep, mix, float, vec4, materialColor, materialOpacity } = TSL;
  const material = new webgpu.MeshBasicNodeMaterial(options);
  const uniforms = {
    uHatch: uniform(0),
    uHatchColor: uniform(new THREE.Color(0x9a9ca3)),
    uHatchSpacing: uniform(HATCH_SPACING),
    uHatchWidth: uniform(HATCH_WIDTH),
    uPixelRatio: uniform(1),
  };
  material.colorNode = Fn(() => {
    const spacing = uniforms.uHatchSpacing.mul(uniforms.uPixelRatio);
    const d = screenCoordinate.x.add(screenCoordinate.y).div(spacing);
    const distanceToLine = abs(fract(d).sub(0.5)).mul(spacing).mul(0.7071);
    const halfWidth = uniforms.uHatchWidth.mul(uniforms.uPixelRatio).mul(0.5);
    const line = float(1).sub(smoothstep(halfWidth, halfWidth.add(uniforms.uPixelRatio), distanceToLine)).mul(uniforms.uHatch);
    return vec4(mix(materialColor.rgb, uniforms.uHatchColor, line), materialOpacity);
  })();
  // The same shape as the WebGL side's uniforms ({ value }).
  material.userData.hatch = uniforms;
  return material;
}

// The fill's material for the renderer in use (`options`: a basic
// material's).
export function createSectionFillMaterial(options) {
  if (core.rendererBackend === "webgpu" && core.threeWebGPU?.MeshBasicNodeMaterial) {
    try {
      return makeWebGPUMaterial(options);
    } catch (error) {
      console.warn("[section fill] no hatch with WebGPU:", error);
    }
  }
  const material = new THREE.MeshBasicMaterial(options);
  patchWebGL(material);
  return material;
}

// `color`: the fill's (hex); `hatch`: lines over it, a lighter shade of it
// - quiet, a drawing's hatch rather than a warning tape.
export function setSectionFillStyle(material, { color, hatch }) {
  if (!material) return;
  material.color.setHex(color);
  const uniforms = material.userData?.hatch;
  if (!uniforms) return;
  uniforms.uHatch.value = hatch ? 1 : 0;
  uniforms.uHatchColor.value.setHex(color).lerp(new THREE.Color(0xffffff), 0.28);
  uniforms.uPixelRatio.value = core.renderer?.getPixelRatio?.() || window.devicePixelRatio || 1;
}
