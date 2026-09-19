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

- Read directly by the viewer: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, GLB, glTF, plus (via three.js loaders) USD/USDA/USDC/USDZ, 3MF, AMF, WRL (VRML), KMZ, VOX (MagicaVoxel) and LWO (LightWave)
- Converted to GLB by the standalone worker: STEP/STP and IGES/IGS (CAD, OpenCASCADE via `cascadio`), 3MF (`trimesh`) and USD/USDZ (Blender), in addition to the Blender formats listed below

Not added on purpose: VTK (its three.js loader is deprecated and scheduled for removal), LDraw (needs a separate parts library), 3DM (needs the extra `rhino3dm` runtime) and PDB/MD2/NRRD/GCode/BVH (not general model formats). LWO has a loader but no sample file, so it is untested.

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

or using serve:
```bash
npx serve -n
```

or using PHP:
```bash
php -S 127.0.0.1:8000 -t ../../viewer
```

4. Open the demo at:

```text
http://localhost:1234
```

> `viewer/viewer-settings.json` is required at runtime when running from source. Use the example file as the starting point.

## Standalone Docker setup

The conversion pipeline (Blender + Python + `scripts/convert.sh`/`scripts/render.sh`) can also run without Drupal, as a small HTTP worker, alongside a static build of the viewer:

```bash
docker compose up --build
```

This starts one shared conversion API on `:8080`, plus three viewer endpoints — each a static build fronted by nginx, reverse-proxying to that same worker (same-origin, no CORS/config needed):

| Service          | Port   | Build          | Notes |
|------------------|--------|----------------|-------|
| `viewer-test`    | `:3000`| `dist/test`    | `npm run build:test` |
| `viewer-dev`     | `:3001`| `dist/dev`     | `npm run build:dev` |
| `viewer-sandbox` | `:3002`| `dist/test`    | same build as `viewer-test`, but opens straight into drag-and-drop upload mode (`viewer/sandbox.js`) — normally reached via `?sandbox=1` on any build, baked on here by default |

#### Docker profiles (settings from an AIM3D manifest)

Each viewer image takes its settings from an AIM3D manifest instead of a hand-edited `viewer-settings.json`. The three profiles live in [`docker/profiles/`](docker/profiles/) and are selected with the `VIEWER_PROFILE` build arg:

| Profile   | File                                   | Used by          | Difference |
|-----------|----------------------------------------|------------------|------------|
| `test`    | `docker/profiles/test.manifest.json`    | `viewer-test`    | baseline settings |
| `dev`     | `docker/profiles/dev.manifest.json`     | `viewer-dev`     | adds the gradient `background` |
| `sandbox` | `docker/profiles/sandbox.manifest.json` | `viewer-sandbox` | `viewer.sandbox: true` (drag-and-drop mode) |

At build time the profile is validated (`node scripts/validate-docker-profiles.mjs [profile]`, so a broken profile fails the build), installed as `manifests/docker-profile.json`, and `viewer-settings.json` is pointed at it (`entity.metadata.sourceType = AIM3IF`, `url = manifests/docker-profile.json`). `viewer-settings.json` remains the fallback for anything the profile doesn't define; see `viewer/manifesto/AIM3DViewer-schema.md` for precedence and which keys apply at startup (`editor`, `lightweight`, `sandbox`, `presentationMode`). To build one image by hand:

```bash
docker build -f Dockerfile.viewer --build-arg BUILD_TARGET=dev --build-arg VIEWER_PROFILE=dev -t dfg-3dviewer-viewer-dev .
```

#### Helper script: `scripts/docker.sh`

A small wrapper around `docker compose` for the everyday operations. Requirements: Docker with the Compose plugin, run from anywhere (the script switches to the repo root itself).

```bash
scripts/docker.sh <command> [profile] [--up]
scripts/docker.sh                # no arguments: interactive menu
scripts/docker.sh --help
```

**Commands**

| Command   | What it does |
|-----------|--------------|
| `build`   | Builds the image(s). |
| `down`    | Stops and removes the container(s); volumes (settings, converted models) are kept. |
| `rebuild` | `down`, then `build`. Use this after changing code, a profile manifest or `.env`. |
| `prune`   | `docker system prune` (unused containers, networks, dangling images). Docker asks for confirmation first; the script does not force it. |

**Profile** (optional): `dev`, `test` or `sandbox` - acts only on that service (`viewer-dev`, `viewer-test`, `viewer-sandbox`) and builds it with the matching manifest from `docker/profiles/`. Without a profile, `build` and `down` act on everything, including the shared `worker`. `prune` ignores the profile.

