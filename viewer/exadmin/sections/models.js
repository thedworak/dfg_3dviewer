import { t } from "../../i18n-utils.js";
import { fillModelThumbnail } from "../../ui/model-thumbnail.js";
import { apiRequest } from "../api.js";
import { confirmDialog, toast } from "../dialogs.js";
import { formatBytes, formatCount, formatDateTime } from "../format.js";

// Every uploaded model (GET /api/admin/models, worker/server.py
// admin_models): filtered by owner, format, state and visibility, sorted
// by date, size or name; opened in the viewer, made private or public,
// deleted. Above them the conversions running or queued now, read again
// every few seconds while there are any.

const PAGE_SIZE = 50;
const QUEUE_POLL_MS = 5000;

const STATES = {
  ready: ["exadmin.modelsStateReady", "Ready"],
  converting: ["exadmin.modelsStateConverting", "Converting"],
  failed: ["exadmin.modelsStateFailed", "Conversion failed"],
  incomplete: ["exadmin.modelsStateIncomplete", "Incomplete"],
};

const SORTS = {
  newest: { label: ["exadmin.modelsSortNewest", "Newest first"], compare: (a, b) => b.createdAt - a.createdAt },
  oldest: { label: ["exadmin.modelsSortOldest", "Oldest first"], compare: (a, b) => a.createdAt - b.createdAt },
  largest: { label: ["exadmin.modelsSortLargest", "Largest on disk"], compare: (a, b) => b.storage - a.storage },
  name: { label: ["exadmin.modelsSortName", "Name"], compare: (a, b) => a.name.localeCompare(b.name) },
};

const QUEUE_STATUS = {
  init: ["exadmin.queueInit", "Starting"],
  queued: ["exadmin.queueQueued", "Waiting for a free slot"],
  preparing: ["exadmin.queuePreparing", "Preparing"],
  processing: ["exadmin.queueProcessing", "Converting"],
  rendering: ["exadmin.queueRendering", "Rendering thumbnails"],
};

const label = ([key, fallback]) => t(key, fallback);

function select(options, value, ariaLabel) {
  const element = document.createElement("select");
  element.setAttribute("aria-label", ariaLabel);
  options.forEach(([optionValue, text]) => element.appendChild(new Option(text, optionValue)));
  element.value = value;
  return element;
}

