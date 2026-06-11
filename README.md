# DLF AIM 3D Viewer

A modern 3D viewer for web and Drupal integration built on three.js. This repo contains the viewer source code, build tooling, server-side helpers, and Drupal integration support.
The module was primarily created for viewing 3D data as a Drupal extension for a WissKI based repository. During development it became also possible to use as a standalone version to be integrated with more environments.
The Viewer is written in JavaScript, based on the three.js library for viewing 3D models and uses PHP/bash scripts for server-side operations.


## What this repo contains

- `viewer/` — viewer runtime source, loaders, utilities, metadata handling, and UI
- `index.html` / `embed.html` — local demo and embed pages
- `rollup.config.js` — build configuration for production and Drupal output
- `package.json` — npm scripts and dependencies
- `viewer/viewer-settings-example.json` — runtime viewer settings template
- `scripts/` and `php/` — helpers for model conversion, Blender rendering, and Drupal workflow
- `dist/` — generated build output (not committed in source)

## Supported 3D formats

- OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, GLB, glTF

There is also a pre-configured complete workflow to handle more file formats and allow to render thumbnails for entries. If an uploaded file is saved in one of the compression-supported formats, it is compressed on-the-fly and converted into GLB format and triggers automatic rendering (based on Blender utility).

## Minimal Requirements

- uploaded files (3D models, textures, other sources) should be named like:
    - hyphens or underscores instead of spaces
    - no national characters such as symbols or spaces
    - uploaded archive should be named the same as input file and content should be placed directly in the archive (without subdirectories)
- upload all the sources needed for rendering. For example OBJ needs MTL files (if any) and textures uploaded too. If you want to do this, please place them inside a single archive.

## Tech Stack

**Client:** JavaScript, three.js, CSS, HTML, PHP, Drupal

**Server:** PHP, Drupal, bash, blender

## Minimal local setup

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

## `viewer-settings.json` explained

The viewer loads configuration from `viewer-settings.json` at runtime.

The example template is located at `viewer/viewer-settings-example.json`.

### Main settings

- `mainUrl` — base backend URL used by viewer metadata and resource requests
- `metadataUrl` — metadata service URL
- `baseNamespace` — namespace used for entity routing and metadata
- `baseModulePath` — path to viewer assets/module when deployed

### Entity integration

- `entity.bundle` — Drupal/WissKI entity bundle identifier
- `entity.fieldDf` — field name used for 3D file references
- `entity.exportViewer` — export field name for viewer settings
- `entity.exportViewerUrl` — metadata URL used by export/viewer integration
- `entity.idUri` — pattern to extract entity IDs from path
- `entity.viewEntityPath` — base path for entity views
- `entity.attributeId` — identifier used for viewer container attribute
- `entity.metadata.source` — metadata source label, e.g. `Drupal` or `IIIF`

### Viewer settings

- `viewer.container` — target container ID for WebGL viewer
- `viewer.fileUpload` — Drupal upload field ID
- `viewer.fileName` — Drupal file name field ID
- `viewer.imageGeneration` — Drupal field ID for image generation
- `viewer.lightweight` — enable lightweight viewer mode when `true`
- `viewer.editor` — show editor controls
- `viewer.gallery.build` — enable gallery generation from metadata/gallery sources
- `viewer.gallery.container` — DOM container for generated gallery thumbnails
- `viewer.gallery.imageClass` — class used to locate gallery images
- `viewer.gallery.imageId` — optional gallery image ID selector
- `viewer.background` — CSS background string for viewer canvas
- `viewer.performanceMode` — performance mode config object
- `viewer.measurement.modelUnitInMeters` — conversion ratio from model units to meters
- `viewer.scaleContainer` — scale adjustments for the viewer container

### Built output behavior

- `rollup.config.js` copies `viewer-settings.json` into `dist/<target>/`
- For `test` and `dev` builds, the generated `viewer-settings.json` is modified to:
  - set `mainUrl = 'localhost'`
  - disable gallery build
  - enable editor mode
  - set `viewer.lightweight = true`
- For `drupal` builds, `baseModulePath` is rewritten to the Drupal assets path and `entity.metadata.source` is set to `Drupal`

## Using the viewer

Example embed markup:

```html
<div id="DFG_3DViewer" 3d="./examples/box.stl" style="height: 50vh"></div>
<script type="module" src="dfg_3dviewer-module.js"></script>
```

This is the current built runtime entry pattern. The viewer reads the `3d` attribute from the container and loads the model.

## `embed.html` parameters

`embed.html` supports these query parameters:

- `model` / `src`
- `id`
- `theme`
- `autorotate`
- `autorotateSpeed`
- `disableInteraction`
- `hideUi`
- `hideMetadata`
- `camPos`
- `camTarget`
- `fov`

Example:

```text
/embed.html?model=/examples/box.glb&theme=light&autorotate=1&autorotateSpeed=1.2&camPos=1.2,0.8,2.5&camTarget=0,0,0&fov=45
```

