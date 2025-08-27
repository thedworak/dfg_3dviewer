import { truncateString, getProxyPath, hexToRgb } from "./utils.js";
import {
  setupObject,
  setupCamera,
  fetchMetadata,
  selectObjectHierarchy
} from "./main.js";

import { showToast } from "./loaders.js";

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

/**
 * Expands/collapses the metadata panel.
 */
export function expandMetadata() {
  const el = document.getElementById("metadata-content");
  el.classList.toggle("expanded");
  const elm = document.getElementById("metadata-collapse");
  elm.classList.toggle("metadata-collapsed");
}

/**
 * Appends metadata HTML to the DOM.
 */
export function appendMetadata(
  metadataContent,
  canvasText,
  metadataContainer,
  container,
  metadataContentTech
) {
  metadataContent += metadataContentTech + "</div>";
  canvasText.innerHTML = metadataContent;
  metadataContainer.appendChild(canvasText);
  container.appendChild(metadataContainer);
}

/**
 * Handles metadata response and builds the metadata UI.
 */
export async function handleMetadataResponse(
  data,
  metadata,
  fileObject,
  object,
  camera,
  light,
  controls,
  hierarchyMain,
  CONFIG,
  entityID,
  container,
  metadataContainer,
  canvasText,
  bottomLineGUI,
  compressedFile,
  viewEntity,
  helperObjects
) {
  var tempArray = [];
  let hierarchyFolder;
  let metadataContentTech = '<hr class="metadataSeparator">';
  if (Array.isArray(object)) {
    setupObject(object[0], light, controls, CONFIG);
    await setupCamera(object[0], camera, light, controls, CONFIG, helperObjects);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh"
  ) {
    setupObject(object, light, controls, CONFIG);
    object.traverse(function (child) {
      if (child.isMesh) {
        metadata["vertices"] += fetchMetadata(child, "vertices");
        metadata["faces"] += fetchMetadata(child, "faces");
        if (child.name === "") child.name = "Mesh";
        var shortChildName = truncateString(child.name, 35);
        tempArray = {
          [shortChildName]() {
            selectObjectHierarchy(child.id, container);
          },
          id: child.id,
        };
        hierarchyFolder = hierarchyMain.addFolder(shortChildName).close();
        hierarchyFolder.add(tempArray, shortChildName);
        child.traverse(function (children) {
          if (children.isMesh && children.name !== child.name) {
            if (children.name === "") children.name = "ChildrenMesh";
            var shortChildrenName = truncateString(children.name, 35);
            tempArray = {
              [shortChildrenName]() {
                selectObjectHierarchy(children.id, container);
              },
              id: children.id,
            };
            hierarchyFolder.add(tempArray, shortChildrenName);
          }
        });
      }
    });
    await setupCamera(object, camera, light, controls, CONFIG, helperObjects);
  } else {
    setupObject(object, light, controls, CONFIG);
    await setupCamera(object, camera, light, controls, CONFIG, helperObjects);
    metadata["vertices"] += fetchMetadata(object, "vertices");
    metadata["faces"] += fetchMetadata(object, "faces");
    if (object.name === "") {
      tempArray = {
        ["Mesh"]() {
          selectObjectHierarchy(object.id, container);
        },
        id: object.id,
      };
      object.name = object.id;
    } else {
      tempArray = {
        [object.name]() {
          selectObjectHierarchy(object.id, container);
        },
        id: object.id,
      };
    }
    hierarchyFolder = hierarchyMain.addFolder(object.name).close();
  }

  hierarchyMain.domElement.classList.add("hierarchy");

  var metadataContent =
    '<div id="metadata-collapse" class="metadata-collapse metadata-collapsed">METADATA </div><div id="metadata-content" class="metadata-content expanded">';
  metadataContentTech +=
    "Visualized file: <b>" + fileObject.basename + "." + fileObject.orgExtension + "</b><br>";
  metadataContentTech += "Vertices: <b>" + metadata["vertices"] + "</b><br>";
  metadataContentTech += "Faces: <b>" + metadata["faces"] + "</b><br>";
  viewEntity = document.createElement("div");
  viewEntity.setAttribute("id", "viewEntity");

  if (
    CONFIG.viewer.lightweight !== true &&
    CONFIG.viewer.lightweight !== null
  ) {
    var req = new XMLHttpRequest();
    req.responseType = "";
    req.open(
      "GET",
      CONFIG.metadataUrl + CONFIG.viewer.exportPath + entityID + "?page=0&amp;_format=xml",
      true
    );
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if (req.status == 200) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(
            req.responseText,
            "application/xml"
          );
          if (doc.documentElement.childNodes > 0) {
            var data = doc.documentElement.childNodes[0].childNodes;
            if (typeof data !== undefined) {
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

          let downloadModel = document.createElement("div");
          downloadModel.setAttribute("id", "downloadModel");

          var c_path = fileObject.path;
          if (compressedFile !== "") {
            fileObject.filename = fileObject.filename.replace(fileObject.orgExtension, fileObject.extension);
          }
          downloadModel.innerHTML =
            "<a href='blob:" +
            c_path +
            fileObject.filename +
            "' download><img src='" +
            CONFIG.baseModulePath +
            "/img/cloud-arrow-down.svg' alt='download' width=25 height=25 title='Download source file'/></a>";
          downloadModel.style.top = bottomLineGUI + "px";
          container.appendChild(downloadModel);

          metadataContainer.appendChild(viewEntity);
          appendMetadata(
            metadataContent,
            canvasText,
            metadataContainer,
            container,
            metadataContentTech
          );

          document
            .getElementById("metadata-collapse")
            .addEventListener("click", expandMetadata, false);
        } else 
          showToast("Error during loading metadata content");
      }
    };
    req.send(null);
  } else {
    viewEntity.innerHTML =
      "<a href='" +
      CONFIG.mainUrl +
      CONFIG.entity.viewEntityPath +
      entityID +
      "/view' target='_blank'><img src='" +
      CONFIG.baseModulePath +
      "/img/share.svg' alt='View Entity' width=22 height=22 title='View Entity'/></a>";
    appendMetadata(metadataContent, canvasText, metadataContainer, container, metadataContentTech);
  }
}

