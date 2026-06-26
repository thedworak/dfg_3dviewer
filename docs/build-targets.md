# Build targets

All builds run through `rollup.config.js`. The behaviour is driven by environment variables
that the npm scripts set for you (`BUILD`, `BUILD_SOURCE`, `IS_PROD`, `DRUPAL_VARIANT`).

```bash
npm install
npm run build:dev            # dist/dev    — standalone + PHP admin panel
npm run build:test           # dist/test   — standalone + PHP admin panel
npm run build:prod           # dist/prod   — standalone, no admin, minified
npm run build:drupal         # dist/drupal/main   — minified Drupal bundle, no admin/examples/settings
npm run build:drupal:custom  # dist/drupal/custom — unminified, fully-featured Drupal variant
npm run build:all            # all of the above in parallel
```

## Output matrix

| Target | Output dir | Entry file | admin | examples + HTML | viewer-settings.json | minified |
|---|---|---|:--:|:--:|:--:|:--:|
| `dev` / `test` | `dist/dev`, `dist/test` | `dlf_aim_3d_viewer-module.js` | ✅ | ✅ | ✅ (localhost) | ❌ |
| `prod` | `dist/prod` | `dlf_aim_3d_viewer-module.js` | ❌ | ✅ | ✅ | ✅ |
| `drupal` (main) | `dist/drupal/main` | `dlf_aim_3d_viewer.min.js` | ❌ | ❌ | ❌ (Drupal-managed) | ✅ |
| `drupal:custom` | `dist/drupal/custom` | `dlf_aim_3d_viewer-module.js` | ✅ | ✅ | ✅ (Drupal paths) | ❌ |

!!! note "Two Drupal variants"
    `build:drupal` produces the `main` variant — the minified bundle Drupal loads in production
    at `dist/drupal/main/`. `build:drupal:custom` produces an **unminified, fully-featured**
    drop at `dist/drupal/custom/` (admin panel, demo pages, examples and a
    `viewer-settings.json`) for site-specific customization.

## What the build copies

For every target, Rollup copies these assets into the output directory:

- `node_modules/three/examples/jsm/libs/draco` → `assets/draco`
- `node_modules/web-ifc` → `assets/ifc`
- `viewer/css` → `assets/css`
- `viewer/img` → `assets/img`
- `viewer/fonts` → `assets/fonts`
- `viewer/js/maps` → `assets/maps`

Standalone bundles and the Drupal `custom` variant additionally copy `viewer/examples`,
`index.html` and `embed.html`. The PHP admin panel (`viewer/admin`) is copied only for
`dev`, `test` and the Drupal `custom` variant; any local `admin/admin.sqlite` is removed from
the output so a developer database is never published.

## `viewer-settings.json` handling per target

- The minified Drupal `main` build ships **no** `viewer-settings.json` — it reads configuration
  from Drupal (`drupalSettings`).
- All other targets write a `viewer-settings.json` into the output, seeded from
  `viewer/viewer-settings-example.json` and merged with a root `viewer-settings.json` if present.
- For `test` and `dev`, the generated settings are tweaked for local development:
  `mainUrl = 'localhost'`, gallery build disabled, editor mode enabled,
  `viewer.lightweight = true`.
- For the Drupal `custom` variant, `baseModulePath` is rewritten to
  `/libraries/dlf_aim_3d_viewer/dist/drupal/custom/assets` and `entity.metadata.source` is set to
  `Drupal`.

See [viewer-settings.json](viewer-settings.md) for the field reference.

## Releases

Releases ship the **whole repository with a built `dist/` committed inside** — there is no
separate library zip. A Drupal site clones this repository into
`web/libraries/dlf_aim_3d_viewer/` and loads assets from `dist/drupal/main/`.
