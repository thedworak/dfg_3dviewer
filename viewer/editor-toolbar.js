import THREE from "./init.js";

import { core } from "./core.js";
import { t } from "./i18n-utils.js";

export function getEditorToolbarIcon(icon) {
  const icons = {
    moveToolbar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    orbit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 2.75 21 3.5l-.75 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.25" fill="currentColor"/></svg>',
    move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5A7.5 7.5 0 1 1 5 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 3.5v3H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    scale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h8v8H8zM5 5h4M5 5v4M19 19h-4M19 19v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lightMove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 13h5l-1 8 7-10h-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    lightTarget: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    lights: '<svg viewBox="0 0 24 24" aria-hidden="true"> <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/> <path d="M12 4V7M12 17v3M4 12h3M17 12h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/> </svg>',
    materials: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v8l-8 4-8-4V6l8-4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 6l8 4M12 6v8M12 14l-8-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    ambientLight: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cameraLight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h3l2-2h4l2 2h3v10H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    environmentMap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 7v10l-7 4-7-4V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 3v18M5 7l7 4 7-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="18.25" cy="5.75" r="1.25" fill="currentColor"/></svg>',
    color: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a5 5 0 0 0-5 5c0 2.8 5 9 5 9s5-6.2 5-9a5 5 0 0 0-5-5Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 14.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="currentColor"/></svg>',
    intensity: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    picking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 3 8 8-4 1 2 5-2.5 1-2-5-3 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    resetCamera: '<svg viewBox="0 0 24 24" aria-hidden="true"> <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/> <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/> </svg>',
    preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8 14 2.5-3 2.5 2 2-3 3 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 4v5h8M9 18h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mainMenu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 2.2 3-.2.8 2.9 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.6-1.4 1-2.8-1-2.8 2.6-1.4.8-2.9 3 .2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    advancedEditor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M4 17h16M14 7h6M4 12h6M12 12h8M8 5v4M16 10v4M10 15v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fullScreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5M20 20h-5M20 20v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    displayHelperX: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8 8 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    displayHelperY: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7 12 13 17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    displayHelperZ: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10M7 17h10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    visible: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    clippingPlanes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10v12H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 6h5v12H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.5 2.5" stroke-linejoin="round"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="16" height="6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/> <path d="M7 9v2.5 M9.5 9v1.6 M12 9v2.5 M14.5 9v1.6 M17 9v2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    annotate: '<svg viewBox="0 0 24 24" aria-hidden="true"> <path d="M5 5h14v10H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> <path d="M9 9h6M9 12h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg>',
    annotateAdd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v11H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8v5M9.5 10.5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    annotateImport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v11H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6.8v7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8.8 10.8 12 14l3.2-3.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    annotateExport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v11H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 14.2V7.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8.8 10.2 12 7l3.2 3.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hierarchy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5zM9 6h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    loadingLogs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M3 6h12M3 18h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    performance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 12 15 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    statistics: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 14v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 10v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 6v12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    performanceDefault: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 12 15 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    performanceHigh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 12 15 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="#FF4136"/></svg>',
    performanceLow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 12 15 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="#2ECC40"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    projection: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8l5-3h7v14h-7l-5-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 5v14" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    wireframe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 7v10l-7 4-7-4V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 3v18M5 7l7 4 7-4M5 17l7-4 7 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    screenshot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5H5a2 2 0 0 0-2 2v2M17 5h2a2 2 0 0 1 2 2v2M17 19h2a2 2 0 0 0 2-2v-2M7 19H5a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M5 12l7 7 7-7M4 19h16a1 1 0 0 1 1 1v2H3v-2a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  return icons[icon] || icons.advancedEditor;
}

export function syncEditorToolbarSecondaryTrayWidth(viewer) {
  if (!viewer.editorToolbarSecondaryTray) return;
  viewer.editorToolbarSecondaryTray.style.setProperty("--viewer-toolbar-secondary-width", `${viewer.editorToolbarSecondaryTray.scrollWidth}px`);
}

export function getEditorToolbarHost(viewer) {
  return core.container || viewer.viewerWrapper || null;
}

function initializeEditorToolbarDrag(handle, viewer, toolbar, host) {
  let dragState = null;

  // persistent toolbar position
  let currentX = 0;
  let currentY = 0;

  const getScale = () => {
    const style = getComputedStyle(toolbar);
    const scale = parseFloat(
      style.getPropertyValue("--viewer-toolbar-scale")
    );

    return Number.isFinite(scale) ? scale : 1;
  };

  const clampPosition = (x, y) => {
    const hostRect = host.getBoundingClientRect();

    return {
      x: Math.min(
        Math.max(x, -hostRect.width),
        hostRect.width
      ),

      y: Math.min(
        Math.max(y, -hostRect.height),
        hostRect.height
      ),
    };
  };

  const applyPosition = () => {
    toolbar.style.setProperty("--drag-x", `${currentX}px`);
    toolbar.style.setProperty("--drag-y", `${currentY}px`);
  };

  const updateToolbarPosition = (event) => {
    if (!dragState) return;

    const scale = getScale();

    const dx = (event.clientX - dragState.startX) / scale;
    const dy = (event.clientY - dragState.startY) / scale;

    const pos = clampPosition(
      dragState.originX + dx,
      dragState.originY + dy
    );

    currentX = pos.x;
    currentY = pos.y;

    applyPosition();
  };

  const stopToolbarDrag = () => {
    if (!dragState) return;

    dragState = null;

    toolbar.classList.remove("viewer-editor-toolbar_dragging");

    document.removeEventListener(
      "pointermove",
      updateToolbarPosition
    );

    document.removeEventListener(
      "pointerup",
      stopToolbarDrag
    );

    document.removeEventListener(
      "pointercancel",
      stopToolbarDrag
    );

    requestAnimationFrame(() => {
      toolbar.style.removeProperty("transition");
    });
  };

  const startToolbarDrag = (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      originX: currentX,
      originY: currentY,
    };

    toolbar.classList.add("viewer-editor-toolbar_dragging");

    toolbar.style.transition = "none";

    document.addEventListener(
      "pointermove",
      updateToolbarPosition,
      {passive: true}
    );

    document.addEventListener(
      "pointerup",
      stopToolbarDrag
    );

    document.addEventListener(
      "pointercancel",
      stopToolbarDrag
    );
  };

  viewer.bindEventListener(
    handle,
    "pointerdown",
    startToolbarDrag
  );

  viewer.bindEventListener(handle, "click", (event) => {
    event.stopPropagation();
  });

  // keep position valid after resize
  const resizeObserver = new ResizeObserver(() => {
    const pos = clampPosition(currentX, currentY);

    currentX = pos.x;
    currentY = pos.y;

    applyPosition();
  });

  resizeObserver.observe(host);

  applyPosition();
}

