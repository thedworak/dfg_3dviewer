import { core } from "../core.js";
import { closeIfcPanel, isIfcPanelOpen } from "../ifc-properties.js";
import { closeMetadataWindow, isMetadataWindowOpen } from "../metadata.js";
import { isAppBuild } from "../remote.js";
import { closeOpenPanelWindow, hasOpenPanelWindow } from "./panel-window.js";

// Back: one step out of what is open - the context menu, a dialog, a
// window, the element's properties, elements isolated or highlighted, a
// measurement's last point - the last layer first. Escape (when nothing
// else used it), the mouse's back button over the viewer, a two-finger tap
// (editor/context-menu.js) and, on a phone or in the app, the system's back
// gesture or button (through the page history) take it.
//
// Phones and the app: while something is open, the page has one history
// entry of its own, so the back gesture closes it instead of leaving the
// page (in the app, Android's back button goes back in the web view's
// history first). Not in an iframe: the history is the embedding page's.

// The topmost first; each: is it open, close it.
function backSteps(Viewer) {
  const dialogOpen = (dialog) => Boolean(dialog && !dialog.hidden);
  return [
    // The camera with a historical photo over it, full screen (editor/photo-onsite.js).
    [() => Viewer.isPhotoOnSiteOpen?.(), () => Viewer.closePhotoOnSite()],
    [() => Viewer.isContextMenuOpen?.(), () => Viewer.closeContextMenu()],
    [() => Viewer.isToolbarMenuOpen?.(), () => Viewer.openToolbarMenu(null)],
    [() => dialogOpen(Viewer.annotationDialog), () => Viewer.closeAnnotationDialog()],
    // Picking a material on the model (editor/materials-editor.js).
    [() => Viewer.isMaterialPicking?.(), () => Viewer.setMaterialPicking(false)],
    [() => dialogOpen(Viewer.shadingDialog), () => Viewer.closeShadingDialog()],
    [hasOpenPanelWindow, closeOpenPanelWindow],
    [() => Viewer.isIfcQueryOpen?.(), () => Viewer.closeIfcQuery()],
    // "Show only this element" / "Select all of this type" (context menu),
    // undone before the element's properties close.
    [() => !Viewer.isIfcQueryOpen?.() && Viewer.isIfcQueryViewActive?.(), () => Viewer.resetIfcQueryView()],
    [isIfcPanelOpen, closeIfcPanel],
    [isMetadataWindowOpen, closeMetadataWindow],
    [() => Viewer.isTourActive?.(), () => Viewer.stopTour()],
    [() => Boolean(Viewer.RULER_MODE && Viewer.measurementDraft), () => Viewer.undoMeasurementPoint()],
    [() => Boolean(Viewer.pickingMode && Viewer.selectedFaces?.length), () => Viewer.clearSelectedFaces()],
  ];
}

const HISTORY_KEY = "explora4dBack";

function useHistory() {
  if (window.self !== window.top) return false;
  return isAppBuild() || window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function attachBackNavigation(Viewer) {
  Object.assign(Viewer, {
    canGoBack() {
      return backSteps(Viewer).some(([isOpen]) => isOpen());
    },

    // Closes the topmost open layer; false when nothing was open.
    goBack() {
      const step = backSteps(Viewer).find(([isOpen]) => isOpen());
      if (!step) return false;
      step[1]();
      Viewer.syncBackHistory?.();
      return true;
    },

    bindBackNavigation() {
      // After the other key handlers: Escape a field, a dialog or the
      // canvas used for itself (preventDefault) is not a step back too.
      Viewer.bindEventListener(document, "keydown", (event) => {
        if (event.key !== "Escape" || event.isComposing) return;
        // Escape in a field with text clears it first.
        if (event.target instanceof Element && event.target.matches("input, textarea") && event.target.value) return;
        setTimeout(() => {
          if (!event.defaultPrevented) Viewer.goBack();
        }, 0);
      }, true);

      // The mouse's back button: the browser goes back on its release
      // unless that is prevented - only when something was closed.
      if (core.container) {
        Viewer.bindEventListener(core.container, "mouseup", (event) => {
          if (event.button === 3 && Viewer.goBack()) event.preventDefault();
        });
      }

      if (useHistory()) Viewer.bindBackHistory();
    },

    bindBackHistory() {
      let pushed = false;
      let ignorePop = false;
      let pending = 0;

      // One entry while something is open, none when all is closed (also
      // when it was closed by its own button).
      Viewer.syncBackHistory = () => {
        const open = Viewer.canGoBack();
        if (open && !pushed) {
          history.pushState({ ...(history.state || {}), [HISTORY_KEY]: true }, "");
          pushed = true;
        } else if (!open && pushed) {
          pushed = false;
          if (history.state?.[HISTORY_KEY]) {
            ignorePop = true;
            history.back();
          }
        }
      };

      Viewer.bindEventListener(window, "popstate", () => {
        if (ignorePop) {
          ignorePop = false;
          return;
        }
        if (!pushed) return;
        pushed = false;
        Viewer.goBack();
      });

      // Panels open from taps, keys and loaded data alike: their DOM
      // changing is when to look again.
      const observer = new MutationObserver(() => {
        clearTimeout(pending);
        pending = setTimeout(Viewer.syncBackHistory, 50);
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"] });
      Viewer.addCleanup(() => {
        observer.disconnect();
        clearTimeout(pending);
        Viewer.syncBackHistory = null;
      });
    },
  });
}
