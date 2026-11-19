// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { validateAIM3DManifest } from '../viewer/manifesto/aim3dviewer-validation.js';
import { inspectAIM3DManifest, manifestFeatureIcons } from '../viewer/manifesto/manifest-inspection.js';
import { retargetManifest } from '../viewer/manifesto/retarget-manifest.js';
import { AIM3D_MANIFEST_VERSION, manifestVersionStatus } from '../viewer/manifesto/manifest-version.js';
import { buildIfcSummary, runIfcFilter } from '../viewer/ai/ifc-filter.js';
import { findSceneCoordinates, findSceneYear, sceneProportions, suggestScene } from '../viewer/editor/scene-rules.js';
import { findSurroundingsKind, layoutSurroundings, normalizeSurroundings, suggestSurroundings, surroundingsGrowth, surroundingsMasonry, surroundingsPeriod, surroundingsRegion, surroundingsSliderToYear, surroundingsTerrainHeight, surroundingsWaterDistance, surroundingsWaterLevel, surroundingsYearToSlider } from '../viewer/editor/surroundings-rules.js';
import { createMapWater, dateYear, filterByYear, mapGeoJsonToAnswer, mapProjector, mapWaterQuery, minimumRectangle, readMapLayout, readMapWater, waterGeoJsonToAnswer } from '../viewer/editor/surroundings-map.js';
import { createHeightfield, decodeTerrarium, elevationZoom, metresPerPixel, worldPixel } from '../viewer/editor/surroundings-terrain.js';
import sharp from 'sharp';
import { getSemanticSettings, scoreSemantic, splitSemanticText } from '../viewer/editor/scene-semantic.js';
import { decideExposure, decideModelBase, evaluatePublishChecks, measureFraming, suggestUpAxis } from '../viewer/editor/publish-rules.js';
import { MATERIAL_BASE, MATERIAL_PRESETS, resolveMaterialPreset, suggestMaterialPreset } from '../viewer/editor/material-presets.js';
import { deviceTier, qualityForWeight } from '../viewer/editor/performance-rules.js';
import { materialFromName, schroederRT, sendGain, synthesizeImpulseResponse, traceRoom } from '../viewer/room-acoustics.js';
import { changedManifestBlocks, changedSessionLook, manifestModels, newSessionId, normalizeSessionBackground, normalizeSessionCamera, sameSessionCamera, sessionLook, SESSION_ID_PATTERN } from '../viewer/live-link-rules.js';
import { dataAlert, dataColorScale, dataNumber, dataTableToCsv, dataTruthy, diffDataRows, guessKeyColumn, normalizeDataKey, normalizeLiveData, parseDataTable } from '../viewer/live-data-table.js';

const defaultModel = '/examples/box.stl';
const supportedFormatsText = 'GLB, GLTF, OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, USD, USDA, USDC, USDZ, 3MF, AMF, WRL, KMZ, VOX, LWO, LAS, LAZ, SPZ, SPLAT, KSPLAT, SOG, RAD, LIF, NRRD, NHDR, NII, MHA, MHD, MRC, REC, CCP4, VGI, XTEKCT, DCM, DICOM, LSM, TIF, TIFF, WAV, WAVE, BWF, MP3, OGG, OGA, OPUS, FLAC, M4A, AAC, WEBA, JPG, JPEG, PNG, WEBP, AVIF, GIF, BMP';
const sandboxDropMessage = 'Drag and drop a 3D model into the viewer.';
const sandboxSupportedFormatsNotice = `<strong>Supported formats</strong>: ${supportedFormatsText}\n`;
const sandboxSupportedArchiveFormatsNotice = 'and <strong>archive formats</strong>: ZIP, RAR, TAR, XZ, GZ.';
const sandboxDropNotice = `${sandboxDropMessage} ${sandboxSupportedFormatsNotice} ${sandboxSupportedArchiveFormatsNotice}`;
const supportedExamples = [
  { format: 'dae', path: '/examples/box.dae' },
  { format: 'stl', path: '/examples/box.stl' },
  { format: 'ply', path: '/examples/box.ply' },
  { format: 'obj', path: '/examples/box.obj' },
  { format: 'xyz', path: '/examples/box.xyz' },
  { format: 'pcd', path: '/examples/box.pcd' },
  { format: '3ds', path: '/examples/box.3ds' },
  { format: 'ifc', path: '/examples/box.ifc' },
  { format: 'fbx', path: '/examples/box.fbx' },
  { format: 'glb', path: '/examples/box.glb' },
  { format: 'usdz', path: '/examples/box.usdz' },
  { format: 'usda', path: '/examples/box.usda' },
  { format: '3mf', path: '/examples/box.3mf' },
  { format: 'amf', path: '/examples/box.amf' },
  { format: 'wrl', path: '/examples/box.wrl' },
  { format: 'kmz', path: '/examples/box.kmz' },
  { format: 'vox', path: '/examples/box.vox' },
  { format: 'las', path: '/examples/points.las' },
  { format: 'laz', path: '/examples/points.laz' },
];

// The tests below were written for the classic toolbar; the menus
// (ui/menu-toolbar.js) have their own tests, which ask for `ui=menus`.
function withToolbar(query) {
  return /(^|&)ui=/.test(query) ? query : [query, 'ui=classic'].filter(Boolean).join('&');
}

async function openViewer(page, modelPath = defaultModel, query = '') {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto(`/?e2eModel=${encodeURIComponent(modelPath)}&${withToolbar(query)}`);
  await page.waitForSelector('#MainCanvas', { state: 'attached' });
}

// "Upload & convert": the file or link is checked, then the metadata form
// (ui/model-metadata.js) asks for the name (the file's, kept) and the type
// before anything is sent.
async function submitUpload(page, type = 'object') {
  await page.click('#uploadPanelSubmit');
  const form = page.locator('.model-metadata-dialog');
  await expect(form).toBeVisible();
  await form.locator('select[name="type"]').selectOption(type);
  await form.locator('button[type="submit"]').click();
  await expect(form).toHaveCount(0);
}

async function openSandboxViewer(page) {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto('/?sandbox=1&ui=classic');
  await page.waitForSelector('#MainCanvas', { state: 'attached' });
}

async function waitForModel(page, timeout = 15_000) {
  await page.waitForFunction(() => window.viewer?.modelLoaded === true, {
    timeout,
  });
}

// The camera's intro flight starts at the end of loading (after
// modelLoaded); wait for loading to finish and the camera to stand still, so
// a test's own camera changes are not overwritten by it.
async function waitForCameraIdle(page) {
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true);
  // The fly-in after loading first: on a slow runner (software WebGL) frames
  // can be far enough apart for the camera to look still mid-animation.
  await page.waitForFunction(() => !window.viewer?.isCameraAnimating?.(), null, { timeout: 15_000 });
  const pose = () => page.evaluate(() => {
    const camera = window.Viewer?.camera;
    const target = window.Viewer?.controls?.target;
    return camera && target ? [...camera.position.toArray(), ...target.toArray()] : null;
  });
  let previous = await pose();
  let stillSamples = 0;
  await expect.poll(async () => {
    await page.waitForTimeout(250);
    const current = await pose();
    stillSamples = current && JSON.stringify(current) === JSON.stringify(previous) ? stillSamples + 1 : 0;
    previous = current;
    return stillSamples >= 3;
  }, { timeout: 15_000 }).toBe(true);
}

async function waitForViewerIssue(page) {
  await page.waitForFunction(
    () =>
      (window.viewer?.errors?.length ?? 0) > 0 ||
      (window.viewer?.toasts?.length ?? 0) > 0,
    { timeout: 15_000 }
  );
}

async function openMainActionMenu(page) {
  const menuToggle = page.locator('#viewerActionMenuToggle');
  if (!(await menuToggle.isChecked())) {
    await page.click('label[for="viewerActionMenuToggle"]');
  }
  await expect(menuToggle).toBeChecked();
}

// Tests tagged @smoke run on every push to a pull request (about 2
// minutes); the whole file runs on a pull request labelled "full-tests",
// on a manual run and when a deploy finds no passing run
// (.github/workflows/playwright.yml). Locally: pnpm run test:smoke.
test('viewer runs in E2E mode', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page);

  const canvas = page.locator('#MainCanvas');
  await expect(canvas).toBeVisible();

  const hasWebGL = await canvas.evaluate((el) => {
    const gl = el.getContext('webgl2') || el.getContext('webgl');
    return !!gl;
  });

  expect(hasWebGL).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__E2E__)).toBe(true);
});

test('fullscreen includes the editor toolbar', async ({ page }) => {
  await openViewer(page);
  await expect(page.locator('#viewerEditorToolbar')).toBeVisible();

  const state = await page.evaluate(async () => {
    const container = document.querySelector<HTMLElement>('#DFG_3DViewer');
    const wrapper = container?.closest<HTMLElement>('.viewer-wrapper');
    if (!container || !wrapper) throw new Error('Viewer wrapper is unavailable');

    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    let fullscreenHost: Element | null = null;
    container.requestFullscreen = async () => {
      fullscreenHost = container;
      fullscreenElement = container;
    };

    await (window as any).Viewer.toggleFullscreen();

    const fullscreenState = {
      requestedContainer: fullscreenHost === container,
      toolbarIsInsideContainer: container.contains(document.querySelector('#viewerEditorToolbar')),
      toolbarParentIsContainer: document.querySelector('#viewerEditorToolbar')?.parentElement === container,
    };

    document.exitFullscreen = async () => {
      fullscreenElement = null;
    };
    await (window as any).Viewer.toggleFullscreen();

    return {
      ...fullscreenState,
      toolbarParentIsRestoredHost:
        document.querySelector('#viewerEditorToolbar')?.parentElement ===
        (window as any).Viewer.getEditorToolbarHost(),
    };
  });

  expect(state.requestedContainer).toBe(true);
  expect(state.toolbarIsInsideContainer).toBe(true);
  expect(state.toolbarParentIsContainer).toBe(true);
  expect(state.toolbarParentIsRestoredHost).toBe(true);
});

test('viewer window can be resized and moved from its controls', async ({ page }) => {
  await openViewer(page);
  // Software-rendered CI is slow; loading overlays must be gone before the handles are usable.
  await waitForModel(page, 60_000);
  const container = page.locator('#DFG_3DViewer');
  await expect(container.locator('.viewer-window-drag-handle')).toBeAttached();
  await expect(container.locator('.viewer-window-resize-bottom-right')).toBeAttached();

  const before = await container.boundingBox();
  if (!before) throw new Error('Viewer container bounding box is unavailable');

  const resizeHandle = container.locator('.viewer-window-resize-bottom-right');
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) throw new Error('Viewer resize handle bounding box is unavailable');
  await page.mouse.move(resizeBox.x + 4, resizeBox.y + 4);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 44, resizeBox.y + 34);
  await page.mouse.up();

  const afterResize = await container.boundingBox();
  if (!afterResize) throw new Error('Viewer container bounding box after resize is unavailable');
  expect(afterResize.width).toBeGreaterThan(before.width);
  expect(afterResize.height).toBeGreaterThan(before.height);

  // The window is clamped to the viewport, so drag towards the side that has more room
  // instead of assuming it can always move up/left.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport size is unavailable');
  const roomLeft = afterResize.x;
  const roomRight = viewport.width - (afterResize.x + afterResize.width);
  const roomTop = afterResize.y;
  const roomBottom = viewport.height - (afterResize.y + afterResize.height);
  const dx = roomLeft >= roomRight ? -Math.min(30, roomLeft) : Math.min(30, roomRight);
  const dy = roomTop >= roomBottom ? -Math.min(25, roomTop) : Math.min(25, roomBottom);
  test.skip(Math.abs(dx) < 5 && Math.abs(dy) < 5, 'No room in the viewport to move the window');

  const dragHandle = container.locator('.viewer-window-drag-handle');
  // hover() fails with the name of the intercepting element if something covers the handle.
  await dragHandle.hover();
  const dragBox = await dragHandle.boundingBox();
  if (!dragBox) throw new Error('Viewer drag handle bounding box is unavailable');
  const startX = dragBox.x + dragBox.width / 2;
  const startY = dragBox.y + dragBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const box = await container.boundingBox();
      return box ? Math.abs(box.x - afterResize.x) + Math.abs(box.y - afterResize.y) : 0;
    })
    .toBeGreaterThan(0);
});

test('sandbox mode starts without loading a model', async ({ page }) => {
  await openSandboxViewer(page);

  await page.waitForFunction(
    (msg) => window.viewer?.toasts?.some((t) => t.includes(msg)),
    sandboxDropMessage
  );
  await page.waitForTimeout(3_000);

  const state = await page.evaluate(() => ({
    modelLoaded: window.viewer.modelLoaded,
    toasts: window.viewer.toasts ?? [],
    guiHidden: document.querySelector('#guiContainer')?.hidden,
    sandboxNoticeVisible:
      document.querySelector('#viewerStatusNotice[data-variant="sandbox"].is-visible')?.hidden === false,
    noticeContainerCentered:
      document.querySelector('#viewerNoticeContainer')?.classList.contains('viewer-notice-container--sandbox'),
  }));

  expect(state.modelLoaded).toBe(false);
  expect(state.toasts.some((t) => t.includes(sandboxDropMessage))).toBe(true);
  expect(state.guiHidden).toBe(true);
  expect(state.sandboxNoticeVisible).toBe(true);
  expect(state.noticeContainerCentered).toBe(true);
});

test('sandbox notice updates after language changes', async ({ page }) => {
  await openSandboxViewer(page);

  const notice = page.locator('#viewerStatusNotice[data-variant="sandbox"]');
  await expect(notice.locator('.viewer-notice-message')).toHaveText(sandboxDropMessage);
  // details are rendered as separate lines/spans: label, formats list, archives
  await expect(notice.locator('.viewer-notice-detail').nth(0)).toContainText('Supported formats');
  await expect(notice.locator('.viewer-notice-detail').nth(1)).toHaveText(supportedFormatsText);
  await expect(notice.locator('.viewer-notice-detail').nth(2)).toContainText('archive formats');

  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#viewerLanguageMode')?.click();
    document.querySelector<HTMLElement>('.language-dropdown-item-polish')?.click();
  });

  await expect(notice.locator('.viewer-notice-message')).toHaveText("Przeciągnij i upuść model 3D w oknie viewer'a.");
  await expect(notice.locator('.viewer-notice-detail').nth(0)).toContainText('formaty');
  await expect(notice.locator('.viewer-notice-detail').nth(1)).toHaveText(supportedFormatsText);
  await expect(notice.locator('.viewer-notice-detail').nth(2)).toContainText('archiwa');
});

for (const example of supportedExamples) {
  test(`loads ${example.format.toUpperCase()} example into scene`, async ({ page }) => {
    // web-ifc ships a ~1.3MB WASM binary plus a multi-MB JS API module -
    // far heavier than any other loader here - so fetching and compiling it
    // can occasionally run past the default budget on a cold/slow CI
    // runner even though it loads in ~1-2s locally.
    const isIfc = example.format === 'ifc';
    if (isIfc) {
      test.setTimeout(60_000);
    }
    await openViewer(page, example.path);
    await waitForModel(page, isIfc ? 45_000 : 15_000);

    const state = await page.evaluate(() => ({
      modelLoaded: window.viewer.modelLoaded,
      objectCount: window.viewer.scene.children.length,
    }));

    expect(state.modelLoaded).toBe(true);
    expect(state.objectCount).toBeGreaterThan(0);
  });
}

// The app's examples (scripts/build-tempietto-examples.mjs): most of them
// point at the shared textures in tempietto/tex/, so none of those may fail.
const tempiettoFormats = ['glb', 'obj', 'fbx', 'dae', '3ds', 'usda', 'usdz', 'kmz', '3mf', 'amf', 'wrl', 'stl', 'ply', 'xyz', 'pcd', 'vox', 'ifc'];
for (const format of tempiettoFormats) {
  test(`loads the Tempietto ${format.toUpperCase()} example with its textures`, async ({ page }) => {
    const isIfc = format === 'ifc';
    if (isIfc) {
      test.setTimeout(60_000);
    }
    // Not the probe for a progressive preview (*.preview.glb), which has none.
    const watched = (url) => url.includes('/examples/tempietto/') && !url.endsWith('.preview.glb');
    const failed = [];
    page.on('response', (response) => {
      if (watched(response.url()) && response.status() >= 400) failed.push(response.url());
    });
    page.on('requestfailed', (request) => {
      if (watched(request.url())) failed.push(request.url());
    });
    await openViewer(page, `/examples/tempietto/Tempietto.${format}`);
    await waitForModel(page, isIfc ? 45_000 : 15_000);
    await page.waitForLoadState('networkidle');

    expect(failed).toEqual([]);
  });
}

test('models are centred on the grid whether or not metadata is configured', async ({ page }) => {
  // box.stl loads as a single mesh, the synagogue GLB as a group.
  for (const model of ['/examples/box.stl', '/examples/WolpaSynagogue.glb']) {
    await openViewer(page, model);
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
    const box = await page.evaluate(() => {
      const root = window.Viewer.resolveObjectByTargetId('m0:root');
      const bounds = new THREE.Box3().setFromObject(root, true);
      return {
        minY: +bounds.min.y.toFixed(3),
        centerX: +((bounds.min.x + bounds.max.x) / 2).toFixed(3),
        centerZ: +((bounds.min.z + bounds.max.z) / 2).toFixed(3),
      };
    });
    expect(box, model).toEqual({ minY: 0, centerX: 0, centerZ: 0 });
  }
});

test('camera rotates on mouse drag', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.waitForFunction(() => window.viewer?.camera);

  const canvas = page.locator('#MainCanvas');
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('MainCanvas bounding box is unavailable');
  }

  const before = await page.evaluate(() => ({
    x: window.viewer.camera.position.x,
    y: window.viewer.camera.position.y,
    z: window.viewer.camera.position.z,
  }));

  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 200, startY, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        x: window.viewer.camera.position.x,
        y: window.viewer.camera.position.y,
        z: window.viewer.camera.position.z,
      }))
    )
    .not.toEqual(before);
});

/*test('reset settings restores the model state used without a _viewer.json file', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  const resetButton = page.locator('button[data-tool="resetSettings"]');
  await expect(resetButton).toHaveAttribute('aria-label', 'Reset settings');

  const initialState = await page.evaluate(() => {
    const object = window.Viewer?.mainObject?.[0];
    const model = Array.isArray(object) ? object[0] : object;
    if (!model) throw new Error('Loaded model is unavailable');

    return {
      position: model.position.toArray(),
      rotation: [
        model.rotation.x,
        model.rotation.y,
        model.rotation.z,
      ],
      scale: model.scale.toArray(),
    };
  });

  await page.evaluate(() => {
    const object = window.Viewer?.mainObject?.[0];
    const model = Array.isArray(object) ? object[0] : object;
    if (!model) throw new Error('Loaded model is unavailable');

    model.position.set(123, 456, 789);
    model.rotation.set(1, 2, 3);
    model.scale.set(2, 3, 4);
    model.updateMatrixWorld(true);
  });

  await resetButton.click({ force: true });

  await expect.poll(async () => {
    return page.evaluate(() => {
      const object = window.Viewer?.mainObject?.[0];
      const model = Array.isArray(object) ? object[0] : object;
      if (!model) return null;

      return {
        position: model.position.toArray(),
        rotation: [
          model.rotation.x,
          model.rotation.y,
          model.rotation.z,
        ],
        scale: model.scale.toArray(),
      };
    });
  }).toEqual(initialState);
});*/

test('guided tour steps through annotations and keeps saved views', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  const savedView = { position: [3, 2, 4], target: [0.1, 0.2, 0.3], fov: 40 };
  const annotationCount = await page.evaluate((view) => {
    const viewer = window.Viewer;
    const root = viewer.resolveObjectByTargetId('m0:root');
    let mesh = null;
    root?.traverse?.((child) => {
      if (!mesh && child.isMesh) mesh = child;
    });
    const targetId = viewer.resolveFaceTargetId(mesh);
    return viewer.hydrateAnnotationsFromMetadataPayload({
      annotationEntries: [
        { id: 'a1', targetId, faceNumbers: [0], title: 'First', description: 'Saved view', view },
        { id: 'a2', targetId, faceNumbers: [4], title: 'Second', description: 'Computed view' },
      ],
    });
  }, savedView);
  expect(annotationCount).toBe(2);

  await page.evaluate(() => window.Viewer.startTour());
  const panel = page.locator('#viewerTourPanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-tour-panel_counter')).toHaveText('Step 1 / 2');
  await expect(panel.locator('.viewer-tour-panel_title')).toHaveText('1. First');

  // Reduced motion (playwright.config.js) makes the flight instant.
  await expect.poll(() => page.evaluate(() => {
    const state = window.Viewer.tourState;
    return state?.flight === null && state?.index === 0;
  })).toBe(true);
  const firstPose = await page.evaluate(() => window.Viewer.captureCurrentAnnotationView());
  firstPose.position.forEach((value, index) => expect(value).toBeCloseTo(savedView.position[index], 4));
  firstPose.target.forEach((value, index) => expect(value).toBeCloseTo(savedView.target[index], 4));
  expect(firstPose.fov).toBeCloseTo(savedView.fov, 4);

  await panel.locator('.viewer-tour-panel_next').click();
  await expect(panel.locator('.viewer-tour-panel_counter')).toHaveText('Step 2 / 2');
  await expect(panel.locator('.viewer-tour-panel_title')).toHaveText('2. Second');
  const secondPose = await page.evaluate(() => window.Viewer.captureCurrentAnnotationView());
  const secondCenter = await page.evaluate(() => {
    const viewer = window.Viewer;
    return viewer.getAnnotationEntryCenter(viewer.getAnnotationEntriesForPersistence()[1]).toArray();
  });
  secondPose.target.forEach((value, index) => expect(value).toBeCloseTo(secondCenter[index], 4));

  // The saved view survives an XML export/import round trip.
  const reimportedView = await page.evaluate(() => {
    const viewer = window.Viewer;
    const xml = viewer.exportAnnotationsToIIIFXml();
    viewer.importAnnotationsFromIIIFXml(xml);
    return viewer.getAnnotationEntriesForPersistence().map((entry) => entry.view || null);
  });
  expect(reimportedView).toEqual([savedView, null]);

  // Closing the tour falls back to the idle panel (annotations remain);
  // closing that one dismisses it.
  await panel.locator('.viewer-tour-panel_close').click();
  await expect(panel).toHaveClass(/viewer-tour-panel--idle/);
  await expect.poll(() => page.evaluate(() => window.Viewer.isTourActive())).toBe(false);
  await panel.locator('.viewer-tour-panel_close').click();
  await expect(panel).toHaveCount(0);
});

test('tool panels: a ring counts down the tour step, panels move, minimize to an icon and close', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => {
    const viewer = window.Viewer;
    const root = viewer.resolveObjectByTargetId('m0:root');
    let mesh = null;
    root?.traverse?.((child) => {
      if (!mesh && child.isMesh) mesh = child;
    });
    const targetId = viewer.resolveFaceTargetId(mesh);
    viewer.hydrateAnnotationsFromMetadataPayload({
      annotationEntries: [
        { id: 'a1', targetId, faceNumbers: [0], title: 'First' },
        { id: 'a2', targetId, faceNumbers: [4], title: 'Second' },
      ],
    });
    viewer.startTour({ autoplay: true, stepDurationMs: 60_000 });
  });

  // Autoplay waiting on a step: the ring around pause fills; paused, it goes.
  const panel = page.locator('#viewerTourPanel');
  const play = panel.locator('.viewer-tour-panel_play');
  await expect(play).toHaveClass(/is-counting/);
  await expect(play).toHaveCSS('--tour-step-duration', '60000ms');
  await play.click();
  await expect(play).not.toHaveClass(/is-counting/);

  // Dragged by its grip, the panel follows the pointer.
  const before = await panel.boundingBox();
  const grip = await panel.locator('.tool-panel-chrome_grip').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 - 120, grip.y + grip.height / 2 + 150, { steps: 6 });
  await page.mouse.up();
  const after = await panel.boundingBox();
  expect(Math.round(after.x - before.x)).toBe(-120);
  expect(Math.round(after.y - before.y)).toBe(150);

  // Minimized: a small round icon alone; a click on it restores the panel.
  await panel.locator('.tool-panel-chrome_minimize').click();
  const pip = panel.locator('.tool-panel-chrome_pip');
  await expect(pip).toBeVisible();
  await expect(panel.locator('.viewer-tour-panel_title')).toBeHidden();
  const icon = await panel.boundingBox();
  expect(icon.width).toBeLessThan(60);
  expect(icon.height).toBeLessThan(60);
  // The tour's progress goes round the icon: step 1 of 2, then 2 of 2.
  await expect(pip).toHaveClass(/has-progress/);
  await expect(pip).toHaveCSS('--tool-panel-progress', '0.5');
  await page.evaluate(() => window.Viewer.nextTourStep());
  await expect(pip).toHaveCSS('--tool-panel-progress', '1');
  await page.evaluate(() => window.Viewer.previousTourStep());
  await pip.click();
  await expect(pip).toBeHidden();
  await expect(panel.locator('.viewer-tour-panel_title')).toHaveText('1. First');

  // The sun panel moves and minimizes too; its close button switches it off.
  await page.evaluate(() => window.Viewer.setSunStudy(true));
  const sun = page.locator('#viewerSun');
  await expect(sun.locator('.tool-panel-chrome_grip')).toBeVisible();
  await sun.locator('.tool-panel-chrome_minimize').click();
  await expect(sun.locator('.tool-panel-chrome_pip')).toBeVisible();
  await sun.locator('.tool-panel-chrome_pip').click();
  await sun.locator('.viewer-sun_icon').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(false);
});

test('tool panels on a phone: a tap on the icon restores the panel, the same tap does not close it', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setSunStudy(true));
  const sun = page.locator('#viewerSun');
  await sun.locator('.tool-panel-chrome_minimize').tap();
  // The icon sits where the close button is once the panel is back.
  await sun.locator('.tool-panel-chrome_pip').tap();
  await expect(sun.locator('.tool-panel-chrome_pip')).toBeHidden();
  await expect(sun).not.toHaveClass(/is-minimized/);
  await page.waitForTimeout(500);
  await expect(sun).toBeVisible();
  expect(await page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(true);
  await context.close();
});

test('guided tour spreads all annotations around the model', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  await page.evaluate(() => {
    const viewer = window.Viewer;
    const root = viewer.resolveObjectByTargetId('m0:root');
    let mesh = null;
    root?.traverse?.((child) => {
      if (!mesh && child.isMesh) mesh = child;
    });
    const targetId = viewer.resolveFaceTargetId(mesh);
    viewer.hydrateAnnotationsFromMetadataPayload({
      annotationEntries: [
        { id: 's1', targetId, faceNumbers: [0], title: 'First', description: 'First description' },
        { id: 's2', targetId, faceNumbers: [4], title: 'Second', description: 'Second description' },
        { id: 's3', targetId, faceNumbers: [8], title: 'Third' },
      ],
    });
  });

  const panel = page.locator('#viewerTourPanel');
  await panel.locator('.viewer-tour-panel_spread').click();
  await expect(panel.locator('.viewer-tour-panel_spread')).toHaveAttribute('aria-pressed', 'true');

  const cards = page.locator('.annotation-spread-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('First description');
  await expect(page.locator('.annotation-spread-line')).toHaveCount(3);

  // Cards do not overlap and each line starts at the edge of its point's
  // number badge (no dot over the number).
  const layout = await page.evaluate(() => {
    const viewer = window.Viewer;
    const state = viewer.annotationSpreadState;
    const rects = state.items.filter((item) => !item.card.hidden)
      .map((item) => item.card.getBoundingClientRect());
    const overlaps = rects.some((a, i) => rects.some((b, j) => i < j
      && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
    const lineStarts = state.items.map((item) => item.line.getAttribute('points').split(' ')[0].split(',').map(Number));
    const anchors = state.items.map((item) => [item.screen.x, item.screen.y]);
    const dotsShown = state.items.filter((item) => item.dot.style.display !== 'none').length;
    return { shown: rects.length, overlaps, lineStarts, anchors, dotsShown };
  });
  expect(layout.shown).toBeGreaterThan(0);
  expect(layout.overlaps).toBe(false);
  expect(layout.dotsShown).toBe(0);
  layout.lineStarts.forEach((start, index) => {
    const distance = Math.hypot(start[0] - layout.anchors[index][0], start[1] - layout.anchors[index][1]);
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(40);
  });

  // A card starts the tour at its step and is marked as current.
  await cards.nth(1).click();
  await expect(panel.locator('.viewer-tour-panel_title')).toHaveText('2. Second');
  await expect(cards.nth(1)).toHaveClass(/is-current/);

  // Leader lines and the spread are exclusive.
  await panel.locator('.viewer-tour-panel_leaders').click();
  await expect(cards).toHaveCount(0);
  await expect(panel.locator('.viewer-tour-panel_spread')).toHaveAttribute('aria-pressed', 'false');
});

test('embed options: the model on screen after a switch, its camera by axis, a preview without the page header, a window to move', async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb');
  await waitForModel(page);
  // Another example from the select: the embed is of that one.
  await page.evaluate(() => { window.viewer.fullModelLoaded = false; });
  await page.selectOption('#example-model-select', './examples/animated.glb');
  await waitForModel(page);
  await waitForCameraIdle(page);
  await page.evaluate(() => window.Viewer.openEmbedConfiguratorFromMenu());
  const panel = page.locator('#embedConfiguratorPanel');
  await expect(panel).toBeVisible();

  // The full address of the model shown, not the page's first one.
  await expect(page.locator('#embedModelInput')).toHaveValue(/^http:\/\/[^/]+\/examples\/animated\.glb$/);
  // The camera by axis, the address from all three.
  const camera = await page.evaluate(() => window.Viewer.camera.position.toArray());
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
    expect(Number(await page.locator(`#embedCamPos${axis}`).inputValue())).toBeCloseTo(camera[index], 1);
  }
  await page.locator('#embedCamPosY').fill('3');
  await expect(page.locator('#embedUrlOutput')).toHaveValue(/camPos=[^&]*%2C3\.0000%2C/);
  // A vector with a number missing is marked, and left out.
  await page.locator('#embedCamTargetZ').fill('');
  await expect(page.locator('#embedCamTargetX')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#embedResetFromViewer').click();
  await expect(page.locator('#embedCamTargetX')).not.toHaveAttribute('aria-invalid', 'true');

  // The preview: the embed page, the model in it, no example picker.
  const frame = page.frameLocator('#embedPreviewFrame');
  await expect(page.locator('#embedPreviewFrame')).toHaveAttribute('src', /embed\.html\?model=[^&]*animated\.glb/);
  await expect(frame.locator('#MainCanvas')).toBeAttached({ timeout: 20_000 });
  await expect(frame.locator('#viewer-page-header')).toHaveCount(0);
  // Its proportions are the code's too.
  await page.selectOption('#embedAspectInput', '4:3');
  await expect(page.locator('#embedIframeOutput')).toHaveValue(/aspect-ratio: 4 \/ 3/);
  const box = await page.locator('#embedPreviewFrame').boundingBox();
  expect(box.width / box.height).toBeCloseTo(4 / 3, 1);

  // Moved by its header, kept on the screen.
  const before = await panel.boundingBox();
  const header = await page.locator('.embed-config-header').boundingBox();
  await page.mouse.move(header.x + 200, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x + 190, header.y + header.height / 2 + 30, { steps: 4 });
  await page.mouse.move(header.x + 100, header.y + header.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  const after = await panel.boundingBox();
  expect(Math.round(after.x)).toBe(0);
  expect(Math.abs(after.y - before.y - 30)).toBeLessThanOrEqual(1);

  // Closed, the preview's viewer stops.
  await page.locator('#embedClosePanel').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#embedPreviewFrame')).toHaveAttribute('src', 'about:blank');
});

test('embed configurator uses the current camera for preview url', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.waitForFunction(() => window.Viewer?.camera && window.Viewer?.controls);
  await waitForCameraIdle(page);

  await page.evaluate(() => {
    const viewer = window.Viewer;
    const camera = viewer?.camera;
    const controls = viewer?.controls;
    if (!camera || !controls) {
      throw new Error('Viewer camera is unavailable');
    }

    // Stabilize camera state before assertions.
    viewer.cameraTween?.stop?.();
    viewer.targetTween?.stop?.();
    controls.autoRotate = false;
    controls.enableDamping = false;

    camera.position.set(-1.8352523027, 1.8888667447, 3.6705046054);
    controls.target.set(0, 1, 0);
    camera.fov = 45;
    camera.updateProjectionMatrix();
    controls.update();
  });

  await openMainActionMenu(page);
  await page.click('#viewEntity');
  await expect(page.locator('#embedConfiguratorPanel')).toBeVisible();

  await page.click('#embedUseCurrentCamera');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const parseVector = (value) => {
          const parts = String(value || '').split(',').map((part) => Number(part.trim()));
          if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
            return null;
          }
          return parts;
        };

        const camera = window.Viewer?.camera;
        const controls = window.Viewer?.controls;
        const camPosInput = document.querySelector('#embedCamPosInput')?.value ?? '';
        const camTargetInput = document.querySelector('#embedCamTargetInput')?.value ?? '';

        if (!camera || !controls) {
          return Number.POSITIVE_INFINITY;
        }

        const parsedCamPos = parseVector(camPosInput);
        const parsedCamTarget = parseVector(camTargetInput);
        if (!parsedCamPos || !parsedCamTarget) {
          return Number.POSITIVE_INFINITY;
        }

        const positionDiff = Math.max(
          Math.abs(parsedCamPos[0] - camera.position.x),
          Math.abs(parsedCamPos[1] - camera.position.y),
          Math.abs(parsedCamPos[2] - camera.position.z)
        );
        const targetDiff = Math.max(
          Math.abs(parsedCamTarget[0] - controls.target.x),
          Math.abs(parsedCamTarget[1] - controls.target.y),
          Math.abs(parsedCamTarget[2] - controls.target.z)
        );

        return Math.max(positionDiff, targetDiff);
      })
    )
    .toBeLessThan(0.01);

  const camPosValue = await page.locator('#embedCamPosInput').inputValue();
  const camTargetValue = await page.locator('#embedCamTargetInput').inputValue();
  const embedUrl = await page.locator('#embedUrlOutput').inputValue();

  expect(embedUrl).toContain(`camPos=${encodeURIComponent(camPosValue)}`);
  expect(embedUrl).toContain(`camTarget=${encodeURIComponent(camTargetValue)}`);
});

test('faces are selected by Shift + drag, Ctrl + click and accepted with Enter', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.pickingMode = true;
    viewer.updatePickingControlsVisibility();
  });

  const canvas = page.locator('#MainCanvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const selectedCount = () => page.evaluate(() => window.Viewer.selectedFaces.length);
  const dragArea = async (modifiers) => {
    for (const key of modifiers) await page.keyboard.down(key);
    // Stay clear of the panels floating over the canvas edges.
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8, { steps: 4 });
    await page.mouse.up();
    for (const key of [...modifiers].reverse()) await page.keyboard.up(key);
  };

  await waitForCameraIdle(page);
  const cameraPose = () => page.evaluate(() => window.Viewer.captureCurrentAnnotationView());
  const cameraBefore = await cameraPose();
  await dragArea(['Shift']);
  const visibleCount = await selectedCount();
  // The cube has 12 triangles; only the faces turned to the camera count.
  expect(visibleCount).toBeGreaterThan(0);
  expect(visibleCount).toBeLessThanOrEqual(6);
  // The drag selected faces instead of panning the camera.
  expect(await cameraPose()).toEqual(cameraBefore);
  await expect(page.locator('#pickingHint')).toContainText(`${visibleCount} faces selected`);

  // Ctrl + click on a selected face removes it again.
  await page.keyboard.down('Control');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.up('Control');
  expect(await selectedCount()).toBe(visibleCount - 1);

  await canvas.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#annotationDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#annotationDialog')).toBeHidden();

  await dragArea(['Control', 'Shift']);
  expect(await selectedCount()).toBe(0);
});

// Size and grid placement of the model root, and its own rotation.
async function modelPose(page) {
  return page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const bounds = new THREE.Box3().setFromObject(root, true);
    const size = bounds.getSize(new THREE.Vector3());
    // "|| 0": -0 reads as 0.
    const round = (value) => +value.toFixed(3) || 0;
    return {
      size: size.toArray().map(round),
      minY: round(bounds.min.y),
      rotation: root.rotation.toArray().slice(0, 3).map(round),
      upAxis: window.Viewer.getModelUpAxis(),
    };
  });
}

test('upAxis turns Z-up and upside-down models upright, under the root transform', async ({ page }) => {
  // A group (glTF) and a single mesh (STL, whose geometry is turned).
  for (const model of ['/examples/WolpaSynagogue.glb', '/examples/box.stl']) {
    await openViewer(page, model);
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
    const asLoaded = await modelPose(page);
    expect(asLoaded.upAxis, model).toBe('Y+');

    // The URL: the file's Z is up (a "+" in a URL reads as a space).
    await openViewer(page, model, 'upAxis=Z+');
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
    const zUp = await modelPose(page);
    expect(zUp.upAxis, model).toBe('Z+');
    expect(zUp.size, model).toEqual([asLoaded.size[0], asLoaded.size[2], asLoaded.size[1]]);
    // Still on the grid, and the fix is not in the root's own rotation.
    expect(zUp.minY, model).toBe(0);
    expect(zUp.rotation, model).toEqual([0, 0, 0]);

    // Annotation targets (child-index paths) skip the pivot.
    const lastMeshTarget = () => page.evaluate(() => {
      const meshes = [];
      window.Viewer.resolveObjectByTargetId('m0:root').traverse((child) => { if (child.isMesh) meshes.push(child); });
      const mesh = meshes.at(-1);
      delete mesh.userData.annotationTargetId;
      const id = window.Viewer.resolveFaceTargetId(mesh);
      return { id, resolved: window.Viewer.resolveObjectByTargetId(id) === mesh };
    });
    const zUpTarget = await lastMeshTarget();
    expect(zUpTarget.resolved, model).toBe(true);

    // The editor: back to Y-up, then upside down.
    expect(await page.evaluate(() => window.Viewer.setUpAxis('Y+'))).toBe(true);
    expect(await modelPose(page)).toEqual(asLoaded);
    expect(await lastMeshTarget(), model).toEqual(zUpTarget);
    await page.evaluate(() => window.Viewer.setUpAxis('Y-'));
    const flipped = await modelPose(page);
    expect(flipped.size, model).toEqual(asLoaded.size);
    expect(flipped.minY, model).toBe(0);
    // Setting it again changes nothing (no second turn).
    expect(await page.evaluate(() => window.Viewer.setUpAxis('Y-'))).toBe(false);
  }

  // The toolbar's menu marks the current axis and sets another.
  const zButton = page.locator('[data-tool="upAxis-Z+"]');
  await expect(zButton).toHaveCount(1);
  await expect(page.locator('[data-tool="upAxis-Y-"]')).toHaveClass(/is-active/);
  await zButton.dispatchEvent('click');
  expect((await modelPose(page)).upAxis).toBe('Z+');
  await expect(zButton).toHaveClass(/is-active/);

  // Exported as modelTransform.upAxis, and imported back.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.modelTransform.upAxis).toBe('Z+');
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  await page.evaluate(() => window.Viewer.setUpAxis('Y+'));
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.modelTransform.upAxis)).toBeUndefined();
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  expect((await modelPose(page)).upAxis).toBe('Z+');

  const broken = structuredClone(manifest);
  broken.AIM3DViewer.modelTransform.upAxis = 'up';
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual(['$.AIM3DViewer.modelTransform.upAxis']);
});

test('progressive loading: the up axis of the preview stays on the full model', async ({ page }) => {
  await page.route('**/examples/compressed.glb', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await openViewer(page, '/examples/compressed.glb', 'upAxis=-Y');
  await waitForModel(page);
  const preview = await modelPose(page);
  expect(preview.upAxis).toBe('Y-');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const full = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const pivots = root.children.filter((child) => child.userData?.isUpAxisPivot);
    return { isPreview: root.userData?.isPreviewModel === true, pivots: pivots.length, pivotX: +pivots[0]?.rotation.x.toFixed(3) };
  });
  expect(full).toEqual({ isPreview: false, pivots: 1, pivotX: +Math.PI.toFixed(3) });
  expect((await modelPose(page)).upAxis).toBe('Y-');
});

test('progressive loading shows the preview first and swaps in the full compressed model', { tag: '@smoke' }, async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/examples/compressed')) {
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await openViewer(page, '/examples/compressed.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });

  expect(requests).toContain('HEAD /examples/compressed.preview.glb');
  expect(requests).toContain('GET /examples/compressed.preview.glb');
  expect(requests).toContain('GET /examples/compressed.glb');
  // Preview first, then the full model.
  expect(requests.indexOf('GET /examples/compressed.preview.glb'))
    .toBeLessThan(requests.indexOf('GET /examples/compressed.glb'));

  const scene = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    let meshes = 0;
    let compressedTextures = 0;
    root.traverse((child) => {
      if (!child.isMesh) return;
      meshes += 1;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (materials.some((material) => material?.map?.isCompressedTexture)) compressedTextures += 1;
    });
    return {
      isPreview: root.userData?.isPreviewModel === true,
      meshes,
      compressedTextures,
      badge: document.querySelectorAll('.viewer-progressive-badge').length,
      errors: window.viewer?.errors?.length ?? 0,
    };
  });
  expect(scene.isPreview).toBe(false);
  expect(scene.meshes).toBeGreaterThan(0);
  // KHR_texture_basisu textures were transcoded by the KTX2 loader.
  expect(scene.compressedTextures).toBeGreaterThan(0);
  expect(scene.badge).toBe(0);
  expect(scene.errors).toBe(0);
});

test('progressive loading: the shading mode set on the preview stays on the full model', async ({ page }) => {
  // The full model arrives late, so the mode is set while the preview shows.
  await page.route('**/examples/compressed.glb', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await openViewer(page, '/examples/compressed.glb');
  await waitForModel(page);
  expect(await page.evaluate(() => window.viewer.fullModelLoaded)).toBe(false);
  await page.evaluate(() => window.Viewer.setShadingMode('clay'));
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });

  const shaded = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const meshes = [];
    root.traverse((child) => { if (child.isMesh) meshes.push(Boolean(child.userData.__shadingMaterials)); });
    return { isPreview: root.userData?.isPreviewModel === true, mode: window.Viewer.shadingMode, meshes };
  });
  expect(shaded.isPreview).toBe(false);
  expect(shaded.mode).toBe('clay');
  expect(shaded.meshes.length).toBeGreaterThan(0);
  expect(shaded.meshes.every(Boolean)).toBe(true);
});

test('preview=0 skips the progressive preview', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('.preview.glb')) requests.push(request.method());
  });
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });
  await page.goto('/?e2eModel=%2Fexamples%2Fcompressed.glb&preview=0&ui=classic');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  expect(requests).toEqual([]);
});

test('streams a 3D Tiles point cloud and keeps annotations off it', async ({ page }) => {
  const tileRequests = new Set();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/examples/tiles/wolpa-points/')) tileRequests.add(path);
  });

  await openViewer(page, '/examples/tiles/wolpa-points/tileset.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });

  // The coarse root level first, then refined tiles as the view needs them.
  await expect.poll(() => tileRequests.size, { timeout: 10_000 }).toBeGreaterThan(2);
  expect(tileRequests).toContain('/examples/tiles/wolpa-points/tileset.json');

  const scene = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    let points = 0;
    root.traverse((child) => {
      if (child.isPoints) points += child.geometry.getAttribute('position').count;
    });
    const box = new THREE.Box3().setFromObject(root, true);
    return {
      tiled: root.userData?.isTiledModel === true,
      points,
      size: box.getSize(new THREE.Vector3()).toArray().map(Math.round),
      minY: Math.round(box.min.y),
      centerX: Math.round((box.min.x + box.max.x) / 2),
      centerZ: Math.round((box.min.z + box.max.z) / 2),
      errors: window.viewer?.errors?.length ?? 0,
    };
  });
  expect(scene.tiled).toBe(true);
  expect(scene.points).toBeGreaterThan(1000);
  // Turned from Z-up to Y-up: the synagogue is about 1875 units tall, 2780 wide.
  expect(scene.size[1]).toBeGreaterThan(1700);
  expect(scene.size[1]).toBeLessThan(2000);
  expect(scene.size[0]).toBeGreaterThan(2500);
  // Centred and on the grid like any other model - by the whole tileset's
  // bounds, not just the coarse root tiles.
  expect(scene.minY).toBe(0);
  expect(scene.centerX).toBe(0);
  expect(scene.centerZ).toBe(0);
  expect(scene.errors).toBe(0);

  await page.evaluate(() => window.Viewer.openAnnotationDialogWithAutoPicking());
  await expect(page.locator('#annotationDialog')).toHaveCount(0);
});

test('LAZ point clouds load directly, re-centred in double precision', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page, '/examples/points.laz');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const cloud = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const points = root.children.find((child) => child.isPoints);
    const info = points.userData.pointCloud;
    const box = new THREE.Box3().setFromObject(root, true);
    const color = points.geometry.getAttribute('color');
    return {
      count: points.geometry.getAttribute('position').count,
      info,
      // Sampled across the cloud (the first points are the black plinth).
      colorVaries: new Set(Array.from({ length: 200 }, (_, i) => color.array[i * 1500])).size > 10,
      // Metres: about 28 x 19 x 24 m; must not collapse or explode from
      // float32 rounding of the ~5.5 million m UTM coordinates.
      size: box.getSize(new THREE.Vector3()).toArray().map(Math.round),
      centerX: Math.round((box.min.x + box.max.x) / 2),
      minY: Math.round(box.min.y),
    };
  });
  expect(cloud.count).toBe(100000);
  expect(cloud.info.colorMode).toBe('rgb');
  expect(cloud.info.skip).toBe(1);
  expect(cloud.info.originOffset[1]).toBeGreaterThan(5_000_000);
  expect(cloud.colorVaries).toBe(true);
  // Height along Y (turned from Z-up).
  expect(cloud.size[1]).toBeGreaterThan(15);
  expect(cloud.size[1]).toBeLessThan(22);
  expect(cloud.size[0]).toBeGreaterThan(25);
  expect(cloud.size[0]).toBeLessThan(32);
  expect(cloud.centerX).toBe(0);
  expect(cloud.minY).toBe(0);
});

// An uncompressed LAS 1.4 file (point format 7) of 300 000 points: decoded
// in the Web Worker while it downloads, in batches of 100 000.
function buildLas14(count) {
  const recordLength = 36;
  const vlrBytes = 1000;
  const pointsOffset = 375 + vlrBytes;
  const buffer = Buffer.alloc(pointsOffset + count * recordLength);
  buffer.write('LASF', 0, 'latin1');
  buffer.writeUInt8(1, 24);
  buffer.writeUInt8(4, 25);
  buffer.writeUInt16LE(375, 94);
  buffer.writeUInt32LE(pointsOffset, 96);
  buffer.writeUInt8(7, 104);
  buffer.writeUInt16LE(recordLength, 105);
  [0.001, 0.001, 0.001].forEach((value, i) => buffer.writeDoubleLE(value, 131 + i * 8));
  [600000, 5800000, 100].forEach((value, i) => buffer.writeDoubleLE(value, 155 + i * 8));
  // Max / min x, y, z: 40 x 20 x 10 m.
  [600040, 600000, 5800020, 5800000, 110, 100].forEach((value, i) => buffer.writeDoubleLE(value, 179 + i * 8));
  buffer.writeBigUInt64LE(BigInt(count), 247);
  for (let i = 0; i < count; i += 1) {
    const at = pointsOffset + i * recordLength;
    buffer.writeInt32LE((i * 397) % 40001, at);
    buffer.writeInt32LE((i * 131) % 20001, at + 4);
    buffer.writeInt32LE(i % 10001, at + 8);
    buffer.writeUInt16LE(i % 4000, at + 12);
    buffer.writeUInt8(i % 7, at + 16);
    buffer.writeUInt16LE((i % 256) * 256, at + 30);
    buffer.writeUInt16LE(65535, at + 32);
  }
  return buffer;
}

test('large LAS files are decoded in a Web Worker and fill in batch by batch', async ({ page }) => {
  const las = buildLas14(300_000);
  await page.context().route('**/examples/generated-scan.las', (route) => route.fulfill({
    body: las,
    contentType: 'application/octet-stream',
  }));
  await openViewer(page, '/examples/generated-scan.las');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  const cloud = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const points = root.children.find((child) => child.isPoints);
    const box = new THREE.Box3().setFromObject(root, true);
    const color = points.geometry.getAttribute('color').array;
    return {
      info: points.userData.pointCloud,
      count: points.geometry.getAttribute('position').count,
      size: box.getSize(new THREE.Vector3()).toArray().map(Math.round),
      minY: Math.round(box.min.y) + 0,
      // Point 123 457: red from its 16-bit value, full green.
      color: Array.from(color.slice(123457 * 3, 123457 * 3 + 3)),
      panel: Boolean(window.Viewer.pointCloudState),
      modes: window.Viewer.pointCloudState?.modes,
    };
  });
  expect(cloud.info.decoder).toBe('worker');
  expect(cloud.info.loading).toBe(false);
  expect(cloud.info.loadedPoints).toBe(300_000);
  expect(cloud.info.skip).toBe(1);
  expect(cloud.info.colorMode).toBe('rgb');
  expect(cloud.info.originOffset).toEqual([600020, 5800010, 105]);
  expect(cloud.count).toBe(300_000);
  // Z-up turned to Y-up: 40 x 10 x 20 m, on the ground.
  expect(cloud.size).toEqual([40, 10, 20]);
  expect(cloud.minY).toBe(0);
  expect(cloud.color).toEqual([123457 % 256, 255, 0]);
  // The point cloud panel waits for the whole cloud.
  expect(cloud.panel).toBe(true);
  // Classes 0-6 in the file: colouring by class, in the shader.
  expect(cloud.modes).toEqual(['rgb', 'intensity', 'height', 'classification']);
  const colorMode = await page.evaluate(() => {
    window.Viewer.setPointCloudColorMode('classification');
    return window.Viewer.pointCloudState.points[0].material.uniforms.uColorMode.value;
  });
  expect(colorMode).toBe(3);
});

// examples/potree/scan: 30 000 points of points.laz through PotreeConverter
// 2.1.1, classified ground (2) / building (6) by height.
test('Potree 2 clouds stream by range requests, with intensity, height and classification colours', { tag: '@smoke' }, async ({ page }) => {
  const ranges = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/octree.bin')) ranges.push(request.headers().range);
  });
  await openViewer(page, '/examples/potree/scan/metadata.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  await page.waitForFunction(() => window.Viewer.pointCloudState?.kind === 'tiles', null, { timeout: 20_000 });
  expect(ranges.length).toBeGreaterThan(0);
  expect(ranges.every((range) => /^bytes=\d+-\d+$/.test(range))).toBe(true);

  const panel = page.locator('#viewerPointCloudPanel');
  const colorSelect = panel.locator('select').nth(1);
  await expect(colorSelect.locator('option')).toHaveText(['RGB', 'Intensity', 'Height', 'Classification', 'Detail levels']);
  await colorSelect.selectOption('classification');
  const tiles = await page.evaluate(() => {
    const points = [];
    window.Viewer.pointCloudState.root.traverse((child) => {
      if (child.isPoints) points.push(child);
    });
    const classes = new Set();
    points.forEach((object) => object.geometry.getAttribute('classification')?.array.forEach((value) => classes.add(value)));
    return {
      count: points.length,
      // One set of colour uniforms for all tiles.
      shared: points.every((object) => object.material.uniforms.uColorMode === points[0].material.uniforms.uColorMode),
      colorMode: points[0].material.uniforms.uColorMode.value,
      classes: [...classes].sort(),
      // Extent of the points loaded (Potree's own bounds are a cube).
      size: points.reduce((box, object) => box.union(new THREE.Box3().setFromObject(object, true)), new THREE.Box3())
        .getSize(new THREE.Vector3()).toArray(),
    };
  });
  expect(tiles.count).toBeGreaterThan(0);
  // UTM coordinates (~5.5 million m north) are not mistaken for Earth-centred
  // ones: Z-up turned to Y-up, the house ~19 m high, not tilted on its side.
  expect(tiles.size[1]).toBeGreaterThan(15);
  expect(tiles.size[1]).toBeLessThan(22);
  expect(tiles.size[0]).toBeGreaterThan(25);
  expect(tiles.shared).toBe(true);
  expect(tiles.colorMode).toBe(3);
  expect(tiles.classes).toEqual([2, 6]);

  // Tiles are picked on the GPU too, and building points (6) can be hidden.
  await waitForCameraIdle(page);
  const hit = await pickAtCanvasCenter(page);
  expect(hit?.isPointCloudHit).toBe(true);
  await expect(panel.locator('.viewer-pointcloud-panel_class input')).toHaveCount(2);
  await panel.locator('.viewer-pointcloud-panel_class input[data-class-id="6"]').uncheck();
  expect(await page.evaluate(() => (window.Viewer.pointCloudState.colorUniforms.uClassHiddenMask.value >>> 6) & 1)).toBe(1);
  const groundOnly = await pickAtCanvasCenter(page);
  expect(groundOnly === null || groundOnly.classification === 2).toBe(true);
});

// The canvas centre in page coordinates, and the model point under it.
async function pickAtCanvasCenter(page) {
  return page.evaluate(() => {
    const rect = window.Viewer.mainCanvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = window.Viewer.pickModelAt(x, y);
    if (!hit) return null;
    // Distance of the hit from the ray through the pixel.
    const ndc = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, window.viewer.camera);
    return {
      isPointCloudHit: hit.isPointCloudHit === true,
      index: hit.index,
      point: hit.point.toArray(),
      classification: hit.object.geometry.getAttribute('classification')?.getX(hit.index),
      fromRay: raycaster.ray.distanceToPoint(hit.point),
      size: hit.object.material.size,
    };
  });
}

test('point clouds are picked on the GPU: the point under the cursor, classes and profile respected', async ({ page }) => {
  // 300,000 points drawn by SwiftShader: about 10 s on a desktop, close to
  // a minute on the self-hosted runner next to other tests.
  test.setTimeout(120_000);
  await page.context().route('**/examples/generated-scan.las', (route) => route.fulfill({
    body: buildLas14(300_000),
    contentType: 'application/octet-stream',
  }));
  await openViewer(page, '/examples/generated-scan.las');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
  await waitForCameraIdle(page);

  const hit = await pickAtCanvasCenter(page);
  expect(hit.isPointCloudHit).toBe(true);
  // On the ray through the pixel, within a point's own size.
  expect(hit.fromRay).toBeLessThan(Math.max(hit.size, 0.05) * 3);
  const visibleClass = hit.classification;

  // Its class switched off: never picked again.
  const panel = page.locator('#viewerPointCloudPanel');
  const classes = panel.locator('.viewer-pointcloud-panel_class input');
  await expect(classes).toHaveCount(7);
  await panel.locator(`.viewer-pointcloud-panel_class input[data-class-id="${visibleClass}"]`).uncheck();
  const filtered = await pickAtCanvasCenter(page);
  expect(filtered.classification).not.toBe(visibleClass);
  expect(await page.evaluate((id) => (window.Viewer.pointCloudState.points[0].material.uniforms.uClassHiddenMask.value >>> id) & 1, visibleClass)).toBe(1);
  await panel.locator(`.viewer-pointcloud-panel_class input[data-class-id="${visibleClass}"]`).check();

  // A profile across the middle: a vertical slab, seen from the side.
  const profile = await page.evaluate(() => {
    const box = new THREE.Box3().setFromObject(window.Viewer.pointCloudState.points[0]);
    const center = box.getCenter(new THREE.Vector3());
    const a = new THREE.Vector3(box.min.x, center.y, center.z);
    const b = new THREE.Vector3(box.max.x, center.y, center.z);
    window.Viewer.setPointCloudProfile(a, b, { width: 1 });
    return { z: center.z, ortho: window.viewer.camera.isOrthographicCamera === true };
  });
  expect(profile.ortho).toBe(true);
  await expect(panel.locator('.viewer-pointcloud-panel_profile button')).toHaveText('Clear profile');
  // Picked where a point of the slab is drawn: a point of the slab comes back.
  const inSlab = await page.evaluate((z) => {
    const points = window.Viewer.pointCloudState.points[0];
    const position = points.geometry.getAttribute('position');
    const world = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      world.fromBufferAttribute(position, i).applyMatrix4(points.matrixWorld);
      if (Math.abs(world.z - z) < 0.2) break;
    }
    const ndc = world.clone().project(window.viewer.camera);
    const rect = window.Viewer.mainCanvas.getBoundingClientRect();
    const hit = window.Viewer.pickModelAt(
      rect.left + ((ndc.x + 1) / 2) * rect.width,
      rect.top + ((1 - ndc.y) / 2) * rect.height,
    );
    return hit && { isPointCloudHit: hit.isPointCloudHit, z: hit.point.z };
  }, profile.z);
  expect(inSlab.isPointCloudHit).toBe(true);
  expect(Math.abs(inSlab.z - profile.z)).toBeLessThanOrEqual(0.5 + 1e-3);
  expect(await page.evaluate(() => window.Viewer.pointCloudState.points[0].material.uniforms.uProfileEnabled.value)).toBe(true);

  await panel.locator('.viewer-pointcloud-panel_profile button').click();
  expect(await page.evaluate(() => window.Viewer.pointCloudState.points[0].material.uniforms.uProfileEnabled.value)).toBe(false);
});

test('a click on a point cloud adds a point annotation there; the ruler measures between picked points', async ({ page }) => {
  await openViewer(page, '/examples/points.laz');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  await waitForCameraIdle(page);
  const canvas = page.locator('#MainCanvas');
  const box = await canvas.boundingBox();

  await page.evaluate(() => window.Viewer.openAnnotationDialogWithAutoPicking());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#annotationDialog')).toBeVisible();
  await page.fill('#annotationTitleInput', 'Window');
  await page.keyboard.press('Enter');
  await expect(page.locator('#annotationDialog')).toBeHidden();
  const entry = await page.evaluate(() => {
    const found = window.Viewer.annotationEntries.find((item) => item.title === 'Window');
    return found && { point: found.point, targetId: found.targetId, markers: window.Viewer.annotationPOIMarkers.length };
  });
  expect(entry.targetId).toBe('m0:root');
  expect(entry.point).toHaveLength(3);
  expect(entry.markers).toBeGreaterThan(0);
  await page.evaluate(() => { window.Viewer.pickingMode = false; });

  // Ruler: two picked points of the cloud.
  await page.evaluate(() => window.Viewer.toggleDistanceMeasurement());
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
  const points = await page.evaluate(() => window.Viewer.measurementDraft?.points.length
    ?? window.Viewer.ruler.reduce((sum, group) => sum + (group.userData.points?.length || 0), 0));
  expect(points).toBe(2);
});

test('LAS/LAZ decoding falls back to the main thread without module workers', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = undefined;
  });
  await openViewer(page, '/examples/points.laz');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const info = await page.evaluate(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    return root.children.find((child) => child.isPoints).userData.pointCloud;
  });
  expect(info.decoder).toBe('main-thread');
  expect(info.loadedPoints).toBe(100_000);
  expect(info.loading).toBe(false);
});

// The current view (window.viewer.captureFrame) as counts: pixels the model
// covers, their mean brightness.
async function frameStats(page) {
  return page.evaluate(async () => {
    const url = await window.viewer.captureFrame();
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let covered = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      covered++;
      sum += data[i] + data[i + 1] + data[i + 2];
    }
    return { covered, mean: covered ? sum / covered / 3 : 0 };
  });
}

test('WebGPU renderer (on its WebGL 2 backend): materials, ambient occlusion, scan views, section planes, area selection', async ({ page }) => {
  test.setTimeout(90_000);
  // A browser offering VR and AR, to see the WebGPU renderer turn them down.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: { isSessionSupported: async () => true, requestSession: async () => { throw new Error('no device'); } },
    });
  });
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'renderer=webgpu&webgpuBackend=webgl2');
  await waitForCameraIdle(page);
  expect(await page.evaluate(() => [window.viewer.rendererBackend, window.viewer.rendererDevice])).toEqual(['webgpu', 'webgl2']);
  await expect(page.locator('#credits')).toContainText('WebGPU renderer (WebGL 2)');

  const base = await frameStats(page);
  expect(base.covered).toBeGreaterThan(5000);

  // Ambient occlusion: a TSL pipeline, darker in the creases.
  const clickTool = (key) => page.evaluate((tool) => document.querySelector(`button[data-tool="${tool}"]`).click(), key);
  await clickTool('renderingAo');
  await expect.poll(() => page.evaluate(() => [window.viewer.ambientOcclusion, window.viewer.postProcessing])).toEqual([true, true]);
  const occluded = await frameStats(page);
  expect(occluded.mean).toBeLessThan(base.mean - 1);
  await clickTool('renderingAo');
  await expect.poll(() => page.evaluate(() => window.viewer.postProcessing)).toBe(false);

  // Scan views are node materials too; the GLSL one is the WebGL renderer's.
  await page.evaluate(() => window.Viewer.setShadingMode('clay', { silent: true }));
  expect((await frameStats(page)).mean).toBeGreaterThan(base.mean + 10);
  await page.evaluate(() => window.Viewer.setShadingMode('custom'));
  expect(await page.evaluate(() => window.Viewer.shadingMode)).toBe('clay');
  await page.evaluate(() => window.Viewer.toggleShadingPanel(true));
  await expect(page.locator('#viewerShading .viewer-shading_shader')).toBeHidden();
  await page.evaluate(() => window.Viewer.toggleShadingPanel(false));
  await page.evaluate(() => window.Viewer.setShadingMode('original', { silent: true }));

  // Section planes clip the model through clipping groups.
  await page.evaluate(() => {
    window.Viewer.toggleClippingPlanesPanel();
    window.Viewer.setClippingAxisPosition('x', 0);
  });
  await expect.poll(async () => (await frameStats(page)).covered, { timeout: 30_000 }).toBeLessThan(base.covered * 0.8);
  await page.evaluate(() => window.Viewer.toggleClippingPlanesPanel());

  // Area selection through the ID buffer, read back asynchronously.
  const faces = await page.evaluate(async () => {
    const rect = document.getElementById('MainCanvas').getBoundingClientRect();
    const hits = await window.Viewer.pickVisibleFacesInRect(
      rect.left + rect.width * 0.3, rect.top + rect.height * 0.2,
      rect.left + rect.width * 0.7, rect.top + rect.height * 0.8
    );
    return { count: hits.length, faceIndices: hits.every((hit) => Number.isInteger(hit.faceIndex)) };
  });
  expect(faces.count).toBeGreaterThan(50);
  expect(faces.faceIndices).toBe(true);

  // WebXR runs on the WebGL renderer only.
  await expect.poll(() => page.evaluate(() => window.Viewer.xr.checked && window.Viewer.xr.support)).toMatchObject({ vr: false, ar: false });
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

// On SwiftShader (no GPU) WebGPU renders on the CPU, slowly enough to
// starve the tests running next to it: opt in with WEBGPU_TESTS=1. The test
// above covers the same code on the WebGPU renderer's WebGL 2 backend.
test('WebGPU renderer on a WebGPU device', async ({ page }) => {
  test.skip(process.env.WEBGPU_TESTS !== '1', 'set WEBGPU_TESTS=1 to run on a WebGPU device');
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    // Headless SwiftShader loses the device once a WebGPU canvas presents:
    // the canvas frames go to a plain texture, and the frames are paced
    // (nothing else paces them without presentation).
    if (!navigator.gpu) return;
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 150);
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type !== 'webgpu') return getContext.call(this, type, ...rest);
      const canvas = this;
      let config = null;
      let texture = null;
      return {
        canvas,
        configure(value) { config = value; },
        unconfigure() { config = null; texture?.destroy(); texture = null; },
        getConfiguration() { return config; },
        getCurrentTexture() {
          const width = Math.max(1, canvas.width);
          const height = Math.max(1, canvas.height);
          if (!texture || texture.width !== width || texture.height !== height) {
            texture?.destroy();
            texture = config.device.createTexture({
              size: [width, height],
              format: config.format,
              usage: config.usage ?? (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC),
            });
          }
          return texture;
        },
      };
    };
  });
  await page.setViewportSize({ width: 480, height: 400 });
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'renderer=webgpu');
  await page.waitForFunction(() => window.viewer?.rendererBackend !== undefined, null, { timeout: 30_000 });
  test.skip(await page.evaluate(() => window.viewer.rendererBackend) !== 'webgpu', 'no WebGPU adapter in this browser');
  await waitForCameraIdle(page);
  expect(await page.evaluate(() => window.viewer.rendererDevice)).toBe('webgpu');
  await expect(page.locator('#credits')).toContainText('· WebGPU');

  const base = await frameStats(page);
  expect(base.covered).toBeGreaterThan(5000);
  await page.evaluate(() => document.querySelector('button[data-tool="renderingAo"]').click());
  await expect.poll(() => page.evaluate(() => window.viewer.ambientOcclusion)).toBe(true);
  expect((await frameStats(page)).mean).toBeLessThan(base.mean - 1);
  await page.evaluate(() => document.querySelector('button[data-tool="renderingAo"]').click());
  await page.evaluate(() => {
    window.Viewer.toggleClippingPlanesPanel();
    window.Viewer.setClippingAxisPosition('x', 0);
  });
  // Software WebGPU is slow: a frame read back can take seconds.
  await expect.poll(async () => (await frameStats(page)).covered, { timeout: 45_000 }).toBeLessThan(base.covered * 0.8);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('renderer choice: WebGL by default, WebGPU on request, WebGL for point clouds and splats', async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb');
  await waitForModel(page);
  expect(await page.evaluate(() => window.viewer.rendererBackend)).toBe('webgl');
  await expect(page.locator('#credits')).not.toContainText('WebGPU');

  // A splat scene keeps WebGL even when WebGPU is asked for.
  await openViewer(page, '/examples/tempietto/Tempietto.splat', 'renderer=webgpu&webgpuBackend=webgl2');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.viewer.rendererBackend)).toBe('webgl');

  // Without WebGPU in the browser: WebGL.
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }));
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'renderer=webgpu');
  await waitForModel(page);
  expect(await page.evaluate(() => window.viewer.rendererBackend)).toBe('webgl');
});

test('point cloud panel changes colours, shape and size, and only appears for point clouds', async ({ page }) => {
  // Three models one after another (LAZ, a streamed tileset, a GLB): about
  // 35 s on the CI runner's software WebGL, over the default 30 s.
  test.setTimeout(60_000);
  await openViewer(page, '/examples/points.laz');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const panel = page.locator('#viewerPointCloudPanel');
  await expect(panel).toBeVisible();
  // Size mode, shape, colour.
  const colorSelect = panel.locator('select').nth(2);
  await expect(colorSelect.locator('option')).toHaveText(['RGB', 'Intensity', 'Height']);
  await expect(panel.locator('select').nth(0).locator('option')).toHaveText(['Adaptive (scan density)', 'Fixed (pixels)']);
  // Eye-Dome Lighting for directly loaded clouds too.
  await expect(panel.locator('input[type=range]:visible')).toHaveCount(2);

  const pointsState = () => page.evaluate(() => {
    const points = window.Viewer.resolveObjectByTargetId('m0:root').children.find((child) => child.isPoints);
    const { material } = points;
    return {
      firstColors: Array.from(points.geometry.getAttribute('color').array.slice(0, 6)),
      colorMode: material.uniforms.uColorMode.value,
      round: Boolean(material.defines?.ROUND_POINTS !== undefined),
      size: material.size,
      minPointSize: material.minPointSize,
      edl: material.edlStrength,
      spacing: points.userData.pointSpacing,
    };
  });
  const before = await pointsState();
  // Adaptive: world units from the point spacing (centimetres in this scan).
  expect(before.spacing).toBeGreaterThan(0.005);
  expect(before.spacing).toBeLessThan(0.5);
  expect(before.size).toBeGreaterThan(before.spacing);
  expect(before.edl).toBeGreaterThan(0);

  await colorSelect.selectOption('height');
  await panel.locator('select').nth(1).selectOption('round');
  await panel.locator('input[type=range]').first().fill('75');
  const after = await pointsState();
  // Colours switch in the shader: the file's own colours stay in the buffer.
  expect(after.colorMode).toBe(2);
  expect(after.firstColors).toEqual(before.firstColors);
  expect(after.round).toBe(true);
  expect(after.size).toBeGreaterThan(before.size * 1.5);

  // Fixed size: pixels.
  await panel.locator('select').nth(0).selectOption('fixed');
  const fixed = await pointsState();
  expect(fixed.size).toBe(0);
  expect(fixed.minPointSize).toBeGreaterThan(2);

  // Back to the file's own colours; Eye-Dome Lighting off.
  await colorSelect.selectOption('rgb');
  await panel.locator('input[type=range]').nth(1).fill('0');
  const rgb = await pointsState();
  expect(rgb.colorMode).toBe(0);
  expect(rgb.edl).toBe(0);

  // Streamed clouds: Eye-Dome Lighting and level-of-detail colours through the plugin.
  await openViewer(page, '/examples/tiles/wolpa-points/tileset.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[type=range]:visible')).toHaveCount(2);
  await panel.locator('select').nth(1).selectOption('tile');
  await panel.locator('input[type=range]').nth(1).fill('0');
  const pluginState = await page.evaluate(() => {
    const state = window.Viewer.pointCloudState;
    return { debug: state.plugin.debugColorMode, edl: state.plugin.edlStrength };
  });
  expect(pluginState).toEqual({ debug: 'tile', edl: 0 });

  await openViewer(page, '/examples/box.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  await expect(panel).toHaveCount(0);
});

test('manifest thumbnails: the gallery shows the manifest\'s own renders, generic images without them', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  const gallery = () => page.locator('#image-list img').evaluateAll((imgs) => imgs.map((img) => ({ src: img.getAttribute('src'), alt: img.alt })));

  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect.poll(async () => (await gallery()).length).toBe(5);
  const own = await gallery();
  expect(own.every(({ src }) => src.includes('/examples/gallery/tempietto/Tempietto_'))).toBe(true);
  expect(own[2].alt).toBe('Back');
  expect(own[4].src).toContain('Tempietto_top.');

  // Another manifest without thumbnails: not the previous renders.
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/box-aim3d-local.json', 'url', 'aim3if'));
  await expect.poll(async () => (await gallery()).every(({ src }) => src.includes('explora4d-placeholder-'))).toBe(true);
  expect((await gallery()).length).toBe(9);
});

test('manifest versions: a newer MINOR opens with a notice, a newer MAJOR or an unreadable one asks for an update', async ({ page }) => {
  const [major, minor] = AIM3D_MANIFEST_VERSION.split('.').map(Number);
  expect(manifestVersionStatus({ AIM3DViewer: { version: AIM3D_MANIFEST_VERSION } }).state).toBe('current');
  expect(manifestVersionStatus({ AIM3DViewer: {} }).state).toBe('unversioned');
  expect(manifestVersionStatus('1.0', '1.1')).toMatchObject({ state: 'older', newer: false });
  expect(manifestVersionStatus('1.2', '1.1')).toMatchObject({ state: 'newer', newer: true, blocking: false });
  expect(manifestVersionStatus('2.0', '1.1')).toMatchObject({ state: 'incompatible', newer: true, blocking: true });
  expect(manifestVersionStatus('one', '1.1').state).toBe('unversioned');

  // The examples are written with this viewer's version.
  const dir = 'viewer/manifesto/examples';
  fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'index.json').forEach((name) => {
    const json = JSON.parse(fs.readFileSync(`${dir}/${name}`, 'utf8'));
    if (json.AIM3DViewer) expect(`${name} ${json.AIM3DViewer.version}`).toBe(`${name} ${AIM3D_MANIFEST_VERSION}`);
  });

  const base = JSON.parse(fs.readFileSync(`${dir}/box-aim3d-local.json`, 'utf8'));
  const withVersion = (version, change = () => {}) => {
    const manifest = structuredClone(base);
    manifest.AIM3DViewer.version = version;
    change(manifest);
    return manifest;
  };
  const newer = withVersion(`${major}.${minor + 1}`, (manifest) => { manifest.AIM3DViewer.futureBlock = { on: true }; });
  const unreadable = withVersion(`${major}.${minor + 1}`, (manifest) => { manifest.AIM3DViewer.camera.perspectiveMode = 'fisheye'; });
  const incompatible = withVersion(`${major + 1}.0`);
  expect(inspectAIM3DManifest(newer).version).toMatchObject({ state: 'newer', newer: true });
  expect(inspectAIM3DManifest(incompatible).version.blocking).toBe(true);

  await openViewer(page);
  await waitForModel(page);
  const dialog = page.locator('.viewer-form-dialog');
  const load = (manifest) => page.evaluate((text) => {
    window.viewer.toasts = [];
    window.viewer.errors = [];
    return window.Viewer.setupManifesto(text, 'text', 'aim3if');
  }, JSON.stringify(manifest));

  // A newer MINOR version: opened, with a notice.
  await load(newer);
  await expect.poll(() => page.evaluate(() => window.viewer.toasts.join(' '))).toContain('made for a newer viewer');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.currentManifest?.json?.AIM3DViewer?.futureBlock)).toEqual({ on: true });

  // Values this viewer cannot read in a newer one, and a newer MAJOR one:
  // not opened, a dialog with the way to a newer viewer - not "invalid".
  for (const manifest of [unreadable, incompatible]) {
    await load(manifest);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('A newer viewer is needed');
    await expect(dialog).toContainText(manifest.AIM3DViewer.version);
    await expect(dialog.locator('.viewer-confirm-ok')).toHaveText('Reload the page');
    expect(await page.evaluate(() => [...window.viewer.toasts, ...window.viewer.errors].join(' '))).not.toContain('Invalid');
    await dialog.locator('.viewer-confirm-cancel').click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => window.Viewer.currentManifest?.json?.AIM3DViewer?.version)).toBe(newer.AIM3DViewer.version);
  }

  // Imported over the model (the editor's import): the same.
  expect(await page.evaluate((json) => window.Viewer.import3IFManifest(json), incompatible)).toBe(false);
  await expect(dialog).toBeVisible();
});

test('gallery lightbox: views open from the keyboard, browse, zoom and close back to their thumbnail', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect(page.locator('#image-list img')).toHaveCount(5);
  const lightbox = page.locator('#modalGallery');
  // The drawer starts hidden.
  await page.locator('.image-list-drawer-toggle').click();

  const thumb = page.locator('#image-list .field__item').nth(1);
  await expect(thumb).toHaveAttribute('data-number', '02');
  await thumb.focus();
  await page.keyboard.press('Enter');
  await expect(lightbox).toHaveClass(/is-open/);
  await expect(page.locator('.closeGallery')).toBeFocused();
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('02');
  await expect(page.locator('.galleryFilmstripItem')).toHaveCount(5);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.galleryCaptionText')).toHaveText('Back');
  await page.keyboard.press('End');
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('05');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('01');

  await page.keyboard.press('+');
  await expect(page.locator('.galleryZoomReset')).toBeVisible();
  await page.keyboard.press('0');
  await expect(page.locator('.galleryZoomReset')).toBeHidden();

  await page.locator('.galleryFilmstripItem').nth(3).click();
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('04');
  await page.keyboard.press('Escape');
  await expect(lightbox).not.toHaveClass(/is-open/);
  await expect(page.locator('#image-list .field__item').nth(3)).toBeFocused();
});

test('the drawer tab stands out with the model\'s own views, not with the generic images', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect(page.locator('#image-list img')).toHaveCount(5);
  const drawer = page.locator('.image-list-drawer');
  await expect(drawer).toHaveClass(/has-model-views/);
  await expect(drawer.locator('.image-list-drawer-preview img')).toHaveAttribute('src', /\/examples\/gallery\/tempietto\/Tempietto_/);

  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/box-aim3d-local.json', 'url', 'aim3if'));
  await expect(page.locator('#image-list img')).toHaveCount(9);
  await expect(page.locator('.image-list-drawer')).not.toHaveClass(/has-model-views/);
  await expect(page.locator('.image-list-drawer-preview')).toHaveCount(0);
  await expect(page.locator('.image-list-drawer-toggle svg').first()).toBeVisible();
});

test('on a phone the lightbox is a slider: the view follows the finger and slides on to its neighbour', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 780 });
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect(page.locator('#image-list img')).toHaveCount(5);
  await page.locator('.image-list-drawer-toggle').click();
  await expect(page.locator('#modalGallery')).toHaveClass(/is-open/);
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('01');

  const stage = await page.locator('.galleryStage').boundingBox();
  const y = stage.y + stage.height / 2;
  const x = stage.x + stage.width * 0.8;
  // At a finger's pace (an event a frame), not all at once - a flick is
  // told by its speed.
  const drag = (to, from = x) => page.evaluate(async ({ from, to, y }) => {
    const target = document.querySelector('.galleryStage');
    const fire = (type, clientX) => target.dispatchEvent(new PointerEvent(type, {
      pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX, clientY: y,
    }));
    fire('pointerdown', from);
    for (let i = 1; i <= 6; i++) {
      fire('pointermove', from + ((to - from) * i) / 6);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const track = document.querySelector('.galleryTrack');
    const moved = new DOMMatrix(getComputedStyle(track).transform).m41;
    const ghostShown = getComputedStyle(document.querySelector('.galleryGhost--next')).visibility;
    fire('pointerup', to);
    return { moved, ghostShown };
  }, { from, to, y });

  // A short drag: follows the finger 1:1, then springs back.
  const short = await drag(x - 40);
  expect(Math.round(short.moved)).toBe(-40);
  expect(short.ghostShown).toBe('visible');
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('01');
  await expect.poll(() => page.locator('.galleryStage').getAttribute('class')).not.toContain('is-sliding');

  // Past a quarter of the width: on to the next view.
  await drag(x - stage.width * 0.5);
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('02');
  await expect.poll(() => page.locator('.galleryTrack').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  // And back, the other way.
  const left = stage.x + stage.width * 0.2;
  await drag(left + stage.width * 0.5, left);
  await expect(page.locator('.galleryCaptionNumber')).toHaveText('01');
});

test('the gallery is a drawer on the viewer\'s right edge, hidden at first: its tab opens it, full height, and it is remembered', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect(page.locator('#image-list img')).toHaveCount(5);
  const drawer = page.locator('#DFG_3DViewer .image-list-drawer');
  const toggle = drawer.locator('.image-list-drawer-toggle');
  await expect(drawer).toHaveClass(/is-collapsed/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle.locator('.image-list-drawer-count')).toHaveText('5');

  // Inside the canvas, on its right edge, from top to bottom.
  const layout = () => page.evaluate(() => {
    const viewer = document.getElementById('DFG_3DViewer').getBoundingClientRect();
    const column = document.querySelector('.image-list-drawer .image-list-scroller').getBoundingClientRect();
    return {
      right: Math.round(viewer.right - column.right),
      top: Math.round(column.top - viewer.top),
      bottom: Math.round(viewer.bottom - column.bottom),
    };
  });
  expect((await layout()).right).toBeLessThan(0);

  await toggle.click();
  await expect(drawer).not.toHaveClass(/is-collapsed/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const open = await layout();
  expect(open.right).toBeGreaterThanOrEqual(0);
  expect(open.right).toBeLessThanOrEqual(12);
  expect(open.top).toBeLessThanOrEqual(12);
  expect(open.bottom).toBeLessThanOrEqual(12);

  // Remembered: the next gallery starts open, then hidden again once closed.
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect(page.locator('.image-list-drawer')).not.toHaveClass(/is-collapsed/);
  await page.locator('.image-list-drawer-toggle').click();
  await expect(page.locator('.image-list-drawer')).toHaveClass(/is-collapsed/);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-thumbnails.json', 'url', 'aim3if'));
  await expect(page.locator('.image-list-drawer')).toHaveClass(/is-collapsed/);
});

test('manifest thumbnails stay above the viewer when the manifest makes it a movable window', async ({ page }) => {
  // The row above the viewer: viewer.gallery.position "top".
  await page.route('**/viewer-settings.json', async (route) => {
    const settings = await (await route.fetch()).json();
    settings.viewer.gallery = { ...settings.viewer.gallery, position: 'top' };
    await route.fulfill({ json: settings });
  });
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(async () => {
    const manifest = await (await fetch('./manifests/tempietto-aim3d-thumbnails.json')).json();
    manifest.AIM3DViewer.viewer.window = { position: { x: 40, y: 260 }, size: { width: 640, height: 420 } };
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text', 'aim3if');
  });
  await expect(page.locator('#image-list img')).toHaveCount(5);
  const layout = await page.evaluate(() => {
    const container = document.getElementById('DFG_3DViewer');
    const placeholder = container.previousElementSibling;
    const gallery = document.getElementById('image-list').closest('.image-list-scroller');
    return {
      placeholder: placeholder?.classList.contains('viewer-window-placeholder'),
      // The gallery first, then where the viewer stood, then the window.
      galleryFirst: Boolean(gallery.compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_FOLLOWING),
      above: gallery.getBoundingClientRect().bottom <= placeholder.getBoundingClientRect().top + 1,
    };
  });
  expect(layout).toEqual({ placeholder: true, galleryFirst: true, above: true });
});

test('IIIF Presentation 4 scenes: camera, lights, transforms and point comments round-trip', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/box-iiif-p4.json', 'url', 'iiif'));

  const sceneState = () => page.evaluate(() => {
    const viewer = window.Viewer;
    const round = (values) => values.map((value) => Math.round(value * 1000) / 1000);
    const root = viewer.resolveObjectByTargetId('m0:root');
    const lights = [];
    viewer.scene.traverse((object) => {
      if (object.isAmbientLight || object.isSpotLight || object.isDirectionalLight) {
        lights.push(`${object.type}:#${object.color.getHexString()}`);
      }
    });
    return {
      camera: round(viewer.camera.position.toArray()),
      target: round(viewer.controls.target.toArray()),
      fov: Math.round(viewer.camera.fov),
      scale: round(root.scale.toArray()),
      lights,
      comments: viewer.getAnnotationEntriesForPersistence().map((entry) => ({
        title: entry.title,
        center: round(viewer.getAnnotationEntryCenter(entry).toArray()),
        view: entry.view ? round(entry.view.position) : null,
      })),
      markers: viewer.annotationPOIMarkers.length,
    };
  });

  const imported = await sceneState();
  // The manifest's own camera, not the viewer's intro flight.
  expect(imported.camera).toEqual([2, 3, 6]);
  expect(imported.target).toEqual([0, 0.5, 0]);
  expect(imported.fov).toBe(40);
  // ScaleTransform on the model's SpecificResource.
  expect(imported.scale).toEqual([1.5, 1.5, 1.5]);
  expect(imported.lights).toEqual(expect.arrayContaining(['AmbientLight:#ffe8d0', 'SpotLight:#6ea8ff']));
  // Comments on scene points; the first one has its view from `scope`.
  expect(imported.comments).toEqual([
    { title: 'Top face', center: [0, 1.5, 0], view: [0.5, 6, 1] },
    { title: 'Corner', center: [0.75, 0.75, 0.75], view: null },
  ]);
  expect(imported.markers).toBe(2);

  // Export: Presentation 4 structure.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  const scene = manifest.items[0];
  const painted = scene.items[0].items.map((annotation) => (
    annotation.body.type === 'SpecificResource' ? `SpecificResource(${annotation.body.source.type})` : annotation.body.type
  ));
  expect(painted[0]).toBe('SpecificResource(Model)');
  expect(scene.items[0].items[0].body.transform).toEqual([{ type: 'ScaleTransform', x: 1.5, y: 1.5, z: 1.5 }]);
  expect(painted[1]).toBe('PerspectiveCamera');
  expect(painted).toEqual(expect.arrayContaining(['AmbientLight', 'SpotLight']));
  const [topComment, cornerComment] = scene.annotations[0].items;
  expect(topComment.target.selector[0]).toEqual({ type: 'PointSelector', x: 0, y: 1.5, z: 0 });
  expect(topComment.scope).toHaveLength(1);
  const scopeCamera = scene.items[0].items.find((annotation) => annotation.id === topComment.scope[0].id);
  expect(scopeCamera.body.type).toBe('PerspectiveCamera');
  expect(cornerComment.scope).toBeUndefined();

  // Round trip through our own export.
  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), manifest);
  const reimported = await sceneState();
  expect(reimported.scale).toEqual(imported.scale);
  expect(reimported.camera).toEqual(imported.camera);
  expect(reimported.comments).toEqual(imported.comments);
  expect(reimported.lights).toEqual(imported.lights);
  const spotLight = () => page.evaluate(() => {
    let spot = null;
    window.Viewer.scene.traverse((object) => { if (object.isSpotLight) spot = object; });
    return spot && {
      angle: Math.round(spot.angle * 1000) / 1000,
      decay: spot.decay,
      target: spot.target.position.toArray().map((value) => Math.round(value * 1000) / 1000),
    };
  });
  expect(await spotLight()).toEqual({ angle: Math.round((25 * Math.PI / 180) * 1000) / 1000, decay: 0, target: expect.any(Array) });

  // Importing again replaces the imported lights instead of adding more.
  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), manifest);
  expect((await sceneState()).lights).toEqual(imported.lights);
});

test('Level of Certainty: objects and groups get see-through colour overlays by level, with a legend, and round-trip', async ({ page }) => {
  // The same 33 parts (m0:0.0 - m0:0.32, group m0:0) as the Wolpa synagogue.
  await openViewer(page, '/examples/compressed.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });

  const state = () => page.evaluate(() => {
    const viewer = window.Viewer;
    // The colour of a part's overlay, or null without one.
    const overlayOf = (targetId) => viewer.resolveObjectByTargetId(targetId).children
      .find((child) => child.userData.isCertaintyOverlay);
    const colorOf = (targetId) => {
      const overlay = overlayOf(targetId);
      return overlay ? `#${overlay.material.color.getHexString()}` : null;
    };
    return {
      view: viewer.certaintyView,
      walls: colorOf('m0:0.4'),
      roof: colorOf('m0:0.3'),
      door: colorOf('m0:0.14'),
      legend: Array.from(document.querySelectorAll('.certainty-legend__row')).map((row) => (
        `${row.querySelector('.certainty-legend__swatch').textContent}${row.querySelector('.certainty-legend__code').textContent}:${row.querySelector('.certainty-legend__count')?.textContent ?? '-'}`
      )),
      markers: viewer.annotationPOIMarkers.length,
      opacity: overlayOf('m0:0.4')?.material.opacity ?? null,
      slider: document.querySelector('.certainty-legend__opacity output')?.textContent ?? null,
      certainties: viewer.getAnnotationEntriesForPersistence().map((entry) => entry.certainty || null),
    };
  });

  const ownMaterial = await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.__ownWallMaterial = viewer.resolveObjectByTargetId('m0:0.4').material;
    viewer.annotationEntries = [
      // The walls, on their own: level B (8-9).
      { id: 'loc-walls', targetId: 'm0:0.4', object: 'm0:0.4', faceIndex: 0, faceNumbers: [0], title: 'Walls', description: '', certainty: { value: 9, scope: 'object' } },
      // The roof's group (the whole building): level E, under the walls' own level.
      { id: 'loc-roof', targetId: 'm0:0.3', object: 'm0:0.3', faceIndex: 0, faceNumbers: [0], title: 'Roof', description: '', certainty: { value: 2, scope: 'group' } },
    ];
    viewer.setCertaintyView(true);
    return true;
  });
  expect(ownMaterial).toBe(true);

  const painted = await state();
  expect(painted.view).toBe(true);
  expect(painted.walls).toBe('#2166ac');
  expect(painted.roof).toBe('#c51b7d');
  // Not annotated itself, but in the assessed group.
  expect(painted.door).toBe('#c51b7d');
  // Each level by symbol and code, with how many objects are assessed at it.
  expect(painted.legend).toEqual(['✓A:0', '■B:1', '▲C:0', '≈D:0', '?E:1', '–:-']);
  expect(painted.markers).toBe(2);
  // The model shows through the overlays: 40% opaque by default.
  expect(painted.opacity).toBeCloseTo(0.4);
  expect(painted.slider).toBe('40%');
  // The legend's slider sets every overlay's opacity.
  await page.locator('.certainty-legend__opacity input').fill('70');
  expect((await state()).opacity).toBeCloseTo(0.7);
  expect((await state()).slider).toBe('70%');
  expect(await page.locator('[data-tool="certainty"]').getAttribute('aria-pressed')).toBe('true');

  // Clicking a legend swatch filters: only that level stays painted (and
  // badged), its swatch ringed; clicking it again shows every level.
  const swatchB = page.locator('.certainty-legend__row[data-code="B"] .certainty-legend__swatch');
  await swatchB.click();
  const filtered = await state();
  expect(filtered.walls).toBe('#2166ac');
  expect(filtered.roof).toBeNull();
  expect(filtered.door).toBeNull();
  expect(filtered.markers).toBe(1);
  await expect(swatchB).toHaveAttribute('aria-pressed', 'true');
  await expect(swatchB).toHaveClass(/is-active/);
  await expect(page.locator('.certainty-legend__row[data-code="E"]')).toHaveClass(/is-filtered-out/);
  // Several levels at once.
  await page.locator('.certainty-legend__row[data-code="E"] .certainty-legend__swatch').click();
  expect((await state()).roof).toBe('#c51b7d');
  expect((await state()).markers).toBe(2);
  await page.locator('.certainty-legend__row[data-code="E"] .certainty-legend__swatch').click();
  await swatchB.click();
  const unfiltered = await state();
  expect(unfiltered.roof).toBe('#c51b7d');
  expect(unfiltered.markers).toBe(2);
  await expect(swatchB).toHaveAttribute('aria-pressed', 'false');
  expect(unfiltered.opacity).toBeCloseTo(0.7);

  // Select none / all: one button, its label following the selection.
  const selectAll = page.locator('.certainty-legend__select-all');
  await expect(selectAll).toHaveText('Select none');
  await selectAll.click();
  const none = await state();
  expect(none.walls).toBeNull();
  expect(none.roof).toBeNull();
  expect(none.markers).toBe(0);
  await expect(page.locator('.certainty-legend__swatch.is-active')).toHaveCount(0);
  await expect(selectAll).toHaveText('Select all');
  await selectAll.click();
  const all = await state();
  expect(all.walls).toBe('#2166ac');
  expect(all.roof).toBe('#c51b7d');
  expect(all.markers).toBe(2);
  // Every level ringed, the unassessed one too.
  await expect(page.locator('.certainty-legend__swatch.is-active')).toHaveCount(6);
  await expect(selectAll).toHaveText('Select none');
  // Dropping one level from "all" leaves the rest.
  await swatchB.click();
  expect((await state()).walls).toBeNull();
  expect((await state()).roof).toBe('#c51b7d');
  await expect(selectAll).toHaveText('Select all');
  await page.evaluate(() => window.Viewer.setCertaintyFilter(null));

  // Export: the scale, an "assessing" motivation and the assessment.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.certainty.levels.map((level) => level.code)).toEqual(['A', 'B', 'C', 'D', 'E']);
  expect(manifest.AIM3DViewer.certainty.visible).toBe(true);
  expect(manifest.AIM3DViewer.certainty.opacity).toBeCloseTo(0.7);
  const [walls, roof] = manifest.items[0].annotations[0].items;
  expect(walls.motivation).toEqual(['commenting', 'assessing']);
  expect(walls.AIM3DViewer.certainty).toEqual({ value: 9, scope: 'object' });
  expect(roof.AIM3DViewer.certainty).toEqual({ value: 2, scope: 'group' });

  // The meshes keep their own materials; switching the view off removes
  // the overlays.
  const restored = await page.evaluate(() => {
    const viewer = window.Viewer;
    const keptWhileOn = viewer.resolveObjectByTargetId('m0:0.4').material === viewer.__ownWallMaterial;
    viewer.setCertaintyView(false);
    let overlays = 0;
    viewer.resolveObjectByTargetId('m0:root').traverse((child) => {
      if (child.userData.isCertaintyOverlay) overlays += 1;
    });
    return {
      keptWhileOn,
      same: viewer.resolveObjectByTargetId('m0:0.4').material === viewer.__ownWallMaterial,
      overlays,
      legend: document.querySelectorAll('.certainty-legend').length,
    };
  });
  expect(restored).toEqual({ keptWhileOn: true, same: true, overlays: 0, legend: 0 });

  // Import: the manifest opens in the view (visible), assessments kept.
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  const reimported = await state();
  expect(reimported.view).toBe(true);
  expect(reimported.walls).toBe('#2166ac');
  // The exported opacity comes back with the scale.
  expect(reimported.opacity).toBeCloseTo(0.7);
  expect(reimported.certainties).toEqual([{ value: 9, scope: 'object' }, { value: 2, scope: 'group' }]);

  // The XML saved to Drupal keeps them too.
  const fromXml = await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.importAnnotationsFromIIIFXml(viewer.exportAnnotationsToIIIFXml());
    return viewer.getAnnotationEntriesForPersistence().map((entry) => entry.certainty);
  });
  expect(fromXml).toEqual(reimported.certainties);

  // A value outside the scale is refused on import.
  const invalid = structuredClone(manifest);
  invalid.items[0].annotations[0].items[0].AIM3DViewer.certainty.value = 12;
  expect(await page.evaluate((json) => window.Viewer.import3IFManifest(json), invalid)).toBe(false);

  // A manifest without a scale, imported over the open view, closes it.
  const plain = structuredClone(manifest);
  delete plain.AIM3DViewer.certainty;
  plain.items[0].annotations[0].items.forEach((annotation) => { delete annotation.AIM3DViewer?.certainty; });
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), plain);
  expect((await state()).view).toBe(false);
  await expect(page.locator('.certainty-legend')).toHaveCount(0);

  // Switching models switches the view off and forgets the scale and the
  // filter; the next manifest decides again.
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  await page.locator('.certainty-legend__row[data-code="B"] .certainty-legend__swatch').click();
  const switched = await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.resetLoadedModelState();
    return {
      view: viewer.certaintyView,
      filter: viewer.certaintyFilter,
      fromManifest: viewer.certaintyScaleFromManifest,
      opacity: viewer.certaintyScale.opacity,
      legend: document.querySelectorAll('.certainty-legend').length,
      pressed: document.querySelector('[data-tool="certainty"]')?.getAttribute('aria-pressed'),
    };
  });
  expect(switched).toEqual({ view: false, filter: null, fromManifest: false, opacity: 0.4, legend: 0, pressed: 'false' });
});

test('shading modes: the original materials come back untouched, switched-out ones are released, scan views and manifests', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page, '/examples/compressed.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });

  // A textured part of the model, with its loader material.
  const prepared = await page.evaluate(() => {
    const viewer = window.Viewer;
    let mesh = null;
    viewer.resolveObjectByTargetId('m0:root').traverse((child) => {
      if (!mesh && child.isMesh && !Array.isArray(child.material) && child.material.map) mesh = child;
    });
    viewer.__shadingMesh = mesh;
    viewer.__shadingOriginal = mesh.material;
    return { mode: viewer.shadingMode, type: mesh.material.type };
  });
  expect(prepared.mode).toBe('original');

  const material = () => page.evaluate(() => {
    const viewer = window.Viewer;
    const current = viewer.__shadingMesh.material;
    return {
      type: current.type,
      original: current === viewer.__shadingOriginal,
      map: Boolean(current.map),
      sameMap: current.map === viewer.__shadingOriginal.map,
      flat: current.flatShading === true,
      sharedPlanes: current.clippingPlanes === viewer.__shadingOriginal.clippingPlanes,
    };
  });

  // Phong is made from the original; leaving it releases it, and "original"
  // puts back the very material the loader made.
  await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.setShadingMode('phong', { silent: true });
    viewer.__released = false;
    viewer.__shadingMesh.material.addEventListener('dispose', () => { viewer.__released = true; });
  });
  expect((await material()).type).toBe('MeshPhongMaterial');
  // The shading window, opened by its tool (in the toolbar's folded tray).
  await page.evaluate(() => document.querySelector('button[data-tool="shading"]').click());
  await expect(page.locator('#viewerShading')).toBeVisible();
  await expect(page.locator('#viewerShading [data-mode="phong"]')).toHaveClass(/is-active/);
  await page.locator('#viewerShading [data-mode="original"]').click();
  expect(await material()).toMatchObject({ original: true, type: prepared.type });
  expect(await page.evaluate(() => window.Viewer.__released)).toBe(true);
  await expect(page.locator('#viewerShading [data-mode="original"]')).toHaveClass(/is-active/);
  // Minimized to its icon, and closed.
  await page.locator('#viewerShading .tool-panel-chrome_minimize').click();
  await expect(page.locator('#viewerShading')).toHaveClass(/is-minimized/);
  await page.locator('#viewerShading .tool-panel-chrome_pip').click();
  await page.locator('#viewerShading .viewer-scene_header .viewer-scene_icon').click();
  await expect(page.locator('#viewerShading')).toHaveCount(0);

  // Scan views: flat keeps the material and its maps, faceted; clay and
  // matcap drop the texture; normals.
  await page.evaluate(() => window.Viewer.setShadingMode('flat', { silent: true }));
  expect(await material()).toMatchObject({ type: prepared.type, original: false, flat: true, sameMap: true, sharedPlanes: true });
  await page.evaluate(() => window.Viewer.setShadingMode('clay', { silent: true }));
  expect(await material()).toMatchObject({ type: 'MeshStandardMaterial', map: false });
  await page.evaluate(() => window.Viewer.setShadingMode('matcap', { silent: true }));
  expect(await material()).toMatchObject({ type: 'MeshMatcapMaterial', map: false });
  await page.evaluate(() => window.Viewer.setShadingMode('normals', { silent: true }));
  expect((await material()).type).toBe('MeshNormalMaterial');
  // The original is still the loader's, not touched by the switches.
  expect(await page.evaluate(() => window.Viewer.__shadingOriginal.flatShading)).toBe(false);

  // Manifests: a mode is exported and read back; the materials as loaded
  // are the default and left out; "standard", the old default, reads as
  // the original materials.
  await page.evaluate(() => window.Viewer.setShadingMode('clay', { silent: true }));
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.modelTransform.shadingMode).toBe('clay');
  await page.evaluate(() => window.Viewer.setShadingMode('original', { silent: true }));
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.modelTransform.shadingMode)).toBeUndefined();
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  expect(await page.evaluate(() => window.Viewer.shadingMode)).toBe('clay');
  const legacy = structuredClone(manifest);
  legacy.AIM3DViewer.modelTransform.shadingMode = 'standard';
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), legacy);
  expect(await page.evaluate(() => window.Viewer.shadingMode)).toBe('original');
  expect((await material()).original).toBe(true);

  // A new model is shown with its own materials.
  await page.evaluate(() => window.Viewer.setShadingMode('matcap', { silent: true }));
  await page.evaluate(() => window.Viewer.resetLoadedModelState());
  expect(await page.evaluate(() => window.Viewer.shadingMode)).toBe('original');
});

test('4D timeline: plays in a loop at 0.5× unless the manifest says otherwise', async ({ page }) => {
  test.setTimeout(120_000);
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  const open = (playback) => page.evaluate(async (playback) => {
    const manifest = await (await fetch('/manifests/wolpa-synagogue-aim3d-local-4d.json')).json();
    manifest.AIM3DViewer.timeline.playback = playback;
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  }, playback);
  const state = () => page.evaluate(() => {
    const { loop, speed, ui } = window.Viewer.timelineState;
    return { loop, speed, select: ui?.speedSelect.value, exported: window.Viewer.build3IFManifest().AIM3DViewer.timeline.playback };
  });

  await open({ autoplay: false, yearsPerSecond: 10 });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.timelineState, null, { timeout: 60_000 });
  const defaults = await state();
  expect(defaults).toMatchObject({ loop: true, speed: 0.5, select: '0.5' });
  expect(defaults.exported.loop).toBe(true);
  expect(defaults.exported.speed).toBeUndefined();

  // A speed chosen in the panel survives the reload, so the panel's speed
  // is reset first to see the manifest's own.
  await page.evaluate(() => window.Viewer.disposeTimeline());
  await open({ autoplay: false, loop: false, speed: 2, yearsPerSecond: 10 });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.timelineState, null, { timeout: 60_000 });
  const own = await state();
  expect(own).toMatchObject({ loop: false, speed: 2, select: '2' });
  expect(own.exported).toMatchObject({ loop: false, speed: 2 });
});

test('reconstruction variants: one shown at a time, compared by a swipe or side by side, with timeline years too, and round-trip', async ({ page }) => {
  test.setTimeout(120_000);
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  const open = (url) => page.evaluate(async (url) => {
    const manifest = await (await fetch(url)).json();
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  }, url);
  await open('/manifests/tempietto-aim3d-variants.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.variantsState, null, { timeout: 60_000 });

  const visible = () => page.evaluate(() => {
    const root = window.Viewer.variantsRoots[0];
    const shown = (name) => root.getObjectByName(name)?.visible;
    return { roof: shown('Roof_Hypothesis'), column: shown('Column_4_Reconstructed'), stump: shown('Column_4_Stump'), cella: shown('Cella') };
  });

  // The manifest's active variant: its nodes shown, the other's hidden, the rest as it is.
  expect(await page.evaluate(() => window.Viewer.variantsState.items.map((item) => [item.id, item.objects.length]))).toEqual([['roofed', 3], ['open', 2]]);
  expect(await visible()).toEqual({ roof: true, column: true, stump: false, cella: true });
  // The panel: one radio per variant, its Level of Certainty as a badge.
  await expect(page.locator('#viewerVariants .viewer-variants_item')).toHaveCount(2);
  await expect(page.locator('#viewerVariants .viewer-variants_item.is-active')).toHaveAttribute('data-variant', 'roofed');
  await expect(page.locator('#viewerVariants .viewer-variants_badge').first()).toHaveText(/^D/);
  await page.locator('#viewerVariants [data-variant="open"]').click();
  expect(await visible()).toEqual({ roof: false, column: false, stump: true, cella: true });

  // The manifest opens the comparison: both sides drawn every frame, the
  // scene left as the panel shows it in between.
  expect(await page.evaluate(() => window.Viewer.getCompareForExport())).toEqual({
    mode: 'swipe', left: { variant: 'roofed' }, right: { variant: 'open' }, position: 0.5,
  });
  await expect(page.locator('#viewerCompare')).toBeVisible();
  const drawn = await page.evaluate(() => new Promise((resolve) => {
    const viewer = window.Viewer;
    const original = viewer.applyCompareSide;
    const sides = [];
    viewer.applyCompareSide = (side) => {
      sides.push(JSON.stringify(side));
      return original(side);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      viewer.applyCompareSide = original;
      resolve(sides.slice(-2));
    }));
  }));
  expect(drawn).toEqual(['{"variant":"roofed"}', '{"variant":"open"}']);
  expect(await visible()).toEqual({ roof: false, column: false, stump: true, cella: true });

  // The divider follows the keyboard; the mode switches to side by side.
  await page.locator('.viewer-compare_handle').focus();
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => window.Viewer.compareState.position)).toBeCloseTo(0.48, 5);
  await page.locator('.viewer-compare_mode').click();
  expect(await page.evaluate(() => window.Viewer.compareState.mode)).toBe('split');
  expect((await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.compare)).position).toBeUndefined();

  // Round-trip: the variants and the comparison come back from an export.
  await page.evaluate(() => window.Viewer.setCompareMode('swipe'));
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  expect(manifest.AIM3DViewer.variants.active).toBe('open');
  expect(manifest.AIM3DViewer.variants.items.map((item) => item.nodes)).toEqual([
    ['Roof_Hypothesis', 'Column_4_Reconstructed', 'Glazing'],
    ['Column_4_Stump', 'Fallen_Drum'],
  ]);
  await page.locator('.viewer-compare_close').click();
  await expect(page.locator('#viewerCompare')).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.compare)).toBeUndefined();
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  expect(await page.evaluate(() => [window.Viewer.variantsState.active, window.Viewer.isComparing()])).toEqual(['open', true]);

  // Invalid manifests are reported.
  const broken = structuredClone(manifest);
  broken.AIM3DViewer.variants.active = 'missing';
  broken.AIM3DViewer.compare = { mode: 'overlay', left: {} };
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual([
    '$.AIM3DViewer.variants.active',
    '$.AIM3DViewer.compare.mode',
    '$.AIM3DViewer.compare.left',
  ]);

  // Two years of the timeline: the stage of each year drawn on its side,
  // the year shown left as it is.
  await page.evaluate(() => window.Viewer.disposeVariants());
  await open('/manifests/tempietto-aim3d-4d.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.timelineState, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.Viewer.pauseTimeline();
    window.Viewer.setTimelineYear(1520, { immediate: true });
  });
  expect(await page.evaluate(() => window.Viewer.hasVariants())).toBe(false);
  await page.locator('.viewer-timeline_compare').click();
  expect(await page.evaluate(() => window.Viewer.getCompareForExport())).toMatchObject({ left: { year: 1520 }, right: { year: 2024 } });
  await expect(page.locator('.viewer-timeline_compare')).toHaveAttribute('aria-pressed', 'true');
  // A year between stages shows the last stage reached.
  expect(await page.evaluate(() => window.Viewer.resolveCompareSide('1900').side)).toEqual({ year: 1783 });
  const stageNodes = await page.evaluate(() => new Promise((resolve) => {
    const viewer = window.Viewer;
    const original = viewer.renderCompareFrame;
    const seen = [];
    viewer.renderCompareFrame = (renderFrame) => original((...args) => {
      seen.push(viewer.timelineState.visualStages.map((stage) => stage.objects.some((object) => object.visible)));
      return renderFrame(...args);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      viewer.renderCompareFrame = original;
      resolve(seen.slice(-2));
    }));
  }));
  const stages = await page.evaluate(() => window.Viewer.timelineState.visualStages.map((stage) => stage.year));
  expect(stageNodes[0][stages.indexOf(1520)]).toBe(true);
  expect(stageNodes[1][stages.indexOf(2024)]).toBe(true);
  expect(await page.evaluate(() => window.Viewer.getTimelineYear())).toBe(1520);
  await page.locator('.viewer-timeline_compare').click();
  expect(await page.evaluate(() => window.Viewer.isComparing())).toBe(false);
});

test('historical photos on site: the camera with the photo over it, aligned by gestures, saved and closed', async ({ page }) => {
  test.setTimeout(120_000);
  // A camera that films a moving gradient.
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    let frame = 0;
    setInterval(() => {
      frame += 1;
      context.fillStyle = `hsl(${frame % 360}, 60%, 50%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }, 50);
    const stream = canvas.captureStream(20);
    (window as any).__cameraAsked = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { (window as any).__cameraAsked += 1; return stream; } },
    });
  });
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await page.evaluate(async () => {
    const manifest = await (await fetch('/manifests/tempietto-aim3d-photos.json')).json();
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.getPhotos().length, null, { timeout: 60_000 });
  await page.locator('#viewerPhotos [data-photo="veduta-1783"]').click();

  // The photo's card opens the camera, full screen, with the photo over it.
  await page.locator('#viewerPhotos .viewer-photos_onsite').click();
  const onSite = page.locator('#viewerPhotoOnSite');
  await expect(onSite).toBeVisible();
  await expect(onSite).not.toHaveClass(/is-starting/);
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewerPhotoOnSite');
    return root?.querySelector('video')?.videoWidth > 0 && root.querySelector('img')?.naturalWidth > 0;
  });
  expect(await page.evaluate(() => (window as any).__cameraAsked)).toBe(1);
  await expect(onSite.locator('.viewer-onsite_title')).toContainText('1783');
  expect(await onSite.locator('.viewer-onsite_layer').evaluate((node) => (node as HTMLElement).style.opacity)).toBe('0.5');

  // One finger moves the photo, the wheel scales it.
  const box = await onSite.locator('.viewer-onsite_stage').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const dx = Math.round(box!.width * 0.1);
  const dy = Math.round(box!.height * 0.1);
  await page.mouse.move(box!.x + box!.width / 2 + dx, box!.y + box!.height / 2 + dy, { steps: 4 });
  await page.mouse.up();
  const moved = await page.evaluate(() => window.Viewer.getPhotoOnSiteAlignment());
  expect(moved.x).toBeCloseTo(0.1, 2);
  expect(moved.y).toBeCloseTo(0.1, 2);
  await page.mouse.wheel(0, -200);
  expect(await page.evaluate(() => window.Viewer.getPhotoOnSiteAlignment().scale)).toBeGreaterThan(1);
  await expect(onSite.locator('.viewer-onsite_frame')).toHaveAttribute('style', new RegExp(`translate\\(${dx}px, ${dy}px\\)`));

  // Divider, and the photo alone while "then" is held.
  await onSite.locator('.viewer-onsite_button', { hasText: 'Divider' }).click();
  await expect(onSite.locator('.viewer-onsite_divider')).toBeVisible();
  expect(await onSite.locator('.viewer-onsite_layer').evaluate((node) => (node as HTMLElement).style.clipPath)).toBe('inset(0px 50% 0px 0px)');
  const peek = onSite.locator('.viewer-onsite_peek');
  const peekBox = await peek.boundingBox();
  await page.mouse.move(peekBox!.x + 5, peekBox!.y + 5);
  await page.mouse.down();
  await expect(onSite).toHaveClass(/is-peeking/);
  await page.mouse.up();
  await expect(onSite).not.toHaveClass(/is-peeking/);

  // The comparison is saved as an image.
  const download = page.waitForEvent('download');
  await onSite.locator('.viewer-onsite_button', { hasText: 'Save comparison' }).click();
  expect((await download).suggestedFilename()).toMatch(/^1783-.*-today\.jpg$/);

  // Reset, then closed: the camera is stopped; the alignment stays with the photo.
  await onSite.locator('.viewer-onsite_button', { hasText: 'Reset' }).click();
  expect(await page.evaluate(() => window.Viewer.getPhotoOnSiteAlignment())).toEqual({ x: 0, y: 0, scale: 1, rotation: 0 });
  await page.evaluate(() => window.Viewer.setPhotoOnSiteAlignment({ rotation: 3 }));
  await page.keyboard.press('Escape');
  await expect(onSite).toHaveCount(0);
  expect(await page.evaluate(() => [window.Viewer.isPhotoOnSiteOpen(), window.Viewer.getOpenPhoto().onSite.rotation])).toEqual([false, 3]);

  // One tap (the app's toolbar tool, startPhotoOnSite): the open photo, and
  // the same tap closes it again.
  await page.evaluate(() => window.Viewer.startPhotoOnSite());
  await expect(onSite).not.toHaveClass(/is-starting/);
  await expect(onSite.locator('.viewer-onsite_title')).toContainText('1783');
  await page.evaluate(() => window.Viewer.startPhotoOnSite());
  await expect(onSite).toHaveCount(0);
  // With several and none open: the one tapped in the list.
  await page.evaluate(() => {
    window.Viewer.addPhoto({ src: '/examples/tempietto/photos/Tempietto_1783.webp', label: 'Second', open: false });
    window.Viewer.closePhoto();
    window.Viewer.startPhotoOnSite();
  });
  await expect(page.locator('#viewerPhotos .viewer-photos_pick')).toBeVisible();
  await page.locator('#viewerPhotos [data-photo="photo-2"]').click();
  await expect(onSite).not.toHaveClass(/is-starting/);
  await expect(onSite.locator('.viewer-onsite_title')).toHaveText('Second');
  await expect(page.locator('#viewerPhotos .viewer-photos_pick')).toBeHidden();
  await onSite.locator('.viewer-onsite_close').click();
  await expect(onSite).toHaveCount(0);
  // With none: an image from the gallery (a file picker opens from a tap:
  // a button standing in for the app's tool).
  await page.evaluate(() => {
    window.Viewer.setPhotos([]);
    const tool = document.createElement('button');
    tool.id = 'onSiteTool';
    tool.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    tool.textContent = 'on site';
    tool.addEventListener('click', () => window.Viewer.startPhotoOnSite());
    document.body.append(tool);
  });
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#onSiteTool').click();
  await (await chooser).setFiles('viewer/examples/tempietto/photos/Tempietto_1783.webp');
  await expect(onSite).not.toHaveClass(/is-starting/);
  await expect(onSite.locator('.viewer-onsite_title')).toHaveText('Tempietto_1783.webp');
  expect(await page.evaluate(() => window.Viewer.getPhotos().length)).toBe(1);
  await page.evaluate(() => window.Viewer.closePhotoOnSite());
});

test('historical photos: opened from their camera over the model, faded or swiped, aligned, added and round-trip', async ({ page }) => {
  test.setTimeout(120_000);
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await page.evaluate(async () => {
    const manifest = await (await fetch('/manifests/tempietto-aim3d-photos.json')).json();
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.timelineState && window.Viewer.getPhotos().length, null, { timeout: 60_000 });

  // The manifest's photos are listed; opening one flies to its camera and
  // sets the timeline to its year.
  await expect(page.locator('#viewerPhotos .viewer-photos_item')).toHaveCount(1);
  await page.locator('#viewerPhotos [data-photo="veduta-1783"]').click();
  await page.waitForFunction(() => document.querySelector('.viewer-photo-overlay_image')?.naturalWidth > 0);
  const opened = await page.evaluate(() => {
    const viewer = window.Viewer;
    const frame = document.querySelector('.viewer-photo-overlay_frame').getBoundingClientRect();
    const canvas = document.querySelector('#MainCanvas').getBoundingClientRect();
    return {
      position: viewer.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
      fov: viewer.camera.fov,
      year: viewer.timelineState.targetYear,
      away: document.querySelector('#viewerPhotoOverlay').classList.contains('is-away'),
      opacity: document.querySelector('.viewer-photo-overlay_image').style.opacity,
      heightMatches: Math.abs(frame.height - canvas.height) < 1.5,
      aspect: Math.round((frame.width / frame.height) * 100) / 100,
      centered: Math.abs((frame.left + frame.width / 2) - (canvas.left + canvas.width / 2)) < 1.5,
    };
  });
  expect(opened).toEqual({ position: [7.5, 2.2, 9.5], fov: 38, year: 1783, away: false, opacity: '0.6', heightMatches: true, aspect: 1.33, centered: true });

  // Moving the camera hides the photo until its view is restored.
  await page.evaluate(() => {
    window.Viewer.camera.position.x += 3;
    window.Viewer.controls.update();
  });
  await expect(page.locator('#viewerPhotoOverlay')).toHaveClass(/is-away/);
  await page.locator('#viewerPhotos .viewer-photos_button', { hasText: /photo's view/ }).click();
  await expect(page.locator('#viewerPhotoOverlay')).not.toHaveClass(/is-away/);

  // The divider cuts the photo instead of fading it.
  await page.evaluate(() => window.Viewer.setPhotoSwipe(true, 0.5));
  expect(await page.evaluate(() => document.querySelector('.viewer-photo-overlay_frame').style.clipPath)).toMatch(/^inset\(0px [\d.]+px 0px 0px\)$/);
  await page.evaluate(() => window.Viewer.setPhotoSwipe(false));

  // Aligning: the photo stays while the camera moves; lens and tilt saved with the view.
  await page.locator('#viewerPhotos .viewer-photos_button', { hasText: 'Align' }).click();
  await page.evaluate(() => {
    window.Viewer.camera.position.y += 0.5;
    window.Viewer.controls.update();
    window.Viewer.setPhotoFov(36);
    window.Viewer.setPhotoRoll(1.5);
  });
  await expect(page.locator('#viewerPhotoOverlay')).not.toHaveClass(/is-away/);
  await expect(page.locator('.viewer-photo-overlay_frame')).toHaveAttribute('style', /rotate\(1\.5deg\)/);
  await page.locator('#viewerPhotos .viewer-photos_button', { hasText: 'Save view' }).click();
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(validateAIM3DManifest(exported).errors).toEqual([]);
  expect(exported.AIM3DViewer.photos).toEqual([expect.objectContaining({
    id: 'veduta-1783',
    src: './examples/tempietto/photos/Tempietto_1783.webp',
    year: 1783,
    view: { position: [7.5, 2.7, 9.5], target: [0, 2.3, 0], fov: 36, roll: 1.5 },
  })]);

  // A photo added by URL is taken from the current view and aligned next; a
  // IIIF Image API info.json asks the service for the image.
  await page.locator('#viewerPhotos .viewer-photos_add-title').click();
  await page.locator('#viewerPhotos input[name="url"]').fill('/examples/tempietto/photos/Tempietto_1783.webp');
  await page.locator('#viewerPhotos input[type="number"]').fill('1520');
  await page.locator('#viewerPhotos .viewer-photos_add button[type="submit"]').click();
  expect(await page.evaluate(() => [window.Viewer.getPhotos().length, window.Viewer.photosState.aligning, window.Viewer.getOpenPhoto().year])).toEqual([2, true, 1520]);
  const iiif = await page.evaluate(() => window.Viewer.addPhoto({ src: 'https://iiif.example.org/iiif/3/photo-17/info.json', open: false }).src);
  expect(iiif).toBe('https://iiif.example.org/iiif/3/photo-17/full/!2000,2000/0/default.jpg');

  // Round-trip: the photos come back from the export; a file has no URL to export.
  await page.evaluate(() => window.Viewer.addPhoto({ file: new File(['x'], 'local.jpg', { type: 'image/jpeg' }), open: false }));
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.photos.map((photo) => photo.id)).toEqual(['veduta-1783', 'photo-2', 'photo-3']);
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  expect(await page.evaluate(() => window.Viewer.getPhotos().map((photo) => [photo.id, photo.view?.fov ?? null]))).toEqual([
    ['veduta-1783', 36], ['photo-2', 36], ['photo-3', 36],
  ]);
  expect(await page.evaluate(() => document.querySelector('#viewerPhotoOverlay'))).toBeNull();

  const broken = structuredClone(manifest);
  broken.AIM3DViewer.photos = [{ label: 'no image' }, { src: 'a.jpg', view: { position: [0, 0], target: [0, 0, 0], fov: 200 } }];
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual([
    '$.AIM3DViewer.photos[0]',
    '$.AIM3DViewer.photos[1].view.position',
    '$.AIM3DViewer.photos[1].view.fov',
  ]);

  // The toolbar opens and closes the panel; a new model takes its photos away.
  await page.evaluate(() => window.Viewer.togglePhotosPanel(false));
  await expect(page.locator('#viewerPhotos')).toHaveCount(0);
  await page.evaluate(() => document.querySelector('[data-tool="annotatePhotos"]').click());
  await expect(page.locator('#viewerPhotos')).toBeVisible();
  await page.evaluate(() => window.Viewer.resetLoadedModelState());
  expect(await page.evaluate(() => window.Viewer.getPhotos().length)).toBe(0);
});

test('sun and shadows: the sun of a place, day and hour, the year of the timeline, the other lights dimmed, and round-trip', async ({ page }) => {
  test.setTimeout(120_000);
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await page.evaluate(async () => {
    const manifest = await (await fetch('/manifests/tempietto-aim3d-sun.json')).json();
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.timelineState && window.Viewer.sunStudy.enabled, null, { timeout: 60_000 });

  const sun = () => page.evaluate(() => {
    const viewer = window.Viewer;
    const light = window.viewer.scene.getObjectByName('sun-light');
    const direction = light ? light.position.clone().sub(light.target.position).normalize() : null;
    const position = viewer.getSunPosition();
    return {
      year: viewer.getSunYear(),
      elevation: Math.round(position.elevation),
      azimuth: Math.round(position.azimuth),
      visible: light?.visible ?? null,
      up: direction ? Math.round(direction.y * 100) / 100 : null,
      shadows: window.viewer.renderer?.shadowMap?.enabled ?? null,
      castShadow: light?.castShadow ?? null,
      readout: document.querySelector('#viewerSun .viewer-sun_readout')?.textContent || '',
    };
  });

  // Rome, a summer evening in the timeline's first year: low in the west-northwest.
  const evening = await sun();
  expect(evening).toMatchObject({ year: 1520, visible: true, castShadow: true, shadows: true });
  expect(evening.azimuth).toBeGreaterThan(280);
  expect(evening.azimuth).toBeLessThan(300);
  expect(evening.elevation).toBeGreaterThan(8);
  expect(evening.elevation).toBeLessThan(20);
  expect(evening.readout).toMatch(/sunrise 04:\d\d, sunset 19:\d\d/);
  await expect(page.locator('#viewerSun')).toBeVisible();

  // Noon: high in the south; the light comes from above.
  await page.evaluate(() => window.Viewer.setSunOptions({ time: '12:15' }));
  const noon = await sun();
  expect(noon.elevation).toBeGreaterThan(68);
  expect(noon.elevation).toBeLessThan(74);
  expect(Math.abs(noon.azimuth - 180)).toBeLessThan(15);
  expect(noon.up).toBeGreaterThan(0.9);
  // Night: no sun.
  await page.evaluate(() => window.Viewer.setSunOptions({ time: '23:30' }));
  expect(await sun()).toMatchObject({ visible: false, readout: expect.stringMatching(/below the horizon/) });

  // The year follows the timeline, unless told not to.
  await page.evaluate(() => {
    window.Viewer.pauseTimeline();
    window.Viewer.setTimelineYear(2024, { immediate: true });
  });
  expect((await sun()).year).toBe(2024);
  await page.evaluate(() => window.Viewer.setSunOptions({ followTimeline: false, date: '1900-12-21', time: '12:00' }));
  const winter = await sun();
  expect(winter.year).toBe(1900);
  expect(winter.elevation).toBeGreaterThan(20);
  expect(winter.elevation).toBeLessThan(28);

  // Round-trip: the place and the sun come back from an export.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  expect(manifest.AIM3DViewer.location).toEqual({ latitude: 41.8894, longitude: 12.4702, north: 30, utcOffset: 1 });
  expect(manifest.AIM3DViewer.sun).toEqual({ enabled: true, date: '1900-12-21', time: '12:00', followTimeline: false });
  await page.evaluate(() => window.Viewer.setSunStudy(false));
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.sun)).toBeUndefined();
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  expect(await sun()).toMatchObject({ year: 1900, elevation: winter.elevation, visible: true });

  // The other lights are dimmed while it is on and come back after; the
  // raking light takes over from it.
  const intensities = () => page.evaluate(() => {
    const values = [];
    window.viewer.scene.traverse((object) => {
      if (object.isLight && !object.userData?.isSunLight && !object.userData?.isRakingLight) values.push(Math.round(object.intensity * 1000) / 1000);
    });
    return values;
  });
  const dimmed = await intensities();
  await page.evaluate(() => window.Viewer.setRakingLight(true));
  expect(await page.evaluate(() => [window.Viewer.sunStudy.enabled, window.Viewer.rakingLight.enabled])).toEqual([false, true]);
  await page.evaluate(() => window.Viewer.setRakingLight(false));
  const restored = await intensities();
  expect(restored.length).toBe(dimmed.length);
  expect(restored.some((value, index) => value > dimmed[index])).toBe(true);
  expect(await page.evaluate(() => window.viewer.renderer.shadowMap.enabled)).toBe(false);
  await expect(page.locator('#viewerSun')).toHaveCount(0);

  const broken = structuredClone(manifest);
  broken.AIM3DViewer.location = { latitude: 95, longitude: 12 };
  broken.AIM3DViewer.sun = { date: '13-40', time: '25:00' };
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual([
    '$.AIM3DViewer.location.latitude',
    '$.AIM3DViewer.sun.date',
    '$.AIM3DViewer.sun.time',
  ]);
});

test('VR and AR: offered when the browser has them, the viewer placed at real size or on a table, and the view restored when a session fails', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const calls = [];
    (window as any).__xrCalls = calls;
    (window as any).__xrMode = 'reject';
    class FakeSession extends EventTarget {
      enabledFeatures = ['local-floor'];
      renderState = {};
      ended = false;
      async end() {
        if (this.ended) return;
        this.ended = true;
        this.dispatchEvent(new Event('end'));
      }
      async updateRenderState() {}
      async requestReferenceSpace() { throw new Error('no space'); }
      requestAnimationFrame() { return 0; }
      cancelAnimationFrame() {}
    }
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: async (mode) => mode === 'immersive-vr' || mode === 'immersive-ar',
        requestSession: async (mode, options) => {
          calls.push({ mode, features: options?.optionalFeatures || [], overlay: !!options?.domOverlay?.root });
          if ((window as any).__xrMode === 'reject') throw new DOMException('Not now', 'NotAllowedError');
          return new FakeSession();
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token) {
      return token === 'ar' ? true : supports.call(this, token);
    };
    const click = HTMLAnchorElement.prototype.click;
    (window as any).__quickLook = [];
    HTMLAnchorElement.prototype.click = function () {
      if (this.rel === 'ar') {
        (window as any).__quickLook.push({ href: this.href, image: !!this.querySelector('img'), download: this.download });
        return;
      }
      return click.call(this);
    };
  });
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);

  await waitForCameraIdle(page);
  const toggle = page.locator('button[data-tool="immersive"]');
  await page.waitForFunction(() => window.Viewer.xr.checked === true);
  expect(await page.evaluate(() => window.Viewer.xr.support)).toEqual({ vr: true, ar: true, quickLook: true });
  await expect(toggle).not.toBeHidden();
  await page.evaluate(() => window.Viewer.toggleXRPanel(true));
  const panel = page.locator('#viewerXR');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-xr="vr"]')).toHaveText('View in VR');
  await expect(panel.locator('[data-xr="ar"]')).toHaveText('View in AR');
  await expect(panel.locator('[data-xr="quickLook"]')).toHaveText('Open in AR Quick Look');

  // Placement: real size in VR (scene units per metre), the model fitted
  // to a table in AR, facing the model from the camera's side.
  const placement = await page.evaluate(() => {
    const viewer = window.Viewer;
    const mpu = viewer.getDistanceMeasurementScaleMeters();
    const vr = viewer.getXRPlacement('vr');
    viewer.setXRArScale('table');
    const table = viewer.getXRPlacement('ar');
    viewer.setXRArScale('real');
    const real = viewer.getXRPlacement('ar');
    viewer.setXRArScale('table');
    const camera = window.Viewer.camera.position;
    const toCamera = Math.atan2(camera.x, camera.z);
    return { mpu, vrScale: vr.scale, tableScale: table.scale, realScale: real.scale, vrTurn: vr.rotationY, toCamera };
  });
  expect(placement.vrScale).toBeCloseTo(1 / placement.mpu, 6);
  expect(placement.realScale).toBeCloseTo(1 / placement.mpu, 6);
  expect(placement.tableScale).not.toBeCloseTo(placement.realScale, 3);
  expect(Math.abs(Math.sin(placement.vrTurn - placement.toCamera))).toBeLessThan(0.2);

  // A refused session leaves everything as it was.
  const before = await page.evaluate(() => window.Viewer.camera.position.toArray());
  await panel.locator('[data-xr="vr"]').click();
  await page.waitForFunction(() => (window as any).__xrCalls.length === 1);
  expect(await page.evaluate(() => (window as any).__xrCalls[0])).toMatchObject({ mode: 'immersive-vr', features: expect.arrayContaining(['local-floor']) });
  await page.waitForFunction(() => window.viewer?.toasts?.some((text) => text.includes('VR or AR could not be started.')));

  // A session that fails to start (no real headset here) hands the camera
  // back, with the window's render loop running again.
  await page.evaluate(() => { (window as any).__xrMode = 'fake'; });
  await panel.locator('[data-xr="ar"]').click();
  await page.waitForFunction(() => (window as any).__xrCalls.length === 2 && !window.Viewer.xr.starting);
  const frames = await page.evaluate(() => window.viewer.renderer.info.render.frame);
  // Polled, not a fixed wait: one frame of software WebGL can take longer
  // than a short pause when the machine is busy.
  const framesRunning = await page
    .waitForFunction((count) => window.viewer.renderer.info.render.frame > count, frames, { timeout: 15_000 })
    .then(() => true, () => false);
  const after = await page.evaluate((framesRunning) => {
    return {
      call: (window as any).__xrCalls[1],
      presenting: window.Viewer.isXRPresenting(),
      parent: window.Viewer.camera.parent === null || window.Viewer.camera.parent?.isScene === true,
      rig: !!window.viewer.scene.getObjectByName('xr-rig'),
      position: window.Viewer.camera.position.toArray(),
      background: window.viewer.scene.background !== null,
      grid: window.Viewer.xr.saved === null,
      controls: window.Viewer.controls.enabled,
      xrEnabled: window.viewer.renderer.xr.enabled,
      framesRunning,
    };
  }, framesRunning);
  expect(after.call).toMatchObject({ mode: 'immersive-ar', overlay: true, features: expect.arrayContaining(['dom-overlay']) });
  expect(after).toMatchObject({ presenting: false, parent: true, rig: false, grid: true, controls: true, xrEnabled: false, framesRunning: true });
  after.position.forEach((value, index) => expect(value).toBeCloseTo(before[index], 4));

  // AR Quick Look: the model as USDZ, handed over by a link holding an image.
  const usdz = await page.evaluate(async () => {
    const blob = await window.Viewer.exportUSDZ();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { size: blob.size, type: blob.type, zip: String.fromCharCode(bytes[0], bytes[1]) };
  });
  expect(usdz).toMatchObject({ type: 'model/vnd.usdz+zip', zip: 'PK' });
  expect(usdz.size).toBeGreaterThan(200);
  await panel.locator('[data-xr="quickLook"]').click();
  await page.waitForFunction(() => (window as any).__quickLook.length === 1);
  expect(await page.evaluate(() => (window as any).__quickLook[0])).toMatchObject({ image: true, href: expect.stringMatching(/^blob:/), download: expect.stringMatching(/\.usdz$/) });

  // Polish labels.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#viewerLanguageMode')?.click();
    document.querySelector<HTMLElement>('.language-dropdown-item-polish')?.click();
  });
  await expect(panel.locator('[data-xr="vr"]')).toHaveText('Zobacz w VR');
});

// Share of the canvas the splats cover: the pixels that change when Spark's
// renderer is hidden, drawn and read back in one go (the drawing buffer is
// not kept between frames).
async function splatPixelShare(page) {
  return page.evaluate(() => {
    const renderer = window.viewer.renderer;
    const scene = window.viewer.scene;
    const camera = window.Viewer.camera;
    const gl = renderer.getContext();
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const read = () => {
      renderer.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    // Spark draws every splat of the scene in one mesh, its renderer.
    const spark = scene.getObjectByName('spark-renderer');
    const shown = read();
    spark.visible = false;
    const hidden = read();
    spark.visible = true;
    let changed = 0;
    for (let i = 0; i < shown.length; i += 4) {
      if (Math.abs(shown[i] - hidden[i]) + Math.abs(shown[i + 1] - hidden[i + 1]) + Math.abs(shown[i + 2] - hidden[i + 2]) > 30) changed += 1;
    }
    return changed / (width * height);
  });
}

test('Gaussian splats: .splat files and PLYs of splats are drawn by Spark, upright and framed like any model', { tag: '@smoke' }, async ({ page }) => {
  test.setTimeout(90_000);
  await openViewer(page, '/examples/tempietto/Tempietto.splat');
  await waitForCameraIdle(page);

  const info = await page.evaluate(() => {
    const root = window.Viewer.mainObject[0];
    const mesh = root.children.find((child) => child.userData.isGaussianSplats);
    root.updateMatrixWorld(true);
    // Stored Y down, turned upright (half a turn about X), standing on the grid.
    const world = mesh.matrixWorld;
    const ys = [];
    mesh.forEachSplat((index, center) => { ys.push(center.clone().applyMatrix4(world).y); });
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const spark = window.viewer.scene.getObjectByName('spark-renderer');
    return {
      group: root.userData.isGaussianSplats === true,
      count: mesh.userData.gaussianSplats.count,
      format: mesh.userData.gaussianSplats.format,
      spark: !!spark,
      upright: mesh.quaternion.toArray().map((v) => Math.round(v * 1000) / 1000),
      height: max - min,
      ground: min,
    };
  });
  expect(info).toMatchObject({ group: true, count: 30000, format: 'splat', spark: true });
  expect(info.upright).toEqual([1, 0, 0, 0]);
  expect(info.height).toBeGreaterThan(3);
  expect(Math.abs(info.ground)).toBeLessThan(info.height * 0.05);
  // Framed and measured like any model: the bounds hold the splats.
  const bounds = await page.evaluate(() => {
    const root = window.Viewer.mainObject[0];
    const geometry = root.children[0].geometry;
    return geometry ? { hasBox: !!geometry.boundingBox, vertices: geometry.getAttribute('position').count } : null;
  });
  expect(bounds).toEqual({ hasBox: true, vertices: 8 });
  // Drawn once Spark has sorted them, a frame or more after loading - and,
  // lit by the scene's lights (splat-lighting.js), once its generator has
  // run the lighting for every splat, seconds on the software GL of the tests.
  await expect.poll(() => splatPixelShare(page), { timeout: 45_000 }).toBeGreaterThan(0.02);

  // A PLY of Gaussians (here 600 in a ring) is told apart from a mesh PLY.
  const count = 600;
  const properties = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
  const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${count}\n${properties.map((name) => `property float ${name}`).join('\n')}\nend_header\n`;
  const body = Buffer.alloc(count * properties.length * 4);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const values = [Math.cos(angle), -0.5 * (i % 3), Math.sin(angle), 1.2, -0.4, -0.4, 4, -3.5, -3.5, -3.5, 1, 0, 0, 0];
    values.forEach((value, k) => body.writeFloatLE(value, (i * properties.length + k) * 4));
  }
  const ply = Buffer.concat([Buffer.from(header, 'latin1'), body]);
  await page.route('**/examples/virtual/ring.ply', (route) => route.fulfill({ contentType: 'application/octet-stream', body: ply }));
  await openViewer(page, '/examples/virtual/ring.ply');
  await waitForCameraIdle(page);
  const ring = await page.evaluate(() => {
    const root = window.Viewer.mainObject[0];
    const mesh = root.children.find((child) => child.userData.isGaussianSplats);
    return { count: mesh?.userData.gaussianSplats.count ?? null, format: mesh?.userData.gaussianSplats.format ?? null };
  });
  expect(ring).toEqual({ count, format: 'ply' });
  await expect.poll(() => splatPixelShare(page)).toBeGreaterThan(0.005);
});

// Tempietto-lod.rad: Tempietto.splat through Spark's build-lod (--rad), as
// the worker does with uploaded splats (worker/splats.py).
test('Gaussian splats: a .rad on the server is paged by range requests, loaded whole without them', async ({ page }) => {
  test.setTimeout(90_000);
  const radRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.rad')) radRequests.push(request.headers().range ?? null);
  });
  await openViewer(page, '/examples/tempietto/Tempietto-lod.rad');
  await waitForCameraIdle(page);
  await expect.poll(() => page.evaluate(() => {
    const mesh = window.Viewer.mainObject[0].children.find((child) => child.userData.isGaussianSplats);
    return mesh?.paged?.numSplats ?? 0;
  }), { timeout: 30_000 }).toBeGreaterThan(0);

  const info = await page.evaluate(() => {
    const root = window.Viewer.mainObject[0];
    const mesh = root.children.find((child) => child.userData.isGaussianSplats);
    const box = new window.THREE.Box3().setFromObject(root);
    return { ...mesh.userData.gaussianSplats, height: box.max.y - box.min.y, upright: mesh.quaternion.toArray() };
  });
  // The count is the header's: the tree's splats, merged inner ones included.
  expect(info).toMatchObject({ format: 'rad', paged: true, upright: [1, 0, 0, 0] });
  expect(info.count).toBeGreaterThanOrEqual(30000);
  expect(info.height).toBeGreaterThan(3);
  // Only ranges: the header, then the tree's chunks.
  expect(radRequests.length).toBeGreaterThan(1);
  expect(radRequests.every((range) => /^bytes=\d+-\d+$/.test(range ?? ''))).toBe(true);
  // Drawn once Spark has walked the tree and sorted what came in, a few
  // frames after the first page.
  await expect.poll(() => splatPixelShare(page), { timeout: 30_000 }).toBeGreaterThan(0.02);

  // A server that ignores Range (200, the whole file): loaded whole, as before.
  await page.route('**/*.rad', async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), range: '' } });
    const body = await response.body();
    await route.fulfill({ status: 200, body, headers: { 'content-type': 'application/octet-stream', 'content-length': String(body.length) } });
  });
  await openViewer(page, '/examples/tempietto/Tempietto-lod.rad');
  await waitForModel(page, 30_000);
  const whole = await page.evaluate(() => {
    const mesh = window.Viewer.mainObject[0].children.find((child) => child.userData.isGaussianSplats);
    return { paged: !!mesh.paged, format: mesh.userData.gaussianSplats.format, count: mesh.userData.gaussianSplats.count };
  });
  expect(whole).toMatchObject({ paged: false, format: 'rad' });
  expect(whole.count).toBe(info.count);
});

// Spark sorts the splats asynchronously; disposed in the middle of a sort it
// threw "Uncaught (in promise) Error: No target" (main.js, disposeSparkRenderer).
test('switching away from Gaussian splats while Spark sorts leaves no errors', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openViewer(page, '/examples/tempietto/Tempietto.splat');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  const box = await page.locator('#MainCanvas').boundingBox();
  for (let round = 0; round < 3; round += 1) {
    // A turn of the camera makes Spark sort again; the model goes right after.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    await page.selectOption('#example-model-select', './examples/points.laz');
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
    await page.selectOption('#example-model-select', './examples/tempietto/Tempietto.splat');
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  }
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('a manifest\'s settings for another model: the look stays, what belongs to the model goes', () => {
  const source = JSON.parse(fs.readFileSync('viewer/manifesto/examples/tempietto-aim3d-tour.json', 'utf8'));
  // As exported from a page where the viewer was a movable window.
  source.AIM3DViewer.viewer.window = { position: { x: 40, y: 80 }, size: { width: 900, height: 600 } };
  const model = 'https://example.org/models/Other.glb';
  const result = retargetManifest(source, model);
  expect(validateAIM3DManifest(result).errors).toEqual([]);
  expect(JSON.stringify(result)).not.toContain('Tempietto.glb');

  // Only the model changes in the scene; the ids follow it.
  const [scene] = result.items;
  expect(scene.id).toBe(`${model}/scene`);
  const models = scene.items.flatMap((page) => page.items).filter((annotation) => annotation.body?.type === 'Model');
  expect(models.map((annotation) => annotation.body)).toEqual([{ id: model, type: 'Model', format: 'model/gltf-binary' }]);
  expect(result.label).toEqual({ en: ['Other.glb'] });
  // The old model's annotations, thumbnails and pose go; the look stays.
  expect(scene.annotations.every((page) => page.items.length === 0)).toBe(true);
  const block = result.AIM3DViewer;
  expect(block.camera).toBeUndefined();
  expect(block.thumbnails).toBeUndefined();
  expect(block.modelTransform.position).toBeUndefined();
  expect(block.viewer.window).toBeUndefined();
  expect(block.lights).toEqual(source.AIM3DViewer.lights);
  expect(block.viewer.rendering).toEqual(source.AIM3DViewer.viewer.rendering);
  expect(block.viewer.environmentMap).toEqual(source.AIM3DViewer.viewer.environmentMap);
  // The camera stays when asked; the source is left as it was.
  expect(retargetManifest(source, model, { keepCamera: true }).AIM3DViewer.camera).toEqual(source.AIM3DViewer.camera);
  expect(JSON.stringify(source)).toContain('Tempietto.glb');
  // Nothing to take the settings from without a model.
  expect(retargetManifest({ type: 'Manifest', items: [] }, model)).toBeNull();
});

test('example manifests: all valid, and the scan views open as written (shading, ambient occlusion, raking light, custom shader)', { tag: '@smoke' }, async ({ page }) => {
  test.setTimeout(120_000);
  // Every example passes the viewer's own validation.
  const dir = 'viewer/manifesto/examples';
  // index.json is the example list (example-manifests.js), not a manifest.
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'index.json')) {
    const result = validateAIM3DManifest(JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8')));
    expect(result.errors, file).toEqual([]);
  }
  // Every manifest the list serves with the viewer exists.
  const list = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'));
  for (const { url } of [...list.iiif, ...list.aim3d].filter(({ url }) => url.startsWith('./manifests/'))) {
    expect(fs.existsSync(`${dir}/${url.slice('./manifests/'.length)}`), url).toBe(true);
  }

  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  const open = async (name) => {
    await page.evaluate(async (file) => {
      const text = await (await fetch(`/manifests/wolpa-synagogue-aim3d-local-${file}.json`)).text();
      window.viewer.fullModelLoaded = false;
      window.viewer.toasts = [];
      await window.Viewer.setupManifesto(text, 'text');
    }, name);
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
    return page.evaluate(() => ({
      shading: window.Viewer.shadingMode,
      ao: window.viewer.ambientOcclusion,
      raking: { ...window.Viewer.rakingLight },
    }));
  };

  expect(await open('raking-light')).toEqual({
    shading: 'clay',
    ao: false,
    raking: expect.objectContaining({ enabled: true, height: 10, sweep: true }),
  });
  // It goes back into an export as it came.
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer);
  expect(exported.rakingLight).toMatchObject({ enabled: true, height: 10, sweep: true });
  expect(exported.modelTransform.shadingMode).toBe('clay');

  // A manifest without one switches it off.
  expect(await open('clay-ao')).toEqual({
    shading: 'clay',
    ao: true,
    raking: expect.objectContaining({ enabled: false }),
  });
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.rakingLight)).toBeUndefined();

  // The custom shader of the contours example compiles.
  expect((await open('contours')).shading).toBe('custom');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.viewer.toasts.filter((text) => text.includes('does not compile')))).toEqual([]);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('IIIF Presentation 4 transforms apply in order, and manifest lights replace the default ones', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  const scene = { id: './examples/box.glb/scene', type: 'Scene' };
  const manifestWith = (transform, lights = []) => JSON.stringify({
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: './examples/box.glb/manifest.json',
    type: 'Manifest',
    items: [{
      ...scene,
      items: [{
        id: './examples/box.glb/scene/page',
        type: 'AnnotationPage',
        items: [
          {
            id: './examples/box.glb/anno/model',
            type: 'Annotation',
            motivation: ['painting'],
            body: { type: 'SpecificResource', source: { id: './examples/box.glb', type: 'Model' }, transform },
            target: scene,
          },
          ...lights.map((body, index) => ({
            id: `./examples/box.glb/anno/light/${index}`,
            type: 'Annotation',
            motivation: ['painting'],
            body,
            target: scene,
          })),
        ],
      }],
    }],
  });
  const load = (json) => page.evaluate((text) => window.Viewer.setupManifesto(text, 'text'), json);
  const root = () => page.evaluate(() => {
    const object = window.Viewer.resolveObjectByTargetId('m0:root');
    const round = (values) => values.map((value) => Math.round(value * 1000) / 1000 + 0);
    return { position: round(object.position.toArray()), scale: round(object.scale.toArray()) };
  });
  const translate = { type: 'TranslateTransform', x: 1, y: 0, z: 0 };
  const turn = { type: 'RotateTransform', x: 0, y: 180, z: 0 };

  // Moved 1 in x, then turned about the scene's y axis: ends up at -1.
  await load(manifestWith([translate, turn]));
  expect((await root()).position).toEqual([-1, 0, 0]);
  // Turned in place, then moved: stays at +1.
  await load(manifestWith([turn, translate]));
  expect((await root()).position).toEqual([1, 0, 0]);
  // Scaling after a translation scales the translation too.
  await load(manifestWith([translate, { type: 'ScaleTransform', x: 2, y: 2, z: 2 }]));
  expect(await root()).toEqual({ position: [2, 0, 0], scale: [2, 2, 2] });

  // A rotation about several axes (x, then y, then z) survives the export.
  const tilt = { type: 'RotateTransform', x: 15, y: 20, z: 35 };
  await load(manifestWith([tilt]));
  // As a three.js "XYZ" Euler rotation, like the IIIF 3D examples use.
  const rootRotation = await page.evaluate(() => {
    const { rotation } = window.Viewer.resolveObjectByTargetId('m0:root');
    return { order: rotation.order, degrees: [rotation.x, rotation.y, rotation.z].map((value) => value * 180 / Math.PI) };
  });
  expect(rootRotation.order).toBe('XYZ');
  rootRotation.degrees.forEach((value, index) => expect(value).toBeCloseTo([15, 20, 35][index], 3));
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest().items[0].items[0].items[0].body.transform);
  expect(exported).toHaveLength(1);
  expect(exported[0]).toMatchObject({ type: 'RotateTransform' });
  ['x', 'y', 'z'].forEach((axis) => expect(exported[0][axis]).toBeCloseTo(tilt[axis], 3));

  // Manifest lights (intensity as a relative Quantity) switch the viewer's
  // own lights off; loading a manifest without lights brings them back.
  const lightState = () => page.evaluate(() => {
    const lights = [];
    window.Viewer.scene.traverse((object) => {
      if (object.isLight && object.visible) lights.push(`${object.type}:#${object.color.getHexString()}:${Math.round(object.intensity * 100) / 100}`);
    });
    return lights.sort();
  });
  const defaults = await lightState();
  expect(defaults).toEqual(expect.arrayContaining([expect.stringMatching(/^HemisphereLight:/)]));
  await load(manifestWith([], [
    { type: 'AmbientLight', color: '#00ff00', intensity: { type: 'Quantity', quantityValue: 0.5, unit: 'relative' } },
  ]));
  expect(await lightState()).toEqual(['AmbientLight:#00ff00:0.5']);
  const exportedLight = await page.evaluate(() => window.Viewer.build3IFManifest().items[0].items[0].items
    .filter((annotation) => /Light$/.test(annotation.body.type)).map((annotation) => annotation.body));
  expect(exportedLight).toEqual([
    { type: 'AmbientLight', color: '#00ff00', intensity: { type: 'Quantity', quantityValue: 0.5, unit: 'relative' } },
  ]);
  await load(manifestWith([]));
  expect(await lightState()).toEqual(defaults);
});

test('IIIF Presentation 4 export keeps every model of the scene and its background colour', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  const scene = { id: './examples/pair/scene', type: 'Scene' };
  const manifest = {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: './examples/pair/manifest.json',
    type: 'Manifest',
    items: [{
      ...scene,
      backgroundColor: '#336699',
      items: [{
        id: './examples/pair/scene/page',
        type: 'AnnotationPage',
        items: [
          {
            id: './examples/pair/anno/glb',
            type: 'Annotation',
            motivation: ['painting'],
            body: { id: './examples/box.glb', type: 'Model', format: 'model/gltf-binary' },
            target: scene,
          },
          {
            id: './examples/pair/anno/stl',
            type: 'Annotation',
            motivation: ['painting'],
            body: {
              type: 'SpecificResource',
              source: { id: './examples/box.stl', type: 'Model' },
              transform: [{ type: 'ScaleTransform', x: 0.5, y: 0.5, z: 0.5 }, { type: 'TranslateTransform', x: 3, y: 0, z: 0 }],
            },
            target: { type: 'SpecificResource', source: scene, selector: [{ type: 'PointSelector', x: 0, y: 1, z: 0 }] },
          },
        ],
      }],
    }],
  };
  const roots = () => page.evaluate(() => [0, 1].map((slot) => {
    const root = window.Viewer.resolveObjectByTargetId(`m${slot}:root`);
    const round = (values) => values.map((value) => Math.round(value * 1000) / 1000 + 0);
    return root && { position: round(root.position.toArray()), scale: round(root.scale.toArray()) };
  }));

  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), manifest);
  const imported = await roots();
  expect(imported).toEqual([
    { position: [0, 0, 0], scale: [1, 1, 1] },
    { position: [3, 1, 0], scale: [0.5, 0.5, 0.5] },
  ]);

  const exported = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(exported.items[0].backgroundColor).toBe('#336699');
  const models = exported.items[0].items[0].items.filter((annotation) => (annotation.body.source?.type || annotation.body.type) === 'Model');
  expect(models.map((annotation) => annotation.body.source?.id || annotation.body.id)).toEqual(['./examples/box.glb', './examples/box.stl']);
  expect(models.map((annotation) => annotation.id)).toEqual([
    expect.stringMatching(/\/annotation\/model$/),
    expect.stringMatching(/\/annotation\/model\/2$/),
  ]);
  expect(models[0].body.format).toBe('model/gltf-binary');
  expect(models[1].body.transform).toEqual([
    { type: 'ScaleTransform', x: 0.5, y: 0.5, z: 0.5 },
    { type: 'TranslateTransform', x: 3, y: 1, z: 0 },
  ]);

  // Round trip through our own export (the AIM3D path): both models are
  // placed again, and the background comes back.
  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), exported);
  expect(await roots()).toEqual(imported);
  const reexported = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(reexported.items[0].backgroundColor).toBe('#336699');

  // A model's default gradient background is not a IIIF background colour.
  await openViewer(page, '/examples/box.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const plain = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(plain.items[0]).not.toHaveProperty('backgroundColor');
  expect(plain.items[0].items[0].items.filter((annotation) => (annotation.body.source?.type || annotation.body.type) === 'Model')).toHaveLength(1);
});

test('IIIF comments: languages, HTML bodies, and one scene of a manifest at a time', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  const scenePoint = (sceneId, x, y, z) => ({
    type: 'SpecificResource',
    source: { id: sceneId, type: 'Scene' },
    selector: [{ type: 'PointSelector', x, y, z }],
  });
  const modelPage = (sceneId, model) => [{
    id: `${sceneId}/page`,
    type: 'AnnotationPage',
    items: [{
      id: `${sceneId}/anno/model`,
      type: 'Annotation',
      motivation: ['painting'],
      body: { id: model, type: 'Model' },
      target: { id: sceneId, type: 'Scene' },
    }],
  }];
  const first = './examples/scenes/1';
  const second = './examples/scenes/2';
  const manifest = {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: './examples/scenes/manifest.json',
    type: 'Manifest',
    items: [
      {
        id: first,
        type: 'Scene',
        label: { en: ['Box'], pl: ['Pudełko'] },
        items: modelPage(first, './examples/box.glb'),
        annotations: [{
          id: `${first}/comments`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${first}/comments/glove`,
              type: 'Annotation',
              motivation: ['commenting'],
              label: { en: ['Glove'], pl: ['Rękawica'] },
              body: {
                type: 'Choice',
                items: [
                  { type: 'TextualBody', value: 'A glove', language: ['en'], format: 'text/plain' },
                  { type: 'TextualBody', value: 'Rękawica astronauty', language: ['pl'], format: 'text/plain' },
                ],
              },
              target: scenePoint(first, 0, 1, 0),
            },
            {
              id: `${first}/comments/html`,
              type: 'Annotation',
              motivation: ['commenting'],
              body: {
                type: 'TextualBody',
                format: 'text/html',
                value: '<p>Right <b>pterygoid</b></p><p>hamulus<script>window.__injected = true</script></p>',
              },
              target: scenePoint(first, 0, 0.5, 0),
            },
          ],
        }],
      },
      {
        id: second,
        type: 'Scene',
        label: { en: ['Tetrahedron'] },
        backgroundColor: '#112233',
        items: modelPage(second, './examples/box.stl'),
      },
    ],
    // Manifest-level comments belong to the scene their target names.
    annotations: [{
      id: './examples/scenes/comments',
      type: 'AnnotationPage',
      items: [{
        id: './examples/scenes/comments/second',
        type: 'Annotation',
        motivation: ['commenting'],
        body: { type: 'TextualBody', value: 'On the second scene' },
        target: scenePoint(second, 0, 0, 0),
      }],
    }],
  };
  // The IIIF source, whose manifest form holds the scene selector.
  await page.evaluate(() => window.Viewer.setupManifestSource('iiif', { loadInitialManifest: false }));
  const comments = () => page.evaluate(() => window.Viewer.annotationEntries.map((entry) => [entry.title, entry.description]));
  const modelUrls = () => page.evaluate(() => window.Viewer.build3IFManifest().items[0].items[0].items
    .filter((annotation) => (annotation.body.source?.type || annotation.body.type) === 'Model')
    .map((annotation) => annotation.body.source?.id || annotation.body.id));

  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), manifest);
  // The first scene only; the comment in the viewer's language, the HTML
  // body as plain text (its script never ran).
  expect(await modelUrls()).toEqual(['./examples/box.glb']);
  expect(await comments()).toEqual([
    ['Glove', 'A glove'],
    ['', 'Right pterygoid\nhamulus'],
  ]);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();

  // Another language shows the other text; an edit changes that language's.
  await page.evaluate(() => window.Viewer.selectLanguage('pl'));
  expect((await comments())[0]).toEqual(['Rękawica', 'Rękawica astronauty']);
  await page.evaluate(() => {
    const entry = window.Viewer.annotationEntries[0];
    window.Viewer.setAnnotationEntryText(entry, 'Rękawica', 'Lewa rękawica');
  });
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest().items[0].annotations[0].items[0]);
  expect(exported.label).toEqual({ en: ['Glove'], pl: ['Rękawica'] });
  expect(exported.body).toEqual({
    type: 'Choice',
    items: [
      { type: 'TextualBody', value: 'A glove', format: 'text/plain', language: ['en'] },
      { type: 'TextualBody', value: 'Lewa rękawica', format: 'text/plain', language: ['pl'] },
    ],
  });
  await page.evaluate(() => window.Viewer.selectLanguage('en'));
  expect((await comments())[0]).toEqual(['Glove', 'A glove']);

  // The scene selector switches to the second scene: its model, its
  // background and the manifest-level comment on it.
  const options = page.locator('#manifesto-scene-select option');
  await expect(options).toHaveText(['Box', 'Tetrahedron']);
  await page.locator('#manifesto-scene-select').selectOption('1');
  await expect.poll(modelUrls).toEqual(['./examples/box.stl']);
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true);
  expect(await comments()).toEqual([['', 'On the second scene']]);
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().items[0].backgroundColor)).toBe('#112233');
  await expect(page.locator('#manifesto-scene-select')).toHaveValue('1');
});

test('an AIM3D manifest\'s camera: as set when it says which view it was set on, the whole model in view when it doesn\'t', async ({ page }) => {
  await openViewer(page);
  await waitForCameraIdle(page);
  const manifest = await page.evaluate(async () => (await fetch('./manifests/box-aim3d-local.json')).json());
  // Set this close, the box is cut off at the bottom of a desktop view.
  const authored = { position: [-1.67, 1.83, 3.34], target: [0, 1, 0], up: [0, 1, 0], fov: 45, perspectiveMode: 'perspective' };
  const load = async (camera) => {
    await page.evaluate((json) => window.Viewer.setupManifesto(json, 'text', 'aim3if'), JSON.stringify({
      ...manifest,
      AIM3DViewer: { ...manifest.AIM3DViewer, camera },
    }));
    return page.evaluate(() => ({
      position: window.Viewer.camera.position.toArray(),
      target: window.Viewer.controls.target.toArray(),
    }));
  };
  const near = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 1e-3);

  // Set on a view as wide as this one (or only said to be landscape): meant.
  for (const view of [{ aspect: 1.5, orientation: 'landscape' }, { orientation: 'landscape' }]) {
    const pose = await load({ ...authored, ...view });
    expect(near(pose.position, authored.position)).toBe(true);
  }

  // Not said: back along its line of sight, the whole box in view.
  const pose = await load(authored);
  expect(near(pose.target, authored.target)).toBe(true);
  const offset = (position) => position.map((value, i) => value - authored.target[i]);
  const length = (vector) => Math.hypot(...vector);
  const moved = offset(pose.position);
  const set = offset(authored.position);
  expect(length(moved)).toBeGreaterThan(length(set) * 1.2);
  expect(near(moved.map((value) => value / length(moved)), set.map((value) => value / length(set)))).toBe(true);

  // Exported with the view it was set on.
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.camera);
  expect(exported.orientation).toBe('landscape');
  expect(exported.aspect).toBeGreaterThan(1);
});

test('an AIM3D manifest\'s camera on a phone held upright: back along its line of sight until the model fits across, not inside the model', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openViewer(page);
  await waitForCameraIdle(page);
  const view = () => page.evaluate(() => {
    const viewer = window.Viewer;
    return {
      position: viewer.camera.position.toArray(),
      target: viewer.controls.target.toArray(),
    };
  });
  const across = () => page.evaluate(() => {
    const viewer = window.Viewer;
    const camera = viewer.camera;
    const Vector3 = camera.position.constructor;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const point = new Vector3();
    viewer.mainObject.flat().forEach((root) => root.traverse((child) => {
      const positions = child.isMesh && child.geometry?.attributes?.position;
      if (!positions) return;
      child.updateWorldMatrix(true, false);
      const step = Math.max(1, Math.floor(positions.count / 20000));
      for (let i = 0; i < positions.count; i += step) {
        point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], point.getComponent(k));
          max[k] = Math.max(max[k], point.getComponent(k));
        }
      }
    }));
    let widest = 0;
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      widest = Math.max(widest, Math.abs(point.set(x, y, z).project(camera).x));
    }
    return widest;
  });

  // Set on a desktop (its aspect says so): the synagogue would be about
  // twice as wide as the phone.
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/wolpa-synagogue-aim3d-local.json', 'url', 'aim3if'));
  const outside = await view();
  const authored = await page.evaluate(async () => (await (await fetch('./manifests/wolpa-synagogue-aim3d-local.json')).json()).AIM3DViewer.camera);
  expect(outside.target.map((value, i) => Math.abs(value - authored.target[i]) < 0.01)).toEqual([true, true, true]);
  const direction = (pose) => {
    const d = pose.position.map((value, i) => value - pose.target[i]);
    const length = Math.hypot(...d);
    return { unit: d.map((value) => value / length), length };
  };
  const moved = direction(outside);
  const set = direction(authored);
  // Looking the same way, from farther back.
  expect(moved.unit.every((value, i) => Math.abs(value - set.unit[i]) < 1e-3)).toBe(true);
  expect(moved.length).toBeGreaterThan(set.length * 1.5);
  expect(await across()).toBeLessThanOrEqual(0.75);

  // A camera inside the building stays where it was set.
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/wolpa-synagogue-aim3d-local-scene-interior.json', 'url', 'aim3if'));
  const inside = await view();
  const interior = await page.evaluate(async () => (await (await fetch('./manifests/wolpa-synagogue-aim3d-local-scene-interior.json')).json()).AIM3DViewer.camera);
  expect(inside.position.map((value, i) => Math.abs(value - interior.position[i]) < 0.01)).toEqual([true, true, true]);
});

test('an AIM3D manifest chosen while an earlier one still loads keeps its own camera and only its model', async ({ page }) => {
  await openViewer(page);
  await waitForCameraIdle(page);
  const pose = () => page.evaluate(() => {
    const viewer = window.Viewer;
    const round = (values) => values.map((value) => Math.round(value * 100) / 100);
    return {
      camera: round(viewer.camera.position.toArray()),
      target: round(viewer.controls.target.toArray()),
      models: viewer.mainObject.length,
    };
  });
  // The AIM3D manifest's camera, loaded on its own.
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-night.json', 'url', 'aim3if'));
  const alone = await pose();
  // The earlier manifest's model arrives after the AIM3D manifest is shown.
  await page.route(/\/examples\/box\.glb/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue().catch(() => {});
  });
  const earlier = page.evaluate(() => window.Viewer.setupManifesto('./manifests/box-iiif-p4.json', 'url', 'iiif'));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-night.json', 'url', 'aim3if'));
  await earlier;
  // After the box would have been fitted and flown to.
  await page.waitForTimeout(1500);
  await waitForCameraIdle(page);

  // AIM3DViewer.camera of tempietto-aim3d-night.json, not the box's.
  const state = await pose();
  expect(state.target).toEqual([0, 2.4, 0]);
  expect(state.camera).toEqual(alone.camera);
  expect(state.models).toBe(1);
});

test('scene cameras: a manifest\'s cameras listed with Blender-like icons, switched between, added and round-trip', async ({ page }) => {
  await openViewer(page, defaultModel, 'ui=menus');
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/tempietto-aim3d-cameras.json', 'url', 'aim3if'));
  await expect.poll(() => page.evaluate(() => window.Viewer.getSceneCameras().length)).toBe(6);

  // The window opens from the Look menu, beside the projection.
  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await toolbar.locator('.viewer-menus_group[data-category="look"] [data-tool="cameras"]').click();
  const panel = page.locator('#viewerCameras');
  await expect(panel).toBeVisible();
  const items = panel.locator('.viewer-cameras_item');
  await expect(items).toHaveCount(6);
  await expect(items.first()).toContainText('Front, three-quarter view');
  await expect(items.first()).toContainText('Start');
  await expect(items.nth(3)).toContainText('Orthographic');

  // A click looks through the camera (reduced motion: at once).
  await items.nth(2).click();
  const viewing = () => page.evaluate(() => {
    const camera = window.Viewer.getActiveSceneCamera();
    return { label: window.Viewer.getSceneCameraLabel(camera), viewing: window.Viewer.isViewingSceneCamera(camera) };
  });
  await expect.poll(viewing).toEqual({ label: 'Portico, detail', viewing: true });
  await panel.getByRole('button', { name: /Next/ }).click();
  await expect.poll(viewing).toEqual({ label: 'Side elevation (orthographic)', viewing: true });
  expect(await page.evaluate(() => window.Viewer.getSceneCameras()[3].type)).toBe('OrthographicCamera');
  await panel.getByRole('button', { name: /Previous/ }).click();
  await expect.poll(viewing).toEqual({ label: 'Portico, detail', viewing: true });

  // Handles, as a light's: where it stands, or where it looks; one at a time.
  const handles = () => page.evaluate(() => window.Viewer.getSceneCameraHandles());
  await panel.getByRole('button', { name: 'Move', exact: true }).click();
  expect(await handles()).toBe('position');
  await expect(panel.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Target', exact: true }).click();
  expect(await handles()).toBe('target');
  await panel.getByRole('button', { name: 'Target', exact: true }).click();
  expect(await handles()).toBe('');

  // One added from the view, named, made the start view: exported first.
  await panel.getByRole('button', { name: /Camera from the current view/ }).click();
  await expect(items).toHaveCount(7);
  await panel.locator('.viewer-lights_name').fill('My view');
  await panel.getByRole('button', { name: 'Make it the start view' }).click();
  await expect(items.first()).toContainText('My view');
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest());
  const cameras = exported.items[0].items[0].items.filter((annotation) => /Camera$/.test(annotation.body?.type || ''));
  expect(cameras.map((annotation) => annotation.body.label?.none?.[0] ?? annotation.body.label?.en?.[0])).toEqual([
    'My view', 'Front, three-quarter view', 'Approach at eye level', 'Portico, detail',
    'Side elevation (orthographic)', "Bird's-eye view", 'Rear, from below',
  ]);
  expect(cameras[4].body).toMatchObject({ type: 'OrthographicCamera', viewHeight: 7 });

  // Closing the window puts the handles away.
  await panel.getByRole('button', { name: 'Move', exact: true }).click();
  await panel.locator('.viewer-scene_header .viewer-scene_icon').last().click();
  expect(await handles()).toBe('');

  // Read back: the same cameras, the start view first.
  await page.evaluate((manifest) => window.Viewer.setupManifesto(JSON.stringify(manifest), 'text', 'aim3if', { baseUrl: `${location.origin}/` }), exported);
  await expect.poll(() => page.evaluate(() => window.Viewer.getSceneCameras().map((camera) => window.Viewer.getSceneCameraLabel(camera))))
    .toEqual(['My view', 'Front, three-quarter view', 'Approach at eye level', 'Portico, detail', 'Side elevation (orthographic)', "Bird's-eye view", 'Rear, from below']);
});

test('IIIF scenes: activating, camera choices, canvases, regions, nesting and descriptive properties', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.setupManifestSource('iiif', { loadInitialManifest: false }));

  const base = './examples/features';
  const main = `${base}/scene`;
  const nested = `${base}/nested`;
  const canvasId = `${base}/canvas`;
  const at = (x, y, z) => ({ type: 'SpecificResource', source: { id: main, type: 'Scene' }, selector: [{ type: 'PointSelector', x, y, z }] });
  const painting = (id, body, target, extra = {}) => ({ id: `${base}/${id}`, type: 'Annotation', motivation: ['painting'], body, target, ...extra });
  const origin = { type: 'PointSelector', x: 0, y: 0, z: 0 };
  const region = [[-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]];
  const manifest = {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: `${base}/manifest.json`,
    type: 'Manifest',
    label: { en: ['Features'] },
    summary: { en: ['A scene with everything'] },
    metadata: [{ label: { en: ['Creator'] }, value: { none: ['Test'] } }],
    rights: 'http://creativecommons.org/licenses/by/4.0/',
    requiredStatement: { label: { en: ['Attribution'] }, value: { en: ['Test suite'] } },
    items: [
      {
        id: main,
        type: 'Scene',
        label: { en: ['Main'] },
        items: [{
          id: `${main}/page`,
          type: 'AnnotationPage',
          items: [
            painting('model', { id: './examples/box.glb', type: 'Model' }, { id: main, type: 'Scene' }),
            // Hidden: only the comment's view, through an activating annotation.
            painting('cameras/hidden', { type: 'PerspectiveCamera', lookAt: origin }, at(0, 0, 9), { behavior: ['hidden'] }),
            painting('cameras/choice', {
              type: 'Choice',
              items: [
                { id: `${base}/cameras/wide`, type: 'PerspectiveCamera', label: { en: ['Wide'] }, fieldOfView: 30, lookAt: origin },
                { id: `${base}/cameras/plan`, type: 'OrthographicCamera', label: { en: ['Plan'] }, lookAt: origin },
              ],
            }, at(4, 3, 6)),
            painting('canvas', {
              type: 'SpecificResource',
              source: { id: canvasId, type: 'Canvas' },
              transform: [{ type: 'ScaleTransform', x: 2, y: 1, z: 1 }],
            }, at(-1, 2, -1)),
            painting('nested', {
              type: 'SpecificResource',
              source: { id: nested, type: 'Scene' },
              transform: [{ type: 'TranslateTransform', x: 3, y: 0, z: 0 }],
            }, { id: main, type: 'Scene' }),
          ],
        }],
        annotations: [{
          id: `${main}/comments`,
          type: 'AnnotationPage',
          items: [
            { id: `${base}/comments/top`, type: 'Annotation', motivation: ['commenting'], body: { type: 'TextualBody', value: 'Top' }, target: at(0, 1, 0) },
            {
              id: `${base}/comments/region`,
              type: 'Annotation',
              motivation: ['commenting'],
              body: { type: 'TextualBody', value: 'Region' },
              target: {
                type: 'SpecificResource',
                source: { id: main, type: 'Scene' },
                selector: [{ type: 'WktSelector', value: `POLYGON Z ((${region.concat([region[0]]).map((point) => point.join(' ')).join(', ')}))` }],
              },
            },
            {
              id: `${base}/activating/top`,
              type: 'Annotation',
              motivation: ['activating'],
              target: { id: `${base}/comments/top`, type: 'Annotation' },
              body: { type: 'SpecificResource', source: { id: `${base}/cameras/hidden`, type: 'Annotation' }, action: ['show', 'enable', 'select'] },
            },
          ],
        }],
      },
      {
        id: nested,
        type: 'Scene',
        label: { en: ['Nested'] },
        items: [{
          id: `${nested}/page`,
          type: 'AnnotationPage',
          items: [{ id: `${nested}/model`, type: 'Annotation', motivation: ['painting'], body: { id: './examples/box.stl', type: 'Model' }, target: { id: nested, type: 'Scene' } }],
        }],
      },
      {
        id: canvasId,
        type: 'Canvas',
        width: 4,
        height: 2,
        backgroundColor: '#ff0000',
        items: [{
          id: `${canvasId}/page`,
          type: 'AnnotationPage',
          items: [{
            id: `${canvasId}/image`,
            type: 'Annotation',
            motivation: ['painting'],
            body: { id: '/assets/img/icon.png', type: 'Image', format: 'image/png' },
            target: `${canvasId}#xywh=0,0,2,2`,
          }],
        }],
      },
    ],
  };

  const state = () => page.evaluate(() => {
    const r3 = (values) => values.map((value) => Math.round(value * 1000) / 1000 + 0);
    const viewer = window.Viewer;
    const roots = [0, 1, 2].map((slot) => viewer.resolveObjectByTargetId(`m${slot}:root`)).filter(Boolean);
    const panels = [];
    viewer.scene.traverse((object) => {
      if (object.parent?.name?.startsWith('iiif-canvas:')) {
        object.updateWorldMatrix(true, false);
        panels.push({ center: r3(object.getWorldPosition(object.position.clone()).toArray()), color: object.material.map ? 'image' : `#${object.material.color.getHexString()}` });
      }
    });
    return {
      roots: roots.map((root) => r3(root.position.toArray())),
      camera: { position: r3(window.viewer.camera.position.toArray()), type: window.viewer.camera.type, fov: window.viewer.camera.fov },
      comments: viewer.annotationEntries.map((entry) => ({ text: entry.description, view: entry.view ? r3(entry.view.position) : null, point: r3(entry.point), polygon: entry.polygon?.length || 0 })),
      panels,
      regions: viewer.annotationPOIGroup?.children.filter((child) => child.name === 'annotation-region').length || 0,
    };
  });

  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), manifest);
  // The nested scene is part of the main one, not a scene of its own.
  await expect(page.locator('#manifesto-scene-select')).toHaveCount(0);
  await expect(page.locator('#manifesto-camera-select option')).toHaveText(['Wide', 'Plan']);
  await expect.poll(async () => (await state()).panels.map((panel) => panel.color).sort()).toEqual(['#ff0000', 'image']);
  const shown = await state();
  expect(shown.roots).toEqual([[0, 0, 0], [3, 0, 0]]);
  // The Choice's first camera, not the hidden one.
  expect(shown.camera).toEqual({ position: [4, 3, 6], type: 'PerspectiveCamera', fov: 30 });
  expect(shown.comments).toEqual([
    { text: 'Top', view: [0, 0, 9], point: [0, 1, 0], polygon: 0 },
    { text: 'Region', view: null, point: [0, 1, 0], polygon: 4 },
  ]);
  expect(shown.regions).toBe(1);
  // Top-left corner at the target point, 4 x 2 Canvas units scaled by 2 in x;
  // the image on the left half, just in front of the background.
  expect(shown.panels).toEqual(expect.arrayContaining([
    { center: [3, 1, -1], color: '#ff0000' },
    { center: [1, 1, -0.999], color: 'image' },
  ]));

  await page.locator('#manifesto-camera-select').selectOption('1');
  expect((await state()).camera.type).toBe('OrthographicCamera');

  const exported = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(exported).toMatchObject({
    label: manifest.label,
    summary: manifest.summary,
    metadata: manifest.metadata,
    rights: manifest.rights,
    requiredStatement: manifest.requiredStatement,
  });
  expect(exported.items[0].label).toEqual({ en: ['Main'] });
  expect(exported.items.map((item) => item.type)).toEqual(['Scene', 'Canvas']);
  const canvasAnnotation = exported.items[0].items[0].items.find((annotation) => annotation.body.source?.type === 'Canvas');
  expect(canvasAnnotation.body.transform).toEqual([{ type: 'ScaleTransform', x: 2, y: 1, z: 1 }]);
  expect(canvasAnnotation.target.selector).toEqual([{ type: 'PointSelector', x: -1, y: 2, z: -1 }]);
  const regionComment = exported.items[0].annotations[0].items.find((annotation) => annotation.body.value === 'Region');
  expect(regionComment.target.selector[0].type).toBe('WktSelector');
  expect(regionComment.target.selector[0].value).toMatch(/^POLYGON Z \(\(-0\.5 1 -0\.5, 0\.5 1 -0\.5, 0\.5 1 0\.5, -0\.5 1 0\.5, -0\.5 1 -0\.5\)\)$/);

  // Our own export shows the same again.
  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), exported);
  await expect.poll(async () => (await state()).panels.length).toBe(2);
  const again = await state();
  expect(again.roots).toEqual(shown.roots);
  expect(again.comments.map((comment) => comment.polygon)).toEqual([0, 4]);

  // A model on its own keeps none of the manifest's descriptive properties.
  await openViewer(page, '/examples/box.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const plain = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(plain).not.toHaveProperty('summary');
  expect(plain.items).toHaveLength(1);
});

test('IIIF models bring their own camera and lights unless the annotation excludes them', async ({ page }) => {
  // A glTF with a triangle, a camera at (0, 1, 7) and a red point light.
  const positions = Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0]).buffer);
  const gltf = {
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_lights_punctual'],
    extensions: { KHR_lights_punctual: { lights: [{ type: 'point', color: [1, 0, 0], intensity: 5 }] } },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { mesh: 0 },
      { camera: 0, translation: [0, 1, 7] },
      { translation: [0, 3, 0], extensions: { KHR_lights_punctual: { light: 0 } } },
    ],
    cameras: [{ type: 'perspective', perspective: { yfov: 0.6, znear: 0.1, zfar: 100 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, 0], max: [1, 2, 0] }],
    bufferViews: [{ buffer: 0, byteLength: positions.length }],
    buffers: [{ byteLength: positions.length, uri: `data:application/octet-stream;base64,${positions.toString('base64')}` }],
  };
  await page.route('**/examples/virtual/lit.gltf', (route) => route.fulfill({ contentType: 'model/gltf+json', body: JSON.stringify(gltf) }));
  await openViewer(page);
  await waitForModel(page);

  const manifestWith = (extra) => JSON.stringify({
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: './examples/virtual/manifest.json',
    type: 'Manifest',
    items: [{
      id: './examples/virtual/scene',
      type: 'Scene',
      items: [{
        id: './examples/virtual/page',
        type: 'AnnotationPage',
        items: [{
          id: './examples/virtual/model',
          type: 'Annotation',
          motivation: ['painting'],
          body: { id: '/examples/virtual/lit.gltf', type: 'Model', format: 'model/gltf+json' },
          target: { id: './examples/virtual/scene', type: 'Scene' },
          ...extra,
        }],
      }],
    }],
  });
  const state = () => page.evaluate(() => {
    const lights = [];
    window.Viewer.scene.traverse((object) => {
      if (object.isLight && object.visible) lights.push(object.isPointLight ? `PointLight:#${object.color.getHexString()}` : object.type);
    });
    return {
      camera: window.viewer.camera.position.toArray().map((value) => Math.round(value * 1000) / 1000 + 0),
      lights: lights.sort(),
    };
  });

  // Used: the model's camera is the view; its light replaces the viewer's.
  await page.evaluate((json) => window.Viewer.setupManifesto(json, 'text'), manifestWith({}));
  expect(await state()).toEqual({ camera: [0, 1, 7], lights: ['PointLight:#ff0000'] });

  // Excluded: the viewer's own camera and lights.
  await page.evaluate((json) => window.Viewer.setupManifesto(json, 'text'), manifestWith({ exclude: ['Cameras', 'Lights'] }));
  const excluded = await state();
  expect(excluded.camera).not.toEqual([0, 1, 7]);
  expect(excluded.lights).not.toContain('PointLight:#ff0000');
  expect(excluded.lights).toEqual(expect.arrayContaining(['HemisphereLight', 'AmbientLight', 'DirectionalLight']));
});

test('sign-in and user management sit in their own account area, outside the example picker', async ({ page }) => {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'required', registration: 'open', maxUploadBytes: 104857600 } })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { user: { id: 1, username: 'admin' }, role: 'admin' } })
  );
  await openViewer(page);
  await waitForModel(page);

  const accountBar = page.locator('#viewer-page-header > #viewer-account-bar');
  await expect(accountBar.locator('#loginButton')).toBeVisible();
  await expect(accountBar.locator('#manageUsersButton')).toBeVisible();
  await expect(page.locator('#example-model-picker #loginButton, #example-model-picker #manageUsersButton')).toHaveCount(0);
  await expect(page.locator('#viewer-page-header > #example-model-picker #uploadModel')).toBeVisible();

  // Accounts off: no empty account area.
  await page.unroute('**/api/auth/config');
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'off', registration: 'closed', maxUploadBytes: 104857600 } })
  );
  await page.evaluate(() => window.Viewer.refreshAuthState());
  await expect(accountBar).toBeHidden();
});

test('model units: from the file, a remembered choice for implausible sizes, and imperial display', async ({ page }) => {
  test.slow();
  const readout = page.locator('#viewerMeasurementReadout');
  const showDimensions = () => page.evaluate(() => {
    if (!window.Viewer.measurementDimensions) window.Viewer.toggleModelDimensions();
    window.Viewer.updateMeasurementReadout();
  });

  // FBX: UnitScaleFactor says centimeters - a 200-unit box is 2 m.
  await openViewer(page, '/examples/box.fbx');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.Viewer.resolveModelUnit())).toEqual({ meters: 0.01, source: 'file', key: 'cm' });
  await showDimensions();
  await expect(readout).toContainText('2.00 m × 2.00 m × 2.00 m');
  await expect(readout.locator('.viewer-measure-units_line')).toContainText('cm');

  // A glTF drawn in centimeters: 2.78 km wide as glTF's meters - a hint,
  // with the units that make it plausible.
  await openViewer(page, '/examples/WolpaSynagogue.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  await showDimensions();
  const warning = readout.locator('.viewer-measure-units_warning');
  await expect(warning).toContainText('2.78 km');
  await expect(warning.locator('button[data-unit]')).toHaveCount(4);
  await warning.locator('button[data-unit="cm"]').click();
  await expect(warning).toHaveCount(0);
  await expect(readout).toContainText('27.76 m');
  await expect(page.locator('[data-tool="measure-units"] > .viewer-editor-tool_unit-label')).toHaveText('cm');

  // Remembered for this model...
  await openViewer(page, '/examples/WolpaSynagogue.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.Viewer.resolveModelUnit())).toEqual({ meters: 0.01, source: 'user', key: 'cm' });
  // ...and shown in feet on request.
  await showDimensions();
  await readout.locator('.viewer-measure-units_display button[data-system="imperial"]').click();
  await expect(readout).toContainText('91.08 ft');
  await readout.locator('.viewer-measure-units_display button[data-system="metric"]').click();

  // Automatic again: meters, and the hint is back.
  await page.evaluate(() => window.Viewer.setModelUnit('auto'));
  expect(await page.evaluate(() => window.Viewer.resolveModelUnit().source)).toBe('default');
  await expect(warning).toContainText('2.78 km');
});

test('credits: a window over the viewer, closed until opened, closed again by its button or a click on the model', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  const credits = page.locator('#credits');
  await expect(credits).toBeHidden();
  // Inside the viewer, not a line below it.
  expect(await credits.evaluate((element) => element.parentElement === window.Viewer.container)).toBe(true);

  await page.evaluate(() => window.Viewer.toggleCredits());
  await expect(credits).toBeVisible();
  await expect(credits.locator('.credits-header')).toHaveText(/Credits/);
  await expect(credits.locator('.credits-iiif')).toBeVisible();
  // The project's changelog (the website's page), in a new tab.
  const changelog = credits.locator('a.credits-changelog');
  await expect(changelog).toHaveText('Changelog');
  await expect(changelog).toHaveAttribute('href', 'https://explora4d.eu/changelog.html');
  await expect(changelog).toHaveAttribute('target', '_blank');
  await credits.locator('.credits-close').click();
  await expect(credits).toBeHidden();

  await page.evaluate(() => window.Viewer.toggleCredits());
  await expect(credits).toBeVisible();
  const canvas = await page.locator('#MainCanvas').boundingBox();
  // Left of the gallery's drawer on the right edge.
  await page.mouse.click(canvas.x + canvas.width * 0.7, canvas.y + canvas.height / 2);
  await expect(credits).toBeHidden();
});

test('the IIIF logo: in the credits, and on the metadata card of a model from a manifest, linking to it', async ({ page }) => {
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  const icon = () => page.evaluate(() => document.querySelector('#metadata-card .metadata-iiif')?.href ?? null);

  // The credits name IIIF next to three.js.
  await expect(page.locator('#credits .credits-iiif')).toHaveAttribute('href', 'https://iiif.io');
  // A model opened on its own has no manifest to link to.
  expect(await icon()).toBeNull();

  // Opened from a manifest's address: the icon links there, so it can be
  // dragged into another IIIF viewer.
  await page.evaluate(async () => {
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto('/manifests/box-aim3d-local.json', 'url', 'aim3if');
  });
  await waitForModel(page);
  await expect.poll(icon).toMatch(/\/manifests\/box-aim3d-local\.json$/);
  expect(await page.evaluate(() => document.querySelector('.metadata-iiif img').naturalWidth)).toBeGreaterThan(0);

  // Given as text, with an id that is no web address: nothing to link to.
  await page.evaluate(async () => {
    const text = await (await fetch('/manifests/box-aim3d-local.json')).text();
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(text, 'text');
  });
  await waitForModel(page);
  expect(await icon()).toBeNull();
});

test('IIIF Scene.spatialScale sets the model unit and is exported again', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  const scene = { id: './examples/scaled/scene', type: 'Scene' };
  const manifest = {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: './examples/scaled/manifest.json',
    type: 'Manifest',
    items: [{
      ...scene,
      spatialScale: { type: 'Quantity', quantityValue: 1, unit: 'cm' },
      items: [{
        id: './examples/scaled/page',
        type: 'AnnotationPage',
        items: [{ id: './examples/scaled/model', type: 'Annotation', motivation: ['painting'], body: { id: './examples/box.glb', type: 'Model' }, target: scene }],
      }],
    }],
  };
  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), manifest);
  expect(await page.evaluate(() => window.Viewer.resolveModelUnit())).toEqual({ meters: 0.01, source: 'manifest', key: 'cm' });
  expect(await page.evaluate(() => window.Viewer.formatLength(2).text)).toBe('2.0 cm');

  const exported = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(exported.items[0].spatialScale).toEqual({ type: 'Quantity', quantityValue: 0.01, unit: 'm' });
  expect(exported.AIM3DViewer.viewer.units).toBe(0.01);

  // Our own export (the AIM3D path) keeps it; a model on its own does not.
  await page.evaluate((json) => window.Viewer.setupManifesto(JSON.stringify(json), 'text'), exported);
  expect(await page.evaluate(() => window.Viewer.resolveModelUnit())).toEqual({ meters: 0.01, source: 'manifest', key: 'cm' });
  await openViewer(page, '/examples/box.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.Viewer.resolveModelUnit().source)).toBe('default');
});

test('upload panel shows limit usage and limit errors from the worker', { tag: '@smoke' }, async ({ page }) => {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'off', registration: 'closed', maxUploadBytes: 104857600 } })
  );
  await page.route('**/api/limits', (route) =>
    route.fulfill({
      json: {
        limits: { uploadsPerHour: 20, uploadsPerDay: 100, storageMb: 0, maxModels: 5, concurrentJobs: 1 },
        usage: { uploadsLastHour: 20, uploadsLastDay: 31, storageBytes: 0, models: 2, activeJobs: 0 },
        maxConcurrentConversions: 2,
      },
    })
  );
  await page.route('**/api/model/create', (route) =>
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '1500' },
      json: { error: 'Upload limit reached', code: 'rate_hour', limit: 20, retryAfter: 1500 },
    })
  );

  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.openUploadPanel());

  const limits = page.locator('#uploadPanelLimits');
  await expect(limits).toHaveText('Uploads: 20/20 this hour, 31/100 today · Models: 2/5');

  await page.setInputFiles('#uploadPanelFileInput', {
    name: 'box.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from('solid box\nendsolid box\n'),
  });
  await submitUpload(page);
  await expect(page.locator('#uploadPanelStatus')).toHaveText(
    'Upload limit reached (20 per hour). Try again in 25 min.'
  );
});

// A file goes to the worker in pieces (worker/server.py, /api/model/upload/),
// each under Cloudflare's 100 MB request limit, several at once; a piece the
// worker failed on is sent again.
test('uploads are sent in pieces, a failed piece again, then converted', async ({ page }) => {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'off', registration: 'closed', maxUploadBytes: 104857600 } })
  );
  const uploadId = 'a'.repeat(32);
  const content = Buffer.from('solid box\nendsolid box\n'.repeat(2));
  const received = new Map();
  const pieces = [];
  let failedOnce = false;
  await page.route('**/api/model/upload/start', (route) => {
    expect(route.request().postDataJSON()).toEqual({ name: 'box.stl', size: content.length, private: false });
    return route.fulfill({ json: { uploadId, chunkBytes: 20 } });
  });
  await page.route(`**/api/model/upload/${uploadId}?offset=*`, (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset'));
    const body = route.request().postDataBuffer();
    pieces.push(offset);
    if (offset === 20 && !failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 502, body: 'Bad gateway' });
    }
    received.set(offset, body);
    return route.fulfill({ json: { received: [...received.values()].reduce((sum, piece) => sum + piece.length, 0) } });
  });
  await page.route(`**/api/model/upload/${uploadId}/finish`, (route) =>
    route.fulfill({ json: { entity_id: 'job1', status: 'started' } })
  );
  let metadata = null;
  await page.route('**/api/jobs/job1/metadata', (route) => {
    metadata = route.request().postDataJSON();
    return route.fulfill({ json: { status: 'ok', metadata } });
  });
  await page.route('**/api/model/status/job1', (route) =>
    route.fulfill({ json: { status: 'failed', progress: 100, message: 'stop here' } })
  );

  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.openUploadPanel());
  await page.setInputFiles('#uploadPanelFileInput', { name: 'box.stl', mimeType: 'model/stl', buffer: content });
  await submitUpload(page);

  await expect(page.locator('#uploadModelPanel')).toBeHidden({ timeout: 15_000 });
  expect(pieces.sort((a, b) => a - b)).toEqual([0, 20, 20, 40]);
  expect(Buffer.concat([0, 20, 40].map((offset) => received.get(offset))).equals(content)).toBe(true);
  // The upload step done, the worker's steps after it.
  await expect(page.locator('#ultra-loader-steps .ultra-step').first()).toHaveText('✓ Uploading file');
  // The form's metadata, stored for the new job.
  await expect.poll(() => metadata).toMatchObject({ name: 'box', type: 'object', license: '' });
});

// The metadata form (ui/model-metadata.js): the name and the type are
// required; cancelling it sends nothing.
test('upload asks for the model metadata, name and type required', async ({ page }) => {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'off', registration: 'closed', maxUploadBytes: 104857600 } })
  );
  let started = false;
  await page.route('**/api/model/upload/start', (route) => {
    started = true;
    return route.fulfill({ status: 429, json: { error: 'Upload limit reached', code: 'rate_hour', limit: 20, retryAfter: 60 } });
  });

  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.openUploadPanel());
  await page.setInputFiles('#uploadPanelFileInput', { name: 'castle_wola.stl', mimeType: 'model/stl', buffer: Buffer.from('solid box\nendsolid box\n') });
  await page.click('#uploadPanelSubmit');

  const form = page.locator('.model-metadata-dialog');
  await expect(form.locator('input[name="name"]')).toHaveValue('castle wola');
  await form.locator('input[name="name"]').fill('');
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('.model-metadata-status')).toHaveText('Enter the name and choose the type.');
  await expect(form.locator('input[name="name"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.locator('select[name="type"]')).toHaveAttribute('aria-invalid', 'true');

  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  expect(started).toBe(false);
});

// Private models (worker/server.py, can_see_job): left out of the list for
// others. Marked in the upload panel by a logged-in user, switched in the
// models panel by the owner.
test('private models: chosen when uploading, switched in the models panel', async ({ page }) => {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'required', registration: 'open', maxUploadBytes: 104857600 } })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { user: { id: 2, username: 'alice' }, role: 'user' } })
  );
  const job = {
    id: 'j1', name: 'castle.glb', status: 'ready', modelUrl: '/examples/box.glb', imageUrls: [],
    createdAt: 1767225600, owner: 'alice', private: false, canDelete: true, validation: null,
  };
  await page.route('**/api/jobs', (route) => route.fulfill({ json: { jobs: [job] } }));
  const visibility = [];
  await page.route('**/api/jobs/j1/visibility', (route) => {
    const { private: isPrivate } = route.request().postDataJSON();
    visibility.push(isPrivate);
    job.private = isPrivate;
    return route.fulfill({ json: { status: 'ok', private: isPrivate } });
  });
  let started = null;
  await page.route('**/api/model/upload/start', (route) => {
    started = route.request().postDataJSON();
    return route.fulfill({ status: 429, json: { error: 'Upload limit reached', code: 'rate_hour', limit: 20, retryAfter: 60 } });
  });

  await openViewer(page);
  await waitForModel(page);

  // Upload panel: the checkbox for a logged-in user, sent with the upload.
  await page.evaluate(() => window.Viewer.openUploadPanel());
  const privateBox = page.locator('#uploadPanelPrivate');
  await expect(privateBox).toBeVisible();
  await privateBox.check();
  await page.setInputFiles('#uploadPanelFileInput', { name: 'box.stl', mimeType: 'model/stl', buffer: Buffer.from('solid box\nendsolid box\n') });
  await submitUpload(page);
  await expect.poll(() => started).toEqual({ name: 'box.stl', size: 23, private: true });
  await page.evaluate(() => window.Viewer.closeUploadPanel());

  // Models panel: the owner's padlock switches it, the caption follows.
  await page.evaluate(() => window.Viewer.openModelsPanel());
  const row = page.locator('#modelsPanel .models-panel-row, #modelsPanel li', { hasText: 'castle.glb' }).first();
  const lock = row.locator('.models-panel-visibility');
  await expect(lock).toHaveAttribute('data-state', 'public');
  await expect(row.locator('.meta-icon[data-icon="private"]')).toHaveCount(0);
  await lock.click();
  await expect.poll(() => visibility).toEqual([true]);
  await expect(row.locator('.models-panel-visibility')).toHaveAttribute('data-state', 'private');
  await expect(row.locator('.meta-icon[data-icon="private"]')).toHaveCount(1);
});

// "Save settings" (File menu) for a model uploaded to the worker: posted to
// POST /api/model/settings, read back from metadata/<file>_viewer.json in the
// model's folder when it opens again (worker/server.py, metadata.js).
test('saved settings of an uploaded model: posted to the worker and applied when it opens again', async ({ page }) => {
  const job = 'd'.repeat(32);
  const box = fs.readFileSync('viewer/examples/box.glb');
  let saved = null;
  await page.route(`**/files/${job}/box.glb`, (route) => route.fulfill({ body: box, contentType: 'model/gltf-binary' }));
  await page.route(`**/files/${job}/metadata/box.glb_viewer.json`, (route) =>
    saved ? route.fulfill({ json: saved }) : route.fulfill({ status: 404, json: { error: 'not found' } }));
  await page.route('**/api/model/settings', async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ path: expect.stringContaining(`/files/${job}/`), filename: 'box.glb' });
    saved = body.content;
    await route.fulfill({ json: { message: 'Settings saved' } });
  });

  await openViewer(page, `/files/${job}/box.glb`, 'ui=menus');
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.helperObjects[0].position.set(1.5, 0.25, -2));
  await page.locator('.viewer-menus_tabs button', { hasText: 'File' }).click();
  await page.locator('[data-tool="save"]').click();
  await page.locator('.viewer-editor-save-apply').click();
  await expect.poll(() => saved?.objPosition ?? null).toEqual([1.5, 0.25, -2]);
  await expect.poll(() => page.evaluate(() => window.viewer.toasts.join(' '))).toContain('Settings have been saved.');

  // Opened again: the saved position.
  await openViewer(page, `/files/${job}/box.glb`, 'ui=menus');
  await waitForModel(page);
  await expect.poll(() => page.evaluate(() => window.Viewer.helperObjects[0].position.toArray())).toEqual([1.5, 0.25, -2]);

  // A model that is not an upload (an example): nothing posted, said why.
  saved = null;
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.locator('.viewer-menus_tabs button', { hasText: 'File' }).click();
  await page.locator('[data-tool="save"]').click();
  await page.locator('.viewer-editor-save-apply').click();
  await expect.poll(() => page.evaluate(() => window.viewer.toasts.join(' '))).toContain('only for models uploaded');
  expect(saved).toBeNull();
});

// Section cuts and measurements in the saved settings: placed again when the
// model opens (setupObject), after its saved position.
test('saved settings of an uploaded model: section cuts and measurements come back when it opens again', async ({ page }) => {
  const job = 'c'.repeat(32);
  const box = fs.readFileSync('viewer/examples/box.glb');
  let saved = null;
  await page.route(`**/files/${job}/box.glb`, (route) => route.fulfill({ body: box, contentType: 'model/gltf-binary' }));
  await page.route(`**/files/${job}/metadata/box.glb_viewer.json`, (route) =>
    saved ? route.fulfill({ json: saved }) : route.fulfill({ status: 404, json: { error: 'not found' } }));
  await page.route('**/api/model/settings', async (route) => {
    saved = route.request().postDataJSON().content;
    await route.fulfill({ json: { message: 'Settings saved' } });
  });

  await openViewer(page, `/files/${job}/box.glb`, 'ui=menus');
  await waitForModel(page);
  await waitForCameraIdle(page);
  const placed = await page.evaluate(() => {
    const viewer = window.Viewer;
    const root = viewer.helperObjects[0];
    root.position.set(1.5, 0, 0);
    root.updateMatrixWorld(true);
    viewer.refreshClippingForModel(root);
    viewer.setClippingAxisEnabled('y', true, { silent: true });
    const range = viewer.getClippingAxisRange('y');
    viewer.setClippingAxisPosition('y', range.min + range.size * 0.6);
    viewer.measurementMode = 'distance';
    const a = root.position.clone().add({ x: -0.25, y: 0.1, z: 0 });
    const b = root.position.clone().add({ x: 0.25, y: 0.1, z: 0 });
    viewer.addMeasurementPoint(a);
    viewer.addMeasurementPoint(b);
    viewer.finishMeasurementDraft();
    return a.toArray();
  });
  await page.locator('.viewer-menus_tabs button', { hasText: 'File' }).click();
  await page.locator('[data-tool="save"]').click();
  await expect(page.locator('.viewer-editor-save-option', { hasText: 'Section cuts' }).locator('input')).toBeChecked();
  await expect(page.locator('.viewer-editor-save-option', { hasText: 'Measurements' }).locator('input')).toBeChecked();
  await page.locator('.viewer-editor-save-apply').click();
  await expect.poll(() => saved?.measurements?.length ?? 0).toBe(1);
  expect(saved.clipping).toMatchObject({ mode: { x: false, y: true, z: false } });

  // Opened again: the cut and the measurement where they were.
  await openViewer(page, `/files/${job}/box.glb`, 'ui=menus');
  await waitForModel(page);
  await expect.poll(() => page.evaluate(() => window.Viewer.measurementResults.length)).toBe(1);
  const state = await page.evaluate(() => {
    const viewer = window.Viewer;
    const range = viewer.getClippingAxisRange('y');
    return {
      root: viewer.helperObjects[0].position.toArray(),
      enabled: viewer.isClippingAxisEnabled('y'),
      cut: (viewer.getClippingAxisPosition('y') - range.min) / range.size,
      first: viewer.measurementResults[0].points[0].toArray(),
      readout: document.querySelector('#viewerMeasurementReadout')?.hidden === false,
    };
  });
  expect(state.root).toEqual([1.5, 0, 0]);
  expect(state).toMatchObject({ enabled: true, readout: true });
  expect(state.cut).toBeCloseTo(0.6, 3);
  state.first.forEach((value, index) => expect(value).toBeCloseTo(placed[index], 4));
});

// The app downloads a repository model before opening it (models-panel.js),
// so it loads from a blob: URL, with no folder for its saved settings.
test('app: repository models open with their saved settings, a .rad paged from the server', async ({ page }) => {
  test.setTimeout(90_000);
  const boxJob = 'e'.repeat(32);
  const radJob = 'f'.repeat(32);
  const box = fs.readFileSync('viewer/examples/box.glb');
  await page.route('**/viewer-settings.json', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), mobile: {} } });
  });
  await page.route(`**/files/${boxJob}/box.glb`, (route) => route.fulfill({ body: box, contentType: 'model/gltf-binary' }));
  await page.route(`**/files/${boxJob}/metadata/box.glb_viewer.json`, (route) => route.fulfill({ json: { objPosition: [1.5, 0.25, -2] } }));
  await page.route(`**/files/${radJob}/Tempietto-lod.rad`, (route) =>
    route.continue({ url: new URL('/examples/tempietto/Tempietto-lod.rad', route.request().url()).href }));
  await page.route(`**/files/${radJob}/metadata/Tempietto-lod.rad_viewer.json`, (route) => route.fulfill({ json: { objPosition: [0, 1, 0] } }));
  const radRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.rad')) radRequests.push(request.headers().range ?? null);
  });

  await openViewer(page);
  await waitForModel(page);
  expect(await page.evaluate(() => document.body.classList.contains('viewer-app'))).toBe(true);

  // Downloaded, opened from a File: the settings come with it.
  await page.evaluate((job) => window.Viewer.loadModelFromList({ id: job, name: 'box.glb', modelUrl: `/files/${job}/box.glb` }), boxJob);
  await expect.poll(() => page.evaluate(() => window.Viewer.helperObjects[0].position.toArray())).toEqual([1.5, 0.25, -2]);

  // A .rad is not downloaded whole: paged by range requests, as in the browser.
  await page.evaluate((job) => window.Viewer.loadModelFromList({ id: job, name: 'Tempietto.splat', modelUrl: `/files/${job}/Tempietto-lod.rad` }), radJob);
  await expect.poll(() => page.evaluate(() => {
    const mesh = window.Viewer.mainObject[0]?.children.find((child) => child.userData.isGaussianSplats);
    return mesh?.paged?.numSplats ?? 0;
  }), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.Viewer.helperObjects[0].position.toArray())).toEqual([0, 1, 0]);
  expect(radRequests.filter((range) => range !== null).every((range) => /^bytes=\d+-\d+$/.test(range))).toBe(true);
  expect(radRequests.filter((range) => range !== null).length).toBeGreaterThan(1);
});

test('point cloud uploads show the worker\'s quick preview until the tiles are ready', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'off', registration: 'closed', maxUploadBytes: 104857600 } })
  );
  await page.route('**/api/limits', (route) =>
    route.fulfill({
      json: {
        limits: { uploadsPerHour: 20, uploadsPerDay: 100, storageMb: 0, maxModels: 5, concurrentJobs: 1 },
        usage: { uploadsLastHour: 0, uploadsLastDay: 0, storageBytes: 0, models: 0, activeJobs: 0 },
        maxConcurrentConversions: 2,
      },
    })
  );
  await page.route('**/api/model/create', (route) => route.fulfill({ json: { entity_id: 'pc1', status: 'started' } }));
  let tilesReady = false;
  await page.route('**/api/model/status/pc1', (route) => route.fulfill({
    json: tilesReady
      ? { status: 'ready', progress: 100, message: '', modelUrl: '/examples/tiles/wolpa-points/tileset.json', imageUrls: [] }
      : { status: 'processing', progress: 40, message: 'Preview ready', previewUrl: '/files/pc1/tiles/scan.preview.las', imageUrls: [] },
  }));
  const preview = buildLas14(200_000);
  await page.context().route('**/files/pc1/tiles/scan.preview.las', (route) => route.fulfill({
    body: preview,
    contentType: 'application/octet-stream',
  }));

  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => window.Viewer.openUploadPanel());
  await page.setInputFiles('#uploadPanelFileInput', {
    name: 'scan.las',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('LASF'),
  });
  await submitUpload(page);

  // The preview, while the worker still converts.
  await page.waitForFunction(() => {
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    return root?.children?.some((child) => child.isPoints && child.userData.pointCloud?.loadedPoints === 200_000);
  }, null, { timeout: 20_000 });
  const badge = page.locator('.viewer-progressive-badge');
  await expect(badge).toHaveText('Preview · building the full point cloud...');

  // The streamed tiles replace it.
  tilesReady = true;
  await page.waitForFunction(() => window.Viewer.pointCloudState?.kind === 'tiles', null, { timeout: 20_000 });
  await expect(badge).toHaveCount(0);
});

test('example model list: fetched from examples/index.json, so a new example needs no new build', async ({ page }) => {
  const list = JSON.parse(fs.readFileSync('viewer/examples/index.json', 'utf8'));
  list.models.push(
    { url: './examples/box.glb', name: { en: 'New example', pl: 'Nowy przykład' } },
    { url: 'https://example.org/model.glb', name: 'Elsewhere' }
  );
  await page.route('**/examples/index.json', (route) => route.fulfill({ json: list }));
  await openViewer(page);
  await waitForModel(page);

  const select = page.locator('#example-model-select');
  await expect(select.locator('option', { hasText: 'New example' })).toHaveAttribute('value', './examples/box.glb');
  await expect(select.locator('option[value="./examples/tempietto/Tempietto.glb"]')).toHaveText('GLB');
  // Each group under its name (the list's "groups", else the id); the added
  // entries, without a group, after them on their own.
  const groups = list.models.map((entry) => entry.group).filter((group, index, all) => group && group !== all[index - 1]);
  await expect(select.locator('optgroup')).toHaveCount(groups.length);
  expect(await select.evaluate((element) => [...element.querySelectorAll('optgroup')].map((group) => group.label)))
    .toEqual(['Tempietto', 'Gaussian splats', 'Wolpa Synagogue', 'Point clouds and animation', 'Amphora, micro-CT (volume)', 'Cells, 2 channels (microscopy volume)', 'Virus capsid, cryo-EM (volume)', 'Soundscape (audio)', 'Images (2D)', 'Test files (broken)']);
  // Within a group, only what sets an example apart.
  await expect(select.locator('optgroup[data-example-group="amphora"] > option').first()).toHaveText('NIfTI');
  await expect(select.locator('option[value="./examples/WolpaSynagogue-progressive.glb"]')).toHaveText('GLB, progressive (Meshopt + KTX2)');
  await expect(select.locator('optgroup[data-example-group="wolpa"] > legend')).toHaveText('Wolpa Synagogue');
  expect(await select.evaluate((element) => element.querySelector('optgroup[data-example-group="wolpa"] > option')?.getAttribute('value'))).toBe('./examples/WolpaSynagogue.glb');
  expect(await select.evaluate((element) => element.querySelector('option[value="./examples/box.glb"]')?.parentElement === element)).toBe(true);
  await expect(select.locator('hr')).toHaveCount(0);
  // Another site: marked, and disabled without network.
  const elsewhere = select.locator('option', { hasText: 'Elsewhere' });
  await expect(elsewhere).toHaveAttribute('data-online', 'true');
  await page.context().setOffline(true);
  await expect(elsewhere).toBeDisabled();
  await page.context().setOffline(false);
  await expect(elsewhere).toBeEnabled();

  // Names follow the language. A web viewer keeps no list (only the app
  // does): a kept one could be another deployment's.
  await page.evaluate(() => window.Viewer.selectLanguage('pl'));
  await expect(select.locator('option[value="./examples/box.glb"]')).toHaveText('Nowy przykład');
  await expect(select.locator('optgroup[data-example-group="wolpa"]')).toHaveAttribute('label', 'Synagoga w Wolpie');
  expect(await page.evaluate(() => localStorage.getItem('dfg3dviewer-example-models'))).toBeNull();
});

// The volume on screen: its manifest series (volume.js), or null.
function shownVolume(page) {
  return page.evaluate(() => {
    let found = null;
    window.viewer?.scene?.traverse?.((object) => {
      if (!found && object.userData?.volumeSeries) found = object.userData.volumeSeries;
    });
    return found && { name: found.name, dims: found.dims, voxelSize: found.voxelSize, unit: found.unit };
  });
}

test('volumes in a .zip by URL: opened in the browser when the repository has no conversion of it', async ({ page }) => {
  test.setTimeout(120_000);
  const cases = [
    ['/examples/volumes/amphora-ct-png-slices.zip', { name: 'amphora-ct_rec', dims: [72, 72, 120], voxelSize: [400, 400, 400] }],
    ['/examples/volumes/amphora-ct-vgi.zip', { name: 'amphora-ct', dims: [72, 72, 120], voxelSize: [400, 400, 400] }],
    ['/examples/volumes/amphora-ct-xtekct.zip', { name: 'amphora-ct', dims: [36, 36, 60], voxelSize: [800, 800, 800] }],
    ['/examples/volumes/amphora-ct-dicom.zip', { dims: [72, 72, 120] }],
  ];
  for (const [model, expected] of cases) {
    await openViewer(page, model);
    await waitForModel(page, 40_000);
    const volume = await shownVolume(page);
    expect(volume, model).toMatchObject({ unit: 'µm', ...expected });
  }
});

test('volume settings on a phone: minimized to their icon, opened as a modal window, folded by a tap beside it', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await context.newPage();
  await openViewer(phone, '/examples/volumes/capsid.mrc');
  await waitForModel(phone, 40_000);
  const panel = phone.locator('#viewerVolumePanel');
  const pip = panel.locator('.tool-panel-chrome_pip');
  const backdrop = phone.locator('.tool-panel-chrome_backdrop');
  const toolButton = phone.locator('button[data-tool="volume"]');
  // There, but only as its icon.
  await expect(panel).toHaveClass(/is-minimized/);
  await expect(pip).toBeVisible();
  await expect(panel.locator('.viewer-pointcloud-panel_body')).toBeHidden();
  await expect(backdrop).toHaveCount(0);
  await expect(toolButton).toHaveAttribute('aria-pressed', 'false');
  const place = () => panel.evaluate((el) => el.parentElement?.className || el.parentElement?.id);
  const docked = await place();

  // A tap: a window over the viewer, on a backdrop.
  await pip.click();
  await expect(panel).toHaveClass(/is-modal-open/);
  await expect(panel).toHaveAttribute('aria-modal', 'true');
  await expect(backdrop).toBeVisible();
  await expect(toolButton).toHaveAttribute('aria-pressed', 'true');
  const box = await panel.boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(4);
  expect(box.width).toBeLessThanOrEqual(380);

  // A tap beside it: back to its icon, where it was.
  await backdrop.click({ position: { x: 20, y: 20 } });
  await expect(panel).toHaveClass(/is-minimized/);
  await expect(panel).not.toHaveClass(/is-modal-open/);
  await expect(backdrop).toHaveCount(0);
  expect(await place()).toBe(docked);

  // The toolbar's button opens it and folds it; Escape folds it too.
  await phone.evaluate(() => window.Viewer.toggleVolumePanel());
  await expect(panel).toHaveClass(/is-modal-open/);
  await phone.keyboard.press('Escape');
  await expect(panel).toHaveClass(/is-minimized/);
  await phone.evaluate(() => window.Viewer.toggleVolumePanel());
  await phone.evaluate(() => window.Viewer.toggleVolumePanel());
  await expect(panel).toHaveClass(/is-minimized/);
  await context.close();
});

test('point cloud settings on a phone: minimized to their icon, opened as a modal window, folded by a tap beside it', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await context.newPage();
  await openViewer(phone, '/examples/points.laz');
  await phone.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const panel = phone.locator('#viewerPointCloudPanel');
  const pip = panel.locator('.tool-panel-chrome_pip');
  const backdrop = phone.locator('.tool-panel-chrome_backdrop');
  const toolButton = phone.locator('button[data-tool="pointCloud"]');
  await expect(panel).toHaveClass(/is-minimized/);
  await expect(pip).toBeVisible();
  await expect(panel.locator('.viewer-pointcloud-panel_body')).toBeHidden();
  await expect(toolButton).toHaveAttribute('aria-pressed', 'false');
  const docked = await panel.evaluate((el) => el.parentElement?.className || el.parentElement?.id);

  await pip.click();
  await expect(panel).toHaveClass(/is-modal-open/);
  await expect(backdrop).toBeVisible();
  await expect(panel.locator('.viewer-pointcloud-panel_body')).toBeVisible();
  await expect(toolButton).toHaveAttribute('aria-pressed', 'true');
  // The settings work in the window.
  await panel.locator('select').nth(2).selectOption('height');
  expect(await phone.evaluate(() => window.Viewer.pointCloudState.colorMode)).toBe('height');

  await backdrop.click({ position: { x: 20, y: 20 } });
  await expect(panel).toHaveClass(/is-minimized/);
  await expect(backdrop).toHaveCount(0);
  expect(await panel.evaluate((el) => el.parentElement?.className || el.parentElement?.id)).toBe(docked);

  await phone.evaluate(() => window.Viewer.togglePointCloudPanel());
  await expect(panel).toHaveClass(/is-modal-open/);
  await phone.keyboard.press('Escape');
  await expect(panel).toHaveClass(/is-minimized/);

  // Drawing a profile: the window folds, so its two clicks reach the cloud.
  await pip.click();
  await panel.getByRole('button', { name: 'Draw profile' }).click();
  await expect(panel).toHaveClass(/is-minimized/);
  await expect(backdrop).toHaveCount(0);
  expect(await phone.evaluate(() => window.Viewer.isPointCloudProfilePicking())).toBe(true);
  await context.close();
});

test('volume settings on a desktop: open in the side stack, not modal', async ({ page }) => {
  await openViewer(page, '/examples/volumes/capsid.mrc');
  await waitForModel(page, 40_000);
  const panel = page.locator('#viewerVolumePanel');
  await expect(panel.locator('.viewer-pointcloud-panel_body')).toBeVisible();
  await expect(panel).not.toHaveClass(/is-minimized|is-modal-open/);
  await panel.locator('.tool-panel-chrome_minimize').click();
  await panel.locator('.tool-panel-chrome_pip').click();
  await expect(panel).not.toHaveClass(/is-modal-open/);
  await expect(page.locator('.tool-panel-chrome_backdrop')).toHaveCount(0);
});

// The audio file on screen (audio.js): what its panel and its scene say.
async function shownAudio(page) {
  return page.evaluate(() => {
    const state = window.Viewer.audioState;
    if (!state?.player) return null;
    let terrain = null;
    state.root.traverse((object) => { if (object.userData?.isAudioTerrain) terrain = object; });
    let top = 0;
    const positions = terrain?.geometry.attributes.position.array || [];
    for (let i = 1; i < positions.length; i += 3) top = Math.max(top, positions[i]);
    const panel = document.getElementById('viewerAudioPanel');
    return {
      kind: window.Viewer.getModelKind(),
      info: state.root.userData.audioInfo,
      terrainTop: top,
      markers: [...(panel?.querySelectorAll('.viewer-audio-panel_marker') || [])].map((el) => el.textContent),
      facts: [...(panel?.querySelectorAll('.viewer-volume-panel_summary dd') || [])].map((el) => el.textContent),
      duration: state.player.duration,
    };
  });
}

test('audio files: played, drawn as a spectrogram landscape, with their tags and markers', async ({ page }) => {
  await openViewer(page, '/examples/audio/soundscape.wav');
  await waitForModel(page, 30_000);
  await page.waitForFunction(() => window.Viewer.isAudioActive?.() && document.getElementById('viewerAudioPanel'));
  const audio = await shownAudio(page);
  expect(audio.kind).toBe('audio');
  expect(audio.info).toMatchObject({ format: 'Broadcast Wave', sampleRate: 22050, channels: 2, bitsPerSample: 16, analysed: true });
  expect(audio.info.tags).toMatchObject({ title: 'Soundscape (synthetic)', artist: 'ExPlora4D examples' });
  expect(audio.duration).toBeCloseTo(12, 1);
  // The bell is the loudest: about 10 dB below full scale at its partials.
  expect(audio.terrainTop).toBeGreaterThan(1);
  expect(audio.markers).toEqual(['0:00 · Bell', '0:03 · Bird call', '0:05 · Chord', '0:09 · Bell again']);
  expect(audio.facts).toEqual(expect.arrayContaining(['Soundscape (synthetic)', 'Broadcast Wave, PCM', '22.05 kHz', '16 bit']));
  await expect(page.locator('#viewerAudioPanel .viewer-audio-panel_title')).toHaveText('Soundscape (synthetic)');

  // Its tools on the bar, those for surfaces left out.
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['audio', 'cameras', 'projection']);
  expect((await formatTools(page)).hidden).toEqual(expect.arrayContaining(['shading', 'materials', 'clippingPlanes']));

  // A marker and the waveform move the time; a drag selects a part.
  await page.locator('.viewer-audio-panel_marker', { hasText: 'Chord' }).click();
  await expect.poll(() => page.evaluate(() => window.Viewer.audioState.player.currentTime)).toBeCloseTo(5.5, 1);
  const wave = page.locator('.viewer-audio-panel_wave');
  const box = await wave.boundingBox();
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => window.Viewer.audioState.player.currentTime)).toBeCloseTo(9, 0);
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const region = await page.evaluate(() => window.Viewer.audioState.player.settings.region);
  expect(region.start).toBeCloseTo(3, 0);
  expect(region.end).toBeCloseTo(6, 0);
  await expect(page.locator('.viewer-audio-panel_region')).toBeVisible();

  // Played through Web Audio: the playhead moves along the landscape; the
  // effects change the graph without stopping it.
  await page.locator('.viewer-audio-panel_play').click();
  await page.waitForFunction(() => window.Viewer.audioState.player.playing && window.Viewer.audioState.player.analyser);
  await page.locator('#viewerAudioPanel select').filter({ has: page.locator('option[value="church"]') }).selectOption('church');
  await page.locator('#viewerAudioPanel select').filter({ has: page.locator('option[value="lowpass"]') }).selectOption('lowpass');
  await expect.poll(() => page.evaluate((start) => {
    const state = window.Viewer.audioState;
    let x = null;
    state.root.traverse((object) => { if (object.userData?.isAudioPlayhead) x = object.position.x; });
    return state.player.currentTime > start + 0.2 && x > -6;
  }, region.start)).toBe(true);
  expect(await page.evaluate(() => window.Viewer.audioState.player.playing)).toBe(true);
  await page.locator('.viewer-audio-panel_play').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.audioState.player.playing)).toBe(false);

  // The 3D settings rebuild the landscape: flatter, on a linear axis.
  await page.locator('#viewerAudioPanel select').filter({ has: page.locator('option[value="linear"]') }).selectOption('linear');
  expect(await page.evaluate(() => window.Viewer.audioState.root.userData.audio.frequencyScale)).toBe('linear');

  // Another model: the player stops and its panel goes. (Its option's
  // value: ./examples/... built, ./viewer/examples/... on dev.html.)
  const glb = await page.locator('#example-model-select option[value$="examples/tempietto/Tempietto.glb"]').first().getAttribute('value');
  await page.selectOption('#example-model-select', glb);
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'mesh', null, { timeout: 30_000 });
  await expect(page.locator('#viewerAudioPanel')).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.isAudioActive())).toBe(false);
});

test('audio files: the playhead dragged in the scene, the mini player, a two-sided landscape; a manifest\'s idle section planes stand at the margins', async ({ page }) => {
  // A file and then a manifest: slow with software WebGL.
  test.setTimeout(90_000);
  await openViewer(page, '/examples/audio/soundscape.wav');
  await waitForModel(page, 30_000);
  await page.waitForFunction(() => window.Viewer.isAudioActive?.() && document.getElementById('viewerAudioPanel'));
  await waitForCameraIdle(page);

  // A point of the playhead's pane on screen, moved to the time `x` (scene
  // units along the landscape, 0 its middle).
  const onScreen = (x) => page.evaluate((x) => {
    const state = window.Viewer.audioState;
    let playhead = null;
    state.root.traverse((object) => { if (object.userData?.isAudioPlayhead) playhead = object; });
    const point = playhead.position.clone();
    point.x = x;
    point.y = 0.3;
    point.z = 3;
    state.root.localToWorld(point).project(window.Viewer.camera);
    const box = document.getElementById('MainCanvas').getBoundingClientRect();
    return { x: box.left + (point.x + 1) / 2 * box.width, y: box.top + (1 - point.y) / 2 * box.height };
  }, x);
  const from = await onScreen(-6);
  const to = await onScreen(0);
  const camera = () => page.evaluate(() => window.Viewer.camera.position.toArray());
  const before = await camera();
  await page.mouse.move(from.x, from.y);
  await expect.poll(() => page.evaluate(() => document.getElementById('MainCanvas').style.cursor)).toBe('ew-resize');
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  // Half way along the 12 s, and the camera did not turn.
  expect(await page.evaluate(() => window.Viewer.audioState.player.currentTime)).toBeCloseTo(6, 0);
  const after = await camera();
  expect(Math.hypot(...after.map((value, i) => value - before[i]))).toBeLessThan(0.05);

  // The landscape is seen from below too.
  expect(await page.evaluate(() => {
    let side = null;
    window.Viewer.audioState.root.traverse((object) => { if (object.userData?.isAudioTerrain) side = object.material.side; });
    return side;
  })).toBe(2);

  // The mini player: not while the panel is open; once it is closed, at
  // the bottom, its buttons playing and moving the time.
  const mini = page.locator('#viewerAudioMiniPlayer');
  await expect(mini).toBeHidden();
  await page.evaluate(() => window.Viewer.closeAudioPanel());
  await expect(mini).toBeVisible();
  await page.evaluate(() => { window.Viewer.audioState.player.currentTime = 1; });
  await mini.locator('.viewer-audio-mini_forward').click();
  expect(await page.evaluate(() => window.Viewer.audioState.player.currentTime)).toBeCloseTo(6, 1);
  await mini.locator('.viewer-audio-mini_play').click();
  await page.waitForFunction(() => window.Viewer.audioState.player.playing);
  await expect(mini.locator('.viewer-audio-mini_play')).toHaveAttribute('aria-pressed', 'true');
  await mini.locator('.viewer-audio-mini_stop').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.audioState.player.playing)).toBe(false);
  await page.evaluate(() => window.Viewer.toggleAudioPanel());
  await expect(mini).toBeHidden();

  // A manifest as the viewer saves it: all three constants, 0 for the axes
  // never moved - the middle of the landscape. Turned on, X cuts nothing.
  await loadExampleManifest(page, 'sounds-aim3d-bird-call.json',
    "manifest.AIM3DViewer.clipping = { mode: { x: false, y: false, z: false }, constants: [0, 0, 0], outlineVisible: true };");
  await page.waitForFunction(() => window.Viewer.isAudioActive?.());
  await page.evaluate(() => window.Viewer.toggleClippingPlanesPanel());
  const clipping = await page.evaluate(() => ({
    x: window.Viewer.isClippingAxisEnabled('x'),
    cut: window.Viewer.clippingPositionToCut('x', window.Viewer.getClippingAxisPosition('x')),
  }));
  expect(clipping.x).toBe(true);
  expect(clipping.cut).toBeCloseTo(0, 3);
});

test('audio files: Ogg Vorbis with its comments and chapters', async ({ page }) => {
  await openViewer(page, '/examples/audio/soundscape.ogg');
  await waitForModel(page, 30_000);
  await page.waitForFunction(() => window.Viewer.isAudioActive?.() && document.getElementById('viewerAudioPanel'));
  const audio = await shownAudio(page);
  expect(audio.info).toMatchObject({ format: 'Ogg', codec: 'Vorbis', sampleRate: 22050, channels: 2, analysed: true });
  expect(audio.info.tags.title).toBe('Soundscape (synthetic)');
  expect(audio.markers).toEqual(['0:00 · Bell', '0:03 · Bird call', '0:05 · Chord', '0:09 · Bell again']);
  expect(audio.duration).toBeCloseTo(12, 0);

  // A file from the device (dropped, or picked in the library): read from
  // the File, its own name as the title's fallback.
  const opened = await page.evaluate(async () => {
    // The example's URL as the page has it (./viewer/examples/... on dev.html).
    const url = document.querySelector('#example-model-select option[value$="examples/audio/soundscape.wav"]').value;
    const bytes = await (await fetch(url)).arrayBuffer();
    return window.Viewer.openLocalFile(new File([bytes], 'field-recording.wav', { type: 'audio/wav' }));
  });
  expect(opened).toBe(true);
  await page.waitForFunction(() => window.Viewer.audioState?.root?.userData.audioInfo?.fileName === 'field-recording.wav' && document.getElementById('viewerAudioPanel'));
  expect((await shownAudio(page)).info).toMatchObject({ format: 'Broadcast Wave', analysed: true });
});

// An example manifest, as the page has it (/manifests/... built,
// viewer/manifesto/examples/... on dev.html).
async function loadExampleManifest(page, name, change = '') {
  await page.evaluate(async ({ name, change }) => {
    let response = await fetch(`/manifests/${name}`);
    if (!response.ok || !/json/.test(response.headers.get('content-type') || '')) response = await fetch(`./viewer/manifesto/examples/${name}`);
    const manifest = await response.json();
    if (change) new Function('manifest', change)(manifest);
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  }, { name, change });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
}

// The scene's sound sources as Web Audio hears them (editor/scene-sounds.js).
const shownSounds = (page) => page.evaluate(() => window.Viewer.getSceneSounds().map((source) => {
  const node = window.Viewer.soundsState.nodes.get(source.id);
  const audio = node?.audio;
  return {
    id: source.id,
    type: source.type,
    positional: audio ? Boolean(audio.panner) : null,
    refDistance: audio?.panner ? Math.round(audio.getRefDistance() * 100) / 100 : null,
    cone: audio?.panner ? [audio.panner.coneInnerAngle, audio.panner.coneOuterAngle] : null,
    position: audio?.panner ? audio.position.toArray().map((v) => Math.round(v * 100) / 100) : null,
  };
}));

test('sounds in the scene: a manifest\'s sources heard from the camera, a narrated tour with captions, saved again', async ({ page }) => {
  // Two manifest loads and a narration: slow with software WebGL.
  test.setTimeout(90_000);
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await loadExampleManifest(page, 'tempietto-aim3d-sound.json');
  await page.waitForFunction(() => window.Viewer.getSceneSounds().length === 3);
  await expect(page.locator('#viewerSoundsPanel')).toBeVisible();
  await expect(page.locator('#viewerSoundsPanel .viewer-sounds-panel_item')).toHaveCount(3);
  expect(await page.evaluate(() => window.Viewer.isSceneSoundPlaying())).toBe(false);

  // Autoplay: the first click starts them (browsers allow sound only then).
  await page.mouse.click(200, 400);
  await page.waitForFunction(() => window.Viewer.isSceneSoundPlaying() && window.Viewer.soundsState.nodes.size === 3);
  expect(await shownSounds(page)).toEqual([
    { id: 'wind', type: 'ambient', positional: false, refDistance: null, cone: null, position: null },
    { id: 'bell', type: 'point', positional: true, refDistance: 2.5, cone: [360, 360], position: [0, 4.6, 0.6] },
    { id: 'hum', type: 'spot', positional: true, refDistance: 1.5, cone: [35, 70], position: [0, 1.6, -0.9] },
  ]);
  // Faded in to their volumes.
  await expect.poll(() => page.evaluate(() => [...window.Viewer.soundsState.nodes.values()].map((node) => Math.round(node.audio.getVolume() * 100))), { timeout: 20_000 })
    .toEqual([45, 80, 70]);

  // The tour tells the narration of the annotation, with its captions; the
  // sounds go quieter under it. The tour waits for it to end.
  await page.evaluate(() => {
    if (!window.Viewer.isTourActive()) window.Viewer.startTour({ autoplay: false });
    window.Viewer.goToTourStep(0, { fly: false });
  });
  await page.waitForFunction(() => window.Viewer.isNarrationPlaying() && /podium/.test(window.Viewer.getNarrationEntryId()), null, { timeout: 20_000 });
  await expect(page.locator('.viewer-narration-caption')).toHaveText(/podium|steps/, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => window.Viewer.soundsState.ducked)).toBe(true);
  await expect(page.locator('.viewer-tour-panel_narration')).toBeVisible();
  // Left out with the speaker button: stopped, the sounds as loud again.
  await page.locator('.viewer-tour-panel_narration').click();
  expect(await page.evaluate(() => [window.Viewer.isNarrationPlaying(), window.Viewer.soundsState.ducked])).toEqual([false, false]);
  await page.locator('.viewer-tour-panel_narration').click();
  await page.evaluate(() => window.Viewer.stopTour());

  // Saved: AIM3DViewer.sounds, the IIIF audio emitters, the narrations.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.version).toBe(AIM3D_MANIFEST_VERSION);
  expect(manifest.AIM3DViewer.sounds.autoplay).toBe(true);
  expect(manifest.AIM3DViewer.sounds.sources.map((source) => [source.id, source.type])).toEqual([['wind', 'ambient'], ['bell', 'point'], ['hum', 'spot']]);
  const painted = manifest.items[0].items.flatMap((page) => page.items).map((annotation) => annotation.body).filter((body) => /Audio$/.test(body?.type));
  expect(painted.map((body) => body.type)).toEqual(['AmbientAudio', 'PointAudio', 'SpotAudio']);
  expect(painted[2]).toMatchObject({ angle: 70, lookAt: { type: 'PointSelector', x: 0, y: 1.4, z: 8 }, volume: { quantityValue: 0.7 } });
  const narrated = manifest.items[0].annotations[0].items.filter((annotation) => annotation.AIM3DViewer?.audio);
  expect(narrated).toHaveLength(3);
  expect(narrated[0].AIM3DViewer.audio.captions).toMatch(/narration-01\.vtt$/);
  expect(narrated[0].body[1]).toMatchObject({ type: 'Sound' });
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);

  // Another viewer's manifest: only the IIIF emitters - read from them.
  await loadExampleManifest(page, 'tempietto-aim3d-sound.json', 'delete manifest.AIM3DViewer.sounds;');
  await page.waitForFunction(() => window.Viewer.getSceneSounds().length === 3);
  expect(await page.evaluate(() => window.Viewer.getSceneSounds().map((source) => [source.type, source.volume, source.angle]))).toEqual([
    ['ambient', 0.45, 90], ['point', 0.8, 90], ['spot', 0.7, 70],
  ]);
});

test('sounds in the scene: added in the window, placed and aimed with a click, removed', async ({ page }) => {
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await waitForCameraIdle(page);
  await page.evaluate(() => window.Viewer.toggleSoundsPanel(true));
  const panel = page.locator('#viewerSoundsPanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-pointcloud-panel_note').first()).toContainText('No sounds');
  const url = await page.locator('#example-model-select option[value$="examples/audio/soundscape.ogg"]').first().getAttribute('value');
  await panel.locator('.viewer-sounds-panel_add select').selectOption('spot');
  await panel.locator('.viewer-sounds-panel_add input[type="url"]').fill(url);
  await panel.locator('.viewer-sounds-panel_add-url').click();
  await expect(panel.locator('.viewer-sounds-panel_item')).toHaveCount(1);
  expect(await page.evaluate(() => window.Viewer.getSceneSounds()[0])).toMatchObject({ type: 'spot', label: 'soundscape.ogg', angle: 90 });

  // Placed on the model where it is clicked, a little off its surface.
  const added = await page.evaluate(() => window.Viewer.getSceneSounds()[0].position);
  await panel.locator('.viewer-sounds-panel_place').click();
  await expect(panel.locator('.viewer-sounds-panel_place')).toHaveAttribute('aria-pressed', 'true');
  const canvas = await page.locator('#MainCanvas').boundingBox();
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await expect(panel.locator('.viewer-sounds-panel_place')).toHaveAttribute('aria-pressed', 'false');
  // On the box's face in front of the camera, not where it was added (the
  // middle of the view, inside the box).
  const placed = await page.evaluate(() => window.Viewer.getSceneSounds()[0].position);
  expect(placed).not.toEqual(added);
  const distance = await page.evaluate((point) => window.Viewer.camera.position.distanceTo({ x: point[0], y: point[1], z: point[2] }), placed);
  const before = await page.evaluate((point) => window.Viewer.camera.position.distanceTo({ x: point[0], y: point[1], z: point[2] }), added);
  expect(distance).toBeLessThan(before);
  // Aimed the same way; its icon and its full-volume sphere while the window is open.
  await panel.locator('.viewer-sounds-panel_aim').click();
  await page.mouse.click(canvas.x + canvas.width / 2 + 20, canvas.y + canvas.height / 2 + 20);
  expect(await page.evaluate(() => window.Viewer.getSceneSounds()[0].lookAt)).not.toBeNull();
  await expect.poll(() => page.evaluate(() => window.Viewer.soundsState.markers?.children.filter((child) => child.isSprite).length)).toBe(1);
  // No 4D timeline: no years to choose.
  await expect(panel.locator('.viewer-sounds-panel_years')).toHaveCount(0);

  await panel.locator('.viewer-sounds-panel_remove').click();
  await expect(panel.locator('.viewer-sounds-panel_item')).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.getSoundsForExport())).toBeUndefined();
});

test('sounds in a manifest for another model: the ambient ones stay, the placed ones go', () => {
  const source = JSON.parse(fs.readFileSync('viewer/manifesto/examples/tempietto-aim3d-sound.json', 'utf8'));
  const result = retargetManifest(source, 'https://example.org/models/Other.glb');
  expect(result.AIM3DViewer.sounds.sources.map((item) => item.id)).toEqual(['wind']);
  const painted = result.items[0].items.flatMap((page) => page.items).map((annotation) => annotation.body?.type).filter((type) => /Audio$/.test(type));
  expect(painted).toEqual(['AmbientAudio']);
  expect(validateAIM3DManifest(source).errors).toEqual([]);
  expect(inspectAIM3DManifest(source).features.find((feature) => feature.id === 'sounds')).toMatchObject({ present: true, count: 6, status: 'ok' });
});

test('live data: tables read from CSV and JSON, compared, and turned into colours', () => {
  // A spreadsheet's CSV where the comma is the decimal sign.
  const table = parseDataTable('﻿part;moisture;note\r\nColumn_1;9,5;"dry; ""sound"""\r\nStep 1;31,5;\r\n\r\n');
  expect(table.columns).toEqual(['part', 'moisture', 'note']);
  expect(table.rows).toEqual([{ part: 'Column_1', moisture: '9,5', note: 'dry; "sound"' }, { part: 'Step 1', moisture: '31,5', note: '' }]);
  expect(parseDataTable('a\tb\n1\t2').rows).toEqual([{ a: '1', b: '2' }]);
  expect(parseDataTable('[{"part":"Wall","t":21.5,"ok":true}]').rows).toEqual([{ part: 'Wall', t: 21.5, ok: true }]);
  expect(parseDataTable('{"rows":[{"part":"Wall"},{"part":"Roof","t":3}]}').rows).toEqual([{ part: 'Wall', t: '' }, { part: 'Roof', t: 3 }]);
  expect(parseDataTable('{"Wall":{"t":1},"Roof":{"t":2}}').rows).toEqual([{ key: 'Wall', t: 1 }, { key: 'Roof', t: 2 }]);
  expect(parseDataTable('  ')).toEqual({ columns: [], rows: [] });
  expect(parseDataTable(dataTableToCsv(table.columns, table.rows))).toEqual(table);

  expect(['9,5', '23 %', '1.250,5', '-3', '1e2', 'n/a', ''].map(dataNumber)).toEqual([9.5, 23, 1250.5, -3, 100, NaN, NaN]);
  expect(['yes', '1', '', 'no', '0', 'FALSE', 'nie'].map(dataTruthy)).toEqual([true, true, true, false, false, false, false]);
  expect(normalizeDataKey('Column_1')).toBe(normalizeDataKey('column 1'));
  expect(guessKeyColumn(['id', 'name'], [{ id: '1', name: 'Step_1' }, { id: '2', name: 'Roof' }], new Set(['step1', 'roof']))).toBe('name');

  // What changed between two tables: a changed row, a new one, one gone.
  const before = [{ part: 'A', v: 1 }, { part: 'B', v: 2 }, { part: 'C', v: 3 }];
  const after = [{ part: 'A', v: 1 }, { part: 'B', v: 5 }, { part: 'D', v: 4 }];
  expect([...diffDataRows(before, after, 'part')].sort()).toEqual(['b', 'c', 'd']);
  expect(diffDataRows(before, before, 'part').size).toBe(0);

  // Numbers along a ramp, between the ends given or the column's own.
  const rows = [{ part: 'A', v: '10', state: 'good' }, { part: 'B', v: '30', state: 'poor' }, { part: 'C', v: '', state: '#123456' }];
  const ramp = dataColorScale({ column: 'v', ramp: ['#000000', '#ffffff'] }, rows);
  expect([ramp.kind, ramp.min, ramp.max]).toEqual(['number', 10, 30]);
  expect(['10', '20', '30', '99', ''].map((value) => ramp.colorOf(value))).toEqual(['#000000', '#808080', '#ffffff', '#ffffff', null]);
  expect(dataColorScale({ column: 'v', ramp: ['#000000', '#ffffff'], min: 0, max: 40, reverse: true }, rows).colorOf('10')).toBe('#bfbfbf');
  // Texts: the colours given, the palette for the rest, a colour as it is.
  const categories = dataColorScale({ column: 'state', categories: { good: '#1a9850' } }, rows);
  expect(categories.kind).toBe('category');
  expect(['good', 'Poor', '#123456', 'unknown'].map((value) => categories.colorOf(value))).toEqual(['#1a9850', '#0072b2', '#123456', null]);
  expect(dataColorScale({ column: 'missing' }, rows).kind).toBe('none');

  expect(dataAlert({ column: 'v', above: 28 }, rows[1])).toBe(true);
  expect(dataAlert({ column: 'v', above: 28 }, rows[0])).toBe(false);
  expect(dataAlert({ column: 'v', below: 15 }, rows[0])).toBe(true);
  expect(dataAlert({ column: 'state', equals: 'POOR' }, rows[1])).toBe(true);

  // The settings as a manifest gives them.
  expect(normalizeLiveData('./table.csv')).toMatchObject({ src: './table.csv', refresh: 0, color: null, strength: 0.75 });
  expect(normalizeLiveData({ src: 'x.csv', refresh: 0.1, color: 'v', label: { column: 'v', unit: '%' }, alert: { column: 'v', above: '28' }, visible: 'on', strength: 7 }))
    .toMatchObject({ refresh: 0.5, color: { column: 'v', ramp: 'heat', min: null }, label: { column: 'v', unit: '%', name: false }, alert: { column: 'v', above: 28, below: null }, visible: { column: 'on' }, strength: 1 });

  const manifest = JSON.parse(fs.readFileSync('viewer/manifesto/examples/tempietto-aim3d-live-data.json', 'utf8'));
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  expect(inspectAIM3DManifest(manifest).features.find((feature) => feature.id === 'data')).toMatchObject({ present: true, status: 'ok' });
  manifest.AIM3DViewer.data = { rows: 'none', refresh: -1, color: { ramp: 'heat' }, strength: 2 };
  expect(validateAIM3DManifest(manifest).errors.map((error) => error.path))
    .toEqual(['$.AIM3DViewer.data.rows', '$.AIM3DViewer.data.refresh', '$.AIM3DViewer.data.strength', '$.AIM3DViewer.data.color.column']);
});

// The parts live data paints, as the model shows them (editor/live-data.js).
const liveParts = (page) => page.evaluate(() => Object.fromEntries(window.Viewer.getLiveData().parts.map((part) => {
  const state = window.Viewer.liveDataState.parts.get(part.key.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return [part.key, {
    color: part.color,
    label: part.label,
    alert: part.alert,
    visible: part.visible,
    overlays: state.meshes.filter(({ overlay }) => overlay.visible && overlay.parent === state.meshes[0].mesh).length,
    opacity: Math.round(state.material.opacity * 100) / 100,
    painted: `#${state.material.color.getHexString()}`,
  }];
})));

test('live data: a table drives the model - read again when it changes, edited in the window, pushed by the page, saved', async ({ page }) => {
  test.setTimeout(90_000);
  // The table as its server gives it: changed between two reads.
  let csv = fs.readFileSync('viewer/examples/tempietto/data/monitoring.csv', 'utf8');
  let reads = 0;
  await page.route('**/examples/tempietto/data/monitoring.csv', (route) => {
    reads += 1;
    return route.fulfill({ contentType: 'text/csv', body: csv });
  });
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  // No transitions to wait for: the looks are where they end.
  await loadExampleManifest(page, 'tempietto-aim3d-live-data.json', 'manifest.AIM3DViewer.data.refresh = 0.5; manifest.AIM3DViewer.data.transition = 0;');
  await page.waitForFunction(() => window.Viewer.getLiveData()?.parts.length === 17);

  const panel = page.locator('#viewerLiveDataPanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-livedata-panel_status')).toHaveClass(/is-live/);
  await expect(panel.locator('.viewer-livedata-panel_matched')).toHaveText('17 of 17 rows found in the model.');
  await expect(panel.locator('tbody tr')).toHaveCount(17);
  await expect(panel.locator('.viewer-livedata-panel_ends')).toHaveText('5%moisture35%');
  let parts = await liveParts(page);
  // 9.5% and 31.5% between 5 and 35 on the heat ramp; an alert above 28.
  expect(parts.Column_1).toMatchObject({ color: '#fee07e', painted: '#fee07e', label: '9.5%', alert: false, overlays: 1, visible: true });
  expect(parts.Step_1).toMatchObject({ color: '#d51c23', label: '31.5%', alert: true, overlays: 1 });
  expect(parts.Column_1.opacity).toBeGreaterThan(0.7);
  await expect(panel.locator('tbody tr.is-alert')).toHaveCount(3);
  // The model's own materials are not touched, and nothing is picked twice.
  expect(await page.evaluate(() => {
    let overlays = 0;
    window.viewer.scene.traverse((object) => { if (object.userData?.isLiveDataOverlay) overlays += 1; });
    return [overlays, window.viewer.scene.getObjectByName('live-data-labels').children.length];
  })).toEqual([17, 17]);

  // The table changes where it lives: the model follows, nothing is loaded again.
  const model = await page.evaluate(() => window.viewer.scene.getObjectByName('Column_1').uuid);
  csv = csv.replace('Column_1,9.5,good', 'Column_1,34,poor').replace(/Fallen_Drum.*\n/, '');
  await page.waitForFunction(() => window.Viewer.getLiveData().parts.find((part) => part.key === 'Column_1').label === '34%');
  await page.waitForFunction(() => window.Viewer.getLiveData().parts.length === 16);
  parts = await liveParts(page);
  expect(parts.Column_1).toMatchObject({ color: '#c40825', painted: '#c40825', alert: true });
  expect(parts.Fallen_Drum).toBeUndefined();
  expect(await page.evaluate(() => [window.Viewer.getLiveData().source.changed, window.viewer.scene.getObjectByName('Column_1').uuid])).toEqual([2, model]);
  await expect(panel.locator('tbody tr')).toHaveCount(16);
  await expect(panel.locator('input[data-row="7"][data-column="moisture"]')).toHaveValue('34');
  await expect(panel.locator('.viewer-livedata-panel_status')).toContainText('Last change');
  expect(reads).toBeGreaterThan(1);

  // A cell typed in the window; the arrow keys nudge it.
  const cell = panel.locator('input[data-row="8"][data-column="moisture"]');
  await cell.fill('20');
  await expect.poll(async () => (await liveParts(page)).Column_2.label).toBe('20%');
  await cell.press('ArrowUp');
  await cell.press('Shift+ArrowUp');
  await expect(cell).toHaveValue('31');
  parts = await liveParts(page);
  expect(parts.Column_2).toMatchObject({ label: '31%', alert: true });

  // Rows pushed by the page, and by a page that embeds the viewer.
  expect(await page.evaluate(() => window.Viewer.updateLiveDataRow('Step_2', { moisture: 6 }))).toBe(true);
  await page.evaluate(() => window.postMessage({ type: 'aim3d-data', key: 'step 3', values: { moisture: 7 } }, '*'));
  await expect.poll(async () => (await liveParts(page)).Step_3.label).toBe('7%');
  expect((await liveParts(page)).Step_2).toMatchObject({ label: '6%', alert: false });

  // Other columns: a colour per value, a part hidden, a row that names no part.
  await page.evaluate(() => {
    window.Viewer.updateLiveDataConfig({ color: { column: 'condition', categories: { good: '#1a9850', poor: '#d73027' } }, label: { column: 'condition', name: true }, alert: { column: 'condition', equals: 'poor' }, visible: 'standing' });
    window.Viewer.updateLiveDataRow('Entablature', { standing: 'no' });
    window.Viewer.updateLiveDataRow('Nowhere', { condition: 'good' });
  });
  parts = await liveParts(page);
  expect(parts.Wall_Front).toMatchObject({ color: '#1a9850', label: 'Wall_Front  good', alert: false, visible: true });
  expect(parts.Step_1).toMatchObject({ color: '#d73027', alert: true });
  expect(parts.Step_2.color).toBe('#0072b2');
  expect(parts.Entablature.visible).toBe(false);
  expect(await page.evaluate(() => window.Viewer.getLiveData().unmatched)).toEqual(['nowhere']);
  await expect(panel.locator('.viewer-livedata-panel_matched')).toHaveText('16 of 17 rows found in the model.');
  await expect(panel.locator('tbody tr.is-unmatched')).toHaveCount(1);
  await expect(panel.locator('.viewer-livedata-panel_category')).toHaveCount(3);

  // Saved: the table's URL and what its columns do.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.version).toBe(AIM3D_MANIFEST_VERSION);
  expect(manifest.AIM3DViewer.data).toEqual({
    src: './examples/tempietto/data/monitoring.csv',
    refresh: 0.5,
    key: 'part',
    color: { column: 'condition', categories: { good: '#1a9850', poor: '#d73027' } },
    label: { column: 'condition', name: true },
    alert: { column: 'condition', equals: 'poor' },
    visible: { column: 'standing' },
    transition: 0,
  });
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);

  // Rows of its own, without a URL: saved as rows.
  await page.evaluate(() => window.Viewer.setLiveData({ rows: [{ part: 'Column_1', t: 3 }, { part: 'Column_2', t: 9 }], transition: 0 }));
  expect(await page.evaluate(() => window.Viewer.getLiveData().config)).toMatchObject({ key: 'part', color: { column: 't' } });
  expect(Object.keys(await liveParts(page))).toEqual(['Column_1', 'Column_2']);
  expect(await page.evaluate(() => window.viewer.scene.getObjectByName('Entablature').visible)).toBe(true);
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.data)).toEqual({ rows: [{ part: 'Column_1', t: 3 }, { part: 'Column_2', t: 9 }], key: 'part', color: { column: 't', ramp: 'heat' }, transition: 0 });

  // Another model: the table goes with the scene it came with.
  await page.evaluate(() => window.Viewer.disposeLiveData());
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => {
    let left = 0;
    window.viewer.scene.traverse((object) => { if (object.userData?.isLiveDataOverlay || object.name === 'live-data-labels') left += 1; });
    return [left, window.Viewer.build3IFManifest().AIM3DViewer.data];
  })).toEqual([0, undefined]);
});

test('live link: what changed between two manifests, a session\'s ids and cameras', () => {
  const manifest = JSON.parse(fs.readFileSync('viewer/manifesto/examples/tempietto-aim3d-live-data.json', 'utf8'));
  expect(manifestModels(manifest)).toEqual([['Model:./examples/tempietto/Tempietto.glb']]);
  const next = structuredClone(manifest);
  expect(changedManifestBlocks(manifest, next)).toEqual([]);
  // When it was written and its renders are not the scene.
  next.AIM3DViewer.generatedAt = '2030-01-01T00:00:00.000Z';
  next.AIM3DViewer.thumbnails = [{ src: './a.png' }];
  expect(changedManifestBlocks(manifest, next)).toEqual([]);
  next.AIM3DViewer.lights[0].intensity = 0.1;
  next.AIM3DViewer.weather = { type: 'snow' };
  delete next.AIM3DViewer.data;
  next.items[0].annotations = [{ type: 'AnnotationPage', items: [] }];
  expect(changedManifestBlocks(manifest, next).sort()).toEqual(['annotations', 'data', 'lights', 'weather']);
  next.items[0].items[0].items[0].body.id = './examples/box.glb';
  expect(manifestModels(next)).not.toEqual(manifestModels(manifest));

  const id = newSessionId();
  expect(id).toMatch(SESSION_ID_PATTERN);
  expect(id).not.toBe(newSessionId());
  expect(SESSION_ID_PATTERN.test('short')).toBe(false);
  expect(SESSION_ID_PATTERN.test('../../etc/passwd')).toBe(false);

  // Only finite numbers in range pass from one viewer to another.
  const camera = normalizeSessionCamera({ position: [1, 2, 3.0000004], target: { x: 0, y: 0, z: 0 }, up: [0, 2, 0], fov: 45, zoom: 1, extra: 'x' });
  expect(camera).toEqual({ position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], fov: 45, zoom: 1 });
  expect(normalizeSessionCamera({ position: [1, 2, NaN], target: [0, 0, 0] })).toBeNull();
  expect(normalizeSessionCamera({ position: [1, 2, 3], target: [1, 2, 3] })).toBeNull();
  expect(normalizeSessionCamera({ position: '1,2,3', target: [0, 0, 0] })).toBeNull();
  expect(normalizeSessionCamera({ position: [1, 2, 3], target: [0, 0, 0], fov: 900, zoom: -1 })).toEqual({ position: [1, 2, 3], target: [0, 0, 0] });
  expect(sameSessionCamera(camera, { ...camera, position: [1, 2, 3.0001] })).toBe(true);
  expect(sameSessionCamera(camera, { ...camera, position: [1, 2, 3.1] })).toBe(false);
  expect(sameSessionCamera(camera, null)).toBe(false);
  // The projection: one of the two, and a camera that names none fits both.
  expect(normalizeSessionCamera({ ...camera, projection: 'orthographic' }).projection).toBe('orthographic');
  expect(normalizeSessionCamera({ ...camera, projection: 'fisheye' })).toEqual(camera);
  expect(sameSessionCamera({ ...camera, projection: 'orthographic' }, { ...camera, projection: 'perspective' })).toBe(false);
  expect(sameSessionCamera({ ...camera, projection: 'orthographic' }, camera)).toBe(true);

  // The look: the scene's part of the viewer block, and what differs in it.
  const look = sessionLook({ language: 'pl', theme: 'dark', ground: 'grid', backgroundColor: '#ffffff', rendering: { exposure: 1 } });
  expect(look).toEqual({ ground: 'grid', backgroundColor: '#ffffff', rendering: { exposure: 1 } });
  expect(sessionLook({ language: 'pl' })).toBeUndefined();
  expect(changedSessionLook(look, { ...look, ground: 'mirror' })).toEqual({ ground: 'grid' });
  expect(changedSessionLook(look, look)).toEqual({});
  expect(changedSessionLook(undefined, look)).toEqual({});
  // The background: a gradient of colours, nothing to fetch.
  expect(normalizeSessionBackground(' radial-gradient(circle, rgb(1, 2, 3) 0%, #fff 100%) ')).toBe('radial-gradient(circle, rgb(1, 2, 3) 0%, #fff 100%)');
  expect(normalizeSessionBackground('url(https://example.org/a.png)')).toBeNull();
  expect(normalizeSessionBackground('linear-gradient(red, url(a))')).toBeNull();
  expect(normalizeSessionBackground(7)).toBeNull();
});

const cameraAt = (page) => page.evaluate(() => window.viewer.camera.position.toArray().map((value) => Math.round(value * 10) / 10));

// Two viewers in one session, each a tab of the same browser.
async function sessionPair(page, { model = '/examples/tempietto/Tempietto.glb' } = {}) {
  await openViewer(page, model);
  await waitForModel(page);
  const id = await page.evaluate(() => window.Viewer.startLiveSession());
  const other = await page.context().newPage();
  await openViewer(other, model, `session=${id}`);
  await waitForModel(other);
  await other.waitForFunction(() => window.Viewer.getLiveLink()?.session?.peers === 2, null, { timeout: 20_000 });
  await page.waitForFunction(() => window.Viewer.getLiveLink().session.peers === 2, null, { timeout: 20_000 });
  return { id, other };
}

test('live link: a shared session - the camera, the raking light and the scene go from one viewer to the others', async ({ page }) => {
  test.setTimeout(120_000);
  const { id, other } = await sessionPair(page);
  expect(await other.evaluate(() => window.Viewer.getLiveLink().session)).toMatchObject({ id, mode: 'browser', send: true, receive: true });
  expect(await page.evaluate(() => window.Viewer.getLiveLink().session.link)).toContain(`session=${id}`);

  // The first viewer moves: the second follows.
  await page.evaluate(() => {
    window.viewer.camera.position.set(3, 9, 14);
    window.Viewer.setRakingLight(true);
  });
  await expect.poll(() => cameraAt(other), { timeout: 20_000 }).toEqual([3, 9, 14]);
  await expect.poll(() => other.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.rakingLight?.enabled), { timeout: 20_000 }).toBe(true);
  // What arrived is not sent back: the first viewer stays where it was put.
  await other.waitForTimeout(1500);
  expect(await cameraAt(page)).toEqual([3, 9, 14]);
  const sentByOther = await other.evaluate(() => window.Viewer.getLiveLink().session.sent);

  // The second viewer is the remote control now.
  await other.evaluate(() => {
    window.viewer.camera.position.set(-8, 3, 6);
    window.Viewer.setRakingLight(false);
  });
  await expect.poll(() => cameraAt(page), { timeout: 20_000 }).toEqual([-8, 3, 6]);
  await expect.poll(() => page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.rakingLight?.enabled === true), { timeout: 20_000 }).toBe(false);
  expect(await other.evaluate(() => window.Viewer.getLiveLink().session.sent)).toBeGreaterThan(sentByOther);

  // Not following: the first viewer keeps its view.
  await page.evaluate(() => window.Viewer.setLiveSessionOptions({ receive: false }));
  await other.evaluate(() => window.viewer.camera.position.set(1, 1, 20));
  await other.waitForTimeout(2000);
  expect(await cameraAt(page)).toEqual([-8, 3, 6]);
  await page.evaluate(() => window.Viewer.setLiveSessionOptions({ receive: true }));

  // The window: the link to hand on, and who is there.
  await page.evaluate(() => window.Viewer.toggleLiveLinkPanel(true));
  const panel = page.locator('#viewerLiveLinkPanel');
  await expect(panel.locator('.viewer-livelink-panel_link')).toHaveValue(new RegExp(`session=${id}`));
  await expect(panel.locator('details[data-section="session"] .viewer-livedata-panel_status')).toHaveText('In the session: 2');

  // Another model opened by the first: the others open it too.
  await page.evaluate(async () => {
    document.querySelector('#example-model-select').value = [...document.querySelectorAll('#example-model-select option')].find((option) => /examples\/animated\.glb$/.test(option.value)).value;
    document.querySelector('#example-model-select').dispatchEvent(new Event('change'));
  });
  await expect.poll(() => other.evaluate(() => String(window.Viewer.shownModelUrl || '')), { timeout: 40_000 }).toMatch(/examples\/animated\.glb$/);

  await panel.locator('.viewer-livelink-panel_leave').click();
  expect(await page.evaluate(() => window.Viewer.getLiveLink().session)).toBeNull();
  await other.close();
});

test('live link: a shared session - the lights, the measurements, the ground, the projection and the materials', async ({ page }) => {
  test.setTimeout(150_000);
  const { other } = await sessionPair(page);
  const block = (target, key) => target.evaluate((name) => window.Viewer.build3IFManifest().AIM3DViewer[name], key);
  // How often the others' lights were set here.
  await other.evaluate(() => {
    window.lightsSet = 0;
    const apply = window.Viewer.apply3IFManifestLights;
    window.Viewer.apply3IFManifestLights = function (...parameters) {
      window.lightsSet += 1;
      return apply.apply(this, parameters);
    };
  });

  // The lights: one made stronger and coloured, one added.
  await page.evaluate(() => {
    window.Viewer.dirLight.intensity = 2.25;
    window.Viewer.dirLight.color.set('#ff8800');
    window.Viewer.dirLight.position.set(4, 9, -3);
  });
  await expect.poll(() => other.evaluate(() => [window.Viewer.dirLight.intensity, `#${window.Viewer.dirLight.color.getHexString()}`, window.Viewer.dirLight.position.toArray()]), { timeout: 20_000 })
    .toEqual([2.25, '#ff8800', [4, 9, -3]]);
  const lights = await block(page, 'lights');
  await page.evaluate((list) => window.Viewer.apply3IFManifestLights([...list, { type: 'PointLight', position: [1, 2, 3], color: '#00ff00', intensity: 5, distance: 20, decay: 2 }]), lights);
  await expect.poll(async () => (await block(other, 'lights')).filter((light) => light.type === 'PointLight'), { timeout: 20_000 })
    .toMatchObject([{ position: [1, 2, 3], color: '#00ff00', intensity: 5 }]);

  // The camera moves with its own light: the lights are not set again.
  await other.waitForTimeout(1500);
  const lightsSet = await other.evaluate(() => window.lightsSet);
  await page.evaluate(() => window.viewer.camera.position.set(5, 6, 12));
  await expect.poll(() => cameraAt(other), { timeout: 20_000 }).toEqual([5, 6, 12]);
  await page.evaluate(() => window.viewer.camera.position.set(6, 6, 12));
  await expect.poll(() => cameraAt(other), { timeout: 20_000 }).toEqual([6, 6, 12]);
  await other.waitForTimeout(1500);
  expect(await other.evaluate(() => window.lightsSet)).toBe(lightsSet);
  // Nor is what arrived sent back.
  expect((await block(page, 'lights')).filter((light) => light.type === 'PointLight')).toHaveLength(1);

  // Under the raking light a light keeps the strength it was given.
  await page.evaluate(() => window.Viewer.setRakingLight(true));
  await expect.poll(() => other.evaluate(() => window.Viewer.rakingLight.enabled), { timeout: 20_000 }).toBe(true);
  expect((await block(other, 'lights')).find((light) => light.color === '#ff8800').intensity).toBe(2.25);
  await page.evaluate(() => window.Viewer.setRakingLight(false));
  await expect.poll(() => other.evaluate(() => [window.Viewer.rakingLight.enabled, window.Viewer.dirLight.intensity]), { timeout: 20_000 }).toEqual([false, 2.25]);

  // Measurements: placed by one, shown to the other; taken away again.
  await page.evaluate(() => window.Viewer.applySavedMeasurements([
    { mode: 'distance', points: [[0, 0, 0], [1, 0, 0]] },
    { mode: 'area', points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] },
  ]));
  await expect.poll(() => block(other, 'measurements'), { timeout: 20_000 }).toEqual([
    { mode: 'distance', points: [[0, 0, 0], [1, 0, 0]] },
    { mode: 'area', points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] },
  ]);
  await other.evaluate(() => window.Viewer.clearMeasurements());
  await expect.poll(() => page.evaluate(() => window.Viewer.measurementResults.length), { timeout: 20_000 }).toBe(0);

  // The ground and the background, without the rest of the viewer block.
  const language = await other.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.viewer.language);
  await page.evaluate(() => {
    window.Viewer.setGroundPreset('grid');
    window.viewer.scene.background = window.Viewer.dirLight.color.clone().set('#123456');
  });
  await expect.poll(async () => {
    const viewer = await block(other, 'viewer');
    return [viewer.ground, viewer.backgroundColor, viewer.language];
  }, { timeout: 20_000 }).toEqual(['grid', '#123456', language]);

  // The background's gradient, as the canvas shows it.
  await page.evaluate(() => document.querySelector('#MainCanvas').style.setProperty('background', 'radial-gradient(circle, rgb(10, 20, 30) 0%, rgb(200, 210, 220) 100%)'));
  await expect.poll(() => other.evaluate(() => document.querySelector('#MainCanvas').style.getPropertyValue('background')), { timeout: 20_000 })
    .toBe(await page.evaluate(() => document.querySelector('#MainCanvas').style.getPropertyValue('background')));
  expect(await other.evaluate(() => document.querySelector('#MainCanvas').style.getPropertyValue('background'))).toContain('rgb(200, 210, 220)');

  // The projection.
  await page.evaluate(() => window.Viewer.setCameraProjection('orthographic'));
  await expect.poll(() => other.evaluate(() => window.viewer.camera.isOrthographicCamera === true), { timeout: 20_000 }).toBe(true);
  expect(await cameraAt(other)).toEqual(await cameraAt(page));
  await other.evaluate(() => window.Viewer.setCameraProjection('perspective'));
  await expect.poll(() => page.evaluate(() => window.viewer.camera.isPerspectiveCamera === true), { timeout: 20_000 }).toBe(true);

  // The materials: one edited, then as loaded again.
  const edited = await page.evaluate(() => {
    const [item] = window.Viewer.materialsEditor.items;
    window.Viewer.setMaterialProperty('color', '#aa0000', item.id);
    return item.name;
  });
  await expect.poll(async () => (await block(other, 'materials'))?.map((entry) => [entry.name, entry.params.color]), { timeout: 20_000 }).toEqual([[edited, '#aa0000']]);
  await other.evaluate(() => window.Viewer.resetAllMaterials());
  await expect.poll(() => block(page, 'materials'), { timeout: 20_000 }).toBeUndefined();
  await other.close();
});

test('live link: a shared session - the comments, the scene\'s cameras, the photos, the sounds and the surroundings', async ({ page }) => {
  test.setTimeout(180_000);
  const { other } = await sessionPair(page);
  const block = (target, key) => target.evaluate((name) => window.Viewer.build3IFManifest().AIM3DViewer[name], key);
  const comments = (target) => target.evaluate(() => window.Viewer.getAnnotationEntriesForPersistence().map((entry) => [entry.title, entry.point, entry.certainty?.value ?? null]));

  // Comments: written by one, read by the other; changed there; taken away.
  await page.evaluate(() => {
    window.Viewer.annotationEntries = [
      { id: 'note-1', targetId: 'model-root', point: [0, 1, 0], title: 'Lantern', description: 'Rebuilt in 1605.' },
      { id: 'note-2', targetId: 'model-root', point: [1, 0.5, 0], title: 'Step', description: '' },
    ];
    window.Viewer.refreshAnnotationPOIs();
  });
  await expect.poll(() => comments(other), { timeout: 20_000 }).toEqual([['Lantern', [0, 1, 0], null], ['Step', [1, 0.5, 0], null]]);
  expect(await other.evaluate(() => window.Viewer.annotationPOIMarkers.length)).toBe(await page.evaluate(() => window.Viewer.annotationPOIMarkers.length));
  await other.evaluate(() => {
    window.Viewer.annotationEntries = window.Viewer.annotationEntries.slice(0, 1).map((entry) => ({ ...entry, title: 'The lantern' }));
    window.Viewer.refreshAnnotationPOIs();
  });
  await expect.poll(() => comments(page), { timeout: 20_000 }).toEqual([['The lantern', [0, 1, 0], null]]);
  await page.evaluate(() => {
    window.Viewer.annotationEntries = [];
    window.Viewer.refreshAnnotationPOIs();
  });
  await expect.poll(() => comments(other), { timeout: 20_000 }).toEqual([]);

  // The scene's cameras: added from the view, named, removed.
  await page.evaluate(() => {
    window.Viewer.addSceneCameraFromView();
    window.Viewer.setSceneCameraProperty('label', 'From the gate');
  });
  await expect.poll(() => other.evaluate(() => window.Viewer.getSceneCameras().map((camera) => camera.label)), { timeout: 20_000 }).toEqual(['From the gate']);
  expect(await other.evaluate(() => window.Viewer.getSceneCameras()[0].position.toArray().map((value) => Math.round(value * 100))))
    .toEqual(await page.evaluate(() => window.Viewer.getSceneCameras()[0].position.toArray().map((value) => Math.round(value * 100))));
  await other.evaluate(() => window.Viewer.removeActiveSceneCamera());
  await expect.poll(() => page.evaluate(() => window.Viewer.getSceneCameras().length), { timeout: 20_000 }).toBe(0);

  // Photos: the list, the one held over the view and how much of it shows -
  // without their window opening at the others'.
  const photo = await page.evaluate(() => {
    const item = window.Viewer.addPhoto({ src: '/examples/tempietto/photos/Tempietto_1783.webp', label: 'In 1783', open: false });
    window.Viewer.openPhoto(item.id, { fly: false });
    window.Viewer.setPhotoOpacity(0.4);
    return item.id;
  });
  await expect.poll(() => other.evaluate(() => [window.Viewer.getOpenPhoto()?.id ?? null, window.Viewer.photosState?.opacity ?? null]), { timeout: 20_000 }).toEqual([photo, 0.4]);
  expect(await other.evaluate(() => window.Viewer.isPhotosPanelOpen())).toBe(false);
  await other.evaluate(() => window.Viewer.closePhoto());
  await expect.poll(() => page.evaluate(() => window.Viewer.getOpenPhoto()), { timeout: 20_000 }).toBeNull();

  // The scene's sounds.
  await page.evaluate(() => window.Viewer.setSceneSounds({ sources: [{ id: 'bells', type: 'ambient', src: '/examples/audio/soundscape.ogg', label: 'Bells' }] }));
  await expect.poll(async () => (await block(other, 'sounds'))?.sources.map((source) => [source.id, source.label]), { timeout: 20_000 }).toEqual([['bells', 'Bells']]);
  expect(await other.evaluate(() => window.Viewer.isSoundsPanelOpen())).toBe(false);

  // The generated surroundings, without their window.
  await page.evaluate(() => window.Viewer.apply3IFManifestSurroundings({ kind: 'shtetl', year: 1780, seed: 7 }));
  await expect.poll(async () => {
    const surroundings = await block(other, 'surroundings');
    return [surroundings?.kind, surroundings?.year, surroundings?.seed, surroundings?.open ?? false];
  }, { timeout: 40_000 }).toEqual(['shtetl', 1780, 7, false]);
  await other.evaluate(() => window.Viewer.setSurroundings(false));
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.enabled), { timeout: 20_000 }).toBe(false);
  await other.close();
});

test('live link: a shared session - a point cloud\'s, an image\'s, a volume\'s and a sound file\'s tools', async ({ page }) => {
  test.setTimeout(240_000);
  // A point cloud: how its points are drawn.
  let { other } = await sessionPair(page, { model: '/examples/box.xyz' });
  await page.waitForFunction(() => window.Viewer.pointCloudState);
  await other.waitForFunction(() => window.Viewer.pointCloudState);
  await page.evaluate(() => {
    window.Viewer.setPointCloudShape('round');
    window.Viewer.setPointCloudEdl(0.25);
    window.Viewer.setPointCloudSize(2);
  });
  await expect.poll(() => other.evaluate(() => [window.Viewer.pointCloudState.shape, window.Viewer.pointCloudState.edl, window.Viewer.pointCloudState.size]), { timeout: 20_000 }).toEqual(['round', 0.25, 2]);
  await other.close();
  await page.evaluate(() => window.Viewer.leaveLiveSession());

  // A 2D image: its filters, and the defaults again.
  ({ other } = await sessionPair(page, { model: '/examples/images/inscription.png' }));
  await page.waitForFunction(() => window.Viewer.imageState?.api);
  await other.waitForFunction(() => window.Viewer.imageState?.api);
  await page.evaluate(() => window.Viewer.apply3IFManifestImage({ invert: true, contrast: 1.5 }));
  await expect.poll(() => other.evaluate(() => window.Viewer.getImageForExport()), { timeout: 20_000 }).toEqual({ invert: true, contrast: 1.5 });
  await other.evaluate(() => window.Viewer.apply3IFManifestImage({ invert: false, contrast: 1 }));
  await expect.poll(() => page.evaluate(() => window.Viewer.getImageForExport()), { timeout: 20_000 }).toBeUndefined();
  await other.close();
  await page.evaluate(() => window.Viewer.leaveLiveSession());

  // A volume: the rendering mode and its strength.
  ({ other } = await sessionPair(page, { model: '/examples/volumes/amphora-ct.nrrd' }));
  await page.waitForFunction(() => window.Viewer.volumeState?.api);
  await other.waitForFunction(() => window.Viewer.volumeState?.api);
  await page.evaluate(() => window.Viewer.updateVolumeSettings((settings) => {
    settings.mode = 'iso';
    settings.iso = 0.45;
  }));
  await expect.poll(() => other.evaluate(() => [window.Viewer.volumeState.mesh.userData.volume.mode, window.Viewer.volumeState.mesh.userData.volume.iso]), { timeout: 20_000 }).toEqual(['iso', 0.45]);
  await other.close();
  await page.evaluate(() => window.Viewer.leaveLiveSession());

  // A sound file: its view and its playback settings.
  ({ other } = await sessionPair(page, { model: '/examples/audio/shofar.ogg' }));
  await page.waitForFunction(() => window.Viewer.audioState?.player);
  await other.waitForFunction(() => window.Viewer.audioState?.player);
  await page.evaluate(() => window.Viewer.apply3IFManifestAudio({ range: 40, playback: { rate: 0.5, loop: true } }));
  await expect.poll(() => other.evaluate(() => window.Viewer.getAudioForExport()), { timeout: 20_000 }).toEqual({ range: 40, playback: { rate: 0.5, loop: true } });
  // Its settings are applied a moment later (the module is fetched).
  await other.waitForTimeout(1500);
  await other.evaluate(() => window.Viewer.apply3IFManifestAudio({ range: 60, playback: { rate: 1, loop: false } }));
  await expect.poll(() => page.evaluate(() => window.Viewer.getAudioForExport()), { timeout: 20_000 }).toBeUndefined();
  await other.close();
});

test('live link: a session through the worker\'s relay', async ({ page }) => {
  test.setTimeout(120_000);
  // The relay (worker/live_sessions.py), answered at once here.
  const rooms = new Map();
  await page.context().route('**/api/live/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split('/').pop();
    const room = rooms.get(name) || { version: 0, state: null, sender: '', peers: new Set() };
    rooms.set(name, room);
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      room.version += 1;
      room.state = body.state;
      room.sender = body.client;
      room.peers.add(body.client);
      return route.fulfill({ json: { version: room.version, peers: room.peers.size } });
    }
    room.peers.add(url.searchParams.get('client'));
    const since = Number(url.searchParams.get('since'));
    if (room.version <= since) await new Promise((resolve) => setTimeout(resolve, 250));
    return route.fulfill({
      json: room.version > since && room.state
        ? { version: room.version, state: room.state, sender: room.sender, peers: room.peers.size }
        : { version: room.version, peers: room.peers.size },
    });
  });
  const { id, other } = await sessionPair(page);
  expect(await other.evaluate(() => window.Viewer.getLiveLink().session.mode)).toBe('server');
  await page.evaluate(() => window.viewer.camera.position.set(2, 7, 11));
  await expect.poll(() => cameraAt(other), { timeout: 20_000 }).toEqual([2, 7, 11]);
  // Who joins later gets the scene as it is.
  const late = await page.context().newPage();
  await openViewer(late, '/examples/tempietto/Tempietto.glb', `session=${id}`);
  await waitForModel(late);
  await expect.poll(() => cameraAt(late), { timeout: 20_000 }).toEqual([2, 7, 11]);
  expect(rooms.get(id).peers.size).toBe(3);
  await late.close();
  await other.close();
});

test('live link: the manifest followed - only what changed is applied, the model stays', async ({ page }) => {
  test.setTimeout(120_000);
  let manifest = JSON.parse(fs.readFileSync('viewer/manifesto/examples/tempietto-aim3d-toon.json', 'utf8'));
  await page.route('**/manifests/followed.json', (route) => route.fulfill({ json: manifest }));
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await page.evaluate(async () => {
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(new URL('/manifests/followed.json', window.location.href).href, 'url');
  });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
  const model = await page.evaluate(() => window.viewer.scene.getObjectByName('Column_1').uuid);
  expect(await page.evaluate(() => window.Viewer.followLiveManifest({ interval: 0.5 }))).toBe(true);
  await page.waitForFunction(() => window.Viewer.liveLinkState.manifest.lastText !== null);

  // The manifest changes where it lives: a light, the shading, the camera.
  manifest = structuredClone(manifest);
  manifest.AIM3DViewer.lights[0].intensity = 0.11;
  manifest.AIM3DViewer.modelTransform.shadingMode = 'original';
  manifest.AIM3DViewer.camera.position = [0, 12, 12];
  manifest.AIM3DViewer.rakingLight = { enabled: true, direction: 120, height: 20 };
  await page.waitForFunction(() => window.Viewer.getLiveLink().manifest.reloads === 1, null, { timeout: 20_000 });
  expect((await page.evaluate(() => window.Viewer.getLiveLink().manifest.changed)).sort()).toEqual(['camera', 'lights', 'modelTransform', 'rakingLight']);
  await expect.poll(() => cameraAt(page), { timeout: 20_000 }).toEqual([0, 12, 12]);
  const scene = await page.evaluate(() => {
    const block = window.Viewer.build3IFManifest().AIM3DViewer;
    return { raking: block.rakingLight?.enabled, shading: window.Viewer.shadingMode, uuid: window.viewer.scene.getObjectByName('Column_1').uuid };
  });
  // The same model object: nothing was loaded again.
  expect(scene).toEqual({ raking: true, shading: 'original', uuid: model });

  // The settings typed in the window: applied as they are, or refused.
  await page.evaluate(() => window.Viewer.toggleLiveLinkPanel(true));
  const editor = page.locator('#viewerLiveLinkPanel textarea');
  await expect(page.locator('#viewerLiveLinkPanel details[data-section="manifest"] .viewer-livedata-panel_status')).toHaveClass(/is-live/);
  const block = JSON.parse(await editor.inputValue());
  expect(block.rakingLight.enabled).toBe(true);
  block.rakingLight.enabled = false;
  await editor.fill(JSON.stringify(block, null, 2));
  await expect(page.locator('.viewer-livelink-panel_editor-note')).toHaveText('Applied: rakingLight');
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.rakingLight?.enabled === true)).toBe(false);
  await editor.fill('{ "camera": ');
  await expect(editor).toHaveClass(/is-invalid/);
  await expect(page.locator('.viewer-livelink-panel_editor-note')).toContainText('Not applied yet');

  // Another model in the manifest: that one is loaded, and still followed.
  manifest = JSON.parse(JSON.stringify(manifest).replaceAll('examples/tempietto/Tempietto.glb', 'examples/box.glb'));
  await page.waitForFunction(() => window.Viewer.getLiveLink().manifest?.changed[0] === 'model', null, { timeout: 40_000 });
  expect(await page.evaluate(() => [Boolean(window.viewer.scene.getObjectByName('Column_1')), window.Viewer.getLiveLink().manifest.kind])).toEqual([false, 'url']);

  // A scene opened by hand ends the following.
  await loadExampleManifest(page, 'box-aim3d-local.json');
  expect(await page.evaluate(() => window.Viewer.getLiveLink().manifest)).toBeNull();
});

test('live link: the model\'s file followed - saved again, it takes the old one\'s place and the scene stays', async ({ page }) => {
  test.setTimeout(120_000);
  let file = 'viewer/examples/tempietto/Tempietto.glb';
  let heads = 0;
  await page.route('**/examples/followed/model.glb', (route) => {
    const body = fs.readFileSync(file);
    const headers = { ETag: `"${file}"`, 'Content-Length': String(body.length), 'Content-Type': 'model/gltf-binary' };
    if (route.request().method() === 'HEAD') {
      heads += 1;
      return route.fulfill({ status: 200, headers });
    }
    return route.fulfill({ status: 200, headers, body });
  });
  await openViewer(page, '/examples/followed/model.glb');
  await waitForModel(page);
  expect(await page.evaluate(() => Boolean(window.viewer.scene.getObjectByName('Column_1')))).toBe(true);
  // The scene around the model: a view, a raking light.
  await page.evaluate(() => {
    // Ends the opening flight of the camera, which would take the view back.
    window.Viewer.glideLiveCamera({ position: [4, 6, 9], target: [0, 2, 0] }, 0);
    window.Viewer.setRakingLight(true);
  });
  expect(await page.evaluate(() => window.Viewer.followLiveModel({ interval: 0.5 }))).toBe(true);
  await page.waitForFunction(() => window.Viewer.liveLinkState.model.stamp !== null);

  // Nothing changed: nothing is loaded.
  await expect.poll(() => heads).toBeGreaterThan(2);
  expect(await page.evaluate(() => window.Viewer.getLiveLink().model.reloads)).toBe(0);

  // Saved again (another file under the same address).
  file = 'viewer/examples/box.glb';
  await page.waitForFunction(() => window.Viewer.getLiveLink().model.reloads === 1, null, { timeout: 60_000 });
  const after = await page.evaluate(() => ({
    tempietto: Boolean(window.viewer.scene.getObjectByName('Column_1')),
    camera: window.viewer.camera.position.toArray().map((value) => Math.round(value * 10) / 10),
    raking: window.Viewer.build3IFManifest().AIM3DViewer.rakingLight?.enabled,
    shown: window.Viewer.shownModelUrl,
    following: window.Viewer.getLiveLink().model.kind,
  }));
  expect(after).toMatchObject({ tempietto: false, camera: [4, 6, 9], raking: true, following: 'url' });
  expect(after.shown).toMatch(/followed\/model\.glb$/);
  // The old view was held over the canvas, then let go.
  await expect(page.locator('.viewer-livelink-veil')).toHaveCount(0, { timeout: 10_000 });

  await page.evaluate(() => window.Viewer.stopLiveModel());
  const stopped = heads;
  await page.waitForTimeout(1500);
  expect(heads).toBeLessThanOrEqual(stopped + 1);
});

// A closed box of w × h × d (scene units), its faces cut into n × n squares.
function roomBox(w, h, d, { roof = true, n = 3 } = {}) {
  const triangles = [];
  const face = (origin, u, v) => {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const at = (a, b) => [0, 1, 2].map((k) => origin[k] + (u[k] * a) / n + (v[k] * b) / n);
        const [p, q, r, s] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        triangles.push(...p, ...q, ...r, ...p, ...r, ...s);
      }
    }
  };
  face([0, 0, 0], [w, 0, 0], [0, 0, d]);
  if (roof) face([0, h, 0], [w, 0, 0], [0, 0, d]);
  face([0, 0, 0], [w, 0, 0], [0, h, 0]);
  face([0, 0, d], [w, 0, 0], [0, h, 0]);
  face([0, 0, 0], [0, 0, d], [0, h, 0]);
  face([w, 0, 0], [0, 0, d], [0, h, 0]);
  return { positions: new Float32Array(triangles), materials: null, size: Math.hypot(w, h, d) };
}

test('room acoustics: a box room traced as the formulas say, and a ruin without a roof drier', () => {
  // 20 × 10 × 30 m of plaster with benches on the floor: 6000 m³, mean free
  // path 4V/S = 10.9 m.
  const options = { position: [10, 1.6, 12], material: 'plaster', floor: 'people', rays: 1500, seed: 3 };
  const room = traceRoom(roomBox(20, 10, 30), options);
  expect(room.volume).toBeGreaterThan(5400);
  expect(room.volume).toBeLessThan(6600);
  expect(room.meanFreePath).toBeGreaterThan(10.3);
  expect(room.meanFreePath).toBeLessThan(11.5);
  expect(room.openness).toBe(0);
  // The decay of the histogram agrees with Eyring's formula (within 15%),
  // band by band; the high bands shorter (people and the air absorb more).
  room.rtFromDecay.forEach((rt, band) => {
    expect(rt, `band ${room.bands[band]}`).not.toBeNull();
    expect(Math.abs(rt / room.rtEyring[band] - 1), `band ${room.bands[band]}`).toBeLessThan(0.15);
  });
  expect(room.rt[0]).toBeGreaterThan(room.rt[3]);
  expect(room.rt[5]).toBeLessThan(room.rt[3]);
  // The critical distance is the diffuse field's, 0.057 √(V / T).
  const classic = 0.057 * Math.sqrt(room.volume / room.rtMid);
  expect(Math.abs(room.criticalDistance / classic - 1)).toBeLessThan(0.05);
  expect(sendGain(room, room.criticalDistance)).toBeCloseTo(1, 5);
  expect(sendGain(room, room.criticalDistance / 2)).toBeCloseTo(0.5, 5);
  expect(sendGain(null, 1)).toBe(0);

  // Without the roof: a fifth of the directions see the sky, the sound
  // leaves through it - a shorter reverberation, a clearer room (bare
  // floors in both: benches would take the sound coming down either way).
  const bare = { ...options, floor: 'material' };
  const roofed = traceRoom(roomBox(20, 10, 30), bare);
  const ruin = traceRoom(roomBox(20, 10, 30, { roof: false }), bare);
  expect(ruin.openness).toBeGreaterThan(0.15);
  expect(ruin.openness).toBeLessThan(0.3);
  expect(ruin.rtMid).toBeLessThan(roofed.rtMid * 0.9);
  expect(ruin.c80).toBeGreaterThan(roofed.c80 + 1);
  // Benches with people: shorter than bare floors.
  expect(room.rtMid).toBeLessThan(roofed.rtMid);
  expect(ruin.surfaces.open).toBeGreaterThan(0);
  // The same room in centimeters: the same seconds.
  const inCentimeters = traceRoom(roomBox(2000, 1000, 3000), { ...options, position: [1000, 160, 1200], metersPerUnit: 0.01 });
  expect(Math.abs(inCentimeters.rtMid / room.rtMid - 1)).toBeLessThan(0.1);
  expect(Math.abs(inCentimeters.criticalDistance / (room.criticalDistance * 100) - 1)).toBeLessThan(0.1);

  // The impulse response: stereo, as long as the longest band needs, each
  // channel of energy 1, the two ears different.
  const response = synthesizeImpulseResponse(room, 8000);
  expect(response.channels).toHaveLength(2);
  expect(response.seconds).toBeGreaterThan(Math.max(...room.rt));
  const energy = (channel) => channel.reduce((sum, value) => sum + value * value, 0);
  expect(energy(response.channels[0])).toBeCloseTo(1, 3);
  expect(energy(response.channels[1])).toBeCloseTo(1, 3);
  expect(response.channels[0][1000]).not.toBe(response.channels[1][1000]);
  // Its decay, read back, is the room's: between its shortest band and its
  // longest (the low one, which also carries the most energy).
  const squared = Array.from(response.channels[0].filter((_, index) => index % 16 === 0), (value) => value * value);
  const readBack = schroederRT(squared, 16 / 8000);
  expect(readBack).toBeGreaterThan(Math.min(...room.rt));
  expect(readBack).toBeLessThan(Math.max(...room.rt) * 1.1);

  // Materials by name, in English, Polish and German; walls say nothing.
  expect(['Oak_planks', 'Okno szklo', 'Kalkstein', 'Tynk_wapienny', 'Vorhang rot', 'Wall_01', ''].map(materialFromName))
    .toEqual(['wood', 'glass', 'stone', 'plaster', 'fabric', null, null]);
});

test('room acoustics in the Sounds window: the Wolpa prayer hall worked out, heard, saved', async ({ page }) => {
  // The worker traces 90 000 triangles: slow with a busy CPU.
  test.setTimeout(120_000);
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await loadExampleManifest(page, 'wolpa-synagogue-aim3d-local-acoustics.json');
  await page.waitForFunction(() => window.Viewer.getSceneSounds().length === 1);
  const panel = page.locator('#viewerSoundsPanel');
  await expect(panel.locator('.viewer-sounds-panel_acoustics')).toBeVisible();
  await expect(panel.locator('.viewer-sounds-panel_acoustics-status')).toContainText('Not worked out yet');
  expect(await page.evaluate(() => window.Viewer.getSceneAcoustics())).toMatchObject({ on: true, position: [0, 270, 250], material: 'wood', floor: 'pews', amount: 1 });

  // Played (the first click): the room is worked out, then heard through the
  // convolver - the source sends to it.
  await page.mouse.click(200, 400);
  await page.waitForFunction(() => window.Viewer.soundsState.acoustics.result, null, { timeout: 90_000 });
  const room = await page.evaluate(() => {
    const { acoustics, nodes } = window.Viewer.soundsState;
    const node = nodes.get('call');
    return {
      rt: acoustics.result.rtMid,
      volume: acoustics.result.volume,
      wood: acoustics.result.surfaces.wood,
      assumed: acoustics.assumedUnit,
      buffer: [acoustics.nodes.convolver.buffer.numberOfChannels, acoustics.nodes.convolver.normalize],
      send: Boolean(node?.send),
    };
  });
  // A wooden hall of some 1000 m³ with benches: about two seconds.
  expect(room.rt).toBeGreaterThan(1);
  expect(room.rt).toBeLessThan(4);
  expect(room.volume).toBeGreaterThan(500);
  expect(room.volume).toBeLessThan(3000);
  expect(room.wood).toBeGreaterThan(0.8);
  expect(room.assumed).toBeNull();
  expect(room.buffer).toEqual([2, false]);
  expect(room.send).toBe(true);
  await expect.poll(() => page.evaluate(() => window.Viewer.soundsState.nodes.get('call').sendLevel), { timeout: 20_000 }).toBeGreaterThan(0.1);
  await expect(panel.locator('.viewer-sounds-panel_acoustics-status')).toContainText('Reverberation');
  await expect(panel.locator('.viewer-sounds-panel_band')).toHaveCount(6);
  // The listening point shows while the window is open.
  expect(await page.evaluate(() => window.Viewer.soundsState.markers.children.some((child) => child.userData.listeningPoint))).toBe(true);

  // Out of the room: no send. Less reverberation: a smaller one.
  await panel.locator('.viewer-sounds-panel_details .viewer-audio-panel_check', { hasText: "In the room's acoustics" }).locator('input').uncheck();
  await expect.poll(() => page.evaluate(() => window.Viewer.soundsState.nodes.get('call').sendLevel)).toBe(0);
  await panel.locator('.viewer-sounds-panel_details .viewer-audio-panel_check', { hasText: "In the room's acoustics" }).locator('input').check();
  await page.evaluate(() => window.Viewer.updateSceneAcoustics({ amount: 0.5 }));
  const half = await page.evaluate(() => window.Viewer.soundsState.nodes.get('call').sendLevel);
  await page.evaluate(() => window.Viewer.updateSceneAcoustics({ amount: 1 }));
  await expect.poll(() => page.evaluate(() => window.Viewer.soundsState.nodes.get('call').sendLevel)).toBeCloseTo(half * 2, 4);

  // Saved with the sounds, valid; the result itself is not kept.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.sounds.acoustics).toEqual({ on: true, position: [0, 270, 250], material: 'wood', floor: 'pews' });
  expect(manifest.AIM3DViewer.sounds.sources[0].acoustics).toBe(true);
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  // For another model, the listening point goes with the placed sources.
  const retargeted = retargetManifest(manifest, 'https://example.org/models/Other.glb');
  expect(retargeted.AIM3DViewer.sounds).toBeUndefined();
});

// The 2D image shown (image2d.js): its file, the shader's settings, the set.
const shownImage = (page) => page.evaluate(() => {
  const state = window.Viewer.imageState;
  if (!state?.api) return null;
  const image = state.api.getImageState(state.root);
  const uniforms = image.material.uniforms;
  return {
    kind: window.Viewer.getModelKind(),
    info: state.root.userData.imageInfo,
    settings: state.root.userData.image,
    index: image.index,
    count: image.items.length,
    uniforms: { relief: uniforms.relief.value, levels: uniforms.levels.value, split: uniforms.split.value, channel: uniforms.channel.value },
    plane: image.plane.scale.toArray().map((value) => Math.round(value * 10000) / 10000),
  };
});

test('2D images: one image with its resolution and tags, enhanced on the GPU, saved as PNG', async ({ page }) => {
  await openViewer(page, '/examples/images/inscription.png');
  await waitForModel(page, 30_000);
  await page.waitForFunction(() => window.Viewer.isImageActive?.() && document.getElementById('viewerImagePanel'));
  const image = await shownImage(page);
  expect(image.kind).toBe('image');
  expect(image.info).toMatchObject({ format: 'PNG', width: 1200, height: 750, dpi: 300, count: 1 });
  expect(image.info.tags.title).toBe('Worn inscription (synthetic)');
  // 300 dpi: the plane in metres (10.16 × 6.35 cm), measured as such.
  expect(image.plane).toEqual([0.1016, 0.0635, 1]);
  expect(await page.evaluate(() => window.Viewer.detectedModelUnitMeters)).toBe(1);
  const facts = await page.locator('#viewerImagePanel .viewer-volume-panel_summary dd').allTextContents();
  expect(facts).toEqual(expect.arrayContaining(['1200 × 750', '300 dpi', '10.2 cm × 6.4 cm']));
  // A picture is moved and zoomed, not turned; no ground under it.
  expect(await page.evaluate(() => [window.Viewer.controls.enableRotate, window.Viewer.controls.mouseButtons.LEFT, window.Viewer.core?.basicGrid?.visible ?? false]))
    .toEqual([false, 2, false]);
  // Its tools on the bar.
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['image', 'ruler', 'picking']);

  // The panel's controls into the shader.
  const panel = page.locator('#viewerImagePanel');
  await panel.locator('label', { hasText: 'Auto levels' }).locator('input').check();
  await panel.locator('label', { hasText: /^Relief/ }).locator('input').fill('80');
  await panel.locator('select').filter({ has: page.locator('option[value="luminance"]') }).selectOption('luminance');
  await expect(panel.locator('label', { hasText: 'Light from' })).toBeVisible();
  await panel.locator('label', { hasText: 'With the original' }).locator('input').check();
  expect((await shownImage(page)).uniforms).toEqual({ relief: 0.8, levels: true, split: 0.5, channel: 4 });

  // Saved as it is shown, at its pixels, without the comparison line.
  const download = page.waitForEvent('download');
  await panel.locator('.viewer-image-panel_save').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('inscription-enhanced.png');
  const png = fs.readFileSync(await file.path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 750]);
  expect((await shownImage(page)).uniforms.split).toBe(0.5);

  await panel.locator('.viewer-image-panel_reset').click();
  expect((await shownImage(page)).uniforms).toEqual({ relief: 0, levels: false, split: -1, channel: 0 });

  // Another model: the camera turns again.
  const glb = await page.locator('#example-model-select option[value$="examples/tempietto/Tempietto.glb"]').first().getAttribute('value');
  await page.selectOption('#example-model-select', glb);
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'mesh', null, { timeout: 30_000 });
  expect(await page.evaluate(() => [window.Viewer.isImageActive(), window.Viewer.controls.enableRotate, window.Viewer.controls.mouseButtons.LEFT])).toEqual([false, true, 0]);
  await expect(page.locator('#viewerImagePanel')).toHaveCount(0);
});

test('2D images: the comparison line dragged with the cursor; the hint pans the image, not turns it', async ({ page }) => {
  await openViewer(page, '/examples/images/inscription.png');
  await waitForModel(page, 30_000);
  await page.waitForFunction(() => window.Viewer.isImageActive?.() && document.getElementById('viewerImagePanel'));
  await page.evaluate(() => {
    window.Viewer.frameImage();
    window.Viewer.updateImageSettings((s) => { s.compare = true; s.split = 0.5; });
  });
  const box = await page.locator('#MainCanvas').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const target = () => page.evaluate(() => window.Viewer.controls.target.toArray());
  const before = await target();
  // On the line: the cursor shows it, a drag moves it (and its slider), not the image.
  await page.mouse.move(x + 3, y);
  expect(await page.evaluate(() => document.getElementById('MainCanvas').style.cursor)).toBe('ew-resize');
  await page.mouse.down();
  await page.mouse.move(x + box.width / 8, y, { steps: 6 });
  await page.mouse.up();
  const split = await page.evaluate(() => window.Viewer.imageState.root.userData.image.split);
  expect(split).toBeGreaterThan(0.55);
  expect(await page.locator('.viewer-image-panel_split input').inputValue()).toBe(String(Math.round(split * 100)));
  expect(await target()).toEqual(before);
  // Away from it: the drag moves the image, the line stays.
  await page.mouse.move(x - box.width / 4, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width / 8, y, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.Viewer.imageState.root.userData.image.split)).toBe(split);

  // The interaction hint: the camera moves sideways, still straight on.
  await page.evaluate(() => {
    window.__E2E__ = false;
    window.Viewer.handHint.hidden = false;
    window.Viewer.GESTURE.rotate = true;
  });
  await page.waitForTimeout(1500);
  const hint = await page.evaluate(() => {
    const camera = window.Viewer.camera;
    return { pan: window.Viewer.GESTURE.pan, direction: camera.getWorldDirection(camera.position.clone()).toArray() };
  });
  await page.evaluate(() => window.Viewer.stopHandMode());
  expect(hint.pan).toBe(true);
  expect(hint.direction[0]).toBeCloseTo(0, 4);
  expect(hint.direction[2]).toBeCloseTo(-1, 4);
});

test('2D images: a .zip of photos browsed as a set - filmstrip, keys, grid; the settings kept', async ({ page }) => {
  await openViewer(page, '/examples/images/images-set.zip');
  await waitForModel(page, 30_000);
  await page.waitForFunction(() => window.Viewer.isImageActive?.() && document.querySelector('.viewer-image-strip'));
  expect(await shownImage(page)).toMatchObject({ kind: 'image', index: 0, count: 3, info: { name: '01-inscription.png' } });
  const strip = page.locator('.viewer-image-strip');
  await expect(strip.locator('.viewer-image-strip_thumb')).toHaveCount(3);
  await expect(strip.locator('.viewer-image-strip_thumb img')).toHaveCount(3, { timeout: 20_000 });
  await expect(strip.locator('.viewer-image-strip_counter')).toHaveText('1 / 3');
  await page.evaluate(() => window.Viewer.updateImageSettings((s) => { s.dstretch = true; }));

  // The next one: its own size (no resolution: a unit per pixel), its EXIF.
  await strip.locator('.viewer-image-strip_step').last().click();
  await page.waitForFunction(() => window.Viewer.getImageIndex() === 1);
  const rock = await shownImage(page);
  expect(rock.info).toMatchObject({ name: '02-rock-art.jpg', format: 'JPEG', metersPerPixel: null, gps: { latitude: 50.05 } });
  expect(rock.info.tags).toMatchObject({ camera: 'ExPlora4D Synthetic camera', exposure: '1/125 s', aperture: 'f/5.6' });
  expect(rock.plane).toEqual([1200, 750, 1]);
  expect(rock.settings.dstretch).toBe(true);
  await expect(strip.locator('.viewer-image-strip_thumb.is-current')).toHaveAttribute('data-index', '1');
  // In view, the camera framed on it.
  expect(await page.evaluate(() => window.Viewer.camera.position.z)).toBeGreaterThan(500);

  // Keys: → and Home.
  await page.locator('#MainCanvas').hover();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.Viewer.getImageIndex() === 2);
  await page.keyboard.press('Home');
  await page.waitForFunction(() => window.Viewer.getImageIndex() === 0);

  // The grid: all of them; a click opens one and closes it.
  await strip.locator('.viewer-image-strip_grid').click();
  const grid = page.locator('.viewer-image-grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.viewer-image-grid_item')).toHaveCount(3);
  await grid.locator('.viewer-image-grid_item').nth(2).click();
  await expect(grid).toBeHidden();
  await page.waitForFunction(() => window.Viewer.getImageIndex() === 2);
  expect((await shownImage(page)).info.name).toBe('03-manuscript.jpg');
});

test('2D images: several dropped together are a set; a .zip of grey slices is a volume', async ({ page }) => {
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  const opened = await page.evaluate(async () => {
    const fetchFile = async (name) => {
      const url = document.querySelector(`#example-model-select option[value$="examples/images/${name}"]`)?.value
        || document.querySelector('#example-model-select option[value$="examples/images/inscription.png"]').value.replace('inscription.png', name);
      return new File([await (await fetch(url)).blob()], name);
    };
    return window.Viewer.openImageSet([await fetchFile('rock-art.jpg'), await fetchFile('inscription.png')]);
  });
  expect(opened).toBe(true);
  await page.waitForFunction(() => window.Viewer.isImageActive?.() && window.Viewer.getImageSet().length === 2);
  // In natural name order.
  expect(await page.evaluate(() => window.Viewer.getImageSet().map((item) => item.name))).toEqual(['inscription.png', 'rock-art.jpg']);

  // CT slices: grey, one size, a SkyScan log - a volume, not a set.
  await openViewer(page, '/examples/volumes/amphora-ct-png-slices.zip');
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'volume' && window.Viewer.isVolumeActive?.(), null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.Viewer.isImageActive?.() ?? false)).toBe(false);
});

test('manifests of a 2D image and of a sound: their settings applied, and saved again', async ({ page }) => {
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);

  // An Image body: the image, with the manifest's tools.
  await loadExampleManifest(page, 'images-aim3d-rock-art-dstretch.json');
  await page.waitForFunction(() => window.Viewer.isImageActive?.() && window.Viewer.getModelKind() === 'image');
  expect((await shownImage(page)).uniforms).toMatchObject({ split: 0.35 });
  expect(await page.evaluate(() => window.Viewer.getImageForExport())).toEqual({ dstretch: true, compare: true, split: 0.35 });
  let saved = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(saved.items[0].items[0].items[0].body).toMatchObject({ type: 'Image', format: 'image/jpeg' });
  expect(saved.AIM3DViewer.image).toEqual({ dstretch: true, compare: true, split: 0.35 });
  expect(validateAIM3DManifest(saved).errors).toEqual([]);

  // A Sound body: the spectrogram, its view and its playback.
  await loadExampleManifest(page, 'sounds-aim3d-bird-call.json');
  await page.waitForFunction(() => window.Viewer.isAudioActive?.() && window.Viewer.getModelKind() === 'audio');
  await expect.poll(() => page.evaluate(() => window.Viewer.audioState.player.settings.reverb)).toBe('church');
  expect(await page.evaluate(() => window.Viewer.getAudioForExport())).toEqual({
    range: 70,
    playback: { loop: true, region: { start: 2.9, end: 4.6 }, reverb: 'church', reverbMix: 0.45 },
  });
  await expect(page.locator('#viewerAudioPanel .viewer-audio-panel_region')).toBeVisible();
  saved = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(saved.items[0].items[0].items[0].body).toMatchObject({ type: 'Sound', format: 'audio/wav' });
  expect(saved.AIM3DViewer.audio.range).toBe(70);
});

test('a .zip the repository converted: loaded from its conversion, not downloaded', async ({ page }) => {
  // The repository keeps <name>_ZIP/<name>.glb next to the archive.
  const glb = fs.readFileSync('viewer/examples/box.glb');
  let archiveFetched = false;
  await page.route('**/examples/archived/house_ZIP/**', (route) => route.fulfill({ contentType: 'model/gltf-binary', body: glb }));
  await page.route('**/examples/archived/house.zip', (route) => {
    archiveFetched = true;
    return route.fulfill({ status: 404 });
  });
  await openViewer(page, '/examples/archived/house.zip');
  await waitForModel(page);
  expect(archiveFetched).toBe(false);
  expect(await shownVolume(page)).toBeNull();
});

test('example model select: a model opened from elsewhere leaves it on none of the examples', async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb');
  await waitForModel(page);
  const select = page.locator('#example-model-select');
  await expect(select).toHaveValue('./examples/tempietto/Tempietto.glb');

  // A model from the device (the library, a dropped file; the repository
  // goes the same way).
  await page.evaluate(async () => {
    window.viewer.fullModelLoaded = false;
    const blob = await (await fetch('./examples/box.glb')).blob();
    await window.Viewer.openLocalFile(new File([blob], 'box.glb'));
  });
  await waitForModel(page);
  await expect(select).toHaveValue('');
  await expect(select.locator('option[data-placeholder]')).toHaveText('Other model');
  await page.evaluate(() => window.Viewer.selectLanguage('pl'));
  await expect(select.locator('option[data-placeholder]')).toHaveText('Inny model');
  await expect(select).toHaveValue('');
});

test('example manifests: one folded group per model, its manifests named by what they change', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.evaluate(() => {
    window.Viewer.createExamplesPanel();
    window.Viewer.examplesPanel.hidden = false;
    window.Viewer.renderExamplesList();
  });
  const panel = page.locator('#examplesPanel');
  const groups = panel.locator('details.examples-panel-group');
  await expect(groups.locator('summary > span:first-child')).toHaveText(['Tempietto', 'Wolpa Synagogue', 'ExPlora4D showcase', 'Angel (Gaussian splats)']);
  await expect(panel.locator('details[data-group="aim3d:showcase"] .examples-panel-count')).toHaveText('15');
  // Folded at first; open, only the variants under the model's name.
  const wolpa = panel.locator('details[data-group="aim3d:wolpa"]');
  await expect(wolpa.locator('li').first()).toBeHidden();
  await wolpa.locator('summary').click();
  await expect(wolpa.locator('.models-panel-item-name').first()).toHaveText('Default view');
  await expect(wolpa.locator('.models-panel-item-name', { hasText: 'Golden hour, ACES' })).toBeVisible();
  // Without a group: the full name, not folded.
  await expect(panel.locator('.models-panel-item-name', { hasText: 'Box configuration' })).toBeVisible();

  // The open group stays open; names follow the language.
  await page.evaluate(() => window.Viewer.selectLanguage('pl'));
  await page.evaluate(() => window.Viewer.renderExamplesList());
  await expect(wolpa.locator('summary > span:first-child')).toHaveText('Synagoga w Wołpie');
  await expect(wolpa).toHaveAttribute('open', '');
});

test('panel windows: opening one closes the other, a click on the background closes it, a drag does not', async ({ page }) => {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({ json: { mode: 'required', registration: 'open', maxUploadBytes: 104857600 } })
  );
  await openViewer(page);
  await waitForModel(page);

  await page.evaluate(() => window.Viewer.openUploadPanel());
  await expect(page.locator('#uploadModelPanel')).toBeVisible();
  await page.evaluate(() => window.Viewer.openLoginPanel());
  await expect(page.locator('#loginPanel')).toBeVisible();
  await expect(page.locator('#uploadModelPanel')).toBeHidden();

  const canvas = page.locator('#MainCanvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No canvas');
  const x = box.x + box.width * 0.2;
  const y = box.y + box.height * 0.8;
  // Orbiting the model keeps the window open.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y - 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#loginPanel')).toBeVisible();

  await page.mouse.click(x, y);
  await expect(page.locator('#loginPanel')).toBeHidden();
});

test('reports unsupported format without loading a model', async ({ page }) => {
  await openViewer(page, '/examples/box.txt');
  await waitForViewerIssue(page);

  const state = await page.evaluate(() => ({
    modelLoaded: window.viewer.modelLoaded,
    errors: window.viewer.errors ?? [],
    toasts: window.viewer.toasts ?? [],
  }));

  expect(state.modelLoaded).toBe(false);
  expect(state.errors).toEqual([]);
  expect(state.toasts).toContain('File extension is not supported yet.');
});

test('reports a missing model file instead of hanging', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page, '/examples/does-not-exist.stl');
  await waitForViewerIssue(page);

  const state = await page.evaluate(() => ({
    modelLoaded: window.viewer.modelLoaded,
    errors: window.viewer.errors ?? [],
    toasts: window.viewer.toasts ?? [],
  }));

  expect(state.modelLoaded).toBe(false);
  expect(state.errors.length).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => window.viewer.errors.join(' ')))
    .toContain('404');
});

test('loads OBJ even when the referenced MTL file is missing', async ({ page }) => {
  await openViewer(page, '/examples/box-missing-mtl.obj');
  await waitForModel(page);

  const state = await page.evaluate(() => ({
    modelLoaded: window.viewer.modelLoaded,
    objectCount: window.viewer.scene.children.length,
    toasts: window.viewer.toasts ?? [],
  }));

  expect(state.modelLoaded).toBe(true);
  expect(state.objectCount).toBeGreaterThan(0);
  expect(state.toasts).toContain('Error occurred while loading attached MTL file.');
});

test('reports a corrupted model file instead of hanging', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page, '/examples/broken.glb');
  await waitForViewerIssue(page);

  const state = await page.evaluate(() => ({
    modelLoaded: window.viewer.modelLoaded,
    errors: window.viewer.errors ?? [],
    toasts: window.viewer.toasts ?? [],
  }));

  expect(state.modelLoaded).toBe(false);
  expect(state.errors.length).toBeGreaterThan(0);
});

test('tone mapping defaults to Neutral and post-processing is switched from the Rendering menu', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  const state = () => page.evaluate(() => ({
    toneMapping: window.viewer.renderer.toneMapping,
    exposure: window.viewer.renderer.toneMappingExposure,
    rendering: window.viewer.rendering,
    postProcessing: window.viewer.postProcessing,
  }));
  const constants = await page.evaluate(() => ({
    neutral: window.THREE.NeutralToneMapping,
    agx: window.THREE.AgXToneMapping,
  }));
  // The buttons' own handlers are what matters here.
  const clickTool = (key) => page.evaluate((tool) => {
    document.querySelector(`button[data-tool="${tool}"]`).click();
  }, key);
  // The model sits in the middle of the transparent canvas.
  const centerAlpha = () => page.evaluate(() => {
    const source = document.getElementById('MainCanvas');
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext('2d');
    context.drawImage(source, 0, 0);
    return context.getImageData(copy.width >> 1, copy.height >> 1, 1, 1).data[3];
  });

  expect(await state()).toMatchObject({
    toneMapping: constants.neutral,
    exposure: 1,
    rendering: { toneMapping: 'neutral', exposure: 1, postprocessing: { enabled: false, antialias: 'msaa' } },
    postProcessing: false,
  });

  // Opening the tone mapping menu draws the view into each mode's preview,
  // and the tone mapping of the view itself stays as it was.
  await page.evaluate(() => {
    document.querySelector('button[data-tool="renderingToneMapping"]').dispatchEvent(new Event('pointerenter'));
  });
  const previews = () => page.evaluate(() =>
    [...document.querySelectorAll('button[data-tool^="renderingToneMapping"] canvas')].map((canvas) => {
      if (!canvas.width) return 0;
      const { data } = canvas.getContext('2d').getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1);
      return data[3];
    }));
  await expect.poll(previews).toEqual(Array(7).fill(255));
  expect((await state()).toneMapping).toBe(constants.neutral);

  await clickTool('renderingPostprocessing');
  await expect.poll(async () => (await state()).postProcessing).toBe(true);
  await expect(page.locator('button[data-tool="renderingPostprocessing"] .viewer-editor-tool_submenu-toggle-state')).toHaveText('ON');
  await expect.poll(centerAlpha).toBeGreaterThan(0);

  await clickTool('renderingAntialiasSmaa');
  await clickTool('renderingToneMappingAgx');
  expect(await state()).toMatchObject({
    toneMapping: constants.agx,
    rendering: { toneMapping: 'agx', postprocessing: { enabled: true, antialias: 'smaa' } },
    postProcessing: true,
  });
  await expect.poll(centerAlpha).toBeGreaterThan(0);

  await clickTool('renderingPostprocessing');
  await expect.poll(async () => (await state()).postProcessing).toBe(false);

  // Ambient occlusion runs the chain by itself, post-processing left off;
  // its strength follows the slider, and it is saved with the rendering.
  await clickTool('renderingAo');
  await expect.poll(() => page.evaluate(() => [window.viewer.ambientOcclusion, window.viewer.postProcessing])).toEqual([true, true]);
  expect((await state()).rendering.postprocessing).toMatchObject({ enabled: false, ao: true, aoIntensity: 1 });
  await expect.poll(centerAlpha).toBeGreaterThan(0);
  // A slider in a folded menu: set as the input event a drag sends.
  const setSlider = (tool, value) => page.evaluate(([key, next]) => {
    const input = document.querySelector(`button[data-tool="${key}"] input[type="range"]`);
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, [tool, value]);
  await setSlider('renderingAoIntensity', '1.5');
  expect((await state()).rendering.postprocessing.aoIntensity).toBeCloseTo(1.5);
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.viewer.rendering.postprocessing);
  expect(exported).toMatchObject({ ao: true, aoIntensity: 1.5 });
  await clickTool('renderingAo');
  await expect.poll(() => page.evaluate(() => [window.viewer.ambientOcclusion, window.viewer.postProcessing])).toEqual([false, false]);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('raking light grazes the view with the other lights dimmed, sweeps, and goes with the model', async ({ page }) => {
  await openViewer(page, '/examples/compressed.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const clickTool = (key) => page.evaluate((tool) => document.querySelector(`button[data-tool="${tool}"]`).click(), key);

  const lights = () => page.evaluate(() => {
    const result = { raking: null, others: [], environment: window.Viewer.scene.environmentIntensity };
    window.Viewer.scene.traverse((object) => {
      if (!object.isLight) return;
      if (object.userData.isRakingLight) {
        // Its direction in camera space: x right, y up, z towards the viewer.
        const direction = object.position.clone().sub(object.target.position).normalize()
          .applyQuaternion(window.Viewer.camera.quaternion.clone().invert());
        result.raking = direction.toArray().map((value) => Math.round(value * 100) / 100);
      } else {
        result.others.push(object.intensity);
      }
    });
    return result;
  });

  const before = await lights();
  expect(before.raking).toBeNull();
  await clickTool('lightRakingToggle');
  await expect(page.locator('button[data-tool="lightRakingToggle"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.Viewer.setRakingLightAngles({ direction: 0, height: 10 }));
  const on = await lights();
  // From the right of the screen, 10 degrees above the surface facing the camera.
  expect(on.raking[0]).toBeCloseTo(Math.cos(Math.PI / 18), 1);
  expect(on.raking[1]).toBeCloseTo(0, 1);
  expect(on.raking[2]).toBeCloseTo(Math.sin(Math.PI / 18), 1);
  on.others.forEach((intensity, index) => expect(intensity).toBeCloseTo(before.others[index] * 0.12));
  expect(on.environment).toBeCloseTo(before.environment * 0.12);
  // The slider shows degrees.
  // A slider in a folded menu: set as the input event a drag sends.
  const setSlider = (tool, value) => page.evaluate(([key, next]) => {
    const input = document.querySelector(`button[data-tool="${key}"] input[type="range"]`);
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, [tool, value]);
  await setSlider('lightRakingHeight', '30');
  await expect(page.locator('button[data-tool="lightRakingHeight"] .viewer-editor-tool_submenu-value')).toHaveText('30°');
  expect((await lights()).raking[2]).toBeCloseTo(0.5, 1);

  // The sweep turns it round the view.
  await page.evaluate(() => window.Viewer.setRakingLightSweep(true));
  const direction = await page.evaluate(() => window.Viewer.rakingLight.direction);
  await expect.poll(() => page.evaluate(() => window.Viewer.rakingLight.direction)).not.toBe(direction);

  // Off: the other lights as they were. A new model switches it off too.
  await clickTool('lightRakingToggle');
  const off = await lights();
  expect(off).toEqual(before);
  await clickTool('lightRakingToggle');
  await page.evaluate(() => window.Viewer.resetLoadedModelState());
  expect(await page.evaluate(() => [window.Viewer.rakingLight.enabled, window.Viewer.rakingLight.sweep])).toEqual([false, false]);
  await expect(page.locator('button[data-tool="lightRakingToggle"]')).toHaveAttribute('aria-pressed', 'false');
});

test('sun and shadows: switched on at the day and hour it is now at the place, unless set', async ({ page }) => {
  // 10:30 UTC; the default place (10° E) is an hour ahead.
  await page.clock.setFixedTime(new Date('2026-03-20T10:30:00Z'));
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  const when = () => page.evaluate(() => {
    const { year, month, day, minutes } = window.Viewer.sunStudy;
    return { year, month, day, minutes };
  });

  await page.evaluate(() => document.querySelector<HTMLElement>('button[data-tool="lightSunToggle"]')?.click());
  await expect.poll(() => page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(true);
  expect(await when()).toEqual({ year: 2026, month: 3, day: 20, minutes: 11 * 60 + 30 });

  // A time set by hand stays through switching off and on.
  await page.evaluate(() => {
    window.Viewer.setSunOptions({ time: '17:00' });
    window.Viewer.setSunStudy(false);
    window.Viewer.setSunStudy(true);
  });
  expect((await when()).minutes).toBe(17 * 60);

  // A manifest's place without a time: now there (UTC+2), on its day.
  await page.evaluate(() => window.Viewer.apply3IFManifestSun(
    { latitude: 41.9, longitude: 12.47, utcOffset: 2 },
    { enabled: true, date: '06-21', followTimeline: false },
  ));
  expect(await when()).toEqual({ year: 2026, month: 6, day: 21, minutes: 12 * 60 + 30 });
});

test('toolbar menus: the loading progress goes round the dock on a desktop, along the bar on a phone', async ({ browser, page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const ring = (target) => target.evaluate(() => {
    const toolbar = document.getElementById('viewerEditorToolbar');
    toolbar.dataset.loading = 'active';
    toolbar.style.setProperty('--toolbar-load-progress', '40');
    const dock = toolbar.querySelector('.viewer-menus_dock');
    const style = (element) => getComputedStyle(element, '::before');
    return {
      mode: toolbar.dataset.mode,
      dock: style(dock).content !== 'none' && style(dock).display !== 'none',
      edge: style(toolbar).display !== 'none' ? parseFloat(style(toolbar).height) : 0,
    };
  });
  expect(await ring(page)).toEqual({ mode: 'desktop', dock: true, edge: 0 });

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await context.newPage();
  await openViewer(phone, '/examples/box.glb', 'ui=menus');
  await waitForModel(phone);
  expect(await ring(phone)).toEqual({ mode: 'bar', dock: false, edge: 3 });
  await context.close();
});

test('on a desktop, menus open on hover: the header buttons\' windows and the toolbar menus; a click keeps them open', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);

  // The header: the window drops down under the button and goes when the
  // mouse leaves both.
  const button = page.locator('#openLocalFileButton');
  const library = page.locator('#libraryPanel');
  await button.hover();
  await expect(library).toBeVisible();
  // Straight down into it (sideways the mouse would cross the next button).
  const from = await button.boundingBox();
  const box = await library.boundingBox();
  await page.mouse.move(from.x + from.width / 2, box.y + 10, { steps: 4 });
  await page.waitForTimeout(500);
  await expect(library).toBeVisible();
  await page.mouse.move(700, 500);
  await expect(library).toBeHidden();
  // Clicked, it stays.
  await button.click();
  await page.mouse.move(700, 500);
  await page.waitForTimeout(500);
  await expect(library).toBeVisible();
  await button.click();
  await expect(library).toBeHidden();

  // The toolbar: a tab's menu opens on hover, another tab switches to its
  // own, leaving closes it; clicked, it stays.
  const toolbar = page.locator('#viewerEditorToolbar.viewer-menus');
  const menu = toolbar.locator('.viewer-menus_panel');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').hover();
  await expect(menu).toBeVisible();
  await expect(toolbar.locator('.viewer-menus_group[data-category="look"]')).toHaveClass(/is-shown/);
  await toolbar.locator('.viewer-menus_tab[data-menu="model"]').hover();
  await expect(toolbar.locator('.viewer-menus_group[data-category="model"]')).toHaveClass(/is-shown/);
  // Away to the right: the shortcuts to the model's tools (ui/format-tools.js)
  // move the tabs, and the menus with them, towards the middle.
  await page.mouse.move(1050, 300);
  await expect(menu).toBeHidden();
  await toolbar.locator('.viewer-menus_tab[data-menu="model"]').click();
  await page.mouse.move(1050, 300);
  await page.waitForTimeout(500);
  await expect(menu).toBeVisible();

  // A submenu in the menu does not: it opens on a click.
  const row = menu.locator('.has-submenu:visible').first();
  await row.hover();
  await page.waitForTimeout(500);
  await expect(row).not.toHaveClass(/is-open/);
  await row.click({ position: { x: 20, y: 18 } });
  await expect(row).toHaveClass(/is-open/);
});

test('toolbar menus on a desktop: the tools sorted into named menus, submenus opening in place', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'ui=menus');
  await waitForModel(page);
  const toolbar = page.locator('#viewerEditorToolbar.viewer-menus');
  await expect(toolbar).toHaveAttribute('data-mode', 'desktop');
  const tabs = toolbar.locator('.viewer-menus_tab:visible .viewer-menus_tab-label');
  await expect(tabs).toHaveText(['Look', 'Analysis', 'Model', 'Story', 'File', 'Settings & help']);
  // Icons only; the name shows over the icon on keyboard focus (on hover
  // the tab's menu opens, carrying the name), moving nothing.
  const lookTab = toolbar.locator('.viewer-menus_tab[data-menu="look"]');
  const lookLabel = lookTab.locator('.viewer-menus_tab-label');
  const opacity = () => lookLabel.evaluate((el) => getComputedStyle(el).opacity);
  expect(await opacity()).toBe('0');
  const tabBefore = await toolbar.locator('.viewer-menus_tab[data-menu="analysis"]').boundingBox();
  await lookTab.focus();
  await expect.poll(opacity).toBe('1');
  expect((await lookLabel.boundingBox()).y + 5).toBeLessThan((await lookTab.boundingBox()).y);
  expect(await toolbar.locator('.viewer-menus_tab[data-menu="analysis"]').boundingBox()).toEqual(tabBefore);
  await page.mouse.move(700, 300);
  // At hand, outside the menus: navigating and the view (the projection is
  // under Look).
  const nav = toolbar.locator('.viewer-menus_nav > [data-tool]:visible:not(.viewer-menus_grip)');
  await expect(nav).toHaveCount(3);
  expect(await nav.evaluateAll((buttons) => buttons.map((button) => button.dataset.tool))).toEqual(['orbit', 'resetCamera', 'fullScreen']);
  // The parts and what only some models have (hidden here: no variants, IFC
  // or point cloud), moving, turning and scaling, then the surface (shading,
  // wireframe, materials): under Model, a line between the sections.
  await toolbar.locator('.viewer-menus_tab[data-menu="model"]').click();
  const tools = toolbar.locator('.viewer-menus_group[data-category="model"] > [data-tool]:visible');
  expect(await tools.evaluateAll((buttons) => buttons.map((button) => button.dataset.tool))).toEqual(['modelDetails', 'hierarchy', 'picking', 'move', 'rotate', 'scale', 'upAxis', 'shading', 'wireframe', 'materials']);
  await expect(toolbar.locator('.viewer-menus_group[data-category="model"] > .viewer-menus_separator')).toHaveCount(2);
  await toolbar.locator('.viewer-menus_group[data-category="model"] [data-tool="move"]').click();
  expect(await page.evaluate(() => window.Viewer.transformText['Transform 3D Object'])).toBe('translate');
  await toolbar.locator('.viewer-menus_nav [data-tool="orbit"]').click();
  expect(await page.evaluate(() => window.Viewer.transformText['Transform 3D Object'])).toBe('');
  await page.keyboard.press('Escape');

  // Settings: the language and theme of the classic main menu, then help;
  // its cog is gone.
  await expect(page.locator('.viewer-menus_cog')).toBeHidden();

  // The grip moves the bar, inside the viewer; moved up, a menu opens below.
  const dock = toolbar.locator('.viewer-menus_dock');
  const before = await dock.boundingBox();
  // The position of the viewer settings (or 0, 0): the offset the bar starts at.
  const start = await page.evaluate(() => window.Viewer.getCurrentEditorToolbarState().position);
  const grip = await toolbar.locator('.viewer-menus_grip').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 200, grip.y - 5000, { steps: 4 });
  await page.mouse.up();
  const moved = await dock.boundingBox();
  const canvas = await page.locator('#MainCanvas').boundingBox();
  expect(moved.x).toBeGreaterThan(before.x + 150);
  expect(moved.y).toBeGreaterThanOrEqual(canvas.y);
  expect(moved.y).toBeLessThan(canvas.y + 10);
  await toolbar.locator('.viewer-menus_tab[data-menu="file"]').click();
  await toolbar.locator('.viewer-menus_panel').evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  expect((await toolbar.locator('.viewer-menus_panel').boundingBox()).y).toBeGreaterThan(moved.y + moved.height);
  await page.keyboard.press('Escape');

  // The position goes into the manifest, and comes back from one.
  const exported = await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.viewer.editorToolbar.position);
  expect(Math.round(exported.x)).toBe(Math.round(start.x + moved.x - before.x));
  expect(Math.round(exported.y)).toBe(Math.round(start.y + moved.y - before.y));
  await page.evaluate(() => window.Viewer.applyEditorToolbarConfig(window.Viewer, { position: { x: 120, y: -40 } }));
  const applied = await dock.boundingBox();
  expect(Math.round(applied.x - before.x)).toBe(120 - start.x);
  expect(Math.round(applied.y - before.y)).toBe(-40 - start.y);
  // Back where it started.
  await page.evaluate((position) => window.Viewer.applyEditorToolbarConfig(window.Viewer, { position }), start);
  expect(await dock.boundingBox()).toEqual(before);
  await toolbar.locator('.viewer-menus_tab[data-menu="settings"]').click();
  const settings = toolbar.locator('.viewer-menus_group[data-category="settings"]');
  await expect(settings.locator('#viewerLanguageMode')).toBeVisible();
  await expect(settings.locator('#viewerThemeMode')).toBeVisible();
  await expect(settings.locator('[data-tool="help"]')).toBeVisible();
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await expect(toolbar.locator('.viewer-menus_group[data-category="look"] > [data-tool]').first()).toHaveAttribute('data-tool', 'lights');
  // The projection last, after a line.
  const lookTools = toolbar.locator('.viewer-menus_group[data-category="look"] > [data-tool]');
  await expect(lookTools.last()).toHaveAttribute('data-tool', 'projection');
  await lookTools.last().click();
  await expect.poll(() => page.evaluate(() => window.viewer.camera.isOrthographicCamera === true)).toBe(true);
  await lookTools.last().click();
  await page.keyboard.press('Escape');

  // Analysis: the sun and the raking light, out of Lights; section planes,
  // the ruler, the certainty view and live data.
  await toolbar.locator('.viewer-menus_tab[data-menu="analysis"]').click();
  const panel = toolbar.locator('.viewer-menus_panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-menus_group.is-shown > [data-tool]:visible')).toHaveCount(6);
  await expect(page.locator('[data-tool="lights"] [data-tool="lightSun"]')).toHaveCount(0);
  const sunToggle = panel.locator('button[data-tool="lightSunToggle"]');
  await expect(sunToggle).toBeHidden();
  await panel.locator('button[data-tool="sunStudy"]').click({ position: { x: 20, y: 18 } });
  await expect(panel.locator('button[data-tool="sunStudy"]')).toHaveAttribute('aria-expanded', 'true');
  await sunToggle.click();
  await expect.poll(() => page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(true);
  await expect(sunToggle).toHaveAttribute('aria-pressed', 'true');

  // One menu at a time; Escape closes it.
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await expect(panel.locator('.viewer-menus_group.is-shown')).toHaveAttribute('data-category', 'look');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  // The names follow the language, chosen in Settings (its list stays open
  // there, out of the action menu).
  await toolbar.locator('.viewer-menus_tab[data-menu="settings"]').click();
  await toolbar.locator('#viewerLanguageMode').click();
  await expect(toolbar.locator('#viewerLanguageModeDropdown')).toBeVisible();
  await toolbar.locator('.language-dropdown-item-polish').click();
  await expect(tabs.first()).toHaveText('Wygląd');
  await expect(toolbar.locator('button[data-tool="rakingLight"]')).toHaveAttribute('aria-label', 'Światło skośne');
  expect(await page.evaluate(() => window.viewer.errors ?? [])).toEqual([]);
});

test('toolbar menus on a phone: tabs along the bottom, a sheet, then a rail once turned', { tag: '@smoke' }, async ({ browser }) => {
  // With motion: turning animates the tabs (none with reduced motion, as the
  // other tests run).
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  // A phone browser with AR (WebXR).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: { isSessionSupported: async (mode) => mode === 'immersive-ar', requestSession: async () => { throw new Error('no device'); } },
    });
  });
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'ui=menus');
  await waitForModel(page);
  const toolbar = page.locator('#viewerEditorToolbar.viewer-menus');
  await expect(toolbar).toHaveAttribute('data-mode', 'bar');

  // AR at the end of the navigation bar, after a divider, the bar still
  // inside the screen.
  const nav = toolbar.locator('.viewer-menus_nav');
  const ar = nav.locator('.viewer-menus_device > [data-tool="immersive"]');
  await expect(ar).toBeVisible();
  await expect(nav.locator('.viewer-menus_nav-divider--device')).toBeVisible();
  const [arBox, navBox] = await Promise.all([ar.boundingBox(), nav.boundingBox()]);
  expect(arBox.y).toBeGreaterThanOrEqual(navBox.y);
  expect(arBox.y + arBox.height).toBeLessThanOrEqual(navBox.y + navBox.height);
  expect(navBox.x).toBeGreaterThanOrEqual(0);
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(390);
  await expect(toolbar.locator('.viewer-menus_tab:visible .viewer-menus_tab-label')).toHaveText(['Look', 'Analysis', 'Model', 'Story', 'More']);

  // "More": the rest, under headings.
  await toolbar.locator('.viewer-menus_tab[data-menu="more"]').tap();
  const panel = toolbar.locator('.viewer-menus_panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-menus_group.is-shown .viewer-menus_group-title')).toHaveText(['File', 'Settings & help']);
  // The sheet stands on the tab bar, over the whole width (once slid in).
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  const [sheet, bar] = await Promise.all([panel.boundingBox(), toolbar.locator('.viewer-menus_tabs').boundingBox()]);
  expect(Math.round(sheet.y + sheet.height)).toBe(Math.round(bar.y));
  expect(Math.round(sheet.width)).toBe(390);
  // Its grip makes it lower, kept so when it opens again; dragged right
  // down, it closes.
  const dragGrip = async (dy) => {
    const grip = await toolbar.locator('.viewer-menus_sheet-grip').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + dy, { steps: 5 });
    await page.mouse.up();
  };
  await dragGrip(120);
  const lower = await panel.boundingBox();
  expect(Math.round(lower.height)).toBe(Math.round(sheet.height - 120));
  expect(Math.round(lower.y + lower.height)).toBe(Math.round(bar.y));
  await toolbar.locator('.viewer-menus_tab[data-menu="more"]').tap();
  await expect(panel).toBeHidden();
  await toolbar.locator('.viewer-menus_tab[data-menu="more"]').tap();
  await expect.poll(async () => Math.round((await panel.boundingBox()).height)).toBe(Math.round(lower.height));
  await dragGrip(lower.height);
  await expect(panel).toBeHidden();

  // Turned on its side: the tabs go down the left edge, turning as they go.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(toolbar).toHaveAttribute('data-mode', 'rail');
  const turning = await page.evaluate(() => document.querySelector('.viewer-menus_tab-icon')?.getAnimations().length ?? 0);
  expect(turning).toBeGreaterThan(0);
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const first = await toolbar.locator('.viewer-menus_tab[data-menu="look"]').boundingBox();
  const last = await toolbar.locator('.viewer-menus_tab[data-menu="more"]').boundingBox();
  expect(last.y).toBeGreaterThan(first.y + 100);
  expect(Math.abs(first.x - last.x)).toBeLessThan(2);
  expect(first.x).toBeLessThan(20);

  // The model's details: not a card under the rail, an entry of Model.
  await expect(page.locator('#metadata-card')).toBeHidden();
  await toolbar.locator('.viewer-menus_tab[data-menu="model"]').tap();
  const details = panel.locator('[data-tool="modelDetails"]');
  await expect(details).toBeVisible();
  await details.tap();
  await expect(page.locator('#metadata-window')).toBeVisible();
  const [detailsWindow, rail] = await Promise.all([
    page.locator('#metadata-window').boundingBox(),
    toolbar.locator('.viewer-menus_tabs').boundingBox(),
  ]);
  expect(detailsWindow.x).toBeGreaterThanOrEqual(rail.x + rail.width);
  await context.close();
});

test('the classic toolbar stays a URL parameter away', async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'ui=classic');
  await waitForModel(page);
  await expect(page.locator('#viewerEditorToolbar')).not.toHaveClass(/viewer-menus/);
  await expect(page.locator('#viewerEditorToolbar .viewer-editor-expand')).toHaveCount(1);
});

test('lights and rendering menus: every entry labelled, also after switching the language', async ({ page }) => {
  await openViewer(page, '/examples/compressed.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  // A label missing from the relabelling falls back to the button's key.
  const unlabelled = () => page.evaluate(() => Object.entries(window.Viewer.lightsSubmenuButtons)
    .filter(([key, button]) => button.getAttribute('title') === key)
    .map(([key]) => key));
  const label = (key) => page.locator(`button[data-tool="${key}"]`).first();

  expect(await unlabelled()).toEqual([]);
  await expect(label('lightRaking')).toHaveAttribute('title', 'Raking light');
  await expect(label('lightSunPlay')).toHaveAttribute('title', 'Play the day');

  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#viewerLanguageMode')?.click();
    document.querySelector<HTMLElement>('.language-dropdown-item-polish')?.click();
  });
  await expect(label('lightRaking')).toHaveAttribute('title', 'Światło skośne');
  await expect(label('lightRakingSweep')).toHaveAttribute('title', 'Obracaj dookoła');
  await expect(label('lightSun')).toHaveAttribute('title', 'Słońce i cienie');
  await expect(label('renderingAo')).toHaveAttribute('title', 'Okluzja otoczenia (AO)');
  expect(await unlabelled()).toEqual([]);
});

test('custom shader: the default one compiles with section planes and vertex colours, a broken one is reported', async ({ page }) => {
  await openViewer(page, '/examples/compressed.glb');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });

  const nextFrames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // With a section plane, so the clipping chunks are compiled in.
  const custom = await page.evaluate(() => {
    window.viewer.toasts = [];
    window.Viewer.setShadingMode('custom', { silent: true });
    const types = new Set();
    window.Viewer.resolveObjectByTargetId('m0:root').traverse((child) => {
      if (!child.isMesh || child.userData.isCertaintyOverlay) return;
      child.material.clippingPlanes = [new window.THREE.Plane(new window.THREE.Vector3(0, -1, 0), 1000)];
      types.add(child.material.type);
    });
    return [...types];
  });
  expect(custom).toEqual(['ShaderMaterial']);
  await nextFrames();
  expect(await page.evaluate(() => [window.viewer.toasts, window.viewer.errors])).toEqual([[], []]);

  await page.evaluate(() => window.Viewer.setShadingMode('custom', {
    vertexShader: window.Viewer.customVertexShader,
    fragmentShader: 'void main() { gl_FragColor = vec4(undefinedValue, 1.0); }',
  }));
  await expect.poll(() => page.evaluate(() => window.viewer.toasts.join(' '))).toContain('does not compile');
  // Reported once per Apply, not every frame.
  await nextFrames();
  expect(await page.evaluate(() => window.viewer.toasts.filter((text) => text.includes('does not compile')).length)).toBe(1);
  await page.evaluate(() => window.Viewer.setShadingMode('original', { silent: true }));
});

test('comparing the look: two shading modes and lightings, the scene as it was between frames and after', async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'ui=menus');
  await waitForModel(page);
  // Materials, lights and the environment of the scene, as a fingerprint.
  const scene = () => page.evaluate(() => {
    let root = window.Viewer.getShadingRootObjects()[0];
    while (root.parent) root = root.parent;
    const parts = [];
    root.traverse((object) => {
      if (object.isLight) parts.push(`${object.name}:${object.intensity.toFixed(3)}`);
      if (object.isMesh) parts.push([object.material].flat().map((material) => material.uuid).join('+'));
    });
    return [parts.join(','), root.environment?.uuid ?? null, root.environmentIntensity].join('|');
  });
  // The default environment map loads after the model.
  await page.waitForFunction(() => {
    let root = window.Viewer.getShadingRootObjects()[0];
    while (root.parent) root = root.parent;
    return window.Viewer.environmentMapEnabled === false || root.environment != null;
  });
  const before = await scene();

  // Its own tool in the Look menu.
  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await toolbar.locator('[data-tool="compareLook"]').click();
  const overlay = page.locator('#viewerCompare');
  await expect(overlay).toHaveClass(/is-look/);
  await expect(overlay.locator('.viewer-compare_label')).toHaveText(['Original materials', 'Clay (no texture)']);

  await overlay.locator('.viewer-compare_select.is-right:not(.viewer-compare_lighting)').selectOption({ label: 'Normals' });
  await overlay.locator('.viewer-compare_lighting.is-right').selectOption('raking');
  await overlay.locator('.viewer-compare_lighting.is-left').selectOption('noEnvironment');
  await expect(overlay.locator('.viewer-compare_label')).toHaveText(['Original materials · No environment map', 'Normals · Raking light']);
  expect(await page.evaluate(() => window.Viewer.getCompareForExport())).toEqual({
    kind: 'look',
    mode: 'swipe',
    left: { shading: 'original', lighting: 'noEnvironment' },
    right: { shading: 'normals', lighting: 'raking' },
    position: 0.5,
  });
  // Between frames the scene is as the menus left it (but for the
  // comparison's raking light, dark).
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect((await scene()).replace(',compare-raking-light:0.000', '')).toBe(before);

  // Closed: as before, the comparison's light and materials gone.
  await overlay.locator('.viewer-compare_close').click();
  await expect(overlay).toHaveCount(0);
  expect(await scene()).toBe(before);
});

test('manifest inspection: every example is fine and every attribute known', { tag: '@smoke' }, () => {
  const dir = 'viewer/manifesto/examples';
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'index.json')) {
    const inspection = inspectAIM3DManifest(JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8')));
    const problems = inspection.attributes.filter((entry) => ['error', 'warning'].includes(entry.level) || !entry.known);
    expect(problems.map((entry) => `${entry.path}: ${entry.issues.map((issue) => issue.message).join('; ')}`), file).toEqual([]);
    expect(inspection.status, file).toBe('ok');
    // Every leaf of the JSON is an attribute of the report.
    expect(inspection.summary.attributes, file).toBeGreaterThan(10);
  }

  // What the list icons show.
  const sun = inspectAIM3DManifest(JSON.parse(fs.readFileSync(`${dir}/tempietto-aim3d-sun.json`, 'utf8')));
  expect(manifestFeatureIcons(sun).map((feature) => feature.id)).toEqual([
    'model', 'metadata', 'rights', 'camera', 'lights', 'timeline', 'location', 'sun', 'transform', 'rendering', 'settings',
  ]);
  expect(manifestFeatureIcons(sun).find((feature) => feature.id === 'timeline')).toMatchObject({ count: 3, status: 'ok' });
});

test('manifest inspection: checks each attribute value', () => {
  const scene = 'https://example.org/scene';
  const inspection = inspectAIM3DManifest({
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: 'https://example.org/manifest.json',
    type: 'Manifest',
    label: { english: ['Vessel'], pl: [''] },
    rights: 'Public domain',
    items: [{
      id: scene,
      type: 'Scene',
      backgroundColor: 'not a colour',
      items: [{
        id: 'https://example.org/page',
        type: 'AnnotationPage',
        items: [{
          id: 'https://example.org/painting',
          type: 'Annotation',
          motivation: ['painting'],
          body: { id: 'http://localhost:8080/vessel.glb', type: 'Model', format: 'glb' },
          target: { id: 'https://example.org/elsewhere', type: 'Scene' },
        }],
      }],
      annotations: [{
        id: 'https://example.org/comments',
        type: 'AnnotationPage',
        items: [{
          id: 'https://example.org/comment',
          type: 'Annotation',
          motivation: 'commenting',
          body: { type: 'TextualBody', value: 'Handle' },
          target: scene,
          AIM3DViewer: { faceIndex: -3, point: [1, 2], certainty: { value: 42 } },
        }],
      }],
    }],
    AIM3DViewer: {
      generatedAt: 'yesterday',
      camera: { up: [0, 0, 0], fov: 200, perspectiveMode: 'fisheye' },
      viewer: { autorotate: 'yes', backgroundColor: '#12345', colour: 'red' },
      lights: [{ type: 'LaserLight', intensity: -1 }],
      variants: { items: [{ id: 'a', label: 'A' }] },
      compare: { left: { variant: 'b' }, right: { variant: 'a' } },
      location: { latitude: 123 },
      sun: { time: '25:00' },
      modelTransform: { scale: [1, 0, 1] },
    },
  });
  const levels = Object.fromEntries(inspection.attributes.filter((entry) => entry.level !== 'ok').map((entry) => [entry.path, entry.level]));
  expect(levels).toEqual({
    '$.summary': 'info',
    '$.label.english': 'warning',
    '$.label.pl[0]': 'warning',
    '$.rights': 'warning',
    '$.items[0].backgroundColor': 'warning',
    '$.items[0].items[0].items[0].body.id': 'warning',
    '$.items[0].items[0].items[0].body.format': 'warning',
    '$.items[0].items[0].items[0].target': 'warning',
    '$.items[0].annotations[0].items[0].AIM3DViewer.faceIndex': 'error',
    '$.items[0].annotations[0].items[0].AIM3DViewer.point': 'error',
    '$.items[0].annotations[0].items[0].AIM3DViewer.certainty.value': 'error',
    '$.AIM3DViewer.generatedAt': 'warning',
    '$.AIM3DViewer.camera.up': 'warning',
    '$.AIM3DViewer.camera.fov': 'warning',
    '$.AIM3DViewer.camera.perspectiveMode': 'error',
    '$.AIM3DViewer.viewer.autorotate': 'error',
    '$.AIM3DViewer.viewer.backgroundColor': 'warning',
    '$.AIM3DViewer.viewer.colour': 'info',
    '$.AIM3DViewer.lights[0].type': 'warning',
    '$.AIM3DViewer.lights[0].intensity': 'warning',
    '$.AIM3DViewer.compare.left.variant': 'warning',
    '$.AIM3DViewer.location.latitude': 'error',
    '$.AIM3DViewer.location.longitude': 'error',
    '$.AIM3DViewer.sun.time': 'error',
    '$.AIM3DViewer.modelTransform.scale': 'warning',
  });
  expect(inspection.status).toBe('error');
  expect(inspection.summary).toMatchObject({ errors: 8, unknown: 1 });

  // Each problem counts against its feature (icon).
  const status = Object.fromEntries(manifestFeatureIcons(inspection).map((feature) => [feature.id, feature.status]));
  expect(status).toMatchObject({
    model: 'warning', annotations: 'error', certainty: 'error', camera: 'error', lights: 'warning',
    variants: 'ok', compare: 'warning', location: 'error', sun: 'error', transform: 'warning', rights: 'warning',
  });

  // Not an object at all.
  expect(inspectAIM3DManifest([]).status).toBe('error');
});

test('validation report: X/Y passed, rows with their issues, the worker check of the model', { tag: '@smoke' }, async ({ page }) => {
  test.setTimeout(120_000);
  const jobId = 'a1b2c3';
  const modelReport = {
    schema: 'explora4d-validation/1',
    file: { name: 'box.glb', format: 'glb', bytes: 1948 },
    status: 'error',
    summary: { errors: 1, warnings: 0 },
    validator: {
      available: true, version: '2.0.0-dev.3.10', errors: 1, warnings: 0, infos: 0, hints: 0,
      issues: [{ code: 'ACCESSOR_MAX_MISMATCH', level: 'error', count: 1, message: 'Declared maximum does not match the actual maximum.', pointers: ['/accessors/0/max'] }],
    },
    stats: { totalTriangleCount: 12, totalVertexCount: 24, materialCount: 1 },
    bounds: { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1], unit: 'm' },
    checks: [],
  };
  await page.route(`**/files/${jobId}/box.glb`, (route) => route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync('viewer/examples/box.glb') }));
  await page.route(`**/api/model/validation/${jobId}`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(modelReport) }));
  await page.route('**/api/jobs', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ jobs: [{ id: jobId, name: 'box.glb', status: 'ready', modelUrl: `/files/${jobId}/box.glb`, imageUrls: [], createdAt: 1792000000, validation: { status: 'error', errors: 1, warnings: 0, validator: true } }] }),
  }));
  await openViewer(page, `/files/${jobId}/box.glb`);
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });

  // The toolbar's tool opens the report on the manifest the viewer would export.
  await page.evaluate(() => window.Viewer.toggleValidationReport());
  const panel = page.locator('#validationReportPanel');
  await expect(panel.locator('.validation-report-summary')).toBeVisible();
  const ring = await panel.locator('.validation-report-ring strong').innerText();
  const [passed, total] = ring.split('/').map(Number);
  const rows = panel.locator('.validation-report-row');
  expect(total).toBe(await rows.count());
  expect(passed).toBe(await panel.locator('.validation-report-row[data-status="ok"]').count());
  await expect(panel.locator('.validation-report-summary')).toHaveAttribute('data-status', 'error');
  expect(await page.evaluate(() => window.Viewer.editorToolbarButtons.validationReport.classList.contains('is-active'))).toBe(true);

  // The model file row: the worker's glTF-Validator issues.
  const modelRow = panel.locator('.validation-report-row[data-check="model-check"]');
  await expect(modelRow).toHaveAttribute('data-status', 'error');
  await modelRow.locator('summary').click();
  await expect(modelRow.locator('.validation-report-issues')).toContainText('ACCESSOR_MAX_MISMATCH');
  await expect(modelRow.locator('.validation-report-issues')).toContainText('/accessors/0/max');
  // Always checked: the IIIF structure, metadata and rights.
  for (const id of ['manifest', 'metadata', 'rights']) await expect(panel.locator(`.validation-report-row[data-check="${id}"]`)).toHaveCount(1);
  await expect(panel.locator('.validation-report-details')).toContainText('box.glb');

  await page.evaluate(() => window.Viewer.closeValidationReport());
  await expect(panel).toBeHidden();

  // The worker's list: the model check as an icon in the row's caption.
  await page.evaluate(() => window.Viewer.openModelsPanel());
  await expect(page.locator('#modelsPanel .model-check-icon')).toHaveAttribute('data-status', 'error');
});

test('AI: the validation report explained in plain language when the worker offers it', async ({ page }) => {
  test.setTimeout(120_000);
  const jobId = 'ai1b2c3';
  const modelReport = {
    file: { name: 'box.glb', format: 'glb', bytes: 1948 },
    status: 'warning',
    summary: { errors: 0, warnings: 1 },
    validator: { available: true, version: '2.0.0', issues: [{ code: 'UNUSED_OBJECT', level: 'warning', count: 2, message: 'This object may be unused.', pointers: ['/textures/0'] }] },
    stats: { totalTriangleCount: 12 },
    bounds: { size: [1, 1, 1], unit: 'm' },
    checks: [],
  };
  const requests = [];
  await page.route(`**/files/${jobId}/box.glb`, (route) => route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync('viewer/examples/box.glb') }));
  await page.route(`**/api/model/validation/${jobId}`, (route) => route.fulfill({ json: modelReport }));
  await page.route('**/api/ai/config', (route) => route.fulfill({ json: { enabled: true, features: ['validation', 'ifc-query', 'variants'], model: 'claude-opus-5-5' } }));
  await page.route(`**/api/ai/validation/${jobId}`, (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      headline: 'The model can be published.',
      summary: 'One unused texture; nothing a viewer would notice.',
      findings: [{ level: 'warning', title: 'Unused texture', explanation: 'It makes the file larger.', fix: 'Remove it in Blender before exporting.', codes: ['UNUSED_OBJECT'] }],
      model: 'claude-opus-5-5',
    } });
  });
  await openViewer(page, `/files/${jobId}/box.glb`);
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });

  await page.evaluate(() => window.Viewer.toggleValidationReport());
  const panel = page.locator('#validationReportPanel');
  const button = panel.locator('.validation-report-ai .ai-button');
  await expect(button).toBeVisible();
  // Nothing is sent before the button.
  expect(requests).toHaveLength(0);
  await button.click();
  const answer = panel.locator('.validation-report-ai');
  await expect(answer.locator('.ai-headline')).toHaveText('The model can be published.');
  await expect(answer.locator('.ai-findings li[data-level="warning"]')).toContainText('Remove it in Blender');
  await expect(answer.locator('.ai-disclaimer')).toContainText('claude-opus-5-5');
  expect(requests[0].lang).toBe('en');
});

test('AI: nothing is offered when the worker has no AI endpoint', async ({ page }) => {
  test.setTimeout(120_000);
  const jobId = 'noai123';
  await page.route(`**/files/${jobId}/box.glb`, (route) => route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync('viewer/examples/box.glb') }));
  await page.route(`**/api/model/validation/${jobId}`, (route) => route.fulfill({ json: { status: 'ok', validator: { issues: [] }, checks: [] } }));
  await page.route('**/api/ai/config', (route) => route.fulfill({ status: 404, json: { error: 'not found' } }));
  await openViewer(page, `/files/${jobId}/box.glb`);
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
  await page.evaluate(() => window.Viewer.toggleValidationReport());
  await expect(page.locator('#validationReportPanel .validation-report-summary')).toBeVisible();
  await expect(page.locator('#validationReportPanel .ai-button')).toHaveCount(0);
});

// A converted IFC model's properties (scripts/ifc_metadata.py): the box's
// node "Cube" is a wall; the other elements have no geometry in box.glb.
const ifcTestData = {
  schema: 'IFC4',
  project: { guid: 'P', name: 'Test house' },
  tree: { guid: 'P', type: 'IfcProject', name: 'Test house', children: [
    { guid: 'B', type: 'IfcBuilding', name: 'House', children: [
      { guid: 'S1', type: 'IfcBuildingStorey', name: 'Level 1', children: [{ guid: 'Cube', type: 'IfcWall' }, { guid: 'W2', type: 'IfcWallStandardCase' }, { guid: 'D1', type: 'IfcDoor' }] },
      { guid: 'S2', type: 'IfcBuildingStorey', name: 'Level 2', children: [{ guid: 'W3', type: 'IfcWall' }, { guid: 'SL', type: 'IfcSlab' }] },
    ] },
  ] },
  elements: {
    P: { type: 'IfcProject', name: 'Test house' },
    B: { type: 'IfcBuilding', name: 'House' },
    S1: { type: 'IfcBuildingStorey', name: 'Level 1' },
    S2: { type: 'IfcBuildingStorey', name: 'Level 2' },
    Cube: { type: 'IfcWall', name: 'Wall A', material: 'Brick', psets: { Pset_WallCommon: { id: 1, LoadBearing: true, IsExternal: true }, Qto_WallBaseQuantities: { NetSideArea: 12.5 } } },
    W2: { type: 'IfcWallStandardCase', name: 'Wall B', material: 'Brick', psets: { Pset_WallCommon: { LoadBearing: '.F.' }, Qto_WallBaseQuantities: { NetSideArea: 7.5 } } },
    W3: { type: 'IfcWall', name: 'Wall C', material: 'Concrete', psets: { Pset_WallCommon: { LoadBearing: true } } },
    D1: { type: 'IfcDoor', name: 'Door', psets: { Pset_DoorCommon: { FireRating: 'EI30' } } },
    SL: { type: 'IfcSlab', name: 'Slab', psets: { Qto_SlabBaseQuantities: { NetArea: 48 } } },
    WT: { type: 'IfcWallType', name: 'Brick wall type' },
  },
};

test('AI: IFC questions - the summary sent and the filter run on the data', () => {
  const summary = buildIfcSummary(ifcTestData);
  expect(summary.classes).toEqual({ IfcWall: 2, IfcWallStandardCase: 1, IfcDoor: 1, IfcSlab: 1, IfcBuilding: 1, IfcBuildingStorey: 2 });
  expect(summary.storeys).toEqual(['Level 1', 'Level 2']);
  expect(summary.psets.Pset_WallCommon.properties.LoadBearing).toMatchObject({ type: 'boolean', samples: [true, false] });
  expect(summary.psets.Pset_WallCommon.properties.id).toBeUndefined();
  expect(summary.psets.Qto_WallBaseQuantities.properties.NetSideArea).toMatchObject({ type: 'number', min: 7.5, max: 12.5 });
  // Only names, types and samples - no GlobalIds.
  expect(JSON.stringify(summary)).not.toContain('Cube');

  const walls = { match: 'all', conditions: [{ field: 'type', op: 'eq', value: 'IfcWall', pset: null, property: null }], aggregate: { kind: 'sum', pset: 'Qto_WallBaseQuantities', property: 'NetSideArea', unit: 'm2' } };
  const all = runIfcFilter(ifcTestData, walls);
  // IfcWallStandardCase counts as a wall.
  expect(all.guids.sort()).toEqual(['Cube', 'W2', 'W3']);
  expect(all.aggregate).toMatchObject({ kind: 'sum', value: 20, counted: 2, missing: 1, unit: 'm2' });

  const loadBearing = runIfcFilter(ifcTestData, { match: 'all', aggregate: { kind: 'count' }, conditions: [
    { field: 'type', op: 'eq', value: 'IfcWall', pset: null, property: null },
    { field: 'property', pset: 'Pset_WallCommon', property: 'LoadBearing', op: 'true', value: null },
    { field: 'storey', op: 'eq', value: 'level 1', pset: null, property: null },
  ] });
  expect(loadBearing.guids).toEqual(['Cube']);
  expect(loadBearing.aggregate).toEqual({ kind: 'count', value: 1 });

  const anyPset = runIfcFilter(ifcTestData, { match: 'any', conditions: [
    { field: 'property', pset: null, property: 'FireRating', op: 'contains', value: 'ei' },
    { field: 'property', pset: null, property: 'NetArea', op: 'gte', value: '40' },
  ] });
  expect(anyPset.guids.sort()).toEqual(['D1', 'SL']);
  // Storeys only when asked for.
  expect(runIfcFilter(ifcTestData, { match: 'all', conditions: [{ field: 'type', op: 'eq', value: 'IfcBuildingStorey' }] }).guids).toEqual(['S1', 'S2']);
  expect(runIfcFilter(ifcTestData, { match: 'all', conditions: [{ field: 'name', op: 'contains', value: 'e' }] }).guids).not.toContain('S1');
});

test('AI: IFC question panel - asks the worker, runs the filter, highlights and hides', async ({ page }) => {
  test.setTimeout(120_000);
  const jobId = 'ifcjob1';
  const asked = [];
  await page.route(`**/files/${jobId}/gltf/box.glb`, (route) => route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync('viewer/examples/box.glb') }));
  await page.route(`**/files/${jobId}/metadata/box_ifc.json`, (route) => route.fulfill({ json: ifcTestData }));
  await page.route('**/api/ai/config', (route) => route.fulfill({ json: { enabled: true, features: ['ifc-query'], model: 'claude-opus-5-5' } }));
  await page.route('**/api/ai/ifc-query', (route) => {
    asked.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      understood: true,
      interpretation: 'Load-bearing walls',
      match: 'all',
      conditions: [
        { field: 'type', pset: null, property: null, op: 'eq', value: 'IfcWall' },
        { field: 'property', pset: 'Pset_WallCommon', property: 'LoadBearing', op: 'true', value: null },
      ],
      aggregate: { kind: 'sum', pset: 'Qto_WallBaseQuantities', property: 'NetSideArea', unit: 'm²' },
      action: 'highlight',
      note: 'Load-bearing taken from Pset_WallCommon.LoadBearing.',
      model: 'claude-opus-5-5',
    } });
  });
  await openViewer(page, `/files/${jobId}/gltf/box.glb`);
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });

  // The tool shows up once the properties are in and the worker offers it.
  await page.waitForFunction(() => window.Viewer.isIfcQueryAvailable?.() === true, null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.Viewer.editorToolbarButtons.ifcQuery.hidden)).toBe(false);
  await page.evaluate(() => window.Viewer.toggleIfcQuery());
  const panel = page.locator('#ifcQueryPanel');
  await expect(panel).toBeVisible();
  await panel.locator('input').fill('nośne ściany');
  await panel.locator('button[type="submit"]').click();
  await expect(panel.locator('.ifc-query-count')).toHaveText('2 element(s) found');
  await expect(panel.locator('.ifc-query-aggregate')).toContainText('12.5 m²');
  await expect(panel.locator('.ifc-query-filter code')).toHaveCount(2);
  await expect(panel.locator('.ifc-query-note')).toContainText('Pset_WallCommon');
  expect(asked[0].question).toBe('nośne ściany');
  expect(asked[0].schema.classes.IfcWall).toBe(2);

  // Highlighted: an overlay on the wall's mesh.
  expect(await page.evaluate(() => window.Viewer.ifcQueryOverlays.length)).toBe(1);
  await panel.locator('.ifc-query-actions [data-action="hide"]').click();
  expect(await page.evaluate(() => window.Viewer.ifcQueryHidden.length)).toBe(1);
  expect(await page.evaluate(() => window.Viewer.ifcQueryOverlays.length)).toBe(0);
  await panel.locator('.ifc-query-actions [data-action="reset"]').click();
  expect(await page.evaluate(() => window.Viewer.ifcQueryHidden.length)).toBe(0);
  await panel.locator('.ifc-query-list summary').click();
  await expect(panel.locator('.ifc-query-list li')).toHaveCount(2);
});

async function routeIfcBox(page, jobId, asked = []) {
  await page.route(`**/files/${jobId}/gltf/box.glb`, (route) => route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync('viewer/examples/box.glb') }));
  await page.route(`**/files/${jobId}/metadata/box_ifc.json`, (route) => route.fulfill({ json: ifcTestData }));
  await page.route('**/api/ai/config', (route) => route.fulfill({ json: { enabled: true, features: ['ifc-query'], model: 'claude-opus-5-5' } }));
  await page.route('**/api/ai/ifc-query', (route) => {
    asked.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      understood: true,
      interpretation: 'Walls like Wall A',
      match: 'all',
      conditions: [{ field: 'type', pset: null, property: null, op: 'eq', value: 'IfcWall' }],
      aggregate: { kind: 'count', pset: null, property: null, unit: null },
      action: 'highlight',
      note: null,
      model: 'claude-opus-5-5',
    } });
  });
}

test('context menu: a right click on an IFC element asks about it; Escape steps back', async ({ page }) => {
  test.setTimeout(120_000);
  const asked = [];
  await routeIfcBox(page, 'ifcjob2', asked);
  await openViewer(page, '/files/ifcjob2/gltf/box.glb');
  await waitForCameraIdle(page);
  await page.waitForFunction(() => window.Viewer.isIfcQueryAvailable?.() === true, null, { timeout: 20_000 });
  const box = await page.locator('#MainCanvas').boundingBox();
  const center = [box.x + box.width / 2, box.y + box.height / 2];
  const menu = page.locator('.viewer-context-menu');

  // A right click picks the element (its properties) and offers the actions.
  await page.mouse.click(...center, { button: 'right' });
  await expect(menu).toBeVisible();
  await expect(page.locator('#ifc-properties-panel')).toContainText('Wall A');
  await expect(menu.locator('.viewer-context-menu_title')).toHaveText('Wall A · IfcWall');
  for (const action of ['ask', 'sameType', 'isolate', 'hide', 'copyGuid', 'focus', 'copyPoint', 'reset']) {
    await expect(menu.locator(`[data-action="${action}"]`)).toBeVisible();
  }

  await menu.locator('[data-action="ask"]').click();
  await expect(menu).toBeHidden();
  const panel = page.locator('#ifcQueryPanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.ifc-query-selection')).toContainText('IfcWall · Wall A');
  await panel.locator('.ifc-query-example').first().click();
  // IfcWall: the IfcWallStandardCase too.
  await expect(panel.locator('.ifc-query-count')).toHaveText('3 element(s) found');
  expect(asked[0].question).toBe('Elements like this');
  expect(asked[0].selection).toMatchObject({ guid: 'Cube', type: 'IfcWall', name: 'Wall A', storey: 'Level 1', material: 'Brick' });
  expect(asked[0].selection.psets.Pset_WallCommon).toEqual({ id: 1, LoadBearing: true, IsExternal: true });

  // Back: the question window first, then the element's properties.
  await page.locator('#MainCanvas').focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  // The mouse's back button over the viewer: the answer's highlight goes,
  // then the element's properties.
  const mouseBack = () => page.evaluate(() => document.getElementById('MainCanvas').dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true })));
  await mouseBack();
  expect(await page.evaluate(() => window.Viewer.isIfcQueryViewActive())).toBe(false);
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  await mouseBack();
  await expect(page.locator('#ifc-properties-panel')).toHaveCount(0);

  // Without the AI: the elements of the same type highlighted, undone by
  // a step back.
  await page.mouse.click(...center, { button: 'right' });
  await menu.locator('[data-action="sameType"]').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.ifcQueryOverlays.length)).toBe(1);
  await page.locator('#MainCanvas').focus();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.Viewer.isIfcQueryViewActive())).toBe(false);
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ifc-properties-panel')).toHaveCount(0);

  await page.mouse.click(...center, { button: 'right' });
  await menu.locator('[data-action="hide"]').click();
  await page.mouse.click(...center, { button: 'right' });
  await expect(menu.locator('[data-action="showHidden"]')).toHaveText('Show hidden elements (1)');
  await menu.locator('[data-action="showHidden"]').click();
  await expect(menu).toBeHidden();

  // Measuring from the menu, then its own actions there.
  await page.mouse.click(...center, { button: 'right' });
  await menu.locator('[data-action="measure"]').click();
  expect(await page.evaluate(() => [window.Viewer.RULER_MODE, window.Viewer.measurementDraft?.points.length])).toEqual([true, 1]);
  await page.mouse.click(center[0] + 10, center[1] + 10);
  expect(await page.evaluate(() => window.Viewer.measurementDraft?.points.length)).toBe(2);
  await page.mouse.click(...center, { button: 'right' });
  await expect(menu.locator('button')).toHaveText(['Finish measurement', 'Remove last point', 'Discard measurement', 'Stop measuring', 'Reset view']);
  await menu.locator('[data-action="undoPoint"]').click();
  expect(await page.evaluate(() => window.Viewer.measurementDraft?.points.length)).toBe(1);
  await page.locator('#MainCanvas').focus();
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => window.Viewer.measurementDraft)).toBeNull();
  await page.evaluate(() => window.Viewer.toggleDistanceMeasurement());

  // A floor plan cut at the point, and off again.
  await page.mouse.click(...center, { button: 'right' });
  await menu.locator('[data-action="cut"]').click();
  expect(await page.evaluate(() => [window.Viewer.isClippingAxisEnabled('y'), window.Viewer.hasActiveClipping()])).toEqual([true, true]);
  await page.mouse.click(...center, { button: 'right' });
  await menu.locator('[data-action="removeCuts"]').click();
  expect(await page.evaluate(() => window.Viewer.hasActiveClipping())).toBe(false);

  // A right-drag pans: no menu.
  await page.mouse.move(...center);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(center[0] + 40, center[1] + 20, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(menu).toBeHidden();
});

test('context menu on a phone: press and hold, the back gesture closes one layer at a time', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await routeIfcBox(page, 'ifcjob3');
  await openViewer(page, '/files/ifcjob3/gltf/box.glb');
  await waitForCameraIdle(page);
  await page.waitForFunction(() => window.Viewer.isIfcQueryAvailable?.() === true, null, { timeout: 20_000 });
  const box = await page.locator('#MainCanvas').boundingBox();
  const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const menu = page.locator('.viewer-context-menu');

  // A short tap is still a tap: the properties, no menu.
  await touch('touchStart', [point]);
  await touch('touchEnd', []);
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  await expect(menu).toBeHidden();

  await touch('touchStart', [point]);
  await expect(menu).toBeVisible();
  await touch('touchEnd', []);
  // The release is not a tap on the model too.
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action="ask"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.explora4dBack === true)).toBe(true);

  await page.evaluate(() => history.back());
  await expect(menu).toBeHidden();
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.explora4dBack === true)).toBe(true);
  await page.evaluate(() => history.back());
  await expect(page.locator('#ifc-properties-panel')).toHaveCount(0);

  // A quick tap of two fingers: a step back.
  await touch('touchStart', [point]);
  await touch('touchEnd', []);
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  const second = { x: point.x + 60, y: point.y + 40 };
  await touch('touchStart', [point, second]);
  await touch('touchEnd', []);
  await expect(page.locator('#ifc-properties-panel')).toHaveCount(0);

  // Closed by its own button: the history entry goes too.
  await touch('touchStart', [point]);
  await touch('touchEnd', []);
  await expect(page.locator('#ifc-properties-panel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.explora4dBack === true)).toBe(true);
  await page.locator('#ifc-properties-panel .ifc-props-close').click();
  await expect.poll(() => page.evaluate(() => history.state?.explora4dBack === true)).toBe(false);
  await context.close();
});

test('AI: reconstruction variants compared and their paradata reviewed', async ({ page }) => {
  test.setTimeout(120_000);
  const sent = [];
  await page.route('**/api/ai/config', (route) => route.fulfill({ json: { enabled: true, features: ['variants'], model: 'claude-opus-5-5' } }));
  await page.route('**/api/ai/variants', (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      summary: 'The roofed variant adds a dome and a fourth column.',
      differences: [{ aspect: 'Height', detail: 'The roofed variant is taller.', variants: ['roofed', 'open'] }],
      paradata: [
        { variant: 'roofed', status: 'ok', issues: [], suggestions: [] },
        { variant: 'open', status: 'incomplete', issues: ['No source is cited.'], suggestions: ['Cite the survey the ruin state is based on.'] },
      ],
      model: 'claude-opus-5-5',
    } });
  });
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await page.evaluate(async () => {
    const manifest = await (await fetch('/manifests/tempietto-aim3d-variants.json')).json();
    window.viewer.fullModelLoaded = false;
    await window.Viewer.setupManifesto(JSON.stringify(manifest), 'text');
  });
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.variantsState, null, { timeout: 60_000 });

  const section = page.locator('#viewerVariants .viewer-variants_ai');
  await expect(section.locator('.ai-button')).toBeVisible();
  expect(sent).toHaveLength(0);
  await section.locator('.ai-button').click();
  await expect(section.locator('.ai-answer')).toContainText('adds a dome');
  await expect(section.locator('[data-variant="open"][data-status="incomplete"]')).toContainText('Cite the survey');
  await expect(section.locator('.ai-disclaimer')).toBeVisible();

  // What was sent: texts, certainty and measurements - no geometry.
  const body = sent[0];
  expect(body.variants.map((variant) => variant.id)).toEqual(['roofed', 'open']);
  const roofed = body.variants[0];
  expect(roofed.measurements.sizeMeters).toHaveLength(3);
  expect(roofed.measurements.triangles).toBeGreaterThan(0);
  expect(roofed.certaintyLevel.code).toMatch(/^D/);
  expect(body.certaintyScale.levels.length).toBeGreaterThan(1);
  expect(roofed.nodeCount).toBe(3);
});

test('point clouds classified by the worker: the class list says so', async ({ page }) => {
  test.setTimeout(60_000);
  // tiles/<name>/tileset.json -> tiles/<name>.classification.json (worker/classify.py).
  await page.route('**/examples/tiles/wolpa-points.classification.json', (route) => route.fulfill({
    json: { classifier: 'geometric', points: 1000, counts: { ground: 600, building: 400 }, seconds: 0.4 },
  }));
  await openViewer(page, '/examples/tiles/wolpa-points/tileset.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  await page.waitForFunction(() => window.Viewer.pointCloudState?.autoClassification, null, { timeout: 20_000 });
  await expect(page.locator('#viewerPointCloudPanel .viewer-pointcloud-panel_note')).toHaveText(/assigned automatically from the geometry/);
});

test('AI: IFC questions on a .ifc opened directly (web-ifc): properties read once, elements drawn from the merged mesh', async ({ page }) => {
  test.setTimeout(150_000);
  let schema = null;
  await page.route('**/api/ai/config', (route) => route.fulfill({ json: { enabled: true, features: ['ifc-query'], model: 'claude-opus-5-5' } }));
  await page.route('**/api/ai/ifc-query', (route) => {
    schema = route.request().postDataJSON().schema;
    return route.fulfill({ json: {
      understood: true, interpretation: 'Columns', match: 'all',
      conditions: [{ field: 'type', pset: null, property: null, op: 'eq', value: 'IfcColumn' }],
      aggregate: { kind: 'count', pset: null, property: null, unit: null }, action: 'highlight', note: null, model: 'claude-opus-5-5',
    } });
  });
  await openViewer(page, '/examples/tempietto/Tempietto.ifc');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 90_000 });
  await page.waitForFunction(() => window.Viewer.ifcQueryAIState?.() === 'on', null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.Viewer.editorToolbarButtons.ifcQuery.hidden)).toBe(false);

  await page.evaluate(() => window.Viewer.toggleIfcQuery());
  const panel = page.locator('#ifcQueryPanel');
  await panel.locator('input').fill('columns');
  await panel.locator('button[type="submit"]').click();
  await expect(panel.locator('.ifc-query-count')).toHaveText('5 element(s) found', { timeout: 60_000 });
  expect(schema.classes.IfcColumn).toBe(5);
  expect(schema.storeys).toEqual(['Ground']);

  // Highlighted: an overlay of the columns' triangles on the one mesh.
  const whole = await page.evaluate(() => window.Viewer.ifcQueryOverlays[0].parent.geometry.index.count);
  expect(await page.evaluate(() => window.Viewer.ifcQueryOverlays[0].geometry.index.count)).toBeLessThan(whole);
  // Shown alone: the mesh gets a geometry with only those triangles, back on reset.
  await panel.locator('.ifc-query-actions [data-action="isolate"]').click();
  const isolated = await page.evaluate(() => window.Viewer.ifcQueryLiveGeometry.model.geometry.index.count);
  expect(isolated).toBeLessThan(whole);
  await panel.locator('.ifc-query-actions [data-action="reset"]').click();
  expect(await page.evaluate(() => window.Viewer.ifcQueryLiveGeometry)).toBeNull();
});

test('example manifests list: icons of what each manifest contains', async ({ page }) => {
  await openViewer(page);
  await page.evaluate(() => {
    window.Viewer.createExamplesPanel();
    window.Viewer.examplesPanel.hidden = false;
    window.Viewer.loadExamplesList();
  });
  const row = page.locator('#examplesPanel .models-panel-item', { hasText: 'Sun and shadows' });
  const icons = row.locator('.feature-icons .feature-icon');
  await expect(icons.first()).toBeAttached({ timeout: 20_000 });
  const shown = await icons.evaluateAll((parts) => parts.map((part) => part.querySelector('.meta-icon').dataset.icon));
  expect(shown).toEqual(expect.arrayContaining(['model', 'timeline', 'location', 'sun']));
  expect(await icons.evaluateAll((parts) => parts.every((part) => part.dataset.status === 'ok'))).toBe(true);
});

test('page header: the manifests button opens and closes the example manifests list', async ({ page }) => {
  await openViewer(page);
  const button = page.locator('#browseManifestsButton');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-label', 'Example manifests');
  await button.click();
  await expect(page.locator('#examplesPanel')).toBeVisible();
  await expect(page.locator('#examplesPanel .feature-icons').first()).toBeAttached({ timeout: 20_000 });
  await button.click();
  await expect(page.locator('#examplesPanel')).toBeHidden();
});

test('weather: rain, snow and a storm around the model; off gives the scene back', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const exposure = await page.evaluate(() => window.viewer.renderer.toneMappingExposure);
  // The materials' own shader hooks (the viewer sets some), to compare after.
  await page.evaluate(() => {
    window.__materialHooks = new Map();
    window.viewer.scene.traverse((object) => {
      [].concat(object.material || []).forEach((material) => window.__materialHooks.set(material, [material.onBeforeCompile, material.customProgramCacheKey]));
    });
  });

  // Look > Weather opens its window; Rain in it.
  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await toolbar.locator('.viewer-menus_panel button[data-tool="weather"]').click();
  const panel = page.locator('#viewerWeather');
  await expect(panel).toBeVisible();
  // Off: the weathers alone.
  await expect(panel.locator('button[data-weather="off"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('.viewer-weather_slider:visible')).toHaveCount(0);
  await panel.locator('button[data-weather="rain"]').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.weather.enabled)).toBe(true);
  await expect(panel.locator('button[data-weather="rain"]')).toHaveAttribute('aria-pressed', 'true');

  // Only the settings this weather has: the wet surfaces, not the mist's.
  const setting = (name) => panel.locator('label').filter({ hasText: name });
  await expect(setting('Wet surfaces and snow cover')).toBeVisible();
  await expect(setting('Mist height')).toBeHidden();

  // It rains, in fog, under a darker sky; the model keeps it off what lies
  // under its roofs (its height map, drawn from above).
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.rain.geometry.drawRange.count)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.heightMap.age < 3)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.viewer.scene.fog?.density > 0)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.viewer.renderer.toneMappingExposure)).toBeLessThan(exposure);

  // Fog: the mist's height and density, no wet surfaces.
  await page.evaluate(() => window.Viewer.setWeatherOptions({ type: 'fog', mistHeight: 0.8 }));
  await expect(setting('Mist height')).toBeVisible();
  await expect(setting('Wet surfaces and snow cover')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.mist.visible)).toBe(true);

  // Snow settles on the model: its materials are patched while it lies.
  await page.evaluate(() => {
    window.Viewer.setWeatherOptions({ type: 'snow' });
    window.Viewer.weatherObjects.snowCover = 1;
  });
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.snow.geometry.drawRange.count)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.patched.size)).toBeGreaterThan(0);

  // In a manifest while it is on.
  await page.evaluate(() => window.Viewer.setWeatherOptions({ type: 'storm', intensity: 0.5 }));
  expect(await page.evaluate(() => window.Viewer.getWeatherForExport())).toMatchObject({ type: 'storm', intensity: 0.5, mistHeight: 0.8 });

  // Off (in the window, which stays open): no fog, the exposure and the
  // materials' hooks as they were.
  await panel.locator('button[data-weather="off"]').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.weather.enabled)).toBe(false);
  expect(await page.evaluate(() => {
    let weather = 0;
    let changed = 0;
    window.viewer.scene.traverse((object) => {
      if (object.userData?.isWeather) weather += 1;
    });
    window.__materialHooks.forEach(([onBeforeCompile, customProgramCacheKey], material) => {
      if (material.onBeforeCompile !== onBeforeCompile || material.customProgramCacheKey !== customProgramCacheKey) changed += 1;
    });
    return { weather, changed, fog: window.viewer.scene.fog, exported: window.Viewer.getWeatherForExport() ?? null };
  })).toEqual({ weather: 0, changed: 0, fog: null, exported: null });
  expect(await page.evaluate(() => window.viewer.renderer.toneMappingExposure)).toBe(exposure);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('seasons: the intro\'s seasons around the model, from their own window', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await toolbar.locator('.viewer-menus_panel button[data-tool="seasons"]').click();
  const panel = page.locator('#viewerSeasons');
  await expect(panel).toBeVisible();
  // Off and the four seasons, each a line icon and its name.
  await expect(panel.locator('.viewer-weather_type')).toHaveCount(5);
  await expect(panel.locator('.viewer-weather_type svg')).toHaveCount(5);
  await expect(panel.locator('button[data-season="off"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('button[data-season="autumn"]')).toHaveText('Autumn');

  // Autumn: a clear sky, leaves in the air, the model's colours warmer.
  await panel.locator('button[data-season="autumn"]').click();
  await expect(panel.locator('button[data-season="autumn"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => ({ enabled: window.Viewer.weather.enabled, type: window.Viewer.weather.type, season: window.Viewer.weather.season }))).toEqual({ enabled: true, type: 'clear', season: 'autumn' });
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.leaves.geometry.drawRange.count)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.patched.size)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.surfaceUniforms.weatherGrade.value.b)).toBeLessThan(0.9);
  expect(await page.evaluate(() => window.Viewer.getWeatherForExport())).toMatchObject({ type: 'clear', season: 'autumn' });

  // Winter brings snow; the leaves go.
  await panel.locator('button[data-season="winter"]').click();
  expect(await page.evaluate(() => window.Viewer.weather.type)).toBe('snow');
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.snow.geometry.drawRange.count)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.leaves.geometry.drawRange.count)).toBe(0);

  // Off: the season's weather goes with it.
  await panel.locator('button[data-season="off"]').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.weather.enabled)).toBe(false);
  expect(await page.evaluate(() => window.Viewer.weather.season)).toBeNull();
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

// The weather (editor/weather.js) is a chunk of its own, downloaded on first
// use (editor/weather-lazy.js): not with the viewer, but as the pointer
// reaches its button; calls made meanwhile run in order once it is there.
test('weather: downloaded on first use, calls made meanwhile kept in order', async ({ page }) => {
  const weatherChunks = [];
  page.on('request', (request) => {
    if (/\/weather-(?!webgpu)[^/]*\.js$/.test(new URL(request.url()).pathname)) weatherChunks.push(request.url());
  });
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  expect(weatherChunks).toEqual([]);
  expect(await page.evaluate(() => [window.Viewer.weather.enabled, window.Viewer.getWeatherForExport()])).toEqual([false, undefined]);

  // A manifest's weather, then none: off in the end, as when loaded.
  expect(await page.evaluate(() => [
    window.Viewer.apply3IFManifestWeather({ type: 'fog' }),
    window.Viewer.apply3IFManifestWeather({ type: 'nope' }),
  ])).toEqual([true, false]);
  await expect.poll(() => weatherChunks.length).toBe(1);
  await expect.poll(() => page.evaluate(() => typeof window.Viewer.enableWeather)).toBe('function');
  expect(await page.evaluate(() => window.Viewer.weather.enabled)).toBe(false);

  await page.evaluate(() => window.Viewer.setWeatherOptions({ type: 'snow' }));
  expect(await page.evaluate(() => window.Viewer.getWeatherForExport()?.type)).toBe('snow');
  expect(weatherChunks).toHaveLength(1);
});

test('weather with the WebGPU renderer: the same weathers in TSL', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'renderer=webgpu&webgpuBackend=webgl2&weather=rain');
  await waitForModel(page);
  expect(await page.evaluate(() => window.viewer.rendererBackend)).toBe('webgpu');
  // ?weather=rain: on once the model is there.
  await expect.poll(() => page.evaluate(() => window.Viewer.weather.enabled && window.Viewer.weather.type)).toBe('rain');
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.rain.geometry.drawRange.count)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.Viewer.weatherObjects.rain.material.isNodeMaterial)).toBe(true);
  // Snow: quads (WebGPU points are one pixel), the surfaces' uniform shared
  // with the node materials.
  await page.evaluate(() => {
    window.Viewer.setWeatherOptions({ type: 'snow' });
    window.Viewer.weatherObjects.snowCover = 1;
  });
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.snow.isMesh)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.surfaceUniforms.weatherSnow.isNode && window.Viewer.weatherObjects.surfaceUniforms.weatherSnow.value > 0.5)).toBe(true);
  // A season: its petals as quads, its grade in the node materials.
  await page.evaluate(() => window.Viewer.setWeatherSeason('spring'));
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.leaves.isMesh && window.Viewer.weatherObjects.leaves.geometry.drawRange.count > 0)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.Viewer.weatherObjects.surfaceUniforms.weatherGrade.value.g)).toBeGreaterThan(1.02);
  await page.evaluate(() => window.Viewer.setWeather(false));
  expect(await page.evaluate(() => window.viewer.scene.fog)).toBeNull();
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('suggested scene rules: purpose, setting and what each suggestion rests on', () => {
  const item = (result, key) => result.items.find((entry) => entry.key === key);

  // A reconstruction of a castle in winter: presented outdoors, the sun of
  // its century, snow, AgX.
  const castle = suggestScene({
    size: { x: 60, y: 25, z: 40 },
    unitSource: 'file',
    text: 'Rekonstrukcja zamku w Malborku, XIV w., zimą. 54.0396, 19.0280',
  });
  expect(castle.purpose).toBe('presentation');
  expect(castle.setting.setting).toBe('outdoor');
  expect(item(castle, 'sun').value).toMatchObject({ enabled: true, latitude: 54.0396, longitude: 19.028, year: 1350, month: 1 });
  expect(item(castle, 'sun').preselected).toBe(true);
  expect(item(castle, 'weather').value).toMatchObject({ enabled: true, type: 'snow' });
  expect(item(castle, 'toneMapping').value.toneMapping).toBe('agx');
  expect(item(castle, 'rakingLight').value.enabled).toBe(false);
  expect(castle.uncertain).toEqual([]);

  // The same castle documented: no sun, no weather.
  const documented = suggestScene({ size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'Zamek w Malborku' }, 'documentation');
  expect(documented.autoPurpose).toBe('presentation');
  expect(item(documented, 'sun').value.enabled).toBe(false);
  expect(item(documented, 'weather').value.enabled).toBe(false);
  expect(item(documented, 'sun').reasons).toContainEqual({ key: 'documentationNeutral' });

  // A coin: documentation with raking light.
  const coin = suggestScene({ size: { x: 0.02, y: 0.02, z: 0.002 }, unitSource: 'manifest', text: 'Denar, moneta z inskrypcją' });
  expect(coin.purpose).toBe('documentation');
  expect(coin.setting.setting).toBe('studio');
  expect(item(coin, 'rakingLight')).toMatchObject({ value: { enabled: true }, preselected: true });

  // The inside of a church is indoors, though a church is a building.
  const nave = suggestScene({ size: { x: 30, y: 20, z: 50 }, unitSource: 'file', text: 'Wnętrze kościoła' });
  expect(nave.setting.setting).toBe('indoor');
  expect(item(nave, 'sun').value.enabled).toBe(false);

  // Splats carry their lighting: no sun, no ambient occlusion.
  const splats = suggestScene({ kind: 'splats', size: { x: 20, y: 10, z: 20 }, unitSource: 'file', text: 'church' }, 'presentation');
  expect(item(splats, 'sun').value.enabled).toBe(false);
  expect(item(splats, 'sun').reasons).toContainEqual({ key: 'splatsBaked' });
  expect(item(splats, 'ao').value.ao).toBe(false);

  // Unknown place: said, and the sun is less sure.
  const unplaced = suggestScene({ size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'castle' }, 'presentation');
  expect(unplaced.uncertain).toContainEqual({ key: 'place' });
  // What is on already is not ticked again.
  const already = suggestScene({ size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'castle', current: { sun: true, toneMapping: 'agx' } }, 'presentation');
  expect(item(already, 'sun')).toMatchObject({ changes: false, preselected: false });

  // A town the texts name (worker/geonames.py) puts the sun there; coordinates
  // written in the texts come first, a guess is said to be one.
  const named = { name: 'Malbork', country: 'PL', latitude: 54.0359, longitude: 19.0266, confidence: 0.75, source: 'geonames' };
  const malbork = suggestScene({ size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'Zamek w Malborku', location: named }, 'presentation');
  expect(item(malbork, 'sun').value).toMatchObject({ latitude: 54.0359, longitude: 19.0266 });
  expect(item(malbork, 'sun').reasons).toContainEqual({ key: 'placeNamed', name: 'Malbork', country: 'PL' });
  expect(malbork.uncertain).toEqual([]);
  const written = suggestScene({ size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'Malbork 54.0712, 19.1043', location: named }, 'presentation');
  expect(item(written, 'sun').value).toMatchObject({ latitude: 54.0712, longitude: 19.1043 });
  const guess = suggestScene({ size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'York', location: { ...named, name: 'York', country: 'GB', confidence: 0.45 } }, 'presentation');
  expect(guess.uncertain).toContainEqual({ key: 'placeGuess', name: 'York', country: 'GB' });
  expect(item(guess, 'sun').confidence).toBeLessThan(item(malbork, 'sun').confidence);

  expect(findSceneYear('built 1410, rebuilt 1650; scanned 2021')).toEqual({ year: 1410, kind: 'year' });
  expect(findSceneYear('14th century')?.year).toBe(1350);
  expect(findSceneYear('XII wiek')?.year).toBe(1150);
  expect(findSceneYear('texture 1920x1080, 2048 px')).toBeNull();
  expect(findSceneCoordinates('33.86° S, 151.21° E')).toEqual({ latitude: -33.86, longitude: 151.21 });
  expect(findSceneCoordinates('version 1.20 2.30')).toBeNull();
});

test('generated surroundings rules: offered for a dated building of a known kind, and laid out the same from the same seed', () => {
  const item = (result) => result.items.find((entry) => entry.key === 'surroundings');
  const castleFacts = { size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'Rekonstrukcja zamku w Malborku, XIV w., zimą. 54.0396, 19.0280' };

  // A castle of the 14th century in Poland, presented: a settlement beside
  // it, under snow; said to be typical, not this place's.
  const castle = item(suggestScene(castleFacts));
  expect(castle.value).toMatchObject({ enabled: true, kind: 'castle', period: 'medieval', year: 1350, season: 'winter', density: 0.6 });
  expect(castle.preselected).toBe(true);
  expect(castle.reasons).toContainEqual({ key: 'surroundingsType', kind: 'castle' });
  expect(castle.reasons).toContainEqual({ key: 'surroundingsTypical' });
  // The same texts, the same seed.
  expect(item(suggestScene(castleFacts)).value.seed).toBe(castle.value.seed);
  // Shown already: nothing to change.
  expect(item(suggestScene({ ...castleFacts, current: { surroundings: true } })).changes).toBe(false);

  // Documented: only what was recorded.
  expect(item(suggestScene(castleFacts, 'documentation'))).toMatchObject({ value: { enabled: false }, reasons: [{ key: 'surroundingsDocumentation' }] });
  // No year, another period, another region, no kind, an object: none.
  const why = (text, size = castleFacts.size) => item(suggestScene({ size, unitSource: 'file', text }, 'presentation')).reasons[0].key;
  expect(why('Zamek w Malborku')).toBe('surroundingsNoYear');
  expect(why('Castle, 9th century')).toBe('surroundingsOtherPeriod');
  expect(why('Castle, 14th century. 35.0116, 135.7681')).toBe('surroundingsOtherRegion');
  expect(why('Bridge, 14th century')).toBe('surroundingsNoType');
  expect(why('Castle, 14th century', { x: 0.3, y: 0.2, z: 0.3 })).not.toBe('surroundingsType');
  // An unknown unit or region: offered, less surely.
  const unsure = item(suggestScene({ size: castleFacts.size, unitSource: 'default', text: 'Church, 12th century' }, 'presentation'));
  expect(unsure.value).toMatchObject({ enabled: true, kind: 'church', period: 'early-medieval' });
  expect(unsure.confidence).toBeLessThan(castle.confidence);
  expect(unsure.reasons.map((reason) => reason.key)).toEqual(expect.arrayContaining(['surroundingsNoPlace', 'surroundingsUnitUnknown']));
  // A castle's text naming its town is still a castle.
  expect(suggestSurroundings({ normalizedText: 'zamek, miasto torun', year: { year: 1300 }, sizeClass: 'building' }).value.kind).toBe('castle');

  // The layout: the same from the same parameters, another from another seed.
  const params = { kind: 'castle', period: 'medieval', seed: 42, density: 0.6 };
  const layout = layoutSurroundings(params, { radius: 36 });
  expect(layoutSurroundings(params, { radius: 36 })).toEqual(layout);
  expect(layoutSurroundings({ ...params, seed: 43 }, { radius: 36 }).blocks).not.toEqual(layout.blocks);
  const count = (entries, role) => entries.filter((entry) => entry.role === role).length;
  expect(count(layout.blocks, 'house')).toBeGreaterThan(10);
  // A masonry church with a tower; no wall round a castle's settlement.
  expect(count(layout.blocks, 'church')).toBe(2);
  expect(layout.walls).toEqual([]);
  expect(layout.fields.length).toBeGreaterThan(5);
  expect(layout.trees.length).toBeGreaterThan(300);
  // Nothing stands on the model, and everything built on flat ground.
  [...layout.blocks, ...layout.trees].forEach((entry) => expect(Math.hypot(entry.x, entry.z)).toBeGreaterThan(layout.clear));
  layout.blocks.forEach((block) => expect(surroundingsTerrainHeight(layout, block.x, block.z)).toBe(0));
  expect(layout.clear).toBeGreaterThan(36);

  // Before the mid 13th century: timber, a palisade, a small church.
  const early = layoutSurroundings({ ...params, period: 'early-medieval' }, { radius: 36 });
  expect(early.walls.length).toBeGreaterThan(10);
  expect(early.walls.every((wall) => wall.kind === 'palisade')).toBe(true);
  expect(count(early.blocks, 'church')).toBe(1);
  // A town: many houses, a masonry wall with towers, open at its gates.
  const town = layoutSurroundings({ ...params, kind: 'town' }, { radius: 36 });
  expect(count(town.blocks, 'house')).toBeGreaterThan(100);
  expect(count(town.blocks, 'tower')).toBeGreaterThan(4);
  expect(town.walls.every((wall) => wall.kind === 'masonry')).toBe(true);
  expect(town.walls.length).toBeLessThan(30);
  // Water: a moat round a castle, crossed by a bridge where the road leaves.
  const moated = layoutSurroundings({ ...params, kind: 'castle' }, { radius: 36 });
  expect(moated.water.moat.inner).toBeGreaterThan(36);
  expect(moated.bridges.length).toBeGreaterThanOrEqual(1);
  const across = moated.bridges[0];
  expect(Math.hypot(across.x, across.z)).toBeGreaterThan(moated.water.moat.inner - 1);
  expect(Math.hypot(across.x, across.z)).toBeLessThan(moated.water.moat.outer + 1);
  // The bed lies under the water, the water under the banks.
  const middle = (moated.water.moat.inner + moated.water.moat.outer) / 2;
  expect(surroundingsTerrainHeight(moated, middle, 0)).toBeLessThan(surroundingsWaterLevel(moated, middle, 0));
  expect(surroundingsTerrainHeight(moated, moated.water.moat.outer + 8, 0)).toBe(0);
  expect(layoutSurroundings({ ...params, kind: 'castle', water: false }, { radius: 36 }).water.moat).toBeNull();
  // A river past a town (seed 1): nothing built or growing in it; bridges
  // cross it, roads do not run along it.
  const riverTown = layoutSurroundings({ kind: 'town', seed: 1 }, { radius: 36 });
  expect(riverTown.water.river).not.toBeNull();
  [...riverTown.blocks, ...riverTown.trees].forEach((entry) => expect(surroundingsWaterDistance(riverTown, entry.x, entry.z)).toBeGreaterThan(0));
  expect(Math.min(...riverTown.water.river.points.map(([x, z]) => Math.hypot(x, z)))).toBeGreaterThan(riverTown.clear);
  expect(riverTown.bridges.length).toBeGreaterThan(0);
  riverTown.bridges.forEach((bridge) => expect(bridge.length).toBeLessThan(75));
  // No river on the real terrain, whose rivers are not known here.
  expect(layoutSurroundings({ kind: 'town', seed: 1, terrain: 'real', latitude: 50, longitude: 20 }, { radius: 36 }).water.river).toBeNull();
  // The real terrain needs a place; the suggestion asks for it where one is known.
  expect(normalizeSurroundings({ terrain: 'real' }).terrain).toBe('generated');
  expect(normalizeSurroundings({ terrain: 'real', latitude: 50, longitude: 20 })).toMatchObject({ terrain: 'real', latitude: 50, longitude: 20 });
  expect(item(suggestScene(castleFacts)).value).toMatchObject({ terrain: 'real', latitude: 54.0396, water: true });
  expect(item(suggestScene(castleFacts)).reasons).toContainEqual({ key: 'surroundingsMoat' });
  expect(item(suggestScene({ ...castleFacts, text: 'Zamek, XIV w.' })).value.terrain).toBe('generated');

  // Elevation tiles: Terrarium decoding, the zoom for a size, and a
  // heightfield relative to the place, flat at the model.
  expect(decodeTerrarium(128, 100, 128)).toBeCloseTo(100.5, 6);
  expect(elevationZoom(50, 1000)).toBe(14);
  expect(elevationZoom(50, 40000)).toBeLessThan(12);
  const slope = { metresPerPixel: 10, origin: { x: 100, y: 100 }, width: 200, height: 200, centre: 0, heights: new Float32Array(200 * 200) };
  for (let y = 0; y < 200; y += 1) for (let x = 0; x < 200; x += 1) slope.heights[y * 200 + x] = (x + 0.5 - 100) * 2;
  slope.centre = 0;
  const field = createHeightfield(slope, { flat: 20, blend: 60 });
  expect(field(10, 0)).toBe(0);
  // East (+x when north is -Z): 2 m a pixel of 10 m.
  expect(field(300, 0)).toBeCloseTo(60, 1);
  expect(field(-300, 0)).toBeCloseTo(-60, 1);
  // North turned to +X: east is +Z.
  expect(createHeightfield(slope, { north: 90, flat: 20, blend: 60 })(0, 300)).toBeCloseTo(60, 1);

  // Brick on the northern lowlands, stone to the south.
  expect(surroundingsMasonry({ latitude: 54.04, longitude: 19.03 })).toBe('brick');
  expect(surroundingsMasonry({ latitude: 50.06, longitude: 19.94 })).toBe('brick');
  expect(surroundingsMasonry({ latitude: 50.09, longitude: 14.42 })).toBe('stone');
  expect(surroundingsMasonry({ latitude: 49.42, longitude: 20.32 })).toBe('stone');
  expect(surroundingsMasonry(null)).toBeNull();
  expect(item(suggestScene(castleFacts)).value.masonry).toBe('brick');
  expect(item(suggestScene({ ...castleFacts, text: 'Castle, 14th century. 50.0900, 14.4200' })).value.masonry).toBe('stone');
  // Following the timeline: a third of the houses at a period's start, all
  // at its end; a house standing at a lower growth stands at a higher one.
  expect(surroundingsGrowth(1250)).toBeCloseTo(0.35, 2);
  expect(surroundingsGrowth(1549)).toBe(1);
  expect(item(suggestScene({ ...castleFacts, timelineYear: 1300 })).value).toMatchObject({ followTimeline: true, period: 'medieval', year: 1300 });
  const houses = (growth) => new Set(layoutSurroundings({ kind: 'village', seed: 7, growth }, { radius: 30 }).blocks.filter((block) => block.role === 'house').map((block) => `${block.x.toFixed(3)},${block.z.toFixed(3)}`));
  const young = houses(0.4);
  const grown = houses(1);
  expect(grown.size).toBeGreaterThan(young.size);
  expect([...young].every((house) => grown.has(house))).toBe(true);

  // The real water from the map: a natural lake east, a river north, the sea
  // south (the coastline runs west to east: land on its left); a reservoir
  // is left out.
  const [mapLat, mapLon] = [54, 18.6];
  const at = (east, north) => ({ lat: mapLat + north / 110540, lon: mapLon + east / (111320 * Math.cos((mapLat * Math.PI) / 180)) });
  const lake = [[150, -50], [300, -50], [300, 50], [150, 50], [150, -50]].map(([east, north]) => at(east, north));
  const answer = { elements: [
    { type: 'way', tags: { natural: 'water' }, geometry: lake },
    { type: 'way', tags: { natural: 'water', water: 'reservoir' }, geometry: [at(-300, -50), at(-150, -50), at(-150, 50), at(-300, 50), at(-300, -50)] },
    { type: 'way', tags: { waterway: 'river', width: '20' }, geometry: [at(-800, 200), at(800, 200)] },
    { type: 'way', tags: { natural: 'coastline' }, geometry: [at(-900, -400), at(900, -400)] },
  ] };
  const features = readMapWater(answer, mapProjector(mapLat, mapLon, 0));
  expect([features.lines.length, features.areas.length, features.coast.length]).toEqual([1, 1, 1]);
  const map = createMapWater(features, 1000);
  // x east, z south (north is -Z).
  expect(map.distance(220, 0)).toBeCloseTo(-50, 0);
  expect(map.distance(100, 0)).toBeCloseTo(50, 0);
  expect(map.distance(-220, 0)).toBeGreaterThan(100);
  expect(map.distance(0, -200)).toBeCloseTo(-10, 0);
  expect(map.distance(0, 450)).toBeCloseTo(-50, 0);
  expect(map.distance(0, 900)).toBeLessThan(-200);
  expect(map.distance(0, 300)).toBeCloseTo(100, 0);
  expect(mapWaterQuery(mapLat, mapLon, 900)).toContain('(around:900,54.000000,18.600000)');
  expect(mapWaterQuery(mapLat, mapLon, 900)).toContain('reservoir');
  // A castle's settlement on dry land; nothing built in the water; a river
  // generated nowhere on the real terrain.
  const mapped = layoutSurroundings({ kind: 'castle', seed: 3, terrain: 'real', latitude: mapLat, longitude: mapLon }, { radius: 30, mapWater: map });
  expect(mapped.water.map).toBe(map);
  expect(map.distance(mapped.zone.x, mapped.zone.z)).toBeGreaterThan(mapped.zone.r * 0.4);
  [...mapped.blocks, ...mapped.trees].forEach((entry) => expect(surroundingsWaterDistance(mapped, entry.x, entry.z)).toBeGreaterThan(0));
  expect(layoutSurroundings({ kind: 'castle', seed: 3, terrain: 'real', latitude: mapLat, longitude: mapLon, water: false }, { radius: 30, mapWater: map }).water.map).toBeNull();

  // 1550-1800: taller town houses, a baroque church under an onion dome,
  // earthen ramparts with bastions instead of a wall with towers.
  expect(item(suggestScene({ ...castleFacts, text: 'Town hall, 1780. 54.0396, 19.0280' })).value).toMatchObject({ enabled: true, kind: 'town', period: 'early-modern' });
  const baroque = layoutSurroundings({ kind: 'town', seed: 3, period: 'early-modern' }, { radius: 30 });
  expect(baroque.walls.length).toBeGreaterThan(10);
  expect(baroque.walls.every((wall) => wall.kind === 'rampart')).toBe(true);
  expect(baroque.blocks.filter((block) => block.roof === 'onion')).toHaveLength(1);
  expect(baroque.blocks.filter((block) => block.role === 'house').every((block) => block.h >= 8)).toBe(true);
  expect(layoutSurroundings({ kind: 'town', seed: 3, period: 'early-modern' }, { radius: 30 }).walls.length).toBe(baroque.walls.length);
  expect(surroundingsGrowth(1550)).toBeCloseTo(0.35, 2);
  expect(surroundingsGrowth(1800)).toBe(1);

  // 1800-1914: no walls but a boulevard with an avenue where they stood, a
  // railway past the town with its station and factories; nothing on the
  // line; tenements.
  expect(item(suggestScene({ ...castleFacts, text: 'Town hall, 1880. 54.0396, 19.0280' })).value.period).toBe('industrial');
  const railTown = layoutSurroundings({ kind: 'town', seed: 1, period: 'industrial' }, { radius: 30 });
  const roles = railTown.blocks.reduce((count, block) => ({ ...count, [block.role]: (count[block.role] || 0) + 1 }), {});
  expect(roles).toMatchObject({ station: 1, church: 2 });
  expect(roles.factory).toBeGreaterThanOrEqual(1);
  expect(roles.chimney).toBeGreaterThanOrEqual(1);
  expect(railTown.walls).toEqual([]);
  expect(railTown.roads.some((road) => road.boulevard)).toBe(true);
  expect(railTown.railway.points.every(([x, z]) => Math.hypot(x, z) > railTown.clear)).toBe(true);
  const onLine = (x, z) => Math.min(...railTown.railway.points.slice(0, -1).map(([ax, az], index) => {
    const [bx, bz] = railTown.railway.points[index + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    return Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az));
  }));
  railTown.blocks.forEach((block) => expect(onLine(block.x, block.z)).toBeGreaterThan(4));
  expect(railTown.blocks.filter((block) => block.role === 'house').every((block) => block.h >= 12)).toBe(true);
  expect(layoutSurroundings({ kind: 'village', seed: 2, period: 'industrial' }, { radius: 30 }).railway).not.toBeNull();
  expect(surroundingsGrowth(1914)).toBe(1);
  // 1914-1945: the same, with flat-roofed blocks of flats.
  expect(item(suggestScene({ ...castleFacts, text: 'Town hall, 1930. 54.0396, 19.0280' })).value.period).toBe('modern');
  const town1930 = layoutSurroundings({ kind: 'town', seed: 1, period: 'modern' }, { radius: 30 });
  const flats = town1930.blocks.filter((block) => block.role === 'house');
  expect(flats.length).toBeGreaterThan(10);
  expect(flats.every((block) => block.roof === 'none' && block.h >= 15)).toBe(true);
  expect(town1930.railway).not.toBeNull();
  expect(town1930.walls).toEqual([]);

  // An old map (GeoJSON): roads, fields, buildings, walls, in the
  // layout's metres; a building as its smallest turned rectangle.
  const turned = minimumRectangle([[0, 0], [10, 0], [10, 4], [0, 4]].map(([x, z]) => [x * Math.cos(0.5) - z * Math.sin(0.5), x * Math.sin(0.5) + z * Math.cos(0.5)]));
  expect(turned.w).toBeCloseTo(10, 5);
  expect(turned.d).toBeCloseTo(4, 5);
  expect(turned.angle).toBeCloseTo(0.5, 5);
  const oldMap = mapGeoJsonToAnswer({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { kind: 'road', width: 6 }, geometry: { type: 'LineString', coordinates: [[18.597, 54.0012], [18.603, 54.0012]] } },
    { type: 'Feature', properties: { kind: 'road', width: 6, start_date: '1700' }, geometry: { type: 'LineString', coordinates: [[18.6, 53.998], [18.6, 54.004]] } },
    { type: 'Feature', properties: { kind: 'building', height: 9 }, geometry: { type: 'Polygon', coordinates: [[[18.6015, 54.0014], [18.6017, 54.0014], [18.6017, 54.0015], [18.6015, 54.0015], [18.6015, 54.0014]]] } },
    { type: 'Feature', properties: { kind: 'building', role: 'church', height: 14 }, geometry: { type: 'Polygon', coordinates: [[[18.5985, 54.0014], [18.5989, 54.0014], [18.5989, 54.0016], [18.5985, 54.0016], [18.5985, 54.0014]]] } },
    { type: 'Feature', properties: { kind: 'field' }, geometry: { type: 'Polygon', coordinates: [[[18.605, 54.002], [18.607, 54.002], [18.607, 54.003], [18.605, 54.003], [18.605, 54.002]]] } },
    { type: 'Feature', properties: { kind: 'wall' }, geometry: { type: 'LineString', coordinates: [[18.598, 54.0005], [18.602, 54.0005]] } },
  ] });
  const old1400 = readMapLayout(filterByYear(oldMap, 1400), mapProjector(54, 18.6, 0));
  expect([old1400.roads.length, old1400.fields.length, old1400.buildings.length, old1400.walls.length]).toEqual([1, 1, 2, 1]);
  expect(old1400.buildings.find((building) => building.role === 'church').h).toBe(14);
  expect(readMapLayout(filterByYear(oldMap, 1750), mapProjector(54, 18.6, 0)).roads).toHaveLength(2);
  // Laid out on it: its roads, its buildings only, its field, its wall.
  const onOldMap = layoutSurroundings({ kind: 'town', seed: 5, latitude: 54, longitude: 18.6 }, { radius: 10, mapLayout: old1400 });
  // (Cut where it meets a generated river's bank, if any.)
  expect(onOldMap.roads.length).toBeGreaterThanOrEqual(1);
  expect(onOldMap.roads.every((road) => road.width === 6)).toBe(true);
  expect(onOldMap.blocks).toHaveLength(2);
  expect(onOldMap.fields).toHaveLength(1);
  expect(onOldMap.fields[0].polygon).toHaveLength(4);
  expect(onOldMap.walls.every((wall) => wall.kind === 'masonry')).toBe(true);
  onOldMap.trees.forEach((tree) => expect(Math.hypot(tree.x - onOldMap.fields[0].x, tree.z - onOldMap.fields[0].z)).toBeGreaterThan(5));
  // Without a place, an old map cannot be placed: generated.
  expect(layoutSurroundings({ kind: 'town', seed: 5 }, { radius: 10, mapLayout: old1400 }).blocks.length).toBeGreaterThan(2);

  // Dated water: kept from its start until before its end.
  expect([dateYear('1350-05-01'), dateYear('~1350'), dateYear('c. 1350'), dateYear(''), dateYear(undefined)]).toEqual([1350, 1350, 1350, null, null]);
  const dated = { elements: [
    { id: 1, tags: { waterway: 'river', start_date: '1200', end_date: '1600' } },
    { id: 2, tags: { waterway: 'river', start_date: '1600' } },
    { id: 3, tags: { waterway: 'stream' } },
  ] };
  expect(filterByYear(dated, 1400).elements.map((element) => element.id)).toEqual([1, 3]);
  expect(filterByYear(dated, 1600).elements.map((element) => element.id)).toEqual([2, 3]);
  // A water file (GeoJSON, digitised from an old map): a lake with an
  // island, a river by its kind and width, a medieval fishpond kept.
  const file = waterGeoJsonToAnswer({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { kind: 'lake' }, geometry: { type: 'Polygon', coordinates: [
      [[18.602, 53.9995], [18.606, 53.9995], [18.606, 54.0005], [18.602, 54.0005], [18.602, 53.9995]],
      [[18.6035, 53.9999], [18.6045, 53.9999], [18.6045, 54.0001], [18.6035, 54.0001], [18.6035, 53.9999]],
    ] } },
    { type: 'Feature', properties: { kind: 'river', width: 30, start_date: '1300' }, geometry: { type: 'LineString', coordinates: [[18.59, 54.002], [18.61, 54.002]] } },
    { type: 'Feature', properties: { natural: 'water', water: 'fishpond' }, geometry: { type: 'Polygon', coordinates: [[[18.59, 53.998], [18.592, 53.998], [18.592, 53.999], [18.59, 53.998]]] } },
  ] });
  const fileWater = createMapWater(readMapWater(file, mapProjector(54, 18.6, 0), { modern: true }), 1000);
  const east = (lon) => (lon - 18.6) * 111320 * Math.cos((54 * Math.PI) / 180);
  expect(fileWater.distance(east(18.6025), 0)).toBeLessThan(0);
  // The island is land.
  expect(fileWater.distance(east(18.604), 0)).toBeGreaterThan(0);
  expect(fileWater.distance(0, -0.002 * 110540)).toBeCloseTo(-15, 0);
  expect(readMapWater(file, mapProjector(54, 18.6, 0)).areas).toHaveLength(1);
  expect(readMapWater(file, mapProjector(54, 18.6, 0), { modern: true }).areas).toHaveLength(2);

  // The look is a parameter of its own: schematic unless asked.
  expect(normalizeSurroundings({ kind: 'town' }).style).toBe('schematic');
  expect(normalizeSurroundings({ kind: 'town', style: 'realistic' }).style).toBe('realistic');
  expect(normalizeSurroundings({ kind: 'town', style: 'photo' }).style).toBe('schematic');
  // A church stands in its village and gets no second one.
  expect(count(layoutSurroundings({ ...params, kind: 'church' }, { radius: 12 }).blocks, 'church')).toBe(0);
});

test('generated surroundings: drawn round the model, marked, stored in the manifest, and no part of the model', async ({ page }) => {
  // Builds and redraws them many times over (software WebGL in CI).
  test.setTimeout(60_000);
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(() => {
    const gather = window.Viewer.gatherSceneFacts;
    window.Viewer.gatherSceneFacts = () => ({
      ...gather(),
      size: { x: 60, y: 25, z: 40 },
      unitSource: 'file',
      text: 'Castle, 14th century. 54.0396, 19.0280',
    });
  });
  const before = await page.evaluate(() => ({ grid: window.viewer.gridSize, box: window.Viewer.getPublishModelBox().getSize(window.viewer.camera.position.clone()).toArray() }));
  const farBefore = await page.evaluate(() => window.viewer.camera.far);
  // The texts give the place: the real terrain is asked for. No tiles here:
  // the generated hills stay, and the badge says so.
  await page.route('**/elevation-tiles-prod/**', (route) => route.abort());
  await page.route('https://overpass-api.openhistoricalmap.org/**', (route) => route.abort());
  await page.route('https://overpass-api.de/**', (route) => route.abort());

  await page.evaluate(() => window.Viewer.toggleSceneSuggestPanel(true));
  const panel = page.locator('#viewerScene');
  const row = panel.locator('.viewer-scene_item[data-item="surroundings"]');
  await expect(row.locator('input')).toBeChecked();
  await expect(row.locator('.viewer-scene_item-value')).toHaveText('a settlement below a castle, late Middle Ages');
  await expect(row.locator('.viewer-scene_reasons')).toContainText('a typical setting of that kind and time');
  await panel.locator('.viewer-scene_apply').click();

  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.enabled)).toBe(true);
  const shown = await page.evaluate(() => {
    const objects = window.Viewer.surroundingsObjects;
    return {
      inScene: window.viewer.scene.children.includes(objects.group),
      marked: objects.group.userData.isSurroundings,
      meshes: objects.group.children.map((mesh) => mesh.name),
      houses: objects.layout.blocks.filter((block) => block.role === 'house').length,
      triangles: objects.triangles,
      exported: window.Viewer.getSurroundingsForExport(),
      manifest: window.Viewer.build3IFManifest().AIM3DViewer.surroundings,
    };
  });
  // Plain shapes, and the castle's moat.
  expect(shown).toMatchObject({ inScene: true, marked: true, meshes: ['surroundings-ground', 'surroundings-built', 'surroundings-water'] });
  expect(shown.houses).toBeGreaterThan(10);
  expect(shown.triangles).toBeGreaterThan(5000);
  expect(shown.exported).toMatchObject({ generated: true, kind: 'castle', period: 'medieval', year: 1350, season: 'summer', terrain: 'real', latitude: 54.0396, longitude: 19.028 });
  expect(shown.manifest).toEqual(shown.exported);
  expect(validateAIM3DManifest({ AIM3DViewer: { surroundings: shown.exported } }).errors.filter((error) => error.path.includes('surroundings'))).toEqual([]);
  expect(validateAIM3DManifest({ AIM3DViewer: { surroundings: { kind: 'harbour', period: 'baroque', seed: -1, density: 2, style: 'photo' } } }).errors.map((error) => error.path).filter((path) => path.includes('surroundings')))
    .toEqual(['$.AIM3DViewer.surroundings.kind', '$.AIM3DViewer.surroundings.period', '$.AIM3DViewer.surroundings.style', '$.AIM3DViewer.surroundings.seed', '$.AIM3DViewer.surroundings.density']);
  // The model's own sizes are as before.
  expect(await page.evaluate(() => ({ grid: window.viewer.gridSize, box: window.Viewer.getPublishModelBox().getSize(window.viewer.camera.position.clone()).toArray() }))).toEqual(before);
  expect(shown.exported.style).toBe('schematic');

  // The badge says what it is; another layout; off.
  const badge = page.locator('#viewerSurroundingsBadge');
  await expect(badge).toContainText('Generated surroundings: a settlement below a castle, late Middle Ages');
  await expect(badge).toContainText('generated hills (the terrain could not be loaded)');
  await badge.locator('button[data-action="reshuffle"]').click();
  expect(await page.evaluate(() => window.Viewer.surroundings.seed)).not.toBe(shown.exported.seed);

  // The realistic look: the same layout, more drawn - a layer of baked
  // shadows, the hills on the horizon within the camera's reach - and the
  // same marks.
  const layoutBefore = await page.evaluate(() => window.Viewer.surroundingsObjects.layout.blocks.length);
  await badge.locator('button[data-action="style"]').click();
  await expect(badge.locator('button[data-action="style"]')).toHaveAttribute('aria-pressed', 'true');
  const realistic = await page.evaluate(() => {
    const objects = window.Viewer.surroundingsObjects;
    return {
      meshes: objects.group.children.map((mesh) => mesh.name),
      blocks: objects.layout.blocks.length,
      triangles: objects.triangles,
      reach: objects.layout.extent * 1.75 / objects.site.meters,
      far: window.viewer.camera.far,
      shadeTransparent: objects.group.children[1].material.transparent,
      exported: window.Viewer.getSurroundingsForExport(),
    };
  });
  // A moat round the box (a castle), smoke in no house of a summer
  // castle's settlement necessarily; cast shadows from the key light.
  expect(realistic.meshes).toEqual(expect.arrayContaining(['surroundings-ground', 'surroundings-shade', 'surroundings-built', 'surroundings-water', 'surroundings-shadows']));
  expect(realistic.blocks).toBe(layoutBefore);
  expect(realistic.triangles).toBeGreaterThan(shown.triangles);
  expect(realistic.far).toBeGreaterThanOrEqual(realistic.reach);
  expect(realistic.shadeTransparent).toBe(true);
  expect(realistic.exported).toMatchObject({ generated: true, style: 'realistic', water: true });
  // The shaders: patterns and sway per corner; time and wind move each
  // frame; the shadows follow the light.
  // The time of the shaders runs with the frames (once they are compiled).
  const started = await page.evaluate(() => window.Viewer.surroundingsUniforms.surroundingsTime.value);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsUniforms.surroundingsTime.value), { timeout: 20_000 }).toBeGreaterThan(started + 0.2);
  const moving = await page.evaluate(async () => {
    const objects = window.Viewer.surroundingsObjects;
    const built = objects.group.getObjectByName('surroundings-built').geometry;
    const detail = built.getAttribute('surroundingsDetail');
    const sway = built.getAttribute('surroundingsSway');
    const tiles = new Set();
    for (let index = 0; index < detail.count; index += 97) tiles.add(detail.getZ(index));
    let swaying = 0;
    for (let index = 0; index < sway.count; index += 1) if (sway.getX(index) > 0) swaying += 1;
    const shadows = objects.shadows.mesh.geometry.getAttribute('position').count;
    const key = objects.shadows.key;
    // The sun instead of the key light: the shadows worked out again.
    window.Viewer.setSunOptions({ latitude: 52, longitude: 20, month: 7, day: 15, minutes: 960 });
    window.Viewer.setSunStudy(true);
    window.Viewer.updateSurroundings(0, { force: true });
    const sunKey = objects.shadows.key;
    // Rain: fainter.
    const strength = window.Viewer.getSurroundingsLight().strength;
    const before = { ...window.Viewer.weather };
    Object.assign(window.Viewer.weather, { enabled: true, type: 'rain', intensity: 0.6 });
    const rainy = window.Viewer.getSurroundingsLight().strength;
    Object.assign(window.Viewer.weather, before);
    window.Viewer.setSunStudy(false);
    return {
      tiles: tiles.size,
      swaying,
      shadows,
      key,
      sunKey,
      strength,
      rainy,
      water: objects.group.getObjectByName('surroundings-water').material.transparent,
    };
  });
  expect(moving.tiles).toBeGreaterThan(3);
  expect(moving.swaying).toBeGreaterThan(1000);
  expect(moving.shadows).toBeGreaterThan(1000);
  expect(moving.sunKey).not.toBe(moving.key);
  expect(moving.rainy).toBeLessThan(moving.strength / 2);
  expect(moving.water).toBe(true);
  await expect(badge).toContainText('Generated surroundings');
  await page.evaluate(() => window.Viewer.selectLanguage('pl'));
  await expect(badge).toContainText('Wygenerowane otoczenie: podgrodzie zamku');
  await page.evaluate(() => window.Viewer.selectLanguage('en'));

  // Undo of the suggestion takes them away again.
  await panel.locator('.viewer-scene_undo').click();
  await expect(badge).toHaveCount(0);
  expect(await page.evaluate(() => [window.Viewer.surroundings.enabled, window.Viewer.surroundingsObjects, window.Viewer.getSurroundingsForExport()])).toEqual([false, null, undefined]);
  // The camera's reach put back.
  expect(await page.evaluate(() => window.viewer.camera.far)).toBe(farBefore);

  // From a manifest; a block of no known kind is none; gone with the model.
  expect(await page.evaluate(() => [
    window.Viewer.apply3IFManifestSurroundings({ generated: true, kind: 'town', year: 1100, seed: 7 }),
    window.Viewer.surroundings.period,
    window.Viewer.surroundingsObjects.layout.walls[0].kind,
  ])).toEqual([true, 'early-medieval', 'palisade']);
  expect(await page.evaluate(() => [window.Viewer.apply3IFManifestSurroundings({ kind: 'harbour' }), window.Viewer.surroundings.enabled])).toEqual([false, false]);
  await page.evaluate(() => {
    window.Viewer.setSurroundingsOptions({ kind: 'village' });
    window.Viewer.disposeSurroundings();
  });
  expect(await page.evaluate(() => window.viewer.scene.children.some((child) => child.userData.isSurroundings))).toBe(false);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings on the real terrain: elevation tiles of the place, relative to the model', async ({ page }) => {
  // Tiles of a slope rising eastwards, 0.1 m a pixel (Terrarium), served
  // here instead of the open Terrain Tiles.
  const [latitude, longitude] = [49.4197, 20.3198];
  const asked = [];
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**', async (route) => {
    const [z, x, y] = route.request().url().match(/terrarium\/(\d+)\/(\d+)\/(\d+)\.png/).slice(1).map(Number);
    asked.push([z, x, y]);
    const centre = worldPixel(latitude, longitude, z).x;
    const data = Buffer.alloc(256 * 256 * 3);
    for (let py = 0; py < 256; py += 1) {
      for (let px = 0; px < 256; px += 1) {
        const value = 500 + 0.1 * (x * 256 + px + 0.5 - centre) + 32768;
        const index = (py * 256 + px) * 3;
        data[index] = Math.floor(value / 256);
        data[index + 1] = Math.floor(value) % 256;
        data[index + 2] = Math.round((value - Math.floor(value)) * 256) % 256;
      }
    }
    await route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: await sharp(data, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer() });
  });
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(([latitude, longitude]) => window.Viewer.setSurroundingsOptions({ kind: 'castle', style: 'realistic', terrain: 'real', latitude, longitude }), [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsTerrain.state)).toBe('real');
  const result = await page.evaluate(() => {
    const objects = window.Viewer.surroundingsObjects;
    const elevation = window.Viewer.surroundingsTerrain.elevation;
    return {
      zoom: elevation.zoom,
      mpp: elevation.metresPerPixel,
      centre: elevation.centre,
      hasField: typeof objects.layout.heightfield === 'function',
      atModel: objects.layout.heightfield(0, 0),
      east: objects.layout.heightfield(300, 0),
      west: objects.layout.heightfield(-300, 0),
      north: objects.layout.heightfield(0, -300),
      badge: document.querySelector('#viewerSurroundingsBadge').textContent,
    };
  });
  expect(result.zoom).toBe(elevationZoom(latitude, 1));
  expect(result.mpp).toBeCloseTo(metresPerPixel(latitude, result.zoom), 6);
  expect(result.centre).toBeCloseTo(500, 0);
  expect(result.hasField).toBe(true);
  expect(result.atModel).toBe(0);
  // 0.1 m a pixel eastwards; level north and south.
  expect(result.east).toBeCloseTo((0.1 * 300) / result.mpp, 0);
  expect(result.west).toBeCloseTo((-0.1 * 300) / result.mpp, 0);
  expect(Math.abs(result.north)).toBeLessThan(0.2);
  expect(result.badge).toContain("on the place's real terrain");
  expect(asked.length).toBeGreaterThan(0);
  expect(asked.every(([z]) => z === result.zoom)).toBe(true);
  // Exported with its place.
  expect(await page.evaluate(() => window.Viewer.getSurroundingsForExport())).toMatchObject({ terrain: 'real', latitude: 49.4197, longitude: 20.3198 });
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings rules: more kinds, the Mediterranean, after 1945, the slider\'s milestones', () => {
  // The kind from the texts, the most particular first.
  expect(findSurroundingsKind('opactwo cystersow w wachocku, kosciol')).toBe('monastery');
  expect(findSurroundingsKind('dwor szlachecki z parkiem')).toBe('manor');
  expect(findSurroundingsKind('folwark, spichlerz dworski')).toBe('manor-farm');
  expect(findSurroundingsKind('drewniana synagoga w miasteczku')).toBe('shtetl');
  expect(findSurroundingsKind('zuraw w porcie, nabrzeze')).toBe('port');
  expect(findSurroundingsKind('zamek krolewski')).toBe('castle');

  // The region by the place: the Mediterranean's stone and low roofs.
  expect(surroundingsRegion({ latitude: 43.77, longitude: 11.25 })).toBe('mediterranean');
  expect(surroundingsRegion({ latitude: 52.23, longitude: 21.01 })).toBe('central');
  expect(surroundingsRegion({ latitude: 35.68, longitude: 139.7 })).toBeNull();
  expect(surroundingsMasonry({ latitude: 43.77, longitude: 11.25 })).toBe('stone');
  const florence = suggestSurroundings({ normalizedText: 'chiesa, borgo, 1500', year: { year: 1500 }, location: { latitude: 43.77, longitude: 11.25 }, sizeClass: 'building' });
  expect(florence.value).toMatchObject({ enabled: true, kind: 'church', region: 'mediterranean', masonry: 'stone' });
  const south = layoutSurroundings({ kind: 'village', region: 'mediterranean', year: 1600, seed: 4 }, { radius: 20 });
  expect(south.blocks.some((block) => block.role === 'campanile')).toBe(true);
  expect(south.trees.some((tree) => tree.kind === 'olive')).toBe(true);
  expect(south.blocks.filter((block) => block.role === 'house' && block.roof === 'gable').every((block) => block.roofHeight < 1.5)).toBe(true);

  // Each kind its own: a precinct's wall and ponds, a manor's farm, a
  // farmyard, a market square, a port's shore and warehouses.
  const of = (kind, extra = {}) => layoutSurroundings({ kind, year: 1700, seed: 7, ...extra }, { radius: 15 });
  const monastery = of('monastery');
  expect(monastery.walls.length).toBeGreaterThan(10);
  expect(monastery.water.ponds.length).toBe(2);
  expect(monastery.blocks.filter((block) => block.role === 'cloister').length).toBeGreaterThanOrEqual(3);
  expect(monastery.blocks.some((block) => block.role === 'church')).toBe(false);
  expect(of('manor').blocks.filter((block) => block.role === 'barn').length).toBeGreaterThanOrEqual(2);
  expect(of('manor-farm').blocks.some((block) => block.role === 'manor')).toBe(true);
  const shtetl = of('shtetl');
  expect(shtetl.roads.filter((road) => road.market).length).toBe(4);
  expect(shtetl.blocks.filter((block) => block.market).length).toBeGreaterThan(10);
  expect(shtetl.walls).toEqual([]);
  const port = of('port');
  expect(port.water.coast).not.toBeNull();
  expect(port.water.river).toBeNull();
  expect(port.blocks.filter((block) => block.role === 'warehouse').length).toBeGreaterThan(2);
  expect(port.bridges.filter((bridge) => bridge.pier).length).toBeGreaterThanOrEqual(3);
  // Nothing built in the water; the sea flat.
  expect(port.blocks.every((block) => surroundingsWaterDistance(port, block.x, block.z) > 0)).toBe(true);
  const sea = port.water.coast;
  expect(surroundingsWaterLevel(port, sea.nx * (sea.offset + 150), sea.nz * (sea.offset + 150))).toBeCloseTo(-0.55, 1);
  // Not on the real terrain, whose shore the map gives.
  expect(of('port', { terrain: 'real', latitude: 54.35, longitude: 18.65 }).water.coast).toBeNull();

  // After 1945: an estate of slabs by a town, a collective farm by a
  // village, fields ploughed together.
  expect(surroundingsPeriod(1945)).toBe('postwar');
  expect(surroundingsPeriod(1989)).toBe('postwar');
  expect(surroundingsPeriod(1990)).toBe('contemporary');
  expect(surroundingsPeriod(2025)).toBe('contemporary');
  expect(surroundingsPeriod(2026)).toBeNull();
  // Just after the war: ruins, no estate yet.
  const ruined = layoutSurroundings({ kind: 'town', year: 1947, seed: 1 }, { radius: 20 });
  expect(ruined.blocks.filter((block) => block.ruin).length).toBeGreaterThan(5);
  expect(ruined.blocks.filter((block) => block.ruin).every((block) => block.roof === 'none')).toBe(true);
  expect(ruined.blocks.some((block) => block.role === 'estate')).toBe(false);
  const estate = layoutSurroundings({ kind: 'town', year: 1975, seed: 1 }, { radius: 20 });
  expect(estate.blocks.some((block) => block.ruin)).toBe(false);
  expect(estate.params.period).toBe('postwar');
  expect(estate.blocks.filter((block) => block.role === 'estate').length).toBeGreaterThan(4);
  expect(estate.blocks.filter((block) => block.role === 'estate').every((block) => block.roof === 'none' && block.w > 50)).toBe(true);
  const farm = layoutSurroundings({ kind: 'village', year: 1970, seed: 1 }, { radius: 20 });
  expect(farm.blocks.some((block) => block.role === 'farm')).toBe(true);
  const strips = layoutSurroundings({ kind: 'village', year: 1900, seed: 1 }, { radius: 20 });
  expect(farm.fields.length).toBeLessThan(strips.fields.length);

  // After 1990: detached houses round the edge, a shop and its car park.
  const today = layoutSurroundings({ kind: 'town', year: 2010, seed: 5 }, { radius: 18 });
  expect(today.params.period).toBe('contemporary');
  expect(today.blocks.filter((block) => block.role === 'villa').length).toBeGreaterThan(5);
  expect(today.blocks.filter((block) => block.role === 'estate').every((block) => block.renovated)).toBe(true);
  expect(today.blocks.some((block) => block.role === 'store')).toBe(true);
  expect(today.fields.some((field) => field.parking)).toBe(true);

  // Further regions by the place, each its own.
  expect([[51.5, -0.12], [59.33, 18.07], [50.45, 30.52], [53.9, 27.56]].map(([latitude, longitude]) => surroundingsRegion({ latitude, longitude }))).toEqual(['british', 'nordic', 'eastern', 'central']);
  const british = suggestSurroundings({ normalizedText: 'parish church, 1650', year: { year: 1650 }, location: { latitude: 51.75, longitude: -1.25 }, sizeClass: 'building' });
  expect(british.value).toMatchObject({ region: 'british', masonry: 'stone' });
  expect(british.reasons).toContainEqual({ key: 'surroundingsBritish' });
  const towers = (region) => layoutSurroundings({ kind: 'village', region, year: 1650, seed: 2 }, { radius: 18 }).blocks.filter((block) => block.role === 'church' && block.w < 8);
  expect(towers('british').every((tower) => tower.roof === 'none')).toBe(true);
  expect(towers('eastern').every((tower) => tower.roof === 'onion')).toBe(true);
  const terraces = layoutSurroundings({ kind: 'town', region: 'british', year: 1880, seed: 1 }, { radius: 20 }).blocks.filter((block) => block.role === 'house');
  expect(terraces.filter((block) => block.w < 7).length).toBeGreaterThan(terraces.length * 0.6);
  const hedged = layoutSurroundings({ kind: 'village', region: 'british', year: 1800, seed: 1 }, { radius: 18 });
  expect(Math.min(...hedged.fields.map((field) => field.d))).toBeGreaterThan(15);
  const conifers = (region) => { const trees = layoutSurroundings({ kind: 'village', region, year: 1600, seed: 1 }, { radius: 18 }).trees; return trees.filter((tree) => tree.kind === 'conifer').length / trees.length; };
  expect(conifers('nordic')).toBeGreaterThan(0.6);
  expect(conifers('british')).toBeLessThan(0.2);
  expect(normalizeSurroundings({ region: 'eastern', period: 'contemporary' })).toMatchObject({ region: 'eastern', period: 'contemporary' });

  // The slider: each period the same width; the milestones where they start.
  expect([900, 1250, 1550, 1800, 1914, 1945, 1990, 2025].map(surroundingsYearToSlider)).toEqual([0, 100, 200, 300, 400, 500, 600, 700]);
  expect(surroundingsSliderToYear(260)).toBe(1700);
  expect(surroundingsSliderToYear(450)).toBe(1930);
  [1100, 1400, 1666, 1871, 1939, 1968].forEach((year) => expect(surroundingsSliderToYear(surroundingsYearToSlider(year))).toBeCloseTo(year, -1));
  expect(normalizeSurroundings({ kind: 'port', region: 'mediterranean', period: 'postwar' })).toMatchObject({ kind: 'port', region: 'mediterranean', period: 'postwar' });
  expect(normalizeSurroundings({ region: 'arctic' }).region).toBe('central');
});

test('generated surroundings on a phone: drawn light, simpler far out', async ({ page }) => {
  await openViewer(page, '/examples/WolpaSynagogue.glb', 'ui=menus');
  await waitForModel(page);
  // Chosen by itself: a desktop full, a phone (a coarse pointer) light, the
  // "fast" render quality light.
  const chosen = await page.evaluate(() => {
    const viewer = window.Viewer;
    const info = viewer.getDeviceInfo;
    const desktop = viewer.getSurroundingsDetail();
    viewer.getDeviceInfo = () => ({ ...info(), coarse: true, memory: 8, cores: 8, gpu: '' });
    const phone = viewer.getSurroundingsDetail();
    viewer.getDeviceInfo = info;
    viewer.setRenderQuality('fast', { silent: true });
    const fast = viewer.getSurroundingsDetail();
    viewer.setRenderQuality('high', { silent: true });
    return { desktop, phone, fast };
  });
  expect(chosen).toEqual({ desktop: 'full', phone: 'light', fast: 'light' });
  const original = await page.evaluate(() => { window.__detail = window.Viewer.getSurroundingsDetail; return true; });
  expect(original).toBe(true);
  const build = (detail) => page.evaluate((detail) => {
    window.Viewer.getSurroundingsDetail = () => detail;
    window.Viewer.setSurroundingsOptions({ kind: 'town', year: 1700, seed: 3, style: 'realistic' });
    const objects = window.Viewer.surroundingsObjects;
    return { triangles: objects.triangles, detail: objects.detail, smoke: objects.group.getObjectByName('surroundings-smoke') != null, reach: window.Viewer.getSurroundingsShadowReachMetres() };
  }, detail);
  const full = await build('full');
  const light = await build('light');
  expect(full).toMatchObject({ detail: 'full', smoke: true, reach: 80 });
  expect(light).toMatchObject({ detail: 'light', smoke: false, reach: 0 });
  expect(light.triangles).toBeLessThan(full.triangles * 0.7);
  // Far out simpler on every device: well under the 160,000 triangles of before.
  expect(full.triangles).toBeLessThan(110_000);
  await page.evaluate(() => { window.Viewer.getSurroundingsDetail = window.__detail; });
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings, the ground as it was: a later quarry filled for the years before it', async ({ page }) => {
  test.setTimeout(60_000);
  // A slope with a pit 20 m deep east of the place (the quarry), in the
  // elevation tiles; the map says the quarry was opened in 1960.
  const [latitude, longitude] = [49.4197, 20.3198];
  let zoom = null;
  const pit = { from: 50, to: 90, half: 25 };
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**', async (route) => {
    const [z, x, y] = route.request().url().match(/terrarium\/(\d+)\/(\d+)\/(\d+)\.png/).slice(1).map(Number);
    zoom = z;
    const centre = worldPixel(latitude, longitude, z);
    const data = Buffer.alloc(256 * 256 * 3);
    for (let py = 0; py < 256; py += 1) {
      for (let px = 0; px < 256; px += 1) {
        const dx = x * 256 + px + 0.5 - centre.x;
        const dy = y * 256 + py + 0.5 - centre.y;
        const inPit = dx > pit.from && dx < pit.to && Math.abs(dy) < pit.half;
        const value = 500 + 0.1 * dx - (inPit ? 20 : 0) + 32768;
        const index = (py * 256 + px) * 3;
        data[index] = Math.floor(value / 256);
        data[index + 1] = Math.floor(value) % 256;
        data[index + 2] = Math.round((value - Math.floor(value)) * 256) % 256;
      }
    }
    await route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: await sharp(data, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer() });
  });
  const asked = [];
  await page.route('https://overpass-api.de/**', (route) => {
    const query = decodeURIComponent(route.request().postData() || '');
    asked.push(query);
    if (!query.includes('quarry') || zoom == null) return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [] }) });
    // The pit's outline in degrees (Web Mercator back).
    const centre = worldPixel(latitude, longitude, zoom);
    const size = 256 * 2 ** zoom;
    const at = (dx, dy) => {
      const lon = ((centre.x + dx) / size) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (centre.y + dy)) / size))) * 180) / Math.PI;
      return { lat, lon };
    };
    const ring = [at(pit.from, -pit.half), at(pit.to, -pit.half), at(pit.to, pit.half), at(pit.from, pit.half), at(pit.from, -pit.half)];
    return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [{ type: 'way', id: 7, tags: { landuse: 'quarry', start_date: '1960' }, geometry: ring }] }) });
  });
  await page.route('https://overpass-api.openhistoricalmap.org/**', (route) => route.abort());
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(([latitude, longitude]) => window.Viewer.setSurroundingsOptions({ kind: 'village', terrain: 'real', latitude, longitude, year: 1990 }), [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsTerrain.state), { timeout: 30_000 }).toBe('real');
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsTerrain.past.state), { timeout: 15_000 }).toBe('real');
  const sample = () => page.evaluate(() => {
    const { layout } = window.Viewer.surroundingsObjects;
    const mpp = window.Viewer.surroundingsTerrain.elevation.metresPerPixel;
    // The pit's middle, and the slope beside it (the same distance east).
    return { pit: layout.heightfield(70 * mpp, 0), beside: layout.heightfield(70 * mpp, 40 * mpp), badge: document.querySelector('#viewerSurroundingsBadge').textContent };
  });
  // 1990: the quarry is there.
  const today = await sample();
  expect(today.beside - today.pit).toBeGreaterThan(15);
  expect(today.badge).not.toContain('the ground as it was');
  // 1900: filled to the slope round it, and said so.
  await page.evaluate(() => window.Viewer.setSurroundingsOptions({ year: 1900 }));
  const before = await sample();
  expect(Math.abs(before.beside - before.pit)).toBeLessThan(3);
  expect(before.badge).toContain('the ground as it was: later quarries taken away');
  expect(asked.some((query) => query.includes('quarry'))).toBe(true);
  // Switched off: today's ground whatever the year; exported so.
  await page.evaluate(() => window.Viewer.setSurroundingsOptions({ pastTerrain: false }));
  const off = await sample();
  expect(off.beside - off.pit).toBeGreaterThan(15);
  expect(await page.evaluate(() => window.Viewer.getSurroundingsForExport().pastTerrain)).toBe(false);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings, life: people, carts and boats moving, fewer in winter, off on request', async ({ page }) => {
  await openViewer(page, '/examples/WolpaSynagogue.glb', 'ui=menus');
  await waitForModel(page);
  const life = (options) => page.evaluate((options) => {
    window.Viewer.setSurroundingsOptions({ style: 'realistic', seed: 3, ...options });
    const group = window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-life');
    if (!group) return null;
    const counts = {};
    group.children.forEach((mesh) => { counts[mesh.name.replace('surroundings-life-', '')] = mesh.count; });
    return counts;
  }, options);
  // A port in summer: people, carts, boats with sails.
  const port = await life({ kind: 'port', year: 1700, season: 'summer' });
  expect(port.person).toBeGreaterThan(20);
  expect(port.cart).toBeGreaterThan(0);
  expect((port.sail || 0) + (port.rowing || 0)).toBeGreaterThan(2);
  // They move: a person somewhere else a few seconds on.
  const where = () => page.evaluate(() => {
    const mesh = window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-life-person');
    const matrix = new window.Viewer.camera.matrix.constructor();
    mesh.getMatrixAt(0, matrix);
    return [matrix.elements[12], matrix.elements[14]];
  });
  const first = await where();
  await page.evaluate(() => window.Viewer.surroundingsObjects.life.update(3));
  const later = await where();
  expect(Math.hypot(later[0] - first[0], later[1] - first[1])).toBeGreaterThan(1);
  // Cars after 1945; no boats on the ice, fewer people in winter.
  const town = await life({ kind: 'town', year: 1975, season: 'summer' });
  expect(town.car).toBeGreaterThan(3);
  const winter = await life({ kind: 'port', year: 1700, season: 'winter' });
  expect(winter.sail || 0).toBe(0);
  expect(winter.rowing || 0).toBe(0);
  expect(winter.person).toBeLessThan(port.person);
  // Off: none; exported so.
  expect(await life({ life: false })).toBeNull();
  expect(await page.evaluate(() => window.Viewer.getSurroundingsForExport().life)).toBe(false);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('more of the scene on a phone: the page header as one button, a window folded to its main setting, the menus hidden behind a handle', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    try { localStorage.removeItem('explora4d-scene-only'); } catch {}
  });
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const toolbar = page.locator('#viewerEditorToolbar.viewer-menus');
  await expect(toolbar).toHaveAttribute('data-mode', 'bar');

  // The header: one round button in the corner, the viewer from the top of
  // the screen; a tap drops the row down, Escape folds it.
  const toggle = page.locator('#viewer-page-header-toggle');
  const select = page.locator('#example-model-select');
  await expect(toggle).toBeVisible();
  await expect(select).toBeHidden();
  const viewerTop = await page.locator('#DFG_3DViewer').evaluate((el) => el.getBoundingClientRect().top);
  expect(viewerTop).toBeLessThan(4);
  await toggle.tap();
  await expect(select).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(select).toBeHidden();

  // The surroundings' window: folded, only the year stays.
  await page.evaluate(() => {
    window.Viewer.setSurroundingsOptions({});
    window.Viewer.toggleSurroundingsPanel(true);
  });
  const panel = page.locator('#viewerSurroundingsPanel');
  await expect(panel).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.Viewer.surroundingsObjects))).toBe(true);
  // Open, the window says what the badge would: no badge.
  await expect(page.locator('#viewerSurroundingsBadge')).toBeHidden();
  const full = (await panel.boundingBox()).height;
  await panel.locator('.tool-panel-chrome_fold').tap();
  await expect(panel).toHaveClass(/is-peek/);
  await expect(panel.locator('input[name="year"]')).toBeVisible();
  await expect(panel.locator('select[name="kind"]')).toBeHidden();
  expect((await panel.boundingBox()).height).toBeLessThan(full / 2);
  // The window clear of the header's button.
  const [panelBox, toggleBox] = await Promise.all([panel.boundingBox(), toggle.boundingBox()]);
  expect(panelBox.x).toBeGreaterThanOrEqual(toggleBox.x + toggleBox.width);
  await panel.locator('.tool-panel-chrome_fold').tap();
  await expect(panel.locator('select[name="kind"]')).toBeVisible();

  // Minimized, the badge comes back: one line.
  await panel.locator('.tool-panel-chrome_minimize').tap();
  const badge = page.locator('#viewerSurroundingsBadge');
  await expect(badge).toBeVisible();
  expect((await badge.boundingBox()).height).toBeLessThan(48);

  // The scene alone: the handle on the tabs hides the menus and the
  // header's button, a tab on the bottom edge brings them back.
  const handle = toolbar.locator('.viewer-menus_handle');
  const tabs = toolbar.locator('.viewer-menus_tabs');
  await handle.tap();
  await expect(toolbar).toHaveClass(/viewer-menus--scene-only/);
  await expect.poll(async () => (await tabs.boundingBox())?.y ?? 844).toBeGreaterThanOrEqual(844 - 2);
  await expect(toggle).toBeHidden();
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  expect(handleBox.y + handleBox.height).toBeGreaterThan(844 - 4);
  expect(handleBox.height).toBeLessThan(40);
  // Kept on this device.
  expect(await page.evaluate(() => localStorage.getItem('explora4d-scene-only'))).toBe('1');
  await handle.tap();
  await expect(toolbar).not.toHaveClass(/viewer-menus--scene-only/);
  await expect(tabs).toBeVisible();
  await expect(toggle).toBeVisible();
  await context.close();
});

test('generated surroundings window: on and off, the year on a slider with its period, the place and the look', async ({ page }) => {
  test.setTimeout(60_000);
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await toolbar.locator('.viewer-menus_panel button[data-tool="surroundings"]').click();
  const panel = page.locator('#viewerSurroundingsPanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[name="enabled"]')).not.toBeChecked();

  await panel.locator('input[name="enabled"]').check();
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.enabled && Boolean(window.Viewer.surroundingsObjects))).toBe(true);
  await expect(page.locator('#viewerSurroundingsBadge')).toBeVisible();
  // The badge kept clear of the window on the right.
  const clear = async () => {
    const badge = await page.locator('#viewerSurroundingsBadge').boundingBox();
    const box = await panel.boundingBox();
    return badge.x + badge.width <= box.x || badge.y >= box.y + box.height;
  };
  await expect.poll(clear).toBe(true);

  // Back to 1700: the early modern period, drawn once the slider rests.
  // Each period is the same stretch of the slider: 1700 is 3/5 into the
  // third (1550-1800).
  await panel.locator('input[name="year"]').fill('260');
  await expect(panel.locator('.viewer-surroundings-panel_year')).toHaveText('1700');
  await expect(panel.locator('.viewer-surroundings-panel_period')).toHaveText('early modern period');
  await expect.poll(() => page.evaluate(() => [window.Viewer.surroundings.year, window.Viewer.surroundings.period])).toEqual([1700, 'early-modern']);
  await expect(panel.locator('.viewer-scene_status')).toContainText('early modern period');

  // Play: the years go by on their own, until paused.
  const play = panel.locator('.viewer-surroundings-panel_play');
  await panel.locator('input[name="year"]').fill('200');
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.year)).toBe(1550);
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.year), { timeout: 15_000 }).toBeGreaterThan(1580);
  await play.click({ force: true });
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const paused = await page.evaluate(() => window.Viewer.surroundings.year);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.Viewer.surroundings.year)).toBe(paused);

  // A milestone: 1945, the housing estates.
  const milestones = panel.locator('.viewer-surroundings-panel_milestone');
  await expect(milestones).toHaveText(['1250', '1550', '1800', '1914', '1945', '1990']);
  await expect(milestones.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(milestones.nth(4)).toHaveAttribute('title', /housing estates/);
  await milestones.nth(4).click();
  await expect.poll(() => page.evaluate(() => [window.Viewer.surroundings.year, window.Viewer.surroundings.period])).toEqual([1945, 'postwar']);
  await expect(panel.locator('.viewer-surroundings-panel_period')).toHaveText('after 1945');
  await expect(milestones.nth(4)).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('input[name="year"]')).toHaveValue('500');

  await panel.locator('select[name="region"]').selectOption('mediterranean');
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.region)).toBe('mediterranean');
  await expect.poll(() => page.evaluate(() => window.Viewer.getSurroundingsForExport().region)).toBe('mediterranean');
  await panel.locator('select[name="kind"]').selectOption('town');
  await panel.locator('select[name="season"]').selectOption('winter');
  await expect.poll(() => page.evaluate(() => [window.Viewer.surroundings.kind, window.Viewer.surroundings.season])).toEqual(['town', 'winter']);
  // Set elsewhere (the badge): the window follows.
  await page.locator('#viewerSurroundingsBadge button[data-action="style"]').click();
  await expect(panel.locator('select[name="style"]')).toHaveValue('realistic');
  // No place: no real terrain to ask for.
  await expect(panel.locator('input[name="terrain"]')).toBeDisabled();

  // Zooming out: far enough to see the whole setting.
  const reach = await page.evaluate(() => ({ max: window.Viewer.controls.maxDistance, extent: window.Viewer.surroundingsObjects.layout.extent / window.Viewer.surroundingsObjects.site.meters }));
  expect(reach.max).toBeGreaterThanOrEqual(reach.extent * 1.5);


  await panel.locator('input[name="enabled"]').uncheck();
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.enabled)).toBe(false);
  await expect(page.locator('#viewerSurroundingsBadge')).toHaveCount(0);
  // The camera's limit put back.
  expect(await page.evaluate(() => window.Viewer.controls.maxDistance)).toBeLessThan(reach.max);
  // From a manifest, the window open with them.
  await panel.locator('.viewer-scene_header button', { hasText: '×' }).click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.apply3IFManifestSurroundings({ kind: 'shtetl', year: 1780, open: true }))).toBe(true);
  await expect(panel).toBeVisible();
  await expect(panel.locator('select[name="kind"]')).toHaveValue('shtetl');
  expect(await page.evaluate(() => window.Viewer.getSurroundingsForExport().open)).toBe(true);
  await page.evaluate(() => window.Viewer.setSurroundings(false));
  await panel.locator('.viewer-scene_header button', { hasText: '×' }).click();
  await expect(panel).toHaveCount(0);
});

test('generated surroundings: the real water from the map, and the timeline followed', async ({ page }) => {
  // The map's water for the place (an Overpass answer served here): a lake
  // east of the model and the sea to the south.
  const [latitude, longitude] = [54, 18.6];
  const at = (east, north) => ({ lat: latitude + north / 110540, lon: longitude + east / (111320 * Math.cos((latitude * Math.PI) / 180)) });
  const queries = [];
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    queries.push(decodeURIComponent(route.request().postData().replace(/^data=/, '')));
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ elements: [
        { type: 'way', tags: { natural: 'water' }, geometry: [[40, -30], [120, -30], [120, 30], [40, 30], [40, -30]].map(([east, north]) => at(east, north)) },
        { type: 'way', tags: { natural: 'coastline' }, geometry: [at(-2000, -300), at(2000, -300)] },
      ] }),
    });
  });
  await page.route('**/elevation-tiles-prod/**', (route) => route.abort());
  // No historical water there: today's.
  await page.route('https://overpass-api.openhistoricalmap.org/**', (route) => route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"elements":[]}' }));
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(([latitude, longitude]) => window.Viewer.setSurroundingsOptions({ kind: 'village', style: 'realistic', terrain: 'real', latitude, longitude, seed: 4 }), [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsMap.state)).toBe('real');
  await expect.poll(() => page.evaluate(() => Boolean(window.Viewer.surroundingsObjects?.layout.water.map))).toBe(true);
  const mapped = await page.evaluate(() => {
    const objects = window.Viewer.surroundingsObjects;
    const layout = objects.layout;
    const map = layout.water.map;
    return {
      lake: map.distance(80, 0),
      sea: map.distance(0, 600),
      wet: [...layout.blocks, ...layout.trees].filter((entry) => map.distance(entry.x, entry.z) < 0).length,
      water: objects.group.getObjectByName('surroundings-water')?.geometry.getAttribute('position').count || 0,
      badge: document.querySelector('#viewerSurroundingsBadge').textContent,
    };
  });
  expect(queries.length).toBe(1);
  expect(queries[0]).toContain('"natural"="coastline"');
  expect(mapped.lake).toBeLessThan(0);
  expect(mapped.sea).toBeLessThan(0);
  expect(mapped.wet).toBe(0);
  expect(mapped.water).toBeGreaterThan(100);
  expect(mapped.badge).toContain('© OpenStreetMap contributors');

  // The timeline (stood in for here): the surroundings follow its year.
  await page.evaluate(() => {
    window.__year = 1100;
    window.Viewer.hasTimeline = () => true;
    window.Viewer.getTimelineYear = () => window.__year;
    window.Viewer.setSurroundingsOptions({ kind: 'town', terrain: 'generated', style: 'schematic', followTimeline: true, seed: 2 });
  });
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.period)).toBe('early-medieval');
  const early = await page.evaluate(() => ({
    walls: window.Viewer.surroundingsObjects.layout.walls.map((wall) => wall.kind),
    houses: window.Viewer.surroundingsObjects.layout.blocks.filter((block) => block.role === 'house').length,
    growth: window.Viewer.surroundings.growth,
  }));
  expect(early.walls.every((kind) => kind === 'palisade')).toBe(true);
  await expect(page.locator('#viewerSurroundingsBadge')).toContainText('1100, following the timeline');
  await page.evaluate(() => { window.__year = 1520; });
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundings.period), { timeout: 10_000 }).toBe('medieval');
  const late = await page.evaluate(() => ({
    walls: window.Viewer.surroundingsObjects.layout.walls.map((wall) => wall.kind),
    houses: window.Viewer.surroundingsObjects.layout.blocks.filter((block) => block.role === 'house').length,
    growth: window.Viewer.surroundings.growth,
    exported: window.Viewer.getSurroundingsForExport(),
  }));
  expect(late.walls.length).toBeGreaterThan(0);
  expect(late.walls.every((kind) => kind === 'masonry')).toBe(true);
  expect(late.growth).toBeGreaterThan(early.growth);
  expect(late.exported).toMatchObject({ followTimeline: true, period: 'medieval', year: 1520 });
  // A year the surroundings do not cover: hidden, and said so.
  await page.evaluate(() => { window.__year = 2040; });
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsObjects.group.visible)).toBe(false);
  await expect(page.locator('#viewerSurroundingsBadge')).toContainText('none for 2040');
  await page.evaluate(() => { window.__year = 1400; });
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsObjects.group.visible)).toBe(true);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings: historical water by the year, the servers in turn, and the sun shadows on the nearest houses', async ({ page }) => {
  const [latitude, longitude] = [54, 18.6];
  const at = (east, north) => ({ lat: latitude + north / 110540, lon: longitude + east / (111320 * Math.cos((latitude * Math.PI) / 180)) });
  // Your own Overpass is not running (502); the public one answers with
  // today's water; OpenHistoricalMap has a river that ran until 1600.
  const asked = [];
  await page.route('**/viewer-settings.json', async (route) => {
    const settings = await (await route.fetch()).json();
    settings.viewer.surroundings = { mapUrl: ['/own-overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'] };
    await route.fulfill({ json: settings });
  });
  await page.route('**/own-overpass/**', (route) => { asked.push('own'); return route.fulfill({ status: 502, body: 'down' }); });
  await page.route('https://overpass-api.de/api/interpreter', (route) => {
    asked.push('public');
    return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [{ type: 'way', id: 9, tags: { waterway: 'river', width: '20' }, geometry: [at(-900, -200), at(900, -200)] }] }) });
  });
  let historical = true;
  await page.route('https://overpass-api.openhistoricalmap.org/api/interpreter', (route) => {
    asked.push('historical');
    const elements = historical ? [{ type: 'way', id: 7, tags: { waterway: 'river', width: '25', start_date: '1100', end_date: '1600' }, geometry: [at(-900, 200), at(900, 200)] }] : [];
    return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements }) });
  });
  await page.route('**/elevation-tiles-prod/**', (route) => route.abort());
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);

  // 1400: the historical river, north of the model.
  await page.evaluate(([latitude, longitude]) => window.Viewer.setSurroundingsOptions({ kind: 'village', terrain: 'real', latitude, longitude, year: 1400, seed: 4 }), [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsMap.source)).toBe('historical');
  await expect.poll(() => page.evaluate(() => Boolean(window.Viewer.surroundingsObjects?.layout.water.map))).toBe(true);
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.layout.water.map.distance(0, -200))).toBeLessThan(0);
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.layout.water.map.distance(0, 200))).toBeGreaterThan(50);
  await expect(page.locator('#viewerSurroundingsBadge')).toContainText('the water of 1400 (© OpenHistoricalMap contributors)');
  // Followed to 1700: the river had gone; laid out again without it.
  await page.evaluate(() => {
    window.__year = 1700;
    window.Viewer.hasTimeline = () => true;
    window.Viewer.getTimelineYear = () => window.__year;
    window.Viewer.surroundings.followTimeline = true;
  });
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsObjects.layout.water.map), { timeout: 10_000 }).toBeNull();
  expect(await page.evaluate(() => window.Viewer.surroundings.period)).toBe('early-modern');

  // Another place, no historical water: today's, from the second server.
  historical = false;
  await page.evaluate(([latitude, longitude]) => {
    window.Viewer.hasTimeline = () => false;
    window.Viewer.setSurroundingsOptions({ followTimeline: false, latitude: latitude + 0.01, longitude, year: 1400 });
  }, [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsMap.source)).toBe('today');
  expect(asked).toEqual(expect.arrayContaining(['historical', 'own', 'public']));
  expect(asked.indexOf('own')).toBeLessThan(asked.indexOf('public'));
  await expect(page.locator('#viewerSurroundingsBadge')).toContainText("today's rivers and lakes (© OpenStreetMap contributors)");

  // The sun on the realistic look: its shadow map reaches the nearest
  // houses, which cast and take shadows; off with the sun.
  const sunlit = await page.evaluate(() => {
    window.Viewer.setSurroundingsOptions({ style: 'realistic' });
    window.Viewer.setSunOptions({ latitude: 52, longitude: 20, month: 7, day: 15, minutes: 960 });
    window.Viewer.setSunStudy(true);
    window.Viewer.updateSunStudy(0, { force: true });
    window.Viewer.updateSurroundings(0, { force: true });
    const near = window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-near');
    const far = window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-built');
    return { reach: window.Viewer.getSunShadowReach(), size: window.Viewer.sunObjects.light.shadow.mapSize.x, cast: near.castShadow, take: near.receiveShadow, farCast: far.castShadow, frustum: window.Viewer.sunObjects.light.shadow.camera.right };
  });
  expect(sunlit.reach).toBeGreaterThan(80);
  expect(sunlit.size).toBe(4096);
  expect([sunlit.cast, sunlit.take, sunlit.farCast]).toEqual([true, true, false]);
  expect(sunlit.frustum).toBeCloseTo(sunlit.reach, 3);
  const shaded = await page.evaluate(() => {
    window.Viewer.setSunStudy(false);
    window.Viewer.updateSurroundings(0, { force: true });
    return [window.Viewer.getSunShadowReach(), window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-near').castShadow];
  });
  expect(shaded).toEqual([0, false]);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings on an old map: its layout file, and its tiles draped over the ground', async ({ page }) => {
  const [latitude, longitude] = [54, 18.6];
  await page.route('**/old-map.geojson', (route) => route.fulfill({ contentType: 'application/geo+json', body: JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { kind: 'road', width: 6 }, geometry: { type: 'LineString', coordinates: [[18.597, 54.0012], [18.603, 54.0012]] } },
    { type: 'Feature', properties: { kind: 'building', height: 9 }, geometry: { type: 'Polygon', coordinates: [[[18.6015, 54.0014], [18.6017, 54.0014], [18.6017, 54.0015], [18.6015, 54.0015], [18.6015, 54.0014]]] } },
    { type: 'Feature', properties: { kind: 'building', height: 7, end_date: '1500' }, geometry: { type: 'Polygon', coordinates: [[[18.5985, 54.0014], [18.5989, 54.0014], [18.5989, 54.0016], [18.5985, 54.0016], [18.5985, 54.0014]]] } },
  ] }) }));
  // Tiles of an old map: sepia, served here.
  const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 196, g: 176, b: 132 } } }).png().toBuffer();
  const tiles = [];
  await page.route('https://tiles.example.org/**', (route) => { tiles.push(route.request().url()); return route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: tile }); });
  await page.route('https://overpass-api.openhistoricalmap.org/**', (route) => route.abort());
  await page.route('https://overpass-api.de/**', (route) => route.abort());
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(([latitude, longitude]) => window.Viewer.apply3IFManifestSurroundings({
    kind: 'town', latitude, longitude, year: 1400, seed: 5,
    layoutUrl: '/old-map.geojson',
    mapOverlay: { url: 'https://tiles.example.org/{z}/{x}/{y}.png', opacity: 0.7, attribution: 'Test map, 1830' },
  }), [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsObjects?.layout.blocks.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => Boolean(window.Viewer.surroundingsObjects?.group.getObjectByName('surroundings-oldmap')))).toBe(true);
  const draped = await page.evaluate(() => {
    const mesh = window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-oldmap');
    const uv = mesh.geometry.getAttribute('uv');
    let inside = 0;
    for (let index = 0; index < uv.count; index += 1) if (uv.getX(index) > 0 && uv.getX(index) < 1 && uv.getY(index) > 0 && uv.getY(index) < 1) inside += 1;
    return { opacity: mesh.material.opacity, map: Boolean(mesh.material.map?.image), inside, count: uv.count, roads: window.Viewer.surroundingsObjects.layout.roads.map((road) => road.width), exported: window.Viewer.getSurroundingsForExport() };
  });
  expect(draped.opacity).toBeCloseTo(0.7, 5);
  expect(draped.map).toBe(true);
  expect(draped.inside).toBeGreaterThan(draped.count * 0.5);
  // The old map's road only (cut at a river's bank, if one is generated).
  expect(draped.roads.length).toBeGreaterThanOrEqual(1);
  expect(draped.roads.every((width) => width === 6)).toBe(true);
  expect(tiles.length).toBeGreaterThan(3);
  expect(tiles.every((url) => /\/\d+\/\d+\/\d+\.png$/.test(url))).toBe(true);
  expect(draped.exported).toMatchObject({ mapOverlay: { url: 'https://tiles.example.org/{z}/{x}/{y}.png', opacity: 0.7, attribution: 'Test map, 1830' } });
  expect(draped.exported.layoutUrl).toMatch(/old-map\.geojson$/);
  const badge = page.locator('#viewerSurroundingsBadge');
  await expect(badge).toContainText('roads and buildings of 1400 from the old map');
  await expect(badge).toContainText('on an old map (Test map, 1830)');
  // 1600: the building gone by 1500 is gone.
  await page.evaluate(() => window.Viewer.setSurroundingsOptions({ year: 1600 }));
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsObjects.layout.blocks.length)).toBe(1);
  // A tile URL without its placeholders is refused.
  expect(validateAIM3DManifest({ AIM3DViewer: { surroundings: { kind: 'town', mapOverlay: { url: 'https://tiles.example.org/map.png', opacity: 3 } } } }).errors.map((error) => error.path).filter((path) => path.includes('mapOverlay')))
    .toEqual(['$.AIM3DViewer.surroundings.mapOverlay.url', '$.AIM3DViewer.surroundings.mapOverlay.opacity']);
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('generated surroundings: an old map read by AI, saved as GeoJSON; OpenHistoricalMap roads and buildings', async ({ page }) => {
  test.setTimeout(60_000);
  const [latitude, longitude] = [54, 18.6];
  const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 196, g: 176, b: 132 } } }).png().toBuffer();
  await page.route('https://tiles.example.org/**', (route) => route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: tile }));
  await page.route('**/api/ai/config', (route) => route.fulfill({ json: { enabled: true, features: ['old-map'], model: 'claude-opus-5-5' } }));
  // The worker reads in the background: an id at once, the answer later.
  const sent = [];
  await page.route('**/api/ai/old-map', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { id: 'a'.repeat(32), state: 'running' } });
  });
  let polls = 0;
  await page.route('**/api/ai/old-map/*', (route) => {
    polls += 1;
    const { width: w, height: h } = sent[0];
    const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
    return route.fulfill({ json: polls < 2 ? { state: 'running' } : { state: 'done', answer: {
      readable: true,
      notes: 'A test map.',
      roads: [{ points: [{ x: w * 0.1, y: h * 0.45 }, { x: w * 0.9, y: h * 0.45 }], width_px: 3 }],
      buildings: [{ points: square(w * 0.62, h * 0.38, 8), kind: 'church' }],
      fields: [],
      water: [{ kind: 'lake', points: square(w * 0.25, h * 0.7, 30), width_px: 0 }],
      walls: [],
      model: 'claude-opus-5-5',
    } } });
  });
  await page.route('https://overpass-api.openhistoricalmap.org/**', (route) => route.abort());
  await page.route('https://overpass-api.de/**', (route) => route.abort());
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(([latitude, longitude]) => window.Viewer.setSurroundingsOptions({
    kind: 'town', latitude, longitude, year: 1830, seed: 5,
    mapOverlay: { url: 'https://tiles.example.org/{z}/{x}/{y}.png', attribution: 'Test map' },
  }), [latitude, longitude]);
  const badge = page.locator('#viewerSurroundingsBadge');
  const read = badge.locator('button[data-action="read-map"]');
  await expect(read).toBeVisible();
  await expect(badge.locator('button[data-action="save-map"]')).toBeHidden();
  await read.click();
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsOldMap.aiState), { timeout: 20_000 }).toBe('done');
  // At most 2576 pixels on the long side, a JPEG, with its scale and year.
  expect(Math.max(sent[0].width, sent[0].height)).toBeLessThanOrEqual(2576);
  expect(sent[0].mediaType).toBe('image/jpeg');
  expect(sent[0].metresPerPixel).toBeGreaterThan(0);
  expect(sent[0].year).toBe(1830);
  const shaped = await page.evaluate(() => {
    const layout = window.Viewer.surroundingsObjects.layout;
    return {
      roles: layout.blocks.map((block) => block.role),
      roads: layout.roads.length,
      water: layout.water.map?.count || 0,
      river: Boolean(layout.water.river),
      geojson: window.Viewer.surroundingsOldMap.aiGeojson,
    };
  });
  // The read church only; the read road; the read lake, no generated river.
  expect(shaped.roles).toEqual(['church']);
  expect(shaped.roads).toBeGreaterThanOrEqual(1);
  expect(shaped.water).toBe(1);
  expect(shaped.river).toBe(false);
  // In degrees, round the place; the road level (one latitude).
  const road = shaped.geojson.features.find((feature) => feature.properties.kind === 'road');
  expect(road.properties.source).toBe('ai');
  expect(road.geometry.coordinates[0][1]).toBeCloseTo(road.geometry.coordinates[1][1], 6);
  road.geometry.coordinates.forEach(([lon, lat]) => {
    expect(Math.abs(lon - longitude)).toBeLessThan(0.05);
    expect(Math.abs(lat - latitude)).toBeLessThan(0.05);
  });
  await expect(badge).toContainText('roads and buildings read from the old map by AI - check them');
  // Saved as GeoJSON.
  const [download] = await Promise.all([page.waitForEvent('download'), badge.locator('button[data-action="save-map"]').click()]);
  expect(download.suggestedFilename()).toBe('old-map-read-by-ai.geojson');
  const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(saved.features.map((feature) => feature.properties.kind).sort()).toEqual(['building', 'lake', 'road']);
  // Not stored in the manifest by itself.
  expect(await page.evaluate(() => window.Viewer.getSurroundingsForExport().layoutUrl)).toBeUndefined();

  // Corrected in the viewer: the reading over the ground, its points
  // dragged, a feature removed, one drawn, undone.
  await page.evaluate(() => window.Viewer.toggleSurroundingsPanel(true));
  const panel = page.locator('#viewerSurroundingsPanel');
  const reading = panel.locator('.viewer-surroundings-panel_reading');
  await expect(reading).toBeVisible();
  await expect(reading).toContainText('3 features read; 0 changed by hand');
  // From above, the whole reading in view.
  await page.evaluate(() => {
    const { group } = window.Viewer.surroundingsObjects;
    const centre = group.localToWorld(new window.Viewer.camera.position.constructor(0, 0, 0));
    const up = group.localToWorld(new window.Viewer.camera.position.constructor(0, 900, 60));
    window.Viewer.camera.position.copy(up);
    window.Viewer.controls.target.copy(centre);
    window.Viewer.controls.update();
  });
  await reading.locator('button[data-action="correct"]').click();
  await expect(reading.locator('button[data-action="correct"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-edit') != null)).toBe(true);
  // The church's first corner dragged 20 m east.
  const corner = await page.evaluate(() => {
    const viewer = window.Viewer;
    const index = viewer.surroundingsOldMap.aiGeojson.features.findIndex((feature) => feature.properties.kind === 'building');
    const vertex = viewer.surroundingsEditVertices().find((entry) => entry.feature === index && entry.index === 0);
    return { index, before: viewer.surroundingsOldMap.aiGeojson.features[index].geometry.coordinates[0][0], from: viewer.surroundingsEditToScreen(vertex.x, vertex.z), to: viewer.surroundingsEditToScreen(vertex.x + 20, vertex.z) };
  });
  await page.mouse.move(corner.from.x, corner.from.y);
  await page.mouse.down();
  await page.mouse.move((corner.from.x + corner.to.x) / 2, (corner.from.y + corner.to.y) / 2, { steps: 4 });
  await page.mouse.move(corner.to.x, corner.to.y, { steps: 4 });
  await page.mouse.up();
  const dragged = await page.evaluate((index) => window.Viewer.surroundingsOldMap.aiGeojson.features[index], corner.index);
  expect(dragged.properties.edited).toBe(true);
  expect(dragged.geometry.coordinates[0][0][0]).toBeGreaterThan(corner.before[0]);
  // The ring stays closed.
  expect(dragged.geometry.coordinates[0].at(-1)).toEqual(dragged.geometry.coordinates[0][0]);
  await expect(reading).toContainText('1 changed by hand');
  // The road selected by a click on it, removed with Delete.
  const roadAt = await page.evaluate(() => {
    const viewer = window.Viewer;
    const index = viewer.surroundingsOldMap.aiGeojson.features.findIndex((feature) => feature.properties.kind === 'road');
    const points = viewer.surroundingsEditVertices().filter((entry) => entry.feature === index);
    return viewer.surroundingsEditToScreen((points[0].x + points[1].x) / 2, (points[0].z + points[1].z) / 2);
  });
  await page.mouse.click(roadAt.x, roadAt.y);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsEdit.selected)).toBeGreaterThanOrEqual(0);
  await expect(reading.locator('button[data-action="delete"]')).toBeEnabled();
  await page.keyboard.press('Delete');
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsOldMap.aiGeojson.features.map((feature) => feature.properties.kind).sort())).toEqual(['building', 'lake']);
  // A building drawn: three clicks, Enter.
  const blocksBefore = await page.evaluate(() => window.Viewer.surroundingsObjects.layout.blocks.length);
  await reading.locator('select[name="drawKind"]').selectOption('building');
  await reading.locator('button[data-action="draw"]').click();
  await expect(reading).toContainText('Click the points on the ground');
  const spots = await page.evaluate(() => [[-120, -80], [-100, -80], [-100, -64]].map(([x, z]) => window.Viewer.surroundingsEditToScreen(x, z)));
  for (const spot of spots) await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press('Enter');
  const drawn = await page.evaluate(() => window.Viewer.surroundingsOldMap.aiGeojson.features.at(-1));
  expect(drawn.properties).toMatchObject({ kind: 'building', source: 'hand' });
  expect(drawn.geometry.coordinates[0]).toHaveLength(4);
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.layout.blocks.length)).toBe(blocksBefore + 1);
  // Undone: the building gone again.
  await reading.locator('button[data-action="undo"]').click();
  expect(await page.evaluate(() => window.Viewer.surroundingsOldMap.aiGeojson.features.length)).toBe(2);
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.layout.blocks.length)).toBe(blocksBefore);
  // Saved with what was changed.
  const [corrected] = await Promise.all([page.waitForEvent('download'), reading.locator('button[data-action="save"]').click()]);
  const correctedFile = JSON.parse(fs.readFileSync(await corrected.path(), 'utf8'));
  expect(correctedFile.properties.checked_by_hand).toBe(true);
  expect(correctedFile.features.find((feature) => feature.properties.kind === 'building').properties.edited).toBe(true);
  await reading.locator('button[data-action="correct"]').click();
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.group.getObjectByName('surroundings-edit') == null)).toBe(true);
  await page.evaluate(() => window.Viewer.toggleSurroundingsPanel(false));

  // OpenHistoricalMap's roads and buildings of the year, on the real terrain.
  await page.unroute('https://overpass-api.openhistoricalmap.org/**');
  await page.route('https://overpass-api.openhistoricalmap.org/**', (route) => {
    const query = decodeURIComponent(route.request().postData() || '');
    const at = (east, north) => ({ lat: latitude + north / 110540, lon: longitude + east / (111320 * Math.cos((latitude * Math.PI) / 180)) });
    const elements = query.includes('"highway"') ? [
      { type: 'way', id: 1, tags: { highway: 'residential', start_date: '1700' }, geometry: [at(-200, 60), at(200, 60)] },
      { type: 'way', id: 2, tags: { building: 'yes', height: '8', start_date: '1750' }, geometry: [at(80, 70), at(92, 70), at(92, 80), at(80, 80), at(80, 70)] },
    ] : [];
    return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements }) });
  });
  await page.route('**/elevation-tiles-prod/**', (route) => route.abort());
  await page.evaluate(([latitude, longitude]) => window.Viewer.apply3IFManifestSurroundings({ kind: 'village', terrain: 'real', latitude: latitude + 0.002, longitude, year: 1800, seed: 3 }), [latitude, longitude]);
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsOldMap.layoutSource), { timeout: 10_000 }).toBe('historical');
  expect(await page.evaluate(() => window.Viewer.surroundingsObjects.layout.blocks.length)).toBe(1);
  await expect(badge).toContainText('roads and buildings of 1800 (© OpenHistoricalMap contributors)');
  // Before they were built: none of it, generated again.
  await page.evaluate(() => window.Viewer.setSurroundingsOptions({ year: 1650 }));
  await expect.poll(() => page.evaluate(() => window.Viewer.surroundingsOldMap.layoutSource)).toBeNull();
  expect(await page.evaluate(() => window.viewer.errors)).toEqual([]);
});

test('suggested scene: the window suggests, applies the ticked and undoes', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  // The box as a castle of the 15th century (the facts the rules get).
  await page.evaluate(() => {
    const gather = window.Viewer.gatherSceneFacts;
    window.Viewer.gatherSceneFacts = () => ({
      ...gather(),
      size: { x: 60, y: 25, z: 40 },
      unitSource: 'file',
      text: 'Castle, 15th century, in winter. 54.0396, 19.0280',
    });
  });

  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="look"]').click();
  await toolbar.locator('.viewer-menus_panel button[data-tool="sceneSuggest"]').click();
  const panel = page.locator('#viewerScene');
  await expect(panel).toBeVisible();
  await expect(panel.locator('button[data-purpose="presentation"]')).toHaveAttribute('aria-checked', 'true');
  await expect(panel.locator('.viewer-scene_item[data-item="sun"] input')).toBeChecked();
  await expect(panel.locator('.viewer-scene_item[data-item="weather"] .viewer-scene_item-value')).toContainText('Snow');
  // Weather left out.
  await panel.locator('.viewer-scene_item[data-item="weather"] input').uncheck();

  await panel.locator('.viewer-scene_apply').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(true);
  const sun = await page.evaluate(() => {
    const { latitude, longitude, year, month, followTimeline } = window.Viewer.sunStudy;
    return { latitude, longitude, year, month, followTimeline, weather: window.Viewer.weather.enabled, toneMapping: window.viewer.renderer.toneMapping };
  });
  expect(sun).toMatchObject({ latitude: 54.0396, year: 1450, month: 1, followTimeline: false, weather: false });
  expect(sun.longitude).toBeCloseTo(19.028, 6);
  // AgX (THREE.AgXToneMapping) for the sun's highlights.
  expect(sun.toneMapping).toBe(6);
  expect(await page.evaluate(() => window.Viewer.sceneSuggestion.result.items.find((item) => item.key === 'sun').changes)).toBe(false);

  // Documentation instead: the sun goes off.
  await panel.locator('button[data-purpose="documentation"]').click();
  await expect(panel.locator('.viewer-scene_item[data-item="sun"] .viewer-scene_item-value')).toHaveText('off');
  await expect(panel.locator('.viewer-scene_item[data-item="sun"] input')).toBeChecked();

  // Undo puts back the scene before Apply.
  await panel.locator('.viewer-scene_undo').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(false);
  expect(await page.evaluate(() => window.Viewer.sunStudy.locationSet)).toBe(false);
  await expect(panel.locator('.viewer-scene_undo')).toBeHidden();

  // A new model: the window goes.
  await page.evaluate(() => window.Viewer.disposeSceneSuggest());
  await expect(panel).toHaveCount(0);
});

test('suggested scene: a town the texts name is found by the worker (GeoNames) and the sun put there', async ({ page }) => {
  const asked = [];
  await page.route('**/api/geo/places', async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ json: { places: [{ name: 'Malbork', country: 'PL', latitude: 54.0359, longitude: 19.0266, population: 38478, timezone: 'Europe/Warsaw', matched: 'Malborku', confidence: 0.75 }] } });
  });
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(() => {
    const gather = window.Viewer.gatherSceneFacts;
    window.Viewer.gatherSceneFacts = () => ({ ...gather(), size: { x: 60, y: 25, z: 40 }, unitSource: 'file', text: 'Zamek w Malborku, XV w.' });
    window.Viewer.toggleSceneSuggestPanel(true);
  });
  const panel = page.locator('#viewerScene');
  await expect(panel.locator('.viewer-scene_basis li', { hasText: 'Malbork, PL' })).toHaveCount(1);
  await expect(panel.locator('.viewer-scene_item[data-item="sun"] .viewer-scene_reasons')).toContainText('Malbork, PL');
  await expect(panel.locator('.viewer-scene_uncertain')).toBeHidden();
  expect(asked).toEqual([{ text: 'Zamek w Malborku, XV w.' }]);

  await panel.locator('.viewer-scene_apply').click();
  await expect.poll(() => page.evaluate(() => window.Viewer.sunStudy.enabled)).toBe(true);
  const sun = await page.evaluate(() => ({ ...window.Viewer.sunStudy }));
  expect(sun.latitude).toBeCloseTo(54.0359, 4);
  expect(sun.longitude).toBeCloseTo(19.0266, 4);
  expect(sun.locationSet).toBe(true);
  // Once per model: reopening the window asks no more.
  await page.evaluate(() => {
    window.Viewer.toggleSceneSuggestPanel(false);
    window.Viewer.toggleSceneSuggestPanel(true);
  });
  await expect(panel).toBeVisible();
  expect(asked).toHaveLength(1);
});

test('suggested scene, language model: passages, probabilities, and how the rules weigh them', () => {
  expect(splitSemanticText('Kolegiata w Tumie. Nawa główna z ołtarzem!\nhttps://example.org/x 2021\nNawa główna z ołtarzem!'))
    .toEqual(['Kolegiata w Tumie.', 'Nawa główna z ołtarzem!']);
  const unit = (vector) => {
    const length = Math.hypot(...vector);
    return vector.map((value) => value / length);
  };
  const scored = scoreSemantic([unit([1, 0, 0])], {
    setting: { outdoor: [unit([0, 1, 0])], indoor: [unit([1, 0.1, 0])], studio: [unit([0, 0, 1])] },
    relief: { yes: [unit([0, 0, 1])], no: [unit([1, 0, 0])] },
  });
  expect(scored.setting.indoor).toBeGreaterThan(0.99);
  expect(scored.relief).toBeLessThan(0.01);
  expect(getSemanticSettings(false).enabled).toBe(false);
  expect(getSemanticSettings({ model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2' })).toMatchObject({ enabled: true, model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', dtype: 'q8' });

  const item = (result, key) => result.items.find((entry) => entry.key === key);
  const nave = { size: { x: 30, y: 20, z: 50 }, unitSource: 'file', text: 'Nawa główna z ołtarzem' };
  // Without the model the size says outdoors; with it, an interior.
  expect(suggestScene(nave).setting.setting).toBe('outdoor');
  const read = suggestScene({ ...nave, semantic: { model: 'multilingual-e5-small', setting: { outdoor: 0.1, indoor: 0.85, studio: 0.05 } } });
  expect(read.setting.setting).toBe('indoor');
  expect(read.setting.reasons).toContainEqual({ key: 'semantic', setting: 'indoor', percent: 85 });
  expect(read.basis).toContainEqual({ key: 'semantic', model: 'multilingual-e5-small' });
  // Words found weigh more.
  expect(suggestScene({ ...nave, text: 'Castle', semantic: { setting: { outdoor: 0.1, indoor: 0.85, studio: 0.05 } } }).setting.setting).toBe('outdoor');
  // The purpose and relief where no words say.
  expect(suggestScene({ ...nave, text: 'Zamek', semantic: { purpose: { documentation: 0.8, presentation: 0.2 } } }).purpose).toBe('documentation');
  const relief = suggestScene({ size: { x: 3, y: 2, z: 0.5 }, unitSource: 'file', text: 'Płyta', semantic: { relief: 0.8 } }, 'documentation');
  expect(item(relief, 'rakingLight')).toMatchObject({ value: { enabled: true }, preselected: true });
  expect(item(relief, 'rakingLight').reasons).toContainEqual({ key: 'semanticRelief', percent: 80 });
});

test('suggested scene, language model: read on a click, then by itself where the rules are unsure', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  await page.evaluate(() => {
    try { window.localStorage.removeItem('dfg3dviewer.sceneSemantic'); } catch (_error) { /* none */ }
    // An embedder of a few words per class (the descriptions' and the
    // text's) instead of downloading the model.
    const words = [
      ['nawa', 'naw', 'interior', 'inside', 'wnętrz', 'crypt', 'krypt', 'innenraum', 'room', 'komnat', 'piwnic', 'cellar', 'gewölbe', 'ołtarz', 'altar', 'sklepien'],
      ['exterior', 'zewnętrz', 'castle', 'ruin', 'außenansicht', 'facade', 'elewacj', 'landscape', 'square', 'street', 'site', 'field'],
      ['coin', 'monet', 'vase', 'figurine', 'sculpture', 'rzeźb', 'artefact', 'museum', 'münze', 'skulptur', 'fundstück', 'pottery', 'naczyni'],
      ['scan', 'survey', 'dokumentac', 'inwentaryzac', 'bauaufnahme'],
      ['reconstruct', 'rekonstruk', 'visualis', 'wizualiz'],
      ['inscription', 'napis', 'relief', 'ornament', 'inschrift', 'carved'],
      ['plain', 'smooth', 'gładkie', 'glatte', 'overall'],
    ];
    window.__embedded = 0;
    window.Viewer.setSceneEmbedder(async (texts) => texts.map((text) => {
      window.__embedded += 1;
      const lower = text.toLowerCase();
      const vector = words.map((list) => list.filter((word) => lower.includes(word)).length);
      vector.push(0.3);
      const length = Math.hypot(...vector);
      return vector.map((value) => value / length);
    }));
    const gather = window.Viewer.gatherSceneFacts;
    window.Viewer.gatherSceneFacts = () => ({ ...gather(), size: { x: 30, y: 20, z: 50 }, unitSource: 'file', text: 'Nawa główna kolegiaty, sklepienie i ołtarz.' });
    window.Viewer.toggleSceneSuggestPanel(true);
  });
  const panel = page.locator('#viewerScene');
  const button = panel.locator('.viewer-scene_semantic-button');
  await expect(button).toContainText('120 MB');
  // Not before the click.
  expect(await page.evaluate(() => window.__embedded)).toBe(0);
  await expect(panel.locator('.viewer-scene_basis li', { hasText: 'Setting: outdoors' })).toHaveCount(1);
  await button.click();
  await expect(panel.locator('.viewer-scene_semantic-status')).toContainText('read 1 passages');
  await expect(button).toBeHidden();
  await expect(panel.locator('.viewer-scene_basis li', { hasText: 'Setting: indoors' })).toHaveCount(1);
  await expect(panel.locator('.viewer-scene_basis li', { hasText: 'language model' })).toHaveCount(1);
  await expect(panel.locator('.viewer-scene_item[data-item="sun"] .viewer-scene_reasons')).toContainText('not outdoors: indoors');
  expect(await page.evaluate(() => window.localStorage.getItem('dfg3dviewer.sceneSemantic'))).toBe('1');

  // Consented: the next model's texts are read by themselves.
  await page.evaluate(() => {
    window.Viewer.disposeSceneSuggest();
    window.__embedded = 0;
    window.Viewer.toggleSceneSuggestPanel(true);
  });
  await expect(panel.locator('.viewer-scene_basis li', { hasText: 'Setting: indoors' })).toHaveCount(1);
  expect(await page.evaluate(() => window.__embedded)).toBeGreaterThan(0);
});

test('suggested scene from a manifest: the window open on load, for its purpose; the examples read as they say', async ({ page }) => {
  const examples = fs.readdirSync('viewer/manifesto/examples').filter((file) => file.includes('-scene-'));
  expect(examples).toHaveLength(5);
  examples.forEach((file) => {
    const manifest = JSON.parse(fs.readFileSync(`viewer/manifesto/examples/${file}`, 'utf8'));
    expect(validateAIM3DManifest(manifest).errors).toEqual([]);
    expect(manifest.AIM3DViewer.sceneSuggest.open).toBe(true);
  });
  const broken = { ...JSON.parse(fs.readFileSync('viewer/manifesto/examples/tempietto-aim3d-scene-winter.json', 'utf8')) };
  broken.AIM3DViewer = { ...broken.AIM3DViewer, sceneSuggest: { open: 'yes', purpose: 'mood' } };
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual(['$.AIM3DViewer.sceneSuggest.open', '$.AIM3DViewer.sceneSuggest.purpose']);

  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const read = (file) => page.evaluate(async (url) => {
    await window.Viewer.setupManifesto(url, 'url', 'aim3if');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const result = window.Viewer.sceneSuggestion.result;
    const item = (key) => result.items.find((entry) => entry.key === key);
    return { open: window.Viewer.isSceneSuggestPanelOpen(), purpose: result.purpose, setting: result.setting.setting, sun: item('sun').value, weather: item('weather').value };
  }, `./manifests/${file}`);
  // A foggy winter morning in Rome: the January sun after sunrise, fog.
  expect(await read('tempietto-aim3d-scene-winter.json')).toMatchObject({
    open: true, purpose: 'presentation', setting: 'outdoor', sun: { enabled: true, month: 1 }, weather: { type: 'fog' },
  });
  // Its size (5 cm a unit) makes it an object on its own.
  expect(await read('tempietto-aim3d-scene-object.json')).toMatchObject({ open: true, setting: 'studio', sun: { enabled: false } });
  // The camera among the walls: an interior.
  expect(await read('wolpa-synagogue-aim3d-local-scene-interior.json')).toMatchObject({ open: true, setting: 'indoor', sun: { enabled: false } });
  expect(await read('wolpa-synagogue-aim3d-local-scene-documentation.json')).toMatchObject({ open: true, purpose: 'documentation', setting: 'outdoor' });
  // A manifest without it leaves the window closed.
  await page.evaluate(() => window.Viewer.setupManifesto('./manifests/box-aim3d-local.json', 'url', 'aim3if'));
  await expect.poll(() => page.evaluate(() => window.Viewer.isSceneSuggestPanelOpen())).toBe(false);
});

test('suggested scene, geometry: walls seen from inside, a ceiling, an open ground, flat sites and thin plates', async ({ page }) => {
  const item = (result, key) => result.items.find((entry) => entry.key === key);
  const hall = { size: { x: 12, y: 8, z: 20 }, unitSource: 'file', text: '' };
  // Walls all round from inside: an interior, the building's size with it.
  const inside = suggestScene({ ...hall, shape: { up: 0.3, down: 0.25, sideways: 0.4, groundCover: 0.9, enclosure: 0.85, shell: 0 } });
  expect(inside.setting).toMatchObject({ setting: 'indoor', confidence: 0.9 });
  expect(inside.setting.reasons).toContainEqual({ key: 'enclosed', percent: 85 });
  expect(inside.basis.find((fact) => fact.key === 'shape')).toMatchObject({ enclosure: 0.85 });
  // Walls all round seen from a manifest's camera outside: a building with
  // its interior modelled, outdoors; with the camera unknown its name wins.
  const modelled = { size: { x: 30, y: 20, z: 40 }, unitSource: 'manifest', text: 'Wolpa Synagogue', shape: { up: 0.3, down: 0.2, sideways: 0.4, groundCover: 0.8, enclosure: 0.8, shell: 0.1 } };
  expect(suggestScene({ ...modelled, cameraInside: false }).setting).toMatchObject({ setting: 'outdoor', confidence: 0.85 });
  expect(suggestScene(modelled).setting.setting).toBe('outdoor');
  expect(suggestScene({ ...modelled, cameraInside: true }).setting.setting).toBe('indoor');
  // A part named "Interior" of a temple seen from outside: still outdoors.
  expect(suggestScene({ ...modelled, text: 'Tempietto. Interior, Roof', cameraInside: false }).setting.setting).toBe('outdoor');
  expect(suggestScene({ ...modelled, text: 'Tempietto. Interior, Roof', cameraInside: true }).setting.setting).toBe('indoor');
  // A closed building seen from its own inside is no interior.
  expect(suggestScene({ ...hall, shape: { up: 0.3, down: 0.01, sideways: 0.6, groundCover: 0.1, enclosure: 0, shell: 0.9 } }).setting.setting).toBe('outdoor');
  // An open, flat site.
  const site = suggestScene({ size: { x: 200, y: 10, z: 150 }, unitSource: 'file', text: '', shape: { up: 0.8, down: 0, sideways: 0.1, groundCover: 0.9, enclosure: 0.1, shell: 0 } });
  expect(site.setting.reasons).toEqual(expect.arrayContaining([{ key: 'ground', percent: 90 }, { key: 'flat' }]));
  // A thin plate: raking light to read it.
  expect(sceneProportions({ x: 0.8, y: 0.6, z: 0.05 }).thinness).toBeCloseTo(0.0625, 4);
  const plate = suggestScene({ size: { x: 0.8, y: 0.6, z: 0.05 }, unitSource: 'file', text: 'Płyta' }, 'documentation');
  expect(item(plate, 'rakingLight')).toMatchObject({ value: { enabled: true }, preselected: true, reasons: [{ key: 'thinPlate' }] });

  // The measures, in the browser, of a room (faces turned inwards), a closed
  // box (outwards) and a ground with a small block on it.
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const shapes = await page.evaluate(() => {
    const THREE = window.THREE;
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8).scale(-1, 1, 1), material);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8), material);
    const ground = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2), material);
    const block = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), material);
    block.position.set(0, 3, 0);
    ground.add(plane, block);
    return [room, shell, ground].map((root) => window.Viewer.measureSceneShape([root]));
  });
  const [room, shell, ground] = shapes;
  expect(room.enclosure).toBeGreaterThan(0.9);
  expect(room.down).toBeGreaterThan(0.2);
  expect(room.groundCover).toBeGreaterThan(0.9);
  expect(shell.enclosure).toBe(0);
  expect(shell.shell).toBeGreaterThan(0.9);
  expect(ground.groundCover).toBeGreaterThan(0.9);
  expect(ground.down).toBeLessThan(0.05);
  expect(ground.enclosure).toBeLessThan(0.5);
});

test('material types: every built-in type is complete, and none leaves another type behind', () => {
  expect(MATERIAL_PRESETS.length).toBeGreaterThanOrEqual(15);
  const keys = MATERIAL_PRESETS.map((preset) => preset.key);
  expect(new Set(keys).size).toBe(keys.length);
  MATERIAL_PRESETS.forEach((preset) => {
    const params = resolveMaterialPreset(preset.key);
    // Everything the base sets, so glass then wood leaves no transmission.
    Object.keys(MATERIAL_BASE).forEach((key) => expect(params).toHaveProperty(key));
    expect(params.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(params.roughness).toBeGreaterThanOrEqual(0);
    expect(params.roughness).toBeLessThanOrEqual(1);
  });
  expect(resolveMaterialPreset('glass')).toMatchObject({ transmission: 1, side: 'double' });
  expect(resolveMaterialPreset('lightWood')).toMatchObject({ transmission: 0, metalness: 0, clearcoat: 0 });
  expect(resolveMaterialPreset('steel').metalness).toBe(1);

  // The type a name suggests, in English, Polish and German.
  expect(suggestMaterialPreset('Glass_01')).toBe('glass');
  expect(suggestMaterialPreset('GlassPane01')).toBe('glass');
  expect(suggestMaterialPreset('Szkło okienne')).toBe('glass');
  expect(suggestMaterialPreset('Frosted glass')).toBe('frostedGlass');
  expect(suggestMaterialPreset('Holz_Eiche')).toBe('lightWood');
  expect(suggestMaterialPreset('Ściana')).toBe('plaster');
  expect(suggestMaterialPreset('Mosiądz')).toBe('brass');
  expect(suggestMaterialPreset('metal_rust')).toBe('iron');
  // Not "panel", not a light map, nothing in a generic name.
  expect(suggestMaterialPreset('Panel_01')).toBeNull();
  expect(suggestMaterialPreset('lightmap')).toBeNull();
  expect(suggestMaterialPreset('Material.001')).toBeNull();
});

test('materials window: lists the materials, applies a type, edits, resets, picks on the model and round-trips', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  const toolbar = page.locator('#viewerEditorToolbar');
  await toolbar.locator('.viewer-menus_tab[data-menu="model"]').click();
  await toolbar.locator('.viewer-menus_panel button[data-tool="materials"]').click();
  const panel = page.locator('#viewerMaterials');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-materials_item')).not.toHaveCount(0);
  const item = panel.locator('.viewer-materials_item.is-selected');
  await expect(item).toHaveCount(1);

  const meshState = () => page.evaluate(() => {
    const [entry] = window.Viewer.materialsEditor.items;
    const mesh = [...entry.meshes][0];
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    return {
      original: material === entry.original,
      physical: material.isMeshPhysicalMaterial === true,
      transmission: material.transmission ?? null,
      roughness: material.roughness,
      color: material.color.getHexString(),
      originalTransmission: entry.original.transmission ?? null,
    };
  });
  expect(await meshState()).toMatchObject({ original: true });

  // Glass from the built-in types: an editable physical copy on the mesh.
  await panel.locator('.viewer-materials_group[data-group="glass"]').click();
  await panel.locator('.viewer-materials_preset[data-preset="glass"]').click();
  expect(await meshState()).toMatchObject({ original: false, physical: true, transmission: 1 });
  await expect(item).toHaveClass(/is-edited/);
  await expect(panel.locator('.viewer-materials_current')).toContainText('Glass');

  // Wood after glass: no glass left.
  await panel.locator('.viewer-materials_group[data-group="wood"]').click();
  await panel.locator('.viewer-materials_preset[data-preset="lightWood"]').click();
  expect(await meshState()).toMatchObject({ transmission: 0, color: 'c9a26b' });
  // The model's own material is untouched.
  expect((await meshState()).originalTransmission ?? 0).toBe(0);

  // A property by hand.
  await panel.locator('.viewer-materials_field[data-field="roughness"] input').evaluate((input) => {
    input.value = '0.3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect((await meshState()).roughness).toBeCloseTo(0.3, 5);

  // Saved with the settings and applied again.
  const saved = await page.evaluate(() => window.Viewer.getMaterialOverridesForPersistence());
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ index: 0, preset: 'lightWood', params: { roughness: 0.3, color: '#c9a26b' } });
  const metadata = await page.evaluate(() => window.Viewer.buildMetadata(new window.THREE.Vector3()).materials);
  expect(metadata).toEqual(saved);

  await panel.locator('.viewer-materials_reset').click();
  expect(await meshState()).toMatchObject({ original: true });
  await expect(item).not.toHaveClass(/is-edited/);
  expect(await page.evaluate((entries) => window.Viewer.applySavedMaterials(entries), saved)).toBe(1);
  expect(await meshState()).toMatchObject({ original: false, transmission: 0, color: 'c9a26b' });
  expect((await meshState()).roughness).toBeCloseTo(0.3, 5);

  // Picked on the model: a click in the middle of the view.
  await page.evaluate(() => window.Viewer.selectMaterial(null));
  await panel.locator('.viewer-materials_pick').click();
  await expect(panel.locator('.viewer-materials_pick')).toHaveAttribute('aria-pressed', 'true');
  const canvas = page.locator('#MainCanvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(panel.locator('.viewer-materials_pick')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.Viewer.materialsEditor.selectedId)).toBe(await page.evaluate(() => window.Viewer.materialsEditor.items[0].id));

  // The context menu over the model offers it too.
  const menuKeys = await page.evaluate(({ x, y }) => window.Viewer.contextMenuItems(x, y).flat().map((entry) => entry.key), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(menuKeys).toContain('editMaterial');

  // Reset settings puts the materials back as loaded too.
  expect(await page.evaluate(() => window.Viewer.resetAllMaterials())).toBe(1);
  expect(await meshState()).toMatchObject({ original: true });
});

test('section cuts and measurements are saved with the settings and the manifest, and come back on the model', async ({ page }) => {
  await openViewer(page, '/examples/box.glb');
  await waitForCameraIdle(page);

  // A cut a third of the way along X, the other side kept, with its fill;
  // a distance and an area across the model.
  await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.setClippingAxisEnabled('x', true, { silent: true });
    viewer.setClippingAxisNegated('x', true);
    const range = viewer.getClippingAxisRange('x');
    viewer.setClippingAxisPosition('x', range.min + range.size / 3);
    viewer.setClippingFillVisible(true);
  });
  await page.evaluate(() => {
    const viewer = window.Viewer;
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const center = root.position;
    viewer.measurementMode = 'distance';
    viewer.addMeasurementPoint(center.clone().set(center.x - 0.5, center.y, center.z));
    viewer.addMeasurementPoint(center.clone().set(center.x + 0.5, center.y, center.z));
    viewer.finishMeasurementDraft();
    viewer.measurementMode = 'area';
    [[0, 0], [1, 0], [1, 1]].forEach(([dx, dz]) => viewer.addMeasurementPoint(center.clone().set(center.x + dx, center.y, center.z + dz)));
    viewer.finishMeasurementDraft();
  });

  const metadata = await page.evaluate(() => window.Viewer.buildMetadata({ x: 0, y: 0, z: 0 }));
  expect(metadata.clipping).toMatchObject({ mode: { x: true, y: false, z: false }, negated: { x: true }, outlineVisible: true });
  expect(metadata.clipping.fraction.x).toBeCloseTo(1 / 3, 4);
  expect(metadata.measurements.map((entry) => [entry.mode, entry.points.length])).toEqual([['distance', 2], ['area', 3]]);

  // Unticked in Save settings: what was saved before stays.
  const unticked = await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.saveProperties.ClippingPlanes = false;
    viewer.saveProperties.Measurements = false;
    const previous = viewer.originalMetadata;
    viewer.originalMetadata = { ...previous, clipping: 'before', measurements: 'before' };
    const result = viewer.buildMetadata({ x: 0, y: 0, z: 0 });
    viewer.originalMetadata = previous;
    viewer.saveProperties.ClippingPlanes = true;
    viewer.saveProperties.Measurements = true;
    return [result.clipping, result.measurements];
  });
  expect(unticked).toEqual(['before', 'before']);

  // Gone, then the model moved and the saved state applied: the cut at the
  // same place in the model's box, the measurements moved with the model.
  const restored = await page.evaluate((saved) => {
    const viewer = window.Viewer;
    const root = window.Viewer.resolveObjectByTargetId('m0:root');
    const before = viewer.measurementResults[0].points[0].clone();
    viewer.clearMeasurements();
    viewer.removeAllClipping();
    root.position.x += 2;
    root.updateMatrixWorld(true);
    viewer.refreshClippingForModel(root);
    viewer.applySavedClipping(saved.clipping);
    const drawn = viewer.applySavedMeasurements(saved.measurements, root);
    const range = viewer.getClippingAxisRange('x');
    return {
      drawn,
      shift: viewer.measurementResults[0].points[0].x - before.x,
      enabled: viewer.isClippingAxisEnabled('x'),
      negated: viewer.isClippingAxisNegated('x'),
      cut: (viewer.getClippingAxisPosition('x') - range.min) / range.size,
      readout: document.querySelectorAll('#viewerMeasurementReadout li').length,
    };
  }, metadata);
  expect(restored).toMatchObject({ drawn: 2, enabled: true, negated: true });
  expect(restored.shift).toBeCloseTo(2, 4);
  expect(restored.cut).toBeCloseTo(1 / 3, 4);
  expect(restored.readout).toBeGreaterThanOrEqual(2);

  // The manifest carries the measurements too, and brings them back.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.measurements).toHaveLength(2);
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  await page.evaluate(() => window.Viewer.clearMeasurements());
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  expect(await page.evaluate(() => window.Viewer.measurementResults.map((entry) => entry.mode))).toEqual(['distance', 'area']);

  const broken = structuredClone(manifest);
  broken.AIM3DViewer.measurements[1].points = [[0, 0, 0], [1, 1]];
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual([
    '$.AIM3DViewer.measurements[1].points',
  ]);
});

test('example manifests with measurements: the synagogue measured outside, and a section measured inside', async ({ page }) => {
  test.setTimeout(120_000);
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForModel(page);
  const shown = async (url, count) => {
    await page.evaluate((manifest) => window.Viewer.setupManifesto(manifest, 'url', 'aim3if'), url);
    await expect.poll(() => page.evaluate(() => window.Viewer.measurementResults.map((entry) => entry.mode).join()), { timeout: 60_000 }).toBe(count);
    return page.evaluate(() => ({
      measured: window.Viewer.measurementResults.map((entry) => [entry.mode, window.Viewer.describeMeasurement(entry).value]),
      clipping: window.Viewer.hasActiveClipping(),
      x: window.Viewer.isClippingAxisEnabled('x'),
      unit: window.Viewer.resolveModelUnit().meters,
    }));
  };

  // The model in centimetres (the Scene's spatialScale): lengths in metres.
  const outside = await shown('./manifests/wolpa-synagogue-aim3d-local-measured.json', 'distance,distance,distance,angle,area');
  expect(outside).toMatchObject({ clipping: false, unit: 0.01 });
  expect(outside.measured).toEqual([
    ['distance', '16.67 m'],
    ['distance', '15.98 m'],
    ['distance', '13.81 m'],
    ['angle', '91.5°'],
    ['area', '220.68 m²'],
  ]);

  // The next manifest's measurements replace them; its cut is on.
  const inside = await shown('./manifests/wolpa-synagogue-aim3d-local-section-measured.json', 'distance,distance,area');
  expect(inside).toMatchObject({ clipping: true, x: true });
  expect(inside.measured).toEqual([['distance', '13.45 m'], ['distance', '15.68 m'], ['area', '111.33 m²']]);

  for (const file of ['wolpa-synagogue-aim3d-local-measured.json', 'wolpa-synagogue-aim3d-local-section-measured.json']) {
    const manifest = JSON.parse(fs.readFileSync(`viewer/manifesto/examples/${file}`, 'utf8'));
    expect(validateAIM3DManifest(manifest).errors, file).toEqual([]);
    expect(manifestFeatureIcons(inspectAIM3DManifest(manifest)).map((icon) => icon.id), file).toContain('measurements');
  }
});

test('prepare for publishing, rules: the base a model stands on, the exposure, the framing', () => {
  // Flat at the bottom only: upright.
  expect(decideModelBase({ 'Y-': 30, 'Y+': 2, 'X+': 1, 'X-': 1, 'Z+': 1, 'Z-': 1 }, 100)).toMatchObject({ base: 'Y-' });
  // A box: no end stands out.
  expect(decideModelBase({ 'Y-': 16, 'Y+': 16, 'X+': 16, 'X-': 16, 'Z+': 16, 'Z-': 16 }, 100).confidence).toBe(0);
  // Its base at the back (a Z-up file): standing on Z- means Z+ is up.
  const lying = decideModelBase({ 'Z-': 40, 'Y-': 3, 'Y+': 3, 'X+': 2, 'X-': 2, 'Z+': 1 }, 100);
  expect(lying).toMatchObject({ base: 'Z-', confidence: 1 });
  expect(suggestUpAxis('Z-')).toBe('Z+');
  expect(suggestUpAxis('Y+')).toBe('Y-');
  expect(suggestUpAxis('Y-')).toBeNull();
  const upright = evaluatePublishChecks({ kind: 'mesh', base: { base: 'Y-', confidence: 1 } });
  expect(upright).toContainEqual({ key: 'orientation', level: 'ok', values: {} });
  const onSide = evaluatePublishChecks({ kind: 'mesh', base: { ...lying, upAxis: 'Z+', rotated: false } });
  expect(onSide[0]).toMatchObject({ key: 'orientation', level: 'fix', values: { side: 'side', upAxis: 'Z+' } });
  // Turned by hand: only pointed out.
  expect(evaluatePublishChecks({ kind: 'mesh', base: { ...lying, upAxis: 'Z+', rotated: true } })[0].level).toBe('tip');
  // Flat on top (a table?): only pointed out, with the fix offered.
  const top = decideModelBase({ 'Y+': 40, 'Y-': 1, 'X+': 1, 'X-': 1, 'Z+': 1, 'Z-': 1 }, 100);
  expect(evaluatePublishChecks({ kind: 'mesh', base: { ...top, upAxis: 'Y-', rotated: false } })[0]).toMatchObject({ level: 'tip', values: { side: 'upsideDown' } });
  // A relief standing with its back to Z-: a slab, its back is no base.
  expect(decideModelBase({ 'Z-': 40, 'Z+': 2, 'Y-': 1, 'Y+': 1, 'X+': 1, 'X-': 1 }, 100, { X: 2, Y: 3, Z: 0.2 }).confidence).toBe(0);
  expect(decideModelBase({ 'Z-': 40, 'Z+': 2, 'Y-': 1, 'Y+': 1, 'X+': 1, 'X-': 1 }, 100, { X: 2, Y: 2, Z: 4 }).confidence).toBe(1);

  expect(decideExposure({ mean: 0.08, clipped: 0, pixels: 2000 })).toMatchObject({ state: 'dark' });
  expect(decideExposure({ mean: 0.9, clipped: 0.5, pixels: 2000 })).toMatchObject({ state: 'bright' });
  expect(decideExposure({ mean: 0.45, clipped: 0, pixels: 2000 })).toBeNull();
  // Too few of the model's pixels to judge.
  expect(decideExposure({ mean: 0.05, clipped: 0, pixels: 20 })).toBeNull();

  const square = (half) => [-half, half].flatMap((x) => [-half, half].map((y) => [x, y, 0.5]));
  expect(measureFraming(square(0.5))).toMatchObject({ hidden: 0, coverage: 0.25 });
  expect(measureFraming(square(2)).hidden).toBeCloseTo(0.75);
  expect(measureFraming(square(0.05)).coverage).toBeLessThan(0.05);
  const checks = evaluatePublishChecks({ framing: measureFraming(square(2)), tools: { clipping: true, wireframe: true }, quality: 'fast' });
  expect(checks.map((check) => check.key)).toEqual(expect.arrayContaining(['framing', 'tool.clipping', 'tool.wireframe', 'quality']));
  expect(checks.every((check) => check.level === 'fix')).toBe(true);
});

test('prepare for publishing: finds what would show in the renders, fixes it, and asks before saving', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  await expect(page.locator('#viewerEditorToolbar button[data-tool="publishCheck"]')).toHaveCount(1);

  // Floating, in wireframe, dark, and with the move handles on.
  await page.evaluate(() => {
    const root = window.Viewer.getUpAxisRoot();
    const size = new window.THREE.Box3().setFromObject(root).getSize(new window.THREE.Vector3());
    root.position.y += size.y;
    root.updateMatrixWorld(true);
    window.Viewer.toggleWireframeMode();
    window.Viewer.setObjectTransformMode('translate');
    window.viewer.renderer.toneMappingExposure = 0.05;
    window.Viewer.togglePublishCheckPanel(true);
  });
  const panel = page.locator('#viewerPublishCheck');
  await expect(panel).toBeVisible();
  const fix = (key) => panel.locator(`.viewer-prepare_item[data-check="${key}"][data-level="fix"]`);
  await expect(fix('ground')).toHaveCount(1);
  await expect(fix('tool.wireframe')).toHaveCount(1);
  await expect(fix('tool.transform')).toHaveCount(1);
  await expect(panel.locator('.viewer-prepare_summary')).toHaveAttribute('data-state', 'fix');

  // One fix by its own button.
  await fix('tool.wireframe').locator('.viewer-prepare_fix').click();
  expect(await page.evaluate(() => window.Viewer.publishCheck.facts.tools.wireframe)).toBe(false);
  await expect(fix('tool.wireframe')).toHaveCount(0);

  // The rest at once.
  await panel.locator('.viewer-prepare_fix-all').click();
  await expect(fix('ground')).toHaveCount(0);
  await expect(fix('tool.transform')).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.transformText['Transform 3D Object'])).toBe('');
  await expect(panel.locator('.viewer-prepare_passed li', { hasText: 'Stands on the ground' })).toHaveCount(1);
  await expect(panel.locator('.viewer-prepare_steps [data-step="save"]')).toContainText('Not saved in this session');

  // Asked before saving while something is left to fix (the guard is off
  // in tests unless switched on).
  await page.evaluate(() => {
    window.Viewer.togglePublishCheckPanel(false);
    window.Viewer.setPublishGuard(true);
    window.Viewer.toggleWireframeMode();
  });
  const saving = page.evaluate(() => window.Viewer.saveEditorMetadata());
  const hint = page.locator('#viewerSmartHint[data-hint="publishGuard"]');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Wireframe is on');
  expect(await saving).toBe(false);
  await hint.locator('[data-action="continue"]').click();
  await expect(hint).toHaveCount(0);
  // Not asked again for this model.
  expect(await page.evaluate(() => window.Viewer.publishCheck.acknowledged.has('save'))).toBe(true);
  // "Review" opens the window instead.
  const rendering = page.evaluate(() => window.Viewer.takeScreenshot());
  await hint.locator('[data-action="review"]').click();
  await expect(panel).toBeVisible();
  expect(await rendering).toBe(false);
});

test('prepare for publishing: a model lying on its side is pointed out after loading and stood up', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  // A plinth with a column on it, the plinth at the back: lying on its side.
  await page.evaluate(() => {
    const THREE = window.THREE;
    const root = window.Viewer.getUpAxisRoot();
    // Instead of the box; under the up axis pivot, if there is one.
    const meshes = [];
    root.traverse((object) => { if (object.isMesh) meshes.push(object); });
    meshes.forEach((mesh) => mesh.removeFromParent());
    const parent = root.children.find((child) => child.userData?.isUpAxisPivot) ?? root;
    const material = new THREE.MeshStandardMaterial();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), material);
    plinth.position.set(0, 1, -1.9);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 24, 1, true), material);
    column.rotation.x = Math.PI / 2;
    column.position.set(0, 1, 0);
    parent.add(plinth, column);
    root.updateMatrixWorld(true);
    window.Viewer.setPublishGuard(true);
  });
  expect(await page.evaluate(() => window.Viewer.offerOrientationHint())).toBe(true);
  const hint = page.locator('#viewerSmartHint[data-hint="orientation"]');
  await expect(hint).toContainText('lie on its side');
  await hint.locator('[data-action="fix"]').click();
  expect(await page.evaluate(() => window.Viewer.getModelUpAxis())).toBe('Z+');
  // Upright now: nothing more to say.
  expect(await page.evaluate(() => window.Viewer.offerOrientationHint())).toBe(false);
});

test('render quality: a stuttering view offers a lower quality, which lowers the pixel ratio and ambient occlusion, and undo restores it', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  await page.evaluate(() => {
    document.querySelector('button[data-tool="renderingAo"]').click();
    window.Viewer.setPerformanceAdvisor(true);
  });
  expect(await page.evaluate(() => window.viewer.rendering.postprocessing.ao)).toBe(true);

  // Frames of a fast view: no hint.
  expect(await page.evaluate(() => [60, 58, 61, 59, 60, 60].some((fps) => window.Viewer.recordPerformanceSecond(fps)))).toBe(false);
  // Six slow seconds in a row.
  expect(await page.evaluate(() => [12, 14, 11, 13, 12, 15].map((fps) => window.Viewer.recordPerformanceSecond(fps)).pop())).toBe(true);
  const hint = page.locator('#viewerSmartHint[data-hint="performance"]');
  await expect(hint).toContainText('stuttering');
  await hint.locator('[data-action="lower"]').click();
  const state = () => page.evaluate(() => ({
    quality: window.Viewer.getRenderQuality(),
    pixelRatio: window.viewer.renderer.getPixelRatio(),
    ao: window.viewer.rendering.postprocessing.ao,
  }));
  expect(await state()).toMatchObject({ quality: 'balanced', ao: false });
  expect((await state()).pixelRatio).toBeLessThanOrEqual(1.25);
  // The Rendering menu shows it.
  await expect(page.locator('button[data-tool="renderingQualityBalanced"]')).toHaveAttribute('aria-pressed', 'true');

  const undo = page.locator('#viewerSmartHint[data-hint="performanceLowered"]');
  await undo.locator('[data-action="undo"]').click();
  expect(await state()).toMatchObject({ quality: 'high', ao: true });

  // From the menu, the fastest: no post-processing at three quarters.
  await page.evaluate(() => document.querySelector('button[data-tool="renderingQualityFast"]').click());
  expect(await state()).toMatchObject({ quality: 'fast', ao: false });
  expect((await state()).pixelRatio).toBeCloseTo(0.75);
  expect(await page.evaluate(() => window.viewer.rendering.postprocessing.enabled)).toBe(false);
  await page.evaluate(() => window.Viewer.setRenderQuality('high'));
  expect(await state()).toMatchObject({ quality: 'high', ao: true, pixelRatio: 1 });

  // Closed with ×: not offered again.
  await page.evaluate(() => [12, 14, 11, 13, 12, 15].forEach((fps) => window.Viewer.recordPerformanceSecond(fps)));
  await hint.locator('.viewer-hint_close').click();
  expect(await page.evaluate(() => [12, 14, 11, 13, 12, 15].map((fps) => window.Viewer.recordPerformanceSecond(fps)).pop())).toBe(false);
});

test('materials in the AIM3D manifest: exported while edited, validated, and imported back', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  expect(await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.materials)).toBeUndefined();
  await page.evaluate(() => {
    window.Viewer.applyMaterialPreset('marble');
    window.Viewer.setMaterialProperty('roughness', 0.4);
  });
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.materials).toEqual([expect.objectContaining({ index: 0, preset: 'marble', params: expect.objectContaining({ roughness: 0.4 }) })]);
  expect(validateAIM3DManifest(manifest).valid).toBe(true);
  expect(manifestFeatureIcons(inspectAIM3DManifest(manifest)).map((feature) => feature.id)).toContain('materials');
  // A type the viewer does not know, a colour that is none.
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.AIM3DViewer.materials[0].preset = 'unobtainium';
  broken.AIM3DViewer.materials[0].params.color = 'red';
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual(expect.arrayContaining([
    '$.AIM3DViewer.materials[0].preset',
    '$.AIM3DViewer.materials[0].params.color',
  ]));

  await page.evaluate(() => window.Viewer.resetAllMaterials());
  expect(await page.evaluate(() => window.Viewer.getEditedMaterialCount())).toBe(0);
  await page.evaluate((json) => window.Viewer.import3IFManifest(json), manifest);
  const state = await page.evaluate(() => {
    const [item] = window.Viewer.materialsEditor.items;
    return { edited: item.current !== item.original, preset: item.preset, roughness: item.current.roughness };
  });
  expect(state).toMatchObject({ edited: true, preset: 'marble' });
  expect(state.roughness).toBeCloseTo(0.4, 5);
});

test('render quality: a model too heavy for the device gets the lower quality offered right after loading', async ({ page }) => {
  expect(deviceTier({ gpu: 'Google SwiftShader' })).toBe('low');
  expect(deviceTier({ coarse: true, memory: 4 })).toBe('low');
  expect(deviceTier({ coarse: true, memory: 8, cores: 8 })).toBe('phone');
  expect(deviceTier({ memory: 16, cores: 12, gpu: 'NVIDIA GeForce RTX 4070' })).toBe('desktop');
  expect(qualityForWeight(1_000_000, 'desktop')).toBeNull();
  expect(qualityForWeight(5_000_000, 'phone')).toBe('balanced');
  expect(qualityForWeight(9_000_000, 'phone')).toBe('fast');

  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  // The box on a phone: fits.
  expect(await page.evaluate(() => {
    window.Viewer.setPerformanceAdvisor(true);
    window.Viewer.getDeviceInfo = () => ({ coarse: true, memory: 8, cores: 8, gpu: '' });
    return window.Viewer.assessModelWeight();
  })).toBe(false);
  // Six million splats on the same phone: Fast, at once.
  expect(await page.evaluate(() => {
    const heavy = new window.THREE.Group();
    heavy.userData.gaussianSplats = { count: 9_000_000 };
    window.Viewer.getSunModelRoots = () => [heavy];
    return window.Viewer.assessModelWeight();
  })).toBe(true);
  const hint = page.locator('#viewerSmartHint[data-hint="performanceHeavy"]');
  await expect(hint).toContainText('9.0 M');
  await hint.locator('[data-action="lower"]').click();
  expect(await page.evaluate(() => window.Viewer.getRenderQuality())).toBe('fast');
});

test('prepare for publishing: the toolbar counts what to fix, and the renders start from the start view\'s side', async ({ page }) => {
  await openViewer(page, '/examples/box.glb', 'ui=menus');
  await waitForCameraIdle(page);
  // In a closed menu: its state, not its visibility.
  const button = page.locator('#viewerEditorToolbar button[data-tool="publishCheck"]');
  const badge = button.locator('.viewer-tool-badge');
  await page.evaluate(() => {
    window.Viewer.setPublishGuard(true);
    window.Viewer.toggleWireframeMode();
    window.Viewer.setObjectTransformMode('translate');
  });
  await expect(button).toHaveAttribute('data-badge', /^[2-9]/);
  await expect(badge).not.toHaveAttribute('hidden', '');
  await expect(badge).toHaveText(/^[2-9]/);
  await expect(page.locator('#viewerEditorToolbar .viewer-menus_tab.has-badge')).not.toHaveCount(0);
  await page.evaluate(() => {
    window.Viewer.toggleWireframeMode();
    window.Viewer.setObjectTransformMode('');
  });
  await expect(button).toHaveAttribute('data-badge', '');
  await expect(badge).toHaveAttribute('hidden', '');
  await expect(page.locator('#viewerEditorToolbar .viewer-menus_tab.has-badge')).toHaveCount(0);

  // The automatic start view looks from a slant: the file's front stays.
  expect(await page.evaluate(() => window.Viewer.getThumbnailFrontAngle())).toBe(0);
  // Framed from +X: that side is the front of the renders.
  const angle = await page.evaluate(() => {
    const box = window.Viewer.getPublishModelBox();
    const center = box.getCenter(new window.THREE.Vector3());
    window.Viewer.camera.position.set(center.x + 10, center.y + 1, center.z + 0.5);
    window.Viewer.controls.target.copy(center);
    window.Viewer.frameModelInView();
    return window.Viewer.getThumbnailFrontAngle();
  });
  expect(angle).toBe(90);
  await page.evaluate(() => window.Viewer.togglePublishCheckPanel(true));
  const front = page.locator('#viewerPublishCheck .viewer-prepare_front');
  await expect(front).toContainText('90°');
  // Off: the file's +Z, as before.
  await front.locator('input').uncheck();
  expect(await page.evaluate(() => window.Viewer.getThumbnailFrontAngle())).toBe(0);
});

test('lights window: the key light round the model, lights added, moved, saved in the manifest and removed', { tag: '@smoke' }, async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);

  // The key light aims at the middle of the model, from outside it.
  const key = await page.evaluate(() => {
    const light = window.Viewer.dirLight;
    const bounds = window.viewer.lightBounds;
    return {
      aimed: light.target.position.distanceTo(bounds.center) < 1e-6,
      outside: light.position.distanceTo(bounds.center) > bounds.radius,
    };
  });
  expect(key).toEqual({ aimed: true, outside: true });

  // The Lights tool opens the window (its tool sits in the toolbar's folded tray).
  await page.evaluate(() => document.querySelector('button[data-tool="lights"]').click());
  const panel = page.locator('#viewerLights');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-lights_item')).toHaveCount(1);
  // The key light's helper, and an icon where it is.
  const markers = () => page.evaluate(() => {
    const group = window.viewer.scene.getObjectByName('light-markers');
    return group?.visible ? group.children.filter((child) => child.isSprite).length : 0;
  });
  const lightHelperShown = () => page.evaluate(() => window.viewer.scene.children.some((child) => /LightHelper$/.test(child.type) && child.visible));
  expect(await lightHelperShown()).toBe(true);
  await expect.poll(markers).toBe(1);
  await expect(panel.locator('.viewer-lights_remove')).toBeDisabled();

  // A spot light: chosen, with its own fields.
  await panel.locator('.viewer-lights_add-button[data-type="SpotLight"]').click();
  await expect(panel.locator('.viewer-lights_item')).toHaveCount(2);
  // It has its icon at once, and (a spot light) its cone, from the bulb.
  await expect.poll(markers).toBe(2);
  const cone = await page.evaluate(() => {
    const group = window.viewer.scene.getObjectByName('light-markers');
    const cones = group.children.filter((child) => child.isLineSegments && child.visible);
    const light = window.Viewer.getActiveLight();
    const bulb = light.getWorldPosition(new window.THREE.Vector3());
    const positions = cones[0]?.geometry.attributes.position;
    const fromBulb = positions
      ? new window.THREE.Vector3().fromBufferAttribute(positions, positions.count - 2).distanceTo(bulb) < 1e-6
      : false;
    return { cones: cones.length, fromBulb };
  });
  expect(cone).toEqual({ cones: 1, fromBulb: true });

  // A click on the key light's icon chooses it; on the spot light's, back.
  const clickMarker = async (index) => {
    const point = await page.evaluate((i) => {
      const viewer = window.Viewer;
      const light = viewer.getEditableLights()[i];
      const canvas = document.getElementById('MainCanvas');
      const rect = canvas.getBoundingClientRect();
      const p = light.getWorldPosition(new window.THREE.Vector3()).project(window.viewer.camera);
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height, inside: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1 };
    }, index);
    return point;
  };
  const keyPoint = await clickMarker(0);
  if (keyPoint.inside) {
    await page.mouse.click(keyPoint.x, keyPoint.y);
    await expect(panel.locator('.viewer-lights_item').nth(0)).toHaveClass(/is-selected/);
    await panel.locator('.viewer-lights_item').nth(1).click();
  }
  await expect(panel.locator('.viewer-lights_item').nth(1)).toHaveClass(/is-selected/);
  await panel.locator('.viewer-lights_name').fill('Front');
  await expect(panel.locator('.viewer-lights_item.is-selected .viewer-lights_item-name')).toHaveText('Front');
  await expect(panel.locator('.viewer-lights_field', { has: page.locator('input[type="range"][max="90"]') })).toBeVisible();

  // Moved by its angles round the target.
  await page.evaluate(() => window.Viewer.setLightAngles({ direction: 90, height: 0 }));
  const moved = await page.evaluate(() => {
    const light = window.Viewer.getActiveLight();
    const offset = light.position.clone().sub(light.target.position);
    return { x: offset.x > 0, y: Math.abs(offset.y) < 1e-6, z: Math.abs(offset.z) < 1e-6 };
  });
  expect(moved).toEqual({ x: true, y: true, z: true });
  await expect(panel.locator('.viewer-lights_number[data-axis="x"]').first()).not.toHaveValue('');

  // Its handles go with the window.
  await panel.locator('.viewer-lights_handle').first().click();
  expect(await page.evaluate(() => window.Viewer.transformText['Transform Light'])).toBe('translate');

  // In the exported manifest, with its name - and back from it.
  const lights = await page.evaluate(() => window.Viewer.build3IFManifest().AIM3DViewer.lights);
  expect(lights.some((light) => light.type === 'SpotLight' && light.name === 'Front')).toBe(true);
  expect(lights.some((light) => light.userData || light.type === 'SpotLight' && !light.target)).toBe(false);
  await page.evaluate((exported) => window.Viewer.apply3IFManifestLights(exported), lights);
  await expect(panel.locator('.viewer-lights_item')).toHaveCount(2);
  await expect(panel.locator('.viewer-lights_item-name').nth(1)).toHaveText('Front');
  await panel.locator('.viewer-lights_item').nth(1).click();

  await panel.locator('.viewer-lights_remove').click();
  await expect(panel.locator('.viewer-lights_item')).toHaveCount(1);
  await page.locator('#viewerLights .viewer-scene_header .viewer-scene_icon').click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => window.Viewer.transformText['Transform Light'])).toBe('');
  // The helper and the icons go with the window.
  expect(await lightHelperShown()).toBe(false);
  await expect.poll(markers).toBe(0);
});

// The tools for the kind of model shown (ui/format-tools.js, model-kind.js).
const formatTools = (page) => page.evaluate(() => {
  const toolbar = document.getElementById('viewerEditorToolbar');
  const keys = (list) => [...list].map((el) => el.dataset.tool || el.dataset.formatTool);
  return {
    kind: window.Viewer.getModelKind(),
    onBar: keys(toolbar.querySelectorAll(':scope > .is-format-tool')),
    inTray: keys(toolbar.querySelectorAll(':scope > .viewer-editor-toolbar_secondary-tray > .is-format-tool')),
    shortcuts: keys(toolbar.querySelectorAll('.viewer-menus_format > .viewer-menus_format-tool')),
    hidden: keys(document.querySelectorAll('.viewer-editor-tool.is-format-hidden')),
  };
});

test('classic toolbar: the tools for the model\'s kind come onto the bar, and go back with another model', async ({ page }) => {
  await openViewer(page, '/examples/points.las');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'pointcloud');
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['pointCloud', 'clippingPlanes', 'ruler']);
  const points = await formatTools(page);
  expect(points.inTray).toEqual([]);
  expect(points.hidden.sort()).toEqual(['shading', 'wireframe']);
  // After the transform tools, as a group of their own, the kind in the tooltip.
  const order = await page.evaluate(() => [...document.querySelectorAll('#viewerEditorToolbar > .viewer-editor-tool')].map((el) => el.dataset.tool));
  expect(order.indexOf('pointCloud')).toBe(order.indexOf('scale') + 1);
  const ruler = page.locator('#viewerEditorToolbar > button[data-tool="ruler"]');
  await expect(ruler).toHaveAttribute('data-group', 'format');
  await expect(ruler).toHaveAttribute('title', /· Point cloud$/);
  await expect(ruler).toBeVisible();
  await expect(page.locator('button[data-tool="shading"]')).toBeHidden();

  // A mesh: the point cloud's tools back in the tray, the mesh's on the bar.
  await page.selectOption('#example-model-select', './examples/tempietto/Tempietto.glb');
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'mesh', null, { timeout: 30_000 });
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['materials', 'shading', 'lights', 'ruler']);
  expect((await formatTools(page)).hidden).toEqual([]);
  expect(await page.evaluate(() => {
    const button = window.Viewer.editorToolbarButtons.clippingPlanes;
    return { inTray: button.parentElement.classList.contains('viewer-editor-toolbar_secondary-tray'), group: button.dataset.group, title: button.title === button.getAttribute('aria-label') };
  })).toEqual({ inTray: true, group: 'view', title: true });
  await expect(page.locator('#viewerEditorToolbar > button[data-tool="pointCloud"]')).toHaveCount(0);

  // A volume: its settings first, what a scan of voxels has no use for left out.
  await page.selectOption('#example-model-select', './examples/volumes/amphora-ct.nrrd');
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'volume' && window.Viewer.isVolumeActive?.(), null, { timeout: 60_000 });
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['volume', 'clippingPlanes', 'ruler']);
  expect((await formatTools(page)).hidden.sort()).toEqual(['ground', 'liveData', 'sceneSuggest', 'seasons', 'shading', 'weather', 'wireframe']);
});

test('classic toolbar: an IFC model brings its hierarchy and section tools to the top, two on a phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openViewer(page, '/examples/box.ifc');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'bim');
  // The IFC questions only with the worker's AI: the next ones take their place.
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['hierarchy', 'picking']);
  await context.close();
});

test('the toolbar profile of a manifest or the settings replaces the kind\'s tools, or turns them off', async ({ page }) => {
  await openViewer(page, '/examples/box.glb');
  await waitForModel(page);
  await page.waitForFunction(() => window.Viewer.getModelKind?.() === 'mesh');
  await page.evaluate(() => window.Viewer.applyEditorToolbarConfig(null, { profile: { promote: ['hierarchy', 'projection'], hide: ['weather'] } }));
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual(['hierarchy', 'projection']);
  expect((await formatTools(page)).hidden).toEqual(['weather']);
  // Exported with the manifest, and valid there.
  const manifest = await page.evaluate(() => window.Viewer.build3IFManifest());
  expect(manifest.AIM3DViewer.viewer.editorToolbar.profile).toEqual({ promote: ['hierarchy', 'projection'], hide: ['weather'] });
  expect(validateAIM3DManifest(manifest).errors).toEqual([]);
  const broken = structuredClone(manifest);
  broken.AIM3DViewer.viewer.editorToolbar.profile = { promote: 'ruler' };
  expect(validateAIM3DManifest(broken).errors.map((error) => error.path)).toEqual(['$.AIM3DViewer.viewer.editorToolbar.profile.promote']);

  await page.evaluate(() => window.Viewer.applyEditorToolbarConfig(null, { profile: false }));
  await expect.poll(async () => (await formatTools(page)).onBar).toEqual([]);
  expect((await formatTools(page)).hidden).toEqual([]);
});

test('menus: shortcuts to the model\'s own tools in the navigation, the tools staying in their menus', async ({ page }) => {
  await openViewer(page, '/examples/points.las', 'ui=menus');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  const toolbar = page.locator('#viewerEditorToolbar.viewer-menus');
  await expect(toolbar).toHaveAttribute('data-mode', 'desktop');
  await expect.poll(async () => (await formatTools(page)).shortcuts).toEqual(['pointCloud', 'clippingPlanes', 'ruler']);
  const nav = toolbar.locator('.viewer-menus_nav');
  await expect(nav.locator('.viewer-menus_nav-divider--format')).toBeVisible();
  // In their menu still, marked as the model's.
  await expect(toolbar.locator('.viewer-menus_group[data-category="analysis"] > [data-tool="ruler"]')).toHaveClass(/is-format-tool/);

  // A shortcut runs its tool and shows its state.
  const shortcut = nav.locator('[data-format-tool="ruler"]');
  await shortcut.click();
  await expect.poll(() => page.evaluate(() => window.Viewer.RULER_MODE)).toBe(true);
  await expect(shortcut).toHaveClass(/is-active/);
  await expect(shortcut).toHaveAttribute('title', /· Point cloud$/);
});

test('section planes cut a volume\'s rays, with no fill drawn for its box', async ({ page }) => {
  await openViewer(page, '/examples/volumes/amphora-ct.nrrd');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true && window.Viewer.isVolumeActive?.(), null, { timeout: 60_000 });
  await waitForCameraIdle(page);
  const canvas = page.locator('#MainCanvas');
  const before = await canvas.screenshot();

  await page.evaluate(() => {
    const viewer = window.Viewer;
    viewer.setClippingAxisEnabled('x', true, { silent: true });
    const range = viewer.getClippingAxisRange('x');
    viewer.setClippingAxisPosition('x', (range.min + range.max) / 2);
    viewer.setClippingFillVisible(true);
  });
  const nextFrames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await nextFrames();
  const state = await page.evaluate(() => {
    let volume = null;
    window.viewer.scene.traverse((object) => {
      if (!volume && object.isMesh && object.userData?.isVolume && object.material?.uniforms?.uClipCount) volume = object;
    });
    let fillBoxes = 0;
    window.viewer.scene.traverse((object) => {
      if (object.isMesh && object.userData?.isVolume && !object.material?.uniforms) fillBoxes += 1;
    });
    const plane = volume.material.uniforms.uClip.value[0];
    return { clips: volume.material.uniforms.uClipCount.value, plane: [plane.x, plane.y, plane.z, plane.w].map((v) => Math.abs(v) < 1e-6 ? 0 : Math.sign(v)), fillBoxes };
  });
  // The X plane in the box's own space (its X along the world's X), through
  // its middle; no crimson copy of the box.
  expect(state.clips).toBe(1);
  expect(state.plane.slice(1)).toEqual([0, 0, 0]);
  expect(state.plane[0]).not.toBe(0);
  expect(state.fillBoxes).toBe(0);
  // Half of the amphora gone.
  await expect.poll(async () => Buffer.compare(await canvas.screenshot(), before) !== 0).toBe(true);

  await page.evaluate(() => window.Viewer.setClippingAxisEnabled('x', false, { silent: true }));
  await nextFrames();
  expect(await page.evaluate(() => {
    let count = -1;
    window.viewer.scene.traverse((object) => {
      if (count < 0 && object.isMesh && object.userData?.isVolume && object.material?.uniforms?.uClipCount) count = object.material.uniforms.uClipCount.value;
    });
    return count;
  })).toBe(0);
});

// ultra.html (viewer/ultra.js): its own bundle, served from the build only.
test('ultra.html shows a compressed GLB and loads nothing of the full viewer', async ({ page }) => {
  test.skip(!process.env.CI, 'ultra.html is served from the build (CI), not the dev server');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));

  // Meshopt geometry and KTX2 textures: the Basis decoder comes from assets/.
  await page.goto('/ultra.html?model=./examples/compressed.glb');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'loaded', { timeout: 30_000 });
  await expect(page.locator('#viewer canvas')).toBeVisible();
  await expect(page.locator('.error')).toHaveCount(0);

  expect(requests).toContain('/assets/maps/lite/neutral.rgbe.webp');
  expect(requests.some((path) => path.includes('/basis/'))).toBe(true);
  // The loaders this model needs, on demand (Draco: it does not use it).
  expect(requests.some((path) => /^\/assets\/ultra\/KTX2Loader-[\w-]+\.js$/.test(path))).toBe(true);
  expect(requests.some((path) => /^\/assets\/ultra\/meshopt_decoder[\w.-]*\.js$/.test(path))).toBe(true);
  expect(requests.some((path) => path.includes('DRACOLoader') || path.includes('/draco/'))).toBe(false);
  // No stylesheet, font or chunk of the full viewer.
  expect(requests.filter((path) => /\.(css|woff2?)$|dfg_3dviewer-module|\/assets\/[\w.-]+\.js$/.test(path))).toEqual([]);
});

test('ultra.html says when there is no model or it cannot be loaded', async ({ page }) => {
  test.skip(!process.env.CI, 'ultra.html is served from the build (CI), not the dev server');
  await page.goto('/ultra.html');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('.error')).toContainText('?model=');

  await page.goto('/ultra.html?model=./examples/broken.glb');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error', { timeout: 15_000 });
  await expect(page.locator('.error')).toContainText('could not be loaded');
});

test('?ultralight=1 on the viewer pages opens ultra.html with the same parameters', async ({ page }) => {
  test.skip(!process.env.CI, 'ultra.html is served from the build (CI), not the dev server');
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });
  await page.goto('/embed.html?model=./examples/box.glb&ultralight=1&autorotate=1');
  await expect(page).toHaveURL(/\/ultra\.html\?model=\.%2Fexamples%2Fbox\.glb&autorotate=1$/);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'loaded', { timeout: 30_000 });
  // Not one chunk of the full viewer, nor a decoder (box.glb is not
  // compressed): only ultra.js's own three.
  expect(scripts.filter((path) => path.startsWith('/assets/') && !/^\/assets\/ultra\/three-[\w-]+\.js$/.test(path))).toEqual([]);

  await page.goto('/?model=./examples/box.glb&ultra=true');
  await expect(page).toHaveURL(/\/ultra\.html\?model=/);

  // Off: the full viewer.
  await page.goto('/embed.html?model=./examples/box.glb&ultralight=0');
  await expect(page).toHaveURL(/\/embed\.html\?/);
  await page.waitForSelector('#MainCanvas', { state: 'attached' });
});

test('the lightweight viewer lights the model with the small environment map', async ({ page }) => {
  test.skip(!process.env.CI, 'the build (CI) runs in lightweight mode');
  const maps: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('.hdr')) maps.push(path);
  });
  await openViewer(page, './examples/box.glb');
  await waitForModel(page);
  await expect.poll(() => maps).toContain('/assets/maps/lite/neutral.hdr');
  expect(maps.filter((path) => !path.includes('/maps/lite/'))).toEqual([]);
});
