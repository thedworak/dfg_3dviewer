// A collapsible, editable tree view of a manifest's JSON, shown in the
// manifest form (#form-manifesto) next to its raw-JSON textarea. The textarea
// stays the source of truth for "Load from Text": every edit made in the tree
// is written back to it as pretty-printed JSON. Object/array nodes start
// collapsed and their children are only built when first opened, so large
// manifests render instantly.

import { t } from "../i18n-utils.js";

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const URL_RE = /^(?:https?:)?\/\/|^\.{0,2}\//i;
// Keys whose value summarises an object well enough to show on its
// collapsed line (IIIF/AIM3D use these for most nodes).
const PREVIEW_KEYS = ["label", "name", "type", "id", "@id", "@type"];

function isContainer(value) {
  return value !== null && typeof value === "object";
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function previewText(value) {
  if (Array.isArray(value)) return "";
  for (const key of PREVIEW_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
    // IIIF language maps: { "en": ["Label"] }
    if (key === "label" && isContainer(candidate)) {
      const first = Object.values(candidate)[0];
      const text = Array.isArray(first) ? first[0] : first;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

function countLabel(value) {
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;
  if (Array.isArray(value)) {
    return count === 1
      ? t("manifesto.treeItem", { count }, "{count} item")
      : t("manifesto.treeItems", { count }, "{count} items");
  }
  return count === 1
    ? t("manifesto.treeKey", { count }, "{count} key")
    : t("manifesto.treeKeys", { count }, "{count} keys");
}

function createKeyElement(key) {
  const keyEl = document.createElement("span");
  keyEl.className = typeof key === "number" ? "mt-key mt-index" : "mt-key";
  keyEl.textContent = typeof key === "number" ? String(key) : `"${key}"`;
  return keyEl;
}

// Parses what the user typed back into the type the value had. Returns
// `undefined` when the text can't be read as that type.
function parseEdited(text, originalType) {
  if (originalType === "string") return text;
  if (originalType === "number") {
    const trimmed = text.trim();
    const number = Number(trimmed);
    return trimmed !== "" && Number.isFinite(number) ? number : undefined;
  }
  // null: accept any JSON literal, otherwise keep what was typed as a string.
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "null") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export class ManifestTreeEditor {
  constructor(container, { onChange } = {}) {
    this.container = container;
    this.onChange = onChange;
    this.data = undefined;
  }

  render(data) {
    this.data = data;
    this.container.replaceChildren();
    if (data === undefined) return;
    const root = document.createElement("div");
    root.className = "mt-root";
    root.appendChild(this.createNode(null, data, (next) => {
      this.data = next;
    }, { open: true }));
    this.container.appendChild(root);
  }

  // Opens (true) or closes (false) every node; opening builds the whole tree.
  setAllOpen(open) {
    const detailsList = () => this.container.querySelectorAll("details.mt-node");
    if (!open) {
      detailsList().forEach((details, index) => {
        details.open = index === 0; // keep the root's direct children visible
      });
      return;
    }
    // Children are built lazily on open, so keep opening until nothing new
    // shows up.
    let pending = [...detailsList()].filter(details => !details.open);
    while (pending.length) {
      pending.forEach(details => { details.open = true; this.ensureChildren(details); });
      pending = [...detailsList()].filter(details => !details.open);
    }
  }

  // Re-applies the current language to the counts and edit hints already
  // rendered (each node keeps the value its count describes).
  relocalize() {
    this.container.querySelectorAll(".mt-count").forEach((count) => {
      if (count._mtValue !== undefined) count.textContent = countLabel(count._mtValue);
    });
    const hint = t("manifesto.treeEditHint", "Click to edit, Enter to confirm, Esc to cancel");
    this.container.querySelectorAll(".mt-value").forEach((valueEl) => { valueEl.title = hint; });
  }

  notifyChange() {
    this.onChange?.(this.data);
  }

  ensureChildren(details) {
    if (details._mtBuilt) return;
    details._mtBuilt = true;
    details._mtBuild?.();
  }

  createNode(key, value, setValue, { open = false } = {}) {
    return isContainer(value)
      ? this.createContainerNode(key, value, { open })
      : this.createLeafNode(key, value, setValue);
  }

  createContainerNode(key, value, { open }) {
    const isArray = Array.isArray(value);
    const details = document.createElement("details");
    details.className = `mt-node mt-${isArray ? "array" : "object"}`;

    const summary = document.createElement("summary");
    if (key !== null) {
      summary.appendChild(createKeyElement(key));
      summary.append(document.createTextNode(":"));
    }
    const bracket = document.createElement("span");
    bracket.className = "mt-bracket";
    bracket.textContent = isArray ? "[ ]" : "{ }";
    summary.appendChild(bracket);

    const count = document.createElement("span");
    count.className = "mt-count";
    count.textContent = countLabel(value);
    count._mtValue = value;
    summary.appendChild(count);

    const preview = previewText(value);
    if (preview) {
      const previewEl = document.createElement("span");
      previewEl.className = "mt-preview";
      previewEl.textContent = preview;
      previewEl.title = preview;
      summary.appendChild(previewEl);
    }
    details.appendChild(summary);

    const children = document.createElement("div");
    children.className = "mt-children";
    details.appendChild(children);

    details._mtBuild = () => {
      const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value);
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "mt-empty";
        empty.textContent = isArray ? "[]" : "{}";
        children.appendChild(empty);
        return;
      }
      entries.forEach(([childKey, childValue]) => {
        const row = document.createElement("div");
        row.className = "mt-row";
        row.appendChild(this.createNode(childKey, childValue, (next) => {
          value[childKey] = next;
        }));
        children.appendChild(row);
      });
    };
    details.addEventListener("toggle", () => {
      if (details.open) this.ensureChildren(details);
    });
    if (open) {
      details.open = true;
      this.ensureChildren(details);
    }
    return details;
  }

  createLeafNode(key, value, setValue) {
    const leaf = document.createElement("div");
    leaf.className = "mt-leaf";
    if (key !== null) {
      leaf.appendChild(createKeyElement(key));
      leaf.append(document.createTextNode(":"));
    }

    const valueType = typeOf(value);
    if (valueType === "boolean") {
      leaf.appendChild(this.createBooleanEditor(value, setValue));
      return leaf;
    }

    const valueEl = document.createElement("span");
    valueEl.className = `mt-value mt-${valueType}`;
    if (valueType === "string" && URL_RE.test(value)) valueEl.classList.add("mt-url");
    valueEl.textContent = valueType === "null" ? "null" : String(value);
    valueEl.contentEditable = "true";
    valueEl.spellcheck = false;
    valueEl.tabIndex = 0;
    valueEl.title = t("manifesto.treeEditHint", "Click to edit, Enter to confirm, Esc to cancel");

    let current = value;
    let swatch = null;
    const commit = () => {
      const next = parseEdited(valueEl.textContent, typeOf(current));
      if (next === undefined) {
        valueEl.classList.add("mt-invalid");
        setTimeout(() => valueEl.classList.remove("mt-invalid"), 900);
        valueEl.textContent = String(current);
        return;
      }
      if (next === current) return;
      current = next;
      setValue(next);
      valueEl.className = `mt-value mt-${typeOf(next)}`;
      if (typeof next === "string" && URL_RE.test(next)) valueEl.classList.add("mt-url");
      valueEl.textContent = next === null ? "null" : isContainer(next) ? JSON.stringify(next) : String(next);
      if (swatch && typeof next === "string" && COLOR_RE.test(next)) swatch.value = expandHex(next);
      this.notifyChange();
    };

    valueEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        valueEl.blur();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        valueEl.textContent = current === null ? "null" : String(current);
        valueEl.blur();
      }
      ev.stopPropagation(); // keep viewer keyboard shortcuts out of the editor
    });
    // Paste as plain text only (contenteditable would keep markup).
    valueEl.addEventListener("paste", (ev) => {
      ev.preventDefault();
      const text = ev.clipboardData?.getData("text/plain") ?? "";
      document.execCommand("insertText", false, text.replace(/\r?\n/g, " "));
    });
    valueEl.addEventListener("blur", commit);

    if (valueType === "string" && COLOR_RE.test(value)) {
      swatch = document.createElement("input");
      swatch.type = "color";
      swatch.className = "mt-color";
      swatch.value = expandHex(value);
      swatch.addEventListener("input", () => {
        valueEl.textContent = swatch.value;
        commit();
      });
      leaf.appendChild(swatch);
    }
    leaf.appendChild(valueEl);
    return leaf;
  }

  createBooleanEditor(value, setValue) {
    const label = document.createElement("label");
    label.className = "mt-value mt-boolean";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = value;
    const text = document.createElement("span");
    text.textContent = String(value);
    checkbox.addEventListener("change", () => {
      text.textContent = String(checkbox.checked);
      setValue(checkbox.checked);
      this.notifyChange();
    });
    label.append(checkbox, text);
    return label;
  }
}

