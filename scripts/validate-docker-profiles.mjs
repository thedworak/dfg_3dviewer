// Validates docker/profiles/<name>.manifest.json against the AIM3D manifest
// rules the viewer itself enforces, so a broken profile fails the image build
// instead of the running container. Usage: node scripts/validate-docker-profiles.mjs [profile ...]
// (no arguments = all profiles). An argument ending in .json is validated as a
// file path instead, e.g. manifests written by scripts/export-static.py.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatAIM3DManifestValidationErrors,
  isAIM3DManifest,
  normalizeAIM3DManifest,
  validateAIM3DManifest,
} from "../viewer/manifesto/aim3dviewer-validation.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docker", "profiles");
const requested = process.argv.slice(2);
const names = requested.length
  ? requested
  : fs.readdirSync(dir).filter((f) => f.endsWith(".manifest.json")).map((f) => f.replace(".manifest.json", ""));

let failed = false;
for (const name of names) {
  const file = name.endsWith(".json") ? path.resolve(name) : path.join(dir, `${name}.manifest.json`);
  try {
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isAIM3DManifest(manifest)) throw new Error('missing "AIM3DViewer" block');
    normalizeAIM3DManifest(manifest);
    const { valid, errors } = validateAIM3DManifest(manifest, { requireCustomBlock: true });
    if (!valid) throw new Error(formatAIM3DManifestValidationErrors(errors));
    console.log(`ok   ${name}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
