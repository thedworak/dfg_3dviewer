// The built-in material types of the materials window (materials-editor.js):
// physically based settings without textures, for models that come without
// materials or with a uniform grey - glass for the windows, wood, plaster,
// stone, metals. A type sets every property below; what it leaves out goes
// back to MATERIAL_BASE, so going from glass to wood leaves no glass behind.
//
// Colours are sRGB hex, as in the colour fields. `side: "double"` for thin
// surfaces seen from both sides (window panes, water); the others keep the
// side of the model's own material.

export const MATERIAL_BASE = Object.freeze({
  color: "#ffffff",
  roughness: 0.5,
  metalness: 0,
  opacity: 1,
  transmission: 0,
  thickness: 0,
  ior: 1.5,
  clearcoat: 0,
  clearcoatRoughness: 0,
  sheen: 0,
  emissive: "#000000",
  emissiveIntensity: 1,
});

export const MATERIAL_GROUPS = ["glass", "wood", "walls", "metal", "other"];

export const MATERIAL_PRESETS = [
  // Glass and water: transmission, refraction only where there is thickness.
  { key: "glass", group: "glass", params: { color: "#ffffff", roughness: 0.03, transmission: 1, ior: 1.5, side: "double" } },
  { key: "frostedGlass", group: "glass", params: { color: "#f3f7f9", roughness: 0.42, transmission: 1, thickness: 0.04, ior: 1.5, side: "double" } },
  { key: "tintedGlass", group: "glass", params: { color: "#8fb8bc", roughness: 0.05, transmission: 0.92, ior: 1.52, side: "double" } },
  { key: "water", group: "glass", params: { color: "#6b9fb0", roughness: 0.04, transmission: 0.85, thickness: 0.5, ior: 1.33, side: "double" } },
  // Wood.
  { key: "lightWood", group: "wood", params: { color: "#c9a26b", roughness: 0.68 } },
  { key: "darkWood", group: "wood", params: { color: "#5f4029", roughness: 0.58 } },
  { key: "varnishedWood", group: "wood", params: { color: "#93592f", roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.12 } },
  // Walls, stone and ceramics.
  { key: "plaster", group: "walls", params: { color: "#eeebe4", roughness: 0.94 } },
  { key: "paintedWall", group: "walls", params: { color: "#d8d0c0", roughness: 0.72 } },
  { key: "concrete", group: "walls", params: { color: "#9c9b96", roughness: 0.96 } },
  { key: "brick", group: "walls", params: { color: "#9a4a33", roughness: 0.9 } },
  { key: "sandstone", group: "walls", params: { color: "#c4b08a", roughness: 0.88 } },
  { key: "marble", group: "walls", params: { color: "#ece8e0", roughness: 0.22, clearcoat: 0.35, clearcoatRoughness: 0.08 } },
  { key: "terracotta", group: "walls", params: { color: "#b5643d", roughness: 0.92 } },
  { key: "ceramic", group: "walls", params: { color: "#f4f2ed", roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 } },
  // Metals.
  { key: "steel", group: "metal", params: { color: "#c8cbcf", metalness: 1, roughness: 0.2 } },
  { key: "aluminium", group: "metal", params: { color: "#d6d8da", metalness: 1, roughness: 0.42 } },
  { key: "iron", group: "metal", params: { color: "#5d5b58", metalness: 1, roughness: 0.62 } },
  { key: "brass", group: "metal", params: { color: "#c9a24c", metalness: 1, roughness: 0.28 } },
  { key: "gold", group: "metal", params: { color: "#e6bb52", metalness: 1, roughness: 0.18 } },
  { key: "copper", group: "metal", params: { color: "#c47c52", metalness: 1, roughness: 0.3 } },
  { key: "bronze", group: "metal", params: { color: "#8c6a3f", metalness: 1, roughness: 0.48 } },
  { key: "mirror", group: "metal", params: { color: "#ffffff", metalness: 1, roughness: 0 } },
  // Everything else.
  { key: "plastic", group: "other", params: { color: "#e2e2e2", roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.2 } },
  { key: "rubber", group: "other", params: { color: "#2a2a2a", roughness: 1 } },
  { key: "fabric", group: "other", params: { color: "#8a8f9c", roughness: 1, sheen: 1 } },
  { key: "clay", group: "other", params: { color: "#c9c2b6", roughness: 1 } },
  { key: "light", group: "other", params: { color: "#fff6e0", roughness: 0.6, emissive: "#fff1d0", emissiveIntensity: 2.5 } },
];

export function getMaterialPreset(key) {
  return MATERIAL_PRESETS.find((preset) => preset.key === key) || null;
}

// The preset's settings over the base: every property set.
export function resolveMaterialPreset(key) {
  const preset = getMaterialPreset(key);
  return preset ? { ...MATERIAL_BASE, ...preset.params } : null;
}

