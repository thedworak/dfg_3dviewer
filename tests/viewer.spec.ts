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

// The camera's intro flight starts at the end of loading (after
// modelLoaded); wait for loading to finish and the camera to stand still, so
// a test's own camera changes are not overwritten by it.
async function waitForCameraIdle(page) {
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true);
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

  await panel.locator('.viewer-tour-panel_close').click();
  await expect(panel).toHaveCount(0);
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

test('point cloud panel changes colours, shape and size, and only appears for point clouds', async ({ page }) => {
  await openViewer(page, '/examples/points.laz');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  const panel = page.locator('#viewerPointCloudPanel');
  await expect(panel).toBeVisible();
  const colorSelect = panel.locator('select').nth(1);
  await expect(colorSelect.locator('option')).toHaveText(['RGB', 'Intensity', 'Height']);

  const pointsState = () => page.evaluate(() => {
    const points = window.Viewer.resolveObjectByTargetId('m0:root').children.find((child) => child.isPoints);
    const color = points.geometry.getAttribute('color').array;
    return {
      firstColors: Array.from(color.slice(0, 6)),
      round: Boolean(points.material.defines?.ROUND_POINTS !== undefined),
      size: points.material.size,
    };
  });
  const before = await pointsState();

  await colorSelect.selectOption('height');
  await panel.locator('select').nth(0).selectOption('round');
  await panel.locator('input[type=range]').first().fill('75');
  const after = await pointsState();
  expect(after.firstColors).not.toEqual(before.firstColors);
  expect(after.round).toBe(true);
  expect(after.size).toBeGreaterThan(before.size * 1.5);

  // Back to the file's own colours.
  await colorSelect.selectOption('rgb');
  expect((await pointsState()).firstColors).toEqual(before.firstColors);

  // Streamed clouds: Eye-Dome Lighting and level-of-detail colours through the plugin.
  await openViewer(page, '/examples/tiles/wolpa-points/tileset.json');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 20_000 });
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[type=range]')).toHaveCount(2);
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
