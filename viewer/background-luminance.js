import { core } from "./core.js";

// How light what is behind the model is: the scene's own background colour,
// else the canvas's CSS background (the gradient by default). Used by the
// logo (ui/brand-logo.js), which fades to its dark variant, and by volumes
// (volume.js), whose default white turns to a colour that stands out.

// Relative luminance below which the background counts as dark.
export const DARK_LUMINANCE = 0.4;

export const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Average luminance of the CSS colours in `value` (a colour or a gradient,
// as getComputedStyle gives them: rgb()/rgba()), transparent ones skipped.
function cssLuminance(value) {
  const values = [];
  String(value || "").replace(/rgba?\(([^)]+)\)/g, (_, channels) => {
    const [r, g, b, a = 1] = channels.split(/[\s,/]+/).filter(Boolean).map(Number);
    if (a > 0) values.push(luminance(r, g, b));
    return "";
  });
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// 0 (black) to 1 (white), or null before there is a canvas.
export function backgroundLuminance() {
  const background = core.scene?.background;
  if (background?.isColor) {
    return luminance(background.r * 255, background.g * 255, background.b * 255);
  }
  const canvas = core.mainCanvas || document.getElementById("MainCanvas");
  if (!canvas) return null;
  const style = getComputedStyle(canvas);
  return cssLuminance(style.backgroundImage) ?? cssLuminance(style.backgroundColor);
}

export function isLightBackground() {
  const value = backgroundLuminance();
  return value != null && value >= DARK_LUMINANCE;
}
