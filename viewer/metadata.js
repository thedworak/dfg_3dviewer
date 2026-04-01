import { truncateString } from "./utils.js";
import { showToast, setupObject, setupCamera } from './viewer-utils.js';
import { core } from './core.js';

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMetadataRow(label, value) {
  if (!label || typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  return (
    '<div class="metadata-row">' +
      '<span class="metadata-label">' + escapeHtml(label) + ':</span>' +
      '<span class="metadata-value">' + escapeHtml(value) + '</span>' +
    '</div>'
  );
}

/**
 * Formats WissKI metadata labels and values for display.
 */
export function addWissKIMetadata(label, value) {
  if (typeof label !== "undefined" && typeof value !== "undefined") {
    var _str = "";
    label = label.replace("wisski_path_3d_model__", "");
    switch (label) {
      case "title":
        _str = "Title";
        break;
      case "author_name":
        _str = "Author";
        break;
      case "author_affiliation":
        _str = "Author affiliation";
        break;
      case "license":
        _str = "License";
        break;
      case "description":
        _str = "Description";
        break;
      case "object_type":
        _str = "Object type";
        break;
      case "reconstruction_authors":
        _str = "Reconstruction authors";
        break;
      case "reconstruction_period":
        _str = "Reconstruction period";
        break;
      default:
        _str = "";
        break;
    }

    if (_str !== "") {
      return buildMetadataRow(_str, value);
    }
  }
}

export function lilGUIhasFolder(folder, name) {
  return folder.folders.some(f => f._title === name);
}

export function lilGUIgetFolder(gui, name) {
  return gui?.folders?.find(f => f._title === name) || null;
}

/**
 * Expands/collapses the metadata panel.
 */
export function expandMetadata() {
  const content = document.getElementById("metadata-content");
  const toggle = document.getElementById("metadata-collapse");
  const card = document.getElementById("metadata-card");

  if (!content || !toggle) return;

  const expanded = content.classList.toggle("expanded");
  toggle.classList.toggle("metadata-collapsed", !expanded);
  card?.classList.toggle("metadata-open", expanded);

  // accessibility
  toggle.setAttribute("aria-expanded", expanded);

  if (!expanded) {
    card?.classList.remove("metadata-card-overflowing");
    content.querySelectorAll(".metadata-row-pinned").forEach((row) => {
      row.classList.remove("metadata-row-pinned");
    });
    return;
  }

  updateMetadataOverflow();
}

function updateMetadataOverflow() {
  const content = document.getElementById("metadata-content");
  const card = document.getElementById("metadata-card");

  if (!content || !card || !content.classList.contains("expanded")) return;

  const hasOverflow = content.scrollHeight - content.clientHeight > 8;
  card.classList.toggle("metadata-card-overflowing", hasOverflow);

  content.querySelectorAll(".metadata-row").forEach((row) => {
    const value = row.querySelector(".metadata-value");
    if (!value) return;

    const wasPinned = row.classList.contains("metadata-row-pinned");
    row.classList.remove("metadata-row-pinned", "metadata-row-expandable");

    const isExpandable = value.scrollHeight - value.clientHeight > 4;
    row.classList.toggle("metadata-row-expandable", isExpandable);

    if (wasPinned && isExpandable) {
      row.classList.add("metadata-row-pinned");
    }
  });
}

function bindMetadataInteractions() {
  if (core.metadataContainer.dataset.boundCollapse === "true") return;

  core.metadataContainer.addEventListener("click", (e) => {
    const toggle = e.target.closest("#metadata-collapse");
    if (toggle) {
      expandMetadata(e);
      return;
    }

    const card = document.getElementById("metadata-card");
    const content = document.getElementById("metadata-content");
    if (!card || !content || !content.classList.contains("expanded")) return;

    const row = e.target.closest(".metadata-row");
    if (!row) return;

    const willPin = !row.classList.contains("metadata-row-pinned");
    content.querySelectorAll(".metadata-row-pinned").forEach((pinnedRow) => {
      pinnedRow.classList.remove("metadata-row-pinned");
    });
    if (willPin) row.classList.add("metadata-row-pinned");
  });

  window.addEventListener("resize", updateMetadataOverflow);
  core.metadataContainer.dataset.boundCollapse = "true";
}

/**
 * Appends metadata HTML to the DOM.
 */
export function appendMetadata(
  metadataContent
) {
  core.metadataContainer.innerHTML = metadataContent;

  if (!core.container.contains(core.metadataContainer)) {
    core.container.appendChild(core.metadataContainer);
  }
}

async function fetchEntityMetadata() {
  if (!core.CONFIG.entity.metadata.sourceType || core.CONFIG.entity.metadata.url === "") {
    return "";
  }

  const metadataUrl = core.CONFIG.entity.metadata.url + encodeURIComponent(core.CONFIG.entity.id);

  try {
    const response = await fetch(metadataUrl, { cache: "no-cache" });

    if (!response.ok) {
      console.warn("Metadata request failed with status:", response.status);
      return "";
    }

    const responseText = await response.text();

    try {
      const jsonData = JSON.parse(responseText);
      const record = Array.isArray(jsonData) ? jsonData[0] : jsonData;

      if (!record || typeof record !== "object") {
        return "";
      }

      console.log("Processing JSON metadata:", record);

      const jsonFieldMap = {
        title: "title",
        reconstruction_authors: "author_name",
        reconstruction_authors_affiliation: "author_affiliation",
        reconstruction_license: "license",
        reconstruction_time_frame: "reconstruction_period",
        object_description: "description",
        object_type: "object_type",
      };

      let entityMetadataContent = "";
      for (const [jsonField, metadataLabel] of Object.entries(jsonFieldMap)) {
        if (record[jsonField]) {
          const fetchedValue = addWissKIMetadata(metadataLabel, record[jsonField]);
          if (typeof fetchedValue !== "undefined") {
            entityMetadataContent += fetchedValue;
          }
        }
      }

      return entityMetadataContent;
    } catch (_jsonError) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(responseText, "application/xml");

      if (doc.documentElement.tagName === "parsererror") {
        console.error("XML parsing error:", doc.documentElement.textContent);
        return "";
      }

      let entityMetadataContent = "";
      if (doc.documentElement.childNodes.length > 0) {
        var data = doc.documentElement.childNodes[0].childNodes;
        if (data !== undefined) {
          for (var i = 0; i < data.length; i++) {
            var fetchedValue = addWissKIMetadata(data[i].tagName, data[i].textContent);
            if (typeof fetchedValue !== "undefined") {
              entityMetadataContent += fetchedValue;
            }
          }
        }
      }

      return entityMetadataContent;
    }
  } catch (error) {
    console.error("Error processing metadata:", error);
    return "";
  }
}

