import { core } from "../core.js";
import { apiUrl, appRequestHeaders, hasRemote, remoteAssetUrl } from "../remote.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";

// A repository model's descriptive metadata (worker/model_metadata.py):
// asked for in a form when the model is added (upload-panel.js), shown in
// the model list (models-panel.js) and the metadata window (metadata.js),
// and changed there by the model's owner. The suggested scene reads the
// metadata window's text (editor/scene-suggest.js), so the type, the place
// and the date also feed its type, scale and lighting rules; the unit is
// for the scale.

// The same lists as worker/model_metadata.py.
export const MODEL_TYPES = ["building", "interior", "urban", "site", "object", "sculpture", "other"];
export const MODEL_LICENSES = [
  "CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "CC-BY-ND-4.0", "CC-BY-NC-ND-4.0",
  "CC0-1.0", "public-domain", "all-rights-reserved",
];
export const MODEL_METADATA_UNITS = ["m", "cm", "mm", "in", "ft"];

const TYPE_FALLBACKS = {
  building: "Building / architecture",
  interior: "Interior",
  urban: "Town / settlement",
  site: "Site / landscape",
  object: "Object / artefact",
  sculpture: "Sculpture / architectural detail",
  other: "Other",
};
const LICENSE_FALLBACKS = { "public-domain": "Public domain", "all-rights-reserved": "All rights reserved" };
const UNIT_FALLBACKS = { m: "metres", cm: "centimetres", mm: "millimetres", in: "inches", ft: "feet" };

export function modelTypeLabel(type) {
  return TYPE_FALLBACKS[type] ? t(`modelMetadata.types.${type}`, TYPE_FALLBACKS[type]) : "";
}

export function modelLicenseLabel(license) {
  if (!license) return "";
  // The Creative Commons ones by their usual names: "CC BY-SA 4.0".
  if (license.startsWith("CC")) return license.replace(/^CC-/, "CC ").replace(/-(\d)/, " $1");
  return t(`modelMetadata.licenses.${license}`, LICENSE_FALLBACKS[license] || license);
}

function modelUnitLabel(unit) {
  return unit ? `${unit} (${t(`modelMetadata.units.${unit}`, UNIT_FALLBACKS[unit])})` : "";
}

// A file name as a starting name: "kosciol_wola-final.glb" -> "kosciol wola final".
export function nameFromFileName(fileName) {
  const base = String(fileName || "").split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

// The metadata as rows of the metadata window: [label, value] in order.
export function modelMetadataRows(metadata) {
  if (!metadata) return [];
  return [
    [t("modelMetadata.fields.name", "Name"), metadata.name],
    [t("modelMetadata.fields.type", "Type"), modelTypeLabel(metadata.type)],
    [t("modelMetadata.fields.author", "Author"), metadata.author],
    [t("modelMetadata.fields.copyright", "Copyright"), metadata.copyright],
    [t("modelMetadata.fields.license", "Licence"), modelLicenseLabel(metadata.license)],
    [t("modelMetadata.fields.date", "Date"), metadata.date],
    [t("modelMetadata.fields.location", "Place"), metadata.location],
    [t("modelMetadata.fields.unit", "Model unit"), modelUnitLabel(metadata.unit)],
    [t("modelMetadata.fields.description", "Description"), metadata.description],
  ].filter(([, value]) => value);
}

function option(value, label, selected) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  element.selected = selected;
  return element;
}

