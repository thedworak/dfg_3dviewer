import { t } from "../i18n-utils.js";
import { metaCaption, metaPart } from "./meta-icons.js";
import { manifestFeatureIcons } from "../manifesto/manifest-inspection.js";

// Icons of what a manifest contains (manifest-inspection.js features) and of
// the check of its model file (the worker's validation.json), for the model
// lists and the validation report (validation-report.js). Each icon is a
// meta-icon (meta-icons.js) whose mask is set here, coloured by its status:
// data-status="warning" / "error" (models-panel.css).

const SHAPES = {
  model: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M12 12 20 7.5M12 12 4 7.5M12 12v9"/>',
  metadata: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  rights: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.6a3.5 3.5 0 1 0 0 4.8"/>',
  annotations: '<path d="M5 4h14v11H10l-5 4z"/><path d="M9 8.5h6M9 11.5h4"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lights: '<path d="M9.5 17.5h5M10.5 20.5h3M12 3a6 6 0 0 0-3.5 10.9V15.5h7v-1.6A6 6 0 0 0 12 3z"/>',
  "raking-light": '<path d="M3 19h18M4.5 14.5l15-8M4.5 10l8-4.5"/>',
  clipping: '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M2.5 12h19"/>',
  timeline: '<path d="M3 12h18M7 8.5v7M12 6v12M17 8.5v7"/>',
  variants: '<rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="11" height="11" rx="1.5"/>',
  compare: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M12 2.5v19"/>',
  photos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.4"/>',
  location: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  weather: '<path d="M7 15.5a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17.2 8.1 3.75 3.75 0 0 1 17 15.5z"/><path d="M8 18.5l-1 2.5M12 18.5l-1 2.5M16 18.5l-1 2.5"/>',
  materials: '<circle cx="12" cy="12" r="8.5"/><path d="M5.5 9.5c3 1.5 10 1.5 13 0M5.5 14.5c3-1.5 10-1.5 13 0"/>',
  certainty: '<path d="M12 3 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  thumbnails: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  transform: '<path d="M12 3v18M3 12h18M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
  rendering: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 8h7.5M12 12h8.5M12 16h7.5"/>',
  tour: '<path d="M6 21V4h11l-2.5 4 2.5 4H6"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  manifest: '<path d="M9 4H8a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1"/>',
  "model-check": '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
};

const mask = (shape) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${shape}</svg>`,
)}")`;

// The same shapes as inline SVG in the current colour (the report's rows).
export function featureIconSvg(icon) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SHAPES[icon] || SHAPES.manifest}</svg>`;
}

export const featureLabel = (feature) => t(`validationReport.features.${feature.id}`, feature.label);

export const statusLabel = (status) => ({
  ok: t("validationReport.pass", "Pass"),
  warning: t("validationReport.review", "Needs review"),
  error: t("validationReport.fail", "Fail"),
  missing: t("validationReport.notSet", "Not set"),
  unchecked: t("validationReport.notChecked", "Not checked"),
}[status] || status);

// One icon, its tooltip "<label> (<count>): <status>".
export function statusIconPart(icon, label, status = "ok", count = 0) {
  const tooltip = `${label}${count > 1 ? ` (${count})` : ""}: ${statusLabel(status)}`;
  const part = metaPart(icon, tooltip, count > 1 ? String(count) : "");
  const glyph = part.querySelector(".meta-icon");
  glyph.style.setProperty("--meta-icon", mask(SHAPES[icon] || SHAPES.manifest));
  part.title = tooltip;
  if (count > 1) part.setAttribute("aria-label", tooltip);
  part.dataset.status = status;
  part.classList.add("feature-icon");
  return part;
}

// The model check of the worker (validation.json, or its summary in
// GET /api/jobs): one icon with the counts in its tooltip.
export function modelCheckPart(validation) {
  if (!validation?.status) return null;
  const counts = [];
  if (validation.errors) counts.push(t("validationReport.errorsCount", { count: validation.errors }, "{count} error(s)"));
  if (validation.warnings) counts.push(t("validationReport.warningsCount", { count: validation.warnings }, "{count} warning(s)"));
  const label = t("validationReport.modelCheck", "Model file check (glTF-Validator)");
  const part = statusIconPart("model-check", counts.length ? `${label} - ${counts.join(", ")}` : label, validation.status);
  part.classList.add("model-check-icon");
  return part;
}

// The caption of a manifest in a list: what it contains, then the model check.
export function featureIconsCaption(inspection, modelValidation = null) {
  const parts = manifestFeatureIcons(inspection)
    .map((feature) => statusIconPart(feature.icon, featureLabel(feature), feature.status, feature.count));
  const caption = metaCaption([...parts, modelCheckPart(modelValidation)]);
  caption.classList.add("feature-icons");
  return caption;
}
