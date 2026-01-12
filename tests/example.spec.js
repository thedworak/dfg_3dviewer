// @ts-check
import { test, expect } from '@playwright/test';

test('viewer runs in E2E mode', async ({ page }) => {
  // 1️⃣ ZAINICJUJ FLAGĘ PRZED ZAŁADOWANIEM STRONY
  await page.addInitScript(() => {
    window.__E2E__ = true;
  });

  // 2️⃣ DOPIERO TERAZ OTWÓRZ STRONĘ
  await page.goto('/viewer');

  // 3️⃣ Sprawdź, czy flaga faktycznie istnieje
  const isE2E = await page.evaluate(() => window.__E2E__);
  expect(isE2E).toBe(true);

  // 4️⃣ (opcjonalnie) sprawdź reakcję aplikacji
  await page.waitForFunction(() =>
    window.viewer?.e2eMode === true
  );
});