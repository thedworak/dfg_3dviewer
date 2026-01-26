// viewer-utils.js
import THREE from "./init.js";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import { core, setCore } from './core.js';
import TWEEN, { add } from "three/examples/jsm/libs/tween.module.js";

export const initClippingPlanes = () => {
  const clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  ];
  setCore('clippingPlanes', clippingPlanes);
  return clippingPlanes;
};

export var toastifyOptions = {
  duration: 6500,
  gravity: "bottom",
  close: true,
  callback() {
    Toastify.reposition();
  },
};

export const showToast = (message) => {
    var myToast = Toastify(toastifyOptions);
    myToast.options.text = message;
    myToast.showToast();
};

function fetchObjectFromConfig(_name) {
  //console.log("Fetching config for", _name, core.objectsConfig);
  return core.objectsConfig?.models?.find(model => model.name === _name);
}

function setupObjectHandler (_object, _metadata) {
  if (typeof _metadata !== "undefined") {
    if (typeof _metadata.position !== "undefined")
      _object.position.set(_metadata.position.x, _metadata.position.y, _metadata.position.z);
    else if (typeof _metadata["objPosition"] !== "undefined")
      _object.position.set(_metadata["objPosition"][0], _metadata["objPosition"][1], _metadata["objPosition"][2]);
    if (typeof _metadata.scale !== "undefined")
      _object.scale.set(_metadata.scale.x, _metadata.scale.y, _metadata.scale.z);
    else if (typeof _metadata["objScale"] !== "undefined")
      _object.scale.set(_metadata["objScale"][0], _metadata["objScale"][1], _metadata["objScale"][2]);
    if (typeof _metadata.rotation !== "undefined")
      _object.rotation.set(THREE.MathUtils.degToRad(_metadata.rotation.x), THREE.MathUtils.degToRad(_metadata.rotation.y), THREE.MathUtils.degToRad(_metadata.rotation.z));
    else if (typeof _metadata["objRotation"] !== "undefined")
      _object.rotation.set(THREE.MathUtils.degToRad(_metadata["objRotation"][0]), THREE.MathUtils.degToRad(_metadata["objRotation"][1]), THREE.MathUtils.degToRad(_metadata["objRotation"][2]));
  }
}

function setupGeometryHandler (_object) {
  _object.needsUpdate = true;
  if (typeof _object.geometry !== "undefined") {
    _object.geometry.computeBoundingBox();
    _object.geometry.computeBoundingSphere();
  }
  _object.updateMatrix();
  _object.updateMatrixWorld(true);
}

export const setupObject = (_object, _light, _controls, _metadata = {}) => {
  let model;
  if (typeof _object.children === "undefined" || _object.children.length == 0) {
    model = fetchObjectFromConfig(_object.name);
  } else if (_object.children.length > 0) {
    model = fetchObjectFromConfig(_object.children[0].name); //TODO: check for multiple objects
  }

  if (_metadata !== null) {
    console.log("Applying metadata for object", _object.name, _metadata);
    setupObjectHandler(_object, _metadata);
    setupGeometryHandler(_object);
  }
  else if (typeof core.objectsConfig !== "undefined" && model) { //Setup from config
    if ((typeof core.objectsConfig.models == undefined || core.objectsConfig.models?.length == 0) && _metadata == undefined) {
      if (typeof model.position !== undefined) _object.position.set(model.position.x, model.position.y, model.position.z);

      if (typeof model.scale !== undefined) _object.scale.set(model.scale.x, model.scale.y, model.scale.z);
      
      if (typeof model.rotation !== undefined) _object.rotation.set(THREE.MathUtils.degToRad(model.rotation.x), THREE.MathUtils.degToRad(model.rotation.y), THREE.MathUtils.degToRad(model.rotation.z));
    } else {
      let m = core.objectsConfig.models[core.objectsConfig.setupIndex];
      if (m !== undefined && _metadata == undefined) {
        //console.log("Applying config for index", core.objectsConfig.setupIndex, m);
        setupObjectHandler(_object, m);
      } else if (_metadata !== undefined) {
        // Fallback to metadata
        setupObjectHandler(_object, _metadata);
      }        
    }
    setupGeometryHandler(_object);
  }
  else {
    var boundingBox = new THREE.Box3();
    if (Array.isArray(_object)) {
      for (let i = 0; i < _object.length; i++) {
        boundingBox.setFromObject(_object[i]);
        _object[i].position.set(
          -(boundingBox.min.x + boundingBox.max.x) / 2,
          -boundingBox.min.y,
          -(boundingBox.min.z + boundingBox.max.z) / 2
        );
        _object[i].needsUpdate = true;
        if (typeof _object[i].geometry !== "undefined") {
          _object[i].geometry.computeBoundingBox();
          _object[i].geometry.computeBoundingSphere();
        }
        _object[i].updateMatrixWorld();
      }
    } else if (_object.isGroup) {
      //workaround for specific Group case
      boundingBox.setFromObject(_object);
      _object.position.set(-(boundingBox.min.x+boundingBox.max.x)/2, -boundingBox.min.y, -(boundingBox.min.z+boundingBox.max.z)/2);
      _object.updateMatrixWorld();
    } else {
      boundingBox.setFromObject(_object);
      _object.position.set((boundingBox.max.x - boundingBox.min.x ) / 2, (boundingBox.max.y - boundingBox.min.y) / 2, (boundingBox.max.z - boundingBox.min.z ) / 2);
      _object.updateMatrixWorld();
      _object.needsUpdate = true;
      if (typeof _object.geometry !== "undefined") {
        _object.geometry.computeBoundingBox();
        _object.geometry.computeBoundingSphere();
      }
    }
  }

  core.cameraLight.position.set(
    core.camera.position.x,
    core.camera.position.y,
    core.camera.position.z
  );
  if (Array.isArray(_object)) {
    core.cameraLightTarget.position.set(
      _object[0].position.x,
      _object[0].position.y,
      _object[0].position.z
    );
  } else {
    core.cameraLightTarget.position.set(
      _object.position.x,
      _object.position.y,
      _object.position.z
    );
  }
  core.cameraLight.target.updateMatrixWorld();
  core.objectsConfig.setupIndex++;
}

