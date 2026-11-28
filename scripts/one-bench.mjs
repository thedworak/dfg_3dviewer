#!/usr/bin/env node
// What The One (.one4d) gains, measured: the same model delivered four
// ways, opened in the built viewer (Chromium, Playwright) over throttled
// networks - see docs/one-format-benchmarks.md.
//
//   glb        the model alone (no preview: ?preview=0)
//   glb+prev   the model and <name>.preview.glb next to it: what the
//              viewer does today (HEAD probe, preview, then full)
//   zip        the model in a deflated .zip (downloaded whole, unpacked)
//   one4d      a .one4d with the preview and the model as two levels,
//              read with Range requests, parts stored - and deflated
//
// For each: requests, bytes received, the time until something is shown
// (viewer.modelLoaded) and until the full model is (fullModelLoaded),
// from the first request for the model (the viewer's own start-up, the
// same for all, is left out).
// Plus what the files themselves offer (count, overhead, integrity).
//
//   pnpm run build:test        # once: the viewer this measures
//   node scripts/one-bench.mjs [--dist dist/test] [--runs 3]
//     [--model viewer/examples/pagoda/Pagoda-progressive.glb]
//     [--profiles fast,10m,4g,3g,slow3g] [--scenarios glb,one4d-deflate] [--json out.json]

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { zipSync } from "fflate";
import { deflateRawSync } from "node:zlib";
import { bufferSource, openOneContainer, writeOneContainer } from "../viewer/one/one-container.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith("--")) pairs.push([arg.slice(2), all[i + 1]]);
  return pairs;
}, []));
const DIST = resolve(args.dist || "dist/test");
const RUNS = Number(args.runs || 3);
const MODEL = resolve(args.model || "viewer/examples/pagoda/Pagoda-progressive.glb");
const PREVIEW = MODEL.replace(/\.glb$/i, ".preview.glb");
const PORT = Number(args.port || 4199);
const PROFILES = {
  fast: { label: "fast (50 Mb/s, 20 ms)", latency: 20, mbps: 50 },
  "10m": { label: "10 Mb/s, 40 ms", latency: 40, mbps: 10 },
  "4g": { label: "4G (9 Mb/s, 85 ms)", latency: 85, mbps: 9 },
  "3g": { label: "3G (1.6 Mb/s, 300 ms)", latency: 300, mbps: 1.6 },
  slow3g: { label: "Slow 3G (0.4 Mb/s, 400 ms)", latency: 400, mbps: 0.4 },
};
const profiles = String(args.profiles || "fast,4g,3g").split(",").filter((name) => PROFILES[name]);
const browserPath = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`${DIST}/index.html missing: build the viewer first (pnpm run build:test)`);
  process.exit(2);
}
if (!existsSync(PREVIEW)) {
  console.error(`${PREVIEW} missing: the model needs its .preview.glb`);
  process.exit(2);
}

// The four deliveries, under <dist>/examples/one-bench/.
const BENCH_DIR = join(DIST, "examples", "one-bench");
const name = basename(MODEL, ".glb");
async function prepare() {
  rmSync(BENCH_DIR, { recursive: true, force: true });
  mkdirSync(join(BENCH_DIR, "plain"), { recursive: true });
  mkdirSync(join(BENCH_DIR, "progressive"), { recursive: true });
  const full = new Uint8Array(readFileSync(MODEL));
  const preview = new Uint8Array(readFileSync(PREVIEW));
  copyFileSync(MODEL, join(BENCH_DIR, "plain", `${name}.glb`));
  copyFileSync(MODEL, join(BENCH_DIR, "progressive", `${name}.glb`));
  copyFileSync(PREVIEW, join(BENCH_DIR, "progressive", `${name}.preview.glb`));
  writeFileSync(join(BENCH_DIR, `${name}.zip`), zipSync({ [`${name}.glb`]: [full, { level: 6 }] }));
  const oneManifest = {
    format: "one",
    version: "0.1",
    title: name,
    parts: [{ id: "model", kind: "mesh", role: "primary", lods: [`mesh/${name}.preview.glb`, `mesh/${name}.glb`] }],
  };
  const parts = { [`mesh/${name}.preview.glb`]: preview, [`mesh/${name}.glb`]: full };
  const { bytes } = await writeOneContainer(oneManifest, parts);
  writeFileSync(join(BENCH_DIR, `${name}.one4d`), bytes);
  const { bytes: deflated } = await writeOneContainer(oneManifest, parts, { deflate: (data) => new Uint8Array(deflateRawSync(data, { level: 9 })) });
  writeFileSync(join(BENCH_DIR, `${name}-deflated.one4d`), deflated);
  return { full, preview, one: bytes, oneDeflated: deflated, zip: readFileSync(join(BENCH_DIR, `${name}.zip`)) };
}

