const VIEWER_I18N = {
  en: {
    menu: {
      actions: "Viewer actions",
      openActions: "Open viewer actions",
      embed: "Embed",
      exitEmbed: "Exit embed",
      openEmbedOptions: "Open embed options",
      exitEmbedMode: "Exit embed mode",
      shareView: "Share view",
      copyShareView: "Copy share view link",
      download: "Download",
      uploadModel: "Upload & convert",
      openUploadPanel: "Upload a 3D model for conversion",
      openModelsPanel: "Browse previously generated models",
      openLocalFile: "Models on this device",
      openModels: "Models",
      openExampleManifests: "Example manifests",
      openAdminPanel: "Administration (users, plans, limits)",
      openLoginPanel: "Log in or register",
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
    toolPanel: {
      move: "Move panel (double tap: dock)",
      minimize: "Minimize panel",
      restore: "Restore panel",
      close: "Close panel",
    },
    gallery: {
      label: "Views of the model",
      dialog: "Image viewer",
      open: "Open view {number}: {label}",
      openPlain: "Open view {number}",
      previous: "Previous view",
      next: "Next view",
      close: "Close (Esc)",
      top: "Top",
      view: "View {number}",
      zoomReset: "Reset zoom",
      hint: "Scroll or pinch to zoom · double-click for detail · arrows to browse",
    },
    credits: {
      title: "Credits",
      close: "Close",
    },
    bugReport: {
      button: "Report a bug",
      title: "Report a bug",
      description: "What went wrong? What did you do just before?",
      email: "E-mail (optional, if we may ask you about it)",
      includeDiagnostics: "Attach technical details (device, browser, model, recent errors)",
      privacy: "The report goes to the viewer's developers only.",
      send: "Send report",
      cancel: "Cancel",
      sent: "Thank you - the report was sent.",
      failed: "The report could not be sent. Please try again later.",
    },
    hints: {
      close: "Not now",
      pickingSelect: "Select at least one face to add annotation.",
      picking: "Click a face, Ctrl + click to add more, Shift + drag to select an area",
      pickingSelected: "{count} faces selected · Enter: add annotation · Esc: clear",
      pickingTouch: "Tap faces to select them, tap again to deselect",
      pickingSelectedTouch: "{count} faces selected · tap a face to add or remove it",
      pickingAnnotate: "Add annotation",
      pickingClear: "Clear",
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
      on: "ON",
      off: "OFF",
      environmentMapNeutral: "Neutral",
      environmentMapSunny: "Sunny",
      environmentMapStudio: "Studio",
      environmentMapGoldenHour: "Golden hour",
      transform: "Transform",
      annotateAdd: "Add annotation",
      annotateImport: "Import annotations",
      annotateExport: "Export annotations",
      backgroundColorOuter: "Background colour (outer)",
      groundTitle: "Ground",
      ground: {
        contact: "Contact shadow",
        mirror: "Mirror",
        grid: "Grid",
        turntable: "Turntable",
        spotlight: "Spotlight",
        dots: "Dot grid",
      },
      enableClippingPlanesMode: "Section planes",
      disableClippingPlanesMode: "Hide section planes",
      annotatePhotos: "Historical photos",
      mainMenu: "Main menu",
      moveToolbar: "Move toolbar",
      orbit: "Navigation mode",
      controls: "Controls",
      editor: "Editor",
      transform3dObject: "Transform 3D Object",
      transformLight: "Transform Light",
      transformMode: "Transform Mode",
      directionalLight: "Directional Light",
      ambientLight: "Ambient Light",
      ambient: "Ambient",
      lights: "Lights",
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
      validationReport: "Validation report",
      clearSelectedFaces: "Clear selected faces",
      clearSelectedHierarchy: "Clear selected objects",
      addAnnotations: "Add annotations",
      exportAnnotationsXml: "Export annotations XML",
      importAnnotationsXml: "Import annotations XML",
      IIIFimport: "Import 3IF",
      IIIFexport: "Export IIIF",
      resetCameraPosition: "Reset camera position",
      resetSettings: "Reset settings",
      saveSettings: "Save settings",
      renderPreview: "Change main thumbnail",
      generateThumbnails: "Generate thumbnails",
      color: "Color",
      intensity: "Intensity",
      metalness: "Metalness",
      emissive: "Emissive",
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
      upAxis: "Up axis of the model",
      upAxisYPlus: "Y up (default)",
      upAxisYMinus: "Upside down (-Y up)",
      upAxisZPlus: "Z up",
      upAxisZMinus: "-Z up",
      upAxisXPlus: "X up",
      upAxisXMinus: "-X up",
      scale: "Scale",
      target: "Target",
      local: "Local",
      global: "Global",
      linear: "Linear",
      gradient: "Gradient",
      editMaterial: "Edit material",
      selectByMaterial: "select by material",
      hideAdvancedEditor: "Hide advanced editor",
      showAdvancedEditor: "Show advanced editor",
      showLoadingLogs: "Show loading logs",
      hideLoadingLogs: "Hide loading logs",
      showCredits: "Show credits",
      hideCredits: "Hide credits",
      hierarchy: "Hierarchy",
      expand: "Expand toolbar",
      collapse: "Collapse toolbar",
      orthographicProjection: "Switch to orthographic projection",
      perspectiveProjection: "Switch to perspective projection",
      environmentMap: "Environment map",
      environmentMapToggle: "Toggle environment map",
      rendering: "Rendering",
      toneMapping: "Tone mapping",
      toneMappingNeutral: "Neutral",
      toneMappingLinear: "Linear",
      toneMappingNone: "None",
      exposure: "Exposure",
      postprocessing: "Post-processing",
      antialiasing: "Anti-aliasing",
      ambientOcclusion: "Ambient occlusion",
      ambientOcclusionIntensity: "Ambient occlusion strength",
      rakingLight: "Raking light",
      rakingLightDirection: "Direction",
      rakingLightHeight: "Height above the surface",
      rakingLightSweep: "Sweep around",
      antialiasingNone: "None",
      environmentMapIntensity: "Environment map intensity",
      environmentMapStyleNeutral: "Neutral",
      environmentMapStyleSunny: "Sunny",
      environmentMapStyleStudio: "Studio",
      environmentMapStyleGoldenHour: "Golden Hour",
      enableWireframeMode: "Enable wireframe mode",
      disableWireframeMode: "Disable wireframe mode",
      download: "Download model",
      shading: "Shading",
      shadingOriginal: "Original materials",
      shadingStandard: "Standard (PBR)",
      shadingPhong: "Phong",
      shadingLambert: "Lambert",
      shadingToon: "Toon",
      shadingFlat: "Flat shading (show faces)",
      shadingClay: "Clay (no texture)",
      shadingMatcap: "Matcap (studio clay)",
      shadingNormals: "Normals",
      shadingCustom: "Custom shader",
      shadingCustomVertex: "Vertex shader",
      shadingCustomFragment: "Fragment shader",
      shadingCustomApply: "Apply",
      shadingCustomReset: "Reset to default",
    },
    metadata: {
      modelDetails: "Model details",
      iiifManifest: "IIIF manifest: drag it into another IIIF viewer, or open it",
      metadata: "Metadata",
      visualizedFile: "Visualized file",
      vertices: "Vertices",
      faces: "Faces",
      summary: "{format} · {vertices} vertices",
      title: "Title",
      author: "Author",
      authorAffiliation: "Author affiliation",
      license: "License",
      description: "Description",
      objectType: "Object type",
      reconstructionAuthors: "Reconstruction authors",
      reconstructionPeriod: "Reconstruction period",
      move: "Move",
      close: "Close",
    },
    manifesto: {
      source: "Manifest type",
      refreshExamples: "Refresh the example list",
      invalidUrl: "Please enter a valid manifesto URL.",
      invalidJson: "Please enter a valid manifesto JSON text.",
      scene: "Scene",
      sceneNumber: "Scene {number}",
      camera: "Camera",
      cameraNumber: "Camera {number}",
      treeView: "Tree",
      jsonView: "JSON",
      expandAll: "Expand all",
      collapseAll: "Collapse all",
      treeItems: "{count} items",
      treeItem: "{count} item",
      treeKey: "{count} key",
      treeKeys: "{count} keys",
      treeEditHint: "Click to edit, Enter to confirm, Esc to cancel",
      retargetTitle: "Use these settings with another model",
      retargetHint: "Lights, rendering and shading stay; annotations, thumbnails, the timeline and the section planes belong to the current model and are left out.",
      retargetPlaceholder: "Model URL (GLB, glTF, OBJ, ...)",
      retargetKeepCamera: "Keep the camera",
      retargetApply: "Apply",
      retargetInvalidUrl: "Enter the URL of a model.",
      retargetNoModel: "No model is loaded whose settings could be used.",
      retargetDone: "Settings applied to {model}. The new manifest is in the text field.",
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
      optionP4Local: "Camera, lights and comments (localhost)",
      optionCamera: "Positioned camera",
      optionLights: "Lights with colours and intensities",
      optionComments: "Comments with their own views",
    },
    aim3if: {
      loader: "AIM3D Loader",
      collapse: "Collapse",
      expand: "Expand",
      modelConfig: "Model configuration",
      loadFromUrl: "Load from URL",
      loadFromText: "Load from Text",
      manifestUrlPlaceholder: "https://example.org/aim3d/manifest.json",
      manifestTextPlaceholder: "Paste AIM3D manifest JSON here...",
      optionDefault: "Default configuration",
      optionBox: "Box configuration",
      optionBoxLocal: "Box (localhost)",
      optionWolpaLocal: "Wolpa Synagogue (localhost)",
      optionWolpaLocalCeiling: "Wolpa Synagogue - ceiling view (localhost)",
      optionWolpaGoldenHour: "Wolpa Synagogue - golden hour, ACES (localhost)",
      optionWolpaStudio: "Wolpa Synagogue - studio, AgX (localhost)",
      optionWolpaNight: "Wolpa Synagogue - night spotlights, Reinhard (localhost)",
      optionWolpaNightTour: "Wolpa Synagogue - night, annotations and guided tour (localhost)",
      optionWolpaCertainty: "Wolpa Synagogue - Level of Certainty (localhost)",
      optionWolpaToon: "Wolpa Synagogue - toon shading (localhost)",
      optionWolpaOvercast: "Wolpa Synagogue - overcast, Lambert, Cineon (localhost)",
      optionWolpaClayAo: "Wolpa Synagogue - clay, ambient occlusion (localhost)",
      optionWolpaRaking: "Wolpa Synagogue - raking light, sweeping, clay (localhost)",
      optionWolpaRakingTexture: "Wolpa Synagogue - raking light on the textures (localhost)",
      optionWolpaMatcap: "Wolpa Synagogue - matcap studio clay (localhost)",
      optionWolpaFlat: "Wolpa Synagogue - flat shading, faces shown (localhost)",
      optionWolpaNormals: "Wolpa Synagogue - surface normals (localhost)",
      optionWolpaContours: "Wolpa Synagogue - custom shader: contour lines (localhost)",
      optionWolpa4D: "Wolpa Synagogue - 4D timeline: weathering 1730-1936 (localhost)",
    },
    localPreview: {
      loadExampleModel: "Load example model",
      noExampleModel: "Other model",
    },
    embedPanel: {
      title: "Embed options",
      closeAria: "Close embed options",
      modelUrl: "Model URL",
      modelUrlPlaceholder: "/examples/box.glb",
      entityId: "Entity ID",
      theme: "Theme",
      themeDark: "Dark",
      themeLight: "Light",
      autoRotateSpeed: "Auto-rotate speed",
      cameraPosition: "Position",
      cameraTarget: "Target",
      cameraVectorPlaceholder: "x,y,z",
      fov: "FOV",
      autoRotate: "Auto-rotate",
      disableInteraction: "Disable interaction",
      hideActionMenu: "Hide action menu",
      hideMetadata: "Hide metadata",
      presentationMode: "Presentation mode",
      useCurrentCamera: "Current camera",
      useCurrentCameraHint: "The camera of the viewer behind this window",
      resetFromViewer: "Reset",
      resetFromViewerHint: "All the options as the viewer has them",
      copyUrl: "Copy URL",
      copyIframe: "Copy iframe",
      sectionModel: "Model",
      sectionLook: "Look",
      sectionCamera: "Camera",
      sectionBehaviour: "Behaviour",
      language: "Language",
      languageAuto: "Viewer's default",
      aspect: "Proportions",
      vectorHint: "Give all three numbers, or none",
      fovHint: "FOV: a number from 1 to 179",
      reload: "Reload the preview",
      openTab: "Open in a new tab",
      noSource: "A model URL or an entity ID is needed: a model opened from this device is not on the web.",
      embedUrl: "Embed URL",
      iframeCode: "Iframe code",
      preview: "Preview",
      previewTitle: "Embed preview",
    },
    uploadPanel: {
      username: "Username",
      password: "Password",
      login: "Log in",
      logout: "Log out",
      register: "Register",
      showPassword: "Show password",
      hidePassword: "Hide password",
      limitsUploads: "Uploads",
      limitsHour: "{used}/{limit} this hour",
      limitsDay: "{used}/{limit} today",
      limitsStorage: "Storage: {used}/{limit} MB",
      limitsModels: "Models: {used}/{limit}",
      limitRateHour: "Upload limit reached ({limit} per hour). Try again in {minutes} min.",
      limitRateDay: "Daily upload limit reached ({limit} per day). Try again in {minutes} min.",
      limitConcurrent: "You already have {limit} model(s) being converted. Wait until they finish.",
      limitStorage: "Storage limit reached ({limit} MB). Delete a model to free space.",
      limitModels: "Model limit reached ({limit}). Delete a model to upload a new one.",
      title: "Upload & convert model",
      closeAria: "Close upload panel",
      fileLabel: "3D model file",
      urlLabel: "…or a link to the file",
      urlPlaceholder: "https://example.org/model.glb",
      urlInvalid: "Enter a full link starting with https:// or http://.",
      urlNoFile: "The link must point to a model file, e.g. …/model.glb.",
      chooseFileOrUrl: "Choose a file or paste a link to one.",
      downloading: "Downloading the file...",
      urlFetchError: "Could not import the link: {reason}",
      urlUnsupported: "This repository cannot import from links.",
      formatsHint: "Supported: abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, glb, usd/usda/usdc/usdz, step/stp, iges/igs, 3mf, gltf, 3ds, pcd, xyz, amf, kmz, vox, lwo, point clouds las/laz/e57, Gaussian splats spz/splat/ksplat/sog/rad, or a .zip archive containing one of these. STEP/IGES, 3MF and USD are converted to GLB; the gltf … lwo group is uploaded as-is, without thumbnails; point clouds (and a .ply without faces) become streamed 3D Tiles, except a .ply of Gaussian splats, which is shown as uploaded.",
      submit: "Upload & convert",
      uploading: "Uploading...",
      private: "Private",
      privateHint: "Only you and admins see it in the model list; anyone with its link can still open it.",
      tooLargeWorker: "The server refused the file: {reason}",
      tooLargeCloudflare: "The file is larger than Cloudflare lets through (100 MB on the Free and Pro plans), so it never reached the server.",
      tooLargeProxy: "A proxy in front of the server refused the file as too large (nginx client_max_body_size).",
      unsupportedFormat: "Unsupported file format: .{ext}",
      webglUnavailable: "WebGL is unavailable in your browser. Enable hardware acceleration or update your graphics drivers.",
      uploadError: "Upload failed. Please try again.",
    },
    loginPanel: {
      title: "Account",
      closeAria: "Close account panel",
      notRequired: "Accounts are not enabled on this server.",
      openSignedIn: "Signed in as {user}",
      planTitle: "Plan bought in the app",
    },
    modelsPanel: {
      title: "Previously generated models",
      closeAria: "Close models panel",
      empty: "No previously generated models yet.",
      loadError: "Could not load previous models.",
      deleteAria: "Delete {name}",
      makePrivate: "Make {name} private - only you and admins see it in this list",
      makePublic: "{name} is private - show it to everyone",
      deleteConfirm: 'Delete "{name}"? This permanently removes the converted model and its renders.',
      deleteAction: "Delete",
      deleteCancel: "Cancel",
      repositoryLabel: "Repository address",
      repositorySave: "Connect",
      noRepository: "Enter the repository address to browse its models.",
      saveOffline: "Keep {name} on this device",
      savedOffline: "{name} is on this device",
      offline: "No internet connection. Models on this device still work.",
      unreachable: "The repository is not responding. Models on this device still work.",
    },
    modelMetadata: {
      title: "Describe the model",
      editTitle: "Edit model metadata",
      intro: "Fields marked * are required. The type, place, date and unit also help to pick the model's scale and lighting.",
      choose: "Choose...",
      notSpecified: "Not specified",
      unitUnknown: "Unknown",
      unitHint: "What one unit of the file measures - for the scale.",
      datePlaceholder: "e.g. 1890, 15th c., 2024-05-12",
      copyrightPlaceholder: "e.g. © 2024 Museum of ...",
      locationPlaceholder: "e.g. Kraków, Wawel Hill",
      required: "Enter the name and choose the type.",
      cancel: "Cancel",
      save: "Save",
      upload: "Upload & convert",
      edit: "Edit metadata",
      add: "Add metadata",
      editAria: "Edit the metadata of {name}",
      saveError: "Could not save the metadata: {reason}",
      unsupported: "this repository does not keep metadata",
      fields: {
        name: "Name",
        type: "Type",
        author: "Author",
        copyright: "Copyright",
        license: "Licence",
        date: "Date",
        location: "Place",
        unit: "Model unit",
        description: "Description",
      },
      types: {
        building: "Building / architecture",
        interior: "Interior",
        urban: "Town / settlement",
        site: "Site / landscape",
        object: "Object / artefact",
        sculpture: "Sculpture / architectural detail",
        other: "Other",
      },
      licenses: {
        "public-domain": "Public domain",
        "all-rights-reserved": "All rights reserved",
      },
      units: { m: "metres", cm: "centimetres", mm: "millimetres", in: "inches", ft: "feet" },
    },
    modelsMeta: {
      uploadedBy: "Uploaded by",
      private: "Private: only its owner and admins see it in this list",
      uploaded: "Uploaded",
      saved: "Saved",
      size: "Size",
    },
    libraryPanel: {
      title: "Models on this device",
      closeAria: "Close",
      browse: "Browse files…",
      empty: "No models on this device yet.",
      fromRepository: "From the repository",
      fromDevice: "From this device",
      deleteAria: "Remove {name} from this device",
      deleteConfirm: 'Remove "{name}" from this device?',
      deleteAction: "Remove",
    },
    modelsSource: {
      aria: "Where the models come from",
      local: "On this device",
      remote: "Remote",
      examples: "Examples",
    },
    examplesPanel: {
      title: "Example manifests",
      closeAria: "Close",
      aim3d: "AIM3D manifests",
      iiif: "IIIF manifests",
      bundled: "In the app, works offline",
      online: "Needs an internet connection",
      refresh: "Refresh",
    },
    ai: {
      disclaimer: "Generated by AI - check it before relying on it.",
      thinking: "The AI assistant is looking at it...",
      offline: "The AI assistant could not be reached.",
      failed: "The AI assistant could not answer.",
      timeout: "The AI answer took too long. Try again or ask a narrower question.",
      unavailable: "The AI assistant is temporarily unavailable.",
      rateLimited: "AI request limit reached. Try again later.",
      locked: "Available with the Business plan",
      validation: {
        explain: "Explain in plain language (AI)",
        explainHint: "Sends the model check report (not the model) to the AI assistant.",
        title: "Explained by AI",
        fix: "What to do: ",
      },
      ifc: {
        toggle: "Ask the building model (AI)",
        title: "Ask the model",
        placeholder: "e.g. load-bearing walls on level 2",
        ask: "Ask",
        hint: "The question and a summary of the property names (not the model) go to the AI assistant. It builds a filter; the viewer applies it to the real data.",
        examples: "Examples",
        example1: "All windows",
        example2: "Load-bearing walls",
        example3: "Total slab area",
        found: "{count} element(s) found",
        noneFound: "No element matches.",
        notUnderstood: "This cannot be answered from the model's properties.",
        aggregate: {
          count: "Count: {value}",
          sum: "Sum of {property}: {value}",
          average: "Average {property}: {value}",
          min: "Minimum {property}: {value}",
          max: "Maximum {property}: {value}",
        },
        missingValues: "{count} matching element(s) have no {property}.",
        filter: "Filter",
        show: "Highlight",
        isolate: "Show only these",
        hide: "Hide these",
        reset: "Show all",
        list: "Elements",
        close: "Close",
        noData: "This model has no IFC properties.",
        selection: "About: {element}",
        clearSelection: "Ask about the whole model",
        selectionExample1: "Elements like this",
        selectionExample2: "Elements of this type on this storey",
        selectionExample3: "How many elements of this type?",
      },
      variants: {
        describe: "Compare and review paradata (AI)",
        describeHint: "Sends the variants' texts, sources, certainty and measurements (not the model) to the AI assistant.",
        title: "Variants compared by AI",
        differences: "Differences",
        paradata: "Paradata review",
        status: { ok: "Documented", incomplete: "Incomplete", inconsistent: "Inconsistent" },
        suggestions: "Suggestions: ",
      },
    },
    validationReport: {
      title: "Validation report",
      download: "Download the report (JSON)",
      refresh: "Check again",
      close: "Close",
      checking: "Checking...",
      noModel: "Open a model to check it.",
      passed: "{passed}/{total}",
      passedLabel: "passed",
      ready: "Ready",
      mostlyReady: "Mostly ready",
      notReady: "Not ready",
      readyHint: "Every check passed: the model and its manifest are ready for public reuse.",
      mostlyReadyHint: "The model can be published. Review the remaining items first.",
      notReadyHint: "Some values cannot be used. Fix the failed items before publishing.",
      pass: "Pass",
      review: "Needs review",
      fail: "Fail",
      notSet: "Not set",
      notChecked: "Not checked",
      notSetHint: "The manifest does not set this yet.",
      noIssues: "No issues.",
      moreIssues: "...and {count} more (download the report)",
      modelCheck: "Model file check (glTF-Validator)",
      modelCheckHint: "Is the model file valid glTF that works in all browsers?",
      modelNotChecked: "Only models converted by the upload worker are checked.",
      validatorMissing: "glTF-Validator is not installed on the worker.",
      errorsCount: "{count} error(s)",
      warningsCount: "{count} warning(s)",
      details: "Details",
      file: "File",
      fileSize: "File size",
      triangles: "Triangles",
      vertices: "Vertices",
      materials: "Materials",
      textures: "Largest texture",
      size: "Size",
      generator: "Made with",
      attributes: "Manifest attributes",
      attributesValue: "{count} checked: {errors} error(s), {warnings} warning(s), {unknown} unknown",
      features: {
        materials: "Materials",
        model: "3D model",
        metadata: "Descriptive metadata",
        rights: "Rights and attribution",
        annotations: "Annotations",
        camera: "Camera view",
        lights: "Lights",
        "raking-light": "Raking light",
        clipping: "Section planes",
        timeline: "4D timeline",
        variants: "Reconstruction variants",
        compare: "Comparison view",
        photos: "Historical photos",
        location: "Geographic location",
        sun: "Sun study",
        weather: "Weather",
        certainty: "Level of certainty",
        thumbnails: "Thumbnails",
        transform: "Model transform and shading",
        rendering: "Rendering and environment",
        tour: "Guided tour",
        settings: "Viewer settings",
        manifest: "IIIF structure",
      },
      hints: {
        model: "Does the manifest paint a model with a usable URL and format?",
        metadata: "Are label, summary and metadata filled in, in every language?",
        rights: "Are the licence (rights) and the attribution (requiredStatement) set?",
        annotations: "Do the annotations have a body and a target in this scene?",
        manifest: "Are ids, types and the IIIF structure right?",
      },
    },
    // Plan names (admin and account panels); an app build adds the rest.
    plans: {
      free: "Free",
      pro: "Pro",
      business: "Business",
      enterprise: "Enterprise",
    },
    exadmin: {
      title: "Administration",
      navUsers: "Users",
      backToViewer: "Back to the viewer",
      language: "Language",
      loading: "Loading...",
      loginTitle: "Log in as an administrator",
      notAdmin: "{user} is not an administrator.",
      accountsOff: "Accounts are not enabled on this server, so there is nothing to administer here.",
      unreachable: "The server is not responding.",
    },
    adminPanel: {
      lastUpload: "last upload {date}",
      sortBy: "Sort by",
      sortPlan: "Plan",
      sortName: "Name",
      sortModels: "Uploaded models",
      sortStorage: "Storage used",
      sortLastUpload: "Last upload",
      sortAscending: "Ascending",
      sortDescending: "Descending",
      limitsUsage: "Uploads {hour} this hour, {day} today · Storage {storage} MB · Models {models}",
      planRenews: "renews/ends {date}",
      planChecked: "checked {date}",
      limitsShow: "Edit limits",
      limitsHide: "Hide limits",
      limitsAdmin: "Admins are not limited.",
      limitsBusiness: "Business or Enterprise plan: the Business limits are the defaults here.",
      planCurrent: "Plan: {plan}",
      planPurchase: "bought in the app: {plan}",
      planGrant: "granted: {plan}",
      planGrantUntil: "granted: {plan} until {date}",
      planShow: "Change plan",
      planHide: "Hide plan",
      planGrantLabel: "Granted plan",
      planNone: "None (only what was bought)",
      planUntil: "Until (empty = no end)",
      planHint: "The higher of the granted and the bought plan applies, in the app and for the upload limits.",
      planSave: "Save plan",
      planSourceAdmin: "granted by an admin",
      limitsDefault: "default: {value}",
      limitsHint: "Empty = default, 0 = unlimited.",
      limitsSave: "Save limits",
      limitsReset: "Use defaults",
      limitUploadsPerHour: "Uploads per hour",
      limitUploadsPerDay: "Uploads per day",
      limitStorageMb: "Storage (MB)",
      limitMaxModels: "Max models",
      limitConcurrentJobs: "Concurrent conversions",
      title: "Manage users",
      closeAria: "Close user management panel",
      empty: "No registered users yet.",
      loadError: "Could not load the user list.",
      approve: "Approve",
      disable: "Disable",
      promote: "Promote",
      demote: "Demote",
      delete: "Delete",
      cannotDeleteSelf: "You cannot delete your own account.",
      deleteConfirm: 'Delete user "{user}"? This permanently removes their account.',
      deleteAction: "Delete",
      deleteCancel: "Cancel",
      modelsCount: "{count} models",
      modelsShow: "Show models",
      modelsHide: "Hide models",
      modelsEmpty: "No models uploaded yet.",
      modelsLoadError: "Could not load this user's models.",
      modelDeleteAria: "Delete {name}",
      modelEditAria: "Edit upload details of {name}",
      modelOwner: "Uploaded by",
      modelUploadedAt: "Uploaded on",
      modelNoOwner: "No owner",
      modelSave: "Save",
      unownedTitle: "Uploads without an owner",
      modelDeleteConfirm: 'Delete "{name}"? This permanently removes the converted model and its renders.',
    },
    eventLog: {
      title: "Event log",
      copy: "Copy",
      clear: "Clear",
      copied: "Log copied.",
      empty: "Nothing logged yet.",
    },
    loadingLog: {
      fullQuality: "Preview · loading full quality...",
      fullQualityProgress: "Preview · loading full quality {percent}%",
      pointCloudPreview: "Preview · building the full point cloud...",
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
      uploadingFile: "Uploading file",
      downloadingFile: "Downloading file",
      uploadedBytes: "{percent}% · {loaded} / {total} MB",
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
      webglOnlyModel: "Point clouds and Gaussian splats need the WebGL renderer: open the viewer without ?renderer=webgpu.",
      webglOnlyFeature: "{feature} needs the WebGL renderer.",
      pointCloudThinned: "Large point cloud: showing {loaded} of {total} points. Convert it with the worker for full-resolution streaming.",
      pointCloudLoaded: "Point cloud loaded: {count} points.",
      pointCloudIncomplete: "The point cloud did not load completely; showing the points that arrived.",
      tiledAnnotationBlocked: "Annotations are not available for streamed (3D Tiles / Potree) models.",
      pointAnnotationHint: "Click a point of the point cloud to annotate it.",
      profileStart: "Click the first end of the profile line on the point cloud.",
      profileSecond: "Now click the second end.",
      profileTooShort: "The two ends lie above each other; click two points apart.",
      fullModelLoaded: "Full-quality model loaded.",
      fullModelLoadError: "Could not load the full-quality model; showing the preview.",
      previewAnnotationBlocked: "Annotations can be added once the full-quality model has loaded.",
      transformMove: "Move: drag axis arrows to reposition the object.",
      transformRotate: "Rotate: drag rotation rings to rotate the object. Hold Shift for snapping.",
      transformScale: "Scale: drag axis handles to resize the object. Hold Shift for snapping.",
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
      invalidJSON: "Invalid JSON: {error}",
      missingJsonSettings: "Required configuration file is missing: {url} (HTTP {status})\nThe viewer cannot start without \"viewer-settings.json\".\nPlease verify that the file was copied during the build/deployment.",

      presentationModeError: "An error occurred during presentation mode setup.",
      objLoaded: "OBJ model has been loaded.",
      mtlLoadError: "Error occurred while loading attached MTL file.",
      glbLoadError: "Error occurred while loading attached GLB file.",
      unsupportedExtension: "File extension is not supported yet.",
      modelLoaded: "Model {filename} has been loaded.",
      upAxisNotForTiles: "The up axis cannot be changed for a streamed (tiled) model.",
      modelLoadedSimple: "Model loaded successfully.",
      unsupportedFormat: "Unsupported file format.",
      presentationModeReady: "Presentation mode is ready.",
      presentationModeError: "An error occurred during presentation mode setup.",
      sandboxDropModel: "Drag and drop a 3D model into the viewer.",
      supportedFormats: "<strong>Supported formats</strong>:\n{formats}\nand <strong>archive formats</strong>: {archives}.",

      embedSourceMissing: "Set Model URL or Entity ID for embed.",
      embedUrlCopied: "Embed URL copied.",
      embedUrlCopyError: "Could not copy embed URL.",
      embedIframeCopied: "Embed iframe copied.",
      embedIframeCopyError: "Could not copy embed iframe.",
      embedCodeCopied: "Embed code copied to clipboard.",
      embedCodeCopyError: "Could not copy embed code.",
      shareUrlCopied: "Share view URL copied.",
      shareUrlCopyError: "Could not copy share view URL.",
      invalidManifest: "Invalid AIM3D manifest.",
      manifestValidationFailed: "AIM3D manifest validation failed.",

      uploadStarted: "Upload received - converting model...",
      uploadReady: "Converted model is ready.",
      pointCloudPreview: "Showing a preview of the point cloud; the full-resolution version follows when it is converted.",
      uploadLoginRequired: "You must log in to upload files. Don't have an account? Use the account icon to register.",
      uploadError: "Model upload or conversion failed.",
      userUpdated: "User updated.",
      userDeleted: "User deleted.",
      modelDeleted: "Model deleted.",
      modelMadePrivate: "The model is private: only you and admins see it in the list.",
      modelMadePublic: "The model is listed for everyone again.",
      modelVisibilityError: "Could not change who sees the model.",
      modelMetadataSaved: "Model metadata saved.",
      modelMetadataError: "The model is uploading, but its metadata could not be saved - add it in the model details.",
      exampleManifestError: "Could not load the example manifest.",
      exampleListRefreshFailed: "Could not refresh the example list - showing the last one loaded.",
      modelUpdated: "Model details saved.",
      previewSaved: "Main thumbnail changed.",
      thumbnailsGenerating: "Generating thumbnails…",
      thumbnailsGenerated: "Thumbnails generated.",
      thumbnailsNotOwner: "Only the person who uploaded this model (or an admin) can change its thumbnails.",
      previewSaveError: "Could not save the preview.",
      previewNotUploaded: "Thumbnails can be saved only for models uploaded to the repository.",
      modelDeleteError: "Failed to delete the model.",
      librarySaved: "Model saved on this device.",
      librarySaveError: "Could not save the model on this device.",
      repositoryUrlInvalid: "That is not a valid repository address.",
      repositoryUnreachable: "The repository is not responding - try again later.",
      planLocked: "Available in the Business plan.",
      planPurchased: "Thank you! Your plan is active.",
      planPurchaseError: "The purchase did not go through - try again later.",
      planRestored: "Purchases restored.",
      planRestoreNone: "No purchases to restore.",
      planLinked: "Logged in. Your account's plan applies on this device.",
      planLinkError: "Could not log in: {message}",

      annotationDataMissing: "Annotation data not found for this POI.",
      selectFaceRequired: "Select at least one face to add annotation.",
      selectFaceRequiredAgain: "Select at least one face, then run Add annotations again.",
      noFacesSelected: "No faces selected for annotation.",
      titleRequired: "Title is required.",
      facesInactive: "Selected faces are no longer active.",

      annotationsSaved: "Annotations saved for {count} face{plural}.",
      annotationsImported: "Imported {count} annotation{plural}.",
      annotationsImportedFromManifest: "Imported {count} annotation{plural} from the manifest.",
      xrUnavailable: "This browser has no VR or AR.",
      xrFailed: "VR or AR could not be started.",
      photoViewSaved: "Photo view saved.",
      photoLoadFailed: "The photo could not be loaded.",
      photoCameraDenied: "The camera was not allowed. Allow it in the browser to see the photo on site.",
      photoCameraUnavailable: "No camera here (it needs HTTPS and a browser that offers one).",
      annotationsExported: "Annotations XML exported.",
      tourNoAnnotations: "Add annotations to the model to start a guided tour.",
      noAnnotationsToExport: "No annotations to export.",
      noValidAnnotations: "No valid annotations found in XML.",
      annotationsImportError: "Failed to import annotations XML.",
      noValidAnnotationsInManifest: "No valid annotations found in AIM3IF manifest.",
      manifestImportedWithoutAnnotations: "AIM3IF manifest imported. Viewer settings were applied (no annotations in manifest).",

      settingsSaved: "Settings have been saved.",
      settingsSaveError: "Error saving settings.",
      settingsNotUploaded: "Settings can be saved only for models uploaded to the repository.",
      settingsNotOwner: "Only the person who uploaded this model (or an admin) can save its settings.",

      featureToggle: "{feature} is {state}.",
      clippingHelperToggle: "Clipping plane {axis} helper {state}.",

      clippingPlanes: "Drag active clipping plane helper to adjust cut",

      downloadSuccess: "Model downloaded successfully.",
      downloadError: "Failed to download model.",

      iiifManifestGenerated: "IIIF manifest has been generated.",
      iiifManifestGenerationError: "Error generating IIIF manifest.",

      containerNotFound: "Container element not found. Please check the Viewer configuration.",
      missingFiles: "Missing required files for the Viewer. Please check the Viewer configuration.",
      unsupportedFileFormat: "Unsupported file format.",

      performanceModeSet: "Performance mode set to {mode}.",
      shadingModeApplied: "Shading mode set to {mode}.",
      customShaderError: "The custom shader does not compile:",
      angleHint: "Click a start point, the vertex and an end point to measure an angle.",
      areaHint: "Click the corners of an area. Click the first point again or press Enter to close it.",
      clippingEnabled: "Section planes are on. Drag a coloured plane or use the sliders.",
      clippingDisabled: "Section planes are off.",
    },
    pointCloud: {
      title: "Point cloud",
      toggle: "Point cloud settings",
      collapse: "Hide settings",
      expand: "Show settings",
      size: "Point size ×{value}",
      sizeMode: "Size",
      sizeModes: {
        adaptive: "Adaptive (scan density)",
        fixed: "Fixed (pixels)",
      },
      shape: "Shape",
      color: "Colour",
      edl: "Eye-Dome Lighting {value}%",
      streamed: "Streamed: detail loads as you zoom in.",
      points: "{total} points",
      thinned: "{loaded} of {total} points",
      shapes: {
        square: "Square",
        round: "Round",
        sphere: "Sphere",
      },
      classesTitle: "Classes",
      autoClassified: "Classes assigned automatically from the geometry - check before relying on them.",
      autoClassifiedModel: "Classes assigned automatically by a model - check before relying on them.",
      classOther: "Class {value}",
      profile: "Profile",
      drawProfile: "Draw profile",
      cancelProfile: "Cancel",
      clearProfile: "Clear profile",
      profileWidth: "Profile width {value}",
      classNames: {
        0: "Never classified",
        1: "Unclassified",
        2: "Ground",
        3: "Low vegetation",
        4: "Medium vegetation",
        5: "High vegetation",
        6: "Building",
        7: "Low point (noise)",
        8: "Model key point",
        9: "Water",
        10: "Rail",
        11: "Road surface",
        12: "Overlap",
        13: "Wire guard",
        14: "Wire conductor",
        15: "Transmission tower",
        16: "Wire insulator",
        17: "Bridge deck",
        18: "High noise",
      },
      colorModes: {
        rgb: "RGB",
        intensity: "Intensity",
        height: "Height",
        classification: "Classification",
        tile: "Detail levels",
      },
    },
    certainty: {
      short: "LoC",
      field: "Level of Certainty (LoC)",
      legendTitle: "Level of Certainty (LoC)",
      none: "— not assessed —",
      scope: "Applies to",
      scopeObject: "Object",
      scopeGroup: "Group (parent object)",
      unassessed: "Not assessed",
      assessedCount: "Assessed objects",
      opacity: "Overlay opacity",
      filter: "Show only this level (click again to undo)",
      selectAll: "Select all",
      selectNone: "Select none",
      showView: "Show Level of Certainty",
      hideView: "Hide Level of Certainty",
    },
    tour: {
      panel: "Guided tour",
      start: "Start guided tour",
      stop: "Stop guided tour",
      step: "Step {current} / {total}",
      previous: "Previous step (P)",
      next: "Next step (N)",
      play: "Play tour",
      pause: "Pause tour",
      close: "Close tour (Esc)",
      untitled: "Untitled annotation",
      saveView: "Save current camera view for the tour",
      replaceView: "Replace the saved tour view with the current camera view",
      annotationCount: "Annotations: {count}",
      idleHint: "Play the guided tour through the saved annotations, or step through them with ‹ ›.",
      dismiss: "Hide guided tour",
      showLeaderLines: "Show annotation leader lines",
      hideLeaderLines: "Hide annotation leader lines",
      showSpread: "Open all annotations around the model",
      hideSpread: "Close annotations around the model",
      spreadLayer: "Annotations",
      showStack: "Show annotations as cards",
      hideStack: "Hide annotation cards",
      stackLayer: "Annotation cards",
    },
    animation: {
      player: "Animation player",
      clip: "Animation clip",
      allClips: "All clips",
      timeline: "Animation time",
      speed: "Playback speed",
      play: "Play (K)",
      pause: "Pause (K)",
      loopOn: "Loop: on",
      loopOff: "Loop: off",
    },
    xr: {
      toggle: "View in VR or AR",
      title: "VR and AR",
      close: "Close",
      enterVr: "View in VR",
      exitVr: "Exit VR",
      enterAr: "View in AR",
      exitAr: "Exit AR",
      quickLook: "Open in AR Quick Look",
      preparing: "Preparing the model…",
      arScale: "Size in AR",
      scaleTable: "On a table",
      scaleReal: "Real size",
      checking: "Checking what this device offers…",
      unsupported: "This browser offers neither VR nor AR. Open the viewer in a headset's browser, or on a phone.",
      vrHint: "Point a controller at the ground and pull the trigger to move there.",
      hint: "The model is shown at real size in VR; in AR on a table or at real size.",
    },
    sun: {
      title: "Sun and shadows",
      close: "Switch the sun off",
      time: "Time of day",
      date: "Day",
      followTimeline: "Year of the timeline",
      latitude: "Latitude",
      longitude: "Longitude",
      north: "North (°)",
      northHint: "Where north lies in the scene: degrees clockwise from -Z, seen from above",
      play: "Play the day",
      pause: "Pause the day",
      position: "Sun {azimuth}° {compass}, {elevation}° above the horizon",
      night: "The sun is below the horizon",
      riseSet: "sunrise {sunrise}, sunset {sunset}",
    },
    weather: {
      title: "Weather",
      off: "Off",
      close: "Close",
      clear: "Clear sky",
      fog: "Fog",
      rain: "Rain",
      snow: "Snow",
      storm: "Thunderstorm",
      intensity: "Intensity",
      wind: "Wind",
      windDirection: "Wind direction",
      mistHeight: "Mist height",
      mistDensity: "Mist density",
      mistSpread: "Mist spread",
      sky: "Sky",
      surfaces: "Wet surfaces and snow cover",
      sound: "Sound",
    },
    scene: {
      title: "Suggested scene",
      semantic: {
        button: "Read the texts with a language model (about {size} MB, downloaded once)",
        retry: "Try the language model again",
        starting: "Loading the language model…",
        loading: "Loading the language model… {percent}%",
        reading: "Reading the texts…",
        failed: "The language model could not be loaded.",
        done: "The language model read {passages} passages of the texts.",
        nothing: "There is no text for the language model to read.",
      },
      close: "Close",
      intro: "Picked by rules from the file name, the metadata, the manifest and the model's size and materials. Nothing changes until you apply it.",
      basis: "What it is based on",
      apply: "Apply the ticked",
      undo: "Undo",
      applied: "Applied. Undo puts back what was there before.",
      undone: "Put back as it was.",
      suggested: "(suggested)",
      on: "on",
      off: "off",
      unchanged: "as it is",
      sunYearTimeline: "the timeline's year",
      purpose: {
        documentation: "Documentation",
        presentation: "Presentation",
      },
      confidence: {
        high: "sure",
        medium: "fairly sure",
        low: "unsure",
      },
      setting: {
        outdoor: "outdoors",
        indoor: "indoors",
        studio: "an object on its own",
      },
      size: {
        object: "a small object",
        "large-object": "a large object",
        building: "a building",
        site: "a site or landscape",
      },
      kind: {
        mesh: "Model: a mesh",
        pointcloud: "Model: a point cloud",
        splats: "Model: Gaussian splats",
      },
      unit: {
        user: "unit set by you",
        manifest: "unit from the manifest",
        file: "unit from the file",
        config: "unit from the settings",
        default: "unit unknown, taken as metres",
      },
      source: {
        manifest: "the manifest",
        text: "the metadata",
        timeline: "the timeline",
        year: "a year in the metadata",
        century: "a century in the metadata",
        geonames: "a place the texts name (GeoNames)",
      },
      season: {
        winter: "winter",
        spring: "spring",
        summer: "summer",
        autumn: "autumn",
      },
      sunTime: {
        sunsetBefore: "{hours} h before sunset",
        sunsetAfter: "{hours} h after sunset",
        sunriseBefore: "{hours} h before sunrise",
        sunriseAfter: "{hours} h after sunrise",
      },
      fact: {
        size: "Size: {size} ({unit})",
        baked: "Lighting already in the textures or colours (a scan or splats)",
        location: "Place: {place} (from {source})",
        year: "Year: {year} (from {source})",
        keywords: "Words found: {words}",
        semantic: "Texts read by a language model ({model}, in the browser)",
        shape: "Geometry: faces up {up}, down {down}, sideways {sideways}; ground {ground} of the footprint; walls seen from inside {enclosure} of directions",
        setting: "Setting: {setting} ({confidence})",
      },
      uncertain: {
        place: "The place is unknown: the sun is that of the default place (50° N, 10° E). Set it in Sun and shadows.",
        placeGuess: "The place is a guess: {name}. Check it in Sun and shadows.",
      },
      reason: {
        keywords: "the texts say {words}",
        size: "its size: {size}",
        ifc: "an IFC building model",
        noEvidence: "nothing tells where it is",
        splatsBaked: "Gaussian splats carry their own lighting",
        pointsNoNormals: "points without normals take no light",
        notOutdoor: "not outdoors: {setting}",
        documentationNeutral: "documentation: an even light that hides nothing",
        outdoorPresentation: "outdoors, presented in its own light",
        bakedSun: "the textures have light and shadow of their own",
        place: "the place from {source}",
        placeNamed: "the texts name {name} (GeoNames)",
        semantic: "the language model reads {setting} ({percent}%)",
        semanticPurpose: "the language model reads: {purpose} ({percent}%)",
        semanticRelief: "the language model reads relief to read ({percent}%)",
        enclosed: "walls all round, seen from inside ({percent}% of directions)",
        ceiling: "a ceiling over a floor",
        ground: "an open ground ({percent}% of the footprint)",
        flat: "flat and wide: a site or terrain",
        thinPlate: "a thin plate: relief to read",
        yearTimeline: "the year follows the timeline",
        year: "the year {year}, from {source}",
        season: "season: {season}",
        timeDawn: "morning, as the texts say",
        timeNoon: "noon, as the texts say",
        timeDusk: "evening, as the texts say",
        timeAfternoon: "late afternoon: a low sun with long shadows shows the shape",
        hidesGeometry: "documentation: a weather would hide the geometry",
        weatherNamed: "the texts say {words}",
        clearSky: "a clear sky with haze towards the horizon",
        phoneLighter: "lighter on a phone",
        presentationNoRaking: "presentation: the raking light is for reading relief",
        relief: "relief to read: {words}",
        studioRelief: "an object: grazing light shows its surface",
        noRelief: "no relief mentioned",
        noNormals: "the model has no normals",
        agxSun: "AgX keeps the sun's highlights",
        neutralColours: "Neutral keeps the colours true",
        aoPoints: "not for point clouds",
        phonePerformance: "too heavy for a phone",
        bakedAo: "the shading is in the textures already",
        aoHeavy: "too many triangles",
        aoShape: "contact shadows bring out the shape",
        unlit: "the materials ignore light",
      },
    },
    photos: {
      title: "Historical photos",
      closePanel: "Close",
      empty: "No photos yet. Add one taken from the current view.",
      opacity: "Photo",
      swipe: "Divider instead of fading",
      divider: "Drag to compare the photo with the model",
      return: "Back to the photo's view",
      hide: "Hide photo",
      align: "Align",
      cancelAlign: "Stop aligning",
      alignHint: "Move the camera until the model lies over the photo, then set the lens and the tilt.",
      fov: "Lens (field of view)",
      roll: "Tilt",
      save: "Save view",
      remove: "Remove photo",
      add: "Add a photo",
      url: "Image URL or IIIF info.json",
      label: "Title",
      year: "Year",
      addUrl: "Add",
      addFile: "From file…",
      onSite: {
        open: "On site (camera)",
        openTitle: "Lay the photo over the place through the camera",
        pick: "Tap the photo to see on site.",
        title: "The photo on site",
        close: "Close the camera",
        hint: "Stand where the photo was taken. Drag the photo with one finger, pinch and turn it with two, until it lies over the place.",
        starting: "Starting the camera…",
        fade: "Fade",
        divider: "Divider",
        dividerHandle: "Drag to compare then and now",
        peek: "Hold: then",
        peekTitle: "Hold to see only the photo",
        reset: "Reset",
        capture: "Save comparison",
        captured: "Comparison saved.",
        captureFailed: "The comparison could not be saved: the photo's server does not allow it.",
      },
    },
    menus: {
      look: "Look",
      analysis: "Analysis",
      measure: "Measure",
      tools: "Tools",
      story: "Story",
      model: "Model",
      file: "File",
      settings: "Settings",
      more: "More",
      close: "Close",
    },
    compare: {
      title: "Compare",
      open: "Compare two variants side by side",
      close: "Close the comparison",
      years: "Compare two years",
      left: "Left side",
      right: "Right side",
      divider: "Drag to compare (arrow keys move it)",
      toSplit: "Side by side",
      toSplitHint: "Show the two sides side by side",
      toSwipe: "Swipe",
      toSwipeHint: "Show both sides in one view, split by a divider",
      variantsGroup: "Variants",
      timelineGroup: "Timeline",
      shadingGroup: "Shading",
      leftLighting: "Left side: lighting",
      rightLighting: "Right side: lighting",
      lightingCurrent: "Lighting as set",
      lightingNoEnvironment: "No environment map",
      lightingEnvironment: "Environment: {name}",
      openLook: "Shading/lighting side by side",
      variantsTitle: "Reconstruction variants",
      expand: "Show variants",
      collapse: "Hide variants",
    },
    timeline: {
      title: "Timeline",
      year: "Year",
      play: "Play (K)",
      pause: "Pause (K)",
      previous: "Previous point",
      next: "Next point",
      speed: "Playback speed",
      collapse: "Hide timeline",
      expand: "Show timeline",
      about: "About this timeline",
      documented: "Documented",
      modelled: "Modelled",
      circa: "c. {year}",
      bce: "{year} BCE",
      source: "Source: {source}",
    },
    measurement: {
      title: "Measurements",
      close: "Close measurements (ends measuring and clears them)",
      distance: "Distance",
      angle: "Angle",
      area: "Area",
      dimensions: "Model dimensions",
      surface: "Surface area",
      volume: "Volume",
      volumeNote: "Valid for closed meshes only",
      perimeter: "Perimeter",
      segments: "{count} segments",
      finish: "Finish",
      finishHint: "Finish the current measurement (Enter)",
      clear: "Clear",
      clearAll: "Clear measurements",
      modelUnit: "Model unit",
      unitLine: "Model unit: {unit} ({source})",
      unitImplausible: "The model measures {size} across - is its unit right?",
      unitUse: "Treat the model as drawn in {unit}",
      unitKeep: "{unit} is right",
      displaySystem: "Show in",
      metric: "Metric",
      imperial: "Imperial",
      unitSource: {
        user: "your choice",
        manifest: "from the manifest",
        file: "from the file",
        config: "viewer settings",
        default: "default",
      },
      unitNames: {
        auto: "Automatic (manifest, file or meters)",
        m: "Meters",
        cm: "Centimeters",
        mm: "Millimeters",
        in: "Inches",
        ft: "Feet",
      },
      hint: {
        distance: "Click points on the model to measure a path.",
        angle: "Click a start point, the vertex and an end point.",
        area: "Click the corners of an area; click the first point again or press Enter to close it.",
      },
    },
    clipping: {
      title: "Section planes",
      toggleAxis: "Cut along {axis}",
      position: "{axis} position",
      flip: "Flip the kept side",
      fill: "Section fill",
      reset: "Reset",
    },
    contextMenu: {
      editMaterial: "Edit the material “{name}”",
      aria: "Actions",
      ask: "Ask about this element",
      hide: "Hide element",
      showHidden: "Show hidden elements ({count})",
      focus: "Zoom to this point",
      reset: "Reset view",
      showAll: "Show all elements",
      sameType: "Select all of this type",
      sameTypeFound: "{count} element(s) of this type",
      isolate: "Show only this element",
      copyGuid: "Copy GlobalId",
      guidCopied: "Copied: {value}",
      measure: "Measure from here",
      annotate: "Annotate here",
      cut: "Cut horizontally here",
      removeCuts: "Remove sections",
      copyPoint: "Copy coordinates",
      pointCopied: "Copied: {value}",
      copyFailed: "Could not copy: {value}",
      finishMeasurement: "Finish measurement",
      undoPoint: "Remove last point",
      cancelMeasurement: "Discard measurement",
      stopMeasuring: "Stop measuring",
      annotateFaces: "Annotate selected faces ({count})",
      clearFaces: "Clear selection",
      stopPicking: "Stop selecting faces",
    },
    materials: {
      applySuggested: "Apply",
      applyAllSuggested: "Apply the types the names suggest ({count})",
      suggested: "The name suggests: {type}",
      title: "Materials",
      unnamed: "Material {number}",
      empty: "This model has no materials to edit (a point cloud or splats).",
      showOriginal: "Show the materials",
      filter: "Find…",
      filterLabel: "Find a material by name",
      reset: "Reset",
      resetHint: "Back to the material as loaded",
      presets: "Material type",
      group: {
        glass: "Glass",
        wood: "Wood",
        walls: "Walls & stone",
        metal: "Metal",
        other: "Other",
      },
      preset: {
        glass: "Glass",
        frostedGlass: "Frosted glass",
        tintedGlass: "Tinted glass",
        water: "Water",
        lightWood: "Light wood",
        darkWood: "Dark wood",
        varnishedWood: "Varnished wood",
        plaster: "Plaster wall",
        paintedWall: "Painted wall",
        concrete: "Concrete",
        brick: "Brick",
        sandstone: "Sandstone",
        marble: "Marble",
        terracotta: "Terracotta",
        ceramic: "Glazed ceramic",
        steel: "Steel",
        aluminium: "Aluminium",
        iron: "Iron",
        brass: "Brass",
        gold: "Gold",
        copper: "Copper",
        bronze: "Bronze",
        mirror: "Mirror",
        plastic: "Plastic",
        rubber: "Rubber",
        fabric: "Fabric",
        clay: "Clay",
        light: "Light source",
      },
      keepTexture: "Keep the texture",
      properties: "Properties",
      field: {
        color: "Colour",
        roughness: "Roughness",
        metalness: "Metalness",
        opacity: "Opacity",
        transmission: "Transmission (glass)",
        clearcoat: "Clear coat",
        emissive: "Glow colour",
        emissiveIntensity: "Glow strength",
        doubleSided: "Both sides",
      },
      resetAll: "Reset all materials",
      saveNote: "Kept with the model's settings: File > Save settings.",
      shadingNote: "Another shading mode is on: edits show with the original materials.",
      picking: "Click the model… (Esc: cancel)",
      pick: "Pick on the model",
      count: "{count} materials",
      edited: "edited",
      meshes: "{count} parts",
      basedOn: "Type: {type}",
      editedCopy: "Edited (the original is kept)",
      asLoaded: "As loaded",
    },
    performance: {
      heavy: "A heavy model for this device ({triangles} M triangles).",
      title: "Render quality",
      quality: {
        high: "Full quality",
        balanced: "Balanced",
        fast: "Fast",
      },
      lowered: "Render quality: {quality}.",
      undo: "Undo",
      slow: "The view is stuttering (about {fps} frames per second).",
      offer: {
        balanced: "Balanced: no ambient occlusion, a little less sharp on high-resolution screens.",
        fast: "Fast: no post-processing, lower resolution.",
      },
      lower: "Switch to {quality}",
    },
    prepare: {
      badge: "{count} to fix",
      title: "Prepare for publishing",
      intro: "Before the settings go to the repository and the renders are made: what would show in them and should not.",
      recheck: "Check again",
      next: "Next",
      fixed: "Fixed: {count}.",
      fixAll: "Fix all ({count})",
      passed: "Passed: {count}",
      orientationHint: "Its largest flat faces are at the side, not below.",
      summary: {
        wait: "Waiting for the model…",
        fix: "To fix: {fixes} · tips: {tips}",
        ready: "Ready to publish · tips: {tips}",
      },
      guard: {
        save: "Before saving: {count} things to fix",
        preview: "Before the thumbnail: {count} things to fix",
        thumbnails: "Before the renders: {count} things to fix",
        review: "Review",
        continue: "Continue anyway",
      },
      step: {
        frontNone: "Front: the side the start view looks from (none saved yet: the file's front)",
        front: "Front: the side the start view looks from ({angle}°)",
        save: "Save the settings",
        saved: "Saved at {time}",
        changed: "Changed since saving",
        unsaved: "Not saved in this session",
        thumbnails: "Make the renders",
        thumbnailsNote: "Nine views of the model as shown now",
        preview: "Make the main thumbnail",
        previewNote: "From the current view",
      },
      fix: {
        suggested: "Apply the types",
        orientation: "Stand it up",
        ground: "Put it on the ground",
        framing: "Frame the model",
        brighter: "Brighten",
        darker: "Darken",
        clipping: "Remove the sections",
        measurements: "Clear them",
        faces: "Clear the picking",
        hide: "Hide them",
        off: "Turn off",
        clearSelection: "Clear the highlight",
        shading: "Original materials",
        quality: "Full quality",
        materials: "Open the materials",
        metadata: "Validation report",
      },
      check: {
        suggested: "Material types from the names: {count}",
        suggestedDetail: "Names like “glass” or “wood” on materials still as loaded: their types in one click (Look > Materials undoes it).",
        loading: "The model is still loading",
        loadingDetail: "Check again once the full model is shown.",
        orientationOk: "Stands upright",
        upsideDown: "The model seems to be upside down",
        onSide: "The model seems to lie on its side",
        orientationDetail: "Its flat base is not at the bottom. Up axis {axis} would stand it up.",
        orientationRotated: "It was turned by hand: check the rotation.",
        groundOk: "Stands on the ground",
        floating: "The model floats above the ground",
        sunk: "The model reaches below the ground",
        groundDetail: "By {share} of its height.",
        framingOk: "The whole model is in the view",
        inside: "The view is inside the model",
        insideDetail: "Fine for an interior; the saved start view and the thumbnail show it so.",
        cut: "Part of the model is out of the view",
        small: "The model is small in the view",
        cutDetail: "About {percent} of it is cut off in the saved start view and the thumbnail.",
        smallDetail: "It fills about {percent} of the view.",
        exposureOk: "Well lit",
        dark: "The model looks too dark",
        bright: "The model looks too bright",
        exposureDetail: "Average brightness {percent}.",
        toolsOk: "No tools left on",
        toolDetail: "They would show in the renders.",
        clipping: "Section planes cut the model",
        measurements: "Measurements are on the model",
        faces: "Faces are picked",
        transform: "The move / turn handles are shown",
        lightTransform: "The light's handles are shown",
        wireframe: "Wireframe is on",
        certainty: "The Level of Certainty colours are on",
        selection: "Parts are highlighted",
        shading: "Shading: {mode}",
        shadingDetail: "The renders show this mode, not the materials.",
        weather: "Weather: {type}",
        weatherDetail: "It would be in the renders; fine if meant so.",
        quality: "Render quality lowered: {quality}",
        qualityDetail: "The renders would be at a lower resolution, without some effects.",
        unitsLarge: "Is the unit right? The model measures {size}",
        unitsSmall: "Is the unit right? The model measures only {size}",
        unitsDetail: "The file does not say its unit: set it in the measurement menu - sizes and the sun depend on it.",
        black: "Black materials",
        invisible: "Invisible materials",
        heavy: "Heavy for phones",
        heavyDetail: "{triangles} M triangles, textures up to {texture} px: the worker's optimised copy loads faster.",
        metadata: "Metadata and rights",
        metadataDetail: "The validation report checks the title, description and licence.",
      },
    },
    shortcuts: {
      title: "Controls",
      mouse: "Mouse: drag orbit, wheel zoom, right-drag pan, right-click actions, back button closes",
      keyboard: "Keyboard: Arrows orbit, Shift+Arrows faster, Ctrl/Cmd+Arrows pan, +/- zoom, Space toggle auto-rotate, Esc back, Backspace removes the last measuring point",
      touch: "Touch: pinch-to-zoom, drag to orbit, double-tap-and-hold pan, press and hold for actions, two-finger tap or back gesture to go back",
      dragAndDrop: "Or drag and drop a 3D model into the viewer",
      helpButtonAria: "Show usage hints",
      closeAria: "Close",
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
      shareView: "Udostępnij widok",
      copyShareView: "Skopiuj link udostępniania widoku",
      download: "Pobierz",
      uploadModel: "Prześlij i skonwertuj",
      openUploadPanel: "Prześlij model 3D do konwersji",
      openModelsPanel: "Przeglądaj wcześniej wygenerowane modele",
      openLocalFile: "Modele na tym urządzeniu",
      openModels: "Modele",
      openExampleManifests: "Przykładowe manifesty",
      openAdminPanel: "Administracja (użytkownicy, plany, limity)",
      openLoginPanel: "Zaloguj się lub zarejestruj",
    },
    theme: {
      lightMode: "Tryb jasny",
      darkMode: "Tryb ciemny",
      switchToLightMode: "Przełącz na tryb jasny",
      switchToDarkMode: "Przełącz na tryb ciemny",
    },
    fullscreen: {
      mode: "Tryb pełnoekranowy",
      enter: "Pełny ekran",
      exit: "Wyjdź z pełnego ekranu",
      exitMode: "Wyjdź z trybu pełnoekranowego",
    },
    language: {
      label: "Language: Polski",
      switchToPolish: "Przełącz na język polski",
      switchToEnglish: "Przełącz na język angielski",
      switchToGerman: "Przełącz na język niemiecki",
    },
    hints: {
      close: "Nie teraz",
      picking: "Kliknij ścianę, Ctrl + klik dodaje kolejne, Shift + przeciągnięcie zaznacza obszar",
      pickingSelected: "Zaznaczone ściany: {count} · Enter: dodaj adnotację · Esc: wyczyść",
      pickingTouch: "Dotknij ścian, aby je zaznaczyć; ponowne dotknięcie odznacza",
      pickingSelectedTouch: "Zaznaczone ściany: {count} · dotknij ściany, aby ją dodać lub usunąć",
      pickingAnnotate: "Dodaj adnotację",
      pickingClear: "Wyczyść",
      pickingSelect: "Wybierz co najmniej jedną ścianę, aby dodać adnotację.",
      clipping: "Przeciągnij aktywną płaszczyznę przycinania, aby dostosować cięcie",
    },
    controls: {
      enablePickingMode: "Włącz tryb wyboru",
      disablePickingMode: "Wyłącz tryb wyboru",
      enableDistanceMeasurement: "Włącz pomiar odległości",
      disableDistanceMeasurement: "Wyłącz pomiar odległości",
      selectedFaces: "Wybrane sciany",
    },
    gui: {
      on: "WŁ.",
      off: "WYŁ.",
      environmentMapNeutral: "Neutralna",
      environmentMapSunny: "Słoneczna",
      environmentMapStudio: "Studio",
      environmentMapGoldenHour: "Złota godzina",
      transform: "Przekształć",
      annotateAdd: "Dodaj adnotację",
      annotateImport: "Importuj adnotacje",
      annotateExport: "Eksportuj adnotacje",
      enableClippingPlanesMode: "Przekroje",
      disableClippingPlanesMode: "Ukryj przekroje",
      annotatePhotos: "Zdjęcia historyczne",
      mainMenu: "Główne menu",
      moveToolbar: "Przesuń pasek narzędzi",
      orbit: "Tryb nawigacji",
      controls: "Sterowanie",
      editor: "Edytor",
      transform3dObject: "Transformacja obiektu 3D",
      transformLight: "Transformacja światła",
      transformMode: "Tryb transformacji",
      directionalLight: "Światło kierunkowe",
      ambientLight: "Światło otaczające",
      ambient: "Ambient",
      lights: "Światła",
      cameraLight: "Światło kamery",
      backgroundColor: "Kolor tła",
      backgroundColorOuter: "Kolor tła zewnętrznego",
      groundTitle: "Podłoże",
      ground: {
        contact: "Cień kontaktowy",
        mirror: "Lustro",
        grid: "Siatka",
        turntable: "Talerz",
        spotlight: "Reflektor",
        dots: "Siatka kropek",
      },
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
      validationReport: "Raport walidacji",
      clearSelectedFaces: "Wyczyść wybrane ściany",
      clearSelectedHierarchy: "Odznacz wybrane obiekty",
      addAnnotations: "Dodaj annotacje",
      exportAnnotationsXml: "Eksportuj annotacje XML",
      importAnnotationsXml: "Importuj annotacje XML",
      IIIFimport: "Importuj 3IF",
      IIIFexport: "Eksportuj do IIIF",
      resetCameraPosition: "Resetuj pozycję kamery",
      resetSettings: "Resetuj ustawienia",
      saveSettings: "Zapisz ustawienia",
      renderPreview: "Zmień miniaturę główną",
      generateThumbnails: "Wygeneruj miniatury",
      color: "Kolor",
      intensity: "Intensywność",
      metalness: "Metaliczność",
      emissive: "Emisja",
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
      upAxis: "Oś pionowa modelu",
      upAxisYPlus: "Y do góry (domyślnie)",
      upAxisYMinus: "Do góry nogami (-Y do góry)",
      upAxisZPlus: "Z do góry",
      upAxisZMinus: "-Z do góry",
      upAxisXPlus: "X do góry",
      upAxisXMinus: "-X do góry",
      scale: "Skaluj",
      target: "Cel",
      local: "Lokalny",
      global: "Globalny",
      linear: "Liniowe",
      gradient: "Gradient",
      editMaterial: "Edytuj materiał",
      selectByMaterial: "wybierz według materiału",
      hideAdvancedEditor: "Ukryj tryb zaawansowany",
      showAdvancedEditor: "Pokaż tryb zaawansowany",
      showLoadingLogs: "Pokaż logi ładowania",
      hideLoadingLogs: "Ukryj logi ładowania",
      showCredits: "Pokaż informacje o autorach",
      hideCredits: "Ukryj informacje o autorach",
      hierarchy: "Hierarchia",
      collapse: "Zwiń pasek narzędzi",
      expand: "Rozwiń pasek narzędzi",
      orthographicProjection: "Przełącz na projekcję ortograficzną",
      perspectiveProjection: "Przełącz na projekcję perspektywiczną",
      environmentMap: "Mapa otoczenia",
      environmentMapToggle: "Przełącz mapę otoczenia",
      rendering: "Renderowanie",
      toneMapping: "Mapowanie tonów",
      toneMappingNeutral: "Neutralne",
      toneMappingLinear: "Liniowe",
      toneMappingNone: "Brak",
      exposure: "Ekspozycja",
      postprocessing: "Postprocessing",
      antialiasing: "Wygładzanie krawędzi",
      ambientOcclusion: "Okluzja otoczenia (AO)",
      ambientOcclusionIntensity: "Siła okluzji otoczenia",
      rakingLight: "Światło skośne",
      rakingLightDirection: "Kierunek",
      rakingLightHeight: "Wysokość nad powierzchnią",
      rakingLightSweep: "Obracaj dookoła",
      antialiasingNone: "Brak",
      environmentMapIntensity: "Intensywność mapy otoczenia",
      environmentMapStyleNeutral: "Neutralny",
      environmentMapStyleSunny: "Słoneczny",
      environmentMapStyleStudio: "Studio",
      environmentMapStyleGoldenHour: "Złota godzina",
      enableWireframeMode: "Włącz tryb siatki",
      disableWireframeMode: "Wyłącz tryb siatki",
      download: "Pobierz model",
      shading: "Cieniowanie",
      shadingOriginal: "Oryginalne materiały",
      shadingStandard: "Standardowy (PBR)",
      shadingPhong: "Phong",
      shadingLambert: "Lambert",
      shadingToon: "Toon",
      shadingFlat: "Płaskie cieniowanie (pokaż ściany)",
      shadingClay: "Glina (bez tekstury)",
      shadingMatcap: "Matcap (glina studyjna)",
      shadingNormals: "Normalne",
      shadingCustom: "Własny shader",
      shadingCustomVertex: "Vertex shader",
      shadingCustomFragment: "Fragment shader",
      shadingCustomApply: "Zastosuj",
      shadingCustomReset: "Przywróć domyślny",
    },
    metadata: {
      modelDetails: "Szczegóły modelu",
      iiifManifest: "Manifest IIIF: przeciągnij go do innej przeglądarki IIIF albo otwórz",
      metadata: "Metadane",
      visualizedFile: "Wizualizowany plik",
      vertices: "Wierzchołki",
      faces: "Ściany",
      summary: "{format} · {vertices} wierzchołków",
      title: "Tytuł",
      author: "Autor",
      authorAffiliation: "Afiliacja autora",
      license: "Licencja",
      description: "Opis",
      objectType: "Typ obiektu",
      reconstructionAuthors: "Autorzy rekonstrukcji",
      reconstructionPeriod: "Okres rekonstrukcji",
      move: "Przesuń",
      close: "Zamknij",
    },
    manifesto: {
      source: "Typ manifestu",
      refreshExamples: "Odśwież listę przykładów",
      invalidUrl: "Podaj poprawny URL manifestu.",
      invalidJson: "Podaj poprawny tekst JSON.",
      scene: "Scena",
      sceneNumber: "Scena {number}",
      camera: "Kamera",
      cameraNumber: "Kamera {number}",
      treeView: "Drzewo",
      jsonView: "JSON",
      expandAll: "Rozwiń wszystko",
      collapseAll: "Zwiń wszystko",
      treeItems: "elementy: {count}",
      treeItem: "elementy: {count}",
      treeKey: "klucze: {count}",
      treeKeys: "klucze: {count}",
      treeEditHint: "Kliknij, aby edytować; Enter zatwierdza, Esc anuluje",
      retargetTitle: "Użyj tych ustawień z innym modelem",
      retargetHint: "Światła, renderowanie i cieniowanie zostają; adnotacje, miniatury, oś czasu i płaszczyzny przekroju należą do obecnego modelu i są pomijane.",
      retargetPlaceholder: "URL modelu (GLB, glTF, OBJ, ...)",
      retargetKeepCamera: "Zachowaj kamerę",
      retargetApply: "Zastosuj",
      retargetInvalidUrl: "Podaj URL modelu.",
      retargetNoModel: "Nie wczytano modelu, którego ustawień można użyć.",
      retargetDone: "Ustawienia zastosowano do {model}. Nowy manifest jest w polu tekstowym.",
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
      optionP4Local: "Kamera, światła i komentarze (localhost)",
      optionCamera: "Ustawiona kamera",
      optionLights: "Światła z kolorami i natężeniem",
      optionComments: "Komentarze z własnymi widokami",
    },
    aim3if: {
      loader: "Ładowanie AIM3D",
      collapse: "Zwiń",
      expand: "Rozwiń",
      modelConfig: "Konfiguracja modelu",
      loadFromUrl: "Wczytaj z URL",
      loadFromText: "Wczytaj z tekstu",
      manifestUrlPlaceholder: "https://example.org/aim3d/manifest.json",
      manifestTextPlaceholder: "Wklej tutaj JSON manifestu AIM3D...",
      optionDefault: "Konfiguracja domyślna",
      optionBox: "Konfiguracja Box",
      optionBoxLocal: "Box (localhost)",
      optionWolpaLocal: "Synagoga w Wołpie (localhost)",
      optionWolpaLocalCeiling: "Synagoga w Wołpie - widok sklepienia (localhost)",
      optionWolpaGoldenHour: "Synagoga w Wołpie - złota godzina, ACES (localhost)",
      optionWolpaStudio: "Synagoga w Wołpie - studio, AgX (localhost)",
      optionWolpaNight: "Synagoga w Wołpie - nocne reflektory, Reinhard (localhost)",
      optionWolpaNightTour: "Synagoga w Wołpie - noc, adnotacje i wycieczka (localhost)",
      optionWolpaCertainty: "Synagoga w Wołpie - poziom pewności (localhost)",
      optionWolpaToon: "Synagoga w Wołpie - cieniowanie toon (localhost)",
      optionWolpaOvercast: "Synagoga w Wołpie - pochmurno, Lambert, Cineon (localhost)",
      optionWolpaClayAo: "Synagoga w Wołpie - glina, okluzja otoczenia (localhost)",
      optionWolpaRaking: "Synagoga w Wołpie - światło skośne, obracające się, glina (localhost)",
      optionWolpaRakingTexture: "Synagoga w Wołpie - światło skośne na teksturach (localhost)",
      optionWolpaMatcap: "Synagoga w Wołpie - matcap, glina studyjna (localhost)",
      optionWolpaFlat: "Synagoga w Wołpie - płaskie cieniowanie, widoczne ściany (localhost)",
      optionWolpaNormals: "Synagoga w Wołpie - normalne powierzchni (localhost)",
      optionWolpaContours: "Synagoga w Wołpie - własny shader: warstwice (localhost)",
      optionWolpa4D: "Synagoga w Wołpie - oś czasu 4D: starzenie 1730-1936 (localhost)",
    },
    localPreview: {
      loadExampleModel: "Wczytaj model przykładowy",
      noExampleModel: "Inny model",
    },
    embedPanel: {
      title: "Opcje osadzania",
      closeAria: "Zamknij opcje osadzania",
      modelUrl: "URL modelu",
      modelUrlPlaceholder: "/examples/box.glb",
      entityId: "ID encji",
      theme: "Motyw",
      themeDark: "Ciemny",
      themeLight: "Jasny",
      autoRotateSpeed: "Prędkość auto-obrotu",
      cameraPosition: "Pozycja",
      cameraTarget: "Cel",
      cameraVectorPlaceholder: "x,y,z",
      fov: "FOV",
      autoRotate: "Auto-obrót",
      disableInteraction: "Wyłącz interakcję",
      hideActionMenu: "Ukryj menu akcji",
      hideMetadata: "Ukryj metadane",
      presentationMode: "Tryb prezentacji",
      useCurrentCamera: "Bieżąca kamera",
      useCurrentCameraHint: "Kamera viewera za tym oknem",
      resetFromViewer: "Przywróć",
      resetFromViewerHint: "Wszystkie opcje tak, jak ma je viewer",
      copyUrl: "Kopiuj URL",
      copyIframe: "Kopiuj iframe",
      sectionModel: "Model",
      sectionLook: "Wygląd",
      sectionCamera: "Kamera",
      sectionBehaviour: "Zachowanie",
      language: "Język",
      languageAuto: "Domyślny viewera",
      aspect: "Proporcje",
      vectorHint: "Podaj wszystkie trzy liczby albo żadnej",
      fovHint: "FOV: liczba od 1 do 179",
      reload: "Odśwież podgląd",
      openTab: "Otwórz w nowej karcie",
      noSource: "Potrzebny jest URL modelu albo ID encji: model otwarty z tego urządzenia nie jest w sieci.",
      embedUrl: "URL osadzenia",
      iframeCode: "Kod iframe",
      preview: "Podgląd",
      previewTitle: "Podgląd osadzenia",
    },
    uploadPanel: {
      username: "Nazwa użytkownika",
      password: "Hasło",
      login: "Zaloguj się",
      logout: "Wyloguj się",
      register: "Zarejestruj się",
      showPassword: "Pokaż hasło",
      hidePassword: "Ukryj hasło",
      limitsUploads: "Przesłane",
      limitsHour: "{used}/{limit} w tej godzinie",
      limitsDay: "{used}/{limit} dzisiaj",
      limitsStorage: "Miejsce: {used}/{limit} MB",
      limitsModels: "Modele: {used}/{limit}",
      limitRateHour: "Osiągnięto limit przesyłania ({limit} na godzinę). Spróbuj ponownie za {minutes} min.",
      limitRateDay: "Osiągnięto dzienny limit przesyłania ({limit} na dobę). Spróbuj ponownie za {minutes} min.",
      limitConcurrent: "Masz już {limit} model(e) w trakcie konwersji. Poczekaj, aż się zakończą.",
      limitStorage: "Osiągnięto limit miejsca ({limit} MB). Usuń model, aby zwolnić miejsce.",
      limitModels: "Osiągnięto limit modeli ({limit}). Usuń model, aby przesłać nowy.",
      title: "Prześlij i skonwertuj model",
      closeAria: "Zamknij panel przesyłania",
      fileLabel: "Plik modelu 3D",
      urlLabel: "…lub link do pliku",
      urlPlaceholder: "https://example.org/model.glb",
      urlInvalid: "Wpisz pełny link zaczynający się od https:// lub http://.",
      urlNoFile: "Link musi prowadzić do pliku modelu, np. …/model.glb.",
      chooseFileOrUrl: "Wybierz plik albo wklej link do niego.",
      downloading: "Pobieranie pliku...",
      urlFetchError: "Nie udało się zaimportować linku: {reason}",
      urlUnsupported: "To repozytorium nie obsługuje importu z linków.",
      formatsHint: "Obsługiwane formaty: abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, glb, usd/usda/usdc/usdz, step/stp, iges/igs, 3mf, gltf, 3ds, pcd, xyz, amf, kmz, vox, lwo, chmury punktów las/laz/e57, Gaussian splats spz/splat/ksplat/sog/rad, lub archiwum .zip zawierające jeden z nich. STEP/IGES, 3MF i USD są konwertowane do GLB; grupa gltf … lwo jest wgrywana bez zmian i bez miniatur; chmury punktów (i .ply bez ścian) są zamieniane na strumieniowane 3D Tiles, poza .ply z Gaussian splats, który jest pokazywany tak, jak został wgrany.",
      submit: "Prześlij i skonwertuj",
      uploading: "Przesyłanie...",
      private: "Prywatny",
      privateHint: "Na liście modeli zobaczysz go tylko Ty i administratorzy; kto ma link, nadal może go otworzyć.",
      tooLargeWorker: "Serwer odrzucił plik: {reason}",
      tooLargeCloudflare: "Plik jest większy, niż przepuszcza Cloudflare (100 MB w planach Free i Pro), więc nie dotarł do serwera.",
      tooLargeProxy: "Proxy przed serwerem odrzuciło plik jako za duży (nginx client_max_body_size).",
      unsupportedFormat: "Nieobsługiwany format pliku: .{ext}",
      webglUnavailable: "WebGL jest niedostępny w Twojej przeglądarce. Włącz akcelerację sprzętową lub zaktualizuj sterowniki karty graficznej.",
      uploadError: "Przesyłanie lub konwersja nie powiodła się. Spróbuj ponownie.",
    },
    loginPanel: {
      title: "Konto",
      closeAria: "Zamknij panel konta",
      notRequired: "Konta nie są włączone na tym serwerze.",
      openSignedIn: "Zalogowano jako {user}",
      planTitle: "Plan kupiony w aplikacji",
    },
    modelsPanel: {
      title: "Wcześniej wygenerowane modele",
      closeAria: "Zamknij panel modeli",
      empty: "Brak wcześniej wygenerowanych modeli.",
      loadError: "Nie udało się wczytać listy poprzednich modeli.",
      deleteAria: "Usuń {name}",
      makePrivate: "Ustaw {name} jako prywatny - na liście zobaczysz go tylko Ty i administratorzy",
      makePublic: "{name} jest prywatny - pokaż go wszystkim",
      deleteConfirm: 'Usunąć "{name}"? Spowoduje to trwałe usunięcie przekonwertowanego modelu i jego renderów.',
      deleteAction: "Usuń",
      deleteCancel: "Anuluj",
      repositoryLabel: "Adres repozytorium",
      repositorySave: "Połącz",
      noRepository: "Podaj adres repozytorium, aby przeglądać jego modele.",
      saveOffline: "Zachowaj {name} na tym urządzeniu",
      savedOffline: "{name} jest na tym urządzeniu",
      offline: "Brak połączenia z internetem. Modele na urządzeniu działają dalej.",
      unreachable: "Repozytorium nie odpowiada. Modele na urządzeniu działają dalej.",
    },
    modelMetadata: {
      title: "Opisz model",
      editTitle: "Edytuj metadane modelu",
      intro: "Pola oznaczone * są wymagane. Typ, miejsce, data i jednostka pomagają też dobrać skalę i oświetlenie modelu.",
      choose: "Wybierz...",
      notSpecified: "Nie określono",
      unitUnknown: "Nie wiem",
      unitHint: "Ile mierzy jedna jednostka pliku - do ustalenia skali.",
      datePlaceholder: "np. 1890, XV w., 2024-05-12",
      copyrightPlaceholder: "np. © 2024 Muzeum ...",
      locationPlaceholder: "np. Kraków, Wawel",
      required: "Podaj nazwę i wybierz typ.",
      cancel: "Anuluj",
      save: "Zapisz",
      upload: "Wyślij i konwertuj",
      edit: "Edytuj metadane",
      add: "Dodaj metadane",
      editAria: "Edytuj metadane: {name}",
      saveError: "Nie udało się zapisać metadanych: {reason}",
      unsupported: "to repozytorium nie przechowuje metadanych",
      fields: {
        name: "Nazwa",
        type: "Typ",
        author: "Autor",
        copyright: "Prawa autorskie",
        license: "Licencja",
        date: "Data",
        location: "Miejsce",
        unit: "Jednostka modelu",
        description: "Opis",
      },
      types: {
        building: "Budynek / architektura",
        interior: "Wnętrze",
        urban: "Miasto / osada",
        site: "Stanowisko / krajobraz",
        object: "Obiekt / artefakt",
        sculpture: "Rzeźba / detal architektoniczny",
        other: "Inne",
      },
      licenses: {
        "public-domain": "Domena publiczna",
        "all-rights-reserved": "Wszelkie prawa zastrzeżone",
      },
      units: { m: "metry", cm: "centymetry", mm: "milimetry", in: "cale", ft: "stopy" },
    },
    modelsMeta: {
      uploadedBy: "Wrzucone przez",
      private: "Prywatny: na tej liście widzi go tylko właściciel i administratorzy",
      uploaded: "Wrzucone",
      saved: "Zapisane",
      size: "Rozmiar",
    },
    libraryPanel: {
      title: "Modele na tym urządzeniu",
      closeAria: "Zamknij",
      browse: "Przeglądaj pliki…",
      empty: "Brak modeli na tym urządzeniu.",
      fromRepository: "Z repozytorium",
      fromDevice: "Z tego urządzenia",
      deleteAria: "Usuń {name} z tego urządzenia",
      deleteConfirm: 'Usunąć "{name}" z tego urządzenia?',
      deleteAction: "Usuń",
    },
    modelsSource: {
      aria: "Skąd pochodzą modele",
      local: "Na urządzeniu",
      remote: "Zdalne",
      examples: "Przykłady",
    },
    examplesPanel: {
      title: "Przykładowe manifesty",
      closeAria: "Zamknij",
      aim3d: "Manifesty AIM3D",
      iiif: "Manifesty IIIF",
      bundled: "W aplikacji, działa offline",
      online: "Wymaga połączenia z internetem",
      refresh: "Odśwież",
    },
    ai: {
      disclaimer: "Wygenerowane przez AI - sprawdź, zanim na tym polegasz.",
      thinking: "Asystent AI analizuje...",
      offline: "Nie udało się połączyć z asystentem AI.",
      failed: "Asystent AI nie mógł odpowiedzieć.",
      timeout: "Odpowiedź AI trwała zbyt długo. Spróbuj ponownie lub zadaj węższe pytanie.",
      unavailable: "Asystent AI jest chwilowo niedostępny.",
      rateLimited: "Osiągnięto limit zapytań AI. Spróbuj później.",
      locked: "Dostępne w planie Business",
      validation: {
        explain: "Wyjaśnij prostym językiem (AI)",
        explainHint: "Wysyła do asystenta AI raport ze sprawdzenia modelu (nie sam model).",
        title: "Wyjaśnienie AI",
        fix: "Co zrobić: ",
      },
      ifc: {
        toggle: "Zapytaj model budynku (AI)",
        title: "Zapytaj model",
        placeholder: "np. ściany nośne na 2. piętrze",
        ask: "Zapytaj",
        hint: "Do asystenta AI trafia pytanie i podsumowanie nazw właściwości (nie model). AI buduje filtr, a viewer stosuje go do prawdziwych danych.",
        examples: "Przykłady",
        example1: "Wszystkie okna",
        example2: "Ściany nośne",
        example3: "Łączna powierzchnia stropów",
        found: "Znaleziono elementów: {count}",
        noneFound: "Żaden element nie pasuje.",
        notUnderstood: "Na to pytanie nie da się odpowiedzieć z właściwości modelu.",
        aggregate: {
          count: "Liczba: {value}",
          sum: "Suma {property}: {value}",
          average: "Średnia {property}: {value}",
          min: "Minimum {property}: {value}",
          max: "Maksimum {property}: {value}",
        },
        missingValues: "Pasujące elementy bez {property}: {count}.",
        filter: "Filtr",
        show: "Podświetl",
        isolate: "Pokaż tylko te",
        hide: "Ukryj te",
        reset: "Pokaż wszystko",
        list: "Elementy",
        close: "Zamknij",
        noData: "Ten model nie ma właściwości IFC.",
        selection: "Dotyczy: {element}",
        clearSelection: "Pytaj o cały model",
        selectionExample1: "Elementy takie jak ten",
        selectionExample2: "Elementy tego typu na tej kondygnacji",
        selectionExample3: "Ile jest elementów tego typu?",
      },
      variants: {
        describe: "Porównaj i sprawdź paradane (AI)",
        describeHint: "Wysyła do asystenta AI opisy wariantów, źródła, poziomy pewności i pomiary (nie model).",
        title: "Porównanie wariantów (AI)",
        differences: "Różnice",
        paradata: "Ocena paradanych",
        status: { ok: "Udokumentowany", incomplete: "Niekompletny", inconsistent: "Niespójny" },
        suggestions: "Sugestie: ",
      },
    },
    validationReport: {
      title: "Raport walidacji",
      download: "Pobierz raport (JSON)",
      refresh: "Sprawdź ponownie",
      close: "Zamknij",
      checking: "Sprawdzanie...",
      noModel: "Otwórz model, aby go sprawdzić.",
      passed: "{passed}/{total}",
      passedLabel: "zaliczone",
      ready: "Gotowy",
      mostlyReady: "Prawie gotowy",
      notReady: "Niegotowy",
      readyHint: "Wszystkie testy zaliczone: model i manifest są gotowe do publicznego udostępnienia.",
      mostlyReadyHint: "Model można opublikować. Najpierw przejrzyj pozostałe pozycje.",
      notReadyHint: "Części wartości nie da się użyć. Popraw niezaliczone pozycje przed publikacją.",
      pass: "Zaliczone",
      review: "Do przejrzenia",
      fail: "Błąd",
      notSet: "Brak",
      notChecked: "Niesprawdzone",
      notSetHint: "Manifest jeszcze tego nie ustawia.",
      noIssues: "Bez uwag.",
      moreIssues: "...i {count} więcej (pobierz raport)",
      modelCheck: "Kontrola pliku modelu (glTF-Validator)",
      modelCheckHint: "Czy plik modelu to poprawny glTF działający w każdej przeglądarce?",
      modelNotChecked: "Sprawdzane są tylko modele skonwertowane przez worker uploadu.",
      validatorMissing: "Na workerze nie ma zainstalowanego glTF-Validatora.",
      errorsCount: "błędy: {count}",
      warningsCount: "ostrzeżenia: {count}",
      details: "Szczegóły",
      file: "Plik",
      fileSize: "Rozmiar pliku",
      triangles: "Trójkąty",
      vertices: "Wierzchołki",
      materials: "Materiały",
      textures: "Największa tekstura",
      size: "Wymiary",
      generator: "Utworzono w",
      attributes: "Atrybuty manifestu",
      attributesValue: "sprawdzone: {count}; błędy: {errors}, ostrzeżenia: {warnings}, nieznane: {unknown}",
      features: {
        materials: "Materiały",
        model: "Model 3D",
        metadata: "Metadane opisowe",
        rights: "Prawa i atrybucja",
        annotations: "Adnotacje",
        camera: "Widok kamery",
        lights: "Światła",
        "raking-light": "Światło boczne",
        clipping: "Przekroje",
        timeline: "Oś czasu 4D",
        variants: "Warianty rekonstrukcji",
        compare: "Porównanie",
        photos: "Zdjęcia historyczne",
        location: "Położenie geograficzne",
        sun: "Analiza nasłonecznienia",
        weather: "Pogoda",
        certainty: "Poziom pewności",
        thumbnails: "Miniatury",
        transform: "Transformacja i cieniowanie",
        rendering: "Renderowanie i otoczenie",
        tour: "Wycieczka",
        settings: "Ustawienia viewera",
        manifest: "Struktura IIIF",
      },
      hints: {
        model: "Czy manifest wskazuje model z poprawnym adresem i formatem?",
        metadata: "Czy tytuł, opis i metadane są wypełnione we wszystkich językach?",
        rights: "Czy ustawiono licencję (rights) i atrybucję (requiredStatement)?",
        annotations: "Czy adnotacje mają treść i cel w tej scenie?",
        manifest: "Czy identyfikatory, typy i struktura IIIF są poprawne?",
      },
    },
    toolPanel: {
      move: "Przesuń panel (podwójne dotknięcie: przypnij z powrotem)",
      minimize: "Zminimalizuj panel",
      restore: "Rozwiń panel",
      close: "Zamknij panel",
    },
    gallery: {
      label: "Widoki modelu",
      dialog: "Przeglądarka obrazów",
      open: "Otwórz widok {number}: {label}",
      openPlain: "Otwórz widok {number}",
      previous: "Poprzedni widok",
      next: "Następny widok",
      close: "Zamknij (Esc)",
      top: "Z góry",
      view: "Widok {number}",
      zoomReset: "Przywróć powiększenie",
      hint: "Kółko lub dwa palce: powiększenie · dwuklik: szczegół · strzałki: kolejne widoki",
    },
    credits: {
      title: "Autorzy i źródła",
      close: "Zamknij",
    },
    bugReport: {
      button: "Zgłoś błąd",
      title: "Zgłoś błąd",
      description: "Co poszło nie tak? Co działo się tuż przed tym?",
      email: "E-mail (opcjonalnie, jeśli możemy dopytać)",
      includeDiagnostics: "Dołącz dane techniczne (urządzenie, przeglądarka, model, ostatnie błędy)",
      privacy: "Zgłoszenie trafia wyłącznie do twórców przeglądarki.",
      send: "Wyślij zgłoszenie",
      cancel: "Anuluj",
      sent: "Dziękujemy - zgłoszenie zostało wysłane.",
      failed: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.",
    },
    // Plan names (admin and account panels); an app build adds the rest.
    plans: {
      free: "Free",
      pro: "Pro",
      business: "Business",
      enterprise: "Enterprise",
    },
    exadmin: {
      title: "Administracja",
      navUsers: "Użytkownicy",
      backToViewer: "Wróć do viewera",
      language: "Język",
      loading: "Wczytywanie...",
      loginTitle: "Zaloguj się jako administrator",
      notAdmin: "{user} nie jest administratorem.",
      accountsOff: "Konta nie są włączone na tym serwerze, więc nie ma tu nic do administrowania.",
      unreachable: "Serwer nie odpowiada.",
    },
    adminPanel: {
      lastUpload: "ostatni upload {date}",
      sortBy: "Sortuj wg",
      sortPlan: "Plan",
      sortName: "Nazwa",
      sortModels: "Przesłane modele",
      sortStorage: "Zajęte miejsce",
      sortLastUpload: "Ostatni upload",
      sortAscending: "Rosnąco",
      sortDescending: "Malejąco",
      limitsUsage: "Przesłane {hour} w tej godzinie, {day} dzisiaj · Miejsce {storage} MB · Modele {models}",
      planRenews: "odnowienie/koniec {date}",
      planChecked: "sprawdzono {date}",
      limitsShow: "Edytuj limity",
      limitsHide: "Ukryj limity",
      limitsAdmin: "Administratorzy nie mają limitów.",
      limitsBusiness: "Plan Business lub Enterprise: domyślne są tu limity Business.",
      planCurrent: "Plan: {plan}",
      planPurchase: "kupiony w aplikacji: {plan}",
      planGrant: "nadany: {plan}",
      planGrantUntil: "nadany: {plan} do {date}",
      planShow: "Zmień plan",
      planHide: "Ukryj plan",
      planGrantLabel: "Nadany plan",
      planNone: "Brak (tylko kupiony)",
      planUntil: "Do (puste = bez końca)",
      planHint: "Obowiązuje wyższy z planów: nadany lub kupiony – w aplikacji i w limitach przesyłania.",
      planSave: "Zapisz plan",
      planSourceAdmin: "nadany przez administratora",
      limitsDefault: "domyślnie: {value}",
      limitsHint: "Puste = domyślnie, 0 = bez limitu.",
      limitsSave: "Zapisz limity",
      limitsReset: "Przywróć domyślne",
      limitUploadsPerHour: "Przesłań na godzinę",
      limitUploadsPerDay: "Przesłań na dobę",
      limitStorageMb: "Miejsce (MB)",
      limitMaxModels: "Maks. liczba modeli",
      limitConcurrentJobs: "Równoległe konwersje",
      title: "Zarządzaj użytkownikami",
      closeAria: "Zamknij panel zarządzania użytkownikami",
      empty: "Brak zarejestrowanych użytkowników.",
      loadError: "Nie udało się wczytać listy użytkowników.",
      approve: "Zatwierdź",
      disable: "Zablokuj",
      promote: "Nadaj admina",
      demote: "Odbierz admina",
      delete: "Usuń",
      cannotDeleteSelf: "Nie możesz usunąć własnego konta.",
      deleteConfirm: 'Usunąć użytkownika "{user}"? Spowoduje to trwałe usunięcie jego konta.',
      deleteAction: "Usuń",
      deleteCancel: "Anuluj",
      modelsCount: "{count} modeli",
      modelsShow: "Pokaż modele",
      modelsHide: "Ukryj modele",
      modelsEmpty: "Brak przesłanych modeli.",
      modelsLoadError: "Nie udało się wczytać modeli użytkownika.",
      modelDeleteAria: "Usuń {name}",
      modelEditAria: "Edytuj dane przesłania modelu {name}",
      modelOwner: "Przesłane przez",
      modelUploadedAt: "Data przesłania",
      modelNoOwner: "Brak właściciela",
      modelSave: "Zapisz",
      unownedTitle: "Modele bez właściciela",
      modelDeleteConfirm: 'Usunąć "{name}"? Spowoduje to trwałe usunięcie przekonwertowanego modelu i jego renderów.',
    },
    eventLog: {
      title: "Dziennik zdarzeń",
      copy: "Kopiuj",
      clear: "Wyczyść",
      copied: "Skopiowano dziennik.",
      empty: "Na razie nic nie zapisano.",
    },
    loadingLog: {
      fullQuality: "Podgląd · ładowanie pełnej jakości...",
      fullQualityProgress: "Podgląd · ładowanie pełnej jakości {percent}%",
      pointCloudPreview: "Podgląd · budowanie pełnej chmury punktów...",
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
      uploadingFile: "Przesyłanie pliku",
      downloadingFile: "Pobieranie pliku",
      uploadedBytes: "{percent}% · {loaded} / {total} MB",
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
      webglOnlyModel: "Chmury punktów i splaty gaussowskie wymagają renderera WebGL: otwórz viewer bez ?renderer=webgpu.",
      webglOnlyFeature: "{feature} wymaga renderera WebGL.",
      pointCloudThinned: "Duża chmura punktów: wyświetlono {loaded} z {total} punktów. Przekonwertuj ją przez workera, aby strumieniować pełną rozdzielczość.",
      pointCloudLoaded: "Załadowano chmurę punktów: {count} punktów.",
      pointCloudIncomplete: "Chmura punktów nie załadowała się w całości; wyświetlono punkty, które dotarły.",
      tiledAnnotationBlocked: "Adnotacje nie są dostępne dla modeli strumieniowanych (3D Tiles / Potree).",
      pointAnnotationHint: "Kliknij punkt chmury, aby dodać do niego adnotację.",
      profileStart: "Kliknij na chmurze pierwszy koniec linii profilu.",
      profileSecond: "Teraz kliknij drugi koniec.",
      profileTooShort: "Oba końce leżą jeden nad drugim; kliknij dwa odległe punkty.",
      fullModelLoaded: "Załadowano model w pełnej jakości.",
      fullModelLoadError: "Nie udało się załadować modelu w pełnej jakości; wyświetlany jest podgląd.",
      previewAnnotationBlocked: "Adnotacje można dodać po załadowaniu modelu w pełnej jakości.",
      transformMove: "Przesuwanie: przeciągnij strzalki osi, aby przesunąć obiekt.",
      transformRotate: "Obracanie: przeciągnij pierscienie obrotu, aby obrócić obiekt. Przytrzymaj Shift, aby włączyć przyciąganie.",
      transformScale: "Skalowanie: przeciągnij uchwyty osi, aby zmienić rozmiar obiektu. Przytrzymaj Shift, aby włączyć przyciąganie.",
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
      invalidJSON: "Nieprawidłowy JSON: {error}",
      missingJsonSettings: "Brak wymaganego pliku konfiguracyjnego: {url} (HTTP {status})\nViewer nie może się uruchomić bez \"viewer-settings.json\".\nProszę sprawdzić, czy plik został skopiowany podczas budowania/deploymentu.",

      presentationModeError: "Wystąpił błąd podczas konfiguracji trybu prezentacji.",
      objLoaded: "Model OBJ został załadowany.",
      mtlLoadError: "Wystąpił błąd podczas ładowania pliku MTL.",
      glbLoadError: "Wystąpił błąd podczas ładowania pliku GLB.",
      unsupportedExtension: "Rozszerzenie pliku nie jest jeszcze obsługiwane.",
      modelLoaded: "Model {filename} został załadowany.",
      upAxisNotForTiles: "Osi pionowej nie można zmienić dla modelu strumieniowanego (kafelkowego).",
      modelLoadedSimple: "Model został pomyślnie załadowany.",
      unsupportedFormat: "Nieobsługiwany format pliku.",
      presentationModeReady: "Tryb prezentacji jest gotowy.",
      presentationModeError: "Wystąpił błąd podczas konfiguracji trybu prezentacji.",
      sandboxDropModel: "Przeciągnij i upuść model 3D w oknie viewer'a.",
      supportedFormats: "<strong>Obłsugiwane formaty</strong>:\n{formats}\ni <strong>archiwa</strong>: {archives}.",

      embedSourceMissing: "Ustaw URL modelu lub ID encji do osadzenia.",
      embedUrlCopied: "Skopiowano URL osadzenia.",
      embedUrlCopyError: "Nie udało się skopiować URL osadzenia.",
      embedIframeCopied: "Skopiowano iframe osadzenia.",
      embedIframeCopyError: "Nie udało się skopiować iframe.",
      embedCodeCopied: "Kod osadzenia został skopiowany do schowka.",
      embedCodeCopyError: "Nie udało się skopiować kodu osadzenia.",
      shareUrlCopied: "Skopiowano link udostępniania widoku.",
      shareUrlCopyError: "Nie udało się skopiować linku udostępniania widoku.",
      invalidManifest: "Nieprawidłowy manifest AIM3D.",
      manifestValidationFailed: "Walidacja manifestu AIM3D nie powiodła się.",

      uploadStarted: "Przesłano plik - konwertowanie modelu...",
      uploadReady: "Skonwertowany model jest gotowy.",
      pointCloudPreview: "Wyświetlono podgląd chmury punktów; wersja w pełnej rozdzielczości pojawi się po konwersji.",
      uploadError: "Przesyłanie lub konwersja modelu nie powiodła się.",
      uploadLoginRequired: "Aby przesłać plik, musisz się zalogować. Nie masz konta? Zarejestruj się przez ikonę konta.",
      userUpdated: "Użytkownik zaktualizowany.",
      userDeleted: "Użytkownik usunięty.",
      modelDeleted: "Model został usunięty.",
      modelMadePrivate: "Model jest prywatny: na liście widzisz go tylko Ty i administratorzy.",
      modelMadePublic: "Model jest znowu widoczny na liście dla wszystkich.",
      modelVisibilityError: "Nie udało się zmienić widoczności modelu.",
      modelMetadataSaved: "Zapisano metadane modelu.",
      modelMetadataError: "Model jest wysyłany, ale nie udało się zapisać jego metadanych - dodaj je w szczegółach modelu.",
      exampleManifestError: "Nie udało się wczytać przykładowego manifestu.",
      exampleListRefreshFailed: "Nie udało się odświeżyć listy przykładów - pokazano ostatnio wczytaną.",
      modelUpdated: "Dane modelu zapisane.",
      previewSaved: "Miniatura główna zmieniona.",
      thumbnailsGenerating: "Generowanie miniatur…",
      thumbnailsGenerated: "Miniatury wygenerowane.",
      thumbnailsNotOwner: "Miniatury tego modelu może zmienić tylko osoba, która go przesłała (lub administrator).",
      previewSaveError: "Nie udało się zapisać podglądu.",
      previewNotUploaded: "Miniatury można zapisać tylko dla modeli przesłanych do repozytorium.",
      modelDeleteError: "Nie udało się usunąć modelu.",
      librarySaved: "Model zapisany na tym urządzeniu.",
      librarySaveError: "Nie udało się zapisać modelu na tym urządzeniu.",
      repositoryUrlInvalid: "To nie jest poprawny adres repozytorium.",
      repositoryUnreachable: "Repozytorium nie odpowiada - spróbuj później.",
      planLocked: "Dostępne w planie Business.",
      planPurchased: "Dziękujemy! Twój plan jest aktywny.",
      planPurchaseError: "Zakup się nie powiódł - spróbuj później.",
      planRestored: "Zakupy przywrócone.",
      planRestoreNone: "Brak zakupów do przywrócenia.",
      planLinked: "Zalogowano. Plan konta obowiązuje na tym urządzeniu.",
      planLinkError: "Nie udało się zalogować: {message}",

      annotationDataMissing: "Nie znaleziono danych adnotacji dla tego punktu.",
      selectFaceRequired: "Wybierz co najmniej jedną ścianę, aby dodać adnotację.",
      selectFaceRequiredAgain: "Wybierz co najmniej jedną ścianę, a następnie ponownie dodaj adnotacje.",
      noFacesSelected: "Nie wybrano ścian do adnotacji.",
      titleRequired: "Tytuł jest wymagany.",
      facesInactive: "Wybrane ściany nie są już aktywne.",

      annotationsSaved: "Zapisano adnotacje dla {count} ścian{plural}.",
      annotationsImported: "Zaimportowano adnotacje: {count}.",
      annotationsImportedFromManifest: "Zaimportowano adnotacje z manifestu: {count}.",
      xrUnavailable: "Ta przeglądarka nie obsługuje VR ani AR.",
      xrFailed: "Nie udało się uruchomić VR ani AR.",
      photoViewSaved: "Zapisano widok zdjęcia.",
      photoLoadFailed: "Nie udało się wczytać zdjęcia.",
      photoCameraDenied: "Brak dostępu do aparatu. Zezwól na niego w przeglądarce, aby zobaczyć zdjęcie na miejscu.",
      photoCameraUnavailable: "Aparat jest niedostępny (wymaga HTTPS i przeglądarki, która go udostępnia).",
      annotationsExported: "Wyeksportowano XML adnotacji.",
      tourNoAnnotations: "Dodaj adnotacje do modelu, aby rozpocząć wycieczkę.",
      noAnnotationsToExport: "Brak adnotacji do eksportu.",
      noValidAnnotations: "Nie znaleziono poprawnych adnotacji w XML.",
      annotationsImportError: "Nie udało się zaimportować XML adnotacji.",
      noValidAnnotationsInManifest: "Nie znaleziono poprawnych adnotacji w manifeście AIM3IF.",
      manifestImportedWithoutAnnotations: "Zaimportowano manifest AIM3IF. Ustawienia viewer'a zostały zastosowane (brak adnotacji w manifeście).",

      settingsSaved: "Ustawienia zostały zapisane.",
      settingsSaveError: "Błąd zapisywania ustawień.",
      settingsNotUploaded: "Ustawienia można zapisać tylko dla modeli przesłanych do repozytorium.",
      settingsNotOwner: "Ustawienia tego modelu może zapisać tylko osoba, która go przesłała (lub administrator).",

      featureToggle: "{feature} jest {state}.",
      clippingHelperToggle: "Pomocnik płaszczyzny przycinania {axis} jest {state}.",

      clippingPlanes: "Przeciągnij aktywną płaszczyznę przycinania, aby dostosować cięcie",

      downloadSuccess: "Model został pomyślnie pobrany.",
      downloadError: "Nie udało się pobrać modelu.",

      iiifManifestGenerated: "Manifest IIIF został wygenerowany.",
      iiifManifestGenerationError: "Błąd podczas generowania manifestu IIIF.",

      containerNotFound: "Element kontenera nie został znaleziony. Proszę sprawdzić konfigurację Viewera.",
      missingFiles: "Brak wymaganych plików dla Viewera. Proszę sprawdzić konfigurację Viewera.",
      unsupportedFileFormat: "Nieobsługiwany format pliku.",

      performanceModeSet: "Tryb wydajności ustawiony na {mode}.",
      shadingModeApplied: "Ustawiono tryb cieniowania: {mode}.",
      customShaderError: "Własny shader się nie kompiluje:",
      angleHint: "Kliknij punkt początkowy, wierzchołek i punkt końcowy, aby zmierzyć kąt.",
      areaHint: "Klikaj narożniki obszaru. Kliknij ponownie pierwszy punkt lub naciśnij Enter, aby go zamknąć.",
      clippingEnabled: "Przekroje są włączone. Przeciągnij kolorową płaszczyznę lub użyj suwaków.",
      clippingDisabled: "Przekroje są wyłączone.",
    },
    pointCloud: {
      title: "Chmura punktów",
      toggle: "Ustawienia chmury punktów",
      collapse: "Ukryj ustawienia",
      expand: "Pokaż ustawienia",
      size: "Rozmiar punktów ×{value}",
      sizeMode: "Rozmiar",
      sizeModes: {
        adaptive: "Adaptacyjny (gęstość skanu)",
        fixed: "Stały (piksele)",
      },
      shape: "Kształt",
      color: "Kolor",
      edl: "Eye-Dome Lighting {value}%",
      streamed: "Strumieniowana: szczegóły doładowują się przy przybliżaniu.",
      points: "Punktów: {total}",
      thinned: "{loaded} z {total} punktów",
      shapes: {
        square: "Kwadrat",
        round: "Koło",
        sphere: "Kula",
      },
      classesTitle: "Klasy",
      autoClassified: "Klasy nadane automatycznie na podstawie geometrii - sprawdź, zanim na nich polegasz.",
      autoClassifiedModel: "Klasy nadane automatycznie przez model - sprawdź, zanim na nich polegasz.",
      classOther: "Klasa {value}",
      profile: "Profil",
      drawProfile: "Rysuj profil",
      cancelProfile: "Anuluj",
      clearProfile: "Usuń profil",
      profileWidth: "Szerokość profilu {value}",
      classNames: {
        0: "Nigdy niesklasyfikowane",
        1: "Niesklasyfikowane",
        2: "Grunt",
        3: "Niska roślinność",
        4: "Średnia roślinność",
        5: "Wysoka roślinność",
        6: "Budynek",
        7: "Niski punkt (szum)",
        8: "Punkt kluczowy modelu",
        9: "Woda",
        10: "Tory",
        11: "Nawierzchnia drogi",
        12: "Nakładanie",
        13: "Linka odgromowa",
        14: "Przewód",
        15: "Słup energetyczny",
        16: "Izolator",
        17: "Pomost mostu",
        18: "Wysoki szum",
      },
      colorModes: {
        rgb: "RGB",
        intensity: "Intensywność",
        height: "Wysokość",
        classification: "Klasyfikacja",
        tile: "Poziomy szczegółowości",
      },
    },
    certainty: {
      short: "LoC",
      field: "Poziom pewności (LoC)",
      legendTitle: "Poziom pewności (LoC)",
      none: "— bez oceny —",
      scope: "Dotyczy",
      scopeObject: "Obiektu",
      scopeGroup: "Grupy (obiekt nadrzędny)",
      unassessed: "Bez oceny",
      assessedCount: "Ocenione obiekty",
      opacity: "Krycie nakładki",
      filter: "Pokaż tylko ten poziom (kliknij ponownie, aby cofnąć)",
      selectAll: "Zaznacz wszystkie",
      selectNone: "Odznacz wszystkie",
      showView: "Pokaż poziom pewności",
      hideView: "Ukryj poziom pewności",
    },
    tour: {
      panel: "Wycieczka z przewodnikiem",
      start: "Rozpocznij wycieczkę",
      stop: "Zakończ wycieczkę",
      step: "Krok {current} / {total}",
      previous: "Poprzedni krok (P)",
      next: "Następny krok (N)",
      play: "Odtwarzaj wycieczkę",
      pause: "Wstrzymaj wycieczkę",
      close: "Zamknij wycieczkę (Esc)",
      untitled: "Adnotacja bez tytułu",
      saveView: "Zapisz bieżący widok kamery dla wycieczki",
      replaceView: "Zastąp zapisany widok wycieczki bieżącym widokiem kamery",
      annotationCount: "Adnotacje: {count}",
      idleHint: "Uruchom wycieczkę po zapisanych adnotacjach albo przechodź między nimi przyciskami ‹ ›.",
      dismiss: "Ukryj wycieczkę z przewodnikiem",
      showLeaderLines: "Pokaż linie odniesienia adnotacji",
      hideLeaderLines: "Ukryj linie odniesienia adnotacji",
      showSpread: "Rozłóż wszystkie adnotacje wokół modelu",
      hideSpread: "Zwiń adnotacje rozłożone wokół modelu",
      spreadLayer: "Adnotacje",
      showStack: "Pokaż adnotacje jako karty",
      hideStack: "Ukryj karty adnotacji",
      stackLayer: "Karty adnotacji",
    },
    animation: {
      player: "Odtwarzacz animacji",
      clip: "Klip animacji",
      allClips: "Wszystkie klipy",
      timeline: "Czas animacji",
      speed: "Prędkość odtwarzania",
      play: "Odtwórz (K)",
      pause: "Pauza (K)",
      loopOn: "Zapętlenie: wł.",
      loopOff: "Zapętlenie: wył.",
    },
    xr: {
      toggle: "Zobacz w VR lub AR",
      title: "VR i AR",
      close: "Zamknij",
      enterVr: "Zobacz w VR",
      exitVr: "Wyjdź z VR",
      enterAr: "Zobacz w AR",
      exitAr: "Wyjdź z AR",
      quickLook: "Otwórz w AR Quick Look",
      preparing: "Przygotowuję model…",
      arScale: "Rozmiar w AR",
      scaleTable: "Na stole",
      scaleReal: "Naturalna wielkość",
      checking: "Sprawdzam, co oferuje to urządzenie…",
      unsupported: "Ta przeglądarka nie obsługuje VR ani AR. Otwórz przeglądarkę modeli w goglach albo na telefonie.",
      vrHint: "Wskaż kontrolerem miejsce na ziemi i naciśnij spust, aby się tam przenieść.",
      hint: "W VR model ma naturalną wielkość; w AR stoi na stole albo ma naturalną wielkość.",
    },
    sun: {
      title: "Słońce i cienie",
      close: "Wyłącz słońce",
      time: "Pora dnia",
      date: "Dzień",
      followTimeline: "Rok z osi czasu",
      latitude: "Szerokość",
      longitude: "Długość",
      north: "Północ (°)",
      northHint: "Gdzie w scenie leży północ: stopnie zgodnie z ruchem wskazówek zegara od -Z, patrząc z góry",
      play: "Odtwórz dzień",
      pause: "Zatrzymaj dzień",
      position: "Słońce {azimuth}° {compass}, {elevation}° nad horyzontem",
      night: "Słońce jest pod horyzontem",
      riseSet: "wschód {sunrise}, zachód {sunset}",
    },
    weather: {
      title: "Pogoda",
      off: "Wyłączona",
      close: "Zamknij",
      clear: "Bezchmurnie",
      fog: "Mgła",
      rain: "Deszcz",
      snow: "Śnieg",
      storm: "Burza",
      intensity: "Natężenie",
      wind: "Wiatr",
      windDirection: "Kierunek wiatru",
      mistHeight: "Wysokość mgły",
      mistDensity: "Gęstość mgły",
      mistSpread: "Rozproszenie mgły",
      sky: "Niebo",
      surfaces: "Mokre powierzchnie i pokrywa śnieżna",
      sound: "Dźwięk",
    },
    scene: {
      title: "Sugerowana scena",
      semantic: {
        button: "Odczytaj teksty modelem językowym (ok. {size} MB, pobierany raz)",
        retry: "Spróbuj ponownie z modelem językowym",
        starting: "Wczytywanie modelu językowego…",
        loading: "Wczytywanie modelu językowego… {percent}%",
        reading: "Odczytywanie tekstów…",
        failed: "Nie udało się wczytać modelu językowego.",
        done: "Model językowy odczytał fragmenty tekstów: {passages}.",
        nothing: "Brak tekstów do odczytania przez model językowy.",
      },
      close: "Zamknij",
      intro: "Dobrana regułami na podstawie nazwy pliku, metadanych, manifestu oraz rozmiaru i materiałów modelu. Nic się nie zmienia, dopóki jej nie zastosujesz.",
      basis: "Na czym się opiera",
      apply: "Zastosuj zaznaczone",
      undo: "Cofnij",
      applied: "Zastosowano. „Cofnij” przywraca poprzedni stan.",
      undone: "Przywrócono poprzedni stan.",
      suggested: "(sugerowane)",
      on: "włączone",
      off: "wyłączone",
      unchanged: "bez zmian",
      sunYearTimeline: "rok z osi czasu",
      purpose: {
        documentation: "Dokumentacja",
        presentation: "Prezentacja",
      },
      confidence: {
        high: "pewne",
        medium: "dość pewne",
        low: "niepewne",
      },
      setting: {
        outdoor: "plener",
        indoor: "wnętrze",
        studio: "pojedynczy obiekt",
      },
      size: {
        object: "mały obiekt",
        "large-object": "duży obiekt",
        building: "budynek",
        site: "teren lub krajobraz",
      },
      kind: {
        mesh: "Model: siatka",
        pointcloud: "Model: chmura punktów",
        splats: "Model: Gaussian splats",
      },
      unit: {
        user: "jednostka ustawiona przez Ciebie",
        manifest: "jednostka z manifestu",
        file: "jednostka z pliku",
        config: "jednostka z ustawień",
        default: "jednostka nieznana, przyjęto metry",
      },
      source: {
        manifest: "manifestu",
        text: "metadanych",
        timeline: "osi czasu",
        year: "roku w metadanych",
        century: "wieku w metadanych",
        geonames: "miejscowości wymienionej w tekstach (GeoNames)",
      },
      season: {
        winter: "zima",
        spring: "wiosna",
        summer: "lato",
        autumn: "jesień",
      },
      sunTime: {
        sunsetBefore: "{hours} h przed zachodem słońca",
        sunsetAfter: "{hours} h po zachodzie słońca",
        sunriseBefore: "{hours} h przed wschodem słońca",
        sunriseAfter: "{hours} h po wschodzie słońca",
      },
      fact: {
        size: "Rozmiar: {size} ({unit})",
        baked: "Oświetlenie zapisane już w teksturach lub kolorach (skan lub splaty)",
        location: "Miejsce: {place} (z {source})",
        year: "Rok: {year} (z {source})",
        keywords: "Znalezione słowa: {words}",
        semantic: "Teksty odczytane przez model językowy ({model}, w przeglądarce)",
        shape: "Geometria: powierzchnie w górę {up}, w dół {down}, pionowe {sideways}; grunt {ground} rzutu; ściany widziane od środka z {enclosure} kierunków",
        setting: "Otoczenie: {setting} ({confidence})",
      },
      uncertain: {
        place: "Miejsce jest nieznane: słońce stoi jak w miejscu domyślnym (50° N, 10° E). Ustaw je w „Słońce i cienie”.",
        placeGuess: "Miejsce jest przypuszczeniem: {name}. Sprawdź je w „Słońce i cienie”.",
      },
      reason: {
        keywords: "teksty mówią {words}",
        size: "rozmiar: {size}",
        ifc: "model budynku IFC",
        noEvidence: "nic nie wskazuje, gdzie się znajduje",
        splatsBaked: "Gaussian splats mają własne oświetlenie",
        pointsNoNormals: "punkty bez normalnych nie reagują na światło",
        notOutdoor: "nie plener: {setting}",
        documentationNeutral: "dokumentacja: równe światło, które niczego nie ukrywa",
        outdoorPresentation: "plener, pokazany we własnym świetle",
        bakedSun: "tekstury mają własne światło i cienie",
        place: "miejsce z {source}",
        placeNamed: "teksty wymieniają {name} (GeoNames)",
        semantic: "model językowy odczytuje: {setting} ({percent}%)",
        semanticPurpose: "model językowy odczytuje: {purpose} ({percent}%)",
        semanticRelief: "model językowy odczytuje relief do odczytania ({percent}%)",
        enclosed: "ściany dookoła, widziane od środka ({percent}% kierunków)",
        ceiling: "strop nad podłogą",
        ground: "otwarty grunt ({percent}% rzutu)",
        flat: "płaski i rozległy: teren lub stanowisko",
        thinPlate: "cienka płyta: relief do odczytania",
        yearTimeline: "rok podąża za osią czasu",
        year: "rok {year}, z {source}",
        season: "pora roku: {season}",
        timeDawn: "rano, jak mówią teksty",
        timeNoon: "południe, jak mówią teksty",
        timeDusk: "wieczór, jak mówią teksty",
        timeAfternoon: "późne popołudnie: niskie słońce i długie cienie pokazują kształt",
        hidesGeometry: "dokumentacja: pogoda zasłoniłaby geometrię",
        weatherNamed: "teksty mówią {words}",
        clearSky: "czyste niebo z mgiełką przy horyzoncie",
        phoneLighter: "lżej na telefonie",
        presentationNoRaking: "prezentacja: światło skośne służy do odczytu reliefu",
        relief: "relief do odczytania: {words}",
        studioRelief: "obiekt: światło pod kątem pokazuje powierzchnię",
        noRelief: "brak wzmianki o reliefie",
        noNormals: "model nie ma normalnych",
        agxSun: "AgX zachowuje światła słońca",
        neutralColours: "Neutralne zachowuje wierne kolory",
        aoPoints: "nie dla chmur punktów",
        phonePerformance: "zbyt ciężkie dla telefonu",
        bakedAo: "cieniowanie jest już w teksturach",
        aoHeavy: "zbyt wiele trójkątów",
        aoShape: "cienie kontaktowe wydobywają kształt",
        unlit: "materiały nie reagują na światło",
      },
    },
    photos: {
      title: "Zdjęcia historyczne",
      closePanel: "Zamknij",
      empty: "Brak zdjęć. Dodaj zdjęcie zrobione z bieżącego widoku.",
      opacity: "Zdjęcie",
      swipe: "Linia podziału zamiast przenikania",
      divider: "Przeciągnij, aby porównać zdjęcie z modelem",
      return: "Wróć do widoku zdjęcia",
      hide: "Ukryj zdjęcie",
      align: "Dopasuj",
      cancelAlign: "Zakończ dopasowanie",
      alignHint: "Przesuń kamerę, aż model nałoży się na zdjęcie, potem ustaw obiektyw i pochylenie.",
      fov: "Obiektyw (pole widzenia)",
      roll: "Pochylenie",
      save: "Zapisz widok",
      remove: "Usuń zdjęcie",
      add: "Dodaj zdjęcie",
      url: "URL obrazu lub IIIF info.json",
      label: "Tytuł",
      year: "Rok",
      addUrl: "Dodaj",
      addFile: "Z pliku…",
      onSite: {
        open: "Na miejscu (aparat)",
        openTitle: "Nałóż zdjęcie na miejsce przez aparat telefonu",
        pick: "Dotknij zdjęcia, które chcesz zobaczyć na miejscu.",
        title: "Zdjęcie na miejscu",
        close: "Zamknij aparat",
        hint: "Stań tam, skąd zrobiono zdjęcie. Przesuń zdjęcie jednym palcem, dwoma powiększ i obróć, aż nałoży się na miejsce.",
        starting: "Uruchamianie aparatu…",
        fade: "Przenikanie",
        divider: "Linia podziału",
        dividerHandle: "Przeciągnij, aby porównać dawniej i dziś",
        peek: "Przytrzymaj: dawniej",
        peekTitle: "Przytrzymaj, aby zobaczyć tylko zdjęcie",
        reset: "Resetuj",
        capture: "Zapisz porównanie",
        captured: "Zapisano porównanie.",
        captureFailed: "Nie udało się zapisać porównania: serwer zdjęcia na to nie pozwala.",
      },
    },
    menus: {
      look: "Wygląd",
      analysis: "Analiza",
      measure: "Pomiary",
      tools: "Narzędzia",
      story: "Opowieść",
      model: "Model",
      file: "Plik",
      settings: "Ustawienia",
      more: "Więcej",
      close: "Zamknij",
    },
    compare: {
      title: "Porównaj",
      open: "Porównaj dwa warianty obok siebie",
      close: "Zamknij porównanie",
      years: "Porównaj dwa lata",
      left: "Lewa strona",
      right: "Prawa strona",
      divider: "Przeciągnij, aby porównać (strzałki przesuwają)",
      toSplit: "Obok siebie",
      toSplitHint: "Pokaż obie strony obok siebie",
      toSwipe: "Przesuwanie",
      toSwipeHint: "Pokaż obie strony w jednym widoku, z linią podziału",
      variantsGroup: "Warianty",
      timelineGroup: "Oś czasu",
      shadingGroup: "Cieniowanie",
      leftLighting: "Lewa strona: oświetlenie",
      rightLighting: "Prawa strona: oświetlenie",
      lightingCurrent: "Oświetlenie jak ustawione",
      lightingNoEnvironment: "Bez mapy otoczenia",
      lightingEnvironment: "Otoczenie: {name}",
      openLook: "Cieniowanie/oświetlenie obok siebie",
      variantsTitle: "Warianty rekonstrukcji",
      expand: "Pokaż warianty",
      collapse: "Ukryj warianty",
    },
    timeline: {
      title: "Oś czasu",
      year: "Rok",
      play: "Odtwórz (K)",
      pause: "Pauza (K)",
      previous: "Poprzedni punkt",
      next: "Następny punkt",
      speed: "Prędkość odtwarzania",
      collapse: "Zwiń oś czasu",
      expand: "Rozwiń oś czasu",
      about: "O tej osi czasu",
      documented: "Źródła",
      modelled: "Model",
      circa: "ok. {year}",
      bce: "{year} p.n.e.",
      source: "Źródło: {source}",
    },
    measurement: {
      title: "Pomiary",
      close: "Zamknij pomiary (kończy mierzenie i je czyści)",
      distance: "Odległość",
      angle: "Kąt",
      area: "Pole",
      dimensions: "Wymiary modelu",
      surface: "Pole powierzchni",
      volume: "Objętość",
      volumeNote: "Poprawna tylko dla zamkniętych siatek",
      perimeter: "Obwód",
      segments: "Odcinki: {count}",
      finish: "Zakończ",
      finishHint: "Zakończ bieżący pomiar (Enter)",
      clear: "Wyczyść",
      clearAll: "Wyczyść pomiary",
      modelUnit: "Jednostka modelu",
      unitLine: "Jednostka modelu: {unit} ({source})",
      unitImplausible: "Model ma {size} szerokości - czy jednostka jest poprawna?",
      unitUse: "Traktuj model jako narysowany w {unit}",
      unitKeep: "{unit} jest poprawne",
      displaySystem: "Pokazuj w",
      metric: "Metryczne",
      imperial: "Imperialne",
      unitSource: {
        user: "Twój wybór",
        manifest: "z manifestu",
        file: "z pliku",
        config: "ustawienia viewera",
        default: "domyślnie",
      },
      unitNames: {
        auto: "Automatycznie (manifest, plik lub metry)",
        m: "Metry",
        cm: "Centymetry",
        mm: "Milimetry",
        in: "Cale",
        ft: "Stopy",
      },
      hint: {
        distance: "Klikaj punkty na modelu, aby zmierzyć ścieżkę.",
        angle: "Kliknij punkt początkowy, wierzchołek i punkt końcowy.",
        area: "Klikaj narożniki obszaru; kliknij ponownie pierwszy punkt lub naciśnij Enter, aby go zamknąć.",
      },
    },
    clipping: {
      title: "Przekroje",
      toggleAxis: "Przekrój wzdłuż {axis}",
      position: "Położenie {axis}",
      flip: "Odwróć zachowaną stronę",
      fill: "Wypełnienie przekroju",
      reset: "Resetuj",
    },
    contextMenu: {
      editMaterial: "Edytuj materiał „{name}”",
      aria: "Akcje",
      ask: "Zapytaj o ten element",
      hide: "Ukryj element",
      showHidden: "Pokaż ukryte elementy ({count})",
      focus: "Przybliż do tego punktu",
      reset: "Resetuj widok",
      showAll: "Pokaż wszystkie elementy",
      sameType: "Zaznacz wszystkie tego typu",
      sameTypeFound: "Elementów tego typu: {count}",
      isolate: "Pokaż tylko ten element",
      copyGuid: "Kopiuj GlobalId",
      guidCopied: "Skopiowano: {value}",
      measure: "Mierz od tego miejsca",
      annotate: "Dodaj adnotację tutaj",
      cut: "Przetnij poziomo tutaj",
      removeCuts: "Usuń przekroje",
      copyPoint: "Kopiuj współrzędne",
      pointCopied: "Skopiowano: {value}",
      copyFailed: "Nie udało się skopiować: {value}",
      finishMeasurement: "Zakończ pomiar",
      undoPoint: "Usuń ostatni punkt",
      cancelMeasurement: "Odrzuć pomiar",
      stopMeasuring: "Zakończ mierzenie",
      annotateFaces: "Dodaj adnotację do zaznaczonych ścian ({count})",
      clearFaces: "Wyczyść zaznaczenie",
      stopPicking: "Zakończ zaznaczanie ścian",
    },
    materials: {
      applySuggested: "Zastosuj",
      applyAllSuggested: "Zastosuj rodzaje podpowiedziane przez nazwy ({count})",
      suggested: "Nazwa podpowiada: {type}",
      title: "Materiały",
      unnamed: "Materiał {number}",
      empty: "Ten model nie ma materiałów do edycji (chmura punktów lub splaty).",
      showOriginal: "Pokaż materiały",
      filter: "Szukaj…",
      filterLabel: "Znajdź materiał po nazwie",
      reset: "Przywróć",
      resetHint: "Materiał taki, jak wczytany",
      presets: "Rodzaj materiału",
      group: {
        glass: "Szkło",
        wood: "Drewno",
        walls: "Ściany i kamień",
        metal: "Metal",
        other: "Inne",
      },
      preset: {
        glass: "Szkło",
        frostedGlass: "Szkło matowe",
        tintedGlass: "Szkło barwione",
        water: "Woda",
        lightWood: "Jasne drewno",
        darkWood: "Ciemne drewno",
        varnishedWood: "Drewno lakierowane",
        plaster: "Tynk",
        paintedWall: "Ściana malowana",
        concrete: "Beton",
        brick: "Cegła",
        sandstone: "Piaskowiec",
        marble: "Marmur",
        terracotta: "Terakota",
        ceramic: "Ceramika szkliwiona",
        steel: "Stal",
        aluminium: "Aluminium",
        iron: "Żelazo",
        brass: "Mosiądz",
        gold: "Złoto",
        copper: "Miedź",
        bronze: "Brąz",
        mirror: "Lustro",
        plastic: "Plastik",
        rubber: "Guma",
        fabric: "Tkanina",
        clay: "Glina",
        light: "Źródło światła",
      },
      keepTexture: "Zachowaj teksturę",
      properties: "Właściwości",
      field: {
        color: "Kolor",
        roughness: "Chropowatość",
        metalness: "Metaliczność",
        opacity: "Krycie",
        transmission: "Przezroczystość (szkło)",
        clearcoat: "Lakier",
        emissive: "Kolor świecenia",
        emissiveIntensity: "Siła świecenia",
        doubleSided: "Obie strony",
      },
      resetAll: "Przywróć wszystkie materiały",
      saveNote: "Zapisywane z ustawieniami modelu: Plik > Zapisz ustawienia.",
      shadingNote: "Włączony jest inny tryb cieniowania: zmiany widać przy oryginalnych materiałach.",
      picking: "Kliknij model… (Esc: anuluj)",
      pick: "Wskaż na modelu",
      count: "Materiały: {count}",
      edited: "zmieniony",
      meshes: "części: {count}",
      basedOn: "Rodzaj: {type}",
      editedCopy: "Zmieniony (oryginał zachowany)",
      asLoaded: "Jak wczytany",
    },
    performance: {
      heavy: "Model ciężki dla tego urządzenia ({triangles} mln trójkątów).",
      title: "Jakość renderowania",
      quality: {
        high: "Pełna jakość",
        balanced: "Zrównoważona",
        fast: "Szybka",
      },
      lowered: "Jakość renderowania: {quality}.",
      undo: "Cofnij",
      slow: "Widok się przycina (ok. {fps} klatek na sekundę).",
      offer: {
        balanced: "Zrównoważona: bez okluzji otoczenia, nieco mniej ostro na ekranach o wysokiej rozdzielczości.",
        fast: "Szybka: bez post-processingu, niższa rozdzielczość.",
      },
      lower: "Przełącz na: {quality}",
    },
    prepare: {
      badge: "{count} do poprawy",
      title: "Przygotuj do publikacji",
      intro: "Zanim ustawienia trafią do repozytorium i powstaną rendery: co by się w nich pokazało, a nie powinno.",
      recheck: "Sprawdź ponownie",
      next: "Dalej",
      fixed: "Poprawiono: {count}.",
      fixAll: "Popraw wszystko ({count})",
      passed: "W porządku: {count}",
      orientationHint: "Jego największe płaskie ściany są z boku, a nie na dole.",
      summary: {
        wait: "Czekam na model…",
        fix: "Do poprawy: {fixes} · wskazówki: {tips}",
        ready: "Gotowe do publikacji · wskazówki: {tips}",
      },
      guard: {
        save: "Przed zapisem: do poprawy {count}",
        preview: "Przed miniaturą: do poprawy {count}",
        thumbnails: "Przed renderami: do poprawy {count}",
        review: "Przejrzyj",
        continue: "Mimo to kontynuuj",
      },
      step: {
        frontNone: "Przód: strona, z której patrzy widok startowy (jeszcze nie zapisany: przód z pliku)",
        front: "Przód: strona, z której patrzy widok startowy ({angle}°)",
        save: "Zapisz ustawienia",
        saved: "Zapisano o {time}",
        changed: "Zmieniono od zapisu",
        unsaved: "Nie zapisano w tej sesji",
        thumbnails: "Wygeneruj rendery",
        thumbnailsNote: "Dziewięć widoków modelu, tak jak wygląda teraz",
        preview: "Wygeneruj miniaturę główną",
        previewNote: "Z bieżącego widoku",
      },
      fix: {
        suggested: "Zastosuj rodzaje",
        orientation: "Postaw pionowo",
        ground: "Postaw na ziemi",
        framing: "Wykadruj model",
        brighter: "Rozjaśnij",
        darker: "Przyciemnij",
        clipping: "Usuń przekroje",
        measurements: "Wyczyść",
        faces: "Wyczyść zaznaczenie",
        hide: "Ukryj",
        off: "Wyłącz",
        clearSelection: "Usuń podświetlenie",
        shading: "Oryginalne materiały",
        quality: "Pełna jakość",
        materials: "Otwórz materiały",
        metadata: "Raport walidacji",
      },
      check: {
        suggested: "Rodzaje materiałów z nazw: {count}",
        suggestedDetail: "Nazwy jak „szkło” czy „drewno” przy materiałach jeszcze nieruszonych: ich rodzaje jednym kliknięciem (cofniesz w Wygląd > Materiały).",
        loading: "Model jeszcze się wczytuje",
        loadingDetail: "Sprawdź ponownie, gdy pojawi się pełny model.",
        orientationOk: "Stoi pionowo",
        upsideDown: "Model wydaje się odwrócony do góry nogami",
        onSide: "Model wydaje się leżeć na boku",
        orientationDetail: "Jego płaska podstawa nie jest na dole. Oś w górę {axis} postawiłaby go pionowo.",
        orientationRotated: "Został obrócony ręcznie: sprawdź obrót.",
        groundOk: "Stoi na ziemi",
        floating: "Model unosi się nad ziemią",
        sunk: "Model sięga pod ziemię",
        groundDetail: "O {share} swojej wysokości.",
        framingOk: "Cały model jest w widoku",
        inside: "Widok jest wewnątrz modelu",
        insideDetail: "W porządku dla wnętrza; tak pokażą go zapisany widok startowy i miniatura.",
        cut: "Część modelu jest poza widokiem",
        small: "Model jest mały w widoku",
        cutDetail: "Ok. {percent} modelu jest ucięte w zapisanym widoku startowym i miniaturze.",
        smallDetail: "Zajmuje ok. {percent} widoku.",
        exposureOk: "Dobrze oświetlony",
        dark: "Model wygląda na zbyt ciemny",
        bright: "Model wygląda na zbyt jasny",
        exposureDetail: "Średnia jasność {percent}.",
        toolsOk: "Żadne narzędzie nie zostało włączone",
        toolDetail: "Byłoby widać to na renderach.",
        clipping: "Płaszczyzny przekroju tną model",
        measurements: "Na modelu są pomiary",
        faces: "Zaznaczone są ściany",
        transform: "Widoczne są uchwyty przesuwania / obrotu",
        lightTransform: "Widoczne są uchwyty światła",
        wireframe: "Włączona siatka (wireframe)",
        certainty: "Włączone są kolory poziomu pewności",
        selection: "Części są podświetlone",
        shading: "Cieniowanie: {mode}",
        shadingDetail: "Rendery pokażą ten tryb, a nie materiały.",
        weather: "Pogoda: {type}",
        weatherDetail: "Będzie widoczna na renderach; w porządku, jeśli to zamierzone.",
        quality: "Obniżona jakość renderowania: {quality}",
        qualityDetail: "Rendery miałyby niższą rozdzielczość i bez części efektów.",
        unitsLarge: "Czy jednostka jest dobra? Model ma {size}",
        unitsSmall: "Czy jednostka jest dobra? Model ma tylko {size}",
        unitsDetail: "Plik nie podaje swojej jednostki: ustaw ją w menu pomiarów - zależą od niej wymiary i słońce.",
        black: "Czarne materiały",
        invisible: "Niewidoczne materiały",
        heavy: "Ciężki dla telefonów",
        heavyDetail: "{triangles} mln trójkątów, tekstury do {texture} px: zoptymalizowana kopia z workera wczyta się szybciej.",
        metadata: "Metadane i prawa",
        metadataDetail: "Raport walidacji sprawdza tytuł, opis i licencję.",
      },
    },
    shortcuts: {
      title: "Sterowanie",
      mouse: "Mysz: przeciągnij, aby obracać, rolka - zoom, prawy przycisk - przesuwanie, prawy klik - akcje, przycisk wstecz - zamyka",
      keyboard: "Klawiatura: strzałki - obrót, Shift+strzałki - szybciej, Ctrl/Cmd+strzałki - przesuwanie, +/- — zoom, Spacja - auto-obrót, Esc - wstecz, Backspace - usuwa ostatni punkt pomiaru",
      touch: "Dotyk: szczypanie, aby przybliżyć, przeciągnij, aby obracać, dotknij i przytrzymaj, aby przesunąć, przytrzymaj palec - akcje, stuknięcie dwoma palcami lub gest wstecz - cofnij",
      dragAndDrop: "Lub przeciągnij i upuść model 3D w oknie viewer'a",
      helpButtonAria: "Pokaż podpowiedzi dotyczące obsługi",
      closeAria: "Zamknij",
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
      shareView: "Ansicht teilen",
      copyShareView: "Link zur geteilten Ansicht kopieren",
      download: "Herunterladen",
      uploadModel: "Hochladen & konvertieren",
      openUploadPanel: "3D-Modell zur Konvertierung hochladen",
      openModelsPanel: "Zuvor generierte Modelle durchsuchen",
      openLocalFile: "Modelle auf diesem Gerät",
      openModels: "Modelle",
      openExampleManifests: "Beispiel-Manifeste",
      openAdminPanel: "Verwaltung (Benutzer, Pläne, Limits)",
      openLoginPanel: "Anmelden oder registrieren",
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
      close: "Nicht jetzt",
      picking: "Fläche anklicken, Strg + Klick fügt weitere hinzu, Umschalt + Ziehen wählt einen Bereich",
      pickingSelected: "{count} Flächen ausgewählt · Enter: Anmerkung hinzufügen · Esc: leeren",
      pickingTouch: "Flächen antippen, um sie auszuwählen; erneutes Antippen hebt die Auswahl auf",
      pickingSelectedTouch: "{count} Flächen ausgewählt · Fläche antippen, um sie hinzuzufügen oder zu entfernen",
      pickingAnnotate: "Anmerkung hinzufügen",
      pickingClear: "Leeren",
      pickingSelect: "Wählen Sie mindestens eine Fläche aus, um eine Anmerkung hinzuzufügen.",
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
      on: "AN",
      off: "AUS",
      environmentMapNeutral: "Neutral",
      environmentMapSunny: "Sonnig",
      environmentMapStudio: "Studio",
      environmentMapGoldenHour: "Goldene Stunde",
      transform: "Transformieren",
      annotateAdd: "Annotation hinzufügen",
      annotateImport: "Annotationen importieren",
      annotateExport: "Annotationen exportieren",
      enableClippingPlanesMode: "Schnittebenen",
      disableClippingPlanesMode: "Schnittebenen ausblenden",
      annotatePhotos: "Historische Fotos",
      mainMenu: "Hauptmenü",
      moveToolbar: "Werkzeugleiste verschieben",
      orbit: "Navigationsmodus",
      controls: "Steuerung",
      editor: "Editor",
      transform3dObject: "3D-Objekt transformieren",
      transformLight: "Licht transformieren",
      transformMode: "Transformationsmodus",
      directionalLight: "Gerichtetes Licht",
      ambientLight: "Umgebungslicht",
      ambient: "Ambient",
      lights: "Beleuchtung",
      cameraLight: "Kamera-Licht",
      backgroundColor: "Hintergrundfarbe",
      backgroundColorOuter: "Äußere Hintergrundfarbe",
      groundTitle: "Boden",
      ground: {
        contact: "Kontaktschatten",
        mirror: "Spiegel",
        grid: "Raster",
        turntable: "Drehteller",
        spotlight: "Spotlicht",
        dots: "Punktraster",
      },
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
      validationReport: "Prüfbericht",
      clearSelectedFaces: "Ausgewählte Flächen löschen",
      clearSelectedHierarchy: "Ausgewählte Objekte abwählen",
      addAnnotations: "Anmerkungen hinzufügen",
      exportAnnotationsXml: "Anmerkungen XML exportieren",
      importAnnotationsXml: "Anmerkungen XML importieren",
      IIIFimport: "3IF importieren",
      IIIFexport: "IIIF exportieren",
      resetCameraPosition: "Kameraposition zurücksetzen",
      resetSettings: "Einstellungen zurücksetzen",
      saveSettings: "Einstellungen speichern",
      renderPreview: "Hauptvorschaubild ändern",
      generateThumbnails: "Vorschaubilder erzeugen",
      color: "Farbe",
      intensity: "Intensität",
      metalness: "Metallizität",
      emissive: "Emissiv",
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
      upAxis: "Hochachse des Modells",
      upAxisYPlus: "Y oben (Standard)",
      upAxisYMinus: "Kopfüber (-Y oben)",
      upAxisZPlus: "Z oben",
      upAxisZMinus: "-Z oben",
      upAxisXPlus: "X oben",
      upAxisXMinus: "-X oben",
      scale: "Skalieren",
      target: "Ziel",
      local: "Lokal",
      global: "Global",
      linear: "Linear",
      gradient: "Farbverlauf",
      editMaterial: "Material bearbeiten",
      selectByMaterial: "nach Material auswählen",
      hideAdvancedEditor: "Erweiterten Editor ausblenden",
      showAdvancedEditor: "Erweiterten Editor anzeigen",
      showLoadingLogs: "Ladeprotokolle anzeigen",
      hideLoadingLogs: "Ladeprotokolle ausblenden",
      showCredits: "Credits anzeigen",
      hideCredits: "Credits ausblenden",
      hierarchy: "Hierarchie",
      expand: "Werkzeugleiste erweitern",
      collapse: "Werkzeugleiste zusammenklappen",
      orthographicProjection: "Zur orthografischen Projektion wechseln",
      perspectiveProjection: "Zur perspektivischen Projektion wechseln",
      environmentMap: "Umgebungsmap",
      environmentMapToggle: "Umgebungsmap wechseln",
      rendering: "Rendering",
      toneMapping: "Tone Mapping",
      toneMappingNeutral: "Neutral",
      toneMappingLinear: "Linear",
      toneMappingNone: "Keins",
      exposure: "Belichtung",
      postprocessing: "Nachbearbeitung",
      antialiasing: "Kantenglättung",
      ambientOcclusion: "Umgebungsverdeckung (AO)",
      ambientOcclusionIntensity: "Stärke der Umgebungsverdeckung",
      rakingLight: "Streiflicht",
      rakingLightDirection: "Richtung",
      rakingLightHeight: "Höhe über der Oberfläche",
      rakingLightSweep: "Umlaufen lassen",
      antialiasingNone: "Keine",
      environmentMapIntensity: "Intensität der Umgebungsmap",
      environmentMapStyleNeutral: "Neutral",
      environmentMapStyleSunny: "Sonnig",
      environmentMapStyleStudio: "Studio",
      environmentMapStyleGoldenHour: "Goldene Stunde",
      enableWireframeMode: "Drahtgittermodus aktivieren",
      disableWireframeMode: "Drahtgittermodus deaktivieren",
      download: "Modell herunterladen",
      shading: "Schattierung",
      shadingOriginal: "Originalmaterialien",
      shadingStandard: "Standard (PBR)",
      shadingPhong: "Phong",
      shadingLambert: "Lambert",
      shadingToon: "Toon",
      shadingFlat: "Flache Schattierung (Flächen zeigen)",
      shadingClay: "Ton (ohne Textur)",
      shadingMatcap: "Matcap (Studio-Ton)",
      shadingNormals: "Normalen",
      shadingCustom: "Eigener Shader",
      shadingCustomVertex: "Vertex-Shader",
      shadingCustomFragment: "Fragment-Shader",
      shadingCustomApply: "Anwenden",
      shadingCustomReset: "Auf Standard zurücksetzen",
    },
    metadata: {
      modelDetails: "Modelldetails",
      iiifManifest: "IIIF-Manifest: in einen anderen IIIF-Viewer ziehen oder öffnen",
      metadata: "Metadaten",
      visualizedFile: "Visualisierte Datei",
      vertices: "Vertices",
      faces: "Flächen",
      summary: "{format} · {vertices} Vertices",
      title: "Titel",
      author: "Autor",
      authorAffiliation: "Autoren-Zugehörigkeit",
      license: "Lizenz",
      description: "Beschreibung",
      objectType: "Objekttyp",
      reconstructionAuthors: "Rekonstruktionsautoren",
      reconstructionPeriod: "Rekonstruktionsperiode",
      move: "Verschieben",
      close: "Schließen",
    },
    manifesto: {
      source: "Manifesttyp",
      refreshExamples: "Beispielliste aktualisieren",
      invalidUrl: "Bitte geben Sie eine gültige Manifest-URL ein.",
      invalidJson: "Bitte geben Sie einen gültigen Manifest-JSON-Text ein.",
      scene: "Szene",
      sceneNumber: "Szene {number}",
      camera: "Kamera",
      cameraNumber: "Kamera {number}",
      treeView: "Baum",
      jsonView: "JSON",
      expandAll: "Alle aufklappen",
      collapseAll: "Alle zuklappen",
      treeItems: "{count} Elemente",
      treeItem: "{count} Element",
      treeKey: "{count} Schlüssel",
      treeKeys: "{count} Schlüssel",
      treeEditHint: "Zum Bearbeiten klicken, Enter bestätigt, Esc bricht ab",
      retargetTitle: "Diese Einstellungen für ein anderes Modell verwenden",
      retargetHint: "Licht, Rendering und Schattierung bleiben; Annotationen, Vorschaubilder, die Zeitleiste und die Schnittebenen gehören zum aktuellen Modell und werden weggelassen.",
      retargetPlaceholder: "Modell-URL (GLB, glTF, OBJ, ...)",
      retargetKeepCamera: "Kamera beibehalten",
      retargetApply: "Anwenden",
      retargetInvalidUrl: "Geben Sie die URL eines Modells ein.",
      retargetNoModel: "Es ist kein Modell geladen, dessen Einstellungen verwendet werden könnten.",
      retargetDone: "Einstellungen auf {model} angewendet. Das neue Manifest steht im Textfeld.",
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
      optionP4Local: "Kamera, Lichter und Kommentare (localhost)",
      optionCamera: "Positionierte Kamera",
      optionLights: "Lichter mit Farben und Intensitäten",
      optionComments: "Kommentare mit eigenen Ansichten",
    },
    aim3if: {
      loader: "AIM3D-Loader",
      collapse: "Zusammenklappen",
      expand: "Erweitern",
      modelConfig: "Modellkonfiguration",
      loadFromUrl: "Von URL laden",
      loadFromText: "Von Text laden",
      manifestUrlPlaceholder: "https://example.org/aim3d/manifest.json",
      manifestTextPlaceholder: "AIM3D-Manifest-JSON hier einfügen...",
      optionDefault: "Standardkonfiguration",
      optionBox: "Box-Konfiguration",
      optionBoxLocal: "Box (localhost)",
      optionWolpaLocal: "Synagoge Wolpa (localhost)",
      optionWolpaLocalCeiling: "Synagoge Wolpa - Deckenansicht (localhost)",
      optionWolpaGoldenHour: "Synagoge Wolpa - goldene Stunde, ACES (localhost)",
      optionWolpaStudio: "Synagoge Wolpa - Studio, AgX (localhost)",
      optionWolpaNight: "Synagoge Wolpa - nächtliche Strahler, Reinhard (localhost)",
      optionWolpaNightTour: "Synagoge Wolpa - Nacht, Anmerkungen und Führung (localhost)",
      optionWolpaCertainty: "Synagoge Wolpa - Grad der Gewissheit (localhost)",
      optionWolpaToon: "Synagoge Wolpa - Toon-Shading (localhost)",
      optionWolpaOvercast: "Synagoge Wolpa - bewölkt, Lambert, Cineon (localhost)",
      optionWolpaClayAo: "Synagoge Wolpa - Ton, Umgebungsverdeckung (localhost)",
      optionWolpaRaking: "Synagoge Wolpa - Streiflicht, umlaufend, Ton (localhost)",
      optionWolpaRakingTexture: "Synagoge Wolpa - Streiflicht auf den Texturen (localhost)",
      optionWolpaMatcap: "Synagoge Wolpa - Matcap, Studio-Ton (localhost)",
      optionWolpaFlat: "Synagoge Wolpa - flache Schattierung, Flächen sichtbar (localhost)",
      optionWolpaNormals: "Synagoge Wolpa - Oberflächennormalen (localhost)",
      optionWolpaContours: "Synagoge Wolpa - eigener Shader: Höhenlinien (localhost)",
      optionWolpa4D: "Synagoge Wolpa - 4D-Zeitleiste: Alterung 1730-1936 (localhost)",
    },
    localPreview: {
      loadExampleModel: "Beispielmodell laden",
      noExampleModel: "Anderes Modell",
    },
    toolPanel: {
      move: "Panel verschieben (Doppeltipp: andocken)",
      minimize: "Panel minimieren",
      restore: "Panel wiederherstellen",
      close: "Panel schließen",
    },
    gallery: {
      label: "Ansichten des Modells",
      dialog: "Bildbetrachter",
      open: "Ansicht {number} öffnen: {label}",
      openPlain: "Ansicht {number} öffnen",
      previous: "Vorherige Ansicht",
      next: "Nächste Ansicht",
      close: "Schließen (Esc)",
      top: "Draufsicht",
      view: "Ansicht {number}",
      zoomReset: "Zoom zurücksetzen",
      hint: "Mausrad oder zwei Finger: Zoom · Doppelklick: Detail · Pfeiltasten: blättern",
    },
    credits: {
      title: "Credits",
      close: "Schließen",
    },
    bugReport: {
      button: "Fehler melden",
      title: "Fehler melden",
      description: "Was ist schiefgelaufen? Was haben Sie kurz davor getan?",
      email: "E-Mail (optional, für Rückfragen)",
      includeDiagnostics: "Technische Details anhängen (Gerät, Browser, Modell, letzte Fehler)",
      privacy: "Die Meldung geht nur an die Entwickler des Viewers.",
      send: "Meldung senden",
      cancel: "Abbrechen",
      sent: "Danke - die Meldung wurde gesendet.",
      failed: "Die Meldung konnte nicht gesendet werden. Bitte später erneut versuchen.",
    },
    embedPanel: {
      title: "Einbettungsoptionen",
      closeAria: "Einbettungsoptionen schließen",
      modelUrl: "Modell-URL",
      modelUrlPlaceholder: "/examples/box.glb",
      entityId: "Entitäts-ID",
      theme: "Thema",
      themeDark: "Dunkel",
      themeLight: "Hell",
      autoRotateSpeed: "Rotationsgeschwindigkeit",
      cameraPosition: "Position",
      cameraTarget: "Ziel",
      cameraVectorPlaceholder: "x,y,z",
      fov: "FOV",
      autoRotate: "Auto-Rotation",
      disableInteraction: "Interaktion deaktivieren",
      hideActionMenu: "Aktionsmenü ausblenden",
      hideMetadata: "Metadaten ausblenden",
      presentationMode: "Präsentationsmodus",
      useCurrentCamera: "Aktuelle Kamera",
      useCurrentCameraHint: "Die Kamera des Viewers hinter diesem Fenster",
      resetFromViewer: "Zurücksetzen",
      resetFromViewerHint: "Alle Optionen so, wie der Viewer sie hat",
      copyUrl: "URL kopieren",
      copyIframe: "Iframe kopieren",
      sectionModel: "Modell",
      sectionLook: "Darstellung",
      sectionCamera: "Kamera",
      sectionBehaviour: "Verhalten",
      language: "Sprache",
      languageAuto: "Standard des Viewers",
      aspect: "Seitenverhältnis",
      vectorHint: "Alle drei Zahlen angeben oder keine",
      fovHint: "FOV: eine Zahl von 1 bis 179",
      reload: "Vorschau neu laden",
      openTab: "In neuem Tab öffnen",
      noSource: "Eine Modell-URL oder Entitäts-ID ist nötig: ein Modell von diesem Gerät ist nicht im Web.",
      embedUrl: "Einbettungs-URL",
      iframeCode: "Iframe-Code",
      preview: "Vorschau",
      previewTitle: "Einbettungsvorschau",
    },
    uploadPanel: {
      username: "Benutzername",
      password: "Passwort",
      login: "Anmelden",
      logout: "Abmelden",
      register: "Registrieren",
      showPassword: "Passwort anzeigen",
      hidePassword: "Passwort verbergen",
      limitsUploads: "Uploads",
      limitsHour: "{used}/{limit} in dieser Stunde",
      limitsDay: "{used}/{limit} heute",
      limitsStorage: "Speicher: {used}/{limit} MB",
      limitsModels: "Modelle: {used}/{limit}",
      limitRateHour: "Upload-Limit erreicht ({limit} pro Stunde). Versuchen Sie es in {minutes} Min. erneut.",
      limitRateDay: "Tägliches Upload-Limit erreicht ({limit} pro Tag). Versuchen Sie es in {minutes} Min. erneut.",
      limitConcurrent: "Es werden bereits {limit} Modell(e) konvertiert. Warten Sie, bis sie fertig sind.",
      limitStorage: "Speicherlimit erreicht ({limit} MB). Löschen Sie ein Modell, um Platz freizugeben.",
      limitModels: "Modell-Limit erreicht ({limit}). Löschen Sie ein Modell, um ein neues hochzuladen.",
      title: "Modell hochladen & konvertieren",
      closeAria: "Upload-Panel schließen",
      fileLabel: "3D-Modelldatei",
      urlLabel: "…oder ein Link zur Datei",
      urlPlaceholder: "https://example.org/model.glb",
      urlInvalid: "Gib einen vollständigen Link ein, der mit https:// oder http:// beginnt.",
      urlNoFile: "Der Link muss auf eine Modelldatei zeigen, z. B. …/model.glb.",
      chooseFileOrUrl: "Wähle eine Datei oder füge einen Link dazu ein.",
      downloading: "Datei wird heruntergeladen...",
      urlFetchError: "Der Link konnte nicht importiert werden: {reason}",
      urlUnsupported: "Dieses Repository kann nicht aus Links importieren.",
      formatsHint: "Unterstützt: abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, glb, usd/usda/usdc/usdz, step/stp, iges/igs, 3mf, gltf, 3ds, pcd, xyz, amf, kmz, vox, lwo, Punktwolken las/laz/e57, Gaussian Splats spz/splat/ksplat/sog/rad, oder ein .zip-Archiv mit einer dieser Dateien. STEP/IGES, 3MF und USD werden zu GLB konvertiert; die Gruppe gltf … lwo wird unverändert und ohne Vorschaubilder hochgeladen; Punktwolken (und .ply ohne Flächen) werden zu gestreamten 3D Tiles, außer einer .ply mit Gaussian Splats, die so gezeigt wird, wie sie hochgeladen wurde.",
      submit: "Hochladen & konvertieren",
      uploading: "Wird hochgeladen...",
      private: "Privat",
      privateHint: "Nur du und Admins sehen es in der Modellliste; wer den Link hat, kann es trotzdem öffnen.",
      tooLargeWorker: "Der Server hat die Datei abgelehnt: {reason}",
      tooLargeCloudflare: "Die Datei ist größer, als Cloudflare durchlässt (100 MB in den Free- und Pro-Tarifen), und hat den Server nie erreicht.",
      tooLargeProxy: "Ein Proxy vor dem Server hat die Datei als zu groß abgelehnt (nginx client_max_body_size).",
      unsupportedFormat: "Nicht unterstütztes Dateiformat: .{ext}",
      webglUnavailable: "WebGL ist in Ihrem Browser nicht verfügbar. Aktivieren Sie die Hardwarebeschleunigung oder aktualisieren Sie Ihre Grafiktreiber.",
      uploadError: "Upload oder Konvertierung fehlgeschlagen. Bitte erneut versuchen.",
    },
    loginPanel: {
      title: "Konto",
      closeAria: "Kontobereich schließen",
      notRequired: "Konten sind auf diesem Server nicht aktiviert.",
      openSignedIn: "Angemeldet als {user}",
      planTitle: "In der App gekaufter Tarif",
    },
    modelsPanel: {
      title: "Zuvor generierte Modelle",
      closeAria: "Modell-Panel schließen",
      empty: "Noch keine zuvor generierten Modelle.",
      loadError: "Vorherige Modelle konnten nicht geladen werden.",
      deleteAria: "{name} löschen",
      makePrivate: "{name} privat machen - nur du und Admins sehen es in dieser Liste",
      makePublic: "{name} ist privat - allen zeigen",
      deleteConfirm: '"{name}" löschen? Dadurch werden das konvertierte Modell und seine Renderings dauerhaft entfernt.',
      deleteAction: "Löschen",
      deleteCancel: "Abbrechen",
      repositoryLabel: "Repository-Adresse",
      repositorySave: "Verbinden",
      noRepository: "Geben Sie die Repository-Adresse ein, um seine Modelle zu durchsuchen.",
      saveOffline: "{name} auf diesem Gerät behalten",
      savedOffline: "{name} ist auf diesem Gerät",
      offline: "Keine Internetverbindung. Modelle auf diesem Gerät funktionieren weiterhin.",
      unreachable: "Das Repository antwortet nicht. Modelle auf diesem Gerät funktionieren weiterhin.",
    },
    modelMetadata: {
      title: "Modell beschreiben",
      editTitle: "Metadaten des Modells bearbeiten",
      intro: "Mit * markierte Felder sind Pflicht. Typ, Ort, Datum und Einheit helfen auch, Maßstab und Beleuchtung des Modells zu wählen.",
      choose: "Auswählen...",
      notSpecified: "Nicht angegeben",
      unitUnknown: "Unbekannt",
      unitHint: "Was eine Einheit der Datei misst - für den Maßstab.",
      datePlaceholder: "z. B. 1890, 15. Jh., 2024-05-12",
      copyrightPlaceholder: "z. B. © 2024 Museum ...",
      locationPlaceholder: "z. B. Krakau, Wawel",
      required: "Geben Sie den Namen ein und wählen Sie den Typ.",
      cancel: "Abbrechen",
      save: "Speichern",
      upload: "Hochladen & konvertieren",
      edit: "Metadaten bearbeiten",
      add: "Metadaten hinzufügen",
      editAria: "Metadaten bearbeiten: {name}",
      saveError: "Die Metadaten konnten nicht gespeichert werden: {reason}",
      unsupported: "dieses Repositorium speichert keine Metadaten",
      fields: {
        name: "Name",
        type: "Typ",
        author: "Autor",
        copyright: "Urheberrecht",
        license: "Lizenz",
        date: "Datum",
        location: "Ort",
        unit: "Modelleinheit",
        description: "Beschreibung",
      },
      types: {
        building: "Gebäude / Architektur",
        interior: "Innenraum",
        urban: "Stadt / Siedlung",
        site: "Fundstätte / Landschaft",
        object: "Objekt / Artefakt",
        sculpture: "Skulptur / Bauteil",
        other: "Sonstiges",
      },
      licenses: {
        "public-domain": "Gemeinfrei",
        "all-rights-reserved": "Alle Rechte vorbehalten",
      },
      units: { m: "Meter", cm: "Zentimeter", mm: "Millimeter", in: "Zoll", ft: "Fuß" },
    },
    modelsMeta: {
      uploadedBy: "Hochgeladen von",
      private: "Privat: nur der Besitzer und Admins sehen es in dieser Liste",
      uploaded: "Hochgeladen",
      saved: "Gespeichert",
      size: "Größe",
    },
    libraryPanel: {
      title: "Modelle auf diesem Gerät",
      closeAria: "Schließen",
      browse: "Dateien durchsuchen…",
      empty: "Noch keine Modelle auf diesem Gerät.",
      fromRepository: "Aus dem Repository",
      fromDevice: "Von diesem Gerät",
      deleteAria: "{name} von diesem Gerät entfernen",
      deleteConfirm: '"{name}" von diesem Gerät entfernen?',
      deleteAction: "Entfernen",
    },
    modelsSource: {
      aria: "Woher die Modelle stammen",
      local: "Auf dem Gerät",
      remote: "Remote",
      examples: "Beispiele",
    },
    examplesPanel: {
      title: "Beispiel-Manifeste",
      closeAria: "Schließen",
      aim3d: "AIM3D-Manifeste",
      iiif: "IIIF-Manifeste",
      bundled: "In der App, funktioniert offline",
      online: "Benötigt eine Internetverbindung",
      refresh: "Aktualisieren",
    },
    ai: {
      disclaimer: "Von KI erstellt - bitte prüfen, bevor Sie sich darauf verlassen.",
      thinking: "Der KI-Assistent sieht es sich an...",
      offline: "Der KI-Assistent ist nicht erreichbar.",
      failed: "Der KI-Assistent konnte nicht antworten.",
      timeout: "Die KI-Antwort hat zu lange gedauert. Erneut versuchen oder enger fragen.",
      unavailable: "Der KI-Assistent ist vorübergehend nicht verfügbar.",
      rateLimited: "KI-Anfragelimit erreicht. Bitte später erneut versuchen.",
      locked: "Im Business-Tarif verfügbar",
      validation: {
        explain: "Verständlich erklären (KI)",
        explainHint: "Sendet den Prüfbericht des Modells (nicht das Modell) an den KI-Assistenten.",
        title: "Von KI erklärt",
        fix: "Was zu tun ist: ",
      },
      ifc: {
        toggle: "Gebäudemodell fragen (KI)",
        title: "Modell fragen",
        placeholder: "z. B. tragende Wände im 2. OG",
        ask: "Fragen",
        hint: "Die Frage und eine Übersicht der Eigenschaftsnamen (nicht das Modell) gehen an den KI-Assistenten. Er erstellt einen Filter; der Viewer wendet ihn auf die echten Daten an.",
        examples: "Beispiele",
        example1: "Alle Fenster",
        example2: "Tragende Wände",
        example3: "Gesamtfläche der Decken",
        found: "{count} Element(e) gefunden",
        noneFound: "Kein Element passt.",
        notUnderstood: "Das lässt sich aus den Eigenschaften des Modells nicht beantworten.",
        aggregate: {
          count: "Anzahl: {value}",
          sum: "Summe {property}: {value}",
          average: "Mittelwert {property}: {value}",
          min: "Minimum {property}: {value}",
          max: "Maximum {property}: {value}",
        },
        missingValues: "{count} passende(s) Element(e) ohne {property}.",
        filter: "Filter",
        show: "Hervorheben",
        isolate: "Nur diese zeigen",
        hide: "Diese ausblenden",
        reset: "Alle zeigen",
        list: "Elemente",
        close: "Schließen",
        noData: "Dieses Modell hat keine IFC-Eigenschaften.",
        selection: "Bezogen auf: {element}",
        clearSelection: "Zum ganzen Modell fragen",
        selectionExample1: "Elemente wie dieses",
        selectionExample2: "Elemente dieses Typs in diesem Geschoss",
        selectionExample3: "Wie viele Elemente dieses Typs gibt es?",
      },
      variants: {
        describe: "Vergleichen und Paradaten prüfen (KI)",
        describeHint: "Sendet Texte, Quellen, Gewissheitsgrade und Messwerte der Varianten (nicht das Modell) an den KI-Assistenten.",
        title: "Varianten von KI verglichen",
        differences: "Unterschiede",
        paradata: "Prüfung der Paradaten",
        status: { ok: "Dokumentiert", incomplete: "Unvollständig", inconsistent: "Widersprüchlich" },
        suggestions: "Vorschläge: ",
      },
    },
    validationReport: {
      title: "Prüfbericht",
      download: "Bericht herunterladen (JSON)",
      refresh: "Erneut prüfen",
      close: "Schließen",
      checking: "Wird geprüft...",
      noModel: "Öffnen Sie ein Modell, um es zu prüfen.",
      passed: "{passed}/{total}",
      passedLabel: "bestanden",
      ready: "Bereit",
      mostlyReady: "Fast bereit",
      notReady: "Nicht bereit",
      readyHint: "Alle Prüfungen bestanden: Modell und Manifest sind bereit zur öffentlichen Nachnutzung.",
      mostlyReadyHint: "Das Modell kann veröffentlicht werden. Prüfen Sie zuerst die übrigen Punkte.",
      notReadyHint: "Einige Werte sind nicht verwendbar. Beheben Sie die Fehler vor der Veröffentlichung.",
      pass: "Bestanden",
      review: "Prüfen",
      fail: "Fehler",
      notSet: "Nicht gesetzt",
      notChecked: "Nicht geprüft",
      notSetHint: "Das Manifest setzt dies noch nicht.",
      noIssues: "Keine Hinweise.",
      moreIssues: "...und {count} weitere (Bericht herunterladen)",
      modelCheck: "Prüfung der Modelldatei (glTF-Validator)",
      modelCheckHint: "Ist die Modelldatei gültiges glTF, das in allen Browsern funktioniert?",
      modelNotChecked: "Nur vom Upload-Worker konvertierte Modelle werden geprüft.",
      validatorMissing: "Auf dem Worker ist kein glTF-Validator installiert.",
      errorsCount: "{count} Fehler",
      warningsCount: "{count} Warnung(en)",
      details: "Details",
      file: "Datei",
      fileSize: "Dateigröße",
      triangles: "Dreiecke",
      vertices: "Eckpunkte",
      materials: "Materialien",
      textures: "Größte Textur",
      size: "Abmessungen",
      generator: "Erstellt mit",
      attributes: "Manifest-Attribute",
      attributesValue: "{count} geprüft: {errors} Fehler, {warnings} Warnungen, {unknown} unbekannt",
      features: {
        materials: "Materialien",
        model: "3D-Modell",
        metadata: "Beschreibende Metadaten",
        rights: "Rechte und Namensnennung",
        annotations: "Annotationen",
        camera: "Kameraansicht",
        lights: "Lichter",
        "raking-light": "Streiflicht",
        clipping: "Schnittebenen",
        timeline: "4D-Zeitleiste",
        variants: "Rekonstruktionsvarianten",
        compare: "Vergleichsansicht",
        photos: "Historische Fotos",
        location: "Geografische Lage",
        sun: "Sonnenstudie",
        weather: "Wetter",
        certainty: "Grad der Gewissheit",
        thumbnails: "Vorschaubilder",
        transform: "Modelltransformation und Schattierung",
        rendering: "Rendering und Umgebung",
        tour: "Führung",
        settings: "Viewer-Einstellungen",
        manifest: "IIIF-Struktur",
      },
      hints: {
        model: "Zeigt das Manifest ein Modell mit gültiger URL und gültigem Format?",
        metadata: "Sind Titel, Zusammenfassung und Metadaten in allen Sprachen ausgefüllt?",
        rights: "Sind Lizenz (rights) und Namensnennung (requiredStatement) gesetzt?",
        annotations: "Haben die Annotationen einen Inhalt und ein Ziel in dieser Szene?",
        manifest: "Stimmen IDs, Typen und die IIIF-Struktur?",
      },
    },
    // Plan names (admin and account panels); an app build adds the rest.
    plans: {
      free: "Free",
      pro: "Pro",
      business: "Business",
      enterprise: "Enterprise",
    },
    exadmin: {
      title: "Verwaltung",
      navUsers: "Benutzer",
      backToViewer: "Zurück zum Viewer",
      language: "Sprache",
      loading: "Wird geladen...",
      loginTitle: "Als Administrator anmelden",
      notAdmin: "{user} ist kein Administrator.",
      accountsOff: "Konten sind auf diesem Server nicht aktiviert, daher gibt es hier nichts zu verwalten.",
      unreachable: "Der Server antwortet nicht.",
    },
    adminPanel: {
      lastUpload: "letzter Upload {date}",
      sortBy: "Sortieren nach",
      sortPlan: "Tarif",
      sortName: "Name",
      sortModels: "Hochgeladene Modelle",
      sortStorage: "Belegter Speicher",
      sortLastUpload: "Letzter Upload",
      sortAscending: "Aufsteigend",
      sortDescending: "Absteigend",
      limitsUsage: "Uploads {hour} in dieser Stunde, {day} heute · Speicher {storage} MB · Modelle {models}",
      planRenews: "Verlängerung/Ende {date}",
      planChecked: "geprüft {date}",
      limitsShow: "Limits bearbeiten",
      limitsHide: "Limits ausblenden",
      limitsAdmin: "Admins sind nicht begrenzt.",
      limitsBusiness: "Business- oder Enterprise-Tarif: die Business-Limits sind hier die Standardwerte.",
      planCurrent: "Tarif: {plan}",
      planPurchase: "in der App gekauft: {plan}",
      planGrant: "vergeben: {plan}",
      planGrantUntil: "vergeben: {plan} bis {date}",
      planShow: "Tarif ändern",
      planHide: "Tarif ausblenden",
      planGrantLabel: "Vergebener Tarif",
      planNone: "Keiner (nur der gekaufte)",
      planUntil: "Bis (leer = unbegrenzt)",
      planHint: "Es gilt der höhere von vergebenem und gekauftem Tarif – in der App und für die Upload-Limits.",
      planSave: "Tarif speichern",
      planSourceAdmin: "von einem Admin vergeben",
      limitsDefault: "Standard: {value}",
      limitsHint: "Leer = Standard, 0 = unbegrenzt.",
      limitsSave: "Limits speichern",
      limitsReset: "Standardwerte verwenden",
      limitUploadsPerHour: "Uploads pro Stunde",
      limitUploadsPerDay: "Uploads pro Tag",
      limitStorageMb: "Speicher (MB)",
      limitMaxModels: "Max. Modelle",
      limitConcurrentJobs: "Gleichzeitige Konvertierungen",
      title: "Benutzer verwalten",
      closeAria: "Benutzerverwaltung schließen",
      empty: "Noch keine registrierten Benutzer.",
      loadError: "Benutzerliste konnte nicht geladen werden.",
      approve: "Freigeben",
      disable: "Sperren",
      promote: "Zum Admin befördern",
      demote: "Admin-Rechte entziehen",
      delete: "Löschen",
      cannotDeleteSelf: "Sie können Ihr eigenes Konto nicht löschen.",
      deleteConfirm: 'Benutzer "{user}" löschen? Dadurch wird sein Konto dauerhaft entfernt.',
      deleteAction: "Löschen",
      deleteCancel: "Abbrechen",
      modelsCount: "{count} Modelle",
      modelsShow: "Modelle anzeigen",
      modelsHide: "Modelle ausblenden",
      modelsEmpty: "Noch keine Modelle hochgeladen.",
      modelsLoadError: "Modelle des Benutzers konnten nicht geladen werden.",
      modelDeleteAria: "{name} löschen",
      modelEditAria: "Upload-Angaben von {name} bearbeiten",
      modelOwner: "Hochgeladen von",
      modelUploadedAt: "Hochgeladen am",
      modelNoOwner: "Kein Besitzer",
      modelSave: "Speichern",
      unownedTitle: "Uploads ohne Besitzer",
      modelDeleteConfirm: '"{name}" löschen? Dadurch werden das konvertierte Modell und seine Renderings dauerhaft entfernt.',
    },
    eventLog: {
      title: "Ereignisprotokoll",
      copy: "Kopieren",
      clear: "Leeren",
      copied: "Protokoll kopiert.",
      empty: "Noch nichts protokolliert.",
    },
    loadingLog: {
      fullQuality: "Vorschau · volle Qualität wird geladen...",
      fullQualityProgress: "Vorschau · volle Qualität wird geladen {percent}%",
      pointCloudPreview: "Vorschau · vollständige Punktwolke wird erstellt...",
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
      uploadingFile: "Datei wird hochgeladen",
      downloadingFile: "Datei wird heruntergeladen",
      uploadedBytes: "{percent} % · {loaded} / {total} MB",
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
      webglOnlyModel: "Punktwolken und Gaussian Splats benötigen den WebGL-Renderer: den Viewer ohne ?renderer=webgpu öffnen.",
      webglOnlyFeature: "{feature} benötigt den WebGL-Renderer.",
      pointCloudThinned: "Große Punktwolke: {loaded} von {total} Punkten angezeigt. Für Streaming in voller Auflösung mit dem Worker konvertieren.",
      pointCloudLoaded: "Punktwolke geladen: {count} Punkte.",
      pointCloudIncomplete: "Die Punktwolke wurde nicht vollständig geladen; die eingetroffenen Punkte werden angezeigt.",
      tiledAnnotationBlocked: "Anmerkungen sind für gestreamte Modelle (3D Tiles / Potree) nicht verfügbar.",
      pointAnnotationHint: "Klicken Sie auf einen Punkt der Punktwolke, um ihn zu annotieren.",
      profileStart: "Klicken Sie auf der Punktwolke das erste Ende der Profillinie an.",
      profileSecond: "Jetzt das zweite Ende anklicken.",
      profileTooShort: "Beide Enden liegen übereinander; klicken Sie zwei entfernte Punkte an.",
      fullModelLoaded: "Modell in voller Qualität geladen.",
      fullModelLoadError: "Das Modell in voller Qualität konnte nicht geladen werden; die Vorschau wird angezeigt.",
      previewAnnotationBlocked: "Anmerkungen können hinzugefügt werden, sobald das Modell in voller Qualität geladen ist.",
      transformMove: "Bewegen: Ziehen Sie die Achsenpfeile, um das Objekt zu repositionieren.",
      transformRotate: "Drehen: Ziehen Sie die Rotationsringe, um das Objekt zu drehen. Halten Sie die Umschalttaste gedrückt, um das Einrasten zu aktivieren.",
      transformScale: "Skalieren: Ziehen Sie die Achsengriffe, um die Größe des Objekts zu ändern. Halten Sie die Umschalttaste gedrückt, um das Einrasten zu aktivieren.",
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
      invalidJSON: "Ungültiges JSON: {error}",
      missingJsonSettings: "Erforderliche Konfigurationsdatei fehlt: {url} (HTTP {status})\nDer Viewer kann ohne \"viewer-settings.json\" nicht gestartet werden.\nBitte überprüfen Sie, ob die Datei während des Build/Deployments kopiert wurde.",

      presentationModeError: "Beim Einrichten des Präsentationsmodus ist ein Fehler aufgetreten.",
      objLoaded: "OBJ-Modell wurde geladen.",
      mtlLoadError: "Fehler beim Laden der zugehörigen MTL-Datei.",
      glbLoadError: "Fehler beim Laden der GLB-Datei.",
      unsupportedExtension: "Dateierweiterung wird noch nicht unterstützt.",
      modelLoaded: "Modell {filename} wurde geladen.",
      upAxisNotForTiles: "Die Hochachse kann bei einem gestreamten (gekachelten) Modell nicht geändert werden.",
      modelLoadedSimple: "Modell wurde erfolgreich geladen.",
      unsupportedFormat: "Nicht unterstütztes Dateiformat.",
      presentationModeReady: "Präsentationsmodus ist bereit.",
      presentationModeError: "Beim Einrichten des Präsentationsmodus ist ein Fehler aufgetreten.",
      sandboxDropModel: "Ziehen Sie ein 3D-Modell per Drag-and-drop in den Viewer.",
      supportedFormats: "<strong>Unterstützte Formate:</strong> {formats} \n und <strong>Unterstützte Archive:</strong> {archives}.",

      embedSourceMissing: "Model-URL oder Entitäts-ID für die Einbettung festlegen.",
      embedUrlCopied: "Einbettungs-URL kopiert.",
      embedUrlCopyError: "Einbettungs-URL konnte nicht kopiert werden.",
      embedIframeCopied: "Einbettungs-iframe kopiert.",
      embedIframeCopyError: "Einbettungs-iframe konnte nicht kopiert werden.",
      embedCodeCopied: "Einbettungscode in die Zwischenablage kopiert.",
      embedCodeCopyError: "Einbettungscode konnte nicht kopiert werden.",
      shareUrlCopied: "URL der geteilten Ansicht kopiert.",
      shareUrlCopyError: "URL der geteilten Ansicht konnte nicht kopiert werden.",
      invalidManifest: "Ungültiges AIM3D-Manifest.",
      manifestValidationFailed: "AIM3D-Manifestvalidierung fehlgeschlagen.",

      uploadStarted: "Datei empfangen - Modell wird konvertiert...",
      uploadReady: "Konvertiertes Modell ist bereit.",
      pointCloudPreview: "Vorschau der Punktwolke; die Version in voller Auflösung folgt nach der Konvertierung.",
      uploadError: "Upload oder Konvertierung des Modells fehlgeschlagen.",
      uploadLoginRequired: "Zum Hochladen von Dateien müssen Sie sich anmelden. Noch kein Konto? Registrieren Sie sich über das Konto-Symbol.",
      userUpdated: "Benutzer aktualisiert.",
      userDeleted: "Benutzer gelöscht.",
      modelDeleted: "Modell wurde gelöscht.",
      modelMadePrivate: "Das Modell ist privat: nur du und Admins sehen es in der Liste.",
      modelMadePublic: "Das Modell ist wieder für alle in der Liste.",
      modelVisibilityError: "Die Sichtbarkeit des Modells konnte nicht geändert werden.",
      modelMetadataSaved: "Metadaten des Modells gespeichert.",
      modelMetadataError: "Das Modell wird hochgeladen, aber seine Metadaten konnten nicht gespeichert werden - ergänzen Sie sie in den Modelldetails.",
      exampleManifestError: "Das Beispiel-Manifest konnte nicht geladen werden.",
      exampleListRefreshFailed: "Die Beispielliste konnte nicht aktualisiert werden - die zuletzt geladene wird angezeigt.",
      modelUpdated: "Modelldaten gespeichert.",
      previewSaved: "Hauptvorschaubild geändert.",
      thumbnailsGenerating: "Vorschaubilder werden erzeugt…",
      thumbnailsGenerated: "Vorschaubilder erzeugt.",
      thumbnailsNotOwner: "Nur wer dieses Modell hochgeladen hat (oder ein Admin) kann seine Vorschaubilder ändern.",
      previewSaveError: "Die Vorschau konnte nicht gespeichert werden.",
      previewNotUploaded: "Vorschaubilder können nur für ins Repository hochgeladene Modelle gespeichert werden.",
      modelDeleteError: "Modell konnte nicht gelöscht werden.",
      librarySaved: "Modell auf diesem Gerät gespeichert.",
      librarySaveError: "Modell konnte nicht auf diesem Gerät gespeichert werden.",
      repositoryUrlInvalid: "Das ist keine gültige Repository-Adresse.",
      repositoryUnreachable: "Das Repository antwortet nicht - bitte später erneut versuchen.",
      planLocked: "Im Business-Tarif verfügbar.",
      planPurchased: "Danke! Ihr Tarif ist aktiv.",
      planPurchaseError: "Der Kauf ist fehlgeschlagen - bitte später erneut versuchen.",
      planRestored: "Käufe wiederhergestellt.",
      planRestoreNone: "Keine Käufe zum Wiederherstellen.",
      planLinked: "Angemeldet. Der Tarif Ihres Kontos gilt auf diesem Gerät.",
      planLinkError: "Anmeldung fehlgeschlagen: {message}",

      annotationDataMissing: "Keine Annotationsdaten für diesen Punkt gefunden.",
      selectFaceRequired: "Wählen Sie mindestens eine Fläche aus, um eine Annotation hinzuzufügen.",
      selectFaceRequiredAgain: "Wählen Sie mindestens eine Fläche und führen Sie dann „Annotationen hinzufügen“ erneut aus.",
      noFacesSelected: "Keine Flächen für Annotation ausgewählt.",
      titleRequired: "Titel ist erforderlich.",
      facesInactive: "Ausgewählte Flächen sind nicht mehr aktiv.",

      annotationsSaved: "Annotationen für {count} Fläche{plural} gespeichert.",
      annotationsImported: "Importierte Annotationen: {count}.",
      annotationsImportedFromManifest: "Aus dem Manifest importierte Annotationen: {count}.",
      xrUnavailable: "Dieser Browser bietet weder VR noch AR.",
      xrFailed: "VR oder AR konnte nicht gestartet werden.",
      photoViewSaved: "Ansicht des Fotos gespeichert.",
      photoLoadFailed: "Das Foto konnte nicht geladen werden.",
      photoCameraDenied: "Die Kamera wurde nicht erlaubt. Erlauben Sie sie im Browser, um das Foto vor Ort zu sehen.",
      photoCameraUnavailable: "Keine Kamera verfügbar (sie braucht HTTPS und einen Browser, der eine anbietet).",
      annotationsExported: "Annotations-XML exportiert.",
      tourNoAnnotations: "Fügen Sie dem Modell Anmerkungen hinzu, um eine geführte Tour zu starten.",
      noAnnotationsToExport: "Keine Annotationen zum Exportieren.",
      noValidAnnotations: "Keine gültigen Annotationen im XML gefunden.",
      annotationsImportError: "Import der Annotations-XML fehlgeschlagen.",
      noValidAnnotationsInManifest: "Keine gültigen Annotationen im AIM3IF-Manifest gefunden.",
      manifestImportedWithoutAnnotations: "AIM3IF-Manifest importiert. Viewer-Einstellungen wurden angewendet (keine Annotationen im Manifest).",

      settingsSaved: "Einstellungen wurden gespeichert.",
      settingsSaveError: "Fehler beim Speichern der Einstellungen.",
      settingsNotUploaded: "Einstellungen können nur für ins Repository hochgeladene Modelle gespeichert werden.",
      settingsNotOwner: "Nur wer dieses Modell hochgeladen hat (oder ein Admin) kann seine Einstellungen speichern.",

      featureToggle: "{feature} ist {state}.",
      clippingHelperToggle: "Clipping-Ebenen-Helfer {axis} ist {state}.",

      clippingPlanes: "Ziehen Sie die aktive Schnittebene-Hilfe, um den Schnitt anzupassen",

      downloadSuccess: "Modell erfolgreich heruntergeladen.",
      downloadError: "Fehler beim Herunterladen des Modells.",

      iiifManifestGenerated: "IIIF-Manifest wurde generiert.",
      iiifManifestGenerationError: "Fehler beim Generieren des IIIF-Manifests.",

      containerNotFound: "Container-Element nicht gefunden. Bitte überprüfen Sie die Viewer-Konfiguration.",
      missingFiles: "Fehlende erforderliche Dateien für den Viewer. Bitte überprüfen Sie die Viewer-Konfiguration.",
      unsupportedFileFormat: "Nicht unterstütztes Dateiformat.",

      performanceModeSet: "Leistungsmodus auf {mode} gesetzt.",
      shadingModeApplied: "Schattierungsmodus auf {mode} gesetzt.",
      customShaderError: "Der eigene Shader lässt sich nicht kompilieren:",
      angleHint: "Klicken Sie einen Startpunkt, den Scheitelpunkt und einen Endpunkt an, um einen Winkel zu messen.",
      areaHint: "Klicken Sie die Ecken einer Fläche an. Klicken Sie erneut auf den ersten Punkt oder drücken Sie Enter, um sie zu schließen.",
      clippingEnabled: "Schnittebenen sind aktiv. Ziehen Sie eine farbige Ebene oder nutzen Sie die Schieberegler.",
      clippingDisabled: "Schnittebenen sind deaktiviert.",
    },
    pointCloud: {
      title: "Punktwolke",
      toggle: "Punktwolken-Einstellungen",
      collapse: "Einstellungen ausblenden",
      expand: "Einstellungen anzeigen",
      size: "Punktgröße ×{value}",
      sizeMode: "Größe",
      sizeModes: {
        adaptive: "Adaptiv (Scandichte)",
        fixed: "Fest (Pixel)",
      },
      shape: "Form",
      color: "Farbe",
      edl: "Eye-Dome Lighting {value}%",
      streamed: "Gestreamt: Details laden beim Heranzoomen.",
      points: "{total} Punkte",
      thinned: "{loaded} von {total} Punkten",
      shapes: {
        square: "Quadrat",
        round: "Rund",
        sphere: "Kugel",
      },
      classesTitle: "Klassen",
      autoClassified: "Klassen automatisch aus der Geometrie zugewiesen - bitte prüfen, bevor Sie sich darauf verlassen.",
      autoClassifiedModel: "Klassen automatisch von einem Modell zugewiesen - bitte prüfen, bevor Sie sich darauf verlassen.",
      classOther: "Klasse {value}",
      profile: "Profil",
      drawProfile: "Profil zeichnen",
      cancelProfile: "Abbrechen",
      clearProfile: "Profil entfernen",
      profileWidth: "Profilbreite {value}",
      classNames: {
        0: "Nie klassifiziert",
        1: "Unklassifiziert",
        2: "Boden",
        3: "Niedrige Vegetation",
        4: "Mittlere Vegetation",
        5: "Hohe Vegetation",
        6: "Gebäude",
        7: "Tiefer Punkt (Rauschen)",
        8: "Modell-Schlüsselpunkt",
        9: "Wasser",
        10: "Schiene",
        11: "Straßenoberfläche",
        12: "Überlappung",
        13: "Erdseil",
        14: "Leiterseil",
        15: "Mast",
        16: "Isolator",
        17: "Brückendeck",
        18: "Hohes Rauschen",
      },
      colorModes: {
        rgb: "RGB",
        intensity: "Intensität",
        height: "Höhe",
        classification: "Klassifikation",
        tile: "Detailstufen",
      },
    },
    certainty: {
      short: "LoC",
      field: "Grad der Gewissheit (LoC)",
      legendTitle: "Grad der Gewissheit (LoC)",
      none: "— nicht bewertet —",
      scope: "Gilt für",
      scopeObject: "Objekt",
      scopeGroup: "Gruppe (übergeordnetes Objekt)",
      unassessed: "Nicht bewertet",
      assessedCount: "Bewertete Objekte",
      opacity: "Deckkraft der Überlagerung",
      filter: "Nur diese Stufe anzeigen (erneut klicken zum Aufheben)",
      selectAll: "Alle auswählen",
      selectNone: "Keine auswählen",
      showView: "Grad der Gewissheit anzeigen",
      hideView: "Grad der Gewissheit ausblenden",
    },
    tour: {
      panel: "Geführte Tour",
      start: "Geführte Tour starten",
      stop: "Geführte Tour beenden",
      step: "Schritt {current} / {total}",
      previous: "Vorheriger Schritt (P)",
      next: "Nächster Schritt (N)",
      play: "Tour abspielen",
      pause: "Tour pausieren",
      close: "Tour schließen (Esc)",
      untitled: "Anmerkung ohne Titel",
      saveView: "Aktuelle Kameraansicht für die Tour speichern",
      replaceView: "Gespeicherte Tour-Ansicht durch die aktuelle Kameraansicht ersetzen",
      annotationCount: "Annotationen: {count}",
      idleHint: "Starten Sie die Führung durch die gespeicherten Annotationen oder blättern Sie mit ‹ › durch sie.",
      dismiss: "Führung ausblenden",
      showLeaderLines: "Hinweislinien der Annotationen einblenden",
      hideLeaderLines: "Hinweislinien der Annotationen ausblenden",
      showSpread: "Alle Annotationen rund um das Modell öffnen",
      hideSpread: "Annotationen rund um das Modell schließen",
      spreadLayer: "Annotationen",
      showStack: "Annotationen als Karten anzeigen",
      hideStack: "Annotationskarten ausblenden",
      stackLayer: "Annotationskarten",
    },
    animation: {
      player: "Animationsplayer",
      clip: "Animationsclip",
      allClips: "Alle Clips",
      timeline: "Animationszeit",
      speed: "Wiedergabegeschwindigkeit",
      play: "Abspielen (K)",
      pause: "Pause (K)",
      loopOn: "Schleife: an",
      loopOff: "Schleife: aus",
    },
    xr: {
      toggle: "In VR oder AR ansehen",
      title: "VR und AR",
      close: "Schließen",
      enterVr: "In VR ansehen",
      exitVr: "VR beenden",
      enterAr: "In AR ansehen",
      exitAr: "AR beenden",
      quickLook: "In AR Quick Look öffnen",
      preparing: "Modell wird vorbereitet…",
      arScale: "Größe in AR",
      scaleTable: "Auf dem Tisch",
      scaleReal: "Originalgröße",
      checking: "Prüfe, was dieses Gerät bietet…",
      unsupported: "Dieser Browser bietet weder VR noch AR. Öffnen Sie den Viewer im Browser einer VR-Brille oder auf dem Smartphone.",
      vrHint: "Mit dem Controller auf den Boden zeigen und den Abzug drücken, um dorthin zu springen.",
      hint: "In VR in Originalgröße; in AR auf dem Tisch oder in Originalgröße.",
    },
    sun: {
      title: "Sonne und Schatten",
      close: "Sonne ausschalten",
      time: "Tageszeit",
      date: "Tag",
      followTimeline: "Jahr der Zeitleiste",
      latitude: "Breite",
      longitude: "Länge",
      north: "Norden (°)",
      northHint: "Wo Norden in der Szene liegt: Grad im Uhrzeigersinn von -Z, von oben gesehen",
      play: "Tag abspielen",
      pause: "Tag anhalten",
      position: "Sonne {azimuth}° {compass}, {elevation}° über dem Horizont",
      night: "Die Sonne steht unter dem Horizont",
      riseSet: "Aufgang {sunrise}, Untergang {sunset}",
    },
    weather: {
      title: "Wetter",
      off: "Aus",
      close: "Schließen",
      clear: "Klarer Himmel",
      fog: "Nebel",
      rain: "Regen",
      snow: "Schnee",
      storm: "Gewitter",
      intensity: "Stärke",
      wind: "Wind",
      windDirection: "Windrichtung",
      mistHeight: "Nebelhöhe",
      mistDensity: "Nebeldichte",
      mistSpread: "Nebelverteilung",
      sky: "Himmel",
      surfaces: "Nasse Oberflächen und Schneedecke",
      sound: "Ton",
    },
    scene: {
      title: "Vorgeschlagene Szene",
      semantic: {
        button: "Texte mit einem Sprachmodell lesen (etwa {size} MB, einmal geladen)",
        retry: "Sprachmodell erneut versuchen",
        starting: "Sprachmodell wird geladen…",
        loading: "Sprachmodell wird geladen… {percent}%",
        reading: "Texte werden gelesen…",
        failed: "Das Sprachmodell konnte nicht geladen werden.",
        done: "Das Sprachmodell hat {passages} Textabschnitte gelesen.",
        nothing: "Es gibt keinen Text für das Sprachmodell.",
      },
      close: "Schließen",
      intro: "Nach Regeln gewählt aus Dateiname, Metadaten, Manifest sowie Größe und Materialien des Modells. Nichts ändert sich, bevor Sie sie anwenden.",
      basis: "Worauf es beruht",
      apply: "Ausgewählte anwenden",
      undo: "Rückgängig",
      applied: "Angewendet. „Rückgängig“ stellt den vorherigen Zustand wieder her.",
      undone: "Vorheriger Zustand wiederhergestellt.",
      suggested: "(vorgeschlagen)",
      on: "an",
      off: "aus",
      unchanged: "unverändert",
      sunYearTimeline: "das Jahr der Zeitleiste",
      purpose: {
        documentation: "Dokumentation",
        presentation: "Präsentation",
      },
      confidence: {
        high: "sicher",
        medium: "ziemlich sicher",
        low: "unsicher",
      },
      setting: {
        outdoor: "im Freien",
        indoor: "Innenraum",
        studio: "ein einzelnes Objekt",
      },
      size: {
        object: "ein kleines Objekt",
        "large-object": "ein großes Objekt",
        building: "ein Gebäude",
        site: "ein Gelände oder eine Landschaft",
      },
      kind: {
        mesh: "Modell: ein Mesh",
        pointcloud: "Modell: eine Punktwolke",
        splats: "Modell: Gaussian Splats",
      },
      unit: {
        user: "Einheit von Ihnen gesetzt",
        manifest: "Einheit aus dem Manifest",
        file: "Einheit aus der Datei",
        config: "Einheit aus den Einstellungen",
        default: "Einheit unbekannt, als Meter angenommen",
      },
      source: {
        manifest: "dem Manifest",
        text: "den Metadaten",
        timeline: "der Zeitleiste",
        year: "einer Jahreszahl in den Metadaten",
        century: "einem Jahrhundert in den Metadaten",
        geonames: "einem in den Texten genannten Ort (GeoNames)",
      },
      season: {
        winter: "Winter",
        spring: "Frühling",
        summer: "Sommer",
        autumn: "Herbst",
      },
      sunTime: {
        sunsetBefore: "{hours} h vor Sonnenuntergang",
        sunsetAfter: "{hours} h nach Sonnenuntergang",
        sunriseBefore: "{hours} h vor Sonnenaufgang",
        sunriseAfter: "{hours} h nach Sonnenaufgang",
      },
      fact: {
        size: "Größe: {size} ({unit})",
        baked: "Beleuchtung bereits in Texturen oder Farben (ein Scan oder Splats)",
        location: "Ort: {place} (aus {source})",
        year: "Jahr: {year} (aus {source})",
        keywords: "Gefundene Wörter: {words}",
        semantic: "Texte von einem Sprachmodell gelesen ({model}, im Browser)",
        shape: "Geometrie: Flächen nach oben {up}, unten {down}, seitlich {sideways}; Boden {ground} der Grundfläche; Wände von innen aus {enclosure} der Richtungen",
        setting: "Umgebung: {setting} ({confidence})",
      },
      uncertain: {
        place: "Der Ort ist unbekannt: Die Sonne steht wie am Standardort (50° N, 10° E). Legen Sie ihn unter „Sonne und Schatten“ fest.",
        placeGuess: "Der Ort ist eine Vermutung: {name}. Prüfen Sie ihn unter „Sonne und Schatten“.",
      },
      reason: {
        keywords: "die Texte nennen {words}",
        size: "Größe: {size}",
        ifc: "ein IFC-Gebäudemodell",
        noEvidence: "nichts verrät, wo es steht",
        splatsBaked: "Gaussian Splats bringen ihre eigene Beleuchtung mit",
        pointsNoNormals: "Punkte ohne Normalen nehmen kein Licht an",
        notOutdoor: "nicht im Freien: {setting}",
        documentationNeutral: "Dokumentation: gleichmäßiges Licht, das nichts verbirgt",
        outdoorPresentation: "im Freien, in seinem eigenen Licht gezeigt",
        bakedSun: "die Texturen haben eigenes Licht und eigene Schatten",
        place: "der Ort aus {source}",
        placeNamed: "die Texte nennen {name} (GeoNames)",
        semantic: "das Sprachmodell liest: {setting} ({percent}%)",
        semanticPurpose: "das Sprachmodell liest: {purpose} ({percent}%)",
        semanticRelief: "das Sprachmodell liest ein Relief zum Lesen ({percent}%)",
        enclosed: "Wände ringsum, von innen gesehen ({percent}% der Richtungen)",
        ceiling: "eine Decke über einem Boden",
        ground: "offener Boden ({percent}% der Grundfläche)",
        flat: "flach und weit: ein Gelände",
        thinPlate: "eine dünne Platte: Relief zum Lesen",
        yearTimeline: "das Jahr folgt der Zeitleiste",
        year: "das Jahr {year}, aus {source}",
        season: "Jahreszeit: {season}",
        timeDawn: "Morgen, wie die Texte sagen",
        timeNoon: "Mittag, wie die Texte sagen",
        timeDusk: "Abend, wie die Texte sagen",
        timeAfternoon: "später Nachmittag: tiefe Sonne und lange Schatten zeigen die Form",
        hidesGeometry: "Dokumentation: ein Wetter würde die Geometrie verdecken",
        weatherNamed: "die Texte nennen {words}",
        clearSky: "klarer Himmel mit Dunst zum Horizont",
        phoneLighter: "leichter auf einem Telefon",
        presentationNoRaking: "Präsentation: Streiflicht dient zum Lesen von Relief",
        relief: "Relief zum Lesen: {words}",
        studioRelief: "ein Objekt: Streiflicht zeigt seine Oberfläche",
        noRelief: "kein Relief erwähnt",
        noNormals: "das Modell hat keine Normalen",
        agxSun: "AgX erhält die Lichter der Sonne",
        neutralColours: "Neutral erhält die Farben treu",
        aoPoints: "nicht für Punktwolken",
        phonePerformance: "zu aufwendig für ein Telefon",
        bakedAo: "die Schattierung steckt schon in den Texturen",
        aoHeavy: "zu viele Dreiecke",
        aoShape: "Kontaktschatten heben die Form hervor",
        unlit: "die Materialien ignorieren Licht",
      },
    },
    photos: {
      title: "Historische Fotos",
      closePanel: "Schließen",
      empty: "Noch keine Fotos. Fügen Sie eines aus der aktuellen Ansicht hinzu.",
      opacity: "Foto",
      swipe: "Trennlinie statt Überblenden",
      divider: "Ziehen, um Foto und Modell zu vergleichen",
      return: "Zurück zur Ansicht des Fotos",
      hide: "Foto ausblenden",
      align: "Ausrichten",
      cancelAlign: "Ausrichten beenden",
      alignHint: "Bewegen Sie die Kamera, bis das Modell über dem Foto liegt, dann Objektiv und Neigung einstellen.",
      fov: "Objektiv (Bildwinkel)",
      roll: "Neigung",
      save: "Ansicht speichern",
      remove: "Foto entfernen",
      add: "Foto hinzufügen",
      url: "Bild-URL oder IIIF info.json",
      label: "Titel",
      year: "Jahr",
      addUrl: "Hinzufügen",
      addFile: "Aus Datei…",
      onSite: {
        open: "Vor Ort (Kamera)",
        openTitle: "Das Foto mit der Kamera über den Ort legen",
        pick: "Tippen Sie auf das Foto, das Sie vor Ort sehen möchten.",
        title: "Das Foto vor Ort",
        close: "Kamera schließen",
        hint: "Stellen Sie sich dorthin, wo das Foto aufgenommen wurde. Mit einem Finger verschieben, mit zwei zoomen und drehen, bis es über dem Ort liegt.",
        starting: "Kamera wird gestartet…",
        fade: "Überblenden",
        divider: "Trennlinie",
        dividerHandle: "Ziehen, um damals und heute zu vergleichen",
        peek: "Halten: damals",
        peekTitle: "Halten, um nur das Foto zu sehen",
        reset: "Zurücksetzen",
        capture: "Vergleich speichern",
        captured: "Vergleich gespeichert.",
        captureFailed: "Der Vergleich konnte nicht gespeichert werden: der Server des Fotos erlaubt es nicht.",
      },
    },
    menus: {
      look: "Darstellung",
      analysis: "Analyse",
      measure: "Messen",
      tools: "Werkzeuge",
      story: "Geschichte",
      model: "Modell",
      file: "Datei",
      settings: "Einstellungen",
      more: "Mehr",
      close: "Schließen",
    },
    compare: {
      title: "Vergleichen",
      open: "Zwei Varianten nebeneinander vergleichen",
      close: "Vergleich schließen",
      years: "Zwei Jahre vergleichen",
      left: "Linke Seite",
      right: "Rechte Seite",
      divider: "Ziehen zum Vergleichen (Pfeiltasten verschieben)",
      toSplit: "Nebeneinander",
      toSplitHint: "Beide Seiten nebeneinander zeigen",
      toSwipe: "Wischen",
      toSwipeHint: "Beide Seiten in einer Ansicht, durch eine Trennlinie geteilt",
      variantsGroup: "Varianten",
      timelineGroup: "Zeitleiste",
      shadingGroup: "Schattierung",
      leftLighting: "Linke Seite: Beleuchtung",
      rightLighting: "Rechte Seite: Beleuchtung",
      lightingCurrent: "Beleuchtung wie eingestellt",
      lightingNoEnvironment: "Ohne Umgebungskarte",
      lightingEnvironment: "Umgebung: {name}",
      openLook: "Schattierung/Beleuchtung nebeneinander",
      variantsTitle: "Rekonstruktionsvarianten",
      expand: "Varianten zeigen",
      collapse: "Varianten ausblenden",
    },
    timeline: {
      title: "Zeitleiste",
      year: "Jahr",
      play: "Abspielen (K)",
      pause: "Pause (K)",
      previous: "Vorheriger Punkt",
      next: "Nächster Punkt",
      speed: "Wiedergabegeschwindigkeit",
      collapse: "Zeitleiste einklappen",
      expand: "Zeitleiste ausklappen",
      about: "Über diese Zeitleiste",
      documented: "Belegt",
      modelled: "Modelliert",
      circa: "um {year}",
      bce: "{year} v. Chr.",
      source: "Quelle: {source}",
    },
    measurement: {
      title: "Messungen",
      close: "Messungen schließen (beendet das Messen und löscht sie)",
      distance: "Entfernung",
      angle: "Winkel",
      area: "Fläche",
      dimensions: "Modellabmessungen",
      surface: "Oberfläche",
      volume: "Volumen",
      volumeNote: "Nur für geschlossene Netze gültig",
      perimeter: "Umfang",
      segments: "{count} Segmente",
      finish: "Fertig",
      finishHint: "Aktuelle Messung abschließen (Enter)",
      clear: "Leeren",
      clearAll: "Messungen löschen",
      modelUnit: "Modelleinheit",
      unitLine: "Modelleinheit: {unit} ({source})",
      unitImplausible: "Das Modell ist {size} groß - stimmt die Einheit?",
      unitUse: "Modell als in {unit} gezeichnet behandeln",
      unitKeep: "{unit} ist richtig",
      displaySystem: "Anzeigen in",
      metric: "Metrisch",
      imperial: "Imperial",
      unitSource: {
        user: "Ihre Wahl",
        manifest: "aus dem Manifest",
        file: "aus der Datei",
        config: "Viewer-Einstellungen",
        default: "Standard",
      },
      unitNames: {
        auto: "Automatisch (Manifest, Datei oder Meter)",
        m: "Meter",
        cm: "Zentimeter",
        mm: "Millimeter",
        in: "Zoll",
        ft: "Fuß",
      },
      hint: {
        distance: "Klicken Sie Punkte auf dem Modell an, um einen Pfad zu messen.",
        angle: "Klicken Sie einen Startpunkt, den Scheitelpunkt und einen Endpunkt an.",
        area: "Klicken Sie die Ecken einer Fläche an; klicken Sie erneut auf den ersten Punkt oder drücken Sie Enter, um sie zu schließen.",
      },
    },
    clipping: {
      title: "Schnittebenen",
      toggleAxis: "Schnitt entlang {axis}",
      position: "Position {axis}",
      flip: "Behaltene Seite umkehren",
      fill: "Schnittfüllung",
      reset: "Zurücksetzen",
    },
    contextMenu: {
      editMaterial: "Material „{name}” bearbeiten",
      aria: "Aktionen",
      ask: "Zu diesem Element fragen",
      hide: "Element ausblenden",
      showHidden: "Ausgeblendete Elemente zeigen ({count})",
      focus: "Auf diesen Punkt zoomen",
      reset: "Ansicht zurücksetzen",
      showAll: "Alle Elemente zeigen",
      sameType: "Alle dieses Typs auswählen",
      sameTypeFound: "{count} Element(e) dieses Typs",
      isolate: "Nur dieses Element zeigen",
      copyGuid: "GlobalId kopieren",
      guidCopied: "Kopiert: {value}",
      measure: "Von hier messen",
      annotate: "Hier annotieren",
      cut: "Hier horizontal schneiden",
      removeCuts: "Schnitte entfernen",
      copyPoint: "Koordinaten kopieren",
      pointCopied: "Kopiert: {value}",
      copyFailed: "Kopieren nicht möglich: {value}",
      finishMeasurement: "Messung abschließen",
      undoPoint: "Letzten Punkt entfernen",
      cancelMeasurement: "Messung verwerfen",
      stopMeasuring: "Messen beenden",
      annotateFaces: "Ausgewählte Flächen annotieren ({count})",
      clearFaces: "Auswahl aufheben",
      stopPicking: "Flächenauswahl beenden",
    },
    materials: {
      applySuggested: "Anwenden",
      applyAllSuggested: "Von den Namen vorgeschlagene Arten anwenden ({count})",
      suggested: "Der Name legt nahe: {type}",
      title: "Materialien",
      unnamed: "Material {number}",
      empty: "Dieses Modell hat keine bearbeitbaren Materialien (eine Punktwolke oder Splats).",
      showOriginal: "Materialien zeigen",
      filter: "Suchen…",
      filterLabel: "Ein Material nach Namen suchen",
      reset: "Zurücksetzen",
      resetHint: "Das Material wie geladen",
      presets: "Materialart",
      group: {
        glass: "Glas",
        wood: "Holz",
        walls: "Wände & Stein",
        metal: "Metall",
        other: "Sonstiges",
      },
      preset: {
        glass: "Glas",
        frostedGlass: "Milchglas",
        tintedGlass: "Getöntes Glas",
        water: "Wasser",
        lightWood: "Helles Holz",
        darkWood: "Dunkles Holz",
        varnishedWood: "Lackiertes Holz",
        plaster: "Putz",
        paintedWall: "Gestrichene Wand",
        concrete: "Beton",
        brick: "Ziegel",
        sandstone: "Sandstein",
        marble: "Marmor",
        terracotta: "Terrakotta",
        ceramic: "Glasierte Keramik",
        steel: "Stahl",
        aluminium: "Aluminium",
        iron: "Eisen",
        brass: "Messing",
        gold: "Gold",
        copper: "Kupfer",
        bronze: "Bronze",
        mirror: "Spiegel",
        plastic: "Kunststoff",
        rubber: "Gummi",
        fabric: "Stoff",
        clay: "Ton",
        light: "Lichtquelle",
      },
      keepTexture: "Textur behalten",
      properties: "Eigenschaften",
      field: {
        color: "Farbe",
        roughness: "Rauheit",
        metalness: "Metallisch",
        opacity: "Deckkraft",
        transmission: "Transmission (Glas)",
        clearcoat: "Klarlack",
        emissive: "Leuchtfarbe",
        emissiveIntensity: "Leuchtstärke",
        doubleSided: "Beide Seiten",
      },
      resetAll: "Alle Materialien zurücksetzen",
      saveNote: "Mit den Einstellungen des Modells gespeichert: Datei > Einstellungen speichern.",
      shadingNote: "Ein anderer Schattierungsmodus ist an: Änderungen zeigen sich mit den Originalmaterialien.",
      picking: "Auf das Modell klicken… (Esc: abbrechen)",
      pick: "Am Modell wählen",
      count: "{count} Materialien",
      edited: "geändert",
      meshes: "{count} Teile",
      basedOn: "Art: {type}",
      editedCopy: "Geändert (das Original bleibt erhalten)",
      asLoaded: "Wie geladen",
    },
    performance: {
      heavy: "Ein schweres Modell für dieses Gerät ({triangles} Mio. Dreiecke).",
      title: "Renderqualität",
      quality: {
        high: "Volle Qualität",
        balanced: "Ausgewogen",
        fast: "Schnell",
      },
      lowered: "Renderqualität: {quality}.",
      undo: "Rückgängig",
      slow: "Die Ansicht ruckelt (etwa {fps} Bilder pro Sekunde).",
      offer: {
        balanced: "Ausgewogen: ohne Umgebungsverdeckung, auf hochauflösenden Bildschirmen etwas weniger scharf.",
        fast: "Schnell: ohne Nachbearbeitung, geringere Auflösung.",
      },
      lower: "Zu „{quality}” wechseln",
    },
    prepare: {
      badge: "{count} zu beheben",
      title: "Für die Veröffentlichung vorbereiten",
      intro: "Bevor die Einstellungen ins Repositorium gehen und die Renderings entstehen: was darin zu sehen wäre und nicht sollte.",
      recheck: "Erneut prüfen",
      next: "Weiter",
      fixed: "Behoben: {count}.",
      fixAll: "Alles beheben ({count})",
      passed: "In Ordnung: {count}",
      orientationHint: "Seine größten flachen Flächen liegen seitlich, nicht unten.",
      summary: {
        wait: "Warte auf das Modell…",
        fix: "Zu beheben: {fixes} · Tipps: {tips}",
        ready: "Bereit zur Veröffentlichung · Tipps: {tips}",
      },
      guard: {
        save: "Vor dem Speichern: {count} Dinge zu beheben",
        preview: "Vor dem Vorschaubild: {count} Dinge zu beheben",
        thumbnails: "Vor den Renderings: {count} Dinge zu beheben",
        review: "Ansehen",
        continue: "Trotzdem fortfahren",
      },
      step: {
        frontNone: "Vorderseite: die Seite, von der die Startansicht blickt (noch keine gespeichert: die Vorderseite der Datei)",
        front: "Vorderseite: die Seite, von der die Startansicht blickt ({angle}°)",
        save: "Einstellungen speichern",
        saved: "Gespeichert um {time}",
        changed: "Seit dem Speichern geändert",
        unsaved: "In dieser Sitzung nicht gespeichert",
        thumbnails: "Renderings erzeugen",
        thumbnailsNote: "Neun Ansichten des Modells, wie es jetzt aussieht",
        preview: "Hauptvorschaubild erzeugen",
        previewNote: "Aus der aktuellen Ansicht",
      },
      fix: {
        suggested: "Arten anwenden",
        orientation: "Aufrichten",
        ground: "Auf den Boden stellen",
        framing: "Modell einpassen",
        brighter: "Aufhellen",
        darker: "Abdunkeln",
        clipping: "Schnitte entfernen",
        measurements: "Entfernen",
        faces: "Auswahl aufheben",
        hide: "Ausblenden",
        off: "Ausschalten",
        clearSelection: "Hervorhebung aufheben",
        shading: "Originalmaterialien",
        quality: "Volle Qualität",
        materials: "Materialien öffnen",
        metadata: "Validierungsbericht",
      },
      check: {
        suggested: "Materialarten aus den Namen: {count}",
        suggestedDetail: "Namen wie „Glas” oder „Holz” bei noch unveränderten Materialien: ihre Arten mit einem Klick (in Ansicht > Materialien rückgängig).",
        loading: "Das Modell lädt noch",
        loadingDetail: "Erneut prüfen, sobald das vollständige Modell angezeigt wird.",
        orientationOk: "Steht aufrecht",
        upsideDown: "Das Modell scheint auf dem Kopf zu stehen",
        onSide: "Das Modell scheint auf der Seite zu liegen",
        orientationDetail: "Seine flache Basis ist nicht unten. Die Hochachse {axis} würde es aufrichten.",
        orientationRotated: "Es wurde von Hand gedreht: die Drehung prüfen.",
        groundOk: "Steht auf dem Boden",
        floating: "Das Modell schwebt über dem Boden",
        sunk: "Das Modell reicht unter den Boden",
        groundDetail: "Um {share} seiner Höhe.",
        framingOk: "Das ganze Modell ist in der Ansicht",
        inside: "Die Ansicht liegt im Modell",
        insideDetail: "Für einen Innenraum in Ordnung; so zeigen ihn die gespeicherte Startansicht und das Vorschaubild.",
        cut: "Ein Teil des Modells liegt außerhalb der Ansicht",
        small: "Das Modell ist in der Ansicht klein",
        cutDetail: "Etwa {percent} davon sind in der gespeicherten Startansicht und im Vorschaubild abgeschnitten.",
        smallDetail: "Es füllt etwa {percent} der Ansicht.",
        exposureOk: "Gut beleuchtet",
        dark: "Das Modell wirkt zu dunkel",
        bright: "Das Modell wirkt zu hell",
        exposureDetail: "Mittlere Helligkeit {percent}.",
        toolsOk: "Keine Werkzeuge mehr an",
        toolDetail: "Sie wären in den Renderings zu sehen.",
        clipping: "Schnittebenen schneiden das Modell",
        measurements: "Messungen liegen auf dem Modell",
        faces: "Flächen sind ausgewählt",
        transform: "Die Griffe zum Verschieben / Drehen sind sichtbar",
        lightTransform: "Die Griffe des Lichts sind sichtbar",
        wireframe: "Drahtgitter ist an",
        certainty: "Die Farben der Gewissheitsstufen sind an",
        selection: "Teile sind hervorgehoben",
        shading: "Schattierung: {mode}",
        shadingDetail: "Die Renderings zeigen diesen Modus, nicht die Materialien.",
        weather: "Wetter: {type}",
        weatherDetail: "Es wäre in den Renderings zu sehen; in Ordnung, wenn gewollt.",
        quality: "Renderqualität gesenkt: {quality}",
        qualityDetail: "Die Renderings hätten eine geringere Auflösung, ohne einige Effekte.",
        unitsLarge: "Stimmt die Einheit? Das Modell misst {size}",
        unitsSmall: "Stimmt die Einheit? Das Modell misst nur {size}",
        unitsDetail: "Die Datei nennt ihre Einheit nicht: im Messmenü einstellen - Maße und Sonne hängen davon ab.",
        black: "Schwarze Materialien",
        invisible: "Unsichtbare Materialien",
        heavy: "Schwer für Telefone",
        heavyDetail: "{triangles} Mio. Dreiecke, Texturen bis {texture} px: die optimierte Kopie des Workers lädt schneller.",
        metadata: "Metadaten und Rechte",
        metadataDetail: "Der Validierungsbericht prüft Titel, Beschreibung und Lizenz.",
      },
    },
    shortcuts: {
      title: "Steuerung",
      mouse: "Maus: ziehen zum Drehen, Mausrad - Zoom, Rechtsklick - Verschieben, Rechtsklick ohne Ziehen - Aktionen, Zurück-Taste - schließt",
      keyboard: "Tastatur: Pfeile - Drehen, Shift+Pfeile - schneller, Ctrl/Cmd+Pfeile - Verschieben, +/- - Zoom, Leertaste - Auto-Rotation, Esc - zurück, Rücktaste - letzten Messpunkt entfernen",
      touch: "Touch: Pinch-to-Zoom, ziehen zum Drehen, Doppeltippen und halten zum Verschieben, gedrückt halten - Aktionen, Tippen mit zwei Fingern oder Zurück-Geste - zurück",
      dragAndDrop: "Oder ziehen Sie ein 3D-Modell per Drag-and-drop in den Viewer",
      helpButtonAria: "Bedienungshinweise anzeigen",
      closeAria: "Schließen",
    }
  },
};

const DEFAULT_LANG = "en";

// Where the current language comes from: the viewer's core.currentLanguage
// (main.js), the admin pages' own choice (exadmin/). Kept out of this module
// so pages without the viewer translate without loading it (core.js pulls
// in three.js).
let languageSource = () => DEFAULT_LANG;

function setLanguageSource(source) {
  languageSource = source;
}

const t=function(key, varsOrFallback = {}, maybeFallback = "") {
  const current = languageSource();
  const lang = ["pl", "de"].includes(current)
    ? current
    : DEFAULT_LANG;

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
      val = t(`state.${val ? "enabled" : "disabled"}`);
    } else if (typeof val === "string") {
      if (val === "enabled" || val === "disabled") {
        val = t(`state.${val}`);
      } else if (val.startsWith("state.")) {
        val = t(val);
      }
    }

    return val ?? `{${v}}`;
  });
};