async function setupEmptyCamera(_object) {
  console.log("Setting up empty camera");
  var boundingBox = new THREE.Box3();
  if (Array.isArray(_object)) {
    for (let i = 0; i < _object.length; i++) {
      boundingBox.setFromObject(_object[i]);
    }
  } else {
    boundingBox.setFromObject(_object);
  }
  var size = new THREE.Vector3();
  boundingBox.getSize(size);
  core.camera.position.set(size.x, size.y, size.z);
  await fitCameraToCenteredObject(_object, true);
}

export async function setupCamera (_object, _light, _config) {
  if (core.objectsConfig !== undefined || _config !== undefined) {    
    // Setup camera position
    if (_config?.["cameraPosition"] !== undefined) {
      core.camera.position.set(_config["cameraPosition"][0], _config["cameraPosition"][1], _config["cameraPosition"][2]);
    } else if (core.objectsConfig?.camera?.position) {
      core.camera.position.set(core.objectsConfig.camera.position.x, core.objectsConfig.camera.position.y, core.objectsConfig.camera.position.z);
    } else {
      await setupEmptyCamera(_object);
    }
 
     // Setup controls target
    let customZoom = 0;
    if (_config !== undefined) {

      if  (_config?.["controlsZoom"] !== undefined) {
        customZoom = _config["controlsZoom"][0];
      }
      if (_config?.["controlsTarget"] !== undefined) {
        core.controls.target.set(_config["controlsTarget"][0], _config["controlsTarget"][1], _config["controlsTarget"][2]);
      }
    }
    else if (core.objectsConfig?.camera?.target && core.controls) {
      core.controls.target.set(core.objectsConfig.camera.target.x, core.objectsConfig.camera.target.y, core.objectsConfig.camera.target.z);
    }
    if (customZoom !== 0) {
      const dir = new THREE.Vector3()
      .subVectors(core.camera.position, core.controls.target)
      .normalize();

      // nowa pozycja kamery
      core.camera.position
      .copy(core.controls.target)
      .add(dir.multiplyScalar(customZoom));

      core.controls.update();      
    }
    //await fitCameraToCenteredObject(core.camera, _object, 1.2, true);

    // Setup lights
    if (_config === undefined) {
    core.objectsConfig.scene.lights.forEach(light => {
      switch (light.type) {
        case "directional":
          _light.position.set(light.position.x, light.position.y, light.position.z);
          _light.rotation.set(light.target.x, light.target.y, light.target.z);
          _light.color = new THREE.Color().setHex(light.color);
          core.colors["DirectionalLight"] = light.color;
          core.intensity.startIntensityDir = _light.intensity = light.intensity;

        break;
        case "ambient":
          core.ambientLight.color = new THREE.Color().setHex(light.color);
          core.colors["AmbientLight"] = light.color;
          core.intensity.startIntensityAmbient = core.ambientLight.intensity = light.intensity;
        break;
        case "point":
          core.cameraLight.color = new THREE.Color().setHex(light.color);
          core.colors["CameraLight"] = light.color;
          core.intensity.startIntensityCamera = core.cameraLight.intensity = light.intensity;
        break;
      }
    });
  } else {
    if (_config?.["lightAmbientColor"] !== undefined) {
      _light.color = new THREE.Color().setHex(_config["lightAmbientColor"][0]);
      core.colors["AmbientLight"] = _config["lightAmbientColor"][0];
      core.intensity.startIntensityAmbient = core.ambientLight.intensity = _config["lightAmbientIntensity"] !== undefined ? _config["lightAmbientIntensity"][0] : core.ambientLight.intensity;
    }
    if (_config?.["lightColor"] !== undefined) {
      _light.color = new THREE.Color().setHex(_config["lightColor"][0]);
      core.colors["DirectionalLight"] = _config["lightColor"][0];
      core.intensity.startIntensityDir = _light.intensity = _config["lightIntensity"] !== undefined ? _config["lightIntensity"][0] : _light.intensity;
    }
    if (_config?.["lightCameraColor"] !== undefined) {
      core.cameraLight.color = new THREE.Color().setHex(_config["lightCameraColor"][0]);
      core.colors["CameraLight"] = _config["lightCameraColor"][0];
      core.intensity.startIntensityCamera = core.cameraLight.intensity = _config["lightCameraIntensity"] !== undefined ? _config["lightCameraIntensity"][0] : core.cameraLight.intensity;
    }
  }

    // Setup background
    let _foundScene = false;
    if (core.objectsConfig.scenes !== undefined && Array.isArray(core.objectsConfig.scenes)) {
        core.objectsConfig.scenes.forEach(_scene => {
          if (_scene.background !== null) {
            if ("red" in _scene.background && "green" in _scene.background && "blue" in _scene.background) {
              var newBackground = new THREE.Color(`rgb(${_scene.background.red}, ${_scene.background.green}, ${_scene.background.blue})`);
              if (newBackground !== null) {
                _foundScene = true;
                changeBackground("linear", "#" + newBackground.getHexString());
              }
            }
          }
        });
    } 
    if (!_foundScene) {
      if (core.objectsConfig.scene.background === null) {
        changeBackground("linear", "#ffffff", "#ffffff");
      } else {
        const gradient = parseGradient(core.objectsConfig.scene.background);
        const newBackground0 = new THREE.Color(`rgb(${gradient.colors[0].r}, ${gradient.colors[0].g}, ${gradient.colors[0].b})`);
        const newBackground1 = new THREE.Color(`rgb(${gradient.colors[1].r}, ${gradient.colors[1].g}, ${gradient.colors[1].b})`);
        changeBackground(gradient.type, "#" + newBackground0.getHexString(), "#" + newBackground1.getHexString());
      }
    }
    core.camera.updateProjectionMatrix();
    core.controls.update();
    await fitCameraToCenteredObject(_object, false);
  } 
  else {
    await setupEmptyCamera(_object);
  }
}

