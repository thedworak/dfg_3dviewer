# Viewer Function Reference

This file documents the main exported viewer functions and helpers used by the viewer runtime.
It is intended as a quick reference for the current `viewer/` module exports and their roles.

## `viewer/main.js`

`viewer/main.js` exposes the exported `Viewer` object and core runtime entry points.

- `Viewer.MainInit()`
  - Initialize the viewer runtime.
  - Loads `viewer-settings.json`, configures the DOM container, sets up core state, starts the animation loop, and prepares the viewer for model loading.

- `Viewer.mainLoadModel()`
  - Load the current model from `core.fileObject`.
  - Handles all supported file formats, archive transformations, GLTF/GLB loading, and post-load scene preparation.

- `Viewer.mainLoadModelWrapper()`
  - Wrapper for `mainLoadModel()`.
  - Normalizes auto-paths and archive paths before delegating to the loader.

- `Viewer.prepareSandboxScene()`
  - Reset the viewer for sandbox mode.
  - Clears loaded objects, resets camera and controls, and shows sandbox UI hints.

- `Viewer.setModelPaths()`
  - Parse and populate `core.fileObject` from `core.fileObject.originalPath`.
  - Sets `filename`, `basename`, `extension`, `path`, `uri`, and `relativePath`.

- `Viewer.normalizeFileUrl(rawUrl)`
  - Normalize source URLs and Drupal `public://` paths.
  - Converts relative model attributes into canonical browser URLs.

- `Viewer.normalizeDrupalFilesPath(path)`
  - Normalize Drupal file paths by stripping `sites/default/files` prefixes and trimming slashes.

- `Viewer.normalizeArchiveModelPath(path)`
  - Fix archive-derived model paths by injecting a `/gltf/` segment when needed.

- `Viewer.applyCameraOverridesFromUrl()`
  - Apply camera position, camera target, and FOV overrides from URL query parameters.

- `Viewer.toggleFullscreen()`
  - Enter or exit fullscreen mode for the viewer container.

- `Viewer.updateSize()`
  - Resize the renderer, camera, GUI, metadata, and action menu when the viewport changes.

- `Viewer.setCameraProjection(projection)`
  - Switch the viewer camera between perspective and orthographic projection.

- `Viewer.toHexColor(input)` / `Viewer.toThreeColor(input)`
  - Normalize different color input formats into numeric or `THREE.Color` values.

- `Viewer.disposeObjectResources(object)`
  - Dispose of mesh geometry and material resources for an object tree.

- `Viewer.removeAndDisposeFromScene(object)`
  - Remove an object or object array from the scene and dispose its resources.

- `Viewer.resetLoadedModelState()`
  - Clear viewer state related to loaded models, annotations, selection, and helper objects.

- `Viewer.reportError(error, options)`
  - Report viewer errors consistently to console, toast notifications, and E2E state.

- URL and parameter parsing utilities:
  - `Viewer.parseBooleanParam(value)`
  - `Viewer.parseFloatParam(value)`
  - `Viewer.parseVector2Param(value)`
  - `Viewer.parseVector3Param(value)`
  - `Viewer.formatVector3Param(vector)`

- Viewer support utilities:
  - `Viewer.getSupportedFormatsText()`
  - `Viewer.getSupportedArchiveFormatsText()`
  - `Viewer.getDistanceMeasurementScaleMeters()`
  - `Viewer.formatMeasuredDistance(rawDistanceInModelUnits)`
  - `Viewer.toggleAutoRotateByKeyboard()`
  - `Viewer.onViewerKeyDown(event)`


## `viewer/loaders.js`

`viewer/loaders.js` contains model loaders, environment sync logic, and loading progress/error handlers.

- `loadDDSLoader()` / `loadMTLLoader()` / `loadOBJLoader()` / `loadFBXLoader()`
- `loadPLYLoader()` / `loadColladaLoader()` / `loadSTLLoader()` / `loadXYZLoader()`
- `loadTDSLoader()` / `loadPCDLoader()` / `loadGLTFLoader()` / `loadDRACOLoader()`
- `loadIFCLoader()` / `loadRoomEnvironment()` / `loadHDRLoader()`
  - Dynamically import the corresponding Three.js loader or environment helper.

