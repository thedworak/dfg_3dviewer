import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { isAppBuild } from "../remote.js";
import { updateViewer } from "../app-hooks.js";
import { openFormDialog } from "./form-dialog.js";

// A manifest of a newer format than this viewer reads
// (manifesto/manifest-version.js): what the person is told, and the way to a
// newer viewer - the page loaded again, or the app's store page
// (app-hooks.js updateViewer).

// The up arrow beside such a manifest in the lists (examples-panel.js).
export const UPDATE_ARROW = "⬆";

export function viewerUpdateLabel() {
  return isAppBuild()
    ? t("manifestUpdate.updateApp", "Update the app")
    : t("manifestUpdate.reloadPage", "Reload the page");
}

// The arrow's tooltip: a manifest this viewer opens without some of it
// (newer), or not at all (incompatible).
export function manifestUpdateHint(status) {
  const vars = { version: status.version, supported: status.supported };
  return status.blocking
    ? t("manifestUpdate.hintIncompatible", vars, "Made for a newer viewer (format {version}, this one reads {supported}): update to open it")
    : t("manifestUpdate.hintNewer", vars, "Made for a newer viewer (format {version}, this one reads {supported}): update to see all of it");
}

// A manifest that does not open: a dialog that says why, with the way to a
// newer viewer. `detail`: the validator's errors (shown in the console).
let dialogOpen = false;
export async function showManifestUpdateDialog(status, detail = "") {
  if (detail) console.warn("AIM3D manifest of a newer format:", detail);
  if (dialogOpen) return;
  dialogOpen = true;
  const body = document.createElement("div");
  const text = document.createElement("p");
  text.textContent = t(
    "manifestUpdate.body",
    { version: status.version, supported: status.supported },
    "This manifest was made for a newer version of the viewer (manifest format {version}; this viewer reads up to {supported}). Update the viewer to open it.",
  );
  body.appendChild(text);
  try {
    const update = await openFormDialog({
      title: `${UPDATE_ARROW} ${t("manifestUpdate.title", "A newer viewer is needed")}`,
      body,
      confirmLabel: viewerUpdateLabel(),
      cancelLabel: t("manifestUpdate.close", "Not now"),
    });
    if (update) updateViewer();
  } finally {
    dialogOpen = false;
  }
}

// A manifest that opens, with what this viewer does not know left out.
export function showManifestNewerNotice(status) {
  toastHelper("manifestNewerVersion", "warning", {
    version: status.version,
    supported: status.supported,
    duration: 9000,
    key: "manifest-newer-version",
    replace: true,
  });
}