export function fetchMetadata(_object, _type) {
  if (!_object?.geometry) return 0;

  const indexedCount = _object.geometry.index?.count;
  const positionCount = _object.geometry.attributes?.position?.count ?? 0;

  switch (_type) {
    case "vertices":
      return positionCount;
    case "faces":
      return (indexedCount ?? positionCount) / 3;
    default:
      return 0;
  }
}

/**
 * Handles metadata response and builds the metadata UI.
 */
export async function handleMetadataResponse(
  data,
  metadata,
  object,
  hierarchyMain,
) {
  var tempArray = [];
  let hierarchyFolder;
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh") {
    setupObject(object, data);
    object.traverse(function (child) {
      if (child.isMesh) {
        metadata["vertices"] += fetchMetadata(child, "vertices");
        metadata["faces"] += fetchMetadata(child, "faces");
        if (child.name === "") child.name = "Mesh";
        var shortChildName = truncateString(child.name, 35);
        tempArray = {
          [shortChildName]() {
           core.selectObjectHierarchy(child.id, core.container);
          },
          id: child.id,
        };
        if (typeof hierarchyMain !== "undefined" && lilGUIgetFolder(core.gui, "Hierarchy") !== null && !lilGUIhasFolder(hierarchyMain, shortChildName)) {
          hierarchyFolder = hierarchyMain.addFolder(shortChildName).close();
          hierarchyFolder.add(tempArray, shortChildName);
          child.traverse(function (children) {
            if (children.isMesh && children.name !== child.name) {
              if (children.name === "") children.name = "ChildrenMesh";
              var shortChildrenName = truncateString(children.name, 35);
              tempArray = {
                [shortChildrenName]() {
                  core.selectObjectHierarchy(children.id, core.container);
                },
                id: children.id,
              };
              hierarchyFolder.add(tempArray, shortChildrenName);
            }
          });
        }
      }
    });
    await setupCamera(object, data);
  } else {
    setupObject(object, data);
    await setupCamera(object, data);
    metadata["vertices"] += fetchMetadata(object, "vertices");
    metadata["faces"] += fetchMetadata(object, "faces");
    if (object.name === "") {
      tempArray = {
        ["Mesh"]() {
          core.selectObjectHierarchy(object.id, core.container);
        },
        id: object.id,
      };
      object.name = object.id;
    } else {
      tempArray = {
        [object.name]() {
          core.selectObjectHierarchy(object.id, core.container);
        },
        id: object.id,
      };
    }
    if (hierarchyMain && lilGUIgetFolder(core.gui, "Hierarchy") !== null && !lilGUIhasFolder(hierarchyMain, object.name)) {
      hierarchyFolder = hierarchyMain.addFolder(object.name).close();
    }
  }

  if (typeof hierarchyMain !== "undefined") {
    hierarchyMain.domElement.classList.add("hierarchy");
  }

  if (!core.metadataContainer) {
    core.metadataContainer = document.createElement("div");
    core.metadataContainer.id = "metadata-container";
  }
  core.metadataContainer.setAttribute("data-viewer-theme", core.container?.closest(".viewer-wrapper")?.getAttribute("data-viewer-theme") || "dark");

  var metadataContent =
    '<div id="metadata-card">' +
      '<button id="metadata-collapse" class="metadata-collapse metadata-collapsed" type="button" aria-expanded="false" aria-controls="metadata-content">' +
        '<span class="metadata-toggle-icon" aria-hidden="true"></span>' +
        '<span class="metadata-toggle-copy">' +
          '<span class="metadata-toggle-eyebrow">Model details</span>' +
          '<span class="metadata-toggle-title">Metadata</span>' +
        '</span>' +
        '<span class="metadata-toggle-chevron" aria-hidden="true"></span>' +
      '</button>' +
      '<div id="metadata-content" class="metadata-content">';
  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label">Visualized file:</span>' +
      '<span class="metadata-value">' +
        escapeHtml(core.fileObject.basename) + '.' + escapeHtml(core.fileObject.extension) +
      '</span>' +
    '</div>';

  metadataContent += '<div class="metadataSeparator"></div>';

  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label">Vertices:</span>' +
      '<span class="metadata-value">' + metadata["vertices"] + '</span>' +
    '</div>';

  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label">Faces:</span>' +
      '<span class="metadata-value">' + metadata["faces"] + '</span>' +
    '</div>';
  metadataContent += await fetchEntityMetadata();

  if (core.downloadModel) {
    core.downloadModel.hidden = true;
    core.downloadModel.removeAttribute("href");
  }

  if (core.viewEntity) {
    core.viewEntity.hidden = true;
    core.viewEntity.removeAttribute("data-embed-url");
  }

  if (!core.isLightweight && core.downloadModel) {
    const c_path = core.fileObject.path;
    if (core.loadedFile !== "") {
      core.fileObject.filename = core.fileObject.filename.replace(core.fileObject.orgExtension, core.fileObject.extension);
    }

    core.downloadModel.href = `blob:${encodeURI(c_path + core.fileObject.filename)}`;
    core.downloadModel.setAttribute("download", core.fileObject.filename);
    core.downloadModel.innerHTML = `
      <span class="viewer-action-icon download-icon" aria-hidden="true"></span>
      <span>Download</span>
    `;
    core.downloadModel.hidden = false;
  }

  if (core.viewEntity && (core.CONFIG?.entity?.id || core.fileObject?.originalPath)) {
    const sharePayload = window.Viewer?.getSharePayload?.();
    if (sharePayload?.url) {
      core.viewEntity.setAttribute("data-embed-url", sharePayload.url);
    }
    core.viewEntity.innerHTML = `<span class="embed-icon"></span><span>Copy embed</span>`;
    core.viewEntity.setAttribute("aria-label", "Copy embed code");
    core.viewEntity.setAttribute("title", "Copy embed code");
    core.viewEntity.hidden = false;
  }
  metadataContent +=
      '</div>' +  // #metadata-content
    '</div>';  
  appendMetadata(metadataContent);
  bindMetadataInteractions();
  requestAnimationFrame(updateMetadataOverflow);
}

