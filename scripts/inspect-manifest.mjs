#!/usr/bin/env node
// Checks every attribute of AIM3D/IIIF manifests and lists what they contain
// (viewer/manifesto/manifest-inspection.js).
//
//   node scripts/inspect-manifest.mjs manifest.json [...]   issues per manifest
//   node scripts/inspect-manifest.mjs --all manifest.json   every attribute, also the fine ones
//   node scripts/inspect-manifest.mjs --json manifest.json  the full inspection as JSON
//
// Exits 1 when a manifest has errors.
import fs from "node:fs";
import { inspectAIM3DManifest, manifestFeatureIcons } from "../viewer/manifesto/manifest-inspection.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const all = args.includes("--all");
const files = args.filter((arg) => !arg.startsWith("--"));
if (!files.length) {
  console.error("usage: node scripts/inspect-manifest.mjs [--json] [--all] <manifest.json> [...]");
  process.exit(2);
}

let failed = false;
const results = files.map((file) => {
  let inspection;
  try {
    inspection = inspectAIM3DManifest(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    inspection = { status: "error", summary: { errors: 1 }, error: String(error.message || error) };
  }
  if (inspection.status === "error") failed = true;
  return { file, inspection };
});

if (json) {
  console.log(JSON.stringify(results.length === 1 ? results[0].inspection : results, null, 1));
} else {
  results.forEach(({ file, inspection }) => {
    const { summary } = inspection;
    console.log(`${file}: ${inspection.status.toUpperCase()}`);
    if (inspection.error) {
      console.log(`  ${inspection.error}`);
      return;
    }
    console.log(`  ${summary.attributes} attributes, ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info(s), ${summary.unknown} unknown`);
    const icons = manifestFeatureIcons(inspection)
      .map((feature) => `${feature.icon}${feature.count > 1 ? `×${feature.count}` : ""}${feature.status === "ok" ? "" : ` (${feature.status})`}`);
    console.log(`  contains: ${icons.join(", ") || "-"}`);
    inspection.attributes
      .filter((entry) => all || entry.issues.length)
      .forEach((entry) => {
        const issues = entry.issues.map((issue) => `${issue.level}: ${issue.message}`).join("; ");
        const value = entry.value === undefined ? "" : ` = ${JSON.stringify(entry.value)}`;
        console.log(`  ${entry.level.padEnd(7)} ${entry.path}${value}${issues ? ` - ${issues}` : ""}`);
      });
  });
}
process.exit(failed ? 1 : 0);
