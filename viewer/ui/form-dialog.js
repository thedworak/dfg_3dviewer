import { core } from "../core.js";

// A confirmation dialog with fields (the look of confirmDialog in
// upload-panel.js, .viewer-confirm): deleting an account with its password,
// reporting a model. `body` is the dialog's content; onConfirm() runs on the
// confirm button and keeps the dialog open while it runs - a thrown error
// is shown in it, and it stays open for another try. Resolves with
// onConfirm's result, or null on cancel, Escape or a click beside it.
export function openFormDialog({ title, body, confirmLabel, cancelLabel, danger = false, onConfirm }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "viewer-confirm-backdrop";
    const dialog = document.createElement("form");
    dialog.className = "viewer-confirm viewer-form-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.noValidate = true;
    if (title) {
      const heading = document.createElement("h3");
      heading.className = "viewer-form-dialog-title";
      heading.id = `viewerFormDialog${Date.now()}`;
      heading.textContent = title;
      dialog.setAttribute("aria-labelledby", heading.id);
      dialog.appendChild(heading);
    }
    if (body) dialog.appendChild(body);
    const error = document.createElement("p");
    error.className = "viewer-form-dialog-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "viewer-confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "viewer-confirm-cancel";
    cancel.textContent = cancelLabel;
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.className = `viewer-confirm-ok${danger ? " viewer-confirm-ok--danger" : ""}`;
    ok.textContent = confirmLabel;
    actions.append(cancel, ok);
    dialog.append(error, actions);
    backdrop.appendChild(dialog);

    let busy = false;
    const finish = (value) => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    cancel.addEventListener("click", () => !busy && finish(null));
    backdrop.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.target === backdrop && !busy) finish(null);
    });
    // Keys typed into the fields stay out of the viewer's shortcuts.
    dialog.addEventListener("keydown", (event) => event.stopPropagation());
    dialog.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      ok.disabled = true;
      cancel.disabled = true;
      error.hidden = true;
      try {
        finish(onConfirm ? await onConfirm() : true);
      } catch (failure) {
        error.textContent = failure?.message || String(failure);
        error.hidden = false;
        busy = false;
        ok.disabled = false;
        cancel.disabled = false;
      }
    });

    (core.container || document.body).appendChild(backdrop);
    (dialog.querySelector("input, select, textarea") || cancel).focus();
  });
}