**`--up`** (with `build` or `rebuild`): starts the result afterwards (`docker compose up -d`). Without it, images are built but nothing is started.

**Output**: each step prints a green `✔` line saying what just happened (e.g. `✔ Image for viewer-dev built (profile: dev)`). `build`/`rebuild` end with the URLs the services are available on. After `--up` they are read from Docker, so port remaps from `docker-compose.override.yml` are shown correctly; without `--up` the defaults are listed as "once started":

```text
>> Available on:
   viewer-sandbox  http://localhost:3002
```

Default ports: `viewer-test` 3000, `viewer-dev` 3001, `viewer-sandbox` 3002, `worker` 8080.

**Examples**

```bash
scripts/docker.sh build                  # all images
scripts/docker.sh rebuild sandbox --up   # rebuild and start just the sandbox viewer
scripts/docker.sh down dev               # remove only the dev viewer container
scripts/docker.sh down                   # remove everything (volumes are kept)
scripts/docker.sh prune                  # free disk space, asks first
```

**Notes**
- The profile is passed to `docker-compose.yml` as the `VIEWER_PROFILE` variable (`${VIEWER_PROFILE:-<default>}` in each service's build args); the compose file itself is never rewritten. A `VIEWER_PROFILE` already exported in your shell therefore also affects plain `docker compose build`.
- Compose variables such as `WORKER_AUTH_MODE` or `WORKER_ADMIN_USER` come from a `.env` file next to `docker-compose.yml` (git-ignored). After editing it, run `scripts/docker.sh rebuild --up`.
- Existing settings volumes keep their old `viewer-settings.json`; see the volume note under "Docker profiles" above.

#### Publishing for a portfolio (cheap static hosting)

Instead of exposing the conversion worker publicly, export the finished models and host them statically:

```bash
docker compose cp worker:/data/jobs ./jobs-export
python3 scripts/export-static.py --jobs-dir ./jobs-export --out ./static-export --base-url https://models.example.com
```

This copies each GLB and its renders and writes an AIM3D manifest per model (view-only: editor off, no worker dependency), plus `index.json`. `--only <job-id>` and `--owner <account>` narrow the selection. Upload the folder to any static host (Cloudflare R2/Pages, GitHub Pages, ...) with a long `Cache-Control`; `--base-url` must be the public URL it will be served from. Validate a result with `node scripts/validate-docker-profiles.mjs static-export/manifests/<name>.json`.

#### Upload limit and accounts

Uploads are capped at 100 MB by default (`WORKER_MAX_UPLOAD_BYTES` in `docker-compose.yml`, mirrored by `client_max_body_size` in `docker/nginx.conf`); larger files get HTTP 413 and the upload panel shows the worker's limit. To see and control who uploads, enable optional accounts (`WORKER_AUTH_MODE=required` in a `.env` file: registration with admin approval, per-upload ownership, admin CLI) - see "Accounts" in [`worker/README.md`](worker/README.md). The manifest option `AIM3DViewer.viewer.auth` only shows/hides the login UI; the worker enforces access.

Both `viewer-settings.json` and the profile manifest are persisted in the service's settings volume and seeded only on first start, so edits survive rebuilds. **Existing volumes** keep their old `viewer-settings.json` (without the manifest pointer) and will not pick up the profile until you delete the volume (`docker compose down -v` for that service) or add the two `entity.metadata` values yourself. The `dev` build still loads IIIF models (that build forces the IIIF source); it only takes its settings from the profile.

See [`worker/README.md`](worker/README.md) for the worker's API contract/configuration, and how to add a fourth `dist/prod` service the same way. Each viewer's main menu gets an "Upload & convert" button in this mode, driving the same pipeline through the browser. This is additive — the existing Drupal-integrated pipeline (`ConvertWorker` queue plugin, `scripts/worker.sh`, `drush`) is untouched and keeps working as-is for the current instance.

The Drupal module can also optionally be pointed at the `worker` container instead of running Blender locally — set the module's "Conversion backend" to Docker and give it the worker's URL — without changing anything else about the module's own upload/queue/field workflow. See "Using this worker from the Drupal module" in [`worker/README.md`](worker/README.md).

## Admin panel setup

The repository includes a minimal admin panel at `viewer/admin/` for editing `viewer-settings.json`, `scripts/.env`, managing HDRI and running maintenance tasks.

1. Ensure PHP CLI is installed and the webserver user can write into `viewer/admin/`.

2. Install SQLite support (PHP extension and CLI)

For Debian/Ubuntu:

```bash
sudo apt update
sudo apt install php-sqlite3 sqlite3
```

For RHEL/CentOS/Fedora:

```bash
sudo dnf install php-sqlite3 sqlite
```

After installing the PHP extension, restart your webserver/PHP-FPM:

```bash
sudo systemctl restart apache2        # or nginx + php-fpm
sudo systemctl restart php8.4-fpm     # adjust version as needed
```

Verify installation:

```bash
php -m | grep -i sqlite
sqlite3 --version
```

3. Create the SQLite admin DB and the first admin user (CLI):

2. Create the SQLite admin DB and the first admin user (CLI):

```bash
# from repository root
php viewer/admin/create_admin.php <username> <password>

# or from viewer/admin/
php create_admin.php <username> <password>
```

The script will create `viewer/admin/admin.sqlite` automatically and insert the user (passwords are hashed).

3. Open the admin UI in your browser and log in:

```text
http://<host>/viewer/admin/login.php
```

4. Notes & troubleshooting
- The `create_admin.php` script must be run from a shell (CLI). If it fails, verify `php -v` and file permissions.
- The web server (e.g. `www-data`) must have write access to `viewer/admin/admin.sqlite` and to the `viewer/` and `scripts/` paths for saving settings and backups. Example:

```bash
sudo chown -R www-data:www-data viewer/admin viewer scripts
sudo chmod -R 750 viewer/admin viewer scripts
```

- If you need to reset or change the admin password you can either recreate the user with the CLI (delete the old row using `sqlite3`) or edit the DB manually. Example to open DB with sqlite3:

```bash
sqlite3 viewer/admin/admin.sqlite
-- then: SELECT * FROM admins;  DELETE FROM admins WHERE username='...';
```

Security: this admin panel is intentionally minimal. For production use enable HTTPS, restrict access by IP if possible, and consider adding CSRF protection and stronger session handling.

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

> AIM3D manifests can now carry these settings themselves (see `viewer/manifesto/AIM3DViewer-schema.md`, "Deployment settings" and "Precedence"). Values defined in the manifest override `viewer-settings.json`; the file stays the fallback for manifests that omit them and for `entity.metadata.*`, which locates the manifest. `viewer.lightweight` and `viewer.editor` are also read from the manifest at startup when it is the configured metadata source.

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

- 3D file formats read directly: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, PCD, JSON, 3DS, glTF/GLB, USD/USDA/USDC/USDZ, 3MF, AMF, WRL, KMZ, VOX, LWO;
- compression and rendering on-the-fly: OBJ, FBX, STL, DAE, PLY, ABC, BLEND, WRL, X3D, USD/USDA/USDC/USDZ, GLB, GLTF; the standalone worker additionally converts STEP/STP, IGES/IGS and 3MF (see "Supported conversion inputs");
- 3D viewer with orbit controls, zoom, and basic editor tools;
- changing lights properties and environment maps;
- standalone version | embeddable version | presentation mode | lightweight or full mode;
- loading archives (zip, rar);
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
    - abc, dae, fbx, obj, ply, stl, wrl, x3d, usd, usda, usdc, usdz - function ```handle_file``` (the usd* formats need a Blender build with USD support, e.g. the official release; distro packages such as Ubuntu's often lack it)
    - ifc - function ```handle_ifc_file```
    - blend (in progress) - function ```handle_blend_file```
    - glb - triggers next step - function ```render_preview```
    - step, stp, iges, igs, 3mf - not handled by `convert.sh`: the standalone Docker worker converts them with `scripts/convert_mesh.py` (OpenCASCADE/trimesh) instead

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

- Blender importers (`scripts/convert.sh`): abc, dae, fbx, obj, ply, stl, wrl, x3d, usd, usda, usdc, usdz, ifc, blend, gml, glb
- Without Blender (`scripts/convert_mesh.py`, used by the worker): step, stp, iges, igs (tessellated by OpenCASCADE, so `--tol-linear` trades detail for size), 3mf
- Viewer-native, kept as uploaded and without thumbnails: gltf (inside a .zip with its .bin/textures), 3ds, pcd, xyz, amf, kmz, vox, lwo

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

![IIIF-AIM3D Data Flow.png](https://i.postimg.cc/htwXZNCh/IIIF-AIM3D-flow.png)


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