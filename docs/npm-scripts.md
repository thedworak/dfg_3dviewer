# npm scripts

These are the scripts defined in `package.json` (`dlf_aim_3d_viewer`, version `1.0.2`).

## Development

| Script | Command | Purpose |
|--------|---------|---------|
| `dev:test` | `cross-env BUILD_SOURCE=IIIF BUILD=test parcel index.html --port 1234` | Parcel dev server with IIIF source enabled |
| `dev:dev` | `cross-env BUILD_SOURCE='' BUILD=test parcel index.html --port 1234` | Parcel dev server without IIIF source |
| `watch` | `cross-env BUILD_SOURCE=IIIF BUILD=test rollup -c -w` | Rollup watch mode for live rebuilds |

## Builds

| Script | Command | Output |
|--------|---------|--------|
| `build:test` | `cross-env BUILD_SOURCE='' BUILD=test rollup -c` | `dist/test` |
| `build:dev` | `cross-env BUILD_SOURCE='IIIF' BUILD=dev rollup -c` | `dist/dev` |
| `build:prod` | `cross-env BUILD_SOURCE='' BUILD=prod rollup -c` | `dist/prod` (minified) |
| `build:drupal` | `cross-env BUILD_SOURCE='' BUILD=drupal IS_PROD=true rollup -c` | `dist/drupal/main` (minified) |
| `build:drupal:custom` | `cross-env BUILD_SOURCE='' BUILD=drupal DRUPAL_VARIANT=custom rollup -c` | `dist/drupal/custom` (unminified) |
| `build:all` | `concurrently … build:test build:dev build:prod build:drupal build:drupal:custom` | all targets |

See [Build targets](build-targets.md) for the full output matrix.

## Serve & test

| Script | Command | Purpose |
|--------|---------|---------|
| `serve:dist` | `cross-env BUILD=test serve dist` | Serve the `dist` folder with the `serve` package |
| `test:local` | `sh ./scripts/run-local-tests.sh` | Build the test bundle and run Playwright locally |

`scripts/run-local-tests.sh` builds the test bundle and runs the Playwright suite with the
`chromium-webgl` project and a single worker:

```bash
npm run build:test
CI=1 npx playwright test tests/viewer.spec.ts --project chromium-webgl --workers=1
```

!!! info "Two ways to serve a build"
    - `npm run serve:dist` uses the [`serve`](https://www.npmjs.com/package/serve) package.
    - `scripts/serve-dist.js` is a tiny zero-dependency static server used by the Playwright
      **CI** web server (`HOST=127.0.0.1 PORT=4173 DIST_DIR=dist/test node scripts/serve-dist.js`).
      It honours the `HOST`, `PORT` and `DIST_DIR` environment variables.

!!! warning "Scripts that no longer exist"
    The original combined README referenced `dev:prod`, `pack-dist`, `dev:tauri`, `tauri:dev`
    and `tauri:build`. Those scripts and the Tauri desktop wrapper are **not part of this
    repository** any more. See [Changes from the original README](changes-from-readme.md).