- `syncSceneEnvironment(enabled = true, preset = null)`
  - Load the environment texture for the scene and apply it to `core.scene`.
  - Supports built-in studio and HDR presets.

- `loadModel()`
  - Main engine for model loading.
  - Detects file type, chooses the correct loader, applies geometry/material setup, adds the object to the scene, and triggers metadata loading.

- `getModuleAssetBasePath()`
  - Resolve the runtime asset base path based on build target, Drupal environment, and local preview mode.

- `onError(_event)`
  - Generic loader error handler.

- `onErrorMTL(_event)`
  - Fallback loader error handler for OBJ/MTL bundles.

- `onErrorGLB(_event, params, loadedTimes)`
  - Retry logic for GLB loading errors.

- `onProgress(xhr)`
  - Update progress UI while a model is downloading.


## `viewer/metadata.js`

`viewer/metadata.js` handles metadata fetching, metadata panel rendering, and IIIF support.

- `addWissKIMetadata(label, value)`
  - Map WissKI field names to localized metadata display labels.

- `lilGUIhasFolder(folder, name)` / `lilGUIgetFolder(gui, name)`
  - Find lil-gui folders by title.

- `expandMetadata()`
  - Toggle the metadata panel open/closed.

- `appendMetadata(metadataContent)`
  - Render metadata HTML into the viewer metadata container.

- `fetchMetadata(_object, _type)`
  - Count vertices or faces for a mesh object.

- `handleMetadataResponse(data, metadata, object, hierarchyMain)`
  - Build the metadata panel and edit/hierarchy UI after loading a model.

- `settingsHandler(object, hierarchyMain, data)`
  - Apply object and camera settings after metadata has been loaded.

- `traverseObject(object)`
  - Run object traversal logic for metadata and camera setup.

- `presentationMode(object)`
  - Apply presentation-mode-specific scene setup.

- `fetchSettings(object)`
  - Fetch remote metadata payloads and dispatch metadata handling.

- `createIIIFDropdown(iiifConfigURL)`
  - Render a dropdown for selectable IIIF manifests.

- `createIIIFUI()`
  - Create the IIIF manifest loader UI panel.


## `viewer/viewer-utils.js`

`viewer/viewer-utils.js` contains viewer helpers for clipping planes, UI notifications, camera setup, and background rendering.

- `initClippingPlanes()`
  - Initialize the three clipping planes used by the viewer.

- `toastHelper(key, toneOrOptions, maybeOptions)`
  - Show a translated status toast by key.

- `showToast(message, toneOrOptions, maybeOptions)`
  - Show a message or translated toast directly.

- `getErrorMessage(error)`
  - Normalize error objects or strings into a message.

- `reportViewerError(error, options)`
  - Report errors through console, toast, and E2E state.

- `setupObject(_object, _metadata)`
  - Adjust object position, rotation, scale, and camera based on metadata or configuration.

- `setupCamera(_object, _data)`
  - Set up camera, controls, lights, and background for the loaded object.

- `applyGradientCss(gradient)`
  - Set a CSS gradient background from parsed gradient values.

- `changeBackground(_type, _color1, _color2 = _color1, _alpha = 100)`
  - Set viewer canvas background color or gradient.

- `invertHexColor(hexTripletColor)`
  - Return the inverted value for a hex color string.

- `getOrAddGuiController(object, prop)`
  - Find or create a lil-gui controller by property name.


## `viewer/utils.js`

`viewer/utils.js` exposes generic utility functions used throughout the viewer.

- `distanceBetweenPoints(pointA, pointB)`
- `distanceBetweenPointsVector(vector)`
- `vectorBetweenPoints(pointA, pointB)`
- `halfwayBetweenPoints(pointA, pointB)`
- `interpolateDistanceBetweenPoints(pointA, vector, length, scalar)`
  - Geometry helpers for basic vector math.

- `detectColorFormat(color)`
- `hexToRgb(hex)`
- `parseCssColor(str)`
- `normalizeColor(value)`
  - Color parsing and normalization helpers.

- `isValidUrl(urlString)`
- `truncateString(str, n)`
  - String and URL utilities.

- `getProxyPath(url, config)`
  - Build proxied asset URLs for server-side proxy support.


## `viewer/viewer-settings.js`

- `loadSettings()`
  - Load `viewer-settings.json` relative to the current module path.
  - Used by source-mode development and runtime config loading.