const ALL_SCENARIOS = [
  { id: "glb", label: "GLB", model: `/examples/one-bench/plain/${name}.glb`, query: "&preview=0" },
  { id: "glb+prev", label: "GLB + preview.glb", model: `/examples/one-bench/progressive/${name}.glb`, query: "&preview=1" },
  { id: "zip", label: "ZIP (deflated)", model: `/examples/one-bench/${name}.zip`, query: "" },
  { id: "one4d", label: ".one4d, 2 LoD, stored", model: `/examples/one-bench/${name}.one4d`, query: "" },
  { id: "one4d-deflate", label: ".one4d, 2 LoD, deflated", model: `/examples/one-bench/${name}-deflated.one4d`, query: "" },
];
// --scenarios glb,one4d-deflate: only these (all by default).
const SCENARIOS = args.scenarios
  ? ALL_SCENARIOS.filter((scenario) => String(args.scenarios).split(",").includes(scenario.id))
  : ALL_SCENARIOS;

async function measure(browser, scenario, profile) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: profile.latency,
    downloadThroughput: (profile.mbps * 1e6) / 8,
    uploadThroughput: (profile.mbps * 1e6) / 8,
  });
  // Bytes per request: the body received so far, then the final count
  // (headers included) once it has finished.
  const received = new Map();
  let requests = 0;
  let firstRequestAt = null;
  const bytesNow = () => [...received.values()].reduce((sum, value) => sum + value, 0);
  cdp.on("Network.requestWillBeSent", ({ requestId, request }) => {
    if (request.url.includes("/examples/one-bench/")) {
      received.set(requestId, 0);
      requests += 1;
      firstRequestAt ??= Date.now();
    }
  });
  cdp.on("Network.dataReceived", ({ requestId, dataLength }) => {
    if (received.has(requestId)) received.set(requestId, received.get(requestId) + dataLength);
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    if (received.has(requestId)) received.set(requestId, encodedDataLength);
  });
  await page.addInitScript(() => { window.__E2E__ = true; });
  const timeout = 600_000;
  // The viewer's own scripts load throttled too: only "commit" is waited for.
  await page.goto(`http://127.0.0.1:${PORT}/?e2eModel=${encodeURIComponent(scenario.model)}&ui=classic${scenario.query}`, { waitUntil: "commit", timeout });
  await page.waitForFunction(() => window.viewer?.modelLoaded === true, null, { timeout, polling: 50 });
  const first = { ms: Date.now() - firstRequestAt, bytes: bytesNow(), requests };
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout, polling: 50 });
  const full = { ms: Date.now() - firstRequestAt, bytes: bytesNow(), requests };
  const errors = await page.evaluate(() => window.viewer?.errors || []);
  await context.close();
  return { first, full, errors };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const mb = (value) => `${(value / 1024 / 1024).toFixed(2)} MB`;
const sec = (value) => `${(value / 1000).toFixed(1)} s`;

