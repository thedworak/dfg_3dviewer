// Menus that open on hover, on a desktop (a mouse that can hover): the page
// header's buttons with their windows (main.js) and the toolbar's menus and
// submenus (ui/menu-toolbar.js). Moving onto the trigger opens what it
// opens; moving off both the trigger and what opened closes it again after
// a moment. A click on the trigger or a press inside keeps it open, as if
// it had been opened by a click - forms in it are not lost to a slip of
// the mouse. Touch and pen keep the taps.

const CLOSE_DELAY_MS = 300;
// Passing over a trigger on the way elsewhere opens nothing.
const OPEN_DELAY_MS = 150;

export function canHoverOpen() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)").matches === true;
}

// `panel()`: the element that opens (created on the first opening, maybe);
// `isOpen()`, `open()`, `close()`; `enabled()`: false where hover should do
// nothing (e.g. the phone layouts); `immediate()`: true to open without the
// short wait (another menu of the bar already open). Returns
// `consumeClick()`, for the trigger's click handler: true when the click
// only kept a hover-opened panel open (and the handler should do nothing
// else).
export function bindHoverOpen(Viewer, trigger, { panel, isOpen, open, close, enabled = () => true, immediate = () => false }) {
  let hoverOpened = false;
  let timer = null;
  let openTimer = null;
  const boundPanels = new WeakSet();

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  const pin = () => {
    hoverOpened = false;
    cancel();
  };
  const isInside = (node) => Boolean(node) && (trigger.contains(node) || panel()?.contains(node));
  const leave = (event) => {
    if (event.pointerType !== "mouse" || isInside(event.relatedTarget)) return;
    clearTimeout(openTimer);
    openTimer = null;
    if (!hoverOpened) return;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (hoverOpened && isOpen()) close();
      hoverOpened = false;
    }, CLOSE_DELAY_MS);
  };
  const bindPanel = () => {
    const element = panel();
    if (!element || boundPanels.has(element)) return;
    boundPanels.add(element);
    Viewer.bindEventListener(element, "pointerenter", (event) => {
      if (event.pointerType === "mouse") cancel();
    });
    Viewer.bindEventListener(element, "pointerleave", leave);
    Viewer.bindEventListener(element, "pointerdown", pin);
    Viewer.bindEventListener(element, "input", pin);
  };

  const openNow = () => {
    openTimer = null;
    if (isOpen() || !enabled()) return;
    open();
    hoverOpened = isOpen();
    if (hoverOpened) bindPanel();
  };
  Viewer.bindEventListener(trigger, "pointerenter", (event) => {
    if (event.pointerType !== "mouse" || !canHoverOpen() || !enabled()) return;
    cancel();
    if (isOpen()) return;
    clearTimeout(openTimer);
    if (immediate()) openNow();
    else openTimer = setTimeout(openNow, OPEN_DELAY_MS);
  });
  Viewer.bindEventListener(trigger, "pointerleave", leave);

  return {
    consumeClick() {
      clearTimeout(openTimer);
      openTimer = null;
      if (!hoverOpened || !isOpen()) return false;
      pin();
      return true;
    },
  };
}