export function attachModelMetadata(Viewer) {
  Object.assign(Viewer, {
    // The repository job of the model on screen, or null: from its URL
    // (/files/<job>/...), or, for a copy the app opened from a File, from
    // the list entry it was opened from (models-panel.js).
    currentRepositoryJobId() {
      if (!hasRemote()) return null;
      const opened = Viewer.openedRepositoryJob;
      if (opened && opened.fileName && core.fileObject?.filename === opened.fileName) return opened.id;
      const source = core.autoPath || core.fileObject?.originalPath || "";
      if (!source) return null;
      try {
        const prefix = new URL(remoteAssetUrl("/files/"), window.location.href).href;
        const url = new URL(source, window.location.href).href;
        if (!url.startsWith(prefix)) return null;
        const id = decodeURIComponent(url.slice(prefix.length).split("/")[0]);
        return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
      } catch {
        return null;
      }
    },

    async fetchModelMetadata(jobId) {
      const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(jobId)}/metadata`), {
        cache: "no-store",
        headers: appRequestHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },

    // Resolves to the stored metadata. A backend without metadata (the
    // Drupal module, an older worker) resolves to null.
    async saveModelMetadata(jobId, metadata) {
      const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(jobId)}/metadata`), {
        method: "POST",
        headers: { ...appRequestHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      if (response.status === 404 || response.status === 405) return null;
      if (!response.ok) {
        let reason = "";
        try {
          reason = (await response.json())?.error || "";
        } catch (_error) {
          // A proxy's page: the status says it.
        }
        throw new Error(reason || `HTTP ${response.status}`);
      }
      return (await response.json()).metadata || null;
    },

    // The form, in a modal dialog. Resolves to the entered metadata, or
    // null when cancelled. `initial`: values to start from; `submitLabel`:
    // the button (e.g. "Upload" while adding a model); `save`: run with the
    // values before the dialog closes - its error stays in the dialog.
    openModelMetadataDialog({ initial = {}, title, submitLabel, save = null } = {}) {
      return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "viewer-confirm-backdrop model-metadata-backdrop";
        const dialog = document.createElement("form");
        dialog.className = "viewer-confirm model-metadata-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "modelMetadataTitle");
        dialog.noValidate = true;

        const heading = document.createElement("h2");
        heading.id = "modelMetadataTitle";
        heading.className = "model-metadata-title";
        heading.textContent = title || t("modelMetadata.title", "Model metadata");
        const intro = document.createElement("p");
        intro.className = "model-metadata-intro";
        intro.textContent = t(
          "modelMetadata.intro",
          "Fields marked * are required. The type, place, date and unit also help to pick the model's scale and lighting."
        );

        const grid = document.createElement("div");
        grid.className = "model-metadata-grid";
        const controls = {};
        const field = (name, label, control, { required = false, wide = false, hint = "" } = {}) => {
          const wrapper = document.createElement("label");
          wrapper.className = "model-metadata-field" + (wide ? " model-metadata-field--wide" : "");
          const caption = document.createElement("span");
          caption.className = "model-metadata-label";
          caption.textContent = label;
          if (required) {
            const mark = document.createElement("span");
            mark.className = "model-metadata-required";
            mark.textContent = " *";
            mark.setAttribute("aria-hidden", "true");
            caption.appendChild(mark);
            control.required = true;
          }
          control.name = name;
          control.id = `modelMetadata-${name}`;
          wrapper.append(caption, control);
          if (hint) {
            const note = document.createElement("span");
            note.className = "model-metadata-hint";
            note.textContent = hint;
            wrapper.appendChild(note);
          }
          controls[name] = control;
          grid.appendChild(wrapper);
        };
        const text = (name, maxLength, placeholder = "") => {
          const input = document.createElement("input");
          input.type = "text";
          input.maxLength = maxLength;
          input.autocomplete = "off";
          input.placeholder = placeholder;
          input.value = initial[name] || "";
          return input;
        };
        const select = (name, values, labelOf, emptyLabel) => {
          const element = document.createElement("select");
          element.appendChild(option("", emptyLabel, !initial[name]));
          values.forEach((value) => element.appendChild(option(value, labelOf(value), initial[name] === value)));
          return element;
        };

        field("name", t("modelMetadata.fields.name", "Name"), text("name", 200), { required: true, wide: true });
        field(
          "type",
          t("modelMetadata.fields.type", "Type"),
          select("type", MODEL_TYPES, modelTypeLabel, t("modelMetadata.choose", "Choose...")),
          { required: true },
        );
        field("date", t("modelMetadata.fields.date", "Date"), text("date", 100, t("modelMetadata.datePlaceholder", "e.g. 1890, 15th c., 2024-05-12")));
        field("author", t("modelMetadata.fields.author", "Author"), text("author", 200));
        field(
          "copyright",
          t("modelMetadata.fields.copyright", "Copyright"),
          text("copyright", 300, t("modelMetadata.copyrightPlaceholder", "e.g. © 2024 Museum of ...")),
        );
        field(
          "license",
          t("modelMetadata.fields.license", "Licence"),
          select("license", MODEL_LICENSES, modelLicenseLabel, t("modelMetadata.notSpecified", "Not specified")),
        );
        field(
          "location",
          t("modelMetadata.fields.location", "Place"),
          text("location", 200, t("modelMetadata.locationPlaceholder", "e.g. Kraków, Wawel Hill")),
        );
        field(
          "unit",
          t("modelMetadata.fields.unit", "Model unit"),
          select("unit", MODEL_METADATA_UNITS, modelUnitLabel, t("modelMetadata.unitUnknown", "Unknown")),
          { hint: t("modelMetadata.unitHint", "What one unit of the file measures - for the scale.") },
        );
        const description = document.createElement("textarea");
        description.rows = 3;
        description.maxLength = 4000;
        description.value = initial.description || "";
        field("description", t("modelMetadata.fields.description", "Description"), description, { wide: true });

        const status = document.createElement("p");
        status.className = "model-metadata-status";
        status.setAttribute("role", "alert");

        const actions = document.createElement("div");
        actions.className = "viewer-confirm-actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "viewer-confirm-cancel";
        cancel.textContent = t("modelMetadata.cancel", "Cancel");
        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "viewer-confirm-ok";
        submit.textContent = submitLabel || t("modelMetadata.save", "Save");
        actions.append(cancel, submit);

        dialog.append(heading, intro, grid, status, actions);
        backdrop.appendChild(dialog);

        const finish = (value) => {
          document.removeEventListener("keydown", onKey, true);
          backdrop.remove();
          resolve(value);
        };
        const onKey = (event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          finish(null);
        };
        document.addEventListener("keydown", onKey, true);
        cancel.addEventListener("click", () => finish(null));
        // Clicks beside the form do not close it: what was typed stays.
        backdrop.addEventListener("pointerdown", (event) => event.stopPropagation());
        Object.values(controls).forEach((control) => {
          control.addEventListener("input", () => control.removeAttribute("aria-invalid"));
        });

        dialog.addEventListener("submit", async (event) => {
          event.preventDefault();
          const values = {};
          Object.entries(controls).forEach(([name, control]) => { values[name] = control.value.trim(); });
          const missing = ["name", "type"].filter((name) => !values[name]);
          missing.forEach((name) => controls[name].setAttribute("aria-invalid", "true"));
          if (missing.length) {
            status.textContent = t("modelMetadata.required", "Enter the name and choose the type.");
            controls[missing[0]].focus();
            return;
          }
          if (!save) {
            finish(values);
            return;
          }
          submit.disabled = true;
          status.textContent = "";
          try {
            await save(values);
            finish(values);
          } catch (error) {
            status.textContent = t("modelMetadata.saveError", { reason: error.message }, "Could not save the metadata: {reason}");
            submit.disabled = false;
          }
        });

        core.container.appendChild(backdrop);
        controls.name.focus();
        if (controls.name.value) controls.name.select();
      });
    },

    // "Edit metadata" (metadata window, model list): the form with what is
    // stored, saved on submit. Resolves to the new metadata, or null.
    async editModelMetadata(jobId, current = null) {
      const saved = await Viewer.openModelMetadataDialog({
        initial: current || {},
        title: t("modelMetadata.editTitle", "Edit model metadata"),
        save: async (values) => {
          const stored = await Viewer.saveModelMetadata(jobId, values);
          if (!stored) throw new Error(t("modelMetadata.unsupported", "this repository does not keep metadata"));
          Viewer.lastSavedModelMetadata = stored;
        },
      });
      if (!saved) return null;
      toastHelper("modelMetadataSaved", "success");
      if (Viewer.currentRepositoryJobId() === jobId) Viewer.renderRepositoryMetadata();
      Viewer.loadModelsList?.();
      return Viewer.lastSavedModelMetadata;
    },

    // The metadata window's section (#metadata-repository, metadata.js):
    // the rows and, for the owner, the edit button. The card shows the
    // model's name instead of its file name.
    async renderRepositoryMetadata() {
      const section = document.getElementById("metadata-repository");
      if (!section) return;
      const jobId = Viewer.currentRepositoryJobId();
      section.textContent = "";
      section.hidden = true;
      if (!jobId) return;
      let data;
      try {
        data = await Viewer.fetchModelMetadata(jobId);
      } catch (_error) {
        // Not a worker's model after all, or the repository is down.
        return;
      }
      // Another model came in the meantime.
      if (!section.isConnected || Viewer.currentRepositoryJobId() !== jobId) return;

      const metadata = data?.metadata || null;
      modelMetadataRows(metadata).forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "metadata-row";
        const labelElement = document.createElement("span");
        labelElement.className = "metadata-label";
        labelElement.textContent = label;
        const valueElement = document.createElement("span");
        valueElement.className = "metadata-value";
        valueElement.textContent = value;
        row.append(labelElement, valueElement);
        section.appendChild(row);
      });
      if (data?.canEdit) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "metadata-edit";
        edit.textContent = metadata
          ? t("modelMetadata.edit", "Edit metadata")
          : t("modelMetadata.add", "Add metadata");
        edit.addEventListener("click", () => Viewer.editModelMetadata(jobId, metadata));
        section.appendChild(edit);
      }
      section.hidden = section.childElementCount === 0;

      const cardTitle = document.querySelector("#metadata-card .metadata-toggle-title");
      if (cardTitle && metadata?.name) cardTitle.textContent = metadata.name;
    },
  });
}
