# DLF AIM 3D Viewer — JavaScript Library

A modern 3D viewer for the web, built on [three.js](https://threejs.org/). This repository
holds the **viewer runtime source**, the **Rollup build tooling**, an optional **PHP admin
panel** for self-hosted setups, and the demo/embed pages.

The viewer was originally written for displaying 3D data in a WissKI-based Drupal repository
and later generalised so it can also run standalone or be embedded in other environments.

!!! info "This is the library half of a two-repository project"
    The codebase was split into two repositories:

    - **JS library (this repo)** — the viewer runtime, build tooling, admin panel, demo/embed
      pages and Playwright tests. Published as
      [`dfg_3dviewer`](https://github.com/thedworak/dfg_3dviewer/tree/standalone).
    - **Drupal module** — PHP/YAML integration plus the server-side model
      conversion/rendering scripts (`convert.sh`, `render.sh`, Blender helpers, …).
      Published as the separate
      [`dlf_aim_3d_viewer`](https://gitlab.nasarek.dev/rnsrk/dlf_aim_3d_viewer_drupal_module) module.

    The server-side conversion pipeline (Blender, IfcConvert, archive extraction, thumbnail
    rendering) **no longer lives in this repo** — it moved to the Drupal module. See that
    module's documentation for the conversion workflow. The only scripts in this repository
    are `scripts/run-local-tests.sh` and `scripts/serve-dist.js`.

## What this repo contains

| Path | Purpose |
|------|---------|
| `viewer/` | Viewer runtime source: `main.js`, loaders, metadata, editor tools, UI, i18n, CSS, fonts, examples |
| `viewer/admin/` | Optional PHP admin panel (SQLite-backed) for editing settings, `.env`, HDRI and backups |
| `viewer/php/` | Small PHP helpers (`editor.php`, `fetchWissKI.php`, `thumbnail_upload.php`) |
| `index.html` | Local demo page with a model picker |
| `embed.html` | Embeddable viewer page driven by URL query parameters |
| `rollup.config.js` | Build configuration for all targets (test/dev/prod/drupal) |
| `package.json` | npm scripts and dependencies |
| `viewer-settings-example.json` / `viewer/viewer-settings-example.json` | Runtime settings templates |
| `playwright.config.js` / `tests/` | Playwright end-to-end tests |
| `scripts/` | `run-local-tests.sh` and `serve-dist.js` only |
| `dist/` | Generated build output (gitignored in source; built for releases) |

## Supported 3D formats

OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, GLB, glTF.

The in-app sandbox reports its supported formats as
`GLB, GLTF, OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD` plus archive formats
`ZIP, RAR, TAR, XZ, GZ`.

!!! note "On-the-fly conversion and thumbnail rendering"
    Compression to GLB and Blender-based thumbnail rendering for additional formats are
    handled **server-side by the Drupal module**, not by this library. This library renders
    the formats listed above directly in the browser.

## Tech stack

- **Client:** JavaScript (ES modules), three.js, jQuery, CSS, HTML
- **Build:** Rollup (production/Drupal bundles) and Parcel (dev server)
- **Optional server helpers:** PHP (admin panel and small endpoints)

## Where to go next

- [Getting started](getting-started.md) — install, run the dev server, create settings
- [Build targets](build-targets.md) — what each build produces
- [Embedding](embedding.md) — `embed.html` and the `3d` container attribute
- [viewer-settings.json](viewer-settings.md) — runtime configuration reference
