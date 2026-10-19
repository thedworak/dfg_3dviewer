import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { aiAvailability, aiDisclaimer, aiRequest, showAILocked } from "./ai-client.js";
import { createLockIcon } from "../ui/lock-icon.js";

// Reconstruction variants (editor/compare.js) compared and their paradata
// reviewed by the AI assistant (worker/ai.py, "variants"): a button in the
// variants panel; the answer below the variant list.
//
// Sent: the variants' labels, descriptions, sources and Level of Certainty
// (with the scale's levels), and what the viewer measured of each - size
// and height in metres, triangles, nodes it shares with other variants or
// has alone. The texts say what the researchers claim; the measurements
// let the comparison name real differences ("the roof of B is 3.2 m
// higher"). The review judges the documentation, never which variant is
// right.

const MAX_NODES = 30;

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function readText(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => readText(item, lang)).filter(Boolean).join("\n");
  if (typeof value === "object") return readText(value[lang] ?? value.en ?? value.none ?? Object.values(value)[0], lang);
  return String(value);
}

function triangles(object) {
  let count = 0;
  object.traverse((child) => {
    const geometry = child.isMesh ? child.geometry : null;
    if (!geometry) return;
    count += geometry.index ? geometry.index.count / 3 : (geometry.attributes.position?.count || 0) / 3;
  });
  return Math.round(count);
}

// What the viewer measures of each variant, in metres.
export function measureVariant(item, metersPerUnit = 1) {
  const box = new THREE.Box3();
  item.objects.forEach((object) => box.expandByObject(object));
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(metersPerUnit);
  return {
    sizeMeters: [round(size.x), round(size.y), round(size.z)],
    bottomMeters: round(box.min.y * metersPerUnit),
    topMeters: round(box.max.y * metersPerUnit),
    triangles: item.objects.reduce((total, object) => total + triangles(object), 0),
  };
}

