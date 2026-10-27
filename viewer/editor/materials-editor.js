import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { fitPanelToViewer, getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { MATERIAL_GROUPS, MATERIAL_PRESETS, getMaterialPreset, materialPresetSwatch, resolveMaterialPreset, suggestMaterialPreset } from "./material-presets.js";

// The materials window (Look > Materials): the model's materials listed with
// their colour, picked from the list or by a click on the model (also from
// the context menu), a built-in material type applied in one click
// (material-presets.js: glass, wood, plaster, metals, ...) and the main
// properties set by hand.
//
// A material whose name says what it is ("Glass_01", "szkło", "Holz") gets
// that type suggested, and "Apply the suggested types" gives every such
// material its type at once.
//
// The model's own materials are never changed: the first edit puts an
// editable copy on the meshes in their place (a MeshPhysicalMaterial for
// the physically based properties, which keeps the textures), and
// "Reset" puts the original back. The shading modes (shading.js) start from
// the copy too, since it takes the original's place in their snapshot.
//
// The edits are saved with the model's settings (File > Save settings,
// metadata-persistence.js) and in the AIM3D manifest (AIM3DViewer.materials)
// as `materials`: per material its place in the
// model and name, the type and the properties; applied again when the
// settings are loaded (viewer-utils.js setupObject).

const PROPERTY_FIELDS = [
  { key: "color", type: "color" },
  { key: "roughness", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "metalness", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "opacity", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "transmission", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "clearcoat", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "emissive", type: "color" },
  { key: "emissiveIntensity", type: "range", min: 0, max: 5, step: 0.05 },
  { key: "doubleSided", type: "toggle" },
];
// Saved per edited material, where the material has them.
const SAVED_NUMBERS = ["roughness", "metalness", "opacity", "transmission", "thickness", "ior", "clearcoat", "clearcoatRoughness", "sheen", "emissiveIntensity"];
// What the editable copy takes over from a material that is not physically
// based (Phong, Lambert, Basic, ...).
const COPIED_PROPERTIES = [
  "map", "alphaMap", "aoMap", "aoMapIntensity", "lightMap", "lightMapIntensity", "emissiveMap", "emissiveIntensity",
  "normalMap", "normalMapType", "bumpMap", "bumpScale", "displacementMap", "displacementScale", "displacementBias",
  "flatShading", "wireframe", "fog",
];
const FLASH_MS = 520;
// Longer lists get a field to find a material by name.
const FILTER_FROM = 8;
const FLASH_COLOR = new THREE.Color(0xe9b264);

function sameColorHex(color) {
  return color?.isColor ? `#${color.getHexString()}` : null;
}

// The physically based copy of `source` that the editor changes.
export function toPhysicalMaterial(source) {
  if (source.isMeshPhysicalMaterial) return source.clone();
  const target = new THREE.MeshPhysicalMaterial();
  if (source.isMeshStandardMaterial) {
    THREE.MeshStandardMaterial.prototype.copy.call(target, source);
    // The standard material's copy() leaves only its own define.
    target.defines = { STANDARD: "", PHYSICAL: "" };
    return target;
  }
  THREE.Material.prototype.copy.call(target, source);
  COPIED_PROPERTIES.forEach((key) => {
    if (source[key] !== undefined) target[key] = source[key];
  });
  if (source.color?.isColor) target.color.copy(source.color);
  if (source.emissive?.isColor) target.emissive.copy(source.emissive);
  if (source.normalScale?.isVector2) target.normalScale.copy(source.normalScale);
  // Phong's shininess as a roughness (Blinn-Phong exponent to GGX).
  target.roughness = Number.isFinite(source.shininess) ? Math.min(1, Math.sqrt(2 / (source.shininess + 2))) : 1;
  target.metalness = 0;
  return target;
}

function hasTexture(material) {
  return Boolean(material?.map || material?.vertexColors);
}

function materialsOf(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

export function attachMaterialsEditor(Viewer) {
  Object.assign(Viewer, {
    materialsEditor: {
      // The model whose materials are listed.
      root: null,
      // { id, index, name, label, original, current, meshes: Set, preset,
      // keepTexture }; current is the original until the first edit.
      items: [],
      selectedId: null,
      // Text the list is narrowed to (shown for long lists).
      filter: "",
      picking: false,
      group: MATERIAL_GROUPS[0],
      keepTexture: true,
      flash: null,
    },
    materialsPanel: null,

    // ---- the materials --------------------------------------------------------

    initializeMaterialsEditor(object) {
      if (!object) return;
      Viewer.disposeMaterialsEditor({ keepPanel: true });
      const state = Viewer.materialsEditor;
      const byMaterial = new Map();
      const register = (mesh) => {
        // Not the Level of Certainty colour overlays, the weather or splats.
        if (!mesh.isMesh || !mesh.material || mesh.userData?.isCertaintyOverlay || mesh.userData?.isWeather || mesh.userData?.isGaussianSplats) return;
        const base = mesh.userData.__shadingBaseMaterials || materialsOf(mesh);
        base.forEach((material) => {
          if (!material?.isMaterial) return;
          let item = byMaterial.get(material);
          if (!item) {
            const index = byMaterial.size;
            const name = String(material.name || "").trim();
            item = {
              id: material.uuid,
              index,
              name,
              label: name || t("materials.unnamed", { number: index + 1 }, "Material {number}"),
              original: material,
              current: material,
              meshes: new Set(),
              preset: null,
              keepTexture: true,
            };
            byMaterial.set(material, item);
          }
          item.meshes.add(mesh);
        });
      };
      // A streamed (tiled) model's meshes come and go with the level of detail.
      if (!object.userData?.isTiledModel) object.traverse(register);
      state.root = object;
      state.items = [...byMaterial.values()];
      state.selectedId = state.items[0]?.id ?? null;
      Viewer.syncMaterialsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    hasEditableMaterials() {
      return Viewer.materialsEditor.items.length > 0;
    },

    getMaterialItem(id = Viewer.materialsEditor.selectedId) {
      return Viewer.materialsEditor.items.find((item) => item.id === id) || null;
    },

    getEditedMaterialCount() {
      return Viewer.materialsEditor.items.filter((item) => item.current !== item.original).length;
    },

    // Puts `next` where `previous` is, on the meshes and in the shading
    // modes' snapshot of the originals.
    swapMaterialOnMeshes(item, previous, next) {
      item.meshes.forEach((mesh) => {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material, slot) => {
            if (material === previous) mesh.material[slot] = next;
          });
        } else if (mesh.material === previous) {
          mesh.material = next;
        }
        const base = mesh.userData.__shadingBaseMaterials;
        base?.forEach((material, slot) => {
          if (material === previous) base[slot] = next;
        });
      });
      // The comparison's materials were made from the previous one.
      Viewer.clearCompareShadingMaterials?.();
    },

    // The material the edits go to: the editable copy, made on the first
    // edit; physically based (`pbr`) for the properties only it has.
    ensureEditableMaterial(item, { pbr = false } = {}) {
      Viewer.endMaterialFlash();
      const current = item.current;
      let next = null;
      if (current === item.original) {
        next = pbr || current.isMeshStandardMaterial ? toPhysicalMaterial(current) : current.clone();
      } else if (pbr && !current.isMeshPhysicalMaterial) {
        next = toPhysicalMaterial(current);
      }
      if (!next) return current;
      next.name = item.original.name;
      next.wireframe = core.wireframeMode || false;
      next.needsUpdate = true;
      Viewer.swapMaterialOnMeshes(item, current, next);
      if (current !== item.original) current.dispose();
      item.current = next;
      return next;
    },

    readMaterialValue(material, key) {
      switch (key) {
        case "color": return sameColorHex(material.color) || "#ffffff";
        case "emissive": return sameColorHex(material.emissive) || "#000000";
        case "doubleSided": return material.side === THREE.DoubleSide;
        case "roughness":
          if (Number.isFinite(material.roughness)) return material.roughness;
          return Number.isFinite(material.shininess) ? Math.min(1, Math.sqrt(2 / (material.shininess + 2))) : 1;
        case "emissiveIntensity": return Number.isFinite(material.emissiveIntensity) ? material.emissiveIntensity : (material.emissive ? 1 : 0);
        default: return Number.isFinite(material[key]) ? material[key] : 0;
      }
    },

    // One property of the material `id` (the selected one by default).
    setMaterialProperty(key, value, id = Viewer.materialsEditor.selectedId) {
      const item = Viewer.getMaterialItem(id);
      if (!item || (!PROPERTY_FIELDS.some((field) => field.key === key) && !SAVED_NUMBERS.includes(key))) return false;
      const property = key === "doubleSided" ? "side" : key;
      const material = Viewer.ensureEditableMaterial(item, { pbr: !(property in item.current) });
      switch (key) {
        case "color":
        case "emissive":
          material[key].set(value);
          break;
        case "doubleSided":
          material.side = value ? THREE.DoubleSide : (item.original.side === THREE.DoubleSide ? THREE.FrontSide : item.original.side);
          material.needsUpdate = true;
          break;
        case "opacity": {
          const opacity = Math.min(1, Math.max(0, Number(value)));
          const transparent = opacity < 1 || item.original.transparent === true;
          if (material.transparent !== transparent) material.needsUpdate = true;
          material.opacity = opacity;
          material.transparent = transparent;
          break;
        }
        default: {
          const number = Number(value);
          if (Number.isFinite(number)) material[key] = number;
        }
      }
      Viewer.syncMaterialsPanelFields();
      Viewer.syncMaterialsList();
      return true;
    },

    // A built-in material type (material-presets.js) on the material `id`.
    // `keepTexture`: the colour texture (and vertex colours) and the tint
    // stay; else the type's own colour, untextured.
    applyMaterialPreset(key, { id = Viewer.materialsEditor.selectedId, keepTexture = Viewer.materialsEditor.keepTexture } = {}) {
      const item = Viewer.getMaterialItem(id);
      const params = resolveMaterialPreset(key);
      if (!item || !params) return false;
      const material = Viewer.ensureEditableMaterial(item, { pbr: true });
      const keep = keepTexture && hasTexture(item.original);
      if (keep) {
        material.map = item.original.map || null;
        material.vertexColors = item.original.vertexColors === true;
        if (item.original.color?.isColor) material.color.copy(item.original.color);
      } else {
        material.map = null;
        material.vertexColors = false;
        material.emissiveMap = null;
        material.color.set(params.color);
      }
      // The type's own roughness and metalness, not the texture's.
      material.roughnessMap = null;
      material.metalnessMap = null;
      material.roughness = params.roughness;
      material.metalness = params.metalness;
      material.transmission = params.transmission;
      material.thickness = params.thickness;
      material.ior = params.ior;
      material.clearcoat = params.clearcoat;
      material.clearcoatRoughness = params.clearcoatRoughness;
      material.sheen = params.sheen;
      material.sheenColor.set(params.sheen > 0 ? "#ffffff" : "#000000");
      material.sheenRoughness = 0.8;
      material.emissive.set(params.emissive);
      material.emissiveIntensity = params.emissiveIntensity;
      material.opacity = params.opacity;
      // Cut-out textures (leaves, fences) stay see-through where they were.
      material.transparent = keep && item.original.transparent === true;
      material.side = params.side === "double" ? THREE.DoubleSide : item.original.side;
      material.needsUpdate = true;
      item.preset = key;
      item.keepTexture = keep;
      Viewer.syncMaterialsPanelFields();
      Viewer.syncMaterialsList();
      return true;
    },

    // The material `id` as loaded.
    resetMaterial(id = Viewer.materialsEditor.selectedId) {
      const item = Viewer.getMaterialItem(id);
      if (!item || item.current === item.original) return false;
      Viewer.endMaterialFlash();
      const edited = item.current;
      // What may have changed meanwhile on the meshes' materials.
      item.original.wireframe = core.wireframeMode || false;
      item.original.clippingPlanes = edited.clippingPlanes;
      item.original.needsUpdate = true;
      Viewer.swapMaterialOnMeshes(item, edited, item.original);
      edited.dispose();
      item.current = item.original;
      item.preset = null;
      item.keepTexture = true;
      Viewer.syncMaterialsPanelFields();
      Viewer.syncMaterialsList();
      return true;
    },

    // The type the material's name suggests, while it is as loaded.
    getSuggestedMaterialPreset(item) {
      return item && item.current === item.original ? suggestMaterialPreset(item.name) : null;
    },

    getMaterialsWithSuggestions() {
      return Viewer.materialsEditor.items.filter((item) => Viewer.getSuggestedMaterialPreset(item));
    },

    // Every material as loaded whose name suggests a type gets it.
    applySuggestedMaterialTypes() {
      const items = Viewer.getMaterialsWithSuggestions();
      items.forEach((item) => Viewer.applyMaterialPreset(Viewer.getSuggestedMaterialPreset(item), { id: item.id }));
      return items.length;
    },

    resetAllMaterials() {
      let count = 0;
      Viewer.materialsEditor.items.forEach((item) => {
        if (Viewer.resetMaterial(item.id)) count += 1;
      });
      return count;
    },

    // The edits, for the saved settings: [{ index, name, preset,
    // keepTexture, params }] of the materials changed.
    getMaterialOverridesForPersistence() {
      Viewer.endMaterialFlash();
      return Viewer.materialsEditor.items
        .filter((item) => item.current !== item.original)
        .map((item) => {
          const material = item.current;
          const params = {};
          if (material.color?.isColor) params.color = sameColorHex(material.color);
          if (material.emissive?.isColor) params.emissive = sameColorHex(material.emissive);
          SAVED_NUMBERS.forEach((key) => {
            if (Number.isFinite(material[key])) params[key] = Math.round(material[key] * 1000) / 1000;
          });
          params.doubleSided = material.side === THREE.DoubleSide;
          return { index: item.index, name: item.name, preset: item.preset, keepTexture: item.keepTexture, params };
        });
    },

    // AIM3DViewer.materials: the edits, as saved with the settings; none
    // while nothing is edited.
    getMaterialsForExport() {
      const edits = Viewer.getMaterialOverridesForPersistence();
      return edits.length ? edits : undefined;
    },

    // A manifest's materials over the model's own (absent: as loaded).
    apply3IFManifestMaterials(materials) {
      Viewer.resetAllMaterials();
      return Viewer.applySavedMaterials(materials) > 0;
    },

    // Saved edits (getMaterialOverridesForPersistence) on the materials
    // listed now: matched by place and name, else by a name only one
    // material has. Returns how many were applied.
    applySavedMaterials(entries) {
      if (!Array.isArray(entries) || !entries.length) return 0;
      const items = Viewer.materialsEditor.items;
      let applied = 0;
      entries.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const name = String(entry.name || "");
        let item = items.find((candidate) => candidate.index === entry.index && candidate.name === name);
        if (!item && name) {
          const named = items.filter((candidate) => candidate.name === name);
          if (named.length === 1) [item] = named;
        }
        if (!item) return;
        Viewer.resetMaterial(item.id);
        if (entry.preset && getMaterialPreset(entry.preset)) {
          Viewer.applyMaterialPreset(entry.preset, { id: item.id, keepTexture: entry.keepTexture !== false });
        }
        const params = entry.params && typeof entry.params === "object" ? entry.params : {};
        Object.entries(params).forEach(([key, value]) => {
          if (key === "color" || key === "emissive") {
            if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) Viewer.setMaterialProperty(key, value, item.id);
          } else if (key === "doubleSided") {
            if (typeof value === "boolean" && value !== (item.current.side === THREE.DoubleSide)) Viewer.setMaterialProperty(key, value, item.id);
          } else if (SAVED_NUMBERS.includes(key) && Number.isFinite(value)) {
            if (Viewer.readMaterialValue(item.current, key) !== value) Viewer.setMaterialProperty(key, value, item.id);
          }
        });
        applied += 1;
      });
      return applied;
    },

    // ---- picking and showing --------------------------------------------------

    // The listed material of a raycast hit (picking.js), or null.
    getMaterialItemForHit(hit) {
      const mesh = hit?.object;
      if (!mesh?.isMesh) return null;
      const list = mesh.userData.__shadingBaseMaterials || materialsOf(mesh);
      const slot = Array.isArray(mesh.material) ? hit.face?.materialIndex ?? 0 : 0;
      const material = list[slot] ?? list[0];
      const items = Viewer.materialsEditor.items;
      return items.find((item) => item.current === material || item.original === material)
        || items.find((item) => item.meshes.has(mesh))
        || null;
    },

    isMaterialPicking() {
      return Viewer.materialsEditor.picking === true;
    },

    setMaterialPicking(picking) {
      Viewer.materialsEditor.picking = picking === true && Viewer.hasEditableMaterials();
      core.container?.classList.toggle("is-picking-material", Viewer.materialsEditor.picking);
      Viewer.syncMaterialsPanel();
    },

    // A click on the model while picking (picking.js onPointerUp).
    pickMaterialFromHit(hit) {
      const item = Viewer.getMaterialItemForHit(hit);
      Viewer.setMaterialPicking(false);
      if (item) Viewer.selectMaterial(item.id, { flash: true });
      return Boolean(item);
    },

    selectMaterial(id, { flash = false } = {}) {
      const item = Viewer.getMaterialItem(id);
      if (!item) return false;
      Viewer.materialsEditor.selectedId = item.id;
      Viewer.syncMaterialsPanel();
      if (flash) Viewer.flashMaterial(item);
      Viewer.materialsPanel?.list.querySelector(".is-selected")?.scrollIntoView?.({ block: "nearest" });
      return true;
    },

    // The material's meshes light up for a moment, to show where it is.
    flashMaterial(item) {
      Viewer.endMaterialFlash();
      const material = item.current;
      if (!material?.emissive?.isColor || Viewer.shadingMode && Viewer.shadingMode !== "original") return;
      const flash = {
        material,
        emissive: material.emissive.clone(),
        intensity: material.emissiveIntensity,
        timer: setTimeout(() => Viewer.endMaterialFlash(), FLASH_MS),
      };
      material.emissive.copy(FLASH_COLOR);
      material.emissiveIntensity = Math.max(0.6, material.emissiveIntensity || 0);
      Viewer.materialsEditor.flash = flash;
    },

    endMaterialFlash() {
      const flash = Viewer.materialsEditor.flash;
      if (!flash) return;
      clearTimeout(flash.timer);
      flash.material.emissive.copy(flash.emissive);
      flash.material.emissiveIntensity = flash.intensity;
      Viewer.materialsEditor.flash = null;
    },

    // ---- window ---------------------------------------------------------------

    isMaterialsPanelOpen() {
      return Boolean(Viewer.materialsPanel);
    },

    toggleMaterialsPanel(open = !Viewer.materialsPanel) {
      if (open) Viewer.createMaterialsPanel();
      else Viewer.removeMaterialsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // The window, on the material `id` (or the one picked before).
    openMaterialsPanel(id = null) {
      Viewer.toggleMaterialsPanel(true);
      if (id) Viewer.selectMaterial(id, { flash: true });
    },

    // The old name (toolbar, older integrations).
    openMaterialsFolder(id = null) {
      Viewer.openMaterialsPanel(id);
    },

    createMaterialsPanel() {
      if (Viewer.materialsPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const button = (className, onClick) => {
        const node = el("button", className);
        node.type = "button";
        node.addEventListener("click", onClick);
        return node;
      };
      const panel = el("section", "viewer-materials viewer-scene");
      panel.id = "viewerMaterials";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = button("viewer-scene_icon", () => Viewer.toggleMaterialsPanel(false));
      closeButton.textContent = "×";
      header.append(title, closeButton);

      // Edits stay out of sight in another shading mode.
      const shadingNote = el("div", "viewer-materials_note");
      const shadingText = el("span");
      const shadingButton = button("viewer-materials_note-button", () => Viewer.setShadingMode?.("original"));
      shadingNote.append(shadingText, shadingButton);

      const empty = el("p", "viewer-scene_intro");
      const listBar = el("div", "viewer-materials_bar");
      const count = el("span", "viewer-materials_count");
      const filter = el("input", "viewer-materials_filter");
      filter.type = "search";
      filter.addEventListener("input", () => {
        Viewer.materialsEditor.filter = filter.value;
        Viewer.syncMaterialsList();
      });
      const pickButton = button("viewer-materials_pick", () => Viewer.setMaterialPicking(!Viewer.isMaterialPicking()));
      listBar.append(count, filter, pickButton);
      const list = el("ul", "viewer-materials_list");
      list.setAttribute("role", "listbox");

      const editor = el("div", "viewer-materials_editor");
      const current = el("div", "viewer-materials_current");
      const currentSwatch = el("span", "viewer-materials_swatch viewer-materials_swatch--large");
      const currentText = el("div", "viewer-materials_current-text");
      const currentName = el("strong");
      const currentKind = el("span");
      currentText.append(currentName, currentKind);
      const resetButton = button("viewer-materials_reset", () => Viewer.resetMaterial());
      current.append(currentSwatch, currentText, resetButton);
      const suggestion = el("div", "viewer-materials_suggest");
      const suggestionText = el("span");
      const suggestionButton = button("viewer-materials_suggest-apply", () => {
        const item = Viewer.getMaterialItem();
        const key = Viewer.getSuggestedMaterialPreset(item);
        if (key) Viewer.applyMaterialPreset(key);
      });
      suggestion.append(suggestionText, suggestionButton);

      const presetsTitle = el("div", "viewer-materials_heading");
      const groups = el("div", "viewer-materials_groups");
      groups.setAttribute("role", "tablist");
      const groupButtons = {};
      MATERIAL_GROUPS.forEach((group) => {
        const groupButton = button("viewer-materials_group", () => {
          Viewer.materialsEditor.group = group;
          Viewer.syncMaterialsPresets();
        });
        groupButton.dataset.group = group;
        groupButton.setAttribute("role", "tab");
        groups.append(groupButton);
        groupButtons[group] = groupButton;
      });
      const presets = el("div", "viewer-materials_presets");
      const presetButtons = {};
      MATERIAL_PRESETS.forEach((preset) => {
        const presetButton = button("viewer-materials_preset", () => Viewer.applyMaterialPreset(preset.key));
        presetButton.dataset.preset = preset.key;
        presetButton.dataset.group = preset.group;
        const swatch = el("span", "viewer-materials_swatch");
        const style = materialPresetSwatch(preset.key);
        swatch.style.background = style.background;
        swatch.style.boxShadow = style.shadow;
        presetButton.append(swatch, el("span", "viewer-materials_preset-name"));
        presets.append(presetButton);
        presetButtons[preset.key] = presetButton;
      });
      const keepLabel = el("label", "viewer-materials_keep");
      const keepInput = el("input");
      keepInput.type = "checkbox";
      keepInput.addEventListener("change", () => {
        Viewer.materialsEditor.keepTexture = keepInput.checked;
      });
      const keepText = el("span");
      keepLabel.append(keepInput, keepText);

      const propertiesTitle = el("div", "viewer-materials_heading");
      const fields = el("div", "viewer-materials_fields");
      const fieldInputs = {};
      PROPERTY_FIELDS.forEach((field) => {
        const row = el("label", "viewer-materials_field");
        row.dataset.field = field.key;
        const name = el("span", "viewer-materials_field-name");
        const input = el("input");
        if (field.type === "range") {
          input.type = "range";
          input.min = String(field.min);
          input.max = String(field.max);
          input.step = String(field.step);
        } else if (field.type === "toggle") {
          input.type = "checkbox";
        } else {
          input.type = "color";
        }
        const value = el("span", "viewer-materials_field-value");
        input.addEventListener("input", () => {
          const next = field.type === "toggle" ? input.checked : field.type === "range" ? Number(input.value) : input.value;
          Viewer.setMaterialProperty(field.key, next);
        });
        if (field.type === "toggle") input.addEventListener("change", () => Viewer.setMaterialProperty(field.key, input.checked));
        row.append(name, input, value);
        fields.append(row);
        fieldInputs[field.key] = { row, name, input, value, field };
      });
      editor.append(current, suggestion, presetsTitle, groups, presets, keepLabel, propertiesTitle, fields);

      const footer = el("div", "viewer-scene_actions");
      const resetAllButton = button("viewer-materials_reset-all", () => Viewer.resetAllMaterials());
      const suggestAllButton = button("viewer-scene_apply viewer-materials_suggest-all", () => Viewer.applySuggestedMaterialTypes());
      footer.append(suggestAllButton, resetAllButton);
      const saveNote = el("p", "viewer-scene_status");

      panel.append(header, shadingNote, empty, listBar, list, editor, footer, saveNote);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && Viewer.isMaterialPicking()) Viewer.setMaterialPicking(false);
      });
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.material,
        label: () => t("materials.title", "Materials"),
      });
      getViewerSideStack()?.append(panel);
      fitPanelToViewer(panel);
      Viewer.materialsPanel = {
        panel, title, closeButton, shadingNote, shadingText, shadingButton, empty, count, filter, pickButton, list, editor,
        currentSwatch, currentName, currentKind, resetButton, suggestion, suggestionText, suggestionButton, suggestAllButton, presetsTitle, groupButtons, presetButtons, keepLabel,
        keepInput, keepText, propertiesTitle, fieldInputs, resetAllButton, saveNote,
      };
      Viewer.updateMaterialsPanelLabels();
    },

    removeMaterialsPanel() {
      Viewer.setMaterialPicking(false);
      Viewer.materialsPanel?.panel.remove();
      Viewer.materialsPanel = null;
    },

    updateMaterialsPanelLabels() {
      const ui = Viewer.materialsPanel;
      if (!ui) return;
      const name = t("materials.title", "Materials");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("scene.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.empty.textContent = t("materials.empty", "This model has no materials to edit (a point cloud or splats).");
      ui.shadingButton.textContent = t("materials.showOriginal", "Show the materials");
      ui.filter.placeholder = t("materials.filter", "Find…");
      ui.filter.setAttribute("aria-label", t("materials.filterLabel", "Find a material by name"));
      ui.resetButton.textContent = t("materials.reset", "Reset");
      ui.resetButton.title = t("materials.resetHint", "Back to the material as loaded");
      ui.presetsTitle.textContent = t("materials.presets", "Material type");
      MATERIAL_GROUPS.forEach((group) => {
        ui.groupButtons[group].textContent = t(`materials.group.${group}`, group);
      });
      MATERIAL_PRESETS.forEach((preset) => {
        const label = t(`materials.preset.${preset.key}`, preset.key);
        const presetButton = ui.presetButtons[preset.key];
        presetButton.querySelector(".viewer-materials_preset-name").textContent = label;
        presetButton.title = label;
      });
      ui.keepText.textContent = t("materials.keepTexture", "Keep the texture");
      ui.propertiesTitle.textContent = t("materials.properties", "Properties");
      Object.values(ui.fieldInputs).forEach(({ name: fieldName, field }) => {
        fieldName.textContent = t(`materials.field.${field.key}`, field.key);
      });
      ui.resetAllButton.textContent = t("materials.resetAll", "Reset all materials");
      ui.suggestionButton.textContent = t("materials.applySuggested", "Apply");
      ui.saveNote.textContent = t("materials.saveNote", "Kept with the model's settings: File > Save settings.");
      Viewer.syncMaterialsPanel();
    },

    syncMaterialsPanel() {
      const ui = Viewer.materialsPanel;
      if (!ui) return;
      const state = Viewer.materialsEditor;
      const has = state.items.length > 0;
      const shaded = Boolean(Viewer.shadingMode) && Viewer.shadingMode !== "original";
      ui.shadingNote.hidden = !has || !shaded;
      ui.shadingText.textContent = t("materials.shadingNote", "Another shading mode is on: edits show with the original materials.");
      ui.empty.hidden = has;
      ui.list.hidden = !has;
      ui.editor.hidden = !has || !Viewer.getMaterialItem();
      ui.resetAllButton.parentElement.hidden = !has;
      ui.pickButton.hidden = !has;
      ui.pickButton.classList.toggle("is-active", state.picking);
      ui.pickButton.setAttribute("aria-pressed", state.picking ? "true" : "false");
      ui.pickButton.textContent = state.picking
        ? t("materials.picking", "Click the model… (Esc: cancel)")
        : t("materials.pick", "Pick on the model");
      ui.count.textContent = t("materials.count", { count: state.items.length }, "{count} materials");
      ui.filter.hidden = state.items.length <= FILTER_FROM;
      Viewer.syncMaterialsList();
      Viewer.syncMaterialsPanelFields();
    },

    syncMaterialsList() {
      const ui = Viewer.materialsPanel;
      if (!ui) return;
      const state = Viewer.materialsEditor;
      const query = state.items.length > FILTER_FROM ? state.filter.trim().toLowerCase() : "";
      const shown = query ? state.items.filter((item) => item.label.toLowerCase().includes(query)) : state.items;
      ui.list.replaceChildren(...shown.map((item) => {
        const row = document.createElement("li");
        const rowButton = document.createElement("button");
        rowButton.type = "button";
        rowButton.className = "viewer-materials_item";
        rowButton.dataset.material = item.id;
        rowButton.setAttribute("role", "option");
        const selected = item.id === state.selectedId;
        rowButton.classList.toggle("is-selected", selected);
        rowButton.setAttribute("aria-selected", selected ? "true" : "false");
        const swatch = document.createElement("span");
        swatch.className = "viewer-materials_swatch";
        swatch.style.background = Viewer.readMaterialValue(item.current, "color");
        swatch.classList.toggle("is-textured", Boolean(item.current.map));
        const name = document.createElement("span");
        name.className = "viewer-materials_item-name";
        name.textContent = item.label;
        const meta = document.createElement("span");
        meta.className = "viewer-materials_item-meta";
        const preset = item.preset ? t(`materials.preset.${item.preset}`, item.preset) : "";
        meta.textContent = item.current !== item.original
          ? preset || t("materials.edited", "edited")
          : t("materials.meshes", { count: item.meshes.size }, "{count} parts");
        rowButton.classList.toggle("is-edited", item.current !== item.original);
        rowButton.append(swatch, name, meta);
        rowButton.addEventListener("click", () => Viewer.selectMaterial(item.id, { flash: true }));
        row.append(rowButton);
        return row;
      }));
      // An edit changes which materials have a suggestion left.
      const suggested = Viewer.getMaterialsWithSuggestions().length;
      ui.suggestAllButton.hidden = suggested < 2;
      ui.suggestAllButton.textContent = t("materials.applyAllSuggested", { count: suggested }, "Apply the types the names suggest ({count})");
    },

    syncMaterialsPresets() {
      const ui = Viewer.materialsPanel;
      if (!ui) return;
      const state = Viewer.materialsEditor;
      const item = Viewer.getMaterialItem();
      Object.entries(ui.groupButtons).forEach(([group, groupButton]) => {
        const active = group === state.group;
        groupButton.classList.toggle("is-active", active);
        groupButton.setAttribute("aria-selected", active ? "true" : "false");
      });
      Object.values(ui.presetButtons).forEach((presetButton) => {
        presetButton.hidden = presetButton.dataset.group !== state.group;
        presetButton.classList.toggle("is-active", Boolean(item) && presetButton.dataset.preset === item.preset);
      });
    },

    syncMaterialsPanelFields() {
      const ui = Viewer.materialsPanel;
      if (!ui) return;
      Viewer.syncMaterialsPresets();
      const item = Viewer.getMaterialItem();
      if (!item) return;
      const material = item.current;
      const edited = material !== item.original;
      ui.currentSwatch.style.background = Viewer.readMaterialValue(material, "color");
      ui.currentSwatch.classList.toggle("is-textured", Boolean(material.map));
      ui.currentName.textContent = item.label;
      const kind = item.preset
        ? t("materials.basedOn", { type: t(`materials.preset.${item.preset}`, item.preset) }, "Type: {type}")
        : edited ? t("materials.editedCopy", "Edited (the original is kept)") : t("materials.asLoaded", "As loaded");
      ui.currentKind.textContent = kind;
      ui.resetButton.hidden = !edited;
      const suggestedKey = Viewer.getSuggestedMaterialPreset(item);
      ui.suggestion.hidden = !suggestedKey;
      if (suggestedKey) {
        ui.suggestionText.textContent = t("materials.suggested", { type: t(`materials.preset.${suggestedKey}`, suggestedKey) }, "The name suggests: {type}");
      }
      ui.keepLabel.hidden = !hasTexture(item.original);
      ui.keepInput.checked = Viewer.materialsEditor.keepTexture;
      Object.values(ui.fieldInputs).forEach(({ input, value, field, row }) => {
        const current = Viewer.readMaterialValue(material, field.key);
        if (field.type === "toggle") {
          input.checked = current === true;
          value.textContent = "";
        } else if (field.type === "range") {
          input.value = String(current);
          value.textContent = Number(current).toFixed(2);
        } else {
          input.value = current;
          value.textContent = "";
        }
        // The glow's strength does nothing without a glow colour.
        row.classList.toggle("is-secondary", field.key === "emissiveIntensity" && Viewer.readMaterialValue(material, "emissive") === "#000000");
      });
    },

    // Before another model: its materials come with it.
    disposeMaterialsEditor({ keepPanel = false } = {}) {
      Viewer.endMaterialFlash();
      const state = Viewer.materialsEditor;
      // The originals put aside by edits are on no mesh any more.
      state.items.forEach((item) => {
        if (item.current !== item.original) item.original.dispose();
      });
      state.items = [];
      state.root = null;
      state.selectedId = null;
      state.filter = "";
      Viewer.setMaterialPicking(false);
      if (!keepPanel) Viewer.removeMaterialsPanel();
      else Viewer.syncMaterialsPanel();
    },
  });
}
