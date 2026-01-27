import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,

  expect: {
    timeout: 5_000,
  },

  fullyParallel: true,

  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:1234',

    // WebGL STABILITY
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=gl',
        '--enable-webgl',
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
        command: 'npx serve dist -p 4173',
        port: 4173,
        timeout: 120_000,
      }
    : {
        command: 'npm run dev',
        port: 1234,
        reuseExistingServer: true,
      },
});
