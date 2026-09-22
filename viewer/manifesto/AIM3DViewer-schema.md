# AIM3DViewer Manifest Schema

This document describes the canonical custom manifest block used by the viewer:

The machine-readable schema lives in [AIM3DViewer-schema.json](./AIM3DViewer-schema.json).

```json
{
  "AIM3DViewer": {
    "version": "1.0",
    "generatedAt": "2026-08-11T12:00:00.000Z",
    "camera": {},
    "viewer": {},
    "integration": {},
    "lights": [],
    "modelTransform": {}
  }
}
```

The runtime currently reads and writes the following fields.

## `AIM3DViewer.camera`

Stores the camera pose and projection state.

```json
{
  "position": [0, 2, 5],
  "target": [0, 0, 0],
  "up": [0, 1, 0],
  "fov": 45,
  "zoom": 1,
  "distance": 5.385,
  "perspectiveMode": "perspective"
}
```

- `position`: camera position as `[x, y, z]`
- `target`: orbit target as `[x, y, z]`
- `up`: camera up vector as `[x, y, z]`
- `fov`: used for perspective camera
- `zoom`: used for orthographic camera
- `distance`: informational only
- `perspectiveMode`: `perspective` or `orthographic`

## `AIM3DViewer.viewer`

Stores runtime viewer options.

```json
{
  "container": "DFG_3DViewer",
  "mailUrl": "https://example.org",
  "baseNamespace": "https://example.org",
  "metadataUrl": "https://example.org",
  "theme": "dark",
  "language": "en",
  "backgroundColor": "#000000",
  "environmentMap": {
    "intensity": 0.5,
    "preset": "neutral",
    "enabled": true
  },
  "presentationMode": false,
  "sandbox": false,
  "autorotate": false,
  "autorotateSpeed": 1.5,
  "disableInteraction": false,
  "hideUi": false,
  "hideMetadata": false,
  "showNotifications": true,
  "scale": { "x": 1, "y": 1 },
  "window": {
    "position": { "x": 120, "y": 80 },
    "size": { "width": 900, "height": 600 }
  },
  "performance": "high-performance",
  "units": 1,
  "gallery": {},
  "editorToolbar": {
    "enabled": true,
    "position": { "x": 0, "y": 0 },
    "expanded": false,
    "visible": true
  },
  "menuToolbar": {
    "enabled": true,
    "position": { "x": 0, "y": 0 }
  },
  "clipping": {
    "mode": {
      "x": false,
      "y": false,
      "z": false
    },
    "constants": [1, 1, 1],
    "outlineVisible": false
  }
}
```

Notes:

- `theme`: `dark` or `light`
- `language`: currently `en`, `pl`, or `de`
- `autorotate` and `autorotateSpeed` map to OrbitControls state
- `disableInteraction` disables rotate, pan, and zoom input
- `hideUi` hides the action menu and editor toolbar
- `hideMetadata` hides the metadata panel
- `showNotifications` controls toast/status notices
- `window` stores the movable viewer host geometry in viewport pixels
- `editorToolbar` is the canonical editor toolbar runtime state used by the current viewer
- `viewer.clipping` is the canonical location for clipping state

### Deployment settings (formerly only in `viewer-settings.json`)

These optional `viewer` fields carry values that used to live only in `viewer-settings.json`:

- `mainUrl`: site base URL (`mailUrl` is the older name and is still written for compatibility)
- `baseModulePath`: base path of the viewer module assets
- `background`: CSS `background` value for the canvas (e.g. a `radial-gradient(...)`); `backgroundColor` remains the scene colour
- `credits`: credits footer definition (`visible`, `logo`, `items`), same shape as in `viewer-settings.json`
- `auth`: `{ "enabled": boolean, "allowRegistration": boolean }` - login UI in the upload panel. **This only controls the UI**: whether accounts are required is enforced by the conversion worker (`WORKER_AUTH_MODE`, see `worker/README.md`), because a manifest is client-side data. Unset = follow the worker's `/api/auth/config`; `enabled: false` never shows the login UI; `allowRegistration: false` hides the Register button
- `manifestoForm` / `metadataContainer`: panel geometry as `{ "position": { x, y }, "size": { width, height } }` (`size` values may be `null`)

`scale`, `performance`, `units`, `gallery`, `editorToolbar` and `menuToolbar` were already part of this block and map to the matching `viewer-settings.json` entries.

### Precedence

`viewer-settings.json` is still loaded first and acts as the fallback. When an AIM3D manifest is loaded, every value it defines overrides the loaded configuration; anything it omits keeps the `viewer-settings.json` value. Manifests written before these fields existed therefore keep working unchanged.

`entity.metadata.*` (manifest source and URL) is needed to find the manifest, so it always stays in `viewer-settings.json`.

`viewer.lightweight`, `viewer.editor`, `viewer.sandbox` and `viewer.presentationMode` (booleans) decide how the UI is built, so at startup the viewer peeks at the AIM3D manifest configured in `entity.metadata.url` (whenever `entity.metadata.sourceType` is `AIM3IF`, even in builds that force another model source) and applies them, together with the deployment settings above, before building the UI. If the manifest cannot be fetched or parsed, or omits them, the `viewer-settings.json` values are used. They only apply to the manifest configured as the metadata source, not to manifests loaded later from the manifest form. The viewer never writes `lightweight` or `editor` on export, so a shared manifest cannot enable the editor elsewhere by accident; add them by hand where needed.

`window` fields:

- `position`: top-left viewer offset as `{ x, y }` pixels
- `size`: viewer host dimensions as `{ width, height }` pixels
- The importer clamps the geometry to the current browser viewport; when `window` is absent, the default host layout is preserved.

`editorToolbar` fields:

- `enabled`: whether the toolbar feature is enabled by config
- `position`: current dragged toolbar offset relative to the host container
- `expanded`: whether the secondary tray is expanded
- `visible`: whether the toolbar is currently visible in the UI

## `AIM3DViewer.integration`

Stores CMS and runtime integration details such as Drupal field names and metadata source settings.

Besides the Drupal field names (`bundle`, `fieldDf`, `exportViewer`, `idUri`, `viewEntityPath`, `attributeId`, `fileUpload`, `fileName`, `imageGeneration`, `metadata`), it may contain:

- `exportViewerUrl`: maps to `entity.exportViewerUrl`
- `api.thumbnailUploadEndpoint`: maps to `api.thumbnailUploadEndpoint`

## `AIM3DViewer.lights`

Stores scene light configuration.

Each light may contain:

```json
{
  "type": "DirectionalLight",
  "position": [0, 100, 50],
  "target": [0, 0, 0],
  "color": "#ffffff",
  "intensity": 1
}
```

## `AIM3DViewer.modelTransform`

Stores model transform and rendering flags.

```json
{
  "position": [0, 0, 0],
  "rotation": {
    "x": 0,
    "y": 0,
    "z": 0,
    "order": "XYZ"
  },
  "scale": [1, 1, 1],
  "wireframe": false
}
```

## Compatibility

- `AIM3DViewer.viewer.clipping` is the preferred schema.
- `AIM3DViewer.viewer.editorToolbar` is the preferred schema for editor toolbar state.
- `AIM3DViewer.viewer.menuToolbar` is kept as a backward-compatibility field for older manifests.
- The importer also accepts `AIM3DViewer.clipping` as a backward-compatibility fallback.
- `camera.zoom` is read from the camera state and should be treated as the source of truth for orthographic view restoration.