// The sandbox's "drop a model here" notice (Viewer.prepareSandboxScene in
// main.js): a button to pick a file from the device, and the formats grouped
// by kind, each with what happens to it - here, opened in the browser
// without leaving the device, and after an upload to the server (the same
// groups and steps as the "Follow your file" section of the project site).
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { modelExtension } from "../model-extension.js";

// Extensions per group, in the order shown. Only the ones in
// core.SUPPORTED_EXTENSIONS / SUPPORTED_ARCHIVES are listed; any supported
// extension no group names lands in "other", so a new format still shows.
const FORMAT_GROUPS = [
  { id: "gltf", extensions: ["glb", "gltf"] },
  { id: "one", extensions: ["one4d", "one"] },
  { id: "mesh", extensions: ["obj", "ply", "stl", "fbx", "dae", "wrl", "usd", "usda", "usdc", "usdz", "3mf"] },
  { id: "kept", extensions: ["3ds", "amf", "vox", "xyz", "pcd", "kmz", "lwo"] },
  { id: "manifest", extensions: ["json"] },
  { id: "ifc", extensions: ["ifc"] },
  { id: "points", extensions: ["las", "laz", "ply"] },
  { id: "splat", extensions: ["spz", "splat", "ksplat", "sog", "rad", "ply"] },
  { id: "volume", extensions: ["lif", "tif", "tiff", "lsm", "nrrd", "nhdr", "nii", "mha", "mhd", "mrc", "rec", "ccp4", "vgi", "xtekct"] },
  { id: "dicom", extensions: ["dcm", "dicom"] },
  { id: "audio", extensions: ["wav", "wave", "bwf", "mp3", "ogg", "oga", "opus", "flac", "m4a", "aac", "weba"] },
  { id: "image", extensions: ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp"] },
  { id: "archive", archives: true },
];

// Read only by the server's conversion (worker/), never in the browser.
const SERVER_ONLY = ["abc", "blend", "x3d", "gml", "step", "stp", "iges", "igs", "e57"];

// Not offered: the worker's converted volumes, nothing to drop in.
const HIDDEN = ["dfgvol"];

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function sandboxFormatGroups() {
  const supported = (core.SUPPORTED_EXTENSIONS || []).filter((ext) => !HIDDEN.includes(ext));
  const archives = core.SUPPORTED_ARCHIVES || [];
  const named = new Set(FORMAT_GROUPS.flatMap((group) => group.extensions || []));
  const groups = FORMAT_GROUPS.map((group) => ({
    id: group.id,
    extensions: group.archives ? [...archives] : group.extensions.filter((ext) => supported.includes(ext)),
  })).filter((group) => group.extensions.length);
  const other = supported.filter((ext) => !named.has(ext));
  if (other.length) groups.splice(groups.length - 1, 0, { id: "other", extensions: other });
  return groups;
}

// Line icons (24x24, stroked in currentColor) for each group and the two
// halves of its flow.
const ICON_PATHS = {
  gltf: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  mesh: '<path d="M4 18 12 4l8 14H4Z"/><path d="M8 11h8M12 4l-4 14M12 4l4 14"/>',
  kept: '<rect x="3.5" y="11" width="8" height="8" rx="1"/><circle cx="16.5" cy="15" r="4"/><path d="m9 3 4.5 6h-9L9 3Z"/>',
  manifest: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M10 12c-1 0-1.5.5-1.5 1.5S8 15 7.5 15c.5 0 1 .5 1 1.5S9 18 10 18M14 12c1 0 1.5.5 1.5 1.5s.5 1.5 1 1.5c-.5 0-1 .5-1 1.5S15 18 14 18"/>',
  ifc: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6M4 21h16M9 11h.01M15 11h.01"/>',
  points: '<circle cx="5" cy="17" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="12" cy="18" r="1"/><circle cx="14" cy="8" r="1"/><circle cx="17" cy="14" r="1"/><circle cx="19" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>',
  splat: '<ellipse cx="9" cy="10" rx="5" ry="3.5" transform="rotate(-25 9 10)"/><ellipse cx="15" cy="15" rx="4.5" ry="2.5" transform="rotate(20 15 15)"/><ellipse cx="16" cy="7" rx="2.5" ry="1.5"/>',
  volume: '<path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
  dicom: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M6 13h3l1.5-4 3 7 1.5-3h3"/>',
  audio: '<path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h0"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  other: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  here: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  server: '<path d="M7 18a4 4 0 0 1-.7-7.94A6 6 0 0 1 17.7 8.6 4.5 4.5 0 0 1 17 18H7Z"/><path d="M12 15V10m-2.5 2.5L12 10l2.5 2.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
};

const icon = (name) =>
  `<svg class="sandbox-formats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.other}</svg>`;

const chips = (extensions) =>
  `<span class="sandbox-formats-chips">${extensions
    .map((ext) => `<span class="sandbox-formats-chip" data-ext="${escapeHtml(ext)}">${escapeHtml(ext.toUpperCase())}</span>`)
    .join("")}</span>`;

const LANGUAGES = ["en", "pl", "de"];

// What was typed in the search box, kept across re-renders (a language
// change rebuilds the notice).
let searchQuery = "";

// One line of HTML (the notice splits its detail on newlines).
export function sandboxDropDetailHtml() {
  const tr = (key, fallback = "") => t(`sandboxFormats.${key}`, {}, fallback);
  const groups = sandboxFormatGroups()
    .map((group) => {
      const name = tr(`groups.${group.id}.name`, group.id);
      const browser = tr(`groups.${group.id}.browser`);
      const server = tr(`groups.${group.id}.server`);
      return (
        `<details class="sandbox-formats-group" data-group="${group.id}">` +
        `<summary><span class="sandbox-formats-name">${icon(group.id)}<span>${escapeHtml(name)}</span></span>${chips(group.extensions)}</summary>` +
        `<dl class="sandbox-formats-flow">` +
        (browser ? `<dt>${icon("here")}${escapeHtml(tr("here", "Here, in the browser"))}</dt><dd>${escapeHtml(browser)}</dd>` : "") +
        (server ? `<dt>${icon("server")}${escapeHtml(tr("server", "Uploaded to the server"))}</dt><dd>${escapeHtml(server)}</dd>` : "") +
        `</dl></details>`
      );
    })
    .join("");

  const current = LANGUAGES.includes(core.currentLanguage) ? core.currentLanguage : "en";
  const dark = document.documentElement.getAttribute("data-viewer-theme") !== "light";
  const prefs =
    `<span class="sandbox-prefs">` +
    `<span class="sandbox-prefs-lang" role="group" aria-label="${escapeHtml(tr("language", "Language"))}">` +
    LANGUAGES.map(
      (code) =>
        `<button type="button" data-sandbox-lang="${code}" aria-pressed="${code === current}">${code.toUpperCase()}</button>`
    ).join("") +
    `</span>` +
    `<button type="button" class="sandbox-prefs-theme" data-sandbox-action="theme" ` +
    `aria-label="${escapeHtml(dark ? tr("toLight", "Switch to light mode") : tr("toDark", "Switch to dark mode"))}" ` +
    `title="${escapeHtml(dark ? tr("toLight", "Switch to light mode") : tr("toDark", "Switch to dark mode"))}">` +
    `${icon(dark ? "sun" : "moon")}</button>` +
    `</span>`;

  return (
    `<span class="sandbox-formats">` +
    prefs +
    `<button type="button" class="sandbox-open-file" data-sandbox-action="open-file">` +
    `<span class="open-local-file-icon" aria-hidden="true"></span>${escapeHtml(tr("openFile", "Load from disk"))}</button>` +
    `<span class="sandbox-formats-local">${escapeHtml(tr("local", "Your file stays on this device — nothing is sent to a server."))}</span>` +
    `<span class="sandbox-formats-title"><span class="sandbox-formats-heading">${escapeHtml(tr("title", "Supported formats"))}</span>` +
    `<label class="sandbox-formats-search">${icon("search")}` +
    `<input type="search" autocomplete="off" spellcheck="false" ` +
    `placeholder="${escapeHtml(tr("searchPlaceholder", "Is my format supported? e.g. e57 or model.las"))}" ` +
    `aria-label="${escapeHtml(tr("searchLabel", "Look up a format"))}" value="${escapeHtml(searchQuery)}"></label>` +
    `<span class="sandbox-formats-hint">${escapeHtml(tr("hint", "Click a group for details."))}</span></span>` +
    `<span class="sandbox-formats-result" role="status" aria-live="polite"></span>` +
    `<span class="sandbox-formats-groups">${groups}</span>` +
    `<span class="sandbox-formats-server-only">${icon("server")}<strong>${escapeHtml(tr("serverOnly", "Only after an upload to the server"))}:</strong> ` +
    `${chips(SERVER_ONLY)}</span>` +
    `</span>`
  );
}

// The extension a query names: "las", ".las", "scan.LAZ", "brain.nii.gz".
export function queryExtension(query) {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return "";
  return value.includes(".") ? modelExtension(value) : value;
}

// Where an extension stands: { kind: "browser", groups } for one the viewer
// opens (PLY is in three: a mesh, points or Gaussian splats), { kind:
// "server" } for one only the server converts, else { kind: "none" }.
export function lookUpFormat(extension) {
  const groups = sandboxFormatGroups().filter((entry) => entry.extensions.includes(extension));
  if (groups.length) return { kind: "browser", groups: groups.map((entry) => entry.id) };
  if (SERVER_ONLY.includes(extension)) return { kind: "server" };
  return { kind: "none" };
}

// Lights up the labels that start with the typed extension, dims the
// groups without one, and says in a line whether that exact format is read.
function applySearch(node) {
  const root = node.querySelector(".sandbox-formats");
  const result = node.querySelector(".sandbox-formats-result");
  if (!root || !result) return;
  const extension = queryExtension(searchQuery);
  root.classList.toggle("is-searching", Boolean(extension));
  node.querySelectorAll(".sandbox-formats-chip").forEach((chip) => {
    chip.classList.toggle("is-match", Boolean(extension) && chip.dataset.ext.startsWith(extension));
    chip.classList.toggle("is-exact", Boolean(extension) && chip.dataset.ext === extension);
  });
  node.querySelectorAll(".sandbox-formats-group, .sandbox-formats-server-only").forEach((block) => {
    block.classList.toggle("is-match", Boolean(block.querySelector(".sandbox-formats-chip.is-match")));
  });

  result.textContent = "";
  delete result.dataset.kind;
  if (!extension) return;
  const found = lookUpFormat(extension);
  const ext = `.${extension}`;
  if (found.kind === "browser") {
    const group = found.groups.map((id) => t(`sandboxFormats.groups.${id}.name`, {}, id)).join(" / ");
    result.textContent = t("sandboxFormats.resultBrowser", { ext, group }, "{ext} is supported ({group}) and opens right here.");
    for (const id of found.groups) {
      const details = node.querySelector(`.sandbox-formats-group[data-group="${id}"]`);
      if (details && !details.open) details.open = true;
    }
  } else if (found.kind === "server") {
    result.textContent = t("sandboxFormats.resultServer", { ext }, "{ext} opens only after an upload to the server, which converts it.");
  } else if (!node.querySelector(".sandbox-formats-chip.is-match")) {
    result.textContent = t("sandboxFormats.resultNone", { ext }, "{ext} is not supported.");
  } else {
    return;
  }
  result.dataset.kind = found.kind;
}

// Picks one file, or several images (a set to browse), like a drop.
export function pickSandboxFiles(viewer) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  // No accept filter: Android has no MIME types for most 3D formats and
  // would grey them out; openLocalFile() checks the extension instead.
  input.addEventListener(
    "change",
    () => {
      const files = [...(input.files || [])];
      if (files.length) viewer.openDroppedFiles(files);
    },
    { once: true }
  );
  input.click();
}

