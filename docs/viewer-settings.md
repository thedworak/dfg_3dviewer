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
- `viewer.scaleContainer` — scale adjustments for the viewer container

## Built output behavior

- `rollup.config.js` copies `viewer-settings.json` into `dist/<target>/`
- For `test` and `dev` builds, the generated `viewer-settings.json` is modified to:
  - set `mainUrl = 'localhost'`
  - disable gallery build
  - enable editor mode
  - set `viewer.lightweight = true`
- For `drupal` builds, `baseModulePath` is rewritten to the Drupal assets path and `entity.metadata.source` is set to `Drupal`