// A swatch for the preset's button (CSS background): a lit ball of its
// colour, shinier the smoother it is, see-through for glass.
export function materialPresetSwatch(key) {
  const params = resolveMaterialPreset(key);
  if (!params) return "";
  const shine = Math.round((1 - params.roughness) * 85 + 10);
  const highlight = params.metalness > 0.5 ? "rgba(255,255,255,0.95)" : `rgba(255,255,255,${(0.25 + (1 - params.roughness) * 0.6).toFixed(2)})`;
  const base = params.transmission > 0.5 ? `${params.color}88` : params.color;
  const shade = params.metalness > 0.5 ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.32)";
  const glow = params.emissiveIntensity > 0 && params.emissive !== "#000000" ? `, 0 0 10px ${params.emissive}` : "";
  return {
    background: `radial-gradient(circle at 32% 28%, ${highlight} 0, transparent ${Math.max(18, 60 - shine / 2)}%), radial-gradient(circle at 50% 50%, ${base} 45%, ${shade} 100%)`,
    shadow: `inset 0 0 0 1px rgba(255,255,255,0.12)${glow}`,
  };
}

// The type a material's name suggests ("Glass_01", "szkło okienne",
// "Holz_Eiche"), from word stems in English, Polish and German; null when
// the name says nothing (most exports: "Material.001"). The more specific
// first: frosted glass before glass, stone before wall.
const NAME_HINTS = [
  ["frostedGlass", ["frost", "milchglas", "mleczn"]],
  ["tintedGlass", ["tinted", "barwion", "getont", "smoked"]],
  ["mirror", ["mirror", "lustr", "spiegel"]],
  ["glass", ["glass", "glas", "szkl", "szyb", "window", "okno", "okien", "fenster", "pane$", "vitr", "witraz"]],
  ["water", ["water", "woda", "wody", "wasser", "pool$", "basen", "fountain", "fontann", "brunnen"]],
  ["varnishedWood", ["varnish", "lakierowan", "lackiert", "polished wood"]],
  ["darkWood", ["walnut", "orzech", "nussbaum", "mahogan", "mahon", "ebony", "heban", "wenge"]],
  ["lightWood", ["wood", "wooden", "holz", "drewn", "drzew", "oak$", "debow", "dab$", "eiche", "pine", "sosn", "kiefer", "birch", "brzoz", "birke", "timber", "plank", "parquet", "parkiet", "beam", "belk", "balken"]],
  ["marble", ["marble", "marmur", "marmor"]],
  ["sandstone", ["sandstone", "piaskowiec", "sandstein", "stone", "kamien", "stein", "granit", "limestone", "wapien", "kalkstein", "rock$", "skal"]],
  ["brick", ["brick", "cegl", "ziegel", "klinkier", "klinker"]],
  ["terracotta", ["terracott", "terakot", "rooftile", "dachowk", "dachziegel"]],
  ["ceramic", ["ceramic", "ceramik", "keramik", "porcelain", "porcelan", "porzellan", "tile", "kafel", "kafl", "fliese", "glazed"]],
  ["concrete", ["concrete", "beton", "cement", "zement"]],
  ["plaster", ["plaster", "tynk", "putz", "stucco", "stiuk", "stuck$", "wall", "sciana", "scian", "wand$", "ceiling", "sufit", "decke"]],
  ["paintedWall", ["paint", "farb", "malowan", "gestrichen"]],
  ["gold", ["gold", "zlot", "gilt", "zlocon", "vergoldet"]],
  ["brass", ["brass", "mosiadz", "messing"]],
  ["bronze", ["bronze", "braz"]],
  ["copper", ["copper", "miedz", "miedzian", "kupfer"]],
  ["aluminium", ["alumin", "alu$"]],
  ["iron", ["iron", "zelaz", "eisen", "zeliw", "rust$", "rdza", "rost$"]],
  ["steel", ["steel", "stal", "stahl", "chrome", "chrom", "inox", "metal", "metall"]],
  ["fabric", ["fabric", "cloth", "textile", "tkanin", "stoff", "curtain", "zaslon", "vorhang", "carpet", "dywan", "teppich", "cushion", "poduszk", "kissen", "velvet", "aksamit", "samt"]],
  ["rubber", ["rubber", "guma", "gumow", "gummi", "tyre$", "tire$", "opon"]],
  ["plastic", ["plastic", "plastik", "kunststoff", "pvc", "acryl", "akryl"]],
  ["clay", ["clay", "glina", "glin", "lehm"]],
  ["light", ["light$", "lamp", "bulb", "zarowk", "leucht", "emissive", "emission", "neon$", "led$"]],
];
// Short stems match whole words only ("alu", "led", "dab$", "tile").
const WHOLE_WORD_BELOW = 5;

function nameWords(name) {
  return String(name || "")
    // Camel case and digits split words: "GlassPane01" -> glass pane.
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
}

export function suggestMaterialPreset(name) {
  const words = nameWords(name);
  if (!words.length) return null;
  const joined = words.join(" ");
  for (const [key, stems] of NAME_HINTS) {
    const found = stems.some((stem) => (stem.includes(" ")
      ? joined.includes(stem)
      : words.some((word) => (stem.endsWith("$") ? word === stem.slice(0, -1) : word.startsWith(stem)))));
    if (found) return key;
  }
  return null;
}
