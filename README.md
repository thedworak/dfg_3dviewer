# DLF AIM 3D Viewer

A modern 3D viewer for web and Drupal integration built on three.js. This repo contains the viewer source code, build tooling, server-side helpers, and Drupal integration support.
The module was primarily created for viewing 3D data as a Drupal extension for a WissKI based repository. During development it became also possible to use as a standalone version to be integrated with more environments.
The Viewer is written in JavaScript, based on the three.js library for viewing 3D models and uses PHP/bash scripts for server-side operations.


## Quickstart (TL;DR)

### 🐳 Docker (recommended)

```bash
git clone <repo-url> && cd dfg_3dviewer
docker compose up --build
```

Open `http://localhost:3000` (test build) — `:3001` for dev, `:3002` for sandbox/drag-and-drop upload mode.

This is a fully working setup, including the full conversion pipeline (conversion to glTF/GLB, compression, and Blender-based thumbnail rendering) — no Drupal, Node, PHP or extra setup needed.

### Or, without Docker

```bash
git clone <repo-url> && cd dfg_3dviewer
pnpm install   # pnpm, not npm: the lockfile is pnpm-lock.yaml
cp viewer/viewer-settings-example.json viewer/viewer-settings.json
npm run dev:test
```

Open `http://localhost:1234` — viewer only, no conversion pipeline.

## What this repo contains

- `viewer/` — viewer runtime source, loaders, utilities, metadata handling, and UI
- `index.html` / `embed.html` — local demo and embed pages
- `rollup.config.js` — build configuration for production and Drupal output
- `package.json` — npm scripts and dependencies
- `viewer/viewer-settings-example.json` — runtime viewer settings template
- `scripts/` and `php/` — helpers for model conversion, Blender rendering, and Drupal workflow
- `dist/` — generated build output (not committed in source)

## Documentation

The topics below used to live in this file; they now have their own page in [`docs/`](docs/):

- [Minimal local setup, npm scripts, build/packaging, Tauri app](docs/development.md)
- [Standalone Docker setup](docs/docker.md) — profiles, `scripts/docker.sh`, static export, uploads/accounts
- [Admin panel setup](docs/admin-panel.md)
- [Server-side conversion and rendering](docs/conversion-pipeline.md) — pipeline, supported conversion inputs, script flags/env vars
- [`viewer-settings.json` explained](docs/viewer-settings.md)
- [Using/embedding the viewer](docs/embedding.md) — embed markup, `embed.html` parameters
- [Publishing to production](docs/publishing.md) — what must be set before a release
- [Bug reports and error tracking](docs/error-tracking.md) — the "Report a bug" button, self-hosted GlitchTip
- [`viewer/FUNCTIONS.md`](viewer/FUNCTIONS.md) — runtime function reference
- [`worker/README.md`](worker/README.md) — standalone conversion worker's API contract/configuration

## Supported 3D formats

| Format | Native | Converted to GLB |
|---|---|---|
| OBJ | ✅ | ✅ ¹ |
| DAE (COLLADA) | ✅ | ✅ ¹ |
| FBX | ✅ | ✅ ¹ |
| PLY | ✅ | ✅ ¹ |
| STL | ✅ | ✅ ¹ |
| IFC | ✅ | ✅ ² |
| WRL (VRML) | ✅ ³ | ✅ ¹ |
| USD / USDA / USDC / USDZ | ✅ ³ | ✅ ¹ ⁴ |
| 3MF | ✅ ³ | ✅ ⁵ |
| XYZ | ✅ | – |
| JSON | ✅ | – |
| 3DS | ✅ | – |
| PCD | ✅ | – |
| GLB / glTF | ✅ ⁶ | – |
| AMF | ✅ ³ | – |
| KMZ | ✅ ³ | – |
| VOX (MagicaVoxel) | ✅ ³ | – |
| LWO (LightWave) | ✅ ³ ⁷ | – |
| ABC (Alembic) | – | ✅ ¹ |
| BLEND | – | ✅ ¹ ⁸ |
| X3D | – | ✅ ¹ |
| GML | – | ✅ ¹ |
| STEP / STP | – | ✅ ⁹ |
| IGES / IGS | – | ✅ ⁹ |
| 3D Tiles (`tileset.json`) | ✅ ¹⁰ | – |
| Potree 2 (`metadata.json`) | ✅ ¹⁰ | – |
| LAS / LAZ (point clouds) | ✅ ¹² | Potree 2 / 3D Tiles ¹¹ |
| E57 (point clouds) | – | Potree 2 / 3D Tiles ¹¹ |
| Gaussian splats: SPZ / SPLAT / KSPLAT / SOG, PLY of splats | ✅ ¹³ | – |

