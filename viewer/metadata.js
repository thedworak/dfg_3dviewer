import { truncateString } from "./utils.js";
import { showToast, setupObject, setupCamera } from './viewer-utils.js';
import { core } from './core.js';

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
      default:
        _str = "";
        break;
    }
    if (_str == "period") {
      return "Reconstruction period: <b>" + value + " - ";
    } else if (_str == "-") {
      return value + "</b><br>";
    } else if (_str !== "") {
      return _str + ": <b>" + value + "</b><br>";
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

  if (!content || !toggle) return;

  const expanded = content.classList.toggle("expanded");
  toggle.classList.toggle("metadata-collapsed", !expanded);

  // accessibility
  toggle.setAttribute("aria-expanded", expanded);
}

/**
 * Appends metadata HTML to the DOM.
 */
export function appendMetadata(
  metadataContent,
  metadataContentTech
) {
  metadataContent += metadataContentTech + "</div>";

  core.metadataContainer.innerHTML = metadataContent;

  if (!core.container.contains(core.metadataContainer)) {
    core.container.appendChild(core.metadataContainer);
  }
}

export function fetchMetadata(_object, _type) {
  switch (_type) {
    case "vertices":
      if (
        typeof _object.geometry.index !== "undefined" &&
        _object.geometry.index !== null
      ) {
        return _object.geometry.index.count;
      } else if (
        typeof _object.attributes !== "undefined" &&
        _object.attributes !== null
      ) {
        return _object.attributes.position.count;
      }
      break;
    case "faces":
      if (
        typeof _object.geometry.index !== "undefined" &&
        _object.geometry.index !== null
      ) {
        return _object.geometry.index.count / 3;
      } else if (
        typeof _object.attributes !== "undefined" &&
        _object.attributes !== null
      ) {
        return _object.attributes.position.count / 3;
      }
      break;
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
  let metadataContentTech = '';
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh"
  ) {
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
    if (lilGUIgetFolder(core.gui, "Hierarchy") !== null && !lilGUIhasFolder(hierarchyMain, object.name)) {
      hierarchyFolder = hierarchyMain.addFolder(object.name).close();
    }
  }

  if (typeof hierarchyMain !== "undefined") {
    hierarchyMain.domElement.classList.add("hierarchy");
  }

  if (!core.metadataContainer) {
    core.metadataContainer = document.createElement("div");
    core.metadataContainer.id = "metadata-container";
    document.body.appendChild(core.metadataContainer);
  }

  var metadataContent =
    '<div id="metadata-card">' +
      '<div id="metadata-collapse" class="metadata-collapse">METADATA</div>' +
      '<div id="metadata-content" class="metadata-content expanded">';
  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label">Visualized file:</span>' +
      '<span class="metadata-value">' +
        core.fileObject.basename + '.' + core.fileObject.extension +
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
    core.viewEntity = document.createElement("div");
    core.viewEntity.setAttribute("id", "viewEntity");

  if (!core.isLightweight) {

    if (!document.getElementById("downloadModel")) {
      core.downloadModel.setAttribute("id", "downloadModel");

      var c_path = core.fileObject.path;
      if (core.loadedFile !== "") core.fileObject.filename = core.fileObject.filename.replace(core.fileObject.orgExtension, core.fileObject.extension);

      core.container.appendChild(core.downloadModel);
      const scriptUrl = document.currentScript?.src || import.meta.url;
      let DFG_ASSETS = scriptUrl.replace(/dfg_3dviewer-module\.js.*$/, 'assets/img');

      core.downloadModel.innerHTML = `
        <a href="blob:${c_path}${core.fileObject.filename}" download>
          <img src="${DFG_ASSETS}/download-icon.svg" alt="download" width="28" height="28" title="Download source file"/>`;
    }

    if (core.fetchMetadataXML) {
      var req = new XMLHttpRequest();
      req.open(
        "GET",
        core.CONFIG.viewer.exportPath +
          core.CONFIG.entity.id +
          "?domain=" + encodeURIComponent(core.CONFIG.metadataUrl),
        true
      );

      req.onreadystatechange = function () {
        if (req.readyState !== 4) return;
          try {
            if (req.status === 200) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(
              req.responseText,
              "application/xml"
            );

            if (doc.documentElement.childNodes.length > 0) {
              var data = doc.documentElement.childNodes[0].childNodes;
              if (data !== undefined) {
                for (var i = 0; i < data.length; i++) {
                  var fetchedValue = addWissKIMetadata(
                    data[i].tagName,
                    data[i].textContent
                  );
                  if (typeof fetchedValue !== "undefined") {
                    metadataContent += fetchedValue;
                  }
                }
              }
            }

            core.metadataContainer.appendChild(core.viewEntity);
            } else {
              showToast("No metadata found for entity " + core.CONFIG.entity.id);
            }
          } finally {
            metadataContent +=
                '</div>' +  // #metadata-content
              '</div>';  
            appendMetadata( metadataContent, metadataContentTech);
          }
      };

      req.send(null);
    }
  } else {
    const scriptUrl = document.currentScript?.src || import.meta.url;
    let DFG_ASSETS = scriptUrl.replace(/dfg_3dviewer-module\.js.*$/, 'assets/img/');
    metadataContent +=
      '</div>' +  // #metadata-content
    '</div>';  

    core.viewEntity.innerHTML =
      `<a href='${core.CONFIG.mainUrl}${core.CONFIG.entity.viewEntityPath}${core.CONFIG.entity.id}/view' target='_blank'><img src='${DFG_ASSETS}share.svg' alt='View Entity' width=22 height=22 title='View Entity'/></a>`;
    appendMetadata(metadataContent, metadataContentTech);
  }
  core.metadataContainer.addEventListener("click", (e) => {
    if (e.target.id === "metadata-collapse") {
      expandMetadata(e);
    }
  });
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
    if (!lilGUIhasFolder(hierarchyMain, object.name)) {
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
  if (core.CONFIG.entity.proxyPath !== undefined || core.isLightweight) {
    console.log("No metadata found due to proxy or lightweight mode", core.CONFIG.entity.proxyPath);
      return null; // no data → proxy
  }

  const response = await fetch(metadataUrl, { cache: "no-cache" });

  if (response.status === 404) {
    showToast("No settings " + core.fileObject.filename + "_viewer.json found");
    return null;
  }

  showToast("Settings " + core.fileObject.filename + "_viewer.json found");
  return response.json();
}

