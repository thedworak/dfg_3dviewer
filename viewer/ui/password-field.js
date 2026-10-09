import { t } from "../i18n-utils.js";

// A password input with an eye button that shows/hides what was typed.
// Returns { field, input }: `field` goes into the form, `input` is read for
// the value. Styles: .password-field in upload-panel.css.
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>';

export function createPasswordField({ autocomplete = "current-password" } = {}) {
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
