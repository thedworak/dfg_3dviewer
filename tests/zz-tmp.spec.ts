import { test } from '@playwright/test';
test('tmp spark', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__E2E__ = true; });
  await page.goto('/?e2eModel=' + encodeURIComponent('/examples/tempietto/Tempietto.splat') + '&ui=classic');
  await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  for (let i = 0; i < 3; i++) {
    // orbit a bit so Spark re-sorts, then switch model right away
    await page.mouse.move(640, 500); await page.mouse.down(); await page.mouse.move(700, 520, { steps: 5 }); await page.mouse.up();
    await page.selectOption('#example-model-select', './examples/points.laz');
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
    await page.selectOption('#example-model-select', './examples/tempietto/Tempietto.splat');
    await page.waitForFunction(() => window.viewer?.fullModelLoaded === true, null, { timeout: 30_000 });
  }
  await page.waitForTimeout(1500);
  console.log('ERRORS', JSON.stringify(errors));
});