/**
 * Fetches settings and metadata for the loaded model.
 */
export async function fetchSettings(object) {
  var metadata = { vertices: 0, faces: 0 };
  // Concat URL for metadata file
  function toURL(value, base = window.location.href) {
    try {
      return new URL(value, base);
    } catch {
      return null;
    }
  }

  let metadataUrl = '';

  if (core.CONFIG.metadataUrl && core.fileObject.uri && core.fileObject.filename) {
    metadataUrl = new URL(
      `${core.CONFIG.metadataUrl}/${core.fileObject.uri}metadata/${core.fileObject.filename}_viewer.json`
    ).href;
    console.log("Fetched metadata from:", metadataUrl);
  } else {
    console.warn("Metadata URL or file information is missing. Skipping metadata fetch.");
  }

  let hierarchyMain;
  if (lilGUIgetFolder(core.gui, "Hierarchy") === null) {
    hierarchyMain = core.gui?.addFolder("Hierarchy").close();
  }
  if (core.CONFIG.entity.proxyPath !== undefined || core.isLightweight) {
    metadataUrl = core.getProxyPath(metadataUrl, core.CONFIG);
    const data = await loadMetadataData(metadataUrl);
    await handleMetadataResponse(data, metadata, object, hierarchyMain);
    settingsHandler(object, hierarchyMain, core.CONFIG);
  } else if (core.CONFIG.entity.metadata.source === "IIIF") {
    console.log("Fetching IIIF metadata from ", core.objectsConfig);
    await handleMetadataResponse( core.CONFIG.model, metadata, object, hierarchyMain);
  } else {
    const data = await loadMetadataData(metadataUrl);
    await handleMetadataResponse(data, metadata, object, hierarchyMain);
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

export function createIIIFDropdown(iiifConfigURL, canvasDimensions) {
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
