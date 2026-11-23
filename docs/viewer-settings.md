# `viewer-settings.json` explained

The viewer loads configuration from `viewer-settings.json` at runtime.

> AIM3D manifests can now carry these settings themselves (see `viewer/manifesto/AIM3DViewer-schema.md`, "Deployment settings" and "Precedence"). Values defined in the manifest override `viewer-settings.json`; the file stays the fallback for manifests that omit them and for `entity.metadata.*`, which locates the manifest. `viewer.lightweight` and `viewer.editor` are also read from the manifest at startup when it is the configured metadata source.

The example template is located at `viewer/viewer-settings-example.json`.

## Main settings

- `branding` — the deployment's name, logo, colours, favicon, page title and stylesheet; see [branding.md](branding.md)

- `mainUrl` — base backend URL used by viewer metadata and resource requests
- `metadataUrl` — metadata service URL
- `baseNamespace` — namespace used for entity routing and metadata
- `baseModulePath` — path to viewer assets/module when deployed

## Entity integration

- `entity.bundle` - Drupal/WissKI entity bundle identifier
- `entity.fieldDf` - field name used for 3D file references
- `entity.exportViewer` - export field name for viewer settings
- `entity.exportViewerUrl` - metadata URL used by export/viewer integration
- `entity.idUri` - pattern to extract entity IDs from path
- `entity.viewEntityPath` - base path for entity views
- `entity.attributeId` - identifier used for viewer container attribute
- `entity.metadata.source` - metadata source label, e.g. `Drupal` or `IIIF`

## Viewer settings