## Features

- 3D file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, glTF;
- compression and rendering on-the-fly: OBJ, FBX, STL, DAE, PLY, ABC, BLEND, STL, WRL, X3D, GLB, GLTF;
- 3D viewer with orbit controls, zoom, and basic editor tools;
- changing lights properties and environment maps;
- standalone version | embeddable version | presentation mode | lightweight or full mode;
- IIIF comliant metadata handling;
- metadata fetching and display integration
- saving/loading custom object's position, scale, rotation, lights, camera
- gallery generation and embedded preview UI
- face picking, ruler measurement, clipping planes, and material editing
- view object's hierarchy and select groups by name
- fullscreen support and screenshot/thumbnail generation
- Drupal/WissKI integration hooks
- adding watermark

## Server-side conversion and rendering

Main workflow is divided into two automatic parts:
- pre-processing - uploaded model is uncompressed (if so) and converted into glTF (glb) format
- automatic rendering - Blender side rendering of 3D model’s thumbnails

The conversion pipeline lives in `scripts/` and `php/`.

After uploading 3D model into repository there are triggered following steps:
- uncompressing 3D models - it is done on Drupal side module script inside ```dfg_3dviewer_entity_presave``` and supports following archive formats: zip, rar, tar, xz, gz. According to the format, the bash script is triggered with following arguments: 
```/scripts/uncompress.sh archiveType -i inputPath -o extractPath -n fileName```
- automatic conversion into glTF (glb) format for the following supported formats:
    - abc, dae, fbx, obj, ply, stl, wrl, x3d - function ```handle_file```
    - ifc - function ```handle_ifc_file```
    - blend (in progress) - function ```handle_blend_file```
    - glb - triggers next step - function ```render_preview```

This step is performed inside ```scripts/convert.sh``` bash script, which is the primary helper for converting files to glTF/GLB and rendering preview images with Blender.
Defaults .env variables should be adjusted due to your needs:

```
BLENDER_BIN=''
# Optional override. If empty, scripts auto-detect the module root from this file location.
SPATH=
BACKUP_SETTINGS_PATH=/var/www/data/project/web/sites/default/settings.php
RENDER_RESOLUTION='1024x1024x16'
RENDER_SAMPLES='20'
```

The script uses Blender to convert the file into glTF format and then renders a preview image with it using blender's built-in cycles engine. The result is saved in a set of pictures with different view angles. 
This step needs some steps to be performed before rendering:
- create scene containing loaded 3D model
- calculate bounding box (for camera and lights settlement)
- scale scene according to bounding box
- setup basic properties for rendering engine, output quality, lights, camera
- prepare rendering from camera placed in 9 different positions (left, left top, front, front top, right, right top, back, back top, top)
- write rendering outputs into png files with consecutive naming


![Backend overview|500](https://i.postimg.cc/7fw9zs6n/image3.png)

### Supported conversion inputs

- abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, xyz, pcd, json, 3ds, glb, gltf

### Minimal conversion examples

Convert an OBJ to GLB and render previews:

```bash
./scripts/convert.sh -c true -l 3 -i '/path/to/input.obj' -b true
```

Convert an IFC with IfcConvert:

```bash
./scripts/convert.sh -i '/path/to/building.ifc'
```

Run lightweight conversion without xvfb checks:

```bash
./scripts/convert.sh -t true -c false -i '/path/to/input.obj'
```

### Script flags

- `-c` — compression true/false
- `-l` — compression level 0-6
- `-i` — input file path
- `-o` — output folder (optional)
- `-b` — binary output true/false (GLB vs glTF)
- `-t` — lightweight true/false
- `-f` — force overwrite

### Environment variables in `scripts/.env`

- `BLENDER_PATH` — path to the Blender binary
- `SPATH` — repository or module base path used by scripts
- `COMPRESSION` — whether glTF compression is enabled
- `COMPRESSION_LEVEL` — compression level
- `GLTF` — target `gltf` or `glb`
- `FORCE` — overwrite existing outputs
- `IS_ARCHIVE` — if input is an archive
- `LIGHTWEIGHT` — skip heavyweight checks and rendering steps

## Packaging and releases

- `npm run pack-dist` packages the distribution into `dfg_3dviewer-dist.zip`
- the repo also contains a GitHub Actions workflow for building release artifacts on tags

## Screenshots

![Functions and other features](https://i.postimg.cc/zHSkMWdh/image2.png)

![Main view](https://i.postimg.cc/qthxrWb4/image4.png)

![Gallery Set](https://i.postimg.cc/R3yGnv6W/image7.png)

![Gallery Preview Element](https://i.postimg.cc/xXF3W9P6/image1.png) 

![Gallery Preview Element 2](https://i.postimg.cc/TKPc7Kny/image6.png)


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
- `dfg_3dviewer.libraries.tpl.yml` — Drupal libraries template used in Drupal build