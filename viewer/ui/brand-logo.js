import { core } from "../core.js";
import { getModuleAssetBasePath } from "../loaders.js";
import { DARK_LUMINANCE, backgroundLuminance } from "../background-luminance.js";
import { getBrandLogo } from "../branding.js";

// The ExPlora4D logo at the top centre of the viewer, in every build and
// mode. The images are in assets/img/logo (viewer/img/logo, copied by
// rollup.config.js), made from resources/ExPlora4D-logo.png: trimmed to its
// content, 640 px wide. The current logo reads on light and dark alike, so
// ExPlora4D-on-dark.webp is the same image; a variant made for dark
// backgrounds can replace it. Both are stacked, and it fades in while the
// background behind the model is dark.
// A deployment replaces it, or turns it off, with branding.logo in
// viewer-settings.json (../branding.js, docs/branding.md).

// How often the background is checked: it changes from settings, manifests
// and the GUI, through several paths.
const BACKGROUND_CHECK_MS = 1000;
// Touch screens: how long the logo stays faded after the last finger
// leaves the model (a mouse fades it on hover instead - main.css).
const TOUCH_FADE_HOLD_MS = 1500;

function createLogoImage(src, variant, alt, { width, height } = {}) {
  const image = document.createElement("img");
  image.className = `viewer-brand-logo__${variant}`;
  image.src = src;
  image.alt = alt;
  if (width) image.width = width;
  if (height) image.height = height;
  image.decoding = "async";
  image.draggable = false;
  return image;
}

export function attachBrandLogo(container) {
  if (!container || container.querySelector(".viewer-brand-logo")) return null;
  const brand = getBrandLogo(`${getModuleAssetBasePath()}/img/logo`);
  if (!brand) return null;
  const logo = document.createElement("div");
  logo.className = "viewer-brand-logo";
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", brand.alt);
  logo.append(
    createLogoImage(brand.src, "light", "", brand),
    createLogoImage(brand.srcOnDark, "dark", "", brand)
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
  fadeWhileTouched(logo);
  return logo;
}

// Fades the logo while fingers (or a pen) move the model: touch has no
// hover, so the CSS rule for the mouse never applies. Touch events count
// the fingers (e.touches) - pointer ids alone can leave a finger counted
// for good when a WebView drops its pointerup. Listened to on the window,
// in the capture phase, so no handler further down can stop them.
function fadeWhileTouched(logo) {
  let restore = 0;
  let pen = false;
  const onCanvas = (event) => {
    const canvas = core.mainCanvas || document.getElementById("MainCanvas");
    return !!canvas && event.composedPath().includes(canvas);
  };
  const fade = () => {
    clearTimeout(restore);
    logo.classList.add("is-faded");
  };
  const release = () => {
    if (!logo.classList.contains("is-faded")) return;
    clearTimeout(restore);
    restore = setTimeout(() => logo.classList.remove("is-faded"), TOUCH_FADE_HOLD_MS);
  };
  const options = { capture: true, passive: true };
  window.addEventListener("touchstart", (event) => {
    if (onCanvas(event)) fade();
  }, options);
  ["touchend", "touchcancel"].forEach((type) => {
    window.addEventListener(type, (event) => {
      if (!event.touches.length) release();
    }, options);
  });
  // A pen sends no touch events.
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "pen" || !onCanvas(event)) return;
    pen = true;
    fade();
  }, options);
  ["pointerup", "pointercancel"].forEach((type) => {
    window.addEventListener(type, (event) => {
      if (event.pointerType !== "pen" || !pen) return;
      pen = false;
      release();
    }, options);
  });
}