// The request body for POST /api/ai/variants.
export function buildVariantsPayload(Viewer) {
  const state = Viewer.variantsState;
  if (!state) return null;
  const lang = core.currentLanguage || "en";
  const metersPerUnit = Viewer.resolveModelUnit?.().meters || 1;
  const owners = new Map();
  state.items.forEach((item) => item.nodes.forEach((node) => {
    if (!owners.has(node)) owners.set(node, new Set());
    owners.get(node).add(item.id);
  }));
  const scale = Viewer.certaintyScale;
  return {
    label: readText(state.label, lang) || null,
    description: readText(state.description, lang) || null,
    certaintyScale: scale ? {
      min: scale.min,
      max: scale.max,
      levels: scale.levels.map((level) => ({ value: level.value, code: level.code, label: Viewer.getCertaintyLevelLabel?.(level) || level.code })),
    } : null,
    variants: state.items.map((item) => {
      const level = item.certainty != null ? Viewer.getCertaintyLevel?.(item.certainty) : null;
      return {
        id: item.id,
        label: readText(item.label, lang) || item.id,
        description: readText(item.description, lang) || null,
        source: readText(item.source, lang) || null,
        certainty: item.certainty,
        certaintyLevel: level ? { code: level.code, label: Viewer.getCertaintyLevelLabel?.(level) || level.code } : null,
        nodes: item.nodes.slice(0, MAX_NODES),
        nodeCount: item.nodes.length,
        sharedNodes: item.nodes.filter((node) => owners.get(node)?.size > 1).length,
        exclusiveNodes: item.nodes.filter((node) => owners.get(node)?.size === 1).length,
        measurements: measureVariant(item, metersPerUnit),
      };
    }),
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function attachVariantsReview(Viewer) {
  Object.assign(Viewer, {
    // {state, answer, error}, for the variants shown.
    variantsAIReview: null,
    // "on" | "locked" | "off" (ai-client.js aiFeatureState).
    variantsAIState: "off",

    // From createVariantsPanel: the place for the button and the answer.
    attachVariantsAI(container) {
      Viewer.variantsAIContainer = container;
      Viewer.variantsAIReview = null;
      Viewer.variantsAIState = "off";
      Viewer.renderVariantsAI();
      aiAvailability("variants").then((state) => {
        if (Viewer.variantsAIContainer !== container) return;
        Viewer.variantsAIState = state;
        Viewer.renderVariantsAI();
      });
    },

    renderVariantsAI() {
      const container = Viewer.variantsAIContainer;
      if (!container) return;
      container.textContent = "";
      container.hidden = Viewer.variantsAIState === "off";
      if (Viewer.variantsAIState === "off") return;
      if (Viewer.variantsAIState === "locked") {
        const button = el("button", "ai-button ai-button-locked", t("ai.variants.describe", "Compare and review paradata (AI)"));
        button.type = "button";
        button.prepend(createLockIcon());
        button.title = t("ai.locked", "Available with the Business plan");
        button.addEventListener("click", () => showAILocked(Viewer));
        container.appendChild(button);
        return;
      }
      const review = Viewer.variantsAIReview;
      if (!review || review.state === "error") {
        const button = el("button", "ai-button", t("ai.variants.describe", "Compare and review paradata (AI)"));
        button.type = "button";
        button.title = t("ai.variants.describeHint", "");
        button.addEventListener("click", () => Viewer.reviewVariantsWithAI());
        container.appendChild(button);
        if (review?.error) container.appendChild(el("p", "ai-error", review.error));
        return;
      }
      if (review.state === "loading") {
        container.appendChild(el("p", "ai-loading", t("ai.thinking", "The AI assistant is looking at it...")));
        return;
      }
      const answer = review.answer || {};
      const section = el("section", "ai-answer");
      section.appendChild(el("h3", "", t("ai.variants.title", "Variants compared by AI")));
      if (answer.summary) section.appendChild(el("p", "", answer.summary));
      const labelOf = (id) => {
        const item = Viewer.variantsState?.items.find((variant) => variant.id === id);
        return readText(item?.label, core.currentLanguage || "en") || id;
      };
      if (answer.differences?.length) {
        section.appendChild(el("h4", "", t("ai.variants.differences", "Differences")));
        const list = el("ul", "ai-findings");
        answer.differences.forEach((difference) => {
          const item = el("li");
          item.appendChild(el("strong", "", difference.aspect || ""));
          if (difference.variants?.length) item.appendChild(el("small", "", ` (${difference.variants.map(labelOf).join(", ")})`));
          item.appendChild(el("p", "", difference.detail || ""));
          list.appendChild(item);
        });
        section.appendChild(list);
      }
      if (answer.paradata?.length) {
        section.appendChild(el("h4", "", t("ai.variants.paradata", "Paradata review")));
        const list = el("ul", "ai-findings");
        answer.paradata.forEach((entry) => {
          const item = el("li");
          item.dataset.status = entry.status;
          item.dataset.variant = entry.variant;
          const head = el("strong", "", labelOf(entry.variant));
          head.appendChild(el("span", "ai-status", ` · ${t(`ai.variants.status.${entry.status}`, entry.status)}`));
          item.appendChild(head);
          (entry.issues || []).forEach((issue) => item.appendChild(el("p", "", issue)));
          if (entry.suggestions?.length) {
            const suggestions = el("p", "ai-fix");
            suggestions.append(el("span", "", t("ai.variants.suggestions", "Suggestions: ")), document.createTextNode(entry.suggestions.join(" · ")));
            item.appendChild(suggestions);
          }
          list.appendChild(item);
        });
        section.appendChild(list);
      }
      section.appendChild(el("p", "ai-disclaimer", aiDisclaimer(answer.model)));
      container.appendChild(section);
    },

    async reviewVariantsWithAI() {
      const payload = buildVariantsPayload(Viewer);
      if (!payload) return;
      const state = Viewer.variantsState;
      Viewer.variantsAIReview = { state: "loading" };
      Viewer.renderVariantsAI();
      try {
        const answer = await aiRequest("/api/ai/variants", payload);
        if (Viewer.variantsState !== state) return;
        Viewer.variantsAIReview = { state: "done", answer };
      } catch (error) {
        if (Viewer.variantsState !== state) return;
        Viewer.variantsAIReview = { state: "error", error: error.message };
      }
      Viewer.renderVariantsAI();
    },
  });
}
