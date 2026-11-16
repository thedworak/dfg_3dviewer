import { t } from "../i18n-utils.js";

// The row above the viewer (#viewer-page-header: the example picker, the
// upload, the repository, the account) on a phone: one round button in the
// viewer's top left corner instead of a row of its own, so the viewer takes
// the whole height of the screen. A tap drops the row down over the viewer;
// choosing a model, any of its buttons, a tap beside it or Escape folds it
// again. Larger screens keep the row (the button is not shown there:
// main.css).

const ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

export function foldPageHeader(viewer, header = document.getElementById("viewer-page-header")) {
  if (!header || header.dataset.folds === "true") return null;
  header.dataset.folds = "true";
  document.body.classList.add("viewer-page-header-folds");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "viewer-page-header-toggle";
  toggle.innerHTML = ICON;
  header.prepend(toggle);

  const label = () => {
    const text = t("pageHeader.toggle", "Models, files and account");
    toggle.title = text;
    toggle.setAttribute("aria-label", text);
  };
  label();

  const isOpen = () => header.classList.contains("is-open");
  const setOpen = (open) => {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  setOpen(false);

  const on = (target, type, handler, options) => {
    if (viewer?.bindEventListener) viewer.bindEventListener(target, type, handler, options);
    else target.addEventListener(type, handler, options);
  };
  on(toggle, "click", (event) => {
    event.stopPropagation();
    setOpen(!isOpen());
  });
  // A button of the row did its work (its panel opens under it first,
  // ui/panel-window.js): folded after the click. The select stays open
  // until a model is chosen.
  on(header, "click", (event) => {
    if (!isOpen() || toggle.contains(event.target)) return;
    if (event.target.closest("button") && !event.target.closest("select")) setTimeout(() => setOpen(false), 0);
  });
  on(header, "change", (event) => {
    if (event.target.matches?.("select")) setOpen(false);
  });
  on(document, "pointerdown", (event) => {
    if (isOpen() && !header.contains(event.target)) setOpen(false);
  }, true);
  on(document, "keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus({ preventScroll: true });
  });
  return { toggle, setOpen, isOpen, refreshLabels: label };
}