export function attachEditorToolbar(viewer) {
  if (!core.editorToolbar || !core.container) return;
  if (getComputedStyle(core.container).position === 'static') {
    core.container.style.position = 'relative';
  }
  const host = getEditorToolbarHost(viewer);
  if (!host || core.editorToolbar.parentElement === host) return;
  host.appendChild(core.editorToolbar);
}

export function toggleToolbarExpanded(viewer) {
  if (!core.editorToolbar) return;

  syncEditorToolbarSecondaryTrayWidth(viewer);
  viewer.isToolbarExpanded = !viewer.isToolbarExpanded;
  core.editorToolbar.classList.toggle("expanded", viewer.isToolbarExpanded);
  viewer.editorToolbarButtons.expand.classList.toggle("expanded-icon", viewer.isToolbarExpanded);
  viewer.editorToolbarButtons.expand.setAttribute("aria-expanded", viewer.isToolbarExpanded ? "true" : "false");
  const icon = viewer.editorToolbarButtons.expand.querySelector(".viewer-editor-tool_icon");
  if (icon) {
    icon.innerHTML = getEditorToolbarIcon(viewer.isToolbarExpanded ? "collapse" : "expand");
  }

  viewer.updateEditorToolbarLabels();
}

async function downloadFile(fileName = "model.glb") {
  if (!core.downloadModel) return;

  const handle = await window.showSaveFilePicker({
    suggestedName: fileName,
  });

  const writable = await handle.createWritable();

  await writable.write(core.downloadModel);
  await writable.close();

  toastHelper("download", "success");
}

