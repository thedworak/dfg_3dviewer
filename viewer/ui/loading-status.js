import { core } from "../core.js";
import { t } from "../i18n-utils.js";

export function attachLoadingStatus(viewer) {
  Object.assign(viewer, {
    toggleLoadingLogs() {
      this.showLoadingLogs = !this.showLoadingLogs;
      if (core.loadingLog.get()) {
        core.loadingLog.get().classList.toggle("editorToolbar-visible", this.showLoadingLogs);
      }
      this.updateEditorToolbarLabels();
      this.updateEditorToolbarState();
    },

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

      const messages = this.getLoadingLogMessages();
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

      const set = (value = 0, maxValue = 100) => {
        const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
        const normalized = Number.isFinite(value) ? Math.min(Math.max(value / safeMax, 0), 1) : 0;
        const progress = Math.round(normalized * 100);

        shell.style.setProperty("--model-loader-progress", String(progress));
        percent.textContent = `${progress}%`;
        bar.style.width = `${progress}%`;
        track.setAttribute("aria-valuenow", String(progress));
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
        },
        hide: () => {
          clearHideTimer();
          shell.hidden = true;
          delete shell.dataset.complete;
        },
        setStage: (stageKey, progressValue = null) => {
          const index = stageKeyToIndex.get(stageKey);
          if (typeof index === "number") {
            updatePhase(index);
          }
          if (Number.isFinite(progressValue)) {
            const normalizedProgress = Math.max(0, Math.min(Math.round(progressValue), 100));
            shell.style.setProperty("--model-loader-progress", String(normalizedProgress));
            percent.textContent = `${normalizedProgress}%`;
            bar.style.width = `${normalizedProgress}%`;
            track.setAttribute("aria-valuenow", String(normalizedProgress));
          }
        },
        complete: (delayMs = 2400) => {
          clearHideTimer();
          updatePhase(stageKeyToIndex.get("loadingLog.modelLoaded") ?? messages.length - 1);
          shell.style.setProperty("--model-loader-progress", "100");
          percent.textContent = "100%";
          bar.style.width = "100%";
          track.setAttribute("aria-valuenow", "100");
          shell.dataset.complete = "true";
          hideTimer = window.setTimeout(() => {
            hideTimer = null;
            delete shell.dataset.complete;
            shell.hidden = true;
          }, delayMs);
        },
        set,
        reset: (maxValue = 100) => {
          clearHideTimer();
          delete shell.dataset.complete;
          set(0, maxValue);
        },
      };
    },

    createLoadingLog() {
      const shell = document.createElement("div");
      shell.id = "loading-log";
      shell.setAttribute("aria-live", "polite");
      shell.hidden = true;

      const collapsedToggle = document.createElement("button");
      collapsedToggle.type = "button";
      collapsedToggle.className = "loading-log__collapsed-toggle";
      collapsedToggle.setAttribute("aria-label", t("loadingLog.title", "Loading process log"));
      collapsedToggle.setAttribute("aria-expanded", "false");
      shell.appendChild(collapsedToggle);

      const header = document.createElement("button");
      header.type = "button";
      header.className = "loading-log__header";
      header.setAttribute("aria-expanded", "false");

      const headerTitle = document.createElement("span");
      headerTitle.className = "loading-log__title";
      headerTitle.textContent = t("loadingLog.title", "Loading process log");

      const headerSummary = document.createElement("span");
      headerSummary.className = "loading-log__summary";

      header.append(headerTitle, headerSummary);
      shell.appendChild(header);

      const body = document.createElement("div");
      body.className = "loading-log__body";

      const list = document.createElement("div");
      list.className = "loading-log__messages";

      const progress = document.createElement("div");
      progress.className = "loading-log__progress";
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      progress.setAttribute("aria-valuenow", "0");

      const progressBar = document.createElement("div");
      progressBar.className = "loading-log__progress-bar";
      progress.appendChild(progressBar);

      body.append(list, progress);
      shell.appendChild(body);
      core.container.appendChild(shell);

      shell.classList.add("editorToolbar-hidden");

      let timer = null;
      let messageIndex = 0;
      let visibleCount = 0;
      let currentProgress = 0;
      let startedAt = 0;
      let hideTimer = null;
      let progressUpdated = false;
      const minVisibleMs = 900;
      const loadingMessages = this.getLoadingLogMessages();
      const loadingStageKeyToIndex = new Map(
        this.loadingLogMessageKeys.map((key, index) => [key, index])
      );
      const loadingModelMessageIndex = Math.max(
        0,
        loadingStageKeyToIndex.get("loadingLog.loadingModel") ?? 0
      );
      let isExpanded = false;

      const setExpanded = (expanded) => {
        isExpanded = expanded;
        shell.dataset.expanded = expanded ? "true" : "false";
        header.setAttribute("aria-expanded", expanded ? "true" : "false");
        collapsedToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      };

      const updateSummary = () => {
        const activeMessage = loadingMessages[messageIndex] || loadingMessages[loadingModelMessageIndex] || "";
        headerSummary.textContent = `${currentProgress}% • ${activeMessage}`;
      };

      header.addEventListener("click", () => {
        if (shell.hidden) return;
        setExpanded(!isExpanded);
      });

      collapsedToggle.addEventListener("click", () => {
        if (shell.hidden) return;
        setExpanded(!isExpanded);
      });

      const renderMessages = (allDone = false) => {
        const messages = loadingMessages
          .slice(Math.max(0, messageIndex - visibleCount + 1), messageIndex + 1);
        list.replaceChildren(...messages.map((message, index) => {
          const row = document.createElement("div");
          row.className = "loading-log__message";
          if (allDone) {
            row.classList.add("loading-log__message--done");
          } else if (index === messages.length - 1) {
            row.classList.add("loading-log__message--active");
          }
          row.textContent = message;
          return row;
        }));
      };

      const setProgress = (value) => {
        const normalizedValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
        currentProgress = Math.max(currentProgress, Math.round(normalizedValue));
        progressBar.style.width = `${currentProgress}%`;
        progress.setAttribute("aria-valuenow", String(currentProgress));
        updateSummary();
      };

      const tick = () => {
        visibleCount = Math.min(4, visibleCount + 1);
        if (!progressUpdated) {
          messageIndex = loadingModelMessageIndex;
          setProgress(Math.min(currentProgress + 8, 12));
        }
        renderMessages();
      };

      const stop = () => {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      };

      const clearHideTimer = () => {
        if (hideTimer) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
      };

      const collapseLog = () => {
        shell.classList.remove("loading-log--done");
        shell.classList.remove("loading-log--error");
        setExpanded(false);
        hideTimer = null;
      };

      return {
        start: () => {
          stop();
          clearHideTimer();
          progressUpdated = false;
          startedAt = performance.now();
          shell.hidden = false;
          setExpanded(false);
          shell.classList.remove("loading-log--done", "loading-log--error");
          messageIndex = loadingModelMessageIndex;
          visibleCount = 1;
          currentProgress = 0;
          renderMessages();
          setProgress(6);
          timer = window.setInterval(tick, 520);
        },
        update: (value) => {
          if (shell.hidden) return;
          progressUpdated = true;
          const normalized = Number.isFinite(value) ? value : 0;
          messageIndex = loadingModelMessageIndex;
          visibleCount = Math.min(4, Math.max(visibleCount, 2));
          renderMessages();
          setProgress(Math.min(normalized, 99));
        },
        setStage: (stageKey, progressValue = null) => {
          if (shell.hidden) return;
          const stageIndex = loadingStageKeyToIndex.get(stageKey);
          if (typeof stageIndex === "number") {
            messageIndex = stageIndex;
            visibleCount = Math.min(4, Math.max(visibleCount, 2));
            renderMessages();
            updateSummary();
          }
          if (Number.isFinite(progressValue)) {
            setProgress(progressValue);
          }
        },
        finish: () => {
          if (shell.hidden) return;
          stop();
          const messageCount = loadingMessages.length;
          messageIndex = messageCount - 1;
          visibleCount = messageCount;
          renderMessages(true);
          setProgress(100);
          updateSummary();
          shell.classList.add("loading-log--done");
          const visibleFor = performance.now() - startedAt;
          const hideDelay = Math.max(1200, minVisibleMs - visibleFor + 800);
          clearHideTimer();
          hideTimer = window.setTimeout(() => {
            collapseLog();
          }, hideDelay);
        },
        fail: () => {
          if (shell.hidden) return;
          stop();
          clearHideTimer();
          setExpanded(true);
          shell.classList.add("loading-log--error");
          hideTimer = window.setTimeout(() => {
            shell.classList.remove("loading-log--error");
            setExpanded(false);
            hideTimer = null;
          }, 2000);
        },
        get: () => shell,
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
      this.statusNotice.hidden = false;
      this.renderStatusNoticeContent(notice);
      this.statusNotice.dataset.tone = notice.tone || "info";
      if (notice.variant) {
        this.statusNotice.dataset.variant = notice.variant;
      } else {
        delete this.statusNotice.dataset.variant;
      }
      this.noticeContainer?.classList.toggle("viewer-notice-container--sandbox", notice.variant === "sandbox");
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
          this.noticeContainer?.classList.remove("viewer-notice-container--sandbox");
          this.statusNoticeActive = false;
          this.statusNoticeCurrent = null;
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
      this.noticeContainer?.classList.remove("viewer-notice-container--sandbox");

      this.statusNoticeActive = false;
      this.statusNoticeCurrent = null;
      this.processStatusNoticeQueue();
    },

    enqueueStatusNotice({
      message,
      duration = 2600,
      tone = "info",
      key = "",
      replace = false,
      persistent = false,
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
