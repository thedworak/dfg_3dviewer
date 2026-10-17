# `viewer-settings.json` explained

The viewer loads configuration from `viewer-settings.json` at runtime.

> AIM3D manifests can now carry these settings themselves (see `viewer/manifesto/AIM3DViewer-schema.md`, "Deployment settings" and "Precedence"). Values defined in the manifest override `viewer-settings.json`; the file stays the fallback for manifests that omit them and for `entity.metadata.*`, which locates the manifest. `viewer.lightweight` and `viewer.editor` are also read from the manifest at startup when it is the configured metadata source.

The example template is located at `viewer/viewer-settings-example.json`.

## Main settings

- `mainUrl` — base backend URL used by viewer metadata and resource requests
- `metadataUrl` — metadata service URL
- `baseNamespace` — namespace used for entity routing and metadata
- `baseModulePath` — path to viewer assets/module when deployed

## Entity integration

- `entity.bundle` — Drupal/WissKI entity bundle identifier
- `entity.fieldDf` — field name used for 3D file references
- `entity.exportViewer` — export field name for viewer settings
- `entity.exportViewerUrl` — metadata URL used by export/viewer integration
- `entity.idUri` — pattern to extract entity IDs from path
- `entity.viewEntityPath` — base path for entity views
- `entity.attributeId` — identifier used for viewer container attribute
- `entity.metadata.source` — metadata source label, e.g. `Drupal` or `IIIF`

## Viewer settings

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
- `viewer.ai` — `false` hides the AI assistance even when the worker offers it (see [AI assistance](ai.md)); default: shown when the worker has it on
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
- `viewer.scaleContainer` — scale adjustments for the viewer container
- `viewer.exampleModelsUrl` — the list of the "Load example model" select (default: `./examples/index.json`, served with the viewer; the app fetches `https://viewer.thedworak.com/examples/index.json`). Fetched at start, when the select opens (at most once a minute), when the page comes back to the foreground and when the network returns. The app keeps the last list on the device (for offline use); a web viewer falls back to its bundled copy. Format: `{ "models": [{ "url", "name", "app"? }] }`, `name` a string or `{ en, de, pl }`, `"app": false` not offered in the app. The app loads models added after its release from the list's site (online only); see `viewer/example-models.js`
- `viewer.exampleManifestsUrl` — the same for the example manifests (default `./manifests/index.json`; the app fetches `https://viewer.thedworak.com/manifests/index.json`); entries may carry `group` and `variant` to be listed under their model's name (`groups`); see `viewer/example-manifests.js`

## Built output behavior

- `rollup.config.js` copies `viewer-settings.json` into `dist/<target>/`
- For `test` and `dev` builds, the generated `viewer-settings.json` is modified to:
  - set `mainUrl = 'localhost'`
  - disable gallery build
  - enable editor mode
  - set `viewer.lightweight = true`
- For `drupal` builds, `baseModulePath` is rewritten to the Drupal assets path and `entity.metadata.source` is set to `Drupal`
