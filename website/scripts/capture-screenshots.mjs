// Renders the "readings" of the Wołpa synagogue shown on the website
// (website/img/*.webp) from the viewer's example manifests.
//
// Needs a running viewer build, e.g.:
//   pnpm run build:test
//   HOST=127.0.0.1 PORT=4173 DIST_DIR=dist/test node scripts/serve-dist.js
// then, from the repository root:
//   node website/scripts/capture-screenshots.mjs [viewer URL] [names...]
// The URL defaults to http://127.0.0.1:4173; names (e.g. "wireframe
// measurement") render only those images.
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const VIEWER_URL = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");
const ONLY = new Set(process.argv.slice(3));
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "img");
// Narrower than the viewer's 45°, so the building fills the crop.
const FOV = 30;
// Crop of the canvas centre, in CSS pixels; drawn at 2x, saved 1200 wide.
const CROP_WIDTH = 760;
const OUTPUT_WIDTH = 1200;

// [file, example manifest, tweak after loading]
const SHOTS = [
  ["original", "wolpa-synagogue-aim3d-local.json"],
  ["clay-ao", "wolpa-synagogue-aim3d-local-clay-ao.json"],
  ["raking", "wolpa-synagogue-aim3d-local-raking-light.json", () => {
    // A still frame: no sweep, a fixed grazing angle.
    window.Viewer.setRakingLightSweep(false);
    window.Viewer.setRakingLightAngles({ direction: 160, height: 9 });
  }],
  ["contours", "wolpa-synagogue-aim3d-local-contours.json"],
  ["normals", "wolpa-synagogue-aim3d-local-normals.json"],
  ["certainty", "wolpa-synagogue-aim3d-local-certainty.json"],
  ["section", "wolpa-synagogue-aim3d-local.json", () => {
    // Lengthwise through the middle (Z), with the red section fill: the
    // bimah and the galleries inside.
    const viewer = window.Viewer;
    viewer.toggleClippingPlanesPanel();
    viewer.setClippingFillVisible(true);
    viewer.setClippingAxisEnabled("x", false, { silent: true });
    viewer.setClippingAxisEnabled("z", true, { silent: true });
    const range = viewer.getClippingAxisRange("z");
    viewer.setClippingAxisPosition("z", (range.min + range.max) / 2);
  }],
  ["annotations", "wolpa-synagogue-aim3d-local-certainty.json", () => {
    // Its annotations as numbered markers, not certainty badges.
    window.Viewer.setCertaintyView(false);
  }],
  ["golden-hour", "wolpa-synagogue-aim3d-local-golden-hour.json"],
  ["night", "wolpa-synagogue-aim3d-local-night-spotlights.json"],
  ["wireframe", "wolpa-synagogue-aim3d-local.json", () => {
    window.Viewer.toggleWireframeMode();
    // Scene helpers (axes, light helpers) show through the wire; the grid stays.
    window.Viewer.scene.traverse((object) => {
      if (object.type.endsWith("Helper") && !object.isGridHelper) object.visible = false;
    });
  }],
  ["measurement", "wolpa-synagogue-aim3d-local.json", () => {
    // The model's bounding box with its size along each axis, in metres:
    // the manifests give the model's unit (Scene.spatialScale, centimetres).
    window.Viewer.toggleModelDimensions();
  }],
];

// Everything drawn over the canvas.
const HIDE_UI = `#credits, .viewer-brand-logo, .viewer-notice, #statusNotice, #viewerNoticeContainer,
  #viewerEditorToolbar, #viewerActionMenu, .viewer-side-stack, #metadataContainer,
  .viewer-window-controls, .annotation-poi-tooltip { display: none !important; }`;

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  for (const [name, manifest, tweak] of SHOTS.filter(([name]) => !ONLY.size || ONLY.has(name))) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    // E2E mode: a fixed pixel ratio and no first-run hints.
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto(`${VIEWER_URL}/?e2eModel=${encodeURIComponent("/examples/box.glb")}`);
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
    await page.evaluate(async (file) => {
      const text = await (await fetch(`/manifests/${file}`)).text();
      window.viewer.fullModelLoaded = false;
      await window.Viewer.setupManifesto(text, "text");
    }, manifest);
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
    if (tweak) await page.evaluate(tweak);
    await page.evaluate((fov) => {
      const camera = window.Viewer.camera;
      if (!camera.isPerspectiveCamera) return;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }, FOV);
    await page.addStyleTag({ content: HIDE_UI });
    // Away from the canvas: no hover fade, no tooltips.
    await page.mouse.move(5, 895);
    await page.waitForTimeout(2000);

    const box = await page.locator("#MainCanvas").boundingBox();
    const png = await page.screenshot({
      clip: { x: box.x + (box.width - CROP_WIDTH) / 2, y: box.y, width: CROP_WIDTH, height: box.height },
    });
    const file = path.join(OUT_DIR, `${name}.webp`);
    const { size } = await sharp(png).resize(OUTPUT_WIDTH).webp({ quality: 70 }).toFile(file);
    console.log(`${name}.webp  ${Math.round(size / 1024)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
