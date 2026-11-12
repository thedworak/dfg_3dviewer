// A deployment's look, from "branding" in viewer-settings.json: the name,
// the logo over the canvas and on the thumbnails, the page title, favicon,
// colours and an extra stylesheet - one codebase for every client, each
// deployment with its own settings file (docs/branding.md). Everything is
// optional; without "branding" the viewer looks as it always did.
//
//   "branding": {
//     "id": "acme",                      // <html data-brand="acme">, for brand.css
//     "name": "Acme 3D",                 // aria labels, intro frame title
//     "title": "Acme 3D Viewer",         // document.title
//     "favicon": "brand/favicon.png",    // replaces <link rel="icon">
//     "themeColor": "#0b3d91",           // <meta name="theme-color">
//     "logo": {                          // false: no logo over the canvas
//       "src": "brand/logo.svg",
//       "srcOnDark": "brand/logo-white.svg",   // optional, for dark backgrounds
//       "alt": "Acme"
//     },
//     "watermark": true,                 // the logo on rendered thumbnails;
//                                        // false: none; a string: its own image
//     "colors": {                        // a string: both themes,
//       "accent": "#ff6a00",             // or { "dark": ..., "light": ... }
//       "secondary": { "dark": "#9ec5ff", "light": "#0b3d91" },
//       "strong": "#0b3d91",
//       "glow": "#ff6a00"
//     },
//     "cssVariables": {                  // any other --viewer-* token
//       "dark":  { "--viewer-panel-bg": "rgba(8, 20, 40, 0.85)" },
//       "light": { "--viewer-panel-bg": "rgba(245, 248, 255, 0.95)" }
//     },
//     "stylesheet": "brand/brand.css"    // loaded last, wins over the rest
//   }
//
// Relative paths resolve against the viewer page (like credits.logo.src),
// so a deployment puts its files next to index.html, e.g. in brand/.

import { core } from "./core.js";

export const DEFAULT_BRAND_NAME = "ExPlora4D";

// colors.<key> -> the CSS variables it sets (main.css, :root).
const COLOR_TOKENS = {
  accent: ["--viewer-brand-accent"],
  secondary: ["--viewer-brand-secondary"],
  strong: ["--viewer-brand-strong"],
  glow: ["--viewer-brand-glow"],
};

// Win over main.css's own declarations whatever order the stylesheets load
// in: one more element (html) than each of its selectors. The variables on
// .viewer-wrapper are declared there again, so it is listed too.
const DARK_SELECTOR = [
  "html:root",
  "html .viewer-wrapper:not([data-viewer-theme=\"light\"])",
].join(",\n");
const LIGHT_SELECTOR = [
  "html[data-viewer-theme=\"light\"]:root",
  "html .viewer-wrapper[data-viewer-theme=\"light\"]",
  "html #form-manifesto[data-viewer-theme=\"light\"]",
].join(",\n");

const STYLE_ID = "viewer-branding-style";
const STYLESHEET_ID = "viewer-branding-stylesheet";

export function getBranding(config = core.CONFIG) {
  const branding = config?.branding;
  return branding && typeof branding === "object" ? branding : {};
}

export function getBrandName(config = core.CONFIG) {
  const name = getBranding(config).name;
  return typeof name === "string" && name.trim() ? name.trim() : DEFAULT_BRAND_NAME;
}

// A path from the settings, as a URL the page can load; null when unusable.
// Only http(s), same-origin relative paths and data:image URLs.
export function resolveBrandUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), document.baseURI);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    if (url.protocol === "data:" && /^data:image\//i.test(value.trim())) return url.href;
  } catch {
    // An invalid URL is left out.
  }
  return null;
}

// The logo over the canvas: { src, srcOnDark, alt, width, height }, or null
// when the deployment turned it off. srcOnDark falls back to src. width and
// height are only set for the built-in logo (its aspect ratio is known).
export function getBrandLogo(defaultBase, config = core.CONFIG) {
  const logo = getBranding(config).logo;
  if (logo === false || logo?.visible === false) return null;
  const name = getBrandName(config);
  const src = resolveBrandUrl(logo?.src);
  if (!src) {
    return {
      src: `${defaultBase}/ExPlora4D.webp`,
      srcOnDark: `${defaultBase}/ExPlora4D-on-dark.webp`,
      alt: name,
      width: 640,
      height: 154,
    };
  }
  return {
    src,
    srcOnDark: resolveBrandUrl(logo.srcOnDark) || src,
    alt: typeof logo.alt === "string" && logo.alt ? logo.alt : name,
    width: Number(logo.width) > 0 ? Number(logo.width) : undefined,
    height: Number(logo.height) > 0 ? Number(logo.height) : undefined,
  };
}

