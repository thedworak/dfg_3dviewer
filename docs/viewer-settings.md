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
- `viewer.measurement.modelUnitInMeters` — conversion ratio from model units to meters
- `viewer.animation.autoplay` — start the model's first animation clip after loading (default `true`)
- `viewer.animation.clip` — clip to select at start, by name or index; `"all"` plays every clip together
- `viewer.animation.speed` — initial playback speed (default `1`)
- `viewer.animation.loop` — repeat clips (default `true`); when `false` a clip stops on its last frame
- `viewer.animation.showPlayer` — show the animation player bar for animated models (default `true`)
- `viewer.progressive.enabled` — show `<model>.preview.glb` (written by the worker's optimization step) first when it exists next to a GLB/glTF model, then swap in the full model; default `true`, except in the Drupal build (its pipeline writes no previews, so probing would only add a 404 per model)
- `viewer.pointCloud.maxPoints` — LAS/LAZ files opened directly are thinned to about this many points (default `5000000`); convert larger scans with the worker for full-resolution streaming
- `viewer.pointCloud.pointSize` — point size in screen pixels for directly opened LAS/LAZ files (default `2`)
- `viewer.tiles.errorTarget` — screen-space error in pixels for 3D Tiles / Potree models (default `6`; lower loads more detail)
- `viewer.tiles.pointShape` — `square`, `round` (default) or `sphere` for point clouds
- `viewer.tiles.edlStrength` — Eye-Dome Lighting strength for point clouds (default `0.4`; `0` turns it off)
- `viewer.tiles.pointScale` — point size factor for Potree clouds (default `1`)
- `viewer.tour.autostart` — start the guided tour through the model's annotations once they are loaded (default `false`)
- `viewer.tour.autoplay` — advance tour steps automatically (default `false`)
- `viewer.tour.stepDuration` — seconds spent on each step while autoplaying (default `6`)
- `viewer.tour.transitionDuration` — seconds of the camera flight between steps (default `1.5`; `0` when the user prefers reduced motion)
- `viewer.tour.loop` — go back to the first step after the last one while autoplaying (default `true`)
- `viewer.viewHelper` — axes gizmo in a corner of the canvas; `false` or `{ "enabled": false }` hides it, `{ "position": "top-left" }` moves it (`bottom-right` by default)
- `viewer.scaleContainer` — scale adjustments for the viewer container

## Built output behavior

- `rollup.config.js` copies `viewer-settings.json` into `dist/<target>/`
- For `test` and `dev` builds, the generated `viewer-settings.json` is modified to:
  - set `mainUrl = 'localhost'`
  - disable gallery build
  - enable editor mode
  - set `viewer.lightweight = true`
- For `drupal` builds, `baseModulePath` is rewritten to the Drupal assets path and `entity.metadata.source` is set to `Drupal`
