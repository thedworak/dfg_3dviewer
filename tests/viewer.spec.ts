// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { validateAIM3DManifest } from '../viewer/manifesto/aim3dviewer-validation.js';
import { inspectAIM3DManifest, manifestFeatureIcons } from '../viewer/manifesto/manifest-inspection.js';
import { retargetManifest } from '../viewer/manifesto/retarget-manifest.js';
import { buildIfcSummary, runIfcFilter } from '../viewer/ai/ifc-filter.js';

const defaultModel = '/examples/box.stl';
const supportedFormatsText = 'GLB, GLTF, OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, USD, USDA, USDC, USDZ, 3MF, AMF, WRL, KMZ, VOX, LWO, LAS, LAZ, SPZ, SPLAT, KSPLAT, SOG, RAD';
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

test('viewer runs in E2E mode', async ({ page }) => {
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

test('camera rotates on mouse drag', async ({ page }) => {
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

test('progressive loading shows the preview first and swaps in the full compressed model', async ({ page }) => {
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

test('LAZ point clouds load directly, re-centred in double precision', async ({ page }) => {
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
test('Potree 2 clouds stream by range requests, with intensity, height and classification colours', async ({ page }) => {
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
  test.setTimeout(60_000);
  await page.context().route('**/examples/generated-scan.las', (route) => route.fulfill({
    body: buildLas14(300_000),
    contentType: 'application/octet-stream',
  }));
  await openViewer(page, '/examples/generated-scan.las');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
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
  await expect(page.locator('button[data-tool="shading-custom"]')).toBeHidden();
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

test('manifest thumbnails stay above the viewer when the manifest makes it a movable window', async ({ page }) => {
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

test('IIIF Presentation 4 scenes: camera, lights, transforms and point comments round-trip', async ({ page }) => {
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

test('shading modes: the original materials come back untouched, switched-out ones are released, scan views and manifests', async ({ page }) => {
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
  // The submenu button (its tool sits in the toolbar's folded tray).
  await page.evaluate(() => document.querySelector('[data-tool="shading-original"]').click());
  expect(await material()).toMatchObject({ original: true, type: prepared.type });
  expect(await page.evaluate(() => window.Viewer.__released)).toBe(true);
  await expect(page.locator('[data-tool="shading-original"]')).toHaveClass(/is-active/);

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
  const after = await page.evaluate(async () => {
    const frames = window.viewer.renderer.info.render.frame;
    await new Promise((resolve) => setTimeout(resolve, 300));
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
      framesRunning: window.viewer.renderer.info.render.frame > frames,
    };
  });
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

test('Gaussian splats: .splat files and PLYs of splats are drawn by Spark, upright and framed like any model', async ({ page }) => {
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
  expect(await splatPixelShare(page)).toBeGreaterThan(0.02);

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
  expect(await splatPixelShare(page)).toBeGreaterThan(0.005);
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
  expect(await splatPixelShare(page)).toBeGreaterThan(0.02);

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

test('example manifests: all valid, and the scan views open as written (shading, ambient occlusion, raking light, custom shader)', async ({ page }) => {
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

test('IIIF Presentation 4 export keeps every model of the scene and its background colour', async ({ page }) => {
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

test('upload panel shows limit usage and limit errors from the worker', async ({ page }) => {
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
  await page.click('#uploadPanelSubmit');
  await expect(page.locator('#uploadPanelStatus')).toHaveText(
    'Upload limit reached (20 per hour). Try again in 25 min.'
  );
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
  await page.click('#uploadPanelSubmit');

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
  expect(await page.evaluate(() => localStorage.getItem('dfg3dviewer-example-models'))).toBeNull();
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
  await expect(groups.locator('summary > span:first-child')).toHaveText(['Tempietto', 'Wolpa Synagogue', 'ExPlora4D showcase']);
  await expect(panel.locator('details[data-group="aim3d:showcase"] .examples-panel-count')).toHaveText('12');
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

test('reports a missing model file instead of hanging', async ({ page }) => {
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

test('reports a corrupted model file instead of hanging', async ({ page }) => {
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
  // The submenus open on hover; the buttons' own handlers are what matters here.
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

test('toolbar menus on a desktop: the tools sorted into named menus, submenus opening in place', async ({ page }) => {
  await openViewer(page, '/examples/tempietto/Tempietto.glb', 'ui=menus');
  await waitForModel(page);
  const toolbar = page.locator('#viewerEditorToolbar.viewer-menus');
  await expect(toolbar).toHaveAttribute('data-mode', 'desktop');
  const tabs = toolbar.locator('.viewer-menus_tab:visible .viewer-menus_tab-label');
  await expect(tabs).toHaveText(['Look', 'Analysis', 'Model', 'Story', 'File', 'Settings']);
  // Icons only; the name shows over the icon on hover, moving nothing.
  const lookTab = toolbar.locator('.viewer-menus_tab[data-menu="look"]');
  const lookLabel = lookTab.locator('.viewer-menus_tab-label');
  const opacity = () => lookLabel.evaluate((el) => getComputedStyle(el).opacity);
  expect(await opacity()).toBe('0');
  const tabBefore = await toolbar.locator('.viewer-menus_tab[data-menu="analysis"]').boundingBox();
  await lookTab.hover();
  await expect.poll(opacity).toBe('1');
  expect((await lookLabel.boundingBox()).y + 5).toBeLessThan((await lookTab.boundingBox()).y);
  expect(await toolbar.locator('.viewer-menus_tab[data-menu="analysis"]').boundingBox()).toEqual(tabBefore);
  await page.mouse.move(700, 300);
  // At hand, outside the menus: navigating and the view.
  const nav = toolbar.locator('.viewer-menus_nav > [data-tool]:visible:not(.viewer-menus_grip)');
  await expect(nav).toHaveCount(3);
  expect(await nav.evaluateAll((buttons) => buttons.map((button) => button.dataset.tool))).toEqual(['orbit', 'resetCamera', 'fullScreen']);
  // Moving, turning, scaling and measuring, the parts, and what only some
  // models have (hidden here: no variants, IFC or point cloud): under Model.
  await toolbar.locator('.viewer-menus_tab[data-menu="model"]').click();
  const tools = toolbar.locator('.viewer-menus_group[data-category="model"] > [data-tool]:visible');
  expect(await tools.evaluateAll((buttons) => buttons.map((button) => button.dataset.tool))).toEqual(['move', 'rotate', 'scale', 'upAxis', 'ruler', 'hierarchy', 'picking']);
  await toolbar.locator('.viewer-menus_group[data-category="model"] [data-tool="move"]').click();
  expect(await page.evaluate(() => window.Viewer.transformText['Transform 3D Object'])).toBe('translate');
  await toolbar.locator('.viewer-menus_nav [data-tool="orbit"]').click();
  expect(await page.evaluate(() => window.Viewer.transformText['Transform 3D Object'])).toBe('');
  await page.keyboard.press('Escape');

  // Settings: the language and theme of the classic main menu, then help;
  // its cog is gone. The projection is under Look.
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
  await expect(toolbar.locator('.viewer-menus_group[data-category="look"] > [data-tool]').first()).toHaveAttribute('data-tool', 'projection');
  await page.keyboard.press('Escape');

  // Analysis: the sun and the raking light, out of Lights.
  await toolbar.locator('.viewer-menus_tab[data-menu="analysis"]').click();
  const panel = toolbar.locator('.viewer-menus_panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.viewer-menus_group.is-shown > [data-tool]:visible')).toHaveCount(4);
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

test('toolbar menus on a phone: tabs along the bottom, a sheet, then a rail once turned', async ({ browser }) => {
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
  await expect(panel.locator('.viewer-menus_group.is-shown .viewer-menus_group-title')).toHaveText(['File', 'Settings']);
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

test('manifest inspection: every example is fine and every attribute known', () => {
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
    'model', 'metadata', 'camera', 'lights', 'timeline', 'location', 'sun', 'transform', 'rendering', 'settings',
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

test('validation report: X/Y passed, rows with their issues, the worker check of the model', async ({ page }) => {
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
