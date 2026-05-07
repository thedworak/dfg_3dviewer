import { T as THREE, e as exports$1, V as Vector3, M as Matrix4, Q as Quaternion, E as Euler, a as MathUtils$1, O as OrbitControls, b as TransformControls, F as FontLoader, c as TextGeometry } from './assets/three.js';

window.THREE = THREE;

// core.js
const core = {
    clippingPlanes: null,
    materialsFolder: null,
    materialsPropertiesText: null,
    camera: null,
    colors: {},
    intensity: {},
    ambientLight: null,
    cameraLight: null,
    mainCanvas: null,
    noticeContainer: null,
    statusNotice: null,
    gridSize: null,
    dirLightTarget: null,
    lightHelper: null,
    scene: new THREE.Scene(),
    basicGrid: new THREE.Group(),
    axesHelper: new THREE.AxesHelper(),
    cameraCoords: null,
    tween: new exports$1.Tween(),
    controls: null,
    transformControlClippingPlaneY: null,
    transformControlClippingPlaneX: null,
    transformControlClippingPlaneZ: null,
    planeHelpers: null,
    outlineClipping: null,
    sceneBackgroundColor: null,
    distanceGeometry: null,
    planeParams: null,
    clippingFolder: null,
    helperObjects: []
    // Add other shared state here
};

const setCore = (key, value) => {
    core[key] = value;
};

function distanceBetweenPointsVector(vector) {
  return Math.sqrt(
    Math.pow(vector.x, 2) +
    Math.pow(vector.y, 2) +
    Math.pow(vector.z, 2)
  );
}

function vectorBetweenPoints(pointA, pointB) {
  return {
    x: pointB.x - pointA.x,
    y: pointB.y - pointA.y,
    z: pointB.z - pointA.z
  };
}

function halfwayBetweenPoints(pointA, pointB) {
  return {
    x: (pointB.x + pointA.x) / 2,
    y: (pointB.y + pointA.y) / 2,
    z: (pointB.z + pointA.z) / 2
  };
}

function interpolateDistanceBetweenPoints(pointA, vector, length, scalar) {
  const _x = pointA.x + (scalar / Math.abs(length)) * vector.x;
  const _y = pointA.y + (scalar / Math.abs(length)) * vector.y;
  const _z = pointA.z + (scalar / Math.abs(length)) * vector.z;
  return { x: _x, y: _y, z: _z };
}

// String helpers
function isValidUrl(urlString) {
  const urlPattern = new RegExp(
    "^(https?:\\/\\/)?" +
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" +
    "((\\d{1,3}\\.){3}\\d{1,3}))" +
    "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" +
    "(\\?[;&a-z\\d%_.~+=-]*)?" +
    "(\\#[-a-z\\d_]*)?$",
    "i"
  );
  return !!urlPattern.test(urlString);
}

function truncateString(str, n) {
  if (str.length === 0) return str;
  if (str.length > n) return str.substring(0, n) + "...";
  return str;
}

// Path helpers
function getProxyPath(url, config) {
  const tempPath = decodeURIComponent(config.mainUrl);
  return tempPath.replace(core.fileObject.originalPath, encodeURIComponent(url));
}

setCore("getProxyPath", getProxyPath);

function normalizeColor(value) {
  if (value == null) return null;

  //legacy: [[r,g,b]]
  if (Array.isArray(value) && Array.isArray(value[0])) {
    value = value[0];
  }

  //already normalized
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.r === "number" &&
    typeof value.g === "number" &&
    typeof value.b === "number"
  ) {
    return {
      r: value.r,
      g: value.g,
      b: value.b,
      a: value.a ?? 1
    };
  }

  //[r, g, b, a?]
  if (Array.isArray(value)) {
    const [r, g, b, a = 1] = value;
    if (
      typeof r === "number" &&
      typeof g === "number" &&
      typeof b === "number"
    ) {
      return { r, g, b, a };
    }
    return null;
  }

  //number (0xffffff or 16777215)
  if (typeof value === "number") {
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
      a: 1
    };
  }

  //string
  if (typeof value === "string") {
    return parseCssColor(value);
  }

  return null;
}

function parseCssColor(str) {
  if (typeof str !== "string") return null;

  str = str.trim();

  // 0xFFFFFF
  if (str.startsWith("0x")) {
    const n = parseInt(str, 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: 1
    };
  }

  // #RGB / #RRGGBB
  if (str.startsWith("#")) {
    let hex = str.slice(1);

    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }

    if (hex.length !== 6) return null;

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1
    };
  }

  // rgb / rgba
  const m = str.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );

  if (m) {
    const [, r, g, b, a] = m;
    return {
      r: +r,
      g: +g,
      b: +b,
      a: a !== undefined ? +a : 1
    };
  }

  return null;
}

const VIEWER_I18N = {
  en: {
    menu: {
      actions: "Viewer actions",
      openActions: "Open viewer actions",
      embed: "Embed",
      exitEmbed: "Exit embed",
      openEmbedOptions: "Open embed options",
      exitEmbedMode: "Exit embed mode",
      download: "Download",
    },
    theme: {
      lightMode: "Light mode",
      darkMode: "Dark mode",
      switchToLightMode: "Switch to light mode",
      switchToDarkMode: "Switch to dark mode",
    },
    fullscreen: {
      mode: "Fullscreen mode",
      enter: "Fullscreen",
      exit: "Exit fullscreen",
      exitMode: "Exit fullscreen mode",
    },
    language: {
      label: "Language: English",
      switchToPolish: "Switch to Polish",
      switchToEnglish: "Switch to English",
      switchToGerman: "Switch to German",
    },
    hints: {
      pickingSelect: "Select at least one face to add annotation.",
      picking: "Shift + click to select multiple faces",
      clipping: "Drag active clipping plane helper to adjust cut",
    },
    controls: {
      enablePickingMode: "Enable picking mode",
      disablePickingMode: "Disable picking mode",
      enableDistanceMeasurement: "Enable distance measurement",
      disableDistanceMeasurement: "Disable distance measurement",
      selectedFaces: "Selected faces",
    },
    gui: {
      controls: "Controls",
      editor: "Editor",
      transform3dObject: "Transform 3D Object",
      transformLight: "Transform Light",
      transformMode: "Transform Mode",
      directionalLight: "Directional Light",
      ambientLight: "Ambient Light",
      cameraLight: "Camera Light",
      backgroundColor: "Background Color",
      BackgroundColorOuter: "Background Color Outer",
      backgroundType: "Background Type",
      clippingPlanes: "Clipping Planes",
      clippingFolder: "Clipping Planes",
      displayHelperX: "Show X helper",
      displayHelperY: "Show Y helper",
      displayHelperZ: "Show Z helper",
      constantX: "Constant X",
      constantY: "Constant Y",
      constantZ: "Constant Z",
      visible: "Visible cutting",
      materials: "Materials",
      metadata: "Annotations",
      saveProperties: "Save properties",
      hierarchy: "Hierarchy",
      statistics: "Statistics",
      clearSelectedFaces: "Clear selected faces",
      addAnnotations: "Add annotations",
      exportAnnotationsXml: "Export annotations XML",
      importAnnotationsXml: "Import annotations XML",
      resetCameraPosition: "Reset camera position",
      save: "Save",
      renderPreview: "Render preview",
      color: "Color",
      intensity: "Intensity",
      position: "Position",
      rotation: "Rotation",
      camera: "Camera",
      performance: "Performance",
      highPerformance: "High-performance",
      lowPower: "Low-power",
      default: "Default",
      none: "None",
      move: "Move",
      rotate: "Rotate",
      scale: "Scale",
      target: "Target",
      local: "Local",
      global: "Global",
      linear: "Linear",
      gradient: "Gradient",
      editMaterial: "Edit material",
      selectByMaterial: "select by material",
    },
    metadata: {
      modelDetails: "Model details",
      metadata: "Metadata",
      visualizedFile: "Visualized file",
      vertices: "Vertices",
      faces: "Faces",
      title: "Title",
      author: "Author",
      authorAffiliation: "Author affiliation",
      license: "License",
      description: "Description",
      objectType: "Object type",
      reconstructionAuthors: "Reconstruction authors",
      reconstructionPeriod: "Reconstruction period",
    },
    iiif: {
      loader: "IIIF Loader",
      collapse: "Collapse",
      expand: "Expand",
      manifest: "IIIF manifest",
      loadFromUrl: "Load from URL",
      loadFromText: "Load from Text",
      manifestUrlPlaceholder: "https://example.org/iiif/manifest.json",
      manifestTextPlaceholder: "Paste IIIF manifest JSON here...",
      invalidUrl: "Please enter a valid IIIF manifest URL.",
      invalidJson: "Please enter a valid IIIF JSON text.",
      optionModelPositionScale: "Model Position and Scale",
      optionModelOrigin: "Model Origin",
      optionModelOriginBg: "Model Origin with background color",
      optionModelPosition: "Model Position",
    },
    localPreview: {
      loadExampleModel: "Load example model",
    },
    loadingLog: {
      title: "Loading process log",
      loadingModel: "Loading 3D model...",
      modelLoaded: "Model has been loaded.",
      loadingAssets: "Loading assets...",
      parsingScene: "Parsing scene...",
      loadingTextures: "Loading textures...",
      preparingGeometry: "Preparing geometry...",
      settingUpLighting: "Setting up lighting...",
      settingUpMaterials: "Setting up materials...",
      buildingBvh: "Building BVH...",
      compilingShaders: "Compiling shaders...",
      initializingRenderer: "Initializing renderer...",
      uploadingBuffers: "Uploading buffers...",
      fetchingMetadata: "Fetching metadata...",
    },
    processingHeader: "Processing progress",
    processingSteps: {
      preparingModel: "Preparing model",
      convertingToTransmissionFormat: "Converting to transmission format",
      renderingThumbnails: "Rendering thumbnails",
      savingEntity: "Saving entity",
      finalizing3dModel: "Finalizing 3D model",
      initializingViewer: "Initializing viewer",
    },
    state: {
      enabled: "enabled",
      disabled: "disabled"
    },
    toasts: {
      transformMove: "Move: drag axis arrows to reposition the object.",
      transformRotate: "Rotate: drag rotation rings to rotate the object.",
      transformScale: "Scale: drag axis handles to resize the object.",
      transformLightMove: "Transform Light - Move: drag axis arrows to move the directional light.",
      transformLightTarget: "Transform Light - Target: drag axis arrows to reposition the light target.",
      distanceEnabled: "Distance measurement is enabled.",
      distanceHint: "Select a start point and an end point to measure distance.",
      noIiiifModelFallback: "No 3D model found in IIIF manifest, loading example model.",
      facePickingEnabled: "Face picking is enabled",
      facePickingDisabled: "Face picking is disabled",
      distanceModeEnabled: "Distance measurement mode is enabled",
      distanceModeDisabled: "Distance measurement mode is disabled",
      settingsFound: "Settings {filename}_viewer.json found",
      settingsNotFound: "No settings {filename}_viewer.json found",
      metadataFetchError: "Error fetching metadata: {error}",

      presentationModeError: "An error occurred during presentation mode setup.",
      objLoaded: "OBJ model has been loaded.",
      mtlLoadError: "Error occurred while loading attached MTL file.",
      glbLoadError: "Error occurred while loading attached GLB file.",
      unsupportedExtension: "File extension is not supported yet.",
      modelLoaded: "Model {filename} has been loaded.",
      modelLoadedSimple: "Model loaded successfully.",
      unsupportedFormat: "Unsupported file format.",
      presentationModeReady: "Presentation mode is ready.",
      presentationModeError: "An error occurred during presentation mode setup.",
      sandboxDropModel: "Drag and drop a 3D model into the viewer.",
      supportedFormats: "Supported formats: {formats}.",

      embedSourceMissing: "Set Model URL or Entity ID for embed.",
      embedUrlCopied: "Embed URL copied.",
      embedUrlCopyError: "Could not copy embed URL.",
      embedIframeCopied: "Embed iframe copied.",
      embedIframeCopyError: "Could not copy embed iframe.",
      embedCodeCopied: "Embed code copied to clipboard.",
      embedCodeCopyError: "Could not copy embed code.",

      annotationDataMissing: "Annotation data not found for this POI.",
      selectFaceRequired: "Select at least one face to add annotation.",
      selectFaceRequiredAgain: "Select at least one face, then run Add annotations again.",
      noFacesSelected: "No faces selected for annotation.",
      titleRequired: "Title is required.",
      facesInactive: "Selected faces are no longer active.",

      annotationsSaved: "Annotations saved for {count} face{plural}.",
      annotationsImported: "Imported {count} annotation{plural}.",
      annotationsExported: "Annotations XML exported.",
      noAnnotationsToExport: "No annotations to export.",
      noValidAnnotations: "No valid annotations found in XML.",
      annotationsImportError: "Failed to import annotations XML.",

      settingsSaved: "Settings have been saved.",
      settingsSaveError: "Error saving settings.",

      featureToggle: "{feature} is {state}.",
      clippingHelperToggle: "Clipping plane {axis} helper {state}.",
    },
    shortcuts: {
      mouse: "Mouse: drag orbit, wheel zoom, right-drag pan",
      keyboard: "Keyboard: Arrows orbit, Shift+Arrows faster, Ctrl/Cmd+Arrows pan, +/- zoom, Space toggle auto-rotate",
      touch: "Touch: pinch-to-zoom, drag to orbit, double-tap-and-hold pan",
      dragAndDrop: "Or drag and drop a 3D model into the viewer",
    },
  },
  pl: {
    menu: {
      actions: "Akcje podglądu",
      openActions: "Otworz akcje podglądu",
      embed: "Osadź",
      exitEmbed: "Wyjdź z osadzania",
      openEmbedOptions: "Otwórz opcje osadzania",
      exitEmbedMode: "Wyjdź z trybu osadzania",
      download: "Pobierz",
    },
    theme: {
      lightMode: "Tryb jasny",
      darkMode: "Tryb ciemny",
      switchToLightMode: "Przelącz na tryb jasny",
      switchToDarkMode: "Przelącz na tryb ciemny",
    },
    fullscreen: {
      mode: "Tryb pełnoekranowy",
      enter: "Pełny ekran",
      exit: "Wyjdź z pełnego ekranu",
      exitMode: "Wyjdź z trybu pełnoekranowego",
    },
    language: {
      label: "Language: Polski",
      switchToPolish: "Przelącz na język polski",
      switchToEnglish: "Przelącz na język angielski",
      switchToGerman: "Przelącz na język niemiecki",
    },
    hints: {
      picking: "Shift + klik, aby wybrać wiele scian",
      clipping: "Przeciągnij aktywną plaszczyznę przycinania, aby dostosować cięcie",
    },
    controls: {
      enablePickingMode: "Włącz tryb wyboru",
      disablePickingMode: "Wyłącz tryb wyboru",
      enableDistanceMeasurement: "Włącz pomiar odległości",
      disableDistanceMeasurement: "Wyłącz pomiar odległości",
      selectedFaces: "Wybrane sciany",
    },
    gui: {
      controls: "Sterowanie",
      editor: "Edytor",
      transform3dObject: "Transformacja obiektu 3D",
      transformLight: "Transformacja światła",
      transformMode: "Tryb transformacji",
      directionalLight: "Światło kierunkowe",
      ambientLight: "Światło otaczające",
      cameraLight: "Światło kamery",
      backgroundColor: "Kolor tła",
      backgroundColorOuter: "Kolor tła zewnętrznego",
      backgroundType: "Typ tła",
      clippingPlanes: "Płaszczyzny przycinania",
      clippingFolder: "Płaszczyzny przycinania",
      displayHelperX: "Pokaż oś X",
      displayHelperY: "Pokaż oś Y",
      displayHelperZ: "Pokaż oś Z",
      constantX: "Stała X",
      constantY: "Stała Y",
      constantZ: "Stała Z",
      visible: "Widoczne cięcie",
      materials: "Materiały",
      metadata: "Annotacje",
      saveProperties: "Zapisz właściwości",
      hierarchy: "Hierarchia",
      statistics: "Statystyki",
      clearSelectedFaces: "Wyczyść wybrane ściany",
      addAnnotations: "Dodaj annotacje",
      exportAnnotationsXml: "Eksportuj annotacje XML",
      importAnnotationsXml: "Importuj annotacje XML",
      resetCameraPosition: "Resetuj pozycję kamery",
      save: "Zapisz",
      renderPreview: "Renderuj podgląd",
      color: "Kolor",
      intensity: "Intensywność",
      position: "Pozycja",
      rotation: "Rotacja",
      camera: "Kamera",
      performance: "Wydajność",
      highPerformance: "Wysoka wydajność",
      lowPower: "Niski pobór mocy",
      default: "Domyślny",
      none: "Brak",
      move: "Przesuń",
      rotate: "Obróć",
      scale: "Skaluj",
      target: "Cel",
      local: "Lokalny",
      global: "Globalny",
      linear: "Liniowe",
      gradient: "Gradient",
      editMaterial: "Edytuj materiał",
      selectByMaterial: "wybierz według materiału",
    },
    metadata: {
      modelDetails: "Szczegóły modelu",
      metadata: "Metadane",
      visualizedFile: "Wizualizowany plik",
      vertices: "Wierzchołki",
      faces: "Ściany",
      title: "Tytuł",
      author: "Autor",
      authorAffiliation: "Afiliacja autora",
      license: "Licencja",
      description: "Opis",
      objectType: "Typ obiektu",
      reconstructionAuthors: "Autorzy rekonstrukcji",
      reconstructionPeriod: "Okres rekonstrukcji",
    },
    iiif: {
      loader: "Ładowanie IIIF",
      collapse: "Zwiń",
      expand: "Rozwiń",
      manifest: "Manifest IIIF",
      loadFromUrl: "Wczytaj z URL",
      loadFromText: "Wczytaj z tekstu",
      manifestUrlPlaceholder: "https://example.org/iiif/manifest.json",
      manifestTextPlaceholder: "Wklej tutaj JSON manifestu IIIF...",
      invalidUrl: "Podaj poprawny URL manifestu IIIF.",
      invalidJson: "Podaj poprawny tekst JSON IIIF.",
      optionModelPositionScale: "Pozycja i skala modelu",
      optionModelOrigin: "Punkt początkowy modelu",
      optionModelOriginBg: "Punkt początkowy modelu z kolorem tła",
      optionModelPosition: "Pozycja modelu",
    },
    localPreview: {
      loadExampleModel: "Wczytaj model przykładowy",
    },
    loadingLog: {
      title: "Log procesu ładowania",
      loadingModel: "Ładowanie modelu 3D...",
      modelLoaded: "Model został załadowany.",
      loadingAssets: "Ładowanie zasobów...",
      parsingScene: "Analizowanie sceny...",
      loadingTextures: "Ładowanie tekstur...",
      preparingGeometry: "Przygotowywanie geometrii...",
      settingUpLighting: "Konfigurowanie oświetlenia...",
      settingUpMaterials: "Konfigurowanie materiałów...",
      buildingBvh: "Budowanie BVH...",
      compilingShaders: "Kompilowanie shaderów...",
      initializingRenderer: "Inicjalizowanie renderera...",
      uploadingBuffers: "Przesyłanie buforów...",
      fetchingMetadata: "Pobieranie metadanych...",
    },
    processingHeader: "Postęp przetwarzania",
    processingSteps: {
      preparingModel: "Przygotowywanie modelu",
      convertingToTransmissionFormat: "Konwersja do formatu docelowego",
      renderingThumbnails: "Renderowanie miniaturek",
      savingEntity: "Zapisywanie encji",
      finalizing3dModel: "Finalizowanie modelu 3D",
      initializingViewer: "Inicjalizowanie viewera",
    },
    state: {
      enabled: "włączony",
      disabled: "wyłączony"
    },
    toasts: {
      transformMove: "Przesuwanie: przeciągnij strzalki osi, aby przesunąć obiekt.",
      transformRotate: "Obracanie: przeciągnij pierscienie obrotu, aby obrócić obiekt.",
      transformScale: "Skalowanie: przeciągnij uchwyty osi, aby zmienić rozmiar obiektu.",
      transformLightMove: "Transformacja światła - Przesunięcie: przeciągnij strzalki osi, aby przesunąć światło kierunkowe.",
      transformLightTarget: "Transformacja światła - Cel: przeciągnij strzałki osi, aby przesunąć punkt celu światła.",
      distanceEnabled: "Pomiar odległości jest włączony.",
      distanceHint: "Wybierz punkt początkowy i końcowy, aby zmierzyć odległość.",
      noIiiifModelFallback: "Nie znaleziono modelu 3D w manifescie IIIF, ładuję model przykładowy.",
      facePickingEnabled: "Tryb wyboru ścian jest włączony",
      facePickingDisabled: "Tryb wyboru ścian jest wyłączony",
      distanceModeEnabled: "Tryb pomiaru odległości jest włączony",
      distanceModeDisabled: "Tryb pomiaru odległości jest wyłączony",
      settingsFound: "Znaleziono ustawienia {filename}_viewer.json",
      settingsNotFound: "Nie znaleziono ustawień {filename}_viewer.json",
      metadataFetchError: "Błąd pobierania metadanych: {error}",

      presentationModeError: "Wystąpił błąd podczas konfiguracji trybu prezentacji.",
      objLoaded: "Model OBJ został załadowany.",
      mtlLoadError: "Wystąpił błąd podczas ładowania pliku MTL.",
      glbLoadError: "Wystąpił błąd podczas ładowania pliku GLB.",
      unsupportedExtension: "Rozszerzenie pliku nie jest jeszcze obsługiwane.",
      modelLoaded: "Model {filename} został załadowany.",
      modelLoadedSimple: "Model został pomyślnie załadowany.",
      unsupportedFormat: "Nieobsługiwany format pliku.",
      presentationModeReady: "Tryb prezentacji jest gotowy.",
      presentationModeError: "Wystąpił błąd podczas konfiguracji trybu prezentacji.",
      sandboxDropModel: "Przeciągnij i upuść model 3D w oknie viewer'a.",
      supportedFormats: "Obsługiwane formaty: {formats}.",

      embedSourceMissing: "Ustaw URL modelu lub ID encji do osadzenia.",
      embedUrlCopied: "Skopiowano URL osadzenia.",
      embedUrlCopyError: "Nie udało się skopiować URL osadzenia.",
      embedIframeCopied: "Skopiowano iframe osadzenia.",
      embedIframeCopyError: "Nie udało się skopiować iframe.",
      embedCodeCopied: "Kod osadzenia został skopiowany do schowka.",
      embedCodeCopyError: "Nie udało się skopiować kodu osadzenia.",

      annotationDataMissing: "Nie znaleziono danych adnotacji dla tego punktu.",
      selectFaceRequired: "Wybierz co najmniej jedną ścianę, aby dodać adnotację.",
      selectFaceRequiredAgain: "Wybierz co najmniej jedną ścianę, a następnie ponownie dodaj adnotacje.",
      noFacesSelected: "Nie wybrano ścian do adnotacji.",
      titleRequired: "Tytuł jest wymagany.",
      facesInactive: "Wybrane ściany nie są już aktywne.",

      annotationsSaved: "Zapisano adnotacje dla {count} ścian{plural}.",
      annotationsImported: "Zaimportowano {count} adnotacj{plural}.",
      annotationsExported: "Wyeksportowano XML adnotacji.",
      noAnnotationsToExport: "Brak adnotacji do eksportu.",
      noValidAnnotations: "Nie znaleziono poprawnych adnotacji w XML.",
      annotationsImportError: "Nie udało się zaimportować XML adnotacji.",

      settingsSaved: "Ustawienia zostały zapisane.",
      settingsSaveError: "Błąd zapisywania ustawień.",

      featureToggle: "{feature} jest {state}.",
      clippingHelperToggle: "Pomocnik płaszczyzny przycinania {axis} jest {state}.",
    },
    shortcuts: {
      mouse: "Mysz: przeciągnij, aby obracać, rolka - zoom, prawy przycisk - przesuwanie",
      keyboard: "Klawiatura: strzałki - obrót, Shift+strzałki - szybciej, Ctrl/Cmd+strzałki - przesuwanie, +/- — zoom, Spacja - auto-obrót",
      touch: "Dotyk: szczypanie, aby przybliżyć, przeciągnij, aby obracać, dotknij i przytrzymaj, aby przesunąć",
      dragAndDrop: "Lub przeciągnij i upuść model 3D w oknie viewer'a",
    },
  },
  de: {
    menu: {
      actions: "Viewer-Aktionen",
      openActions: "Viewer-Aktionen öffnen",
      embed: "Einbetten",
      exitEmbed: "Einbettung beenden",
      openEmbedOptions: "Einbettungsoptionen öffnen",
      exitEmbedMode: "Einbettungsmodus beenden",
      download: "Herunterladen",
    },
    theme: {
      lightMode: "Hellmodus",
      darkMode: "Dunkelmodus",
      switchToLightMode: "Zu Hellmodus wechseln",
      switchToDarkMode: "Zu Dunkelmodus wechseln",
    },
    fullscreen: {
      mode: "Vollbildmodus",
      enter: "Vollbild",
      exit: "Vollbild beenden",
      exitMode: "Vollbildmodus beenden",
    },
    language: {
      label: "Sprache: Deutsch",
      switchToPolish: "Zu Polnisch wechseln",
      switchToEnglish: "Zu Englisch wechseln",
    },
    hints: {
      picking: "Umschalt + Klick, um mehrere Flächen auszuwählen",
      clipping: "Ziehen Sie die aktive Schnittebene-Hilfe, um den Schnitt anzupassen",
    },
    controls: {
      enablePickingMode: "Auswahlmodus aktivieren",
      disablePickingMode: "Auswahlmodus deaktivieren",
      enableDistanceMeasurement: "Entfernungsmessung aktivieren",
      disableDistanceMeasurement: "Entfernungsmessung deaktivieren",
      selectedFaces: "Ausgewählte Flächen",
    },
    gui: {
      controls: "Steuerung",
      editor: "Editor",
      transform3dObject: "3D-Objekt transformieren",
      transformLight: "Licht transformieren",
      transformMode: "Transformationsmodus",
      directionalLight: "Gerichtetes Licht",
      ambientLight: "Umgebungslicht",
      cameraLight: "Kamera-Licht",
      backgroundColor: "Hintergrundfarbe",
      backgroundColorOuter: "Äußere Hintergrundfarbe",
      backgroundType: "Hintergrundtyp",
      clippingPlanes: "Schnittebenen",
      clippingFolder: "Schnittebenen",
      displayHelperX: "X-Hilfe anzeigen",
      displayHelperY: "Y-Hilfe anzeigen",
      displayHelperZ: "Z-Hilfe anzeigen",
      constantX: "Konstante X",
      constantY: "Konstante Y",
      constantZ: "Konstante Z",
      visible: "Sichtbarer Schnitt",
      materials: "Materialien",
      metadata: "Anmerkungen",
      saveProperties: "Eigenschaften speichern",
      hierarchy: "Hierarchie",
      statistics: "Statistiken",
      clearSelectedFaces: "Ausgewählte Flächen löschen",
      addAnnotations: "Anmerkungen hinzufügen",
      exportAnnotationsXml: "Anmerkungen XML exportieren",
      importAnnotationsXml: "Anmerkungen XML importieren",
      resetCameraPosition: "Kameraposition zurücksetzen",
      save: "Speichern",
      renderPreview: "Vorschau rendern",
      color: "Farbe",
      intensity: "Intensität",
      position: "Position",
      rotation: "Rotation",
      camera: "Kamera",
      performance: "Leistung",
      highPerformance: "Hohe Leistung",
      lowPower: "Niedriger Stromverbrauch",
      default: "Standard",
      none: "Keine",
      move: "Bewegen",
      rotate: "Drehen",
      scale: "Skalieren",
      target: "Ziel",
      local: "Lokal",
      global: "Global",
      linear: "Linear",
      gradient: "Farbverlauf",
      editMaterial: "Material bearbeiten",
      selectByMaterial: "nach Material auswählen",
    },
    metadata: {
      modelDetails: "Modelldetails",
      metadata: "Metadaten",
      visualizedFile: "Visualisierte Datei",
      vertices: "Vertices",
      faces: "Flächen",
      title: "Titel",
      author: "Autor",
      authorAffiliation: "Autoren-Zugehörigkeit",
      license: "Lizenz",
      description: "Beschreibung",
      objectType: "Objekttyp",
      reconstructionAuthors: "Rekonstruktionsautoren",
      reconstructionPeriod: "Rekonstruktionsperiode",
    },
    iiif: {
      loader: "IIIF-Loader",
      collapse: "Zusammenklappen",
      expand: "Erweitern",
      manifest: "IIIF-Manifest",
      loadFromUrl: "Von URL laden",
      loadFromText: "Von Text laden",
      manifestUrlPlaceholder: "https://example.org/iiif/manifest.json",
      manifestTextPlaceholder: "IIIF-Manifest-JSON hier einfügen...",
      invalidUrl: "Bitte geben Sie eine gültige IIIF-Manifest-URL ein.",
      invalidJson: "Bitte geben Sie einen gültigen IIIF-JSON-Text ein.",
      optionModelPositionScale: "Modellposition und -skalierung",
      optionModelOrigin: "Modellursprung",
      optionModelOriginBg: "Modellursprung mit Hintergrundfarbe",
      optionModelPosition: "Modellposition",
    },
    localPreview: {
      loadExampleModel: "Beispielmodell laden",
    },
    loadingLog: {
      title: "Protokoll des Ladeprozesses",
      loadingModel: "3D-Modell wird geladen...",
      modelLoaded: "Modell wurde geladen.",
      loadingAssets: "Assets werden geladen...",
      parsingScene: "Szene wird analysiert...",
      loadingTextures: "Texturen werden geladen...",
      preparingGeometry: "Geometrie wird vorbereitet...",
      settingUpLighting: "Beleuchtung wird eingerichtet...",
      settingUpMaterials: "Materialien werden eingerichtet...",
      buildingBvh: "BVH wird erstellt...",
      compilingShaders: "Shader werden kompiliert...",
      initializingRenderer: "Renderer wird initialisiert...",
      uploadingBuffers: "Buffer werden hochgeladen...",
      fetchingMetadata: "Metadaten werden abgerufen...",
    },
    processingHeader: "Verarbeitungsschritte",
    processingSteps: {
      preparingModel: "Modell wird vorbereitet",
      convertingToTransmissionFormat: "Konvertierung in das Übertragungsformat",
      renderingThumbnails: "Vorschaubilder werden gerendert",
      savingEntity: "Entität wird gespeichert",
      finalizing3dModel: "3D-Modell wird finalisiert",
      initializingViewer: "Viewer wird initialisiert",
    },
    state: {
      enabled: "aktiviert",
      disabled: "deaktiviert"
    },
    toasts: {
      transformMove: "Bewegen: Ziehen Sie die Achsenpfeile, um das Objekt zu repositionieren.",
      transformRotate: "Drehen: Ziehen Sie die Rotationsringe, um das Objekt zu drehen.",
      transformScale: "Skalieren: Ziehen Sie die Achsengriffe, um die Größe des Objekts zu ändern.",
      transformLightMove: "Licht transformieren - Bewegen: Ziehen Sie die Achsenpfeile, um das gerichtete Licht zu bewegen.",
      transformLightTarget: "Licht transformieren - Ziel: Ziehen Sie die Achsenpfeile, um das Lichtziel zu repositionieren.",
      distanceEnabled: "Entfernungsmessung ist aktiviert.",
      distanceHint: "Wählen Sie einen Startpunkt und einen Endpunkt, um die Entfernung zu messen.",
      noIiiifModelFallback: "Kein 3D-Modell im IIIF-Manifest gefunden, Beispielmodell wird geladen.",
      facePickingEnabled: "Flächenauswahl ist aktiviert",
      facePickingDisabled: "Flächenauswahl ist deaktiviert",
      distanceModeEnabled: "Entfernungsmessungsmodus ist aktiviert",
      distanceModeDisabled: "Entfernungsmessungsmodus ist deaktiviert",
      settingsFound: "Einstellungen {filename}_viewer.json gefunden",
      settingsNotFound: "Keine Einstellungen {filename}_viewer.json gefunden",
      metadataFetchError: "Fehler beim Abrufen der Metadaten: {error}",

      presentationModeError: "Beim Einrichten des Präsentationsmodus ist ein Fehler aufgetreten.",
      objLoaded: "OBJ-Modell wurde geladen.",
      mtlLoadError: "Fehler beim Laden der zugehörigen MTL-Datei.",
      glbLoadError: "Fehler beim Laden der GLB-Datei.",
      unsupportedExtension: "Dateierweiterung wird noch nicht unterstützt.",
      modelLoaded: "Modell {filename} wurde geladen.",
      modelLoadedSimple: "Modell wurde erfolgreich geladen.",
      unsupportedFormat: "Nicht unterstütztes Dateiformat.",
      presentationModeReady: "Präsentationsmodus ist bereit.",
      presentationModeError: "Beim Einrichten des Präsentationsmodus ist ein Fehler aufgetreten.",
      sandboxDropModel: "Ziehen Sie ein 3D-Modell per Drag-and-drop in den Viewer.",
      supportedFormats: "Unterstützte Formate: {formats}.",

      embedSourceMissing: "Model-URL oder Entitäts-ID für die Einbettung festlegen.",
      embedUrlCopied: "Einbettungs-URL kopiert.",
      embedUrlCopyError: "Einbettungs-URL konnte nicht kopiert werden.",
      embedIframeCopied: "Einbettungs-iframe kopiert.",
      embedIframeCopyError: "Einbettungs-iframe konnte nicht kopiert werden.",
      embedCodeCopied: "Einbettungscode in die Zwischenablage kopiert.",
      embedCodeCopyError: "Einbettungscode konnte nicht kopiert werden.",

      annotationDataMissing: "Keine Annotationsdaten für diesen Punkt gefunden.",
      selectFaceRequired: "Wählen Sie mindestens eine Fläche aus, um eine Annotation hinzuzufügen.",
      selectFaceRequiredAgain: "Wählen Sie mindestens eine Fläche und führen Sie dann „Annotationen hinzufügen“ erneut aus.",
      noFacesSelected: "Keine Flächen für Annotation ausgewählt.",
      titleRequired: "Titel ist erforderlich.",
      facesInactive: "Ausgewählte Flächen sind nicht mehr aktiv.",

      annotationsSaved: "Annotationen für {count} Fläche{plural} gespeichert.",
      annotationsImported: "{count} Annotation{plural} importiert.",
      annotationsExported: "Annotations-XML exportiert.",
      noAnnotationsToExport: "Keine Annotationen zum Exportieren.",
      noValidAnnotations: "Keine gültigen Annotationen im XML gefunden.",
      annotationsImportError: "Import der Annotations-XML fehlgeschlagen.",

      settingsSaved: "Einstellungen wurden gespeichert.",
      settingsSaveError: "Fehler beim Speichern der Einstellungen.",

      featureToggle: "{feature} ist {state}.",
      clippingHelperToggle: "Clipping-Ebenen-Helfer {axis} ist {state}.",
    },
    shortcuts: {
      mouse: "Maus: ziehen zum Drehen, Mausrad - Zoom, Rechtsklick - Verschieben",
      keyboard: "Tastatur: Pfeile - Drehen, Shift+Pfeile - schneller, Ctrl/Cmd+Pfeile - Verschieben, +/- - Zoom, Leertaste - Auto-Rotation",
      touch: "Touch: Pinch-to-Zoom, ziehen zum Drehen, Doppeltippen und halten zum Verschieben",
      dragAndDrop: "Oder ziehen Sie ein 3D-Modell per Drag-and-drop in den Viewer",
    }
  },
};

const t$1=function(key, varsOrFallback = {}, maybeFallback = "") {
  const lang = ["pl", "de"].includes(core.currentLanguage)
    ? core.currentLanguage
    : "en";

  const dictionary = VIEWER_I18N[lang] || VIEWER_I18N.en;

  const value = String(key || "")
    .split(".")
    .reduce(
      (acc, part) =>
        acc && typeof acc === "object" ? acc[part] : undefined,
      dictionary
    );

  let vars = {};
  let fallback = "";

  if (typeof varsOrFallback === "string") {
    fallback = varsOrFallback;
  } else {
    vars = varsOrFallback || {};
    fallback = maybeFallback;
  }

  const template = typeof value === "string" ? value : fallback || key;

  return template.replace(/\{(\w+)\}/g, (_, v) => {
    let val = vars[v];

    if (typeof val === "boolean") {
      val = t$1(`state.${val ? "enabled" : "disabled"}`);
    } else if (typeof val === "string") {
      if (val === "enabled" || val === "disabled") {
        val = t$1(`state.${val}`);
      } else if (val.startsWith("state.")) {
        val = t$1(val);
      }
    }

    return val ?? `{${v}}`;
  });
};

// viewer-utils.js

const initClippingPlanes = () => {
  const clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  ];
  setCore('clippingPlanes', clippingPlanes);
  return clippingPlanes;
};

const scaleXYZ = (v, s) =>
  ['x', 'y', 'z'].forEach(k => v[k] *= s);

const DEFAULT_NOTICE_DURATION = 4200;

function normalizeNoticeArgs(toneOrOptions, maybeOptions) {
  let tone = "info";
  let options = {};

  if (typeof toneOrOptions === "string") {
    tone = toneOrOptions;
    options = maybeOptions ?? {};
  } else if (toneOrOptions && typeof toneOrOptions === "object") {
    options = toneOrOptions;
    tone = toneOrOptions.tone ?? "info";
  }

  return { tone, options };
}

const toastHelper$1 = (key, toneOrOptions, maybeOptions) => {
  return showToast(`toasts.${key}`, toneOrOptions, maybeOptions);
};

const showToast = (message, toneOrOptions, maybeOptions) => {
  if (!core.showNotifications) return;
  const { tone, options } = normalizeNoticeArgs(toneOrOptions, maybeOptions);

  const duration = Number.isFinite(options.duration)
    ? options.duration
    : DEFAULT_NOTICE_DURATION;

  const key = String(options.key ?? "");
  const replace = options.replace === true;
  const persistent = options.persistent === true;
  const variant = String(options.variant ?? "");
  let i18nKey = "";
  let i18nVars = {};
  const detailI18nKey = String(options.detailI18nKey ?? "");
  const detailI18nVars = options.detailVars && typeof options.detailVars === "object" ? options.detailVars : options;

  // Resolve i18n key if possible, otherwise use the message as-is (for backward compatibility)
  let text;
  let detail = "";

  if (typeof message === "string" && message.includes(".")) {
    // try to resolve as i18n key with optional variables
    i18nKey = message;
    i18nVars = options;
    text = t$1(message, options);
  } else {
    // fallback (old way)
    text = String(message);
  }

  if (detailI18nKey) {
    detail = t$1(detailI18nKey, detailI18nVars);
  } else if (options.detail != null) {
    detail = String(options.detail);
  }

  if (window.__E2E__ && window.viewer) {
    window.viewer.toasts ??= [];
    window.viewer.toasts.push([text, detail].filter(Boolean).join(" "));
  }

  const statusNotice = core.statusNotice;
  const enqueueStatusNotice = core.enqueueStatusNotice;

  if (typeof enqueueStatusNotice === "function") {
    enqueueStatusNotice({ message: text, detail, tone, duration, key, replace, persistent, variant, i18nKey, i18nVars, detailI18nKey, detailI18nVars });
    return;
  }

  if (!statusNotice) {
    console.info(`[viewer:${tone}] ${text}`);
    return;
  }

  statusNotice.hidden = false;
  statusNotice.textContent = [text, detail].filter(Boolean).join(" ");
  statusNotice.dataset.tone = tone;
  statusNotice.classList.remove("is-visible", "is-hiding");
  statusNotice.classList.add("is-visible");

  if (core.statusNoticeTimer) {
    window.clearTimeout(core.statusNoticeTimer);
  }

  core.statusNoticeTimer = window.setTimeout(() => {
    statusNotice.classList.remove("is-visible");
    statusNotice.classList.add("is-hiding");

    window.setTimeout(() => {
      if (!statusNotice.classList.contains("is-visible")) {
        statusNotice.hidden = true;
        statusNotice.classList.remove("is-hiding");
      }
    }, 220);
  }, duration);
};

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function reportViewerError(error, options = {}) {
  const {
    context = "",
    consoleLabel = "Viewer error",
    toast = true,
    e2e = true,
  } = options;

  const baseMessage = getErrorMessage(error);
  const message = context ? `${context}: ${baseMessage}` : baseMessage;

  console.error(consoleLabel, error);

  if (e2e && window.__E2E__ && window.viewer) {
    window.viewer.errors ??= [];
    window.viewer.errors.push(message);
  }

  if (toast) {
    showToast(message);
  }

  return message;
}

function fetchObjectFromConfig(_name) {
  //console.log("Fetching config for", _name, core.objectsConfig);
  return core.objectsConfig?.models?.find(model => model.name === _name);
}

function normalizeVec3(v) {
  if (!v) return null;

  if (Array.isArray(v) && v.length === 3) {
    return { x: v[0], y: v[1], z: v[2] };
  }

  if (
    typeof v === "object" &&
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.z === "number"
  ) {
    return v;
  }

  return null;
}


function normalizeGradient(gradient) {
  return {
    type: gradient.type,
    shapeOrDirection: gradient.shapeOrDirection,
    colors: gradient.colors
      .map(normalizeColor)
      .filter(Boolean)
  };
}

function setupObjectHandler(_object, _metadata) {
  if (!_metadata) return;

  const pos = normalizeVec3(_metadata.position ?? _metadata.objPosition);
  if (pos) {
    _object.position.set(pos.x, pos.y, pos.z);
  }

  const scale = normalizeVec3(_metadata.scale ?? _metadata.objScale);
  if (scale) {
    _object.scale.set(scale.x, scale.y, scale.z);
  }

  const rot = normalizeVec3(_metadata.rotation ?? _metadata.objRotation);
  if (rot) {
    _object.rotation.set(
      THREE.MathUtils.degToRad(rot.x),
      THREE.MathUtils.degToRad(rot.y),
      THREE.MathUtils.degToRad(rot.z)
    );
  }
}

function setupGeometryHandler (_object) {
  _object.needsUpdate = true;
  if (typeof _object.geometry !== "undefined") {
    _object.geometry.computeBoundingBox();
    _object.geometry.computeBoundingSphere();
  }
  _object.updateMatrix();
  _object.updateMatrixWorld(true);
}

function centerObjectAtOrigin(_object) {
  const boundingBox = new THREE.Box3();
  boundingBox.setFromObject(_object, true);
  if (boundingBox.isEmpty()) return;

  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  _object.position.sub(center);
  _object.updateMatrixWorld(true);
}

function setupCameraHandler(_object, meta) {
  if (!meta) return;

  const target = normalizeVec3(meta.controlsTarget);
  const camPos = normalizeVec3(meta.cameraPosition);

  if (!target && !camPos) return;

  const wasDamping = core.controls.enableDamping;
  core.controls.enableDamping = false;

  if (target) {
    core.controls.target?.set(target.x, target.y, target.z);
  }

  if (camPos) {
    core.camera.position?.set(camPos.x, camPos.y, camPos.z);
  }

  core.camera.updateProjectionMatrix();
  core.controls.update();
  core.controls.saveState();
  core.controls.enableDamping = wasDamping;
}

const setupObject = (_object, _metadata) => {
  let model;
  if (typeof _object.children === "undefined" || _object.children.length == 0) {
    model = fetchObjectFromConfig(_object.name);
  } else if (_object.children.length > 0) {
    model = fetchObjectFromConfig(_object.children[0].name); //TODO: check for multiple objects
  }

  if (_metadata != null) {
    setupObjectHandler(_object, _metadata);
    setupGeometryHandler(_object);
    setupCameraHandler(_object, _metadata);
  }
  else if (typeof core.objectsConfig !== "undefined" && model) { //Setup from config
    if ((!Array.isArray(core.objectsConfig.models) || core.objectsConfig.models.length === 0) && _metadata == null) {
      if (model.position != null) _object.position.set(model.position.x, model.position.y, model.position.z);

      if (model.scale != null) _object.scale.set(model.scale.x, model.scale.y, model.scale.z);
      
      if (model.rotation != null) _object.rotation.set(THREE.MathUtils.degToRad(model.rotation.x), THREE.MathUtils.degToRad(model.rotation.y), THREE.MathUtils.degToRad(model.rotation.z));
    } else {
      let m = core.objectsConfig.models[core.objectsConfig.setupIndex];
      if (m != undefined && _metadata == null) {
        //console.log("Applying config for index", core.objectsConfig.setupIndex, m);
        setupObjectHandler(_object, m);
      } else if (_metadata != null) {
        // Fallback to metadata
        setupObjectHandler(_object, _metadata);
      }        
    }
    setupGeometryHandler(_object);
  }
  else {
    var boundingBox = new THREE.Box3();
    if (Array.isArray(_object)) {
      for (let i = 0; i < _object.length; i++) {
        boundingBox.setFromObject(_object[i]);
        _object[i].position.set(
          -(boundingBox.min.x + boundingBox.max.x) / 2,
          -boundingBox.min.y,
          -(boundingBox.min.z + boundingBox.max.z) / 2
        );
        _object[i].needsUpdate = true;
        if (typeof _object[i].geometry !== "undefined") {
          _object[i].geometry.computeBoundingBox();
          _object[i].geometry.computeBoundingSphere();
        }
        _object[i].updateMatrixWorld();
      }
    } else if (_object.isGroup) {
      // Keep non-presentation behavior, but center fully in presentation mode.
      if (core.PRESENTATION_MODE) {
        centerObjectAtOrigin(_object);
      } else {
        //workaround for specific Group case
        boundingBox.setFromObject(_object);
        _object.position.set(-(boundingBox.min.x+boundingBox.max.x)/2, -boundingBox.min.y, -(boundingBox.min.z+boundingBox.max.z)/2);
        _object.updateMatrixWorld();
      }
    } else if (!core.PRESENTATION_MODE) {
      boundingBox.setFromObject(_object);
      _object.position.set((boundingBox.max.x - boundingBox.min.x ) / 2, (boundingBox.max.y - boundingBox.min.y) / 2, (boundingBox.max.z - boundingBox.min.z ) / 2);
      setupGeometryHandler(_object);
    } else {
      // In presentation mode keep local hierarchy transforms and center only the whole object.
      centerObjectAtOrigin(_object);
      setupGeometryHandler(_object);
    }
  }

  core.cameraLight.position.set(
    core.camera.position.x,
    core.camera.position.y,
    core.camera.position.z
  );
  if (Array.isArray(_object)) {
    core.cameraLightTarget.position.set(
      _object[0].position.x,
      _object[0].position.y,
      _object[0].position.z
    );
  } else {
    core.cameraLightTarget.position.set(
      _object.position.x,
      _object.position.y,
      _object.position.z
    );
  }
  core.cameraLight.target.updateMatrixWorld();
  core.objectsConfig.setupIndex++;
};

async function setupEmptyCamera(_object) {
  console.log("Setting up empty camera");
  var boundingBox = new THREE.Box3();
  if (Array.isArray(_object)) {
    for (let i = 0; i < _object.length; i++) {
      const box = new THREE.Box3().setFromObject(_object[i], true);
      boundingBox.union(box);
    }
  } else {
    boundingBox.setFromObject(_object, true);
  }
  var size = new THREE.Vector3();
  boundingBox.getSize(size);
  var center = new THREE.Vector3();
  boundingBox.getCenter(center);
  // Set camera position at the center level, behind the model
  const distance = size.length();
  core.camera.position.set(center.x, center.y, center.z + distance);
  await fitCameraToCenteredObject(_object, true);
}

function parseColor(v) {
  if (Array.isArray(v)) {
    const [r, g, b, a = 1] = v;
    return { r, g, b, a };
  }

  if (typeof v === "string") {
    return parseCssColor(v); // #hex / rgb / rgba
  }

  return null;
}

function parseGradientArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;

  // [r, g, b] → single color
  if (
    arr.length === 3 &&
    arr.every(v => typeof v === "number")
  ) {
    return {
      type: "linear",
      colors: [ { r: arr[0], g: arr[1], b: arr[2], a: 1 } ]
    };
  }

  // list of colors
  const colors = arr
    .map(parseColor)
    .filter(Boolean);

  if (colors.length < 2) return null;

  return {
    type: "linear",
    colors
  };
}

function resolveBackground(meta, sceneId) {
  const raw =
    meta.scenes?.[sceneId]?.background ??
    meta.scene?.background ??
    meta.globals?.background ??
    null;

  if (!raw) return { kind: "default" };

  // object + array of colors
  if (typeof raw === "object" && Array.isArray(raw.value)) {
    const gradient = parseGradientArray(raw.value);
    if (gradient) {
      const normalizedGradient = normalizeGradient(gradient);
      return { kind: "gradient", normalizedGradient };
    }
  }

  // css string
  if (typeof raw === "string") {
    const gradient = parseGradient(raw);
    if (gradient) {
      const normalizedGradient = normalizeGradient(gradient);
      return { kind: "gradient", normalizedGradient };
    }
    return { kind: "color", color: raw };
  }

  return { kind: "default" };
}

async function setupCamera(_object, _data) {
  const _light = core.lightObjects[0];
  const cfg = _data ?? core.CONFIG ?? null;
  const fallback = _data ?? core.objectsConfig ?? null;

  // --- CAMERA POSITION ---
  const camPos = cfg?.cameraPosition ?? fallback?.camera?.position;

  if (Array.isArray(camPos)) {
    core.camera.position.set(camPos[0], camPos[1], camPos[2]);
  } else if (camPos && typeof camPos === "object") {
    core.camera.position.set(camPos.x, camPos.y, camPos.z);
  } else {
    await setupEmptyCamera(_object);
  }

  // --- CONTROLS TARGET + ZOOM ---
  const target = cfg?.controlsTarget ?? fallback?.camera?.target;

  if (Array.isArray(target)) {
    core.controls.target.set(target[0], target[1], target[2]);
  } else if (target) {
    core.controls?.target.set(target.x, target.y, target.z);
  }

  const customZoom = cfg?.controlsZoom?.[0];

  if (typeof customZoom === "number" && customZoom !== 0) {
    const dir = new THREE.Vector3()
    .subVectors(core.camera.position, core.controls?.target || new THREE.Vector3())
    .normalize();


    core.camera.position
    .copy(core.controls?.target || new THREE.Vector3())
    .add(dir.multiplyScalar(customZoom));
  }

  // --- LIGHTS ---
  if (!cfg && fallback?.scene?.lights) {
    fallback.scene.lights.forEach(light => {
      switch (light.type) {
        case "directional":
        _light.position.set(light.position.x, light.position.y, light.position.z);
        _light.color = new THREE.Color(normalizeColor(light.color));
        _light.intensity = light.intensity;
        break;
        case "ambient":
        core.ambientLight.color = new THREE.Color(normalizeColor(light.color));
        core.ambientLight.intensity = light.intensity;
        break;
        case "point":
        core.cameraLight.color = new THREE.Color(normalizeColor(light.color));
        core.cameraLight.intensity = light.intensity;
        break;
      }
    });
  } 
  else if (cfg) {
    if (cfg.lightAmbientColor) {
      core.ambientLight.color = new THREE.Color(normalizeColor(cfg.lightAmbientColor[0]));
      core.ambientLight.intensity = cfg.lightAmbientIntensity?.[0] ?? core.ambientLight.intensity;
    }

    if (cfg.lightColor) {
      _light.color = new THREE.Color(normalizeColor(cfg.lightColor[0]));
      _light.intensity = cfg.lightIntensity?.[0] ?? _light.intensity;
    }

    if (cfg.lightCameraColor) {
      core.cameraLight.color = new THREE.Color(normalizeColor(cfg.lightCameraColor[0]));
      core.cameraLight.intensity = cfg.lightCameraIntensity?.[0] ?? core.cameraLight.intensity;
    }
  }

  // --- BACKGROUND ---
  //const sceneBg = fallback?.scene?.background;

  if (!core.PRESENTATION_MODE) {
    const bg = resolveBackground(fallback, core.activeScene);

    switch (bg.kind) {
      case "gradient":
      case "radial":
        applyGradientCss(bg.normalizedGradient);
        break;

      case "color":
      case "linear":
        changeBackground("linear", bg.color);
        break;

      case "default":
      case "unknown":
        changeBackground(
          "radial",
          core.colors.BackgroundColor,
          core.colors.BackgroundColorOuter
        );
        break;
    }
  } else {
    const grandient = {type: "radial", colors: [{r: 255, g: 255, b: 255, a: 0}, {r: 255, g: 255, b: 255, a: 0}]};
    applyGradientCss(grandient);
  }

  core.camera.updateProjectionMatrix();
  core.controls?.update();
  fitCameraToCenteredObject(_object, false);
}

  // Show interaction hint on first load
  function showInteractionHint(boxCenter) {
  if (window.__E2E__) return;
  //if (localStorage.getItem("viewerHintSeen")) return;

  if (core.GESTURE == null) return;
  core.GESTURE.rotate = true;

  core.GESTURE.target = boxCenter.clone();
  core.controls.target.copy(core.GESTURE.target);

  if (core.handHint == null) return;
  core.handHint.hidden = false;
  core.handHint.classList.add("hand-drag-animate");
}

function animateCameraToPose ({
  finalCameraPos,     // THREE.Vector3 (target camera position)
  finalTarget,        // THREE.Vector3 (target)
  boundingBox,        // THREE.Box3 (optional, near/far)
  duration = 3500,
  easing = exports$1.Easing.Cubic.Out,
  startOffsetFactor = 0.5, // % of moving back (0.2–0.4 should be good)
  animate = true,
  distanceOffsetFactor = 0,   // additional factor to move closer (0.1 = 10% closer) (optional)
  distanceOffsetUnits  = 0,   // additional world units to move closer (optional)
}) {

  const endCamPos = finalCameraPos.clone();
  const endTarget = finalTarget.clone();

  const dir = endCamPos.clone().sub(endTarget).normalize();

  const baseDistance = endCamPos.distanceTo(endTarget);

  const distanceOffset =
    baseDistance * distanceOffsetFactor + distanceOffsetUnits;

  const startCamPos = endCamPos.clone().add(
    dir.multiplyScalar(
      baseDistance * startOffsetFactor + distanceOffset
    )
  );
  const startTarget = endTarget.clone(); // target

  if (!animate) {
    core.camera.position.copy(endCamPos);
    core.controls?.target.copy(endTarget);
    core.controls?.update();
    return;
  }

  core.camera.position.copy(startCamPos);
  core.controls?.target.copy(startTarget);
  core.controls?.update();

  const camTweenPos = startCamPos.clone();
  const targetTweenPos = startTarget.clone();

  core.cameraTween = new exports$1.Tween(camTweenPos)
    .to(endCamPos, duration)
    .easing(easing)
    .onUpdate(() => {
      core.camera.position.copy(camTweenPos);
    });

  core.targetTween = new exports$1.Tween(targetTweenPos)
    .to(endTarget, duration)
    .easing(easing)
    .onUpdate(() => {
      core.controls?.target.copy(targetTweenPos);
      core.controls?.update();
    });

  core.cameraTween.start();
  core.targetTween.start();

  // === (near / far / limits) ===
  core.cameraTween.onComplete(() => {
    core.camera.position.copy(endCamPos);
    core.controls?.target.copy(endTarget);
    core.controls?.update();
    const boxCenter = boundingBox ? boundingBox.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    if (boundingBox) {
      const boxSize = boundingBox.getSize(new THREE.Vector3()).length();

      const maxDistance =
        endCamPos.distanceTo(boxCenter) + boxSize;

      core.camera.near = Math.max(maxDistance / 1000, 0.001);
      core.camera.far  = maxDistance * 10;
      core.camera.updateProjectionMatrix();

      if (core.controls) {
        core.controls.maxDistance = maxDistance * 2;
      }
    }
    showInteractionHint(boxCenter);
  });
}

async function fitCameraToCenteredObject(object, _fit) {
  const boundingBox = new THREE.Box3();
  if (Array.isArray(object)) {
    for (let i = 0; i < object.length; i++) {
      const box = new THREE.Box3().setFromObject(object[i], true);
      boundingBox.union(box);
    }
  } else {
    boundingBox.setFromObject(object, true);
  }

  var size = new THREE.Vector3(), center = new THREE.Vector3();
  boundingBox.getSize(size);
  boundingBox.getCenter(center); // center point
  // ground
  var distance1 = new THREE.Vector3(
    Math.abs(boundingBox.max.x - boundingBox.min.x),
    Math.abs(boundingBox.max.y - boundingBox.min.y),
    Math.abs(boundingBox.max.z - boundingBox.min.z)
  );
  core.gridSize = Math.max(distance1.x, distance1.y, distance1.z);

  core.dirLightTarget = new THREE.Object3D();
  core.dirLightTarget.position.set(0, 0, 0);

  core.lightHelper = new THREE.DirectionalLightHelper(core.dirLight, core.gridSize);
  core.scene.add(core.lightHelper);
  core.lightHelper.visible = false;

  core.scene.add(core.dirLightTarget);
  core.dirLight.target = core.dirLightTarget;
  core.dirLight.target.updateMatrixWorld();

  var gridSizeScale = core.gridSize * 2.5;
  if (core.basicGrid !== undefined) core.scene.remove(core.basicGrid);
  core.basicGrid = new THREE.Group();
  var planeMaterial = new THREE.ShadowMaterial({ opacity: 0.35 });

  var planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(gridSizeScale, gridSizeScale), planeMaterial);

  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.set(0, 0, 0);
  planeMesh.receiveShadow = true;
  core.basicGrid.add(planeMesh);

  core.axesHelper = new THREE.AxesHelper(core.gridSize);
  core.axesHelper.position.set(0, 0, 0);
  core.axesHelper.visible = false;
  core.basicGrid.add(core.axesHelper);

  const grid = new THREE.GridHelper(gridSizeScale, 25, 0xaeaeae, 0x000000);
  grid.material.opacity = 0.05;
  grid.material.transparent = true;
  grid.position.set(0, 0, 0);
  core.basicGrid.add(grid);

  core.scene.add(core.basicGrid);
 
  // === fit camera distance ===
  const halfHeight = size.y / 2;
  const halfWidth  = size.x / 2;

  const fitHeightDistance =
    halfHeight / Math.tan(THREE.MathUtils.degToRad(core.camera.fov / 2));

  const fitWidthDistance =
    halfWidth /
    Math.tan(THREE.MathUtils.degToRad(core.camera.fov / 2)) /
    core.camera.aspect;

  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.95;

  // === target position ===
  const dir = new THREE.Vector3(0.5, -0.25, -1).normalize(); // 45-degree angle perspective
  dir.multiplyScalar(-distance);

  const finalCameraPos = center.clone().add(dir);
  const finalTarget = center.clone();

  // Store reset position for "Reset camera" action
  core.cameraCoords = finalCameraPos.clone();
  core.controlsTarget = finalTarget.clone();

  // === animate ===
  animateCameraToPose({
    finalCameraPos,
    finalTarget,
    boundingBox,
    duration: 3500,
    startOffsetFactor: 0.15,
    distanceOffsetFactor: -0.5, // 0.1 = 10% closer
    distanceOffsetUnits: 0, // +0.5 world units
  });

  if (_fit) {
    var rotateMetadata = new THREE.Vector3();
    rotateMetadata = new THREE.Vector3(
      THREE.MathUtils.radToDeg(core.helperObjects[0]?.rotation.x || 1),
      THREE.MathUtils.radToDeg(core.helperObjects[0]?.rotation.y || 5),
      THREE.MathUtils.radToDeg(core.helperObjects[0]?.rotation.z || 1)
    );
    const rootObject = Array.isArray(object) ? object[0] : object;
    core.objectsConfig.originalMetadata = {
      objPosition: [rootObject?.position?.x || 0, rootObject?.position?.y || 0, rootObject?.position?.z || 0],
      objRotation: [rotateMetadata.x, rotateMetadata.y, rotateMetadata.z],
      objScale: [
        core.helperObjects[0]?.scale.x || 1,
        core.helperObjects[0]?.scale.y || 5,
        core.helperObjects[0]?.scale.z || 1,
      ],
      cameraPosition: [core.camera.position.x, core.camera.position.y, core.camera.position.z],
      controlsTarget: [core.controls.target.x, core.controls.target.y, core.controls.target.z],
    };
  }
  if (!core.PRESENTATION_MODE) {
    setupClippingPlanes(object, {x: boundingBox.max.x*1.1, y: boundingBox.max.y*1.1, z: boundingBox.max.z*1.1});
  }
}

function parseGradient(str) {
  if (!str || typeof str !== "string") return null;

  // Match "radial-gradient" or "linear-gradient"
  const typeMatch = str.match(/(radial|linear)-gradient\s*\(([^,]+)/i);
  const gradientType = typeMatch ? typeMatch[1].toLowerCase() : null;
  const shapeOrDirection = typeMatch ? typeMatch[2].trim() : null;

  const colors = [];

  /* ==========================
     RGB / RGBA
  ========================== */
  const rgbMatches = str.matchAll(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/gi
  );

  for (const [, r, g, b, a] of rgbMatches) {
    colors.push({
      r: +r,
      g: +g,
      b: +b,
      a: a !== undefined ? +a : 1,
    });
  }

  /* ==========================
     HEX (#RGB / #RRGGBB)
  ========================== */
  const hexMatches = str.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})/gi);

  for (const [, hex] of hexMatches) {
    const fullHex =
      hex.length === 3
        ? hex.split("").map(c => c + c).join("")
        : hex;

    colors.push({
      r: parseInt(fullHex.slice(0, 2), 16),
      g: parseInt(fullHex.slice(2, 4), 16),
      b: parseInt(fullHex.slice(4, 6), 16),
      a: 1,
    });
  }

  return {
    type: gradientType,        // "radial" | "linear"
    shapeOrDirection,          // "circle", "to right", etc.
    colors,                    // [{ r, g, b, a }]
  };
}

function rgbaToCss(c) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function changeBackgroundHelper(_color1, _color2, _alpha = 100) {
  core.mainCanvas.style.setProperty(
    "background",
    `radial-gradient(circle, ${_color1} 0%, ${_color2} ${_alpha}%)`
  );
}

function applyGradientCss(gradient) {
  if (!gradient || !Array.isArray(gradient.colors) || gradient.colors.length === 0) {
    return;
  }

  const colors = gradient.colors;

  // 1 color → solid background
  if (colors.length === 1) {
    const c = rgbaToCss(colors[0]);
    changeBackground("linear", c);
    return;
  }

  // 2 colors → legacy helper
  if (colors.length === 2) {
    const c1 = rgbaToCss(colors[0]);
    const c2 = rgbaToCss(colors[1]);
    changeBackground(gradient.type, c1, c2);
    return;
  }

  // >= 3 stops → full CSS gradient
  const stops = colors.map((c, i) => {
    const t = Math.round((i / (colors.length - 1)) * 100);
    return `${rgbaToCss(c)} ${t}%`;
  });

  const css =
    gradient.type === "radial"
      ? `radial-gradient(circle, ${stops.join(", ")})`
      : `linear-gradient(to bottom, ${stops.join(", ")})`;

  core.mainCanvas.style.setProperty("background", css);
}

function changeBackground(_type, _color1, _color2 = _color1, _alpha = 100) {
  switch (_type) {
    case "linear":
      changeBackgroundHelper(_color1, _color1, _alpha);
      break;
    case "gradient":
    case "radial":
      changeBackgroundHelper(_color1, _color2, _alpha);
      break;
  }
}

function setupClippingPlanes(_geom, _distance) {
  /*var _geometry;
  if (_geom.isGroup)
    _geometry = _geom.children;
  else
    _geometry = _geom.geometry.clone();*/
  core.clippingPlanes[0].constant = _distance.x;
  core.clippingPlanes[1].constant = _distance.y;
  core.clippingPlanes[2].constant = _distance.z;
  let clippingCenterY = 0;
  if (_geom) {
    const bounds = new THREE.Box3();
    if (Array.isArray(_geom)) {
      for (let i = 0; i < _geom.length; i++) {
        bounds.union(new THREE.Box3().setFromObject(_geom[i], true));
      }
    } else {
      bounds.setFromObject(_geom, true);
    }
    if (!bounds.isEmpty()) {
      clippingCenterY = bounds.getCenter(new THREE.Vector3()).y;
    }
  }
  const updatePlaneHelperPosition = (index, constantValue) => {
    const helper = core.planeHelpers?.[index];
    const plane = core.clippingPlanes?.[index];
    if (!helper || !plane) return;
    helper.position.copy(plane.normal).multiplyScalar(-constantValue);
  };
  if (core.EDITOR) {

  if (core.transformControlClippingPlaneX && core.transformControlClippingPlaneY && core.transformControlClippingPlaneZ) {
    core.scene.add(core.transformControlClippingPlaneX?.getHelper());
    core.scene.add(core.transformControlClippingPlaneY?.getHelper());
    core.scene.add(core.transformControlClippingPlaneZ?.getHelper());
  }

  let planeColor = new THREE.Color(0xffffff).getHexString();
  if (core.scene.background != null) planeColor = core.scene.background.getHexString();

  core.planeHelpers = core.clippingPlanes.map(
    (p) => new THREE.PlaneHelper(p, core.gridSize * 2, invertHexColor(planeColor))
  );
  core.planeHelpers.forEach((ph, index) => {
    ph.visible = false;
    ph.name = "PlaneHelper";
    updatePlaneHelperPosition(index, core.clippingPlanes[index].constant);
    if (index === 0 || index === 2) {
      ph.userData.clippingCenterY = clippingCenterY;
      const baseUpdateMatrixWorld = ph.updateMatrixWorld.bind(ph);
      ph.updateMatrixWorld = function updatePlaneHelperMatrix(force) {
        baseUpdateMatrixWorld(force);
        this.position.y = this.userData.clippingCenterY || 0;
        this.updateMatrix();
        if (this.parent) {
          this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        } else {
          this.matrixWorld.copy(this.matrix);
        }
        for (let i = 0; i < this.children.length; i++) {
          this.children[i].updateMatrixWorld(true);
        }
      };
      core.scene.add(ph);
    } else {
      core.scene.add(ph);
    }
  });

  core.distanceGeometry = _distance;
  scaleXYZ(core.distanceGeometry, 2);
  const showClippingPlaneToast = (axisLabel, enabled) => {
    toastHelper$1("clippingHelperToggle", "info", {
      axis: axisLabel,
      state: enabled
    });
  };
  const refreshClippingHint = () => {
    const update = core.updateClippingHintVisibility;
    if (typeof update === "function") {
      update();
      return;
    }
    if (!core.clippingHint || !core.planeParams?.clippingMode) return;
    const mode = core.planeParams.clippingMode;
    core.clippingHint.hidden = !(mode.x || mode.y || mode.z);
  };
  const tr = (key, fallback) => window?.Viewer?.t?.(key, fallback) ?? fallback;
  let displayHelper = {x: getOrAddGuiController(core.planeParams.planeX, "displayHelperX"), constantX: getOrAddGuiController(core.planeParams.planeX, "constantX"), y: getOrAddGuiController(core.planeParams.planeY, "displayHelperY"), constantY: getOrAddGuiController(core.planeParams.planeY, "constantY"), z: getOrAddGuiController(core.planeParams.planeZ, "displayHelperZ"), constantZ: getOrAddGuiController(core.planeParams.planeZ, "constantZ"), outline: getOrAddGuiController(core.planeParams.outline, "visible")};
  displayHelper.x?.name?.(tr("gui.displayHelperX", "Show X helper"));
  displayHelper.constantX?.name?.(tr("gui.constantX", "Constant X"));
  displayHelper.y?.name?.(tr("gui.displayHelperY", "Show Y helper"));
  displayHelper.constantY?.name?.(tr("gui.constantY", "Constant Y"));
  displayHelper.z?.name?.(tr("gui.displayHelperZ", "Show Z helper"));
  displayHelper.constantZ?.name?.(tr("gui.constantZ", "Constant Z"));
  displayHelper.outline?.name?.(tr("gui.visible", "Visible"));
  displayHelper.x?.onChange((v) => {
      core.planeParams.clippingMode.x = core.planeHelpers[0].visible = v;
      if (v) {
        core.transformControlClippingPlaneX.attach(core.planeHelpers[0]);
        if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
      } else {
        core.transformControlClippingPlaneX.detach();
        if (
          !core.planeParams.clippingMode.y &&
          !core.planeParams.clippingMode.z &&
          !core.planeParams.outline.visible
        )
          core.outlineClipping.visible = false;
      }
      showClippingPlaneToast("X", v);
      refreshClippingHint();
    });

    displayHelper?.constantX.min(-core.distanceGeometry.x)
      .max(core.distanceGeometry.x)
      .setValue(core.distanceGeometry.x)
      .step(core.gridSize / 100)
      .listen()
      .onChange((d) => {
        core.clippingPlanes[0].constant = d;
        updatePlaneHelperPosition(0, d);
      });

    displayHelper.y?.onChange((v) => {
      core.planeParams.clippingMode.y = core.planeHelpers[1].visible = v;
      if (v) {
        core.transformControlClippingPlaneY.attach(core.planeHelpers[1]);
        if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
      } else {
        core.transformControlClippingPlaneY.detach();
        if (
          !core.planeParams.clippingMode.x &&
          !core.planeParams.clippingMode.z &&
          !core.planeParams.outline.visible
        )
          core.outlineClipping.visible = false;
      }
      showClippingPlaneToast("Y", v);
      refreshClippingHint();
    });
    displayHelper?.constantY
      .min(-core.distanceGeometry.y)
      .max(core.distanceGeometry.y)
      .setValue(core.distanceGeometry.y)
      .step(core.gridSize / 100)
      .listen()
      .onChange((d) => {
        core.clippingPlanes[1].constant = d;
        updatePlaneHelperPosition(1, d);
      });
  
    displayHelper.z?.onChange((v) => {
      core.planeParams.clippingMode.z = core.planeHelpers[2].visible = v;
      if (v) {
        core.transformControlClippingPlaneZ.attach(core.planeHelpers[2]);
        if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
      } else {
        core.transformControlClippingPlaneZ.detach();
        if (
          !core.planeParams.clippingMode.x &&
          !core.planeParams.clippingMode.y &&
          !core.planeParams.outline.visible
        )
          core.outlineClipping.visible = false;
      }
      showClippingPlaneToast("Z", v);
      refreshClippingHint();
    });
    displayHelper?.constantZ
      .min(-core.distanceGeometry.z)
      .max(core.distanceGeometry.z)
      .setValue(core.distanceGeometry.z)
      .step(core.gridSize / 100)
      .listen()
      .onChange((d) => {
        core.clippingPlanes[2].constant = d;
        updatePlaneHelperPosition(2, d);
      });

    displayHelper.outline.onChange((v) => {
      core.outlineClipping.visible = v;
    });
    refreshClippingHint();
  }
}


// Color helpers
function invertHexColor(hexTripletColor) {
  let color = hexTripletColor.substring(1);
  color = parseInt(color, 16);
  color = 0xffffff ^ color;
  color = color.toString(16);
  color = ("000000" + color).slice(-6);
  return "#" + color;
}

function getOrAddGuiController(object, prop) {
  const findController = (folder) => {
    if (!folder) return null;
    const controller = folder.controllers?.find(c => c._name === prop || c.property === prop);
    if (controller) return controller;

    for (const subfolder of folder.folders || []) {
      const found = findController(subfolder);
      if (found) return found;
    }
    return null;
  };

  let controller = findController(core.clippingFolder);
  if (controller) return controller;

  return core.clippingFolder.add(object, prop);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMetadataRow(label, value) {
  if (!label || typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  return (
    '<div class="metadata-row">' +
      '<span class="metadata-label">' + escapeHtml(label) + ':</span>' +
      '<span class="metadata-value">' + escapeHtml(value) + '</span>' +
    '</div>'
  );
}

/**
 * Formats WissKI metadata labels and values for display.
 */
function addWissKIMetadata(label, value) {
  if (typeof label !== "undefined" && typeof value !== "undefined") {
    var _str = "";
    label = label.replace("wisski_path_3d_model__", "");
    switch (label) {
      case "title":
        _str = t$1("metadata.title", "Title");
        break;
      case "author_name":
        _str = t$1("metadata.author", "Author");
        break;
      case "author_affiliation":
        _str = t$1("metadata.authorAffiliation", "Author affiliation");
        break;
      case "license":
        _str = t$1("metadata.license", "License");
        break;
      case "description":
        _str = t$1("metadata.description", "Description");
        break;
      case "object_type":
        _str = t$1("metadata.objectType", "Object type");
        break;
      case "reconstruction_authors":
        _str = t$1("metadata.reconstructionAuthors", "Reconstruction authors");
        break;
      case "reconstruction_period":
        _str = t$1("metadata.reconstructionPeriod", "Reconstruction period");
        break;
      default:
        _str = "";
        break;
    }

    if (_str !== "") {
      return buildMetadataRow(_str, value);
    }
  }
}

function lilGUIhasFolder(folder, name) {
  return folder.folders.some(f => f._title === name);
}

function lilGUIgetFolder(gui, name) {
  return gui?.folders?.find(f => f._title === name) || null;
}

/**
 * Expands/collapses the metadata panel.
 */
function expandMetadata() {
  const content = document.getElementById("metadata-content");
  const toggle = document.getElementById("metadata-collapse");
  const card = document.getElementById("metadata-card");

  if (!content || !toggle) return;

  const expanded = content.classList.toggle("expanded");
  toggle.classList.toggle("metadata-collapsed", !expanded);
  card?.classList.toggle("metadata-open", expanded);

  // accessibility
  toggle.setAttribute("aria-expanded", expanded);

  if (!expanded) {
    card?.classList.remove("metadata-card-overflowing");
    content.querySelectorAll(".metadata-row-pinned").forEach((row) => {
      row.classList.remove("metadata-row-pinned");
    });
    return;
  }

  updateMetadataOverflow();
}

function updateMetadataOverflow() {
  const content = document.getElementById("metadata-content");
  const card = document.getElementById("metadata-card");

  if (!content || !card || !content.classList.contains("expanded")) return;

  const hasOverflow = content.scrollHeight - content.clientHeight > 8;
  card.classList.toggle("metadata-card-overflowing", hasOverflow);

  content.querySelectorAll(".metadata-row").forEach((row) => {
    const value = row.querySelector(".metadata-value");
    if (!value) return;

    const wasPinned = row.classList.contains("metadata-row-pinned");
    row.classList.remove("metadata-row-pinned", "metadata-row-expandable");

    const isExpandable = value.scrollHeight - value.clientHeight > 4;
    row.classList.toggle("metadata-row-expandable", isExpandable);

    if (wasPinned && isExpandable) {
      row.classList.add("metadata-row-pinned");
    }
  });
}

function bindMetadataInteractions() {
  if (core.metadataContainer.dataset.boundCollapse === "true") return;

  core.metadataContainer.addEventListener("click", (e) => {
    const toggle = e.target.closest("#metadata-collapse");
    if (toggle) {
      expandMetadata();
      return;
    }

    const card = document.getElementById("metadata-card");
    const content = document.getElementById("metadata-content");
    if (!card || !content || !content.classList.contains("expanded")) return;

    const row = e.target.closest(".metadata-row");
    if (!row) return;

    const willPin = !row.classList.contains("metadata-row-pinned");
    content.querySelectorAll(".metadata-row-pinned").forEach((pinnedRow) => {
      pinnedRow.classList.remove("metadata-row-pinned");
    });
    if (willPin) row.classList.add("metadata-row-pinned");
  });

  window.addEventListener("resize", updateMetadataOverflow);
  core.metadataContainer.dataset.boundCollapse = "true";
}

/**
 * Appends metadata HTML to the DOM.
 */
function appendMetadata(
  metadataContent
) {
  core.metadataContainer.innerHTML = metadataContent;

  if (!core.container.contains(core.metadataContainer)) {
    core.container.appendChild(core.metadataContainer);
  }
}

async function fetchEntityMetadata() {
  if (!core.CONFIG.entity.metadata.sourceType || core.CONFIG.entity.metadata.url === "") {
    return "";
  }

  const metadataUrl = core.CONFIG.entity.metadata.url + encodeURIComponent(core.CONFIG.entity.id);

  try {
    const response = await fetch(metadataUrl, { cache: "no-cache" });

    if (!response.ok) {
      console.warn("Metadata request failed with status:", response.status);
      return "";
    }

    const responseText = await response.text();

    try {
      const jsonData = JSON.parse(responseText);
      const record = Array.isArray(jsonData) ? jsonData[0] : jsonData;

      if (!record || typeof record !== "object") {
        return "";
      }

      console.log("Processing JSON metadata:", record);

      const jsonFieldMap = {
        title: "title",
        reconstruction_authors: "author_name",
        reconstruction_authors_affiliation: "author_affiliation",
        reconstruction_license: "license",
        reconstruction_time_frame: "reconstruction_period",
        object_description: "description",
        object_type: "object_type",
      };

      let entityMetadataContent = "";
      for (const [jsonField, metadataLabel] of Object.entries(jsonFieldMap)) {
        if (record[jsonField]) {
          const fetchedValue = addWissKIMetadata(metadataLabel, record[jsonField]);
          if (typeof fetchedValue !== "undefined") {
            entityMetadataContent += fetchedValue;
          }
        }
      }

      return entityMetadataContent;
    } catch (_jsonError) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(responseText, "application/xml");

      if (doc.documentElement.tagName === "parsererror") {
        console.error("XML parsing error:", doc.documentElement.textContent);
        return "";
      }

      let entityMetadataContent = "";
      if (doc.documentElement.childNodes.length > 0) {
        var data = doc.documentElement.childNodes[0].childNodes;
        if (data !== undefined) {
          for (var i = 0; i < data.length; i++) {
            var fetchedValue = addWissKIMetadata(data[i].tagName, data[i].textContent);
            if (typeof fetchedValue !== "undefined") {
              entityMetadataContent += fetchedValue;
            }
          }
        }
      }

      return entityMetadataContent;
    }
  } catch (error) {
    console.error("Error processing metadata:", error);
    return "";
  }
}

function fetchMetadata(_object, _type) {
  if (!_object?.geometry) return 0;

  const indexedCount = _object.geometry.index?.count;
  const positionCount = _object.geometry.attributes?.position?.count ?? 0;

  switch (_type) {
    case "vertices":
      return positionCount;
    case "faces":
      return (indexedCount ?? positionCount) / 3;
    default:
      return 0;
  }
}
/**
 * Handles metadata response and builds the metadata UI.
 */
async function handleMetadataResponse(
  data,
  metadata,
  object,
  hierarchyMain,
) {
  const hierarchyLabel = t$1("gui.hierarchy", "Hierarchy");
  const hasHierarchyFolder = () =>
    lilGUIgetFolder(core.gui, "Hierarchy") !== null ||
    lilGUIgetFolder(core.gui, hierarchyLabel) !== null;
  var tempArray = [];
  let hierarchyFolder;
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh") {
    setupObject(object, data);
    object.traverse(function (child) {
      if (child.isMesh) {
        metadata["vertices"] += fetchMetadata(child, "vertices");
        metadata["faces"] += fetchMetadata(child, "faces");
        if (child.name === "") child.name = "Mesh";
        var shortChildName = truncateString(child.name, 35);
        tempArray = {
          [shortChildName]() {
           core.selectObjectHierarchy(child.id, core.container);
          },
          id: child.id,
        };
        if (typeof hierarchyMain !== "undefined" && hasHierarchyFolder() && !lilGUIhasFolder(hierarchyMain, shortChildName)) {
          hierarchyFolder = hierarchyMain.addFolder(shortChildName).close();
          hierarchyFolder.add(tempArray, shortChildName);
          child.traverse(function (children) {
            if (children.isMesh && children.name !== child.name) {
              if (children.name === "") children.name = "ChildrenMesh";
              var shortChildrenName = truncateString(children.name, 35);
              tempArray = {
                [shortChildrenName]() {
                  core.selectObjectHierarchy(children.id, core.container);
                },
                id: children.id,
              };
              hierarchyFolder.add(tempArray, shortChildrenName);
            }
          });
        }
      }
    });
    await setupCamera(object, data);
  } else {
    setupObject(object, data);
    await setupCamera(object, data);
    metadata["vertices"] += fetchMetadata(object, "vertices");
    metadata["faces"] += fetchMetadata(object, "faces");
    if (object.name === "") {
      tempArray = {
        ["Mesh"]() {
          core.selectObjectHierarchy(object.id, core.container);
        },
        id: object.id,
      };
      object.name = object.id;
    } else {
      tempArray = {
        [object.name]() {
          core.selectObjectHierarchy(object.id, core.container);
        },
        id: object.id,
      };
    }
    if (hierarchyMain && hasHierarchyFolder() && !lilGUIhasFolder(hierarchyMain, object.name)) {
      hierarchyFolder = hierarchyMain.addFolder(object.name).close();
    }
  }

  if (typeof hierarchyMain !== "undefined") {
    hierarchyMain.domElement.classList.add("hierarchy");
  }

  if (!core.metadataContainer) {
    core.metadataContainer = document.createElement("div");
    core.metadataContainer.id = "metadata-container";
  }
  core.metadataContainer.setAttribute("data-viewer-theme", core.container?.closest(".viewer-wrapper")?.getAttribute("data-viewer-theme") || "dark");

  var metadataContent =
    '<div id="metadata-card">' +
      '<button id="metadata-collapse" class="metadata-collapse metadata-collapsed" type="button" aria-expanded="false" aria-controls="metadata-content">' +
        '<span class="metadata-toggle-icon" aria-hidden="true"></span>' +
        '<span class="metadata-toggle-copy">' +
          '<span class="metadata-toggle-eyebrow" data-i18n-key="metadata.modelDetails">' + escapeHtml(t$1("metadata.modelDetails", "Model details")) + '</span>' +
          '<span class="metadata-toggle-title" data-i18n-key="metadata.metadata">' + escapeHtml(t$1("metadata.metadata", "Metadata")) + '</span>' +
        '</span>' +
        '<span class="metadata-toggle-chevron" aria-hidden="true"></span>' +
      '</button>' +
      '<div id="metadata-content" class="metadata-content">';
  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label" data-i18n-key="metadata.visualizedFile">' + escapeHtml(t$1("metadata.visualizedFile", "Visualized file")) + ':</span>' +
      '<span class="metadata-value">' +
        escapeHtml(core.fileObject.basename) + '.' + escapeHtml(core.fileObject.extension) +
      '</span>' +
    '</div>';

  metadataContent += '<div class="metadataSeparator"></div>';

  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label" data-i18n-key="metadata.vertices">' + escapeHtml(t$1("metadata.vertices", "Vertices")) + ':</span>' +
      '<span class="metadata-value">' + metadata["vertices"] + '</span>' +
    '</div>';

  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label" data-i18n-key="metadata.faces">' + escapeHtml(t$1("metadata.faces", "Faces")) + ':</span>' +
      '<span class="metadata-value">' + metadata["faces"] + '</span>' +
    '</div>';
  metadataContent += await fetchEntityMetadata();

  if (core.downloadModel) {
    core.downloadModel.hidden = true;
    core.downloadModel.removeAttribute("href");
  }

  if (core.viewEntity) {
    core.viewEntity.hidden = true;
    core.viewEntity.removeAttribute("data-embed-url");
  }

  if (!core.isLightweight && core.downloadModel) {
    const c_path = core.fileObject.path;
    if (core.loadedFile !== "") {
      core.fileObject.filename = core.fileObject.filename.replace(core.fileObject.orgExtension, core.fileObject.extension);
    }

    core.downloadModel.href = `blob:${encodeURI(c_path + core.fileObject.filename)}`;
    core.downloadModel.setAttribute("download", core.fileObject.filename);
    core.downloadModel.hidden = false;
    window.Viewer?.updateDownloadMenuEntryLabel?.();
  }

  if (core.viewEntity && (core.CONFIG?.entity?.id || core.fileObject?.originalPath)) {
    const sharePayload = window.Viewer?.getSharePayload?.();
    if (sharePayload?.url) {
      core.viewEntity.setAttribute("data-embed-url", sharePayload.url);
    }
    window.Viewer?.updateEmbedMenuEntryState?.();
    core.viewEntity.hidden = false;
  }
  metadataContent +=
      '</div>' +  // #metadata-content
    '</div>';  
  appendMetadata(metadataContent);
  bindMetadataInteractions();
  requestAnimationFrame(updateMetadataOverflow);
}

/**
 * Handles settings for the loaded object and camera.
 */
async function settingsHandler(object, hierarchyMain, data) {
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0) {
    setupObject(object, data);
    await setupCamera(object, data);
  } else {
    setupObject(object, data);
    await setupCamera(object, data);
    if (object.name === "undefined") object.name = "level";
    if (hierarchyMain && !lilGUIhasFolder(hierarchyMain, object.name)) {
      hierarchyMain.addFolder(object.name).close();
    }
  }
}

async function loadMetadataData(metadataUrl) {
  // proxy / non-lightweight
  if (core.CONFIG.entity.proxyPath !== undefined || metadataUrl === null || metadataUrl === '') {
    console.log("No metadata found due to proxy or null URL", core.CONFIG.entity.proxyPath);
    return null; // no data → proxy
  }

  try {
    if (core.isLocalPreview) {
      return null;
    }
    const response = await fetch(metadataUrl, { cache: "no-cache" });

    if (response.status === 404) {
      toastHelper("settingsNotFound", "info", {
        filename: core.fileObject.filename
      });
      return null;
    }

    toastHelper("settingsFound", "success", {
      filename: core.fileObject.filename
    });
    return response.json();
  } catch (error) {
    toastHelper("metadataFetchError", "error", {
      error: error.message
    });
    return null;
  }
}

async function traverseObject (object) {
  if (Array.isArray(object)) {
    // Keep relative transforms between parts; centering each element separately
    // collapses multi-part models into overlapping geometry.
    object.forEach((obj) => {
      obj.updateMatrixWorld(true);
    });
    await setupCamera(object, null);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh") {
    setupObject(object, null);
    await setupCamera(object, null);
  } else {
    setupObject(object, null);
    await setupCamera(object, null);
  }
}

async function presentationMode (object) {
  if (core.PRESENTATION_MODE) {
    traverseObject(object);
  } else { return; }
}

/**
 * Fetches settings and metadata for the loaded model.
 */
async function fetchSettings(object) {
  var metadata = { vertices: 0, faces: 0 };
  let metadataUrl = '';

  // Skip metadata fetch for blob URLs (drag & drop files)
  if (core.fileObject.filename.startsWith('blob:')) {
    console.log("Skipping metadata fetch for local file");
  } else if (core.CONFIG.metadataUrl && core.fileObject.uri && core.fileObject.filename) {
    metadataUrl = new URL(
      `${core.CONFIG.metadataUrl}/${core.fileObject.uri}metadata/${core.fileObject.filename}_viewer.json`
    ).href;
    console.log("Fetched metadata from:", metadataUrl);
  } else {
    console.warn("Metadata URL or file information is missing. Skipping metadata fetch.");
  }

  let hierarchyMain;
  const hierarchyLabel = t$1("gui.hierarchy", "Hierarchy");
  const existingHierarchy = lilGUIgetFolder(core.gui, "Hierarchy") || lilGUIgetFolder(core.gui, hierarchyLabel);
  if (existingHierarchy === null) {
    hierarchyMain = core.gui?.addFolder(hierarchyLabel).close();
    hierarchyMain?.domElement?.classList.add("viewer-gui-main-folder");
    hierarchyMain?.domElement?.setAttribute("data-gui-main-folder", "hierarchy");
  } else {
    hierarchyMain = existingHierarchy;
    if (typeof hierarchyMain.title === "function") {
      hierarchyMain.title(hierarchyLabel);
    }
    hierarchyMain?.domElement?.classList.add("viewer-gui-main-folder");
    hierarchyMain?.domElement?.setAttribute("data-gui-main-folder", "hierarchy");
  }
  core.i18nGui.hierarchyFolder = hierarchyMain;
  if (core.CONFIG.entity.metadata.sourceType === "IIIF") {
    console.log("Fetching IIIF metadata from ", core.objectsConfig);
    await handleMetadataResponse( core.CONFIG.model, metadata, object, hierarchyMain);
  }
  else if (metadataUrl) {
    console.log("Loading metadata from URL:", metadataUrl);
    if (core.CONFIG.entity.proxyPath !== undefined || core.isLightweight) {
      metadataUrl = core.getProxyPath(metadataUrl, core.CONFIG);
      const data = await loadMetadataData(metadataUrl);
      window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(data);
      await handleMetadataResponse(data, metadata, object, hierarchyMain);
      settingsHandler(object, hierarchyMain, core.CONFIG);
    } else {
      const data = await loadMetadataData(metadataUrl);
      window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(data);
      await handleMetadataResponse(data, metadata, object, hierarchyMain);
    }
  } else {
    window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(null);
    await handleMetadataResponse("", metadata, object, hierarchyMain);
  }
  // Add statistics GUI
  let statsMain;
  const statisticsLabel = t$1("gui.statistics", "Statistics");
  if (lilGUIgetFolder(core.gui, "Statistics") === null && lilGUIgetFolder(core.gui, statisticsLabel) === null) {
    statsMain = core.gui.addFolder(statisticsLabel).close();
    statsMain?.domElement?.classList.add("viewer-gui-main-folder");
    statsMain?.domElement?.setAttribute("data-gui-main-folder", "statistics");
    const performanceController = statsMain
    .add(core.CONFIG.viewer.performanceMode, "Performance", {
      [t$1("gui.highPerformance", "High-performance")]: "high-performance",
      [t$1("gui.lowPower", "Low-power")]: "low-power",
      [t$1("gui.default", "Default")]: "default",
    })
    .name(t$1("gui.performance", "Performance"))
    .onChange(function (value) {
      if (typeof core.renderer !== "undefined") core.renderer.powerPreference = value;
    });

    core.i18nGui.statisticsFolder = statsMain;
    core.i18nGui.performanceController = performanceController;

    statsMain.onOpenClose((changedGUI) => {
    if (changedGUI._closed) {
      if (typeof core.stats !== "undefined") core.stats.dom.style.visibility = "hidden";
    } else {
      if (typeof core.stats !== "undefined") core.stats.dom.style.visibility = "visible";
    }
    });
    if (typeof core.guiContainer !== "undefined" && typeof core.stats !== "undefined") {
      core.guiContainer.appendChild(core.stats.dom);
      core.stats.dom.style.left = (core.lilGui[0]?.getBoundingClientRect().width - core.stats.domElement.getBoundingClientRect().width + 10) + 'px';
    }
  }
}

function createIIIFDropdown(iiifConfigURL) {
  // list of candidate IIIF config URLs (add more as needed)
  const iiifList = [
    { url: iiifConfigURL.url, name: iiifConfigURL.name },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json", name: t$1("iiif.optionModelPositionScale", "Model Position and Scale") },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin.json", name: t$1("iiif.optionModelOrigin", "Model Origin") },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin_bgcolor.json", name: t$1("iiif.optionModelOriginBg", "Model Origin with background color") },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_position.json", name: t$1("iiif.optionModelPosition", "Model Position") },
  ].filter(Boolean);

  const group = document.createElement("div");
  group.className = "form-IIIF-group";

  const label = document.createElement("label");
  label.textContent = t$1("iiif.manifest", "IIIF manifest");
  label.className = "form-IIIF-label";

  const select = document.createElement("select");
  select.id = "iiif-manifest-select";
  select.name = "iiif-manifest-select";

  iiifList.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.url;
    opt.textContent = item.name;
    select.appendChild(opt);
  });

  group.appendChild(label);
  group.appendChild(select);

  // add on the top
  document.querySelector("#form-IIIF-content").prepend(group);

}

function createIIIFUI() {
  const formContainer = document.createElement("div");
  formContainer.id = "form-IIIF";

  /* header */
  const header = document.createElement("div");
  header.className = "form-IIIF-header";
  header.innerHTML = `
    <span class="title">${escapeHtml(t$1("iiif.loader", "IIIF Loader"))}</span>
    <div class="tools">
      <button type="button" id="iiif-toggle-collapse" title="${escapeHtml(t$1("iiif.collapse", "Collapse"))}">▾</button>
    </div>
  `;

  formContainer.appendChild(header);

  /* content */
  const content = document.createElement("div");
  content.className = "form-IIIF-content";
  content.id = "form-IIIF-content";
  content.innerHTML = `
    <div class="form-IIIF-group">
      <input type="text" id="manifest-url" placeholder="${escapeHtml(t$1("iiif.manifestUrlPlaceholder", "https://example.org/iiif/manifest.json"))}">
      <button class="primary" id="load-manifest-from-url">${escapeHtml(t$1("iiif.loadFromUrl", "Load from URL"))}</button>
    </div>

    <div class="form-IIIF-group column">
      <textarea id="manifest-text" rows="8" placeholder="${escapeHtml(t$1("iiif.manifestTextPlaceholder", "Paste IIIF manifest JSON here..."))}"></textarea>
      <div class="actions">
        <button class="secondary" id="load-manifest-from-text">${escapeHtml(t$1("iiif.loadFromText", "Load from Text"))}</button>
      </div>
    </div>
  `;

  formContainer.appendChild(content);

  document.body.appendChild(formContainer);
}

const loadDDSLoader = async () => (await import('./assets/three.js').then(function (n) { return n.j; })).DDSLoader;
const loadMTLLoader = async () => (await import('./assets/three.js').then(function (n) { return n.k; })).MTLLoader;
const loadOBJLoader = async () => (await import('./assets/three.js').then(function (n) { return n.l; })).OBJLoader;
const loadFBXLoader = async () => (await import('./assets/three.js').then(function (n) { return n.n; })).FBXLoader;
const loadPLYLoader = async () => (await import('./assets/three.js').then(function (n) { return n.P; })).PLYLoader;
const loadColladaLoader = async () => (await import('./assets/three.js').then(function (n) { return n.o; })).ColladaLoader;
const loadSTLLoader = async () => (await import('./assets/three.js').then(function (n) { return n.S; })).STLLoader;
const loadXYZLoader = async () => (await import('./assets/three.js').then(function (n) { return n.X; })).XYZLoader;
const loadTDSLoader = async () => (await import('./assets/three.js').then(function (n) { return n.p; })).TDSLoader;
const loadPCDLoader = async () => (await import('./assets/three.js').then(function (n) { return n.q; })).PCDLoader;
const loadGLTFLoader = async () => (await import('./assets/three.js').then(function (n) { return n.G; })).GLTFLoader;
const loadDRACOLoader = async () => (await import('./assets/three.js').then(function (n) { return n.r; })).DRACOLoader;
const loadIFCLoader = async () => (await import('./assets/IFCLoader.js')).IFCLoader;
const loadRoomEnvironment = async () => (await import('./assets/three.js').then(function (n) { return n.R; })).RoomEnvironment;

var outlineClipping;
let environmentTexturePromise = null;

const loaderMap = {
  gltf: loadGLTFLoader,
  glb: loadGLTFLoader,
  obj: loadOBJLoader,
  fbx: loadFBXLoader,
  ply: loadPLYLoader,
  stl: loadSTLLoader,
  dae: loadColladaLoader,
  xyz: loadXYZLoader,
  '3ds': loadTDSLoader,
  pcd: loadPCDLoader,
  ifc: loadIFCLoader
};

async function createLoader(ext) {

  const loadLoader = loaderMap[ext];

  if (!loadLoader) {
    throw new Error(`Unsupported format: ${ext}`);
  }

  const LoaderClass = await loadLoader();
  return new LoaderClass();
}

const ENV_BUILD = "test";
const MODULES_PATH = "";
const ENV_SUBDIR = "";
console.log('[loaders] ENV_BUILD:', ENV_BUILD);
console.log('[loaders] MODULES_PATH:', MODULES_PATH);
console.log('[loaders] ENV_SUBDIR:', ENV_SUBDIR);

function normalizeWasmPath(path) {
  if (typeof window === 'undefined' || !path) return path;
  let normalized = path.trim();

  // Force secure scheme for explicit http resources
  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice('http://'.length);
  } else if (normalized.startsWith('//')) {
    normalized = `${window.location.protocol}${normalized}`;
  } else if (normalized.startsWith('/')) {
    normalized = `${window.location.protocol}//${window.location.host}${normalized}`;
  } else if (!/^[a-zA-Z][\w+-.]*:/.test(normalized)) {
    normalized = new URL(normalized, window.location.href).href;
  }

  // Normalize duplicate slashes while keeping protocol separator intact
  try {
    const url = new URL(normalized);
    url.pathname = url.pathname.replace(/\/\/{2,}/g, '/');
    normalized = url.href;
  } catch (err) {
    normalized = normalized.replace(/\/\/{2,}/g, '/');
  }

  return normalized;
}

function sanitizeModuleAssetBasePath(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let basePath = input.trim().replace(/\/$/, '');

  if (!basePath) {
    return '';
  }

  if (/^[a-zA-Z][\w+-.]*:\/\//.test(basePath)) {
    try {
      const url = new URL(basePath);
      const hostSegment = `/${url.host}`;

      if (url.pathname.startsWith(hostSegment)) {
        url.pathname = url.pathname.slice(hostSegment.length) || '/';
      }

      url.pathname = url.pathname.replace(/\/\/{2,}/g, '/');
      return url.href.replace(/\/$/, '');
    } catch (_err) {
      return basePath;
    }
  }

  if (/^[^\/]+\.[^\/]+\/.+/.test(basePath)) {
    const parts = basePath.split('/');
    const host = parts.shift();
    const remainder = `/${parts.join('/')}`.replace(/\/\/{2,}/g, '/');

    if (
      host &&
      typeof window !== 'undefined' &&
      (host === window.location.host || /^\w[\w.-]*\.[a-z]{2,}$/i.test(host))
    ) {
      return remainder.replace(/\/$/, '');
    }
  }

  if (/^\/[^\/]+\.[^\/]+\/.+/.test(basePath)) {
    const parts = basePath.split('/').filter(Boolean);
    const host = parts.shift();
    const remainder = `/${parts.join('/')}`.replace(/\/\/{2,}/g, '/');

    if (
      host &&
      typeof window !== 'undefined' &&
      (host === window.location.host || /^\w[\w.-]*\.[a-z]{2,}$/i.test(host))
    ) {
      return remainder.replace(/\/$/, '');
    }
  }

  return basePath.replace(/\/\/{2,}/g, '/');
}

function prepareOutlineClipping(_object) {
  core.outlineClipping = _object.clone(true);
  var gutsMaterial = new THREE.MeshBasicMaterial({
    color: "crimson",
    side: THREE.BackSide,
    clippingPlanes: core.clippingPlanes,
    clipShadows: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  core.outlineClipping.traverse(function (child) {
    if (child.type == "Mesh" || child.type == "Object3D") {
      child.material = gutsMaterial;
    }
  });
  core.outlineClipping.visible = false;
  return core.outlineClipping;
}

function setupSingleMaterial(materials, material) {
  if (material.map) {
    material.map.anisotropy = 16;
    material.map.colorSpace = THREE.SRGBColorSpace;
  }
  material.envMapIntensity = 0.6;
  material.roughness = Math.max(material.roughness * 0.85, 0.05);
  material.clipShadows = true;
  material.side = core.PRESENTATION_MODE ? THREE.DoubleSide : THREE.FrontSide;
  material.clippingPlanes = core.PRESENTATION_MODE ? [] : core.clippingPlanes;
  //material.clipIntersection = false;
  if (material.name === "") material.name = material.uuid;
  var newMaterial = { name: material.name, uuid: material.uuid };
  if (!materials.some((item) => item.uuid === newMaterial.uuid)) materials.push(newMaterial);
}

function setupMaterials(_object) {
  var materials = [];
  if (_object.isMesh) {
    _object.castShadow = true;
    _object.receiveShadow = true;
    if (
      _object.geometry &&
      typeof _object.geometry.computeVertexNormals === "function" &&
      !_object.geometry.getAttribute?.("normal")
    ) {
      _object.geometry.computeVertexNormals();
    }
    if (_object.material.isMaterial) {
      setupSingleMaterial(materials, _object.material);
    } else if (Array.isArray(_object.material)) {
      _object.material.forEach((material) =>
        setupSingleMaterial(materials, material)
      );
    }
  }
  return materials;
}

function getMaterialByID(_object, _uuid) {
  var _material;
  _object.traverse(function (child) {
    if (
      child.isMesh &&
      child.material.isMaterial &&
      child.material.uuid === _uuid
    ) {
      _material = child.material;
    }
  });
  return _material;
}

function traverseMesh(object) {
  var _objectMaterials = [];
  _objectMaterials.push(setupMaterials(object));

  object.traverse(function (child) {
    _objectMaterials.push(setupMaterials(child));
    _objectMaterials.side = THREE.DoubleSide;
  });
  var objectMaterials = ["select by material"];
  _objectMaterials.forEach(function (item, index, array) {
    if (item.length > 1) {
      item.forEach(function (_item, _index, _array) {
        objectMaterials.push(_item.uuid);
      });
    } else if (item.length == 1) {
      objectMaterials.push(item[0].uuid);
    }
  });
  var _material = null;
  var _materialGui = null;
  var _uuid = null;
  if (!core.materialsFolder) return;
  core.i18nGui.editMaterialsController =core.materialsFolder
    .add(core.materialsPropertiesText, "Edit material", objectMaterials)
    .name(window.Viewer?.t?.("gui.editMaterial", "Edit material") ?? "Edit material")
    .onChange(function (value) {
      if (
        (value === "select by material" || value !== _uuid) &&
        _material !== null
      ) {
        _materialGui.color.destroy();
        _materialGui.emissiveColor.destroy();
        _materialGui.emissive.destroy();
        _materialGui.metalness.destroy();
        _materialGui = null;
        _material = null;
      }
      if (_material === null) {
        _materialGui = {};
        _material = getMaterialByID(object, value);
        //console.log(_material);
        core.materialProperties.color = _material.color;
        core.materialProperties.emissiveColor = _material.emissive;
        core.materialProperties.emissive = _material.emissiveIntensity;
        core.materialProperties.metalness = _material.metalness;
        _materialGui.color = core.materialsFolder
          .addColor(core.materialProperties, "color")
          .onChange(function (value) {
            _material.color = new THREE.Color(value);
          })
          .listen();
        _materialGui.emissiveColor = core.materialsFolder
          .addColor(core.materialProperties, "emissiveColor")
          .onChange(function (value) {
            _material.emissive = new THREE.Color(value);
          })
          .listen();
        _materialGui.emissive = core.materialsFolder
          .add(core.materialProperties, "emissive", 0, 1)
          .onChange(function (value) {
            _material.emissiveIntensity = value;
          })
          .listen();
        _materialGui.metalness = core.materialsFolder
          .add(core.materialProperties, "metalness", 0, 1)
          .onChange(function (value) {
            _material.metalness = value;
          })
          .listen();
      }
      if (_uuid === null || _uuid !== value) {
        _uuid = value;
      }
    });
}

function getEnvironmentTexture(renderer) {
  if (!renderer) return Promise.resolve(null);
  if (!environmentTexturePromise) {
    environmentTexturePromise = (async () => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        const TempRoomEnvironment = await loadRoomEnvironment();
        return pmrem.fromScene(new TempRoomEnvironment()).texture;
      } finally {
        pmrem.dispose();
      }
    })();
  }
  return environmentTexturePromise;
}

function reportLoadError(error, context = "") {
  const message = reportViewerError(error, {
    context,
    consoleLabel: "Viewer load error:",
  });
  core.circle?.complete?.(1200);
  if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 1;
  return message;
}

async function loadModel() {
  core.loadingLog?.start?.();
  let modelPath = core.fileObject.filename.startsWith('blob:') ? core.fileObject.filename : core.fileObject.path + core.fileObject.filename;
  if (core.CONFIG.entity.proxyPath !== undefined && !core.fileObject.filename.startsWith('blob:')) {
    modelPath = core.getProxyPath(modelPath, core.CONFIG, core.fileObject);
  }

  function loadAsync(loader, url, progressHandler = onProgress) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, progressHandler, reject);
    });
  }

  function updateLoadingStage(stageKey, progressValue = null) {
    core.circle?.setStage?.(stageKey, progressValue);
    core.loadingLog?.setStage?.(stageKey, progressValue);
  }

  async function afterLoad({ object }) {
    if (object === null || typeof object === "undefined") {
      throw new Error("Loaded object is null or undefined.");
    }
    updateLoadingStage("loadingLog.loadingTextures", 99);

    // Keep authoring transforms in presentation mode to avoid collapsing model parts.
    if (!core.PRESENTATION_MODE) {
      // Reset transform to ensure consistent positioning
      if (Array.isArray(object)) {
        object.forEach(obj => {
          obj.position.set(0, 0, 0);
          obj.rotation.set(0, 0, 0);
          obj.scale.set(1, 1, 1);
          obj.updateMatrixWorld(true);
        });
      } else {
        object.position.set(0, 0, 0);
        object.rotation.set(0, 0, 0);
        object.scale.set(1, 1, 1);
        object.updateMatrixWorld(true);
      }
      core.handHint.hidden = true;
    }

    window.viewer.modelLoaded = true;
    updateLoadingStage("loadingLog.preparingGeometry", 99);
    traverseMesh(object);

    if (!core.PRESENTATION_MODE) {
      const isArchiveDerivedPath = /\/[^/]+_(ZIP|RAR|TAR|XZ|GZ)\/gltf\/$/i.test(core.fileObject.path);
      if (!isArchiveDerivedPath) {
        if (core.fileObject.extension.toLowerCase() === "gltf" || core.fileObject.extension.toLowerCase() === "glb") {
          core.fileObject.path = core.fileObject.path.replace("/gltf/", "/");
        } else {
          core.fileObject.path = core.fileObject.path.replace("gltf/", "");
        }
      }
      updateLoadingStage("loadingLog.fetchingMetadata", 99);
      await fetchSettings(object);

      updateLoadingStage("loadingLog.settingUpMaterials", 99);
      core.outlineClipping = prepareOutlineClipping(object);
      if (Array.isArray(object)) {
        core.helperObjects.push(object[0]);
      } else {
        core.helperObjects.push(object);
      }
      core.scene.add(core.outlineClipping);
    } else {
      updateLoadingStage("loadingLog.settingUpMaterials", 99);
      presentationMode(object).catch(error => {
        reportLoadError(error, "Presentation mode setup failed");
        showToast("toasts.presentationModeError", "error");
      });
    }

    updateLoadingStage("loadingLog.settingUpLighting", 99);
    if (Array.isArray(object)) {
      object.forEach(o => core.scene.add(o));
    } else {
      core.scene.add(object);
    }
    core.mainObject.push(object);

    updateLoadingStage("loadingLog.compilingShaders", 99);
    core.scene.environment = await getEnvironmentTexture(core.renderer);
  }

  async function loadOBJWithMTL() {
    const DDSLoader = await loadDDSLoader();
    const MTLLoader = await loadMTLLoader();
    const OBJLoader = await loadOBJLoader();
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => toastHelper$1("objLoaded", "success");
    manager.addHandler(/\.dds$/i, new DDSLoader());

    const basename = core.fileObject.filename.replace(/\.[^/.]+$/, "");
    const filename = core.fileObject.filename;

    if (!core.CONFIG.noMTL) {
      try {
        const materials = await new Promise((resolve, reject) => {
          new MTLLoader(manager)
          .setPath(core.fileObject.path)
          .load(basename + ".mtl", resolve, undefined, reject);
        });
        materials.preload();

        const obj = await new Promise((resolve, reject) => {
          new OBJLoader(manager)
          .setMaterials(materials)
          .setPath(core.fileObject.path)
          .load(filename, resolve, onProgress, reject);
        });

        obj.position.set(0, 0, 0);
        return obj;
      } catch (error) {
        core.CONFIG.noMTL = true;
        toastHelper$1("mtlLoadError", "error");
        console.warn("MTL load failed, falling back to OBJ-only load.", error);
      }
    }

  const obj = await new Promise((resolve, reject) => {
      new OBJLoader()
      .setPath(core.fileObject.path)
      .load(filename, resolve, onProgress, reject);
    });

    obj.position.set(0, 0, 0);
    return obj;
  }

  function normalizePath(path) {
    if (!path || typeof path !== 'string') {
      return path;
    }

    if (/^[a-zA-Z][\w+-.]*:\/\//.test(path)) {
      try {
        const url = new URL(path);
        url.pathname = url.pathname.replace(/\/{2,}/g, '/');
        return url.href;
      } catch (_err) {
        return path;
      }
    }

    return path.replace(/\/{2,}/g, '/');
  }

  async function resolveIfcWasmPath(basePath) {
    const candidates = [
      normalizePath(basePath.replace(/\/$/, '') + '/ifc/'),
      normalizePath(basePath.replace(/\/$/, '') + '/ifc'),
    ];

    for (const candidate of candidates) {
      const wasmUrl = candidate.replace(/\/$/, '') + '/web-ifc.wasm';
      try {
        const res = await fetch(wasmUrl, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          return candidate;
        }
      } catch (err) {
        // ignored, try next candidate
      }
    }
    return null;
  }

  async function loadGLTFModel() {
    let gltfModelPath = core.fileObject.filename.startsWith('blob:') ? core.fileObject.filename : core.fileObject.path + core.fileObject.basename + "." + core.fileObject.extension;
    if (core.CONFIG.entity.proxyPath !== undefined && !core.fileObject.filename.startsWith('blob:')) {
      gltfModelPath = core.getProxyPath(gltfModelPath);
    }

    const dracoBase = normalizePath(normalizeWasmPath(`${getModuleAssetBasePath()}/draco/gltf/`));

    const loader = await createLoader(core.fileObject.extension.toLowerCase());
    const DRACOLoader = await loadDRACOLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(dracoBase);
    loader.setDRACOLoader(draco);

    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          gltfModelPath,
          resolve,
          (xhr) => {
            progressLoaderHandler(xhr);
          },
          reject
        );
      });
      return gltf.scene;
    } finally {
      draco.dispose();
    }
  }

  try {
    switch (core.fileObject.extension.toLowerCase()) {
      case "obj": {
        const object = await loadOBJWithMTL();
        await afterLoad({ object });
        break;
      }

      case "fbx": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "ply": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        if (!geometry.getAttribute?.("normal")) {
          geometry.computeVertexNormals();
        }
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff, flatShading: true });
        const object = new THREE.Mesh(geometry, material);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        await afterLoad({ object });
        break;
      }

      case "dae": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const collada = await loadAsync(loader, modelPath, onProgress);
        const object = collada.scene;
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "ifc": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const basePath = getModuleAssetBasePath();

        let ifcWasmPath = await resolveIfcWasmPath(basePath);

        if (!ifcWasmPath) {
          const errorMsg = `[loadModel] IFC WASM not found in ${basePath}/ifc or fallback; please verify path and permissions`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }

        const normalizedIfcWasmPath = normalizeWasmPath(ifcWasmPath);
        console.log('[loadModel] IFC WASM path:', normalizedIfcWasmPath);
        loader.ifcManager.setWasmPath(normalizedIfcWasmPath, true);
        const object = await loadAsync(loader, modelPath, onProgress);
        await afterLoad({ object });
        break;
      }

      case "stl": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        let meshMaterial = new THREE.MeshPhongMaterial({ color: 0xff5533, specular: 0x111111, shininess: 200 });
        if (geometry.hasColors) {
          meshMaterial = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });
        }
        const object = new THREE.Mesh(geometry, meshMaterial);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        await afterLoad({ object });
        break;
      }

      case "xyz": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        geometry.center();
        const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: geometry.hasAttribute("color") === true });
        const object = new THREE.Points(geometry, material);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "pcd": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const mesh = await loadAsync(loader, modelPath, onProgress);
        mesh.geometry?.center?.();
        if (mesh.material) {
          mesh.material.size = Math.max(mesh.material.size ?? 0, 0.1);
        }
        await afterLoad({ object: mesh });
        break;
      }

      case "json": {
        const loader = new THREE.ObjectLoader();
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "3ds": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        loader.setResourcePath(core.fileObject.path);
        let mp = core.fileObject.path;
        if (core.CONFIG.entity.proxyPath !== undefined) mp = core.getProxyPath(mp);
        const object = await loadAsync(loader, mp + core.fileObject.basename + "." + core.fileObject.extension, onProgress);
        await afterLoad({ object });
        break;
      }

      case "glb":
      case "gltf": {
        const object = await loadGLTFModel();
        await afterLoad({ object });
        break;
      }
      default:
        toastHelper$1("unsupportedExtension", "warning");
        core.loadingLog?.fail?.();
        return;
    }

    updateLoadingStage("loadingLog.modelLoaded", 100);
    core.circle?.complete?.(2600);
    core.loadingLog?.finish?.();
    if (!core.PRESENTATION_MODE) {
      toastHelper$1("modelLoaded", "success", {
        filename: core.fileObject.filename
      });
    } else {
      toastHelper$1("presentationModeReady", "success");
    }
    if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 0;
    core.UltraLoader?.finish();
    core.poller?.updateSteps(2);
  } catch (error) {
    core.loadingLog?.fail?.();
    reportLoadError(error, `Failed to load ${core.fileObject.filename}`);
    throw error;
  }
}

const getModuleAssetBasePath = function() {
  let basePath = sanitizeModuleAssetBasePath(core.CONFIG?.baseModulePath);
  core.DFG_ASSETS ? core.DFG_ASSETS.replace(/\/$/, '') : '';

  if (!basePath) {
    basePath = '/assets';
  }

  // Override for localhost
  if (core.isLocalPreview) {
    basePath = '/assets';
  }

  basePath = sanitizeModuleAssetBasePath(basePath);

  console.log('[loaders] resolved ModuleAssetBasePath:', basePath);
  core.CONFIG.baseModulePath = basePath; // Cache for future use
  core.DFG_ASSETS = basePath;
  return basePath;
};

const onProgress = function (xhr) {
  progressLoaderHandler(xhr);
};

const progressLoaderHandler = function (xhr) {
  if (!core.circle) return;
  const total = xhr.total || xhr.loaded || 1;
  const percentComplete = Math.min((xhr.loaded / total) * 100, 99);
  if (!Number.isFinite(percentComplete)) return;
  core.circle.show();
  core.circle.set(percentComplete, 100);
  core.loadingLog?.update?.(percentComplete);
  core.UltraLoader?.set(percentComplete);
};

const UltraLoader$1 = {

  progress:0,
  bar:null,
  panel:null,
  header:null,
  stepsContainer:null,
  steps:[],
  isFinished:false,
  hideTimer:null,
  resetTimer:null,

  init() {
    if(this.bar) return;

    const loader=document.createElement("div");
    loader.id="ultra-loader";
    loader.innerHTML='<div id="ultra-loader-bar"></div>';

    const panel=document.createElement("div");
    panel.id="ultra-loader-panel";

    const header=document.createElement("div");
    header.id="ultra-loader-header";
    header.textContent=t$1("processingHeader");
    panel.appendChild(header);

    const stepsContainer=document.createElement("div");
    stepsContainer.id="ultra-loader-steps";
    panel.appendChild(stepsContainer);

    document.body.appendChild(loader);
    document.body.appendChild(panel);

    this.bar=document.getElementById("ultra-loader-bar");
    this.panel=panel;
    this.header=header;
    this.stepsContainer=stepsContainer;
  },

  start(steps) {
    this.init();

    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.steps=steps;
    this.updateHeader();
    this.progress=5;
    this.isFinished=false;

    this.bar.style.width = "5%";
    this.bar.style.background = "";

    this.renderSteps(0);

    this.panel.classList.add("show");

    this.render();
    },

  set(progress,message) {
    this.progress=Math.max(this.progress,progress);
    this.render();
  },

  step(index) {
    this.renderSteps(index);
  },

  finish() {
    this.progress=100;
    this.isFinished=true;
    this.render();
    this.renderSteps(this.steps.length);

    this.hideTimer = window.setTimeout(() => {
      if (!this.isFinished) {
        return;
      }

      this.panel.classList.remove("show");
      this.hideTimer = null;

      this.resetTimer = window.setTimeout(() => {
        this.bar.style.width = "0%";
        this.progress = 0;
        this.resetTimer = null;
      }, 1500);
    }, 2500);

  },

  render() {
    this.bar.style.width=this.progress+"%";
  },

  updateHeader() {
    if (this.header) {
      this.header.textContent=t$1("processingHeader");
    }
  },

  renderSteps(active) {
    this.updateHeader();
    if (!this.stepsContainer) return;
    this.stepsContainer.replaceChildren();
    this.steps.forEach((s,i)=>{
      const row=document.createElement("div");
      row.className="ultra-step";
      if(i<active) {
        row.classList.add("done");
        row.textContent="✓ "+s;
      }
      else if(i===active) {
        row.classList.add("active");
        row.textContent="⏳ "+s;
      }
      else {
        row.classList.add("pending");
        row.textContent="□ "+s;
      }
      this.stepsContainer.appendChild(row);
    });
  },

  error(message="Processing error") {
    this.isFinished = true;
    this.renderErrorSteps();
    const error=document.createElement("div");
    error.id="ultra-loader-error";
    error.textContent=`ERROR: ${message}`;
    this.panel.appendChild(error);
    this.bar.style.background="#d93025";
  },

  renderErrorSteps() {
    this.updateHeader();
    if (!this.stepsContainer) return;
    this.stepsContainer.replaceChildren();
    this.steps.forEach((s)=>{
      const row=document.createElement("div");
      row.className="ultra-step error";
      row.textContent="✖ "+s;
      this.stepsContainer.appendChild(row);
    });
  }

};

window.UltraLoader=UltraLoader$1;

class StatusPoller {

    constructor(id) {
        this.id=id;
        this.interval=2000;
        this.timer=null;
        this.running=false;
    }

    async start() {
        if(this.running) return;
        this.running=true;
        if (!core.isLocalPreview)
            await this.tick();
        else {
            this.map = core.isLocalPreview
                ? Object.fromEntries(
                    Object.entries(this.fullMap)
                        .slice(-3)      // Only keep the last 2 steps for local preview
                        .map(([k], i) => [k, i])
                    )
                : this.fullMap;
        }
    }

    stop() {
        this.running=false;
        if(this.timer) clearTimeout(this.timer);
    }
    fullMap = {
        init: 0,
        preparing: 1,
        processing: 2,
        converted: 3,
        updating: 4,
        rendering: 4,
        model_ready: 5,
        viewer_ready: 6,
        ready: 6,
        failed: 7,
        error: 7,
    };

    terminalStatuses = new Set(["ready", "viewer_ready", "failed", "error"]);

    map = this.fullMap;

    updateSteps(status) {
        if(this.map[status]!==undefined) {
            UltraLoader.step(this.map[status]);
        }

    }

    async tick() {
        if(!this.running || core.isLocalPreview) return;

        try {
            const r=await fetch(`/api/model/status/${this.id}`, {
                cache:"no-store"
            });

            if(!r.ok){
                throw new Error("API error");
            }

            const data=await r.json();

            if(data.status==="error") {
                UltraLoader.error(data.message || "Processing failed");
                this.stop();
                localStorage.removeItem("processing_model_id");
                return;
            }

            UltraLoader.set(data.progress);

            this.updateSteps(data.status);

            if(this.terminalStatuses.has(data.status)) {
                if (data.status==="ready" || data.status==="viewer_ready") {
                    UltraLoader.finish("3D Viewer is ready");
                }
                else {
                    UltraLoader.finish("Failed processing the model");
                }
                this.stop();
                localStorage.removeItem("processing_model_id");
                return;
            }
        }
        catch(e){
            if (!core.isLocalPreview) {
                UltraLoader.error("Connection error");
                this.stop();
            }
        }
        this.timer=setTimeout(()=>this.tick(),this.interval);
    }

}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var stats_min$1 = {exports: {}};

var stats_min = stats_min$1.exports;

var hasRequiredStats_min;

function requireStats_min () {
	if (hasRequiredStats_min) return stats_min$1.exports;
	hasRequiredStats_min = 1;
	(function (module, exports) {
		// stats.js - http://github.com/mrdoob/stats.js
		(function(f,e){module.exports=e();})(stats_min,function(){var f=function(){function e(a){c.appendChild(a.dom);return a}function u(a){for(var d=0;d<c.children.length;d++)c.children[d].style.display=d===a?"block":"none";l=a;}var l=0,c=document.createElement("div");c.style.cssText="position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";c.addEventListener("click",function(a){a.preventDefault();
		u(++l%c.children.length);},false);var k=(performance||Date).now(),g=k,a=0,r=e(new f.Panel("FPS","#0ff","#002")),h=e(new f.Panel("MS","#0f0","#020"));if(self.performance&&self.performance.memory)var t=e(new f.Panel("MB","#f08","#201"));u(0);return {REVISION:16,dom:c,addPanel:e,showPanel:u,begin:function(){k=(performance||Date).now();},end:function(){a++;var c=(performance||Date).now();h.update(c-k,200);if(c>g+1E3&&(r.update(1E3*a/(c-g),100),g=c,a=0,t)){var d=performance.memory;t.update(d.usedJSHeapSize/
		1048576,d.jsHeapSizeLimit/1048576);}return c},update:function(){k=this.end();},domElement:c,setMode:u}};f.Panel=function(e,f,l){var c=Infinity,k=0,g=Math.round,a=g(window.devicePixelRatio||1),r=80*a,h=48*a,t=3*a,v=2*a,d=3*a,m=15*a,n=74*a,p=30*a,q=document.createElement("canvas");q.width=r;q.height=h;q.style.cssText="width:80px;height:48px";var b=q.getContext("2d");b.font="bold "+9*a+"px Helvetica,Arial,sans-serif";b.textBaseline="top";b.fillStyle=l;b.fillRect(0,0,r,h);b.fillStyle=f;b.fillText(e,t,v);
		b.fillRect(d,m,n,p);b.fillStyle=l;b.globalAlpha=.9;b.fillRect(d,m,n,p);return {dom:q,update:function(h,w){c=Math.min(c,h);k=Math.max(k,h);b.fillStyle=l;b.globalAlpha=1;b.fillRect(0,0,r,m);b.fillStyle=f;b.fillText(g(h)+" "+e+" ("+g(c)+"-"+g(k)+")",t,v);b.drawImage(q,d+a,m,n-a,p,d,m,n-a,p);b.fillRect(d+n-a,m,a,p);b.fillStyle=l;b.globalAlpha=.9;b.fillRect(d+n-a,m,a,g((1-h/w)*p));}}};return f}); 
	} (stats_min$1));
	return stats_min$1.exports;
}

var stats_minExports = /*@__PURE__*/ requireStats_min();
var Stats = /*@__PURE__*/getDefaultExportFromCjs(stats_minExports);

/**
 * lil-gui
 * https://lil-gui.georgealways.com
 * @version 0.19.2
 * @author George Michael Brower
 * @license MIT
 */
class t{constructor(i,e,s,n,l="div"){this.parent=i,this.object=e,this.property=s,this._disabled=false,this._hidden=false,this.initialValue=this.getValue(),this.domElement=document.createElement(l),this.domElement.classList.add("controller"),this.domElement.classList.add(n),this.$name=document.createElement("div"),this.$name.classList.add("name"),t.nextNameID=t.nextNameID||0,this.$name.id="lil-gui-name-"+ ++t.nextNameID,this.$widget=document.createElement("div"),this.$widget.classList.add("widget"),this.$disable=this.$widget,this.domElement.appendChild(this.$name),this.domElement.appendChild(this.$widget),this.domElement.addEventListener("keydown",t=>t.stopPropagation()),this.domElement.addEventListener("keyup",t=>t.stopPropagation()),this.parent.children.push(this),this.parent.controllers.push(this),this.parent.$children.appendChild(this.domElement),this._listenCallback=this._listenCallback.bind(this),this.name(s);}name(t){return this._name=t,this.$name.textContent=t,this}onChange(t){return this._onChange=t,this}_callOnChange(){this.parent._callOnChange(this),void 0!==this._onChange&&this._onChange.call(this,this.getValue()),this._changed=true;}onFinishChange(t){return this._onFinishChange=t,this}_callOnFinishChange(){this._changed&&(this.parent._callOnFinishChange(this),void 0!==this._onFinishChange&&this._onFinishChange.call(this,this.getValue())),this._changed=false;}reset(){return this.setValue(this.initialValue),this._callOnFinishChange(),this}enable(t=true){return this.disable(!t)}disable(t=true){return t===this._disabled||(this._disabled=t,this.domElement.classList.toggle("disabled",t),this.$disable.toggleAttribute("disabled",t)),this}show(t=true){return this._hidden=!t,this.domElement.style.display=this._hidden?"none":"",this}hide(){return this.show(false)}options(t){const i=this.parent.add(this.object,this.property,t);return i.name(this._name),this.destroy(),i}min(t){return this}max(t){return this}step(t){return this}decimals(t){return this}listen(t=true){return this._listening=t,void 0!==this._listenCallbackID&&(cancelAnimationFrame(this._listenCallbackID),this._listenCallbackID=void 0),this._listening&&this._listenCallback(),this}_listenCallback(){this._listenCallbackID=requestAnimationFrame(this._listenCallback);const t=this.save();t!==this._listenPrevValue&&this.updateDisplay(),this._listenPrevValue=t;}getValue(){return this.object[this.property]}setValue(t){return this.getValue()!==t&&(this.object[this.property]=t,this._callOnChange(),this.updateDisplay()),this}updateDisplay(){return this}load(t){return this.setValue(t),this._callOnFinishChange(),this}save(){return this.getValue()}destroy(){this.listen(false),this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.controllers.splice(this.parent.controllers.indexOf(this),1),this.parent.$children.removeChild(this.domElement);}}class i extends t{constructor(t,i,e){super(t,i,e,"boolean","label"),this.$input=document.createElement("input"),this.$input.setAttribute("type","checkbox"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$widget.appendChild(this.$input),this.$input.addEventListener("change",()=>{this.setValue(this.$input.checked),this._callOnFinishChange();}),this.$disable=this.$input,this.updateDisplay();}updateDisplay(){return this.$input.checked=this.getValue(),this}}function e(t){let i,e;return (i=t.match(/(#|0x)?([a-f0-9]{6})/i))?e=i[2]:(i=t.match(/rgb\(\s*(\d*)\s*,\s*(\d*)\s*,\s*(\d*)\s*\)/))?e=parseInt(i[1]).toString(16).padStart(2,0)+parseInt(i[2]).toString(16).padStart(2,0)+parseInt(i[3]).toString(16).padStart(2,0):(i=t.match(/^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i))&&(e=i[1]+i[1]+i[2]+i[2]+i[3]+i[3]),!!e&&"#"+e}const s={isPrimitive:true,match:t=>"number"==typeof t,fromHexString:t=>parseInt(t.substring(1),16),toHexString:t=>"#"+t.toString(16).padStart(6,0)},n={isPrimitive:false,match:t=>Array.isArray(t),fromHexString(t,i,e=1){const n=s.fromHexString(t);i[0]=(n>>16&255)/255*e,i[1]=(n>>8&255)/255*e,i[2]=(255&n)/255*e;},toHexString:([t,i,e],n=1)=>s.toHexString(t*(n=255/n)<<16^i*n<<8^e*n<<0)},l={isPrimitive:false,match:t=>Object(t)===t,fromHexString(t,i,e=1){const n=s.fromHexString(t);i.r=(n>>16&255)/255*e,i.g=(n>>8&255)/255*e,i.b=(255&n)/255*e;},toHexString:({r:t,g:i,b:e},n=1)=>s.toHexString(t*(n=255/n)<<16^i*n<<8^e*n<<0)},r=[{isPrimitive:true,match:t=>"string"==typeof t,fromHexString:e,toHexString:e},s,n,l];class o extends t{constructor(t,i,s,n){var l;super(t,i,s,"color"),this.$input=document.createElement("input"),this.$input.setAttribute("type","color"),this.$input.setAttribute("tabindex",-1),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$text=document.createElement("input"),this.$text.setAttribute("type","text"),this.$text.setAttribute("spellcheck","false"),this.$text.setAttribute("aria-labelledby",this.$name.id),this.$display=document.createElement("div"),this.$display.classList.add("display"),this.$display.appendChild(this.$input),this.$widget.appendChild(this.$display),this.$widget.appendChild(this.$text),this._format=(l=this.initialValue,r.find(t=>t.match(l))),this._rgbScale=n,this._initialValueHexString=this.save(),this._textFocused=false,this.$input.addEventListener("input",()=>{this._setValueFromHexString(this.$input.value);}),this.$input.addEventListener("blur",()=>{this._callOnFinishChange();}),this.$text.addEventListener("input",()=>{const t=e(this.$text.value);t&&this._setValueFromHexString(t);}),this.$text.addEventListener("focus",()=>{this._textFocused=true,this.$text.select();}),this.$text.addEventListener("blur",()=>{this._textFocused=false,this.updateDisplay(),this._callOnFinishChange();}),this.$disable=this.$text,this.updateDisplay();}reset(){return this._setValueFromHexString(this._initialValueHexString),this}_setValueFromHexString(t){if(this._format.isPrimitive){const i=this._format.fromHexString(t);this.setValue(i);}else this._format.fromHexString(t,this.getValue(),this._rgbScale),this._callOnChange(),this.updateDisplay();}save(){return this._format.toHexString(this.getValue(),this._rgbScale)}load(t){return this._setValueFromHexString(t),this._callOnFinishChange(),this}updateDisplay(){return this.$input.value=this._format.toHexString(this.getValue(),this._rgbScale),this._textFocused||(this.$text.value=this.$input.value.substring(1)),this.$display.style.backgroundColor=this.$input.value,this}}class a extends t{constructor(t,i,e){super(t,i,e,"function"),this.$button=document.createElement("button"),this.$button.appendChild(this.$name),this.$widget.appendChild(this.$button),this.$button.addEventListener("click",t=>{t.preventDefault(),this.getValue().call(this.object),this._callOnChange();}),this.$button.addEventListener("touchstart",()=>{},{passive:true}),this.$disable=this.$button;}}class h extends t{constructor(t,i,e,s,n,l){super(t,i,e,"number"),this._initInput(),this.min(s),this.max(n);const r=void 0!==l;this.step(r?l:this._getImplicitStep(),r),this.updateDisplay();}decimals(t){return this._decimals=t,this.updateDisplay(),this}min(t){return this._min=t,this._onUpdateMinMax(),this}max(t){return this._max=t,this._onUpdateMinMax(),this}step(t,i=true){return this._step=t,this._stepExplicit=i,this}updateDisplay(){const t=this.getValue();if(this._hasSlider){let i=(t-this._min)/(this._max-this._min);i=Math.max(0,Math.min(i,1)),this.$fill.style.width=100*i+"%";}return this._inputFocused||(this.$input.value=void 0===this._decimals?t:t.toFixed(this._decimals)),this}_initInput(){this.$input=document.createElement("input"),this.$input.setAttribute("type","text"),this.$input.setAttribute("aria-labelledby",this.$name.id);window.matchMedia("(pointer: coarse)").matches&&(this.$input.setAttribute("type","number"),this.$input.setAttribute("step","any")),this.$widget.appendChild(this.$input),this.$disable=this.$input;const t=t=>{const i=parseFloat(this.$input.value);isNaN(i)||(this._snapClampSetValue(i+t),this.$input.value=this.getValue());};let i,e,s,n,l,r=false;const o=t=>{if(r){const s=t.clientX-i,n=t.clientY-e;Math.abs(n)>5?(t.preventDefault(),this.$input.blur(),r=false,this._setDraggingStyle(true,"vertical")):Math.abs(s)>5&&a();}if(!r){const i=t.clientY-s;l-=i*this._step*this._arrowKeyMultiplier(t),n+l>this._max?l=this._max-n:n+l<this._min&&(l=this._min-n),this._snapClampSetValue(n+l);}s=t.clientY;},a=()=>{this._setDraggingStyle(false,"vertical"),this._callOnFinishChange(),window.removeEventListener("mousemove",o),window.removeEventListener("mouseup",a);};this.$input.addEventListener("input",()=>{let t=parseFloat(this.$input.value);isNaN(t)||(this._stepExplicit&&(t=this._snap(t)),this.setValue(this._clamp(t)));}),this.$input.addEventListener("keydown",i=>{"Enter"===i.key&&this.$input.blur(),"ArrowUp"===i.code&&(i.preventDefault(),t(this._step*this._arrowKeyMultiplier(i))),"ArrowDown"===i.code&&(i.preventDefault(),t(this._step*this._arrowKeyMultiplier(i)*-1));}),this.$input.addEventListener("wheel",i=>{this._inputFocused&&(i.preventDefault(),t(this._step*this._normalizeMouseWheel(i)));},{passive:false}),this.$input.addEventListener("mousedown",t=>{i=t.clientX,e=s=t.clientY,r=true,n=this.getValue(),l=0,window.addEventListener("mousemove",o),window.addEventListener("mouseup",a);}),this.$input.addEventListener("focus",()=>{this._inputFocused=true;}),this.$input.addEventListener("blur",()=>{this._inputFocused=false,this.updateDisplay(),this._callOnFinishChange();});}_initSlider(){this._hasSlider=true,this.$slider=document.createElement("div"),this.$slider.classList.add("slider"),this.$fill=document.createElement("div"),this.$fill.classList.add("fill"),this.$slider.appendChild(this.$fill),this.$widget.insertBefore(this.$slider,this.$input),this.domElement.classList.add("hasSlider");const t=t=>{const i=this.$slider.getBoundingClientRect();let e=(s=t,n=i.left,l=i.right,r=this._min,o=this._max,(s-n)/(l-n)*(o-r)+r);var s,n,l,r,o;this._snapClampSetValue(e);},i=i=>{t(i.clientX);},e=()=>{this._callOnFinishChange(),this._setDraggingStyle(false),window.removeEventListener("mousemove",i),window.removeEventListener("mouseup",e);};let s,n,l=false;const r=i=>{i.preventDefault(),this._setDraggingStyle(true),t(i.touches[0].clientX),l=false;},o=i=>{if(l){const t=i.touches[0].clientX-s,e=i.touches[0].clientY-n;Math.abs(t)>Math.abs(e)?r(i):(window.removeEventListener("touchmove",o),window.removeEventListener("touchend",a));}else i.preventDefault(),t(i.touches[0].clientX);},a=()=>{this._callOnFinishChange(),this._setDraggingStyle(false),window.removeEventListener("touchmove",o),window.removeEventListener("touchend",a);},h=this._callOnFinishChange.bind(this);let d;this.$slider.addEventListener("mousedown",s=>{this._setDraggingStyle(true),t(s.clientX),window.addEventListener("mousemove",i),window.addEventListener("mouseup",e);}),this.$slider.addEventListener("touchstart",t=>{t.touches.length>1||(this._hasScrollBar?(s=t.touches[0].clientX,n=t.touches[0].clientY,l=true):r(t),window.addEventListener("touchmove",o,{passive:false}),window.addEventListener("touchend",a));},{passive:false}),this.$slider.addEventListener("wheel",t=>{if(Math.abs(t.deltaX)<Math.abs(t.deltaY)&&this._hasScrollBar)return;t.preventDefault();const i=this._normalizeMouseWheel(t)*this._step;this._snapClampSetValue(this.getValue()+i),this.$input.value=this.getValue(),clearTimeout(d),d=setTimeout(h,400);},{passive:false});}_setDraggingStyle(t,i="horizontal"){this.$slider&&this.$slider.classList.toggle("active",t),document.body.classList.toggle("lil-gui-dragging",t),document.body.classList.toggle("lil-gui-"+i,t);}_getImplicitStep(){return this._hasMin&&this._hasMax?(this._max-this._min)/1e3:.1}_onUpdateMinMax(){!this._hasSlider&&this._hasMin&&this._hasMax&&(this._stepExplicit||this.step(this._getImplicitStep(),false),this._initSlider(),this.updateDisplay());}_normalizeMouseWheel(t){let{deltaX:i,deltaY:e}=t;Math.floor(t.deltaY)!==t.deltaY&&t.wheelDelta&&(i=0,e=-t.wheelDelta/120,e*=this._stepExplicit?1:10);return i+-e}_arrowKeyMultiplier(t){let i=this._stepExplicit?1:10;return t.shiftKey?i*=10:t.altKey&&(i/=10),i}_snap(t){const i=Math.round(t/this._step)*this._step;return parseFloat(i.toPrecision(15))}_clamp(t){return t<this._min&&(t=this._min),t>this._max&&(t=this._max),t}_snapClampSetValue(t){this.setValue(this._clamp(this._snap(t)));}get _hasScrollBar(){const t=this.parent.root.$children;return t.scrollHeight>t.clientHeight}get _hasMin(){return void 0!==this._min}get _hasMax(){return void 0!==this._max}}class d extends t{constructor(t,i,e,s){super(t,i,e,"option"),this.$select=document.createElement("select"),this.$select.setAttribute("aria-labelledby",this.$name.id),this.$display=document.createElement("div"),this.$display.classList.add("display"),this.$select.addEventListener("change",()=>{this.setValue(this._values[this.$select.selectedIndex]),this._callOnFinishChange();}),this.$select.addEventListener("focus",()=>{this.$display.classList.add("focus");}),this.$select.addEventListener("blur",()=>{this.$display.classList.remove("focus");}),this.$widget.appendChild(this.$select),this.$widget.appendChild(this.$display),this.$disable=this.$select,this.options(s);}options(t){return this._values=Array.isArray(t)?t:Object.values(t),this._names=Array.isArray(t)?t:Object.keys(t),this.$select.replaceChildren(),this._names.forEach(t=>{const i=document.createElement("option");i.textContent=t,this.$select.appendChild(i);}),this.updateDisplay(),this}updateDisplay(){const t=this.getValue(),i=this._values.indexOf(t);return this.$select.selectedIndex=i,this.$display.textContent=-1===i?t:this._names[i],this}}class c extends t{constructor(t,i,e){super(t,i,e,"string"),this.$input=document.createElement("input"),this.$input.setAttribute("type","text"),this.$input.setAttribute("spellcheck","false"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$input.addEventListener("input",()=>{this.setValue(this.$input.value);}),this.$input.addEventListener("keydown",t=>{"Enter"===t.code&&this.$input.blur();}),this.$input.addEventListener("blur",()=>{this._callOnFinishChange();}),this.$widget.appendChild(this.$input),this.$disable=this.$input,this.updateDisplay();}updateDisplay(){return this.$input.value=this.getValue(),this}}let u=false;class p{constructor({parent:t,autoPlace:i=void 0===t,container:e,width:s,title:n="Controls",closeFolders:l=false,injectStyles:r=true,touchStyles:o=true}={}){if(this.parent=t,this.root=t?t.root:this,this.children=[],this.controllers=[],this.folders=[],this._closed=false,this._hidden=false,this.domElement=document.createElement("div"),this.domElement.classList.add("lil-gui"),this.$title=document.createElement("div"),this.$title.classList.add("title"),this.$title.setAttribute("role","button"),this.$title.setAttribute("aria-expanded",true),this.$title.setAttribute("tabindex",0),this.$title.addEventListener("click",()=>this.openAnimated(this._closed)),this.$title.addEventListener("keydown",t=>{"Enter"!==t.code&&"Space"!==t.code||(t.preventDefault(),this.$title.click());}),this.$title.addEventListener("touchstart",()=>{},{passive:true}),this.$children=document.createElement("div"),this.$children.classList.add("children"),this.domElement.appendChild(this.$title),this.domElement.appendChild(this.$children),this.title(n),this.parent)return this.parent.children.push(this),this.parent.folders.push(this),void this.parent.$children.appendChild(this.domElement);this.domElement.classList.add("root"),o&&this.domElement.classList.add("allow-touch-styles"),!u&&r&&(!function(t){const i=document.createElement("style");i.innerHTML=t;const e=document.querySelector("head link[rel=stylesheet], head style");e?document.head.insertBefore(i,e):document.head.appendChild(i);}('.lil-gui{--background-color:#1f1f1f;--text-color:#ebebeb;--title-background-color:#111;--title-text-color:#ebebeb;--widget-color:#424242;--hover-color:#4f4f4f;--focus-color:#595959;--number-color:#2cc9ff;--string-color:#a2db3c;--font-size:11px;--input-font-size:11px;--font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;--font-family-mono:Menlo,Monaco,Consolas,"Droid Sans Mono",monospace;--padding:4px;--spacing:4px;--widget-height:20px;--title-height:calc(var(--widget-height) + var(--spacing)*1.25);--name-width:45%;--slider-knob-width:2px;--slider-input-width:27%;--color-input-width:27%;--slider-input-min-width:45px;--color-input-min-width:45px;--folder-indent:7px;--widget-padding:0 0 0 3px;--widget-border-radius:2px;--checkbox-size:calc(var(--widget-height)*0.75);--scrollbar-width:5px;color:var(--text-color);font-family:var(--font-family);font-size:var(--font-size);font-style:normal;font-weight:400;line-height:1;text-align:left;touch-action:manipulation;user-select:none;-webkit-user-select:none}.lil-gui,.lil-gui *{box-sizing:border-box;margin:0;padding:0}.lil-gui.root{background:var(--background-color);display:flex;flex-direction:column;width:var(--width,245px)}.lil-gui.root>.title{background:var(--title-background-color);color:var(--title-text-color)}.lil-gui.root>.children{overflow-x:hidden;overflow-y:auto}.lil-gui.root>.children::-webkit-scrollbar{background:var(--background-color);height:var(--scrollbar-width);width:var(--scrollbar-width)}.lil-gui.root>.children::-webkit-scrollbar-thumb{background:var(--focus-color);border-radius:var(--scrollbar-width)}.lil-gui.force-touch-styles,.lil-gui.force-touch-styles .lil-gui{--widget-height:28px;--padding:6px;--spacing:6px;--font-size:13px;--input-font-size:16px;--folder-indent:10px;--scrollbar-width:7px;--slider-input-min-width:50px;--color-input-min-width:65px}.lil-gui.autoPlace{max-height:100%;position:fixed;right:15px;top:0;z-index:1001}.lil-gui .controller{align-items:center;display:flex;margin:var(--spacing) 0;padding:0 var(--padding)}.lil-gui .controller.disabled{opacity:.5}.lil-gui .controller.disabled,.lil-gui .controller.disabled *{pointer-events:none!important}.lil-gui .controller>.name{flex-shrink:0;line-height:var(--widget-height);min-width:var(--name-width);padding-right:var(--spacing);white-space:pre}.lil-gui .controller .widget{align-items:center;display:flex;min-height:var(--widget-height);position:relative;width:100%}.lil-gui .controller.string input{color:var(--string-color)}.lil-gui .controller.boolean{cursor:pointer}.lil-gui .controller.color .display{border-radius:var(--widget-border-radius);height:var(--widget-height);position:relative;width:100%}.lil-gui .controller.color input[type=color]{cursor:pointer;height:100%;opacity:0;width:100%}.lil-gui .controller.color input[type=text]{flex-shrink:0;font-family:var(--font-family-mono);margin-left:var(--spacing);min-width:var(--color-input-min-width);width:var(--color-input-width)}.lil-gui .controller.option select{max-width:100%;opacity:0;position:absolute;width:100%}.lil-gui .controller.option .display{background:var(--widget-color);border-radius:var(--widget-border-radius);height:var(--widget-height);line-height:var(--widget-height);max-width:100%;overflow:hidden;padding-left:.55em;padding-right:1.75em;pointer-events:none;position:relative;word-break:break-all}.lil-gui .controller.option .display.active{background:var(--focus-color)}.lil-gui .controller.option .display:after{bottom:0;content:"↕";font-family:lil-gui;padding-right:.375em;position:absolute;right:0;top:0}.lil-gui .controller.option .widget,.lil-gui .controller.option select{cursor:pointer}.lil-gui .controller.number input{color:var(--number-color)}.lil-gui .controller.number.hasSlider input{flex-shrink:0;margin-left:var(--spacing);min-width:var(--slider-input-min-width);width:var(--slider-input-width)}.lil-gui .controller.number .slider{background:var(--widget-color);border-radius:var(--widget-border-radius);cursor:ew-resize;height:var(--widget-height);overflow:hidden;padding-right:var(--slider-knob-width);touch-action:pan-y;width:100%}.lil-gui .controller.number .slider.active{background:var(--focus-color)}.lil-gui .controller.number .slider.active .fill{opacity:.95}.lil-gui .controller.number .fill{border-right:var(--slider-knob-width) solid var(--number-color);box-sizing:content-box;height:100%}.lil-gui-dragging .lil-gui{--hover-color:var(--widget-color)}.lil-gui-dragging *{cursor:ew-resize!important}.lil-gui-dragging.lil-gui-vertical *{cursor:ns-resize!important}.lil-gui .title{-webkit-tap-highlight-color:transparent;text-decoration-skip:objects;cursor:pointer;font-weight:600;height:var(--title-height);line-height:calc(var(--title-height) - 4px);outline:none;padding:0 var(--padding)}.lil-gui .title:before{content:"▾";display:inline-block;font-family:lil-gui;padding-right:2px}.lil-gui .title:active{background:var(--title-background-color);opacity:.75}.lil-gui.root>.title:focus{text-decoration:none!important}.lil-gui.closed>.title:before{content:"▸"}.lil-gui.closed>.children{opacity:0;transform:translateY(-7px)}.lil-gui.closed:not(.transition)>.children{display:none}.lil-gui.transition>.children{overflow:hidden;pointer-events:none;transition-duration:.3s;transition-property:height,opacity,transform;transition-timing-function:cubic-bezier(.2,.6,.35,1)}.lil-gui .children:empty:before{content:"Empty";display:block;font-style:italic;height:var(--widget-height);line-height:var(--widget-height);margin:var(--spacing) 0;opacity:.5;padding:0 var(--padding)}.lil-gui.root>.children>.lil-gui>.title{border-width:0;border-bottom:1px solid var(--widget-color);border-left:0 solid var(--widget-color);border-right:0 solid var(--widget-color);border-top:1px solid var(--widget-color);transition:border-color .3s}.lil-gui.root>.children>.lil-gui.closed>.title{border-bottom-color:transparent}.lil-gui+.controller{border-top:1px solid var(--widget-color);margin-top:0;padding-top:var(--spacing)}.lil-gui .lil-gui .lil-gui>.title{border:none}.lil-gui .lil-gui .lil-gui>.children{border:none;border-left:2px solid var(--widget-color);margin-left:var(--folder-indent)}.lil-gui .lil-gui .controller{border:none}.lil-gui button,.lil-gui input,.lil-gui label{-webkit-tap-highlight-color:transparent}.lil-gui input{background:var(--widget-color);border:0;border-radius:var(--widget-border-radius);color:var(--text-color);font-family:var(--font-family);font-size:var(--input-font-size);height:var(--widget-height);outline:none;width:100%}.lil-gui input:disabled{opacity:1}.lil-gui input[type=number],.lil-gui input[type=text]{-moz-appearance:textfield;padding:var(--widget-padding)}.lil-gui input[type=number]:focus,.lil-gui input[type=text]:focus{background:var(--focus-color)}.lil-gui input[type=checkbox]{appearance:none;border-radius:var(--widget-border-radius);cursor:pointer;height:var(--checkbox-size);text-align:center;width:var(--checkbox-size)}.lil-gui input[type=checkbox]:checked:before{content:"✓";font-family:lil-gui;font-size:var(--checkbox-size);line-height:var(--checkbox-size)}.lil-gui button{background:var(--widget-color);border:none;border-radius:var(--widget-border-radius);color:var(--text-color);cursor:pointer;font-family:var(--font-family);font-size:var(--font-size);height:var(--widget-height);outline:none;text-transform:none;width:100%}.lil-gui button:active{background:var(--focus-color)}@font-face{font-family:lil-gui;src:url("data:application/font-woff;charset=utf-8;base64,d09GRgABAAAAAAUsAAsAAAAACJwAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAABHU1VCAAABCAAAAH4AAADAImwmYE9TLzIAAAGIAAAAPwAAAGBKqH5SY21hcAAAAcgAAAD0AAACrukyyJBnbHlmAAACvAAAAF8AAACEIZpWH2hlYWQAAAMcAAAAJwAAADZfcj2zaGhlYQAAA0QAAAAYAAAAJAC5AHhobXR4AAADXAAAABAAAABMAZAAAGxvY2EAAANsAAAAFAAAACgCEgIybWF4cAAAA4AAAAAeAAAAIAEfABJuYW1lAAADoAAAASIAAAIK9SUU/XBvc3QAAATEAAAAZgAAAJCTcMc2eJxVjbEOgjAURU+hFRBK1dGRL+ALnAiToyMLEzFpnPz/eAshwSa97517c/MwwJmeB9kwPl+0cf5+uGPZXsqPu4nvZabcSZldZ6kfyWnomFY/eScKqZNWupKJO6kXN3K9uCVoL7iInPr1X5baXs3tjuMqCtzEuagm/AAlzQgPAAB4nGNgYRBlnMDAysDAYM/gBiT5oLQBAwuDJAMDEwMrMwNWEJDmmsJwgCFeXZghBcjlZMgFCzOiKOIFAB71Bb8AeJy1kjFuwkAQRZ+DwRAwBtNQRUGKQ8OdKCAWUhAgKLhIuAsVSpWz5Bbkj3dEgYiUIszqWdpZe+Z7/wB1oCYmIoboiwiLT2WjKl/jscrHfGg/pKdMkyklC5Zs2LEfHYpjcRoPzme9MWWmk3dWbK9ObkWkikOetJ554fWyoEsmdSlt+uR0pCJR34b6t/TVg1SY3sYvdf8vuiKrpyaDXDISiegp17p7579Gp3p++y7HPAiY9pmTibljrr85qSidtlg4+l25GLCaS8e6rRxNBmsnERunKbaOObRz7N72ju5vdAjYpBXHgJylOAVsMseDAPEP8LYoUHicY2BiAAEfhiAGJgZWBgZ7RnFRdnVJELCQlBSRlATJMoLV2DK4glSYs6ubq5vbKrJLSbGrgEmovDuDJVhe3VzcXFwNLCOILB/C4IuQ1xTn5FPilBTj5FPmBAB4WwoqAHicY2BkYGAA4sk1sR/j+W2+MnAzpDBgAyEMQUCSg4EJxAEAwUgFHgB4nGNgZGBgSGFggJMhDIwMqEAYAByHATJ4nGNgAIIUNEwmAABl3AGReJxjYAACIQYlBiMGJ3wQAEcQBEV4nGNgZGBgEGZgY2BiAAEQyQWEDAz/wXwGAAsPATIAAHicXdBNSsNAHAXwl35iA0UQXYnMShfS9GPZA7T7LgIu03SSpkwzYTIt1BN4Ak/gKTyAeCxfw39jZkjymzcvAwmAW/wgwHUEGDb36+jQQ3GXGot79L24jxCP4gHzF/EIr4jEIe7wxhOC3g2TMYy4Q7+Lu/SHuEd/ivt4wJd4wPxbPEKMX3GI5+DJFGaSn4qNzk8mcbKSR6xdXdhSzaOZJGtdapd4vVPbi6rP+cL7TGXOHtXKll4bY1Xl7EGnPtp7Xy2n00zyKLVHfkHBa4IcJ2oD3cgggWvt/V/FbDrUlEUJhTn/0azVWbNTNr0Ens8de1tceK9xZmfB1CPjOmPH4kitmvOubcNpmVTN3oFJyjzCvnmrwhJTzqzVj9jiSX911FjeAAB4nG3HMRKCMBBA0f0giiKi4DU8k0V2GWbIZDOh4PoWWvq6J5V8If9NVNQcaDhyouXMhY4rPTcG7jwYmXhKq8Wz+p762aNaeYXom2n3m2dLTVgsrCgFJ7OTmIkYbwIbC6vIB7WmFfAAAA==") format("woff")}@media (pointer:coarse){.lil-gui.allow-touch-styles,.lil-gui.allow-touch-styles .lil-gui{--widget-height:28px;--padding:6px;--spacing:6px;--font-size:13px;--input-font-size:16px;--folder-indent:10px;--scrollbar-width:7px;--slider-input-min-width:50px;--color-input-min-width:65px}}@media (hover:hover){.lil-gui .controller.color .display:hover:before{border:1px solid #fff9;border-radius:var(--widget-border-radius);bottom:0;content:" ";display:block;left:0;position:absolute;right:0;top:0}.lil-gui .controller.option .display.focus{background:var(--focus-color)}.lil-gui .controller.number .slider:hover,.lil-gui .controller.option .widget:hover .display{background:var(--hover-color)}body:not(.lil-gui-dragging) .lil-gui .title:hover{background:var(--title-background-color);opacity:.85}.lil-gui .title:focus{text-decoration:underline var(--focus-color)}.lil-gui input:hover{background:var(--hover-color)}.lil-gui input:active{background:var(--focus-color)}.lil-gui input[type=checkbox]:focus{box-shadow:inset 0 0 0 1px var(--focus-color)}.lil-gui button:hover{background:var(--hover-color)}.lil-gui button:focus{box-shadow:inset 0 0 0 1px var(--focus-color)}}'),u=true),e?e.appendChild(this.domElement):i&&(this.domElement.classList.add("autoPlace"),document.body.appendChild(this.domElement)),s&&this.domElement.style.setProperty("--width",s+"px"),this._closeFolders=l;}add(t,e,s,n,l){if(Object(s)===s)return new d(this,t,e,s);const r=t[e];switch(typeof r){case "number":return new h(this,t,e,s,n,l);case "boolean":return new i(this,t,e);case "string":return new c(this,t,e);case "function":return new a(this,t,e)}console.error("gui.add failed\n\tproperty:",e,"\n\tobject:",t,"\n\tvalue:",r);}addColor(t,i,e=1){return new o(this,t,i,e)}addFolder(t){const i=new p({parent:this,title:t});return this.root._closeFolders&&i.close(),i}load(t,i=true){return t.controllers&&this.controllers.forEach(i=>{i instanceof a||i._name in t.controllers&&i.load(t.controllers[i._name]);}),i&&t.folders&&this.folders.forEach(i=>{i._title in t.folders&&i.load(t.folders[i._title]);}),this}save(t=true){const i={controllers:{},folders:{}};return this.controllers.forEach(t=>{if(!(t instanceof a)){if(t._name in i.controllers)throw new Error(`Cannot save GUI with duplicate property "${t._name}"`);i.controllers[t._name]=t.save();}}),t&&this.folders.forEach(t=>{if(t._title in i.folders)throw new Error(`Cannot save GUI with duplicate folder "${t._title}"`);i.folders[t._title]=t.save();}),i}open(t=true){return this._setClosed(!t),this.$title.setAttribute("aria-expanded",!this._closed),this.domElement.classList.toggle("closed",this._closed),this}close(){return this.open(false)}_setClosed(t){this._closed!==t&&(this._closed=t,this._callOnOpenClose(this));}show(t=true){return this._hidden=!t,this.domElement.style.display=this._hidden?"none":"",this}hide(){return this.show(false)}openAnimated(t=true){return this._setClosed(!t),this.$title.setAttribute("aria-expanded",!this._closed),requestAnimationFrame(()=>{const i=this.$children.clientHeight;this.$children.style.height=i+"px",this.domElement.classList.add("transition");const e=t=>{t.target===this.$children&&(this.$children.style.height="",this.domElement.classList.remove("transition"),this.$children.removeEventListener("transitionend",e));};this.$children.addEventListener("transitionend",e);const s=t?this.$children.scrollHeight:0;this.domElement.classList.toggle("closed",!t),requestAnimationFrame(()=>{this.$children.style.height=s+"px";});}),this}title(t){return this._title=t,this.$title.textContent=t,this}reset(t=true){return (t?this.controllersRecursive():this.controllers).forEach(t=>t.reset()),this}onChange(t){return this._onChange=t,this}_callOnChange(t){this.parent&&this.parent._callOnChange(t),void 0!==this._onChange&&this._onChange.call(this,{object:t.object,property:t.property,value:t.getValue(),controller:t});}onFinishChange(t){return this._onFinishChange=t,this}_callOnFinishChange(t){this.parent&&this.parent._callOnFinishChange(t),void 0!==this._onFinishChange&&this._onFinishChange.call(this,{object:t.object,property:t.property,value:t.getValue(),controller:t});}onOpenClose(t){return this._onOpenClose=t,this}_callOnOpenClose(t){this.parent&&this.parent._callOnOpenClose(t),void 0!==this._onOpenClose&&this._onOpenClose.call(this,t);}destroy(){this.parent&&(this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.folders.splice(this.parent.folders.indexOf(this),1)),this.domElement.parentElement&&this.domElement.parentElement.removeChild(this.domElement),Array.from(this.children).forEach(t=>t.destroy());}controllersRecursive(){let t=Array.from(this.controllers);return this.folders.forEach(i=>{t=t.concat(i.controllersRecursive());}),t}foldersRecursive(){let t=Array.from(this.folders);return this.folders.forEach(i=>{t=t.concat(i.foldersRecursive());}),t}}

let objectsConfig = {
  models: [
    {
      name: "Astronaut_mesh", // optional unique id
      url:  "https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb", // required
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale:    { x: 1, y: 1, z: 1 }
    },
    /*{
      name: "Synagogue",
      url:  "https://models.babylonjs.com/Synagogue.glb",
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 45, z: 0 },
      scale:    { x: 1, y: 1, z: 1 }
    }*/
  ],

  camera: {
    position: { x: 0, y: 5, z: 10 },
    target:   { x: 0, y: 0, z: 0 }
  },

  scene: {
    background: "radial-gradient(circle, #ffffff 0%, #999999 100%)",
    lights: [
      {
        type: "directional",
        color: "0xffffff",
        intensity: 1,
        position: { x: 0, y: 100, z: 100 },
        target:   { x: 0, y: 0, z: 0 }
      },
      {
        type: "ambient",
        color: "0x404040",
        intensity: 1
      },
      {
        type: "point",
        color: "0xffffff",
        intensity: 1,
        position: { x: 2, y: 3, z: 4 }
      }
    ]
  }
};

var JSONLDResource = /** @class */ (function () {
    function JSONLDResource(jsonld) {
        this.__jsonld = jsonld;
        this.context = this.getProperty("context");
        this.id = this.getProperty("id");
    }
    JSONLDResource.prototype.getProperty = function (name) {
        var prop = null;
        if (this.__jsonld) {
            prop = this.__jsonld[name];
            if (!prop) {
                // property may have a prepended '@'
                prop = this.__jsonld["@" + name];
            }
        }
        return prop;
    };
    /**
    A function that wraps the getProperty function, which client
    code can use if it is needed to identify when the json value of
    a property is an IRI -- Internationalized Resource Identifier
    
    If the value of the json value is a bare string, then it will be
    wrapped in a json object with the string in the property 'id',
    additionally that property will have a property 'isIRI' which will
    be true for the literal string case, otherwise false meaning the
    returned getProperty should be parsed as before.
    
    **/
    JSONLDResource.prototype.getPropertyAsObject = function (name) {
        var prop = this.getProperty(name);
        if (typeof prop === "string")
            return { id: prop, isIRI: true };
        else if (prop === Object(prop))
            return prop;
        else {
            return null;
        }
    };
    return JSONLDResource;
}());

var __extends$p = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Transform = /** @class */ (function (_super) {
    __extends$p(Transform, _super);
    function Transform(jsonld) {
        var _this = _super.call(this, jsonld) || this;
        _this.isTransform = true;
        _this.isTransform = true;
        return _this;
    }
    return Transform;
}(JSONLDResource));

var distCommonjs$1 = {};

var hasRequiredDistCommonjs$1;

function requireDistCommonjs$1 () {
	if (hasRequiredDistCommonjs$1) return distCommonjs$1;
	hasRequiredDistCommonjs$1 = 1;
	Object.defineProperty(distCommonjs$1, "__esModule", { value: true });
	distCommonjs$1.ViewingHint = distCommonjs$1.ViewingDirection = distCommonjs$1.ServiceType = distCommonjs$1.ServiceProfile = distCommonjs$1.RenderingFormat = distCommonjs$1.MediaType = distCommonjs$1.IIIFResourceType = distCommonjs$1.ExternalResourceType = distCommonjs$1.Behavior = distCommonjs$1.AnnotationMotivation = void 0;
	var AnnotationMotivation;
	(function (AnnotationMotivation) {
	    AnnotationMotivation["BOOKMARKING"] = "oa:bookmarking";
	    AnnotationMotivation["CLASSIFYING"] = "oa:classifying";
	    AnnotationMotivation["COMMENTING"] = "oa:commenting";
	    AnnotationMotivation["DESCRIBING"] = "oa:describing";
	    AnnotationMotivation["EDITING"] = "oa:editing";
	    AnnotationMotivation["HIGHLIGHTING"] = "oa:highlighting";
	    AnnotationMotivation["IDENTIFYING"] = "oa:identifying";
	    AnnotationMotivation["LINKING"] = "oa:linking";
	    AnnotationMotivation["MODERATING"] = "oa:moderating";
	    AnnotationMotivation["PAINTING"] = "sc:painting";
	    AnnotationMotivation["QUESTIONING"] = "oa:questioning";
	    AnnotationMotivation["REPLYING"] = "oa:replying";
	    AnnotationMotivation["TAGGING"] = "oa:tagging";
	    AnnotationMotivation["TRANSCRIBING"] = "oad:transcribing";
	})(AnnotationMotivation || (distCommonjs$1.AnnotationMotivation = AnnotationMotivation = {}));
	var Behavior;
	(function (Behavior) {
	    Behavior["AUTO_ADVANCE"] = "auto-advance";
	    Behavior["CONTINUOUS"] = "continuous";
	    Behavior["FACING_PAGES"] = "facing-pages";
	    Behavior["HIDDEN"] = "hidden";
	    Behavior["INDIVIDUALS"] = "individuals";
	    Behavior["MULTI_PART"] = "multi-part";
	    Behavior["NO_NAV"] = "no-nav";
	    Behavior["NON_PAGED"] = "non-paged";
	    Behavior["PAGED"] = "paged";
	    Behavior["REPEAT"] = "repeat";
	    Behavior["SEQUENCE"] = "sequence";
	    Behavior["THUMBNAIL_NAV"] = "thumbnail-nav";
	    Behavior["TOGETHER"] = "together";
	    Behavior["UNORDERED"] = "unordered";
	})(Behavior || (distCommonjs$1.Behavior = Behavior = {}));
	var ExternalResourceType;
	(function (ExternalResourceType) {
	    ExternalResourceType["CANVAS"] = "canvas";
	    ExternalResourceType["CHOICE"] = "choice";
	    ExternalResourceType["OA_CHOICE"] = "oa:choice";
	    ExternalResourceType["CONTENT_AS_TEXT"] = "contentastext";
	    ExternalResourceType["DATASET"] = "dataset";
	    ExternalResourceType["DOCUMENT"] = "document";
	    ExternalResourceType["IMAGE"] = "image";
	    ExternalResourceType["MODEL"] = "model";
	    ExternalResourceType["MOVING_IMAGE"] = "movingimage";
	    ExternalResourceType["PDF"] = "pdf";
	    ExternalResourceType["PHYSICAL_OBJECT"] = "physicalobject";
	    ExternalResourceType["SOUND"] = "sound";
	    ExternalResourceType["TEXT"] = "text";
	    ExternalResourceType["TEXTUALBODY"] = "textualbody";
	    ExternalResourceType["VIDEO"] = "video";
	})(ExternalResourceType || (distCommonjs$1.ExternalResourceType = ExternalResourceType = {}));
	var IIIFResourceType;
	(function (IIIFResourceType) {
	    IIIFResourceType["ANNOTATION"] = "annotation";
	    IIIFResourceType["ANNOTATION_COLLECTION"] = "annotationcollection";
	    IIIFResourceType["ANNOTATION_PAGE"] = "annotationpage";
	    IIIFResourceType["CANVAS"] = "canvas";
	    IIIFResourceType["COLLECTION"] = "collection";
	    IIIFResourceType["MANIFEST"] = "manifest";
	    IIIFResourceType["RANGE"] = "range";
	    IIIFResourceType["SEQUENCE"] = "sequence";
	})(IIIFResourceType || (distCommonjs$1.IIIFResourceType = IIIFResourceType = {}));
	var MediaType;
	(function (MediaType) {
	    MediaType["APNG"] = "image/apng";
	    MediaType["AUDIO_MP4"] = "audio/mp4";
	    MediaType["AUDIO_OGG"] = "audio/ogg";
	    MediaType["AVIF"] = "audio/avif";
	    MediaType["CORTO"] = "application/corto";
	    MediaType["DICOM"] = "application/dicom";
	    MediaType["DRACO"] = "application/draco";
	    MediaType["EPUB"] = "application/epub+zip";
	    MediaType["GIF"] = "image/gif";
	    MediaType["GIRDER"] = "image/vnd.kitware.girder";
	    MediaType["GLB"] = "model/gltf-binary";
	    MediaType["GLTF"] = "model/gltf+json";
	    MediaType["IIIF_PRESENTATION_2"] = "application/ld+json;profile=\"http://iiif.io/api/presentation/2/context.json\"";
	    MediaType["IIIF_PRESENTATION_3"] = "application/ld+json;profile=\"http://iiif.io/api/presentation/3/context.json\"";
	    MediaType["JPG"] = "image/jpeg";
	    MediaType["M3U8"] = "application/vnd.apple.mpegurl";
	    MediaType["MP3"] = "audio/mp3";
	    MediaType["MPEG"] = "audio/mpeg";
	    MediaType["MPEG_DASH"] = "application/dash+xml";
	    MediaType["OBJ"] = "model/obj";
	    MediaType["OPF"] = "application/oebps-package+xml";
	    MediaType["PDF"] = "application/pdf";
	    MediaType["PLY"] = "application/ply";
	    MediaType["PNG"] = "image/png";
	    MediaType["SVG"] = "image/svg+xml";
	    MediaType["THREEJS"] = "application/vnd.threejs+json";
	    MediaType["USDZ"] = "model/vnd.usd+zip";
	    MediaType["VIDEO_MP4"] = "video/mp4";
	    MediaType["VIDEO_OGG"] = "video/ogg";
	    MediaType["WAV"] = "audio/wav";
	    MediaType["WEBM"] = "video/webm";
	    MediaType["WEBP"] = "image/webp";
	})(MediaType || (distCommonjs$1.MediaType = MediaType = {}));
	var RenderingFormat;
	(function (RenderingFormat) {
	    RenderingFormat["DOC"] = "application/msword";
	    RenderingFormat["DOCX"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	    RenderingFormat["ODT"] = "application/vnd.oasis.opendocument.text";
	    RenderingFormat["PDF"] = "application/pdf";
	})(RenderingFormat || (distCommonjs$1.RenderingFormat = RenderingFormat = {}));
	var ServiceProfile;
	(function (ServiceProfile) {
	    // image api
	    ServiceProfile["IMAGE_0_COMPLIANCE_LEVEL_0"] = "http://library.stanford.edu/iiif/image-api/compliance.html#level0";
	    ServiceProfile["IMAGE_0_COMPLIANCE_LEVEL_1"] = "http://library.stanford.edu/iiif/image-api/compliance.html#level1";
	    ServiceProfile["IMAGE_0_COMPLIANCE_LEVEL_2"] = "http://library.stanford.edu/iiif/image-api/compliance.html#level2";
	    ServiceProfile["IMAGE_0_CONFORMANCE_LEVEL_0"] = "http://library.stanford.edu/iiif/image-api/conformance.html#level0";
	    ServiceProfile["IMAGE_0_CONFORMANCE_LEVEL_1"] = "http://library.stanford.edu/iiif/image-api/conformance.html#level1";
	    ServiceProfile["IMAGE_0_CONFORMANCE_LEVEL_2"] = "http://library.stanford.edu/iiif/image-api/conformance.html#level2";
	    ServiceProfile["IMAGE_1_COMPLIANCE_LEVEL_0"] = "http://library.stanford.edu/iiif/image-api/1.1/compliance.html#level0";
	    ServiceProfile["IMAGE_1_COMPLIANCE_LEVEL_1"] = "http://library.stanford.edu/iiif/image-api/1.1/compliance.html#level1";
	    ServiceProfile["IMAGE_1_COMPLIANCE_LEVEL_2"] = "http://library.stanford.edu/iiif/image-api/1.1/compliance.html#level2";
	    ServiceProfile["IMAGE_1_CONFORMANCE_LEVEL_0"] = "http://library.stanford.edu/iiif/image-api/1.1/conformance.html#level0";
	    ServiceProfile["IMAGE_1_CONFORMANCE_LEVEL_1"] = "http://library.stanford.edu/iiif/image-api/1.1/conformance.html#level1";
	    ServiceProfile["IMAGE_1_CONFORMANCE_LEVEL_2"] = "http://library.stanford.edu/iiif/image-api/1.1/conformance.html#level2";
	    ServiceProfile["IMAGE_1_LEVEL_0"] = "http://iiif.io/api/image/1/level0.json";
	    ServiceProfile["IMAGE_1_PROFILE_LEVEL_0"] = "http://iiif.io/api/image/1/profiles/level0.json";
	    ServiceProfile["IMAGE_1_LEVEL_1"] = "http://iiif.io/api/image/1/level1.json";
	    ServiceProfile["IMAGE_1_PROFILE_LEVEL_1"] = "http://iiif.io/api/image/1/profiles/level1.json";
	    ServiceProfile["IMAGE_1_LEVEL_2"] = "http://iiif.io/api/image/1/level2.json";
	    ServiceProfile["IMAGE_1_PROFILE_LEVEL_2"] = "http://iiif.io/api/image/1/profiles/level2.json";
	    ServiceProfile["IMAGE_2_LEVEL_0"] = "http://iiif.io/api/image/2/level0.json";
	    ServiceProfile["IMAGE_2_PROFILE_LEVEL_0"] = "http://iiif.io/api/image/2/profiles/level0.json";
	    ServiceProfile["IMAGE_2_LEVEL_1"] = "http://iiif.io/api/image/2/level1.json";
	    ServiceProfile["IMAGE_2_PROFILE_LEVEL_1"] = "http://iiif.io/api/image/2/profiles/level1.json";
	    ServiceProfile["IMAGE_2_LEVEL_2"] = "http://iiif.io/api/image/2/level2.json";
	    ServiceProfile["IMAGE_2_PROFILE_LEVEL_2"] = "http://iiif.io/api/image/2/profiles/level2.json";
	    // auth api
	    ServiceProfile["AUTH_0_CLICK_THROUGH"] = "http://iiif.io/api/auth/0/login/clickthrough";
	    ServiceProfile["AUTH_0_LOGIN"] = "http://iiif.io/api/auth/0/login";
	    ServiceProfile["AUTH_0_LOGOUT"] = "http://iiif.io/api/auth/0/logout";
	    ServiceProfile["AUTH_0_RESTRICTED"] = "http://iiif.io/api/auth/0/login/restricted";
	    ServiceProfile["AUTH_0_TOKEN"] = "http://iiif.io/api/auth/0/token";
	    ServiceProfile["AUTH_1_CLICK_THROUGH"] = "http://iiif.io/api/auth/1/clickthrough";
	    ServiceProfile["AUTH_1_EXTERNAL"] = "http://iiif.io/api/auth/1/external";
	    ServiceProfile["AUTH_1_KIOSK"] = "http://iiif.io/api/auth/1/kiosk";
	    ServiceProfile["AUTH_1_LOGIN"] = "http://iiif.io/api/auth/1/login";
	    ServiceProfile["AUTH_1_LOGOUT"] = "http://iiif.io/api/auth/1/logout";
	    ServiceProfile["AUTH_1_PROBE"] = "http://iiif.io/api/auth/1/probe";
	    ServiceProfile["AUTH_1_TOKEN"] = "http://iiif.io/api/auth/1/token";
	    // search api
	    ServiceProfile["SEARCH_0"] = "http://iiif.io/api/search/0/search";
	    ServiceProfile["SEARCH_0_AUTO_COMPLETE"] = "http://iiif.io/api/search/0/autocomplete";
	    ServiceProfile["SEARCH_1"] = "http://iiif.io/api/search/1/search";
	    ServiceProfile["SEARCH_1_AUTO_COMPLETE"] = "http://iiif.io/api/search/1/autocomplete";
	    ServiceProfile["SEARCH_2"] = "http://iiif.io/api/search/2/search";
	    ServiceProfile["SEARCH_2_AUTO_COMPLETE"] = "http://iiif.io/api/search/2/autocomplete";
	    // extensions
	    ServiceProfile["TRACKING_EXTENSIONS"] = "http://universalviewer.io/tracking-extensions-profile";
	    ServiceProfile["UI_EXTENSIONS"] = "http://universalviewer.io/ui-extensions-profile";
	    ServiceProfile["PRINT_EXTENSIONS"] = "http://universalviewer.io/print-extensions-profile";
	    ServiceProfile["SHARE_EXTENSIONS"] = "http://universalviewer.io/share-extensions-profile";
	    ServiceProfile["DOWNLOAD_EXTENSIONS"] = "http://universalviewer.io/download-extensions-profile";
	    // other
	    ServiceProfile["OTHER_MANIFESTATIONS"] = "http://iiif.io/api/otherManifestations.json";
	    ServiceProfile["IXIF"] = "http://wellcomelibrary.org/ld/ixif/0/alpha.json";
	})(ServiceProfile || (distCommonjs$1.ServiceProfile = ServiceProfile = {}));
	var ServiceType;
	(function (ServiceType) {
	    ServiceType["IMAGE_SERVICE_2"] = "ImageService2";
	    ServiceType["IMAGE_SERVICE_3"] = "ImageService3";
	    ServiceType["SEARCH_SERVICE_2"] = "SearchService2";
	    ServiceType["AUTO_COMPLETE_SERVICE_2"] = "AutoCompleteService2";
	})(ServiceType || (distCommonjs$1.ServiceType = ServiceType = {}));
	var ViewingDirection;
	(function (ViewingDirection) {
	    ViewingDirection["BOTTOM_TO_TOP"] = "bottom-to-top";
	    ViewingDirection["LEFT_TO_RIGHT"] = "left-to-right";
	    ViewingDirection["RIGHT_TO_LEFT"] = "right-to-left";
	    ViewingDirection["TOP_TO_BOTTOM"] = "top-to-bottom";
	})(ViewingDirection || (distCommonjs$1.ViewingDirection = ViewingDirection = {}));
	var ViewingHint;
	(function (ViewingHint) {
	    ViewingHint["CONTINUOUS"] = "continuous";
	    ViewingHint["INDIVIDUALS"] = "individuals";
	    ViewingHint["NON_PAGED"] = "non-paged";
	    ViewingHint["PAGED"] = "paged";
	    ViewingHint["TOP"] = "top";
	})(ViewingHint || (distCommonjs$1.ViewingHint = ViewingHint = {}));
	
	return distCommonjs$1;
}

var distCommonjsExports$1 = /*@__PURE__*/ requireDistCommonjs$1();

var __extends$o = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var ManifestResource = /** @class */ (function (_super) {
    __extends$o(ManifestResource, _super);
    function ManifestResource(jsonld, options) {
        var _this = _super.call(this, jsonld) || this;
        _this.options = options;
        return _this;
    }
    ManifestResource.prototype.getIIIFResourceType = function () {
        return Utils.normaliseType(this.getProperty("type"));
    };
    /**
     * returns the PropertyValue which in turn allows a language-specific string
     * encoded in the json as the "label" property
     * @example
     * var label = manifest.getLabel().getValue(); // returns the string for default locale
     *
     * @example
     * var label = manifest.getLabel().getValue(locale); // locale a string , examples
     *                                                   // would be "fr", "en-US",
     **/
    ManifestResource.prototype.getLabel = function () {
        var label = this.getProperty("label");
        if (label) {
            return PropertyValue.parse(label, this.options.locale);
        }
        return new PropertyValue([], this.options.locale);
    };
    ManifestResource.prototype.getSummary = function () {
        var summary = this.getProperty("summary");
        if (summary) {
            return PropertyValue.parse(summary, this.options.locale);
        }
        return new PropertyValue([], this.options.locale);
    };
    ManifestResource.prototype.getDefaultLabel = function () {
        return this.getLabel().getValue(this.options.locale);
    };
    ManifestResource.prototype.getMetadata = function () {
        var _metadata = this.getProperty("metadata");
        var metadata = [];
        if (!_metadata)
            return metadata;
        for (var i = 0; i < _metadata.length; i++) {
            var item = _metadata[i];
            var metadataItem = new LabelValuePair(this.options.locale);
            metadataItem.parse(item);
            metadata.push(metadataItem);
        }
        return metadata;
    };
    ManifestResource.prototype.getRendering = function (format) {
        var renderings = this.getRenderings();
        for (var i = 0; i < renderings.length; i++) {
            var rendering = renderings[i];
            if (rendering.getFormat() === format) {
                return rendering;
            }
        }
        return null;
    };
    ManifestResource.prototype.getRenderings = function () {
        var rendering;
        // if passing a manifesto-parsed object, use the __jsonld.rendering property,
        // otherwise look for a rendering property
        if (this.__jsonld) {
            rendering = this.__jsonld.rendering;
        }
        else {
            rendering = this.rendering;
        }
        var renderings = [];
        if (!rendering)
            return renderings;
        // coerce to array
        if (!Array.isArray(rendering)) {
            rendering = [rendering];
        }
        for (var i = 0; i < rendering.length; i++) {
            var r = rendering[i];
            renderings.push(new Rendering(r, this.options));
        }
        return renderings;
    };
    ManifestResource.prototype.getRequiredStatement = function () {
        var requiredStatement = null;
        var _requiredStatement = this.getProperty("requiredStatement");
        if (_requiredStatement) {
            requiredStatement = new LabelValuePair(this.options.locale);
            requiredStatement.parse(_requiredStatement);
        }
        return requiredStatement;
    };
    ManifestResource.prototype.getService = function (profile) {
        return Utils.getService(this, profile);
    };
    ManifestResource.prototype.getServices = function () {
        return Utils.getServices(this);
    };
    ManifestResource.prototype.getThumbnail = function () {
        var thumbnail = this.getProperty("thumbnail");
        if (Array.isArray(thumbnail)) {
            thumbnail = thumbnail[0];
        }
        if (thumbnail) {
            return new Thumbnail(thumbnail, this.options);
        }
        return null;
    };
    ManifestResource.prototype.isAnnotation = function () {
        return this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.ANNOTATION;
    };
    ManifestResource.prototype.isCanvas = function () {
        return this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.CANVAS;
    };
    ManifestResource.prototype.isCollection = function () {
        return this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.COLLECTION;
    };
    ManifestResource.prototype.isManifest = function () {
        return this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.MANIFEST;
    };
    ManifestResource.prototype.isRange = function () {
        return this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.RANGE;
    };
    // this different implementation is necessary until such time as the
    // SCENE is added to the @iiif/vocabulary package.
    ManifestResource.prototype.isScene = function () {
        return (this.getIIIFResourceType() ===
            Utils.normaliseType("Scene"));
    };
    ManifestResource.prototype.isSequence = function () {
        return this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.SEQUENCE;
    };
    return ManifestResource;
}(JSONLDResource));

var __extends$n = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Resource = /** @class */ (function (_super) {
    __extends$n(Resource, _super);
    function Resource(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    Resource.prototype.getFormat = function () {
        var format = this.getProperty("format");
        if (format) {
            return format.toLowerCase();
        }
        return null;
    };
    Resource.prototype.getResources = function () {
        var resources = [];
        if (!this.__jsonld.resources)
            return resources;
        for (var i = 0; i < this.__jsonld.resources.length; i++) {
            var a = this.__jsonld.resources[i];
            var annotation = new Annotation(a, this.options);
            resources.push(annotation);
        }
        return resources;
    };
    Resource.prototype.getType = function () {
        var type = this.getProperty("type");
        if (type) {
            return Utils.normaliseType(type);
        }
        return null;
    };
    Resource.prototype.getWidth = function () {
        return this.getProperty("width");
    };
    Resource.prototype.getHeight = function () {
        return this.getProperty("height");
    };
    Resource.prototype.getMaxWidth = function () {
        return this.getProperty("maxWidth");
    };
    Resource.prototype.getMaxHeight = function () {
        var maxHeight = this.getProperty("maxHeight");
        // if a maxHeight hasn't been specified, default to maxWidth.
        // maxWidth in essence becomes maxEdge
        if (!maxHeight) {
            return this.getMaxWidth();
        }
        return null;
    };
    return Resource;
}(ManifestResource));

var __extends$m = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var IIIFResource = /** @class */ (function (_super) {
    __extends$m(IIIFResource, _super);
    function IIIFResource(jsonld, options) {
        var _this = _super.call(this, jsonld, options) || this;
        _this.index = -1;
        _this.isLoaded = false;
        var defaultOptions = {
            defaultLabel: "-",
            locale: "en-GB",
            resource: _this,
            pessimisticAccessControl: false,
        };
        _this.options = Object.assign(defaultOptions, options);
        return _this;
    }
    /**
     * @deprecated
     */
    IIIFResource.prototype.getAttribution = function () {
        //console.warn('getAttribution will be deprecated, use getRequiredStatement instead.');
        var attribution = this.getProperty("attribution");
        if (attribution) {
            return PropertyValue.parse(attribution, this.options.locale);
        }
        return new PropertyValue([], this.options.locale);
    };
    IIIFResource.prototype.getDescription = function () {
        var description = this.getProperty("description");
        if (description) {
            return PropertyValue.parse(description, this.options.locale);
        }
        return new PropertyValue([], this.options.locale);
    };
    IIIFResource.prototype.getHomepage = function () {
        var homepage = this.getProperty("homepage");
        if (!homepage)
            return null;
        if (typeof homepage == "string")
            return homepage;
        if (Array.isArray(homepage) && homepage.length) {
            homepage = homepage[0];
        }
        return homepage["@id"] || homepage.id;
    };
    IIIFResource.prototype.getIIIFResourceType = function () {
        return Utils.normaliseType(this.getProperty("type"));
    };
    IIIFResource.prototype.getLogo = function () {
        var logo = this.getProperty("logo");
        // Presentation 3.
        // The logo is exclusive to the "provider" property, which is of type "Agent".
        // In order to fulfil `manifest.getLogo()` we should check
        // When P3 is fully supported, the following should work.
        // return this.getProvider()?.getLogo();
        if (!logo) {
            var provider = this.getProperty("provider");
            if (!provider) {
                return null;
            }
            // get the first agent in the provider array with a logo
            var agent = provider.find(function (item) { return item.logo !== undefined; });
            if (agent && agent.logo !== undefined) {
                logo = agent.logo;
            }
            else {
                logo = null;
            }
        }
        if (!logo)
            return null;
        if (typeof logo === "string")
            return logo;
        if (Array.isArray(logo) && logo.length) {
            logo = logo[0];
        }
        return logo["@id"] || (logo === null || logo === void 0 ? void 0 : logo.id);
    };
    IIIFResource.prototype.getLicense = function () {
        return Utils.getLocalisedValue(this.getProperty("license"), this.options.locale);
    };
    IIIFResource.prototype.getRights = function () {
        var rights = this.getProperty("rights");
        if (!rights)
            return null;
        if (typeof rights === "string")
            return rights;
        if (Array.isArray(rights) && rights.length) {
            rights = rights[0];
        }
        return rights["@id"] || rights.id;
    };
    IIIFResource.prototype.getNavDate = function () {
        return new Date(this.getProperty("navDate"));
    };
    IIIFResource.prototype.getRelated = function () {
        return this.getProperty("related");
    };
    IIIFResource.prototype.getSeeAlso = function () {
        return this.getProperty("seeAlso");
    };
    IIIFResource.prototype.getTrackingLabel = function () {
        var service = (this.getService(distCommonjsExports$1.ServiceProfile.TRACKING_EXTENSIONS));
        if (service) {
            return service.getProperty("trackingLabel");
        }
        return "";
    };
    IIIFResource.prototype.getDefaultTree = function () {
        this.defaultTree = new TreeNode("root");
        this.defaultTree.data = this;
        return this.defaultTree;
    };
    IIIFResource.prototype.getRequiredStatement = function () {
        var requiredStatement = null;
        var _requiredStatement = this.getProperty("requiredStatement");
        if (_requiredStatement) {
            requiredStatement = new LabelValuePair(this.options.locale);
            requiredStatement.parse(_requiredStatement);
        }
        else {
            // fall back to attribution (if it exists)
            var attribution = this.getAttribution();
            if (attribution && attribution.length) {
                requiredStatement = new LabelValuePair(this.options.locale);
                requiredStatement.value = attribution;
            }
        }
        return requiredStatement;
    };
    IIIFResource.prototype.isCollection = function () {
        if (this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.COLLECTION) {
            return true;
        }
        return false;
    };
    IIIFResource.prototype.isManifest = function () {
        if (this.getIIIFResourceType() === distCommonjsExports$1.IIIFResourceType.MANIFEST) {
            return true;
        }
        return false;
    };
    IIIFResource.prototype.load = function () {
        var that = this;
        return new Promise(function (resolve) {
            if (that.isLoaded) {
                resolve(that);
            }
            else {
                var options_1 = that.options;
                options_1.navDate = that.getNavDate();
                var id = that.__jsonld.id;
                if (!id) {
                    id = that.__jsonld["@id"];
                }
                Utils.loadManifest(id).then(function (data) {
                    that.parentLabel = that.getLabel().getValue(options_1.locale);
                    var parsed = Deserialiser.parse(data, options_1);
                    that = Object.assign(that, parsed);
                    //that.parentCollection = options.resource.parentCollection;
                    that.index = options_1.index;
                    resolve(that);
                });
            }
        });
    };
    return IIIFResource;
}(ManifestResource));

var __extends$l = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/**
    Developer note: This implementation does not strictly adhere
    to the description of SpecificResource in the Web Annotation Model
    document https://www.w3.org/TR/annotation-model/
    section 4 : https://www.w3.org/TR/annotation-model/#specific-resources
    
    The getTransform() method returning an Array of 3D Transfom resources, is
    an extension of SpecificResource beyond the web annotation model.
*/
var SpecificResource = /** @class */ (function (_super) {
    __extends$l(SpecificResource, _super);
    function SpecificResource(jsonld, options) {
        var _this = _super.call(this, jsonld, options) || this;
        /*
        property distinguishing instances of SpecificResource from instances of AnnotionBody.
        The return type of the Annotation.getBody() method is an array of instances of the
        union type ( AnnotationBody | SpecificResource )
        */
        _this.isAnnotationBody = false;
        /*
        property distinguishing instances of SpecificResource from instances of AnnotionBody.
        The return type of the Annotation.getBody() method is an array of instances of the
        union type ( AnnotationBody | SpecificResource )
        */
        _this.isSpecificResource = true;
        _this.isSpecificResource = true;
        return _this;
    }
    SpecificResource.prototype.getScope = function () {
        var raw = this.getPropertyAsObject("scope");
        if (raw === null || raw === void 0 ? void 0 : raw.isIRI)
            return raw;
        if (raw) {
            var scope = [].concat(raw)[0];
            if (scope && scope["type"] === "Annotation")
                return new Annotation(scope, this.options);
        }
        return null;
    };
    SpecificResource.prototype.getSource = function () {
        var raw = this.getPropertyAsObject("source");
        if (raw.isIRI)
            return raw;
        /*
            this logic gets a little convoluted, because we have to preserve
            the cases where the raw json is an array for the sources of a
            SpecificResource applied to an annotation body, while for a target
            of an Annotation we just want a single object
        */
        // case of a source of a SpecificResource which is an Annotation target
        if (raw) {
            var containerTypes = ["Scene", "Canvas"];
            var singleItem = [].concat(raw)[0];
            if (containerTypes.includes(singleItem["type"]))
                return singleItem;
        }
        if (raw) {
            var item = [].concat(raw)[0];
            if (item) {
                return AnnotationBodyParser.BuildFromJson(item, this.options);
            }
        }
        throw new Error("cannot resolve Source " + JSON.stringify(raw));
    };
    Object.defineProperty(SpecificResource.prototype, "Source", {
        get: function () {
            return this.getSource();
        },
        enumerable: false,
        configurable: true
    });
    SpecificResource.prototype.getSelector = function () {
        var raw = this.getProperty("selector");
        if (raw) {
            var item = [].concat(raw)[0];
            if (item) {
                if (item["type"] === "PointSelector")
                    return new PointSelector(item);
            }
            throw new Error("unable to resolve SpecificResource selector " +
                JSON.stringify(this.__jsonld));
        }
        return null;
    };
    Object.defineProperty(SpecificResource.prototype, "Selector", {
        get: function () {
            return this.getSelector();
        },
        enumerable: false,
        configurable: true
    });
    SpecificResource.prototype.getTransform = function () {
        var retVal = [];
        var transformItems = this.getProperty("transform");
        for (var i = 0; i < transformItems.length; ++i) {
            var transformItem = transformItems[i];
            retVal.push(TransformParser.BuildFromJson(transformItem));
        }
        return retVal;
    };
    Object.defineProperty(SpecificResource.prototype, "Transform", {
        get: function () {
            return this.getTransform();
        },
        enumerable: false,
        configurable: true
    });
    return SpecificResource;
}(ManifestResource));

var __extends$k = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/**
With the 3D extensions to the IIIF Presentation API the name of this
class is misleading, but for now is being retained for the sake backward
compatibility with earlier manifesto code and tests.

The 3D extensions allow that the body property of an annotation can be
a light, camera, or model, or a SpecificResource object wrapping a light, camera,
or model.
**/
var AnnotationBody = /** @class */ (function (_super) {
    __extends$k(AnnotationBody, _super);
    function AnnotationBody(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    // Get resource URI ID from either body (for content resource) or source (for specific resource)
    AnnotationBody.prototype.getResourceID = function () {
        if (this.isSpecificResource()) {
            var source = this.getSource();
            if (source instanceof AnnotationBody) {
                return source.id;
            }
            else {
                return source || this.id;
            }
        }
        else {
            return this.id;
        }
    };
    // Format, Type, Width, and Height are the body properties supported
    // in the code that supports Presentation 3
    AnnotationBody.prototype.getFormat = function () {
        var format = this.getPropertyFromSelfOrSource("format");
        if (format) {
            return Utils.getMediaType(format);
        }
        return null;
    };
    AnnotationBody.prototype.getType = function () {
        var type = this.getPropertyFromSelfOrSource("type");
        if (type) {
            return Utils.normaliseType(type);
        }
        return null;
    };
    AnnotationBody.prototype.getWidth = function () {
        return this.getProperty("width");
    };
    AnnotationBody.prototype.getHeight = function () {
        return this.getProperty("height");
    };
    AnnotationBody.prototype.getTransform = function () {
        var transform = this.getProperty("transform");
        if (transform) {
            return this.getProperty("transform").map(function (transform) {
                return TransformParser.BuildFromJson(transform);
            });
        }
        return null;
    };
    AnnotationBody.prototype.getTransformMatrix = function () {
        var transform = this.getTransform();
        if (transform && transform.length) {
            return combineTransformsToMatrix(transform);
        }
        return null;
    };
    AnnotationBody.prototype.getTransformSet = function () {
        var transform = this.getTransform();
        if (transform && transform.length) {
            return combineTransformsToTRS(transform);
        }
        return null;
    };
    // Some properties may be on this object or (for SpecificResource) in source object
    AnnotationBody.prototype.getPropertyFromSelfOrSource = function (prop) {
        if (this.isSpecificResource() &&
            this.getSource() instanceof AnnotationBody) {
            return this.getSource().getProperty(prop);
        }
        else {
            return this.getProperty(prop);
        }
    };
    // Some labels may be on this object or (for SpecificResource) in source object
    AnnotationBody.prototype.getLabelFromSelfOrSource = function () {
        if (this.isSpecificResource() &&
            this.getSource() instanceof AnnotationBody) {
            return this.getSource().getLabel();
        }
        else {
            return this.getLabel();
        }
    };
    // Get the first source available on the annotation body, if any
    AnnotationBody.prototype.getSource = function () {
        var source = [].concat(this.getPropertyAsObject("source"))[0];
        if (source) {
            if (source["isIRI"] === true) {
                return source["id"];
            }
            else {
                return AnnotationBodyParser.BuildFromJson(source, this.options);
            }
        }
        return null;
    };
    AnnotationBody.prototype.isModel = function () {
        return this.getType() === distCommonjsExports$1.ExternalResourceType.MODEL;
    };
    AnnotationBody.prototype.isSound = function () {
        return this.getType() === distCommonjsExports$1.ExternalResourceType.SOUND;
    };
    AnnotationBody.prototype.isSoundCaption = function () {
        return this.getType() === distCommonjsExports$1.ExternalResourceType.TEXT && this.getProperty("format").toLowerCase() === "text/vtt";
    };
    AnnotationBody.prototype.isSpecificResource = function () {
        return this.getProperty("type") === "SpecificResource";
    };
    return AnnotationBody;
}(ManifestResource));

var __extends$j = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Light = /** @class */ (function (_super) {
    __extends$j(Light, _super);
    function Light(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    Light.prototype.getColor = function () {
        var hexColor = this.getPropertyFromSelfOrSource("color");
        if (hexColor)
            return Color.fromCSS(hexColor);
        else
            return new Color([255, 255, 255]); // white light
    };
    Object.defineProperty(Light.prototype, "Color", {
        get: function () {
            return this.getColor();
        },
        enumerable: false,
        configurable: true
    });
    /**
     * The implementation of the intensity is based on
     * {@link https://github.com/IIIF/3d/blob/main/temp-draft-4.md | temp-draft-4.md }
     * and the example 3D manifests
     * {@link https://github.com/IIIF/3d/tree/main/manifests/3_lights | lights }
     * on 24 Mar 2024. The intensity property in the manifest is an object
     * with declared type 'Value', a numeric property named 'value' and a
     * property named unit . This implementation will only work with a unit == 'relative'
     * and it will be assumed that a relative unit value of 1.0 corresponds to the
     * brightest light source a rendering engine supports.
     *
     * This code will implement a default intensity of 1.0
     **/
    Light.prototype.getIntensity = function () {
        var intObject = this.getPropertyFromSelfOrSource("intensity");
        if (intObject) {
            try {
                if (!(intObject.type === "Value" && intObject.unit === "relative"))
                    throw new Error();
                return intObject.value;
            }
            catch (err) {
                throw new Error("unable to interpret raw intensity object " +
                    JSON.stringify(intObject));
            }
        }
        else
            return 1.0;
    };
    Object.defineProperty(Light.prototype, "Intensity", {
        get: function () {
            return this.getIntensity();
        },
        enumerable: false,
        configurable: true
    });
    /**
    * As defined in the temp-draft-4.md (
    * https://github.com/IIIF/3d/blob/main/temp-draft-4.md#lights ; 12 May 2024)
    * this quantity is the half-angle of the cone of the spotlight.
    *
    * The inconsistency between this definition of the angle and the definition of
    * fieldOfView for PerspectiveCamera (where the property value defines the full angle) has
    * already been noted: https://github.com/IIIF/api/issues/2284
    *
    * provisional decision is to return undefined in case that this property
    * is accessed in a light that is not a spotlight
    *
    *
    * @returns number
    
    **/
    Light.prototype.getAngle = function () {
        if (this.isSpotLight()) {
            return Number(this.getPropertyFromSelfOrSource("angle"));
        }
        else {
            return undefined;
        }
    };
    Object.defineProperty(Light.prototype, "Angle", {
        get: function () {
            return this.getAngle();
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @return : if not null, is either a PointSelector, or an object
     * with an id matching the id of an Annotation instance.
     **/
    Light.prototype.getLookAt = function () {
        var _a, _b;
        var rawObj = (_a = this.getPropertyAsObject("lookAt")) !== null && _a !== void 0 ? _a : null;
        if (rawObj == null)
            return null;
        var rawType = (_b = (rawObj["type"] || rawObj["@type"])) !== null && _b !== void 0 ? _b : null;
        if (rawType == null)
            return null;
        if (rawType == "Annotation") {
            return rawObj;
        }
        if (rawType == "PointSelector") {
            return new PointSelector(rawObj);
        }
        throw new Error("unidentified value of lookAt ".concat(rawType));
    };
    Object.defineProperty(Light.prototype, "LookAt", {
        get: function () {
            return this.getLookAt();
        },
        enumerable: false,
        configurable: true
    });
    Light.prototype.isAmbientLight = function () {
        return Utils.normaliseType(this.getType() || "") === "ambientlight";
    };
    Light.prototype.isDirectionalLight = function () {
        return Utils.normaliseType(this.getType() || "") === "directionallight";
    };
    Light.prototype.isPointLight = function () {
        return Utils.normaliseType(this.getType() || "") === "pointlight";
    };
    Light.prototype.isSpotLight = function () {
        return Utils.normaliseType(this.getType() || "") === "spotlight";
    };
    return Light;
}(AnnotationBody));

var __extends$i = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Camera = /** @class */ (function (_super) {
    __extends$i(Camera, _super);
    function Camera(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    /**
    @returns full angular size of perspective viewport in vertical direction.
    Angular unit is degrees
    **/
    Camera.prototype.getFieldOfView = function () {
        if (this.isPerspectiveCamera()) {
            var value = this.getPropertyFromSelfOrSource("fieldOfView");
            if (value) {
                if (value > 0 && value < 180)
                    return value;
                else {
                    console.warn("Camera fieldOfView out of range and will be considered undefined.");
                    return undefined;
                }
            }
            else
                return undefined;
        }
        else
            return undefined;
    };
    Object.defineProperty(Camera.prototype, "FieldOfView", {
        /**
        Full angular size of perspective viewport in vertical direction.
        Angular unit is degrees
        **/
        get: function () {
            return this.getFieldOfView();
        },
        enumerable: false,
        configurable: true
    });
    /**
    @returns full linear size of orthographic viewport in vertical direction.
    linear unit is Scene global unit of measure
    
    Name of this property was originally Height, has been changed
    at this revision to ViewHeight:
    See issues at https://github.com/IIIF/api/issues/2289
    **/
    Camera.prototype.getViewHeight = function () {
        if (this.isOrthographicCamera()) {
            // the term viewHeight for the resource Type was suggested
            // in https://github.com/IIIF/api/issues/2289#issuecomment-2161608587
            var value = this.getProperty("viewHeight");
            if (value)
                return value;
            else
                return undefined;
        }
        else
            return undefined;
    };
    Object.defineProperty(Camera.prototype, "ViewHeight", {
        get: function () {
            return this.getViewHeight();
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @return : if not null, is either a PointSelector, an object
     * with an id matching the id of an Annotation instance, or a
     * SpecificResource with a PointSelector .
     **/
    Camera.prototype.getLookAt = function () {
        var _a, _b;
        var rawObj = (_a = this.getPropertyAsObject("lookAt")) !== null && _a !== void 0 ? _a : null;
        if (rawObj == null)
            return null;
        var rawType = (_b = (rawObj["type"] || rawObj["@type"])) !== null && _b !== void 0 ? _b : null;
        if (rawType == null)
            return null;
        if (rawType == "Annotation")
            return rawObj;
        else if (rawType == "PointSelector")
            return new PointSelector(rawObj);
        else if (rawType == "SpecificResource") {
            return new SpecificResource(rawObj, this.options);
        }
        else {
            console.error("unidentified value of lookAt ".concat(rawType));
            return null;
        }
    };
    Object.defineProperty(Camera.prototype, "LookAt", {
        get: function () {
            return this.getLookAt();
        },
        enumerable: false,
        configurable: true
    });
    /**
    @returns the near plane value, i.e. the minimum distance from the camera at
    which something in the space must exist in order to be viewed by the camera.
    **/
    Camera.prototype.getNear = function () {
        var value = this.getPropertyFromSelfOrSource("near");
        if (value)
            return value;
        else
            return undefined;
    };
    Object.defineProperty(Camera.prototype, "Near", {
        /**
        Near plane value of the camera.
        **/
        get: function () {
            return this.getNear();
        },
        enumerable: false,
        configurable: true
    });
    /**
    @returns the far plane value, i.e. the maximum distance from the camera at
    which something in the space must exist in order to be viewed by the camera.
    **/
    Camera.prototype.getFar = function () {
        var value = this.getPropertyFromSelfOrSource("far");
        if (value)
            return value;
        else
            return undefined;
    };
    Object.defineProperty(Camera.prototype, "Far", {
        /**
        Far plane value of the camera.
        **/
        get: function () {
            return this.getFar();
        },
        enumerable: false,
        configurable: true
    });
    Camera.prototype.isPerspectiveCamera = function () {
        return Utils.normaliseType(this.getType() || "") === "perspectivecamera";
    };
    Camera.prototype.isOrthographicCamera = function () {
        return Utils.normaliseType(this.getType() || "") === "orthographiccamera";
    };
    return Camera;
}(AnnotationBody));

var __extends$h = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/**
An implementation of the TextualBody class (class in JSON-LD sense)
as it is described in Web Annotation Data Model Section 3.2.4
https://www.w3.org/TR/annotation-model/#embedded-textual-body
**/
var TextualBody = /** @class */ (function (_super) {
    __extends$h(TextualBody, _super);
    function TextualBody(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    Object.defineProperty(TextualBody.prototype, "Value", {
        /**
      The simple string that is the data content of this resource
      will return empty string as a default value
      **/
        get: function () {
            return this.getProperty("value") || "";
        },
        enumerable: false,
        configurable: true
    });
    /**
  Returns a specific resource representing the TextualBody position if
  present, otherwise null.
  **/
    TextualBody.prototype.getPosition = function () {
        var _a;
        var rawPosition = (_a = this.getPropertyAsObject("position")) !== null && _a !== void 0 ? _a : null;
        if (rawPosition == null)
            return null;
        if (rawPosition.type && rawPosition.type == "SpecificResource") {
            return new SpecificResource(rawPosition, this.options);
        }
        else {
            throw new Error("unknown position type specified");
        }
    };
    Object.defineProperty(TextualBody.prototype, "Position", {
        get: function () {
            return this.getPosition();
        },
        enumerable: false,
        configurable: true
    });
    return TextualBody;
}(AnnotationBody));

// Todo: Add these to @iiif/vocabulary
var LightTypes = [
    "AmbientLight",
    "DirectionalLight",
    "PointLight",
    "SpotLight",
];
var CameraTypes = ["PerspectiveCamera", "OrthographicCamera"];
var DisplayedTypes = [
    "Image",
    "Document",
    "Audio",
    "Model",
    "Video",
    "Canvas",
    "Sound",
    "Text"
];
var AnnotationBodyParser = /** @class */ (function () {
    function AnnotationBodyParser() {
    }
    AnnotationBodyParser.BuildFromJson = function (jsonld, options) {
        var type = jsonld.type === "SpecificResource" && jsonld.source
            ? [].concat(jsonld.source)[0]["type"]
            : jsonld.type;
        if (DisplayedTypes.includes(type))
            return new AnnotationBody(jsonld, options);
        else if (LightTypes.includes(type))
            return new Light(jsonld, options);
        else if (CameraTypes.includes(type))
            return new Camera(jsonld, options);
        else if (type === "TextualBody")
            return new TextualBody(jsonld, options);
        else
            throw new Error("unimplemented type for AnnotationBody: " + type);
    };
    return AnnotationBodyParser;
}());

var __extends$g = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Annotation = /** @class */ (function (_super) {
    __extends$g(Annotation, _super);
    function Annotation(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    /**
    In spite of its name, this method returns an array of objects, each of which
    represents a potential body annotations
    
    @see{ https://iiif.io/api/cookbook/recipe/0033-choice/ }
    **/
    Annotation.prototype.getBody = function () {
        var bodies = [];
        /*
        A bodyValue property in the annotation json will short circuit
        the parsing process and be interpreted as a shorthand version of
        a TextualBody resource defining as the body
        
        This procedure is allowed, see Web Annotation Data Model section 3.2.5
        https://www.w3.org/TR/annotation-model/#string-body
        */
        var stringBody = this.getProperty("bodyValue");
        //console.log("retrieved stringBody " + stringBody);
        if (stringBody) {
            return [
                new TextualBody({
                    id: "https://example.com/TextualBody/1",
                    value: stringBody,
                    type: "TextualBody",
                }, this.options),
            ];
        }
        var body = this.getProperty("body");
        // the following is intended to handle the following cases for
        /// the raw json of the body property of __jsonld
        // -- body is an array, each element of which is parsed
        // == body is an object with property items, each item is parsed
        // -- body is parsed
        if (body) {
            for (var _i = 0, _a = [].concat(body); _i < _a.length; _i++) {
                var bd = _a[_i];
                var items = bd.items;
                if (items)
                    bodies = bodies.concat(this.parseBodiesFromItemsList(items));
                else
                    bodies.push(this.parseSingletonBody(bd));
            }
        }
        return bodies;
    };
    Object.defineProperty(Annotation.prototype, "Body", {
        get: function () {
            return this.getBody();
        },
        enumerable: false,
        configurable: true
    });
    /**
    auxiliary function to getBody; intended to hande an object that has an element items
    which is a array of annotation- body-like objects. This : https://iiif.io/api/cookbook/recipe/0033-choice/
    seems to be the use case for this
    **/
    Annotation.prototype.parseBodiesFromItemsList = function (rawbodies) {
        var retVal = [];
        for (var _i = 0, _a = [].concat(rawbodies); _i < _a.length; _i++) {
            var bd = _a[_i];
            retVal.push(this.parseSingletonBody(bd));
        }
        return retVal;
    };
    /**
    auxiliary function to parseBodiesFromItemsList and getBody, this is the last
    step on recursively going through collections of bodies.
    **/
    Annotation.prototype.parseSingletonBody = function (rawbody) {
        return AnnotationBodyParser.BuildFromJson(rawbody, this.options);
    };
    /**
    Developer Note: 8 April 2024
    getBody3D function was developed in the early stages of the 3D API Feb-March 2024
    as alternative to the existing Annotation getBody function, but the signature for
    getBody3D was chosen to be a single object instance, not an array.
    
    At this stage, the merging of the 2D API anf the draft 3D API has been completed, so
    3D applications can use the getBody() function to retrieve the body of an Annotation intended
    to target a scene. For compatibily the return value of the function is still an
    array.
    
    3D clients using getBody are responsible for choosing the appropriate instance from the
    returned array. In most cases this will be the sole 0th element.
    **/
    Annotation.prototype.getBody3D = function () {
        console.warn("Annotation.getBody3D is deprecated: replace with getBody3D() with getBody()[0]");
        return this.getBody()[0];
    };
    Annotation.prototype.getMotivation = function () {
        var motivation = this.getProperty("motivation");
        if (motivation) {
            //const key: string | undefined = Object.keys(AnnotationMotivationEnum).find(k => AnnotationMotivationEnum[k] === motivation);
            return motivation;
        }
        return null;
    };
    // open annotation
    Annotation.prototype.getOn = function () {
        return this.getProperty("on");
    };
    Annotation.prototype.getTarget = function () {
        var rawTarget = this.getPropertyAsObject("target");
        if (rawTarget.isIRI)
            return rawTarget;
        if (rawTarget.type && rawTarget.type == "SpecificResource") {
            return new SpecificResource(rawTarget, this.options);
        }
        else if (["Scene", "Canvas"].includes(rawTarget.type)) {
            return rawTarget;
        }
        else {
            throw new Error("unknown target specified");
        }
    };
    Object.defineProperty(Annotation.prototype, "Target", {
        get: function () {
            return this.getTarget();
        },
        enumerable: false,
        configurable: true
    });
    // Retrieves target scope content state annotations
    Annotation.prototype.getScopeContent = function () {
        var _this = this;
        var _a, _b, _c;
        var items = (_c = (_b = (_a = this.getTarget()) === null || _a === void 0 ? void 0 : _a.getScope()) === null || _b === void 0 ? void 0 : _b.getTarget()) === null || _c === void 0 ? void 0 : _c.items;
        if (!items)
            return [];
        return items
            .filter(function (item) { return item && item.type === "AnnotationPage"; })
            .map(function (item) { return new AnnotationPage(item, _this.options).getItems(); })
            .flat()
            .filter(function (item) { return item && item.type === "Annotation"; })
            .map(function (annotation) { return new Annotation(annotation, _this.options); });
    };
    Object.defineProperty(Annotation.prototype, "ScopeContent", {
        get: function () {
            return this.getScopeContent();
        },
        enumerable: false,
        configurable: true
    });
    Annotation.prototype.getResource = function () {
        return new Resource(this.getProperty("resource"), this.options);
    };
    Object.defineProperty(Annotation.prototype, "LookAtLocation", {
        /**
         *    A 3D point coordinate object for the location of an Annotation
         *    to satisfy the requirements of the lookAt property of camera and
         *    spotlight resources, according to the draft v4 API as of April 1 2024
         *
         *    Is the position of the point for a target which is a SpecificResource with
         *    a PointSelector
         *    Otherwise, for example when the annotation target is an entire Scene, the
         *    location for lookAt is the origin (0,0,0)
         **/
        get: function () {
            var _a;
            var target = this.getTarget();
            if (target.isSpecificResource && ((_a = target.getSelector()) === null || _a === void 0 ? void 0 : _a.isPointSelector))
                return target.getSelector().getLocation();
            else
                return new Vector3(0.0, 0.0, 0.0);
        },
        enumerable: false,
        configurable: true
    });
    return Annotation;
}(ManifestResource));

var __extends$f = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var AnnotationList = /** @class */ (function (_super) {
    __extends$f(AnnotationList, _super);
    function AnnotationList(label, jsonld, options) {
        var _this = _super.call(this, jsonld) || this;
        _this.label = label;
        _this.options = options;
        return _this;
    }
    AnnotationList.prototype.getIIIFResourceType = function () {
        return Utils.normaliseType(this.getProperty("type"));
    };
    AnnotationList.prototype.getLabel = function () {
        return this.label;
    };
    AnnotationList.prototype.getResources = function () {
        var _this = this;
        var resources = this.getProperty("resources");
        return resources.map(function (resource) { return new Annotation(resource, _this.options); });
    };
    AnnotationList.prototype.load = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.isLoaded) {
                resolve(_this);
            }
            else {
                var id = _this.__jsonld.id;
                if (!id) {
                    id = _this.__jsonld["@id"];
                }
                Utils.loadManifest(id)
                    .then(function (data) {
                    _this.__jsonld = data;
                    _this.context = _this.getProperty("context");
                    _this.id = _this.getProperty("id");
                    _this.isLoaded = true;
                    resolve(_this);
                })
                    .catch(reject);
            }
        });
    };
    return AnnotationList;
}(JSONLDResource));

var __extends$e = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var AnnotationPage = /** @class */ (function (_super) {
    __extends$e(AnnotationPage, _super);
    function AnnotationPage(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    AnnotationPage.prototype.getItems = function () {
        return this.getProperty("items");
    };
    return AnnotationPage;
}(ManifestResource));

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */

var _arrayPush;
var hasRequired_arrayPush;

function require_arrayPush () {
	if (hasRequired_arrayPush) return _arrayPush;
	hasRequired_arrayPush = 1;
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;

	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}

	_arrayPush = arrayPush;
	return _arrayPush;
}

/** Detect free variable `global` from Node.js. */

var _freeGlobal;
var hasRequired_freeGlobal;

function require_freeGlobal () {
	if (hasRequired_freeGlobal) return _freeGlobal;
	hasRequired_freeGlobal = 1;
	var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

	_freeGlobal = freeGlobal;
	return _freeGlobal;
}

var _root;
var hasRequired_root;

function require_root () {
	if (hasRequired_root) return _root;
	hasRequired_root = 1;
	var freeGlobal = /*@__PURE__*/ require_freeGlobal();

	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();

	_root = root;
	return _root;
}

var _Symbol;
var hasRequired_Symbol;

function require_Symbol () {
	if (hasRequired_Symbol) return _Symbol;
	hasRequired_Symbol = 1;
	var root = /*@__PURE__*/ require_root();

	/** Built-in value references. */
	var Symbol = root.Symbol;

	_Symbol = Symbol;
	return _Symbol;
}

var _getRawTag;
var hasRequired_getRawTag;

function require_getRawTag () {
	if (hasRequired_getRawTag) return _getRawTag;
	hasRequired_getRawTag = 1;
	var Symbol = /*@__PURE__*/ require_Symbol();

	/** Used for built-in method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var nativeObjectToString = objectProto.toString;

	/** Built-in value references. */
	var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

	/**
	 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the raw `toStringTag`.
	 */
	function getRawTag(value) {
	  var isOwn = hasOwnProperty.call(value, symToStringTag),
	      tag = value[symToStringTag];

	  try {
	    value[symToStringTag] = undefined;
	    var unmasked = true;
	  } catch (e) {}

	  var result = nativeObjectToString.call(value);
	  if (unmasked) {
	    if (isOwn) {
	      value[symToStringTag] = tag;
	    } else {
	      delete value[symToStringTag];
	    }
	  }
	  return result;
	}

	_getRawTag = getRawTag;
	return _getRawTag;
}

/** Used for built-in method references. */

var _objectToString;
var hasRequired_objectToString;

function require_objectToString () {
	if (hasRequired_objectToString) return _objectToString;
	hasRequired_objectToString = 1;
	var objectProto = Object.prototype;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var nativeObjectToString = objectProto.toString;

	/**
	 * Converts `value` to a string using `Object.prototype.toString`.
	 *
	 * @private
	 * @param {*} value The value to convert.
	 * @returns {string} Returns the converted string.
	 */
	function objectToString(value) {
	  return nativeObjectToString.call(value);
	}

	_objectToString = objectToString;
	return _objectToString;
}

var _baseGetTag;
var hasRequired_baseGetTag;

function require_baseGetTag () {
	if (hasRequired_baseGetTag) return _baseGetTag;
	hasRequired_baseGetTag = 1;
	var Symbol = /*@__PURE__*/ require_Symbol(),
	    getRawTag = /*@__PURE__*/ require_getRawTag(),
	    objectToString = /*@__PURE__*/ require_objectToString();

	/** `Object#toString` result references. */
	var nullTag = '[object Null]',
	    undefinedTag = '[object Undefined]';

	/** Built-in value references. */
	var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

	/**
	 * The base implementation of `getTag` without fallbacks for buggy environments.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	function baseGetTag(value) {
	  if (value == null) {
	    return value === undefined ? undefinedTag : nullTag;
	  }
	  return (symToStringTag && symToStringTag in Object(value))
	    ? getRawTag(value)
	    : objectToString(value);
	}

	_baseGetTag = baseGetTag;
	return _baseGetTag;
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */

var isObjectLike_1;
var hasRequiredIsObjectLike;

function requireIsObjectLike () {
	if (hasRequiredIsObjectLike) return isObjectLike_1;
	hasRequiredIsObjectLike = 1;
	function isObjectLike(value) {
	  return value != null && typeof value == 'object';
	}

	isObjectLike_1 = isObjectLike;
	return isObjectLike_1;
}

var _baseIsArguments;
var hasRequired_baseIsArguments;

function require_baseIsArguments () {
	if (hasRequired_baseIsArguments) return _baseIsArguments;
	hasRequired_baseIsArguments = 1;
	var baseGetTag = /*@__PURE__*/ require_baseGetTag(),
	    isObjectLike = /*@__PURE__*/ requireIsObjectLike();

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]';

	/**
	 * The base implementation of `_.isArguments`.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 */
	function baseIsArguments(value) {
	  return isObjectLike(value) && baseGetTag(value) == argsTag;
	}

	_baseIsArguments = baseIsArguments;
	return _baseIsArguments;
}

var isArguments_1;
var hasRequiredIsArguments;

function requireIsArguments () {
	if (hasRequiredIsArguments) return isArguments_1;
	hasRequiredIsArguments = 1;
	var baseIsArguments = /*@__PURE__*/ require_baseIsArguments(),
	    isObjectLike = /*@__PURE__*/ requireIsObjectLike();

	/** Used for built-in method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/** Built-in value references. */
	var propertyIsEnumerable = objectProto.propertyIsEnumerable;

	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
	  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
	    !propertyIsEnumerable.call(value, 'callee');
	};

	isArguments_1 = isArguments;
	return isArguments_1;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */

var isArray_1;
var hasRequiredIsArray;

function requireIsArray () {
	if (hasRequiredIsArray) return isArray_1;
	hasRequiredIsArray = 1;
	var isArray = Array.isArray;

	isArray_1 = isArray;
	return isArray_1;
}

var _isFlattenable;
var hasRequired_isFlattenable;

function require_isFlattenable () {
	if (hasRequired_isFlattenable) return _isFlattenable;
	hasRequired_isFlattenable = 1;
	var Symbol = /*@__PURE__*/ require_Symbol(),
	    isArguments = /*@__PURE__*/ requireIsArguments(),
	    isArray = /*@__PURE__*/ requireIsArray();

	/** Built-in value references. */
	var spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined;

	/**
	 * Checks if `value` is a flattenable `arguments` object or array.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
	 */
	function isFlattenable(value) {
	  return isArray(value) || isArguments(value) ||
	    !!(spreadableSymbol && value && value[spreadableSymbol]);
	}

	_isFlattenable = isFlattenable;
	return _isFlattenable;
}

var _baseFlatten;
var hasRequired_baseFlatten;

function require_baseFlatten () {
	if (hasRequired_baseFlatten) return _baseFlatten;
	hasRequired_baseFlatten = 1;
	var arrayPush = /*@__PURE__*/ require_arrayPush(),
	    isFlattenable = /*@__PURE__*/ require_isFlattenable();

	/**
	 * The base implementation of `_.flatten` with support for restricting flattening.
	 *
	 * @private
	 * @param {Array} array The array to flatten.
	 * @param {number} depth The maximum recursion depth.
	 * @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
	 * @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
	 * @param {Array} [result=[]] The initial result value.
	 * @returns {Array} Returns the new flattened array.
	 */
	function baseFlatten(array, depth, predicate, isStrict, result) {
	  var index = -1,
	      length = array.length;

	  predicate || (predicate = isFlattenable);
	  result || (result = []);

	  while (++index < length) {
	    var value = array[index];
	    if (depth > 0 && predicate(value)) {
	      if (depth > 1) {
	        // Recursively flatten arrays (susceptible to call stack limits).
	        baseFlatten(value, depth - 1, predicate, isStrict, result);
	      } else {
	        arrayPush(result, value);
	      }
	    } else if (!isStrict) {
	      result[result.length] = value;
	    }
	  }
	  return result;
	}

	_baseFlatten = baseFlatten;
	return _baseFlatten;
}

var flatten_1;
var hasRequiredFlatten;

function requireFlatten () {
	if (hasRequiredFlatten) return flatten_1;
	hasRequiredFlatten = 1;
	var baseFlatten = /*@__PURE__*/ require_baseFlatten();

	/**
	 * Flattens `array` a single level deep.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Array
	 * @param {Array} array The array to flatten.
	 * @returns {Array} Returns the new flattened array.
	 * @example
	 *
	 * _.flatten([1, [2, [3, [4]], 5]]);
	 * // => [1, 2, [3, [4]], 5]
	 */
	function flatten(array) {
	  var length = array == null ? 0 : array.length;
	  return length ? baseFlatten(array, 1) : [];
	}

	flatten_1 = flatten;
	return flatten_1;
}

var flattenExports = /*@__PURE__*/ requireFlatten();
var flatten = /*@__PURE__*/getDefaultExportFromCjs(flattenExports);

var flattenDeep_1;
var hasRequiredFlattenDeep;

function requireFlattenDeep () {
	if (hasRequiredFlattenDeep) return flattenDeep_1;
	hasRequiredFlattenDeep = 1;
	var baseFlatten = /*@__PURE__*/ require_baseFlatten();

	/** Used as references for various `Number` constants. */
	var INFINITY = 1 / 0;

	/**
	 * Recursively flattens `array`.
	 *
	 * @static
	 * @memberOf _
	 * @since 3.0.0
	 * @category Array
	 * @param {Array} array The array to flatten.
	 * @returns {Array} Returns the new flattened array.
	 * @example
	 *
	 * _.flattenDeep([1, [2, [3, [4]], 5]]);
	 * // => [1, 2, 3, 4, 5]
	 */
	function flattenDeep(array) {
	  var length = array == null ? 0 : array.length;
	  return length ? baseFlatten(array, INFINITY) : [];
	}

	flattenDeep_1 = flattenDeep;
	return flattenDeep_1;
}

var flattenDeepExports = /*@__PURE__*/ requireFlattenDeep();
var flattenDeep = /*@__PURE__*/getDefaultExportFromCjs(flattenDeepExports);

var __extends$d = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Canvas = /** @class */ (function (_super) {
    __extends$d(Canvas, _super);
    function Canvas(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    // http://iiif.io/api/image/2.1/#canonical-uri-syntax
    Canvas.prototype.getCanonicalImageUri = function (w) {
        var id = null;
        var region = "full";
        var rotation = 0;
        var quality = "default";
        var width = w;
        var size;
        // if an info.json has been loaded
        if (this.externalResource &&
            this.externalResource.data &&
            this.externalResource.data["@id"]) {
            id = this.externalResource.data["@id"];
            if (!width) {
                width = this.externalResource.data.width;
            }
            if (this.externalResource.data["@context"]) {
                if (this.externalResource.data["@context"].indexOf("/1.0/context.json") >
                    -1 ||
                    this.externalResource.data["@context"].indexOf("/1.1/context.json") >
                        -1 ||
                    this.externalResource.data["@context"].indexOf("/1/context.json") > -1) {
                    quality = "native";
                }
            }
        }
        else {
            // info.json hasn't been loaded yet
            var images = void 0;
            // presentation 2.0
            images = this.getImages();
            if (images && images.length) {
                var firstImage = images[0];
                var resource = firstImage.getResource();
                var services = resource.getServices();
                if (!width) {
                    width = resource.getWidth();
                }
                var service = services
                    ? services.find(function (service) {
                        return (Utils.isImageProfile(service.getProfile()) ||
                            Utils.isImageServiceType(service.getIIIFResourceType()));
                    })
                    : null;
                if (service) {
                    id = service.id;
                    quality = Utils.getImageQuality(service.getProfile());
                }
                else if (width === resource.getWidth()) {
                    // if the passed width is the same as the resource width
                    // i.e. not looking for a thumbnail
                    // return the full size image.
                    // used for download options when loading static images.
                    return resource.id;
                }
            }
            // presentation 3.0
            images = this.getContent();
            if (images && images.length) {
                var firstImage = images[0];
                // Developer note: Since Canvas in Presentation 3 doesn't use
                // SpecificResource resources in the body, force a cast
                var body = firstImage.getBody();
                var anno = body[0];
                var services = anno.getServices();
                if (!width) {
                    width = anno.getWidth();
                }
                var service = services
                    ? services.find(function (service) {
                        return Utils.isImageServiceType(service.getIIIFResourceType());
                    })
                    : null;
                if (service) {
                    id = service.id;
                    quality = Utils.getImageQuality(service.getProfile());
                }
                else if (width === anno.getWidth()) {
                    // if the passed width is the same as the resource width
                    // i.e. not looking for a thumbnail
                    // return the full size image.
                    // used for download options when loading static images.
                    return anno.id;
                }
            }
            // todo: should this be moved to getThumbUri?
            if (!id) {
                var thumbnail = this.getProperty("thumbnail");
                if (thumbnail) {
                    if (typeof thumbnail === "string") {
                        return thumbnail;
                    }
                    else {
                        if (thumbnail["@id"]) {
                            return thumbnail["@id"];
                        }
                        else if (thumbnail.length) {
                            return thumbnail[0].id;
                        }
                    }
                }
            }
        }
        size = width + ",";
        // trim off trailing '/'
        if (id && id.endsWith("/")) {
            id = id.substr(0, id.length - 1);
        }
        var uri = [id, region, size, rotation, quality + ".jpg"].join("/");
        return uri;
    };
    Canvas.prototype.getMaxDimensions = function () {
        var maxDimensions = null;
        var profile;
        if (this.externalResource &&
            this.externalResource.data &&
            this.externalResource.data.profile) {
            profile = this.externalResource.data.profile;
            if (Array.isArray(profile)) {
                profile = profile.filter(function (p) { var _a; return (_a = p["maxWidth"]) !== null && _a !== void 0 ? _a : p["maxwidth"]; })[0];
                if (profile) {
                    maxDimensions = new Size(profile.maxWidth, profile.maxHeight ? profile.maxHeight : profile.maxWidth);
                }
            }
        }
        return maxDimensions;
    };
    // Presentation API 3.0
    Canvas.prototype.getContent = function () {
        var content = [];
        var items = this.__jsonld.items || this.__jsonld.content;
        if (!items)
            return content;
        // should be contained in an AnnotationPage
        var annotationPage = null;
        if (items.length) {
            annotationPage = new AnnotationPage(items[0], this.options);
        }
        if (!annotationPage) {
            return content;
        }
        var annotations = annotationPage.getItems();
        for (var i = 0; i < annotations.length; i++) {
            var a = annotations[i];
            var annotation = new Annotation(a, this.options);
            content.push(annotation);
        }
        return content;
    };
    Canvas.prototype.getDuration = function () {
        return this.getProperty("duration");
    };
    // presentation 2.0
    Canvas.prototype.getImages = function () {
        var images = [];
        if (!this.__jsonld.images)
            return images;
        for (var i = 0; i < this.__jsonld.images.length; i++) {
            var a = this.__jsonld.images[i];
            var annotation = new Annotation(a, this.options);
            images.push(annotation);
        }
        return images;
    };
    Canvas.prototype.getIndex = function () {
        return this.getProperty("index");
    };
    // Annotations not rendered as part of the Canvas
    // Have non-painting motivations and are listed in Canvas annotations property, not items property
    Canvas.prototype.getNonContentAnnotations = function () {
        var _this = this;
        var annotationPages = (this.__jsonld.annotations || [])
            .filter(function (annotationPage) {
            return annotationPage && annotationPage.type === "AnnotationPage";
        })
            .map(function (annotationPage) { return new AnnotationPage(annotationPage, _this.options); });
        if (!annotationPages.length)
            return [];
        var annotationsNested = annotationPages.map(function (page) {
            return page.getItems();
        });
        var annotationsFlat = flattenDeep(annotationsNested);
        return annotationsFlat.map(function (annotation) { return new Annotation(annotation, _this.options); });
    };
    Canvas.prototype.getOtherContent = function () {
        var _this = this;
        var otherContent = Array.isArray(this.getProperty("otherContent"))
            ? this.getProperty("otherContent")
            : [this.getProperty("otherContent")];
        var canonicalComparison = function (typeA, typeB) {
            if (typeof typeA !== "string" || "string" !== "string") {
                return false;
            }
            return typeA.toLowerCase() === typeA.toLowerCase();
        };
        var otherPromises = otherContent
            .filter(function (otherContent) {
            return otherContent &&
                canonicalComparison(otherContent["@type"]);
        })
            .map(function (annotationList, i) {
            return new AnnotationList(annotationList["label"] || "Annotation list ".concat(i), annotationList, _this.options);
        })
            .map(function (annotationList) { return annotationList.load(); });
        return Promise.all(otherPromises);
    };
    // Prefer thumbnail service to image service if supplied and if
    // the thumbnail service can provide a satisfactory size +/- x pixels.
    // this is used to get thumb URIs *before* the info.json has been requested
    // and populate thumbnails in a viewer.
    // the publisher may also provide pre-computed fixed-size thumbs for better performance.
    //getThumbUri(width: number): string {
    //
    //    var uri;
    //    var images: IAnnotation[] = this.getImages();
    //
    //    if (images && images.length) {
    //        var firstImage = images[0];
    //        var resource: IResource = firstImage.getResource();
    //        var services: IService[] = resource.getServices();
    //
    //        for (let i = 0; i < services.length; i++) {
    //            var service: IService = services[i];
    //            var id = service.id;
    //
    //            if (!_endsWith(id, '/')) {
    //                id += '/';
    //            }
    //
    //            uri = id + 'full/' + width + ',/0/' + Utils.getImageQuality(service.getProfile()) + '.jpg';
    //        }
    //    }
    //
    //    return uri;
    //}
    //getType(): CanvasType {
    //    return new CanvasType(this.getProperty('@type').toLowerCase());
    //}
    Canvas.prototype.getWidth = function () {
        return this.getProperty("width");
    };
    Canvas.prototype.getHeight = function () {
        return this.getProperty("height");
    };
    Canvas.prototype.getViewingHint = function () {
        return this.getProperty("viewingHint");
    };
    Object.defineProperty(Canvas.prototype, "imageResources", {
        get: function () {
            var _this = this;
            var resources = flattenDeep([
                this.getImages().map(function (i) { return i.getResource(); }),
                this.getContent().map(function (i) { return i.getBody(); }),
            ]);
            return flatten(resources.map(function (resource) {
                switch (resource.getProperty("type").toLowerCase()) {
                    case distCommonjsExports$1.ExternalResourceType.CHOICE:
                    case distCommonjsExports$1.ExternalResourceType.OA_CHOICE:
                        return new Canvas({
                            images: flatten([
                                resource.getProperty("default"),
                                resource.getProperty("item"),
                            ]).map(function (r) { return ({ resource: r }); }),
                        }, _this.options)
                            .getImages()
                            .map(function (i) { return i.getResource(); });
                    default:
                        return resource;
                }
            }));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Canvas.prototype, "resourceAnnotations", {
        get: function () {
            return flattenDeep([this.getImages(), this.getContent()]);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Returns a given resource Annotation, based on a contained resource or body
     * id
     */
    Canvas.prototype.resourceAnnotation = function (id) {
        return this.resourceAnnotations.find(function (anno) {
            return anno.getResource().id === id ||
                flatten(new Array(anno.getBody())).some(function (body) { return body.id === id; });
        });
    };
    /**
     * Returns the fragment placement values if a resourceAnnotation is placed on
     * a canvas somewhere besides the full extent
     */
    Canvas.prototype.onFragment = function (id) {
        var resourceAnnotation = this.resourceAnnotation(id);
        if (!resourceAnnotation)
            return undefined;
        // IIIF v2
        var on = resourceAnnotation.getProperty("on");
        // IIIF v3
        var target = resourceAnnotation.getProperty("target");
        if (!on || !target) {
            return undefined;
        }
        var fragmentMatch = (on || target).match(/xywh=(.*)$/);
        if (!fragmentMatch)
            return undefined;
        return fragmentMatch[1].split(",").map(function (str) { return parseInt(str, 10); });
    };
    Object.defineProperty(Canvas.prototype, "iiifImageResources", {
        get: function () {
            return this.imageResources.filter(function (r) { return r && r.getServices()[0] && r.getServices()[0].id; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Canvas.prototype, "imageServiceIds", {
        get: function () {
            return this.iiifImageResources.map(function (r) { return r.getServices()[0].id; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Canvas.prototype, "aspectRatio", {
        get: function () {
            return this.getWidth() / this.getHeight();
        },
        enumerable: false,
        configurable: true
    });
    return Canvas;
}(Resource));

var __extends$c = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Collection = /** @class */ (function (_super) {
    __extends$c(Collection, _super);
    function Collection(jsonld, options) {
        var _this = _super.call(this, jsonld, options) || this;
        _this.items = [];
        _this._collections = null;
        _this._manifests = null;
        jsonld.__collection = _this;
        return _this;
    }
    Collection.prototype.getCollections = function () {
        if (this._collections) {
            return this._collections;
        }
        return (this._collections = (this.items.filter(function (m) { return m.isCollection(); })));
    };
    Collection.prototype.getManifests = function () {
        if (this._manifests) {
            return this._manifests;
        }
        return (this._manifests = (this.items.filter(function (m) { return m.isManifest(); })));
    };
    Collection.prototype.getCollectionByIndex = function (collectionIndex) {
        var collections = this.getCollections();
        var collection;
        for (var i = 0; i < collections.length; i++) {
            var c = collections[i];
            if (c.index === collectionIndex) {
                collection = c;
            }
        }
        if (collection) {
            collection.options.index = collectionIndex;
            // id for collection MUST be dereferenceable
            return collection.load();
        }
        else {
            throw new Error("Collection index not found");
        }
    };
    Collection.prototype.getManifestByIndex = function (manifestIndex) {
        var manifests = this.getManifests();
        var manifest;
        for (var i = 0; i < manifests.length; i++) {
            var m = manifests[i];
            if (m.index === manifestIndex) {
                manifest = m;
            }
        }
        if (manifest) {
            manifest.options.index = manifestIndex;
            return manifest.load();
        }
        else {
            throw new Error("Manifest index not found");
        }
    };
    Collection.prototype.getTotalCollections = function () {
        return this.getCollections().length;
    };
    Collection.prototype.getTotalManifests = function () {
        return this.getManifests().length;
    };
    Collection.prototype.getTotalItems = function () {
        return this.items.length;
    };
    Collection.prototype.getViewingDirection = function () {
        if (this.getProperty("viewingDirection")) {
            return this.getProperty("viewingDirection");
        }
        return distCommonjsExports$1.ViewingDirection.LEFT_TO_RIGHT;
    };
    /**
     * Note: this only will return the first behavior as per the manifesto convention
     * IIIF v3 supports multiple behaviors
     */
    Collection.prototype.getBehavior = function () {
        var behavior = this.getProperty("behavior");
        if (Array.isArray(behavior)) {
            behavior = behavior[0];
        }
        if (behavior) {
            return behavior;
        }
        return null;
    };
    Collection.prototype.getViewingHint = function () {
        return this.getProperty("viewingHint");
    };
    /**
     * Get a tree of sub collections and manifests, using each child manifest's first 'top' range.
     */
    Collection.prototype.getDefaultTree = function () {
        _super.prototype.getDefaultTree.call(this);
        //console.log("get default tree for ", this.id);
        this.defaultTree.data.type = Utils.normaliseType(TreeNodeType.COLLECTION);
        this._parseManifests(this);
        this._parseCollections(this);
        Utils.generateTreeNodeIds(this.defaultTree);
        return this.defaultTree;
    };
    Collection.prototype._parseManifests = function (parentCollection) {
        if (parentCollection.getManifests() &&
            parentCollection.getManifests().length) {
            for (var i = 0; i < parentCollection.getManifests().length; i++) {
                var manifest = parentCollection.getManifests()[i];
                var tree = manifest.getDefaultTree();
                tree.label =
                    manifest.parentLabel ||
                        manifest.getLabel().getValue(this.options.locale) ||
                        "manifest " + (i + 1);
                tree.navDate = manifest.getNavDate();
                tree.data.id = manifest.id;
                tree.data.type = Utils.normaliseType(TreeNodeType.MANIFEST);
                parentCollection.defaultTree.addNode(tree);
            }
        }
    };
    Collection.prototype._parseCollections = function (parentCollection) {
        //console.log("parse collections for ", parentCollection.id);
        if (parentCollection.getCollections() &&
            parentCollection.getCollections().length) {
            for (var i = 0; i < parentCollection.getCollections().length; i++) {
                var collection = parentCollection.getCollections()[i];
                var tree = collection.getDefaultTree();
                tree.label =
                    collection.parentLabel ||
                        collection.getLabel().getValue(this.options.locale) ||
                        "collection " + (i + 1);
                tree.navDate = collection.getNavDate();
                tree.data.id = collection.id;
                tree.data.type = Utils.normaliseType(TreeNodeType.COLLECTION);
                parentCollection.defaultTree.addNode(tree);
            }
        }
    };
    return Collection;
}(IIIFResource));

var Duration = /** @class */ (function () {
    function Duration(start, end) {
        this.start = start;
        this.end = end;
    }
    Duration.prototype.getLength = function () {
        return this.end - this.start;
    };
    return Duration;
}());

var LabelValuePair = /** @class */ (function () {
    function LabelValuePair(defaultLocale) {
        this.defaultLocale = defaultLocale;
    }
    LabelValuePair.prototype.parse = function (resource) {
        this.resource = resource;
        this.label = PropertyValue.parse(this.resource.label, this.defaultLocale);
        this.value = PropertyValue.parse(this.resource.value, this.defaultLocale);
    };
    // shortcuts to get/set values based on user or default locale
    LabelValuePair.prototype.getLabel = function (locale) {
        if (this.label === null) {
            return null;
        }
        if (Array.isArray(locale) && !locale.length) {
            locale = undefined;
        }
        return this.label.getValue(locale || this.defaultLocale);
    };
    LabelValuePair.prototype.setLabel = function (value) {
        if (this.label === null) {
            this.label = new PropertyValue([]);
        }
        this.label.setValue(value, this.defaultLocale);
    };
    LabelValuePair.prototype.getValue = function (locale, joinWith) {
        if (joinWith === void 0) { joinWith = "<br/>"; }
        if (this.value === null) {
            return null;
        }
        if (Array.isArray(locale) && !locale.length) {
            locale = undefined;
        }
        return this.value.getValue(locale || this.defaultLocale, joinWith);
    };
    LabelValuePair.prototype.getValues = function (locale) {
        if (this.value === null) {
            return [];
        }
        if (Array.isArray(locale) && !locale.length) {
            locale = undefined;
        }
        return this.value.getValues(locale || this.defaultLocale);
    };
    LabelValuePair.prototype.setValue = function (value) {
        if (this.value === null) {
            this.value = new PropertyValue([]);
        }
        this.value.setValue(value, this.defaultLocale);
    };
    return LabelValuePair;
}());

var distCommonjs = {};

var hasRequiredDistCommonjs;

function requireDistCommonjs () {
	if (hasRequiredDistCommonjs) return distCommonjs;
	hasRequiredDistCommonjs = 1;
	Object.defineProperty(distCommonjs, "__esModule", { value: true });
	distCommonjs.CONTINUE = 100;
	distCommonjs.SWITCHING_PROTOCOLS = 101;
	distCommonjs.PROCESSING = 102;
	distCommonjs.OK = 200;
	distCommonjs.CREATED = 201;
	distCommonjs.ACCEPTED = 202;
	distCommonjs.NON_AUTHORITATIVE_INFORMATION = 203;
	distCommonjs.NO_CONTENT = 204;
	distCommonjs.RESET_CONTENT = 205;
	distCommonjs.PARTIAL_CONTENT = 206;
	distCommonjs.MULTI_STATUS = 207;
	distCommonjs.MULTIPLE_CHOICES = 300;
	distCommonjs.MOVED_PERMANENTLY = 301;
	distCommonjs.MOVED_TEMPORARILY = 302;
	distCommonjs.SEE_OTHER = 303;
	distCommonjs.NOT_MODIFIED = 304;
	distCommonjs.USE_PROXY = 305;
	distCommonjs.TEMPORARY_REDIRECT = 307;
	distCommonjs.BAD_REQUEST = 400;
	distCommonjs.UNAUTHORIZED = 401;
	distCommonjs.PAYMENT_REQUIRED = 402;
	distCommonjs.FORBIDDEN = 403;
	distCommonjs.NOT_FOUND = 404;
	distCommonjs.METHOD_NOT_ALLOWED = 405;
	distCommonjs.NOT_ACCEPTABLE = 406;
	distCommonjs.PROXY_AUTHENTICATION_REQUIRED = 407;
	distCommonjs.REQUEST_TIME_OUT = 408;
	distCommonjs.CONFLICT = 409;
	distCommonjs.GONE = 410;
	distCommonjs.LENGTH_REQUIRED = 411;
	distCommonjs.PRECONDITION_FAILED = 412;
	distCommonjs.REQUEST_ENTITY_TOO_LARGE = 413;
	distCommonjs.REQUEST_URI_TOO_LARGE = 414;
	distCommonjs.UNSUPPORTED_MEDIA_TYPE = 415;
	distCommonjs.REQUESTED_RANGE_NOT_SATISFIABLE = 416;
	distCommonjs.EXPECTATION_FAILED = 417;
	distCommonjs.IM_A_TEAPOT = 418;
	distCommonjs.UNPROCESSABLE_ENTITY = 422;
	distCommonjs.LOCKED = 423;
	distCommonjs.FAILED_DEPENDENCY = 424;
	distCommonjs.UNORDERED_COLLECTION = 425;
	distCommonjs.UPGRADE_REQUIRED = 426;
	distCommonjs.PRECONDITION_REQUIRED = 428;
	distCommonjs.TOO_MANY_REQUESTS = 429;
	distCommonjs.REQUEST_HEADER_FIELDS_TOO_LARGE = 431;
	distCommonjs.INTERNAL_SERVER_ERROR = 500;
	distCommonjs.NOT_IMPLEMENTED = 501;
	distCommonjs.BAD_GATEWAY = 502;
	distCommonjs.SERVICE_UNAVAILABLE = 503;
	distCommonjs.GATEWAY_TIME_OUT = 504;
	distCommonjs.HTTP_VERSION_NOT_SUPPORTED = 505;
	distCommonjs.VARIANT_ALSO_NEGOTIATES = 506;
	distCommonjs.INSUFFICIENT_STORAGE = 507;
	distCommonjs.BANDWIDTH_LIMIT_EXCEEDED = 509;
	distCommonjs.NOT_EXTENDED = 510;
	distCommonjs.NETWORK_AUTHENTICATION_REQUIRED = 511;
	
	return distCommonjs;
}

var distCommonjsExports = /*@__PURE__*/ requireDistCommonjs();

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var Utils = /** @class */ (function () {
    function Utils() {
    }
    Utils.getMediaType = function (type) {
        type = type.toLowerCase();
        type = type.split(";")[0];
        return type.trim();
    };
    Utils.getImageQuality = function (profile) {
        if (profile === distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_1 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_2 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_1 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_2 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_1 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_2 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_1 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_2 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_1 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_1 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_2 ||
            profile === distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_2) {
            return "native";
        }
        return "default";
    };
    Utils.getInexactLocale = function (locale) {
        if (locale.indexOf("-") !== -1) {
            return locale.substr(0, locale.indexOf("-"));
        }
        return locale;
    };
    Utils.getLocalisedValue = function (resource, locale) {
        // if the resource is not an array of translations, return the string.
        if (!Array.isArray(resource)) {
            return resource;
        }
        // test for exact match
        for (var i = 0; i < resource.length; i++) {
            var value_1 = resource[i];
            var language_1 = value_1["@language"];
            if (locale === language_1) {
                return value_1["@value"];
            }
        }
        // test for inexact match
        var match = locale.substr(0, locale.indexOf("-"));
        for (var i = 0; i < resource.length; i++) {
            var value = resource[i];
            var language = value["@language"];
            if (language === match) {
                return value["@value"];
            }
        }
        return null;
    };
    Utils.generateTreeNodeIds = function (treeNode, index) {
        if (index === void 0) { index = 0; }
        var id;
        if (!treeNode.parentNode) {
            id = "0";
        }
        else {
            id = treeNode.parentNode.id + "-" + index;
        }
        treeNode.id = id;
        for (var i = 0; i < treeNode.nodes.length; i++) {
            var n = treeNode.nodes[i];
            Utils.generateTreeNodeIds(n, i);
        }
    };
    Utils.normaliseType = function (type) {
        type = (type || "").toLowerCase();
        if (type.indexOf(":") !== -1) {
            var split = type.split(":");
            return split[1];
        }
        return type;
    };
    Utils.normaliseUrl = function (url) {
        url = url.substr(url.indexOf("://"));
        if (url.indexOf("#") !== -1) {
            url = url.split("#")[0];
        }
        return url;
    };
    Utils.normalisedUrlsMatch = function (url1, url2) {
        return Utils.normaliseUrl(url1) === Utils.normaliseUrl(url2);
    };
    Utils.isImageProfile = function (profile) {
        if (Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_PROFILE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_PROFILE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_PROFILE_LEVEL_2)) {
            return true;
        }
        return false;
    };
    Utils.isImageServiceType = function (type) {
        return ((type !== null &&
            type.toLowerCase() === distCommonjsExports$1.ServiceType.IMAGE_SERVICE_2.toLowerCase()) ||
            type === distCommonjsExports$1.ServiceType.IMAGE_SERVICE_3.toLowerCase());
    };
    Utils.isLevel0ImageProfile = function (profile) {
        if (Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_LEVEL_0) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_PROFILE_LEVEL_0)) {
            return true;
        }
        return false;
    };
    Utils.isLevel1ImageProfile = function (profile) {
        if (Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_LEVEL_1) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_PROFILE_LEVEL_1)) {
            return true;
        }
        return false;
    };
    Utils.isLevel2ImageProfile = function (profile) {
        if (Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_COMPLIANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_COMPLIANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_0_CONFORMANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_CONFORMANCE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_1_PROFILE_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_LEVEL_2) ||
            Utils.normalisedUrlsMatch(profile, distCommonjsExports$1.ServiceProfile.IMAGE_2_PROFILE_LEVEL_2)) {
            return true;
        }
        return false;
    };
    Utils.parseManifest = function (manifest, options) {
        return Deserialiser.parse(manifest, options);
    };
    Utils.checkStatus = function (response) {
        if (response.ok) {
            return response;
        }
        else {
            var error = new Error(response.statusText);
            error.response = response;
            return Promise.reject(error);
        }
    };
    Utils.loadManifest = function (url) {
        return new Promise(function (resolve, reject) {
            fetch(url)
                .then(Utils.checkStatus)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                resolve(data);
            })
                .catch(function (err) {
                reject();
            });
        });
    };
    Utils.loadExternalResourcesAuth1 = function (resources, openContentProviderInteraction, openTokenService, getStoredAccessToken, userInteractedWithContentProvider, getContentProviderInteraction, handleMovedTemporarily, showOutOfOptionsMessages) {
        return new Promise(function (resolve, reject) {
            var promises = resources.map(function (resource) {
                return Utils.loadExternalResourceAuth1(resource, openContentProviderInteraction, openTokenService, getStoredAccessToken, userInteractedWithContentProvider, getContentProviderInteraction, handleMovedTemporarily, showOutOfOptionsMessages);
            });
            Promise.all(promises)
                .then(function () {
                resolve(resources);
            })["catch"](function (error) {
                reject(error);
            });
        });
    };
    Utils.loadExternalResourceAuth1 = function (resource, openContentProviderInteraction, openTokenService, getStoredAccessToken, userInteractedWithContentProvider, getContentProviderInteraction, handleMovedTemporarily, showOutOfOptionsMessages) {
        return __awaiter(this, void 0, void 0, function () {
            var storedAccessToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getStoredAccessToken(resource)];
                    case 1:
                        storedAccessToken = _a.sent();
                        if (!storedAccessToken) return [3 /*break*/, 6];
                        return [4 /*yield*/, resource.getData(storedAccessToken)];
                    case 2:
                        _a.sent();
                        if (!(resource.status === distCommonjsExports.OK)) return [3 /*break*/, 3];
                        return [2 /*return*/, resource];
                    case 3: 
                    // the stored token is no good for this resource
                    return [4 /*yield*/, Utils.doAuthChain(resource, openContentProviderInteraction, openTokenService, userInteractedWithContentProvider, getContentProviderInteraction, handleMovedTemporarily, showOutOfOptionsMessages)];
                    case 4:
                        // the stored token is no good for this resource
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        if (resource.status === distCommonjsExports.OK || resource.status === distCommonjsExports.MOVED_TEMPORARILY) {
                            return [2 /*return*/, resource];
                        }
                        throw Utils.createAuthorizationFailedError();
                    case 6: return [4 /*yield*/, resource.getData()];
                    case 7:
                        _a.sent();
                        if (!(resource.status === distCommonjsExports.MOVED_TEMPORARILY ||
                            resource.status === distCommonjsExports.UNAUTHORIZED)) return [3 /*break*/, 9];
                        return [4 /*yield*/, Utils.doAuthChain(resource, openContentProviderInteraction, openTokenService, userInteractedWithContentProvider, getContentProviderInteraction, handleMovedTemporarily, showOutOfOptionsMessages)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        if (resource.status === distCommonjsExports.OK || resource.status === distCommonjsExports.MOVED_TEMPORARILY) {
                            return [2 /*return*/, resource];
                        }
                        throw Utils.createAuthorizationFailedError();
                }
            });
        });
    };
    Utils.doAuthChain = function (resource, openContentProviderInteraction, openTokenService, userInteractedWithContentProvider, getContentProviderInteraction, handleMovedTemporarily, showOutOfOptionsMessages) {
        return __awaiter(this, void 0, void 0, function () {
            var externalService, kioskService, clickThroughService, loginService, serviceToTry, lastAttempted, kioskInteraction, contentProviderInteraction, contentProviderInteraction;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // This function enters the flowchart at the < External? > junction
                        // http://iiif.io/api/auth/1.0/#workflow-from-the-browser-client-perspective
                        if (!resource.isAccessControlled()) {
                            return [2 /*return*/, resource]; // no services found
                        }
                        externalService = resource.externalService;
                        if (externalService) {
                            externalService.options = resource.options;
                        }
                        kioskService = resource.kioskService;
                        if (kioskService) {
                            kioskService.options = resource.options;
                        }
                        clickThroughService = resource.clickThroughService;
                        if (clickThroughService) {
                            clickThroughService.options = resource.options;
                        }
                        loginService = resource.loginService;
                        if (loginService) {
                            loginService.options = resource.options;
                        }
                        if (!(!resource.isResponseHandled && resource.status === distCommonjsExports.MOVED_TEMPORARILY)) return [3 /*break*/, 2];
                        return [4 /*yield*/, handleMovedTemporarily(resource)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, resource];
                    case 2:
                        serviceToTry = null;
                        lastAttempted = null;
                        // repetition of logic is left in these steps for clarity:
                        // Looking for external pattern
                        serviceToTry = externalService;
                        if (!serviceToTry) return [3 /*break*/, 4];
                        lastAttempted = serviceToTry;
                        return [4 /*yield*/, Utils.attemptResourceWithToken(resource, openTokenService, serviceToTry)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, resource];
                    case 4:
                        // Looking for kiosk pattern
                        serviceToTry = kioskService;
                        if (!serviceToTry) return [3 /*break*/, 7];
                        lastAttempted = serviceToTry;
                        kioskInteraction = openContentProviderInteraction(serviceToTry);
                        if (!kioskInteraction) return [3 /*break*/, 7];
                        return [4 /*yield*/, userInteractedWithContentProvider(kioskInteraction)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, Utils.attemptResourceWithToken(resource, openTokenService, serviceToTry)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, resource];
                    case 7:
                        // The code for the next two patterns is identical (other than the profile name).
                        // The difference is in the expected behaviour of
                        //
                        //    await userInteractedWithContentProvider(contentProviderInteraction);
                        //
                        // For clickthrough the opened window should close immediately having established
                        // a session, whereas for login the user might spend some time entering credentials etc.
                        // Looking for clickthrough pattern
                        serviceToTry = clickThroughService;
                        if (!serviceToTry) return [3 /*break*/, 11];
                        lastAttempted = serviceToTry;
                        return [4 /*yield*/, getContentProviderInteraction(resource, serviceToTry)];
                    case 8:
                        contentProviderInteraction = _a.sent();
                        if (!contentProviderInteraction) return [3 /*break*/, 11];
                        // should close immediately
                        return [4 /*yield*/, userInteractedWithContentProvider(contentProviderInteraction)];
                    case 9:
                        // should close immediately
                        _a.sent();
                        return [4 /*yield*/, Utils.attemptResourceWithToken(resource, openTokenService, serviceToTry)];
                    case 10:
                        _a.sent();
                        return [2 /*return*/, resource];
                    case 11:
                        // Looking for login pattern
                        serviceToTry = loginService;
                        if (!serviceToTry) return [3 /*break*/, 15];
                        lastAttempted = serviceToTry;
                        return [4 /*yield*/, getContentProviderInteraction(resource, serviceToTry)];
                    case 12:
                        contentProviderInteraction = _a.sent();
                        if (!contentProviderInteraction) return [3 /*break*/, 15];
                        // we expect the user to spend some time interacting
                        return [4 /*yield*/, userInteractedWithContentProvider(contentProviderInteraction)];
                    case 13:
                        // we expect the user to spend some time interacting
                        _a.sent();
                        return [4 /*yield*/, Utils.attemptResourceWithToken(resource, openTokenService, serviceToTry)];
                    case 14:
                        _a.sent();
                        return [2 /*return*/, resource];
                    case 15:
                        // nothing worked! Use the most recently tried service as the source of
                        // messages to show to the user.
                        if (lastAttempted) {
                            showOutOfOptionsMessages(resource, lastAttempted);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    Utils.attemptResourceWithToken = function (resource, openTokenService, authService) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenService, tokenMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tokenService = authService.getService(distCommonjsExports$1.ServiceProfile.AUTH_1_TOKEN);
                        if (!tokenService) return [3 /*break*/, 3];
                        return [4 /*yield*/, openTokenService(resource, tokenService)];
                    case 1:
                        tokenMessage = _a.sent();
                        if (!(tokenMessage && tokenMessage.accessToken)) return [3 /*break*/, 3];
                        return [4 /*yield*/, resource.getData(tokenMessage)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, resource];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Utils.loadExternalResourcesAuth09 = function (resources, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, getStoredAccessToken, handleResourceResponse, options) {
        return new Promise(function (resolve, reject) {
            var promises = resources.map(function (resource) {
                return Utils.loadExternalResourceAuth09(resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, getStoredAccessToken, handleResourceResponse, options);
            });
            Promise.all(promises)
                .then(function () {
                resolve(resources);
            })["catch"](function (error) {
                reject(error);
            });
        });
    };
    // IIIF auth api pre v1.0
    // Keeping this around for now until the auth 1.0 implementation is stable
    Utils.loadExternalResourceAuth09 = function (resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, getStoredAccessToken, handleResourceResponse, options) {
        return new Promise(function (resolve, reject) {
            if (options && options.pessimisticAccessControl) {
                // pessimistic: access control cookies may have been deleted.
                // always request the access token for every access controlled info.json request
                // returned access tokens are not stored, therefore the login window flashes for every request.
                resource
                    .getData()
                    .then(function () {
                    if (resource.isAccessControlled()) {
                        // if the resource has a click through service, use that.
                        if (resource.clickThroughService) {
                            resolve(clickThrough(resource));
                            //} else if(resource.restrictedService) {
                            resolve(restricted(resource));
                        }
                        else {
                            login(resource)
                                .then(function () {
                                getAccessToken(resource, true)
                                    .then(function (token) {
                                    resource
                                        .getData(token)
                                        .then(function () {
                                        resolve(handleResourceResponse(resource));
                                    })["catch"](function (message) {
                                        reject(Utils.createInternalServerError(message));
                                    });
                                })["catch"](function (message) {
                                    reject(Utils.createInternalServerError(message));
                                });
                            })["catch"](function (message) {
                                reject(Utils.createInternalServerError(message));
                            });
                        }
                    }
                    else {
                        // this info.json isn't access controlled, therefore no need to request an access token.
                        resolve(resource);
                    }
                })["catch"](function (message) {
                    reject(Utils.createInternalServerError(message));
                });
            }
            else {
                // optimistic: access control cookies may not have been deleted.
                // store access tokens to avoid login window flashes.
                // if cookies are deleted a page refresh is required.
                // try loading the resource using an access token that matches the info.json domain.
                // if an access token is found, request the resource using it regardless of whether it is access controlled.
                getStoredAccessToken(resource, tokenStorageStrategy)
                    .then(function (storedAccessToken) {
                    if (storedAccessToken) {
                        // try using the stored access token
                        resource
                            .getData(storedAccessToken)
                            .then(function () {
                            // if the info.json loaded using the stored access token
                            if (resource.status === distCommonjsExports.OK) {
                                resolve(handleResourceResponse(resource));
                            }
                            else {
                                // otherwise, load the resource data to determine the correct access control services.
                                // if access controlled, do login.
                                Utils.authorize(resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, getStoredAccessToken)
                                    .then(function () {
                                    resolve(handleResourceResponse(resource));
                                })["catch"](function (error) {
                                    // if (resource.restrictedService){
                                    //     reject(Utils.createRestrictedError());
                                    // } else {
                                    reject(Utils.createAuthorizationFailedError());
                                    //}
                                });
                            }
                        })["catch"](function (error) {
                            reject(Utils.createAuthorizationFailedError());
                        });
                    }
                    else {
                        Utils.authorize(resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, getStoredAccessToken)
                            .then(function () {
                            resolve(handleResourceResponse(resource));
                        })["catch"](function (error) {
                            reject(Utils.createAuthorizationFailedError());
                        });
                    }
                })["catch"](function (error) {
                    reject(Utils.createAuthorizationFailedError());
                });
            }
        });
    };
    Utils.createError = function (name, message) {
        var error = new Error();
        error.message = message;
        error.name = String(name);
        return error;
    };
    Utils.createAuthorizationFailedError = function () {
        return Utils.createError(StatusCode.AUTHORIZATION_FAILED, "Authorization failed");
    };
    Utils.createRestrictedError = function () {
        return Utils.createError(StatusCode.RESTRICTED, "Restricted");
    };
    Utils.createInternalServerError = function (message) {
        return Utils.createError(StatusCode.INTERNAL_SERVER_ERROR, message);
    };
    Utils.authorize = function (resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, getStoredAccessToken) {
        return new Promise(function (resolve, reject) {
            resource.getData().then(function () {
                if (resource.isAccessControlled()) {
                    getStoredAccessToken(resource, tokenStorageStrategy)
                        .then(function (storedAccessToken) {
                        if (storedAccessToken) {
                            // try using the stored access token
                            resource
                                .getData(storedAccessToken)
                                .then(function () {
                                if (resource.status === distCommonjsExports.OK) {
                                    resolve(resource); // happy path ended
                                }
                                else {
                                    // the stored token is no good for this resource
                                    Utils.showAuthInteraction(resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, resolve, reject);
                                }
                            })["catch"](function (message) {
                                reject(Utils.createInternalServerError(message));
                            });
                        }
                        else {
                            // There was no stored token, but the user might have a cookie that will grant a token
                            getAccessToken(resource, false).then(function (accessToken) {
                                if (accessToken) {
                                    storeAccessToken(resource, accessToken, tokenStorageStrategy)
                                        .then(function () {
                                        // try using the fresh access token
                                        resource
                                            .getData(accessToken)
                                            .then(function () {
                                            if (resource.status === distCommonjsExports.OK) {
                                                resolve(resource);
                                            }
                                            else {
                                                // User has a token, but it's not good enough
                                                Utils.showAuthInteraction(resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, resolve, reject);
                                            }
                                        })["catch"](function (message) {
                                            reject(Utils.createInternalServerError(message));
                                        });
                                    })["catch"](function (message) {
                                        // not able to store access token
                                        reject(Utils.createInternalServerError(message));
                                    });
                                }
                                else {
                                    // The user did not have a cookie that granted a token
                                    Utils.showAuthInteraction(resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, resolve, reject);
                                }
                            });
                        }
                    })["catch"](function (message) {
                        reject(Utils.createInternalServerError(message));
                    });
                }
                else {
                    // this info.json isn't access controlled, therefore there's no need to request an access token
                    resolve(resource);
                }
            });
        });
    };
    Utils.showAuthInteraction = function (resource, tokenStorageStrategy, clickThrough, restricted, login, getAccessToken, storeAccessToken, resolve, reject) {
        if (resource.status === distCommonjsExports.MOVED_TEMPORARILY && !resource.isResponseHandled) {
            // if the resource was redirected to a degraded version
            // and the response hasn't been handled yet.
            // if the client wishes to trigger a login, set resource.isResponseHandled to true
            // and call loadExternalResources() again passing the resource.
            resolve(resource);
            // } else if (resource.restrictedService) {
            //     resolve(restricted(resource));
            //     // TODO: move to next etc
        }
        else if (resource.clickThroughService && !resource.isResponseHandled) {
            // if the resource has a click through service, use that.
            clickThrough(resource).then(function () {
                getAccessToken(resource, true)
                    .then(function (accessToken) {
                    storeAccessToken(resource, accessToken, tokenStorageStrategy)
                        .then(function () {
                        resource
                            .getData(accessToken)
                            .then(function () {
                            resolve(resource);
                        })["catch"](function (message) {
                            reject(Utils.createInternalServerError(message));
                        });
                    })["catch"](function (message) {
                        reject(Utils.createInternalServerError(message));
                    });
                })["catch"](function (message) {
                    reject(Utils.createInternalServerError(message));
                });
            });
        }
        else {
            // get an access token
            login(resource).then(function () {
                getAccessToken(resource, true)
                    .then(function (accessToken) {
                    storeAccessToken(resource, accessToken, tokenStorageStrategy)
                        .then(function () {
                        resource
                            .getData(accessToken)
                            .then(function () {
                            resolve(resource);
                        })["catch"](function (message) {
                            reject(Utils.createInternalServerError(message));
                        });
                    })["catch"](function (message) {
                        reject(Utils.createInternalServerError(message));
                    });
                })["catch"](function (message) {
                    reject(Utils.createInternalServerError(message));
                });
            });
        }
    };
    Utils.getService = function (resource, profile) {
        var services = this.getServices(resource);
        for (var i = 0; i < services.length; i++) {
            var service = services[i];
            if (service.getProfile() === profile) {
                return service;
            }
        }
        return null;
    };
    Utils.getResourceById = function (parentResource, id) {
        return (Utils.traverseAndFind(parentResource.__jsonld, "@id", id));
    };
    /**
     * Does a depth first traversal of an Object, returning an Object that
     * matches provided k and v arguments
     * @example Utils.traverseAndFind({foo: 'bar'}, 'foo', 'bar')
     */
    Utils.traverseAndFind = function (object, k, v) {
        if (object.hasOwnProperty(k) && object[k] === v) {
            return object;
        }
        for (var i = 0; i < Object.keys(object).length; i++) {
            if (typeof object[Object.keys(object)[i]] === "object") {
                var o = Utils.traverseAndFind(object[Object.keys(object)[i]], k, v);
                if (o != null) {
                    return o;
                }
            }
        }
        return undefined;
    };
    Utils.getServices = function (resource, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.onlyService, onlyService = _c === void 0 ? false : _c, _d = _b.onlyServices, onlyServices = _d === void 0 ? false : _d, _e = _b.skipParentResources, skipParentResources = _e === void 0 ? false : _e;
        var services = [];
        // Resources can reference "services" on the manifest. This is a bit of a hack to just get the services from the manifest
        // too. What would be better is if this was used as a "Map" of full services.
        // So when you come across { id: '...' } without any data, you can "lookup" services from the manifest.
        // I would have implemented this if I was confident that it was reliable. Instead, I opted for the safest option that
        // should not break any existing services.
        if (!skipParentResources &&
            resource &&
            resource.options &&
            resource.options.resource &&
            resource.options.resource !== resource) {
            services.push.apply(services, Utils.getServices(resource.options.resource, { onlyServices: true }));
        }
        var service = !onlyServices
            ? (resource.__jsonld || resource).service || []
            : [];
        // coerce to array
        if (!Array.isArray(service)) {
            service = [service];
        }
        if (!onlyService) {
            // Some resources also have a `.services` property.
            // https://iiif.io/api/presentation/3.0/#services
            service.push.apply(service, ((resource.__jsonld || resource).services || []));
        }
        if (service.length === 0) {
            return services;
        }
        for (var i = 0; i < service.length; i++) {
            var s = service[i];
            if (typeof s === "string") {
                var r = this.getResourceById(resource.options.resource, s);
                if (r) {
                    services.push(new Service(r.__jsonld || r, resource.options));
                }
            }
            else {
                services.push(new Service(s, resource.options));
            }
        }
        return services;
    };
    Utils.getTemporalComponent = function (target) {
        var temporal = /t=([^&]+)/g.exec(target);
        var t = null;
        if (temporal && temporal[1]) {
            t = temporal[1].split(",");
        }
        return t;
    };
    return Utils;
}());

var __extends$b = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/** Utility class to hold one or more values with their associated (optional) locale */
var LocalizedValue = /** @class */ (function () {
    function LocalizedValue(value, locale, defaultLocale) {
        if (defaultLocale === void 0) { defaultLocale = "none"; }
        if (Array.isArray(value) && value.length === 1) {
            this._value = value[0];
        }
        else {
            this._value = value;
        }
        if (locale === "none" || locale === "@none") {
            locale = undefined;
        }
        this._locale = locale;
        this._defaultLocale = defaultLocale;
    }
    /** Parse a localized value from a IIIF v2 property value
     *
     * @param {string | string[] | object | object[]} rawVal value from IIIF resource
     * @param {string | undefined} defaultLocale deprecated: defaultLocale the default locale to use for this value
     */
    LocalizedValue.parseV2Value = function (rawVal, defaultLocale) {
        if (typeof rawVal === "string") {
            return new LocalizedValue(rawVal, undefined, defaultLocale);
        }
        else if (rawVal["@value"]) {
            return new LocalizedValue(rawVal["@value"], rawVal["@language"], defaultLocale);
        }
        return null;
    };
    Object.defineProperty(LocalizedValue.prototype, "value", {
        /*** @deprecated Use PropertyValue#getValue instead */
        get: function () {
            if (Array.isArray(this._value)) {
                return this._value.join("<br/>");
            }
            return this._value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LocalizedValue.prototype, "locale", {
        /*** @deprecated Don't use, only used for backwards compatibility reasons */
        get: function () {
            if (this._locale === undefined) {
                return this._defaultLocale;
            }
            return this._locale;
        },
        enumerable: false,
        configurable: true
    });
    LocalizedValue.prototype.addValue = function (value) {
        if (!Array.isArray(this._value)) {
            this._value = [this._value];
        }
        if (Array.isArray(value)) {
            this._value = this._value.concat(value);
        }
        else {
            this._value.push(value);
        }
    };
    return LocalizedValue;
}());
/***
 * Holds a collection of values and their (optional) languages and allows
 * language-based value retrieval as per the algorithm described in
 * https://iiif.io/api/presentation/2.1/#language-of-property-values
 */
var PropertyValue = /** @class */ (function (_super) {
    __extends$b(PropertyValue, _super);
    function PropertyValue(values, defaultLocale) {
        if (values === void 0) { values = []; }
        var _this = _super.apply(this, values) || this;
        // Needed for ES5 compatibility, see https://stackoverflow.com/a/40967939
        _this.__proto__ = PropertyValue.prototype;
        _this._defaultLocale = defaultLocale;
        return _this;
    }
    PropertyValue.parse = function (rawVal, defaultLocale) {
        if (!rawVal) {
            return new PropertyValue([], defaultLocale);
        }
        if (Array.isArray(rawVal)) {
            // Collection of IIIF v2 property values
            var parsed = rawVal
                .map(function (v) { return LocalizedValue.parseV2Value(v, defaultLocale); })
                .filter(function (v) { return v !== null; });
            var byLocale = parsed.reduce(function (acc, lv) {
                var loc = lv._locale;
                if (!loc) {
                    // Cannot use undefined as an object key
                    loc = "none";
                }
                if (acc[loc]) {
                    acc[loc].addValue(lv._value);
                }
                else {
                    acc[loc] = lv;
                }
                return acc;
            }, {});
            return new PropertyValue(Object.values(byLocale), defaultLocale);
        }
        else if (typeof rawVal === "string") {
            return new PropertyValue([new LocalizedValue(rawVal, undefined, defaultLocale)], defaultLocale);
        }
        else if (rawVal["@language"]) {
            // Single IIIF v2 property value
            var parsed = LocalizedValue.parseV2Value(rawVal);
            return new PropertyValue(parsed !== null ? [parsed] : [], defaultLocale);
        }
        else if (rawVal["@value"]) {
            // Single IIIF v2 property value without language
            var parsed = LocalizedValue.parseV2Value(rawVal);
            return new PropertyValue(parsed !== null ? [parsed] : [], defaultLocale);
        }
        else {
            // IIIF v3 property value
            return new PropertyValue(Object.keys(rawVal).map(function (locale) {
                var val = rawVal[locale];
                if (!Array.isArray(val)) {
                    throw new Error("A IIIF v3 localized property value must have an array as the value for a given language.");
                }
                return new LocalizedValue(val, locale, defaultLocale);
            }), defaultLocale);
        }
    };
    /*** Try to find the available locale that best fit's the user's preferences. */
    PropertyValue.prototype.getSuitableLocale = function (locales) {
        // If any of the values have a language associated with them, the client
        // must display all of the values associated with the language that best
        // matches the language preference.
        if (locales.length == 0 && this._defaultLocale)
            locales.push(this._defaultLocale);
        var allLocales = Array.from(this.values())
            .map(function (lv) { return lv._locale; })
            .filter(function (l) { return l !== undefined; });
        var _loop_1 = function (userLocale) {
            var matchingLocale = allLocales.find(function (l) { return l === userLocale; });
            if (matchingLocale) {
                return { value: matchingLocale };
            }
        };
        // First, look for a precise match
        for (var _i = 0, locales_1 = locales; _i < locales_1.length; _i++) {
            var userLocale = locales_1[_i];
            var state_1 = _loop_1(userLocale);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        var _loop_2 = function (userLocale) {
            var matchingLocale = allLocales.find(function (l) { return Utils.getInexactLocale(l) === Utils.getInexactLocale(userLocale); });
            if (matchingLocale) {
                return { value: matchingLocale };
            }
        };
        // Look for an inexact match
        for (var _a = 0, locales_2 = locales; _a < locales_2.length; _a++) {
            var userLocale = locales_2[_a];
            var state_2 = _loop_2(userLocale);
            if (typeof state_2 === "object")
                return state_2.value;
        }
        return undefined;
    };
    /**
     * Set the value(s) for a given locale.
     *
     * If there's an existing locale that matches the given locale, it will be updated.
     *
     * @param locale Locale to set the value for
     * @param value value to set
     */
    PropertyValue.prototype.setValue = function (value, locale) {
        var existing = undefined;
        if (!locale) {
            existing = this.find(function (lv) { return lv._locale === undefined; });
        }
        else {
            var bestLocale_1 = this.getSuitableLocale([locale]);
            if (bestLocale_1) {
                existing = this.find(function (lv) { return lv._locale === bestLocale_1; });
            }
        }
        if (existing) {
            // Mutate existing localized value
            existing._value = value;
        }
        else {
            // Create a new localized value
            this.push(new LocalizedValue(value, locale, this._defaultLocale));
        }
    };
    /**
     * Get a value in the most suitable locale.
     *
     * @param {string | string[] | undefined} locales Desired locale, can be a list of
     * locales sorted by descending priority.
     * @param {string | undefined} joinWith String to join multiple available values by,
     * if undefined only the first available value will be returned
     * @returns the first value in the most suitable locale or null if none could be found
     */
    PropertyValue.prototype.getValue = function (locales, joinWith) {
        var vals = this.getValues(locales);
        if (vals.length === 0) {
            return null;
        }
        if (joinWith) {
            return vals.join(joinWith);
        }
        return vals[0];
    };
    /**
     * Get all values available in the most suitable locale.
     *
     * @param {string | string[]} userLocales Desired locale, can be a list of
     * locales sorted by descending priority.
     * @returns the values for the most suitable locale, empty if none could be found
     */
    PropertyValue.prototype.getValues = function (userLocales) {
        if (!this.length) {
            return [];
        }
        var locales;
        if (!userLocales) {
            locales = [];
        }
        else if (!Array.isArray(userLocales)) {
            locales = [userLocales];
        }
        else {
            locales = userLocales;
        }
        // If none of the values have a language associated with them, the client
        // must display all of the values.
        if (this.length === 1 && this[0]._locale === undefined) {
            var val = this[0]._value;
            return Array.isArray(val) ? val : [val];
        }
        // Try to determine the available locale that best fits the user's preferences
        var matchingLocale = this.getSuitableLocale(locales);
        if (matchingLocale) {
            var val = this.find(function (lv) { return lv._locale === matchingLocale; })._value;
            return Array.isArray(val) ? val : [val];
        }
        // If all of the values have a language associated with them, and none match
        // the language preference, the client must select a language and display
        // all of the values associated with that language.
        var allHaveLang = !this.find(function (lv) { return lv._locale === undefined; });
        if (allHaveLang) {
            var val = this[0]._value;
            return Array.isArray(val) ? val : [val];
        }
        // If some of the values have a language associated with them, but none
        // match the language preference, the client must display all of the values
        // that do not have a language associated with them.
        var lv = this.find(function (lv) { return lv._locale === undefined; });
        if (lv) {
            return Array.isArray(lv._value) ? lv._value : [lv._value];
        }
        return [];
    };
    return PropertyValue;
}(Array));

var __extends$a = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/**
 * @remarks Scenes are conveniently retrieved from a Manifest by iterating through
 * Sequence in the Manifest, inner loop the Scenes in each sequence
 * @see {@link Sequence }
 *
 * @example
 * var manifest: Manifest;
 * function doSomethingWithScene(scene:Scene)...
 * ...
 * foreach(var seq:Sequence of manifest.getSequences()
 *   foreach(var scene : Scene of seq.getScenes()
 *     doSomethingWithScene(scene);
 **/
var Manifest = /** @class */ (function (_super) {
    __extends$a(Manifest, _super);
    function Manifest(jsonld, options) {
        var _this = _super.call(this, jsonld, options) || this;
        _this.index = 0;
        _this._allRanges = null;
        _this.items = [];
        _this._topRanges = [];
        if (_this.__jsonld.structures && _this.__jsonld.structures.length) {
            var topRanges = _this._getTopRanges();
            for (var i = 0; i < topRanges.length; i++) {
                var range = topRanges[i];
                _this._parseRanges(range, String(i));
            }
        }
        // initialization the cached _annotationIdMap to null
        // it will be populated if and only if client calls make a request
        // to the getter annotationIdMap
        _this._annotationIdMap = null;
        return _this;
    }
    /** @deprecated Use getAccompanyingCanvas instead */
    Manifest.prototype.getPosterCanvas = function () {
        var posterCanvas = this.getProperty("posterCanvas");
        if (posterCanvas) {
            posterCanvas = new Canvas(posterCanvas, this.options);
        }
        return posterCanvas;
    };
    Manifest.prototype.getAccompanyingCanvas = function () {
        var accompanyingCanvas = this.getProperty("accompanyingCanvas");
        if (accompanyingCanvas) {
            accompanyingCanvas = new Canvas(accompanyingCanvas, this.options);
        }
        return accompanyingCanvas;
    };
    Manifest.prototype.getBehavior = function () {
        var behavior = this.getProperty("behavior");
        if (Array.isArray(behavior)) {
            behavior = behavior[0];
        }
        if (behavior) {
            return behavior;
        }
        return null;
    };
    Manifest.prototype.getDefaultTree = function () {
        _super.prototype.getDefaultTree.call(this);
        this.defaultTree.data.type = Utils.normaliseType(TreeNodeType.MANIFEST);
        if (!this.isLoaded) {
            return this.defaultTree;
        }
        var topRanges = this.getTopRanges();
        // if there are any ranges in the manifest, default to the first 'top' range or generated placeholder
        if (topRanges.length) {
            topRanges[0].getTree(this.defaultTree);
        }
        Utils.generateTreeNodeIds(this.defaultTree);
        return this.defaultTree;
    };
    Manifest.prototype._getTopRanges = function () {
        var topRanges = [];
        if (this.__jsonld.structures && this.__jsonld.structures.length) {
            for (var i = 0; i < this.__jsonld.structures.length; i++) {
                var json = this.__jsonld.structures[i];
                if (json.viewingHint === distCommonjsExports$1.ViewingHint.TOP) {
                    topRanges.push(json);
                }
            }
            // if no viewingHint="top" range was found, create a default one
            if (!topRanges.length) {
                var range = {};
                range.ranges = this.__jsonld.structures;
                topRanges.push(range);
            }
        }
        return topRanges;
    };
    Manifest.prototype.getTopRanges = function () {
        return this._topRanges;
    };
    Manifest.prototype._getRangeById = function (id) {
        if (this.__jsonld.structures && this.__jsonld.structures.length) {
            for (var i = 0; i < this.__jsonld.structures.length; i++) {
                var r = this.__jsonld.structures[i];
                if (r["@id"] === id || r.id === id) {
                    return r;
                }
            }
        }
        return null;
    };
    //private _parseRangeCanvas(json: any, range: Range): void {
    // todo: currently this isn't needed
    //var canvas: IJSONLDResource = new JSONLDResource(json);
    //range.items.push(<IManifestResource>canvas);
    //}
    Manifest.prototype._parseRanges = function (r, path, parentRange) {
        var id = null;
        if (typeof r === "string") {
            id = r;
            r = this._getRangeById(id);
        }
        if (!r) {
            console.warn("Range:", id, "does not exist");
            return;
        }
        var range = new Range(r, this.options);
        range.parentRange = parentRange;
        range.path = path;
        if (!parentRange) {
            this._topRanges.push(range);
        }
        else {
            parentRange.items.push(range);
        }
        var items = r.items || r.members;
        if (items) {
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                // todo: use an ItemType constant?
                if ((item["@type"] && item["@type"].toLowerCase() === "sc:range") ||
                    (item["type"] && item["type"].toLowerCase() === "range")) {
                    this._parseRanges(item, path + "/" + i, range);
                }
                else if ((item["@type"] && item["@type"].toLowerCase() === "sc:canvas") ||
                    (item["type"] && item["type"].toLowerCase() === "canvas")) {
                    // store the ids on the __jsonld object to be used by Range.getCanvasIds()
                    if (!range.canvases) {
                        range.canvases = [];
                    }
                    var id_1 = item.id || item["@id"];
                    range.canvases.push(id_1);
                }
            }
        }
        else if (r.ranges) {
            for (var i = 0; i < r.ranges.length; i++) {
                this._parseRanges(r.ranges[i], path + "/" + i, range);
            }
        }
    };
    Manifest.prototype.getAllRanges = function () {
        if (this._allRanges != null)
            return this._allRanges;
        this._allRanges = [];
        var topRanges = this.getTopRanges();
        var _loop_1 = function (i) {
            var topRange = topRanges[i];
            if (topRange.id) {
                this_1._allRanges.push(topRange); // it might be a placeholder root range
            }
            var reducer = function (acc, next) {
                acc.add(next);
                var nextRanges = next.getRanges();
                if (nextRanges.length) {
                    return nextRanges.reduce(reducer, acc);
                }
                return acc;
            };
            var subRanges = Array.from(topRange.getRanges().reduce(reducer, new Set()));
            this_1._allRanges = this_1._allRanges.concat(subRanges);
        };
        var this_1 = this;
        for (var i = 0; i < topRanges.length; i++) {
            _loop_1(i);
        }
        return this._allRanges;
    };
    Manifest.prototype.getRangeById = function (id) {
        var ranges = this.getAllRanges();
        for (var i = 0; i < ranges.length; i++) {
            var range = ranges[i];
            if (range.id === id) {
                return range;
            }
        }
        return null;
    };
    Manifest.prototype.getRangeByPath = function (path) {
        var ranges = this.getAllRanges();
        for (var i = 0; i < ranges.length; i++) {
            var range = ranges[i];
            if (range.path === path) {
                return range;
            }
        }
        return null;
    };
    /**
     * @returns Array of Sequence instances
     **/
    Manifest.prototype.getSequences = function () {
        if (this.items.length) {
            return this.items;
        }
        // IxIF mediaSequences overrode sequences, so need to be checked first.
        // deprecate this when presentation 3 ships
        var items = this.__jsonld.mediaSequences || this.__jsonld.sequences;
        if (items) {
            for (var i = 0; i < items.length; i++) {
                var s = items[i];
                var sequence = new Sequence(s, this.options);
                this.items.push(sequence);
            }
        }
        else if (this.__jsonld.items) {
            var sequence = new Sequence(this.__jsonld.items, this.options);
            this.items.push(sequence);
        }
        return this.items;
    };
    Manifest.prototype.getSequenceByIndex = function (sequenceIndex) {
        return this.getSequences()[sequenceIndex];
    };
    Manifest.prototype.getTotalSequences = function () {
        return this.getSequences().length;
    };
    Manifest.prototype.getManifestType = function () {
        var service = (this.getService(distCommonjsExports$1.ServiceProfile.UI_EXTENSIONS));
        if (service) {
            return service.getProperty("manifestType");
        }
        return ManifestType.EMPTY;
    };
    Manifest.prototype.isMultiSequence = function () {
        return this.getTotalSequences() > 1;
    };
    Manifest.prototype.isPagingEnabled = function () {
        var viewingHint = this.getViewingHint();
        if (viewingHint) {
            return viewingHint === distCommonjsExports$1.ViewingHint.PAGED;
        }
        var behavior = this.getBehavior();
        if (behavior) {
            return behavior === distCommonjsExports$1.Behavior.PAGED;
        }
        return false;
    };
    Manifest.prototype.getViewingDirection = function () {
        return this.getProperty("viewingDirection");
    };
    Manifest.prototype.getViewingHint = function () {
        return this.getProperty("viewingHint");
    };
    Object.defineProperty(Manifest.prototype, "annotationIdMap", {
        /**
         * Developer Note: The concept of the "id map" appear in the
         * JSON-LD specification https://www.w3.org/TR/json-ld11/#dfn-id-map
         * This functionality may be available as well in the 'nodeMap' code of the
         * digitalbazaar/jsonld library
         *
         * this very simplified version just returns a mao of id -> Annotation nodes
         * in manifest
         *
         * THe annotationIdMap is a Javascript object whose property names are
         * IRI (id values) and property values are instances of the Annotation class
         **/
        get: function () {
            if (this._annotationIdMap == null) {
                this._annotationIdMap = {};
                for (var _i = 0, _a = this.getSequences(); _i < _a.length; _i++) {
                    var seq = _a[_i];
                    for (var _b = 0, _c = seq.getScenes(); _b < _c.length; _b++) {
                        var scene = _c[_b];
                        for (var _d = 0, _e = scene.getContent(); _d < _e.length; _d++) {
                            var anno = _e[_d];
                            this._annotationIdMap[anno.id] = anno;
                        }
                    }
                }
            }
            return this._annotationIdMap;
        },
        enumerable: false,
        configurable: true
    });
    return Manifest;
}(IIIFResource));

var ManifestType;
(function (ManifestType) {
    ManifestType["EMPTY"] = "";
    ManifestType["MANUSCRIPT"] = "manuscript";
    ManifestType["MONOGRAPH"] = "monograph";
})(ManifestType || (ManifestType = {}));

var __extends$9 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var PointSelector = /** @class */ (function (_super) {
    __extends$9(PointSelector, _super);
    function PointSelector(jsonld) {
        var _this = _super.call(this, jsonld) || this;
        _this.isPointSelector = true;
        return _this;
    }
    /**
    @returns the 3D coordinates of the point as a Vector3 instance.
    **/
    PointSelector.prototype.getLocation = function () {
        return new Vector3(this.__jsonld.x, this.__jsonld.y, this.__jsonld.z);
    };
    Object.defineProperty(PointSelector.prototype, "Location", {
        /**
        @returns the 3D coordinates of the point as a Vector3 instance.
        **/
        get: function () {
            return this.getLocation();
        },
        enumerable: false,
        configurable: true
    });
    return PointSelector;
}(JSONLDResource));

var __extends$8 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Range = /** @class */ (function (_super) {
    __extends$8(Range, _super);
    function Range(jsonld, options) {
        var _this = _super.call(this, jsonld, options) || this;
        _this._ranges = null;
        _this.canvases = null;
        _this.items = [];
        return _this;
    }
    Range.prototype.getCanvasIds = function () {
        if (this.__jsonld.canvases) {
            return this.__jsonld.canvases;
        }
        else if (this.canvases) {
            return this.canvases;
        }
        return [];
    };
    Range.prototype.getDuration = function () {
        // For this implementation, we want to catch SOME of the temporal cases - i.e. when there is a t=1,100
        if (this.canvases && this.canvases.length) {
            var startTimes = [];
            var endTimes = [];
            // When we loop through all of the canvases we store the recorded start and end times.
            // Then we choose the maximum and minimum values from this. This will give us a more accurate duration for the
            // Chosen range. However this is still not perfect and does not cover more complex ranges. These cases are out of
            // scope for this change.
            for (var _i = 0, _a = this.canvases; _i < _a.length; _i++) {
                var canvas = _a[_i];
                if (!canvas)
                    continue;
                var _b = (canvas.match(/(.*)#t=([0-9.]+),?([0-9.]+)?/) || [undefined, canvas]), canvasId = _b[1], start_1 = _b[2], end_1 = _b[3];
                if (canvasId) {
                    startTimes.push(parseFloat(start_1));
                    endTimes.push(parseFloat(end_1));
                }
            }
            if (startTimes.length && endTimes.length) {
                return new Duration(Math.min.apply(Math, startTimes), Math.max.apply(Math, endTimes));
            }
        }
        else {
            // get child ranges and calculate the start and end based on them
            var childRanges = this.getRanges();
            var startTimes = [];
            var endTimes = [];
            // Once again, we use a max/min to get the ranges.
            for (var _c = 0, childRanges_1 = childRanges; _c < childRanges_1.length; _c++) {
                var childRange = childRanges_1[_c];
                var duration = childRange.getDuration();
                if (duration) {
                    startTimes.push(duration.start);
                    endTimes.push(duration.end);
                }
            }
            // And return the minimum as the start, and the maximum as the end.
            if (startTimes.length && endTimes.length) {
                return new Duration(Math.min.apply(Math, startTimes), Math.max.apply(Math, endTimes));
            }
        }
        var start;
        var end;
        // There are 2 paths for this implementation. Either we have a list of canvases, or a list of ranges
        // which may have a list of ranges.
        // This is one of the limitations of this implementation.
        if (this.canvases && this.canvases.length) {
            // When we loop through each of the canvases we are expecting to see a fragment or a link to the whole canvas.
            // For example - if we have http://example.org/canvas#t=1,100 it will extract 1 and 100 as the start and end.
            for (var i = 0; i < this.canvases.length; i++) {
                var canvas = this.canvases[i];
                var temporal = Utils.getTemporalComponent(canvas);
                if (temporal && temporal.length > 1) {
                    if (i === 0) {
                        // Note: Cannot guarantee ranges are sequential (fixed above)
                        start = Number(temporal[0]);
                    }
                    if (i === this.canvases.length - 1) {
                        end = Number(temporal[1]); // Note: The end of this duration may be targeting a different canvas.
                    }
                }
            }
        }
        else {
            // In this second case, where there are nested ranges, we recursively get the duration
            // from each of the child ranges (a start and end) and then choose the first and last for the bounds of this range.
            var childRanges = this.getRanges();
            for (var i = 0; i < childRanges.length; i++) {
                var childRange = childRanges[i];
                var duration = childRange.getDuration();
                if (duration) {
                    if (i === 0) {
                        start = duration.start;
                    }
                    if (i === childRanges.length - 1) {
                        end = duration.end;
                    }
                }
            }
        }
        if (start !== undefined && end !== undefined) {
            return new Duration(start, end);
        }
        return undefined;
    };
    // getCanvases(): ICanvas[] {
    //     if (this._canvases) {
    //         return this._canvases;
    //     }
    //     return this._canvases = <ICanvas[]>this.items.en().where(m => m.isCanvas()).toArray();
    // }
    Range.prototype.getRanges = function () {
        if (this._ranges) {
            return this._ranges;
        }
        return (this._ranges = this.items.filter(function (m) { return m.isRange(); }));
    };
    Range.prototype.getBehavior = function () {
        var behavior = this.getProperty("behavior");
        if (Array.isArray(behavior)) {
            behavior = behavior[0];
        }
        if (behavior) {
            return behavior;
        }
        return null;
    };
    Range.prototype.getViewingDirection = function () {
        return this.getProperty("viewingDirection");
    };
    Range.prototype.getViewingHint = function () {
        return this.getProperty("viewingHint");
    };
    Range.prototype.getTree = function (treeRoot) {
        treeRoot.data = this;
        this.treeNode = treeRoot;
        var ranges = this.getRanges();
        if (ranges && ranges.length) {
            for (var i = 0; i < ranges.length; i++) {
                var range = ranges[i];
                var node = new TreeNode();
                treeRoot.addNode(node);
                this._parseTreeNode(node, range);
            }
        }
        Utils.generateTreeNodeIds(treeRoot);
        return treeRoot;
    };
    Range.prototype.spansTime = function (time) {
        var duration = this.getDuration();
        if (duration) {
            if (time >= duration.start && time <= duration.end) {
                return true;
            }
        }
        return false;
    };
    Range.prototype._parseTreeNode = function (node, range) {
        node.label = range.getLabel().getValue(this.options.locale);
        node.data = range;
        node.data.type = Utils.normaliseType(TreeNodeType.RANGE);
        range.treeNode = node;
        var ranges = range.getRanges();
        if (ranges && ranges.length) {
            for (var i = 0; i < ranges.length; i++) {
                var childRange = ranges[i];
                var behavior = childRange.getBehavior();
                if (behavior === distCommonjsExports$1.Behavior.NO_NAV) {
                    continue;
                }
                else {
                    var childNode = new TreeNode();
                    node.addNode(childNode);
                    this._parseTreeNode(childNode, childRange);
                }
            }
        }
    };
    return Range;
}(ManifestResource));

var __extends$7 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Rendering = /** @class */ (function (_super) {
    __extends$7(Rendering, _super);
    function Rendering(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    Rendering.prototype.getFormat = function () {
        return this.getProperty("format");
    };
    return Rendering;
}(ManifestResource));

var __extends$6 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Scene = /** @class */ (function (_super) {
    __extends$6(Scene, _super);
    function Scene(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    // Presentation API 3.0
    Scene.prototype.getContent = function () {
        var content = [];
        var items = this.__jsonld.items || this.__jsonld.content;
        if (!items)
            return content;
        // should be contained in an AnnotationPage
        var annotationPage = null;
        if (items.length) {
            annotationPage = new AnnotationPage(items[0], this.options);
        }
        if (!annotationPage) {
            return content;
        }
        var annotations = annotationPage.getItems();
        for (var i = 0; i < annotations.length; i++) {
            var a = annotations[i];
            var annotation = new Annotation(a, this.options);
            content.push(annotation);
        }
        return content;
    };
    Object.defineProperty(Scene.prototype, "Content", {
        // 3D extension
        get: function () {
            return this.getContent();
        },
        enumerable: false,
        configurable: true
    });
    Scene.prototype.getAnnotationById = function (searchId) {
        for (var _i = 0, _a = this.Content; _i < _a.length; _i++) {
            var anno = _a[_i];
            if (anno.id === searchId)
                return anno;
        }
        return null;
    };
    Scene.prototype.getBackgroundColor = function () {
        // regular expression intended to match strings like
        // "#FF00FF" -- interpreted as three hexadecimal values
        // in range 0-255 . Not that the \w escape matches digits,
        // upper and lower case latin characters, and underscore
        // currently only supports the form for CSS
        // https://www.w3.org/wiki/CSS/Properties/color/RGB
        // with 6 hexadecimal digits
        var bgc = this.getProperty("backgroundColor");
        if (bgc)
            return Color.fromCSS(bgc);
        else
            return null;
    };
    // Annotations not rendered as part of the Canvas
    // Have non-painting motivations and are listed in Canvas annotations property, not items property
    Scene.prototype.getNonContentAnnotations = function () {
        var _this = this;
        var annotationPages = (this.__jsonld.annotations || [])
            .filter(function (annotationPage) {
            return annotationPage && annotationPage.type === "AnnotationPage";
        })
            .map(function (annotationPage) { return new AnnotationPage(annotationPage, _this.options); });
        if (!annotationPages.length)
            return [];
        var annotationsNested = annotationPages.map(function (page) {
            return page.getItems();
        });
        var annotationsFlat = flattenDeep(annotationsNested);
        return annotationsFlat.map(function (annotation) { return new Annotation(annotation, _this.options); });
    };
    return Scene;
}(ManifestResource));

var __extends$5 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Sequence = /** @class */ (function (_super) {
    __extends$5(Sequence, _super);
    function Sequence(jsonld, options) {
        var _this = _super.call(this, jsonld, options) || this;
        _this.items = [];
        _this._thumbnails = null;
        return _this;
    }
    Sequence.prototype.getCanvases = function () {
        if (this.items.length) {
            return this.items;
        }
        var items = this.__jsonld.canvases || this.__jsonld.elements;
        if (items) {
            for (var i = 0; i < items.length; i++) {
                var c = items[i];
                var canvas = new Canvas(c, this.options);
                canvas.index = i;
                this.items.push(canvas);
            }
        }
        else if (this.__jsonld) {
            for (var i = 0; i < this.__jsonld.length; i++) {
                var c = this.__jsonld[i];
                var canvas = new Canvas(c, this.options);
                canvas.index = i;
                this.items.push(canvas);
            }
        }
        return this.items;
    };
    Sequence.prototype.getCanvasById = function (id) {
        for (var i = 0; i < this.getTotalCanvases(); i++) {
            var canvas = this.getCanvasByIndex(i);
            // normalise canvas id
            var canvasId = Utils.normaliseUrl(canvas.id);
            if (Utils.normaliseUrl(id) === canvasId) {
                return canvas;
            }
        }
        return null;
    };
    Sequence.prototype.getCanvasByIndex = function (canvasIndex) {
        return this.getCanvases()[canvasIndex];
    };
    Sequence.prototype.getCanvasIndexById = function (id) {
        for (var i = 0; i < this.getTotalCanvases(); i++) {
            var canvas = this.getCanvasByIndex(i);
            if (canvas.id === id) {
                return i;
            }
        }
        return null;
    };
    Sequence.prototype.getCanvasIndexByLabel = function (label, foliated) {
        label = label.trim();
        if (!isNaN(label)) {
            // if the label is numeric
            label = parseInt(label, 10).toString(); // trim any preceding zeros.
            if (foliated)
                label += "r"; // default to recto
        }
        var doublePageRegExp = /(\d*)\D+(\d*)/;
        var match, regExp, regStr, labelPart1, labelPart2;
        for (var i = 0; i < this.getTotalCanvases(); i++) {
            var canvas = this.getCanvasByIndex(i);
            // check if there's a literal match
            if (canvas.getLabel().getValue(this.options.locale) === label) {
                return i;
            }
            // check if there's a match for double-page spreads e.g. 100-101, 100_101, 100 101
            match = doublePageRegExp.exec(label);
            if (!match)
                continue;
            labelPart1 = match[1];
            labelPart2 = match[2];
            if (!labelPart2)
                continue;
            regStr = "^" + labelPart1 + "\\D+" + labelPart2 + "$";
            regExp = new RegExp(regStr);
            if (regExp.test(canvas.getLabel().toString())) {
                return i;
            }
        }
        return -1;
    };
    Sequence.prototype.getLastCanvasLabel = function (alphanumeric) {
        for (var i = this.getTotalCanvases() - 1; i >= 0; i--) {
            var canvas = this.getCanvasByIndex(i);
            var label = (canvas.getLabel().getValue(this.options.locale));
            if (alphanumeric) {
                var regExp = /^[a-zA-Z0-9]*$/;
                if (regExp.test(label)) {
                    return label;
                }
            }
            else if (label) {
                return label;
            }
        }
        return this.options.defaultLabel;
    };
    Sequence.prototype.getLastPageIndex = function () {
        return this.getTotalCanvases() - 1;
    };
    Sequence.prototype.getNextPageIndex = function (canvasIndex, pagingEnabled) {
        var index;
        if (pagingEnabled) {
            var indices = this.getPagedIndices(canvasIndex);
            var viewingDirection = this.getViewingDirection();
            if (viewingDirection &&
                viewingDirection === distCommonjsExports$1.ViewingDirection.RIGHT_TO_LEFT) {
                index = indices[0] + 1;
            }
            else {
                index = indices[indices.length - 1] + 1;
            }
        }
        else {
            index = canvasIndex + 1;
        }
        if (index > this.getLastPageIndex()) {
            return -1;
        }
        return index;
    };
    Sequence.prototype.getPagedIndices = function (canvasIndex, pagingEnabled) {
        var indices = [];
        if (!pagingEnabled) {
            indices.push(canvasIndex);
        }
        else {
            if (this.isFirstCanvas(canvasIndex) || this.isLastCanvas(canvasIndex)) {
                indices = [canvasIndex];
            }
            else if (canvasIndex % 2) {
                indices = [canvasIndex, canvasIndex + 1];
            }
            else {
                indices = [canvasIndex - 1, canvasIndex];
            }
            var viewingDirection = this.getViewingDirection();
            if (viewingDirection &&
                viewingDirection === distCommonjsExports$1.ViewingDirection.RIGHT_TO_LEFT) {
                indices = indices.reverse();
            }
        }
        return indices;
    };
    Sequence.prototype.getPrevPageIndex = function (canvasIndex, pagingEnabled) {
        var index;
        if (pagingEnabled) {
            var indices = this.getPagedIndices(canvasIndex);
            var viewingDirection = this.getViewingDirection();
            if (viewingDirection &&
                viewingDirection === distCommonjsExports$1.ViewingDirection.RIGHT_TO_LEFT) {
                index = indices[indices.length - 1] - 1;
            }
            else {
                index = indices[0] - 1;
            }
        }
        else {
            index = canvasIndex - 1;
        }
        return index;
    };
    /**
     * @returns Array of Scene instances in the Sequence
     **/
    Sequence.prototype.getScenes = function () {
        var returnVal = [];
        var low_items = this.__jsonld.elements || this.__jsonld;
        if (low_items) {
            for (var i = 0; i < low_items.length; ++i) {
                var c = low_items[i];
                if (c.type === "Scene") {
                    var scene = new Scene(c, this.options);
                    //scene.index = i;
                    returnVal.push(scene);
                }
            }
        }
        return returnVal;
    };
    Sequence.prototype.getStartCanvasIndex = function () {
        var startCanvas = this.getStartCanvas();
        if (startCanvas) {
            // if there's a startCanvas attribute, loop through the canvases and return the matching index.
            for (var i = 0; i < this.getTotalCanvases(); i++) {
                var canvas = this.getCanvasByIndex(i);
                if (canvas.id === startCanvas)
                    return i;
            }
        }
        // default to first canvas.
        return 0;
    };
    // todo: deprecate
    Sequence.prototype.getThumbs = function (width, height) {
        //console.warn('getThumbs will be deprecated, use getThumbnails instead');
        var thumbs = [];
        var totalCanvases = this.getTotalCanvases();
        for (var i = 0; i < totalCanvases; i++) {
            var canvas = this.getCanvasByIndex(i);
            var thumb = new Thumb(width, canvas);
            thumbs.push(thumb);
        }
        return thumbs;
    };
    Sequence.prototype.getThumbnails = function () {
        if (this._thumbnails != null)
            return this._thumbnails;
        this._thumbnails = [];
        var canvases = this.getCanvases();
        for (var i = 0; i < canvases.length; i++) {
            var thumbnail = canvases[i].getThumbnail();
            if (thumbnail) {
                this._thumbnails.push(thumbnail);
            }
        }
        return this._thumbnails;
    };
    Sequence.prototype.getStartCanvas = function () {
        return this.getProperty("startCanvas");
    };
    Sequence.prototype.getTotalCanvases = function () {
        return this.getCanvases().length;
    };
    Sequence.prototype.getViewingDirection = function () {
        if (this.getProperty("viewingDirection")) {
            return this.getProperty("viewingDirection");
        }
        else if (this.options.resource.getViewingDirection) {
            return this.options.resource.getViewingDirection();
        }
        return null;
    };
    Sequence.prototype.getViewingHint = function () {
        return this.getProperty("viewingHint");
    };
    Sequence.prototype.isCanvasIndexOutOfRange = function (canvasIndex) {
        return canvasIndex > this.getTotalCanvases() - 1;
    };
    Sequence.prototype.isFirstCanvas = function (canvasIndex) {
        return canvasIndex === 0;
    };
    Sequence.prototype.isLastCanvas = function (canvasIndex) {
        return canvasIndex === this.getTotalCanvases() - 1;
    };
    Sequence.prototype.isMultiCanvas = function () {
        return this.getTotalCanvases() > 1;
    };
    Sequence.prototype.isPagingEnabled = function () {
        var viewingHint = this.getViewingHint();
        if (viewingHint) {
            return viewingHint === distCommonjsExports$1.ViewingHint.PAGED;
        }
        return false;
    };
    // checks if the number of canvases is even - therefore has a front and back cover
    Sequence.prototype.isTotalCanvasesEven = function () {
        return this.getTotalCanvases() % 2 === 0;
    };
    return Sequence;
}(ManifestResource));

var Deserialiser = /** @class */ (function () {
    function Deserialiser() {
    }
    Deserialiser.parse = function (manifest, options) {
        if (typeof manifest === "string") {
            manifest = JSON.parse(manifest);
        }
        return this.parseJson(manifest, options);
    };
    Deserialiser.parseJson = function (json, options) {
        var resource;
        // have options been passed for the manifest to inherit?
        if (options) {
            if (options.navDate && !isNaN(options.navDate.getTime())) {
                json.navDate = options.navDate.toString();
            }
        }
        if (json["@type"]) {
            switch (json["@type"]) {
                case "sc:Collection":
                    resource = this.parseCollection(json, options);
                    break;
                case "sc:Manifest":
                    resource = this.parseManifest(json, options);
                    break;
                default:
                    return null;
            }
        }
        else {
            // presentation 3
            switch (json["type"]) {
                case "Collection":
                    resource = this.parseCollection(json, options);
                    break;
                case "Manifest":
                    resource = this.parseManifest(json, options);
                    break;
                default:
                    return null;
            }
        }
        // Top-level resource was loaded from a URI, so flag it to prevent
        // unnecessary reload:
        resource.isLoaded = true;
        return resource;
    };
    Deserialiser.parseCollection = function (json, options) {
        var collection = new Collection(json, options);
        if (options) {
            collection.index = options.index || 0;
            if (options.resource) {
                collection.parentCollection = options.resource.parentCollection;
            }
        }
        else {
            collection.index = 0;
        }
        this.parseCollections(collection, options);
        this.parseManifests(collection, options);
        this.parseItems(collection, options);
        return collection;
    };
    Deserialiser.parseCollections = function (collection, options) {
        var items;
        if (collection.__jsonld.collections) {
            items = collection.__jsonld.collections;
        }
        else if (collection.__jsonld.items) {
            items = collection.__jsonld.items.filter(function (m) { return m.type.toLowerCase() === "collection"; });
        }
        if (items) {
            for (var i = 0; i < items.length; i++) {
                if (options) {
                    options.index = i;
                }
                var item = this.parseCollection(items[i], options);
                item.index = i;
                item.parentCollection = collection;
                collection.items.push(item);
            }
        }
    };
    Deserialiser.parseManifest = function (json, options) {
        var manifest = new Manifest(json, options);
        return manifest;
    };
    Deserialiser.parseManifests = function (collection, options) {
        var items;
        if (collection.__jsonld.manifests) {
            items = collection.__jsonld.manifests;
        }
        else if (collection.__jsonld.items) {
            items = collection.__jsonld.items.filter(function (m) { return m.type.toLowerCase() === "manifest"; });
        }
        if (items) {
            for (var i = 0; i < items.length; i++) {
                var item = this.parseManifest(items[i], options);
                item.index = i;
                item.parentCollection = collection;
                collection.items.push(item);
            }
        }
    };
    Deserialiser.parseItem = function (json, options) {
        if (json["@type"]) {
            if (json["@type"].toLowerCase() === "sc:manifest") {
                return this.parseManifest(json, options);
            }
            else if (json["@type"].toLowerCase() === "sc:collection") {
                return this.parseCollection(json, options);
            }
        }
        else if (json.type) {
            if (json.type.toLowerCase() === "manifest") {
                return this.parseManifest(json, options);
            }
            else if (json.type.toLowerCase() === "collection") {
                return this.parseCollection(json, options);
            }
        }
        return null;
    };
    Deserialiser.parseItems = function (collection, options) {
        var items = collection.__jsonld.members || collection.__jsonld.items;
        if (items) {
            var _loop_1 = function (i) {
                if (options) {
                    options.index = i;
                }
                var item = this_1.parseItem(items[i], options);
                if (!item)
                    return { value: void 0 };
                // only add to items if not already parsed from backwards-compatible collections/manifests arrays
                if (collection.items.filter(function (m) { return m.id === item.id; })[0]) {
                    return "continue";
                }
                item.index = i;
                item.parentCollection = collection;
                collection.items.push(item);
            };
            var this_1 = this;
            for (var i = 0; i < items.length; i++) {
                var state_1 = _loop_1(i);
                if (typeof state_1 === "object")
                    return state_1.value;
            }
        }
    };
    return Deserialiser;
}());

var __extends$4 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Service = /** @class */ (function (_super) {
    __extends$4(Service, _super);
    function Service(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    Service.prototype.getProfile = function () {
        var profile = this.getProperty("profile");
        if (!profile) {
            profile = this.getProperty("dcterms:conformsTo");
        }
        if (Array.isArray(profile)) {
            return profile[0];
        }
        return profile;
    };
    Service.prototype.getConfirmLabel = function () {
        return Utils.getLocalisedValue(this.getProperty("confirmLabel"), this.options.locale);
    };
    Service.prototype.getDescription = function () {
        return Utils.getLocalisedValue(this.getProperty("description"), this.options.locale);
    };
    Service.prototype.getFailureDescription = function () {
        return Utils.getLocalisedValue(this.getProperty("failureDescription"), this.options.locale);
    };
    Service.prototype.getFailureHeader = function () {
        return Utils.getLocalisedValue(this.getProperty("failureHeader"), this.options.locale);
    };
    Service.prototype.getHeader = function () {
        return Utils.getLocalisedValue(this.getProperty("header"), this.options.locale);
    };
    Service.prototype.getServiceLabel = function () {
        return Utils.getLocalisedValue(this.getProperty("label"), this.options.locale);
    };
    Service.prototype.getInfoUri = function () {
        var infoUri = this.id;
        if (!infoUri.endsWith("/")) {
            infoUri += "/";
        }
        infoUri += "info.json";
        return infoUri;
    };
    return Service;
}(ManifestResource));

var Size = /** @class */ (function () {
    function Size(width, height) {
        this.width = width;
        this.height = height;
    }
    return Size;
}());

var StatusCode;
(function (StatusCode) {
    StatusCode[StatusCode["AUTHORIZATION_FAILED"] = 1] = "AUTHORIZATION_FAILED";
    StatusCode[StatusCode["FORBIDDEN"] = 2] = "FORBIDDEN";
    StatusCode[StatusCode["INTERNAL_SERVER_ERROR"] = 3] = "INTERNAL_SERVER_ERROR";
    StatusCode[StatusCode["RESTRICTED"] = 4] = "RESTRICTED";
})(StatusCode || (StatusCode = {}));

// todo: deprecate
// this is used by Sequence.getThumbs
var Thumb = /** @class */ (function () {
    function Thumb(width, canvas) {
        this.data = canvas;
        this.index = canvas.index;
        this.width = width;
        var heightRatio = canvas.getHeight() / canvas.getWidth();
        if (heightRatio) {
            this.height = Math.floor(this.width * heightRatio);
        }
        else {
            this.height = width;
        }
        this.uri = canvas.getCanonicalImageUri(width);
        this.label = canvas.getLabel().getValue(); // todo: pass locale?
        this.viewingHint = canvas.getViewingHint();
    }
    return Thumb;
}());

var __extends$3 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Thumbnail = /** @class */ (function (_super) {
    __extends$3(Thumbnail, _super);
    function Thumbnail(jsonld, options) {
        return _super.call(this, jsonld, options) || this;
    }
    return Thumbnail;
}(Resource));

var __extends$2 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var TranslateTransform = /** @class */ (function (_super) {
    __extends$2(TranslateTransform, _super);
    function TranslateTransform(jsonld) {
        var _this = _super.call(this, jsonld) || this;
        _this.isTranslateTransform = true;
        return _this;
    }
    TranslateTransform.prototype.getTranslation = function () {
        var retVal = {};
        for (var _i = 0, _a = ["x", "y", "z"]; _i < _a.length; _i++) {
            var attrib = _a[_i];
            var raw = this.__jsonld[attrib];
            retVal[attrib] = raw !== undefined ? Number(raw) : 0.0;
        }
        return retVal;
    };
    return TranslateTransform;
}(Transform));

var TransformParser = /** @class */ (function () {
    function TransformParser() {
    }
    TransformParser.BuildFromJson = function (jsonld) {
        if (jsonld.type === "TranslateTransform")
            return new TranslateTransform(jsonld);
        else if (jsonld.type === "RotateTransform")
            return new RotateTransform(jsonld);
        else if (jsonld.type === "ScaleTransform")
            return new ScaleTransform(jsonld);
        else
            throw new Error("Unknown transform type " + jsonld.type);
    };
    return TransformParser;
}());

var TreeNode = /** @class */ (function () {
    function TreeNode(label, data) {
        this.label = label;
        this.data = data || {};
        this.nodes = [];
    }
    TreeNode.prototype.addNode = function (node) {
        this.nodes.push(node);
        node.parentNode = this;
    };
    TreeNode.prototype.isCollection = function () {
        return this.data.type === Utils.normaliseType(TreeNodeType.COLLECTION);
    };
    TreeNode.prototype.isManifest = function () {
        return this.data.type === Utils.normaliseType(TreeNodeType.MANIFEST);
    };
    TreeNode.prototype.isRange = function () {
        return this.data.type === Utils.normaliseType(TreeNodeType.RANGE);
    };
    return TreeNode;
}());

var TreeNodeType;
(function (TreeNodeType) {
    TreeNodeType["COLLECTION"] = "collection";
    TreeNodeType["MANIFEST"] = "manifest";
    TreeNodeType["RANGE"] = "range";
})(TreeNodeType || (TreeNodeType = {}));

var __extends$1 = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var RotateTransform = /** @class */ (function (_super) {
    __extends$1(RotateTransform, _super);
    function RotateTransform(jsonld) {
        var _this = _super.call(this, jsonld) || this;
        _this.isRotateTransform = true;
        return _this;
    }
    /**
     * Returns an object with x,y,z attributes whose values are
     * a counter-clockwise rotation in degrees about the fixed coordinate
     * system axes.
     *
     * @returns object
     **/
    RotateTransform.prototype.getRotation = function () {
        var retVal = {};
        for (var _i = 0, _a = ["x", "y", "z"]; _i < _a.length; _i++) {
            var attrib = _a[_i];
            var raw = this.__jsonld[attrib];
            retVal[attrib] = raw !== undefined ? Number(raw) : 0.0;
        }
        return retVal;
    };
    Object.defineProperty(RotateTransform.prototype, "Rotation", {
        /**
         * accessor Rotation is an object with x,y,z attributes whose values are
         * a counter-clockwise rotation in degrees about the fixed coordinate
         * system axes.
         **/
        get: function () {
            return this.getRotation();
        },
        enumerable: false,
        configurable: true
    });
    return RotateTransform;
}(Transform));

var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var ScaleTransform = /** @class */ (function (_super) {
    __extends(ScaleTransform, _super);
    function ScaleTransform(jsonld) {
        var _this = _super.call(this, jsonld) || this;
        _this.isScaleTransform = true;
        return _this;
    }
    ScaleTransform.prototype.getScale = function () {
        var retVal = {};
        for (var _i = 0, _a = ["x", "y", "z"]; _i < _a.length; _i++) {
            var attrib = _a[_i];
            var raw = this.__jsonld[attrib];
            // note that default scaling is 1.0
            retVal[attrib] = raw !== undefined ? Number(raw) : 1.0;
        }
        return retVal;
    };
    return ScaleTransform;
}(Transform));

var colorString$1 = {exports: {}};

var colorName;
var hasRequiredColorName;

function requireColorName () {
	if (hasRequiredColorName) return colorName;
	hasRequiredColorName = 1;

	colorName = {
		"aliceblue": [240, 248, 255],
		"antiquewhite": [250, 235, 215],
		"aqua": [0, 255, 255],
		"aquamarine": [127, 255, 212],
		"azure": [240, 255, 255],
		"beige": [245, 245, 220],
		"bisque": [255, 228, 196],
		"black": [0, 0, 0],
		"blanchedalmond": [255, 235, 205],
		"blue": [0, 0, 255],
		"blueviolet": [138, 43, 226],
		"brown": [165, 42, 42],
		"burlywood": [222, 184, 135],
		"cadetblue": [95, 158, 160],
		"chartreuse": [127, 255, 0],
		"chocolate": [210, 105, 30],
		"coral": [255, 127, 80],
		"cornflowerblue": [100, 149, 237],
		"cornsilk": [255, 248, 220],
		"crimson": [220, 20, 60],
		"cyan": [0, 255, 255],
		"darkblue": [0, 0, 139],
		"darkcyan": [0, 139, 139],
		"darkgoldenrod": [184, 134, 11],
		"darkgray": [169, 169, 169],
		"darkgreen": [0, 100, 0],
		"darkgrey": [169, 169, 169],
		"darkkhaki": [189, 183, 107],
		"darkmagenta": [139, 0, 139],
		"darkolivegreen": [85, 107, 47],
		"darkorange": [255, 140, 0],
		"darkorchid": [153, 50, 204],
		"darkred": [139, 0, 0],
		"darksalmon": [233, 150, 122],
		"darkseagreen": [143, 188, 143],
		"darkslateblue": [72, 61, 139],
		"darkslategray": [47, 79, 79],
		"darkslategrey": [47, 79, 79],
		"darkturquoise": [0, 206, 209],
		"darkviolet": [148, 0, 211],
		"deeppink": [255, 20, 147],
		"deepskyblue": [0, 191, 255],
		"dimgray": [105, 105, 105],
		"dimgrey": [105, 105, 105],
		"dodgerblue": [30, 144, 255],
		"firebrick": [178, 34, 34],
		"floralwhite": [255, 250, 240],
		"forestgreen": [34, 139, 34],
		"fuchsia": [255, 0, 255],
		"gainsboro": [220, 220, 220],
		"ghostwhite": [248, 248, 255],
		"gold": [255, 215, 0],
		"goldenrod": [218, 165, 32],
		"gray": [128, 128, 128],
		"green": [0, 128, 0],
		"greenyellow": [173, 255, 47],
		"grey": [128, 128, 128],
		"honeydew": [240, 255, 240],
		"hotpink": [255, 105, 180],
		"indianred": [205, 92, 92],
		"indigo": [75, 0, 130],
		"ivory": [255, 255, 240],
		"khaki": [240, 230, 140],
		"lavender": [230, 230, 250],
		"lavenderblush": [255, 240, 245],
		"lawngreen": [124, 252, 0],
		"lemonchiffon": [255, 250, 205],
		"lightblue": [173, 216, 230],
		"lightcoral": [240, 128, 128],
		"lightcyan": [224, 255, 255],
		"lightgoldenrodyellow": [250, 250, 210],
		"lightgray": [211, 211, 211],
		"lightgreen": [144, 238, 144],
		"lightgrey": [211, 211, 211],
		"lightpink": [255, 182, 193],
		"lightsalmon": [255, 160, 122],
		"lightseagreen": [32, 178, 170],
		"lightskyblue": [135, 206, 250],
		"lightslategray": [119, 136, 153],
		"lightslategrey": [119, 136, 153],
		"lightsteelblue": [176, 196, 222],
		"lightyellow": [255, 255, 224],
		"lime": [0, 255, 0],
		"limegreen": [50, 205, 50],
		"linen": [250, 240, 230],
		"magenta": [255, 0, 255],
		"maroon": [128, 0, 0],
		"mediumaquamarine": [102, 205, 170],
		"mediumblue": [0, 0, 205],
		"mediumorchid": [186, 85, 211],
		"mediumpurple": [147, 112, 219],
		"mediumseagreen": [60, 179, 113],
		"mediumslateblue": [123, 104, 238],
		"mediumspringgreen": [0, 250, 154],
		"mediumturquoise": [72, 209, 204],
		"mediumvioletred": [199, 21, 133],
		"midnightblue": [25, 25, 112],
		"mintcream": [245, 255, 250],
		"mistyrose": [255, 228, 225],
		"moccasin": [255, 228, 181],
		"navajowhite": [255, 222, 173],
		"navy": [0, 0, 128],
		"oldlace": [253, 245, 230],
		"olive": [128, 128, 0],
		"olivedrab": [107, 142, 35],
		"orange": [255, 165, 0],
		"orangered": [255, 69, 0],
		"orchid": [218, 112, 214],
		"palegoldenrod": [238, 232, 170],
		"palegreen": [152, 251, 152],
		"paleturquoise": [175, 238, 238],
		"palevioletred": [219, 112, 147],
		"papayawhip": [255, 239, 213],
		"peachpuff": [255, 218, 185],
		"peru": [205, 133, 63],
		"pink": [255, 192, 203],
		"plum": [221, 160, 221],
		"powderblue": [176, 224, 230],
		"purple": [128, 0, 128],
		"rebeccapurple": [102, 51, 153],
		"red": [255, 0, 0],
		"rosybrown": [188, 143, 143],
		"royalblue": [65, 105, 225],
		"saddlebrown": [139, 69, 19],
		"salmon": [250, 128, 114],
		"sandybrown": [244, 164, 96],
		"seagreen": [46, 139, 87],
		"seashell": [255, 245, 238],
		"sienna": [160, 82, 45],
		"silver": [192, 192, 192],
		"skyblue": [135, 206, 235],
		"slateblue": [106, 90, 205],
		"slategray": [112, 128, 144],
		"slategrey": [112, 128, 144],
		"snow": [255, 250, 250],
		"springgreen": [0, 255, 127],
		"steelblue": [70, 130, 180],
		"tan": [210, 180, 140],
		"teal": [0, 128, 128],
		"thistle": [216, 191, 216],
		"tomato": [255, 99, 71],
		"turquoise": [64, 224, 208],
		"violet": [238, 130, 238],
		"wheat": [245, 222, 179],
		"white": [255, 255, 255],
		"whitesmoke": [245, 245, 245],
		"yellow": [255, 255, 0],
		"yellowgreen": [154, 205, 50]
	};
	return colorName;
}

var simpleSwizzle = {exports: {}};

var isArrayish;
var hasRequiredIsArrayish;

function requireIsArrayish () {
	if (hasRequiredIsArrayish) return isArrayish;
	hasRequiredIsArrayish = 1;
	isArrayish = function isArrayish(obj) {
		if (!obj || typeof obj === 'string') {
			return false;
		}

		return obj instanceof Array || Array.isArray(obj) ||
			(obj.length >= 0 && (obj.splice instanceof Function ||
				(Object.getOwnPropertyDescriptor(obj, (obj.length - 1)) && obj.constructor.name !== 'String')));
	};
	return isArrayish;
}

var hasRequiredSimpleSwizzle;

function requireSimpleSwizzle () {
	if (hasRequiredSimpleSwizzle) return simpleSwizzle.exports;
	hasRequiredSimpleSwizzle = 1;

	var isArrayish = /*@__PURE__*/ requireIsArrayish();

	var concat = Array.prototype.concat;
	var slice = Array.prototype.slice;

	var swizzle = simpleSwizzle.exports = function swizzle(args) {
		var results = [];

		for (var i = 0, len = args.length; i < len; i++) {
			var arg = args[i];

			if (isArrayish(arg)) {
				// http://jsperf.com/javascript-array-concat-vs-push/98
				results = concat.call(results, slice.call(arg));
			} else {
				results.push(arg);
			}
		}

		return results;
	};

	swizzle.wrap = function (fn) {
		return function () {
			return fn(swizzle(arguments));
		};
	};
	return simpleSwizzle.exports;
}

/* MIT license */

var hasRequiredColorString;

function requireColorString () {
	if (hasRequiredColorString) return colorString$1.exports;
	hasRequiredColorString = 1;
	var colorNames = /*@__PURE__*/ requireColorName();
	var swizzle = /*@__PURE__*/ requireSimpleSwizzle();
	var hasOwnProperty = Object.hasOwnProperty;

	var reverseNames = Object.create(null);

	// create a list of reverse color names
	for (var name in colorNames) {
		if (hasOwnProperty.call(colorNames, name)) {
			reverseNames[colorNames[name]] = name;
		}
	}

	var cs = colorString$1.exports = {
		to: {},
		get: {}
	};

	cs.get = function (string) {
		var prefix = string.substring(0, 3).toLowerCase();
		var val;
		var model;
		switch (prefix) {
			case 'hsl':
				val = cs.get.hsl(string);
				model = 'hsl';
				break;
			case 'hwb':
				val = cs.get.hwb(string);
				model = 'hwb';
				break;
			default:
				val = cs.get.rgb(string);
				model = 'rgb';
				break;
		}

		if (!val) {
			return null;
		}

		return {model: model, value: val};
	};

	cs.get.rgb = function (string) {
		if (!string) {
			return null;
		}

		var abbr = /^#([a-f0-9]{3,4})$/i;
		var hex = /^#([a-f0-9]{6})([a-f0-9]{2})?$/i;
		var rgba = /^rgba?\(\s*([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
		var per = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
		var keyword = /^(\w+)$/;

		var rgb = [0, 0, 0, 1];
		var match;
		var i;
		var hexAlpha;

		if (match = string.match(hex)) {
			hexAlpha = match[2];
			match = match[1];

			for (i = 0; i < 3; i++) {
				// https://jsperf.com/slice-vs-substr-vs-substring-methods-long-string/19
				var i2 = i * 2;
				rgb[i] = parseInt(match.slice(i2, i2 + 2), 16);
			}

			if (hexAlpha) {
				rgb[3] = parseInt(hexAlpha, 16) / 255;
			}
		} else if (match = string.match(abbr)) {
			match = match[1];
			hexAlpha = match[3];

			for (i = 0; i < 3; i++) {
				rgb[i] = parseInt(match[i] + match[i], 16);
			}

			if (hexAlpha) {
				rgb[3] = parseInt(hexAlpha + hexAlpha, 16) / 255;
			}
		} else if (match = string.match(rgba)) {
			for (i = 0; i < 3; i++) {
				rgb[i] = parseInt(match[i + 1], 0);
			}

			if (match[4]) {
				if (match[5]) {
					rgb[3] = parseFloat(match[4]) * 0.01;
				} else {
					rgb[3] = parseFloat(match[4]);
				}
			}
		} else if (match = string.match(per)) {
			for (i = 0; i < 3; i++) {
				rgb[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
			}

			if (match[4]) {
				if (match[5]) {
					rgb[3] = parseFloat(match[4]) * 0.01;
				} else {
					rgb[3] = parseFloat(match[4]);
				}
			}
		} else if (match = string.match(keyword)) {
			if (match[1] === 'transparent') {
				return [0, 0, 0, 0];
			}

			if (!hasOwnProperty.call(colorNames, match[1])) {
				return null;
			}

			rgb = colorNames[match[1]];
			rgb[3] = 1;

			return rgb;
		} else {
			return null;
		}

		for (i = 0; i < 3; i++) {
			rgb[i] = clamp(rgb[i], 0, 255);
		}
		rgb[3] = clamp(rgb[3], 0, 1);

		return rgb;
	};

	cs.get.hsl = function (string) {
		if (!string) {
			return null;
		}

		var hsl = /^hsla?\(\s*([+-]?(?:\d{0,3}\.)?\d+)(?:deg)?\s*,?\s*([+-]?[\d\.]+)%\s*,?\s*([+-]?[\d\.]+)%\s*(?:[,|\/]\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
		var match = string.match(hsl);

		if (match) {
			var alpha = parseFloat(match[4]);
			var h = ((parseFloat(match[1]) % 360) + 360) % 360;
			var s = clamp(parseFloat(match[2]), 0, 100);
			var l = clamp(parseFloat(match[3]), 0, 100);
			var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);

			return [h, s, l, a];
		}

		return null;
	};

	cs.get.hwb = function (string) {
		if (!string) {
			return null;
		}

		var hwb = /^hwb\(\s*([+-]?\d{0,3}(?:\.\d+)?)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
		var match = string.match(hwb);

		if (match) {
			var alpha = parseFloat(match[4]);
			var h = ((parseFloat(match[1]) % 360) + 360) % 360;
			var w = clamp(parseFloat(match[2]), 0, 100);
			var b = clamp(parseFloat(match[3]), 0, 100);
			var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);
			return [h, w, b, a];
		}

		return null;
	};

	cs.to.hex = function () {
		var rgba = swizzle(arguments);

		return (
			'#' +
			hexDouble(rgba[0]) +
			hexDouble(rgba[1]) +
			hexDouble(rgba[2]) +
			(rgba[3] < 1
				? (hexDouble(Math.round(rgba[3] * 255)))
				: '')
		);
	};

	cs.to.rgb = function () {
		var rgba = swizzle(arguments);

		return rgba.length < 4 || rgba[3] === 1
			? 'rgb(' + Math.round(rgba[0]) + ', ' + Math.round(rgba[1]) + ', ' + Math.round(rgba[2]) + ')'
			: 'rgba(' + Math.round(rgba[0]) + ', ' + Math.round(rgba[1]) + ', ' + Math.round(rgba[2]) + ', ' + rgba[3] + ')';
	};

	cs.to.rgb.percent = function () {
		var rgba = swizzle(arguments);

		var r = Math.round(rgba[0] / 255 * 100);
		var g = Math.round(rgba[1] / 255 * 100);
		var b = Math.round(rgba[2] / 255 * 100);

		return rgba.length < 4 || rgba[3] === 1
			? 'rgb(' + r + '%, ' + g + '%, ' + b + '%)'
			: 'rgba(' + r + '%, ' + g + '%, ' + b + '%, ' + rgba[3] + ')';
	};

	cs.to.hsl = function () {
		var hsla = swizzle(arguments);
		return hsla.length < 4 || hsla[3] === 1
			? 'hsl(' + hsla[0] + ', ' + hsla[1] + '%, ' + hsla[2] + '%)'
			: 'hsla(' + hsla[0] + ', ' + hsla[1] + '%, ' + hsla[2] + '%, ' + hsla[3] + ')';
	};

	// hwb is a bit different than rgb(a) & hsl(a) since there is no alpha specific syntax
	// (hwb have alpha optional & 1 is default value)
	cs.to.hwb = function () {
		var hwba = swizzle(arguments);

		var a = '';
		if (hwba.length >= 4 && hwba[3] !== 1) {
			a = ', ' + hwba[3];
		}

		return 'hwb(' + hwba[0] + ', ' + hwba[1] + '%, ' + hwba[2] + '%' + a + ')';
	};

	cs.to.keyword = function (rgb) {
		return reverseNames[rgb.slice(0, 3)];
	};

	// helpers
	function clamp(num, min, max) {
		return Math.min(Math.max(min, num), max);
	}

	function hexDouble(num) {
		var str = Math.round(num).toString(16).toUpperCase();
		return (str.length < 2) ? '0' + str : str;
	}
	return colorString$1.exports;
}

//import { colorString } from "color-string"
var colorString = /*@__PURE__*/ requireColorString();
/**
 * class structure with red, green, blue values in 0-255 range
 * Uses the {@link  https://www.npmjs.com/package.color-string | color-string }
 * library for conversion from and to string representations of color.
 **/
var Color = /** @class */ (function () {
    /**
     * @param rgbValue - Array of three 0-255 integers for r,g,b value. Ex: [255.0,0] for red
     **/
    function Color(rgbValue) {
        this.value = rgbValue;
    }
    /**
     * @param cssTerm - hex representtion of color as used in CSS. Ex "#FF0000" as red
     * @returns Color instance.
     **/
    Color.fromCSS = function (cssTerm) {
        var rv = colorString.get(cssTerm);
        if (rv.model !== "rgb")
            throw new Error("unsupported color string: " + cssTerm);
        return new Color([rv.value[0], rv.value[1], rv.value[2]]);
    };
    Object.defineProperty(Color.prototype, "red", {
        /**
         * @return 0 to 255 value of red color component
         **/
        get: function () {
            return this.value[0];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Color.prototype, "green", {
        /**
         * @return 0 to 255 value of green color component
         **/
        get: function () {
            return this.value[1];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Color.prototype, "blue", {
        /**
         * @return 0 to 255 value of blue color component
         **/
        get: function () {
            return this.value[2];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Color.prototype, "CSS", {
        /**
         * @returns  hex string (as for CSS ) representation of r,g,b components
         **/
        get: function () {
            return colorString.to.hex(this.value);
        },
        enumerable: false,
        configurable: true
    });
    return Color;
}());

/**
* Implements the convention that the 3 component values for the RotateTranform
* cass (properties  x,y,z) are to be interpreted as Euler angles in the intrinsic XYZ
* order
* @param transform : A object with a Rotation member object, properties x,y,z

*
* @returns threejs-math.EulerAngle instance. From this  threejs-math functionsa
* allow conversion to other rotation representations.
**/
function eulerFromRotateTransform(transform) {
    var eulerOrder = "XYZ";
    var rdata = transform.Rotation;
    return new Euler(MathUtils$1.degToRad(rdata.x), MathUtils$1.degToRad(rdata.y), MathUtils$1.degToRad(rdata.z), eulerOrder);
}
/**
 * Given an array of Transform instances, returns a single Matrix4
 * instance that represents the cumulative effect of the transforms
 * in the order they appear in the array.
 *
 * @param transforms An array of Transform instances
 *
 * @returns A Matrix4 instance representing the cumulative effect of the transforms
 **/
function combineTransformsToMatrix(transforms) {
    var matrix = new Matrix4();
    for (var _i = 0, transforms_1 = transforms; _i < transforms_1.length; _i++) {
        var transform = transforms_1[_i];
        var tmat = new Matrix4();
        if (transform.isTranslateTransform) {
            var translation = transform.getTranslation();
            tmat.makeTranslation(translation.x, translation.y, translation.z);
        }
        else if (transform.isRotateTransform) {
            var euler = eulerFromRotateTransform(transform);
            tmat.makeRotationFromEuler(euler);
        }
        else if (transform.isScaleTransform) {
            var scale = transform.getScale();
            tmat.makeScale(scale.x, scale.y, scale.z);
        }
        matrix.premultiply(tmat);
    }
    return matrix;
}
function combineTransformsToTRS(transforms) {
    var translation = new Vector3();
    var rotation = new Euler();
    var scale = new Vector3(1, 1, 1);
    for (var _i = 0, transforms_2 = transforms; _i < transforms_2.length; _i++) {
        var transform = transforms_2[_i];
        if (transform.isTranslateTransform) {
            var translationTransform = transform.getTranslation();
            translation.add(new Vector3(translationTransform.x, translationTransform.y, translationTransform.z));
        }
        else if (transform.isRotateTransform) {
            var euler = eulerFromRotateTransform(transform);
            var q1 = new Quaternion().setFromEuler(rotation);
            var q2 = new Quaternion().setFromEuler(euler);
            q1.premultiply(q2);
            rotation.setFromQuaternion(q1, "XYZ");
            translation.applyEuler(euler);
        }
        else if (transform.isScaleTransform) {
            var scaleTransform = transform.getScale();
            var newScale = new Vector3(scaleTransform.x, scaleTransform.y, scaleTransform.z);
            scale.multiply(newScale);
            translation.multiply(newScale);
        }
    }
    return { translation: translation, rotation: rotation, scale: scale };
}

/**
Initiates downloading an IIIF manifest json file from URL. Returns a Promise<any>
to allow subsequent processing on a successful fetch.

@param url  string containing the URL to Fetch
@returns Promise<any> The object returned through the Promise is the javascript object obtained by deserializing the json text.
**/
var loadManifest = function (url) {
    return Utils.loadManifest(url);
};
/**
Parses  IIIF manifest file to return a manifesto Manifest instance

@param manifest Either a string containing text of a manifest file or an javascript object obtained by deserializing by the JSON.parse function a manifest file.
@param options? TODO Not yet documented
@returns  instance of Manifest class.
**/
var parseManifest = function (manifest, options) {
    return Utils.parseManifest(manifest, options);
};

//import manifest from "@iiif/3d-manifesto-dev/dist-esmodule/";

class IIIFManifest {
  constructor(manifest) {
    // Is manifest JSON or URL?
    if (isJsonString(manifest)) {
      this.manifestJson = manifest;
      this.manifestUrl = null;
      this.manifest = parseManifest(manifest);
    } else {
      this.manifestJson = null;
      this.manifestUrl = manifest;
    }
  }

  async loadManifest() {
    if (this.manifestUrl)
      this.manifestJson = await loadManifest(this.manifestUrl);

    if (this.manifestJson)
      this.manifest = await parseManifest(this.manifestJson);

    if (this.manifest)
      this.scenes = this.manifest?.getSequences()[0]?.getScenes() || [];
  }

  annotationsFromScene(scene) {
    return scene?.getContent() || [];
  }
}

function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

async function loadIIIFManifest(manifestUrlOrJson) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();
  let modelTarget;
  let filteredAnnos;
  iiifManifest.modelUrls = new Array();

  if (iiifManifest.scenes.length > 0) {
    for (const [i, scene] of iiifManifest.scenes.entries()) { //TODO: support multiple scenes const manifestScene = scene;
    //if (!scene) return;
      // Root scene
      const manifestScene = iiifManifest.scenes[i];

      // Add scene BG color
      iiifManifest.scenes[i].background = await manifestScene.getBackgroundColor();

      // Load individual model annotations
      const annos = iiifManifest.annotationsFromScene(manifestScene);

      filteredAnnos = annos.filter((anno) => {
        const body = anno.getBody()[0];
        return (
          anno.getMotivation()?.[0] === "painting" &&
          (body.isSpecificResource || body?.getType() === "model")
        );
      });

      filteredAnnos.forEach((modelAnnotation) => {
        let modelUrl;
        if (modelAnnotation.getBody()[0].isSpecificResource) {
          modelUrl = modelAnnotation.getBody()[0].getSource()?.id;
        } else {
          modelUrl = modelAnnotation.getBody()[0].id;
        }
        modelTarget = modelAnnotation.getTarget();
        if (modelUrl && modelTarget) {
          iiifManifest.modelUrls.push(modelUrl);
        }
      });
    }
  }
  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    annotations: filteredAnnos,
    modelUrls: iiifManifest.modelUrls,
    modelTarget: modelTarget
  };
}

async function getAnnotations(iiifManifest, objectsConfig) {
  let ind = objectsConfig.index || 0;
  const modelAnnotations = iiifManifest.annotations[ind];
  if (!modelAnnotations) return;

  const target = iiifManifest.annotations?.[ind];

  if (target == null) {
    // handle missing (out-of-range or undefined)
    throw new Error(`No annotation at index ${ind}`);
  }

  // make sure we have an array to map over
  const items = Array.isArray(target) ? target : [target];

  await Promise.all(
    items.map(async (modelAnnotation) => {       
        if (modelAnnotation.getBody()[0].isSpecificResource) {
          let transforms = new Array();

          try {
            const body = modelAnnotation.getBody?.();
            const first = Array.isArray(body) ? body[0] : null;
            transforms = first?.getTransform?.() || [];
          } catch (e) {
            // No transforms present so keep defaults
            //objectsConfig.models[ind].scale = {x: 1, y: 1, z: 1};
            //objectsConfig.models[ind].rotation = {x: 0, y: 0, z: 0};
            //objectsConfig.models[ind].position = {x: 0, y: 0, z: 0};
            //console.log("No transform present in specific resource body");
          }
          // Correct use of async-safe loop
          for (const transform of transforms) {
            if (!transform.isTransform) continue;

            const transformHandlers = [
              {
                key: "isScaleTransform",
                action: () => {
                  const scale = transform.getScale();
                  if (scale) {
                    objectsConfig.models[ind].scale = scale;
                  }
                  else {
                    objectsConfig.models[ind].scale = {x: 1, y: 1, z: 1};
                    console.log("No scale defined in scale transform");
                  }
                },
              },
              {
                key: "isRotateTransform",
                action: () => {
                  const rotation = transform.getRotation();
                  if (rotation) {
                    objectsConfig.models[ind].rotation = rotation;
                  }
                  else { 
                    objectsConfig.models[ind].rotation = {x: 0, y: 0, z: 0};
                    console.log("No rotation defined in rotate transform");
                  }
                },
              },
              {
                key: "isTranslateTransform",
                action: () => {
                  const translation = transform.getTranslation();
                  if (translation) {
                    objectsConfig.models[ind].position = translation;
                  }
                  else { 
                    objectsConfig.models[ind].position = {x: 0, y: 0, z: 0};
                  }
                },
              },
            ];

            for (const { key, action } of transformHandlers) {
              if (transform[key]) {
                action();
              }
            }
          }
        }

        // Position model within target scene if position selector present
        if (iiifManifest.modelTarget.isSpecificResource == true) {
          const selector = iiifManifest.modelTarget.getSelector();
          if (selector && selector.isPointSelector) {
            const position = selector.getLocation();
            if (position) {
              objectsConfig.models[ind].position.x += position.x;
              objectsConfig.models[ind].position.y += position.y;
              objectsConfig.models[ind].position.z += position.z;
            }
          }
        }
        }));
  
  return iiifManifest.annotations;
}

/*
DFG 3D-Viewer
Copyright (C) 2025 - Daniel Dworak

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details at 
https://www.gnu.org/licenses/.
*/

//Supported file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, glTF

const SOURCE = "" ;
const isE2E = window.__E2E__ === true ;

window.viewer = {
  ready: false,
  modelLoaded: false,
  webglReady: false,
  camera: null,
  scene: null,
  renderer: null,
  controls: null
};

const Viewer = {
  CONFIG: null,
  PRESENTATION_MODE: false,
  SANDBOX_MODE: false,
  camera: null,
  scene: null,
  activeScene: 0,
  renderer: null,
  stats: null,
  controls: null,
  loader: null,
  ambientLight: null,
  dirLight: null,
  dirLightTarget: null,
  cameraLight: null,
  cameraLightTarget: null,
  dirLights: [],
  imported: null,
  mainObject: [],
  metadataContentTech: null,
  mainCanvas: null,
  distanceGeometry: new THREE.Vector3(),
  metadataUrl: null,
  iiifConfigURL: {url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json", name: "Inbuilt"},
  testModelURL: 'https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb',
  clock: null,
  FULLSCREEN: false,
  mixer: null,
  cameraTween: null,
  targetTween: null,
  container: null,
  viewerWrapper: null,
  scrollTop: null,
  rect: null,
  fileObject: { originalPath: '', filename: '', basename: '', extension: '', path: '', uri: '', newExtension: '', relativePath: '', autopath: '' },
  bottomLineGUI: null,
  loadedFile: null,    
  fileElement: null,
  COPYRIGHTS: false,
  EXIT_CODE: 1,
  gridSize: null,
  noMTL: false,
  canvasText: null,
  viewEntity: null,
  actionMenu: null,
  actionMenuToggle: null,
  actionMenuPanel: null,
  mainMenuButton: null,
  fullscreenMode: null,
  themeMode: null,
  languageMode: null,
  editorToolbar: null,
  editorToolbarButtons: {},
  downloadModel: null,
  embedConfiguratorPanel: null,
  embedConfigInputs: null,
  embedConfigPreviewFrame: null,
  embedMissingSourceNotified: false,
  currentTheme: "dark",
  currentLanguage: "en",
  loadingLogMessageKeys: [
    "loadingLog.loadingAssets",
    "loadingLog.loadingModel",
    "loadingLog.loadingTextures",
    "loadingLog.preparingGeometry",
    "loadingLog.settingUpLighting",
    "loadingLog.settingUpMaterials",
    "loadingLog.compilingShaders",
    "loadingLog.fetchingMetadata",
    "loadingLog.modelLoaded",
  ],
  processingLoadingStepKeys: [
    "processingSteps.preparingModel",
    "processingSteps.convertingToTransmissionFormat",
    "processingSteps.renderingThumbnails",
    "processingSteps.savingEntity",
    "processingSteps.finalizing3dModel",
    "processingSteps.initializingViewer",
  ],
  THEME_STORAGE_KEY: "iiif-dark-mode",
  LANGUAGE_STORAGE_KEY: "viewer-language",
  I18N: VIEWER_I18N,
  SUPPORTED_EXTENSIONS: ['obj', 'dae', 'fbx', 'ply', 'ifc', 'stl', 'xyz', 'json', '3ds', 'pcd', 'gltf', 'glb', 'zip', 'rar', 'tar', 'xz', 'gz'],
  GESTURE: {handPx: 55, period: 5.5, rotate: false, active: false, target: new THREE.Vector3(), startTime: 0, baseAngle: 0, orbitAngle: THREE.MathUtils.degToRad(15), easeInTime: 2.25},
  lastTime: null,
  originalMetadata: [],
  spinnerContainer: null,
  spinnerElement: null,
  loadingLog: null,
  guiContainer: null,
  noticeContainer: null,
  statusNotice: null,
  statusNoticeTimer: null,
  statusNoticeHideTimer: null,
  statusNoticeQueue: [],
  statusNoticeActive: false,
  statusNoticeCurrent: null,
  pickingHint: null,
  clippingHint: null,
  metadataContainer: null,
  spinner: null,
  circle: null,
  lilGui: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  onUpPosition: new THREE.Vector2(),
  onDownPosition: new THREE.Vector2(),
  bottomOffsetFullscreen: 0,
  geometry: new THREE.BoxGeometry(20, 20, 20),
  transformControl: null,
  transformControlLight: null,
  transformControlLightTarget: null,
  transformControlClippingPlaneX: null,
  transformControlClippingPlaneY: null,
  transformControlClippingPlaneZ: null,
  cameraCoords: null,
  helperObjects: [],
  lightObjects: [],
  lightHelper: null,
  lightHelperTarget: null,
  selectedObject: false,
  selectedObjects:[],
  selectedFaces: [],
  annotationEntries: [],
  annotationDialog: null,
  annotationDialogHost: null,
  annotationDialogTitleInput: null,
  annotationDialogDescriptionInput: null,
  annotationTargetFaceKeys: [],
  annotationBatchGroupId: "",
  annotationPOIGroup: null,
  annotationPOIMarkers: [],
  annotationPOITooltip: null,
  annotationPOITooltipTitle: null,
  annotationPOITooltipTarget: null,
  annotationImportInput: null,
  pendingAnnotationsXml: "",
  pickingTexture: null,
  windowHalfX: null,
  windowHalfY: null,
  transformType: "",
  transformText: {
    "Transform 3D Object": "",
    "Transform Light": "",
    "Transform Mode": "local",
  },
  materialsPropertiesText: {
    "Edit material": "select by material",
  },
  pickingStats: {
    "Selected faces": 0,
  },
  colors: {
    DirectionalLight: "0xFFFFFF",
    AmbientLight: "0x404040",
    CameraLight: "0xFFFFFF",
    BackgroundColor: "#FFFFFF",
    BackgroundColorOuter: "#999999",
  },
  materialProperties: {
    color: "0xFFFFFF",
    emissiveColor: "0x404040",
    emissive: 1,
    metalness: 0,
  },
  intensity: {
    startIntensityDir: 1,
    startIntensityAmbient: 1,
    startIntensityCamera: 1,
  },
  saveProperties: {
    Position: true,
    Rotation: true,
    Scale: true,
    Camera: true,
    DirectionalLight: true,
    AmbientLight: true,
    CameraLight: true,
    BackgroundColor: true,
    BackgroundColorOuter: true,
  },
  backgroundType: { "Background Type": "gradient" },
  backgroundOuterFolder: null,
  pickingMode: false,
  EDITOR: false,
  RULER_MODE: false,
  linePoints: [],
  gui: null,
  hierarchyFolder: null,
  GUILength: 35,
  zoomImage: 1,
  ZOOM_SPEED_IMAGE: 0.1,
  loadedFile: "",
  archiveType: "",
  planeParams: {
    planeX: {
      constantX: 0,
      negated: false,
      displayHelperX: false,
    },
    planeY: {
      constantY: 0,
      negated: false,
      displayHelperY: false,
    },
    planeZ: {
      constantZ: 0,
      negated: false,
      displayHelperZ: false,
    },
    outline: {
      visible: false,
    },
    clippingMode: {
      x: false,
      y: false,
      z: false,
    },
  },
  clippingPlanes: null,    
  planeHelpers: [],
  clippingFolder: null,
  propertiesFolder: null,
  planeObjects: [],
  editorFolder: null,
  metadataFolder: null,
  materialsFolder: null,
  pickingModeController: null,
  distanceMeasurementController: null,
  clearSelectedFacesController: null,
  selectedFacesCountController: null,
  addAnnotationController: null,
  textMesh: null,
  textMeshDistance: null,
  ruler: [],
  rulerObject: null,
  lastPickedFace: { id: "", object: "", faceIndex: null, overlay: null },
  loadedTimes: 0,
  _ext: '',
  DFG_ASSETS: '',
  isLightweight: false,
  urlOptions: {
    model: null,
    id: null,
    theme: null,
    language: null,
    autoRotate: null,
    autoRotateSpeed: null,
    disableInteraction: false,
    hideUi: false,
    hideMetadata: false,
    cameraPosition: null,
    cameraTarget: null,
    cameraFov: null,
    presentationMode: false,
    sandboxMode: false,
  },
  keyboardStep: {
    rotate: THREE.MathUtils.degToRad(2.25),
    rotateFast: THREE.MathUtils.degToRad(6),
    panFactor: 0.04,
    zoomFactor: 1.08,
  },
  keyboardTweenDurationMs: 150,
  lastKeyboardHintAt: 0,
  keyboardHintCooldownMs: 45000,
  keyboardHintAfterFocusDelayMs: 1800,
  lastWindowFocusAt: 0,
  cleanupCallbacks: [],
  resizeObserver: null,
  i18nGui: {},
  showNotifications: true,

  getE2EModelOverride() {
    if (!window.__E2E__) return null;
    const model = new URLSearchParams(window.location.search).get('e2eModel');
    return model || null;
  },

  ensureE2EState() {
    if (!window.__E2E__) return null;

    if (!window.viewer || window.viewer.e2eMode !== true) {
      window.viewer = {
        e2eMode: true,
        modelLoaded: false,
        errors: [],
        toasts: [],

        get camera() {
          return core.camera;
        },

        get scene() {
          return core.scene;
        },
      };
    } else {
      window.viewer.errors ??= [];
      window.viewer.toasts ??= [];
    }

    return window.viewer;
  },

  recordE2EError(error) {
    if (!window.__E2E__) return;
    const state = this.ensureE2EState();
    const message = error instanceof Error ? error.message : String(error);
    state.errors.push(message);
  },

  addCleanup(callback) {
    if (typeof callback === "function") {
      this.cleanupCallbacks.push(callback);
    }
  },

  bindEventListener(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, options);
    this.addCleanup(() => target.removeEventListener(type, handler, options));
  },

  closeActionMenu() {
    if (this.actionMenuToggle) {
      this.actionMenuToggle.checked = false;
    }
    if (this.languageModeDropdown) {
      this.languageModeDropdown.hidden = true;
    }
    this.updateEditorToolbarState();
  },

  stopHandMode() {
    const g = core.GESTURE;
    if (g) {
      g.rotate = false;
      g.active = false;
      g.baseAngle = null;
      g.target = null;
    }

    if (core.handHint) {
      core.handHint.hidden = true;
      core.handHint.classList.remove("hand-drag-animate");
    }

    if (core.controls) {
      core.controls.enabled = true;
      core.controls.update?.();
    }
  },

  getEditorToolbarIcon(icon) {
    const icons = {
      orbit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 2.75 21 3.5l-.75 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.25" fill="currentColor"/></svg>',
      move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5A7.5 7.5 0 1 1 5 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 3.5v3H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      scale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h8v8H8zM5 5h4M5 5v4M19 19h-4M19 19v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      lightMove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 13h5l-1 8 7-10h-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      lightTarget: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      picking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 3 8 8-4 1 2 5-2.5 1-2-5-3 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      annotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 8-8 8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 12 6.5 10.5M11 9l-1.5-1.5M14 12l-1.5-1.5M17 15l-1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      resetCamera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h4l2-2h4l2 2h4v10H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.25" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
      preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8 14 2.5-3 2.5 2 2-3 3 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 4v5h8M9 18h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      mainMenu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 2.2 3-.2.8 2.9 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.6-1.4 1-2.8-1-2.8 2.6-1.4.8-2.9 3 .2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
      advancedEditor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M4 17h16M14 7h6M4 12h6M12 12h8M8 5v4M16 10v4M10 15v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      fullScreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5M20 20h-5M20 20v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return icons[icon] || icons.advancedEditor;
  },

  createEditorToolbar() {
    if (!core.EDITOR || this.urlOptions.hideUi || this.editorToolbar || !core.container) return;

    const toolbar = document.createElement("div");
    toolbar.id = "viewerEditorToolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", t$1("toolbar.editor", "Editor tools"));
    toolbar.style.translate = "-25% 95%";

    const tools = [
      { key: "orbit", icon: "orbit", onClick: () => this.setObjectTransformMode("") },
      { key: "move", icon: "move", onClick: () => this.toggleObjectTransformMode("translate"), pressed: true },
      { key: "rotate", icon: "rotate", onClick: () => this.toggleObjectTransformMode("rotate"), pressed: true },
      { key: "scale", icon: "scale", onClick: () => this.toggleObjectTransformMode("scale"), pressed: true },
      { key: "lightMove", icon: "lightMove", onClick: () => this.toggleLightTransformMode("translate"), pressed: true },
      { key: "lightTarget", icon: "lightTarget", onClick: () => this.toggleLightTransformMode("rotate"), pressed: true },
      { key: "picking", icon: "picking", onClick: () => this.togglePickingMode(), pressed: true },
      { key: "annotate", icon: "annotate", onClick: () => this.openAnnotationDialogWithAutoPicking() },
      { key: "ruler", icon: "ruler", onClick: () => this.toggleDistanceMeasurement(), pressed: true },
      { key: "resetCamera", icon: "resetCamera", onClick: () => this.resetCamera() },
      { key: "advancedEditor", icon: "advancedEditor", onClick: () => this.toggleEditorAdvancedPanel(), pressed: true },
      { key: "fullScreen", icon: "fullScreen", onClick: () => this.toggleFullscreen(), pressed: true },
    ];

    if (!core.isLightweight) {
      tools.splice(tools.length - 1, 0,
        { key: "preview", icon: "preview", onClick: () => this.takeScreenshot() },
        { key: "save", icon: "save", onClick: () => this.saveEditorMetadata() }
      );
    }

    this.editorToolbarButtons = {};

    tools.forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "viewer-editor-tool";
      button.dataset.tool = tool.key;
      button.dataset.pressed = tool.pressed ? "true" : "false";
      button.innerHTML = `
        <span class="viewer-editor-tool_icon" aria-hidden="true">${this.getEditorToolbarIcon(tool.icon)}</span>
        <span class="viewer-editor-tool_sr"></span>
      `;
      this.bindEventListener(button, "click", () => {
        this.stopHandMode();
        tool.onClick();
      });
      toolbar.appendChild(button);
      this.editorToolbarButtons[tool.key] = button;
    });

    if (this.actionMenu) {
      this.actionMenu.classList.add("viewer-action-menu_in-toolbar");
      toolbar.appendChild(this.actionMenu);
    }

    core.container.appendChild(toolbar);
    this.editorToolbar = toolbar;
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  updateEditorToolbarLabels() {
    if (!this.editorToolbarButtons) return;

    const labels = {
      orbit: t$1("toolbar.orbit", "Navigation mode"),
      move: t$1("gui.move", "Move"),
      rotate: t$1("gui.rotate", "Rotate"),
      scale: t$1("gui.scale", "Scale"),
      lightMove: t$1("toolbar.lightMove", "Move light"),
      lightTarget: t$1("toolbar.lightTarget", "Light target"),
      picking: this.pickingMode
        ? t$1("controls.disablePickingMode", "Disable picking mode")
        : t$1("controls.enablePickingMode", "Enable picking mode"),
      annotate: t$1("gui.addAnnotations", "Add annotations"),
      ruler: this.RULER_MODE
        ? t$1("controls.disableDistanceMeasurement", "Disable distance measurement")
        : t$1("controls.enableDistanceMeasurement", "Enable distance measurement"),
      resetCamera: t$1("gui.resetCameraPosition", "Reset camera position"),
      preview: t$1("gui.renderPreview", "Render preview"),
      save: t$1("gui.save", "Save"),
      advancedEditor: this.isEditorAdvancedPanelVisible()
        ? t$1("toolbar.hideAdvancedEditor", "Hide advanced editor")
        : t$1("toolbar.showAdvancedEditor", "Show advanced editor"),
      fullScreen: this.fullscreenMode
        ? t$1("fullscreen.enter", "Enter fullscreen")
        : t$1("fullscreen.exit", "Exit fullscreen"),
    };

    Object.entries(this.editorToolbarButtons).forEach(([key, button]) => {
      const label = labels[key] || key;
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
      const sr = button.querySelector(".viewer-editor-tool_sr");
      if (sr) sr.textContent = label;
    });

    this.editorToolbar?.setAttribute("aria-label", t$1("toolbar.editor", "Editor tools"));
  },

  isEditorAdvancedPanelVisible() {
    if (!this.editorFolder?.domElement) return false;
    return this.editorFolder.domElement.style.display !== "none";
  },

  setEditorAdvancedPanelVisible(visible) {
    if (!this.editorFolder) return;
    if (visible) this.editorFolder.show?.();
    else this.editorFolder.hide?.();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  toggleEditorAdvancedPanel() {
    this.setEditorAdvancedPanelVisible(!this.isEditorAdvancedPanelVisible());
  },

  toggleMainMenu() {
    if (!this.actionMenuToggle) return;
    this.actionMenuToggle.checked = !this.actionMenuToggle.checked;
    if (!this.actionMenuToggle.checked && this.languageModeDropdown) {
      this.languageModeDropdown.hidden = true;
    }
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  setObjectTransformMode(mode = "") {
    const normalizedMode = ["translate", "rotate", "scale"].includes(mode) ? mode : "";
    if (normalizedMode && !core.helperObjects?.[0]) return;

    if (core.i18nGui.transformObjectController?.setValue) {
      core.i18nGui.transformObjectController.setValue(normalizedMode);
    } else {
      this.transformText["Transform 3D Object"] = normalizedMode;
    }
    this.updateEditorToolbarState();
  },

  toggleObjectTransformMode(mode = "") {
    const nextMode = this.transformText["Transform 3D Object"] === mode ? "" : mode;
    this.setObjectTransformMode(nextMode);
  },

  setLightTransformMode(mode = "") {
    const normalizedMode = ["translate", "rotate"].includes(mode) ? mode : "";

    if (core.i18nGui.transformLightController?.setValue) {
      core.i18nGui.transformLightController.setValue(normalizedMode);
    } else {
      this.transformText["Transform Light"] = normalizedMode;
    }
    this.updateEditorToolbarState();
  },

  toggleLightTransformMode(mode = "") {
    const nextMode = this.transformText["Transform Light"] === mode ? "" : mode;
    this.setLightTransformMode(nextMode);
  },

  togglePickingMode() {
    this.pickingMode = !this.pickingMode;
    toastHelper$1(this.pickingMode ? "facePickingEnabled" : "facePickingDisabled", {
      duration: 1400
    });
    if (!this.pickingMode) {
      this.restoreLastPickedFace();
      this.clearSelectedFaces();
    } else {
      this.RULER_MODE = false;
      this.updateDistanceMeasurementControllerLabel();
    }
    this.updatePickingModeControllerLabel();
    this.updatePickingControlsVisibility();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  toggleDistanceMeasurement() {
    this.RULER_MODE = !this.RULER_MODE;
    if (this.RULER_MODE) {
      toastHelper$1("distanceEnabled", {
        duration: 2600
      });
      toastHelper$1("distanceHint", {
        duration: 5200
      });
    } else {
      toastHelper$1(this.RULER_MODE ? "distanceModeEnabled" : "distanceModeDisabled");
    }
    if (!this.RULER_MODE) {
      this.ruler.forEach((r) => {
        core.scene.remove(r);
      });
      this.rulerObject = new THREE.Object3D();
      this.ruler = [];
      this.linePoints = [];
    } else {
      this.pickingMode = false;
      this.restoreLastPickedFace();
      this.clearSelectedFaces();
      this.updatePickingModeControllerLabel();
      this.updatePickingControlsVisibility();
    }
    this.updateDistanceMeasurementControllerLabel();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  async saveEditorMetadata() {
    if (!core.EDITOR || core.isLightweight || !core.helperObjects?.[0]) return;

    const rotateMetadata = new THREE.Vector3(
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.x),
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.y),
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.z)
    );

    if (core.CONFIG.entity.proxyPath !== undefined) {
      core.CONFIG.metadataUrl = core.getProxyPath(core.CONFIG.metadataUrl);
    }

    let fetchedMetadata = {};

    try {
      if (core.CONFIG?.metadataUrl) {
        const response = await fetch(core.CONFIG.metadataUrl, { cache: "no-cache" });
        if (response.ok) {
          fetchedMetadata = await response.json();
        }
      }
    } catch (err) {
      console.warn("Metadata fetch failed, continuing with save", err);
    }

    this.originalMetadata = {
      ...this.originalMetadata,
      ...fetchedMetadata
    };

    const newMetadata = this.buildMetadata(this, rotateMetadata);

    try {
      const token = await fetch("/session/token").then((r) => r.text());

      await fetch(core.CONFIG.mainUrl + "/api/editor/save-metadata", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token
        },
        body: JSON.stringify({
          filename: core.fileObject.filename,
          path:
            this.archiveType !== ""
              ? core.fileObject.relativePath + core.fileObject.basename + core.loadedFile
              : core.fileObject.relativePath,
          content: JSON.stringify(newMetadata, null, "\t")
        })
      });

      toastHelper$1("settingsSaved", "success");
    } catch (err) {
      console.error(err);
      toastHelper$1("settingsSaveError", "error");
    }
  },

  updateEditorToolbarState() {
    if (!this.editorToolbarButtons) return;

    const activeMap = {
      orbit: this.transformText["Transform 3D Object"] === "",
      move: this.transformText["Transform 3D Object"] === "translate",
      rotate: this.transformText["Transform 3D Object"] === "rotate",
      scale: this.transformText["Transform 3D Object"] === "scale",
      lightMove: this.transformText["Transform Light"] === "translate",
      lightTarget: this.transformText["Transform Light"] === "rotate",
      picking: this.pickingMode === true,
      ruler: this.RULER_MODE === true,
      advancedEditor: this.isEditorAdvancedPanelVisible(),
      fullScreen: this.fullscreenMode === true,
    };

    Object.entries(this.editorToolbarButtons).forEach(([key, button]) => {
      const isActive = activeMap[key] === true;
      button.classList.toggle("is-active", isActive);
      if (button.dataset.pressed === "true") {
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      } else {
        button.removeAttribute("aria-pressed");
      }
    });
  },

  isEmbedModeActive() {
    return this.embedConfiguratorPanel?.hidden === false;
  },

  updateEmbedMenuEntryState() {
    if (!this.viewEntity) return;
    const isActive = this.isEmbedModeActive();
    const label = isActive ? t$1("menu.exitEmbed", "Exit embed") : t$1("menu.embed", "Embed");
    const iconClass = isActive ? "embed-exit-icon" : "embed-icon";
    this.viewEntity.innerHTML = `<span class="${iconClass}"></span><span>${label}</span>`;
    const a11yLabel = isActive
      ? t$1("menu.exitEmbedMode", "Exit embed mode")
      : t$1("menu.openEmbedOptions", "Open embed options");
    this.viewEntity.setAttribute("aria-label", a11yLabel);
    this.viewEntity.setAttribute("title", a11yLabel);
  },

  closeEmbedConfigurator() {
    if (this.embedConfiguratorPanel) {
      this.embedConfiguratorPanel.hidden = true;
    }
    this.updateEmbedMenuEntryState();
  },

  closeEmbedMode() {
    this.closeEmbedConfigurator();
  },

  getStoredTheme() {
    if (this.urlOptions?.theme === "light" || this.urlOptions?.theme === "dark") {
      return this.urlOptions.theme;
    }

    const storedTheme = window.localStorage.getItem(this.THEME_STORAGE_KEY);
    return storedTheme === "0" ? "light" : "dark";
  },

  normalizeLanguage(value) {
    if (value == null) return null;
    const normalizedValue = String(value).trim().toLowerCase();
    if (normalizedValue.startsWith("pl")) return "pl";
    if (normalizedValue.startsWith("de")) return "de";
    if (normalizedValue.startsWith("en")) return "en";
    return null;
  },

  getStoredLanguage() {
    const fromQuery = this.normalizeLanguage(this.urlOptions?.language);
    if (fromQuery) return fromQuery;

    const storedLanguage = this.normalizeLanguage(window.localStorage.getItem(this.LANGUAGE_STORAGE_KEY));
    if (storedLanguage) return storedLanguage;

    const browserLanguage = this.normalizeLanguage(navigator?.language || "en");
    return browserLanguage || "en";
  },

  tFormat(key, params = {}, fallback = "") {
    const template = t$1(key, fallback);
    return String(template).replace(/\{(\w+)\}/g, (_match, token) => {
      const replacement = params?.[token];
      return replacement == null ? "" : String(replacement);
    });
  },

  parseBooleanParam(value) {
    if (value == null) return null;
    const normalizedValue = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalizedValue)) return true;
    if (["0", "false", "no", "off"].includes(normalizedValue)) return false;
    return null;
  },

  parseFloatParam(value) {
    if (value == null || value === "") return null;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  },

  parseVector2Param(value) {
    if  (value == null || value === "") return null;
    const cleaned = String(value).replace(/[\[\]()]/g, " ").trim();
    const parts = cleaned.split(/[\s,;|]+/).filter(Boolean);
    if (parts.length !== 2) return null;
    const x = Number.parseFloat(parts[0]);
    const y = Number.parseFloat(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return new THREE.Vector2(x, y);
  },

  parseVector3Param(value) {
    if (value == null || value === "") return null;
    const cleaned = String(value).replace(/[\[\]()]/g, " ").trim();
    const parts = cleaned.split(/[\s,;|]+/).filter(Boolean);
    if (parts.length !== 3) return null;
    const x = Number.parseFloat(parts[0]);
    const y = Number.parseFloat(parts[1]);
    const z = Number.parseFloat(parts[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return new THREE.Vector3(x, y, z);
  },

  formatVector3Param(vector) {
    if (!vector || typeof vector !== "object") return null;
    const x = Number(vector.x);
    const y = Number(vector.y);
    const z = Number(vector.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
  },

  parseUrlOptions() {
    const params = new URLSearchParams(window.location.search);
    const modelFromQuery = params.get("model") || params.get("src");
    const themeFromQuery = (params.get("theme") || "").trim().toLowerCase();
    const languageFromQuery = this.normalizeLanguage(params.get("lang") || params.get("language"));
    const autoRotateFromQuery = this.parseBooleanParam(params.get("autorotate"));
    const disableInteractionFromQuery = this.parseBooleanParam(params.get("disableInteraction"));
    const hideUiFromQuery = this.parseBooleanParam(params.get("hideUi"));
    const hideMetadataFromQuery = this.parseBooleanParam(params.get("hideMetadata"));
    const presentationModeFromQuery = this.parseBooleanParam(params.get("presentationMode"));
    const sandboxModeFromQuery = this.parseBooleanParam(params.get("sandbox"));
    if (presentationModeFromQuery !== null) {
      core.PRESENTATION_MODE = presentationModeFromQuery;
    }
    if (sandboxModeFromQuery !== null) {
      core.SANDBOX_MODE = sandboxModeFromQuery;
    }
    const showNotificationsFromQuery = this.parseBooleanParam(params.get("showNotifications"));

    this.urlOptions = {
      model: modelFromQuery || null,
      id: params.get("id") || null,
      theme: themeFromQuery === "light" || themeFromQuery === "dark" ? themeFromQuery : null,
      language: languageFromQuery,
      autoRotate: autoRotateFromQuery,
      autoRotateSpeed: this.parseFloatParam(params.get("autorotateSpeed")),
      disableInteraction: disableInteractionFromQuery === true,
      hideUi: hideUiFromQuery === true,
      hideMetadata: hideMetadataFromQuery === true,
      cameraPosition: this.parseVector3Param(params.get("camPos") || params.get("cameraPos")),
      cameraTarget: this.parseVector3Param(params.get("camTarget") || params.get("cameraTarget")),
      cameraFov: this.parseFloatParam(params.get("fov")),
      presentationMode: core.PRESENTATION_MODE === true,
      sandboxMode: core.SANDBOX_MODE === true,
      scale: this.parseVector2Param(params.get("scale")) || new THREE.Vector2(1, 1),
      showNotifications: showNotificationsFromQuery !== false
    };
  },

  updateThemeControlLabels() {
    const isDark = this.currentTheme === "dark";

    if (this.themeMode) {
      this.themeMode.innerHTML = `
        <span class="viewer-theme-icon" aria-hidden="true">${isDark ? "☀️" : "🌙"}</span>
        <span>${isDark ? t$1("theme.lightMode", "Light mode") : t$1("theme.darkMode", "Dark mode")}</span>
      `;
      const label = isDark
        ? t$1("theme.switchToLightMode", "Switch to light mode")
        : t$1("theme.switchToDarkMode", "Switch to dark mode");
      this.themeMode.setAttribute("aria-label", label);
      this.themeMode.setAttribute("title", label);
    }

    const exampleThemeToggle = document.getElementById("example-theme-toggle");
    if (exampleThemeToggle) {
      exampleThemeToggle.textContent = isDark ? "☀️" : "🌙";
      exampleThemeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
      exampleThemeToggle.hidden = true;
    }
  },

  applyTheme(theme, { persist = true } = {}) {
    const normalizedTheme = theme === "light" ? "light" : "dark";
    const isDark = normalizedTheme === "dark";

    this.currentTheme = normalizedTheme;
    document.documentElement.setAttribute("data-viewer-theme", normalizedTheme);
    document.body.setAttribute("data-viewer-theme", normalizedTheme);
    document.body.classList.toggle("iiif-dark", isDark);
    this.viewerWrapper?.setAttribute("data-viewer-theme", normalizedTheme);
    this.actionMenu?.setAttribute("data-viewer-theme", normalizedTheme);
    this.metadataContainer?.setAttribute("data-viewer-theme", normalizedTheme);
    core.guiContainer?.setAttribute("data-viewer-theme", normalizedTheme);
    document.getElementById("form-IIIF")?.setAttribute("data-viewer-theme", normalizedTheme);
    UltraLoader$1.panel?.setAttribute("data-viewer-theme", normalizedTheme);

    if (persist) {
      window.localStorage.setItem(this.THEME_STORAGE_KEY, isDark ? "1" : "0");
    }

    this.updateThemeControlLabels();
  },

  toggleTheme() {
    this.closeActionMenu();
    this.applyTheme(this.currentTheme === "dark" ? "light" : "dark");
  },

  updateLanguageControlLabels() {
    if (!this.languageMode) return;
    const languages = [
      { code: "en", label: "Language: EN"},
      { code: "pl", label: "Język: PL"},
      { code: "de", label: "Sprache: DE"}
    ];
    const currentLangLabel = languages.find(l => l.code === core.currentLanguage)?.label || "EN";
    this.languageMode.innerHTML = `
      <span class="viewer-action-icon language-icon" aria-hidden="true"></span>
      <span>${currentLangLabel}</span>
    `;
    this.languageMode.setAttribute("aria-label", t$1("language.label", "Language: EN"));
    this.languageMode.setAttribute("title", t$1("language.label", "Language: EN"));
    
    if (this.languageModeDropdown) {
      const items = this.languageModeDropdown.querySelectorAll(".language-dropdown-item");
      items.forEach(item => {
        item.classList.toggle("active", item.dataset.lang === core.currentLanguage);
      });
    }
  },

  updateActionMenuLabels() {
    if (!this.actionMenu) return;
    const actionMenuLabel = t$1("menu.mainMenu", "Main menu");

    const toggle = this.actionMenu.querySelector(".viewer-action-menu_toggle");
    toggle?.setAttribute("title", actionMenuLabel);
    const toggleCopy = toggle?.querySelector(".viewer-editor-tool_sr");
    if (toggleCopy) toggleCopy.textContent = actionMenuLabel;
    this.actionMenu.querySelector(".viewer-action-menu_panel")?.setAttribute("aria-label", actionMenuLabel);
  },

  updateDownloadMenuEntryLabel() {
    if (!this.downloadModel || this.downloadModel.hidden) return;
    this.downloadModel.innerHTML = `
      <span class="viewer-action-icon download-icon" aria-hidden="true"></span>
      <span>${t$1("menu.download", "Download")}</span>
    `;
  },

  updateLocalizedUI() {
    const lang = ["pl", "de"].includes(core.currentLanguage) ? core.currentLanguage : "en";
    document.documentElement.setAttribute("lang", lang);
    this.updateActionMenuLabels();
    this.updateLanguageControlLabels();
    this.updateThemeControlLabels();
    this.updateEmbedMenuEntryState();
    this.updateFullscreenButtonIcon();
    this.updateDownloadMenuEntryLabel();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
    this.updatePickingModeControllerLabel();
    this.updateDistanceMeasurementControllerLabel();
    this.updateSelectedFacesControllerLabel();
    this.updateLilGuiLabels();
    this.updateLocalPreviewLabels();
    this.updateIIIFFormLabels();
    this.updateMetadataPanelLabels();
    this.refreshStatusNoticeLanguage();
    UltraLoader$1.updateHeader?.();
    if (this.pickingHint) this.pickingHint.textContent = t$1("hints.picking", "Shift + click to select multiple faces");
    if (this.clippingHint) this.clippingHint.textContent = t$1("hints.clipping", "Drag active clipping plane helper to adjust cut");

  },

  setGuiFolderTitle(folder, title) {
    if (!folder || !title) return;
    if (typeof folder.title === "function") {
      folder.title(title);
      return;
    }
    if (folder.$title) {
      folder.$title.textContent = title;
    }
    folder._title = title;
  },

  refreshOptionController(controller, optionsMap) {
    if (!controller || typeof controller.options !== "function") return;
    const currentValue = typeof controller.getValue === "function" ? controller.getValue() : undefined;
    controller.options(optionsMap);
    if (currentValue !== undefined && typeof controller.setValue === "function") {
      controller.setValue(currentValue);
    }
    if (typeof controller.updateDisplay === "function") {
      controller.updateDisplay();
    }
  },

  updateLilGuiLabels() {
    const g = core.i18nGui;
    if (!g) return;
    this.setGuiFolderTitle(core.gui, t$1("gui.controls", "Controls"));
    this.setGuiFolderTitle(g.editorFolder, t$1("gui.editor", "Editor"));
    this.setGuiFolderTitle(g.lightFolder, t$1("gui.directionalLight", "Directional Light"));
    this.setGuiFolderTitle(g.lightFolderAmbient, t$1("gui.ambientLight", "Ambient Light"));
    this.setGuiFolderTitle(g.lightFolderCamera, t$1("gui.cameraLight", "Camera Light"));
    this.setGuiFolderTitle(g.backgroundFolder, t$1("gui.backgroundColor", "Background Color"));
    this.setGuiFolderTitle(g.clippingFolder, t$1("gui.clippingFolder", "Clipping Planes"));
    this.setGuiFolderTitle(g.materialsFolder, t$1("gui.materials", "Materials"));
    this.setGuiFolderTitle(g.metadataFolder, t$1("gui.metadata", "Metadata"));
    this.setGuiFolderTitle(g.propertiesFolder, t$1("gui.saveProperties", "Save properties"));
    this.setGuiFolderTitle(g.hierarchyFolder, t$1("gui.hierarchy", "Hierarchy"));
    this.setGuiFolderTitle(g.statisticsFolder, t$1("gui.statistics", "Statistics"));

    // Update clipping controllers
    if (g.clippingFolder) {
      g.clippingFolder.controllers.forEach(controller => {
        switch (controller.property) {
          case 'displayHelperX':
            controller.name(t$1('gui.displayHelperX', 'Show X helper'));
            break;
          case 'displayHelperY':
            controller.name(t$1('gui.displayHelperY', 'Show Y helper'));
            break;
          case 'displayHelperZ':
            controller.name(t$1('gui.displayHelperZ', 'Show Z helper'));
            break;
          case 'constantX':
            controller.name(t$1('gui.constantX', 'Constant X'));
            break;
          case 'constantY':
            controller.name(t$1('gui.constantY', 'Constant Y'));
            break;
          case 'constantZ':
            controller.name(t$1('gui.constantZ', 'Constant Z'));
            break;
          case 'visible':
            controller.name(t$1('gui.visible', 'Visible'));
            break;
        }
      });
    }

    g.clearSelectedFacesController?.name?.(t$1("gui.clearSelectedFaces", "Clear selected faces"));
    g.transformObjectController?.name?.(t$1("gui.transform3dObject", "Transform 3D Object"));
    g.transformLightController?.name?.(t$1("gui.transformLight", "Transform Light"));
    g.transformModeController?.name?.(t$1("gui.transformMode", "Transform Mode"));
    g.backgroundTypeController?.name?.(t$1("gui.backgroundType", "Background Type"));
    g.backgroundColorController?.name?.(t$1("gui.backgroundColor", "Background Color"));
    g.backgroundColorOuterController?.name?.(t$1("gui.backgroundColorOuter", "Background Color Outer"));
    g.addAnnotationController?.name?.(t$1("gui.addAnnotations", "Add annotations"));
    g.exportAnnotationsController?.name?.(t$1("gui.exportAnnotationsXml", "Export annotations XML"));
    g.importAnnotationsController?.name?.(t$1("gui.importAnnotationsXml", "Import annotations XML"));
    g.resetCameraController?.name?.(t$1("gui.resetCameraPosition", "Reset camera position"));
    g.saveController?.name?.(t$1("gui.save", "Save"));
    g.renderPreviewController?.name?.(t$1("gui.renderPreview", "Render preview"));
    g.performanceController?.name?.(t$1("gui.performance", "Performance"));
    g.savePropPositionController?.name?.(t$1("gui.position", "Position"));
    g.savePropRotationController?.name?.(t$1("gui.rotation", "Rotation"));
    g.savePropScaleController?.name?.(t$1("gui.scale", "Scale"));
    g.savePropCameraController?.name?.(t$1("gui.camera", "Camera"));
    g.savePropDirectionalController?.name?.(t$1("gui.directionalLight", "Directional Light"));
    g.savePropAmbientController?.name?.(t$1("gui.ambientLight", "Ambient Light"));
    g.savePropCameraLightController?.name?.(t$1("gui.cameraLight", "Camera Light"));
    g.savePropBackgroundController?.name?.(t$1("gui.backgroundColor", "Background Color"));
    g.directionalLightColorController?.name?.(t$1("gui.color", "Color"));
    g.directionalLightIntensityController?.name?.(t$1("gui.intensity", "Intensity"));
    g.ambientLightColorController?.name?.(t$1("gui.color", "Color"));
    g.ambientLightIntensityController?.name?.(t$1("gui.intensity", "Intensity"));
    g.cameraLightColorController?.name?.(t$1("gui.color", "Color"));
    g.cameraLightIntensityController?.name?.(t$1("gui.intensity", "Intensity"));
    g.editMaterialsController?.name?.(t$1("gui.editMaterial", "Edit material"));

    this.refreshOptionController(g.transformObjectController, {
      [t$1("gui.none", "None")]: "",
      [t$1("gui.move", "Move")]: "translate",
      [t$1("gui.rotate", "Rotate")]: "rotate",
      [t$1("gui.scale", "Scale")]: "scale",
    });
    this.refreshOptionController(g.transformModeController, {
      [t$1("gui.local", "Local")]: "local",
      [t$1("gui.global", "Global")]: "global",
    });
    this.refreshOptionController(g.transformLightController, {
      [t$1("gui.none", "None")]: "",
      [t$1("gui.move", "Move")]: "translate",
      [t$1("gui.target", "Target")]: "rotate",
    });
    this.refreshOptionController(g.backgroundTypeController, {
      [t$1("gui.linear", "Linear")]: "linear",
      [t$1("gui.gradient", "Gradient")]: "gradient",
    });
    this.refreshOptionController(g.performanceController, {
      [t$1("gui.highPerformance", "High-performance")]: "high-performance",
      [t$1("gui.lowPower", "Low-power")]: "low-power",
      [t$1("gui.default", "Default")]: "default",
    });
    this.refreshOptionController(g.editMaterialsController, {
      [t$1("gui.selectByMaterial", "select by material")]: "select by material",
    });
  },

  updateLocalPreviewLabels() {
    const label = document.querySelector("#example-model-picker label[for='example-model-select']");
    if (label) {
      label.textContent = t$1("localPreview.loadExampleModel", "Load example model");
    }
  },

  updateIIIFFormLabels() {
    const form = document.getElementById("form-IIIF");
    if (!form) return;
    const title = form.querySelector(".form-IIIF-header .title");
    if (title) title.textContent = t$1("iiif.loader", "IIIF Loader");
    const collapseBtn = document.getElementById("iiif-toggle-collapse");
    if (collapseBtn) {
      const isCollapsed = form.classList.contains("collapsed");
      collapseBtn.title = isCollapsed
        ? t$1("iiif.expand", "Expand")
        : t$1("iiif.collapse", "Collapse");
    }
    const label = form.querySelector(".form-IIIF-label");
    if (label) label.textContent = t$1("iiif.manifest", "IIIF manifest");
    const select = document.getElementById("iiif-manifest-select");
    if (select) {
      const optionLabelByUrl = {
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json": t$1("iiif.optionModelPositionScale", "Model Position and Scale"),
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin.json": t$1("iiif.optionModelOrigin", "Model Origin"),
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin_bgcolor.json": t$1("iiif.optionModelOriginBg", "Model Origin with background color"),
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_position.json": t$1("iiif.optionModelPosition", "Model Position"),
      };
      Array.from(select.options).forEach((option) => {
        const labelFromMap = optionLabelByUrl[option.value];
        if (labelFromMap) option.textContent = labelFromMap;
      });
    }
    const manifestUrl = document.getElementById("manifest-url");
    if (manifestUrl) manifestUrl.placeholder = t$1("iiif.manifestUrlPlaceholder", "https://example.org/iiif/manifest.json");
    const manifestText = document.getElementById("manifest-text");
    if (manifestText) manifestText.placeholder = t$1("iiif.manifestTextPlaceholder", "Paste IIIF manifest JSON here...");
    const loadFromUrlButton = document.getElementById("load-manifest-from-url");
    if (loadFromUrlButton) loadFromUrlButton.textContent = t$1("iiif.loadFromUrl", "Load from URL");
    const loadFromTextButton = document.getElementById("load-manifest-from-text");
    if (loadFromTextButton) loadFromTextButton.textContent = t$1("iiif.loadFromText", "Load from Text");
  },

  updateMetadataPanelLabels() {
    const metadataContainer = document.getElementById("metadata-container");
    if (!metadataContainer) return;
    metadataContainer.querySelectorAll("[data-i18n-key]").forEach((node) => {
      const key = node.getAttribute("data-i18n-key");
      if (!key) return;
      const needsColon = node.classList.contains("metadata-label");
      const text = t$1(key, node.textContent?.replace(/:\s*$/, "") || "");
      node.textContent = needsColon ? `${text}:` : text;
    });
  },

  applyLanguage({ persist = true } = {}) {
    if (persist) {
      window.localStorage.setItem(this.LANGUAGE_STORAGE_KEY, core.currentLanguage);
    }
    this.updateLocalizedUI();
  },

  toggleLanguage() {
    if (!this.languageModeDropdown) return;
    const isVisible = !this.languageModeDropdown.hidden;
    this.languageModeDropdown.hidden = isVisible;
  },

  selectLanguage(lang) {
    core.currentLanguage = lang;
    this.languageModeDropdown.hidden = true;
    this.closeActionMenu();
    this.applyLanguage();
  },

  updatePickingModeControllerLabel() {
    if (!this.pickingModeController?.name) return;
    this.pickingModeController.name(
      this.pickingMode
        ? t$1("controls.disablePickingMode", "Disable picking mode")
        : t$1("controls.enablePickingMode", "Enable picking mode")
    );
  },

  updateDistanceMeasurementControllerLabel() {
    if (!this.distanceMeasurementController?.name) return;
    this.distanceMeasurementController.name(
      this.RULER_MODE
        ? t$1("controls.disableDistanceMeasurement", "Disable distance measurement")
        : t$1("controls.enableDistanceMeasurement", "Enable distance measurement")
    );
  },

  getDistanceMeasurementScaleMeters() {
    const configuredScale = Number(core.CONFIG?.viewer?.measurement?.modelUnitInMeters);
    if (Number.isFinite(configuredScale) && configuredScale > 0) return configuredScale;
    return 1;
  },

  formatMeasuredDistance(rawDistanceInModelUnits) {
    const scaleMeters = this.getDistanceMeasurementScaleMeters();
    const meters = rawDistanceInModelUnits * scaleMeters;

    if (!Number.isFinite(meters)) {
      return { text: "0 mm", meters: 0, scaleMeters };
    }

    if (meters >= 1) {
      return { text: `${meters.toFixed(2)} m`, meters, scaleMeters };
    }

    if (meters >= 0.01) {
      return { text: `${(meters * 100).toFixed(1)} cm`, meters, scaleMeters };
    }

    return { text: `${(meters * 1000).toFixed(0)} mm`, meters, scaleMeters };
  },

  updateSelectedFacesControllerLabel() {
    if (!this.selectedFacesCountController?.name) return;
    this.selectedFacesCountController.name(t$1("controls.selectedFaces", "Selected faces"));
  },

  updatePickingHintVisibility() {
    if (!this.pickingHint) return;
    const hasSelectedFaces = Array.isArray(this.selectedFaces) && this.selectedFaces.length > 0;
    this.pickingHint.hidden = !this.pickingMode || hasSelectedFaces;
    this.updateClippingHintVisibility();
  },

  updateClippingHintVisibility() {
    if (!this.clippingHint) return;
    const clippingMode = this.planeParams?.clippingMode || {};
    const hasActiveClipping = Boolean(clippingMode.x || clippingMode.y || clippingMode.z);
    const pickingHintVisible = Boolean(this.pickingHint && this.pickingHint.hidden === false);
    this.clippingHint.hidden = !hasActiveClipping || pickingHintVisible;
  },

  updatePickingControlsVisibility() {
    const method = this.pickingMode ? "show" : "hide";
    this.clearSelectedFacesController?.[method]?.();
    this.selectedFacesCountController?.[method]?.();
    this.updateAddAnnotationControllerState();
    this.updatePickingHintVisibility();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  updateAddAnnotationControllerState() {
    if (!this.addAnnotationController) return;
    this.addAnnotationController.enable?.();
  },

  getKeyboardShortcutsText() {
    return [
      t$1("shortcuts.mouse"),
      t$1("shortcuts.keyboard"),
      t$1("shortcuts.touch"),
      core.CONFIG?.viewer?.enableDragAndDrop === true ? t$1("shortcuts.dragAndDrop") : null
    ].join("\n");
  },

  getSupportedFormatsText() {
    return this.SUPPORTED_EXTENSIONS.map((extension) => extension.toUpperCase()).join(", ");
  },

  updateDragAndDropHint() {
    if (!this.dragAndDropHint) return;
    if (core.CONFIG?.viewer?.enableDragAndDrop === true) {
      this.dragAndDropHint.textContent = t$1("shortcuts.dragAndDrop", "You can also drag and drop a model file here to load it");
      this.dragAndDropHint.hidden = false;
    } else {
      this.dragAndDropHint.hidden = true;
    }

  },

  getLoadingLogMessages() {
    return this.loadingLogMessageKeys.map((key) => t$1(key));
  },

  getProcessingLoadingSteps() {
    return this.processingLoadingStepKeys.map((key) => t$1(key));
  },

  createModelLoadingProgress(shell) {
    shell.className = "model-loader";
    shell.hidden = true;
    shell.setAttribute("role", "status");
    shell.setAttribute("aria-live", "polite");

    const ring = document.createElement("div");
    ring.className = "model-loader__ring";
    ring.setAttribute("aria-hidden", "true");

    const percent = document.createElement("div");
    percent.className = "model-loader__percent";
    percent.textContent = "0%";
    ring.appendChild(percent);

    const content = document.createElement("div");
    content.className = "model-loader__content";


    const phase = document.createElement("div");
    phase.className = "model-loader__phase";
    phase.textContent = this.getLoadingLogMessages()[0] ?? t$1("loadingLog.loadingAssets", "Loading assets");

    const phaseViewport = document.createElement("div");
    phaseViewport.className = "model-loader__phase-viewport";

    const phaseList = document.createElement("div");
    phaseList.className = "model-loader__phase-list";

    phaseViewport.appendChild(phaseList);

    const messages = this.getLoadingLogMessages();
    const stageKeyToIndex = new Map(
      this.loadingLogMessageKeys.map((key, index) => [key, index])
    );
    const loadingModelKeyIndex = Math.max(
      0,
      stageKeyToIndex.get("loadingLog.loadingModel") ?? 0
    );
    let hideTimer = null;

    messages.forEach((msg) => {
      const item = document.createElement("div");
      item.className = "model-loader__phase-item";
      item.textContent = msg;
      phaseList.appendChild(item);
    });

    const clearHideTimer = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const updatePhase = (index) => {
      const itemHeight = phaseList.firstElementChild?.offsetHeight || 24;
      phaseList.style.transform = `translateY(-${index * itemHeight}px)`;
      phase.textContent = messages[index] || messages[loadingModelKeyIndex] || phase.textContent;
      Array.from(phaseList.children).forEach((item, itemIndex) => {
        item.toggleAttribute("data-active", itemIndex === index);
        item.toggleAttribute("data-near", itemIndex === index - 1 || itemIndex === index + 1);
      });
    };

    const track = document.createElement("div");
    track.className = "model-loader__track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", "0");
    content.append(phaseViewport, track);

    const bar = document.createElement("div");
    bar.className = "model-loader__bar";
    track.appendChild(bar);

    shell.replaceChildren(ring, content);

    const set = (value = 0, maxValue = 100) => {
      const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
      const normalized = Number.isFinite(value) ? Math.min(Math.max(value / safeMax, 0), 1) : 0;
      const progress = Math.round(normalized * 100);

      shell.style.setProperty("--model-loader-progress", String(progress));
      percent.textContent = `${progress}%`;
      bar.style.width = `${progress}%`;
      track.setAttribute("aria-valuenow", String(progress));
      updatePhase(loadingModelKeyIndex);
    };

    set(0, 100);

    return {
      getElement: () => shell,
      show: () => {
        clearHideTimer();
        shell.hidden = false;
        delete shell.dataset.complete;
        updatePhase(loadingModelKeyIndex);
      },
      hide: () => {
        clearHideTimer();
        shell.hidden = true;
        delete shell.dataset.complete;
      },
      setStage: (stageKey, progressValue = null) => {
        const index = stageKeyToIndex.get(stageKey);
        if (typeof index === "number") {
          updatePhase(index);
        }
        if (Number.isFinite(progressValue)) {
          const normalizedProgress = Math.max(0, Math.min(Math.round(progressValue), 100));
          shell.style.setProperty("--model-loader-progress", String(normalizedProgress));
          percent.textContent = `${normalizedProgress}%`;
          bar.style.width = `${normalizedProgress}%`;
          track.setAttribute("aria-valuenow", String(normalizedProgress));
        }
      },
      complete: (delayMs = 2400) => {
        clearHideTimer();
        updatePhase(stageKeyToIndex.get("loadingLog.modelLoaded") ?? messages.length - 1);
        shell.style.setProperty("--model-loader-progress", "100");
        percent.textContent = "100%";
        bar.style.width = "100%";
        track.setAttribute("aria-valuenow", "100");
        shell.dataset.complete = "true";
        hideTimer = window.setTimeout(() => {
          hideTimer = null;
          delete shell.dataset.complete;
          shell.hidden = true;
        }, delayMs);
      },
      set,
      reset: (maxValue = 100) => {
        clearHideTimer();
        delete shell.dataset.complete;
        set(0, maxValue);
      },
    };
  },

  createLoadingLog() {
    const shell = document.createElement("div");
    shell.id = "loading-log";
    shell.setAttribute("aria-live", "polite");
    shell.hidden = true;
    shell.style.setProperty("bottom", "-55px");

    const collapsedToggle = document.createElement("button");
    collapsedToggle.type = "button";
    collapsedToggle.className = "loading-log__collapsed-toggle";
    collapsedToggle.setAttribute("aria-label", t$1("loadingLog.title", "Loading process log"));
    collapsedToggle.setAttribute("aria-expanded", "false");
    shell.appendChild(collapsedToggle);

    const header = document.createElement("button");
    header.type = "button";
    header.className = "loading-log__header";
    header.setAttribute("aria-expanded", "false");

    const headerTitle = document.createElement("span");
    headerTitle.className = "loading-log__title";
    headerTitle.textContent = t$1("loadingLog.title", "Loading process log");

    const headerSummary = document.createElement("span");
    headerSummary.className = "loading-log__summary";

    header.append(headerTitle, headerSummary);
    shell.appendChild(header);

    const body = document.createElement("div");
    body.className = "loading-log__body";

    const list = document.createElement("div");
    list.className = "loading-log__messages";

    const progress = document.createElement("div");
    progress.className = "loading-log__progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", "0");

    const progressBar = document.createElement("div");
    progressBar.className = "loading-log__progress-bar";
    progress.appendChild(progressBar);

    body.append(list, progress);
    shell.appendChild(body);
    core.container.appendChild(shell);

    let timer = null;
    let messageIndex = 0;
    let visibleCount = 0;
    let currentProgress = 0;
    let startedAt = 0;
    let hideTimer = null;
    let progressUpdated = false;
    const minVisibleMs = 900;
    const loadingMessages = this.getLoadingLogMessages();
    const loadingStageKeyToIndex = new Map(
      this.loadingLogMessageKeys.map((key, index) => [key, index])
    );
    const loadingModelMessageIndex = Math.max(
      0,
      loadingStageKeyToIndex.get("loadingLog.loadingModel") ?? 0
    );
    let isExpanded = false;

    const setExpanded = (expanded) => {
      isExpanded = expanded;
      shell.dataset.expanded = expanded ? "true" : "false";
      header.setAttribute("aria-expanded", expanded ? "true" : "false");
      collapsedToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    };

    const updateSummary = () => {
      const activeMessage = loadingMessages[messageIndex] || loadingMessages[loadingModelMessageIndex] || "";
      headerSummary.textContent = `${currentProgress}% • ${activeMessage}`;
    };

    header.addEventListener("click", () => {
      if (shell.hidden) return;
      setExpanded(!isExpanded);
    });

    collapsedToggle.addEventListener("click", () => {
      if (shell.hidden) return;
      setExpanded(!isExpanded);
    });

    const renderMessages = (allDone = false) => {
      const messages = loadingMessages
        .slice(Math.max(0, messageIndex - visibleCount + 1), messageIndex + 1);
      list.replaceChildren(...messages.map((message, index) => {
        const row = document.createElement("div");
        row.className = "loading-log__message";
        if (allDone) {
          row.classList.add("loading-log__message--done");
        } else if (index === messages.length - 1) {
          row.classList.add("loading-log__message--active");
        }
        row.textContent = message;
        return row;
      }));
    };

    const setProgress = (value) => {
      const normalizedValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
      currentProgress = Math.max(currentProgress, Math.round(normalizedValue));
      progressBar.style.width = `${currentProgress}%`;
      progress.setAttribute("aria-valuenow", String(currentProgress));
      updateSummary();
    };

    const tick = () => {
      visibleCount = Math.min(4, visibleCount + 1);
      if (!progressUpdated) {
        messageIndex = loadingModelMessageIndex;
        setProgress(Math.min(currentProgress + 8, 12));
      }
      renderMessages();
    };

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const clearHideTimer = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const collapseLog = () => {
      shell.classList.remove("loading-log--done");
      shell.classList.remove("loading-log--error");
      setExpanded(false);
      hideTimer = null;
    };

    return {
      start: () => {
        stop();
        clearHideTimer();
        progressUpdated = false;
        startedAt = performance.now();
        shell.hidden = false;
        setExpanded(false);
        shell.classList.remove("loading-log--done", "loading-log--error");
        messageIndex = loadingModelMessageIndex;
        visibleCount = 1;
        currentProgress = 0;
        renderMessages();
        setProgress(6);
        timer = window.setInterval(tick, 520);
      },
      update: (value) => {
        if (shell.hidden) return;
        progressUpdated = true;
        const normalized = Number.isFinite(value) ? value : 0;
        messageIndex = loadingModelMessageIndex;
        visibleCount = Math.min(4, Math.max(visibleCount, 2));
        renderMessages();
        setProgress(Math.min(normalized, 99));
      },
      setStage: (stageKey, progressValue = null) => {
        if (shell.hidden) return;
        const stageIndex = loadingStageKeyToIndex.get(stageKey);
        if (typeof stageIndex === "number") {
          messageIndex = stageIndex;
          visibleCount = Math.min(4, Math.max(visibleCount, 2));
          renderMessages();
          updateSummary();
        }
        if (Number.isFinite(progressValue)) {
          setProgress(progressValue);
        }
      },
      finish: () => {
        if (shell.hidden) return;
        stop();
        const messageCount = loadingMessages.length;
        messageIndex = messageCount - 1;
        visibleCount = messageCount;
        renderMessages(true);
        setProgress(100);
        updateSummary();
        shell.classList.add("loading-log--done");
        const visibleFor = performance.now() - startedAt;
        const hideDelay = Math.max(1200, minVisibleMs - visibleFor + 800);
        clearHideTimer();
        hideTimer = window.setTimeout(() => {
          collapseLog();
        }, hideDelay);
      },
      fail: () => {
        if (shell.hidden) return;
        stop();
        clearHideTimer();
        setExpanded(true);
        shell.classList.add("loading-log--error");
        hideTimer = window.setTimeout(() => {
          shell.classList.remove("loading-log--error");
          setExpanded(false);
          hideTimer = null;
        }, 2000);
      }
    };
  },

  showStatusNotice(message, duration = 2600, options = {}) {
    this.enqueueStatusNotice({ message, duration, tone: "info", ...options });
  },

  localizeStatusNotice(notice) {
    if (!notice) return notice;
    const i18nKey = String(notice.i18nKey || "");
    const detailI18nKey = String(notice.detailI18nKey || "");
    return {
      ...notice,
      message: i18nKey ? t$1(i18nKey, notice.i18nVars || {}, notice.message) : notice.message,
      detail: detailI18nKey ? t$1(detailI18nKey, notice.detailI18nVars || {}, notice.detail) : notice.detail,
    };
  },

  renderStatusNoticeContent(notice) {
    if (!this.statusNotice || !notice) return;
    const message = String(notice.message ?? "");
    const detail = String(notice.detail ?? "");

    this.statusNotice.textContent = "";

    const messageNode = document.createElement("span");
    messageNode.className = "viewer-notice-message";
    messageNode.textContent = message;
    this.statusNotice.appendChild(messageNode);

    if (detail) {
      const detailNode = document.createElement("span");
      detailNode.className = "viewer-notice-detail";
      detailNode.textContent = detail;
      this.statusNotice.appendChild(detailNode);
    }
  },

  getStatusNoticeText(notice) {
    return [notice?.message, notice?.detail].filter(Boolean).join(" ");
  },

  refreshStatusNoticeLanguage() {
    if (Array.isArray(this.statusNoticeQueue)) {
      this.statusNoticeQueue = this.statusNoticeQueue.map((notice) => this.localizeStatusNotice(notice));
    }

    if (!this.statusNoticeCurrent) return;
    this.statusNoticeCurrent = this.localizeStatusNotice(this.statusNoticeCurrent);
    this.renderStatusNoticeContent(this.statusNoticeCurrent);
  },

  showStatusNoticeNow(notice) {
    if (!this.statusNotice || !notice) return;
    notice = this.localizeStatusNotice(notice);

    if (this.statusNoticeHideTimer) {
      clearTimeout(this.statusNoticeHideTimer);
      this.statusNoticeHideTimer = null;
    }

    this.statusNoticeActive = true;
    this.statusNoticeCurrent = notice;
    this.statusNotice.hidden = false;
    this.renderStatusNoticeContent(notice);
    this.statusNotice.dataset.tone = notice.tone || "info";
    if (notice.variant) {
      this.statusNotice.dataset.variant = notice.variant;
    } else {
      delete this.statusNotice.dataset.variant;
    }
    this.noticeContainer?.classList.toggle("viewer-notice-container--sandbox", notice.variant === "sandbox");
    this.statusNotice.classList.remove("is-hiding");
    this.statusNotice.classList.add("is-visible");

    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }

    if (notice.persistent) {
      return;
    }

    this.statusNoticeTimer = setTimeout(() => {
      if (this.statusNotice) {
        this.statusNotice.classList.remove("is-visible");
        this.statusNotice.classList.add("is-hiding");
      }

      this.statusNoticeHideTimer = setTimeout(() => {
        if (this.statusNotice) {
          this.statusNotice.hidden = true;
          this.statusNotice.classList.remove("is-hiding");
          delete this.statusNotice.dataset.variant;
        }
        this.noticeContainer?.classList.remove("viewer-notice-container--sandbox");
        this.statusNoticeActive = false;
        this.statusNoticeCurrent = null;
        this.statusNoticeTimer = null;
        this.statusNoticeHideTimer = null;
        this.processStatusNoticeQueue();
      }, 220);
    }, notice.duration);
  },

  dismissStatusNotice(key = "") {
    const normalizedKey = String(key || "");
    this.statusNoticeQueue = this.statusNoticeQueue.filter(
      (entry) => normalizedKey && (entry?.key || "") !== normalizedKey
    );

    if (
      normalizedKey &&
      (!this.statusNoticeCurrent || (this.statusNoticeCurrent.key || "") !== normalizedKey)
    ) {
      return;
    }

    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }
    if (this.statusNoticeHideTimer) {
      clearTimeout(this.statusNoticeHideTimer);
      this.statusNoticeHideTimer = null;
    }

    if (this.statusNotice) {
      this.statusNotice.hidden = true;
      this.statusNotice.classList.remove("is-visible", "is-hiding");
      delete this.statusNotice.dataset.variant;
    }
    this.noticeContainer?.classList.remove("viewer-notice-container--sandbox");

    this.statusNoticeActive = false;
    this.statusNoticeCurrent = null;
    this.processStatusNoticeQueue();
  },

  enqueueStatusNotice({
    message,
    duration = 2600,
    tone = "info",
    key = "",
    replace = false,
    persistent = false,
    variant = "",
    i18nKey = "",
    i18nVars = {},
    detail = "",
    detailI18nKey = "",
    detailI18nVars = {},
  } = {}) {
    const text = String(message ?? "");
    if (!text) return;

    const nextNotice = {
      message: text,
      tone,
      duration: Number.isFinite(duration) ? duration : 2600,
      key: String(key || ""),
      persistent,
      variant: String(variant || ""),
      i18nKey: String(i18nKey || ""),
      i18nVars: i18nVars && typeof i18nVars === "object" ? { ...i18nVars } : {},
      detail: String(detail || ""),
      detailI18nKey: String(detailI18nKey || ""),
      detailI18nVars: detailI18nVars && typeof detailI18nVars === "object" ? { ...detailI18nVars } : {},
    };

    if (
      this.statusNoticeActive &&
      this.getStatusNoticeText(this.statusNoticeCurrent) === this.getStatusNoticeText(nextNotice) &&
      (this.statusNoticeCurrent?.tone || "info") === nextNotice.tone &&
      (this.statusNoticeCurrent?.key || "") === nextNotice.key
    ) {
      return;
    }

    if (nextNotice.key) {
      this.statusNoticeQueue = this.statusNoticeQueue.filter(
        (entry) => (entry?.key || "") !== nextNotice.key
      );
    }

    if (
      replace &&
      this.statusNoticeActive &&
      (!nextNotice.key || (this.statusNoticeCurrent?.key || "") === nextNotice.key)
    ) {
      this.showStatusNoticeNow(nextNotice);
      return;
    }

    const isDuplicateQueued = this.statusNoticeQueue.some(
      (entry) =>
        this.getStatusNoticeText(entry) === this.getStatusNoticeText(nextNotice) &&
        entry?.tone === nextNotice.tone &&
        (entry?.key || "") === nextNotice.key
    );
    if (isDuplicateQueued) return;

    const priorityMap = {
      error: 0,
      warning: 1,
      info: 2,
      success: 3,
    };
    const nextPriority = priorityMap[nextNotice.tone] ?? 2;
    const insertAt = this.statusNoticeQueue.findIndex((entry) => {
      const entryPriority = priorityMap[entry?.tone] ?? 2;
      return nextPriority < entryPriority;
    });

    if (insertAt === -1) {
      this.statusNoticeQueue.push(nextNotice);
    } else {
      this.statusNoticeQueue.splice(insertAt, 0, nextNotice);
    }

    this.processStatusNoticeQueue();
  },

  processStatusNoticeQueue() {
    if (this.statusNoticeActive) return;
    if (!this.statusNotice) return;
    if (!Array.isArray(this.statusNoticeQueue) || this.statusNoticeQueue.length === 0) return;

    const nextNotice = this.statusNoticeQueue.shift();
    if (!nextNotice) return;
    this.showStatusNoticeNow(nextNotice);
  },

  maybeShowKeyboardHint() {
    try {
      if (window.localStorage.getItem("viewerHintSeen") !== "1") return;
    } catch (_err) {
      // If storage is unavailable, keep previous behavior.
    }
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    const now = Date.now();
    if (now - this.lastWindowFocusAt < this.keyboardHintAfterFocusDelayMs) return;
    if (this.pickingMode) return;
    const clippingMode = this.planeParams?.clippingMode || {};
    if (clippingMode.x || clippingMode.y || clippingMode.z) return;
    if (!core.handHint?.hidden || core.GESTURE?.active) return;
    if (now - this.lastKeyboardHintAt < this.keyboardHintCooldownMs) return;
    this.lastKeyboardHintAt = now;
    this.showStatusNotice(this.getKeyboardShortcutsText(), 7400);
  },

  isInteractiveTextInput(element) {
    if (!element || typeof element.closest !== "function") return false;
    return Boolean(
      element.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")
    );
  },

  isViewerKeyboardActive(event) {
    if (this.isInteractiveTextInput(event?.target)) return false;
    if (!core.renderer?.domElement) return false;
    const active = document.activeElement;
    return active === core.renderer.domElement || core.renderer.domElement.contains(active);
  },

  isPointerDirectlyOverCanvas(event) {
    if (!core.renderer?.domElement || !event) return false;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const topElement = document.elementFromPoint(x, y);
    if (!topElement) return false;
    return topElement === core.renderer.domElement;
  },

  animateKeyboardCameraTo(nextCameraPosition, nextTarget) {
    if (!core.camera || !core.controls || !nextCameraPosition || !nextTarget) return;

    const startCamera = core.camera.position.clone();
    const startTarget = core.controls.target.clone();
    const targetCamera = nextCameraPosition.clone();
    const targetControls = nextTarget.clone();
    const duration = this.keyboardTweenDurationMs;

    core.cameraTween?.stop?.();
    core.targetTween?.stop?.();

    core.cameraTween = new exports$1.Tween(startCamera)
      .to(targetCamera, duration)
      .easing(exports$1.Easing.Quadratic.Out)
      .onUpdate(() => {
        core.camera.position.copy(startCamera);
        core.cameraLight?.position.copy(startCamera);
        core.camera.updateProjectionMatrix();
      })
      .onComplete(() => {
        core.camera.position.copy(targetCamera);
        core.cameraLight?.position.copy(targetCamera);
        core.camera.updateProjectionMatrix();
      });

    core.targetTween = new exports$1.Tween(startTarget)
      .to(targetControls, duration)
      .easing(exports$1.Easing.Quadratic.Out)
      .onUpdate(() => {
        core.controls.target.copy(startTarget);
        core.controls.update();
      })
      .onComplete(() => {
        core.controls.target.copy(targetControls);
        core.controls.update();
      });

    core.cameraTween.start();
    core.targetTween.start();
  },

  rotateCameraByKeyboard(deltaTheta = 0, deltaPhi = 0) {
    if (!core.camera || !core.controls) return;

    const target = core.controls.target.clone();
    const offset = core.camera.position.clone().sub(target);
    if (offset.lengthSq() === 0) return;

    const spherical = new THREE.Spherical().setFromVector3(offset);
    const minPolar = 0.05;
    const maxPolar = Math.PI - 0.05;
    spherical.theta += deltaTheta;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + deltaPhi, minPolar, maxPolar);

    offset.setFromSpherical(spherical);
    const nextCamera = target.clone().add(offset);
    this.animateKeyboardCameraTo(nextCamera, target);
  },

  panCameraByKeyboard(directionX = 0, directionY = 0) {
    if (!core.camera || !core.controls) return;
    const distance = core.camera.position.distanceTo(core.controls.target) || 1;
    const panStep = distance * this.keyboardStep.panFactor;

    const forward = core.controls.target.clone().sub(core.camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, core.camera.up).normalize();
    const up = core.camera.up.clone().normalize();

    const panOffset = right.multiplyScalar(directionX * panStep).add(up.multiplyScalar(directionY * panStep));
    const nextCamera = core.camera.position.clone().add(panOffset);
    const nextTarget = core.controls.target.clone().add(panOffset);
    this.animateKeyboardCameraTo(nextCamera, nextTarget);
  },

  zoomCameraByKeyboard(zoomIn = true) {
    if (!core.camera || !core.controls) return;
    const factor = zoomIn ? 1 / this.keyboardStep.zoomFactor : this.keyboardStep.zoomFactor;
    const offset = core.camera.position.clone().sub(core.controls.target);
    let nextDistance = offset.length() * factor;

    if (Number.isFinite(core.controls.minDistance)) {
      nextDistance = Math.max(core.controls.minDistance, nextDistance);
    }
    if (Number.isFinite(core.controls.maxDistance) && core.controls.maxDistance > 0) {
      nextDistance = Math.min(core.controls.maxDistance, nextDistance);
    }
    if (nextDistance <= 0) return;

    offset.setLength(nextDistance);
    const nextTarget = core.controls.target.clone();
    const nextCamera = nextTarget.clone().add(offset);
    this.animateKeyboardCameraTo(nextCamera, nextTarget);
  },

  toggleAutoRotateByKeyboard() {
    if (!core.controls) return;
    core.controls.autoRotate = !core.controls.autoRotate;
    this.showStatusNotice(
      core.controls.autoRotate ? "Auto-rotate enabled" : "Auto-rotate disabled",
      1400
    );
    this.updateEmbedConfiguratorPreview();
  },

  onViewerKeyDown(event) {
    if (!Viewer.isViewerKeyboardActive(event)) return;

    const isFast = event.shiftKey;
    const rotateStep = isFast ? Viewer.keyboardStep.rotateFast : Viewer.keyboardStep.rotate;
    const isPanMode = event.ctrlKey || event.metaKey;
    let handled = false;

    switch (event.key) {
      case "ArrowLeft":
        if (isPanMode) Viewer.panCameraByKeyboard(-1, 0);
        else Viewer.rotateCameraByKeyboard(-rotateStep, 0);
        handled = true;
        break;
      case "ArrowRight":
        if (isPanMode) Viewer.panCameraByKeyboard(1, 0);
        else Viewer.rotateCameraByKeyboard(rotateStep, 0);
        handled = true;
        break;
      case "ArrowUp":
        if (isPanMode) Viewer.panCameraByKeyboard(0, 1);
        else Viewer.rotateCameraByKeyboard(0, -rotateStep);
        handled = true;
        break;
      case "ArrowDown":
        if (isPanMode) Viewer.panCameraByKeyboard(0, -1);
        else Viewer.rotateCameraByKeyboard(0, rotateStep);
        handled = true;
        break;
      case "+":
      case "=":
        Viewer.zoomCameraByKeyboard(true);
        handled = true;
        break;
      case "-":
      case "_":
        Viewer.zoomCameraByKeyboard(false);
        handled = true;
        break;
      case " ":
      case "Spacebar":
        Viewer.toggleAutoRotateByKeyboard();
        handled = true;
        break;
    }

    if (handled) {
      Viewer.maybeShowKeyboardHint();
      event.preventDefault();
      event.stopPropagation();
    }
  },

  isEmbedMode() {
    const params = new URLSearchParams(window.location.search);
    const embedParam = params.get("embed");
    return window.location.pathname.endsWith("/embed.html") || embedParam === "1" || embedParam === "true";
  },

  getEmbedPageUrl() {
    const embedUrl = new URL("embed.html", import.meta.url);
    embedUrl.search = "";
    embedUrl.hash = "";
    return embedUrl;
  },

  async copyTextToClipboard(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const tempInput = document.createElement("textarea");
    tempInput.value = value;
    tempInput.setAttribute("readonly", "true");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    tempInput.remove();
  },

  getCurrentEmbedOptions({ includeCamera = false } = {}) {
    const entityId = core.CONFIG?.entity?.id;
    const modelPath = core.fileObject?.originalPath || core.container?.getAttribute("3d") || "";
    const options = {
      model: modelPath || null,
      id: entityId || null,
      theme: this.currentTheme === "light" ? "light" : null,
      autorotate: core.controls?.autoRotate === true,
      autorotateSpeed: Number.isFinite(core.controls?.autoRotateSpeed) ? core.controls.autoRotateSpeed : null,
      disableInteraction: this.urlOptions?.disableInteraction === true,
      hideUi: this.urlOptions?.hideUi === true,
      hideMetadata: this.urlOptions?.hideMetadata === true,
      presentationMode: core.PRESENTATION_MODE === true,
      sandboxMode: core.SANDBOX_MODE === true,
      cameraPosition: null,
      cameraTarget: null,
      fov: null,
    };

    if (includeCamera) {
      options.cameraPosition = this.formatVector3Param(core.camera?.position);
      options.cameraTarget = this.formatVector3Param(core.controls?.target);
      options.fov = Number.isFinite(core.camera?.fov) ? core.camera.fov : null;
    }

    return options;
  },

  applyEmbedOptionsToInputs(options = {}) {
    if (!this.embedConfigInputs) return;
    this.embedConfigInputs.model.value = options.model ?? "";
    this.embedConfigInputs.id.value = options.id ?? "";
    this.embedConfigInputs.theme.value = options.theme === "light" ? "light" : "dark";
    this.embedConfigInputs.autorotate.checked = options.autorotate === true;
    this.embedConfigInputs.autorotateSpeed.value = Number.isFinite(options.autorotateSpeed) ? String(options.autorotateSpeed) : "";
    this.embedConfigInputs.disableInteraction.checked = options.disableInteraction === true;
    this.embedConfigInputs.hideUi.checked = options.hideUi === true;
    this.embedConfigInputs.hideMetadata.checked = options.hideMetadata === true;
    this.embedConfigInputs.presentationMode.checked = options.presentationMode === true;
    this.embedConfigInputs.camPos.value = options.cameraPosition ?? "";
    this.embedConfigInputs.camTarget.value = options.cameraTarget ?? "";
    this.embedConfigInputs.fov.value = Number.isFinite(options.fov) ? String(options.fov) : "";
  },

  setEmbedInputError(input, hasError, message = "") {
    if (!input) return;
    input.classList.toggle("embed-input-invalid", hasError);
    if (hasError && message) {
      input.setAttribute("title", message);
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("title");
      input.removeAttribute("aria-invalid");
    }
  },

  validateEmbedInputFields() {
    if (!this.embedConfigInputs) return true;
    const { camPos, camTarget, fov } = this.embedConfigInputs;
    const camPosRaw = camPos.value.trim();
    const camTargetRaw = camTarget.value.trim();
    const fovRaw = fov.value.trim();

    const camPosOk = camPosRaw === "" || this.parseVector3Param(camPosRaw) !== null;
    const camTargetOk = camTargetRaw === "" || this.parseVector3Param(camTargetRaw) !== null;
    const parsedFov = this.parseFloatParam(fovRaw);
    const fovOk = fovRaw === "" || (Number.isFinite(parsedFov) && parsedFov >= 1 && parsedFov <= 179);

    this.setEmbedInputError(camPos, !camPosOk, "Use format: x,y,z (for example 1.2,0.8,2.5)");
    this.setEmbedInputError(camTarget, !camTargetOk, "Use format: x,y,z (for example 0,0,0)");
    this.setEmbedInputError(fov, !fovOk, "FOV must be a number from 1 to 179");

    return camPosOk && camTargetOk && fovOk;
  },

  buildEmbedPayload(options = {}) {
    const embedUrl = this.getEmbedPageUrl();
    const params = new URLSearchParams();

    if (options.model) {
      params.set("model", options.model);
    } else if (options.id) {
      params.set("id", options.id);
    }

    if (options.theme === "light") {
      params.set("theme", options.theme);
    }

    if (options.autorotate === true) {
      params.set("autorotate", "1");
      if (Number.isFinite(options.autorotateSpeed)) {
        params.set("autorotateSpeed", String(options.autorotateSpeed));
      }
    }

    if (options.disableInteraction) {
      params.set("disableInteraction", "1");
    }
    if (options.hideUi) {
      params.set("hideUi", "1");
    }
    if (options.hideMetadata) {
      params.set("hideMetadata", "1");
    }
    if (options.presentationMode) {
      params.set("presentationMode", "1");
    }
    if (options.sandboxMode) {
      params.set("sandbox", "1");
    }
    if (options.cameraPosition) {
      params.set("camPos", options.cameraPosition);
    }
    if (options.cameraTarget) {
      params.set("camTarget", options.cameraTarget);
    }
    if (Number.isFinite(options.fov)) {
      params.set("fov", String(options.fov));
    }

    embedUrl.search = params.toString();

    return {
      url: embedUrl.toString(),
      code: `<iframe src="${embedUrl.toString()}" title="DFG 3D Viewer" loading="lazy" allow="fullscreen; xr-spatial-tracking" referrerpolicy="strict-origin-when-cross-origin" style="width:100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`,
    };
  },

  getSharePayload() {
    return this.buildEmbedPayload(this.getCurrentEmbedOptions({ includeCamera: true }));
  },

  collectEmbedConfiguratorOptions() {
    const inputs = this.embedConfigInputs;
    if (!inputs) return this.getCurrentEmbedOptions({ includeCamera: true });
    const parsedCamPos = this.parseVector3Param(inputs.camPos.value);
    const parsedCamTarget = this.parseVector3Param(inputs.camTarget.value);
    const parsedFov = this.parseFloatParam(inputs.fov.value);
    const normalizedFov = Number.isFinite(parsedFov) ? Math.min(179, Math.max(1, parsedFov)) : null;
    return {
      model: inputs.model.value.trim() || null,
      id: inputs.id.value.trim() || null,
      theme: inputs.theme.value === "light" ? "light" : null,
      autorotate: inputs.autorotate.checked,
      autorotateSpeed: this.parseFloatParam(inputs.autorotateSpeed.value),
      disableInteraction: inputs.disableInteraction.checked,
      hideUi: inputs.hideUi.checked,
      hideMetadata: inputs.hideMetadata.checked,
      presentationMode: inputs.presentationMode.checked,
      cameraPosition: this.formatVector3Param(parsedCamPos),
      cameraTarget: this.formatVector3Param(parsedCamTarget),
      fov: normalizedFov,
    };
  },

  hasEmbedSourceSelection(options = {}) {
    return Boolean(options.model || options.id);
  },

  notifyMissingEmbedSource({ force = false } = {}) {
    if (!force && this.embedMissingSourceNotified) return;
    toastHelper$1("embedSourceMissing", "warning");
    this.embedMissingSourceNotified = true;
  },

  updateEmbedConfiguratorPreview() {
    if (!this.embedConfigInputs) return;
    this.validateEmbedInputFields();
    const options = this.collectEmbedConfiguratorOptions();
    if (!this.hasEmbedSourceSelection(options)) {
      this.notifyMissingEmbedSource();
    } else {
      this.embedMissingSourceNotified = false;
    }
    const payload = this.buildEmbedPayload(options);
    this.embedConfigInputs.url.value = payload.url;
    this.embedConfigInputs.iframe.value = payload.code;
    if (this.embedConfigPreviewFrame) {
      this.embedConfigPreviewFrame.src = payload.url;
    }
  },

  fillConfiguratorWithCurrentCamera() {
    if (!this.embedConfigInputs) return;
    this.embedConfigInputs.camPos.value = this.formatVector3Param(core.camera?.position) || "";
    this.embedConfigInputs.camTarget.value = this.formatVector3Param(core.controls?.target) || "";
    this.embedConfigInputs.fov.value = Number.isFinite(core.camera?.fov) ? String(core.camera.fov) : "";
    this.updateEmbedConfiguratorPreview();
  },

  resetEmbedConfiguratorFromViewerState() {
    if (!this.embedConfigInputs) return;
    this.applyEmbedOptionsToInputs(this.getCurrentEmbedOptions({ includeCamera: true }));
    this.updateEmbedConfiguratorPreview();
  },

  toggleEmbedConfigurator(event) {
    event?.preventDefault?.();
    this.closeActionMenu();
    if (!this.embedConfiguratorPanel) return;
    const willShow = this.embedConfiguratorPanel.hidden === true;
    this.embedConfiguratorPanel.hidden = !willShow;
    if (willShow) {
      this.updateEmbedConfiguratorPreview();
    }
    this.updateEmbedMenuEntryState();
  },

  openEmbedConfiguratorFromMenu(event) {
    this.toggleEmbedConfigurator(event);
  },

  createEmbedConfiguratorPanel() {
    if (!core.container || this.embedConfiguratorPanel) return;

    const defaults = this.getCurrentEmbedOptions({ includeCamera: true });
    const panel = document.createElement("div");
    panel.id = "embedConfiguratorPanel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="embed-config-header">
        <span>Embed options</span>
        <button id="embedClosePanel" type="button" aria-label="Close embed options">X</button>
      </div>
      <div class="embed-config-layout">
        <div class="embed-config-main">
          <div class="embed-config-grid">
            <label>Model URL<input id="embedModelInput" type="text" placeholder="/examples/box.glb" value="${defaults.model ?? ""}" /></label>
            <label>Entity ID<input id="embedIdInput" type="text" value="${defaults.id ?? ""}" /></label>
            <label>Theme
              <select id="embedThemeInput">
                <option value="dark">Dark</option>
                <option value="light"${defaults.theme === "light" ? " selected" : ""}>Light</option>
              </select>
            </label>
            <label>Auto-rotate speed<input id="embedAutorotateSpeedInput" type="number" step="0.1" value="${Number.isFinite(defaults.autorotateSpeed) ? defaults.autorotateSpeed : ""}" /></label>
            <label>Camera position<input id="embedCamPosInput" type="text" placeholder="x,y,z" value="${defaults.cameraPosition ?? ""}" /></label>
            <label>Camera target<input id="embedCamTargetInput" type="text" placeholder="x,y,z" value="${defaults.cameraTarget ?? ""}" /></label>
            <label>FOV<input id="embedFovInput" type="number" step="1" min="1" max="179" value="${Number.isFinite(defaults.fov) ? defaults.fov : ""}" /></label>
          </div>
          <div class="embed-config-checks">
            <label><input id="embedAutorotateInput" type="checkbox"${defaults.autorotate ? " checked" : ""} /> Auto-rotate</label>
            <label><input id="embedDisableInteractionInput" type="checkbox"${defaults.disableInteraction ? " checked" : ""} /> Disable interaction</label>
            <label><input id="embedHideUiInput" type="checkbox"${defaults.hideUi ? " checked" : ""} /> Hide action menu</label>
            <label><input id="embedHideMetadataInput" type="checkbox"${defaults.hideMetadata ? " checked" : ""} /> Hide metadata</label>
            <label><input id="embedPresentationModeInput" type="checkbox"${defaults.presentationMode ? " checked" : ""} /> Presentation mode</label>
          </div>
          <div class="embed-config-actions">
            <button id="embedUseCurrentCamera" type="button">Use Current Camera</button>
            <button id="embedResetFromViewer" type="button">Reset From Viewer</button>
            <button id="embedCopyUrl" type="button">Copy URL</button>
            <button id="embedCopyIframe" type="button">Copy Iframe</button>
          </div>
          <label class="embed-config-field">Embed URL<textarea id="embedUrlOutput" readonly></textarea></label>
          <label class="embed-config-field">Iframe code<textarea id="embedIframeOutput" readonly></textarea></label>
        </div>
        <div class="embed-config-preview-side">
          <span>Preview</span>
          <iframe id="embedPreviewFrame" title="Embed preview" loading="lazy"></iframe>
        </div>
      </div>
    `;

    core.container.appendChild(panel);
    this.embedConfiguratorPanel = panel;
    this.embedConfigInputs = {
      model: panel.querySelector("#embedModelInput"),
      id: panel.querySelector("#embedIdInput"),
      theme: panel.querySelector("#embedThemeInput"),
      autorotate: panel.querySelector("#embedAutorotateInput"),
      autorotateSpeed: panel.querySelector("#embedAutorotateSpeedInput"),
      disableInteraction: panel.querySelector("#embedDisableInteractionInput"),
      hideUi: panel.querySelector("#embedHideUiInput"),
      hideMetadata: panel.querySelector("#embedHideMetadataInput"),
      presentationMode: panel.querySelector("#embedPresentationModeInput"),
      camPos: panel.querySelector("#embedCamPosInput"),
      camTarget: panel.querySelector("#embedCamTargetInput"),
      fov: panel.querySelector("#embedFovInput"),
      url: panel.querySelector("#embedUrlOutput"),
      iframe: panel.querySelector("#embedIframeOutput"),
    };
    this.embedConfigPreviewFrame = panel.querySelector("#embedPreviewFrame");

    const watchedInputs = [
      this.embedConfigInputs.model,
      this.embedConfigInputs.id,
      this.embedConfigInputs.theme,
      this.embedConfigInputs.autorotate,
      this.embedConfigInputs.autorotateSpeed,
      this.embedConfigInputs.disableInteraction,
      this.embedConfigInputs.hideUi,
      this.embedConfigInputs.hideMetadata,
      this.embedConfigInputs.presentationMode,
      this.embedConfigInputs.camPos,
      this.embedConfigInputs.camTarget,
      this.embedConfigInputs.fov,
    ];
    watchedInputs.forEach((input) => {
      if (!input) return;
      const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
      this.bindEventListener(input, eventName, () => this.updateEmbedConfiguratorPreview());
    });

    const useCurrentCameraButton = panel.querySelector("#embedUseCurrentCamera");
    const resetFromViewerButton = panel.querySelector("#embedResetFromViewer");
    const copyUrlButton = panel.querySelector("#embedCopyUrl");
    const copyIframeButton = panel.querySelector("#embedCopyIframe");
    const closePanelButton = panel.querySelector("#embedClosePanel");

    this.bindEventListener(useCurrentCameraButton, "click", () => this.fillConfiguratorWithCurrentCamera());
    this.bindEventListener(resetFromViewerButton, "click", () => this.resetEmbedConfiguratorFromViewerState());
    this.bindEventListener(closePanelButton, "click", () => {
      this.closeEmbedConfigurator();
    });
    this.bindEventListener(copyUrlButton, "click", async () => {
      try {
        const options = this.collectEmbedConfiguratorOptions();
        if (!this.hasEmbedSourceSelection(options)) {
          this.notifyMissingEmbedSource({ force: true });
          return;
        }
        const payload = this.buildEmbedPayload(options);
        await this.copyTextToClipboard(payload.url);
        toastHelper$1("embedUrlCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy embed URL failed" });
        toastHelper$1("embedUrlCopyError", "error");
      }
    });
    this.bindEventListener(copyIframeButton, "click", async () => {
      try {
        const options = this.collectEmbedConfiguratorOptions();
        if (!this.hasEmbedSourceSelection(options)) {
          this.notifyMissingEmbedSource({ force: true });
          return;
        }
        const payload = this.buildEmbedPayload(options);
        await this.copyTextToClipboard(payload.code);
        toastHelper$1("embedIframeCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy embed iframe failed" });
        toastHelper$1("embedIframeCopyError", "error");
      }
    });

    this.updateEmbedConfiguratorPreview();
  },

  async copyEmbedCode(event) {
    event?.preventDefault?.();
    Viewer.closeActionMenu();

    try {
      const { code } = Viewer.getSharePayload();
      await Viewer.copyTextToClipboard(code);
      toastHelper$1("embedCodeCopied", "success");
    } catch (error) {
      Viewer.reportError(error, { context: "Copy embed code failed" });
      toastHelper$1("embedCodeCopyError", "error");
    }
  },

  updateFullscreenButtonIcon() {
    if (this.editorToolbar) {
      if (this.fullscreenMode) {
        this.editorToolbar.classList.add("with-fullscreen");
      } else {
        this.editorToolbar.classList.remove("with-fullscreen");
      }
    }    
    if (!this.fullscreenMode) return;

    const isFullscreen = !!document.fullscreenElement;
    const label = isFullscreen
      ? t$1("fullscreen.exitMode", "Exit fullscreen mode")
      : t$1("fullscreen.mode", "Fullscreen mode");

    this.fullscreenMode.innerHTML = `
      <span class="viewer-action-icon ${isFullscreen ? "fullscreen-exit-icon" : "fullscreen-icon"}" aria-hidden="true"></span>
      <span>${isFullscreen ? t$1("fullscreen.exit", "Exit fullscreen") : t$1("fullscreen.enter", "Fullscreen")}</span>
    `;
    this.fullscreenMode.setAttribute("aria-label", label);
    this.fullscreenMode.setAttribute("title", label);
  },

  cleanupRuntimeBindings() {
    while (this.cleanupCallbacks.length > 0) {
      const callback = this.cleanupCallbacks.pop();
      try {
        callback();
      } catch (error) {
        console.warn("Viewer cleanup callback failed:", error);
      }
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },

  cleanupTransientUI() {
    const iiifForm = document.getElementById("form-IIIF");
    if (iiifForm) {
      iiifForm.remove();
    }
  },

  reportError(error, options = {}) {
    return reportViewerError(error, {
      consoleLabel: "Viewer error:",
      ...options,
    });
  },

  disposeMaterial(material) {
    if (!material) return;

    const materials = Array.isArray(material) ? material : [material];

    materials.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;

      Object.values(entry).forEach((value) => {
        if (value && typeof value === "object" && value.isTexture === true) {
          value.dispose();
        }
      });

      entry.dispose?.();
    });
  },

  disposeObjectResources(object) {
    if (!object) return;

    const disposeNode = (node) => {
      if (!node || typeof node !== "object") return;
      node.geometry?.dispose?.();
      Viewer.disposeMaterial(node.material);
    };

    if (Array.isArray(object)) {
      object.forEach((entry) => Viewer.disposeObjectResources(entry));
      return;
    }

    object.traverse?.((child) => disposeNode(child));
  },

  removeAndDisposeFromScene(object) {
    if (!object) return;

    if (Array.isArray(object)) {
      object.forEach((entry) => Viewer.removeAndDisposeFromScene(entry));
      return;
    }

    if (object.parent) {
      object.parent.remove(object);
    } else {
      core.scene?.remove?.(object);
    }

    Viewer.disposeObjectResources(object);
  },

  disposeFaceOverlay(entry) {
    if (!entry?.overlay) return;
    entry.overlay.removeFromParent();
    Viewer.disposeObjectResources(entry.overlay);
  },

  resetLoadedModelState() {
    Viewer.restoreLastPickedFace();
    Viewer.clearSelectedFaces();
    Viewer.closeAnnotationDialog();
    Viewer.annotationEntries.length = 0;
    Viewer.pendingAnnotationsXml = "";
    Viewer.clearAnnotationPOIs();
    core.transformControl?.detach?.();
    core.transformControlLight?.detach?.();
    core.transformControlLightTarget?.detach?.();
    Viewer.transformText["Transform 3D Object"] = "";
    Viewer.transformText["Transform Light"] = "";
    Viewer.pickingMode = false;
    Viewer.RULER_MODE = false;
    Viewer.updateEditorToolbarLabels();
    Viewer.updateEditorToolbarState();

    if (core.outlineClipping) {
      Viewer.removeAndDisposeFromScene(core.outlineClipping);
      core.outlineClipping = null;
      setCore('outlineClipping', null);
    }

    if (Viewer.textMesh) {
      Viewer.removeAndDisposeFromScene(Viewer.textMesh);
      Viewer.textMesh = null;
    }

    if (Viewer.ruler?.length) {
      Viewer.ruler.forEach((item) => Viewer.removeAndDisposeFromScene(item));
    }
    Viewer.ruler = [];
    Viewer.rulerObject = null;
    Viewer.textMeshDistance = null;

    if (core.mainObject?.length) {
      core.mainObject.forEach((obj) => Viewer.removeAndDisposeFromScene(obj));
      core.mainObject.length = 0;
    }

    if (Array.isArray(core.helperObjects)) core.helperObjects.length = 0;
    if (Array.isArray(core.selectedObjects)) core.selectedObjects.length = 0;
    if (Array.isArray(Viewer.helperObjects)) Viewer.helperObjects.length = 0;
    if (Array.isArray(Viewer.selectedObjects)) Viewer.selectedObjects.length = 0;
    if (Array.isArray(Viewer.selectedFaces)) Viewer.selectedFaces.length = 0;
    Viewer.updateSelectedFacesCount();
    Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
  },

  renderFatalError(error) {
    const message = this.reportError(error, {
      context: "Viewer initialization failed",
      toast: false,
      consoleLabel: "Viewer initialization error:",
    });
    const container =
      this.container ||
      document.getElementById(core.CONFIG?.viewer?.container || "DFG_3DViewer") ||
      document.body;

    if (!container) return;

    let errorBox = document.getElementById("viewer-fatal-error");
    if (!errorBox) {
      errorBox = document.createElement("div");
      errorBox.id = "viewer-fatal-error";
      errorBox.style.padding = "16px";
      errorBox.style.margin = "12px 0";
      errorBox.style.border = "1px solid #b91c1c";
      errorBox.style.background = "#fef2f2";
      errorBox.style.color = "#7f1d1d";
      errorBox.style.fontFamily = "sans-serif";
      container.prepend(errorBox);
    }

    errorBox.textContent = message;
  },

  async MainInit() {
    if (window.__E2E__) {
      this.ensureE2EState();
    }

    this.cleanupRuntimeBindings();
    this.cleanupTransientUI();
    this.resetLoadedModelState();

    await new Promise(r => {
      if (document.readyState !== 'loading') r();
      else document.addEventListener('DOMContentLoaded', r);
    });
    const moduleUrl = new URL(import.meta.url);
    const settingsPath = moduleUrl.pathname.includes('/assets/')
      ? '../viewer-settings.json'
      : './viewer-settings.json';
    const url = new URL(settingsPath, moduleUrl);

    //Setup core variables first to make them available in the loaders and utils
    setCore('viewEntity', this.viewEntity);
    setCore('CONFIG', this.CONFIG);
    setCore('loadedFile', this.loadedFile);
    setCore('stats', this.stats);
    setCore('guiContainer', this.guiContainer);
    setCore('lilGui', this.lilGui);
    setCore('gui', this.gui);
    setCore('i18nGui', this.i18nGui);
    setCore('enqueueStatusNotice', this.enqueueStatusNotice.bind(this));
    setCore('dismissStatusNotice', this.dismissStatusNotice.bind(this));
    setCore('updateClippingHintVisibility', this.updateClippingHintVisibility.bind(this));

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    core.CONFIG = await res.json();
    console.log("Loaded viewer-settings.json", core.CONFIG.viewer);

    if (Object.keys(core.CONFIG).length === 0) {
      core.CONFIG = {
        mainUrl: "https://dfg-repository.wisski.cloud",
        baseNamespace: "https://dfg-repository.wisski.cloud",
        metadataUrl: "https://dfg-repository.wisski.cloud",
        baseModulePath: "/modules/dfg_3dviewer-main/viewer",
        entity: {
          bundle: "bd3d7baa74856d141bcff7b4193fa128",
          fieldDf: "field_df",
          idUri: "/wisski/navigate/(.*)/view",
          viewEntityPath: "/wisski/navigate/",
          attributeId: "wisski_id",
          metadata: {
            source: "IIIF",
          },
        },
        viewer: {
          container: "DFG_3DViewer",
          fileUpload: "fbf95bddee5160d515b982b3fd2e05f7",
          fileName: "faa602a0be629324806aef22892cdbe5",
          imageGeneration: "f605dc6b727a1099b9e52b3ccbdf5673",
          presentationMode: "false",
          sandboxMode: "false",
          lightweight: 0,
          scaleContainer: {
            x: 0.85,
            y: 1.4,
          },
          editor: true,
          gallery: {
            build: true,
            container: "block-bootstrap5-content",
            imageClass: "field--name-fd6a974b7120d422c7b21b5f1f2315d9",
            imageId: "",
          },
          background:
            "radial-gradient(circle, #ffffff 0%, #999999 100%)",
          performanceMode: {
            Performance: "high-performance",
          },
          measurement: {
            modelUnitInMeters: 1,
          }
        },
      };
    }

    this.isLightweight = Boolean(core.CONFIG.viewer.lightweight);
    setCore('isLightweight', this.isLightweight);
  
    this.EDITOR = Boolean(core.CONFIG.viewer.editor);
    setCore('EDITOR', this.EDITOR);

    const presentationModeFromConfig = this.parseBooleanParam(core.CONFIG.viewer.presentationMode);
    this.PRESENTATION_MODE = presentationModeFromConfig ?? Boolean(core.CONFIG.viewer.presentationMode);
    setCore('PRESENTATION_MODE', this.PRESENTATION_MODE);

    const sandboxModeFromConfig = this.parseBooleanParam(core.CONFIG.viewer.sandboxMode);
    this.SANDBOX_MODE = sandboxModeFromConfig ?? Boolean(core.CONFIG.viewer.sandboxMode);
    setCore('SANDBOX_MODE', this.SANDBOX_MODE);
    console.log(`Presentation mode: ${this.PRESENTATION_MODE ? "ON" : "OFF"}`);
    console.log(`Sandbox mode: ${this.SANDBOX_MODE ? "ON" : "OFF"}`);

    console.log(`AIM 3D-Viewer ${this.isLightweight ? '🪶 LIGHTWEIGHT' : '💪 FULL'} mode`);
    console.log(`Powered by Three.js (v${THREE.REVISION})`);
    
    if (!core.CONFIG.entity.metadata.sourceType) { 
      core.CONFIG.entity.metadata.sourceType = SOURCE;
      console.log(`Metadata source: ${core.CONFIG.entity.metadata.sourceType}`);
    }

    this.container = document.getElementById(core.CONFIG.viewer.container);
    if (!this.container) throw new Error("Container not found");
    setCore('container', this.container);
    document.body.classList.toggle("viewer-embed-page", this.isEmbedMode());

    this.parseUrlOptions();
    console.log(`Presentation mode: ${core.PRESENTATION_MODE ? "ON" : "OFF"}`);
    console.log(`Sandbox mode: ${core.SANDBOX_MODE ? "ON" : "OFF"}`);
    this.currentLanguage = this.getStoredLanguage();
    setCore('currentLanguage', this.currentLanguage);
    setCore('showNotifications', this.showNotifications);
    core.showNotifications = this.urlOptions.showNotifications;

    if (this.urlOptions.model) {
      this.container.setAttribute("3d", this.urlOptions.model);
    }
    if (this.shouldIgnoreLegacyEmbedDefaultModel()) {
      this.container.removeAttribute("3d");
    }

    this.scrollTop = window.scrollY || document.documentElement.scrollTop;
    this.rect = core.container.getBoundingClientRect();
    const e2eModel = this.getE2EModelOverride();
    if (e2eModel) {
      core.container.setAttribute("3d", e2eModel);
    }

    this.fileObject.originalPath = this.normalizeFileUrl(core.container.getAttribute("3d"));
    setCore('fileObject', this.fileObject);
    if (this.urlOptions.scale !== undefined && this.urlOptions.scale !== null) {
      core.CONFIG.viewer.scaleContainer.x = this.urlOptions.scale.x;
      core.CONFIG.viewer.scaleContainer.y = this.urlOptions.scale.y;
    }
    core.CONFIG.viewer.canvasDimensions = {
      x: this.rect.width * Number(core.CONFIG.viewer.scaleContainer.x),
      y: this.rect.height * Number(core.CONFIG.viewer.scaleContainer.y),
    };
    this.bottomLineGUI = core.CONFIG.viewer.canvasDimensions.y - 85;
    setCore('bottomLineGUI', this.bottomLineGUI);

    if (core.isLightweight) {
      core.CONFIG.viewer.lightweight = core.container.getAttribute("proxy");
    }
    var elementsURL = window.location.pathname;
    elementsURL = elementsURL.match(core.CONFIG.entity.idUri);
    if (elementsURL !== null) {
      core.CONFIG.entity.id = elementsURL[1];
    } else {
      if (this.urlOptions.id) {
        core.CONFIG.entity.id = this.urlOptions.id;
      }
    }
    if (core.CONFIG.entity.id) {
      core.container.setAttribute(core.CONFIG.entity.attributeId, core.CONFIG.entity.id);
      console.log("Entity ID:", core.CONFIG.entity.id);
    }

    // Initialize clipping planes at startup
    this.core = initClippingPlanes();
    setCore('EXIT_CODE', this.EXIT_CODE);
    // Initialize objectsConfig in core
    setCore('objectsConfig', objectsConfig);
    setCore('outlineClipping', outlineClipping);
    core.objectsConfig.setupIndex = core.objectsConfig.index = 0;

    this.cameraTween = new exports$1.Tween();
    setCore('cameraTween', this.cameraTween);

    this.targetTween = new exports$1.Tween();
    setCore('targetTween', this.targetTween);

    core.container.classList.add("mainContainer");

    if (core.container.hasAttribute("basePath")) {
      core.CONFIG.baseModulePath = core.container.getAttribute("basePath");
    }

    this.setModelPaths();

    core.CONFIG.viewer.exportPath = "/api/editor/xml-export/";    
    this.loadedFile = `${core.fileObject.basename}.${core.fileObject.extension}`;

    this.noticeContainer = document.createElement("div");
    this.noticeContainer.id = "viewerNoticeContainer";
    core.container.appendChild(this.noticeContainer);
    setCore("noticeContainer", this.noticeContainer);

    this.statusNotice = document.createElement("div");
    this.statusNotice.id = "viewerStatusNotice";
    this.statusNotice.className = "viewer-notice viewer-notice-status";
    this.statusNotice.hidden = true;
    this.statusNotice.setAttribute("role", "status");
    this.statusNotice.setAttribute("aria-live", "polite");
    this.noticeContainer.appendChild(this.statusNotice);
    setCore("statusNotice", this.statusNotice);
    this.statusNoticeQueue = [];
    this.statusNoticeActive = false;
    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }

    if (!core.PRESENTATION_MODE) {
      this.handHint = document.createElement("div");
      this.handHint.id = "handHint";
      this.handHint.hidden = true;
      core.container.appendChild(this.handHint);
      setCore('handHint', this.handHint);

      this.pickingHint = document.createElement("div");
      this.pickingHint.id = "pickingHint";
      this.pickingHint.className = "viewer-notice viewer-notice-hint";
      this.pickingHint.textContent = "Shift + click to select multiple faces";
      this.pickingHint.hidden = true;
      this.noticeContainer.appendChild(this.pickingHint);
      setCore("pickingHint", this.pickingHint);

      this.clippingHint = document.createElement("div");
      this.clippingHint.id = "clippingHint";
      this.clippingHint.className = "viewer-notice viewer-notice-hint";
      this.clippingHint.textContent = "Drag active clipping plane helper to adjust cut";
      this.clippingHint.hidden = true;
      this.noticeContainer.appendChild(this.clippingHint);
      setCore("clippingHint", this.clippingHint);

      core.guiContainer = document.createElement("div");
      core.guiContainer.id = "guiContainer";
      core.guiContainer.className = "guiContainer";
      core.guiContainer.hidden = core.SANDBOX_MODE === true;
      core.container.appendChild(core.guiContainer);

      core.gui  = new p({ container: core.guiContainer });

      this.metadataContainer = document.createElement("div");
      this.metadataContainer.setAttribute("id", "metadata-container");
      this.metadataContainer.style.top = -this.metadataContainer.getBoundingClientRect().top + "px";
      if (this.urlOptions.hideMetadata) {
        this.metadataContainer.style.display = "none";
      }
      setCore('metadataContainer', this.metadataContainer);
      setCore('colors', this.colors);
      setCore("planeHelpers", this.planeHelpers);    
      setCore("planeParams", this.planeParams);
      setCore('materialProperties', this.materialProperties);
      setCore('materialsPropertiesText', this.materialsPropertiesText);
      setCore('intensity', this.intensity);
      this.clippingPlanes = this.core;
      setCore("clippingPlanes", this.clippingPlanes);
      setCore('helperObjects', this.helperObjects);
      setCore('lightHelper', this.lightHelper);
      setCore('selectedObjects', this.selectedObjects);
    }

    this.spinnerContainer = document.createElement("div");
    this.spinnerContainer.id = "spinnerContainer";
    this.spinnerElement = document.createElement("div");
    this.spinnerElement.id = "spinner";
    this.spinnerContainer.appendChild(this.spinnerElement);
    core.container.appendChild(this.spinnerContainer);

    this.circle = this.createModelLoadingProgress(this.spinnerElement);
    setCore('circle', this.circle);
    if (!core.PRESENTATION_MODE) {
      this.loadingLog = this.createLoadingLog();
      setCore('loadingLog', this.loadingLog);
    }

    this.rect = core.container.getBoundingClientRect();

    this.clock = new THREE.Timer();

    Viewer.init();
    if (!core.PRESENTATION_MODE) {
      Viewer.prepareStats();
    }
    localStorage.setItem("viewerHintSeen", "0");
    
    this.updateSize();
    /*if (core.CONFIG.entity?.metadata?.source != null) {
      await Viewer.mainLoadModel();
    }*/
    Viewer.animate();
  },

  normalizeDrupalFilesPath(path) {
    return path
      .replace(/^\/?sites\/default\/files\/?/, '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  },

  normalizeArchiveModelPath(path) {
    if (!path || typeof path !== "string") {
      return path;
    }

    const injectGltfSegment = (pathname) => pathname.replace(
      /\/([^/]+_(ZIP|RAR|TAR|XZ|GZ))\/([^/]+\.(glb|gltf))$/i,
      "/$1/gltf/$3"
    );

    if (/^[a-zA-Z][\w+-.]*:\/\//.test(path)) {
      try {
        const url = new URL(path);
        url.pathname = injectGltfSegment(url.pathname);
        return url.href;
      } catch (_err) {
        return injectGltfSegment(path);
      }
    }

    return injectGltfSegment(path);
  },

  setModelPaths() {
    if (!core.fileObject.originalPath) {
      core.fileObject.filename = "";
      core.fileObject.basename = "";
      core.fileObject.extension = "";
      core.fileObject.path = "";
      core.fileObject.uri = "";
      core.fileObject.relativePath = "";
      return;
    }

    core.fileObject.filename = core.fileObject.originalPath.split("/").pop();
    core.fileObject.basename = core.fileObject.filename.substring(0, core.fileObject.filename.lastIndexOf("."));
    core.fileObject.extension = core.fileObject.filename.substring(core.fileObject.filename.lastIndexOf(".") + 1);
    core.fileObject.path = core.fileObject.originalPath.substring(0, core.fileObject.originalPath.lastIndexOf(core.fileObject.filename)) || "/";
    core.fileObject.uri = core.fileObject.path.replace(core.CONFIG.mainUrl + "/", "");
    core.fileObject.relativePath = Viewer.normalizeDrupalFilesPath(core.fileObject.uri);
  },

  // Disable interaction hint on first interaction
 disableInteractionHint() {
    if (core.PRESENTATION_MODE) return;
    core.handHint.hidden = true;
    Viewer.stopGesture();

    // Stop any running camera tweens when user interacts
    if (core.cameraTween && typeof core.cameraTween.stop === "function") {
      core.cameraTween.stop();
      core.cameraTween = null;
    }
    if (core.targetTween && typeof core.targetTween.stop === "function") {
      core.targetTween.stop();
      core.targetTween = null;
    }

    //core.handHint.classList.remove("hand-drag-animate");
    localStorage.setItem("viewerHintSeen", "1");
  },

  addTextWatermark(_text, _scale) {
    var materials = [
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.4,
      }), // front
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.4,
      }), // side
    ];
    const loader = new FontLoader();

    loader.load(
      `${core.DFG_ASSETS}/fonts/helvetiker_regular.typeface.json`,
      function (font) {
        const textGeo = new TextGeometry(_text, {
          font,
          size: _scale * 3,
          height: _scale / 10,
          curveSegments: 5,
          bevelEnabled: true,
          bevelThickness: _scale / 8,
          bevelSize: _scale / 10,
          bevelOffset: 0,
          bevelSegments: 1,
        });
        textGeo.computeBoundingBox();

        //const centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);

        Viewer.textMesh = new THREE.Mesh(textGeo, materials);

        Viewer.textMesh.rotation.z = Math.PI;
        Viewer.textMesh.rotation.y = Math.PI;

        Viewer.textMesh.position.x = 0;
        Viewer.textMesh.position.y = 0;
        Viewer.textMesh.position.z = 0;
        Viewer.textMesh.renderOrder = 1;
        core.scene.add(Viewer.textMesh);
      }
    );
  },

  addTextPoint(_text, _scale, _point) {
    const loader = new FontLoader();
    const bevelSize = _scale / 10;

    loader.load(`${core.DFG_ASSETS}/fonts/helvetiker_regular.typeface.json`, (font) => {

      const baseOptions = {
        font: font,
        size: _scale * 3,
        height: _scale,
        curveSegments: 4,
        bevelEnabled: true,
        bevelThickness: bevelSize,
        bevelSize: bevelSize / 10,
        bevelOffset: 0,
        bevelSegments: 1,
        depth: _scale / 10,
      };

      const textGeo = new TextGeometry(_text, baseOptions);
      textGeo.computeBoundingBox();

      const centerOffset = new THREE.Vector3();
      textGeo.boundingBox.getCenter(centerOffset).negate();
      textGeo.translate(centerOffset.x, centerOffset.y, centerOffset.z);

      const outlineGeo = textGeo.clone();
      outlineGeo.scale(1.05, 1.08, 1.05);

      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      });

      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
      });

      const outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
      outlineMesh.position.z = -_scale * 0.02;
      const fillMesh = new THREE.Mesh(textGeo, fillMat);

      const group = new THREE.Group();
      group.add(outlineMesh);
      group.add(fillMesh);

      group.position.set(_point.x, _point.y, _point.z);
      group.renderOrder = 999;

      group.userData.isDistanceLabel = true;

      Viewer.rulerObject.add(group);
    });
  },

  selectObjectHierarchy(_id) {
    let search = true;
    for (let i = 0; i < core.selectedObjects.length && search === true; i++) {
      if (core.selectedObjects[i].id === _id) {
        search = false;
        if (core.selectedObjects[i].selected === true) {
          core.scene.getObjectById(_id).material = core.selectedObjects[i].originalMaterial;
          core.scene.getObjectById(_id).material.needsUpdate = true;
          core.selectedObjects[i].selected = false;
          core.selectedObjects.splice(core.selectedObjects.indexOf(core.selectedObjects[i]), 1);
        }
      }
    }
    if (search) {
      core.selectedObjects.push({
        id: _id,
        selected: true,
        originalMaterial: core.scene.getObjectById(_id).material.clone(),
      });
      const tempMaterial = core.scene.getObjectById(_id).material.clone();
      const selectedColor = Viewer.toThreeColor("0x00FF00");
      if (selectedColor) {
        tempMaterial.color = selectedColor;
      }
      core.scene.getObjectById(_id).material = tempMaterial;
      core.scene.getObjectById(_id).material.needsUpdate = true;
    }
  },

  recreateBoundingBox(object) {
    var _min = new THREE.Vector3();
    var _max = new THREE.Vector3();
    if (object instanceof THREE.Object3D) {
      object.traverse(function (mesh) {
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry.computeBoundingBox();
          var bBox = mesh.geometry.boundingBox;

          // compute overall bbox
          _min.x = Math.min(_min.x, bBox.min.x + mesh.position.x);
          _min.y = Math.min(_min.y, bBox.min.y + mesh.position.y);
          _min.z = Math.min(_min.z, bBox.min.z + mesh.position.z);
          _max.x = Math.max(_max.x, bBox.max.x + mesh.position.x);
          _max.y = Math.max(_max.y, bBox.max.y + mesh.position.y);
          _max.z = Math.max(_max.z, bBox.max.z + mesh.position.z);
        }
      });

      var bBox_min = new THREE.Vector3(_min.x, _min.y, _min.z);
      var bBox_max = new THREE.Vector3(_max.x, _max.y, _max.z);
      var bBox_new = new THREE.Box3(bBox_min, bBox_max);
      object.position.set(
        (bBox_new.min.x + bBox_new.max.x) / 2,
        bBox_new.min.y,
        (bBox_new.min.z + bBox_new.max.z) / 2
      );
    }
    return object;
  },

  prepareGalleryImages(imageElementsChildren) {
    imageElementsChildren = imageElementsChildren.filter(function (_image) {
      if (!(_image instanceof Element)) return false;
      let rawUrl = "";
      const img = _image.querySelector("img");
      const link = _image.querySelector("a");
      if (img && img.getAttribute("src")) {
        rawUrl = img.getAttribute("src");
      } else if (link && link.getAttribute("href")) {
        rawUrl = link.getAttribute("href");
      } else {
        rawUrl = (_image.textContent || _image.innerHTML || "").trim();
      }

      const normalized = Viewer.normalizeGalleryUrl(rawUrl);
      if (!isValidUrl(normalized)) {
        return false;
      }
      _image.innerHTML = normalized;
      return !!img;
    });
    imageElementsChildren.forEach(function (imgLink, index) {
      imgLink.innerHTML =
        '<img loading="lazy" src="' +
        imgLink.innerHTML +
        '" width="200px" height="200px" alt="" class="img-fluid image-style-wisski-preview">';
    });
    return imageElementsChildren;
  },

  normalizeGalleryUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return "";
    }

    let url = rawUrl.trim();
    if (url === "") {
      return "";
    }

    if (url.startsWith("public://")) {
      url = "/sites/default/files/" + url.substring("public://".length);
    } else if (url.startsWith("sites/default/files/")) {
      url = "/" + url;
    }

    const base = (core.CONFIG?.mainUrl || window.location.origin || "").replace(/\/+$/, "");

    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.host || "";
      const path = parsed.pathname || "";
      const normalizedHost = host.toLowerCase();
      const hasBadHost = host.includes("_") || normalizedHost === "default" || normalizedHost === "dfg_3dviewer";

      if (path.startsWith("/sites/default/files/")) {
        if (hasBadHost) {
          return `${base}${path}`;
        }
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.href;
        }
        return `${base}${path}`;
      }
      return parsed.href;
    } catch (e) {
      if (url.startsWith("/sites/default/files/")) {
        return `${base}${url}`;
      }
      return url;
    }
  },

  normalizeFileUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return "";
    }

    let url = rawUrl.trim();
    if (url === "") {
      return "";
    }

    if (/^\/[a-z][\w+.-]*:\/\//i.test(url)) {
      url = url.replace(/^\/+/, "");
    }

    if (url.startsWith("public://")) {
      url = "/sites/default/files/" + url.substring("public://".length);
    } else if (url.startsWith("sites/default/files/")) {
      url = "/" + url;
    }

    const base = (core.CONFIG?.mainUrl || window.location.origin || "").replace(/\/+$/, "");

    try {
      const parsed = new URL(url, window.location.origin);
      const host = (parsed.host || "").toLowerCase();
      const path = parsed.pathname || "";
      const hasBadHost =
        host === "default" ||
        host === "dfg_3dviewer" ||
        host.includes("_");

      if (path.startsWith("/sites/default/files/")) {
        if (hasBadHost) {
          return `${base}${path}`;
        }
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.href;
        }
        return `${base}${path}`;
      }

      return parsed.href;
    } catch (_err) {
      if (url.startsWith("/sites/default/files/")) {
        return `${base}${url}`;
      }
      return url;
    }
  },

  shouldIgnoreLegacyEmbedDefaultModel() {
    if (!this.isEmbedMode()) return false;
    if (this.urlOptions?.model || this.urlOptions?.id) return false;

    const sourceType = String(core.CONFIG?.entity?.metadata?.sourceType || "").toLowerCase();
    if (!sourceType.startsWith("drupal")) return false;

    const currentModelAttr = String(this.container?.getAttribute("3d") || "").trim();
    if (!currentModelAttr) return false;

    return /^(?:\.{1,2}\/)?examples\/box\.stl(?:\?.*)?$/i.test(currentModelAttr);
  },

  handleImages(
    mainElement,
    imageElements,
    imageElementsChildren
  ) {
    if (typeof (imageElementsChildren == undefined)) {
      imageElementsChildren = imageElements;
    }
    var imageList = document.createElement("div");
    imageList.setAttribute("id", "image-list");
    var modalGallery = document.createElement("div");
    var modalImage = document.createElement("img");
    modalImage.setAttribute("class", "modalImage");
    modalImage.style.transform = `scale(0.95)`;
    Viewer.bindEventListener(modalGallery, "wheel", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY > 0 && Viewer.zoomImage > 0.15) {
        modalImage.style.transform = `scale(${(Viewer.zoomImage -= Viewer.ZOOM_SPEED_IMAGE)})`;
      } else if (e.deltaY < 0 && Viewer.zoomImage < 5) {
        modalImage.style.transform = `scale(${(Viewer.zoomImage += Viewer.ZOOM_SPEED_IMAGE)})`;
      }
      return false;
    });
    var modalClose = document.createElement("span");
    modalGallery.setAttribute("id", "modalGallery");
    modalGallery.setAttribute("class", "modalGallery");
    modalClose.setAttribute("class", "closeGallery");
    modalClose.setAttribute("title", "Close");
    modalClose.innerHTML = "&times";
    modalClose.onclick = function () {
      modalGallery.style.display = "none";
    };

    Viewer.bindEventListener(document, "click", function (event) {
      if (
        !modalGallery.contains(event.target) &&
        !imageList.contains(event.target)
      ) {
        modalGallery.style.display = "none";
        Viewer.zoomImage = 1.5;
        modalImage.style.transform = `scale(1.5)`;
      }
    });

    modalGallery.appendChild(modalImage);
    modalGallery.appendChild(modalClose);
    for (let i = 0; imageElementsChildren.length - i >= 0; i++) {
      if (
        imageElementsChildren[i] !== undefined &&
        imageElementsChildren[i].innerHTML !== undefined
      ) {
        var imgList = imageElementsChildren[i].getElementsByTagName("a");
        for (let j = 0; j < imgList.length; j++) {
          imgList[j].setAttribute("href", "#");
          imgList[j].setAttribute("src", imgList[j].firstChild.src);
          imgList[j].setAttribute("class", "image-list-item");
        }
        imgList = imageElementsChildren[i].getElementsByTagName("img");
        //for single thumbnail
        if (imgList.length == 1) {
          imgList[0].style.maxWidth = "fit-content";
          imgList[0].style.maxHeight = "180px";
        }
        for (let j = 0; j < imgList.length; j++) {
          imgList[j].onclick = function () {
            modalGallery.style.display = "block";
            imageList.style.zIndex = 0;
            imageList.style.display = "hidden";
            modalImage.src = this.src;
          };
        }
        imageList.appendChild(imageElementsChildren[i]);
      }
    }
    if (
      imageList &&
      imageList.childNodes.length > 0 &&
      Viewer.fileElement &&
      Viewer.fileElement[0] &&
      mainElement
    ) {
      Viewer.fileElement[0].insertAdjacentElement("beforebegin", modalGallery);
      mainElement.insertAdjacentElement("beforebegin", imageList);
    }
    //mainElement.insertBefore(imageList, fileElement[0]);
  },

  buildGallery() {
    if (Viewer.fileElement && Viewer.fileElement?.length > 0) {
      var mainElement = document.getElementById(core.CONFIG.viewer.gallery.container);
      var imageElements;
      if (core.CONFIG.viewer.gallery.imageClass !== "") {
        imageElements = document.getElementsByClassName(
          core.CONFIG.viewer.gallery.imageClass
        );
        if (imageElements.length > 0) {
          var galleryLabel = document.getElementsByClassName("field__label");
          if (galleryLabel !== undefined) galleryLabel[0].innerText = "";
        }
      } else if (core.CONFIG.viewer.gallery.imageId !== "") {
        imageElements = document.getElementById(core.CONFIG.viewer.gallery.imageId);
      } else {
        console.log("No gallery created");
      }

      if (imageElements !== null) {
        if (imageElements.length > 0) {
          if (imageElements[0].innerHTML !== undefined) {
            let imagesList = Array.from(
              imageElements[0].getElementsByClassName("field__items")[0]
                .childNodes
            );
            imagesList = Viewer.prepareGalleryImages(imagesList);
            //imageElements[0].classList.add("field--type-image");
            imageElements[0].classList.add("field--label-hidden");
            imageElements[0].classList.add("field__items");
            Viewer.handleImages(mainElement, imagesList, imageElements);
          } else {
            Viewer.handleImages(mainElement, imageElements);
          }
        } else if (
          imageElements.childNodes !== undefined &&
          imageElements.childNodes.length > 0
        ) {
          if (
            typeof imageElements.childNodes[0].innerHTML == "string" ||
            typeof imageElements.childNodes[1].innerHTML == "string"
          ) {
            //handle links and convert to img
            let imagesList = Array.from(imageElements.childNodes);
            imagesList = Viewer.prepareGalleryImages(imagesList);
            imageElements.classList.add("field--type-image");
            imageElements.classList.add("field--label-hidden");
            imageElements.classList.add("field__items");
            Viewer.handleImages(mainElement, imagesList, imageElements);
          } else {
            Viewer.handleImages(mainElement, imageElements);
          }
        }
      }
    }
  },

  toHexColor(input) {
    if (!input) return null;

    // THREE.Color
    if (typeof input.getHex === "function") {
      return input.getHex();
    }

    // hex number
    if (typeof input === "number") {
      return input >>> 0;
    }

    // hex string: "#ff00aa" / "ff00aa"
    if (typeof input === "string") {
      const s = input.replace("#", "");
      if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16);
      return null;
    }

    // array [r,g,b] / [r,g,b,a]
    if (Array.isArray(input)) {
      const [r, g, b] = input;
      if ([r, g, b].every(v => typeof v === "number")) {
        const rr = r <= 1 ? Math.round(r * 255) : r;
        const gg = g <= 1 ? Math.round(g * 255) : g;
        const bb = b <= 1 ? Math.round(b * 255) : b;
        return ((rr & 255) << 16) | ((gg & 255) << 8) | (bb & 255);
      }
      return null;
    }

    // object { r, g, b, a? }
    if (typeof input === "object" && "r" in input && "g" in input && "b" in input) {
      const rr = input.r <= 1 ? Math.round(input.r * 255) : input.r;
      const gg = input.g <= 1 ? Math.round(input.g * 255) : input.g;
      const bb = input.b <= 1 ? Math.round(input.b * 255) : input.b;
      return ((rr & 255) << 16) | ((gg & 255) << 8) | (bb & 255);
    }

    return null;
  },

  toThreeColor(input) {
    const normalized = normalizeColor(input);
    if (!normalized) return null;
    return new THREE.Color(
      normalized.r / 255,
      normalized.g / 255,
      normalized.b / 255
    );
  },

  createTriangleGeometry(intersection) {
    const position = intersection?.object?.geometry?.attributes?.position;
    const face = intersection?.face;

    if (!position || !face) return null;

    const trianglePositions = new Float32Array([
      position.getX(face.a), position.getY(face.a), position.getZ(face.a),
      position.getX(face.b), position.getY(face.b), position.getZ(face.b),
      position.getX(face.c), position.getY(face.c), position.getZ(face.c),
    ]);

    const triangleGeometry = new THREE.BufferGeometry();
    triangleGeometry.setAttribute("position", new THREE.BufferAttribute(trianglePositions, 3));
    triangleGeometry.computeVertexNormals();

    return triangleGeometry;
  },

  createPickingFaceOverlay(intersection, options = {}) {
    const triangleGeometry = Viewer.createTriangleGeometry(intersection);
    if (!triangleGeometry) return null;

    const fillColor = options.fillColor ?? 0xff0000;
    const lineColor = options.lineColor ?? 0xffffff;
    const opacity = options.opacity ?? 0.65;

    const overlayMaterial = new THREE.MeshBasicMaterial({
      color: fillColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });

    const fillMesh = new THREE.Mesh(triangleGeometry, overlayMaterial);
    fillMesh.renderOrder = 999;

    const lineGeometry = new THREE.EdgesGeometry(triangleGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: Math.min(opacity + 0.2, 1),
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    lineSegments.renderOrder = 1000;

    const overlayGroup = new THREE.Group();
    overlayGroup.name = "picking-face-overlay";
    overlayGroup.userData.isPickingOverlay = true;
    fillMesh.userData.isPickingOverlay = true;
    lineSegments.userData.isPickingOverlay = true;
    overlayGroup.add(fillMesh);
    overlayGroup.add(lineSegments);

    return overlayGroup;
  },

  isPickingOverlayObject(object) {
    let current = object;

    while (current) {
      if (current.userData?.isPickingOverlay === true || current.name === "picking-face-overlay") {
        return true;
      }
      current = current.parent;
    }

    return false;
  },

  getPrimaryIntersection(intersections) {
    if (!Array.isArray(intersections) || intersections.length === 0) return null;

    return intersections.find((entry) => !Viewer.isPickingOverlayObject(entry?.object)) ?? null;
  },

  getFaceSelectionKey(targetId, faceIndex) {
    if (!targetId || faceIndex === null || faceIndex === undefined) return "";
    return `${targetId}:${faceIndex}`;
  },

  findSelectedFaceIndex(targetId, faceIndex) {
    const key = Viewer.getFaceSelectionKey(targetId, faceIndex);
    return Viewer.selectedFaces.findIndex((entry) => entry.key === key);
  },

  updateSelectedFacesCount() {
    Viewer.pickingStats["Selected faces"] = Array.isArray(Viewer.selectedFaces)
      ? Viewer.selectedFaces.length
      : 0;
    const selectedFacesCount = Array.isArray(Viewer.selectedFaces) ? Viewer.selectedFaces.length : 0;
    if (selectedFacesCount < 1 && Viewer.annotationDialog && Viewer.annotationDialog.hidden === false) {
      Viewer.closeAnnotationDialog();
    }
    Viewer.updateAddAnnotationControllerState();
    Viewer.updatePickingHintVisibility();
  },

  toStableIdToken(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || "target";
  },

  getSelectionRootObject(object) {
    let current = object;
    while (current?.parent && current.parent !== core.scene) {
      current = current.parent;
    }
    return current || object;
  },

  getSelectionRootSlot(rootObject) {
    if (!rootObject || !Array.isArray(core.mainObject)) return -1;
    return core.mainObject.findIndex((entry) => {
      if (entry === rootObject) return true;
      return Array.isArray(entry) && entry.includes(rootObject);
    });
  },

  getObjectHierarchyPath(object, rootObject) {
    if (!object || !rootObject) return "";
    const path = [];
    let current = object;
    while (current && current !== rootObject) {
      const parent = current.parent;
      if (!parent) break;
      const index = parent.children.indexOf(current);
      path.push(index >= 0 ? String(index) : "x");
      current = parent;
    }
    return path.reverse().join(".") || "root";
  },

  resolveFaceTargetId(object) {
    if (!object) return "";

    const explicitId = object.userData?.annotationTargetId || object.userData?.id;
    if (explicitId) return String(explicitId);

    const rootObject = Viewer.getSelectionRootObject(object);
    const rootSlot = Viewer.getSelectionRootSlot(rootObject);
    const path = Viewer.getObjectHierarchyPath(object, rootObject);
    let rootTag = rootSlot >= 0 ? `m${rootSlot}` : "m0";
    if (rootSlot >= 0 && Array.isArray(core.mainObject?.[rootSlot])) {
      const rootIndex = core.mainObject[rootSlot].indexOf(rootObject);
      if (rootIndex >= 0) {
        rootTag = `${rootTag}.${rootIndex}`;
      }
    }
    const targetId = `${rootTag}:${path}`;

    object.userData ??= {};
    object.userData.annotationTargetId = targetId;
    return targetId;
  },

  resolveObjectByTargetId(targetId) {
    const raw = String(targetId || "").trim();
    const match = raw.match(/^m(\d+)(?:\.(\d+))?:(.+)$/);
    if (!match) return null;

    const slot = Number.parseInt(match[1], 10);
    const rootIndex = Number.parseInt(match[2] || "0", 10);
    const path = match[3] || "root";
    if (!Number.isInteger(slot) || slot < 0) return null;

    const entry = core.mainObject?.[slot];
    if (!entry) return null;
    let rootObject = Array.isArray(entry) ? entry[rootIndex] : entry;
    if (!rootObject) return null;

    if (path === "root") return rootObject;
    const segments = path.split(".").filter(Boolean);
    for (const segment of segments) {
      const childIndex = Number.parseInt(segment, 10);
      if (!Number.isInteger(childIndex) || childIndex < 0) return null;
      rootObject = rootObject.children?.[childIndex];
      if (!rootObject) return null;
    }

    return rootObject;
  },

  getFaceCentroidWorld(object, faceIndex) {
    const geometry = object?.geometry;
    if (!geometry || !geometry.getAttribute) return null;
    const position = geometry.getAttribute("position");
    if (!position) return null;
    const face = Number(faceIndex);
    if (!Number.isInteger(face) || face < 0) return null;

    let ia = face * 3;
    let ib = ia + 1;
    let ic = ia + 2;
    const index = geometry.getIndex?.() || geometry.index || null;
    if (index?.array) {
      const arr = index.array;
      if (ic >= arr.length) return null;
      ia = arr[ia];
      ib = arr[ib];
      ic = arr[ic];
    } else if (ic >= position.count) {
      return null;
    }

    const va = new THREE.Vector3().fromBufferAttribute(position, ia);
    const vb = new THREE.Vector3().fromBufferAttribute(position, ib);
    const vc = new THREE.Vector3().fromBufferAttribute(position, ic);
    const center = va.add(vb).add(vc).multiplyScalar(1 / 3);
    object.updateMatrixWorld?.(true);
    center.applyMatrix4(object.matrixWorld);
    return center;
  },

  clearAnnotationPOIs() {
    this.closeAnnotationPOITooltip();
    if (!this.annotationPOIGroup) {
      this.annotationPOIMarkers = [];
      return;
    }

    this.annotationPOIGroup.children.slice().forEach((child) => {
      this.removeAndDisposeFromScene(child);
    });
    this.annotationPOIGroup.clear();
    this.annotationPOIMarkers = [];
    this.annotationPOIGroup.visible = false;
  },

  ensureAnnotationPOIGroup() {
    if (this.annotationPOIGroup) return this.annotationPOIGroup;
    const group = new THREE.Group();
    group.name = "annotation-poi-group";
    group.visible = false;
    core.scene?.add?.(group);
    this.annotationPOIGroup = group;
    return group;
  },

  createNumberTexture(text) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  },

  createAnnotationPOIMarker(entry, position, index = 1) {
    const radius = Math.max((this.gridSize || core.gridSize || 1) / 15, 0.005);

    const texture = Viewer.createNumberTexture(index.toString());

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);

    sprite.scale.set(radius, radius, 1);

    sprite.position.copy(position);

    sprite.userData.isAnnotationPOI = true;
    sprite.userData.annotationId = entry.id;
    sprite.userData.groupId = entry.groupId || "";
    sprite.userData.key = entry.key || "";
    sprite.userData.targetId = entry.targetId;
    sprite.userData.faceIndex = entry.faceIndex;
    sprite.userData.title = entry.title || "";

    return sprite;
  },

  ensureAnnotationPOITooltip() {
    if (this.annotationPOITooltip) return this.annotationPOITooltip;
    const tooltip = document.createElement("div");
    tooltip.id = "annotationPOITooltip";
    tooltip.className = "annotation-poi-tooltip";
    tooltip.hidden = true;
    tooltip.innerHTML = `
      <div class="annotation-poi-tooltip__panel" role="status" aria-live="polite" aria-atomic="true">
        <div class="annotation-poi-tooltip__title" id="annotationPOITooltipTitle"></div>
      </div>
    `;
    document.body.appendChild(tooltip);
    this.annotationPOITooltip = tooltip;
    this.annotationPOITooltipTitle = tooltip.querySelector("#annotationPOITooltipTitle");
    return tooltip;
  },

  openAnnotationPOITooltip(marker) {
    if (!marker?.userData?.isAnnotationPOI) {
      this.closeAnnotationPOITooltip();
      return false;
    }

    const tooltip = this.ensureAnnotationPOITooltip();
    if (!tooltip) return false;

    this.annotationPOITooltipTarget = marker;
    const titleText = String(marker.userData?.title || "").trim();
    if (this.annotationPOITooltipTitle) {
      this.annotationPOITooltipTitle.textContent = titleText || "Annotation";
    }

    tooltip.hidden = false;
    tooltip.style.visibility = "visible";
    this.updateAnnotationPOITooltipPosition();
    return true;
  },

  getAnnotationEntriesForPOIMarker(marker) {
    if (!marker?.userData?.isAnnotationPOI) return [];
    const markerId = String(marker.userData?.annotationId || "").trim();
    const markerGroupId = String(marker.userData?.groupId || "").trim();
    const markerKey = String(marker.userData?.key || "").trim();

    let baseEntry = null;
    if (markerId) {
      baseEntry = this.annotationEntries.find((entry) => String(entry?.id || "") === markerId) || null;
    }
    if (!baseEntry && markerKey) {
      baseEntry = this.annotationEntries.find((entry) => String(entry?.key || "") === markerKey) || null;
    }

    const effectiveGroupId = String(baseEntry?.groupId || markerGroupId || "").trim();
    if (effectiveGroupId) {
      const groupedEntries = this.annotationEntries.filter(
        (entry) => String(entry?.groupId || "").trim() === effectiveGroupId
      );
      if (groupedEntries.length > 0) return groupedEntries;
    }

    if (baseEntry) return [baseEntry];

    const fallbackTargetId = String(marker.userData?.targetId || "").trim();
    const fallbackFaceIndex = Number(marker.userData?.faceIndex);
    if (!fallbackTargetId || !Number.isInteger(fallbackFaceIndex) || fallbackFaceIndex < 0) return [];
    return [{
      id: markerId || "",
      key: this.getFaceSelectionKey(fallbackTargetId, fallbackFaceIndex),
      targetId: fallbackTargetId,
      object: fallbackTargetId,
      faceIndex: fallbackFaceIndex,
      title: String(marker.userData?.title || "").trim(),
      description: "",
      groupId: effectiveGroupId,
    }];
  },

  openAnnotationDialogFromPOIMarker(marker) {
    const entries = this.getAnnotationEntriesForPOIMarker(marker);
    if (!entries.length) {
      toastHelper$1("annotationDataMissing", "warning");
      return false;
    }

    this.buildAnnotationDialog();
    if (!this.annotationDialog) return false;

    const keys = entries
      .map((entry) => String(entry?.key || "").trim())
      .filter(Boolean);
    this.annotationTargetFaceKeys = Array.from(new Set(keys));

    const existingGroupIds = Array.from(
      new Set(entries.map((entry) => String(entry?.groupId || "").trim()).filter(Boolean))
    );
    this.annotationBatchGroupId = existingGroupIds.length === 1
      ? existingGroupIds[0]
      : `anno-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const uniqueTitles = Array.from(
      new Set(entries.map((entry) => String(entry?.title || "").trim()))
    );
    const uniqueDescriptions = Array.from(
      new Set(entries.map((entry) => String(entry?.description || "").trim()))
    );
    this.annotationDialogTitleInput.value = uniqueTitles.length === 1 ? uniqueTitles[0] : "";
    this.annotationDialogDescriptionInput.value =
      uniqueDescriptions.length === 1 ? uniqueDescriptions[0] : "";

    this.updateAnnotationDialogBounds();
    this.annotationDialog.hidden = false;
    this.closeAnnotationPOITooltip();
    this.closeActionMenu();
    this.annotationDialogTitleInput?.focus();
    this.annotationDialogTitleInput?.select();
    return true;
  },

  closeAnnotationPOITooltip() {
    this.annotationPOITooltipTarget = null;
    if (!this.annotationPOITooltip) return;
    this.annotationPOITooltip.hidden = true;
    this.annotationPOITooltip.style.visibility = "hidden";
  },

  updateAnnotationPOITooltipPosition() {
    const tooltip = this.annotationPOITooltip;
    const marker = this.annotationPOITooltipTarget;
    if (!tooltip || tooltip.hidden || !marker || !core.camera) return;

    const rect =
      Viewer.mainCanvas?.getBoundingClientRect?.() ||
      core.container?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const worldPosition = new THREE.Vector3();
    marker.getWorldPosition(worldPosition);
    const projected = worldPosition.clone().project(core.camera);
    const withinDepth = projected.z >= -1 && projected.z <= 1;
    const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
    const screenY = rect.top + ((-projected.y + 1) / 2) * rect.height;
    const withinHorizontal = screenX >= rect.left && screenX <= rect.right;
    const withinVertical = screenY >= rect.top && screenY <= rect.bottom;
    if (!withinDepth || !withinHorizontal || !withinVertical) {
      tooltip.style.visibility = "hidden";
      return;
    }

    tooltip.style.left = `${Math.round(screenX)}px`;
    tooltip.style.top = `${Math.round(screenY)}px`;
    tooltip.style.visibility = "visible";
  },

  refreshAnnotationPOIs() {
    this.clearAnnotationPOIs();
    const entries = this.getAnnotationEntriesForPersistence();
    if (!entries.length) return 0;

    const group = this.ensureAnnotationPOIGroup();
    let added = 0;
    entries.forEach((entry) => {
      const object = this.resolveObjectByTargetId(entry.targetId);
      if (!object) return;
      const point = this.getFaceCentroidWorld(object, entry.faceIndex);
      if (!point) return;
      const marker = this.createAnnotationPOIMarker(entry, point, entries.indexOf(entry) + 1);
      group.add(marker);
      this.annotationPOIMarkers.push(marker);
      added += 1;
    });

    group.visible = added > 0;
    return added;
  },

  buildAnnotationDialog() {
    if (!core.container || this.annotationDialog) return;

    const dialog = document.createElement("div");
    dialog.id = "annotationDialog";
    dialog.className = "annotation-dialog";
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="annotation-dialog__backdrop" data-annotation-dismiss="true"></div>
      <div class="annotation-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="annotationDialogTitle">
        <div class="annotation-dialog__header">
          <h3 id="annotationDialogTitle">Add annotation</h3>
          <button type="button" class="annotation-dialog__close" data-annotation-dismiss="true" aria-label="Close annotation dialog">&times;</button>
        </div>
        <form id="annotationDialogForm" class="annotation-dialog__form">
          <label>
            <span>Title</span>
            <input id="annotationTitleInput" name="title" type="text" maxlength="120" required />
          </label>
          <label>
            <span>Description</span>
            <textarea id="annotationDescriptionInput" name="description" rows="5" maxlength="4000"></textarea>
          </label>
          <div class="annotation-dialog__actions">
            <button type="submit">Save annotation</button>
            <button type="button" data-annotation-dismiss="true">Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(dialog);
    this.annotationDialog = dialog;
    this.annotationDialogHost = document.body;
    this.annotationDialogTitleInput = dialog.querySelector("#annotationTitleInput");
    this.annotationDialogDescriptionInput = dialog.querySelector("#annotationDescriptionInput");
    const form = dialog.querySelector("#annotationDialogForm");

    this.bindEventListener(dialog, "click", (event) => {
      const dismissTrigger = event.target?.closest?.("[data-annotation-dismiss='true']");
      if (dismissTrigger) {
        this.closeAnnotationDialog();
      }
    });

    this.bindEventListener(document, "keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!this.annotationDialog || this.annotationDialog.hidden) return;
      event.preventDefault();
      this.closeAnnotationDialog();
    });

    this.bindEventListener(form, "submit", (event) => {
      event.preventDefault();
      this.saveAnnotationFromDialog();
    });

    this.bindEventListener(window, "resize", () => this.updateAnnotationDialogBounds());
    this.bindEventListener(window, "scroll", () => this.updateAnnotationDialogBounds(), true);
    this.bindEventListener(document, "fullscreenchange", () => this.updateAnnotationDialogBounds());
  },

  updateAnnotationDialogBounds() {
    if (!this.annotationDialog) return;
    const targetRect =
      Viewer.mainCanvas?.getBoundingClientRect?.() ||
      core.container?.getBoundingClientRect?.();
    if (!targetRect) return;

    const left = Math.max(0, Math.round(targetRect.left));
    const top = Math.max(0, Math.round(targetRect.top));
    const width = Math.max(0, Math.round(targetRect.width));
    const height = Math.max(0, Math.round(targetRect.height));

    this.annotationDialog.style.left = `${left}px`;
    this.annotationDialog.style.top = `${top}px`;
    this.annotationDialog.style.width = `${width}px`;
    this.annotationDialog.style.height = `${height}px`;
  },

  openAnnotationDialog() {
    if (!Array.isArray(this.selectedFaces) || this.selectedFaces.length === 0) {
      toastHelper$1("selectFaceRequired", "warning");
      return;
    }

    this.buildAnnotationDialog();
    if (!this.annotationDialog) return;

    const selectedKeys = this.selectedFaces
      .map((entry) => String(entry?.key || "").trim())
      .filter(Boolean);
    this.annotationTargetFaceKeys = selectedKeys;
    const existingGroupIds = Array.from(
      new Set(
        selectedKeys
          .map((key) => this.annotationEntries.find((entry) => entry.key === key)?.groupId || "")
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );
    this.annotationBatchGroupId = existingGroupIds.length === 1
      ? existingGroupIds[0]
      : `anno-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const existingEntries = selectedKeys
      .map((key) => this.annotationEntries.find((entry) => entry.key === key))
      .filter(Boolean);
    const uniqueTitles = Array.from(
      new Set(existingEntries.map((entry) => String(entry.title || "").trim()))
    );
    const uniqueDescriptions = Array.from(
      new Set(existingEntries.map((entry) => String(entry.description || "").trim()))
    );
    this.annotationDialogTitleInput.value = uniqueTitles.length === 1 ? uniqueTitles[0] : "";
    this.annotationDialogDescriptionInput.value =
      uniqueDescriptions.length === 1 ? uniqueDescriptions[0] : "";
    this.updateAnnotationDialogBounds();
    this.annotationDialog.hidden = false;
    this.closeAnnotationPOITooltip();
    this.closeActionMenu();
    this.annotationDialogTitleInput?.focus();
    this.annotationDialogTitleInput?.select();
  },

  openAnnotationDialogWithAutoPicking() {
    if (!this.pickingMode) {
      this.pickingMode = true;
      this.RULER_MODE = false;
      this.updateDistanceMeasurementControllerLabel();
      this.updatePickingModeControllerLabel();
      this.updatePickingControlsVisibility();
      toastHelper$1("featureToggle", "info", {
        feature: "Face picking",
        state: "enabled"
      });
    }

    if (!Array.isArray(this.selectedFaces) || this.selectedFaces.length === 0) {
      toastHelper$1("selectFaceRequiredAgain", "warning");
      return;
    }

    this.openAnnotationDialog();
  },

  closeAnnotationDialog() {
    if (!this.annotationDialog) return;
    this.annotationDialog.hidden = true;
    this.annotationTargetFaceKeys = [];
    this.annotationBatchGroupId = "";
  },

  saveAnnotationFromDialog() {
    if (!Array.isArray(this.annotationTargetFaceKeys) || this.annotationTargetFaceKeys.length === 0) {
      toastHelper$1("noFacesSelected", "warning");
      this.closeAnnotationDialog();
      return;
    }

    const title = String(this.annotationDialogTitleInput?.value || "").trim();
    const description = String(this.annotationDialogDescriptionInput?.value || "").trim();

    if (!title) {
      toastHelper$1("titleRequired", "warning");
      this.annotationDialogTitleInput?.focus();
      return;
    }

    const selectedFaces = this.annotationTargetFaceKeys
      .map((key) => {
        const selected = this.selectedFaces.find((entry) => entry.key === key);
        if (selected) return selected;
        const existingEntry = this.annotationEntries.find((entry) => entry.key === key);
        if (!existingEntry) return null;
        return {
          key: existingEntry.key,
          targetId: existingEntry.targetId || existingEntry.object || "",
          object: existingEntry.object || existingEntry.targetId || "",
          faceIndex: existingEntry.faceIndex,
        };
      })
      .filter(Boolean);
    if (selectedFaces.length === 0) {
      toastHelper$1("facesInactive", "warning");
      this.closeAnnotationDialog();
      return;
    }

    const nowIso = new Date().toISOString();
    const groupId = String(this.annotationBatchGroupId || `anno-group-${Date.now()}`);
    let updatedCount = 0;
    let addedCount = 0;

    selectedFaces.forEach((selectedFace) => {
      const faceNumber = Number(selectedFace.faceIndex);
      const normalizedFaceNumber = Number.isInteger(faceNumber) ? faceNumber : -1;
      const annotationTargetId = selectedFace.targetId || selectedFace.object || "";
      const stableTargetToken = Viewer.toStableIdToken(annotationTargetId);
      const existingIndex = this.annotationEntries.findIndex(
        (entry) => entry.key === selectedFace.key
      );
      if (!annotationTargetId || normalizedFaceNumber < 0) return;

      const annotationPayload = {
        id: existingIndex >= 0
          ? this.annotationEntries[existingIndex].id
          : `anno-${stableTargetToken}-f${normalizedFaceNumber}`,
        groupId,
        key: selectedFace.key,
        object: annotationTargetId,
        targetId: annotationTargetId,
        faceIndex: normalizedFaceNumber,
        faceNumbers: [normalizedFaceNumber],
        target: {
          id: annotationTargetId,
          faces: [normalizedFaceNumber],
        },
        title,
        description,
        updatedAt: nowIso,
      };

      if (existingIndex >= 0) {
        annotationPayload.createdAt = this.annotationEntries[existingIndex].createdAt || nowIso;
        this.annotationEntries.splice(existingIndex, 1, annotationPayload);
        updatedCount += 1;
      } else {
        annotationPayload.createdAt = nowIso;
        this.annotationEntries.push(annotationPayload);
        addedCount += 1;
      }
    });

    const totalChanged = updatedCount + addedCount;
    if (totalChanged > 0) {
      toastHelper$1("annotationsSaved", "success", {
        count: totalChanged,
        plural: totalChanged === 1 ? "" : "s"
      });
    }

    this.refreshAnnotationPOIs();
    this.closeAnnotationDialog();
  },

  getAnnotationEntriesForPersistence() {
    if (!Array.isArray(this.annotationEntries)) return [];

    return this.annotationEntries
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const targetId = String(entry.targetId || entry.object || "").trim();
        const faceNumbersRaw = Array.isArray(entry.faceNumbers)
          ? entry.faceNumbers
          : [entry.faceIndex];
        const faceNumbers = faceNumbersRaw
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0);
        const faceIndex = faceNumbers[0] ?? Number(entry.faceIndex);
        const normalizedFaceIndex = Number.isInteger(faceIndex) && faceIndex >= 0 ? faceIndex : -1;
        if (!targetId || normalizedFaceIndex < 0) return null;

        const key = this.getFaceSelectionKey(targetId, normalizedFaceIndex);
        const fallbackId = `anno-${this.toStableIdToken(targetId)}-f${normalizedFaceIndex}`;

        return {
          id: String(entry.id || fallbackId),
          groupId: entry.groupId ? String(entry.groupId) : "",
          key,
          object: targetId,
          targetId,
          faceIndex: normalizedFaceIndex,
          faceNumbers: faceNumbers.length > 0 ? faceNumbers : [normalizedFaceIndex],
          target: {
            id: targetId,
            faces: faceNumbers.length > 0 ? faceNumbers : [normalizedFaceIndex],
          },
          title: String(entry.title || "").trim(),
          description: String(entry.description || "").trim(),
          createdAt: entry.createdAt ? String(entry.createdAt) : "",
          updatedAt: entry.updatedAt ? String(entry.updatedAt) : "",
        };
      })
      .filter(Boolean);
  },

  exportAnnotationsToIIIFXml() {
    const entries = this.getAnnotationEntriesForPersistence();
    const doc = document.implementation.createDocument("", "", null);
    const root = doc.createElement("iiif:annotations");
    root.setAttribute("xmlns:iiif", "http://iiif.io/api/presentation/3#");
    root.setAttribute("version", "3.0");
    root.setAttribute("generatedAt", new Date().toISOString());
    doc.appendChild(root);

    entries.forEach((entry) => {
      const annotation = doc.createElement("iiif:annotation");
      annotation.setAttribute("id", entry.id);
      annotation.setAttribute("type", "Annotation");
      annotation.setAttribute("motivation", "commenting");
      if (entry.groupId) {
        annotation.setAttribute("groupId", String(entry.groupId));
      }

      const body = doc.createElement("iiif:body");
      body.setAttribute("type", "TextualBody");
      body.setAttribute("format", "text/plain");

      const titleNode = doc.createElement("iiif:title");
      titleNode.textContent = entry.title || "";
      body.appendChild(titleNode);

      const descriptionNode = doc.createElement("iiif:description");
      descriptionNode.textContent = entry.description || "";
      body.appendChild(descriptionNode);
      annotation.appendChild(body);

      const targetNode = doc.createElement("iiif:target");
      targetNode.setAttribute("id", entry.targetId);
      targetNode.setAttribute("faces", entry.faceNumbers.join(","));
      annotation.appendChild(targetNode);

      root.appendChild(annotation);
    });

    return new XMLSerializer().serializeToString(doc);
  },

  downloadAnnotationsXmlFile() {
    const xml = this.exportAnnotationsToIIIFXml();
    if (!xml) {
      toastHelper$1("noAnnotationsToExport", "warning");
      return false;
    }

    const defaultBaseName = core.fileObject?.basename || "annotations";
    const safeBaseName = String(defaultBaseName).replace(/[^a-zA-Z0-9._-]+/g, "_");
    const fileName = `${safeBaseName || "annotations"}-iiif-annotations.xml`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    toastHelper$1("annotationsExported", "success");
    return true;
  },

  ensureAnnotationImportInput() {
    if (this.annotationImportInput) return this.annotationImportInput;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml,text/xml,application/xml";
    input.hidden = true;
    this.bindEventListener(input, "change", async (event) => {
      const target = event?.target;
      const file = target?.files?.[0];
      if (!file) return;

      try {
        const xmlText = await file.text();
        const imported = this.importAnnotationsFromIIIFXml(xmlText);
        if (imported > 0) {
          toastHelper$1("annotationsImported", "success", {
            count: imported,
            plural: imported === 1 ? "" : "s"
          });
        } else {
          toastHelper$1("noValidAnnotations", "warning");
        }
      } catch (error) {
        console.error(error);
        toastHelper$1("annotationsImportError", "error");
      } finally {
        target.value = "";
      }
    });
    document.body.appendChild(input);
    this.annotationImportInput = input;
    return input;
  },

  triggerAnnotationsXmlImport() {
    const input = this.ensureAnnotationImportInput();
    if (!input) return false;
    input.click();
    return true;
  },

  importAnnotationsFromIIIFXml(xmlText) {
    const xml = String(xmlText || "").trim();
    if (!xml) {
      this.annotationEntries = [];
      return 0;
    }

    let doc;
    try {
      doc = new DOMParser().parseFromString(xml, "application/xml");
    } catch (_error) {
      return 0;
    }

    if (!doc || doc.querySelector("parsererror")) {
      return 0;
    }

    const annotations = Array.from(
      doc.querySelectorAll("annotation, iiif\\:annotation")
    );
    const importedEntries = [];

    annotations.forEach((node, index) => {
      const rawId = node.getAttribute("id") || "";
      const rawGroupId = node.getAttribute("groupId") || "";
      const targetNode =
        node.querySelector("target, iiif\\:target") ||
        node.getElementsByTagName("target")[0] ||
        node.getElementsByTagName("iiif:target")[0];
      const targetId = String(targetNode?.getAttribute?.("id") || "").trim();
      const facesAttr = String(targetNode?.getAttribute?.("faces") || "").trim();
      const faceNumbers = facesAttr
        .split(/[,\s;|]+/)
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0);
      const faceIndex = faceNumbers[0];
      if (!targetId || !Number.isInteger(faceIndex)) return;

      const titleNode =
        node.querySelector("title, iiif\\:title, label, iiif\\:label") ||
        node.getElementsByTagName("title")[0] ||
        node.getElementsByTagName("iiif:title")[0];
      const descriptionNode =
        node.querySelector("description, iiif\\:description, value, iiif\\:value") ||
        node.getElementsByTagName("description")[0] ||
        node.getElementsByTagName("iiif:description")[0];

      const key = this.getFaceSelectionKey(targetId, faceIndex);
      importedEntries.push({
        id: rawId || `anno-${this.toStableIdToken(targetId)}-f${faceIndex}-${index}`,
        groupId: rawGroupId ? String(rawGroupId) : "",
        key,
        object: targetId,
        targetId,
        faceIndex,
        faceNumbers: faceNumbers.length > 0 ? faceNumbers : [faceIndex],
        target: {
          id: targetId,
          faces: faceNumbers.length > 0 ? faceNumbers : [faceIndex],
        },
        title: String(titleNode?.textContent || "").trim(),
        description: String(descriptionNode?.textContent || "").trim(),
      });
    });

    this.annotationEntries = importedEntries;
    this.refreshAnnotationPOIs();
    return importedEntries.length;
  },

  hydrateAnnotationsFromMetadataPayload(payload) {
    if (!payload || typeof payload !== "object") {
      this.annotationEntries = [];
      this.refreshAnnotationPOIs();
      return 0;
    }

    const xmlCandidate = payload.iiifAnnotationsXml
      || payload.iiif_annotations_xml
      || payload.annotationsXml
      || payload.annotations_xml
      || "";
    if (typeof xmlCandidate === "string" && xmlCandidate.trim() !== "") {
      return this.importAnnotationsFromIIIFXml(xmlCandidate);
    }

    if (Array.isArray(payload.annotationEntries)) {
      this.annotationEntries = payload.annotationEntries
        .map((entry, index) => {
          const targetId = String(entry?.targetId || entry?.object || entry?.target?.id || "").trim();
          const faceNumbers = Array.isArray(entry?.faceNumbers)
            ? entry.faceNumbers
            : Array.isArray(entry?.target?.faces)
              ? entry.target.faces
              : [entry?.faceIndex];
          const normalizedFaces = faceNumbers
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0);
          const faceIndex = normalizedFaces[0];
          if (!targetId || !Number.isInteger(faceIndex)) return null;
          return {
            id: String(entry?.id || `anno-${this.toStableIdToken(targetId)}-f${faceIndex}-${index}`),
            groupId: entry?.groupId ? String(entry.groupId) : "",
            key: this.getFaceSelectionKey(targetId, faceIndex),
            object: targetId,
            targetId,
            faceIndex,
            faceNumbers: normalizedFaces.length > 0 ? normalizedFaces : [faceIndex],
            target: {
              id: targetId,
              faces: normalizedFaces.length > 0 ? normalizedFaces : [faceIndex],
            },
            title: String(entry?.title || "").trim(),
            description: String(entry?.description || "").trim(),
            createdAt: entry?.createdAt ? String(entry.createdAt) : "",
            updatedAt: entry?.updatedAt ? String(entry.updatedAt) : "",
          };
        })
        .filter(Boolean);
      this.refreshAnnotationPOIs();
      return this.annotationEntries.length;
    }

    this.annotationEntries = [];
    this.refreshAnnotationPOIs();
    return 0;
  },

  extractAnnotationsXmlFromExportDocument(doc) {
    if (!doc) return "";
    const node =
      doc.querySelector("iiif\\:annotations, annotations, iiif_annotations, iiif_annotations_xml") ||
      doc.getElementsByTagName("iiif:annotations")[0] ||
      doc.getElementsByTagName("annotations")[0] ||
      doc.getElementsByTagName("iiif_annotations")[0] ||
      doc.getElementsByTagName("iiif_annotations_xml")[0];
    if (!node) return "";

    if (node.tagName === "iiif_annotations_xml") {
      return String(node.textContent || "").trim();
    }

    try {
      return new XMLSerializer().serializeToString(node);
    } catch (_error) {
      return "";
    }
  },

  applyPendingAnnotationsIfAny() {
    const pendingXml = String(this.pendingAnnotationsXml || "").trim();
    if (!pendingXml) return 0;
    const imported = this.importAnnotationsFromIIIFXml(pendingXml);
    this.pendingAnnotationsXml = "";
    return imported;
  },

  clearSelectedFaces() {
    if (!Array.isArray(Viewer.selectedFaces) || Viewer.selectedFaces.length === 0) {
      Viewer.updateSelectedFacesCount();
      return;
    }

    Viewer.selectedFaces.forEach((entry) => {
      Viewer.disposeFaceOverlay(entry);
    });
    Viewer.selectedFaces.length = 0;
    Viewer.updateSelectedFacesCount();
  },

  restoreLastPickedFace() {
    if (!Viewer.lastPickedFace.overlay) {
      Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
      return;
    }

    Viewer.disposeFaceOverlay(Viewer.lastPickedFace);

    Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
  },

  pickFaces(_id) {
    const hoveredObjectId = _id?.object?.id ?? "";
    const hoveredFaceIndex = _id?.faceIndex ?? null;
    if (!hoveredObjectId) {
      Viewer.restoreLastPickedFace();
      return;
    }

    if (
      Viewer.lastPickedFace.object === hoveredObjectId &&
      Viewer.lastPickedFace.faceIndex === hoveredFaceIndex
    ) {
      return;
    }

    Viewer.restoreLastPickedFace();
    const overlay = Viewer.createPickingFaceOverlay(_id, {
      fillColor: 0xff3b30,
      lineColor: 0xffffff,
      opacity: 0.4,
    });
    if (!overlay) return;

    Viewer.lastPickedFace = {
      id: hoveredObjectId,
      object: hoveredObjectId,
      faceIndex: hoveredFaceIndex,
      overlay,
    };

    _id.object.add(overlay);
  },

  toggleSelectedFace(intersection, options = {}) {
    const targetId = Viewer.resolveFaceTargetId(intersection?.object);
    const runtimeObjectId = intersection?.object?.id ?? "";
    const faceIndex = intersection?.faceIndex ?? null;
    if (!targetId || faceIndex === null) return;

    const multiSelect = options.multiSelect === true;
    const selectedFaceIndex = Viewer.findSelectedFaceIndex(targetId, faceIndex);

    if (!multiSelect) {
      const clickedFaceKey = Viewer.getFaceSelectionKey(targetId, faceIndex);
      const clickedFaceAlreadySelected =
        selectedFaceIndex >= 0 && Viewer.selectedFaces.length === 1 &&
        Viewer.selectedFaces[0]?.key === clickedFaceKey;

      Viewer.clearSelectedFaces();

      if (clickedFaceAlreadySelected) {
        return;
      }
    }

    if (selectedFaceIndex >= 0) {
      const [selectedFace] = Viewer.selectedFaces.splice(selectedFaceIndex, 1);
      Viewer.disposeFaceOverlay(selectedFace);
      Viewer.updateSelectedFacesCount();
      return;
    }

    const overlay = Viewer.createPickingFaceOverlay(intersection, {
      fillColor: 0x00c853,
      lineColor: 0xe8ffe8,
      opacity: 0.5,
    });
    if (!overlay) return;

    intersection.object.add(overlay);
    Viewer.selectedFaces.push({
      key: Viewer.getFaceSelectionKey(targetId, faceIndex),
      targetId,
      object: targetId,
      runtimeObjectId,
      faceIndex,
      overlay,
    });
    Viewer.updateSelectedFacesCount();
  },

  buildRuler(_id) {
    Viewer.rulerObject = new THREE.Object3D();
    const gridSize = Viewer.gridSize || core.gridSize || 1;
    const sphereRadius = Math.max(gridSize / 150, 0.001);
    const textScale = Math.max(gridSize / 100, 0.01);
    const measureSize = Math.max(gridSize / 200, 0.01);

    var sphere = new THREE.Mesh(
      new THREE.SphereGeometry(sphereRadius, 7, 7),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
    );
    var newPoint = new THREE.Vector3(_id.point.x, _id.point.y, _id.point.z);
    sphere.position.set(newPoint.x, newPoint.y, newPoint.z);
    Viewer.rulerObject.add(sphere);
    Viewer.linePoints.push(newPoint);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(Viewer.linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    Viewer.rulerObject.add(line);
    var lineMtr = new THREE.LineBasicMaterial({
      color: 0x0000ff,
      linewidth: 3,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    if (Viewer.linePoints.length > 1) {
      var vectorPoints = vectorBetweenPoints(
        Viewer.linePoints[Viewer.linePoints.length - 2],
        newPoint
      );
      var distancePoints = distanceBetweenPointsVector(vectorPoints);
      const measuredDistance = Viewer.formatMeasuredDistance(distancePoints);

      //var distancePoints = distanceBetweenPoints(Viewer.linePoints[Viewer.linePoints.length-2], newPoint);
      var halfwayPoints = halfwayBetweenPoints(
        Viewer.linePoints[Viewer.linePoints.length - 2],
        newPoint
      );
      Viewer.addTextPoint(measuredDistance.text, textScale, halfwayPoints);
      var rulerI = 0;
      // `measureSize` was already precomputed outside, keep same scale
      while (rulerI <= distancePoints * 100) {
        const geoSegm = [];
        var interpolatePoints = interpolateDistanceBetweenPoints(
          Viewer.linePoints[Viewer.linePoints.length - 2],
          vectorPoints,
          distancePoints,
          rulerI / 100
        );
        geoSegm.push(
          new THREE.Vector3(
            interpolatePoints.x,
            interpolatePoints.y,
            interpolatePoints.z
          )
        );
        geoSegm.push(
          new THREE.Vector3(
            interpolatePoints.x + measureSize,
            interpolatePoints.y + measureSize,
            interpolatePoints.z + measureSize
          )
        );
        const geometryLine = new THREE.BufferGeometry().setFromPoints(geoSegm);
        var lineSegm = new THREE.Line(geometryLine, lineMtr);
        Viewer.rulerObject.add(lineSegm);
        rulerI += 10;
      }
    }
    Viewer.rulerObject.renderOrder = 10;
    core.scene.add(Viewer.rulerObject);
    Viewer.ruler.push(Viewer.rulerObject);
  },


  updateSize() {
    const isFullscreen = !!document.fullscreenElement;
    Viewer.FULLSCREEN = isFullscreen;

    if (!Viewer.mainCanvas || !Viewer.fullscreenMode || !core.guiContainer) {
      return;
    }

    let widthCSS, heightCSS;  // CSS pixels (layout)
    let widthDev, heightDev;  // Device pixels (Three.js)
    let scale = {x: 1, y: 1};
    let rect = {width: 1, height: 1};

    if (isFullscreen) {
        widthCSS = window.innerWidth;
        heightCSS = window.innerHeight;
        widthDev = widthCSS * devicePixelRatio;
        heightDev = heightCSS * devicePixelRatio;

        Viewer.mainCanvas.style.width = '100vw';
        Viewer.mainCanvas.style.height = '100vh';
    } else {
      scale = {x: Number(core.CONFIG.viewer.scaleContainer?.x || 1), y: Number(core.CONFIG.viewer.scaleContainer?.y || 1)};
      const wrapper = Viewer.viewerWrapper || core.container;
      if (!wrapper) {
        return;
      }
      rect = wrapper.getBoundingClientRect();
      widthCSS = (rect.width * scale.x) || 800;
      heightCSS = (rect.height * scale.y) || 600;

      widthDev = widthCSS * devicePixelRatio;
      heightDev = heightCSS * devicePixelRatio;
      Viewer.mainCanvas.style.width = widthCSS + 'px';
      Viewer.mainCanvas.style.height = heightCSS + 'px';

      core.metadataContainer.style.width = '100%';
      core.metadataContainer.style.height = '100%';

      if (Viewer.fileElement && Viewer.fileElement.length > 0) {
        Viewer.fileElement[0].style.height = (heightCSS * 1.1) + 'px';
      }
    }

    if (!core.guiContainer.hidden) {
      const guiWidth =
        core.lilGui?.[0]?.getBoundingClientRect().width ||
        core.guiContainer.getBoundingClientRect().width;
      if (guiWidth > 0) {
        core.guiContainer.style.left = (widthCSS - guiWidth) + 'px';
      }
    }

    Viewer.mainCanvas.width = widthDev;
    Viewer.mainCanvas.height = heightDev;

    if (Viewer.actionMenu) {
      if (Viewer.actionMenu.classList.contains("viewer-action-menu_in-toolbar")) {
        Viewer.actionMenu.style.top = "";
        Viewer.actionMenu.style.right = "";
        Viewer.actionMenu.style.bottom = "";
      } else {
        const menuMargin = 16;
        const toggleSize = Viewer.actionMenu.querySelector(".viewer-action-menu_toggle")?.getBoundingClientRect().height || 45;
        Viewer.actionMenu.style.top = (heightCSS - toggleSize - menuMargin) + "px";
        Viewer.actionMenu.style.right = menuMargin + "px";
        Viewer.actionMenu.style.bottom = "auto";
      }
    }

    if (core.handHint)
    core.handHint.style.top = (heightCSS - 70) + 'px';
   
    core.renderer.setPixelRatio(devicePixelRatio * scale.x);
    core.renderer.setSize(widthCSS*scale.x, heightCSS*scale.y, false);
    core.camera.aspect = widthCSS / heightCSS;
    core.camera.updateProjectionMatrix();
    core.controls?.update();
    core.CONFIG.viewer.canvasDimensions = { x: widthCSS, y: heightCSS };
  },

    // Three.js renderer needs actual pixel size

  async toggleFullscreen() {
    Viewer.closeActionMenu();
    try {
      if (!document.fullscreenElement) {
        await core.container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      Viewer.reportError(err, {
        context: "Fullscreen error",
        toast: false,
        e2e: false,
      });
    }
  },

  onFullscreenChange () {
    Viewer.updateFullscreenButtonIcon();
    Viewer.closeActionMenu();

    // Layout (ESC + click)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Viewer.updateSize();
      });
    });
  },

  exitFullscreenHandler() {
    var fullscreenElement =
      document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement;
    var fullscreenElement2 =
      document.webkitIsFullScreen &&
      document.mozFullScreen &&
      document.msFullscreenElement;
    if (
      !fullscreenElement &&
      typeof (fullscreenElement2 === undefined) &&
      Viewer.FULLSCREEN
    ) {
      fullscreen();
    }
  },

  updateHandAnimation: (time) => {
    const g = core.GESTURE;
    if (!g) return;
  
    if (!g.active || !g.baseAngle || !g.target) return;

    const t = (time - g.startTime) / 1000;
    const s = Math.sin((t / core.GESTURE.period) * Math.PI * 2);

    // EASE-IN (smoothstep)
    const ei = Math.min(t / g.easeInTime, 1);
    const ease = ei * ei * (3 - 2 * ei); // smoothstep(0..1)

    // hand icon
    core.handHint?.style.setProperty(
      '--hand-x',
      `${s * core.GESTURE.handPx}px`
    );

    // camera - orbit
    const sph = g.baseAngle.clone();
    sph.theta = g.baseAngle.theta + s * core.GESTURE.orbitAngle * ease;


    core.camera.position
      .setFromSpherical(sph)
      .add(g.target);

    core.camera.lookAt(g.target);
  },

  startGesture: (time) => {
    const g = core.GESTURE;
    if (!g) return;
    if (g.active) return;

    g.rotate = true;
    g.startTime = time;
    g.active = true;

    g.target = core.controls.target.clone();

    g.baseAngle = new THREE.Spherical().setFromVector3(
      core.camera.position.clone().sub(g.target)
    );

    core.controls.enabled = false;
  },

  stopGesture: () => {
    if (!core.handHint) return;
    const g = core.GESTURE;
    if (!g) return;
    if (!g.active) return;
    g.rotate = false;
    g.active = false;

    core.controls.target.copy(g.target);

    core.controls.object.position.copy(core.camera.position);
    core.controls.update();
    core.controls.enabled = true;

    g.baseAngle = null;
    g.target = null;
    core.handHint.hidden = true;
    core.GESTURE.active = false;
  },

  animate: (time) => {
    requestAnimationFrame(Viewer.animate);
    const delta = Viewer.clock.getDelta();

    if (!core.PRESENTATION_MODE) {

      // =========================
      // GESTURE LIFECYCLE
      // =========================
      const canGesture =
        !window.__E2E__ &&
        !core.handHint?.hidden;

      if (canGesture && core.GESTURE?.rotate && !core.GESTURE?.active ) {
        Viewer.startGesture(time);
      }

      if (core.GESTURE?.active && (!core.GESTURE?.rotate || !canGesture)) {
        Viewer.stopGesture();
      }

      // =========================
      // GESTURE UPDATE
      // =========================
      Viewer.updateHandAnimation(time);

      core.controls?.update();

      if (Viewer.textMesh !== null) {
        Viewer.textMesh.lookAt(core.camera.position);
      }

      if (Viewer.ruler?.length) {
        Viewer.ruler.forEach((rulerObject) => {
          rulerObject?.traverse?.((child) => {
            if (child?.userData?.isDistanceLabel === true) {
              child.lookAt(core.camera.position);
            }
          });
        });
      }
      Viewer.updateAnnotationPOITooltipPosition();
    }
    if (!core.GESTURE?.active || core.PRESENTATION_MODE) {
      core.controls?.update();
    }

    if ((core.PRESENTATION_MODE ||core.handHint?.hidden) && !core.GESTURE?.active) {
      core.cameraTween?.update(time);
      core.targetTween?.update(time);
    }

    // =========================
    // LOOP UPDATE
    // =========================
    
    if (Viewer.mixer) {
      Viewer.mixer.update(delta);
    }

    core.renderer?.clear();
    core.renderer?.render(core.scene, core.camera);
    core.stats?.update();
  },

  onPointerDown(e) {
    Viewer.disableInteractionHint();
    e.stopPropagation();
    if (e.button === 0) {
      Viewer.onDownPosition.x =
        ((e.clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
          core.renderer.domElement.clientWidth) *
        2 -
        1;
      Viewer.onDownPosition.y =
        -(
          (e.clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
          core.renderer.domElement.clientHeight
        ) *
        2 +
        1;
    }
  },

  onPointerUp(e) {
    if (e.button == 0) {
      Viewer.onUpPosition.x =
        ((e.clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
          core.renderer.domElement.clientWidth) *
        2 -
        1;
      Viewer.onUpPosition.y =
        -(
          (e.clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
          core.renderer.domElement.clientHeight
        ) *
        2 +
        1;
      if (
        Viewer.onUpPosition.x === Viewer.onDownPosition.x &&
        Viewer.onUpPosition.y === Viewer.onDownPosition.y
      ) {
        Viewer.raycaster.setFromCamera(Viewer.onUpPosition, core.camera);
        if (!Viewer.pickingMode && !Viewer.RULER_MODE) {
          const poiIntersects = Viewer.raycaster.intersectObjects(
            Viewer.annotationPOIMarkers || [],
            true
          );
          const poiHit = poiIntersects.find(
            (entry) => entry?.object?.userData?.isAnnotationPOI === true
          );
          if (poiHit?.object) {
            Viewer.openAnnotationDialogFromPOIMarker(poiHit.object);
            return;
          }
          Viewer.closeAnnotationPOITooltip();
        }

        let intersects = [];
        let primaryIntersection = null;

        if (Viewer.pickingMode || Viewer.RULER_MODE) {
          if (core.mainObject.length > 1) {
            for (let ii = 0; ii < core.mainObject.length; ii++) {
              intersects.push(
                ...Viewer.raycaster.intersectObjects(
                  core.mainObject[ii].children,
                  true
                )
              );
            }
            if (intersects.length <= 0) {
              intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
            }
          } else {
            intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
          }
          primaryIntersection = Viewer.getPrimaryIntersection(intersects);
          if (primaryIntersection) {
            if (Viewer.RULER_MODE) Viewer.buildRuler(primaryIntersection);
            else if (Viewer.pickingMode) {
              Viewer.toggleSelectedFace(primaryIntersection, {
                multiSelect: e.shiftKey,
              });
            }
          }
        }
      }
    }
  },

  onPointerMove(e) {
    Viewer.pointer.x =
      ((e.clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
        core.renderer.domElement.clientWidth) *
      2 -
      1;
    Viewer.pointer.y =
      -(
        (e.clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
        core.renderer.domElement.clientHeight
      ) *
      2 +
      1;
    if (e.buttons !== 0) {
      Viewer.disableInteractionHint();
      Viewer.closeAnnotationPOITooltip();
    }
    if (e.buttons == 1) {
      if (Viewer.pointer.x !== Viewer.onDownPosition.x && Viewer.pointer.y !== Viewer.onDownPosition.y) {
        Viewer.cameraLight.position.set(
          core.camera.position.x,
          core.camera.position.y,
          core.camera.position.z
        );
      }
    } else {
      if (!Viewer.pickingMode && !Viewer.RULER_MODE) {
        if (Viewer.annotationDialog && Viewer.annotationDialog.hidden === false) {
          Viewer.closeAnnotationPOITooltip();
        } else {
          Viewer.raycaster.setFromCamera(Viewer.pointer, core.camera);
          const poiIntersects = Viewer.raycaster.intersectObjects(
            Viewer.annotationPOIMarkers || [],
            true
          );
          const poiHit = poiIntersects.find(
            (entry) => entry?.object?.userData?.isAnnotationPOI === true
          );
          if (poiHit?.object) {
            Viewer.openAnnotationPOITooltip(poiHit.object);
          } else {
            Viewer.closeAnnotationPOITooltip();
          }
        }
      }
      if (Viewer.pickingMode) {
        Viewer.raycaster.setFromCamera(Viewer.pointer, core.camera);
        let intersects = [];
        if (core.mainObject.length > 1) {
          for (let ii = 0; ii < core.mainObject.length; ii++) {
            intersects.push(
              ...Viewer.raycaster.intersectObjects(
                core.mainObject[ii].children,
                true
              )
            );
          }
          if (intersects.length <= 0) {
            intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
          }
        } else {
          intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
        }
        const primaryIntersection = Viewer.getPrimaryIntersection(intersects);
        if (primaryIntersection) {
          Viewer.pickFaces(primaryIntersection);
        } else {
          Viewer.pickFaces("");
        }
      }
    }
  },

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  },

  showSandboxGuiAfterModelLoad() {
    if (!core.guiContainer) return;

    core.guiContainer.hidden = false;
    core.lilGui = document.getElementsByClassName("lil-gui root");

    const updateAfterLayout = () => {
      Viewer.updateSize();
      requestAnimationFrame(() => Viewer.updateSize());
    };

    requestAnimationFrame(updateAfterLayout);
  },

  async onDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (Viewer.SUPPORTED_EXTENSIONS.includes(extension)) {
        // Clear existing model
        if (core.mainObject.length > 0) {
          core.mainObject.forEach(obj => {
            core.scene.remove(obj);
          });
          core.mainObject = [];
        }
        
        // Set up fileObject for the dropped file
        const url = URL.createObjectURL(file);
        core.fileObject.originalPath = url;
        core.fileObject.filename = url;  // Use URL as filename for blob
        core.fileObject.basename = file.name.substring(0, file.name.lastIndexOf('.'));
        core.fileObject.extension = extension;
        core.fileObject.path = '';  // No path for blob URLs
        core.fileObject.uri = url;
        core.fileObject.relativePath = url;
        
        Viewer._ext = extension;
        
        setCore('fileObject', core.fileObject);
        
        // Clear autoPath to prevent overriding with server URL
        core.autoPath = '';
        
        // Load the model
        await Viewer.mainLoadModel();
        if (core.SANDBOX_MODE) {
          Viewer.showSandboxGuiAfterModelLoad();
          Viewer.dismissStatusNotice("sandbox-drop-model");
        }        
        toastHelper$1("modelLoadedSimple", "success");
      } else {
        toastHelper$1("unsupportedFormat", "error");
      }
    }
  },

  async changeScale() {
    if (core.transformControl.getMode() === "scale") {
      switch (core.transformControl.axis) {
        case "X":
        case "XY":
          core.helperObjects[0].scale.set(
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x
          );
          break;
        case "Y":
        case "YZ":
          core.helperObjects[0].scale.set(
            core.helperObjects[0].scale.y,
            core.helperObjects[0].scale.y,
            core.helperObjects[0].scale.y
          );
          break;
        case "Z":
        case "XZ":
          core.helperObjects[0].scale.set(
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x
          );
          break;
      }
    }
  },

  syncOutlineClippingTransform() {
    const outline = core.outlineClipping;
    const object = core.helperObjects?.[0];
    if (!outline || !object) return;
    outline.position.copy(object.position);
    outline.quaternion.copy(object.quaternion);
    outline.scale.copy(object.scale);
    outline.updateMatrixWorld(true);
  },

  async calculateObjectScale() {
    if (core.renderer) {
      core.renderer.localClippingEnabled = true;
    }
    Viewer.syncOutlineClippingTransform();
    const boundingBox = new THREE.Box3();
    if (Array.isArray(core.helperObjects[0])) {
      for (let i = 0; i < core.helperObjects[0].length; i++) {
        const box = new THREE.Box3().setFromObject(core.helperObjects[0][i], true);
        boundingBox.union(box);
      }
    } else {
      boundingBox.setFromObject(core.helperObjects[0], true);
    }

    if (boundingBox.isEmpty()) return;

    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const _distance = new THREE.Vector3(
      Math.max(Math.abs(boundingBox.max.x), Math.abs(boundingBox.min.x)),
      Math.max(Math.abs(boundingBox.max.y), Math.abs(boundingBox.min.y)),
      Math.max(Math.abs(boundingBox.max.z), Math.abs(boundingBox.min.z))
    );

    Viewer.distanceGeometry = _distance;
    setCore("distanceGeometry", Viewer.distanceGeometry);

    if (core.clippingPlanes?.length >= 3) {
      core.clippingPlanes[0].constant = _distance.x;
      core.clippingPlanes[1].constant = _distance.y;
      core.clippingPlanes[2].constant = _distance.z;
    }

    Viewer.planeParams.planeX.constantX = _distance.x;
    Viewer.planeParams.planeY.constantY = _distance.y;
    Viewer.planeParams.planeZ.constantZ = _distance.z;

    if (core.clippingFolder?.controllers?.[1]) {
      core.clippingFolder.controllers[1]._max = _distance.x;
      core.clippingFolder.controllers[1]._min = -_distance.x;
      core.clippingFolder.controllers[1].setValue(_distance.x);
      core.clippingFolder.controllers[1].updateDisplay();
    }
    if (core.clippingFolder?.controllers?.[3]) {
      core.clippingFolder.controllers[3]._max = _distance.y;
      core.clippingFolder.controllers[3]._min = -_distance.y;
      core.clippingFolder.controllers[3].setValue(_distance.y);
      core.clippingFolder.controllers[3].updateDisplay();
    }
    if (core.clippingFolder?.controllers?.[5]) {
      core.clippingFolder.controllers[5]._max = _distance.z;
      core.clippingFolder.controllers[5]._min = -_distance.z;
      core.clippingFolder.controllers[5].setValue(_distance.z);
      core.clippingFolder.controllers[5].updateDisplay();
    }

    if (Viewer.planeHelpers?.length >= 3 && core.clippingPlanes?.length >= 3) {
      for (let i = 0; i < 3; i++) {
        const helper = Viewer.planeHelpers[i];
        const plane = core.clippingPlanes[i];
        if (!helper || !plane) continue;
        helper.position.copy(plane.normal).multiplyScalar(-plane.constant);
        if (i === 0 || i === 2) {
          helper.userData.clippingCenterY = center.y;
          helper.updateMatrixWorld(true);
        }
      }
    }

    var _maxDistance = Math.max(_distance.x, _distance.y, _distance.z);
    Viewer.planeHelpers?.forEach(h => h && (h.size = _maxDistance));
  },

  changeLightRotation() {
    core.lightHelper.update();
  },

  takeScreenshot() {
    /*const messDiv = document.createElement('div');
    messDiv.classList.add('message');
    document.body.appendChild(messDiv);*/
    core.camera.aspect = 1;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(256, 256);
    core.renderer.render(core.scene, core.camera);
    if (core.fileObject.archiveType !== "") {
      core.fileObject.basename + "_" + core.fileObject.archiveType.toUpperCase() + "/";
    }

    Viewer.mainCanvas.toBlob((imgBlob) => {
      if (!imgBlob) {
        console.error("Failed to capture screenshot");
        return;
      }

      if (!(imgBlob instanceof Blob) || imgBlob.size === 0) {
        console.error("Invalid blob data");
        return;
      }

      if (!["image/png", "image/jpeg"].includes(imgBlob.type)) {
        console.error("Invalid blob type:", imgBlob.type);
        return;
      }
      const fileform = new FormData();
      fileform.append("path", core.fileObject.path);
      fileform.append("filename", core.fileObject.basename);
      //fileform.append("path", uri + prependName);
      fileform.append("data", imgBlob, "thumbnail.png");
      console.log("Uploading thumbnail for entity ID:", core.CONFIG.entity.id);
      fileform.append("wisski_individual", core.CONFIG.entity.id);
      fetch(core.CONFIG.mainUrl + "/api/editor/upload-thumbnail", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CSRF-Token": window.CSRF_TOKEN
        },
        body: fileform
      })
      .then(async (res) => {
        //console.log("HTTP STATUS:", res.status);
        const text = await res.text();
        //console.log("RAW RESPONSE:", text);
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error || "Upload failed");
        return data;
      });
    }, "image/png");

    core.renderer.setPixelRatio(devicePixelRatio);
    core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);
  },

  async mainLoadModelWrapper() {
    if (core.autoPath !== '') {
      core.autoPath = Viewer.normalizeFileUrl(core.autoPath);
      core.autoPath = Viewer.normalizeArchiveModelPath(core.autoPath);
      core.fileObject.filename = core.autoPath.split('/').pop();
      core.fileObject.basename =
        core.fileObject.filename.substring(
          0,
          core.fileObject.filename.lastIndexOf('.')
        );
      core.fileObject.extension =
        core.fileObject.filename.substring(
          core.fileObject.filename.lastIndexOf('.') + 1
        );
      Viewer._ext = core.fileObject.extension.toLowerCase();
      core.fileObject.path =
        core.autoPath.substring(0, core.autoPath.lastIndexOf(core.fileObject.filename));
    }

    await Viewer.mainLoadModel();
    Viewer.applyPendingAnnotationsIfAny();
  },

  async mainLoadModel() {
    console.log("Loading model:", core.fileObject.basename, ", with extension:", core.fileObject.extension);
    if (Viewer._ext === "glb" || Viewer._ext === "gltf") {
      await loadModel();
    } else if (
      Viewer._ext === "zip" ||
      Viewer._ext === "rar" ||
      Viewer._ext === "tar" ||
      Viewer._ext === "xz" ||
      Viewer._ext === "gz"
    ) {
      core.loadedFile = "_" + Viewer._ext.toUpperCase() + "/";
      core.fileObject.path = core.fileObject.path + core.fileObject.basename + core.loadedFile;
      core.fileObject.extension = "glb";
      core.fileObject.newExtension = Viewer._ext;
      await loadModel();
    } else {
      //core.fileObject.extension = "glb";
      if (Viewer._ext === "glb") {
        await loadModel();
      }
      else await loadModel();
    }

    this.applyCameraOverridesFromUrl();
  },

  prepareSandboxScene() {
    if (core.mainObject?.length) {
      core.mainObject.forEach((obj) => Viewer.removeAndDisposeFromScene(obj));
      core.mainObject.length = 0;
    }

    if (core.loadingLog) {
      core.loadingLog.finish?.();
    }
    if (core.circle) {
      core.circle.set?.(0, 100);
      core.circle.complete();
    }

    if (core.mainCanvas && core.CONFIG?.viewer?.background) {
      core.mainCanvas.style.setProperty("background", core.CONFIG.viewer.background);
    }

    core.camera?.position.set(0, 60, 180);
    core.controls?.target.set(0, 0, 0);
    core.controls?.update();
    this.applyCameraOverridesFromUrl();

    if (window.viewer) {
      window.viewer.modelLoaded = false;
    }

    toastHelper$1("sandboxDropModel", "info", {
      formats: this.getSupportedFormatsText(),
      detailI18nKey: "toasts.supportedFormats",
      key: "sandbox-drop-model",
      replace: true,
      persistent: true,
      variant: "sandbox",
    });
  },

  applyCameraOverridesFromUrl() {
    if (!core.camera) return;

    const cameraPosition = this.urlOptions?.cameraPosition;
    const cameraTarget = this.urlOptions?.cameraTarget;
    const cameraFov = this.urlOptions?.cameraFov;
    const hasPosition = cameraPosition && Number.isFinite(cameraPosition.x) && Number.isFinite(cameraPosition.y) && Number.isFinite(cameraPosition.z);
    const hasTarget = cameraTarget && Number.isFinite(cameraTarget.x) && Number.isFinite(cameraTarget.y) && Number.isFinite(cameraTarget.z);
    const hasFov = Number.isFinite(cameraFov);
    if (!hasPosition && !hasTarget && !hasFov) return;

    if (hasPosition) {
      core.camera.position.copy(cameraPosition);
      core.cameraLight?.position.copy(cameraPosition);
    }
    if (hasTarget) {
      core.controls?.target.copy(cameraTarget);
      core.camera.lookAt(cameraTarget);
    }
    if (hasFov) {
      const normalizedFov = Math.min(179, Math.max(1, Number(cameraFov)));
      core.camera.fov = normalizedFov;
      if (this.embedConfigInputs?.fov && this.embedConfigInputs.fov.value === "") {
        this.embedConfigInputs.fov.value = String(normalizedFov);
      }
    }

    core.camera.updateProjectionMatrix();
    core.controls?.update();
  },

  createClippingPlaneAxis(_number, axis = "z") {
    var tempClippingControl = new TransformControls(core.camera, core.renderer.domElement);
    tempClippingControl.space = "world";
    tempClippingControl.setMode("translate");
    tempClippingControl.showX = axis === "x";
    tempClippingControl.showY = axis === "y";
    tempClippingControl.showZ = axis === "z";
    tempClippingControl.addEventListener("change", Viewer.render);
    tempClippingControl.addEventListener("objectChange", function (event) {
      if (event.target === undefined || event.target.object === undefined) {
        return;
      }
      let newConstant;
      switch (_number) {
        case 0:
          newConstant = event.target.worldPositionStart.x + event.target.pointEnd.x;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeX.constantX = newConstant;
          if (core.clippingFolder.controllers[1]) {
            core.clippingFolder.controllers[1].setValue(newConstant);
          }
          core.planeHelpers[0].position.copy(core.clippingPlanes[0].normal).multiplyScalar(-newConstant);
          break;
        case 1:
          newConstant = event.target.worldPositionStart.y + event.target.pointEnd.y;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeY.constantY = newConstant;
          if (core.clippingFolder.controllers[3]) {
            core.clippingFolder.controllers[3].setValue(newConstant);
          }
          core.planeHelpers[1].position.copy(core.clippingPlanes[1].normal).multiplyScalar(-newConstant);
          break;
        case 2:
          newConstant = event.target.worldPositionStart.z + event.target.pointEnd.z;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeZ.constantZ = newConstant;
          if (core.clippingFolder.controllers[5]) {
            core.clippingFolder.controllers[5].setValue(newConstant);
          }
          core.planeHelpers[2].position.copy(core.clippingPlanes[2].normal).multiplyScalar(-newConstant);
          break;
      }
    });
    tempClippingControl.addEventListener("dragging-changed", function (event) {
      core.controls.enabled = !event.value;
    });
    return tempClippingControl;
  },

  resetCamera() {
    const targetCamera = core.cameraCoords || core.camera.position.clone();
    const targetControls =
      core.controlsTarget ||
      core.controls?.target?.clone() ||
      new THREE.Vector3();

    if (!targetCamera || typeof targetCamera.x !== 'number') {
      return;
    }

    const startCam = core.camera.position.clone();
    const startTarget = core.controls?.target?.clone() || new THREE.Vector3();
    //const targetDistance = startTarget.distanceTo(targetControls);
    const startDir = startTarget.clone().sub(startCam).normalize();
    const endDir = targetControls.clone().sub(targetCamera).normalize();

    const angle = startDir.angleTo(endDir);
    const rotationFactor = 2.0;
    const rotationDistance = angle * rotationFactor;

    const linearDistance = Math.max(
      startCam.distanceTo(targetCamera),
      startTarget.distanceTo(targetControls)
    );

    const distance = Math.max(linearDistance, rotationDistance);

    const speed = 1.25;
    const duration = THREE.MathUtils.clamp((distance / speed) * 1000, 300, 3000);

    core.cameraTween = new exports$1.Tween(startCam)
      .to(targetCamera, duration)
      .easing(exports$1.Easing.Cubic.Out)
      .onUpdate(() => {
        core.camera.position.copy(startCam);
        core.cameraLight.position.copy(startCam);
        core.camera.updateProjectionMatrix();
      });

    core.targetTween = new exports$1.Tween(startTarget)
      .to(targetControls, duration)
      .easing(exports$1.Easing.Cubic.Out)
      .onUpdate(() => {
        core.controls?.target.copy(startTarget);
        core.controls?.update();
      });

    core.cameraTween.onComplete(() => {
      core.camera.position.copy(targetCamera);
      core.cameraLight.position.copy(targetCamera);
      core.controls?.target.copy(targetControls);
      core.controls?.update();
      core.camera.updateProjectionMatrix();
    });

    core.cameraTween.start();
    core.targetTween.start();
  },

  pick(save, current, original) {
    return save ? current : original;
  },

  buildMetadata(Viewer, rotateMetadata) {
    const O = Viewer.originalMetadata;
    const S = Viewer.saveProperties;

    const M = {};

    // --- OBJECT ---
    M.objPosition = Viewer.pick(
      S.Position,
      [
        core.helperObjects[0].position.x,
        core.helperObjects[0].position.y,
        core.helperObjects[0].position.z
      ],
      O.objPosition
    );

    M.objRotation = Viewer.pick(
      S.Rotation,
      [rotateMetadata.x, rotateMetadata.y, rotateMetadata.z],
      O.objRotation
    );

    M.objScale = Viewer.pick(
      S.Scale,
      [
        core.helperObjects[0].scale.x,
        core.helperObjects[0].scale.y,
        core.helperObjects[0].scale.z
      ],
      O.objScale
    );

    // --- CAMERA ---
    M.cameraPosition = Viewer.pick(
      S.Camera,
      [
        core.camera.position.x,
        core.camera.position.y,
        core.camera.position.z
      ],
      O.cameraPosition
    );

    M.controlsTarget = Viewer.pick(
      S.Camera,
      [
        core.controls.target.x,
        core.controls.target.y,
        core.controls.target.z
      ],
      O.controlsTarget
    );

    M.controlsZoom = Viewer.pick(
      S.Camera,
      [
        core.camera.position.distanceTo(core.controls.target)
      ],
      O.controlsZoom
    );

    // --- DIRECTIONAL LIGHT ---
    M.lightPosition = Viewer.pick(
      S.DirectionalLight,
      [
        core.dirLight.position.x,
        core.dirLight.position.y,
        core.dirLight.position.z
      ],
      O.lightPosition
    );

    M.lightTarget = Viewer.pick(
      S.DirectionalLight,
      [
        core.dirLight.rotation._x,
        core.dirLight.rotation._y,
        core.dirLight.rotation._z
      ],
      O.lightTarget
    );

    M.lightColor = Viewer.pick(
      S.DirectionalLight,
      ["#" + core.dirLight.color.getHexString().toUpperCase()],
      O.lightColor
    );

    M.lightIntensity = Viewer.pick(
      S.DirectionalLight,
      [core.dirLight.intensity],
      O.lightIntensity
    );

    // --- AMBIENT LIGHT ---
    M.lightAmbientColor = Viewer.pick(
      S.AmbientLight,
      ["#" + core.ambientLight.color.getHexString().toUpperCase()],
      O.lightAmbientColor
    );

    M.lightAmbientIntensity = Viewer.pick(
      S.AmbientLight,
      [core.ambientLight.intensity],
      O.lightAmbientIntensity
    );

    // --- CAMERA LIGHT ---
    M.lightCameraColor = Viewer.pick(
      S.CameraLight,
      ["#" + core.cameraLight.color.getHexString().toUpperCase()],
      O.lightCameraColor
    );

    M.lightCameraIntensity = Viewer.pick(
      S.CameraLight,
      [core.cameraLight.intensity],
      O.lightCameraIntensity
    );

    // --- BACKGROUND ---
    if (S.BackgroundColor) {
      M.background = [
        window.getComputedStyle(Viewer.mainCanvas).background
      ];
    } else {
      M.background = O.background;
    }

    const persistedAnnotations = Viewer.getAnnotationEntriesForPersistence();
    M.annotationEntries = persistedAnnotations;
    M.iiifAnnotationsXml = Viewer.exportAnnotationsToIIIFXml();

    return M;
  },

  prepareStats () {
    // stats
    core.stats = new Stats();
    core.stats.domElement.style.cssText =
      "position:relative;top:0px;" +
      "max-height:120px;max-width:90px;z-index:2;visibility:hidden;";

    Viewer.windowHalfX = core.CONFIG.viewer.canvasDimensions.x / 2;
    Viewer.windowHalfY = core.CONFIG.viewer.canvasDimensions.y / 2;

    Viewer.editorFolder = core.gui.addFolder(t$1("gui.editor", "Editor")).close();
    Viewer.editorFolder.domElement?.classList.add("viewer-gui-main-folder");
    Viewer.editorFolder.domElement?.setAttribute("data-gui-main-folder", "editor");
    core.i18nGui.editorFolder = Viewer.editorFolder;
    const showTransformHintToast = (mode) => {
      const hints = {
        translate: t$1("toasts.transformMove", "Move: drag axis arrows to reposition the object."),
        rotate: t$1("toasts.transformRotate", "Rotate: drag rotation rings to rotate the object."),
        scale: t$1("toasts.transformScale", "Scale: drag axis handles to resize the object."),
      };
      const message = hints[mode];
      if (!message) return;
        showToast(message, {
          duration: 5200
        });
    };

    const showTransformLightHintToast = (mode) => {
      const hints = {
        translate: t$1("toasts.transformLightMove", "Transform Light - Move: drag axis arrows to move the directional light."),
        rotate: t$1("toasts.transformLightTarget", "Transform Light - Target: drag axis arrows to reposition the light target."),
      };
      const message = hints[mode];
      if (!message) return;
        showToast(message, {
          duration: 5200
        });
    };

    core.i18nGui.transformObjectController = Viewer.editorFolder
      .add(Viewer.transformText, "Transform 3D Object", {
        [t$1("gui.none", "None")]: "",
        [t$1("gui.move", "Move")]: "translate",
        [t$1("gui.rotate", "Rotate")]: "rotate",
        [t$1("gui.scale", "Scale")]: "scale",
      })
      .name(t$1("gui.transform3dObject", "Transform 3D Object"))
      .onChange(function (value) {
        if (value === "") {
          core.transformControl.detach();
          core.axesHelper.visible = false;
          core.renderer.localClippingEnabled = true;
        } else {
          const object = core.helperObjects?.[0];

          if (!object) {
            return;
          }
          core.axesHelper.visible = true;
          core.renderer.localClippingEnabled = true;

          core.transformControl.setMode(value);
          core.transformControl.attach(object);
          showTransformHintToast(value);

        }
        Viewer.updateEditorToolbarState();
      });
    core.i18nGui.transformModeController = Viewer.editorFolder
      .add(Viewer.transformText, "Transform Mode", {
        [t$1("gui.local", "Local")]: "local",
        [t$1("gui.global", "Global")]: "global",
      })
      .name(t$1("gui.transformMode", "Transform Mode"))
      .onChange(function (value) {
        core.transformControl.space = value;
        Viewer.updateEditorToolbarState();
      });
    const lightFolder = Viewer.editorFolder.addFolder(t$1("gui.directionalLight", "Directional Light")).close();
    core.i18nGui.lightFolder = lightFolder;
    core.i18nGui.transformLightController = lightFolder
      .add(Viewer.transformText, "Transform Light", {
        [t$1("gui.none", "None")]: "",
        [t$1("gui.move", "Move")]: "translate",
        [t$1("gui.target", "Target")]: "rotate",
      })
      .name(t$1("gui.transformLight", "Transform Light"))
      .onChange(function (value) {
        if (value === "") {
          core.transformControlLight.detach();
          core.transformControlLightTarget.detach();
          core.lightHelper.visible = false;
        } else {
          core.lightHelper.visible = true;
          if (value === "translate") {
            core.transformControlLight.setMode("translate");
            core.transformControlLight.attach(core.dirLight);
            core.transformControlLightTarget.detach();
            showTransformLightHintToast("translate");
          } else {
            core.transformControlLightTarget.setMode("translate");
            core.transformControlLightTarget.attach(core.dirLightTarget);
            core.transformControlLight.detach();
            showTransformLightHintToast("rotate");
          }
        }
        Viewer.updateEditorToolbarState();
      });
    core.i18nGui.directionalLightColorController = lightFolder
      .addColor(Viewer.colors, "DirectionalLight")
      .name(t$1("gui.color", "Color"))
      .onChange(function (value) {
        core.lightObjects[0].color = new THREE.Color(value);
      })
      .listen();
    core.i18nGui.directionalLightIntensityController = lightFolder
      .add(Viewer.intensity, "startIntensityDir", 0, 10)
      .name(t$1("gui.intensity", "Intensity"))
      .onChange(function (value) {
        core.lightObjects[0].intensity = value;
      })
      .listen();

    const lightFolderAmbient = Viewer.editorFolder.addFolder(t$1("gui.ambientLight", "Ambient Light")).close();
    core.i18nGui.lightFolderAmbient = lightFolderAmbient;
    core.i18nGui.ambientLightColorController = lightFolderAmbient
      .addColor(Viewer.colors, "AmbientLight")
      .name(t$1("gui.color", "Color"))
      .onChange(function (value) {
        Viewer.ambientLight.color = new THREE.Color(value);
      })
      .listen();
    core.i18nGui.ambientLightIntensityController = lightFolderAmbient
      .add(Viewer.intensity, "startIntensityAmbient", 0, 10)
      .name(t$1("gui.intensity", "Intensity"))
      .onChange(function (value) {
        Viewer.ambientLight.intensity = value;
      })
      .listen();

    const lightFolderCamera = Viewer.editorFolder.addFolder(t$1("gui.cameraLight", "Camera Light")).close();
    core.i18nGui.lightFolderCamera = lightFolderCamera;
    core.i18nGui.cameraLightColorController = lightFolderCamera
      .addColor(Viewer.colors, "CameraLight")
      .name(t$1("gui.color", "Color"))
      .onChange(function (value) {
        Viewer.cameraLight.color = new THREE.Color(value);
      })
      .listen();
    core.i18nGui.cameraLightIntensityController = lightFolderCamera
      .add(Viewer.intensity, "startIntensityCamera", 0, 10)
      .name(t$1("gui.intensity", "Intensity"))
      .onChange(function (value) {
        Viewer.cameraLight.intensity = value;
      })
      .listen();

    const backgroundFolder = Viewer.editorFolder.addFolder(t$1("gui.backgroundColor", "Background Color")).close();
    core.i18nGui.backgroundFolder = backgroundFolder;
    core.i18nGui.backgroundColorController = backgroundFolder
      .addColor(Viewer.colors, "BackgroundColor")
      .name(t$1("gui.backgroundColor", "Background Color"))
      .onChange(function (value) {
        changeBackground(
          Viewer.backgroundType["Background Type"],
          value,
          Viewer.colors["BackgroundColorOuter"]
        );
      })
      .listen();
    core.i18nGui.backgroundColorOuterController = backgroundFolder
      .addColor(Viewer.colors, "BackgroundColorOuter")
      .name(t$1("gui.backgroundColorOuter", "Background Color Outer"))
      .onChange(function (value) {
        changeBackground(
          Viewer.backgroundType["Background Type"],
          Viewer.colors["BackgroundColor"],
          value
        );
      })
      .listen();
    core.i18nGui.backgroundTypeController = backgroundFolder
      .add(Viewer.backgroundType, "Background Type", {
        [t$1("gui.linear", "Linear")]: "linear",
        [t$1("gui.gradient", "Gradient")]: "gradient",
      })
      .name(t$1("gui.backgroundType", "Background Type"))
      .onChange(function (value) {
        if (value == "linear") Viewer.backgroundOuterFolder.hide();
        else Viewer.backgroundOuterFolder.show();
        changeBackground(
          value,
          Viewer.colors["BackgroundColor"],
          Viewer.colors["BackgroundColorOuter"]
        );
      });
    setCore("clippingFolder", Viewer.clippingFolder);

    if (core.EDITOR) {
      core.clippingFolder = Viewer.editorFolder.addFolder(t$1("gui.clippingFolder", "Clipping Planes")).close();
      core.i18nGui.clippingFolder = core.clippingFolder;
      
      core.materialsFolder = Viewer.editorFolder.addFolder(t$1("gui.materials", "Materials")).close();
      core.i18nGui.materialsFolder = core.materialsFolder;
      setCore("materialsFolder", core.materialsFolder);

      Viewer.pickingModeController = Viewer.editorFolder.add(
        {
          togglePickingMode() {
            Viewer.togglePickingMode();
          },
        },
        "togglePickingMode"
      );
      Viewer.updatePickingModeControllerLabel();

      Viewer.clearSelectedFacesController = Viewer.editorFolder.add(
        {
          [t$1("gui.clearSelectedFaces", "Clear selected faces")]() {
            Viewer.clearSelectedFaces();
            Viewer.restoreLastPickedFace();
          },
        },
        t$1("gui.clearSelectedFaces", "Clear selected faces")
      );
      core.i18nGui.clearSelectedFacesController = Viewer.clearSelectedFacesController;

      Viewer.selectedFacesCountController = Viewer.editorFolder
        .add(Viewer.pickingStats, "Selected faces")
        .listen();
      Viewer.updateSelectedFacesControllerLabel();
      Viewer.selectedFacesCountController.disable();

      Viewer.metadataFolder = core.gui.addFolder(t$1("gui.metadata", "Metadata")).close();
      Viewer.metadataFolder.domElement?.classList.add("viewer-gui-main-folder");
      Viewer.metadataFolder.domElement?.setAttribute("data-gui-main-folder", "metadata");
      core.i18nGui.metadataFolder = Viewer.metadataFolder;

      Viewer.addAnnotationController = Viewer.metadataFolder.add(
        {
          [t$1("gui.addAnnotations", "Add annotations")]() {
            Viewer.openAnnotationDialogWithAutoPicking();
          },
        },
        t$1("gui.addAnnotations", "Add annotations")
      );
      core.i18nGui.addAnnotationController = Viewer.addAnnotationController;
      core.i18nGui.exportAnnotationsController = Viewer.metadataFolder.add(
        {
          [t$1("gui.exportAnnotationsXml", "Export annotations XML")]() {
            Viewer.downloadAnnotationsXmlFile();
          },
        },
        t$1("gui.exportAnnotationsXml", "Export annotations XML")
      );
      core.i18nGui.importAnnotationsController = Viewer.metadataFolder.add(
        {
          [t$1("gui.importAnnotationsXml", "Import annotations XML")]() {
            Viewer.triggerAnnotationsXmlImport();
          },
        },
        t$1("gui.importAnnotationsXml", "Import annotations XML")
      );
      Viewer.updatePickingControlsVisibility();

      Viewer.distanceMeasurementController = Viewer.editorFolder.add(
        {
          toggleDistanceMeasurement() {
            Viewer.toggleDistanceMeasurement();
          },
        },
        "toggleDistanceMeasurement"
      );
      Viewer.updateDistanceMeasurementControllerLabel();

      core.i18nGui.resetCameraController = Viewer.editorFolder.add(
        {
          [t$1("gui.resetCameraPosition", "Reset camera position")]() {
            Viewer.resetCamera();
          },
        },
        t$1("gui.resetCameraPosition", "Reset camera position")
      );
    }

    if (!core.isLightweight) {
      Viewer.propertiesFolder = Viewer.editorFolder.addFolder(t$1("gui.saveProperties", "Save properties")).close();
      core.i18nGui.propertiesFolder = Viewer.propertiesFolder;
      core.i18nGui.savePropPositionController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Position").name(t$1("gui.position", "Position"));
      core.i18nGui.savePropRotationController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Rotation").name(t$1("gui.rotation", "Rotation"));
      core.i18nGui.savePropScaleController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Scale").name(t$1("gui.scale", "Scale"));
      core.i18nGui.savePropCameraController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Camera").name(t$1("gui.camera", "Camera"));
      core.i18nGui.savePropDirectionalController = Viewer.propertiesFolder.add(Viewer.saveProperties, "DirectionalLight").name(t$1("gui.directionalLight", "Directional Light"));
      core.i18nGui.savePropAmbientController = Viewer.propertiesFolder.add(Viewer.saveProperties, "AmbientLight").name(t$1("gui.ambientLight", "Ambient Light"));
      core.i18nGui.savePropCameraLightController = Viewer.propertiesFolder.add(Viewer.saveProperties, "CameraLight").name(t$1("gui.cameraLight", "Camera Light"));
      core.i18nGui.savePropBackgroundController = Viewer.propertiesFolder.add(Viewer.saveProperties, "BackgroundColor").name(t$1("gui.backgroundColor", "Background Color"));
    }

    if (core.EDITOR && !core.isLightweight) {
      core.i18nGui.saveController = Viewer.editorFolder.add(
        {
          [t$1("gui.save", "Save")]() {
            Viewer.saveEditorMetadata();
          }
        },
        t$1("gui.save", "Save")
      );
      core.i18nGui.renderPreviewController = Viewer.editorFolder.add(
        {
          [t$1("gui.renderPreview", "Render preview")]() {
            Viewer.takeScreenshot();
          },
        },
        t$1("gui.renderPreview", "Render preview")
      );
    }

    if (core.EDITOR) {
      Viewer.createEditorToolbar();
      Viewer.setEditorAdvancedPanelVisible(false);
    }

    Viewer.updateLocalizedUI();
  },

  async startModelProcessing() {
    /*const r = await fetch("/api/model/create", {method:"POST" });

    const data = await r.json();

    const id = data.entity_id;*/

    const _id = core.CONFIG.entity.id;

    localStorage.setItem("processing_model_id", _id);

    let loadingMap = this.getProcessingLoadingSteps();

    loadingMap = core.isLocalPreview ? loadingMap.slice(-2) : loadingMap;

    UltraLoader$1.start(loadingMap);
    setCore("UltraLoader", UltraLoader$1);

    const poller = new StatusPoller(_id);
    setCore("poller", poller);
    poller.start();
  },

  // IIIF setup and loading
  async setupIIIF(newUrlOrJson, type="url") {
    if (type === "text") {
      Viewer.iiifConfigURL.url = "";
    } else {
      Viewer.iiifConfigURL.url = newUrlOrJson;
    }
    const loadedIIIF = await loadIIIFManifest(newUrlOrJson);
    if (loadedIIIF.modelUrls.length === 0) { // no 3D model found, use example model
      loadedIIIF.modelUrls.push('https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb');
      showToast(t$1("toasts.noIiiifModelFallback", "No 3D model found in IIIF manifest, loading example model."));
    }
    // reset scene and release GPU resources from the previous model batch
    Viewer.resetLoadedModelState();
    core.axesHelper.visible = false;
    console.log("TOTAL Annotations: " + loadedIIIF.annotations.length);
    if (loadedIIIF.annotations.length !== loadedIIIF.modelUrls.length) {
      //console.warn("Number of annotations does not match number of model URLs, adding testing model...");
        const diff = loadedIIIF.annotations.length - loadedIIIF.modelUrls.length;
        if (diff > 0) {
          // Need more model URLs → push empty strings (or null)
          for (let i = 0; i < diff; i++) {
            loadedIIIF.modelUrls.push(Viewer.testModelURL);
            core.objectsConfig.models.push({name: "Test Model", url: Viewer.testModelURL});
          }
        }
    }
    for (const [i, url] of loadedIIIF.modelUrls?.entries()) {
      core.objectsConfig.index = i;
      core.fileObject.originalPath = loadedIIIF.modelUrl = url;
      //fileObject.originalPath = loadedIIIF.modelUrl;
      Viewer.setModelPaths();
      await getAnnotations(loadedIIIF, core.objectsConfig);
      if (loadedIIIF.scenes && loadedIIIF.scenes.length > 0) {
        core.objectsConfig.scenes = loadedIIIF.scenes;
      }
      Viewer._ext = core.fileObject.extension.toLowerCase();
      await Viewer.mainLoadModel();
    }
  },

  async loadIIIFURL() {
    const form = document.getElementById("form-IIIF");
    const collapseBtn = document.getElementById("iiif-toggle-collapse");
    form?.setAttribute("data-viewer-theme", Viewer.currentTheme);
    Viewer.updateIIIFFormLabels();

    Viewer.bindEventListener(collapseBtn, "click", () => {
      form.classList.toggle("collapsed");
      collapseBtn.textContent = form.classList.contains("collapsed") ? "▸" : "▾";
      collapseBtn.title = form.classList.contains("collapsed")
        ? t$1("iiif.expand", "Expand")
        : t$1("iiif.collapse", "Collapse");
    });
    // create a small dropdown to switch iiif manifests at runtime
    Viewer.bindEventListener(document.getElementById("iiif-manifest-select"), "change", async (ev) => {
      try {
        if (ev.target.value !== Viewer.iiifConfigURL.url) {
          core.objectsConfig.setupIndex = 0;
          await Viewer.setupIIIF(ev.target.value, "url");
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading IIIF manifest",
        });
      }
      });

    Viewer.bindEventListener(document.getElementById("load-manifest-from-url"), "click", async (ev) => {
      try {
        const inputElement = document.getElementById("manifest-url");
        if (inputElement.value === "" || !Viewer.isUrlFlexible(inputElement.value)) {
        inputElement.style.border = "2px solid red";
        showToast("iiif.invalidUrl", "warning");
        return;
      } else {
        inputElement.style.border = "2px solid green";
        core.objectsConfig.setupIndex = 0;
          console.log("Loading IIIF manifest from URL: " + inputElement.value);
          await Viewer.setupIIIF(inputElement.value, "url");
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading IIIF manifest",
        });
      }
      });

    Viewer.bindEventListener(document.getElementById("load-manifest-from-text"), "click", async (ev) => {
      try {
        const inputElement = document.getElementById("manifest-text");
        if (inputElement.value === "" || !Viewer.isValidJsonObject(inputElement.value)) {
          inputElement.style.border = "2px solid red";
          showToast("iiif.invalidJson", "warning");
        return;
      } else {
        inputElement.style.border = "2px solid green";
        core.objectsConfig.setupIndex = 0;
          console.log("Loading IIIF manifest from privided text");
          await Viewer.setupIIIF(inputElement.value, "text");
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading IIIF manifest",
        });
      }
    });
  },

  isUrlFlexible(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(string);
    }
  },

  isValidJsonObject(text) {
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  },

  async init() {
    if (!Viewer.renderer) {
      Viewer.camera = new THREE.PerspectiveCamera(
        45,
        core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y,
        0.001,
        999000000
      );
      Viewer.camera.position.set(0, 0, 0);
      setCore('renderer', Viewer.renderer);
      setCore('camera', Viewer.camera);
      setCore('mainObject', Viewer.mainObject);

      Viewer.scene = new THREE.Scene();
      setCore('scene', Viewer.scene);
      setCore('activeScene', Viewer.activeScene);

      const hostname = window.location.hostname;
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
      const isLocalNetwork = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.endsWith('.local');
      const isCodeSandbox = hostname.includes('codesandbox.io') || hostname.includes('csb.app');
      this.isLocalPreview = isLocal || isLocalNetwork || isCodeSandbox;
      setCore('isLocalPreview', this.isLocalPreview);
      console.info('Running on', window.location.hostname, '- Local preview mode:', core.isLocalPreview);

      if (!core.PRESENTATION_MODE && !core.SANDBOX_MODE) {
        Viewer.startModelProcessing();
      }

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
      hemiLight.position.set(0, 200, 0);
      core.scene.add(hemiLight);

      Viewer.ambientLight = new THREE.AmbientLight(0x404040); // soft white light
      core.scene.add(Viewer.ambientLight);

      setCore('ambientLight', Viewer.ambientLight);

      Viewer.dirLight = new THREE.DirectionalLight(0xffffff);
      Viewer.dirLight.position.set(0, 100, 50);
      Viewer.dirLight.castShadow = true;
      Viewer.dirLight.shadow.camera.top = 180;
      Viewer.dirLight.shadow.camera.bottom = -100;
      Viewer.dirLight.shadow.camera.left = -120;
      Viewer.dirLight.shadow.camera.right = 120;
      Viewer.dirLight.shadow.bias = -1e-4;
      Viewer.dirLight.shadow.mapSize.width = 1024 * 4;
      Viewer.dirLight.shadow.mapSize.height = 1024 * 4;
      core.scene.add(Viewer.dirLight);
      Viewer.lightObjects.push(Viewer.dirLight);
      setCore('dirLight', Viewer.dirLight);
      setCore('lightObjects', Viewer.lightObjects);

      Viewer.cameraLightTarget = new THREE.Object3D();
      Viewer.cameraLightTarget.position.set(
        Viewer.camera.position.x,
        Viewer.camera.position.y,
        Viewer.camera.position.z
      );
      core.scene.add(Viewer.cameraLightTarget);
      // Store in core
      setCore('cameraLightTarget', Viewer.cameraLightTarget);

      Viewer.cameraLight = new THREE.DirectionalLight(0xffffff);
      Viewer.cameraLight.position.set(core.camera.position);
      Viewer.cameraLight.castShadow = false;
      Viewer.cameraLight.intensity = 0.3;
      core.scene.add(Viewer.cameraLight);
      Viewer.cameraLight.target = Viewer.cameraLightTarget;
      Viewer.cameraLight.target.updateMatrixWorld();
      // Store in core
      setCore('cameraLight', Viewer.cameraLight);      

      core.renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        colorManagement: true,
        sortObjects: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        alpha: true,
        shadowMap: {
          enabled: true,
          type: THREE.PCFSoftShadowMap
        },
        localClippingEnabled: true,
        physicallyCorrectLights: true,
        autoClear: false,
        setClearColor: (0.0),
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.65
      });
      
      core.renderer.localClippingEnabled = true;

      setCore('renderer', core.renderer);

      core.renderer.domElement.id = "MainCanvas";
      Viewer.mainCanvas = document.getElementById("MainCanvas") || core.renderer.domElement;

      if (window.__E2E__) {
        document.body.appendChild(core.renderer.domElement);
      }

      core.renderer.domElement.tabIndex = 0;
      core.renderer.domElement.setAttribute("aria-label", "3D viewer canvas");

      if (!core.PRESENTATION_MODE) {

        Viewer.bindEventListener(core.renderer.domElement, "pointerdown", Viewer.onPointerDown);
        Viewer.bindEventListener(core.renderer.domElement, "pointerup", Viewer.onPointerUp);
        Viewer.bindEventListener(core.renderer.domElement, "pointermove", Viewer.onPointerMove);
        Viewer.bindEventListener(core.renderer.domElement, "mouseenter", (event) => {
          if (!Viewer.isPointerDirectlyOverCanvas(event)) return;
          Viewer.maybeShowKeyboardHint();
        });
        Viewer.lastWindowFocusAt = Date.now();
        Viewer.bindEventListener(window, "focus", () => {
          Viewer.lastWindowFocusAt = Date.now();
        });
        Viewer.bindEventListener(document, "visibilitychange", () => {
          if (document.visibilityState === "visible") {
            Viewer.lastWindowFocusAt = Date.now();
          }
        });

        Viewer.bindEventListener(core.renderer.domElement, "pointerdown", () => {
          core.renderer.domElement.focus();
        });
        Viewer.bindEventListener(core.renderer.domElement, "keydown", Viewer.onViewerKeyDown);

        if (core.isLocalPreview || core.SANDBOX_MODE) {
          Viewer.bindEventListener(core.renderer.domElement, "dragover", Viewer.onDragOver);
          Viewer.bindEventListener(core.renderer.domElement, "drop", Viewer.onDrop);
        }
      }

      const devicePixelRatio = window.devicePixelRatio || 1;
      core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);

      if (isE2E) {
        console.info('E2E MODE ENABLED');
        core.renderer.setPixelRatio(1);
        core.renderer.toneMappingExposure = 1;
        if (typeof disablePostProcessing === 'function') {
          disablePostProcessing();
        }
        this.ensureE2EState();
      } else {
            core.renderer.setPixelRatio(devicePixelRatio);
      }
      core.renderer.domElement.style.width = core.CONFIG.viewer.canvasDimensions.x + "px";
      core.renderer.domElement.style.height = core.CONFIG.viewer.canvasDimensions.y + "px";

      core.renderer.domElement.style.display = "block";
      core.container.appendChild(core.renderer.domElement);
      Viewer.mainCanvas.classList.add("mainCanvas");

      Viewer.viewerWrapper = core.container.closest('.viewer-wrapper');

      if (!Viewer.viewerWrapper) {
        Viewer.viewerWrapper = core.container.parentElement;
        Viewer.viewerWrapper.classList.add('viewer-wrapper');
      }

      core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
      core.camera.updateProjectionMatrix();

      setCore('mainCanvas', Viewer.mainCanvas);
      if (!core.PRESENTATION_MODE) {
        const scriptUrl = document.currentScript?.src || import.meta.url;
        Viewer.DFG_ASSETS = scriptUrl.replace(/\/[^\/]*$/, '');

        setCore('DFG_ASSETS', Viewer.DFG_ASSETS);
        getModuleAssetBasePath();

        Viewer.actionMenu = document.createElement("div");
        Viewer.actionMenu.setAttribute("id", "viewerActionMenu");
        Viewer.actionMenu.innerHTML = `
          <input
            id="viewerActionMenuToggle"
            class="viewer-action-menu_checkbox"
            type="checkbox"
            aria-label="Open main menu"
          />
          <label
            for="viewerActionMenuToggle"
            class="viewer-action-menu_toggle"
            aria-label="Open main menu"
            title="Main menu"
          >
            <span class="viewer-action-menu_settings-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 2.2 3-.2.8 2.9 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.6-1.4 1-2.8-1-2.8 2.6-1.4.8-2.9 3 .2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
            </span>
            <b class="viewer-editor-tool_sr">Main menu</b>
          </label>
          <div class="viewer-action-menu_panel" aria-label="Main menu"></div>
        `;
        core.container.appendChild(Viewer.actionMenu);

        Viewer.actionMenuToggle = Viewer.actionMenu.querySelector("#viewerActionMenuToggle");
        Viewer.actionMenuPanel = Viewer.actionMenu.querySelector(".viewer-action-menu_panel");
        Viewer.applyTheme(Viewer.getStoredTheme(), { persist: false });

        Viewer.viewEntity = document.createElement("button");
        Viewer.viewEntity.setAttribute("id", "viewEntity");
        Viewer.viewEntity.setAttribute("type", "button");
        Viewer.viewEntity.hidden = true;

        Viewer.downloadModel = document.createElement("a");
        setCore('downloadModel', Viewer.downloadModel);
        Viewer.downloadModel.setAttribute("id", "downloadModel");
        Viewer.downloadModel.hidden = true;

        Viewer.fullscreenMode = document.createElement("button");
        Viewer.fullscreenMode.setAttribute("id", "fullscreenMode");
        Viewer.fullscreenMode.setAttribute("type", "button");
        Viewer.updateFullscreenButtonIcon();

        Viewer.themeMode = document.createElement("button");
        Viewer.themeMode.setAttribute("id", "viewerThemeMode");
        Viewer.themeMode.setAttribute("type", "button");
        
        // Create language mode container and dropdown
        Viewer.languageModeContainer = document.createElement("div");
        Viewer.languageModeContainer.setAttribute("id", "viewerLanguageModeContainer");
        Viewer.languageModeContainer.className = "language-mode-container";
        
        Viewer.languageMode = document.createElement("button");
        Viewer.languageMode.setAttribute("id", "viewerLanguageMode");
        Viewer.languageMode.setAttribute("type", "button");
        
        Viewer.languageModeDropdown = document.createElement("div");
        Viewer.languageModeDropdown.setAttribute("id", "viewerLanguageModeDropdown");
        Viewer.languageModeDropdown.className = "language-mode-dropdown";
        Viewer.languageModeDropdown.hidden = true;
        
        const languages = [
          { code: "en", label: "EN", class: "language-dropdown-item-english" },
          { code: "pl", label: "PL", class: "language-dropdown-item-polish" },
          { code: "de", label: "DE", class: "language-dropdown-item-german" }
        ];
        
        languages.forEach(lang => {
          const item = document.createElement("div");
          item.className = `language-dropdown-item ${lang.class}`;
          item.dataset.lang = lang.code;
          item.textContent = lang.label;
          item.setAttribute("role", "option");
          item.setAttribute("aria-selected", core.currentLanguage === lang.code ? "true" : "false");
          Viewer.bindEventListener(item, "click", () => Viewer.selectLanguage(lang.code));
          Viewer.languageModeDropdown.appendChild(item);
        });
        
        Viewer.languageModeContainer.appendChild(Viewer.languageMode);
        Viewer.languageModeContainer.appendChild(Viewer.languageModeDropdown);
        
        Viewer.updateThemeControlLabels();
        Viewer.updateLanguageControlLabels();

        Viewer.actionMenuPanel.appendChild(Viewer.languageModeContainer);
        Viewer.actionMenuPanel.appendChild(Viewer.themeMode);
        Viewer.actionMenuPanel.appendChild(Viewer.viewEntity);
        Viewer.actionMenuPanel.appendChild(Viewer.downloadModel);
        Viewer.actionMenuPanel.appendChild(Viewer.fullscreenMode);
        if (Viewer.urlOptions.hideUi) {
          Viewer.actionMenu.hidden = true;
        }
        Viewer.createEmbedConfiguratorPanel();

        setCore('viewEntity', Viewer.viewEntity);
        Viewer.bindEventListener(Viewer.languageMode, "click", Viewer.toggleLanguage.bind(Viewer));
        Viewer.bindEventListener(Viewer.themeMode, "click", Viewer.toggleTheme.bind(Viewer));
        Viewer.bindEventListener(Viewer.fullscreenMode, "click", Viewer.toggleFullscreen, false);
        Viewer.bindEventListener(Viewer.viewEntity, "click", Viewer.openEmbedConfiguratorFromMenu.bind(Viewer));
        Viewer.updateEmbedMenuEntryState();
        Viewer.applyLanguage({ persist: false });
        Viewer.bindEventListener(Viewer.downloadModel, "click", () => Viewer.closeActionMenu());
        Viewer.bindEventListener(document, "click", (event) => {
          if (
            !Viewer.actionMenu?.contains(event.target) &&
            !Viewer.embedConfiguratorPanel?.contains(event.target)
          ) {
            Viewer.closeActionMenu();
          }
        });

        Viewer.handHint.innerHTML = `<img src="${core.DFG_ASSETS}/img/hand-hint.png" alt="Hand hint" width=48 height=48 title="Hand hint animation"/>`;
        
        Viewer.rect = core.container.getBoundingClientRect();
        core.guiContainer.style.maxHeight = `${Viewer.rect.height - 20}px`;
        core.lilGui = document.getElementsByClassName("lil-gui root");

        Viewer.fileElement = document.getElementsByClassName("field--type-file");
        if (Viewer.fileElement.length > 0) {
          Viewer.fileElement[0].style.height = core.CONFIG.viewer.canvasDimensions.y * 1.1 + "px";
        }

        if (
          !core.isLightweight || 
          core.CONFIG.viewer.gallery?.build === true
        ) {
          Viewer.buildGallery();
        }
      }

      Viewer.controls = new OrbitControls(core.camera, core.renderer.domElement);
      Viewer.controls.target.set(0, 100, 0);
      Viewer.controls.enableDamping = true;
      Viewer.controls.dampingFactor = 0.05;
      Viewer.controls.enableRotate = true;

      if (core.PRESENTATION_MODE) {
        //TODO
        Viewer.controls.autoRotate = true;
        Viewer.controls.autoRotateSpeed = 1.5; // in seconds
        document.body.classList.add("presentation-mode");
        document.documentElement.classList.add("presentation-mode");
        core.renderer.setClearColor(0x000000, 0);
      }
      if (typeof Viewer.urlOptions.autoRotate === "boolean") {
        Viewer.controls.autoRotate = Viewer.urlOptions.autoRotate;
      }
      if (Number.isFinite(Viewer.urlOptions.autoRotateSpeed)) {
        Viewer.controls.autoRotateSpeed = Viewer.urlOptions.autoRotateSpeed;
      }
      if (Viewer.urlOptions.disableInteraction || core.PRESENTATION_MODE) {
        Viewer.controls.enabled = false;
        Viewer.controls.enableRotate = false;
        Viewer.controls.enablePan = false;
        Viewer.controls.enableZoom = false;
      }
      Viewer.controls.update();
      setCore('controls', Viewer.controls);
      setCore('GESTURE', Viewer.GESTURE);
      setCore('lastTime', Viewer.lastTime);
      setCore('helperObjects', Viewer.helperObjects);

      if (!core.PRESENTATION_MODE) {
        Viewer.transformControl = new TransformControls(core.camera, core.renderer.domElement);
        Viewer.transformControl.rotationSnap = THREE.MathUtils.degToRad(5);
        Viewer.transformControl.space = "local";
        Viewer.transformControl.addEventListener("change", Viewer.render);
        Viewer.transformControl.addEventListener("objectChange", () => {
          Viewer.changeScale();
          Viewer.syncOutlineClippingTransform();
        });
        Viewer.transformControl.addEventListener("mouseUp", () => {
          Viewer.syncOutlineClippingTransform();
          Viewer.calculateObjectScale();
        });
        Viewer.transformControl.addEventListener("dragging-changed", function (event) {
          core.controls.enabled = !event.value;
        });
        core.scene.add(Viewer.transformControl.getHelper());
        setCore('transformControl', Viewer.transformControl);

        Viewer.transformControlLight = new TransformControls(core.camera, core.renderer.domElement);
        Viewer.transformControlLight.space = "local";
        Viewer.transformControlLight.addEventListener("change", Viewer.render);
        //Viewer.transformControlLight.addEventListener('objectChange', changeLightRotation);
        Viewer.transformControlLight.addEventListener(
          "dragging-changed",
          function (event) {
            core.controls.enabled = !event.value;
          }
        );
        core.scene.add(Viewer.transformControlLight.getHelper());
        setCore('transformControlLight', Viewer.transformControlLight);

        Viewer.transformControlLightTarget = new TransformControls(
          core.camera,
          core.renderer.domElement
        );
        Viewer.transformControlLightTarget.space = "global";
        Viewer.transformControlLightTarget.addEventListener("change", Viewer.render);
        Viewer.transformControlLightTarget.addEventListener(
          "objectChange",
          Viewer.changeLightRotation
        );
        Viewer.transformControlLightTarget.addEventListener(
          "dragging-changed",
          function (event) {
            core.controls.enabled = !event.value;
          }
        );
        core.scene.add(Viewer.transformControlLightTarget.getHelper());
        setCore('transformControlLightTarget', Viewer.transformControlLightTarget);

        Viewer.transformControlClippingPlaneX = Viewer.createClippingPlaneAxis(0, "x");
        Viewer.transformControlClippingPlaneY = Viewer.createClippingPlaneAxis(1, "y");
        Viewer.transformControlClippingPlaneZ = Viewer.createClippingPlaneAxis(2, "z");
        setCore('transformControlClippingPlaneX', Viewer.transformControlClippingPlaneX);
        setCore('transformControlClippingPlaneY', Viewer.transformControlClippingPlaneY);
        setCore('transformControlClippingPlaneZ', Viewer.transformControlClippingPlaneZ);

        setCore('clippingPlanes', Viewer.clippingPlanes);
        setCore('selectObjectHierarchy', Viewer.selectObjectHierarchy);

      }

      Viewer.GESTURE.handPx *= Math.min(window.innerWidth / 1200, 1);

      Viewer._ext = core.fileObject.extension.toLowerCase();
      if (
        Viewer._ext === "zip" ||
        Viewer._ext === "rar" ||
        Viewer._ext === "tar" ||
        Viewer._ext === "xz" ||
        Viewer._ext === "gz"
      ) {
        Viewer.archiveType = Viewer._ext;
      }
      
      core.autoPath = "";

      if (core.isLocalPreview && !core.PRESENTATION_MODE && !core.SANDBOX_MODE) {
        const picker = document.getElementById('example-model-picker');
        const selectModel = document.getElementById('example-model-select');
        const themeToggle = document.getElementById('example-theme-toggle');
        const viewerElement = document.getElementById('DFG_3DViewer');
        if (picker && selectModel && viewerElement) {
          Viewer.updateLocalPreviewLabels();
          const localurl = new URL(window.location.href);
          let selectedModel = localurl.searchParams.get('model');
          if (!selectedModel) {
            selectedModel = localStorage.getItem('dfg3dviewer-example-model');
          }
          if (!selectedModel) {
            selectedModel = viewerElement.getAttribute('3d');
          }
          if (!selectedModel) {
            selectedModel = './examples/box.stl';
          }
          core.autoPath = selectedModel;
          picker.style.display = 'inline-flex';
          selectModel.value = selectedModel;
          viewerElement.setAttribute('3d', selectedModel);
          if (themeToggle) {
            themeToggle.hidden = true;
          }

          selectModel.addEventListener('change', () => {
            core.autoPath = selectModel.value;
            window.localStorage.setItem('dfg3dviewer-example-model', selectModel.value);
            this.resetLoadedModelState();
            this.mainLoadModelWrapper();
          });
        }
      }

      if (core.SANDBOX_MODE) {
        Viewer.prepareSandboxScene();
      } else if (!core.PRESENTATION_MODE) {
        const sourceType = core.CONFIG.entity.metadata.sourceType.toLowerCase();
        console.log("Loading from source: " + sourceType);
            
        if (window.__E2E__) {
          try {
            await Viewer.mainLoadModelWrapper();
          } catch (error) {
            Viewer.reportError(error, {
              context: "E2E model load error",
            });
          }
        } 
        else if (sourceType === "drupal") {
          try {
            if (core.CONFIG.entity.metadata.exportUrl && core.CONFIG.entity.metadata.exportUrl !== "") 
            {
              const response = await fetch(core.CONFIG.viewer.exportPath + core.CONFIG.entity.id, 
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/xml'
                },
                body: JSON.stringify({
                  id: core.CONFIG.entity.id,
                  domain: core.CONFIG.metadataUrl
                })
              });

              if (!response.ok) {
                throw new Error(`XML export failed: ${response.status}`);
              }

              const xmlText = await response.text();

              const parser = new DOMParser();
              const doc = parser.parseFromString(xmlText, 'application/xml');
              Viewer.pendingAnnotationsXml = Viewer.extractAnnotationsXmlFromExportDocument(doc);

              core.autoPath = '';

              const nodes = doc.getElementsByTagName('*');
              for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (
                  node.tagName?.includes('converted_file') &&
                  node.textContent
                ) {
                  core.autoPath = node.textContent;
                  break;
                  }
                }
            }
            await Viewer.mainLoadModelWrapper();
          } catch (err) {
            Viewer.reportError(err, {
              context: core.isLightweight ? "Lightweight model load error" : "Metadata load error",
            });
          }
        } else if (sourceType === "iiif") {
          Viewer.cleanupTransientUI();
          createIIIFUI();

          console.log("Loading from source: " + core.CONFIG.entity.metadata.sourceType);
          if (Viewer.iiifConfigURL.url !== "") {
            createIIIFDropdown(Viewer.iiifConfigURL);
            await Viewer.loadIIIFURL();
            core.CONFIG.entity.metadata.sourceType = "IIIF";
            await Viewer.setupIIIF(Viewer.iiifConfigURL.url);
          }
        } else {
          console.log("Custom metadata source:" + core.CONFIG.entity.metadata.sourceType);
          try {
            switch(core.CONFIG.entity.metadata.sourceType.substring(0, 6).toLowerCase()) {
              case "drupal":
                console.log("Loading from URL: " + core.CONFIG.entity.metadata.url);

                break;
            }
            // Load model for custom metadata sources
            await Viewer.mainLoadModelWrapper();
          } catch (error) {
            Viewer.reportError(error, {
              context: core.isLightweight ? "Lightweight model load error" : "Custom metadata load error",
            });
          }
        }
      } else {
        await Viewer.mainLoadModelWrapper();
      }

      core.renderer.setPixelRatio(devicePixelRatio);
      const update = () => Viewer.updateSize();

      Viewer.bindEventListener(window, 'resize', update);

      Viewer.resizeObserver = new ResizeObserver(update);
      Viewer.resizeObserver.observe(Viewer.viewerWrapper);


      Viewer.bindEventListener(document, 'fullscreenchange', Viewer.onFullscreenChange);

      const onOrientationChange = () => setTimeout(update, 100);
      Viewer.bindEventListener(window, 'orientationchange', onOrientationChange);
	  }
  },
  render() {
    core.controls?.update();
    core.renderer?.render(core.scene, core.camera);
  }
  
};

async function expectWebGL(page) {
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('webgl2');
    return !!gl;
  });

  if (!hasWebGL) {
    throw new Error('WebGL context not available');
  }
}

window.Viewer = Viewer;

(async () => {
  try {
    await Viewer.MainInit();
  } catch (error) {
    Viewer.renderFatalError(error);
  }
})();

export { Viewer, expectWebGL };
//# sourceMappingURL=main.js.map
