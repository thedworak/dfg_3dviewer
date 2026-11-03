import { t } from "../i18n-utils.js";
import { isAppBuild, remoteAssetUrl } from "../remote.js";

// The administration (users, plans, limits) is a page of its own,
// exadmin/ (viewer/exadmin/), which every build puts next to the viewer's
// page - so on the web it is found from the page, wherever the viewer is
// served: /exadmin/ at a host's root, /viewer/exadmin/ where the viewer
// lives in a folder of a site. In the app: on the repository it is
// connected to.
// The account bar only links to it, for admins.
function adminPageUrl() {
  if (isAppBuild()) return remoteAssetUrl("/exadmin/");
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
      if (!show) return;
      this.manageUsersButton.innerHTML = `<span class="admin-users-icon" aria-hidden="true"></span>`;
      const a11yLabel = t("menu.openAdminPanel", "Administration (users, plans, limits)");
      this.manageUsersButton.setAttribute("aria-label", a11yLabel);
      this.manageUsersButton.setAttribute("title", a11yLabel);
    },

    // In a new tab: the model on screen stays.
    openAdminPage(event) {
      event?.preventDefault?.();
      if (!this.isAdminUser()) return;
      window.open(adminPageUrl(), "_blank", "noopener");
    },
  });
}
