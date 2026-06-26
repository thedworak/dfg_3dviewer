# Changes from the original README

These docs describe the **current reality** of the standalone JS library. The original combined
README (the monorepo at `github.com/thedworak/dlf_aim_3d_viewer`) described a single project before it
was split into a JS library and a Drupal module. The notes below flag where the old README is no
longer accurate for this repository.

## Repository split

- The old README described one repo containing the viewer **and** the server-side conversion
  pipeline and Drupal integration. That has been split:
    - **This repo** = JS library (viewer runtime, build tooling, admin panel, demo/embed pages,
      Playwright tests).
    - **Separate Drupal module** = PHP/YAML integration **plus** the conversion/rendering scripts.
- The old README's `scripts/` and `php/` sections (`convert.sh`, `render.py`, `uncompress.sh`,
  `IfcConvert`, `2gltf2/`, `CityGML2OBJv2/`, `worker.sh`, `.env`, …) **moved to the Drupal
  module**. This repo's `scripts/` only contains `run-local-tests.sh` and `serve-dist.js`.

## npm scripts

| Old README claim | Current reality |
|------------------|-----------------|
| `npm run dev:prod` | Removed — there is no `dev:prod`. Use `build:prod` for a prod bundle. |
| `npm run pack-dist` (packages `dlf_aim_3d_viewer-dist.zip`) | Removed — releases ship the whole repo with `dist/` committed inside; there is no library zip. |
| `npm run dev:tauri`, `tauri:dev`, `tauri:build` | Removed — there is no Tauri wrapper (`src-tauri/`) in this repo. |
| `build:drupal:custom` "custom Drupal build with module prefix" | Exists and produces an unminified, fully-featured variant at `dist/drupal/custom`. |
| `watch`, `serve:dist`, `build:all` | Present. |

## Build outputs

- The old README referenced `dist/drupal`. The Drupal build now writes to
  **`dist/drupal/main`** (minified) and **`dist/drupal/custom`** (unminified). Drupal loads
  `dist/drupal/main/`.
- The old README implied Parcel for dev **and** builds. Builds use **Rollup**; Parcel only powers
  the dev server (`dev:test`, `dev:dev`).

## Settings & paths

- The old README's "rollup copies `viewer-settings.json` into `dist/ /`" is captured precisely in
  [Build targets](build-targets.md): the `main` Drupal build ships **no** settings file; other
  targets write one seeded from `viewer/viewer-settings-example.json`.
- Local dev copies the example to a **root** `viewer-settings.json`
  (`cp viewer/viewer-settings-example.json viewer-settings.json`).

## `embed.html` parameters

The runtime now supports more parameters than the old README listed (added `lang`/`language`,
`presentationMode`, `sandbox`, `cameraPos`/`cameraTarget` aliases, `scale`,
`showNotifications`). See [Embedding](embedding.md).

## Server-side conversion & rendering

Everything the old README documented under "Server-side conversion and rendering" (the Blender
pipeline, `convert.sh` flags, `.env` variables, `uncompress.sh`, supported conversion inputs,
thumbnail rendering) now lives in the **Drupal module** and is documented there. Note also that
some details changed during the split (for example, `convert.sh` now accepts compression levels
`0–9` and an `-a/--archive` flag, `uncompress.sh` takes the archive type via `-t`, and rendering
moved into a separate `render.sh`).
