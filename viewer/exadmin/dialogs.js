import { t } from "../i18n-utils.js";

// Replaces window.confirm(), styled like the viewer's (upload-panel.css
// .viewer-confirm). Resolves true on confirm, false on cancel, Escape or a
// click beside it.
export function confirmDialog({ message, confirmLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "viewer-confirm-backdrop exadmin-confirm-backdrop";
    backdrop.innerHTML = `
      <div class="viewer-confirm" role="alertdialog" aria-modal="true" aria-describedby="exadminConfirmMessage">
        <p id="exadminConfirmMessage" class="viewer-confirm-message"></p>
        <div class="viewer-confirm-actions">
          <button type="button" class="viewer-confirm-cancel"></button>
          <button type="button" class="viewer-confirm-ok${danger ? " viewer-confirm-ok--danger" : ""}"></button>
        </div>
      </div>`;
    backdrop.querySelector(".viewer-confirm-message").textContent = message;
    const cancel = backdrop.querySelector(".viewer-confirm-cancel");
    const ok = backdrop.querySelector(".viewer-confirm-ok");
    cancel.textContent = cancelLabel;
    ok.textContent = confirmLabel;

    const finish = (value) => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) finish(false);
    });

    document.body.appendChild(backdrop);
    cancel.focus();
  });
}

const TOAST_MS = 3500;

// A short message in the corner: `key` from the viewer's toasts.* texts.
export function toast(key, tone = "info") {
  let host = document.getElementById("exadminToasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "exadminToasts";
    host.className = "exadmin-toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const item = document.createElement("div");
  item.className = "exadmin-toast";
  item.dataset.tone = tone;
  item.textContent = t(`toasts.${key}`, key);
  host.appendChild(item);
  setTimeout(() => item.remove(), TOAST_MS);
}
