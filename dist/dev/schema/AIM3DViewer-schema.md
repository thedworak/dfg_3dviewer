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
    "timeline": {},
    "thumbnails": [],
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
  "upAxis": "Z+",
  "wireframe": false,
  "shadingMode": "clay"
}
```

`upAxis` (optional) names the axis of the model file that points up, for
models that do not come in Y-up (three.js and glTF are Y-up). The viewer
turns that axis to +Y when the model is loaded, before placing it on the grid
and before `position`, `rotation` and `scale`, which are those of the upright
model. Left out, the model is used as loaded (`Y+`).

| Value | Model |
|---|---|
| `Y+` | Y-up (the default; not written on export) |
| `Y-` | upside down |
| `Z+` | Z-up: CAD, scans and photogrammetry exports (STL, PLY, OBJ, ...) |
| `Z-` | Z-up, flipped |
| `X+`, `X-` | X-up |

The fix is applied under the model root (an inner pivot node, or the geometry
of a single mesh), so `rotation` stays the rotation set in the editor.
Streamed models (3D Tiles, Potree) are oriented by their loader and do not
take `upAxis`; LAS/LAZ point clouds and Gaussian splats are already turned to
Y-up when loaded, so `upAxis` turns them further. The same setting comes from
the `upAxis` URL parameter (`?upAxis=Z` or `?upAxis=-Y`; a `+` in a URL reads as a space, which is fine, as a bare axis means its + side; the URL wins over the manifest), the
`upAxis` of a model's entry in `viewer-settings.json` / `objectsConfig.models`,
and the model's saved `_viewer.json` metadata.

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

## `AIM3DViewer.timeline`

The fourth dimension: the model's states in time. Each stage is a point on
the time axis (a year) with the model nodes that show the object at that
point. Any year can be chosen on the axis; the viewer fades the stages
around it into each other, so jumps and playback run smoothly.

```json
{
  "enabled": true,
  "year": 1730,
  "startYear": 1730,
  "endYear": 1936,
  "label": { "en": ["Weathering 1730-1936"], "pl": ["Starzenie 1730-1936"] },
  "description": { "en": ["Three events are documented; the stages between them are modelled."] },
  "transition": "interpolate",
  "transitionDuration": 0.8,
  "playback": { "autoplay": false, "loop": false, "yearsPerSecond": 10, "pauseAtEvents": 1.5 },
  "stages": [
    {
      "year": 1730,
      "approximate": true,
      "type": "documented",
      "label": { "en": ["Construction"], "pl": ["Budowa"] },
      "description": { "en": ["Fresh, light timber and shingles."] },
      "source": { "en": ["first half of the 18th century"] },
      "nodes": ["Stage_1730"]
    },
    { "year": 1735, "type": "modelled", "label": { "en": ["The timber darkens"] }, "nodes": ["Stage_1735"] }
  ]
}
```

- `enabled`: `false` turns off a timeline the model carries itself (default `true`)
- `year`: year shown when the manifest opens (default `startYear`); exported as the year shown
- `startYear`, `endYear`: ends of the axis (default: the first and last stage)
- `label`, `description`: panel title and the text behind its *i* button (language maps or strings)
- `transition`:
  - `interpolate` (default): a year between two stages blends them in proportion, e.g. 1795 shows 1790 and 1810 half and half. Suits gradual change (weathering, growth)
  - `step`: the last stage reached is shown as it is; changing stage fades over `transitionDuration`. Suits building phases
- `transitionDuration`: seconds a jump to another year (or a `step` fade) takes, `>= 0` (default `0.8`)
- `playback.autoplay`: start playing on open (default `false`)
- `playback.loop`: start over after the end (default `true`)
- `playback.yearsPerSecond`: playback speed (default: the whole axis in 24 seconds)
- `playback.speed`: multiple of `yearsPerSecond`, set in the panel (0.25× to 3×) and exported with the manifest (default `0.5`)
- `playback.pauseAtEvents`: seconds held on each `documented` stage while playing (default `1.5`)
- `showPanel`: `false` hides the panel; the model stays at `year` (a fixed point in time, e.g. for an embed)
- `stages[]`:
  - `year` (required): the point on the axis; fractional and negative years (BCE) are allowed
  - `type`: `documented` (an event from the sources - a diamond on the axis, held while playing) or `modelled` (a state reconstructed between them - a circle)
  - `approximate`: the date is approximate (shown as *c. 1730*); `yearLabel` replaces the year text altogether (e.g. `"1st half of the 18th c."`)
  - `label`, `description`, `source`: shown in the panel's card while the stage is the last one reached
  - `nodes`: names of the model nodes that show the stage. Nodes of the timeline's stages are shown only around their year; everything else in the model stays as it is. Left out, the nodes of the model's own stage of the same year are used. A stage without nodes is only a point on the axis (an event without its own state)

When the manifest lists `stages`, they replace the model's list. Without
`stages` the manifest only sets the playback and texts for the stages the
model carries.

### Timeline in the model (glTF)

A glTF/GLB model can carry its timeline itself, so it also works opened
without a manifest:

- `scenes[n].extras.timeline` with the same fields as above (`stages[].node` may name a single node), or
- `nodes[n].extras.year` (plus optional `label`, `description`, `type`) on each stage node; at least two such nodes make a timeline

Stage nodes hidden by a zero scale (a common way to switch glTF parts) are
shown at their normal scale, and an animation clip that only switches the
stage nodes is left out of the animation player: the timeline drives them.
Labels written as `"ok. 1730 – …"` / `"c. 1730 – …"` lose the year prefix
and mark the stage `approximate`.

Fading draws the earlier stage as it is and the later one over it,
transparent. Stages that share the geometry (the same building with other
textures or vertex colours) blend cleanly; stages with different geometry
cross over, the earlier one leaving at the end of the fade.

## `AIM3DViewer.variants`

Reconstruction variants: alternative hypotheses of the same object (two
roofs, three versions of a lost tower), each a set of model nodes. One
variant is shown at a time, chosen in the variants panel; nodes that belong
to no variant are always shown.

```json
{
  "label": { "en": ["Roof and fourth column: two hypotheses"] },
  "active": "roofed",
  "items": [
    {
      "id": "roofed",
      "label": { "en": ["A: roofed temple"] },
      "description": { "en": ["Gabled roof with a skylight; the fourth column stood complete."] },
      "source": { "en": ["Analogy with temples of the same period"] },
      "certainty": 4,
      "nodes": ["Roof_Hypothesis", "Column_4_Reconstructed"]
    },
    { "id": "open", "label": { "en": ["B: open monopteros"] }, "certainty": 8, "nodes": ["Column_4_Stump", "Fallen_Drum"] }
  ]
}
```

- `enabled`: `false` turns off variants the model carries itself (default `true`)
- `active`: id of the variant shown (default the first); exported as the one shown
- `label`, `description`: panel title and the text under it
- `showPanel`: `false` hides the panel; `active` stays shown
- `items[]` (at least two):
  - `id` (required, unique): used by `active`, `AIM3DViewer.compare` and the `variant` URL parameter
  - `label`, `description`, `source`: shown in the panel
  - `certainty`: a value on the Level of Certainty scale (`AIM3DViewer.certainty`, else the default one), shown as the level's code and symbol in its colour
  - `nodes`: names of the model nodes of the variant. Left out, the nodes of the model's variant with the same id are used

Keep the variants' nodes apart from the timeline's stage nodes: the timeline
shows and hides its own nodes by year, the variants theirs by choice.

### Variants in the model (glTF)

- `scenes[n].extras.variants`: the same object as above, or just its `items` array, or
- `nodes[n].extras.variant`: the variant id on each node of it (optional `variantLabel`, `variantDescription`); at least two ids make a set of variants

## `AIM3DViewer.compare`

The comparison view, open when the manifest loads. The scene is drawn twice
per frame, once for each side: a variant, or a year of the timeline (the last
stage reached in that year).

```json
{ "mode": "swipe", "position": 0.5, "left": { "variant": "roofed" }, "right": { "variant": "open" } }
```

- `mode`: `swipe` (default) - one view split by a divider dragged across the canvas (arrow keys move it once it has focus); `split` - the two sides side by side, the camera shared
- `position`: where the divider stands in `swipe` mode, `0` to `1` across the canvas (default `0.5`)
- `left`, `right`: `{ "variant": "<id>" }` or `{ "year": 1730 }`. Left out: the variant shown and the next one, or the first and last stage of the timeline
- `enabled`: `false` keeps the comparison closed

The comparison is exported while it is open. The URL parameters `compare`
(`swipe` or `split`), `compareLeft`, `compareRight` (a variant id or a year)
and `variant` (the variant shown) override the manifest.

## `AIM3DViewer.location` and `AIM3DViewer.sun`

The sun where it stood at the model's place on a day and hour, casting
shadows on the model and the ground (*Lights > Sun and shadows*). With a 4D
timeline the year is the timeline's, so a building is lit as in its own time.

```json
"location": { "latitude": 41.8894, "longitude": 12.4702, "north": 30, "utcOffset": 1 },
"sun": { "enabled": true, "date": "06-21", "time": "17:30" }
```

- `location.latitude`, `location.longitude` (required): degrees, north and east positive
- `location.north`: where north lies in the scene - degrees clockwise from -Z, seen from above (default `0`: north is -Z, east +X). The model's up is +Y
- `location.utcOffset`: hours the local time is ahead of UTC (default: the longitude / 15, rounded - local mean time)
- `sun.date`: `"MM-DD"`, or `"YYYY-MM-DD"`; `sun.time`: local `"HH:MM"` (default: the day and time now, at the model's place)
- `sun.followTimeline`: take the year from the timeline (default `true`); without a timeline the date's year is used
- `sun.animate`: play the day on open (default `false`)

The panel sets the time of day (or plays the day), the day, the place and
north, and shows the sun's azimuth and elevation, sunrise and sunset. The
solar position is good to a fraction of a degree; dates before 1582 are
taken as proleptic Gregorian. While the sun is on, the other lights and the
environment are dimmed to a sky light (the raking light is switched off).
`location` is exported once a place is set; `sun` while it is on.

## `AIM3DViewer.photos`

Historical photographs (or drawings, paintings) laid over the model from the
camera they were taken from, so the reconstruction can be checked against
its sources. Opening a photo in the panel (*Annotations > Historical photos*)
flies the camera to its view and shows the photo over the canvas, faded in,
or cut by a divider. Moving the camera hides the photo until its view is
restored.

```json
[
  {
    "id": "postcard-1912",
    "src": "./examples/tempietto/photos/Tempietto_1912.webp",
    "label": { "en": ["Postcard, about 1912"] },
    "source": { "en": ["Private collection"] },
    "year": 1912,
    "opacity": 0.6,
    "view": { "position": [9.1, 3.2, 11.4], "target": [0, 1.6, 0], "fov": 38, "roll": 0 }
  },
  { "service": "https://iiif.example.org/iiif/3/photo-17", "label": { "en": ["Survey photo"] } }
]
```

- `src`: image URL; a URL ending in `info.json`, or `service` (a IIIF Image API service, its URL or `{ "id": ... }`), asks the service for the image at up to 2000 px
- `label`, `description`, `source`: shown in the panel
- `year`: the 4D timeline goes to this year when the photo opens
- `opacity`: how strongly the photo covers the model, `0` to `1` (default `0.6`)
- `view`: the camera the photo was taken from, in scene coordinates: `position`, `target`, `fov` (vertical field of view, degrees) and `roll` (the photo's tilt, degrees clockwise). The photo is fitted to the canvas height, which the vertical field of view spans, so it lines up at any canvas width. Without a view the photo is shown over whatever the camera sees

A photo is added in the panel from a URL or a file and taken from the
current view; *Align* keeps it on screen while the camera, the lens and the
tilt are matched to it, *Save view* keeps that pose. Photos from a file are
shown for the session only and are left out of an export (they have no URL).

## `AIM3DViewer.thumbnails`

Renders of the model shown in the thumbnail gallery, in this order. The list
may have any length. Each entry is a URL or an object with `src` and an
optional `label` (a string or a language map, used as the image's alt text).

```json
[
  "./examples/gallery/tempietto/Tempietto_side0.png",
  { "src": "./examples/gallery/tempietto/Tempietto_top.png", "label": { "en": ["Top view"], "pl": ["Widok z góry"] } }
]
```

- Relative URLs (`./...`) resolve like the manifest's model URLs.
- A manifest without `thumbnails` (or with an empty list) shows the viewer's
  generic placeholder images, never the renders of a previous manifest.
- An image that fails to load is replaced by a generic placeholder.

See [tempietto-aim3d-thumbnails.json](./examples/tempietto-aim3d-thumbnails.json).

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
## Inspection: what a manifest contains, value by value

`manifest-inspection.js` (`inspectAIM3DManifest(manifest)`) checks every
attribute of a manifest - every leaf of the JSON, the IIIF part as well as
`AIM3DViewer` - and groups them into features, one icon each in the manifest
lists (`manifestFeatureIcons(inspection)`):

`model`, `metadata`, `rights`, `annotations`, `camera`, `lights`,
`raking-light`, `clipping`, `timeline`, `variants`, `compare`, `photos`,
`location`, `sun`, `certainty`, `thumbnails`, `transform`, `rendering`,
`tour`, `settings`, `manifest` (the IIIF structure itself).

Each attribute gets a level:

- `error` - the viewer cannot use the value: wrong type, out of range, an
  unknown enum value, a required key missing. Everything
  `validateAIM3DManifest` rejects is an error here too.
- `warning` - it loads, but is probably wrong: an empty text, a URL with
  spaces or pointing at `localhost`, a colour the browser does not know, a
  date that is not ISO 8601, a language key that is not a language code, a
  media type like `glb`, a zero `camera.up` or `modelTransform.scale`, a
  compared variant that does not exist, an annotation targeting a scene the
  manifest does not have, a duplicate IIIF id, a stage outside the timeline.
- `info` - worth knowing: an attribute the viewer does not know and ignores,
  a recommended one not set (`summary`, `rights`, labels of photos and
  variants), `rights` that is neither Creative Commons nor
  RightsStatements.org, a file served over http.

```json
{
  "status": "warning",
  "summary": { "errors": 0, "warnings": 1, "infos": 2, "attributes": 154, "unknown": 0 },
  "features": [{ "id": "timeline", "icon": "timeline", "label": "4D timeline", "present": true, "count": 3, "status": "ok", "errors": 0, "warnings": 0 }],
  "attributes": [{ "path": "$.AIM3DViewer.viewer.backgroundColor", "value": "#12345", "level": "warning", "feature": "rendering", "known": true, "issues": [{ "level": "warning", "message": "is not a colour (#rrggbb expected)" }] }]
}
```

From the command line: `node scripts/inspect-manifest.mjs manifest.json`
(issues and the features it contains), `--all` for every attribute, `--json`
for the full report; it exits 1 when a manifest has errors. Models
themselves are checked by the conversion worker (`validation.json`, see
`worker/README.md`).