/**
 * Handles settings for the loaded object and camera.
 */
export async function settingsHandler(object, hierarchyMain, data) {
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0) {
    setupObject(object, data);
    await setupCamera(object, data);
  } else {
    setupObject(object, data);
    await setupCamera(object, data);
    if (object.name === "undefined") object.name = "level";
    if (hierarchyMain && !lilGUIhasFolder(hierarchyMain, object.name)) {
      hierarchyMain.addFolder(object.name).close();
    }
  }
}

function safeURL(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

async function loadMetadataData(metadataUrl) {
  // proxy / non-lightweight
  if (core.CONFIG.entity.proxyPath !== undefined || metadataUrl === null || metadataUrl === '') {
    console.log("No metadata found due to proxy or null URL", core.CONFIG.entity.proxyPath);
    return null; // no data → proxy
  }

  try {
    if (core.isLocalPreview) {
      return null;
    }
    const response = await fetch(metadataUrl, { cache: "no-cache" });

    if (response.status === 404) {
      showToast("No settings " + core.fileObject.filename + "_viewer.json found");
      return null;
    }

    showToast("Settings " + core.fileObject.filename + "_viewer.json found");
    return response.json();
  } catch (error) {
    showToast("Error fetching metadata: " + error.message);
    return null;
  }
}

/**
 * Fetches settings and metadata for the loaded model.
 */
export async function fetchSettings(object) {
  var metadata = { vertices: 0, faces: 0 };
  let metadataUrl = '';

  // Skip metadata fetch for blob URLs (drag & drop files)
  if (core.fileObject.filename.startsWith('blob:')) {
    console.log("Skipping metadata fetch for local file");
  } else if (core.CONFIG.metadataUrl && core.fileObject.uri && core.fileObject.filename) {
    metadataUrl = new URL(
      `${core.CONFIG.metadataUrl}/${core.fileObject.uri}metadata/${core.fileObject.filename}_viewer.json`
    ).href;
    console.log("Fetched metadata from:", metadataUrl);
  } else {
    console.warn("Metadata URL or file information is missing. Skipping metadata fetch.");
  }

  let hierarchyMain;
  const existingHierarchy = lilGUIgetFolder(core.gui, "Hierarchy");
  if (existingHierarchy === null) {
    hierarchyMain = core.gui?.addFolder("Hierarchy").close();
  } else {
    hierarchyMain = existingHierarchy;
  }
  if (core.CONFIG.entity.metadata.sourceType === "IIIF") {
    console.log("Fetching IIIF metadata from ", core.objectsConfig);
    await handleMetadataResponse( core.CONFIG.model, metadata, object, hierarchyMain);
  }
  else if (metadataUrl) {
    console.log("Loading metadata from URL:", metadataUrl);
    if (core.CONFIG.entity.proxyPath !== undefined || core.isLightweight) {
      metadataUrl = core.getProxyPath(metadataUrl, core.CONFIG);
      const data = await loadMetadataData(metadataUrl);
      await handleMetadataResponse(data, metadata, object, hierarchyMain);
      settingsHandler(object, hierarchyMain, core.CONFIG);
    } else {
      const data = await loadMetadataData(metadataUrl);
      await handleMetadataResponse(data, metadata, object, hierarchyMain);
    }
  } else {
    await handleMetadataResponse("", metadata, object, hierarchyMain);
  }
  // Add statistics GUI
  let statsMain;
  if (lilGUIgetFolder(core.gui, "Statistics") === null) {
    statsMain = core.gui.addFolder("Statistics").close();
    statsMain
    .add(core.CONFIG.viewer.performanceMode, "Performance", {
      "High-performance": "high-performance",
      "Low-power": "low-power",
      Default: "default",
    })
    .onChange(function (value) {
      if (typeof core.renderer !== "undefined") core.renderer.powerPreference = value;
    });
    statsMain.onOpenClose((changedGUI) => {
    if (changedGUI._closed) {
      if (typeof core.stats !== "undefined") core.stats.dom.style.visibility = "hidden";
    } else {
      if (typeof core.stats !== "undefined") core.stats.dom.style.visibility = "visible";
    }
    });
    if (typeof core.guiContainer !== "undefined" && typeof core.stats !== "undefined") {
      core.guiContainer.appendChild(core.stats.dom);
      core.stats.dom.style.left = (core.lilGui[0]?.getBoundingClientRect().width - core.stats.domElement.getBoundingClientRect().width + 10) + 'px';
    }
  }
}

export function createIIIFDropdown(iiifConfigURL) {
  // list of candidate IIIF config URLs (add more as needed)
  const iiifList = [
    { url: iiifConfigURL.url, name: iiifConfigURL.name },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json", name: "Model Position and Scale" },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin.json", name: "Model Origin" },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin_bgcolor.json", name: "Model Origin with background color" },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_position.json", name: "Model Position" },
  ].filter(Boolean);

  const group = document.createElement("div");
  group.className = "form-IIIF-group";

  const label = document.createElement("label");
  label.textContent = "IIIF manifest";
  label.className = "form-IIIF-label";

  const select = document.createElement("select");
  select.id = "iiif-manifest-select";
  select.name = "iiif-manifest-select";

  iiifList.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.url;
    opt.textContent = item.name;
    select.appendChild(opt);
  });

  group.appendChild(label);
  group.appendChild(select);

  // add on the top
  document.querySelector("#form-IIIF-content").prepend(group);

}

export function createIIIFUI() {
  const formContainer = document.createElement("div");
  formContainer.id = "form-IIIF";

  /* header */
  const header = document.createElement("div");
  header.className = "form-IIIF-header";
  header.innerHTML = `
    <span class="title">IIIF Loader</span>
    <div class="tools">
      <button type="button" id="iiif-toggle-collapse" title="Collapse">▾</button>
    </div>
  `;

  formContainer.appendChild(header);

  /* content */
  const content = document.createElement("div");
  content.className = "form-IIIF-content";
  content.id = "form-IIIF-content";
  content.innerHTML = `
    <div class="form-IIIF-group">
      <input type="text" id="manifest-url" placeholder="https://example.org/iiif/manifest.json">
      <button class="primary" id="load-manifest-from-url">Load from URL</button>
    </div>

    <div class="form-IIIF-group column">
      <textarea id="manifest-text" rows="8" placeholder="Paste IIIF manifest JSON here…"></textarea>
      <div class="actions">
        <button class="secondary" id="load-manifest-from-text">Load from Text</button>
      </div>
    </div>
  `;

  formContainer.appendChild(content);

  document.body.appendChild(formContainer);
}