export function createEditorToolbar(viewer) {
  if (!core.EDITOR || viewer.urlOptions.hideUi || core.editorToolbar || !core.container) return;

  const toolbar = document.createElement("div");
  toolbar.id = "viewerEditorToolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", t("toolbar.editor", "Editor tools"));

  const tools = [
    { key: "moveToolbar", icon: "moveToolbar", onClick: () => {}, pressed:true, primary: true },
    { key: "orbit", icon: "orbit", onClick: () => viewer.setObjectTransformMode(""), primary: true },
    { key: "move", icon: "move", onClick: () => viewer.toggleObjectTransformMode("translate"), pressed: true, primary: true },
    { key: "rotate", icon: "rotate", onClick: () => viewer.toggleObjectTransformMode("rotate"), pressed: true, primary: true },
    { key: "scale", icon: "scale", onClick: () => viewer.toggleObjectTransformMode("scale"), pressed: true, primary: true },
    { key: "lights", icon: "lights", onClick: () => {}, pressed: false, primary: false },
    { key: "materials", icon: "materials", onClick: () => viewer.openMaterialsFolder(), pressed: false, primary: false },
    { key: "picking", icon: "picking", onClick: () => viewer.togglePickingMode(), pressed: true, primary: false },
    { key: "annotate", icon: "annotate", onClick: () => viewer.openAnnotationDialogWithAutoPicking(), primary: false },
    { key: "ruler", icon: "ruler", onClick: () => viewer.toggleDistanceMeasurement(), pressed: true, primary: false },
    { key: "fullScreen", icon: "fullScreen", onClick: () => viewer.toggleFullscreen(), pressed: true, primary: true },
    { key: "clippingPlanes", icon: "clippingPlanes", onClick: () => viewer.toggleClippingPlanesPanel(), pressed: true, primary: false },
    { key: "resetCamera", icon: "resetCamera", onClick: () => viewer.resetCamera(), primary: false },
    { key: "hierarchy", icon: "hierarchy", onClick: () => {}, pressed: true, primary: false },
    { key: "projection", icon: "projection", onClick: () => viewer.toggleCameraProjection(), pressed: true, primary: false },
    { key: "wireframe", icon: "wireframe", onClick: () => viewer.toggleWireframeMode(), pressed: true, primary: false },    
    { key: "statistics", icon: "statistics", onClick: () => {}, pressed: false, primary: false },
    
  ];

  if (!core.isLightweight || core.isLocalPreview) {
    tools.splice(tools.length - 1, 0,
      { key: "loadingLogs", icon: "loadingLogs", onClick: () => viewer.toggleLoadingLogs(), pressed: true, primary: false },
      { key: "download", icon: "download", onClick: () => downloadFile(core.fileObject.filename), pressed: true, primary: false },
      { key: "preview", icon: "preview", onClick: () => viewer.takeScreenshot(), primary: false },
      { key: "save", icon: "save", onClick: () => {}, primary: false }
    );
  }

  viewer.editorToolbarButtons = {};
  viewer.environmentMapPreset = viewer.environmentMapPreset || "neutral";
  const secondaryTray = document.createElement("div");
  secondaryTray.className = "viewer-editor-toolbar_secondary-tray";
  viewer.editorToolbarSecondaryTray = secondaryTray;

  tools.forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "viewer-editor-tool";
    if (!tool.primary) {
      button.classList.add("viewer-editor-tool-not-primary");
    }
    button.dataset.tool = tool.key;
    button.dataset.pressed = tool.pressed ? "true" : "false";
    button.dataset.primary = tool.primary ? "true" : "false";
    if (tool.key === "materials") {
      const label = t("gui.materials", "Materials");
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
    }
    button.innerHTML = `
      <span class="viewer-editor-tool_icon" aria-hidden="true">${getEditorToolbarIcon(tool.icon)}</span>
      <span class="viewer-editor-tool_sr"></span>
    `;
    if (tool.key === "moveToolbar") {
      initializeEditorToolbarDrag(button, viewer, toolbar, getEditorToolbarHost(viewer));
    }
    else if (tool.key === "clippingPlanes") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu";
      const submenuItems = [
        { key: "displayHelperX", icon: "displayHelperX", label: t("gui.displayHelperX", "Show X helper"), onClick: () => viewer.toggleClippingPlaneHelper("x") },
        { key: "displayHelperY", icon: "displayHelperY", label: t("gui.displayHelperY", "Show Y helper"), onClick: () => viewer.toggleClippingPlaneHelper("y") },
        { key: "displayHelperZ", icon: "displayHelperZ", label: t("gui.displayHelperZ", "Show Z helper"), onClick: () => viewer.toggleClippingPlaneHelper("z") },
        { key: "visible", icon: "visible", label: t("gui.visible", "Visible"), onClick: () => viewer.toggleClippingPlaneVisible() },
      ];
      viewer.clippingPlaneSubmenuButtons = {};
      submenuItems.forEach((item) => {
        const subButton = document.createElement("button");
        subButton.type = "button";
        subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button";
        subButton.dataset.tool = item.key;
        subButton.innerHTML = `
          <span class="viewer-editor-tool_icon" aria-hidden="true">${getEditorToolbarIcon(item.icon)}</span>
        `;
        subButton.setAttribute("title", item.label);
        subButton.setAttribute("aria-label", item.label);
        viewer.bindEventListener(subButton, "click", (event) => {
          event.stopPropagation();
          item.onClick();
        });
        submenu.appendChild(subButton);
        viewer.clippingPlaneSubmenuButtons[item.key] = subButton;
      });
      button.appendChild(submenu);
    } else if (tool.key === "annotate") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu";
      const submenuItems = [
        { key: "annotateAdd", icon: "annotateAdd", label: t("gui.annotateAdd", "Add Annotation"), onClick: () => viewer.openAnnotationDialogWithAutoPicking() },
        { key: "annotateImport", icon: "annotateImport", label: t("gui.annotateImport", "Import Annotations"), onClick: () => viewer.downloadAnnotationsXmlFile() },
        { key: "annotateExport", icon: "annotateExport", label: t("gui.annotateExport", "Export Annotations"), onClick: () => viewer.triggerAnnotationsXmlImport() },
      ];
      viewer.annotateSubmenuButtons = {};
      submenuItems.forEach((item) => {
        const subButton = document.createElement("button");
        subButton.type = "button";
        subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button";
        subButton.dataset.tool = item.key;
        subButton.innerHTML = `
          <span class="viewer-editor-tool_icon" aria-hidden="true">${getEditorToolbarIcon(item.icon)}</span>
        `;
        subButton.setAttribute("title", item.label);
        subButton.setAttribute("aria-label", item.label);
        viewer.bindEventListener(subButton, "click", (event) => {
          event.stopPropagation();
          item.onClick();
        });
        submenu.appendChild(subButton);
        viewer.annotateSubmenuButtons[item.key] = subButton;
      });
      button.appendChild(submenu);
    } else if (tool.key === "materials") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu viewer-editor-tool_submenu-materials";
      viewer.materialsSubmenu = submenu;
      viewer.refreshMaterialsToolbarMenu();
      button.appendChild(submenu);
    } else if (tool.key === "hierarchy") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu viewer-editor-hierarchy-submenu";
      viewer.hierarchySubmenu = submenu;
      const hierarchyList = document.createElement("div");
      hierarchyList.className = "viewer-editor-hierarchy-submenu-list";
      viewer.hierarchySubmenuList = hierarchyList;
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button viewer-editor-hierarchy-clear";
      viewer.bindEventListener(clearButton, "click", (event) => {
        event.stopPropagation();
        viewer.clearHierarchySelection();
      });
      viewer.hierarchyClearButton = clearButton;
      viewer.hierarchySubmenuButtons = {};
      submenu.appendChild(hierarchyList);
      submenu.appendChild(clearButton);
      button.appendChild(submenu);
    } else if (tool.key === "save") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu viewer-editor-save-submenu";
      viewer.bindEventListener(submenu, "click", (event) => {
        event.stopPropagation();
      });
      const submenuItems = [
        { key: "Position", label: t("gui.position", "Position") },
        { key: "Rotation", label: t("gui.rotation", "Rotation") },
        { key: "Scale", label: t("gui.scale", "Scale") },
        { key: "Camera", label: t("gui.camera", "Camera") },
        { key: "DirectionalLight", label: t("gui.directionalLight", "Directional Light") },
        { key: "AmbientLight", label: t("gui.ambientLight", "Ambient Light") },
        { key: "CameraLight", label: t("gui.cameraLight", "Camera Light") },
        { key: "BackgroundColor", label: t("gui.backgroundColor", "Background Color") },
      ];
      viewer.saveSubmenuCheckboxes = {};
      submenuItems.forEach((item) => {
        const row = document.createElement("label");
        row.className = "viewer-editor-save-option";
        row.setAttribute("title", item.label);
        row.setAttribute("aria-label", item.label);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(viewer.saveProperties[item.key]);
        checkbox.dataset.property = item.key;
        viewer.bindEventListener(checkbox, "click", (event) => {
          event.stopPropagation();
        });
        viewer.bindEventListener(checkbox, "change", (event) => {
          event.stopPropagation();
          viewer.saveProperties[item.key] = event.target.checked;
        });

        const text = document.createElement("span");
        text.className = "viewer-editor-save-option_label";
        text.textContent = item.label;

        row.appendChild(checkbox);
        row.appendChild(text);
        submenu.appendChild(row);
        viewer.saveSubmenuCheckboxes[item.key] = { row, checkbox, text };
      });

      const actions = document.createElement("div");
      actions.className = "viewer-editor-save-actions";

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "viewer-editor-save-apply";
      saveButton.textContent = t("gui.saveSettings", "Save settings");
      viewer.bindEventListener(saveButton, "click", (event) => {
        event.stopPropagation();
        viewer.saveEditorMetadata();
      });
      viewer.saveSubmenuActionButton = saveButton;

      actions.appendChild(saveButton);
      submenu.appendChild(actions);
      button.appendChild(submenu);
    } else if (tool.key === "statistics") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu";
      viewer.statisticsSubmenuButtons = {};

      const appendStatisticsSubmenuItems = (items, container) => {
        items.forEach((item) => {
          const subButton = document.createElement("button");
          subButton.type = "button";
          subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button";
          subButton.dataset.tool = item.key;
          subButton.setAttribute("title", item.label);
          subButton.setAttribute("aria-label", item.label);
          subButton.setAttribute("aria-pressed", item.pressed);

          const iconSpan = document.createElement("span");
          iconSpan.className = "viewer-editor-tool_icon";
          iconSpan.setAttribute("aria-hidden", "true");
          iconSpan.innerHTML = getEditorToolbarIcon(item.icon);
          subButton.appendChild(iconSpan);

          const srSpan = document.createElement("span");
          srSpan.className = "viewer-editor-tool_sr";
          srSpan.textContent = item.label;
          subButton.appendChild(srSpan);

          if (item.onClick) {
            viewer.bindEventListener(subButton, "click", (event) => {
              event.stopPropagation();
              item.onClick();
            });
          }

          if (item.children) {
            subButton.classList.add("has-submenu");
            const nested = document.createElement("div");
            nested.className = "viewer-editor-tool_submenu";
            appendStatisticsSubmenuItems(item.children, nested);
            subButton.appendChild(nested);
          }

          viewer.statisticsSubmenuButtons[item.key] = subButton;
          container.appendChild(subButton);
        });
      };

      appendStatisticsSubmenuItems([
        {
          key: "toggleStats",
          icon: "statistics",
          label: t("gui.statistics", "Statistics"),
          pressed: false,
          onClick: () => viewer.toggleStatsVisibility(),
        },
        {
          key: "performance",
          icon: "performance",
          label: t("gui.performance", "Performance"),
          children: [
            {
              key: "performanceDefault",
              icon: "statistics",
              label: t("gui.default", "Default"),
              onClick: () => viewer.setPerformanceMode("default"),
              pressed: true,
            },
            {
              key: "performanceHigh",
              icon: "performanceHigh",
              label: t("gui.highPerformance", "High-performance"),
              onClick: () => viewer.setPerformanceMode("high-performance"),
              pressed: true,
            },
            {
              key: "performanceLow",
              icon: "performanceLow",
              label: t("gui.lowPower", "Low-power"),
              onClick: () => viewer.setPerformanceMode("low-power"),
              pressed: true,
            },
          ],
        },
      ], submenu);

      button.appendChild(submenu);
    } else if (tool.key === "lights") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu";
      viewer.lightsSubmenuButtons = {};

      const normalizeColorValue = (value) => {
        if (typeof value !== "string") return "#ffffff";
        if (value.startsWith("0x")) {
          return `#${value.slice(2).padStart(6, "0")}`;
        }
        return value.startsWith("#") ? value : `#${value}`;
      };

      const appendSubmenuItems = (items, container) => {
        items.forEach((item) => {
          const subButton = document.createElement("button");
          subButton.type = "button";
          subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button ";
          subButton.dataset.tool = item.key;
          subButton.setAttribute("title", item.label);
          subButton.setAttribute("aria-label", item.label);

          const iconSpan = document.createElement("span");
          iconSpan.className = "viewer-editor-tool_icon";
          iconSpan.setAttribute("aria-hidden", "true");
          iconSpan.innerHTML = item.iconHtml || getEditorToolbarIcon(item.icon);
          subButton.appendChild(iconSpan);

          if (item.type === "color") {
            subButton.classList.add("viewer-editor-tool_submenu-control");

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = normalizeColorValue(item.value());
            colorInput.className = "viewer-editor-tool_submenu-input";
            colorInput.addEventListener("click", (event) => event.stopPropagation());
            colorInput.addEventListener("input", (event) => {
              const value = event.target.value;
              item.onChange(value);
              colorInput.value = normalizeColorValue(value);
            });
            subButton.appendChild(colorInput);
          } else if (item.type === "slider") {
            subButton.classList.add("viewer-editor-tool_submenu-control");

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = item.min ?? 0;
            slider.max = item.max ?? 10;
            slider.step = item.step ?? 0.01;
            slider.value = String(item.value());
            slider.className = "viewer-editor-tool_submenu-input";
            slider.addEventListener("click", (event) => event.stopPropagation());
            slider.addEventListener("input", (event) => {
              const value = parseFloat(event.target.value);
              item.onChange(value);
              valueLabel.textContent = value.toFixed(2);
            });

            const valueLabel = document.createElement("span");
            valueLabel.className = "viewer-editor-tool_submenu-value";
            valueLabel.textContent = Number(item.value()).toFixed(2);
            valueLabel.setAttribute("aria-hidden", "true");

            subButton.appendChild(slider);
            subButton.appendChild(valueLabel);
          } else if (item.type === "toggle") {
            subButton.classList.add("viewer-editor-tool_submenu-control", "viewer-editor-tool_submenu-toggle");
            subButton.setAttribute("type", "button");

            const toggleState = document.createElement("span");
            toggleState.className = "viewer-editor-tool_submenu-toggle-state";
            const setToggleState = () => {
              const enabled = Boolean(item.value());
              toggleState.textContent = enabled ? t("gui.on", "ON") : t("gui.off", "OFF");
              subButton.setAttribute("aria-pressed", enabled ? "true" : "false");
              subButton.classList.toggle("is-active", enabled);
            };
            setToggleState();

            viewer.bindEventListener(subButton, "click", async (event) => {
              event.stopPropagation();
              const nextValue = !Boolean(item.value());
              if (item.onChange) {
                await item.onChange(nextValue);
              }
              setToggleState();
            });

            subButton.appendChild(toggleState);
          } else if (item.onClick) {
            viewer.bindEventListener(subButton, "click", (event) => {
              event.stopPropagation();
              item.onClick();
            });
          }

          if (item.children) {
            subButton.classList.add("has-submenu");
            const nested = document.createElement("div");
            nested.className = "viewer-editor-tool_submenu";
            appendSubmenuItems(item.children, nested);
            subButton.appendChild(nested);
          }

          if (
            item.key === "lightTargetTransformMove" ||
            item.key === "lightTargetTransformTarget" ||
            item.key.startsWith("environmentMap")
          ) {
            viewer.lightsSubmenuButtons[item.key] = subButton;
          }
          container.appendChild(subButton);
        });
      };

      appendSubmenuItems([
        {
          key: "environmentMap",
          icon: "environmentMap",
          label: t("gui.environmentMap", "Environment map"),
          children: [
            {
              key: "environmentMapToggle",
              icon: "environmentMap",
              label: t("gui.environmentMapToggle", "Environment map"),
              type: "toggle",
              value: () => (core.scene?.environmentIntensity ?? 0) > 0,
              onChange: async (value) => {
                if (!core.scene) return;
                if (value) {
                  core.scene.environmentIntensity = 0.5;
                } else {
                  core.scene.environmentIntensity = 0;
                }
                core.scene.traverse((child) => {
                  const materials = child?.material
                    ? Array.isArray(child.material)
                      ? child.material
                      : [child.material]
                    : [];
                  materials.forEach((material) => {
                    if (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) {
                      material.needsUpdate = true;
                    }
                  });
                });
                viewer.updateEditorToolbarState();
              },
            },
            {
              key: "environmentMapIntensity",
              icon: "intensity",
              label: t("gui.intensity", "Intensity"),
              type: "slider",
              min: 0,
              max: 1,
              step: 0.01,
              value: () => core.scene?.environmentIntensity ?? 0.5,
              onChange: (value) => {
                if (!core.scene) return;
                core.scene.environmentIntensity = value;
                core.scene.traverse((child) => {
                  const materials = child?.material
                    ? Array.isArray(child.material)
                      ? child.material
                      : [child.material]
                    : [];
                  materials.forEach((material) => {
                    if (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) {
                      material.needsUpdate = true;
                    }
                  });
                });
              },
            },
            {
              key: "environmentMapStyleNeutral",
              iconHtml: "🌥",
              label: t("gui.environmentMapNeutral", "Neutral"),
              onClick: async () => {
                await viewer.setEnvironmentMapPreset("neutral");
                viewer.updateLightsSubmenuState();
              },
            },
            {
              key: "environmentMapStyleSunny",
              iconHtml: "☀️",
              label: t("gui.environmentMapSunny", "Sunny"),
              onClick: async () => {
                await viewer.setEnvironmentMapPreset("sunny");
                viewer.updateLightsSubmenuState();
              },
            },
            {
              key: "environmentMapStyleStudio",
              iconHtml: "📸",
              label: t("gui.environmentMapStudio", "Studio"),
              onClick: async () => {
                await viewer.setEnvironmentMapPreset("studio");
                viewer.updateLightsSubmenuState();
              },
            },
            {
              key: "environmentMapStyleGoldenHour",
              iconHtml: "🌅",
              label: t("gui.environmentMapGoldenHour", "Golden Hour"),
              onClick: async () => {
                await viewer.setEnvironmentMapPreset("goldenHour");
                viewer.updateLightsSubmenuState();
              },
            },
          ],
        },
        {
          key: "lightTarget",
          icon: "lightTarget",
          label: t("gui.target", "Target"),
          children: [
            {
              key: "lightTargetColor",
              icon: "color",
              label: t("gui.color", "Color"),
              type: "color",
              value: () => viewer.colors.DirectionalLight,
              onChange: (value) => {
                viewer.colors.DirectionalLight = value;
                core.lightObjects[0].color = new THREE.Color(value);
              },
            },
            {
              key: "lightTargetIntensity",
              icon: "intensity",
              label: t("gui.intensity", "Intensity"),
              type: "slider",
              min: 0,
              max: 10,
              step: 0.01,
              value: () => viewer.intensity.startIntensityDir,
              onChange: (value) => {
                viewer.intensity.startIntensityDir = value;
                core.lightObjects[0].intensity = value;
              },
            },
            {
              key: "lightTargetTransform",
              icon: "move",
              label: t("gui.transform", "Transform"),
              children: [
                { key: "lightTargetTransformMove", icon: "move", label: t("gui.move", "Move"), onClick: () => viewer.toggleLightTransformMode("translate") },
                { key: "lightTargetTransformTarget", icon: "lightTarget", label: t("gui.target", "Target"), onClick: () => viewer.toggleLightTransformMode("rotate") },
              ],
            },
          ],
        },
        {
          key: "lightAmbient",
          icon: "ambientLight",
          label: t("gui.ambient", "Ambient"),
          children: [
            {
              key: "lightAmbientColor",
              icon: "color",
              label: t("gui.color", "Color"),
              type: "color",
              value: () => viewer.colors.AmbientLight,
              onChange: (value) => {
                viewer.colors.AmbientLight = value;
                viewer.ambientLight.color = new THREE.Color(value);
              },
            },
            {
              key: "lightAmbientIntensity",
              icon: "intensity",
              label: t("gui.intensity", "Intensity"),
              type: "slider",
              min: 0,
              max: 10,
              step: 0.01,
              value: () => viewer.intensity.startIntensityAmbient,
              onChange: (value) => {
                viewer.intensity.startIntensityAmbient = value;
                viewer.ambientLight.intensity = value;
              },
            },
          ],
        },
        {
          key: "lightCamera",
          icon: "cameraLight",
          label: t("gui.camera", "Camera"),
          children: [
            {
              key: "lightCameraColor",
              icon: "color",
              label: t("gui.color", "Color"),
              type: "color",
              value: () => viewer.colors.CameraLight,
              onChange: (value) => {
                viewer.colors.CameraLight = value;
                viewer.cameraLight.color = new THREE.Color(value);
              },
            },
            {
              key: "lightCameraIntensity",
              icon: "intensity",
              label: t("gui.intensity", "Intensity"),
              type: "slider",
              min: 0,
              max: 10,
              step: 0.01,
              value: () => viewer.intensity.startIntensityCamera,
              onChange: (value) => {
                viewer.intensity.startIntensityCamera = value;
                viewer.cameraLight.intensity = value;
              },
            },
          ],
        },
      ], submenu);
      button.appendChild(submenu);
    } else if (tool.key === "materials") {
      button.classList.add("has-submenu");
      const submenu = document.createElement("div");
      submenu.className = "viewer-editor-tool_submenu viewer-editor-tool_submenu-materials";
      const submenuItems = [
        { key: "materialColor", icon: "color", label: t("gui.color", "Color"), onClick: () => viewer.openMaterialsFolder() },
        { key: "materialIntensity", icon: "intensity", label: t("gui.intensity", "Intensity"), onClick: () => viewer.openMaterialsFolder() },
      ];
      submenuItems.forEach((item) => {
        const subButton = document.createElement("button");
        subButton.type = "button";
        subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button";
        subButton.dataset.tool = item.key;
        subButton.innerHTML = `
          <span class="viewer-editor-tool_icon" aria-hidden="true">${getEditorToolbarIcon(item.icon)}</span>
        `;
        subButton.setAttribute("title", item.label);
        subButton.setAttribute("aria-label", item.label);
        viewer.bindEventListener(subButton, "click", (event) => {
          event.stopPropagation();
          item.onClick();
        });
        submenu.appendChild(subButton);
      });
      button.appendChild(submenu);
    } else if (tool.key === "download") {
      if (!core.isLightweight || core.isLocalPreview) {
        button.href = core.downloadModel;
        button.target = "_blank";
        button.rel = "noopener noreferrer";
        button.download = core.fileObject.filename;
      }  
    }
    viewer.bindEventListener(button, "click", () => {
      viewer.stopHandMode();
      if (tool.onClick) {
        tool.onClick();
      }
    });
    if (tool.primary) toolbar.appendChild(button);
    else secondaryTray.appendChild(button);
    viewer.editorToolbarButtons[tool.key] = button;
    if (!tool.primary) viewer.editorSecondaryKeys.push(button);
  });

  toolbar.appendChild(secondaryTray);

  const expandButton = document.createElement("button");
  expandButton.type = "button";
  expandButton.className = "viewer-editor-tool viewer-editor-expand";
  expandButton.innerHTML = `<span class="viewer-editor-tool_icon" aria-hidden="true">${getEditorToolbarIcon("expand")}</span>`;
  expandButton.dataset.primary = "true";
  expandButton.setAttribute("aria-expanded", "false");
  expandButton.setAttribute("title", t("gui.expand", "Expand toolbar"));
  expandButton.setAttribute("aria-label", t("gui.expand", "Expand toolbar"));
  viewer.bindEventListener(expandButton, "click", () => toggleToolbarExpanded(viewer));
  toolbar.appendChild(expandButton);
  viewer.editorToolbarButtons.expand = expandButton;

  if (viewer.actionMenu) {
    viewer.actionMenu.classList.add("viewer-action-menu_in-toolbar");
    toolbar.appendChild(viewer.actionMenu);
  }

  getEditorToolbarHost(viewer)?.appendChild(toolbar);
  core.editorToolbar = toolbar;
  core.editorToolbar.classList.add("editorToolbar-hidden");
  core.editorToolbar.classList.add("collapsed");
  viewer.updateFullscreenButtonIcon();
  viewer.updateEditorToolbarLabels();
  viewer.updateEditorToolbarState();
  syncEditorToolbarSecondaryTrayWidth(viewer);
  viewer.bindEventListener(window, "resize", () => syncEditorToolbarSecondaryTrayWidth(viewer));
}

