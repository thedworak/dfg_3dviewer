# Function reference

The viewer's exported runtime functions are documented in detail in
[`viewer/FUNCTIONS.md`](https://gitlab.nasarek.dev/rnsrk/dfg_3dviewer_js_library/-/blob/standalone/viewer/FUNCTIONS.md)
inside the repository. This page summarises what lives where.

## `viewer/main.js` — the `Viewer` object

Core entry points and helpers, including:

- `Viewer.MainInit()` — initialise the runtime: load `viewer-settings.json`, configure the DOM
  container, set up core state, start the animation loop.
- `Viewer.mainLoadModel()` / `Viewer.mainLoadModelWrapper()` — load the current model from
  `core.fileObject`, handling all supported formats and archive transformations.
- `Viewer.setModelPaths()` — parse `core.fileObject` from its original path.
- `Viewer.normalizeFileUrl()` / `normalizeDrupalFilesPath()` / `normalizeArchiveModelPath()` —
  URL and Drupal `public://` path normalisation.
- `Viewer.applyCameraOverridesFromUrl()` — apply camera position/target/FOV from URL params.
- `Viewer.toggleFullscreen()`, `Viewer.updateSize()`, `Viewer.setCameraProjection()`.
- Disposal helpers: `disposeObjectResources()`, `removeAndDisposeFromScene()`,
  `resetLoadedModelState()`.
- URL parsing utilities: `parseBooleanParam`, `parseFloatParam`, `parseVector2Param`,
  `parseVector3Param`, `formatVector3Param`.
- Support utilities: `getSupportedFormatsText`, `getSupportedArchiveFormatsText`,
  `getDistanceMeasurementScaleMeters`, `formatMeasuredDistance`, `toggleAutoRotateByKeyboard`,
  `onViewerKeyDown`.

## `viewer/loaders.js`

Per-format loaders (`loadOBJLoader`, `loadFBXLoader`, `loadGLTFLoader`, `loadIFCLoader`, …),
`syncSceneEnvironment()`, the main `loadModel()` engine, `getModuleAssetBasePath()`, and the
error/progress handlers (`onError`, `onErrorMTL`, `onErrorGLB`, `onProgress`).

## `viewer/metadata.js`

Metadata fetching and rendering, WissKI label mapping, lil-gui folder helpers, IIIF/AIM³IF
manifest UI (`createIIIFDropdown`, `createAIM3IFDropdown`, `createManifestUI`), and
presentation-mode setup.

## `viewer/viewer-utils.js`

Clipping planes, toast helpers, error reporting, object/camera setup, and background/gradient
rendering helpers.

## `viewer/utils.js`

Generic geometry math, color parsing/normalisation, URL utilities and `getProxyPath()`.

## `viewer/viewer-settings.js`

`loadSettings()` — loads `viewer-settings.json` relative to the current module path; used in
source-mode development and runtime config loading.
