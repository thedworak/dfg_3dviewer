import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";

// Annotation cards (toggled from the guided tour panel): every annotation as
// a card in a vertical deck under the tour panel. Cards are sticky, each one
// a title strip lower than the one before, so scrolling the deck slides them
// over each other like a stack of cards - the ones above stay visible by
// their number and title. The deck starts folded: every card shows only its
// number and title, piled up. Clicking a card unfolds it (its description;
// one card at a time), brings it to the front and goes to its tour step;
// clicking it again folds it back. The current tour step is unfolded and
// brought to the front as the tour moves on. Native scrolling makes it work
// with touch on phones; after scrolling the deck settles on the nearest card.
// Exclusive with the spread cards.

const GAP = 8; // between cards in the deck
const MIN_STEP = 14; // smallest visible strip of a covered card
const STACKED_SHARE = 0.55; // of the deck height, at most, for covered strips
const BOTTOM_MARGIN = 12; // between the deck and the toolbar / viewer edge
const SETTLE_DELAY = 140; // ms after the last scroll event
const FOLD_OVERLAP = 6; // of a folded card hidden under the next one

export function attachAnnotationStack(Viewer) {
  Object.assign(Viewer, {
    annotationStack: false,
    annotationStackState: null,

    setAnnotationStack(enabled) {
      const next = enabled === true;
      if (next && !Viewer.getTourSteps?.().length) return false;
      Viewer.annotationStack = next;
      if (next && Viewer.annotationSpread) Viewer.setAnnotationSpread?.(false);
      if (next) Viewer.rebuildAnnotationStack();
      else Viewer.disposeAnnotationStack();
      Viewer.syncTourStackToggle?.();
      return true;
    },

    toggleAnnotationStack() {
      return Viewer.setAnnotationStack(!Viewer.annotationStack);
    },

    disposeAnnotationStack() {
      const state = Viewer.annotationStackState;
      if (!state) return;
      window.clearTimeout(state.settleTimer);
      state.resizeObserver?.disconnect();
      state.deck.remove();
      Viewer.annotationStackState = null;
    },

    // (Re)creates the deck from the current annotations. Called when it is
    // switched on, when annotations change and on language change.
    rebuildAnnotationStack() {
      if (!Viewer.annotationStack) return;
      const steps = Viewer.getTourSteps?.() || [];
      const stack = getViewerSideStack();
      if (!steps.length || !stack) {
        Viewer.annotationStack = false;
        Viewer.disposeAnnotationStack();
        Viewer.syncTourStackToggle?.();
        return;
      }

      const previousScroll = Viewer.annotationStackState?.deck.scrollTop ?? 0;
      const previousOpenId = Viewer.annotationStackState?.cards[Viewer.annotationStackState.open]?.id;
      Viewer.disposeAnnotationStack();

      const deck = document.createElement("div");
      deck.className = "annotation-stack";
      deck.setAttribute("role", "list");
      deck.setAttribute("aria-label", t("tour.stackLayer", "Annotation cards"));

      const cards = steps.map(({ entry, markerNumber }, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "annotation-stack-card";
        card.setAttribute("role", "listitem");
        card.style.setProperty("--annotation-stack-index", String(index));
        const badge = document.createElement("span");
        badge.className = "annotation-stack-card_number";
        badge.textContent = String(markerNumber);
        const title = document.createElement("span");
        title.className = "annotation-stack-card_title";
        title.textContent = entry.title || t("tour.untitled", "Untitled annotation");
        const header = document.createElement("span");
        header.className = "annotation-stack-card_header";
        header.append(badge, title);
        card.appendChild(header);
        if (entry.description) {
          const description = document.createElement("span");
          description.className = "annotation-stack-card_description";
          description.textContent = entry.description;
          card.appendChild(description);
        }
        card.title = title.textContent;
        card.setAttribute("aria-expanded", "false");
        card.addEventListener("click", () => {
          if (Viewer.annotationStackState?.open === index) {
            Viewer.setAnnotationStackOpen(-1);
            return;
          }
          Viewer.setAnnotationStackOpen(index);
          Viewer.goToAnnotationSpreadStep?.(index);
        });
        deck.appendChild(card);
        return { id: String(entry.id), card, header };
      });

      // Lets the last card scroll up to its place in the stack.
      const spacer = document.createElement("div");
      spacer.className = "annotation-stack_spacer";
      spacer.setAttribute("aria-hidden", "true");
      deck.appendChild(spacer);

      // Keep input on the deck away from the orbit controls and the
      // viewer's own shortcuts.
      ["pointerdown", "pointerup", "wheel", "touchstart", "touchmove"].forEach((type) => {
        deck.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
      });
      deck.addEventListener("keydown", (event) => {
        event.stopPropagation();
        const focusedIndex = cards.findIndex(({ card }) => card === document.activeElement);
        if (focusedIndex < 0) return;
        const nextIndex = event.key === "ArrowDown" ? focusedIndex + 1
          : event.key === "ArrowUp" ? focusedIndex - 1 : -1;
        if (nextIndex < 0 || nextIndex >= cards.length) return;
        event.preventDefault();
        cards[nextIndex].card.focus({ preventScroll: true });
        Viewer.scrollAnnotationStackTo(nextIndex);
      });

      const state = {
        deck,
        spacer,
        cards,
        step: 0,
        tops: [],
        focused: -1,
        open: -1,
        currentId: null,
        containerHeight: 0,
        settleTimer: null,
        resizeObserver: null,
      };
      Viewer.annotationStackState = state;

      deck.addEventListener("scroll", () => {
        Viewer.updateAnnotationStackFocus();
        window.clearTimeout(state.settleTimer);
        state.settleTimer = window.setTimeout(() => Viewer.settleAnnotationStack(), SETTLE_DELAY);
      }, { passive: true });

      // Right under the tour panel, in the same column.
      const tourPanel = stack.querySelector(":scope > .viewer-tour-panel");
      if (tourPanel) tourPanel.after(deck);
      else stack.appendChild(deck);

      // The tour panel above changing height (another step's description)
      // moves the deck - keep it within the viewer.
      state.resizeObserver = new ResizeObserver(() => Viewer.layoutAnnotationStack());
      if (tourPanel) state.resizeObserver.observe(tourPanel);
      if (core.container) state.resizeObserver.observe(core.container);

      const reopen = cards.findIndex(({ id }) => id === previousOpenId);
      if (reopen >= 0) Viewer.setAnnotationStackOpen(reopen, { scroll: false });
      Viewer.layoutAnnotationStack();
      deck.scrollTop = previousScroll;
      Viewer.updateAnnotationStack();
      Viewer.updateAnnotationStackFocus();
    },

    // Deck height (what is left of the viewer below it), the strip each
    // covered card keeps visible, and where each card sits unscrolled.
    layoutAnnotationStack() {
      const state = Viewer.annotationStackState;
      if (!state?.deck.isConnected || !core.container) return;
      const { deck, cards, spacer } = state;
      const containerRect = core.container.getBoundingClientRect();
      const deckTop = deck.getBoundingClientRect().top;
      let bottom = containerRect.bottom - BOTTOM_MARGIN;
      const toolbar = core.editorToolbar;
      if (toolbar && !toolbar.hidden) {
        const toolbarRect = toolbar.getBoundingClientRect();
        if (toolbarRect.height > 0 && toolbarRect.top > deckTop) bottom = Math.min(bottom, toolbarRect.top - GAP);
      }
      const maxHeight = Math.max(120, Math.round(bottom - deckTop));
      deck.style.maxHeight = `${maxHeight}px`;
      state.containerHeight = containerRect.height;

      const folded = cards.find(({ card }) => !card.classList.contains("is-open"))?.card;
      const strip = folded ? folded.offsetHeight - FOLD_OVERLAP : 32;
      const covered = Math.max(cards.length - 1, 1);
      const step = Math.round(Math.max(MIN_STEP, Math.min(strip, (maxHeight * STACKED_SHARE) / covered)));
      state.step = step;
      deck.style.setProperty("--annotation-stack-step", `${step}px`);

      // Natural (unstuck) positions, from the cards' own heights. A folded
      // card is followed one step lower, so folded cards pile up; an open
      // one keeps its whole height in view.
      let top = parseFloat(getComputedStyle(deck).paddingTop || "0");
      state.tops = cards.map(({ card }) => {
        const cardTop = top;
        const height = card.offsetHeight;
        const advance = card.classList.contains("is-open") ? height + GAP : step;
        card.style.marginBottom = `${advance - height}px`;
        top += advance;
        return cardTop;
      });

      // Room to scroll the last card up to its place in the stack - only
      // needed once the deck is taller than the space it has.
      spacer.style.height = "0px";
      const last = cards[cards.length - 1]?.card;
      const lastHeight = last?.offsetHeight || 0;
      const contentHeight = (state.tops[cards.length - 1] ?? 0) + lastHeight;
      spacer.style.height = contentHeight > maxHeight
        ? `${Math.max(0, Math.round(maxHeight - lastHeight - (cards.length - 1) * step))}px`
        : "0px";
    },

    // Unfolds card `index` (folding the one open before), or folds them all
    // with -1, and brings it to the front.
    setAnnotationStackOpen(index, { scroll = true } = {}) {
      const state = Viewer.annotationStackState;
      if (!state) return;
      state.open = index >= 0 && index < state.cards.length ? index : -1;
      state.cards.forEach(({ card }, cardIndex) => {
        const open = cardIndex === state.open;
        card.classList.toggle("is-open", open);
        card.setAttribute("aria-expanded", open ? "true" : "false");
      });
      Viewer.layoutAnnotationStack();
      if (scroll && state.open >= 0) Viewer.scrollAnnotationStackTo(state.open);
    },

    // Scroll position at which card `index` is at the front of the stack.
    getAnnotationStackTarget(index) {
      const state = Viewer.annotationStackState;
      if (!state) return 0;
      return Math.max(0, (state.tops[index] ?? 0) - index * state.step);
    },

    scrollAnnotationStackTo(index, { smooth = true } = {}) {
      const state = Viewer.annotationStackState;
      if (!state || index < 0 || index >= state.cards.length) return;
      state.deck.scrollTo({
        top: Viewer.getAnnotationStackTarget(index),
        behavior: smooth ? "smooth" : "auto",
      });
    },

    // The card at the front: the last one already slid into the stack.
    updateAnnotationStackFocus() {
      const state = Viewer.annotationStackState;
      if (!state) return;
      const scrollTop = state.deck.scrollTop;
      let focused = 0;
      state.cards.forEach((_, index) => {
        if (scrollTop >= Viewer.getAnnotationStackTarget(index) - 4) focused = index;
      });
      if (focused === state.focused) return;
      state.focused = focused;
      state.cards.forEach(({ card }, index) => {
        card.classList.toggle("is-front", index === focused);
        card.classList.toggle("is-covered", index < focused);
      });
    },

    // After scrolling, settle on the nearest card instead of between two.
    settleAnnotationStack() {
      const state = Viewer.annotationStackState;
      if (!state) return;
      const scrollTop = state.deck.scrollTop;
      const maxScroll = state.deck.scrollHeight - state.deck.clientHeight;
      if (scrollTop <= 1 || scrollTop >= maxScroll - 1) return;
      let nearest = 0;
      let distance = Infinity;
      state.cards.forEach((_, index) => {
        const d = Math.abs(Viewer.getAnnotationStackTarget(index) - scrollTop);
        if (d < distance) {
          distance = d;
          nearest = index;
        }
      });
      if (distance > 1) Viewer.scrollAnnotationStackTo(nearest);
    },

    // Called from the render loop: follows the tour's current step and the
    // viewer's height.
    updateAnnotationStack() {
      const state = Viewer.annotationStackState;
      if (!state) return;
      if (core.container && core.container.getBoundingClientRect().height !== state.containerHeight) {
        Viewer.layoutAnnotationStack();
      }
      const currentId = Viewer.isTourActive?.()
        ? String(Viewer.tourState?.steps?.[Viewer.tourState.index]?.entry?.id ?? "")
        : "";
      if (currentId === state.currentId) return;
      state.currentId = currentId;
      let currentIndex = -1;
      state.cards.forEach(({ id, card }, index) => {
        const current = id === currentId;
        card.classList.toggle("is-current", current);
        if (current) {
          card.setAttribute("aria-current", "step");
          currentIndex = index;
        } else {
          card.removeAttribute("aria-current");
        }
      });
      if (currentIndex >= 0) Viewer.setAnnotationStackOpen(currentIndex);
    },
  });
}
