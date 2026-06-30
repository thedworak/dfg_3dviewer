# `viewer-settings.json`

The viewer loads its configuration from `viewer-settings.json` at runtime (in source/standalone
mode). The example template lives at `viewer/viewer-settings-example.json` (a copy also exists
at the repository root as `viewer-settings-example.json`).

In Drupal `main` builds there is **no** `viewer-settings.json`; configuration is provided by
Drupal through `drupalSettings.dlf_aim_3d_viewer`.

## Example

```json
{
  "baseNamespace": "",
  "mainUrl": "https://your.domain.com",
  "metadataUrl": "",
  "baseModulePath": "/modules/dlf_aim_3d_viewer/viewer",
  "entity": {
    "bundle": "bd1220d6ec7f07e726c65fd215d8e493",
    "fieldDf": "field_df",
    "exportViewer": "field_df",
    "exportViewerUrl": "https://your.domain.com",
    "idUri": "/wisski/navigate/(.*)/view",
    "viewEntityPath": "/wisski/navigate/",
    "attributeId": "wisski_id",
    "metadata": {
      "sourceType": "Drupal",
      "url": "https://repository.covher.eu/api/digital_reconstruction/record/"
    }
  },
  "viewer": {
    "container": "DLF_AIM_3DViewer",
    "fileUpload": "fad29437cb2a561b91b26aca5dbb7c42",
    "fileName": "fb76901eb219495fee0512b5cdfdaa18",
    "imageGeneration": "fd6a974b7120d422c7b21b5f1f2315d9",
    "presentationMode": false,
    "sandboxMode": false,
    "lightweight": true,
    "scaleContainer": { "x": "1.0", "y": "1.0" },
    "editor": true,
    "gallery": {
      "build": true,
      "container": "block-bootstrap5-content",
      "imageClass": "field--name-fd6a974b7120d422c7b21b5f1f2315d9",
      "imageId": "field--name-fd6a974b7120d422c7b21b5f1f2315d9",
      "buildFake": true,
      "testImages": []
    },
    "background": "radial-gradient(circle, #ffffff 0%, #999999 100%)",
    "performanceMode": { "Performance": "high-performance" },
    "measurement": { "modelUnitInMeters": 1 }
  }
}
```

## Top-level settings

| Key | Purpose |
|-----|---------|
| `baseNamespace` | Namespace used for entity routing and metadata |
| `mainUrl` | Base backend URL for viewer metadata and resource requests |
| `metadataUrl` | Metadata service URL |
| `baseModulePath` | Path to the viewer assets/module when deployed |

## `entity` — integration

| Key | Purpose |
|-----|---------|
| `entity.bundle` | Drupal/WissKI entity bundle identifier |
| `entity.fieldDf` | Field name used for 3D file references |
| `entity.exportViewer` | Export field name for viewer settings |
| `entity.exportViewerUrl` | Metadata URL used by export/viewer integration |
| `entity.idUri` | Regex to extract entity IDs from the path |
| `entity.viewEntityPath` | Base path for entity views |
| `entity.attributeId` | Identifier used for the viewer container attribute |
| `entity.metadata.sourceType` | Metadata source label, e.g. `Drupal` or `IIIF` |
| `entity.metadata.url` | Metadata record endpoint |

## `viewer` — runtime

| Key | Purpose |
|-----|---------|
| `viewer.container` | Target container ID for the WebGL viewer |
| `viewer.fileUpload` | Drupal upload field ID |
| `viewer.fileName` | Drupal file name field ID |
| `viewer.imageGeneration` | Drupal field ID for generated thumbnails |
| `viewer.presentationMode` | Start in presentation mode |
| `viewer.sandboxMode` | Start in drag-and-drop sandbox mode |
| `viewer.lightweight` | Enable lightweight viewer mode |
| `viewer.editor` | Show editor controls |
| `viewer.scaleContainer` | `{ x, y }` scale adjustments for the viewer container |
| `viewer.gallery.build` | Enable gallery generation from metadata/gallery sources |
| `viewer.gallery.container` | DOM container for generated gallery thumbnails |
| `viewer.gallery.imageClass` | Class used to locate gallery images |
| `viewer.gallery.imageId` | Optional gallery image ID selector |
| `viewer.gallery.buildFake` / `testImages` | Test/placeholder gallery support |
| `viewer.background` | CSS background string for the viewer canvas |
| `viewer.performanceMode` | Performance mode config object (e.g. `high-performance`) |
| `viewer.measurement.modelUnitInMeters` | Conversion ratio from model units to meters |

## How the build rewrites settings

The Rollup build derives the output `viewer-settings.json` from the example template merged
with a root `viewer-settings.json`:

- **`test` / `dev`** — `mainUrl = 'localhost'`, gallery build disabled, editor enabled,
  `viewer.lightweight = true`.
- **`drupal:custom`** — `baseModulePath = '/libraries/dlf_aim_3d_viewer/dist/drupal/custom/assets'`,
  `entity.metadata.source = 'Drupal'`.
- **`drupal` (main)** — no settings file is written.

See [Build targets](build-targets.md) for details.