// A password input with an eye button that shows/hides what was typed.
// Returns { field, input }: `field` goes into the form, `input` is read for
// the value. Styles: .password-field in upload-panel.css.
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>';

function createPasswordField({ autocomplete = "current-password" } = {}) {
  const field = document.createElement("div");
  field.className = "password-field";

  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = autocomplete;
  input.placeholder = t("uploadPanel.password", "Password");
  input.setAttribute("aria-label", input.placeholder);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "password-toggle";

  const render = () => {
    const visible = input.type === "text";
    const label = visible
      ? t("uploadPanel.hidePassword", "Hide password")
      : t("uploadPanel.showPassword", "Show password");
    toggle.innerHTML = visible ? EYE_OFF : EYE;
    toggle.title = label;
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("aria-pressed", String(visible));
  };

  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    render();
    // Keep typing where it was.
    const end = input.value.length;
    input.focus();
    input.setSelectionRange?.(end, end);
  });

  render();
  field.append(input, toggle);
  return { field, input };
}

// The line under a model's name in the model lists (library, repository,
// admin): small icons instead of words. Each part is an icon, optionally
// followed by a value; the words stay as its tooltip and accessible name.
// The icons themselves are CSS masks (.meta-icon[data-icon] in models-panel.css).

function metaPart(icon, label, value = "") {
  const part = document.createElement("span");
  part.className = "meta-part";
  part.title = label;
  const glyph = document.createElement("span");
  glyph.className = "meta-icon";
  glyph.dataset.icon = icon;
  part.appendChild(glyph);
  if (value) {
    const text = document.createElement("span");
    text.textContent = value;
    part.appendChild(text);
    glyph.setAttribute("aria-hidden", "true");
    part.setAttribute("aria-label", `${label}: ${value}`);
  } else {
    part.setAttribute("role", "img");
    part.setAttribute("aria-label", label);
  }
  return part;
}

