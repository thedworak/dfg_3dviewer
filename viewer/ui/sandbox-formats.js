// The sandbox's "drop a model here" notice (Viewer.prepareSandboxScene in
// main.js): a button to pick a file from the device, and the formats grouped
// by kind, each with what happens to it - here, opened in the browser
// without leaving the device, and after an upload to the server (the same
// groups and steps as the "Follow your file" section of the project site).
import { core } from "../core.js";
import { t } from "../i18n-utils.js";

// Extensions per group, in the order shown. Only the ones in
// core.SUPPORTED_EXTENSIONS / SUPPORTED_ARCHIVES are listed; any supported
// extension no group names lands in "other", so a new format still shows.
const FORMAT_GROUPS = [
  { id: "gltf", extensions: ["glb", "gltf"] },
  { id: "mesh", extensions: ["obj", "ply", "stl", "fbx", "dae", "wrl", "usd", "usda", "usdc", "usdz", "3mf"] },
  { id: "kept", extensions: ["3ds", "amf", "vox", "xyz", "pcd", "kmz", "lwo"] },
  { id: "manifest", extensions: ["json"] },
  { id: "ifc", extensions: ["ifc"] },
  { id: "points", extensions: ["las", "laz"] },
  { id: "splat", extensions: ["spz", "splat", "ksplat", "sog", "rad"] },
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

const chips = (extensions) =>
  `<span class="sandbox-formats-chips">${extensions
    .map((ext) => `<span class="sandbox-formats-chip">${escapeHtml(ext.toUpperCase())}</span>`)
    .join("")}</span>`;

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
        `<summary><span class="sandbox-formats-name">${escapeHtml(name)}</span>${chips(group.extensions)}</summary>` +
        `<dl class="sandbox-formats-flow">` +
        (browser ? `<dt>${escapeHtml(tr("here", "Here, in the browser"))}</dt><dd>${escapeHtml(browser)}</dd>` : "") +
        (server ? `<dt>${escapeHtml(tr("server", "Uploaded to the server"))}</dt><dd>${escapeHtml(server)}</dd>` : "") +
        `</dl></details>`
      );
    })
    .join("");

  return (
    `<span class="sandbox-formats">` +
    `<button type="button" class="sandbox-open-file" data-sandbox-action="open-file">` +
    `<span class="open-local-file-icon" aria-hidden="true"></span>${escapeHtml(tr("openFile", "Load from disk"))}</button>` +
    `<span class="sandbox-formats-local">${escapeHtml(tr("local", "Your file stays on this device — nothing is sent to a server."))}</span>` +
    `<span class="sandbox-formats-title">${escapeHtml(tr("title", "Supported formats"))}` +
    `<span class="sandbox-formats-hint">${escapeHtml(tr("hint", "Click a group for details."))}</span></span>` +
    `<span class="sandbox-formats-groups">${groups}</span>` +
    `<span class="sandbox-formats-server-only"><strong>${escapeHtml(tr("serverOnly", "Only after an upload to the server"))}:</strong> ` +
    `${chips(SERVER_ONLY)}</span>` +
    `</span>`
  );
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
}
