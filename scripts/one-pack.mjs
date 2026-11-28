#!/usr/bin/env node
// The One (.one4d) container tool - see docs/one-format.md.
//
//   node scripts/one-pack.mjs pack <folder> -o model.one4d
//       The folder holds one.json (the manifest, without `files`) and the
//       files it names; every file in the folder is packed.
//   node scripts/one-pack.mjs pack --mesh lod0.glb --mesh lod1.glb \
//       [--points scan.laz] [--splats capture.spz] [--preview preview.webp] \
//       [--scene manifest.json] [--title "..."] [--timeline timeline.json] -o model.one4d
//       One.json written from the options: the --mesh files are the levels
//       of detail of one mesh part, coarsest first.
//   Parts are stored; a part whose format is not compressed already (a
//   GLB without Meshopt/Draco, JSON, LAS) is deflated when that saves 10%
//   or more - --store keeps every part stored.
//   node scripts/one-pack.mjs inspect model.one4d     what is inside, where
//   node scripts/one-pack.mjs verify model.one4d      CRC-32 and SHA-256 of every part
//   node scripts/one-pack.mjs unpack model.one4d -d folder

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
  ONE_ALIGNMENT,
  ONE_FORMAT,
  ONE_MANIFEST,
  ONE_VERSION,
  bufferSource,
  crc32,
  openOneContainer,
  partLods,
  writeOneContainer,
} from "../viewer/one/one-container.js";

function usage(message) {
  if (message) console.error(`one-pack: ${message}\n`);
  const text = readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 19).join("\n");
  console.error(text.replace(/^\/\/ ?/gm, ""));
  process.exit(message ? 2 : 0);
}

function parseArgs(argv) {
  const options = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("-")) {
      options._.push(arg);
      continue;
    }
    if (arg === "--store") {
      options.store = true;
      continue;
    }
    const key = arg.replace(/^-+/, "");
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) usage(`${arg} needs a value`);
    i += 1;
    const name = { o: "output", d: "dir" }[key] || key;
    if (["mesh", "points", "splats"].includes(name)) (options[name] ??= []).push(value);
    else options[name] = value;
  }
  return options;
}

