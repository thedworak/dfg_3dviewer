// @ts-check
import { test, expect } from '@playwright/test';

const defaultModel = '/examples/box.stl';
const supportedFormatsText = 'GLB, GLTF, OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD';
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

async function waitForModel(page) {
  await page.waitForFunction(() => window.viewer?.modelLoaded === true, {
    timeout: 15_000,
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
      toolbarParentIsWrapperAfterExit: document.querySelector('#viewerEditorToolbar')?.parentElement === wrapper,
    };
  });

  expect(state.requestedContainer).toBe(true);
  expect(state.toolbarIsInsideContainer).toBe(true);
  expect(state.toolbarParentIsContainer).toBe(true);
  expect(state.toolbarParentIsWrapperAfterExit).toBe(true);
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
    await openViewer(page, example.path);
    await waitForModel(page);

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