// Show interaction hint on first load
function showInteractionHint(boxCenter) {
  if (window.__E2E__) return;
  //if (localStorage.getItem("viewerHintSeen")) return;

  core.GESTURE.rotate = true;

  core.GESTURE.target = boxCenter.clone();
  core.controls.target.copy(core.GESTURE.target);

  core.handHint.hidden = false;
  core.handHint.classList.add("hand-drag-animate");
}

function animateCameraToPose ({
  finalCameraPos,     // THREE.Vector3 (target camera position)
  finalTarget,        // THREE.Vector3 (target)
  boundingBox,        // THREE.Box3 (optional, near/far)
  duration = 3500,
  easing = TWEEN.Easing.Cubic.Out,
  startOffsetFactor = 0.5, // % of moving back (0.2–0.4 should be good)
  animate = true,
  distanceOffsetFactor = 0,   // additional factor to move closer (0.1 = 10% closer) (optional)
  distanceOffsetUnits  = 0,   // additional world units to move closer (optional)
}) {

  const endCamPos = finalCameraPos.clone();
  const endTarget = finalTarget.clone();

  const dir = endCamPos.clone().sub(endTarget).normalize();

  const baseDistance = endCamPos.distanceTo(endTarget);

  const distanceOffset =
    baseDistance * distanceOffsetFactor + distanceOffsetUnits;

  const startCamPos = endCamPos.clone().add(
    dir.multiplyScalar(
      baseDistance * startOffsetFactor + distanceOffset
    )
  );
  const startTarget = endTarget.clone(); // target

  if (!animate) {
    core.camera.position.copy(endCamPos);
    core.controls?.target.copy(endTarget);
    core.controls?.update();
    return;
  }

  core.camera.position.copy(startCamPos);
  core.controls?.target.copy(startTarget);
  core.controls?.update();

  const camTweenPos = startCamPos.clone();
  const targetTweenPos = startTarget.clone();

  core.cameraTween = new TWEEN.Tween(camTweenPos)
    .to(endCamPos, duration)
    .easing(easing)
    .onUpdate(() => {
      core.camera.position.copy(camTweenPos);
    });

  core.targetTween = new TWEEN.Tween(targetTweenPos)
    .to(endTarget, duration)
    .easing(easing)
    .onUpdate(() => {
      core.controls?.target.copy(targetTweenPos);
      core.controls?.update();
    });

  core.cameraTween.start();
  core.targetTween.start();

  // === (near / far / limits) ===
  core.cameraTween.onComplete(() => {
    core.camera.position.copy(endCamPos);
    core.controls?.target.copy(endTarget);
    core.controls?.update();
    const boxCenter = boundingBox ? boundingBox.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    if (boundingBox) {
      const boxSize = boundingBox.getSize(new THREE.Vector3()).length();

      const maxDistance =
        endCamPos.distanceTo(boxCenter) + boxSize;

      core.camera.near = maxDistance / 100;
      core.camera.far  = maxDistance * 5;
      core.camera.updateProjectionMatrix();

      if (core.controls) {
        core.controls.maxDistance = maxDistance;
      }
    }
    showInteractionHint(boxCenter);
  });
}

