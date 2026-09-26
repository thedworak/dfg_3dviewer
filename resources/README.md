# App icon and splash screen (Capacitor, Android)

Source images for the app build. `pnpm run cap:assets` turns them into every
Android density under `android/app/src/main/res/` (mipmap-* icons,
drawable-*/splash.png); run it after replacing any of them, then
`pnpm run cap:sync`. The files here are placeholders.

| File                  | Size        | What it is |
|-----------------------|-------------|------------|
| `icon-only.png`       | 1024 × 1024 | Legacy icon (Android < 8), full square, no transparency |
| `icon-foreground.png` | 1024 × 1024 | Adaptive icon foreground, transparent; keep the artwork inside the centre 66% (the launcher masks the rest) |
| `icon-background.png` | 1024 × 1024 | Adaptive icon background, solid colour or pattern |
| `splash.png`          | 2732 × 2732 | Splash, light theme; artwork centred inside about 1200 × 1200 (cropped on narrow screens) |
| `splash-dark.png`     | 2732 × 2732 | Splash, dark theme (same rules) |

Background colours for generated fallbacks are set in the `cap:assets` script
(package.json). After generating, `scripts/optimize-android-splash.mjs` turns
every `splash.png` into a lossy `splash.webp` (a photo-like splash is several
MB per density as PNG). On Android 12+ the system splash shows the app icon on that
background instead of `splash.png`.

The splash stays up until the first model is loaded or fails to load
(`viewer/app-splash.js`, `SplashScreen` in capacitor.config.json), at most 6 s.
