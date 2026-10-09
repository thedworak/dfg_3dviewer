import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // CI renders with software WebGL on small runners (2 vCPU for a private
  // repository): waits on rendered frames take several times longer there.
  timeout: process.env.CI ? 60_000 : 30_000,

  expect: {
    timeout: process.env.CI ? 15_000 : 5_000,
  },

  // On CI: lets --shard split single tests rather than whole files (all the
  // tests are in one file, so by file one shard would get all of them).
  fullyParallel: !!process.env.CI,

  workers: process.env.CI ? 1 : undefined,

  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [
        ['list'],
        ['github'],
        ['html', { outputFolder: 'playwright-report' }],
      ]
    : 'html',

  use: {
    baseURL: process.env.CI
      ? 'http://localhost:4173'
      : 'http://localhost:1234',

    // WebGL STABILITY
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-gpu-driver-bug-workarounds',
        '--disable-dev-shm-usage',
      ],
    },

    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 800 },

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    colorScheme: 'light',
    reducedMotion: 'reduce',
  },

  projects: [
    {
      name: 'chromium-webgl',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: process.env.CI
    ? {
        command: 'HOST=127.0.0.1 PORT=4173 DIST_DIR=dist/test node scripts/serve-dist.js',
        port: 4173,
        timeout: 120_000,
      }
    : {
        command: 'npm run dev',
        port: 1234,
        reuseExistingServer: true,
      },
});
