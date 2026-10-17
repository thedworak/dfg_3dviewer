import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getIfcData, getLiveIfcModel, hasIfcProperties, IFC_PROPERTIES_EVENT, loadIfcQueryData, showIfcProperties } from "../ifc-properties.js";
import { aiDisclaimer, aiFeatureState, aiRequest, fetchAIConfig, showAILocked } from "./ai-client.js";
import { buildIfcSummary, runIfcFilter } from "./ifc-filter.js";

// Questions about a building model in plain language ("load-bearing walls
// on level 2", "total slab area"), answered from its IFC properties
// (<name>_ifc.json, scripts/ifc_metadata.py).
//
// The AI assistant (worker/ai.py, "ifc-query") only sees a summary of the
// data - the IFC classes with counts, storeys, materials, property sets
// with their properties' types and a few sample values - and turns the
// question into a filter. The filter is run here, on all the elements
// (runIfcFilter): the elements found, the counts and sums come from the
// data, not from the AI. The panel shows the filter as well, so the user
// can see how the question was understood.
//
// Converted IFC models: <name>_ifc.json, GLB node names are the GlobalIds.
// A .ifc opened directly (web-ifc): its properties are read from the model
// on the first question (loadIfcQueryData), and the elements found are drawn
// from its one merged mesh by their expressIDs (liveSubset below).

const MAX_LIST = 200;

// The triangles of a web-ifc mesh whose elements are (keep) or are not in
// `ids` (expressIDs), as a geometry sharing its attributes; `groups`: with
// the material groups of the source, renumbered.
function liveSubset(geometry, ids, keep, groups) {
  const index = geometry.index.array;
  const expressId = geometry.attributes.expressID;
  const ranges = groups && geometry.groups.length ? geometry.groups : [{ start: 0, count: index.length, materialIndex: 0 }];
  const out = [];
  const outGroups = [];
  ranges.forEach((range) => {
    const start = out.length;
    for (let i = range.start; i < range.start + range.count; i += 3) {
      if (ids.has(Math.round(expressId.getX(index[i]))) === keep) out.push(index[i], index[i + 1], index[i + 2]);
    }
    if (out.length > start) outGroups.push({ start, count: out.length - start, materialIndex: range.materialIndex });
  });
  const subset = new THREE.BufferGeometry();
  Object.entries(geometry.attributes).forEach(([name, attribute]) => subset.setAttribute(name, attribute));
  subset.setIndex(out);
  if (groups) outGroups.forEach(({ start, count, materialIndex }) => subset.addGroup(start, count, materialIndex));
  subset.boundingBox = geometry.boundingBox;
  subset.boundingSphere = geometry.boundingSphere;
  return subset;
}

function describeCondition(condition) {
  const field = condition.field === "property"
    ? [condition.pset, condition.property].filter(Boolean).join(".")
    : condition.field;
  const ops = { eq: "=", ne: "≠", contains: "∋", gt: ">", gte: "≥", lt: "<", lte: "≤", exists: "exists", missing: "missing", true: "= true", false: "= false" };
  return [field, ops[condition.op] || condition.op, condition.value ?? ""].filter((part) => part !== "").join(" ");
}

