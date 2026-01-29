# DLF AIM 3D Viewer


The module was primarily created for viewing 3D data as a Drupal extension for a WissKI based repository. During development it became also possible to use as a standalone version to be integrated with more environments.
The Viewer is written in JavaScript, based on the three.js library for viewing 3D models and uses PHP/bash scripts for server-side operations.
Supported 3D file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, glTF. There is also a pre-configured complete workflow to handle more file formats and allow to render thumbnails for entries. If an uploaded file is saved in one of the compression-supported formats (obj, fbx, ply, dae, abc, blend, stl, wrl, x3d, glb, gltf), it is compressed on-the-fly and converted into GLB format and triggers automatic rendering (based on Blender utility).



## Minimal Requirements

- uploaded files (3D models, textures, other sources) should be named like:
    - hyphens or underscores instead of spaces
    - no national characters such as symbols or spaces
    - uploaded archive should be named the same as input file and content should be placed directly in the archive (without subdirectories)
- upload all the sources needed for rendering. For example OBJ needs MTL files (if any) and textures uploaded too. If you want to do this, please place them inside a single archive.

## Screenshots

![Functions and other features](https://i.postimg.cc/zHSkMWdh/image2.png)

![Main view](https://i.postimg.cc/qthxrWb4/image4.png)

![Gallery Set](https://i.postimg.cc/R3yGnv6W/image7.png)

![Gallery Preview Element](https://i.postimg.cc/xXF3W9P6/image1.png) 

![Gallery Preview Element 2](https://i.postimg.cc/TKPc7Kny/image6.png)



## Tech Stack

**Client:** JavaScript, three.js (r180+), CSS, HTML, PHP (8.x), Drupal (9+)
**Tooling:** Node.js (v18+), npm (v8+) — used for building the viewer with Parcel and Rollup

**Server:** PHP, Drupal, bash, blender

The main part is located in the ```viewer``` directory and the ```main.js``` is responsible for delivering 3D content.
The viewer at first imports all necessary three.js components:
```bash
import * as THREE from './build/three.module.js';
import { TWEEN } from './js/jsm/libs/tween.module.min.js';

import Stats from './js/jsm/libs/stats.module.js';

import { OrbitControls } from './js/jsm/controls/OrbitControls.js';
import { TransformControls } from './js/jsm/controls/TransformControls.js';
import { GUI } from './js/jsm/libs/lil-gui.module.min.js';
import { FBXLoader } from './js/jsm/loaders/FBXLoader.js';
import { DDSLoader } from './js/jsm/loaders/DDSLoader.js';
import { MTLLoader } from './js/jsm/loaders/MTLLoader.js';
import { OBJLoader } from './js/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from './js/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from './js/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from './js/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from './js/jsm/libs/meshopt_decoder.module.js';
import { IFCLoader } from './js/jsm/loaders/IFCLoader.js';
import { PLYLoader } from './js/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from './js/jsm/loaders/ColladaLoader.js';
import { STLLoader } from './js/jsm/loaders/STLLoader.js';
import { XYZLoader } from './js/jsm/loaders/XYZLoader.js'; 
import { TDSLoader } from './js/jsm/loaders/TDSLoader.js';
import { PCDLoader } from './js/jsm/loaders/PCDLoader.js';
import { FontLoader } from './js/jsm/loaders/FontLoader.js';
import { TextGeometry } from './js/jsm/geometries/TextGeometry.js';
```

**Basic Viewer configuration**

Then, basic configuration should be changed:

```bash
  CONFIG = {
    mainUrl: "https://dfg-repository.wisski.cloud",
    baseNamespace: "https://dfg-repository.wisski.cloud",
    metadataUrl: "https://dfg-repository.wisski.cloud",
    baseModulePath: "/modules/dfg_3dviewer-main/viewer",
    entity: {
      bundle: "bd3d7baa74856d141bcff7b4193fa128",
      fieldDf: "field_df",
      idUri: "/wisski/navigate/(.*)/view",
      viewEntityPath: "/wisski/navigate/",
      attributeId: "wisski_id",
      metadata: {
        source: "",
      },
    },
    viewer: {
      container: "DFG_3DViewer",
      fileUpload: "fbf95bddee5160d515b982b3fd2e05f7",
      fileName: "faa602a0be629324806aef22892cdbe5",
      imageGeneration: "f605dc6b727a1099b9e52b3ccbdf5673",
      lightweight: 1,
      scaleContainer: {
        x: 0.85,
        y: 1.4,
      },
      gallery: {
        build: true,       
        container: "block-bootstrap5-content",
        imageClass: "field--name-fd6a974b7120d422c7b21b5f1f2315d9",
        imageId: "",
      },
      background:
        "radial-gradient(circle, #ffffff 0%, #999999 100%)",
      performanceMode: {
        Performance: "high-performance",
      }
    },
  };
}

domain, metadataDomain - domains that deliver 3D content and metadata content respectively
container - container to attach to and will contain 3D content
galleryContainer - container with generated thumbnails
galleryImageClass - class for gallery 
basePath - relative path where this script is placed
entityIdUri - WissKI side URI that can deliver ID of the entity
attributeId - the ID name that container will be given
lightweight - use Viewer as simple version - mostly for usage as a standalone 3D viewer
```

**3D DFG Viewer functions overview**

Below is an updated, code-accurate summary of the main functions found in the viewer source (grouped by module). Short descriptions focus on purpose and intended usage.

viewer/main.js
```text
outputLog(debug = false, label) - helper that returns a namespaced logger (uses stack trace to include location)
setModelPaths() - derives filename, basename, extension and paths from the container `3d` attribute
addTextWatermark(text, scale) - adds a 3D text watermark to the scene
addTextPoint(text, scale, point) - adds a 3D text label at a given point (used by the ruler)
selectObjectHierarchy(id) - toggle-selects an object in the scene hierarchy (visually highlights it)
recreateBoundingBox(object) - recomputes object's bounding box and recenters the object
prepareGalleryImages(imageElementsChildren) - normalizes/validates gallery image links (converts to <img> elements)
handleImages(fileElement, mainElement, imageElements, imageElementsChildren) - builds modal gallery UI and wiring
buildGallery() - finds gallery DOM elements and initialises the gallery UI
render() - one-frame render (calls controls.update and renderer.render)
setupEmptyCamera(camera, object, helperObjects) - positions camera relative to object bounding box (fallback camera setup)
pickFaces(intersect) - visual face picking / highlight logic
buildRuler(intersect) - creates ruler geometry and labels between points
onWindowResize() - adjusts canvas, renderer and GUI to current container/window size
fullscreen() / exitFullscreenHandler() - toggle and handle fullscreen changes
animate(time) - main RAF loop: update mixers, tweens, controls and render
onPointerDown(e) / onPointerUp(e) / onPointerMove(e) - pointer interaction handlers (picking, dragging)
```

viewer/viewer-utils.js
```text
initClippingPlanes() - create and register three clipping planes in core
showToast(message) - thin wrapper around Toastify to show temporary messages
setupObject(object, light, controls, helperObjects) - apply model-specific configuration (position/scale/rotation) from `objectsConfig` or auto-fit
setupCamera(object, light, config, helperObjects) - set camera and lights according to `objectsConfig` (falls back to empty camera setup)
fitCameraToCenteredObject(object, add_offset, fit, helperObjects) - compute camera distance/position to fit object in view and animate to it
setupClippingPlanes(geom, size, distance) - configure GUI controls, helpers and plane helpers for clipping
changeBackground(type, color1, color2) / parseGradient(...) - helpers to set scene background from CSS-like strings
invertHexColor(hex) - color utility used for helpers and UI contrast
getOrAddGuiController(folder, object, prop) - utility to find or add a lil-gui controller
```

viewer/utils.js
```text
distanceBetweenPoints(a, b) - euclidean distance between two points
distanceBetweenPointsVector(v) - length of a vector
vectorBetweenPoints(a, b) - returns vector from a to b
halfwayBetweenPoints(a, b) - midpoint between two points
interpolateDistanceBetweenPoints(start, vector, length, scalar) - linear interpolation along vector
detectColorFormat(color) / hexToRgb(hex) - color format helpers
isValidUrl(url) - basic URL validator used by gallery code
truncateString(str, n) - truncates and adds ellipsis
getProxyPath(url, config, fileObject) - helper to convert source URL into proxied path (used for metadata/image proxies)
```

Other important imports (used by the viewer entry point)
```text
loadModel(path, basename, filename, extension, orgExtension) - from `loaders.js` (main model loading routine)
outlineClipping - (exported from loaders) used by clipping helpers
createIIIFDropdown(...) / downloadModel - from `metadata.js` (IIIF / metadata helpers)
```

viewer/loaders.js
```text
outlineClipping (var) - outline clone used for clipping visualization
loadModel(params) - main loader routine that dispatches based on file extension (obj, fbx, ply, dae, ifc, stl, xyz, pcd, json, 3ds, glb/gltf) and adds the resulting object(s) to the scene; accepts a params object containing many runtime dependencies (fileObject, scene, camera, controls, gui, etc.)
prepareOutlineClipping(object) - build a crimson-backside outline clone used for clipping/outline visualization
setupMaterials(object) - scan an object or mesh and prepare materials (anisotropy, clippingPlanes) and return a materials list for GUI
getMaterialByID(object, uuid) - traverse object and return material with matching uuid
traverseMesh(object) - helper to populate material GUI entries and connect material editing controls
onError(event) / onErrorMTL(event, params) / onErrorGLB(event, params) - error handlers used during async loading to fallback or retry
onProgress(xhr, params) - generic loading progress callback (updates spinner/circle and shows toasts)
```

Usage examples & source
```text
// Programmatic model load (viewer runtime provides most dependencies)
import { loadModel } from './viewer/loaders.js';

const params = { fileObject, config: CONFIG, getProxyPath, camera, lightObjects, controls, scene, mainObject, gui, stats, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, helperObjects };
await loadModel(params);

// Create outline clone for clipping visualization
import { prepareOutlineClipping } from './viewer/loaders.js';
const outline = prepareOutlineClipping(myMesh);
scene.add(outline);

// Progress/error handlers are exported and used internally by the loader
// Source (links)
- prepareOutlineClipping — `viewer/loaders.js` line 23
- loadModel — `viewer/loaders.js` line 160
- onErrorGLB — `viewer/loaders.js` line 747
- onProgress — `viewer/loaders.js` line 761
 - prepareOutlineClipping — `viewer/loaders.js` line 23 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/loaders.js#L23)
 - loadModel — `viewer/loaders.js` line 160 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/loaders.js#L160)
 - onErrorGLB — `viewer/loaders.js` line 747 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/loaders.js#L747)
 - onProgress — `viewer/loaders.js` line 761 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/loaders.js#L761)
```

viewer/metadata.js
```text
addWissKIMetadata(label, value) - format WissKI metadata keys into human-friendly labels for display
lilGUIhasFolder(folder, name) / lilGUIgetFolder(gui, name) - small helpers for lil-gui folder detection/lookup
expandMetadata() - toggle-expand/collapse the metadata panel in the UI
appendMetadata(metadataContent, canvasText, metadataContainer, container, metadataContentTech) - append built metadata HTML to the DOM
downloadModel (let) - DOM element reference created when metadata includes a downloadable source
fetchMetadata(object, type) - returns counts (vertices/faces) for a mesh/object
handleMetadataResponse(data, metadata, fileObject, object, camera, light, controls, ...) - main handler that builds metadata UI from fetched data and wires hierarchy controls and download link
settingsHandler(object, camera, light, controls, hierarchyMain, CONFIG, helperObjects) - applies per-model settings (calls setupObject/setupCamera) and ensures hierarchy GUI exists
fetchSettings(fileObject, object, camera, light, controls, gui, CONFIG, getProxyPath, ...) - fetch or compute viewer settings & metadata (tries proxy, IIIF, or metadata URL) and calls handleMetadataResponse
createIIIFDropdown(container, iiifConfigURL, canvasDimensions) - UI helper that inserts a IIIF manifest selector/dropdown into the viewer UI
```

Usage examples & source
```text
import { fetchSettings, createIIIFDropdown } from './viewer/metadata.js';

// Typical call after an object was loaded
await fetchSettings(fileObject, object, camera, light, controls, gui, CONFIG, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, helperObjects);

// Add IIIF manifest selector to the UI
createIIIFDropdown(document.getElementById('DFG_3DViewer'), iiifConfigURL, CONFIG.viewer.canvasDimensions);

// Source (links)
 - appendMetadata — `viewer/metadata.js` line 59 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/metadata.js#L59)
 - handleMetadataResponse — `viewer/metadata.js` line 108 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/metadata.js#L108)
 - fetchSettings — `viewer/metadata.js` line 308 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/metadata.js#L308)
 - createIIIFDropdown — `viewer/metadata.js` line 423 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/metadata.js#L423)
```

viewer/core.js
```text
core (object) - shared runtime state bag for the viewer (clippingPlanes, camera, scene, lights, GUI folders, helpers, tween, controls, etc.)
setCore(key, value) - tiny setter to place items into the `core` state object (used across modules to share references)
```

Usage example & source
```text
import { core, setCore } from './viewer/core.js';

// Set and read shared references (typical usage in modules)
setCore('camera', camera);
console.log(core.camera); // -> the same camera reference

// Source (links)
 - core (state bag) — `viewer/core.js` line 5 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/core.js#L5)
 - setCore — `viewer/core.js` line 35 — [view source on GitHub](https://github.com/thedworak/dfg_3dviewer/blob/npm-refactor-update/viewer/core.js#L35)
```

![Viewer overview](https://i.postimg.cc/VdgRWq0Q/image5.png)

## Server side scripts

![Backend overview|500](https://i.postimg.cc/7fw9zs6n/image3.png)

Main workflow is divided into two automatic parts:
- pre-processing - uploaded model is uncompressed (if so) and converted into glTF (glb) format
- automatic rendering - Blender side rendering of 3D model’s thumbnails

Scripts needed there are placed under ```scripts``` and ```php``` directory.

After uploading 3D model into repository there are triggered following steps:
- uncompressing 3D models - it is done on Drupal side module script inside ```dfg_3dviewer_entity_presave``` and supports following archive formats: zip, rar, tar, xz, gz. According to the format, the bash script is triggered with following arguments: 
```/scripts/uncompress.sh archiveType -i inputPath -o extractPath -n fileName```
- automatic conversion into glTF (glb) format for the following supported formats:
    - abc, dae, fbx, obj, ply, stl, wrl, x3d - function ```handle_file```
    - ifc - function ```handle_ifc_file```
    - blend (in progress) - function ```handle_blend_file```
    - glb - triggers next step - function ```render_preview```


This step is performed by the helper script `scripts/convert.sh`. The script wraps Blender-based conversion and an automatic thumbnail rendering pipeline. Below is a short reference so you can run or adapt it in your environment.

scripts/convert.sh — quick reference

- Purpose: convert a wide range of 3D formats (abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, etc.) into glTF / GLB and then render thumbnails with Blender.
- Location: `scripts/convert.sh`
- Prerequisites (Ubuntu/Debian examples):
  - blender, xvfb, python3, python3-pip
  - pip packages: numpy, triangle (used by some scripts), lxml/shapely/matplotlib for CityGML converter
  - system packages: libxi6, libgconf-2-4 (Blender GUI dependencies)
  - If running headless rendering, `xvfb-run` is required.

Environment & defaults
- The script reads optional environment settings from `scripts/.env` and uses these defaults when not set:

```bash
BLENDER_PATH=''                # path to blender binary (empty means 'blender' in PATH)
SPATH='/var/www/html/3drepository/modules/dfg_3dviewer'  # repo base used for helper scripts
COMPRESSION=false              # whether to compress glTF (via 2gltf2)
COMPRESSION_LEVEL=3            # compression level (0-6)
GLTF='gltf'                    # target output format; set to 'glb' when binary mode requested
FORCE='false'                  # force overwrite existing outputs
IS_ARCHIVE=false               # set to true if input was an archive
LIGHTWEIGHT=false              # skip some heavyweight steps (used by certain callers)
```

Usage / flags
- Basic usage: `./scripts/convert.sh -c true -l 3 -i '/path/to/input.obj' -o '/path/to/output/' -b true -f true`
- Flags handled by the script:
  - `-c` compression (true/false)
  - `-l` compression level (0-6)
  - `-i` input (required) — full path to the source file
  - `-o` output (optional) — path where `gltf/` will be created; when omitted script writes into the input folder
  - `-b` binary (true/false) — if true the script will produce `glb` output instead of `gltf`
  - `-t` lightweight (true/false) — when true the script runs in lightweight mode and will skip checks and some heavyweight steps (notably the `xvfb-run` check and possibly some render steps). Useful when the conversion is run by another service that manages rendering resources.
  - `-f` force (true/false) — overwrite existing output

What it does (high level)
- Validates that Blender and `xvfb-run` (for headless rendering) exist (unless running in lightweight mode).
- Converts supported input into a glTF/GLB via one of the helper scripts (2gltf2, IfcConvert or custom Blender Python scripts).
- Writes converted files under `<input-folder>/gltf/<name>.glb` (or the configured output folder).
- Calls `scripts/render.py` inside Blender (via `xvfb-run`) to render thumbnails from multiple camera angles into `<input-folder>/views/`.
- Handles special cases (IFC via IfcConvert, CityGML via CityGML2OBJv2 converter, .blend via `convert-blender-to-gltf.py`).

Supported input extensions (handled by `convert.sh`)
- abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, xyz, pcd, json, 3ds, glb/gltf

Examples
- Convert an OBJ into a compressed glb and render thumbnails (headless):

```bash
./scripts/convert.sh -c true -l 3 -i '/var/www/html/sites/default/files/my_model.obj' -b true
```

- Convert an IFC using IfcConvert and render:

```bash
./scripts/convert.sh -i '/var/www/html/sites/default/files/building.ifc'
```

- Run conversion in lightweight mode (skip xvfb checks / headless rendering orchestration):

```bash
./scripts/convert.sh -t true -c false -i '/var/www/html/sites/default/files/my_model.obj'
```

Notes & troubleshooting
- If Blender isn't on PATH, set `BLENDER_PATH` in `scripts/.env` to your blender binary or make a system symlink (`ln -s /path/to/blender /usr/local/bin/blender`).
- The script uses `sudo` when invoking Blender for some rendering commands — on production servers you may want to remove `sudo` and run the script under an appropriate user.
- Headless rendering requires `xvfb-run`; install it with `apt install xvfb` on Debian/Ubuntu.
- The script creates `gltf/` and `metadata/` directories next to the input file and writes rendered views to `views/`.
- For large conversions or CI, run the script in an environment where Blender has access to necessary codecs and WASM decoders for IFC/DRACO if used.

--------------------------------
If your Drupal module invokes `convert.sh` (for example during an entity presave or a background worker), it's common to run the script in lightweight mode and let Drupal or a job runner manage rendering resources. Below is a minimal, safe example showing how to call the script from PHP. It demonstrates safe argument escaping and basic error handling — don't run user-provided paths without validation.

```php
<?php
// Minimal example — use inside a Drupal background job or cron task, not directly in a page request.
$input = '/var/www/html/sites/default/files/my_model.obj';
$repoRoot = DRUPAL_ROOT . '/modules/dfg_3dviewer'; // adjust to your layout

// Build command (use escapeshellarg to prevent injection)
$cmd = sprintf(
  '%s/scripts/convert.sh -t true -c true -l 3 -i %s -b true 2>&1',
  escapeshellarg($repoRoot),
  escapeshellarg($input)
);

// Run the command and capture output and exit code
exec($cmd, $outputLines, $exitCode);

if ($exitCode !== 0) {
  // Log and handle error (replace with Drupal logger / watchdog in real module)
  error_log("convert.sh failed: " . implode("\n", $outputLines));
} else {
  // Success — converted GLB will be in the input folder under gltf/ and views/
  error_log("convert.sh finished: " . implode("\n", $outputLines));
}

```

Security & operational notes
- Always validate and sanitize input file paths. Prefer passing server-side-constructed paths (not raw user input).
- Run conversions in a background worker (Queue API or Batch API) instead of directly in a web request to avoid timeouts and blocking.
- Ensure the PHP process user has permission to execute `scripts/convert.sh` and write to the target folders. Avoid running as root — prefer proper file permissions or a dedicated service account.
- If you need to run conversions in parallel or at scale, consider delegating to a job worker (supervisor, systemd, or external job queue) and let the web process enqueue jobs only.

## Using prebuilt files (quick start)

If you prefer not to build the viewer on every machine, this repository provides a ready-to-use `dist/` folder containing the prebuilt viewer bundles and assets. Consumers can either:

- Download and extract the `dfg_3dviewer-dist.zip` from the GitHub release (or copy the `dist/` folder from this repo).
- Copy the `dist/` folder to any static webroot and serve it as-is.

Two simple usage patterns:

- Use the shipped `index.html` (recommended):
  - Extract `dist/` and point your webserver to the folder root. Open `/index.html` in a browser.

- Embed the module in an existing page:
  - Copy the needed files from `dist/` (e.g. `dfg_3dviewer-module.js`, CSS and assets) into your webroot and include the script tag:

```html
<link rel="stylesheet" href="/path/to/dfg_3dviewer.b0020198.css">
<script type="module" src="/path/to/dfg_3dviewer-module.js"></script>
<div id="DFG_3DViewer" 3d="/path/to/model.glb" style="height:50vh"></div>
```

Notes:
- Always serve the files over HTTP(S). Opening `index.html` via `file://` often breaks module imports, WASM loads and XHR/fetch requests (causing errors such as `net::ERR_FAILED`). Use a small static server for local testing (examples below).
- The `dist/` folder already contains bundled dependencies (three.js, loaders, draco, etc.) so consumers don't need to run the build steps.

## Serving the prebuilt files locally

If you want to quickly test the prebuilt `dist/` on your machine, run a tiny static server and open the site at `http://localhost:<port>/index.html`.

Examples (PowerShell):

Node (no global install required if Node is present):
```powershell
# run the included lightweight server (uses PORT env or 8080)
node .\scripts\serve-dist.js
# or explicitly set a port
$env:PORT=8082; node .\scripts\serve-dist.js
```

npx http-server (one-liner, will prompt to install if not present):
```powershell
npx http-server .\dist -p 8080
Start-Process "http://localhost:8080/index.html"
```
OR
```powershell
http-server -c-1
```

Python (if you have Python installed):
```powershell
python -m http.server 8080 --directory .\dist
Start-Process "http://localhost:8080/index.html"
```

If the page loads correctly over HTTP but fails via `file://`, the issue is the browser's local-file restrictions — serving via HTTP is the correct remedy.

## Packaging & releases

The project contains a `pack-dist` helper and a GitHub Actions workflow that builds the `dist/` and uploads a `dfg_3dviewer-dist.zip` release artifact when a tag is created. Consumers can download that ZIP and extract it to any static host.

## Recent Updates

Notable changes in the latest updates:

Distribution & Packaging
- Added ready-to-use prebuilt `dist/` folder containing bundled viewer and assets.
- Created a distribution helper (`scripts/pack-dist.js`) and CI workflow for automatic release artifacts.
- Modified build to bundle three.js and loaders into self-contained output.
- Normalized paths in bundled HTML/JS for portability (can be hosted at any URL).

Development Improvements
- Added `scripts/serve-dist.js` — small Node static server for local testing.
- Added PowerShell-compatible example commands for serving files locally.
- Documented how to avoid `file://` limitations when testing locally.


Functions used during this step:
- ```handle_file``` - uses python script (downloaded and modified version of https://github.com/ux3d/2gltf2/tree/master) triggered by blender 
```${BLENDER_PATH}blender -b -P ${SPATH}/scripts/2gltf2/2gltf2.py -- "$INPATH/$FILENAME" "$GLTF" "$COMPRESSION" "$COMPRESSION_LEVEL" "$OUTPUT$OUTPUTPATH"```
- ```handle_ifc_file``` - uses IfcConvert script (available at https://ifcopenshell.sourceforge.net/ifcconvert.html)
```${SPATH}/scripts/IfcConvert "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb"```
- ```handle_blend_file``` - (not fully tested yet) uses python script triggered by blender
```${BLENDER_PATH}blender -b -P ${SPATH}/scripts/convert-blender-to-gltf.py "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb"```

- automatic rendering of 3D model for thumbnails - function ```render_preview```, which uses wrapper for triggering virtual environment (xvfb-run) for blender and it’s python script
```xvfb-run --auto-servernum --server-args="-screen 0 512x512x16" sudo ${BLENDER_PATH}blender -b -P ${SPATH}/scripts/render.py -- "$INPATH/$NAME.glb" "glb" $1 "$INPATH/views/" $IS_ARCHIVE -E BLENDER_EEVEE -f 1```
This step needs some steps to be performed before rendering:
- create scene containing loaded 3D model
- calculate bounding box (for camera and lights settlement)
- scale scene according to bounding box
- setup basic properties for rendering engine, output quality, lights, camera
- prepare rendering from camera placed in 9 different positions (left, left top, front, front top, right, right top, back, back top, top)
- write rendering outputs into png files with consecutive naming

## Minimal effort setup for 3D DFG Viewer

Since the project was refactored to use npm-based build tooling, you need to install dependencies and compile the viewer before running it locally. From the repository root run:

```bash
npm install
npm run build-all
npm start
```
The `build-all` script runs Parcel and Rollup (see `package.json`), producing the compiled viewer assets under the `viewer`/`build` directories.


```html
<!doctype html>
<html>
    <head>
    	<title>Three.js 3D-DFG-Viewer</title>
    <link rel="stylesheet" href="./viewer/css/spinner.css">
    <link rel="stylesheet" href="./viewer/css/main.css">
    </head>
    <body>
    <script type="module" src="./viewer/jquery-3.7.1.min.js"></script>
    <script src="./viewer/Toast.min.js"></script>
    <script src="./viewer/spinner/main.js"></script>
    <script type="module" src="./viewer/main.js"></script>
      <div id="DFG_3DViewer" 3d="your_model_name"></div>
    </body>
</html>

```
    
## Documentation



[Documentation](https://docs.google.com/document/d/10Qw37DwgMXHsuZqCol3xEf68S29eaj0Q-rOOAe3XhXE)


## Features

- 3D file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, glTF
- compression and rendering on-the-fly: obj, fbx, ply, dae, abc, blend, stl, wrl, x3d, glb, gltf
- basic interaction (rotate, scale, translate, zoom)
- metadata displaying
- saving/loading custom object's position, scale, rotation, lights, camera
- view object's hierarchy and select groups by name
- distance measurement
- face picking
- clipping planes
- manage materials
- fullscreen mode
- cross platform
- add watermark

## Using prebuilt files (quick start)

If you don't want to build the project on every machine, use the prebuilt distribution in `dist/`.

- Build locally and create a zip of the distribution:

```powershell
npm ci
npm run build
npm run pack-dist
# The resulting archive is `dfg_3dviewer-dist.zip` and `dist/` contains JS and assets
```

- Consumer usage (in a plain HTML site): copy `dist/dfg_3dviewer-module.js` and the `dist/assets/` folder to your webroot and include the script:

```html
<script src="/path/to/dfg_3dviewer-module.js"></script>
```

The bundle is produced as a self-contained IIFE exposing `Dfg3DViewer` (see `rollup.config.js`). If you choose not to bundle `three.js` in the future, include `three` before the module:

```html
<script src="/path/to/three.min.js"></script>
<script src="/path/to/dfg_3dviewer-module.js"></script>
```

- CI / releases: The included GitHub Actions workflow (`.github/workflows/build-release.yml`) will build the project and attach `dfg_3dviewer-dist.zip` to any tag that matches `v*` (e.g. `v1.0.0`). This lets to distribute ready-to-go archives without committing `dist/` to the repo.