function walk(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const readBytes = (path) => new Uint8Array(readFileSync(path));
const toPosix = (path) => path.split(sep).join("/");

function packFolder(folder) {
  const manifest = JSON.parse(readFileSync(join(folder, ONE_MANIFEST), "utf8"));
  delete manifest.files;
  const files = {};
  walk(folder).forEach((path) => {
    const name = toPosix(relative(folder, path));
    if (name !== ONE_MANIFEST && !name.split("/").some((segment) => segment.startsWith("."))) {
      files[name] = readBytes(path);
    }
  });
  return { manifest, files };
}

function packFromOptions(options) {
  const files = {};
  const add = (folder, path) => {
    const name = `${folder}/${basename(path)}`;
    if (files[name]) usage(`two files are named ${name}`);
    files[name] = readBytes(path);
    return name;
  };
  const parts = [];
  if (options.mesh?.length) {
    parts.push({ id: "model", kind: "mesh", role: "primary", lods: options.mesh.map((path) => ({ path: add("mesh", path) })) });
  }
  (options.points || []).forEach((path, index) => {
    parts.push({ id: index ? `points-${index + 1}` : "points", kind: "points", path: add("points", path) });
  });
  (options.splats || []).forEach((path, index) => {
    parts.push({ id: index ? `splats-${index + 1}` : "splats", kind: "splats", path: add("splats", path) });
  });
  if (!parts.length) usage("nothing to pack: give a folder, or --mesh / --points / --splats");
  if (!parts.some((part) => part.role === "primary")) parts[0].role = "primary";

  const manifest = {
    format: ONE_FORMAT,
    version: ONE_VERSION,
    generator: "one-pack.mjs",
    created: new Date().toISOString(),
    ...(options.title ? { title: options.title } : {}),
    units: options.units || "m",
    upAxis: options.upAxis || "Y",
    parts,
  };
  if (options.preview) manifest.preview = add("meta", options.preview);
  if (options.scene) manifest.scene = add("meta", options.scene);
  if (options.timeline) manifest.timeline = JSON.parse(readFileSync(options.timeline, "utf8"));
  if (options.certainty) manifest.certainty = JSON.parse(readFileSync(options.certainty, "utf8"));
  return { manifest, files };
}

async function pack(options) {
  if (!options.output) usage("pack needs -o <file.one4d>");
  const source = options._[1];
  const { manifest, files } = source ? packFolder(resolve(source)) : packFromOptions(options);
  manifest.format ??= ONE_FORMAT;
  manifest.version ??= ONE_VERSION;
  const deflate = options.store ? null : (data) => new Uint8Array(deflateRawSync(data, { level: 9 }));
  const { bytes, problems, manifest: written } = await writeOneContainer(manifest, files, { deflate });
  const deflated = Object.entries(written.files).filter(([, info]) => info.compression);
  deflated.forEach(([name, info]) => console.log(`  deflated ${name}: ${formatSize(info.size)} -> ${formatSize(info.length)}`));
  problems.forEach((problem) => console.warn(`${problem.level}: ${problem.message}`));
  mkdirSync(dirname(resolve(options.output)), { recursive: true });
  writeFileSync(options.output, bytes);
  console.log(`${options.output}: ${Object.keys(files).length + 1} entries, ${formatSize(bytes.byteLength)}`);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function open(path) {
  return openOneContainer(bufferSource(readBytes(path), basename(path)), { inflate: (data) => new Uint8Array(inflateRawSync(data)), directory: "read" });
}

async function inspect(path) {
  const one = await open(path);
  const { manifest } = one;
  console.log(`${basename(path)}  ${manifest.format} ${manifest.version}${manifest.title ? `  "${manifest.title}"` : ""}`);
  if (manifest.generator) console.log(`  generator: ${manifest.generator}${manifest.created ? `, ${manifest.created}` : ""}`);
  console.log(`  units: ${manifest.units || "m"}, up: ${manifest.upAxis || "Y"}`);
  if (manifest.preview) console.log(`  preview: ${manifest.preview}`);
  if (manifest.scene) console.log(`  scene manifest: ${manifest.scene}`);
  console.log("  parts:");
  manifest.parts.forEach((part) => {
    const lods = partLods(part);
    console.log(`    ${part.id} (${part.kind}${part.role ? `, ${part.role}` : ""}${part.certainty != null ? `, certainty ${part.certainty}` : ""})`);
    lods.forEach((lod, index) => {
      const size = manifest.files?.[lod.path]?.size;
      console.log(`      ${lods.length > 1 ? `LoD ${index}: ` : ""}${lod.path}${size != null ? `  ${formatSize(size)}` : ""}`);
    });
  });
  if (manifest.timeline?.stages?.length) {
    console.log(`  timeline: ${manifest.timeline.stages.map((stage) => stage.yearLabel || stage.year).join(", ")}`);
  }
  if (manifest.certainty) console.log(`  certainty scale: ${(manifest.certainty.levels || []).length} levels`);
  console.log("  entries (offset, size, aligned):");
  for (const entry of one.entries.values()) {
    const { offset, length, stored } = await one.locate(entry.name);
    const aligned = offset % ONE_ALIGNMENT === 0;
    console.log(`    ${String(offset).padStart(10)}  ${formatSize(length).padStart(9)}  ${aligned ? "yes" : "NO "}  ${stored ? "" : "(deflated) "}${entry.name}`);
  }
  one.problems.forEach((problem) => console.log(`  ${problem.level}: ${problem.message}`));
}

async function verify(path) {
  const one = await open(path);
  let failures = 0;
  for (const entry of one.entries.values()) {
    const data = await one.readFile(entry.name);
    const crcOk = crc32(data) === entry.crc32;
    const hash = entry.name === ONE_MANIFEST ? null : await one.verify(entry.name);
    const ok = crcOk && hash !== false;
    if (!ok) failures += 1;
    console.log(`${ok ? "ok  " : "FAIL"}  ${entry.name}${!crcOk ? "  (CRC-32)" : ""}${hash === false ? "  (SHA-256)" : ""}${hash === null && entry.name !== ONE_MANIFEST ? "  (no SHA-256 in one.json)" : ""}`);
  }
  Object.keys(one.manifest.files || {}).forEach((name) => {
    if (!one.has(name)) {
      failures += 1;
      console.log(`FAIL  ${name}  (in one.json, not in the container)`);
    }
  });
  if (failures) {
    console.error(`${failures} problem(s)`);
    process.exit(1);
  }
}

async function unpack(path, dir) {
  if (!dir) usage("unpack needs -d <folder>");
  const one = await open(path);
  for (const entry of one.entries.values()) {
    const target = resolve(dir, entry.name);
    if (!target.startsWith(resolve(dir) + sep)) throw new Error(`${entry.name}: outside the folder`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, await one.readFile(entry.name));
  }
  console.log(`${one.entries.size} files in ${dir}`);
}

const options = parseArgs(process.argv.slice(2));
const [command, file] = options._;
try {
  if (command === "pack") await pack(options);
  else if (command === "inspect" && file) await inspect(file);
  else if (command === "verify" && file) await verify(file);
  else if (command === "unpack" && file) await unpack(file, options.dir);
  else usage(command ? `unknown command or missing file: ${command}` : null);
} catch (error) {
  console.error(`one-pack: ${error.message}`);
  process.exit(1);
}