class ModelsSection {
  constructor() {
    this.models = [];
    this.queue = [];
    this.filters = { query: "", owner: "", format: "", state: "", visibility: "" };
    this.sort = "newest";
    this.shown = PAGE_SIZE;

    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-models";
    element.innerHTML = `
      <div class="exadmin-section-header"><h2></h2></div>
      <div class="exadmin-queue" hidden></div>
      <div class="exadmin-models-filters" hidden></div>
      <p class="exadmin-models-summary"></p>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="exadmin-models-list"></ul>
      <button type="button" class="exadmin-models-more" hidden></button>
    `;
    element.querySelector("h2").textContent = t("exadmin.modelsTitle", "Uploaded models");
    this.element = element;
    this.queueBox = element.querySelector(".exadmin-queue");
    this.filtersBox = element.querySelector(".exadmin-models-filters");
    this.summary = element.querySelector(".exadmin-models-summary");
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-models-list");
    this.more = element.querySelector(".exadmin-models-more");
    this.more.addEventListener("click", () => {
      this.shown += PAGE_SIZE;
      this.renderList();
    });
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  async load({ quiet = false } = {}) {
    if (!quiet) this.setStatus(t("exadmin.loading", "Loading..."));
    try {
      const data = await apiRequest("/api/admin/models");
      this.models = Array.isArray(data.models) ? data.models : [];
      this.queue = Array.isArray(data.queue) ? data.queue : [];
      this.setStatus("");
    } catch (error) {
      console.error("[exadmin] Failed to load models:", error);
      this.setStatus(error.message, "error");
      return;
    }
    if (!quiet) this.renderFilters();
    this.renderQueue();
    this.renderList();
    this.scheduleQueuePoll();
  }

  // While conversions run, they (and the list, as they finish) are read
  // again; it stops once the section is left (its element out of the page).
  scheduleQueuePoll() {
    clearTimeout(this.pollTimer);
    if (!this.queue.length) return;
    this.pollTimer = setTimeout(() => {
      if (this.element.isConnected) this.load({ quiet: true });
    }, QUEUE_POLL_MS);
  }

  renderQueue() {
    this.queueBox.textContent = "";
    this.queueBox.hidden = this.queue.length === 0;
    if (!this.queue.length) return;
    const heading = document.createElement("h3");
    heading.textContent = t("exadmin.queueTitle", { count: this.queue.length }, "Converting now ({count})");
    this.queueBox.appendChild(heading);
    this.queue.forEach((job) => {
      const row = document.createElement("div");
      row.className = "exadmin-queue-row";
      const name = document.createElement("span");
      name.className = "exadmin-queue-name";
      name.textContent = job.filename || job.id;
      const meta = document.createElement("span");
      meta.className = "exadmin-queue-meta";
      meta.textContent = [
        job.owner || t("adminPanel.modelNoOwner", "No owner"),
        QUEUE_STATUS[job.status] ? label(QUEUE_STATUS[job.status]) : job.status,
        job.message,
      ].filter(Boolean).join(" · ");
      const bar = document.createElement("progress");
      bar.max = 100;
      bar.value = job.progress || 0;
      bar.setAttribute("aria-label", `${job.filename || job.id}: ${job.progress || 0}%`);
      row.append(name, meta, bar);
      this.queueBox.appendChild(row);
    });
  }

  renderFilters() {
    this.filtersBox.textContent = "";
    this.filtersBox.hidden = this.models.length === 0;
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("exadmin.modelsSearch", "Search by name, file or owner");
    search.setAttribute("aria-label", search.placeholder);
    search.value = this.filters.query;
    search.addEventListener("input", () => {
      this.filters.query = search.value.trim().toLocaleLowerCase();
      this.shown = PAGE_SIZE;
      this.renderList();
    });

    const owners = [...new Set(this.models.map((m) => m.owner || ""))].sort((a, b) => a.localeCompare(b));
    const formats = [...new Set(this.models.map((m) => m.format).filter(Boolean))].sort();
    const all = t("exadmin.modelsAll", "All");
    const controls = [
      ["owner", t("exadmin.modelsOwner", "Owner"), [["", all], ...owners.map((o) => [o || "-", o || t("adminPanel.modelNoOwner", "No owner")])]],
      ["format", t("exadmin.modelsFormat", "Format"), [["", all], ...formats.map((f) => [f, `.${f}`])]],
      ["state", t("exadmin.modelsState", "State"), [["", all], ...Object.entries(STATES).map(([id, text]) => [id, label(text)]), ["reported", t("exadmin.modelsReported", "Reported")]]],
      ["visibility", t("exadmin.modelsVisibility", "Visibility"), [["", all], ["public", t("exadmin.modelsPublic", "Public")], ["private", t("exadmin.modelsPrivate", "Private")]]],
    ].map(([key, text, options]) => {
      const field = document.createElement("label");
      const caption = document.createElement("span");
      caption.textContent = text;
      const control = select(options, this.filters[key], text);
      control.addEventListener("change", () => {
        this.filters[key] = control.value;
        this.shown = PAGE_SIZE;
        this.renderList();
      });
      field.append(caption, control);
      return field;
    });

    const sortField = document.createElement("label");
    const sortCaption = document.createElement("span");
    sortCaption.textContent = t("adminPanel.sortBy", "Sort by");
    const sort = select(Object.entries(SORTS).map(([id, item]) => [id, label(item.label)]), this.sort, sortCaption.textContent);
    sort.addEventListener("change", () => {
      this.sort = sort.value;
      this.renderList();
    });
    sortField.append(sortCaption, sort);

    this.filtersBox.append(search, ...controls, sortField);
  }

  filtered() {
    const { query, owner, format, state, visibility } = this.filters;
    return this.models.filter((model) => {
      if (owner && (model.owner || "-") !== owner) return false;
      if (format && model.format !== format) return false;
      if (state === "reported" ? !model.openReports : state && model.state !== state) return false;
      if (visibility && (visibility === "private") !== model.private) return false;
      if (query && ![model.name, model.filename, model.owner, model.id]
        .some((text) => String(text || "").toLocaleLowerCase().includes(query))) return false;
      return true;
    }).sort(SORTS[this.sort].compare);
  }

  renderList() {
    const models = this.filtered();
    const total = models.reduce((sum, m) => sum + (m.storage || 0), 0);
    this.summary.textContent = this.models.length
      ? t("exadmin.modelsSummary", { count: formatCount(models.length), all: formatCount(this.models.length), size: formatBytes(total) },
        "{count} of {all} models · {size} on disk")
      : "";
    this.list.textContent = "";
    if (!models.length) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = this.models.length
        ? t("exadmin.modelsNoMatch", "No model matches these filters.")
        : t("exadmin.modelsEmpty", "No models uploaded yet.");
      this.list.appendChild(empty);
    }
    models.slice(0, this.shown).forEach((model) => this.list.appendChild(this.renderModel(model)));
    const left = models.length - this.shown;
    this.more.hidden = left <= 0;
    this.more.textContent = t("exadmin.modelsMore", { count: Math.min(left, PAGE_SIZE) }, "Show {count} more");
  }

