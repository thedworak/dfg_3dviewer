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
- `ultralight` / `ultra` - `1` opens the ultralight viewer, `ultra.html` (below), with the other parameters
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
- `animation` - animation clip to select (name, index or `all`)
- `animationAutoplay` - `0` loads the animation paused on its first frame
- `animationSpeed` - playback speed, e.g. `0.5`
- `format` - `3dtiles` or `potree` for a tileset / Potree cloud whose file is not named `tileset.json` / `metadata.json`
- `preview` - `0` skips the progressive-loading preview; a URL loads that file as the preview
- `tour` - `1` starts the guided tour through the model's annotations; `tourAutoplay` - `1` advances steps automatically; `tourStep` - step to start at (1-based); `tourInterval` - seconds per step while autoplaying
- `viewHelper` - `0` hides the axes gizmo
- `variant` - id of the reconstruction variant shown; `compare` - `swipe` or `split` opens the comparison view; `compareLeft`, `compareRight` - what each side shows: a variant id or a timeline year
- `clip` - active section planes, e.g. `xy`; `clipConst` - their plane constants `x,y,z`; `clipFlip` - axes whose kept side is flipped, e.g. `y`; `clipOutline` - `0` hides the section fill

Example:

```text
/embed.html?model=/examples/box.glb&theme=light&autorotate=1&autorotateSpeed=1.2&camPos=1.2,0.8,2.5&camTarget=0,0,0&fov=45
```

## `ultra.html`: the model and nothing else

`ultra.html` is the smallest viewer: a glTF / GLB model with orbit controls - no menu, intro, gallery, metadata, annotations or editor. It is a bundle of its own (`ultra.js`, built from `viewer/ultra.js`), about 290 KB gzipped with its environment map, against about 1.2 MB for the lightweight viewer (code, styles, fonts, images and environment map; the model and decoders not counted). The Draco, Meshopt and KTX2 compressions are supported; the Draco and Basis decoders in `assets/` are fetched only for models that use them. The lighting is the lightweight viewer's (its lights, the 256x128 neutral environment map, neutral tone mapping), so a model looks the same in both.

It can be opened directly or with the `ultralight` flag on the viewer's pages: `embed.html?model=house.glb&ultralight=1` (also `index.html`, and `ultra=1`) goes to `ultra.html?model=house.glb`, keeping the other parameters. The pages check the flag before anything else, so the viewer's module is not fetched; at most their few stylesheets start downloading before the switch. Linking `ultra.html` directly avoids even that.

Parameters:

- `model` / `src` - the `.glb` or `.gltf` file
- `autorotate` - `1` turns the model slowly
- `bg` - the page's background, a CSS color (e.g. `%23202020` for `#202020`, `transparent`); default the viewer's grey gradient

Other formats (OBJ, PLY, STL, IFC, point clouds, volumes, 3D Tiles...) and everything `embed.html` takes beyond these three need the full viewer.

```html
<iframe src="https://your.domain.com/viewer/ultra.html?model=models/house.glb" style="width: 100%; height: 60vh; border: 0"></iframe>
```
