# Using the viewer

Example embed markup:

```html
<div id="DFG_3DViewer" 3d="./examples/box.stl" style="height: 50vh"></div>
<script type="module" src="dfg_3dviewer-module.js"></script>
```

This is the current built runtime entry pattern. The viewer reads the `3d` attribute from the container and loads the model.

## `embed.html` parameters

`embed.html` supports these query parameters:

- `model` / `src`
- `id`
- `theme`
- `autorotate`
- `autorotateSpeed`
- `disableInteraction`
- `hideUi`
- `hideMetadata`
- `camPos`
- `camTarget`
- `fov`
- `animation` — animation clip to select (name, index or `all`)
- `animationAutoplay` — `0` loads the animation paused on its first frame
- `animationSpeed` — playback speed, e.g. `0.5`
- `viewHelper` — `0` hides the axes gizmo

Example:

```text
/embed.html?model=/examples/box.glb&theme=light&autorotate=1&autorotateSpeed=1.2&camPos=1.2,0.8,2.5&camTarget=0,0,0&fov=45
```
