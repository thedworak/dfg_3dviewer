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
    "rakingLight": {},
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
  "rendering": {
    "toneMapping": "neutral",
    "exposure": 1,
    "postprocessing": {
      "enabled": false,
      "antialias": "msaa",
      "ao": false,
      "aoIntensity": 1
    }
  },
  "tour": {
    "autostart": false,
    "autoplay": false,
    "stepDuration": 6,
    "transitionDuration": 1.5,
    "loop": true
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
- `rendering` controls how the canvas image is produced (all fields optional; `viewer-settings.json` `viewer.rendering` is the fallback, then the defaults shown above):
  - `toneMapping`: `none`, `linear`, `reinhard`, `cineon`, `aces`, `agx` or `neutral` (default, Khronos PBR Neutral - closest to the material colours)
  - `exposure`: tone mapping exposure, a number `>= 0` (default `1`)
  - `postprocessing.enabled`: renders through a post-processing chain (default `false`); tone mapping looks the same either way
  - `postprocessing.antialias`: anti-aliasing used by that chain - `msaa` (4x multisampling, default), `smaa`, `fxaa` (cheapest) or `none`
  - `postprocessing.ao`: ambient occlusion (GTAO) - darkens crevices and corners so relief reads better (default `false`). It runs the post-processing chain by itself, even with `postprocessing.enabled` off, and costs an extra pass over the model every frame
  - `postprocessing.aoIntensity`: strength of the ambient occlusion, `0` to `2` (default `1`)
- `showNotifications` controls toast/status notices
- `tour`: guided tour through the manifest's annotations, same keys as `viewer-settings.json` `viewer.tour` (each optional, the settings file stays the fallback):
  - `autostart`: start the tour once the model and annotations have loaded (default `false`); a manifest that sets `tour` may autostart it again even if an earlier manifest already did
  - `autoplay`: advance the steps automatically (default `false`)
  - `stepDuration`: seconds on each step while autoplaying, `> 0` (default `6`)
  - `transitionDuration`: camera flight time in seconds, `>= 0` (default `1.5`)
  - `loop`: wrap around after the last step while autoplaying (default `true`)
  - The steps are the annotations in marker order; each one's `AIM3DViewer.view` (`{ position, target, fov }`) is the camera pose shown for it.
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

`type` is `AmbientLight`, `DirectionalLight`, `HemisphereLight`, `PointLight` or `SpotLight`. The first directional light is the viewer's key light, the second its camera light, the first ambient and hemisphere lights the viewer's own; further lights are added to the scene. Optional fields:

- `visible`: `false` for a light that is switched off (default `true`)
- `groundColor`: ground colour of a `HemisphereLight`
- `distance`, `decay`: range and falloff of a `PointLight` or `SpotLight`
- `angle`, `penumbra`: cone half-angle (radians) and edge softness (0-1) of a `SpotLight`

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
  "wireframe": false,
  "shadingMode": "clay"
}
```

`shadingMode` (optional) sets how the model's surfaces are drawn; left out,
the model keeps the materials it was loaded with:

| Value | Look |
|---|---|
| `original` | the materials as loaded (the default; not written on export) |
| `standard` | converted to PBR (`MeshStandardMaterial`). Manifests written before `original` existed carry `standard` as their default, so it is read as `original` |
| `phong`, `lambert` | the classic lighting models, textures kept |
| `toon` | cel shading |
| `flat` | the model's own materials with faceted normals: shows the triangles of a scan |
| `clay` | untextured matte clay: the geometry alone, without the photo texture |
| `matcap` | studio clay sphere (matcap), independent of the scene's lights |
| `normals` | surface normals as colours, for checking a mesh |
| `custom` | the GLSL of `customShader` (`vertexShader`, `fragmentShader`); the `clipping_planes` chunks and `USE_COLOR` / `color` let it follow the section planes and vertex colours |

## `AIM3DViewer.rakingLight`

A low light grazing the surface the camera looks at, with the other lights and
the environment dimmed, so shallow relief (inscriptions, tool marks, worn
ornament) casts readable shading. Written only while it is on; a manifest
without it leaves the raking light off.

```json
{
  "enabled": true,
  "direction": 135,
  "height": 12,
  "sweep": false
}
```

It is placed relative to the view, as in RTI viewers, so it keeps grazing the
surface while the camera moves:

- `direction`: where on the screen the light comes from, in degrees (`0` right, `90` top, `180` left, `270` bottom; default `135`)
- `height`: its angle above the surface facing the camera, `1` to `89` degrees; low values graze (default `12`)
- `sweep`: turns the light round the view continuously (default `false`)

## `AIM3DViewer.certainty`

The Level of Certainty (LoC) scale of a reconstruction. Annotations assess the
object (or group) they target against it; the viewer's LoC view (editor
toolbar, *Show Level of Certainty*) paints every assessed object in its
level's colour, the rest in `unassessedColor`, and shows a legend.

Levels are told apart by three things, so the view also reads without colour
vision and in greyscale prints: a distinct `color`, a short `code` (a letter)
and a `symbol`. Annotation badges in the view show the code and symbol
instead of their number.

```json
{
  "min": 0,
  "max": 10,
  "unassessedColor": "#9ca3af",
  "opacity": 0.4,
  "visible": false,
  "levels": [
    { "value": 10, "code": "A", "symbol": "✓", "color": "#1a9850", "label": { "en": ["Preserved / surveyed"], "pl": ["Stan zachowany / pomiar"] } },
    { "value": 8,  "code": "B", "symbol": "■", "color": "#2166ac", "label": { "en": ["Direct documentation"], "pl": ["Dokumentacja bezpośrednia"] } },
    { "value": 6,  "code": "C", "symbol": "▲", "color": "#ffd400", "label": { "en": ["Indirect sources"], "pl": ["Źródła pośrednie"] } },
    { "value": 4,  "code": "D", "symbol": "≈", "color": "#f46d00", "label": { "en": ["Analogy"], "pl": ["Analogia"] } },
    { "value": 0,  "code": "E", "symbol": "?", "color": "#c51b7d", "label": { "en": ["Hypothesis"], "pl": ["Hipoteza"] } }
  ]
}
```

- `levels`: required. A level's `value` is its lower bound: an assessment
  belongs to the highest level whose value is not above it (on the scale
  above, 7 is level C). `value`, `code` and `color` must be unique.
- `label`, `description`: IIIF language maps (or plain strings).
- `min`, `max`: the range assessments must fall in (default: the lowest and
  highest level).
- `opacity`: opacity of the colour overlays, 0-1 (default 0.4). The colours
  are laid over the model's own materials, which show through; 1 hides them.
  Set in the view from the legend's slider and exported with the scale.
- `visible`: open the manifest in the LoC view.
- Without this block the viewer uses the scale above. It is exported when a
  manifest gave it or an annotation is assessed.

### Assessments on annotations

An assessed annotation adds the W3C Web Annotation motivation `assessing` and
carries the assessment in its own `AIM3DViewer` block; its body is the
justification (sources, reasoning).

```json
{
  "type": "Annotation",
  "motivation": ["commenting", "assessing"],
  "label": { "en": ["Roof"] },
  "body": { "type": "TextualBody", "value": "Reconstructed from a 1920 photograph.", "format": "text/plain" },
  "AIM3DViewer": {
    "targetId": "m0:0.12",
    "faceNumbers": [0],
    "certainty": { "value": 6, "code": "C", "scope": "object", "targetId": "m0:0.12" }
  }
}
```

- `value` (or `code` alone, resolved against the scale): the level.
- `scope`: `object` paints the annotated object, `group` its parent object
  (e.g. every part of a building element).
- `targetId`: the object painted, resolved when the annotation was saved.

The XML export for Drupal (`iiif:annotations`) carries the same as
`<iiif:certainty value="6" code="C" scope="object" target="m0:0.12"/>`.

## Compatibility

- `AIM3DViewer.viewer.clipping` is the preferred schema.
- `AIM3DViewer.viewer.editorToolbar` is the preferred schema for editor toolbar state.
- `AIM3DViewer.viewer.menuToolbar` is kept as a backward-compatibility field for older manifests.
- The importer also accepts `AIM3DViewer.clipping` as a backward-compatibility fallback.
- `camera.zoom` is read from the camera state and should be treated as the source of truth for orthographic view restoration.