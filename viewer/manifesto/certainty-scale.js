// Level of Certainty (LoC) of a reconstruction: the scale a manifest defines
// (AIM3DViewer.certainty) and the assessments its annotations carry
// (annotation.AIM3DViewer.certainty). No three.js here: the manifest
// validation (aim3dviewer-validation.js) also runs in Node.
//
// A level is told apart by its colour, its code (a letter) and its symbol,
// so it reads without colour vision too. A level's `value` is its lower bound
// on the scale: an assessment belongs to the highest level not above it.

export const CERTAINTY_SCOPES = ["object", "group"];

// Opacity of the colour overlays in the view: the model shows through.
export const DEFAULT_CERTAINTY_OPACITY = 0.4;

export const DEFAULT_CERTAINTY_SCALE = Object.freeze({
  min: 0,
  max: 10,
  unassessedColor: "#9ca3af",
  opacity: DEFAULT_CERTAINTY_OPACITY,
  levels: [
    {
      value: 10, code: "A", symbol: "✓", color: "#1a9850",
      label: { en: ["Preserved / surveyed"], pl: ["Stan zachowany / pomiar"], de: ["Erhalten / vermessen"] },
    },
    {
      value: 8, code: "B", symbol: "■", color: "#2166ac",
      label: { en: ["Direct documentation"], pl: ["Dokumentacja bezpośrednia"], de: ["Direkte Dokumentation"] },
    },
    {
      value: 6, code: "C", symbol: "▲", color: "#ffd400",
      label: { en: ["Indirect sources"], pl: ["Źródła pośrednie"], de: ["Indirekte Quellen"] },
    },
    {
      value: 4, code: "D", symbol: "≈", color: "#f46d00",
      label: { en: ["Analogy"], pl: ["Analogia"], de: ["Analogie"] },
    },
    {
      value: 0, code: "E", symbol: "?", color: "#c51b7d",
      label: { en: ["Hypothesis"], pl: ["Hipoteza"], de: ["Hypothese"] },
    },
  ],
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

// A IIIF language map ({ "pl": ["..."] }) or a plain string, as a language map.
function normalizeLanguageMap(value) {
  if (typeof value === "string") return value.trim() ? { none: [value.trim()] } : null;
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value)
    .map(([language, texts]) => [language, (Array.isArray(texts) ? texts : [texts]).map(String).filter(Boolean)])
    .filter(([, texts]) => texts.length > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}

// The text of a language map in `language`, else English, else any.
export function certaintyText(map, language = "en") {
  if (!isPlainObject(map)) return "";
  const texts = map[language] || map.en || map.none || Object.values(map)[0];
  return Array.isArray(texts) ? texts.join(" ") : String(texts || "");
}

// The manifest's scale, levels sorted from the highest value down; the
// default scale when it has no usable levels. Invalid levels are dropped
// (the validation reports them).
export function normalizeCertaintyScale(raw) {
  const source = isPlainObject(raw) && Array.isArray(raw.levels) ? raw : DEFAULT_CERTAINTY_SCALE;
  const levels = source.levels
    .map((level) => {
      if (!isPlainObject(level)) return null;
      const value = toFiniteNumber(level.value);
      const color = String(level.color || "").trim();
      const code = String(level.code || "").trim();
      if (value === null || !HEX_COLOR.test(color) || !code) return null;
      return {
        value,
        code,
        symbol: String(level.symbol || "").trim(),
        color: color.toLowerCase(),
        label: normalizeLanguageMap(level.label) || { none: [code] },
        ...(normalizeLanguageMap(level.description) ? { description: normalizeLanguageMap(level.description) } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
  if (!levels.length) return normalizeCertaintyScale(DEFAULT_CERTAINTY_SCALE);

  const min = toFiniteNumber(source.min) ?? Math.min(...levels.map((level) => level.value));
  const max = toFiniteNumber(source.max) ?? Math.max(...levels.map((level) => level.value));
  const unassessedColor = HEX_COLOR.test(String(source.unassessedColor || ""))
    ? source.unassessedColor.toLowerCase()
    : DEFAULT_CERTAINTY_SCALE.unassessedColor;
  const opacity = toFiniteNumber(source.opacity);
  return {
    min,
    max,
    unassessedColor,
    opacity: opacity !== null && opacity >= 0 && opacity <= 1 ? opacity : DEFAULT_CERTAINTY_OPACITY,
    levels,
    ...(normalizeLanguageMap(source.label) ? { label: normalizeLanguageMap(source.label) } : {}),
    visible: source.visible === true,
  };
}

// The level an assessed value belongs to; null when below every level.
export function certaintyLevelForValue(scale, value) {
  const number = toFiniteNumber(value);
  if (number === null || !scale?.levels?.length) return null;
  return scale.levels.find((level) => number >= level.value) || null;
}

// An annotation's assessment ({ value, code?, scope, targetId? }); a code
// alone is resolved against the scale. null when it has none.
export function normalizeCertaintyAssessment(raw, scale = null) {
  if (!isPlainObject(raw)) return null;
  let value = toFiniteNumber(raw.value);
  const code = String(raw.code || "").trim();
  if (value === null && code && scale) {
    value = scale.levels.find((level) => level.code === code)?.value ?? null;
  }
  if (value === null) return null;
  const scope = CERTAINTY_SCOPES.includes(raw.scope) ? raw.scope : "object";
  const targetId = String(raw.targetId || "").trim();
  return {
    value,
    ...(code ? { code } : {}),
    scope,
    ...(targetId ? { targetId } : {}),
  };
}

// Problems of a manifest's scale, as [path, message] pairs.
export function certaintyScaleErrors(raw, path) {
  const errors = [];
  if (!isPlainObject(raw)) return [[path, "must be an object"]];
  ["min", "max"].forEach((key) => {
    if (raw[key] !== undefined && toFiniteNumber(raw[key]) === null) errors.push([`${path}.${key}`, "must be a finite number"]);
  });
  if (raw.unassessedColor !== undefined && !HEX_COLOR.test(String(raw.unassessedColor))) {
    errors.push([`${path}.unassessedColor`, "must be a #rrggbb colour"]);
  }
  if (raw.visible !== undefined && typeof raw.visible !== "boolean") errors.push([`${path}.visible`, "must be a boolean"]);
  if (raw.opacity !== undefined && (typeof raw.opacity !== "number" || !(raw.opacity >= 0 && raw.opacity <= 1))) {
    errors.push([`${path}.opacity`, "must be a number within 0..1"]);
  }
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    errors.push([`${path}.levels`, "must be a non-empty array"]);
    return errors;
  }
  const seen = { value: new Set(), code: new Set(), color: new Set() };
  raw.levels.forEach((level, index) => {
    const levelPath = `${path}.levels[${index}]`;
    if (!isPlainObject(level)) {
      errors.push([levelPath, "must be an object"]);
      return;
    }
    if (typeof level.value !== "number" || !Number.isFinite(level.value)) errors.push([`${levelPath}.value`, "must be a finite number"]);
    if (typeof level.code !== "string" || !level.code.trim()) errors.push([`${levelPath}.code`, "must be a non-empty string"]);
    if (!HEX_COLOR.test(String(level.color))) errors.push([`${levelPath}.color`, "must be a #rrggbb colour"]);
    if (level.symbol !== undefined && typeof level.symbol !== "string") errors.push([`${levelPath}.symbol`, "must be a string"]);
    if (level.label !== undefined && typeof level.label !== "string" && !isPlainObject(level.label)) {
      errors.push([`${levelPath}.label`, "must be a string or a language map"]);
    }
    // Levels must stay apart: no shared value, code or colour.
    ["value", "code", "color"].forEach((key) => {
      const token = key === "color" ? String(level[key]).toLowerCase() : level[key];
      if (level[key] === undefined) return;
      if (seen[key].has(token)) errors.push([`${levelPath}.${key}`, "must be unique among the levels"]);
      seen[key].add(token);
    });
  });
  const min = toFiniteNumber(raw.min);
  const max = toFiniteNumber(raw.max);
  if (min !== null && max !== null && min > max) errors.push([`${path}.min`, "must not exceed max"]);
  return errors;
}

// Problems of an annotation's assessment, checked against the scale.
export function certaintyAssessmentErrors(raw, path, scale) {
  if (!isPlainObject(raw)) return [[path, "must be an object"]];
  const errors = [];
  if (raw.value === undefined && raw.code === undefined) errors.push([path, "needs a value or a code"]);
  if (raw.value !== undefined) {
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value)) {
      errors.push([`${path}.value`, "must be a finite number"]);
    } else if (scale && (raw.value < scale.min || raw.value > scale.max)) {
      errors.push([`${path}.value`, `must be within ${scale.min}..${scale.max}`]);
    }
  }
  if (raw.code !== undefined && scale && !scale.levels.some((level) => level.code === raw.code)) {
    errors.push([`${path}.code`, `must be one of: ${scale.levels.map((level) => level.code).join(", ")}`]);
  }
  if (raw.scope !== undefined && !CERTAINTY_SCOPES.includes(raw.scope)) {
    errors.push([`${path}.scope`, `must be one of: ${CERTAINTY_SCOPES.join(", ")}`]);
  }
  if (raw.targetId !== undefined && typeof raw.targetId !== "string") errors.push([`${path}.targetId`, "must be a string"]);
  return errors;
}