// The notice takes clicks (its button, the groups), so a file dropped on it
// would not reach the canvas and the browser would open it in the tab:
// forwarded to the viewer's drop handler instead. Bound once on the notice
// element, which later notices reuse - hence the variant check.
export function bindSandboxDropNotice(viewer, node) {
  if (!node.dataset.sandboxDropBound) {
    node.dataset.sandboxDropBound = "1";
    node.addEventListener("dragover", (event) => {
      if (node.dataset.variant === "sandbox") event.preventDefault();
    });
    node.addEventListener("drop", (event) => {
      if (node.dataset.variant !== "sandbox") return;
      event.preventDefault();
      viewer.onDrop(event);
    });
  }
  const button = node.querySelector('[data-sandbox-action="open-file"]');
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    pickSandboxFiles(viewer);
  });

  // The sandbox hides the viewer's menus, so the language and the theme are
  // switched here.
  node.querySelectorAll("[data-sandbox-lang]").forEach((langButton) => {
    langButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const lang = langButton.dataset.sandboxLang;
      if (lang === core.currentLanguage) return;
      core.currentLanguage = lang;
      viewer.applyLanguage?.();
      // The notice was rebuilt in the new language: keep the focus on it.
      node.querySelector(`[data-sandbox-lang="${lang}"]`)?.focus();
    });
  });
  node.querySelector('[data-sandbox-action="theme"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    viewer.toggleTheme?.();
    viewer.refreshStatusNoticeLanguage?.();
    node.querySelector('[data-sandbox-action="theme"]')?.focus();
  });

  const input = node.querySelector(".sandbox-formats-search input");
  if (input) {
    input.addEventListener("input", () => {
      searchQuery = input.value;
      applySearch(node);
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape" && input.value) {
        input.value = "";
        searchQuery = "";
        applySearch(node);
      }
    });
  }
  applySearch(node);
}