function formatNumber(value) {
  return typeof value === "number"
    ? value.toLocaleString(core.currentLanguage || undefined, { maximumFractionDigits: 2 })
    : "–";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function attachIfcQuery(Viewer) {
  Object.assign(Viewer, {
    ifcQueryPanel: null,
    // {question, state, answer, result, error}
    ifcQueryState: null,
    ifcQueryOverlays: [],
    ifcQueryHidden: [],
    ifcQueryAIConfig: null,

    // "on" | "locked" | "off" (ai-client.js aiFeatureState) for the model
    // shown: the tool is in the toolbar while the model has IFC properties
    // and the worker has the feature - with a lock in the app when the
    // plan does not include it.
    ifcQueryAIState() {
      return hasIfcProperties() ? aiFeatureState(this.ifcQueryAIConfig, "ifc-query") : "off";
    },

    isIfcQueryAvailable() {
      return this.ifcQueryAIState() === "on";
    },

    isIfcQueryOpen() {
      return Boolean(this.ifcQueryPanel && !this.ifcQueryPanel.hidden);
    },

    // The worker is asked what it offers once a model with IFC properties
    // is shown (the settings are loaded by then).
    initIfcQuery() {
      document.addEventListener(IFC_PROPERTIES_EVENT, async () => {
        this.ifcQueryData = null;
        if (!hasIfcProperties()) {
          this.closeIfcQuery({ reset: true });
        } else {
          this.resetIfcQueryView();
          this.ifcQueryState = null;
          this.renderIfcQuery();
          this.ifcQueryAIConfig = await fetchAIConfig();
        }
        this.updateEditorToolbarState?.();
      });
    },

    // After logging in or out: what the worker offers may have changed
    // (WORKER_AI_ACCESS).
    async refreshAIConfig() {
      const config = await fetchAIConfig({ refresh: true });
      this.ifcQueryAIConfig = config;
      if (!this.isIfcQueryAvailable()) this.closeIfcQuery({ reset: true });
      if (this.variantsAIContainer) this.attachVariantsAI?.(this.variantsAIContainer);
      this.updateEditorToolbarState?.();
    },

    toggleIfcQuery() {
      if (this.ifcQueryAIState() === "locked") {
        showAILocked(this);
        return;
      }
      if (this.isIfcQueryOpen()) {
        this.closeIfcQuery();
        return;
      }
      this.createIfcQueryPanel();
      if (!this.ifcQueryPanel) return;
      this.ifcQueryPanel.hidden = false;
      this.openToolbarMenu?.(null);
      this.renderIfcQuery();
      this.ifcQueryPanel.querySelector("input")?.focus();
      this.updateEditorToolbarState?.();
    },

    closeIfcQuery({ reset = false } = {}) {
      if (this.ifcQueryPanel) this.ifcQueryPanel.hidden = true;
      if (reset) {
        this.resetIfcQueryView();
        this.ifcQueryState = null;
      }
      this.updateEditorToolbarState?.();
    },

    createIfcQueryPanel() {
      if (!core.container || this.ifcQueryPanel) return;
      const panel = el("div");
      panel.id = "ifcQueryPanel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-labelledby", "ifcQueryTitle");
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span id="ifcQueryTitle"></span>
          <button type="button" data-action="close">X</button>
        </div>
        <form class="ifc-query-form">
          <input type="search" name="question" maxlength="500" autocomplete="off">
          <button type="submit" class="ai-button"></button>
        </form>
        <p class="ifc-query-hint"></p>
        <div class="ifc-query-examples"></div>
        <div class="ifc-query-body"></div>
      `;
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      core.container.appendChild(panel);
      this.ifcQueryPanel = panel;
      this.bindEventListener(panel.querySelector('[data-action="close"]'), "click", () => this.closeIfcQuery());
      this.bindEventListener(panel.querySelector("form"), "submit", (event) => {
        event.preventDefault();
        this.askIfcQuestion(panel.querySelector("input").value);
      });
      this.localizeIfcQuery();
    },

    localizeIfcQuery() {
      const panel = this.ifcQueryPanel;
      if (!panel) return;
      panel.querySelector("#ifcQueryTitle").textContent = t("ai.ifc.title", "Ask the model");
      const close = panel.querySelector('[data-action="close"]');
      close.title = t("ai.ifc.close", "Close");
      close.setAttribute("aria-label", close.title);
      const input = panel.querySelector("input");
      input.placeholder = t("ai.ifc.placeholder", "e.g. load-bearing walls on level 2");
      input.setAttribute("aria-label", t("ai.ifc.title", "Ask the model"));
      panel.querySelector('button[type="submit"]').textContent = t("ai.ifc.ask", "Ask");
      panel.querySelector(".ifc-query-hint").textContent = t("ai.ifc.hint", "");
      const examples = panel.querySelector(".ifc-query-examples");
      examples.textContent = "";
      examples.setAttribute("aria-label", t("ai.ifc.examples", "Examples"));
      ["example1", "example2", "example3"].forEach((key) => {
        const chip = el("button", "ifc-query-example", t(`ai.ifc.${key}`, key));
        chip.type = "button";
        chip.addEventListener("click", () => {
          input.value = chip.textContent;
          this.askIfcQuestion(chip.textContent);
        });
        examples.appendChild(chip);
      });
      this.renderIfcQuery();
    },

    async askIfcQuestion(question) {
      const text = String(question || "").trim();
      if (!text) return;
      // A .ifc opened directly: its properties are read now, once.
      this.ifcQueryState = { question: text, state: "loading" };
      this.renderIfcQuery();
      const data = await loadIfcQueryData().catch(() => null);
      if (this.ifcQueryState?.question !== text) return;
      this.ifcQueryData = data;
      if (!data) {
        this.ifcQueryState = { question: text, state: "error", error: t("ai.ifc.noData", "This model has no IFC properties.") };
        this.renderIfcQuery();
        return;
      }
      this.ifcQueryState = { question: text, state: "loading" };
      this.renderIfcQuery();
      try {
        const answer = await aiRequest("/api/ai/ifc-query", { question: text, schema: buildIfcSummary(data) });
        if (this.ifcQueryState?.question !== text || this.ifcQueryData !== data) return;
        const result = answer.understood === false ? { guids: [], aggregate: null } : runIfcFilter(data, answer);
        this.ifcQueryState = { question: text, state: "done", answer, result };
        this.applyIfcQueryAction(answer.understood === false ? "reset" : answer.action || "highlight");
      } catch (error) {
        if (this.ifcQueryState?.question !== text) return;
        this.ifcQueryState = { question: text, state: "error", error: error.message };
      }
      this.renderIfcQuery();
    },

    renderIfcQuery() {
      const body = this.ifcQueryPanel?.querySelector(".ifc-query-body");
      if (!body) return;
      body.textContent = "";
      const state = this.ifcQueryState;
      const form = this.ifcQueryPanel.querySelector("form");
      form.querySelectorAll("input, button").forEach((node) => {
        node.disabled = state?.state === "loading";
      });
      if (!state) return;
      if (state.state === "loading") {
        body.appendChild(el("p", "ai-loading", t("ai.thinking", "The AI assistant is looking at it...")));
        return;
      }
      if (state.state === "error") {
        body.appendChild(el("p", "ai-error", state.error));
        return;
      }
      const { answer, result } = state;
      const section = el("section", "ai-answer");
      if (answer.interpretation) section.appendChild(el("p", "ai-headline", answer.interpretation));
      if (answer.understood === false) {
        section.appendChild(el("p", "", t("ai.ifc.notUnderstood", "This cannot be answered from the model's properties.")));
      } else {
        // The filter, so the user sees what was searched for.
        const filter = el("p", "ifc-query-filter");
        filter.appendChild(el("span", "", `${t("ai.ifc.filter", "Filter")}: `));
        (answer.conditions || []).forEach((condition, index) => {
          if (index) filter.appendChild(el("span", "ifc-query-join", answer.match === "any" ? " ∨ " : " ∧ "));
          filter.appendChild(el("code", "", describeCondition(condition)));
        });
        section.appendChild(filter);
        section.appendChild(el("p", "ifc-query-count", result.guids.length
          ? t("ai.ifc.found", { count: result.guids.length }, "{count} element(s) found")
          : t("ai.ifc.noneFound", "No element matches.")));
        const aggregate = result.aggregate;
        if (aggregate && aggregate.kind !== "count") {
          const value = `${formatNumber(aggregate.value)}${aggregate.unit ? ` ${aggregate.unit}` : ""}`;
          section.appendChild(el("p", "ifc-query-aggregate", t(`ai.ifc.aggregate.${aggregate.kind}`, { property: aggregate.property, value }, "{property}: {value}")));
          if (aggregate.missing) {
            section.appendChild(el("p", "ai-disclaimer", t("ai.ifc.missingValues", { count: aggregate.missing, property: aggregate.property }, "{count} matching element(s) have no {property}.")));
          }
        }
        if (result.guids.length) section.appendChild(this.renderIfcQueryActions());
      }
      if (answer.note) section.appendChild(el("p", "ifc-query-note", answer.note));
      section.appendChild(el("p", "ai-disclaimer", aiDisclaimer(answer.model)));
      body.appendChild(section);
      if (result.guids.length) body.appendChild(this.renderIfcQueryList(result.guids));
    },

    renderIfcQueryActions() {
      const actions = el("div", "ifc-query-actions");
      [
        ["highlight", t("ai.ifc.show", "Highlight")],
        ["isolate", t("ai.ifc.isolate", "Show only these")],
        ["hide", t("ai.ifc.hide", "Hide these")],
        ["reset", t("ai.ifc.reset", "Show all")],
      ].forEach(([action, label]) => {
        const button = el("button", "", label);
        button.type = "button";
        button.dataset.action = action;
        button.classList.toggle("is-active", this.ifcQueryState?.view === action);
        button.addEventListener("click", () => {
          this.applyIfcQueryAction(action);
          this.renderIfcQuery();
        });
        actions.appendChild(button);
      });
      return actions;
    },

    renderIfcQueryList(guids) {
      const data = this.ifcQueryData;
      const details = el("details", "ifc-query-list");
      details.appendChild(el("summary", "", `${t("ai.ifc.list", "Elements")} (${guids.length})`));
      const list = el("ul");
      guids.slice(0, MAX_LIST).forEach((guid) => {
        const entry = data?.elements?.[guid] || {};
        const item = el("li");
        const button = el("button", "", entry.name || guid);
        button.type = "button";
        button.title = guid;
        button.appendChild(el("small", "", ` ${entry.type || ""}`));
        button.addEventListener("click", () => {
          // A .ifc opened directly has no node per element: the element
          // alone is highlighted instead of its properties opened.
          if (getLiveIfcModel() && !getIfcData()) {
            this.applyIfcQueryAction("highlight", [guid]);
            this.renderIfcQuery();
            return;
          }
          const node = this.findIfcNodes(new Set([guid]))[0];
          if (node) showIfcProperties(node);
        });
        item.appendChild(button);
        list.appendChild(item);
      });
      if (guids.length > MAX_LIST) list.appendChild(el("li", "ai-disclaimer", `+${guids.length - MAX_LIST}`));
      details.appendChild(list);
      return details;
    },

    // The model's roots (not the section outline's copy of it, nor helpers).
    ifcQueryRoots() {
      const roots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
      return roots.flat().filter((root) => root?.isObject3D);
    },

    // Model nodes named by these GlobalIds.
    findIfcNodes(guids) {
      const nodes = [];
      this.ifcQueryRoots().forEach((root) => root.traverse((object) => {
        if (object.name && guids.has(object.name) && !object.userData?.ifcQueryOverlay) nodes.push(object);
      }));
      return nodes;
    },

    // The meshes of the IFC model: [mesh, matched?] - a mesh belongs to its
    // nearest ancestor (or itself) named by a GlobalId of the data.
    ifcQueryMeshes(guids) {
      const elements = getIfcData()?.elements || {};
      const meshes = [];
      this.ifcQueryRoots().forEach((root) => root.traverse((object) => {
        if (!object.isMesh || object.userData?.ifcQueryOverlay || object.userData?.ifcHighlight) return;
        let element = false;
        let matched = false;
        for (let node = object; node; node = node.parent) {
          if (node.name && elements[node.name]) {
            element = true;
            if (guids.has(node.name)) {
              matched = true;
              break;
            }
          }
        }
        if (element) meshes.push([object, matched]);
      }));
      return meshes;
    },

    resetIfcQueryView() {
      this.ifcQueryOverlays.forEach((overlay) => {
        overlay.parent?.remove(overlay);
        if (overlay.userData.ownGeometry) overlay.geometry.dispose();
      });
      this.ifcQueryOverlays = [];
      // A .ifc opened directly: its whole geometry back.
      const swapped = this.ifcQueryLiveGeometry;
      if (swapped) {
        swapped.model.geometry.dispose();
        swapped.model.geometry = swapped.geometry;
        this.ifcQueryLiveGeometry = null;
      }
      this.ifcQueryMaterial?.dispose();
      this.ifcQueryMaterial = null;
      this.ifcQueryHidden.forEach((mesh) => {
        mesh.visible = true;
      });
      this.ifcQueryHidden = [];
      if (this.ifcQueryState) this.ifcQueryState.view = "reset";
    },

    // highlight | isolate | hide | reset, on the elements found (or on
    // `only`, some of them).
    applyIfcQueryAction(action, only = null) {
      this.resetIfcQueryView();
      const guids = new Set(only || this.ifcQueryState?.result?.guids || []);
      if (action === "reset" || !guids.size) return;
      const live = getLiveIfcModel();
      if (live && !getIfcData()) {
        this.applyLiveIfcQueryAction(live, action, guids);
        this.ifcQueryState.view = action;
        return;
      }
      const meshes = this.ifcQueryMeshes(guids);
      if (action === "highlight") {
        this.ifcQueryMaterial = this.createIfcQueryMaterial();
        meshes.filter(([, matched]) => matched).forEach(([mesh]) => {
          const overlay = new THREE.Mesh(mesh.geometry, this.ifcQueryMaterial);
          overlay.raycast = () => {};
          overlay.renderOrder = 998;
          overlay.userData.ifcQueryOverlay = true;
          mesh.add(overlay);
          this.ifcQueryOverlays.push(overlay);
        });
      } else {
        const hide = action === "hide" ? meshes.filter(([, matched]) => matched) : meshes.filter(([, matched]) => !matched);
        hide.forEach(([mesh]) => {
          if (mesh.visible) {
            mesh.visible = false;
            this.ifcQueryHidden.push(mesh);
          }
        });
      }
      this.ifcQueryState.view = action;
    },

    createIfcQueryMaterial() {
      return new THREE.MeshBasicMaterial({
          color: 0x7c5cff,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
      });
    },

    // A .ifc opened directly is one mesh, its elements told apart by the
    // expressID of each vertex: highlighted by an overlay of their
    // triangles; hidden or isolated by giving the mesh, until the view is
    // reset, a geometry with only the triangles that stay (its material
    // groups kept, and the same attributes, so picking still works).
    applyLiveIfcQueryAction(model, action, guids) {
      const expressIds = this.ifcQueryData?.expressIds || {};
      const ids = new Set([...guids].map((guid) => expressIds[guid]).filter((id) => id != null));
      if (!ids.size) return;
      const geometry = model.geometry;
      if (action === "highlight") {
        this.ifcQueryMaterial = this.createIfcQueryMaterial();
        const overlay = new THREE.Mesh(liveSubset(geometry, ids, true, false), this.ifcQueryMaterial);
        overlay.raycast = () => {};
        overlay.renderOrder = 998;
        overlay.userData.ifcQueryOverlay = true;
        overlay.userData.ownGeometry = true;
        model.add(overlay);
        this.ifcQueryOverlays.push(overlay);
        return;
      }
      this.ifcQueryLiveGeometry = { model, geometry };
      model.geometry = liveSubset(geometry, ids, action === "isolate", true);
    },
  });
  Viewer.initIfcQuery();
}
