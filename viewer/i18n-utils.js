import { VIEWER_I18N } from "./i18n.js";
import { core } from './core.js';

const DEFAULT_LANG = "en";

export const t=function(key, varsOrFallback = {}, maybeFallback = "") {
  const lang = ["pl", "de"].includes(core.currentLanguage)
    ? core.currentLanguage
    : "en";

  const dictionary = VIEWER_I18N[lang] || VIEWER_I18N.en;

  const value = String(key || "")
    .split(".")
    .reduce(
      (acc, part) =>
        acc && typeof acc === "object" ? acc[part] : undefined,
      dictionary
    );

  let vars = {};
  let fallback = "";

  if (typeof varsOrFallback === "string") {
    fallback = varsOrFallback;
  } else {
    vars = varsOrFallback || {};
    fallback = maybeFallback;
  }

  const template = typeof value === "string" ? value : fallback || key;

  return template.replace(/\{(\w+)\}/g, (_, v) => {
    let val = vars[v];

    if (typeof val === "boolean") {
      val = t(`state.${val ? "enabled" : "disabled"}`);
    } else if (typeof val === "string") {
      if (val === "enabled" || val === "disabled") {
        val = t(`state.${val}`);
      } else if (val.startsWith("state.")) {
        val = t(val);
      }
    }

    return val ?? `{${v}}`;
  });
}