async function fitCameraToCenteredObject(object, _fit) {
  const boundingBox = new THREE.Box3();
  if (Array.isArray(object)) {
    for (let i = 0; i < object.length; i++) {
      const box = new THREE.Box3().setFromObject(object[i]);
      boundingBox.union(box);
    }
  } else {
    boundingBox.setFromObject(object);
  }

  var size = new THREE.Vector3(), center = new THREE.Vector3();
  boundingBox.getSize(size);
  boundingBox.getCenter(center); // center point
  // ground
  var distance1 = new THREE.Vector3(
    Math.abs(boundingBox.max.x - boundingBox.min.x),
    Math.abs(boundingBox.max.y - boundingBox.min.y),
    Math.abs(boundingBox.max.z - boundingBox.min.z)
  );
  core.gridSize = Math.max(distance1.x, distance1.y, distance1.z);

  core.dirLightTarget = new THREE.Object3D();
  core.dirLightTarget.position.set(0, 0, 0);

  core.lightHelper = new THREE.DirectionalLightHelper(core.dirLight, core.gridSize);
  core.scene.add(core.lightHelper);
  core.lightHelper.visible = false;

  core.scene.add(core.dirLightTarget);
  core.dirLight.target = core.dirLightTarget;
  core.dirLight.target.updateMatrixWorld();

  var gridSizeScale = core.gridSize * 2.5;
  if (core.basicGrid !== undefined) core.scene.remove(core.basicGrid);
  core.basicGrid = new THREE.Group();
  var planeMaterial = new THREE.ShadowMaterial({ opacity: 0.35 })

  var planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(gridSizeScale, gridSizeScale), planeMaterial);

  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.set(0, 0, 0);
  planeMesh.receiveShadow = true;
  core.basicGrid.add(planeMesh);

  core.axesHelper = new THREE.AxesHelper(core.gridSize);
  core.axesHelper.position.set(0, 0, 0);
  core.axesHelper.visible = false;
  core.basicGrid.add(core.axesHelper);

  const grid = new THREE.GridHelper(gridSizeScale, 25, 0xaeaeae, 0x000000);
  grid.material.opacity = 0.05;
  grid.material.transparent = true;
  grid.position.set(0, 0, 0);
  core.basicGrid.add(grid);

  core.scene.add(core.basicGrid);
 
  // === fit camera distance ===
  const halfHeight = size.y / 2;
  const halfWidth  = size.x / 2;

  const fitHeightDistance =
    halfHeight / Math.tan(THREE.MathUtils.degToRad(core.camera.fov / 2));

  const fitWidthDistance =
    halfWidth /
    Math.tan(THREE.MathUtils.degToRad(core.camera.fov / 2)) /
    core.camera.aspect;

  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.55;

  // === target position ===
  const dir = new THREE.Vector3();
  core.camera.getWorldDirection(dir);
  dir.multiplyScalar(-distance);

  const finalCameraPos = center.clone().add(dir);
  const finalTarget = center.clone();

  // === animate ===
  animateCameraToPose({
    finalCameraPos,
    finalTarget,
    boundingBox,
    duration: 3500,
    startOffsetFactor: 0.15,
    distanceOffsetFactor: -0.5, // 0.1 = 10% closer
    distanceOffsetUnits: 0, // +0.5 world units
  });

  if (_fit) {
    var rotateMetadata = new THREE.Vector3();
    rotateMetadata = new THREE.Vector3(
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.x || 1),
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.y || 5),
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.z || 1)
    );
    core.objectsConfig.originalMetadata = {
      objPosition: [object.position.x, object.position.y, object.position.z],
      objRotation: [rotateMetadata.x, rotateMetadata.y, rotateMetadata.z],
      objScale: [
        core.helperObjects[0]?.scale.x || 1,
        core.helperObjects[0]?.scale.y || 5,
        core.helperObjects[0]?.scale.z || 1,
      ],
      cameraPosition: [core.camera.position.x, core.camera.position.y, core.camera.position.z],
      controlsTarget: [core.controls.target.x, core.controls.target.y, core.controls.target.z],
    };
  }
  setupClippingPlanes(object, core.gridSize, {x: boundingBox.max.x*1.1, y: boundingBox.max.y*1.1, z: boundingBox.max.z*1.1});
}

