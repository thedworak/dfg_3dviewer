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
- `editorToolbar` is the canonical editor toolbar runtime state used by the current viewer
- `viewer.clipping` is the canonical location for clipping state

`editorToolbar` fields:

- `enabled`: whether the toolbar feature is enabled by config
- `position`: current dragged toolbar offset relative to the host container
- `expanded`: whether the secondary tray is expanded
- `visible`: whether the toolbar is currently visible in the UI

## `AIM3DViewer.integration`

Stores CMS and runtime integration details such as Drupal field names and metadata source settings.

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