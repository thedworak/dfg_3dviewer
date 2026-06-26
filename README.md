# DFG 3D Viewer — JavaScript Library

Three.js-based 3D viewer. Builds standalone HTML demos and a minified Drupal bundle.

**Drupal integration** is provided by the separate [`dfg_3dviewer`](https://gitlab.nasarek.dev/rnsrk/dfg_3dviewer_drupal_module) module.

## Build targets

```bash
npm install
npm run build:dev            # dist/dev    — standalone + PHP admin panel
npm run build:test           # dist/test   — standalone + PHP admin panel
npm run build:prod           # dist/prod   — standalone, no admin
npm run build:drupal         # dist/drupal/main   — minified Drupal bundle, no admin/examples/settings
npm run build:drupal:custom  # dist/drupal/custom — unminified, fully-featured Drupal variant for customization
```

| Target | Output | admin | examples + HTML | viewer-settings.json | minified |
|---|---|:--:|:--:|:--:|:--:|
| `dev` / `test` | `dist/dev`, `dist/test` | ✅ | ✅ | ✅ (localhost) | ❌ |
| `prod` | `dist/prod` | ❌ | ✅ | ✅ | ✅ |
| `drupal` | `dist/drupal/main` | ❌ | ❌ | ❌ (Drupal-managed) | ✅ |
| `drupal:custom` | `dist/drupal/custom` | ✅ | ✅ | ✅ (Drupal paths) | ❌ |

Releases ship the whole repo with the built `dist/` inside — there is no separate library zip.

## Local development

```bash
cp viewer/viewer-settings-example.json viewer-settings.json
npm run dev:test
# http://localhost:1234
```

## Install on Drupal

1. Place this repo (with its built `dist/`) at `web/libraries/dfg-3dviewer/`. The Drupal module loads assets from `web/libraries/dfg-3dviewer/dist/drupal/main/`.

   ```bash
   git clone https://gitlab.nasarek.dev/rnsrk/dfg_3dviewer_js_library.git web/libraries/dfg-3dviewer
   cd web/libraries/dfg-3dviewer && npm install && npm run build:drupal
   ```

   Run from your Drupal project root (e.g. `/opt/drupal`).

2. Enable the `dfg_3dviewer` Drupal module and configure at `/admin/config/dfg_3dviewer`

## Standalone embed

```html
<div id="DFG_3DViewer" 3d="./examples/box.stl"></div>
<script type="module" src="./dfg_3dviewer-module.js"></script>
```

Or pass config in code: `await Viewer.MainInit({ ... })`.

## Repository layout

- `viewer/` — source (incl. `viewer/admin/` PHP panel)
- `dist/` — build output (gitignored in source; built for releases)
- `rollup.config.js` — build configuration
- `tests/` — Playwright E2E
