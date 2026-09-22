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
