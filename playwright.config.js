import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,

  expect: {
    timeout: 5_000,
  },

  fullyParallel: true,

  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',

    // 🔑 WebGL STABILITY
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

    // 🎯 deterministyczne testy
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 800 },

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // 🧪 ważne dla WebGL
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

    // Firefox – opcjonalnie (słabsze WebGL)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // WebKit – TYLKO jeśli celujesz w Safari/iOS
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
