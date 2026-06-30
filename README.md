# DLF AIM 3D Viewer — JavaScript Library

A [three.js](https://threejs.org/)-based 3D viewer. This repository holds the viewer runtime
source, the Rollup build tooling, an optional PHP admin panel, demo/embed pages and Playwright
tests. It builds standalone HTML demos, a minified Drupal bundle and an unminified customizable
Drupal variant.

**Drupal integration** (PHP/YAML glue plus the server-side conversion/rendering pipeline) lives
in the separate [`dlf_aim_3d_viewer`](https://gitlab.nasarek.dev/rnsrk/dlf_aim_3d_viewer_drupal_module)
module. This library renders supported formats directly in the browser; conversion to GLB and
Blender-based thumbnail rendering are handled server-side by that module.

Supported formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, GLB, glTF.

## Quickstart

Requires **Node.js 24+** and a WebGL-capable browser.

```bash
npm install
cp viewer/viewer-settings-example.json viewer-settings.json
npm run dev:test
# http://localhost:1234
```

Build a static bundle instead (see all targets in the docs):

```bash
npm run build:test   # dist/test — standalone bundle
npm run serve:dist   # preview it locally
```

Embed the built viewer:

```html
<div id="DLF_AIM_3DViewer" 3d="./examples/box.stl" style="height: 50vh"></div>
<script type="module" src="./dlf_aim_3d_viewer-module.js"></script>
```

## Documentation

Full docs live in [`docs/`](docs/) (run `mkdocs serve` to preview):

- [Getting started](docs/getting-started.md) — install, dev server, settings
- [Build targets](docs/build-targets.md) — every output target and what it contains
- [npm scripts](docs/npm-scripts.md) — full script reference
- [viewer-settings.json](docs/viewer-settings.md) — runtime configuration
- [Embedding](docs/embedding.md) — `embed.html` and URL parameters
- [Admin panel](docs/admin-panel.md) — optional PHP/SQLite settings UI
- [Architecture](docs/architecture.md) — repository layout, build pipeline, how dependencies are wired
- [Function reference](docs/function-reference.md) · [Testing](docs/testing.md)