/**
 * Handles settings for the loaded object and camera.
 */
export async function settingsHandler(object, camera, light, controls, hierarchyMain, CONFIG, helperObjects) {
  if (Array.isArray(object)) {
    setupObject(object[0], light, controls, CONFIG, helperObjects);
    await setupCamera(object[0], camera, light, controls, CONFIG, helperObjects);
  } else if (object.name === "Scene" || object.children.length > 0) {
    setupObject(object, light, controls, CONFIG, helperObjects);
    await setupCamera(object, camera, light, controls, CONFIG, helperObjects);
  } else {
    setupObject(object, light, controls, CONFIG, helperObjects);
    await setupCamera(object, camera, light, controls, CONFIG, helperObjects);
    if (object.name === "undefined") object.name = "level";
    hierarchyMain.addFolder(object.name).close();
  }
}

/**
 * Fetches settings and metadata for the loaded model.
 */
export async function fetchSettings(
  fileObject,
  object,
  camera,
  light,
  controls,
  gui,
  CONFIG,
  getProxyPath,
  stats,
  guiContainer,
  entityID,
  container,
  metadataContainer,
  canvasText,
  bottomLineGUI,
  compressedFile,
  viewEntity,
  helperObjects
) {
  var metadata = { vertices: 0, faces: 0 };
  let metadataUrl = fileObject.path + "metadata/" + fileObject.filename + "_viewer";

  if (Array.isArray(object)) {
    helperObjects.push(object[0]);
  } else {
    helperObjects.push(object);
  }

  const hierarchyMain = gui.addFolder("Hierarchy").close();
  if (CONFIG.entity.proxyPath !== undefined) {
    metadataUrl = getProxyPath(metadataUrl, CONFIG, fileObject);
    settingsHandler(object, camera, light, controls, hierarchyMain, CONFIG, helperObjects);
  } else if (CONFIG.entity.metadata.source === "IIIF") {
    await handleMetadataResponse(
      CONFIG.model,
      metadata,
      fileObject,
      object,
      camera,
      light,
      controls,
      hierarchyMain,
      CONFIG,
      entityID,
      container,
      metadataContainer,
      canvasText,
      bottomLineGUI,
      compressedFile,
      viewEntity,
      helperObjects
    );
  } else {
    fetch(metadataUrl, { cache: "no-cache" })
      .then((response) => {
        if (response["status"] !== 404) {
          showToast("Settings " + fileObject.filename + "_viewer found");
          return response.json();
        } else if (response["status"] === 404) {
          showToast("No settings " + fileObject.filename + "_viewer found");
        }
      })
      .then(async (data) => {
        await handleMetadataResponse(
          data,
          metadata,
          fileObject,
          object,
          camera,
          light,
          controls,
          hierarchyMain,
          CONFIG,
          entityID,
          container,
          metadataContainer,
          canvasText,
          bottomLineGUI,
          compressedFile,
          viewEntity,
          helperObjects
        );
      });
  }
  // Add statistics GUI
  const statsMain = gui.addFolder("Statistics").close();
  statsMain
    .add(CONFIG.viewer.performanceMode, "Performance", {
      "High-performance": "high-performance",
      "Low-power": "low-power",
      Default: "default",
    })
    .onChange(function (value) {
      if (typeof renderer !== "undefined") renderer.powerPreference = value;
    });
  statsMain.onOpenClose((changedGUI) => {
    if (changedGUI._closed) {
      if (typeof stats !== "undefined") stats.dom.style.visibility = "hidden";
    } else {
      if (typeof stats !== "undefined") stats.dom.style.visibility = "visible";
    }
  });
  if (typeof guiContainer !== "undefined" && typeof stats !== "undefined") {
    guiContainer.appendChild(stats.dom);
  }
}