function expandHex(hex) {
  return hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase()
    : hex.toLowerCase();
}

// Wires the tree/JSON toggle of the manifest form and returns a function
// that shows a manifest in it (both views). Safe to call when the form
// isn't on the page - it then does nothing.
// The editor of the manifest form currently on the page.
let activeEditor = null;

export function relocalizeManifestTree() {
  activeEditor?.relocalize();
}

export function attachManifestTreeEditor() {
  const textarea = document.getElementById("manifesto-manifest-text");
  const treeHost = document.getElementById("manifesto-manifest-tree");
  if (!textarea || !treeHost) return () => {};

  const treeButton = document.getElementById("manifesto-view-tree");
  const jsonButton = document.getElementById("manifesto-view-json");
  const expandButton = document.getElementById("manifesto-tree-expand");
  const collapseButton = document.getElementById("manifesto-tree-collapse");

  const editor = new ManifestTreeEditor(treeHost, {
    onChange: (data) => {
      textarea.value = JSON.stringify(data, null, 2);
      textarea.style.border = "";
    },
  });

  activeEditor = editor;

  const setMode = (mode) => {
    if (mode === "tree") {
      // Pick up anything typed into the textarea since the last render.
      const text = textarea.value.trim();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (JSON.stringify(parsed) !== JSON.stringify(editor.data)) editor.render(parsed);
        } catch {
          textarea.style.border = "2px solid red";
          return;
        }
      } else {
        editor.render(undefined);
      }
    }
    const tree = mode === "tree";
    treeHost.hidden = !tree;
    textarea.hidden = tree;
    expandButton.hidden = !tree;
    collapseButton.hidden = !tree;
    treeButton.classList.toggle("active", tree);
    jsonButton.classList.toggle("active", !tree);
    treeButton.setAttribute("aria-pressed", String(tree));
    jsonButton.setAttribute("aria-pressed", String(!tree));
  };

  treeButton?.addEventListener("click", () => setMode("tree"));
  jsonButton?.addEventListener("click", () => setMode("json"));
  expandButton?.addEventListener("click", () => editor.setAllOpen(true));
  collapseButton?.addEventListener("click", () => editor.setAllOpen(false));
  // Keep viewer keyboard shortcuts from firing while typing JSON.
  textarea.addEventListener("keydown", ev => ev.stopPropagation());

  setMode("json");

  return (manifestJson) => {
    const text = JSON.stringify(manifestJson, null, 2);
    if (text === textarea.value && editor.data !== undefined) return;
    textarea.value = text;
    textarea.style.border = "";
    editor.render(JSON.parse(text));
    setMode("tree");
  };
}
