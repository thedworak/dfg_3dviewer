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
- `preview` — `0` skips the progressive-loading preview; a URL loads that file as the preview
- `tour` — `1` starts the guided tour through the model's annotations; `tourAutoplay` — `1` advances steps automatically; `tourStep` — step to start at (1-based); `tourInterval` — seconds per step while autoplaying
- `viewHelper` — `0` hides the axes gizmo
- `clip` — active section planes, e.g. `xy`; `clipConst` — their plane constants `x,y,z`; `clipFlip` — axes whose kept side is flipped, e.g. `y`; `clipOutline` — `0` hides the section fill

Example:

```text
/embed.html?model=/examples/box.glb&theme=light&autorotate=1&autorotateSpeed=1.2&camPos=1.2,0.8,2.5&camTarget=0,0,0&fov=45
```