> - ¹ via Blender (`scripts/convert.sh`)
> - ² via `IfcConvert` (+ metadata export, see below)
> - ³ via a three.js loader
> - ⁴ needs a USD-enabled Blender build
> - ⁵ via `trimesh` (standalone worker)
> - ⁶ native target format
> - ⁷ untested, no sample file
> - ⁸ in progress
> - ⁹ via OpenCASCADE (`cascadio`, standalone worker)
> - ¹⁰ streamed level of detail via `3d-tiles-renderer`
> - ¹¹ converted to a streamed octree by the standalone worker: Potree 2 via PotreeConverter (default; keeps intensity and classification, read by HTTP range requests) or 3D Tiles via `py3dtiles`; a PLY without faces is treated the same way
> - ¹² loaded directly in a Web Worker (LAS 1.0-1.4 all point formats, decoded while downloading; LAZ point formats 0-3 with loaders.gl + laz-perf), shown progressively and thinned above `viewer.pointCloud.maxPoints`; convert large scans to 3D Tiles for full-resolution streaming - see [docs/point-clouds.md](docs/point-clouds.md)
> - ¹³ drawn with Spark (sparkjs.dev), downloaded with the first splat file; a PLY is read as splats when its vertices carry Gaussians (`f_dc_0`, `scale_0`, `rot_0`), and the worker keeps such a PLY as uploaded
>
> Not added on purpose: VTK (its three.js loader is deprecated and scheduled for removal), LDraw (needs a separate parts library), 3DM (needs the extra `rhino3dm` runtime) and PDB/MD2/NRRD/GCode/BVH (not general model formats).

There is also a pre-configured complete workflow to handle more file formats and allow to render thumbnails for entries. If an uploaded file is saved in one of the compression-supported formats, it is compressed on-the-fly and converted into GLB format and triggers automatic rendering (based on Blender utility). See [Server-side conversion and rendering](docs/conversion-pipeline.md) for details.

## Minimal Requirements

- uploaded files (3D models, textures, other sources) should be named like:
    - hyphens or underscores instead of spaces
    - no national characters such as symbols or spaces
    - uploaded archive should be named the same as input file and content should be placed directly in the archive (without subdirectories)
- upload all the sources needed for rendering. For example OBJ needs MTL files (if any) and textures uploaded too. If you want to do this, please place them inside a single archive.

## Tech Stack

**Client:** JavaScript, three.js, CSS, HTML, PHP, Drupal

**Server:** PHP, Drupal, bash, blender, Python (`ifcopenshell` for IFC metadata export)

## Features

- 3D file formats read directly: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, PCD, JSON, 3DS, glTF/GLB, USD/USDA/USDC/USDZ, 3MF, AMF, WRL, KMZ, VOX, LWO, Gaussian splats (SPZ, SPLAT, KSPLAT, SOG, PLY);
- optional WebGPU renderer (`viewer.renderer` / `?renderer=webgpu`): node materials, ambient occlusion and post-processing as a TSL pipeline, section planes and area selection, falling back to WebGL where WebGPU (or the model) needs it;
- streamed level-of-detail models: 3D Tiles (`tileset.json` - b3dm, i3dm, pnts, glb; meshes and point clouds) and Potree 2 point clouds (`metadata.json`), with adaptive point size and Eye-Dome Lighting - directly opened LAS/LAZ/XYZ/PCD clouds too, with colouring by RGB, intensity, height or classification on the GPU;
- compressed glTF (Draco, Meshopt, KTX2/Basis textures) and progressive loading: a lightweight preview is shown first, then swapped for the full model (the Docker worker optimizes converted models with gltfpack);
- compression and rendering on-the-fly: OBJ, FBX, STL, DAE, PLY, ABC, BLEND, WRL, X3D, USD/USDA/USDC/USDZ, GLB, GLTF; the standalone worker additionally converts STEP/STP, IGES/IGS and 3MF (see [Server-side conversion and rendering](docs/conversion-pipeline.md));
- 3D viewer with orbit controls, zoom, and basic editor tools;
- changing lights properties and environment maps;
- standalone version | embeddable version | presentation mode | lightweight or full mode;
- loading archives (zip, rar);
- IIIF comliant metadata handling;
- metadata fetching and display integration
- saving/loading custom object's position, scale, rotation, lights, camera
- gallery generation and embedded preview UI
- face picking, ruler measurement, clipping planes, and material editing
- 4D timeline, reconstruction variants (alternative hypotheses, each with its Level of Certainty) and a comparison view of two variants or two years: a swipe divider or side by side
- view object's hierarchy and select groups by name
- historical photos laid over the model from the camera they were taken from (faded or swiped), lined up by hand and kept in the manifest
- sun and shadows: the sun of the model's place on any day and hour, in the year of the 4D timeline
- VR and AR in the browser (WebXR): walk around the model at real size in a headset, or put it on a table or the floor through a phone; AR Quick Look on iPhone and iPad
- Gaussian splats (3D Gaussian Splatting captures) next to meshes: framed, measured and shown in VR/AR like any model
- fullscreen support and screenshot/thumbnail generation
- Drupal/WissKI integration hooks
- adding watermark

## Screenshots

![Functions and other features](https://i.postimg.cc/zHSkMWdh/image2.png)

![Main view](https://i.postimg.cc/qthxrWb4/image4.png)

![Gallery Set](https://i.postimg.cc/R3yGnv6W/image7.png)

![Gallery Preview Element](https://i.postimg.cc/xXF3W9P6/image1.png) 

![Gallery Preview Element 2](https://i.postimg.cc/TKPc7Kny/image6.png)

![IIIF-AIM3D Data Flow.png](https://i.postimg.cc/htwXZNCh/IIIF-AIM3D-flow.png)
