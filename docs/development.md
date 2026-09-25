# Minimal local setup

1. Install Node dependencies:

```bash
npm install
```

2. Create the runtime settings file:

```bash
cp viewer/viewer-settings-example.json viewer/viewer-settings.json
```

3. Start the dev server:

```bash
npm run dev:test
```

or using serve:
```bash
npx serve -n
```

or using PHP:
```bash
php -S 127.0.0.1:8000 -t ../../viewer
```

4. Open the demo at:

```text
http://localhost:1234
```

> `viewer/viewer-settings.json` is required at runtime when running from source. Use the example file as the starting point.

## Build and serve locally

To create a static dist bundle and preview it locally:

```bash
npm run build:test
npm run serve:dist
```

This writes build output into `dist/test/` and serves it with a small HTTP server.

## Main npm scripts

- `npm run dev:test` — start Parcel dev server with `BUILD_SOURCE=IIIF`, `BUILD=test`
- `npm run dev:dev` — start Parcel dev server with `BUILD_SOURCE=''`, `BUILD=test`
- `npm run dev:prod` — start Parcel dev server with `BUILD=prod`
- `npm run build:test` — Rollup build for `dist/test`
- `npm run build:dev` — Rollup build for `dist/dev`
- `npm run build:prod` — Rollup build for `dist/prod`
- `npm run build:drupal` — Drupal-specific build using `scripts/build-drupal.js`
- `npm run build:drupal:custom` — custom Drupal build with module prefix
- `npm run watch` — Rollup watch mode for live rebuilds
- `npm run serve:dist` — serve the current `dist` folder with `serve`
- `npm run pack-dist` — package `dist/` into `dfg_3dviewer-dist.zip`
- `npm run dev:tauri` — build dev bundle and serve for Tauri development
- `npm run tauri:dev` — run Tauri in dev mode
- `npm run tauri:build` — build the Tauri desktop app

## Runtime entry points

- `viewer/main.js` — current viewer runtime entry point in source mode
- `index.html` — demo page used by local builds and `dist` preview
- `embed.html` — viewer embed page with URL controls

In built output, the generated bundle is exposed through the module entry `dfg_3dviewer-module.js`.

## Viewer function reference

A separate reference file documents the main exported runtime functions and helpers used by the viewer.
- `viewer/FUNCTIONS.md` — function descriptions for `Viewer`, loader helpers, metadata handlers, utilities, and build/runtime helpers.

## Packaging and releases

- `npm run pack-dist` packages the distribution into `dfg_3dviewer-dist.zip`
- the repo also contains a GitHub Actions workflow for building release artifacts on tags

## Tauri standalone app (testing)

This repo also includes a Tauri desktop wrapper in `src-tauri/`.

- `npm run tauri:dev` — run the app in Tauri dev mode
- `npm run tauri:build` — build the standalone desktop executable

## Mobile app (Capacitor, Android)

The viewer is packaged as a mobile app with [Capacitor](https://capacitorjs.com): the same bundle runs in the system WebView, served from `https://localhost` inside the app, so it works offline.

- `npm run build:mobile` — build the app bundle into `dist/mobile` (no PHP helpers, admin panel or source maps)
- `npm run cap:sync` — build and copy the bundle into the native project (`android/`)
- `npm run cap:android` — sync and open the project in Android Studio

Building the APK needs Android Studio (or the Android SDK plus JDK 21). iOS needs macOS with Xcode (`npx cap add ios`).

The app runs online and offline:

- **Offline** — the header's device button opens *Models on this device*: models kept on the device, and *Browse files…*, which opens a model or `.zip` (model plus textures) from the device and keeps a copy there. Drag-and-drop in the browser takes the same path.
- **Online** — the model browser connects to a repository (a standalone worker deployment, see [docker.md](docker.md)): its address is entered at the top of the panel and kept on the device; the build's default is empty, or `MOBILE_REMOTE_URL=https://… npm run build:mobile`. The worker API calls go there (`viewer/remote.js`, `apiUrl()`), and the worker already answers with `Access-Control-Allow-Origin: *`, so nothing changes on the server. Each single-file model there can be kept on the device (the download button next to it), with its thumbnail; 3D Tiles tilesets cannot. Without a repository, upload is hidden.

The kept models live in IndexedDB (`viewer/offline-library.js`), as files, so the same library works in the browser too. `viewer/connectivity.js` keeps `core.isOnline` current and sets `body.viewer-offline`, which hides the controls that need a server while there is no network.

The repository must be reachable over `https://`: the app itself runs on `https://localhost`, and Android blocks plain `http://` requests from it.

Sign-in and user management are hidden in the app: the worker's session cookie is `SameSite=Lax` and never reaches the app, which runs on another origin. Uploads therefore only work against a worker with accounts off.

## Notes

- Always serve the viewer over HTTP(S). `file://` mode usually fails because of module import and fetch restrictions.
- For local preview use `npm run serve:dist` or `npm run dev:test`.
- If you use `pack-dist`, make sure `zip` is installed on your system.
- Drupal builds use `npm run build:drupal` or `npm run build:drupal:custom`.

## More information

- `viewer/viewer-settings-example.json` — runtime configuration template
- `viewer/viewer-settings.js` — runtime settings loader used by built/source bundles
- `rollup.config.js` — build output and asset copy configuration
- `scripts/convert.sh` — conversion and Blender rendering helper
- `scripts/ifc_metadata.py` — exports IFC property sets/spatial tree to `<name>_ifc.json` (needs `ifcopenshell`)
- `dfg_3dviewer.libraries.tpl.yml` — Drupal libraries template used in Drupal build