function parseGradient(str) {
  if (!str || typeof str !== "string") return null;

  // Match "radial-gradient" or "linear-gradient"
  const typeMatch = str.match(/(radial|linear)-gradient\s*\(([^,]+)/i);
  const gradientType = typeMatch ? typeMatch[1].toLowerCase() : null;
  const shapeOrDirection = typeMatch ? typeMatch[2].trim() : null;

  const colors = [];

  /* ==========================
     RGB / RGBA
  ========================== */
  const rgbMatches = str.matchAll(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/gi
  );

  for (const [, r, g, b, a] of rgbMatches) {
    colors.push({
      r: +r,
      g: +g,
      b: +b,
      a: a !== undefined ? +a : 1,
    });
  }

  /* ==========================
     HEX (#RGB / #RRGGBB)
  ========================== */
  const hexMatches = str.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})/gi);

  for (const [, hex] of hexMatches) {
    const fullHex =
      hex.length === 3
        ? hex.split("").map(c => c + c).join("")
        : hex;

    colors.push({
      r: parseInt(fullHex.slice(0, 2), 16),
      g: parseInt(fullHex.slice(2, 4), 16),
      b: parseInt(fullHex.slice(4, 6), 16),
      a: 1,
    });
  }

  return {
    type: gradientType,        // "radial" | "linear"
    shapeOrDirection,          // "circle", "to right", etc.
    colors,                    // [{ r, g, b, a }]
  };
}

function changeBackgroundHelper(_color1, _color2) {
  core.mainCanvas.style.setProperty(
    "background",
    "-moz-radial-gradient(circle, " + _color1 + " 0%, " + _color2 + " 100%)"
  );
  core.mainCanvas.style.setProperty(
    "background",
    "-webkit-radial-gradient(circle, " + _color1 + " 0%, " + _color2 + " 100%)"
  );
  core.mainCanvas.style.setProperty(
    "background",
    "radial-gradient(circle, " + _color1 + " 0%, " + _color2 + " 100%)"
  );
}

export function changeBackground(_type, _color1, _color2) {
  switch (_type) {
    case "linear":
      changeBackgroundHelper(_color1, _color1);
      break;
    case "gradient":
    case "radial":
      changeBackgroundHelper(_color1, _color2);
      break;
  }
}

