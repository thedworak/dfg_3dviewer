import { core } from "../core.js";
import { syncNoticeAboveToolbar } from "../editor-toolbar.js";
import { t } from "../i18n-utils.js";
import { recordEvent } from "./event-log-store.js";

export function attachLoadingStatus(viewer) {
  Object.assign(viewer, {
    getLoadingLogMessages() {
      return this.loadingLogMessageKeys.map((key) => t(key));
    },

    getProcessingLoadingSteps() {
      return this.processingLoadingStepKeys.map((key) => t(key));
    },

    createModelLoadingProgress(shell) {
      shell.className = "model-loader";
      shell.hidden = true;
      shell.setAttribute("role", "status");
      shell.setAttribute("aria-live", "polite");

      const ring = document.createElement("div");
      ring.className = "model-loader__ring";
      ring.setAttribute("aria-hidden", "true");

      const percent = document.createElement("div");
      percent.className = "model-loader__percent";
      percent.textContent = "0%";
      ring.appendChild(percent);

      const content = document.createElement("div");
      content.className = "model-loader__content";

      const phase = document.createElement("div");
      phase.className = "model-loader__phase";
      phase.textContent = this.getLoadingLogMessages()[0] ?? t("loadingLog.loadingAssets", "Loading assets");

      const phaseViewport = document.createElement("div");
      phaseViewport.className = "model-loader__phase-viewport";

      const phaseList = document.createElement("div");
      phaseList.className = "model-loader__phase-list";

      phaseViewport.appendChild(phaseList);

      let messages = this.getLoadingLogMessages();
      let activeIndex = 0;
      const stageKeyToIndex = new Map(
        this.loadingLogMessageKeys.map((key, index) => [key, index])
      );
      const loadingModelKeyIndex = Math.max(
        0,
        stageKeyToIndex.get("loadingLog.loadingModel") ?? 0
      );
      let hideTimer = null;

      messages.forEach((msg) => {
        const item = document.createElement("div");
        item.className = "model-loader__phase-item";
        item.textContent = msg;
        phaseList.appendChild(item);
      });

      const clearHideTimer = () => {
        if (hideTimer) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
      };

      const updatePhase = (index) => {
        activeIndex = index;
        const itemHeight = phaseList.firstElementChild?.offsetHeight || 24;
        phaseList.style.transform = `translateY(-${index * itemHeight}px)`;
        phase.textContent = messages[index] || messages[loadingModelKeyIndex] || phase.textContent;
        Array.from(phaseList.children).forEach((item, itemIndex) => {
          item.toggleAttribute("data-active", itemIndex === index);
          item.toggleAttribute("data-near", itemIndex === index - 1 || itemIndex === index + 1);
        });
      };

      const track = document.createElement("div");
      track.className = "model-loader__track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", "0");
      content.append(phaseViewport, track);

      const bar = document.createElement("div");
      bar.className = "model-loader__bar";
      track.appendChild(bar);

      shell.replaceChildren(ring, content);

      // With the editor toolbar on screen the progress is drawn around it
      // (data-loading, --toolbar-load-progress; editor-toolbar.css) and this
      // card is kept for screen readers only (data-on-toolbar, main.css).
      let currentProgress = 0;
      const syncToolbar = (state) => {
        const toolbar = core.editorToolbar;
        const onToolbar = Boolean(toolbar?.isConnected && toolbar.style.display !== "none");
        shell.toggleAttribute("data-on-toolbar", onToolbar);
        if (!toolbar) return;
        if (state === "hidden" || !onToolbar) {
          delete toolbar.dataset.loading;
          return;
        }
        toolbar.style.setProperty("--toolbar-load-progress", String(currentProgress));
        toolbar.dataset.loading = state;
      };

      const applyProgress = (progress) => {
        currentProgress = progress;
        shell.style.setProperty("--model-loader-progress", String(progress));
        percent.textContent = `${progress}%`;
        bar.style.width = `${progress}%`;
        track.setAttribute("aria-valuenow", String(progress));
        if (!shell.hidden && !shell.dataset.complete) syncToolbar("active");
      };

      const set = (value = 0, maxValue = 100) => {
        const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
        const normalized = Number.isFinite(value) ? Math.min(Math.max(value / safeMax, 0), 1) : 0;
        applyProgress(Math.round(normalized * 100));
        updatePhase(loadingModelKeyIndex);
      };

      set(0, 100);

      return {
        getElement: () => shell,
        show: () => {
          clearHideTimer();
          shell.hidden = false;
          delete shell.dataset.complete;
          updatePhase(loadingModelKeyIndex);
          syncToolbar("active");
        },
        hide: () => {
          clearHideTimer();
          shell.hidden = true;
          delete shell.dataset.complete;
          syncToolbar("hidden");
        },
        setStage: (stageKey, progressValue = null) => {
          const index = stageKeyToIndex.get(stageKey);
          if (typeof index === "number") {
            updatePhase(index);
          }
          if (Number.isFinite(progressValue)) {
            applyProgress(Math.max(0, Math.min(Math.round(progressValue), 100)));
          }
        },
        complete: (delayMs = 4400) => {
          clearHideTimer();
          updatePhase(stageKeyToIndex.get("loadingLog.modelLoaded") ?? messages.length - 1);
          applyProgress(100);
          shell.dataset.complete = "true";
          syncToolbar("complete");
          hideTimer = window.setTimeout(() => {
            hideTimer = null;
            delete shell.dataset.complete;
            shell.hidden = true;
            syncToolbar("hidden");
          }, delayMs);
        },
        // Re-translates the phase messages after a language change.
        relocalize: () => {
          messages = this.getLoadingLogMessages();
          Array.from(phaseList.children).forEach((item, itemIndex) => {
            item.textContent = messages[itemIndex] ?? item.textContent;
          });
          phase.textContent = messages[activeIndex] || messages[loadingModelKeyIndex] || phase.textContent;
        },
        set,
        reset: (maxValue = 100) => {
          clearHideTimer();
          delete shell.dataset.complete;
          set(0, maxValue);
        },
      };
    },

    // The loading steps go into the event log (ui/event-log-store.js); the
    // progress itself is shown by createModelLoadingProgress().
    createLoadingLog() {
      let active = false;
      let startedAt = 0;
      let lastStageKey = "";
      const record = (message, extra = {}) => recordEvent({ tone: "info", message, source: "loading", quiet: true, ...extra });

      return {
        start: () => {
          active = true;
          startedAt = performance.now();
          lastStageKey = "loadingLog.loadingModel";
          record(t("loadingLog.loadingModel", "Loading 3D model..."), { detail: core.fileObject?.filename || "" });
        },
        update: () => {},
        setStage: (stageKey) => {
          // "Model has been loaded" is the modelLoaded notice (loaders.js).
          if (!active || stageKey === lastStageKey || stageKey === "loadingLog.modelLoaded") return;
          lastStageKey = stageKey;
          record(t(stageKey));
        },
        finish: () => {
          if (!active) return;
          active = false;
          const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
          record(t("loadingLog.loadTime", { seconds }, "Loaded in {seconds} s"), { tone: "success" });
        },
        // The error itself is logged by reportLoadError() (loaders.js).
        fail: () => {
          active = false;
        },
      };
    },

    showStatusNotice(message, duration = 2600, options = {}) {
      this.enqueueStatusNotice({ message, duration, tone: "info", ...options });
    },

    localizeStatusNotice(notice) {
      if (!notice) return notice;
      const i18nKey = String(notice.i18nKey || "");
      const detailI18nKey = String(notice.detailI18nKey || "");
      return {
        ...notice,
        message: i18nKey ? t(i18nKey, notice.i18nVars || {}, notice.message) : notice.message,
        detail: detailI18nKey ? t(detailI18nKey, notice.detailI18nVars || {}, notice.detail) : notice.detail,
      };
    },

    renderStatusNoticeContent(notice) {
      if (!this.statusNotice || !notice) return;
      const message = String(notice.message ?? "");
      const detail = String(notice.detail ?? "");

      this.statusNotice.textContent = "";

      const messageNode = document.createElement("span");
      messageNode.className = "viewer-notice-message";
      messageNode.textContent = message;
      this.statusNotice.appendChild(messageNode);

      if (detail) {
        const detailLines = detail.split(/\r?\n/);
        for (const line of detailLines) {
          const detailNode = document.createElement("span");
          detailNode.className = "viewer-notice-detail";
          detailNode.innerHTML = line;
          this.statusNotice.appendChild(detailNode);
        }
      }

      if (notice.dismissible) {
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "viewer-notice-close";
        closeButton.textContent = "×";
        const closeLabel = t("shortcuts.closeAria", "Close");
        closeButton.setAttribute("aria-label", closeLabel);
        closeButton.title = closeLabel;
        this.bindEventListener(closeButton, "click", (event) => {
          event.stopPropagation();
          this.dismissStatusNotice(notice.key);
        });
        this.statusNotice.appendChild(closeButton);
      }
    },

    getStatusNoticeText(notice) {
      return [notice?.message, notice?.detail].filter(Boolean).join(" ");
    },

    refreshStatusNoticeLanguage() {
      if (Array.isArray(this.statusNoticeQueue)) {
        this.statusNoticeQueue = this.statusNoticeQueue.map((notice) => this.localizeStatusNotice(notice));
      }

      if (!this.statusNoticeCurrent) return;
      this.statusNoticeCurrent = this.localizeStatusNotice(this.statusNoticeCurrent);
      this.renderStatusNoticeContent(this.statusNoticeCurrent);
    },

    showStatusNoticeNow(notice) {
      if (!this.statusNotice || !notice) return;
      notice = this.localizeStatusNotice(notice);

      if (this.statusNoticeHideTimer) {
        clearTimeout(this.statusNoticeHideTimer);
        this.statusNoticeHideTimer = null;
      }

      this.statusNoticeActive = true;
      this.statusNoticeCurrent = notice;
      this.updateEditorToolbarState?.();
      syncNoticeAboveToolbar();
      this.statusNotice.hidden = false;
      this.renderStatusNoticeContent(notice);
      this.statusNotice.dataset.tone = notice.tone || "info";
      if (notice.variant) {
        this.statusNotice.dataset.variant = notice.variant;
      } else {
        delete this.statusNotice.dataset.variant;
      }
      this.noticeContainer?.classList.toggle("viewer-notice-container--sandbox", notice.variant === "sandbox");
      this.noticeContainer?.classList.toggle("viewer-notice-container--shortcuts", notice.variant === "shortcuts");
      this.statusNotice.classList.remove("is-hiding");
      this.statusNotice.classList.add("is-visible");

      if (this.statusNoticeTimer) {
        clearTimeout(this.statusNoticeTimer);
        this.statusNoticeTimer = null;
      }

      if (notice.persistent) {
        return;
      }

      this.statusNoticeTimer = setTimeout(() => {
        if (this.statusNotice) {
          this.statusNotice.classList.remove("is-visible");
          this.statusNotice.classList.add("is-hiding");
        }

        this.statusNoticeHideTimer = setTimeout(() => {
          if (this.statusNotice) {
            this.statusNotice.hidden = true;
            this.statusNotice.classList.remove("is-hiding");
            delete this.statusNotice.dataset.variant;
          }
          this.noticeContainer?.classList.remove("viewer-notice-container--sandbox", "viewer-notice-container--shortcuts");
          this.statusNoticeActive = false;
          this.statusNoticeCurrent = null;
          this.updateEditorToolbarState?.();
          this.statusNoticeTimer = null;
          this.statusNoticeHideTimer = null;
          this.processStatusNoticeQueue();
        }, 220);
      }, notice.duration);
    },

    dismissStatusNotice(key = "") {
      const normalizedKey = String(key || "");
      this.statusNoticeQueue = this.statusNoticeQueue.filter(
        (entry) => normalizedKey && (entry?.key || "") !== normalizedKey
      );

      if (
        normalizedKey &&
        (!this.statusNoticeCurrent || (this.statusNoticeCurrent.key || "") !== normalizedKey)
      ) {
        return;
      }

      if (this.statusNoticeTimer) {
        clearTimeout(this.statusNoticeTimer);
        this.statusNoticeTimer = null;
      }
      if (this.statusNoticeHideTimer) {
        clearTimeout(this.statusNoticeHideTimer);
        this.statusNoticeHideTimer = null;
      }

      if (this.statusNotice) {
        this.statusNotice.hidden = true;
        this.statusNotice.classList.remove("is-visible", "is-hiding");
        delete this.statusNotice.dataset.variant;
      }
      this.noticeContainer?.classList.remove("viewer-notice-container--sandbox", "viewer-notice-container--shortcuts");

      this.statusNoticeActive = false;
      this.statusNoticeCurrent = null;
      this.updateEditorToolbarState?.();
      this.processStatusNoticeQueue();
    },

    enqueueStatusNotice({
      message,
      duration = 2600,
      tone = "info",
      key = "",
      replace = false,
      persistent = false,
      dismissible = false,
      variant = "",
      i18nKey = "",
      i18nVars = {},
      detail = "",
      detailI18nKey = "",
      detailI18nVars = {},
    } = {}) {
      const text = String(message ?? "");
      if (!text) return;

      const nextNotice = {
        message: text,
        tone,
        duration: Number.isFinite(duration) ? duration : 2600,
        key: String(key || ""),
        persistent,
        dismissible,
        variant: String(variant || ""),
        i18nKey: String(i18nKey || ""),
        i18nVars: i18nVars && typeof i18nVars === "object" ? { ...i18nVars } : {},
        detail: String(detail || ""),
        detailI18nKey: String(detailI18nKey || ""),
        detailI18nVars: detailI18nVars && typeof detailI18nVars === "object" ? { ...detailI18nVars } : {},
      };

      if (
        this.statusNoticeActive &&
        this.getStatusNoticeText(this.statusNoticeCurrent) === this.getStatusNoticeText(nextNotice) &&
        (this.statusNoticeCurrent?.tone || "info") === nextNotice.tone &&
        (this.statusNoticeCurrent?.key || "") === nextNotice.key
      ) {
        return;
      }

      if (nextNotice.key) {
        this.statusNoticeQueue = this.statusNoticeQueue.filter(
          (entry) => (entry?.key || "") !== nextNotice.key
        );
      }

      if (
        replace &&
        this.statusNoticeActive &&
        (!nextNotice.key || (this.statusNoticeCurrent?.key || "") === nextNotice.key)
      ) {
        this.showStatusNoticeNow(nextNotice);
        return;
      }

      const isDuplicateQueued = this.statusNoticeQueue.some(
        (entry) =>
          this.getStatusNoticeText(entry) === this.getStatusNoticeText(nextNotice) &&
          entry?.tone === nextNotice.tone &&
          (entry?.key || "") === nextNotice.key
      );
      if (isDuplicateQueued) return;

      const priorityMap = {
        error: 0,
        warning: 1,
        info: 2,
        success: 3,
      };
      const nextPriority = priorityMap[nextNotice.tone] ?? 2;
      const insertAt = this.statusNoticeQueue.findIndex((entry) => {
        const entryPriority = priorityMap[entry?.tone] ?? 2;
        return nextPriority < entryPriority;
      });

      if (insertAt === -1) {
        this.statusNoticeQueue.push(nextNotice);
      } else {
        this.statusNoticeQueue.splice(insertAt, 0, nextNotice);
      }
      this.processStatusNoticeQueue();
    },

    processStatusNoticeQueue() {
      if (this.statusNoticeActive) return;
      if (!this.statusNotice) return;
      if (!Array.isArray(this.statusNoticeQueue) || this.statusNoticeQueue.length === 0) return;

      const nextNotice = this.statusNoticeQueue.shift();
      if (!nextNotice) return;
      this.showStatusNoticeNow(nextNotice);
    },
  });
}
