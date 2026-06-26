# Changelog

## [unreleased]

## 1.0.0

### Added
- Three.js-based DFG 3D Viewer library (`dfg_3dviewer.min.js`) with CSS, Draco, IFC WASM, and font assets.
- Rollup build targets: `build:library`, `build:dev`, `build:prod`, `build:test`.
- `npm run pack:library` to produce `dfg-3dviewer-library.zip` for `web/libraries/dfg-3dviewer/` on Drupal.
- Playwright E2E tests and local dev server (`npm run dev:test`).
- Tauri desktop app wrapper (`src-tauri/`).
- standalone HTML embed (`embed.html`).

### Changed
- stop tracking `dist/` in git; build output is produced locally.
- remove GitHub Actions release-build workflow; library zip is built with `npm run pack:library`.

### Fixed
- fix CI workflow configuration.
- fix asset path resolving in the library build.
