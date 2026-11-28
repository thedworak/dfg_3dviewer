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
- `dock` - `0`: the tool panels as floating windows instead of the panel dock
- `variant` - id of the reconstruction variant shown; `compare` - `swipe` or `split` opens the comparison view; `compareLeft`, `compareRight` - what each side shows: a variant id or a timeline year
- `clip` - active section planes, e.g. `xy`; `clipConst` - their plane constants `x,y,z`; `clipFlip` - axes whose kept side is flipped, e.g. `y`; `clipOutline` - `0` hides the section fill

Example:

```text
/embed.html?model=/examples/box.glb&theme=light&autorotate=1&autorotateSpeed=1.2&camPos=1.2,0.8,2.5&camTarget=0,0,0&fov=45
```

## `ultra.html`: the model and nothing else

`ultra.html` is the smallest viewer: a glTF / GLB model with orbit controls - no menu, intro, gallery, metadata, annotations or editor. It is a bundle of its own (`ultra.js` and its three.js in `assets/ultra/`, built from `viewer/ultra.js`): about 130 KB of code with Brotli (about 160 KB gzipped) and a 39 KB environment map: 0.17 MB in all as the server sends it, against 0.99 MB for the lightweight viewer and 2.33 MB for the full one (code, styles, fonts, images and environment map; the model not counted; measured on the production build in November 2026). Most of the code is three.js's WebGL renderer itself (about 140 KB gzipped). The Draco, Meshopt and KTX2 compressions are supported, and loaded only for a model that uses them: before parsing, the viewer looks for their extensions in the model's JSON and fetches the loader (`assets/ultra/`) and decoder (`assets/draco/`, `assets/basis/`) it needs - about 3 KB more for Draco, 7 KB for Meshopt, 24 KB for KTX2, gzipped, plus the decoders. The lighting is the lightweight viewer's (its lights, the 256x128 neutral environment map, neutral tone mapping), so a model looks the same in both; the map is the `.hdr` file's RGBE bytes repacked as a lossless WebP (`scripts/hdr-to-rgbe-webp.py`: 39 KB instead of 80 KB gzipped) and decoded on the GPU.

It can be opened directly or with the `ultralight` flag on the viewer's pages: `embed.html?model=house.glb&ultralight=1` (also `index.html`, and `ultra=1`) goes to `ultra.html?model=house.glb`, keeping the other parameters. The pages check the flag before anything else, so the viewer's module is not fetched; at most their few stylesheets start downloading before the switch. Linking `ultra.html` directly avoids even that.

Parameters:

- `model` / `src` - the `.glb` or `.gltf` file
- `autorotate` - `1` turns the model slowly
- `bg` - the page's background, a CSS color (e.g. `%23202020` for `#202020`, `transparent`); default the viewer's grey gradient

In an iframe, `ultra.html` tells the embedding page how loading goes, with `postMessage`: `{ source: "e4d-ultra", state, progress }`, where `state` is `"loading"`, `"loaded"` or `"error"` and `progress` is the model's download, 0 to 1 (left out when the server sends no length). The page can show its own loading bar with it:

```js
window.addEventListener("message", (e) => {
  if (e.origin !== "https://your.domain.com" || e.data?.source !== "e4d-ultra") return
  // e.data.state, e.data.progress
})
```

Other formats (OBJ, PLY, STL, IFC, point clouds, volumes, 3D Tiles...) and everything `embed.html` takes beyond these three need the full viewer.

```html
<iframe src="https://your.domain.com/viewer/ultra.html?model=models/house.glb" style="width: 100%; height: 60vh; border: 0"></iframe>
```
