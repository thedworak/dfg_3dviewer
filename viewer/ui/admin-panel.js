import { t } from "../i18n-utils.js";
import { isAppBuild, remoteBase } from "../remote.js";

// The administration (users, models, statistics, reports, history) is a
// page of its own, exadmin/ (viewer/exadmin/), which every build puts next
// to the viewer's page. On the web it opens in a new tab, from the page
// wherever the viewer is served: /exadmin/ at a host's root,
// /viewer/exadmin/ where the viewer lives in a folder of a site. In the app
// it is the copy inside the app, shown in a frame over the viewer and told
// which repository to administer (?app=1&remote=...): it takes the app's
// session token from where remote.js keeps it, and asks for the
// administrator's second step itself. Closing it, or opening a model from
// it, comes back as a message (exadmin/app-bridge.js).
// The account bar only shows the button to admins.
function adminPageUrl() {
  if (isAppBuild()) {
    const params = new URLSearchParams({ app: "1", remote: remoteBase() });
    return new URL(`exadmin/index.html?${params}`, document.baseURI).href;
  }
  return new URL("exadmin/", document.baseURI).href;
}

export function attachAdminPanel(Viewer) {
  Object.assign(Viewer, {
    isAdminUser() {
      return Boolean(this.authState?.required && this.authState?.user && this.authState?.role === "admin");
    },

    updateAdminMenuEntryState() {
      if (!this.manageUsersButton) return;
      const show = this.isAdminUser();
      this.manageUsersButton.hidden = !show;
      if (!show) {
        this.closeAdminOverlay?.();
        return;
      }
      this.manageUsersButton.innerHTML = `<span class="admin-users-icon" aria-hidden="true"></span>`;
      const a11yLabel = t("menu.openAdminPanel", "Administration (users, plans, limits)");
      this.manageUsersButton.setAttribute("aria-label", a11yLabel);
      this.manageUsersButton.setAttribute("title", a11yLabel);
    },

    // On the web in a new tab: the model on screen stays. In the app over
    // the viewer, which stays as it is underneath.
    openAdminPage(event) {
      event?.preventDefault?.();
      if (!this.isAdminUser()) return;
      if (isAppBuild()) this.openAdminOverlay();
      else window.open(adminPageUrl(), "_blank", "noopener");
    },

    openAdminOverlay() {
      if (this.adminOverlay) return;
      const overlay = document.createElement("div");
      overlay.className = "viewer-admin-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", t("menu.openAdminPanel", "Administration (users, plans, limits)"));
      const frame = document.createElement("iframe");
      frame.src = adminPageUrl();
      frame.title = overlay.getAttribute("aria-label");
      overlay.appendChild(frame);
      document.body.appendChild(overlay);
      this.adminOverlay = overlay;

      this.adminOverlayMessages = (message) => {
        if (message.source !== frame.contentWindow || message.origin !== location.origin) return;
        const data = message.data || {};
        if (data.source !== "exadmin") return;
        if (data.type === "close") this.closeAdminOverlay();
        if (data.type === "open-model" && data.job?.modelUrl) {
          this.closeAdminOverlay();
          this.loadModelFromList?.(data.job);
        }
      };
      window.addEventListener("message", this.adminOverlayMessages);
      // Escape (a keyboard) closes it as well as its own back link.
      this.adminOverlayBack = (event) => {
        if (event.key === "Escape") this.closeAdminOverlay();
      };
      document.addEventListener("keydown", this.adminOverlayBack);
    },

    closeAdminOverlay() {
      if (!this.adminOverlay) return;
      window.removeEventListener("message", this.adminOverlayMessages);
      document.removeEventListener("keydown", this.adminOverlayBack);
      this.adminOverlay.remove();
      this.adminOverlay = null;
      // A login or a second step there may have renewed the session token:
      // the account area reads it again.
      this.refreshAuthState?.();
    },
  });
}