function setupClippingPlanes(_geom, _size, _distance) {
  /*var _geometry;
  if (_geom.isGroup)
    _geometry = _geom.children;
  else
    _geometry = _geom.geometry.clone();*/
  core.clippingPlanes[0].constant = _distance.x;
  core.clippingPlanes[1].constant = _distance.y;
  core.clippingPlanes[2].constant = _distance.z;

  core.scene.add(core.transformControlClippingPlaneX.getHelper());
  core.scene.add(core.transformControlClippingPlaneY.getHelper());
  core.scene.add(core.transformControlClippingPlaneZ.getHelper());
  let planeColor = new THREE.Color(0xffffff).getHexString();
  if (core.scene.background != null) planeColor = core.scene.background.getHexString();

  core.planeHelpers = core.clippingPlanes.map(
    (p) => new THREE.PlaneHelper(p, _size * 2, invertHexColor(planeColor))
  );
  core.planeHelpers.forEach((ph) => {
    ph.visible = false;
    ph.name = "PlaneHelper";
    core.scene.add(ph);
  });

  core.distanceGeometry = _distance;
  let displayHelper = {x: getOrAddGuiController(core.clippingFolder, core.planeParams.planeX, "displayHelperX"), constantX: getOrAddGuiController(core.clippingFolder, core.planeParams.planeX, "constantX"), y: getOrAddGuiController(core.clippingFolder, core.planeParams.planeY, "displayHelperY"), constantY: getOrAddGuiController(core.clippingFolder, core.planeParams.planeY, "constantY"), z: getOrAddGuiController(core.clippingFolder, core.planeParams.planeZ, "displayHelperZ"), constantZ: getOrAddGuiController(core.clippingFolder, core.planeParams.planeZ, "constantZ"), outline: getOrAddGuiController(core.clippingFolder, core.planeParams.outline, "visible")};
  displayHelper.x.onChange((v) => {
      core.planeParams.clippingMode.x = core.planeHelpers[0].visible = v;
      if (v) {
        core.transformControlClippingPlaneX.attach(core.planeHelpers[0]);
        if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
      } else {
        core.transformControlClippingPlaneX.detach();
        if (
          !core.planeParams.clippingMode.y &&
          !core.planeParams.clippingMode.z &&
          !core.planeParams.outline.visible
        )
          core.outlineClipping.visible = false;
      }
    });

    displayHelper.constantX
      .min(-core.distanceGeometry.x)
      .max(core.distanceGeometry.x)
      .setValue(core.distanceGeometry.x)
      .step(_size / 100)
      .listen()
      .onChange((d) => (core.clippingPlanes[0].constant = d));

    displayHelper.y.onChange((v) => {
      core.planeParams.clippingMode.y = core.planeHelpers[1].visible = v;
      if (v) {
        core.transformControlClippingPlaneY.attach(core.planeHelpers[1]);
        if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
      } else {
        core.transformControlClippingPlaneY.detach();
        if (
          !core.planeParams.clippingMode.x &&
          !core.planeParams.clippingMode.z &&
          !core.planeParams.outline.visible
        )
          core.outlineClipping.visible = false;
      }
    });
    displayHelper.constantY
      .min(-core.distanceGeometry.y)
      .max(core.distanceGeometry.y)
      .setValue(core.distanceGeometry.y)
      .step(_size / 100)
      .listen()
      .onChange((d) => (core.clippingPlanes[1].constant = d));
  
    displayHelper.z.onChange((v) => {
      core.planeParams.clippingMode.z = core.planeHelpers[2].visible = v;
      if (v) {
        core.transformControlClippingPlaneZ.attach(core.planeHelpers[2]);
        if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
      } else {
        core.transformControlClippingPlaneZ.detach();
        if (
          !core.planeParams.clippingMode.x &&
          !core.planeParams.clippingMode.y &&
          !core.planeParams.outline.visible
        )
          core.outlineClipping.visible = false;
      }
    });
    displayHelper.constantZ
      .min(-core.distanceGeometry.z)
      .max(core.distanceGeometry.z)
      .setValue(core.distanceGeometry.z)
      .step(_size / 100)
      .listen()
      .onChange((d) => (core.clippingPlanes[2].constant = d));

    displayHelper.outline.onChange((v) => {
      core.outlineClipping.visible = v;
    });
}


// Color helpers
export function invertHexColor(hexTripletColor) {
  let color = hexTripletColor.substring(1);
  color = parseInt(color, 16);
  color = 0xffffff ^ color;
  color = color.toString(16);
  color = ("000000" + color).slice(-6);
  return "#" + color;
}

export function getOrAddGuiController(folder, object, prop) {
  let controller = folder.controllers.find(c => c._name === prop);
  if (controller) return controller;

  for (const subfolder of folder.folders) {
    const found = getOrAddController(subfolder, object, prop);
    if (found) return found;
  }
  return folder.add(object, prop);
}