// What the files offer, whatever the network.
async function fileFacts(data) {
  const one = await openOneContainer(bufferSource(data.one));
  // One byte of the model changed: the .one4d says which file is damaged.
  const damaged = new Uint8Array(data.one);
  const { offset } = await one.locate(`mesh/${name}.glb`);
  damaged[offset + 1000] ^= 0xff;
  const damagedOne = await openOneContainer(bufferSource(damaged));
  return {
    sizes: {
      glb: data.full.byteLength,
      "glb+prev": data.full.byteLength + data.preview.byteLength,
      zip: data.zip.byteLength,
      one4d: data.one.byteLength,
      "one4d-deflate": data.oneDeflated.byteLength,
    },
    overheadBytes: data.one.byteLength - data.full.byteLength - data.preview.byteLength,
    damageDetected: (await damagedOne.verify(`mesh/${name}.glb`)) === false,
    intactVerified: (await one.verify(`mesh/${name}.glb`)) === true,
  };
}

async function main() {
  const data = await prepare();
  const facts = await fileFacts(data);
  const server = spawn(process.execPath, ["scripts/serve-dist.js"], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(PORT), DIST_DIR: DIST },
    stdio: "ignore",
  });
  await new Promise((done) => setTimeout(done, 800));
  const browser = await chromium.launch({
    executablePath: browserPath,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const results = {};
  try {
    for (const profileId of profiles) {
      const profile = PROFILES[profileId];
      results[profileId] = {};
      for (const scenario of SCENARIOS) {
        const runs = [];
        for (let run = 0; run < RUNS; run += 1) {
          runs.push(await measure(browser, scenario, profile));
          process.stderr.write(".");
        }
        results[profileId][scenario.id] = {
          firstMs: median(runs.map((r) => r.first.ms)),
          fullMs: median(runs.map((r) => r.full.ms)),
          firstBytes: median(runs.map((r) => r.first.bytes)),
          fullBytes: median(runs.map((r) => r.full.bytes)),
          requests: median(runs.map((r) => r.full.requests)),
          errors: runs.flatMap((r) => r.errors),
        };
      }
    }
  } finally {
    await browser.close();
    server.kill();
    rmSync(BENCH_DIR, { recursive: true, force: true });
  }
  process.stderr.write("\n");

  const lines = [];
  lines.push(`Model: ${basename(MODEL)} (${mb(data.full.byteLength)}), preview ${mb(data.preview.byteLength)}; median of ${RUNS} run(s); times from the first request for the model.`, "");
  for (const profileId of profiles) {
    lines.push(`### ${PROFILES[profileId].label}`, "");
    lines.push("| Delivery | Requests | Shown after | Bytes until shown | Full model after | Bytes in all |");
    lines.push("|---|---:|---:|---:|---:|---:|");
    for (const scenario of SCENARIOS) {
      const r = results[profileId][scenario.id];
      lines.push(`| ${scenario.label} | ${r.requests} | ${sec(r.firstMs)} | ${mb(r.firstBytes)} | ${sec(r.fullMs)} | ${mb(r.fullBytes)} |${r.errors.length ? ` errors: ${r.errors.join("; ")}` : ""}`);
    }
    lines.push("");
  }
  lines.push("### The files", "");
  lines.push("| Delivery | Files | Size | Range reads | Checksums |");
  lines.push("|---|---:|---:|---|---|");
  lines.push(`| GLB | 1 | ${mb(facts.sizes.glb)} | whole file | none |`);
  lines.push(`| GLB + preview.glb | 2 | ${mb(facts.sizes["glb+prev"])} | whole files | none |`);
  lines.push(`| ZIP (deflated) | 1 | ${mb(facts.sizes.zip)} | no (deflated: whole) | CRC-32 |`);
  lines.push(`| .one4d, stored | 1 | ${mb(facts.sizes.one4d)} | yes, per part | CRC-32 + SHA-256 per file |`);
  lines.push(`| .one4d, deflated | 1 | ${mb(facts.sizes["one4d-deflate"])} | yes, per part | CRC-32 + SHA-256 per file |`);
  lines.push("", `.one4d overhead over its parts: ${facts.overheadBytes} bytes. One damaged byte detected by verify: ${facts.damageDetected ? "yes" : "NO"} (intact file verified: ${facts.intactVerified ? "yes" : "NO"}).`);
  const report = lines.join("\n");
  console.log(report);
  if (args.json) writeFileSync(args.json, JSON.stringify({ model: basename(MODEL), runs: RUNS, profiles: profiles.map((id) => PROFILES[id]), results, facts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
