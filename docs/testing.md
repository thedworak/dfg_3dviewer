# Testing

End-to-end tests use [Playwright](https://playwright.dev/) and live in `tests/viewer.spec.ts`.
Configuration is in `playwright.config.js`.

## Run locally

```bash
npm run test:local
```

This runs `scripts/run-local-tests.sh`, which:

1. builds the test bundle (`npm run build:test`), then
2. runs `CI=1 npx playwright test tests/viewer.spec.ts --project chromium-webgl --workers=1`.

## Configuration highlights

- **Single project:** `chromium-webgl` (Desktop Chrome).
- **WebGL stability:** Chromium is launched with ANGLE/SwiftShader flags so software WebGL works
  in headless CI (`--use-gl=angle`, `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, …).
- **Web server:**
    - In CI: `HOST=127.0.0.1 PORT=4173 DIST_DIR=dist/test node scripts/serve-dist.js` on port 4173.
    - Locally: `npm run dev` on port 1234 (reusing an existing server if present).
- **Artifacts:** screenshots on failure, video and trace retained on failure; the HTML report is
  written to `playwright-report/`.

!!! note
    The local web-server command in `playwright.config.js` is `npm run dev`. Day-to-day local runs
    typically go through `npm run test:local` (which builds and uses the CI server config), or you
    can start `npm run dev:test` manually before running Playwright against `http://localhost:1234`.

## Continuous integration

`.github/workflows/playwright.yml` runs on every push and pull request:

1. checkout, set up Node 24,
2. `npm ci`,
3. `npx playwright install --with-deps chromium`,
4. `npm run build:test`,
5. `npx playwright test` with `CI=true`,
6. upload the `playwright-report/` artifact (retained 30 days).
