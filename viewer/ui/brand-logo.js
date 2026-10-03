import { core } from "../core.js";
import { getModuleAssetBasePath } from "../loaders.js";

// The ExPlora4D logo at the top centre of the viewer, in every build and
// mode. The images are in assets/img/logo (viewer/img/logo, copied by
// rollup.config.js), made from resources/ExPlora4D-logo.png: trimmed to its
// content, 640 px wide. ExPlora4D-on-dark.webp has the dark lettering (the
// low-chroma pixels right of the picture panels) lightened; both are
// stacked, and it fades in while the background behind the model is dark.

// How often the background is checked: it changes from settings, manifests
// and the GUI, through several paths.
const BACKGROUND_CHECK_MS = 1000;
// Relative luminance below which the background counts as dark.
const DARK_LUMINANCE = 0.4;
// Touch screens: how long the logo stays faded after the last finger
// leaves the model (a mouse fades it on hover instead - main.css).
const TOUCH_FADE_HOLD_MS = 1500;

const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

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

// Luminance of what is behind the model: the scene's own background colour,
// else the canvas's CSS background (the gradient by default).
function backgroundLuminance() {
  const background = core.scene?.background;
  if (background?.isColor) {
    return luminance(background.r * 255, background.g * 255, background.b * 255);
  }
  const canvas = core.mainCanvas || document.getElementById("MainCanvas");
  if (!canvas) return null;
  const style = getComputedStyle(canvas);
  return cssLuminance(style.backgroundImage) ?? cssLuminance(style.backgroundColor);
}

function createLogoImage(src, variant, alt) {
  const image = document.createElement("img");
  image.className = `viewer-brand-logo__${variant}`;
  image.src = src;
  image.alt = alt;
  image.width = 640;
  image.height = 154;
  image.decoding = "async";
  image.draggable = false;
  return image;
}

export function attachBrandLogo(container) {
  if (!container || container.querySelector(".viewer-brand-logo")) return null;
  const base = `${getModuleAssetBasePath()}/img/logo`;
  const logo = document.createElement("div");
  logo.className = "viewer-brand-logo";
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", "ExPlora4D");
  logo.append(
    createLogoImage(`${base}/ExPlora4D.webp`, "light", ""),
    createLogoImage(`${base}/ExPlora4D-on-dark.webp`, "dark", "")
  );
  container.appendChild(logo);

  const update = () => {
    if (!logo.isConnected) {
      clearInterval(timer);
      return;
    }
    const value = backgroundLuminance();
    logo.classList.toggle("is-on-dark", value != null && value < DARK_LUMINANCE);
  };
  const timer = setInterval(update, BACKGROUND_CHECK_MS);
  update();
  fadeWhileTouched(container, logo);
  return logo;
}

// Fades the logo while fingers (or a pen) move the model: touch has no
// hover, so the CSS rule for the mouse never applies. Capture phase - the
// camera controls may stop the events from bubbling.
function fadeWhileTouched(container, logo) {
  const pointers = new Set();
  let restore = 0;
  const release = (event) => {
    if (!pointers.delete(event.pointerId) || pointers.size) return;
    clearTimeout(restore);
    restore = setTimeout(() => logo.classList.remove("is-faded"), TOUCH_FADE_HOLD_MS);
  };
  container.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.target?.id !== "MainCanvas") return;
    pointers.add(event.pointerId);
    clearTimeout(restore);
    logo.classList.add("is-faded");
  }, { capture: true, passive: true });
  ["pointerup", "pointercancel"].forEach((type) => {
    window.addEventListener(type, release, { capture: true, passive: true });
  });
}
