// @ts-check
import { test, expect } from '@playwright/test';

test('viewer runs in E2E mode', async ({ page }) => {
  // Init
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  // Open page
  await page.goto('/');
  await page.waitForSelector('#MainCanvas', { state: 'attached' });

  // check canvas visible
  const canvas = page.locator('#MainCanvas');
  await expect(canvas).toBeVisible();

  // WebGL alive
  const hasWebGL = await canvas.evaluate((el) => {
    const gl =
      el.getContext('webgl2') ||
      el.getContext('webgl');
    return !!gl;
  });

  expect(hasWebGL).toBe(true);

  // E2E mode active
  const isE2E = await page.evaluate(() => window.__E2E__);
  expect(isE2E).toBe(true);
});

test('model loads into scene', async ({ page }) => {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto('/');

  await page.waitForFunction(
    () => window.viewer?.modelLoaded === true,
    { timeout: 10_000 }
  );

  expect(await page.evaluate(() => window.viewer.modelLoaded)).toBe(true);
});

test('scene contains objects', async ({ page }) => {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto('/');

  await page.waitForFunction(() => window.viewer?.modelLoaded === true);

  const objectCount = await page.evaluate(() => {
    return window.viewer.scene.children.length;
  });

  expect(objectCount).toBeGreaterThan(0);
});

test('camera rotates on mouse drag', async ({ page }) => {
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  await page.goto('/');

  await page.waitForFunction(() => window.viewer?.camera);

  const before = await page.evaluate(() => ({
    x: window.viewer.camera.position.x,
    y: window.viewer.camera.position.y,
    z: window.viewer.camera.position.z,
  }));

  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(600, 300);
  await page.mouse.up();

  const after = await page.evaluate(() => ({
    x: window.viewer.camera.position.x,
    y: window.viewer.camera.position.y,
    z: window.viewer.camera.position.z,
  }));

  expect(after.x).not.toBe(before.x);
});