// The caption itself; empty parts (null) are left out.
function metaCaption(parts) {
  const caption = document.createElement("span");
  caption.className = "models-panel-item-meta";
  caption.append(...parts.filter(Boolean));
  return caption;
}

// Level of Certainty (LoC) of a reconstruction: the scale a manifest defines
// (AIM3DViewer.certainty) and the assessments its annotations carry
// (annotation.AIM3DViewer.certainty). No three.js here: the manifest
// validation (aim3dviewer-validation.js) also runs in Node.
//
// A level is told apart by its colour, its code (a letter) and its symbol,
// so it reads without colour vision too. A level's `value` is its lower bound
// on the scale: an assessment belongs to the highest level not above it.

const CERTAINTY_SCOPES = ["object", "group"];

// Opacity of the colour overlays in the view: the model shows through.
const DEFAULT_CERTAINTY_OPACITY = 0.4;

const DEFAULT_CERTAINTY_SCALE = Object.freeze({
  min: 0,
  max: 10,
  unassessedColor: "#9ca3af",
  opacity: DEFAULT_CERTAINTY_OPACITY,
  levels: [
    {
      value: 10, code: "A", symbol: "✓", color: "#1a9850",
      label: { en: ["Preserved / surveyed"], pl: ["Stan zachowany / pomiar"], de: ["Erhalten / vermessen"] },
    },
    {
      value: 8, code: "B", symbol: "■", color: "#2166ac",
      label: { en: ["Direct documentation"], pl: ["Dokumentacja bezpośrednia"], de: ["Direkte Dokumentation"] },
    },
    {
      value: 6, code: "C", symbol: "▲", color: "#ffd400",
      label: { en: ["Indirect sources"], pl: ["Źródła pośrednie"], de: ["Indirekte Quellen"] },
    },
    {
      value: 4, code: "D", symbol: "≈", color: "#f46d00",
      label: { en: ["Analogy"], pl: ["Analogia"], de: ["Analogie"] },
    },
    {
      value: 0, code: "E", symbol: "?", color: "#c51b7d",
      label: { en: ["Hypothesis"], pl: ["Hipoteza"], de: ["Hypothese"] },
    },
  ],
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isPlainObject$1(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

// A IIIF language map ({ "pl": ["..."] }) or a plain string, as a language map.
function normalizeLanguageMap(value) {
  if (typeof value === "string") return value.trim() ? { none: [value.trim()] } : null;
  if (!isPlainObject$1(value)) return null;
  const entries = Object.entries(value)
    .map(([language, texts]) => [language, (Array.isArray(texts) ? texts : [texts]).map(String).filter(Boolean)])
    .filter(([, texts]) => texts.length > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}

// The text of a language map in `language`, else English, else any.
function certaintyText(map, language = "en") {
  if (!isPlainObject$1(map)) return "";
  const texts = map[language] || map.en || map.none || Object.values(map)[0];
  return Array.isArray(texts) ? texts.join(" ") : String(texts || "");
}

// The manifest's scale, levels sorted from the highest value down; the
// default scale when it has no usable levels. Invalid levels are dropped
// (the validation reports them).
function normalizeCertaintyScale(raw) {
  const source = isPlainObject$1(raw) && Array.isArray(raw.levels) ? raw : DEFAULT_CERTAINTY_SCALE;
  const levels = source.levels
    .map((level) => {
      if (!isPlainObject$1(level)) return null;
      const value = toFiniteNumber(level.value);
      const color = String(level.color || "").trim();
      const code = String(level.code || "").trim();
      if (value === null || !HEX_COLOR.test(color) || !code) return null;
      return {
        value,
        code,
        symbol: String(level.symbol || "").trim(),
        color: color.toLowerCase(),
        label: normalizeLanguageMap(level.label) || { none: [code] },
        ...(normalizeLanguageMap(level.description) ? { description: normalizeLanguageMap(level.description) } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
  if (!levels.length) return normalizeCertaintyScale(DEFAULT_CERTAINTY_SCALE);

  const min = toFiniteNumber(source.min) ?? Math.min(...levels.map((level) => level.value));
  const max = toFiniteNumber(source.max) ?? Math.max(...levels.map((level) => level.value));
  const unassessedColor = HEX_COLOR.test(String(source.unassessedColor || ""))
    ? source.unassessedColor.toLowerCase()
    : DEFAULT_CERTAINTY_SCALE.unassessedColor;
  const opacity = toFiniteNumber(source.opacity);
  return {
    min,
    max,
    unassessedColor,
    opacity: opacity !== null && opacity >= 0 && opacity <= 1 ? opacity : DEFAULT_CERTAINTY_OPACITY,
    levels,
    ...(normalizeLanguageMap(source.label) ? { label: normalizeLanguageMap(source.label) } : {}),
    visible: source.visible === true,
  };
}

// The level an assessed value belongs to; null when below every level.
function certaintyLevelForValue(scale, value) {
  const number = toFiniteNumber(value);
  if (number === null || !scale?.levels?.length) return null;
  return scale.levels.find((level) => number >= level.value) || null;
}

// An annotation's assessment ({ value, code?, scope, targetId? }); a code
// alone is resolved against the scale. null when it has none.
function normalizeCertaintyAssessment(raw, scale = null) {
  if (!isPlainObject$1(raw)) return null;
  let value = toFiniteNumber(raw.value);
  const code = String(raw.code || "").trim();
  if (value === null && code && scale) {
    value = scale.levels.find((level) => level.code === code)?.value ?? null;
  }
  if (value === null) return null;
  const scope = CERTAINTY_SCOPES.includes(raw.scope) ? raw.scope : "object";
  const targetId = String(raw.targetId || "").trim();
  return {
    value,
    ...(code ? { code } : {}),
    scope,
    ...(targetId ? { targetId } : {}),
  };
}

// Problems of a manifest's scale, as [path, message] pairs.
function certaintyScaleErrors(raw, path) {
  const errors = [];
  if (!isPlainObject$1(raw)) return [[path, "must be an object"]];
  ["min", "max"].forEach((key) => {
    if (raw[key] !== undefined && toFiniteNumber(raw[key]) === null) errors.push([`${path}.${key}`, "must be a finite number"]);
  });
  if (raw.unassessedColor !== undefined && !HEX_COLOR.test(String(raw.unassessedColor))) {
    errors.push([`${path}.unassessedColor`, "must be a #rrggbb colour"]);
  }
  if (raw.visible !== undefined && typeof raw.visible !== "boolean") errors.push([`${path}.visible`, "must be a boolean"]);
  if (raw.opacity !== undefined && (typeof raw.opacity !== "number" || !(raw.opacity >= 0 && raw.opacity <= 1))) {
    errors.push([`${path}.opacity`, "must be a number within 0..1"]);
  }
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    errors.push([`${path}.levels`, "must be a non-empty array"]);
    return errors;
  }
  const seen = { value: new Set(), code: new Set(), color: new Set() };
  raw.levels.forEach((level, index) => {
    const levelPath = `${path}.levels[${index}]`;
    if (!isPlainObject$1(level)) {
      errors.push([levelPath, "must be an object"]);
      return;
    }
    if (typeof level.value !== "number" || !Number.isFinite(level.value)) errors.push([`${levelPath}.value`, "must be a finite number"]);
    if (typeof level.code !== "string" || !level.code.trim()) errors.push([`${levelPath}.code`, "must be a non-empty string"]);
    if (!HEX_COLOR.test(String(level.color))) errors.push([`${levelPath}.color`, "must be a #rrggbb colour"]);
    if (level.symbol !== undefined && typeof level.symbol !== "string") errors.push([`${levelPath}.symbol`, "must be a string"]);
    if (level.label !== undefined && typeof level.label !== "string" && !isPlainObject$1(level.label)) {
      errors.push([`${levelPath}.label`, "must be a string or a language map"]);
    }
    // Levels must stay apart: no shared value, code or colour.
    ["value", "code", "color"].forEach((key) => {
      const token = key === "color" ? String(level[key]).toLowerCase() : level[key];
      if (level[key] === undefined) return;
      if (seen[key].has(token)) errors.push([`${levelPath}.${key}`, "must be unique among the levels"]);
      seen[key].add(token);
    });
  });
  const min = toFiniteNumber(raw.min);
  const max = toFiniteNumber(raw.max);
  if (min !== null && max !== null && min > max) errors.push([`${path}.min`, "must not exceed max"]);
  return errors;
}

// Problems of an annotation's assessment, checked against the scale.
function certaintyAssessmentErrors(raw, path, scale) {
  if (!isPlainObject$1(raw)) return [[path, "must be an object"]];
  const errors = [];
  if (raw.value === undefined && raw.code === undefined) errors.push([path, "needs a value or a code"]);
  if (raw.value !== undefined) {
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value)) {
      errors.push([`${path}.value`, "must be a finite number"]);
    } else if (scale && (raw.value < scale.min || raw.value > scale.max)) {
      errors.push([`${path}.value`, `must be within ${scale.min}..${scale.max}`]);
    }
  }
  if (raw.code !== undefined && scale && !scale.levels.some((level) => level.code === raw.code)) {
    errors.push([`${path}.code`, `must be one of: ${scale.levels.map((level) => level.code).join(", ")}`]);
  }
  if (raw.scope !== undefined && !CERTAINTY_SCOPES.includes(raw.scope)) {
    errors.push([`${path}.scope`, `must be one of: ${CERTAINTY_SCOPES.join(", ")}`]);
  }
  if (raw.targetId !== undefined && typeof raw.targetId !== "string") errors.push([`${path}.targetId`, "must be a string"]);
  return errors;
}

// Keep in sync with TONE_MAPPING_MODES / ANTIALIAS_MODES in viewer/rendering.js
// (not imported: this module also runs in Node without three.js).
const RENDERING_TONE_MAPPINGS = ["none", "linear", "reinhard", "cineon", "aces", "agx", "neutral"];
const RENDERING_ANTIALIAS_MODES = ["msaa", "smaa", "fxaa", "none"];
// Keep in sync with WEATHER_TYPES in viewer/editor/weather.js (same reason).
const WEATHER_TYPES = ["clear", "fog", "rain", "snow", "storm"];
// Keep in sync with SHADING_MODES in viewer/editor/shading.js (same reason).
const SHADING_MODES = ["original", "standard", "phong", "lambert", "toon", "flat", "clay", "matcap", "normals", "custom"];
// Keep in sync with MATERIAL_PRESETS in viewer/editor/material-presets.js.
const MATERIAL_PRESET_KEYS = [
  "glass", "frostedGlass", "tintedGlass", "water", "lightWood", "darkWood", "varnishedWood",
  "plaster", "paintedWall", "concrete", "brick", "sandstone", "marble", "terracotta", "ceramic",
  "steel", "aluminium", "iron", "brass", "gold", "copper", "bronze", "mirror",
  "plastic", "rubber", "fabric", "clay", "light",
];
// Keep in sync with UP_AXES in viewer/up-axis.js (same reason).
const MODEL_UP_AXES = ["Y+", "Y-", "Z+", "Z-", "X+", "X-"];
// Keep in sync with TIMELINE_TRANSITIONS / TIMELINE_STAGE_TYPES in viewer/timeline.js.
const TIMELINE_TRANSITIONS = ["interpolate", "step"];
const TIMELINE_STAGE_TYPES = ["documented", "modelled"];
// Keep in sync with COMPARE_MODES / COMPARE_KINDS in viewer/editor/compare.js.
const COMPARE_MODES = ["swipe", "split"];
const COMPARE_KINDS = ["content", "look"];
const COMPARE_LIGHTINGS = ["current", "noEnvironment", "neutral", "sunny", "studio", "goldenHour", "raking"];

function isPlainObject(value) {
  return value != null && typeof value === "object" && Array.isArray(value) === false;
}

function isAIM3DManifest(manifest) {
  return isPlainObject(manifest) && Object.hasOwn(manifest, "AIM3DViewer");
}

function parseFiniteNumber(value) {
  if (isFiniteNumber$1(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Older viewer exports kept values from viewer-settings.json verbatim. Normalize
// those compatible values before validating the canonical AIM3D representation.
function normalizeAIM3DManifest(manifest) {
  const viewer = manifest?.AIM3DViewer?.viewer;
  if (!isPlainObject(viewer)) return manifest;

  if (Array.isArray(viewer.scale)) {
    viewer.scale = viewer.scale.map((value) => parseFiniteNumber(value) ?? value);
  } else if (isPlainObject(viewer.scale)) {
    ["x", "y"].forEach((axis) => {
      viewer.scale[axis] = parseFiniteNumber(viewer.scale[axis]) ?? viewer.scale[axis];
    });
  }

  if (isPlainObject(viewer.performance)) {
    const mode = viewer.performance.Performance ?? viewer.performance.performance;
    if (typeof mode === "string" && mode.trim() !== "") {
      viewer.performance = mode;
    }
  }

  return manifest;
}

function isFiniteNumber$1(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string";
}

function pushError(errors, path, message) {
  errors.push({ path, message });
}

function validateVector(value, path, errors, expectedLength = 3) {
  if (Array.isArray(value)) {
    if (value.length < expectedLength) {
      pushError(errors, path, `must contain at least ${expectedLength} numbers`);
      return;
    }
    value.slice(0, expectedLength).forEach((item, index) => {
      if (!isFiniteNumber$1(item)) {
        pushError(errors, `${path}[${index}]`, "must be a finite number");
      }
    });
    return;
  }

  if (isPlainObject(value)) {
    const keys = expectedLength === 2 ? ["x", "y"] : ["x", "y", "z"];
    keys.forEach((key) => {
      if (!isFiniteNumber$1(value[key])) {
        pushError(errors, `${path}.${key}`, "must be a finite number");
      }
    });
    return;
  }

  pushError(errors, path, `must be a ${expectedLength}D vector array or object`);
}

function validateBoolean(value, path, errors) {
  if (typeof value !== "boolean") {
    pushError(errors, path, "must be a boolean");
  }
}

function validateNumber(value, path, errors) {
  if (!isFiniteNumber$1(value)) {
    pushError(errors, path, "must be a finite number");
  }
}

function validateString(value, path, errors) {
  if (!isString(value)) {
    pushError(errors, path, "must be a string");
  }
}

function validateEnum(value, allowedValues, path, errors) {
  if (!allowedValues.includes(value)) {
    pushError(errors, path, `must be one of: ${allowedValues.join(", ")}`);
  }
}

function validateLight(light, path, errors) {
  if (!isPlainObject(light)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (light.type !== undefined) validateString(light.type, `${path}.type`, errors);
  if (light.position !== undefined) validateVector(light.position, `${path}.position`, errors, 3);
  if (light.target !== undefined) validateVector(light.target, `${path}.target`, errors, 3);
  if (light.color !== undefined) validateString(light.color, `${path}.color`, errors);
  if (light.intensity !== undefined) validateNumber(light.intensity, `${path}.intensity`, errors);
}

// AIM3DViewer.rakingLight (editor/raking-light.js): direction 0-360 and
// height 1-89 degrees.
function validateRakingLight(rakingLight, path, errors) {
  if (!isPlainObject(rakingLight)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (rakingLight.enabled !== undefined) validateBoolean(rakingLight.enabled, `${path}.enabled`, errors);
  if (rakingLight.sweep !== undefined) validateBoolean(rakingLight.sweep, `${path}.sweep`, errors);
  if (rakingLight.direction !== undefined) {
    if (!isFiniteNumber$1(rakingLight.direction) || rakingLight.direction < 0 || rakingLight.direction > 360) {
      pushError(errors, `${path}.direction`, "must be a number from 0 to 360");
    }
  }
  if (rakingLight.height !== undefined) {
    if (!isFiniteNumber$1(rakingLight.height) || rakingLight.height < 1 || rakingLight.height > 89) {
      pushError(errors, `${path}.height`, "must be a number from 1 to 89");
    }
  }
}

function validateClipping(clipping, path, errors) {
  if (!isPlainObject(clipping)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (clipping.mode !== undefined) {
    if (!isPlainObject(clipping.mode)) {
      pushError(errors, `${path}.mode`, "must be an object");
    } else {
      ["x", "y", "z"].forEach((axis) => {
        if (clipping.mode[axis] !== undefined) validateBoolean(clipping.mode[axis], `${path}.mode.${axis}`, errors);
      });
    }
  }
  if (clipping.constants !== undefined) validateVector(clipping.constants, `${path}.constants`, errors, 3);
  if (clipping.outlineVisible !== undefined) validateBoolean(clipping.outlineVisible, `${path}.outlineVisible`, errors);
  if (clipping.outline !== undefined) validateBoolean(clipping.outline, `${path}.outline`, errors);
}

function validateCamera(camera, path, errors) {
  if (!isPlainObject(camera)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (camera.position !== undefined) validateVector(camera.position, `${path}.position`, errors, 3);
  if (camera.target !== undefined) validateVector(camera.target, `${path}.target`, errors, 3);
  if (camera.up !== undefined) validateVector(camera.up, `${path}.up`, errors, 3);
  if (camera.fov !== undefined) validateNumber(camera.fov, `${path}.fov`, errors);
  if (camera.zoom !== undefined) validateNumber(camera.zoom, `${path}.zoom`, errors);
  if (camera.distance !== undefined) validateNumber(camera.distance, `${path}.distance`, errors);
  if (camera.perspectiveMode !== undefined) validateEnum(camera.perspectiveMode, ["perspective", "orthographic"], `${path}.perspectiveMode`, errors);
}

function validatePanelState(panel, path, errors) {
  if (!isPlainObject(panel)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (panel.position !== undefined) validateVector(panel.position, `${path}.position`, errors, 2);
  if (panel.size !== undefined) {
    if (!isPlainObject(panel.size)) {
      pushError(errors, `${path}.size`, "must be an object");
    } else {
      // viewer-settings.json uses null for "not sized yet".
      ["width", "height"].forEach((key) => {
        if (panel.size[key] != null) validateNumber(panel.size[key], `${path}.size.${key}`, errors);
      });
    }
  }
}

function validateIntegration(integration, path, errors) {
  if (!isPlainObject(integration)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (integration.exportViewerUrl !== undefined) validateString(integration.exportViewerUrl, `${path}.exportViewerUrl`, errors);
  if (integration.api !== undefined) {
    if (!isPlainObject(integration.api)) {
      pushError(errors, `${path}.api`, "must be an object");
    } else if (integration.api.thumbnailUploadEndpoint !== undefined) {
      validateString(integration.api.thumbnailUploadEndpoint, `${path}.api.thumbnailUploadEndpoint`, errors);
    }
  }
}

function validateViewer(viewer, path, errors) {
  if (!isPlainObject(viewer)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (viewer.container !== undefined) validateString(viewer.container, `${path}.container`, errors);
  if (viewer.mailUrl !== undefined) validateString(viewer.mailUrl, `${path}.mailUrl`, errors);
  if (viewer.mainUrl !== undefined) validateString(viewer.mainUrl, `${path}.mainUrl`, errors);
  if (viewer.baseModulePath !== undefined) validateString(viewer.baseModulePath, `${path}.baseModulePath`, errors);
  if (viewer.background !== undefined) validateString(viewer.background, `${path}.background`, errors);
  if (viewer.credits !== undefined && !isPlainObject(viewer.credits)) pushError(errors, `${path}.credits`, "must be an object");
  if (viewer.auth !== undefined) {
    if (!isPlainObject(viewer.auth)) {
      pushError(errors, `${path}.auth`, "must be an object");
    } else {
      ["enabled", "allowRegistration"].forEach((key) => {
        if (viewer.auth[key] !== undefined) validateBoolean(viewer.auth[key], `${path}.auth.${key}`, errors);
      });
    }
  }
  ["manifestoForm", "metadataContainer"].forEach((key) => {
    if (viewer[key] !== undefined) validatePanelState(viewer[key], `${path}.${key}`, errors);
  });
  if (viewer.baseNamespace !== undefined) validateString(viewer.baseNamespace, `${path}.baseNamespace`, errors);
  if (viewer.metadataUrl !== undefined) validateString(viewer.metadataUrl, `${path}.metadataUrl`, errors);
  if (viewer.theme !== undefined) validateEnum(viewer.theme, ["light", "dark"], `${path}.theme`, errors);
  if (viewer.language !== undefined) validateEnum(viewer.language, ["en", "pl", "de"], `${path}.language`, errors);
  if (viewer.backgroundColor !== undefined) validateString(viewer.backgroundColor, `${path}.backgroundColor`, errors);
  if (viewer.environmentMap !== undefined) {
    if (!isPlainObject(viewer.environmentMap)) {
      pushError(errors, `${path}.environmentMap`, "must be an object");
    } else {
      if (viewer.environmentMap.intensity !== undefined) validateNumber(viewer.environmentMap.intensity, `${path}.environmentMap.intensity`, errors);
      if (viewer.environmentMap.preset !== undefined) validateString(viewer.environmentMap.preset, `${path}.environmentMap.preset`, errors);
      if (viewer.environmentMap.enabled !== undefined) validateBoolean(viewer.environmentMap.enabled, `${path}.environmentMap.enabled`, errors);
    }
  }
  if (viewer.rendering !== undefined) {
    const rendering = viewer.rendering;
    if (!isPlainObject(rendering)) {
      pushError(errors, `${path}.rendering`, "must be an object");
    } else {
      if (rendering.toneMapping !== undefined) validateEnum(rendering.toneMapping, RENDERING_TONE_MAPPINGS, `${path}.rendering.toneMapping`, errors);
      if (rendering.exposure !== undefined) {
        validateNumber(rendering.exposure, `${path}.rendering.exposure`, errors);
        if (Number.isFinite(rendering.exposure) && rendering.exposure < 0) pushError(errors, `${path}.rendering.exposure`, "must be >= 0");
      }
      if (rendering.postprocessing !== undefined) {
        const postprocessing = rendering.postprocessing;
        if (!isPlainObject(postprocessing)) {
          pushError(errors, `${path}.rendering.postprocessing`, "must be an object");
        } else {
          if (postprocessing.enabled !== undefined) validateBoolean(postprocessing.enabled, `${path}.rendering.postprocessing.enabled`, errors);
          if (postprocessing.antialias !== undefined) validateEnum(postprocessing.antialias, RENDERING_ANTIALIAS_MODES, `${path}.rendering.postprocessing.antialias`, errors);
          if (postprocessing.ao !== undefined) validateBoolean(postprocessing.ao, `${path}.rendering.postprocessing.ao`, errors);
          if (postprocessing.aoIntensity !== undefined) {
            if (!isFiniteNumber$1(postprocessing.aoIntensity) || postprocessing.aoIntensity < 0 || postprocessing.aoIntensity > 2) {
              pushError(errors, `${path}.rendering.postprocessing.aoIntensity`, "must be a number from 0 to 2");
            }
          }
        }
      }
    }
  }
  [
    "presentationMode",
    "sandbox",
    "lightweight",
    "editor",
    "autorotate",
    "disableInteraction",
    "hideUi",
    "hideMetadata",
    "showNotifications",
  ].forEach((key) => {
    if (viewer[key] !== undefined) validateBoolean(viewer[key], `${path}.${key}`, errors);
  });
  if (viewer.autorotateSpeed !== undefined) validateNumber(viewer.autorotateSpeed, `${path}.autorotateSpeed`, errors);
  if (viewer.scale !== undefined) validateVector(viewer.scale, `${path}.scale`, errors, 2);
  if (viewer.window !== undefined) {
    if (!isPlainObject(viewer.window)) {
      pushError(errors, `${path}.window`, "must be an object");
    } else {
      if (viewer.window.position !== undefined) {
        validateVector(viewer.window.position, `${path}.window.position`, errors, 2);
      }
      if (viewer.window.size !== undefined) {
        if (!isPlainObject(viewer.window.size)) {
          pushError(errors, `${path}.window.size`, "must be an object");
        } else {
          if (viewer.window.size.width !== undefined) validateNumber(viewer.window.size.width, `${path}.window.size.width`, errors);
          if (viewer.window.size.height !== undefined) validateNumber(viewer.window.size.height, `${path}.window.size.height`, errors);
        }
      }
    }
  }
  if (viewer.performance !== undefined) validateString(viewer.performance, `${path}.performance`, errors);
  if (viewer.units !== undefined && !(isFiniteNumber$1(viewer.units) || isString(viewer.units))) {
    pushError(errors, `${path}.units`, "must be a finite number or string");
  }
  if (viewer.gallery !== undefined && !isPlainObject(viewer.gallery)) pushError(errors, `${path}.gallery`, "must be an object");
  if (viewer.editorToolbar !== undefined) {
    if (!isPlainObject(viewer.editorToolbar)) {
      pushError(errors, `${path}.editorToolbar`, "must be an object");
    } else {
      if (viewer.editorToolbar.enabled !== undefined) validateBoolean(viewer.editorToolbar.enabled, `${path}.editorToolbar.enabled`, errors);
      if (viewer.editorToolbar.position !== undefined) validateVector(viewer.editorToolbar.position, `${path}.editorToolbar.position`, errors, 2);
      if (viewer.editorToolbar.expanded !== undefined) validateBoolean(viewer.editorToolbar.expanded, `${path}.editorToolbar.expanded`, errors);
      if (viewer.editorToolbar.visible !== undefined) validateBoolean(viewer.editorToolbar.visible, `${path}.editorToolbar.visible`, errors);
    }
  }
  if (viewer.menuToolbar !== undefined) {
    if (!isPlainObject(viewer.menuToolbar)) {
      pushError(errors, `${path}.menuToolbar`, "must be an object");
    } else {
      if (viewer.menuToolbar.enabled !== undefined) validateBoolean(viewer.menuToolbar.enabled, `${path}.menuToolbar.enabled`, errors);
      if (viewer.menuToolbar.position !== undefined) validateVector(viewer.menuToolbar.position, `${path}.menuToolbar.position`, errors, 2);
    }
  }
  if (viewer.clipping !== undefined) validateClipping(viewer.clipping, `${path}.clipping`, errors);
  if (viewer.tour !== undefined) {
    if (!isPlainObject(viewer.tour)) {
      pushError(errors, `${path}.tour`, "must be an object");
    } else {
      ["autostart", "autoplay", "loop"].forEach((key) => {
        if (viewer.tour[key] !== undefined) validateBoolean(viewer.tour[key], `${path}.tour.${key}`, errors);
      });
      if (viewer.tour.stepDuration !== undefined) {
        validateNumber(viewer.tour.stepDuration, `${path}.tour.stepDuration`, errors);
        if (Number.isFinite(viewer.tour.stepDuration) && viewer.tour.stepDuration <= 0) pushError(errors, `${path}.tour.stepDuration`, "must be > 0");
      }
      if (viewer.tour.transitionDuration !== undefined) {
        validateNumber(viewer.tour.transitionDuration, `${path}.tour.transitionDuration`, errors);
        if (Number.isFinite(viewer.tour.transitionDuration) && viewer.tour.transitionDuration < 0) pushError(errors, `${path}.tour.transitionDuration`, "must be >= 0");
      }
    }
  }
}

function validateModelTransform(modelTransform, path, errors) {
  if (!isPlainObject(modelTransform)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (modelTransform.position !== undefined) validateVector(modelTransform.position, `${path}.position`, errors, 3);
  if (modelTransform.scale !== undefined) validateVector(modelTransform.scale, `${path}.scale`, errors, 3);
  if (modelTransform.rotation !== undefined) {
    if (!isPlainObject(modelTransform.rotation)) {
      pushError(errors, `${path}.rotation`, "must be an object");
    } else {
      ["x", "y", "z"].forEach((key) => {
        if (modelTransform.rotation[key] !== undefined) validateNumber(modelTransform.rotation[key], `${path}.rotation.${key}`, errors);
      });
      if (modelTransform.rotation.order !== undefined) validateString(modelTransform.rotation.order, `${path}.rotation.order`, errors);
    }
  }
  if (modelTransform.upAxis !== undefined) validateEnum(modelTransform.upAxis, MODEL_UP_AXES, `${path}.upAxis`, errors);
  if (modelTransform.wireframe !== undefined) validateBoolean(modelTransform.wireframe, `${path}.wireframe`, errors);
  if (modelTransform.shadingMode !== undefined) {
    validateEnum(modelTransform.shadingMode, SHADING_MODES, `${path}.shadingMode`, errors);
  }
  if (modelTransform.customShader !== undefined) {
    if (!isPlainObject(modelTransform.customShader)) {
      pushError(errors, `${path}.customShader`, "must be an object");
    } else {
      if (modelTransform.customShader.vertexShader !== undefined) {
        validateString(modelTransform.customShader.vertexShader, `${path}.customShader.vertexShader`, errors);
      }
      if (modelTransform.customShader.fragmentShader !== undefined) {
        validateString(modelTransform.customShader.fragmentShader, `${path}.customShader.fragmentShader`, errors);
      }
    }
  }
}

// IIIF language map ({ "pl": ["..."] }) or a plain string.
function validateLanguageMap(value, path, errors) {
  if (isString(value)) return;
  if (!isPlainObject(value)) {
    pushError(errors, path, "must be a string or a language map");
    return;
  }
  Object.entries(value).forEach(([lang, texts]) => {
    if (!Array.isArray(texts) || !texts.every(isString)) {
      pushError(errors, `${path}.${lang}`, "must be an array of strings");
    }
  });
}

// AIM3DViewer.thumbnails (ui/thumbnail-gallery.js): URLs, or { src, label }.
function validateThumbnails(thumbnails, path, errors) {
  if (!Array.isArray(thumbnails)) {
    pushError(errors, path, "must be an array");
    return;
  }
  thumbnails.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (isString(entry)) {
      if (!entry.trim()) pushError(errors, entryPath, "must not be empty");
      return;
    }
    if (!isPlainObject(entry) || !isString(entry.src) || !entry.src.trim()) {
      pushError(errors, entryPath, "must be a URL or an object with a non-empty src");
      return;
    }
    if (entry.label !== undefined) validateLanguageMap(entry.label, `${entryPath}.label`, errors);
  });
}

// AIM3DViewer.timeline (timeline.js): the 4D stages of the model.
function validateTimeline(timeline, path, errors) {
  if (!isPlainObject(timeline)) {
    pushError(errors, path, "must be an object");
    return;
  }
  ["enabled", "showPanel"].forEach((key) => {
    if (timeline[key] !== undefined) validateBoolean(timeline[key], `${path}.${key}`, errors);
  });
  ["year", "startYear", "endYear"].forEach((key) => {
    if (timeline[key] !== undefined) validateNumber(timeline[key], `${path}.${key}`, errors);
  });
  if (isFiniteNumber$1(timeline.startYear) && isFiniteNumber$1(timeline.endYear) && timeline.startYear > timeline.endYear) {
    pushError(errors, `${path}.endYear`, "must not be before startYear");
  }
  if (timeline.label !== undefined) validateLanguageMap(timeline.label, `${path}.label`, errors);
  if (timeline.description !== undefined) validateLanguageMap(timeline.description, `${path}.description`, errors);
  if (timeline.transition !== undefined) validateEnum(timeline.transition, TIMELINE_TRANSITIONS, `${path}.transition`, errors);
  if (timeline.transitionDuration !== undefined && (!isFiniteNumber$1(timeline.transitionDuration) || timeline.transitionDuration < 0)) {
    pushError(errors, `${path}.transitionDuration`, "must be a number >= 0");
  }
  if (timeline.playback !== undefined) {
    const playback = timeline.playback;
    if (!isPlainObject(playback)) {
      pushError(errors, `${path}.playback`, "must be an object");
    } else {
      if (playback.autoplay !== undefined) validateBoolean(playback.autoplay, `${path}.playback.autoplay`, errors);
      if (playback.loop !== undefined) validateBoolean(playback.loop, `${path}.playback.loop`, errors);
      if (playback.yearsPerSecond !== undefined && (!isFiniteNumber$1(playback.yearsPerSecond) || playback.yearsPerSecond <= 0)) {
        pushError(errors, `${path}.playback.yearsPerSecond`, "must be a number > 0");
      }
      if (playback.speed !== undefined && (!isFiniteNumber$1(playback.speed) || playback.speed <= 0)) {
        pushError(errors, `${path}.playback.speed`, "must be a number > 0");
      }
      if (playback.pauseAtEvents !== undefined && (!isFiniteNumber$1(playback.pauseAtEvents) || playback.pauseAtEvents < 0)) {
        pushError(errors, `${path}.playback.pauseAtEvents`, "must be a number >= 0");
      }
    }
  }
  if (timeline.stages === undefined) return;
  if (!Array.isArray(timeline.stages)) {
    pushError(errors, `${path}.stages`, "must be an array");
    return;
  }
  timeline.stages.forEach((stage, index) => {
    const stagePath = `${path}.stages[${index}]`;
    if (!isPlainObject(stage)) {
      pushError(errors, stagePath, "must be an object");
      return;
    }
    validateNumber(stage.year, `${stagePath}.year`, errors);
    if (stage.type !== undefined) validateEnum(stage.type, TIMELINE_STAGE_TYPES, `${stagePath}.type`, errors);
    if (stage.approximate !== undefined) validateBoolean(stage.approximate, `${stagePath}.approximate`, errors);
    ["yearLabel", "label", "description", "source"].forEach((key) => {
      if (stage[key] !== undefined) validateLanguageMap(stage[key], `${stagePath}.${key}`, errors);
    });
    if (stage.nodes !== undefined && !(Array.isArray(stage.nodes) && stage.nodes.every(isString))) {
      pushError(errors, `${stagePath}.nodes`, "must be an array of node names");
    }
  });
}

// AIM3DViewer.variants (editor/compare.js): reconstruction variants.
function validateVariants(variants, path, errors) {
  if (!isPlainObject(variants)) {
    pushError(errors, path, "must be an object");
    return;
  }
  ["enabled", "showPanel"].forEach((key) => {
    if (variants[key] !== undefined) validateBoolean(variants[key], `${path}.${key}`, errors);
  });
  if (variants.label !== undefined) validateLanguageMap(variants.label, `${path}.label`, errors);
  if (variants.description !== undefined) validateLanguageMap(variants.description, `${path}.description`, errors);
  if (variants.active !== undefined) validateString(variants.active, `${path}.active`, errors);
  if (variants.items === undefined) return;
  if (!Array.isArray(variants.items)) {
    pushError(errors, `${path}.items`, "must be an array");
    return;
  }
  const ids = new Set();
  variants.items.forEach((item, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isPlainObject(item)) {
      pushError(errors, itemPath, "must be an object");
      return;
    }
    validateString(item.id, `${itemPath}.id`, errors);
    if (isString(item.id)) {
      if (ids.has(item.id)) pushError(errors, `${itemPath}.id`, "must be unique");
      ids.add(item.id);
    }
    ["label", "description", "source"].forEach((key) => {
      if (item[key] !== undefined) validateLanguageMap(item[key], `${itemPath}.${key}`, errors);
    });
    if (item.certainty !== undefined) validateNumber(item.certainty, `${itemPath}.certainty`, errors);
    if (item.nodes !== undefined && !(Array.isArray(item.nodes) && item.nodes.every(isString))) {
      pushError(errors, `${itemPath}.nodes`, "must be an array of node names");
    }
  });
  if (isString(variants.active) && ids.size && !ids.has(variants.active)) {
    pushError(errors, `${path}.active`, "must be the id of one of the items");
  }
}

// AIM3DViewer.compare (editor/compare.js): the comparison view.
function validateCompare(compare, path, errors) {
  if (!isPlainObject(compare)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (compare.enabled !== undefined) validateBoolean(compare.enabled, `${path}.enabled`, errors);
  if (compare.mode !== undefined) validateEnum(compare.mode, COMPARE_MODES, `${path}.mode`, errors);
  if (compare.kind !== undefined) validateEnum(compare.kind, COMPARE_KINDS, `${path}.kind`, errors);
  const look = compare.kind === "look";
  if (compare.position !== undefined && (!isFiniteNumber$1(compare.position) || compare.position < 0 || compare.position > 1)) {
    pushError(errors, `${path}.position`, "must be a number from 0 to 1");
  }
  ["left", "right"].forEach((key) => {
    const side = compare[key];
    if (side === undefined) return;
    const sidePath = `${path}.${key}`;
    if (!isPlainObject(side)) {
      pushError(errors, sidePath, look ? "must be an object with a shading mode or a lighting" : "must be an object with a variant or a year");
      return;
    }
    if (look) {
      if (side.shading === undefined && side.lighting === undefined) pushError(errors, sidePath, "must have a shading mode or a lighting");
      if (side.shading !== undefined) validateEnum(side.shading, SHADING_MODES, `${sidePath}.shading`, errors);
      if (side.lighting !== undefined) validateEnum(side.lighting, COMPARE_LIGHTINGS, `${sidePath}.lighting`, errors);
      return;
    }
    if (side.variant !== undefined) validateString(side.variant, `${sidePath}.variant`, errors);
    if (side.year !== undefined) validateNumber(side.year, `${sidePath}.year`, errors);
    if (side.variant === undefined && side.year === undefined) pushError(errors, sidePath, "must have a variant or a year");
  });
}

// AIM3DViewer.photos (editor/photo-overlay.js): historical photos and the
// views they were taken from.
function validatePhotos(photos, path, errors) {
  if (!Array.isArray(photos)) {
    pushError(errors, path, "must be an array");
    return;
  }
  const ids = new Set();
  photos.forEach((photo, index) => {
    const photoPath = `${path}[${index}]`;
    if (!isPlainObject(photo)) {
      pushError(errors, photoPath, "must be an object");
      return;
    }
    const service = typeof photo.service === "string" || isPlainObject(photo.service);
    if (!isString(photo.src) && !service) pushError(errors, photoPath, "must have a src or a IIIF Image API service");
    if (photo.src !== undefined) validateString(photo.src, `${photoPath}.src`, errors);
    if (photo.id !== undefined) {
      validateString(photo.id, `${photoPath}.id`, errors);
      if (ids.has(photo.id)) pushError(errors, `${photoPath}.id`, "must be unique");
      ids.add(photo.id);
    }
    ["label", "description", "source"].forEach((key) => {
      if (photo[key] !== undefined) validateLanguageMap(photo[key], `${photoPath}.${key}`, errors);
    });
    if (photo.year !== undefined) validateNumber(photo.year, `${photoPath}.year`, errors);
    if (photo.opacity !== undefined && (!isFiniteNumber$1(photo.opacity) || photo.opacity < 0 || photo.opacity > 1)) {
      pushError(errors, `${photoPath}.opacity`, "must be a number from 0 to 1");
    }
    if (photo.view === undefined) return;
    const view = photo.view;
    if (!isPlainObject(view)) {
      pushError(errors, `${photoPath}.view`, "must be an object");
      return;
    }
    ["position", "target"].forEach((key) => {
      const value = view[key];
      if (!(Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber$1))) {
        pushError(errors, `${photoPath}.view.${key}`, "must be an array of 3 numbers");
      }
    });
    if (view.fov !== undefined && (!isFiniteNumber$1(view.fov) || view.fov <= 0 || view.fov >= 180)) {
      pushError(errors, `${photoPath}.view.fov`, "must be a number between 0 and 180");
    }
    if (view.roll !== undefined) validateNumber(view.roll, `${photoPath}.view.roll`, errors);
  });
}

// AIM3DViewer.location (editor/sun-study.js): where the model stands.
function validateLocation(location, path, errors) {
  if (!isPlainObject(location)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (!isFiniteNumber$1(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    pushError(errors, `${path}.latitude`, "must be a number from -90 to 90");
  }
  if (!isFiniteNumber$1(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    pushError(errors, `${path}.longitude`, "must be a number from -180 to 180");
  }
  if (location.north !== undefined) validateNumber(location.north, `${path}.north`, errors);
  if (location.utcOffset !== undefined && (!isFiniteNumber$1(location.utcOffset) || location.utcOffset < -14 || location.utcOffset > 14)) {
    pushError(errors, `${path}.utcOffset`, "must be a number of hours from -14 to 14");
  }
}

// AIM3DViewer.sun (editor/sun-study.js): the sun on a day and hour.
function validateSun(sun, path, errors) {
  if (!isPlainObject(sun)) {
    pushError(errors, path, "must be an object");
    return;
  }
  ["enabled", "followTimeline", "animate"].forEach((key) => {
    if (sun[key] !== undefined) validateBoolean(sun[key], `${path}.${key}`, errors);
  });
  if (sun.date !== undefined && !(isString(sun.date) && /^(-?\d{1,4}-)?(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/.test(sun.date.trim()))) {
    pushError(errors, `${path}.date`, 'must be "MM-DD" or "YYYY-MM-DD"');
  }
  if (sun.time !== undefined && !(isString(sun.time) && /^([01]?\d|2[0-3]):[0-5]\d$|^24:00$/.test(sun.time.trim()))) {
    pushError(errors, `${path}.time`, 'must be "HH:MM"');
  }
}

// AIM3DViewer.weather (editor/weather.js): the weather around the model.
function validateWeather(weather, path, errors) {
  if (!isPlainObject(weather)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (!WEATHER_TYPES.includes(weather.type)) {
    pushError(errors, `${path}.type`, `must be one of ${WEATHER_TYPES.join(", ")}`);
  }
  ["intensity", "wind", "mistHeight", "mistDensity", "mistSpread"].forEach((key) => {
    if (weather[key] !== undefined && (!isFiniteNumber$1(weather[key]) || weather[key] < 0 || weather[key] > 1)) {
      pushError(errors, `${path}.${key}`, "must be a number from 0 to 1");
    }
  });
  if (weather.windDirection !== undefined) validateNumber(weather.windDirection, `${path}.windDirection`, errors);
  ["sky", "surfaces"].forEach((key) => {
    if (weather[key] !== undefined) validateBoolean(weather[key], `${path}.${key}`, errors);
  });
}

// AIM3DViewer.materials (editor/materials-editor.js): the materials edited,
// by their place in the model and name.
const MATERIAL_UNIT_PARAMS = ["roughness", "metalness", "opacity", "transmission", "clearcoat", "clearcoatRoughness", "sheen"];
function validateMaterials(materials, path, errors) {
  if (!Array.isArray(materials)) {
    pushError(errors, path, "must be an array");
    return;
  }
  materials.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      pushError(errors, itemPath, "must be an object");
      return;
    }
    if (entry.index !== undefined && !(Number.isInteger(entry.index) && entry.index >= 0)) {
      pushError(errors, `${itemPath}.index`, "must be a whole number from 0");
    }
    if (entry.index === undefined && !entry.name) pushError(errors, itemPath, "needs an index or a name");
    if (entry.name !== undefined) validateString(entry.name, `${itemPath}.name`, errors);
    if (entry.preset !== undefined && entry.preset !== null) validateEnum(entry.preset, MATERIAL_PRESET_KEYS, `${itemPath}.preset`, errors);
    if (entry.keepTexture !== undefined) validateBoolean(entry.keepTexture, `${itemPath}.keepTexture`, errors);
    const params = entry.params;
    if (params === undefined) return;
    if (!isPlainObject(params)) {
      pushError(errors, `${itemPath}.params`, "must be an object");
      return;
    }
    ["color", "emissive"].forEach((key) => {
      if (params[key] !== undefined && !(isString(params[key]) && /^#[0-9a-f]{6}$/i.test(params[key]))) {
        pushError(errors, `${itemPath}.params.${key}`, 'must be a colour "#rrggbb"');
      }
    });
    MATERIAL_UNIT_PARAMS.forEach((key) => {
      if (params[key] !== undefined && (!isFiniteNumber$1(params[key]) || params[key] < 0 || params[key] > 1)) {
        pushError(errors, `${itemPath}.params.${key}`, "must be a number from 0 to 1");
      }
    });
    ["thickness", "ior", "emissiveIntensity"].forEach((key) => {
      if (params[key] !== undefined && (!isFiniteNumber$1(params[key]) || params[key] < 0)) {
        pushError(errors, `${itemPath}.params.${key}`, "must be a number from 0");
      }
    });
    if (params.doubleSided !== undefined) validateBoolean(params.doubleSided, `${itemPath}.params.doubleSided`, errors);
  });
}

// AIM3DViewer.sceneSuggest (editor/scene-suggest.js): the Suggested scene
// window open on load, for a purpose.
function validateSceneSuggest(sceneSuggest, path, errors) {
  if (!isPlainObject(sceneSuggest)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (sceneSuggest.open !== undefined) validateBoolean(sceneSuggest.open, `${path}.open`, errors);
  if (sceneSuggest.purpose !== undefined) validateEnum(sceneSuggest.purpose, ["documentation", "presentation"], `${path}.purpose`, errors);
}

function validateAIM3DViewerBlock(block, path, errors) {
  if (!isPlainObject(block)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (block.version !== undefined) validateString(block.version, `${path}.version`, errors);
  if (block.generatedAt !== undefined) validateString(block.generatedAt, `${path}.generatedAt`, errors);
  if (block.camera !== undefined) validateCamera(block.camera, `${path}.camera`, errors);
  if (block.viewer !== undefined) validateViewer(block.viewer, `${path}.viewer`, errors);
  if (block.integration !== undefined) validateIntegration(block.integration, `${path}.integration`, errors);
  if (block.lights !== undefined) {
    if (!Array.isArray(block.lights)) {
      pushError(errors, `${path}.lights`, "must be an array");
    } else {
      block.lights.forEach((light, index) => validateLight(light, `${path}.lights[${index}]`, errors));
    }
  }
  if (block.modelTransform !== undefined) validateModelTransform(block.modelTransform, `${path}.modelTransform`, errors);
  if (block.clipping !== undefined) validateClipping(block.clipping, `${path}.clipping`, errors);
  if (block.rakingLight !== undefined) validateRakingLight(block.rakingLight, `${path}.rakingLight`, errors);
  if (block.timeline !== undefined) validateTimeline(block.timeline, `${path}.timeline`, errors);
  if (block.variants !== undefined) validateVariants(block.variants, `${path}.variants`, errors);
  if (block.compare !== undefined) validateCompare(block.compare, `${path}.compare`, errors);
  if (block.photos !== undefined) validatePhotos(block.photos, `${path}.photos`, errors);
  if (block.location !== undefined) validateLocation(block.location, `${path}.location`, errors);
  if (block.sun !== undefined) validateSun(block.sun, `${path}.sun`, errors);
  if (block.weather !== undefined) validateWeather(block.weather, `${path}.weather`, errors);
  if (block.sceneSuggest !== undefined) validateSceneSuggest(block.sceneSuggest, `${path}.sceneSuggest`, errors);
  if (block.materials !== undefined) validateMaterials(block.materials, `${path}.materials`, errors);
  if (block.thumbnails !== undefined) validateThumbnails(block.thumbnails, `${path}.thumbnails`, errors);
  if (block.certainty !== undefined) {
    certaintyScaleErrors(block.certainty, `${path}.certainty`).forEach(([errorPath, message]) => pushError(errors, errorPath, message));
  }
}

// Level of Certainty assessments on the annotations of every Scene and of
// the manifest itself, checked against the manifest's scale (or the default).
function validateCertaintyAssessments(manifest, errors) {
  const scale = normalizeCertaintyScale(manifest.AIM3DViewer?.certainty);
  const pages = [
    ...(Array.isArray(manifest.items) ? manifest.items : []).flatMap((item, itemIndex) => (
      Array.isArray(item?.annotations)
        ? item.annotations.map((page, pageIndex) => [page, `$.items[${itemIndex}].annotations[${pageIndex}]`])
        : []
    )),
    ...(Array.isArray(manifest.annotations)
      ? manifest.annotations.map((page, pageIndex) => [page, `$.annotations[${pageIndex}]`])
      : []),
  ];
  pages.forEach(([page, pagePath]) => {
    (Array.isArray(page?.items) ? page.items : []).forEach((annotation, index) => {
      const certainty = annotation?.AIM3DViewer?.certainty;
      if (certainty === undefined) return;
      certaintyAssessmentErrors(certainty, `${pagePath}.items[${index}].AIM3DViewer.certainty`, scale)
        .forEach(([errorPath, message]) => pushError(errors, errorPath, message));
    });
  });
}

function validateAIM3DManifest(manifest, options = {}) {
  const { requireCustomBlock = false } = options;
  const errors = [];

  if (!isPlainObject(manifest)) {
    pushError(errors, "$", "must be an object");
    return { valid: false, errors };
  }

  if (manifest.id !== undefined) validateString(manifest.id, "$.id", errors);
  if (manifest.type !== undefined) validateString(manifest.type, "$.type", errors);
  if (manifest.type !== undefined && manifest.type !== "Manifest") {
    pushError(errors, "$.type", 'must equal "Manifest"');
  }
  if (manifest.items !== undefined && !Array.isArray(manifest.items)) {
    pushError(errors, "$.items", "must be an array");
  }
  if (requireCustomBlock && !isPlainObject(manifest.AIM3DViewer)) {
    pushError(errors, "$.AIM3DViewer", "is required and must be an object");
  }
  if (manifest.AIM3DViewer !== undefined) {
    validateAIM3DViewerBlock(manifest.AIM3DViewer, "$.AIM3DViewer", errors);
  }
  validateCertaintyAssessments(manifest, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function formatAIM3DManifestValidationErrors(errors, maxErrors = 8) {
  if (!Array.isArray(errors) || errors.length === 0) return "";
  const visibleErrors = errors.slice(0, maxErrors).map((error) => `${error.path} ${error.message}`);
  const remainingCount = errors.length - visibleErrors.length;
  if (remainingCount > 0) {
    visibleErrors.push(`...and ${remainingCount} more error${remainingCount === 1 ? "" : "s"}`);
  }
  return visibleErrors.join("\n");
}

// What an AIM3D/IIIF manifest contains and whether each of its values is
// right: every attribute (every leaf of the JSON) is checked against a
// description of the known attributes below, and the result is grouped into
// features (model, annotations, timeline, photos...) - one icon each in the
// manifest lists. No three.js and no DOM here: this also runs in Node
// (scripts/inspect-manifest.mjs, the tests).
//
//   inspectAIM3DManifest(manifest) -> {
//     status: "ok" | "warning" | "error",
//     summary: { errors, warnings, infos, attributes, unknown },
//     features: [{ id, icon, label, present, count, status, errors, warnings }],
//     attributes: [{ path, value, level, feature, known, issues: [{ level, message }] }],
//   }
//
// Levels: "error" - the viewer cannot use the value (validateAIM3DManifest
// would reject the manifest, or IIIF requires otherwise); "warning" - it
// loads, but the value is probably wrong (a local URL, an empty text, a
// colour the browser does not know); "info" - worth knowing (an attribute
// the viewer does not know and ignores, a recommended one missing); "ok".
// validateAIM3DManifest stays the authority: its errors always win.


const INSPECTION_SCHEMA = "explora4d-manifest-inspection/1";

const LEVELS = ["ok", "info", "warning", "error"];
const MAX_TEXT = 200;

// Keep in sync with LIGHT_TYPES / CAMERA_TYPES in viewer/IIIF/presentation4.js
// and the light types annotations.js exports.
const LIGHT_TYPES = ["AmbientLight", "DirectionalLight", "PointLight", "SpotLight", "HemisphereLight"];
const CAMERA_TYPES = ["PerspectiveCamera", "OrthographicCamera"];
const TRANSFORM_TYPES = ["RotateTransform", "ScaleTransform", "TranslateTransform"];
const MOTIVATIONS = [
  "painting", "supplementing", "commenting", "describing", "tagging", "linking", "highlighting",
  "identifying", "assessing", "bookmarking", "classifying", "editing", "moderating", "questioning",
  "replying", "contentState", "activating", "transforming",
];
const ROTATION_ORDERS = ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"];

// ---- the features (icons) ------------------------------------------------------

const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
const typeOf = (value) => (isObject(value) ? value.type || value["@type"] || null : null);
const block = (manifest) => (isObject(manifest.AIM3DViewer) ? manifest.AIM3DViewer : {});
const has = (value) => (value !== undefined ? 1 : 0);
const length = (value) => (Array.isArray(value) ? value.length : 0);

function annotationsOf(manifest, pages) {
  return asArray(manifest.items).flatMap((scene) => asArray(scene?.[pages]))
    .concat(pages === "annotations" ? asArray(manifest.annotations) : [])
    .flatMap((page) => asArray(page?.items))
    .filter(isObject);
}

function paintedBodies(manifest) {
  return annotationsOf(manifest, "items").flatMap((annotation) => asArray(annotation.body))
    .map((body) => (typeOf(body) === "SpecificResource" && isObject(body.source) ? body.source : body))
    .filter(isObject);
}

function bodyFeature(body) {
  const resource = typeOf(body) === "SpecificResource" && isObject(body?.source) ? body.source : body;
  const type = typeOf(resource);
  if (CAMERA_TYPES.includes(type)) return "camera";
  if (LIGHT_TYPES.includes(type)) return "lights";
  return "model";
}

// The order is the order of the icons. `count` says whether the manifest has
// the feature (0 = not set) and how much of it.
const MANIFEST_FEATURES = [
  { id: "model", label: "3D model", count: (m) => paintedBodies(m).filter((body) => bodyFeature(body) === "model").length },
  {
    id: "metadata",
    label: "Descriptive metadata",
    count: (m) => ["label", "summary", "metadata", "provider", "homepage", "navDate"].filter((key) => m[key] !== undefined).length,
  },
  { id: "rights", label: "Rights and attribution", count: (m) => has(m.rights) + has(m.requiredStatement) },
  { id: "annotations", label: "Annotations", count: (m) => annotationsOf(m, "annotations").length },
  {
    id: "camera",
    label: "Camera view",
    count: (m) => has(block(m).camera) + paintedBodies(m).filter((body) => bodyFeature(body) === "camera").length,
  },
  {
    id: "lights",
    label: "Lights",
    count: (m) => length(block(m).lights) + paintedBodies(m).filter((body) => bodyFeature(body) === "lights").length,
  },
  { id: "raking-light", label: "Raking light", count: (m) => has(block(m).rakingLight) },
  { id: "clipping", label: "Section planes", count: (m) => has(block(m).clipping) + has(block(m).viewer?.clipping) },
  { id: "timeline", label: "4D timeline", count: (m) => (block(m).timeline ? Math.max(length(block(m).timeline.stages), 1) : 0) },
  { id: "variants", label: "Reconstruction variants", count: (m) => length(block(m).variants?.items) || has(block(m).variants) },
  { id: "compare", label: "Comparison view", count: (m) => has(block(m).compare) },
  { id: "photos", label: "Historical photos", count: (m) => length(block(m).photos) },
  { id: "location", label: "Geographic location", count: (m) => has(block(m).location) },
  { id: "sun", label: "Sun study", count: (m) => has(block(m).sun) },
  { id: "weather", label: "Weather", count: (m) => has(block(m).weather) },
  { id: "scene-suggest", label: "Suggested scene", count: (m) => has(block(m).sceneSuggest) },
  { id: "materials", label: "Materials", count: (m) => length(block(m).materials) },
  {
    id: "certainty",
    label: "Level of certainty",
    count: (m) => has(block(m).certainty)
      + annotationsOf(m, "annotations").filter((annotation) => annotation.AIM3DViewer?.certainty !== undefined).length,
  },
  { id: "thumbnails", label: "Thumbnails", count: (m) => length(block(m).thumbnails) },
  { id: "transform", label: "Model transform and shading", count: (m) => has(block(m).modelTransform) },
  {
    id: "rendering",
    label: "Rendering and environment",
    count: (m) => has(block(m).viewer?.rendering) + has(block(m).viewer?.environmentMap) + has(block(m).viewer?.backgroundColor),
  },
  { id: "tour", label: "Guided tour", count: (m) => has(block(m).viewer?.tour) },
  { id: "settings", label: "Viewer settings", count: (m) => has(block(m).viewer) + has(block(m).integration) },
  { id: "manifest", label: "IIIF structure", count: () => 1 },
];

// ---- value checks ------------------------------------------------------------
// A check returns null (fine) or [level, message].

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

function text(value) {
  if (typeof value !== "string") return ["error", "must be a string"];
  if (!value.trim()) return ["warning", "is empty"];
  return null;
}

const anyString = (value) => (typeof value === "string" ? null : ["error", "must be a string"]);
const bool = (value) => (typeof value === "boolean" ? null : ["error", "must be a boolean"]);

function number({ min, max, above, below, integer, level = "error" } = {}) {
  return (value) => {
    if (!isFiniteNumber(value)) return ["error", "must be a finite number"];
    if (integer && !Number.isInteger(value)) return [level, "must be a whole number"];
    if (min !== undefined && value < min) return [level, max !== undefined ? `must be from ${min} to ${max}` : `must be >= ${min}`];
    if (max !== undefined && value > max) return [level, min !== undefined ? `must be from ${min} to ${max}` : `must be <= ${max}`];
    if (above !== undefined && value <= above) return [level, below !== undefined ? `must be between ${above} and ${below}` : `must be > ${above}`];
    if (below !== undefined && value >= below) return [level, above !== undefined ? `must be between ${above} and ${below}` : `must be < ${below}`];
    return null;
  };
}

const num = number();

function oneOf(values, level = "error") {
  return (value) => (values.includes(value) ? null : [level, `must be one of: ${values.join(", ")}`]);
}

const LOCAL_HOST = /^(localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[::1\])$/i;

// An absolute URI (http(s), urn, data, mailto...) or a path relative to the
// manifest. Addresses of this computer work for nobody else.
function url(value, fetched = false) {
  const problem = text(value);
  if (problem) return problem;
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return ["warning", "contains spaces - must be URL-encoded"];
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Relative: resolved against the manifest's own URL.
    return null;
  }
  if (/^https?:$/.test(parsed.protocol) && LOCAL_HOST.test(parsed.hostname)) {
    return ["warning", `points at ${parsed.hostname} - works only on the computer that made it`];
  }
  // Identifiers may be http; files the viewer downloads are blocked on https pages.
  if (fetched && parsed.protocol === "http:") return ["info", "uses http - browsers block it on https pages (mixed content)"];
  return null;
}

// Colours the viewer passes to three.js / CSS: #rgb, #rrggbb, rgb(), hsl()
// or a colour name.
function color(value) {
  if (typeof value !== "string") return ["error", "must be a colour string"];
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return null;
  if (/^#([0-9a-f]{4}|[0-9a-f]{8})$/i.test(trimmed)) return ["info", "has an alpha channel, which the viewer ignores"];
  if (/^(rgb|hsl)a?\([^)]*\)$/i.test(trimmed) || /^[a-z]+$/i.test(trimmed)) return null;
  return ["warning", "is not a colour (#rrggbb expected)"];
}

function isoDate(value) {
  if (typeof value !== "string") return ["error", "must be a date string"];
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value.trim()) || Number.isNaN(Date.parse(value))) {
    return ["warning", "is not an ISO 8601 date (YYYY-MM-DDThh:mm:ssZ)"];
  }
  return null;
}

function mediaType(value) {
  if (typeof value !== "string") return ["error", "must be a string"];
  return /^[a-z]+\/[a-z0-9.+-]+$/i.test(value.trim()) ? null : ["warning", "is not a media type (e.g. model/gltf-binary)"];
}

// IIIF rights: a Creative Commons licence or a RightsStatements.org statement.
function rights(value) {
  if (typeof value === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(value.trim())) {
    return ["warning", "must be a licence URI, e.g. https://creativecommons.org/licenses/by/4.0/"];
  }
  const problem = url(value);
  if (problem) return problem;
  if (!/^https?:\/\/(creativecommons\.org\/(licenses|publicdomain)\/|rightsstatements\.org\/vocab\/)/.test(value.trim())) {
    return ["info", "is not a Creative Commons or RightsStatements.org URI, which IIIF expects"];
  }
  return null;
}

const languageKey = (key) => (
  key === "none" || /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(key) ? null : ["warning", `"${key}" is not a language code (BCP 47, e.g. "en", "pl")`]
);

const sunDate = (value) => (
  typeof value === "string" && /^(-?\d{1,4}-)?(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/.test(value.trim())
    ? null : ["error", 'must be "MM-DD" or "YYYY-MM-DD"']
);
const sunTime = (value) => (
  typeof value === "string" && /^([01]?\d|2[0-3]):[0-5]\d$|^24:00$/.test(value.trim()) ? null : ["error", 'must be "HH:MM"']
);

// ---- the known attributes ------------------------------------------------------
// leaf(check) a value; obj({...}) an object with these keys (others: "info,
// unknown"), arr(item) an array, map(value) an object with free keys (language
// maps), alt({ string, number, boolean, array, object }) by the value's type,
// ANY a free-form value the viewer passes on as it is. A function is a lazy
// spec (for recursion).

const leaf = (check) => ({ kind: "leaf", check });
const obj = (props, options = {}) => ({ kind: "object", props, ...options });
const arr = (items, options = {}) => ({ kind: "array", items, ...options });
const map = (value, options = {}) => ({ kind: "map", value, ...options });
const alt = (byType, options = {}) => ({ kind: "alt", byType, ...options });
const ANY = { kind: "any" };
const tag = (feature, spec) => ({ ...spec, feature });

const TEXT = leaf(text);
const STRING = leaf(anyString);
const BOOL = leaf(bool);
const NUM = leaf(num);
const URL_ = leaf(url);
// A file the viewer downloads (model, photo, thumbnail, metadata).
const FILE_URL = leaf((value) => url(value, true));
const COLOR = leaf(color);
const DATE = leaf(isoDate);
const LANG = alt({ string: TEXT, object: map(alt({ array: arr(TEXT), string: TEXT }), { key: languageKey }) }, { name: "a string or a language map" });
const NODE_NAMES = arr(TEXT);

const vector = (size) => alt({
  array: arr(NUM, { minLength: size }),
  object: obj(Object.fromEntries(["x", "y", "z"].slice(0, size).map((axis) => [axis, NUM])), { expect: [["x", "error"], ["y", "error"], ...(size === 3 ? [["z", "error"]] : [])] }),
}, { name: `a ${size}D vector array or object` });
const VEC2 = vector(2);
const VEC3 = vector(3);
const TRIPLE = arr(NUM, { exactLength: 3 });

const PANEL = obj({ position: VEC2, size: obj({ width: alt({ number: NUM, null: leaf(() => null) }), height: alt({ number: NUM, null: leaf(() => null) }) }) });
const CLIPPING = tag("clipping", obj({
  mode: obj({ x: BOOL, y: BOOL, z: BOOL }),
  // Planes flipped to keep the other side (editor/clipping.js).
  negated: obj({ x: BOOL, y: BOOL, z: BOOL }),
  constants: VEC3,
  outlineVisible: BOOL,
  outline: BOOL,
}));

const VIEWER = obj({
  container: TEXT,
  mailUrl: TEXT,
  mainUrl: FILE_URL,
  baseModulePath: STRING,
  background: STRING,
  credits: ANY,
  auth: obj({ enabled: BOOL, allowRegistration: BOOL }),
  manifestoForm: PANEL,
  metadataContainer: PANEL,
  baseNamespace: URL_,
  metadataUrl: FILE_URL,
  theme: leaf(oneOf(["light", "dark"])),
  language: leaf(oneOf(["en", "pl", "de"])),
  backgroundColor: tag("rendering", COLOR),
  environmentMap: tag("rendering", obj({ intensity: leaf(number({ min: 0 })), preset: TEXT, enabled: BOOL })),
  rendering: tag("rendering", obj({
    toneMapping: leaf(oneOf(RENDERING_TONE_MAPPINGS)),
    exposure: leaf(number({ min: 0 })),
    postprocessing: obj({
      enabled: BOOL,
      antialias: leaf(oneOf(RENDERING_ANTIALIAS_MODES)),
      ao: BOOL,
      aoIntensity: leaf(number({ min: 0, max: 2 })),
    }),
  })),
  ...Object.fromEntries([
    "presentationMode", "sandbox", "lightweight", "editor", "forceLocalPreview", "autorotate",
    "disableInteraction", "hideUi", "hideMetadata", "showNotifications",
  ].map((key) => [key, BOOL])),
  autorotateSpeed: NUM,
  scale: VEC2,
  window: obj({ position: VEC2, size: obj({ width: NUM, height: NUM }) }),
  performance: leaf((value) => anyString(value) || oneOf(["high-performance", "low-power", "default"], "warning")(value)),
  units: alt({ number: NUM, string: TEXT }),
  gallery: ANY,
  editorToolbar: obj({ enabled: BOOL, position: VEC2, expanded: BOOL, visible: BOOL }),
  menuToolbar: obj({ enabled: BOOL, position: VEC2 }),
  clipping: CLIPPING,
  tour: tag("tour", obj({
    autostart: BOOL,
    autoplay: BOOL,
    loop: BOOL,
    stepDuration: leaf(number({ above: 0 })),
    transitionDuration: leaf(number({ min: 0 })),
  })),
});

const CERTAINTY_LEVEL = obj({ value: NUM, code: TEXT, symbol: STRING, color: COLOR, label: LANG, description: LANG }, {
  expect: [["value", "error"], ["code", "error"], ["color", "error"]],
});

const AIM3D_BLOCK = obj({
  version: TEXT,
  generatedAt: DATE,
  camera: tag("camera", obj({
    position: VEC3,
    target: VEC3,
    up: VEC3,
    fov: leaf(number({ above: 0, below: 180, level: "warning" })),
    zoom: leaf(number({ above: 0, level: "warning" })),
    distance: leaf(number({ min: 0, level: "warning" })),
    perspectiveMode: leaf(oneOf(["perspective", "orthographic"])),
  })),
  viewer: tag("settings", VIEWER),
  integration: tag("settings", obj({
    type: TEXT,
    exportViewerUrl: URL_,
    api: obj({ thumbnailUploadEndpoint: STRING }),
  }, { open: true })),
  lights: tag("lights", arr(obj({
    type: leaf(oneOf(LIGHT_TYPES, "warning")),
    position: VEC3,
    target: VEC3,
    color: COLOR,
    groundColor: COLOR,
    intensity: leaf(number({ min: 0, level: "warning" })),
    distance: leaf(number({ min: 0, level: "warning" })),
    decay: leaf(number({ min: 0, level: "warning" })),
    angle: leaf(number({ above: 0, max: Math.PI / 2, level: "warning" })),
    penumbra: leaf(number({ min: 0, max: 1, level: "warning" })),
    visible: BOOL,
  }))),
  certainty: tag("certainty", obj({
    label: LANG,
    min: NUM,
    max: NUM,
    unassessedColor: COLOR,
    visible: BOOL,
    opacity: leaf(number({ min: 0, max: 1 })),
    levels: arr(CERTAINTY_LEVEL, { minLength: 1 }),
  })),
  rakingLight: tag("raking-light", obj({
    enabled: BOOL,
    sweep: BOOL,
    direction: leaf(number({ min: 0, max: 360 })),
    height: leaf(number({ min: 1, max: 89 })),
  })),
  timeline: tag("timeline", obj({
    enabled: BOOL,
    showPanel: BOOL,
    year: NUM,
    startYear: NUM,
    endYear: NUM,
    label: LANG,
    description: LANG,
    transition: leaf(oneOf(TIMELINE_TRANSITIONS)),
    transitionDuration: leaf(number({ min: 0 })),
    playback: obj({
      autoplay: BOOL,
      loop: BOOL,
      yearsPerSecond: leaf(number({ above: 0 })),
      speed: leaf(number({ above: 0 })),
      pauseAtEvents: leaf(number({ min: 0 })),
    }),
    stages: arr(obj({
      year: NUM,
      type: leaf(oneOf(TIMELINE_STAGE_TYPES)),
      approximate: BOOL,
      yearLabel: LANG,
      label: LANG,
      description: LANG,
      source: LANG,
      nodes: NODE_NAMES,
    }, { expect: [["year", "error"], ["label", "info"]] })),
  })),
  variants: tag("variants", obj({
    enabled: BOOL,
    showPanel: BOOL,
    label: LANG,
    description: LANG,
    active: TEXT,
    items: arr(obj({
      id: TEXT,
      label: LANG,
      description: LANG,
      source: LANG,
      certainty: NUM,
      nodes: NODE_NAMES,
    }, { expect: [["id", "error"], ["label", "info"]] })),
  })),
  compare: tag("compare", obj({
    enabled: BOOL,
    mode: leaf(oneOf(COMPARE_MODES)),
    kind: leaf(oneOf(COMPARE_KINDS)),
    position: leaf(number({ min: 0, max: 1 })),
    left: obj({ variant: TEXT, year: NUM, shading: leaf(oneOf(SHADING_MODES)), lighting: leaf(oneOf(COMPARE_LIGHTINGS)) }),
    right: obj({ variant: TEXT, year: NUM, shading: leaf(oneOf(SHADING_MODES)), lighting: leaf(oneOf(COMPARE_LIGHTINGS)) }),
  })),
  photos: tag("photos", arr(obj({
    id: TEXT,
    src: FILE_URL,
    service: alt({ string: FILE_URL, object: ANY }),
    label: LANG,
    description: LANG,
    source: LANG,
    year: leaf(number({ integer: true, level: "warning" })),
    opacity: leaf(number({ min: 0, max: 1 })),
    view: obj({
      position: TRIPLE,
      target: TRIPLE,
      fov: leaf(number({ above: 0, below: 180 })),
      roll: NUM,
    }, { expect: [["position", "error"], ["target", "error"]] }),
  }, { expect: [["label", "info"], ["source", "info"]] }))),
  location: tag("location", obj({
    latitude: leaf(number({ min: -90, max: 90 })),
    longitude: leaf(number({ min: -180, max: 180 })),
    north: leaf(number({ min: -360, max: 360, level: "warning" })),
    utcOffset: leaf(number({ min: -14, max: 14 })),
  }, { expect: [["latitude", "error"], ["longitude", "error"]] })),
  sun: tag("sun", obj({ enabled: BOOL, followTimeline: BOOL, animate: BOOL, date: leaf(sunDate), time: leaf(sunTime) })),
  weather: tag("weather", obj({
    type: leaf(oneOf(WEATHER_TYPES)),
    intensity: leaf(number({ min: 0, max: 1 })),
    wind: leaf(number({ min: 0, max: 1 })),
    windDirection: leaf(number({ min: -360, max: 360, level: "warning" })),
    mistHeight: leaf(number({ min: 0, max: 1 })),
    mistDensity: leaf(number({ min: 0, max: 1 })),
    mistSpread: leaf(number({ min: 0, max: 1 })),
    sky: BOOL,
    surfaces: BOOL,
  }, { expect: [["type", "error"]] })),
  sceneSuggest: tag("scene-suggest", obj({ open: BOOL, purpose: leaf(oneOf(["documentation", "presentation"])) })),
  materials: tag("materials", arr(obj({
    index: leaf(number({ min: 0, integer: true })),
    name: STRING,
    preset: alt({ string: leaf(oneOf(MATERIAL_PRESET_KEYS)), null: leaf(() => null) }),
    keepTexture: BOOL,
    params: obj({
      color: COLOR,
      emissive: COLOR,
      roughness: leaf(number({ min: 0, max: 1 })),
      metalness: leaf(number({ min: 0, max: 1 })),
      opacity: leaf(number({ min: 0, max: 1 })),
      transmission: leaf(number({ min: 0, max: 1 })),
      thickness: leaf(number({ min: 0 })),
      ior: leaf(number({ min: 0 })),
      clearcoat: leaf(number({ min: 0, max: 1 })),
      clearcoatRoughness: leaf(number({ min: 0, max: 1 })),
      sheen: leaf(number({ min: 0, max: 1 })),
      emissiveIntensity: leaf(number({ min: 0 })),
      doubleSided: BOOL,
    }),
  }))),
  thumbnails: tag("thumbnails", arr(alt({ string: FILE_URL, object: obj({ src: FILE_URL, label: LANG }, { expect: [["src", "error"]] }) }))),
  modelTransform: tag("transform", obj({
    position: VEC3,
    rotation: obj({ x: NUM, y: NUM, z: NUM, order: leaf(oneOf(ROTATION_ORDERS, "warning")) }),
    scale: VEC3,
    wireframe: BOOL,
    shadingMode: leaf(oneOf(SHADING_MODES)),
    customShader: obj({ vertexShader: TEXT, fragmentShader: TEXT }),
  })),
  clipping: CLIPPING,
});

// IIIF Presentation 3/4. Linking and descriptive properties every resource
// may have.
const DESCRIPTIVE = {
  label: LANG,
  summary: LANG,
  metadata: arr(obj({ label: LANG, value: LANG }, { expect: [["label", "error"], ["value", "error"]] })),
  requiredStatement: tag("rights", obj({ label: LANG, value: LANG }, { expect: [["label", "error"], ["value", "error"]] })),
  rights: tag("rights", leaf(rights)),
  provider: ANY,
  homepage: ANY,
  thumbnail: ANY,
  logo: ANY,
  seeAlso: ANY,
  service: ANY,
  services: ANY,
  partOf: ANY,
  rendering: ANY,
  start: ANY,
  navDate: DATE,
  navPlace: ANY,
  behavior: arr(TEXT),
  viewingDirection: leaf(oneOf(["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"])),
  created: DATE,
  modified: DATE,
};

const QUANTITY = obj({ type: leaf(oneOf(["Quantity"], "warning")), quantityValue: NUM, unit: TEXT }, { expect: [["quantityValue", "error"]] });
const POINT = obj({ type: TEXT, x: NUM, y: NUM, z: NUM, id: URL_ });
const TRANSFORM = obj({ type: leaf(oneOf(TRANSFORM_TYPES)), x: NUM, y: NUM, z: NUM }, { expect: [["type", "error"]] });
const SELECTOR = obj({ type: TEXT, x: NUM, y: NUM, z: NUM, value: STRING }, { open: true });

// Bodies: a model, a light, a camera, a SpecificResource around one of them,
// a TextualBody of a comment, or a Choice / List of bodies.
const BODY = () => obj({
  id: FILE_URL,
  type: TEXT,
  format: leaf(mediaType),
  language: alt({ string: TEXT, array: arr(TEXT) }),
  value: STRING,
  label: LANG,
  source: alt({ string: URL_, object: BODY }),
  selector: alt({ object: SELECTOR, array: arr(SELECTOR) }),
  transform: arr(TRANSFORM),
  items: arr(BODY),
  color: COLOR,
  intensity: alt({ number: leaf(number({ min: 0, level: "warning" })), object: QUANTITY }),
  angle: leaf(number({ above: 0, max: 90, level: "warning" })),
  fieldOfView: leaf(number({ above: 0, below: 180, level: "warning" })),
  near: leaf(number({ min: 0, level: "warning" })),
  far: leaf(number({ above: 0, level: "warning" })),
  lookAt: alt({ string: URL_, object: POINT }),
  purpose: TEXT,
  ...DESCRIPTIVE,
});

const TARGET = obj({
  id: URL_,
  type: TEXT,
  source: alt({ string: URL_, object: obj({ id: URL_, type: TEXT }) }),
  selector: alt({ object: SELECTOR, array: arr(SELECTOR) }),
});

// annotation.AIM3DViewer: where an annotation sits on the model.
const ANNOTATION_AIM3D = obj({
  certainty: tag("certainty", obj({ value: NUM, code: TEXT, scope: leaf(oneOf(CERTAINTY_SCOPES)), targetId: STRING })),
  faceIndex: leaf(number({ min: 0, integer: true })),
  faceNumbers: arr(leaf(number({ min: 0, integer: true }))),
  groupId: STRING,
  key: alt({ string: STRING, number: NUM }),
  object: STRING,
  point: TRIPLE,
  targetId: STRING,
  view: obj({ position: TRIPLE, target: TRIPLE, fov: leaf(number({ above: 0, below: 180 })) }),
});

const MOTIVATION = leaf((value) => anyString(value) || oneOf(MOTIVATIONS, "info")(value));

const annotation = (feature) => obj({
  id: URL_,
  type: leaf(oneOf(["Annotation"])),
  motivation: alt({ string: MOTIVATION, array: arr(MOTIVATION) }),
  body: alt({ string: URL_, object: BODY, array: arr(BODY) }),
  bodyValue: STRING,
  target: alt({ string: URL_, object: TARGET, array: arr(TARGET) }),
  scope: ANY,
  stylesheet: ANY,
  timeMode: ANY,
  AIM3DViewer: ANNOTATION_AIM3D,
  ...DESCRIPTIVE,
}, {
  feature,
  expect: [["id", "warning"], ["type", "warning"], ["target", "error"], ["motivation", "info"]],
});

// Painting annotations are the model, its lights and cameras; the others
// are the annotations of the "annotations" feature.
const PAINTING = annotation((value) => bodyFeature(asArray(value?.body)[0]));
const COMMENT = annotation("annotations");

const page = (item) => obj({
  id: URL_,
  type: leaf(oneOf(["AnnotationPage"])),
  items: arr(item),
  ...DESCRIPTIVE,
}, { expect: [["id", "warning"], ["type", "warning"]] });

const SCENE = obj({
  id: URL_,
  type: leaf(oneOf(["Scene", "Canvas"])),
  backgroundColor: tag("rendering", COLOR),
  spatialScale: QUANTITY,
  height: leaf(number({ above: 0 })),
  width: leaf(number({ above: 0 })),
  duration: leaf(number({ above: 0 })),
  items: arr(page(PAINTING)),
  annotations: arr(page(COMMENT)),
  placeholderContainer: ANY,
  accompanyingContainer: ANY,
  ...DESCRIPTIVE,
}, { expect: [["id", "warning"], ["type", "warning"], ["items", "warning"]] });

const MANIFEST = obj({
  "@context": alt({ string: URL_, array: arr(alt({ string: URL_, object: ANY })) }),
  id: URL_,
  type: leaf(oneOf(["Manifest"])),
  items: arr(SCENE),
  structures: ANY,
  annotations: arr(page(COMMENT)),
  AIM3DViewer: AIM3D_BLOCK,
  ...Object.fromEntries(Object.entries(DESCRIPTIVE).map(([key, spec]) => [key, spec.feature ? spec : tag("metadata", spec)])),
}, {
  feature: "manifest",
  expect: [["id", "warning"], ["type", "warning"], ["label", "warning"], ["items", "info"], ["summary", "info"], ["rights", "info"]],
});

// ---- the walk ----------------------------------------------------------------

function kindOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function shown(value) {
  if (typeof value === "string") return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (isObject(value)) return `{${Object.keys(value).length}}`;
  return value;
}

class Collector {
  constructor() {
    this.entries = new Map();
  }

  entry(path, value, feature, known = true) {
    let entry = this.entries.get(path);
    if (!entry) {
      entry = { path, value: shown(value), level: "ok", feature, known, issues: [] };
      this.entries.set(path, entry);
    }
    return entry;
  }

  issue(path, level, message, value, feature) {
    const entry = this.entry(path, value, feature);
    if (entry.issues.some((issue) => issue.message === message)) return;
    entry.issues.push({ level, message });
    if (LEVELS.indexOf(level) > LEVELS.indexOf(entry.level)) entry.level = level;
  }
}

function walk(value, spec, path, feature, out) {
  if (typeof spec === "function") spec = spec();
  if (spec.feature) feature = typeof spec.feature === "function" ? spec.feature(value) : spec.feature;

  switch (spec.kind) {
    case "any":
      out.entry(path, value, feature);
      return;
    case "leaf": {
      out.entry(path, value, feature);
      const problem = spec.check(value);
      if (problem) out.issue(path, problem[0], problem[1], value, feature);
      return;
    }
    case "alt": {
      const next = spec.byType[kindOf(value)];
      if (!next) {
        const expected = spec.name || Object.keys(spec.byType).join(" or ");
        out.issue(path, "error", `must be ${expected}`, value, feature);
        return;
      }
      walk(value, next, path, feature, out);
      return;
    }
    case "array": {
      if (!Array.isArray(value)) {
        out.issue(path, "error", "must be an array", value, feature);
        return;
      }
      if (value.length === 0) out.entry(path, value, feature);
      if (spec.minLength !== undefined && value.length < spec.minLength) {
        out.issue(path, "error", `must contain at least ${spec.minLength} item${spec.minLength === 1 ? "" : "s"}`, value, feature);
      }
      if (spec.exactLength !== undefined && value.length !== spec.exactLength) {
        out.issue(path, "error", `must contain exactly ${spec.exactLength} items`, value, feature);
      }
      value.forEach((item, index) => walk(item, spec.items, `${path}[${index}]`, feature, out));
      return;
    }
    case "map": {
      if (!isObject(value)) {
        out.issue(path, "error", "must be an object", value, feature);
        return;
      }
      if (Object.keys(value).length === 0) out.issue(path, "warning", "is empty", value, feature);
      Object.entries(value).forEach(([key, item]) => {
        const problem = spec.key?.(key);
        if (problem) out.issue(`${path}.${key}`, problem[0], problem[1], item, feature);
        walk(item, spec.value, `${path}.${key}`, feature, out);
      });
      return;
    }
    case "object": {
      if (!isObject(value)) {
        out.issue(path, "error", "must be an object", value, feature);
        return;
      }
      if (Object.keys(value).length === 0) out.entry(path, value, feature);
      (spec.expect || []).forEach(([key, level]) => {
        if (value[key] === undefined) {
          out.issue(`${path}.${key}`, level, level === "info" ? "is not set (recommended)" : "is missing", undefined, feature);
        }
      });
      Object.entries(value).forEach(([key, item]) => {
        const childPath = `${path}.${key}`;
        const child = spec.props[key];
        if (child) {
          walk(item, child, childPath, feature, out);
        } else if (spec.open) {
          out.entry(childPath, item, feature);
        } else {
          out.entry(childPath, item, feature, false);
          out.issue(childPath, "info", "is not a known attribute - the viewer ignores it", item, feature);
        }
      });
      return;
    }
    default:
      throw new Error(`Unknown spec kind: ${spec.kind}`);
  }
}

// ---- checks across attributes --------------------------------------------------

function crossChecks(manifest, out) {
  const aim = block(manifest);

  // IIIF resources need their own ids; the viewer looks scenes up by id.
  const ids = new Map();
  const remember = (resource, path) => {
    if (!isObject(resource) || typeof resource.id !== "string") return;
    if (ids.has(resource.id)) {
      out.issue(`${path}.id`, "warning", `is the same id as ${ids.get(resource.id)}`, resource.id);
    } else {
      ids.set(resource.id, path);
    }
  };
  const sceneIds = new Set();
  remember(manifest, "$");
  asArray(manifest.items).forEach((scene, sceneIndex) => {
    const scenePath = `$.items[${sceneIndex}]`;
    remember(scene, scenePath);
    if (typeof scene?.id === "string") sceneIds.add(scene.id);
    ["items", "annotations"].forEach((pages) => {
      asArray(scene?.[pages]).forEach((annotationPage, pageIndex) => {
        const pagePath = `${scenePath}.${pages}[${pageIndex}]`;
        remember(annotationPage, pagePath);
        asArray(annotationPage?.items).forEach((item, index) => remember(item, `${pagePath}.items[${index}]`));
      });
    });
  });

  // Annotation targets must be one of the manifest's scenes.
  if (sceneIds.size) {
    asArray(manifest.items).forEach((scene, sceneIndex) => {
      ["items", "annotations"].forEach((pages) => {
        asArray(scene?.[pages]).forEach((annotationPage, pageIndex) => {
          asArray(annotationPage?.items).forEach((item, index) => {
            asArray(item?.target).forEach((target, targetIndex) => {
              const source = typeof target === "string" ? target : typeof target?.source === "string" ? target.source : target?.source?.id ?? target?.id;
              if (typeof source !== "string") return;
              const scene = source.split("#")[0];
              if (sceneIds.has(scene)) return;
              const targets = Array.isArray(item.target) ? `.target[${targetIndex}]` : ".target";
              out.issue(
                `$.items[${sceneIndex}].${pages}[${pageIndex}].items[${index}]${targets}`,
                "warning",
                `points at "${shown(scene)}", which is not a scene of this manifest`,
                target,
              );
            });
          });
        });
      });
    });
  }

  // The comparison view shows variants by id.
  const variantIds = new Set(asArray(aim.variants?.items).map((item) => item?.id).filter((id) => typeof id === "string"));
  ["left", "right"].forEach((side) => {
    const variant = aim.compare?.[side]?.variant;
    if (typeof variant === "string" && !variantIds.has(variant)) {
      out.issue(`$.AIM3DViewer.compare.${side}.variant`, "warning", "is not the id of one of AIM3DViewer.variants.items", variant, "compare");
    }
  });

  // Vectors that make the view or the model degenerate.
  const zero = (vector) => {
    const values = Array.isArray(vector) ? vector.slice(0, 3) : isObject(vector) ? [vector.x, vector.y, vector.z] : null;
    return values && values.every(isFiniteNumber) && values.every((v) => v === 0);
  };
  if (zero(aim.camera?.up)) out.issue("$.AIM3DViewer.camera.up", "warning", "is a zero vector - the camera has no up direction", aim.camera.up, "camera");
  const scale = aim.modelTransform?.scale;
  const scales = Array.isArray(scale) ? scale : isObject(scale) ? [scale.x, scale.y, scale.z] : [];
  if (scales.some((v) => v === 0)) {
    out.issue("$.AIM3DViewer.modelTransform.scale", "warning", "has a zero component - the model becomes flat or invisible", scale, "transform");
  }
  const { startYear, endYear } = aim.timeline || {};
  asArray(aim.timeline?.stages).forEach((stage, index) => {
    if (!isFiniteNumber(stage?.year)) return;
    if ((isFiniteNumber(startYear) && stage.year < startYear) || (isFiniteNumber(endYear) && stage.year > endYear)) {
      out.issue(`$.AIM3DViewer.timeline.stages[${index}].year`, "warning", "lies outside startYear..endYear", stage.year, "timeline");
    }
  });
}

// ---- the result ----------------------------------------------------------------

// The feature an attribute path belongs to, for validator errors at paths
// the walk did not reach (e.g. a missing value).
const LAST_SEGMENT = /(\.[^.[\]]+|\[\d+\])$/;

function featureOfPath(path, out) {
  let prefix = path;
  while (true) {
    const entry = out.entries.get(prefix);
    if (entry) return entry.feature;
    if (!LAST_SEGMENT.test(prefix)) return "manifest";
    prefix = prefix.replace(LAST_SEGMENT, "");
  }
}

function inspectAIM3DManifest(manifest) {
  const out = new Collector();
  if (!isObject(manifest)) {
    out.issue("$", "error", "must be an object", manifest, "manifest");
  } else {
    // As the viewer reads it: older exports keep numbers as strings.
    const normalized = normalizeAIM3DManifest(structuredClone(manifest));
    walk(normalized, MANIFEST, "$", "manifest", out);
    crossChecks(normalized, out);
    // The validator decides what the viewer rejects; an attribute the walk
    // already marked as an error keeps that message.
    validateAIM3DManifest(normalized).errors.forEach(({ path, message }) => {
      if (out.entries.get(path)?.level === "error") return;
      out.issue(path, "error", message, undefined, featureOfPath(path, out));
    });
  }

  const attributes = [...out.entries.values()];
  const count = (level) => attributes.reduce((sum, entry) => sum + entry.issues.filter((issue) => issue.level === level).length, 0);
  const summary = {
    errors: count("error"),
    warnings: count("warning"),
    infos: count("info"),
    attributes: attributes.length,
    unknown: attributes.filter((entry) => !entry.known).length,
  };

  const features = MANIFEST_FEATURES.map((feature) => {
    const own = attributes.filter((entry) => entry.feature === feature.id);
    const issues = own.flatMap((entry) => entry.issues);
    const errors = issues.filter((issue) => issue.level === "error").length;
    const warnings = issues.filter((issue) => issue.level === "warning").length;
    const featureCount = isObject(manifest) ? feature.count(manifest) : 0;
    return {
      id: feature.id,
      icon: feature.id,
      label: feature.label,
      present: featureCount > 0,
      count: featureCount,
      status: errors ? "error" : warnings ? "warning" : "ok",
      errors,
      warnings,
    };
  });

  return {
    schema: INSPECTION_SCHEMA,
    status: summary.errors ? "error" : summary.warnings ? "warning" : "ok",
    summary,
    features,
    attributes,
  };
}

// The model files a manifest paints (body ids), resolved against its URL.
function manifestModelUrls(manifest, base = undefined) {
  if (!isObject(manifest)) return [];
  return paintedBodies(manifest)
    .filter((body) => bodyFeature(body) === "model" && typeof body.id === "string")
    .map((body) => {
      try {
        return base ? new URL(body.id, base).href : body.id;
      } catch {
        return body.id;
      }
    });
}

// What the manifest lists show: the features that are set, in icon order,
// with their status (the structure itself only when something is wrong).
function manifestFeatureIcons(inspection) {
  return inspection.features
    .filter((feature) => feature.present && (feature.id !== "manifest" || feature.status !== "ok"))
    .map(({ id, icon, label, count, status }) => ({ id, icon, label, count, status }));
}

// Icons of what a manifest contains (manifest-inspection.js features) and of
// the check of its model file (the worker's validation.json), for the model
// lists and the validation report (validation-report.js). Each icon is a
// meta-icon (meta-icons.js) whose mask is set here, coloured by its status:
// data-status="warning" / "error" (models-panel.css).

const SHAPES = {
  model: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M12 12 20 7.5M12 12 4 7.5M12 12v9"/>',
  metadata: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  rights: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.6a3.5 3.5 0 1 0 0 4.8"/>',
  annotations: '<path d="M5 4h14v11H10l-5 4z"/><path d="M9 8.5h6M9 11.5h4"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lights: '<path d="M9.5 17.5h5M10.5 20.5h3M12 3a6 6 0 0 0-3.5 10.9V15.5h7v-1.6A6 6 0 0 0 12 3z"/>',
  "raking-light": '<path d="M3 19h18M4.5 14.5l15-8M4.5 10l8-4.5"/>',
  clipping: '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M2.5 12h19"/>',
  timeline: '<path d="M3 12h18M7 8.5v7M12 6v12M17 8.5v7"/>',
  variants: '<rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="11" height="11" rx="1.5"/>',
  compare: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M12 2.5v19"/>',
  photos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.4"/>',
  location: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  weather: '<path d="M7 15.5a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17.2 8.1 3.75 3.75 0 0 1 17 15.5z"/><path d="M8 18.5l-1 2.5M12 18.5l-1 2.5M16 18.5l-1 2.5"/>',
  materials: '<circle cx="12" cy="12" r="8.5"/><path d="M5.5 9.5c3 1.5 10 1.5 13 0M5.5 14.5c3-1.5 10-1.5 13 0"/>',
  certainty: '<path d="M12 3 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  thumbnails: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  transform: '<path d="M12 3v18M3 12h18M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
  rendering: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 8h7.5M12 12h8.5M12 16h7.5"/>',
  tour: '<path d="M6 21V4h11l-2.5 4 2.5 4H6"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  manifest: '<path d="M9 4H8a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1"/>',
  "model-check": '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
};

const mask = (shape) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${shape}</svg>`,
)}")`;

// The same shapes as inline SVG in the current colour (the report's rows).
function featureIconSvg(icon) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SHAPES[icon] || SHAPES.manifest}</svg>`;
}

const featureLabel = (feature) => t(`validationReport.features.${feature.id}`, feature.label);

const statusLabel = (status) => ({
  ok: t("validationReport.pass", "Pass"),
  warning: t("validationReport.review", "Needs review"),
  error: t("validationReport.fail", "Fail"),
  missing: t("validationReport.notSet", "Not set"),
  unchecked: t("validationReport.notChecked", "Not checked"),
}[status] || status);

// One icon, its tooltip "<label> (<count>): <status>".
function statusIconPart(icon, label, status = "ok", count = 0) {
  const tooltip = `${label}${count > 1 ? ` (${count})` : ""}: ${statusLabel(status)}`;
  const part = metaPart(icon, tooltip, count > 1 ? String(count) : "");
  const glyph = part.querySelector(".meta-icon");
  glyph.style.setProperty("--meta-icon", mask(SHAPES[icon] || SHAPES.manifest));
  part.title = tooltip;
  if (count > 1) part.setAttribute("aria-label", tooltip);
  part.dataset.status = status;
  part.classList.add("feature-icon");
  return part;
}

// The model check of the worker (validation.json, or its summary in
// GET /api/jobs): one icon with the counts in its tooltip.
function modelCheckPart(validation) {
  if (!validation?.status) return null;
  const counts = [];
  if (validation.errors) counts.push(t("validationReport.errorsCount", { count: validation.errors }, "{count} error(s)"));
  if (validation.warnings) counts.push(t("validationReport.warningsCount", { count: validation.warnings }, "{count} warning(s)"));
  const label = t("validationReport.modelCheck", "Model file check (glTF-Validator)");
  const part = statusIconPart("model-check", counts.length ? `${label} - ${counts.join(", ")}` : label, validation.status);
  part.classList.add("model-check-icon");
  return part;
}

// The caption of a manifest in a list: what it contains, then the model check.
function featureIconsCaption(inspection, modelValidation = null) {
  const parts = manifestFeatureIcons(inspection)
    .map((feature) => statusIconPart(feature.icon, featureLabel(feature), feature.status, feature.count));
  const caption = metaCaption([...parts, modelCheckPart(modelValidation)]);
  caption.classList.add("feature-icons");
  return caption;
}

// Model thumbnails and the generic images that stand in for missing ones
// (gallery, browse panel, admin pages). No viewer imports: the admin pages
// (exadmin/) use it without loading the viewer.

// Renders of the Explora 4D logo (viewer/examples/gallery/generic/
// explora4d-placeholder-01..09.png), shown wherever a gallery image is
// missing. Resolved against this module like viewer-settings.json: the chunk
// sits in <build>/assets/, the examples next to it in <build>/examples/.
const GENERIC_GALLERY_IMAGE_COUNT = 9;

// Rollup builds turn the gallery PNGs into WebP (rollup.config.js,
// convertGalleryToWebp); the dev server (Parcel, no "test") serves the
// PNGs straight from viewer/examples.
const GALLERY_IMAGE_EXT = "webp" ;

function getGenericGalleryImageUrl(index) {
  const moduleUrl = new URL(import.meta.url);
  const examplesPath = moduleUrl.pathname.includes("/assets/") ? "../examples/" : "./examples/";
  const number = String((index % GENERIC_GALLERY_IMAGE_COUNT) + 1).padStart(2, "0");
  return new URL(`${examplesPath}gallery/generic/explora4d-placeholder-${number}.${GALLERY_IMAGE_EXT}`, moduleUrl).href;
}

// One of the generic images for a model without thumbnails (browse and
// admin panels), the same one for the same model every time.
function genericThumbnailUrl(seed = "") {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return getGenericGalleryImageUrl(hash % GENERIC_GALLERY_IMAGE_COUNT);
}

// Fills a list row's thumbnail slot: the model's own image, or a generic one
// when it has none or it fails to load (the slot's CSS placeholder is left
// if even that is missing).
function fillModelThumbnail(slot, imageUrl, seed) {
  const thumb = document.createElement("img");
  thumb.alt = "";
  thumb.loading = "lazy";
  const generic = genericThumbnailUrl(seed);
  thumb.addEventListener("error", function onError() {
    if (thumb.src !== generic && imageUrl) {
      thumb.src = generic;
      return;
    }
    thumb.removeEventListener("error", onError);
    thumb.remove();
  });
  thumb.src = imageUrl || generic;
  slot.appendChild(thumb);
}

export { GENERIC_GALLERY_IMAGE_COUNT as G, VIEWER_I18N as V, metaPart as a, modelCheckPart as b, createPasswordField as c, featureIconSvg as d, statusLabel as e, fillModelThumbnail as f, featureLabel as g, featureIconsCaption as h, inspectAIM3DManifest as i, manifestModelUrls as j, getGenericGalleryImageUrl as k, GALLERY_IMAGE_EXT as l, metaCaption as m, normalizeAIM3DManifest as n, formatAIM3DManifestValidationErrors as o, certaintyText as p, normalizeCertaintyScale as q, normalizeCertaintyAssessment as r, setLanguageSource as s, t, certaintyLevelForValue as u, validateAIM3DManifest as v, isAIM3DManifest as w };
//# sourceMappingURL=model-thumbnail-DiYglNlG.js.map
