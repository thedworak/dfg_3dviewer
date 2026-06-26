# Embedding the viewer

## Container attribute

The simplest way to embed the viewer is a container element with a `3d` attribute pointing at
a model, plus the module script:

```html
<div id="DLF_AIM_3DViewer" 3d="./examples/box.stl" style="height: 50vh"></div>
<script type="module" src="dlf_aim_3d_viewer-module.js"></script>
```

The viewer reads the `3d` attribute from the container (default container id `DLF_AIM_3DViewer`)
and loads the model. This is the entry pattern used by `index.html`.

!!! note "Built entry file name"
    In standalone/dev/test/`drupal:custom` builds the runtime entry is
    `dlf_aim_3d_viewer-module.js`. In the minified Drupal `main` build it is `dlf_aim_3d_viewer.min.js`.

You can also drive everything from code instead of the attribute:

```js
await Viewer.MainInit({ /* settings overrides */ });
```

## `embed.html`

`embed.html` is a full-page embeddable viewer driven by URL query parameters. When opened on a
local preview host (`localhost`, `127.0.0.1`, `::1`) without an explicit source, it falls back
to loading `./examples/box.stl`.

### Supported query parameters

These are parsed in `viewer/main.js` (`parseUrlOptions()`):

| Parameter | Aliases | Type | Description |
|-----------|---------|------|-------------|
| `model` | `src` | string | Model URL to load |
| `id` | | string | Entity/identifier passed to the viewer |
| `theme` | | `light` \| `dark` | Forces the colour theme |
| `lang` | `language` | string | UI language code |
| `autorotate` | | boolean | Enable auto-rotation |
| `autorotateSpeed` | | float | Auto-rotation speed |
| `disableInteraction` | | boolean | Disable user interaction (kiosk/presentation) |
| `hideUi` | | boolean | Hide the viewer UI controls |
| `hideMetadata` | | boolean | Hide the metadata panel |
| `presentationMode` | | boolean | Start in presentation mode |
| `sandbox` | | boolean | Start in drag-and-drop sandbox mode |
| `camPos` | `cameraPos` | `x,y,z` | Initial camera position |
| `camTarget` | `cameraTarget` | `x,y,z` | Initial camera target |
| `fov` | | float | Camera field of view (degrees) |
| `scale` | | `x,y` | Container scale override |
| `showNotifications` | | boolean | Toggle toast notifications |

!!! info "More parameters than the original README"
    The original combined README listed only `model`/`src`, `id`, `theme`, `autorotate`,
    `autorotateSpeed`, `disableInteraction`, `hideUi`, `hideMetadata`, `camPos`, `camTarget`
    and `fov`. The current runtime additionally supports `lang`/`language`, `presentationMode`,
    `sandbox`, the `cameraPos`/`cameraTarget` aliases, `scale` and `showNotifications`.

### Example

```text
/embed.html?model=/examples/box.glb&theme=light&autorotate=1&autorotateSpeed=1.2&camPos=1.2,0.8,2.5&camTarget=0,0,0&fov=45
```