  renderModel(model) {
    const item = document.createElement("li");
    item.className = "exadmin-model";
    item.dataset.state = model.state;

    const thumb = document.createElement("span");
    thumb.className = "models-panel-item-thumb";
    thumb.setAttribute("aria-hidden", "true");
    fillModelThumbnail(thumb, model.imageUrl || "", model.id);

    const body = document.createElement("div");
    body.className = "exadmin-model-body";
    const name = document.createElement("span");
    name.className = "exadmin-model-name";
    name.textContent = model.name;
    name.title = model.filename || model.id;
    const meta = document.createElement("span");
    meta.className = "exadmin-model-meta";
    meta.textContent = [
      model.owner || t("adminPanel.modelNoOwner", "No owner"),
      formatDateTime(model.createdAt),
      model.format ? `.${model.format}` : "",
      model.size ? t("exadmin.modelsUploadedSize", { size: formatBytes(model.size) }, "uploaded {size}") : "",
      t("exadmin.modelsStorage", { size: formatBytes(model.storage) }, "{size} on disk"),
    ].filter(Boolean).join(" · ");

    const tags = document.createElement("span");
    tags.className = "exadmin-model-tags";
    const tag = (text, tone) => {
      const element = document.createElement("span");
      element.className = "exadmin-model-tag";
      if (tone) element.dataset.tone = tone;
      element.textContent = text;
      tags.appendChild(element);
    };
    if (model.state !== "ready") tag(label(STATES[model.state] || [model.state, model.state]), model.state === "failed" ? "error" : "info");
    if (model.private) tag(t("exadmin.modelsPrivate", "Private"));
    if (model.openReports) {
      tag(t("exadmin.modelsReportsTag", { count: model.openReports }, "Reported ({count})"), "warning");
    }
    if (model.underReview) tag(t("exadmin.modelsUnderReview", "Hidden until decided"), "warning");
    body.append(name, meta);
    if (tags.childElementCount) body.appendChild(tags);
    if (model.error) {
      const error = document.createElement("span");
      error.className = "exadmin-model-error";
      error.textContent = model.error;
      body.appendChild(error);
    }

    const actions = document.createElement("div");
    actions.className = "exadmin-report-actions";
    if (model.modelUrl) {
      const open = document.createElement("a");
      open.href = `../?model=${encodeURIComponent(model.modelUrl)}`;
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = t("exadmin.modelsOpen", "Open");
      actions.appendChild(open);
    }
    // Only a model with an owner can be private (server.py _handle_visibility).
    if (model.owner) {
      const visibility = document.createElement("button");
      visibility.type = "button";
      visibility.textContent = model.private
        ? t("exadmin.modelsMakePublic", "Make public")
        : t("exadmin.modelsMakePrivate", "Make private");
      visibility.addEventListener("click", () => this.setPrivate(model, !model.private));
      actions.appendChild(visibility);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "exadmin-report-danger";
    remove.textContent = t("adminPanel.delete", "Delete");
    remove.addEventListener("click", () => this.remove(model));
    actions.appendChild(remove);

    item.append(thumb, body, actions);
    return item;
  }

  async setPrivate(model, makePrivate) {
    try {
      await apiRequest(`/api/jobs/${encodeURIComponent(model.id)}/visibility`, "POST", { private: makePrivate });
      model.private = makePrivate;
      toast("modelUpdated", "success");
      this.renderList();
    } catch (error) {
      this.setStatus(error.message, "error");
    }
  }

  async remove(model) {
    const confirmed = await confirmDialog({
      message: t("adminPanel.modelDeleteConfirm", { name: model.name },
        'Delete "{name}"? This permanently removes the converted model and its renders.'),
      confirmLabel: t("modelsPanel.deleteAction", "Delete"),
      cancelLabel: t("modelsPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      try {
        await apiRequest(`/api/jobs/${encodeURIComponent(model.id)}`, "DELETE");
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      this.models = this.models.filter((item) => item.id !== model.id);
      toast("modelDeleted", "success");
      this.renderList();
    } catch (error) {
      this.setStatus(error.message, "error");
    }
  }
}

export const modelsSection = {
  id: "models",
  label: () => t("exadmin.navModels", "Models"),
  mount(container) {
    const section = new ModelsSection();
    container.appendChild(section.element);
    section.load();
  },
};
