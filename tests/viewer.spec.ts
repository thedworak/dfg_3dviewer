// @ts-check
import { test, expect } from '@playwright/test';

const defaultModel = '/examples/box.stl';
const supportedFormatsText = 'GLB, GLTF, OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, USD, USDA, USDC, USDZ, 3MF, AMF, WRL, KMZ, VOX, LWO, LAS, LAZ';
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

async function openViewer(page, modelPath = defaultModel) {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto(`/?e2eModel=${encodeURIComponent(modelPath)}`);
  await page.waitForSelector('#MainCanvas', { state: 'attached' });
}

async function openSandboxViewer(page) {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto('/?sandbox=1');
  await page.waitForSelector('#MainCanvas', { state: 'attached' });
}

async function waitForModel(page, timeout = 15_000) {
  await page.waitForFunction(() => window.viewer?.modelLoaded === true, {
    timeout,
  });
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

  await panel.locator('.viewer-tour-panel_close').click();
  await expect(panel).toHaveCount(0);
});

test('embed configurator uses the current camera for preview url', async ({ page }) => {
  await openViewer(page);
  await waitForModel(page);
  await page.waitForFunction(() => window.Viewer?.camera && window.Viewer?.controls);

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

  // Let the camera finish its intro flight before comparing poses: it starts
  // at the end of loading, so wait for that, then for a few still samples.
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true);
  const cameraPose = () => page.evaluate(() => window.Viewer.captureCurrentAnnotationView());
  let cameraBefore = await cameraPose();
  let stillSamples = 0;
  await expect.poll(async () => {
    const previous = cameraBefore;
    await page.waitForTimeout(250);
    cameraBefore = await cameraPose();
    stillSamples = JSON.stringify(cameraBefore) === JSON.stringify(previous) ? stillSamples + 1 : 0;
    return stillSamples >= 3;
  }, { timeout: 15_000 }).toBe(true);
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

test('preview=0 skips the progressive preview', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('.preview.glb')) requests.push(request.method());
  });
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });
  await page.goto('/?e2eModel=%2Fexamples%2Fcompressed.glb&preview=0');
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
  // Centred on the origin (ECEF-far or not) - whether it is also grounded on
  // the grid depends on the viewer configuration, as for any model.
  expect(Math.abs(scene.centerX)).toBeLessThan(100);
  expect(Math.abs(scene.centerZ)).toBeLessThan(150);
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
  expect(Math.abs(cloud.centerX)).toBeLessThan(1);
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