- `viewer.container` — target container ID for WebGL viewer
- `viewer.fileUpload` — Drupal upload field ID
- `viewer.fileName` — Drupal file name field ID
- `viewer.imageGeneration` — Drupal field ID for image generation
- `viewer.lightweight` — enable lightweight viewer mode when `true`; it also loads the environment maps' 256x128 copies (`assets/maps/lite/`, made by `scripts/downscale-hdr.py`: about 100 KB each instead of 1.4 MB). For a page with the model and nothing else, see `ultra.html` in [embedding.md](embedding.md)
- `viewer.editor` — show editor controls
- `viewer.gallery.build` — enable gallery generation from metadata/gallery sources
- `viewer.gallery.container` — DOM container for generated gallery thumbnails
- `viewer.gallery.imageClass` — class used to locate gallery images
- `viewer.gallery.imageId` — optional gallery image ID selector
- `viewer.gallery.position` — where the views of the model show: `right` (default; a drawer on the viewer's right edge, over the canvas, hidden and shown by its tab - remembered per browser; on a phone only the tab, which opens the lightbox) or `top` (the row above the viewer, as before)
- `viewer.background` — CSS background string for viewer canvas
- `viewer.ground` — what the model stands on: `contact` (default; a soft contact shadow, no visible floor), `mirror` (fading reflection), `grid` (technical grid without edges, fading out, axes in colour), `turntable` (disc with a compass, N = -Z, and a scale bar in the model's unit), `spotlight` (dark room with a pool of light; sets a dark background while chosen) or `dots` (dot grid). Changeable in the Ground window (Look menu); `?ground=` in the page URL and `ground` in a manifest (`scenes[id].ground`, `scene.ground`, `globals.ground` or AIM3DViewer `viewer.ground`, written by the viewer's own export) win over it. With the WebGPU renderer the contact shadow is a blurred blob, `mirror` falls back to it and `grid` is a plain grid; see `viewer/ground.js`
- `viewer.performanceMode` — performance mode config object
- `viewer.ai` — `false` hides the AI assistance even when the worker offers it (see [AI assistance](ai.md)); default: shown when the worker has it on
- `viewer.sceneSuggest.semantic` — the language model of the suggested scene, run in the browser (see [AI assistance](ai.md), section 5): `false` hides it; an object overrides any of `library` (transformers.js as an ES module, default jsDelivr's `@huggingface/transformers@3.8.1/dist/transformers.min.js`), `model` (default `Xenova/multilingual-e5-small`), `dtype` (`q8`), `prefix` (`"query: "`, what the model expects before a text), `sizeMb` (shown on the button, `120`), `modelHost` (another host of the models instead of the Hugging Face hub, e.g. `"/models/"`) and `wasmPaths` (where ONNX Runtime's `.wasm` files are)
- `viewer.surroundings.elevationUrl` — where the real terrain of the generated surroundings comes from ([surroundings](surroundings.md)): elevation tiles in the Terrarium encoding, `{z}`, `{x}`, `{y}` in the URL (default the open Terrain Tiles, `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`; only the tile numbers of the place go out); `null` switches the real terrain off
- `viewer.surroundings.mapUrl` — the Overpass API server(s) today's water of the surroundings comes from (rivers, natural lakes, the coast from OpenStreetMap): one URL or a list tried in turn - your own first ([docker](docker.md), profile `overpass`); default `https://overpass-api.de/api/interpreter`; the query holds the place and a radius; `null` switches it off
- `viewer.surroundings.historicalMapUrl` — OpenHistoricalMap's Overpass API, asked first for the water of the surroundings' year, and for its roads and buildings where no old map gives them (default `https://overpass-api.openhistoricalmap.org/api/interpreter`); `null` switches it off
- `viewer.surroundings.detail` — how much of the realistic surroundings is drawn: `"auto"` (default: `"light"` on a phone or a weak device, or while the render quality is "fast"; else `"full"`), `"full"` or `"light"` (fewer ground rings, a sparser far wood, no smoke or haystacks, simpler from nearer, no sun shadow map for them, cast shadows redrawn less often) - [surroundings](surroundings.md)
- `viewer.surroundings.shadowReach` — how far beyond the model's footprint (metres, default `80`) the sun's shadow map reaches while the realistic surroundings are shown: their houses there cast and take real shadows (on walls and on the model); `0` keeps all their shadows projected onto the ground
- `viewer.errorTracking` — GlitchTip DSN and options for bug reports and automatic error reports (`dsn`, `environment`, `autoCapture`, `sampleRate`); see [error-tracking.md](error-tracking.md)
- `viewer.bugReport` — the toolbar's "Report a bug" button: `enabled` (default `true`), `url` (issue tracker used when `errorTracking` is not set)
- `viewer.measurement.modelUnitInMeters` — conversion ratio from model units to meters - the fallback only: a unit chosen in the measurement menu (remembered per model), a IIIF Scene `spatialScale` / AIM3DViewer `units`, and the file's own unit (FBX, 3MF, AMF, USD, COLLADA) come first; see `viewer/editor/model-units.js`
- `viewer.animation.autoplay` — start the model's first animation clip after loading (default `true`)
- `viewer.animation.clip` — clip to select at start, by name or index; `"all"` plays every clip together
- `viewer.animation.speed` — initial playback speed (default `1`)
- `viewer.animation.loop` — repeat clips (default `true`); when `false` a clip stops on its last frame
- `viewer.animation.showPlayer` — show the animation player bar for animated models (default `true`)
- `viewer.progressive.enabled` — show `<model>.preview.glb` (written by the worker's optimization step) first when it exists next to a GLB/glTF model, then swap in the full model; default `true`, except in the Drupal build (its pipeline writes no previews, so probing would only add a 404 per model)
- `viewer.pointCloud.maxPoints` — LAS/LAZ files opened directly are thinned to about this many points (default `5000000`; every n-th point is kept); convert larger scans with the worker for full-resolution streaming. They are decoded in a Web Worker and shown from the first 100 000 points on, filling in while the rest loads; uncompressed LAS is decoded while it downloads, without keeping the file in memory
- `viewer.pointCloud.colorMode` — initial colouring of directly opened point clouds: `rgb`, `intensity`, `height` or `classification` (when the file carries it); changeable in the point cloud panel, switched in the shader (no recolouring of the buffers)
- `viewer.pointCloud.sizeMode` — point size of directly opened point clouds: `adaptive` (default; in world units, from the cloud's estimated point spacing, so points close the gaps between them at any distance) or `fixed` (screen pixels, `pointSize`); changeable in the point cloud panel
- `viewer.pointCloud.pointSize` — point size in screen pixels for `sizeMode: "fixed"`, and while a LAS/LAZ file is still loading (default `2`)
- `viewer.pointCloud.pointShape` — `square` (default), `round` or `sphere` for directly opened point clouds (falls back to `viewer.tiles.pointShape`)
- `viewer.pointCloud.edlStrength` — Eye-Dome Lighting for directly opened point clouds (default: `viewer.tiles.edlStrength`, else `0.4`; `0` turns it off - it costs one extra pass over the cloud per frame)
- `viewer.renderer` — `webgl` (default), `webgpu` or `auto`: three's WebGPU renderer where the browser has WebGPU, for mesh models; point clouds and Gaussian splats, and browsers without WebGPU, keep the WebGL renderer. `?renderer=webgl|webgpu|auto` in the page URL overrides it (for trying it out). With WebGPU, post-processing and ambient occlusion are a TSL pipeline (SMAA and FXAA use multisampling there), and the custom GLSL scan view, the tone mapping previews and WebXR are left out; see `viewer/renderer-backend.js`. For tests, `&webgpuBackend=webgl2` runs the WebGPU renderer on its WebGL 2 backend
- `viewer.tiles.errorTarget` — screen-space error in pixels for 3D Tiles / Potree models (default `6`; lower loads more detail)
- `viewer.tiles.pointShape` — `square`, `round` (default) or `sphere` for point clouds
- `viewer.tiles.edlStrength` — Eye-Dome Lighting strength for point clouds (default `0.4`; `0` turns it off)
- `viewer.tiles.pointScale` — point size factor for Potree clouds (default `1`)
- `viewer.tiles.georeferenced` — `true`: the tileset is in Earth-centred coordinates (ECEF, e.g. photogrammetry from Cesium ion) and is laid flat at its place on the globe; `false`: local or projected coordinates (UTM, Gauss-Krüger), Z up. Unset (default): guessed - Earth-centred only when the centre is far from the origin *and* more than 10 km off the equatorial plane, so scans in projected systems (northings of millions of metres) are no longer tilted
- `viewer.tour.autostart` — start the guided tour through the model's annotations once they are loaded (default `false`)
- `viewer.tour.autoplay` — advance tour steps automatically (default `false`)
- `viewer.tour.stepDuration` — seconds spent on each step while autoplaying (default `6`)
- `viewer.tour.transitionDuration` — seconds of the camera flight between steps (default `1.5`; `0` when the user prefers reduced motion)
- `viewer.tour.loop` — go back to the first step after the last one while autoplaying (default `true`)
- `viewer.viewHelper` — axes gizmo in a corner of the canvas; `false` or `{ "enabled": false }` hides it, `{ "position": "top-left" }` moves it (`bottom-right` by default)
- `viewer.fillViewport` — on the standalone page (`index.html`), the viewer takes the whole browser window below the header and gallery (default `true`); `false` keeps the height set on `#DFG_3DViewer` (`50vh`). Pages that embed the viewer (Drupal, `embed.html`) are not affected
- `viewer.intro` — the intro ([`docs/intro.md`](intro.md)) in front of the standalone page (`index.html`): a full-window layer over the viewer, which starts and loads its model underneath; "Enter the viewer" fades it away; through it the viewer opens the intro's model, whatever was opened last. Also in the app build (on its first start); not on embedded pages or in Drupal
  - `enabled` — show it (default `true`); `?intro=1` / `?intro=0` in the page address overrides it
  - `show` — `once` (default): on the first visit only, remembered in the browser's `localStorage` (`explora4d-intro-seen`); `session`: once per browser session; `always`
  - `sound` — the intro's sound on by default (default `false`); browsers start it only with the visitor's first click or key press, and the visitor's own on/off choice is remembered and wins
  - `url` — the intro page, relative to the viewer page, same site only (default `intro.html`)
  - `scene` — the intro's model: a scene file (e.g. `assets/intro/scenes/tempietto/scene.json`, the second built-in one) or the scene itself; default the Wołpa Synagogue. See [intro.md](intro.md#another-model)
- `viewer.scaleContainer` — scale adjustments for the viewer container
- `viewer.exampleModelsUrl` — the list of the "Load example model" select (default: `./examples/index.json`, served with the viewer; the app fetches `https://explora4d.eu/viewer/examples/index.json`). Fetched at start, when the select opens (at most once a minute), when the page comes back to the foreground and when the network returns. The app keeps the last list on the device (for offline use); a web viewer falls back to its bundled copy. Format: `{ "models": [{ "url", "name", "app"?, "testing"? }] }`, `name` a string or `{ en, de, pl }`, `"app": false` not offered in the app, `"testing": true` only in the testing build (`BUILD=test`: `build:test` and the dev server - the broken test files). The app loads models added after its release from the list's site (online only); see `viewer/example-models.js`
- `viewer.exampleManifestsUrl` — the same for the example manifests (default `./manifests/index.json`; the app fetches `https://explora4d.eu/viewer/manifests/index.json`); entries may carry `group` and `variant` to be listed under their model's name (`groups`); see `viewer/example-manifests.js`

## Built output behavior

- `rollup.config.js` copies `viewer-settings.json` into `dist/<target>/`
- For `test` and `dev` builds, the generated `viewer-settings.json` is modified to:
  - set `mainUrl = 'localhost'`
  - disable gallery build
  - enable editor mode
  - set `viewer.lightweight = true`
- For `drupal` builds, `baseModulePath` is rewritten to the Drupal assets path and `entity.metadata.source` is set to `Drupal`