// The image drawn on rendered thumbnails, or null for none.
export function getWatermarkUrl(defaultBase, config = core.CONFIG) {
  const branding = getBranding(config);
  const watermark = branding.watermark;
  if (watermark === false) return null;
  if (typeof watermark === "string") return resolveBrandUrl(watermark);
  return resolveBrandUrl(branding.logo?.src) || `${defaultBase}/ExPlora4D.webp`;
}

// A CSS value from the settings, left out when it could end the
// declaration or the rule it is written into.
function safeCssValue(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text || /[;{}<>\\]|\/\*/.test(text)) return null;
  return text;
}

function addDeclaration(target, name, value) {
  if (!/^--[a-z0-9-]+$/i.test(name)) return;
  const safe = safeCssValue(value);
  if (safe) target.push(`  ${name}: ${safe};`);
}

// The <style> text for branding.colors and branding.cssVariables ("" when
// there is nothing to set). Exported for the tests.
export function brandingCss(branding) {
  const dark = [];
  const light = [];
  const colors = branding?.colors && typeof branding.colors === "object" ? branding.colors : {};
  for (const [key, names] of Object.entries(COLOR_TOKENS)) {
    const value = colors[key];
    if (value == null) continue;
    const pair = typeof value === "object" ? value : { dark: value, light: value };
    names.forEach((name) => {
      if (pair.dark != null) addDeclaration(dark, name, pair.dark);
      if (pair.light != null) addDeclaration(light, name, pair.light);
    });
  }
  const variables = branding?.cssVariables;
  if (variables && typeof variables === "object") {
    const both = Object.entries(variables).filter(([name]) => name.startsWith("--"));
    both.forEach(([name, value]) => {
      addDeclaration(dark, name, value);
      addDeclaration(light, name, value);
    });
    Object.entries(variables.dark || {}).forEach(([name, value]) => addDeclaration(dark, name, value));
    Object.entries(variables.light || {}).forEach(([name, value]) => addDeclaration(light, name, value));
  }
  const rules = [];
  if (dark.length) rules.push(`${DARK_SELECTOR} {\n${dark.join("\n")}\n}`);
  if (light.length) rules.push(`${LIGHT_SELECTOR} {\n${light.join("\n")}\n}`);
  return rules.join("\n\n");
}

function setLinkHref(selector, attributes, href) {
  let link = document.head.querySelector(selector);
  if (!link) {
    link = document.createElement("link");
    Object.entries(attributes).forEach(([name, value]) => link.setAttribute(name, value));
    document.head.appendChild(link);
  }
  link.href = href;
  link.removeAttribute("type");
}

// Applies the branding to the page, once the settings are loaded (main.js).
// Safe to call again: everything it adds is replaced, not duplicated.
export function applyBranding(config = core.CONFIG) {
  const branding = getBranding(config);
  const root = document.documentElement;

  if (typeof branding.title === "string" && branding.title.trim()) {
    document.title = branding.title.trim();
  }

  const favicon = resolveBrandUrl(branding.favicon);
  if (favicon) {
    document.head.querySelectorAll('link[rel~="icon"]').forEach((link) => {
      link.href = favicon;
      link.removeAttribute("type");
    });
    if (!document.head.querySelector('link[rel~="icon"]')) {
      setLinkHref('link[rel~="icon"]', { rel: "icon" }, favicon);
    }
  }

  const themeColor = safeCssValue(branding.themeColor);
  if (themeColor) {
    let meta = document.head.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
  }

  const css = brandingCss(branding);
  let style = document.getElementById(STYLE_ID);
  if (css) {
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
    }
    style.textContent = css;
    // Last in <head>, after the stylesheets already there.
    document.head.appendChild(style);
  } else {
    style?.remove();
  }

  const stylesheet = resolveBrandUrl(branding.stylesheet);
  const existing = document.getElementById(STYLESHEET_ID);
  if (stylesheet) {
    const link = existing || document.createElement("link");
    link.id = STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href = stylesheet;
    document.head.appendChild(link);
  } else {
    existing?.remove();
  }

  if (typeof branding.id === "string" && /^[a-z0-9_-]+$/i.test(branding.id)) {
    root.dataset.brand = branding.id;
  }
}
