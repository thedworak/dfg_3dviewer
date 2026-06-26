# Architecture

## Repository layout

```text
dfg_3dviewer/
├── index.html                     # demo page with model picker
├── embed.html                     # embeddable viewer (URL-parameter driven)
├── rollup.config.js               # build configuration (all targets)
├── package.json                   # npm scripts + dependencies
├── playwright.config.js           # Playwright config
├── viewer-settings-example.json   # root settings template
├── scripts/
│   ├── run-local-tests.sh         # build test bundle + run Playwright
│   └── serve-dist.js              # zero-dependency static server (used by CI)
├── tests/
│   └── viewer.spec.ts             # Playwright end-to-end tests
└── viewer/
    ├── main.js                    # runtime entry: the exported `Viewer` object
    ├── loaders.js                 # per-format model loaders + environment sync
    ├── metadata.js                # metadata fetching, panel rendering, IIIF
    ├── viewer-utils.js            # clipping planes, toasts, camera/background helpers
    ├── utils.js                   # generic math/color/URL helpers
    ├── viewer-settings.js         # runtime settings loader (loadSettings)
    ├── viewer-settings-example.json
    ├── editor/                    # annotations, materials editor, measurement, picking, thumbnail capture
    ├── admin/                     # optional PHP admin panel (+ api/)
    ├── php/                       # editor.php, fetchWissKI.php, thumbnail_upload.php
    ├── IIIF/ , manifesto/         # IIIF / manifesto support
    ├── css/ , img/ , fonts/ , js/ # static assets copied into dist/assets
    └── examples/                  # bundled example models (box.stl, box.glb, …)
```

## Runtime entry points

- **`viewer/main.js`** — the viewer runtime entry in source mode. Exposes the `Viewer` object
  and core entry points (`MainInit`, `mainLoadModel`, …).
- **`index.html`** — demo page used by local builds and the `dist` preview.
- **`embed.html`** — embeddable viewer page with URL controls (see [Embedding](embedding.md)).

In built output, the generated bundle is exposed as `dfg_3dviewer-module.js` (or
`dfg_3dviewer.min.js` for the Drupal `main` build).

## Build pipeline

The build is a single Rollup config with `viewer/main.js` as input. Notable behaviour:

- **Code splitting** — three.js is split into its own `three` chunk via `manualChunks`.
- **Asset handling** — `@rollup/plugin-url` inlines/copies `svg/png/jpg/gif/hdr` assets into
  `assets/`; a custom `copyBuildAssets` plugin copies CSS/fonts/img/maps, Draco and web-ifc, and
  (for standalone targets) the demo pages and examples.
- **Replacements** — `@rollup/plugin-replace` injects build-time constants:
  `__BUILD_SOURCE__`, `__BUILD__`, `__IS_PROD__`, `__MODULES_PATH__`, `__ENV_SUBDIR__`.
- **Minification** — only for `prod` and the Drupal `main` build (via `@rollup/plugin-terser`).
- **Warning filtering** — `THIS_IS_UNDEFINED` and `CIRCULAR_DEPENDENCY` warnings originating in
  `node_modules` (from the `@iiif/3d-manifesto-dev` dependency) are silenced; warnings for the
  project's own sources are kept.

See [Build targets](build-targets.md) for the output matrix.

## Dependencies

Key runtime dependencies (`package.json`): `three`, `web-ifc`, `@iiif/3d-manifesto-dev`,
`fflate` (archive handling), `jquery`, `lru-cache`, `stats.js`, `toastify-js`.

Build/dev tooling: `rollup` (+ plugins), `parcel`, `serve`, `cross-env`, `concurrently`,
`@playwright/test`.

## Relationship to the Drupal module

This library produces the browser runtime. A separate Drupal module provides PHP/YAML
integration **and** the server-side conversion/rendering pipeline (Blender, IfcConvert, archive
extraction, thumbnail rendering). A Drupal site installs this library at
`web/libraries/dfg-3dviewer/` and loads `dist/drupal/main/`. See the Drupal module's
documentation for the server side.