export function updateHierarchySubmenuState(viewer) {
  if (!viewer.hierarchySubmenuButtons) return;

  const selectedIds = new Set(
    (core.selectedObjects || [])
      .filter((item) => item?.selected === true)
      .map((item) => String(item.id))
  );

  Object.entries(viewer.hierarchySubmenuButtons).forEach(([key, button]) => {
    const isActive = selectedIds.has(String(key));
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  viewer.hierarchyClearButton?.toggleAttribute("disabled", selectedIds.size === 0);
}

export function updateStatisticsSubmenuState(viewer) {
  if (!viewer.statisticsSubmenuButtons) return;
  const isVisible = typeof core.stats !== "undefined" && core.stats?.dom?.style?.visibility !== "hidden";
  viewer.statisticsSubmenuButtons.toggleStats?.classList.toggle("is-active", isVisible);
  viewer.statisticsSubmenuButtons.toggleStats?.setAttribute("aria-pressed", isVisible ? "true" : "false");

  const currentMode = core.renderer?.powerPreference || core.CONFIG.viewer?.performanceMode || "default";
  const performanceMap = {
    performanceHigh: "high-performance",
    performanceLow: "low-power",
    performanceDefault: "default",
  };
  Object.entries(performanceMap).forEach(([key, value]) => {
    const isActive = currentMode === value;
    viewer.statisticsSubmenuButtons[key]?.classList.toggle("is-active", isActive);
    viewer.statisticsSubmenuButtons[key]?.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

export function updateClippingPlanesSubmenuState(viewer) {
  if (!viewer.clippingPlaneSubmenuButtons) return;
  const clippingMode = core.planeParams?.clippingMode || {};

  viewer.clippingPlaneSubmenuButtons.displayHelperX?.classList.toggle(
    "is-active",
    Boolean(clippingMode.x)
  );
  viewer.clippingPlaneSubmenuButtons.displayHelperY?.classList.toggle(
    "is-active",
    Boolean(clippingMode.y)
  );
  viewer.clippingPlaneSubmenuButtons.displayHelperZ?.classList.toggle(
    "is-active",
    Boolean(clippingMode.z)
  );
  viewer.clippingPlaneSubmenuButtons.visible?.classList.toggle(
    "is-active",
    Boolean(core.planeParams?.outline?.visible)
  );
}

export function updateLightsSubmenuState(viewer) {
  if (!viewer.lightsSubmenuButtons) return;
  const activeMode = viewer.transformText["Transform Light"];
  viewer.lightsSubmenuButtons.environmentMap?.classList.toggle(
    "is-active",
    viewer.environmentMapEnabled !== false
  );
  viewer.lightsSubmenuButtons.environmentMap?.setAttribute(
    "aria-pressed",
    viewer.environmentMapEnabled !== false ? "true" : "false"
  );

  const environmentMapToggle = viewer.lightsSubmenuButtons.environmentMapToggle;
  if (environmentMapToggle) {
    const toggleLabel = environmentMapToggle.querySelector('.viewer-editor-tool_submenu-toggle-state');
    const isEnabled = (core.scene?.environmentIntensity ?? 0) > 0;
    if (toggleLabel) toggleLabel.textContent = isEnabled ? t("gui.on", "ON") : t("gui.off", "OFF");
    environmentMapToggle.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    environmentMapToggle.classList.toggle("is-active", isEnabled);
  }

  viewer.lightsSubmenuButtons.lightTargetTransformMove?.classList.toggle(
    "is-active",
    activeMode === "translate"
  );
  viewer.lightsSubmenuButtons.lightTargetTransformTarget?.classList.toggle(
    "is-active",
    activeMode === "rotate"
  );

  const environmentMapPreset = viewer.environmentMapPreset || "neutral";
  const environmentMapPresetStates = {
    environmentMapStyleNeutral: "neutral",
    environmentMapStyleSunny: "sunny",
    environmentMapStyleStudio: "studio",
    environmentMapStyleGoldenHour: "goldenHour",
  };

  Object.entries(environmentMapPresetStates).forEach(([key, value]) => {
    const isActive = environmentMapPreset === value;
    viewer.lightsSubmenuButtons[key]?.classList.toggle("is-active", isActive);
    viewer.lightsSubmenuButtons[key]?.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

export function updateEditorToolbarLabels(viewer) {
  if (!viewer.editorToolbarButtons) return;

  const labels = {
    moveToolbar: t("gui.moveToolbar", "Move toolbar"),
    orbit: t("gui.orbit", "Navigation mode"),
    move: t("gui.move", "Move"),
    rotate: t("gui.rotate", "Rotate"),
    scale: t("gui.scale", "Scale"),
    lights: t("gui.lights", "Lights"),
    picking: viewer.pickingMode
      ? t("controls.disablePickingMode", "Disable picking mode")
      : t("controls.enablePickingMode", "Enable picking mode"),
    annotate: t("gui.addAnnotations", "Add annotations"),
    ruler: viewer.RULER_MODE
      ? t("controls.disableDistanceMeasurement", "Disable distance measurement")
      : t("controls.enableDistanceMeasurement", "Enable distance measurement"),
    resetCamera: t("gui.resetCameraPosition", "Reset camera position"),
    preview: t("gui.renderPreview", "Render preview"),
    save: t("gui.saveSettings", "Save settings"),
    advancedEditor: viewer.isEditorAdvancedPanelVisible()
      ? t("gui.hideAdvancedEditor", "Hide advanced editor")
      : t("gui.showAdvancedEditor", "Show advanced editor"),
    fullScreen: viewer.FULLSCREEN
      ? t("fullscreen.exit", "Exit fullscreen")
      : t("fullscreen.enter", "Enter fullscreen"),
    clippingPlanes: viewer.clippingMode
      ? t("gui.disableClippingPlanesMode", "Disable clipping planes mode")
      : t("gui.enableClippingPlanesMode", "Enable clipping planes mode"),
    projection: core.camera && core.camera.isPerspectiveCamera
      ? t("gui.orthographicProjection", "Switch to orthographic projection")
      : t("gui.perspectiveProjection", "Switch to perspective projection"),
    wireframe: viewer.wireframeMode
      ? t("gui.disableWireframeMode", "Disable wireframe mode")
      : t("gui.enableWireframeMode", "Enable wireframe mode"),
    loadingLogs: viewer.showLoadingLogs
      ? t("gui.hideLoadingLogs", "Hide loading logs")
      : t("gui.showLoadingLogs", "Show loading logs"),
    hierarchy: t("gui.hierarchy", "Hierarchy"),
    materials: t("gui.materials", "Materials"),
    statistics: t("gui.statistics", "Statistics"),
    expand: viewer.isToolbarExpanded
      ? t("gui.collapse", "Collapse toolbar")
      : t("gui.expand", "Expand toolbar"),
    download: t("gui.download", "Download model"),
  };

  Object.entries(viewer.editorToolbarButtons).forEach(([key, button]) => {
    const label = labels[key] || key;
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
    const sr = button.querySelector(".viewer-editor-tool_sr");
    if (sr) sr.textContent = label;
  });

  if (viewer.clippingPlaneSubmenuButtons) {
    const clippingPlaneSubmenuLabels = {
      displayHelperX: t("gui.displayHelperX", "Show X helper"),
      displayHelperY: t("gui.displayHelperY", "Show Y helper"),
      displayHelperZ: t("gui.displayHelperZ", "Show Z helper"),
      visible: t("gui.visible", "Visible"),
    };
    Object.entries(viewer.clippingPlaneSubmenuButtons).forEach(([key, button]) => {
      const label = clippingPlaneSubmenuLabels[key] || key;
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
    });
  }

  if (viewer.annotateSubmenuButtons) {
    const annotateSubmenuLabels = {
      annotateAdd: t("gui.addAnnotations", "Add Annotation"),
      annotateImport: t("gui.importAnnotationsXml", "Import Annotations"),
      annotateExport: t("gui.exportAnnotationsXml", "Export Annotations"),
    };
    Object.entries(viewer.annotateSubmenuButtons).forEach(([key, button]) => {
      const label = annotateSubmenuLabels[key] || key;
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
    });
  }

  if (viewer.statisticsSubmenuButtons) {
    const statisticsSubmenuLabels = {
      toggleStats: t("gui.statistics", "Statistics"),
      performance: t("gui.performance", "Performance"),
      performanceDefault: t("gui.default", "Default"),
      performanceHigh: t("gui.highPerformance", "High-performance"),
      performanceLow: t("gui.lowPower", "Low-power"),
    };
    Object.entries(viewer.statisticsSubmenuButtons).forEach(([key, button]) => {
      const label = statisticsSubmenuLabels[key] || key;
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
    });
  }

  if (viewer.lightsSubmenuButtons) {
    const lightsSubmenuLabels = {
      environmentMap: t("gui.environmentMap", "Environment map"),
      lightTargetTransformMove: t("gui.move", "Move"),
      lightTargetTransformTarget: t("gui.target", "Target"),
      environmentMapToggle: t("gui.environmentMapToggle", "Environment map"),
      environmentMapIntensity: t("gui.intensity", "Intensity"),
      environmentMapStyleNeutral: t("gui.environmentMapNeutral", "Neutral"),
      environmentMapStyleSunny: t("gui.environmentMapSunny", "Sunny"),
      environmentMapStyleStudio: t("gui.environmentMapStudio", "Studio"),
      environmentMapStyleGoldenHour: t("gui.environmentMapGoldenHour", "Golden Hour"),
    };
    Object.entries(viewer.lightsSubmenuButtons).forEach(([key, button]) => {
      const label = lightsSubmenuLabels[key] || key;
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
    });
  }

  if (viewer.hierarchyClearButton) {
    const label = t("gui.clearSelectedHierarchy", "Clear selected objects");
    viewer.hierarchyClearButton.setAttribute("title", label);
    viewer.hierarchyClearButton.setAttribute("aria-label", label);
    viewer.hierarchyClearButton.textContent = label;
  }

  if (viewer.saveSubmenuCheckboxes) {
    const saveSubmenuLabels = {
      Position: t("gui.position", "Position"),
      Rotation: t("gui.rotation", "Rotation"),
      Scale: t("gui.scale", "Scale"),
      Camera: t("gui.camera", "Camera"),
      DirectionalLight: t("gui.directionalLight", "Directional Light"),
      AmbientLight: t("gui.ambientLight", "Ambient Light"),
      CameraLight: t("gui.cameraLight", "Camera Light"),
      BackgroundColor: t("gui.backgroundColor", "Background Color"),
    };
    Object.entries(viewer.saveSubmenuCheckboxes).forEach(([key, elements]) => {
      const label = saveSubmenuLabels[key] || key;
      elements.row.setAttribute("title", label);
      elements.row.setAttribute("aria-label", label);
      elements.text.textContent = label;
      elements.checkbox.checked = Boolean(viewer.saveProperties[key]);
    });
  }

  if (viewer.saveSubmenuActionButton) {
    viewer.saveSubmenuActionButton.textContent = t("gui.saveSettings", "Save settings");
  }

  core.editorToolbar?.setAttribute("aria-label", t("toolbar.editor", "Editor tools"));
  viewer.editorToolbarButtons.expand?.setAttribute("aria-expanded", viewer.isToolbarExpanded ? "true" : "false");
}

export function updateEditorToolbarState(viewer) {
  if (!viewer.editorToolbarButtons) return;

  const activeMap = {
    moveToolbar: viewer.transformText["Transform 3D Object"] === "translate" || viewer.transformText["Transform 3D Object"] === "rotate" || viewer.transformText["Transform 3D Object"] === "scale",
    orbit: viewer.transformText["Transform 3D Object"] === "",
    move: viewer.transformText["Transform 3D Object"] === "translate",
    rotate: viewer.transformText["Transform 3D Object"] === "rotate",
    scale: viewer.transformText["Transform 3D Object"] === "scale",
    picking: viewer.pickingMode === true,
    ruler: viewer.RULER_MODE === true,
    clippingPlanes: viewer.clippingMode === true,
    advancedEditor: viewer.isEditorAdvancedPanelVisible(),
    fullScreen: viewer.FULLSCREEN === true,
    loadingLogs: viewer.showLoadingLogs === true,
    wireframe: viewer.wireframeMode === true,
    download: false,
  };

  Object.entries(viewer.editorToolbarButtons).forEach(([key, button]) => {
    const isActive = activeMap[key] === true;
    button.classList.toggle("is-active", isActive);
    if (button.dataset.pressed === "true") {
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    } else {
      button.removeAttribute("aria-pressed");
    }
  });

  updateHierarchySubmenuState(viewer);
  updateClippingPlanesSubmenuState(viewer);
  updateLightsSubmenuState(viewer);
  updateStatisticsSubmenuState(viewer);
}
