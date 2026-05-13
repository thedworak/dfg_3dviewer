// @ts-check
import { test, expect } from '@playwright/test';

const defaultModel = '/examples/box.stl';
const supportedFormatsText = 'OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, GLTF, GLB, ZIP, RAR, TAR, XZ, GZ';
const sandboxDropMessage = 'Drag and drop a 3D model into the viewer.';
const sandboxSupportedFormatsNotice = `Supported formats: ${supportedFormatsText}.`;
const sandboxDropNotice = `${sandboxDropMessage} ${sandboxSupportedFormatsNotice}`;
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

test('sandbox mode starts without loading a model', async ({ page }) => {
  await openSandboxViewer(page);

  await page.waitForFunction(
    (expectedNotice) => window.viewer?.toasts?.includes(expectedNotice),
    sandboxDropNotice
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
  expect(state.toasts).toContain(sandboxDropNotice);
  expect(state.guiHidden).toBe(true);
  expect(state.sandboxNoticeVisible).toBe(true);
  expect(state.noticeContainerCentered).toBe(true);
});

test('sandbox notice updates after language changes', async ({ page }) => {
  await openSandboxViewer(page);

  const notice = page.locator('#viewerStatusNotice[data-variant="sandbox"]');
  await expect(notice.locator('.viewer-notice-message')).toHaveText(sandboxDropMessage);
  await expect(notice.locator('.viewer-notice-detail')).toHaveText(sandboxSupportedFormatsNotice);

  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#viewerLanguageMode')?.click();
    document.querySelector<HTMLElement>('.language-dropdown-item-polish')?.click();
  });

  await expect(notice.locator('.viewer-notice-message')).toHaveText("Przeciągnij i upuść model 3D w oknie viewer'a.");
  await expect(notice.locator('.viewer-notice-detail')).toHaveText(`Obsługiwane formaty: ${supportedFormatsText}.`);
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
