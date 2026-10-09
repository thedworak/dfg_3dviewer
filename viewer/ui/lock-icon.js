// The small padlock next to a control that is not available (see
// hasFeature() in app-features.js).
export function createLockIcon() {
  const icon = document.createElement("span");
  icon.className = "plan-lock-icon";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}
