// viewer-utils.js
import THREE from "./init.js";
import { core, setCore } from './core.js';
import TWEEN, { add } from "three/examples/jsm/libs/tween.module.js";
import { normalizeColor, parseCssColor } from './utils.js';
import { t } from "./i18n-utils.js";

export const initClippingPlanes = () => {
  const clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  ];
  setCore('clippingPlanes', clippingPlanes);
  return clippingPlanes;
};

const scaleXYZ = (v, s) =>
  ['x', 'y', 'z'].forEach(k => v[k] *= s);

const DEFAULT_NOTICE_DURATION = 4200;

function normalizeNoticeArgs(toneOrOptions, maybeOptions) {
  let tone = "info";
  let options = {};

  if (typeof toneOrOptions === "string") {
    tone = toneOrOptions;
    options = maybeOptions ?? {};
  } else if (toneOrOptions && typeof toneOrOptions === "object") {
    options = toneOrOptions;
    tone = toneOrOptions.tone ?? "info";
  }

  return { tone, options };
}

export const toastHelper = (key, toneOrOptions, maybeOptions) => {
  return showToast(`toasts.${key}`, toneOrOptions, maybeOptions);
};

export const showToast = (message, toneOrOptions, maybeOptions) => {
  const { tone, options } = normalizeNoticeArgs(toneOrOptions, maybeOptions);

  const duration = Number.isFinite(options.duration)
    ? options.duration
    : DEFAULT_NOTICE_DURATION;

  const key = String(options.key ?? "");
  const replace = options.replace === true;

  // Resolve i18n key if possible, otherwise use the message as-is (for backward compatibility)
  let text;

  if (typeof message === "string" && message.includes(".")) {
    // try to resolve as i18n key with optional variables
    text = t(message, options);
  } else {
    // fallback (old way)
    text = String(message);
  }

  if (window.__E2E__ && window.viewer) {
    window.viewer.toasts ??= [];
    window.viewer.toasts.push(text);
  }

  const statusNotice = core.statusNotice;
  const enqueueStatusNotice = core.enqueueStatusNotice;

  if (typeof enqueueStatusNotice === "function") {
    enqueueStatusNotice({ message: text, tone, duration, key, replace });
    return;
  }

  if (!statusNotice) {
    console.info(`[viewer:${tone}] ${text}`);
    return;
  }

  statusNotice.hidden = false;
  statusNotice.textContent = text;
  statusNotice.dataset.tone = tone;
  statusNotice.classList.remove("is-visible", "is-hiding");

  void statusNotice.offsetWidth;
  statusNotice.classList.add("is-visible");

  if (core.statusNoticeTimer) {
    window.clearTimeout(core.statusNoticeTimer);
  }

  core.statusNoticeTimer = window.setTimeout(() => {
    statusNotice.classList.remove("is-visible");
    statusNotice.classList.add("is-hiding");

    window.setTimeout(() => {
      if (!statusNotice.classList.contains("is-visible")) {
        statusNotice.hidden = true;
        statusNotice.classList.remove("is-hiding");
      }
    }, 220);
  }, duration);
};

export function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function reportViewerError(error, options = {}) {
  const {
    context = "",
    consoleLabel = "Viewer error",
    toast = true,
    e2e = true,
  } = options;

  const baseMessage = getErrorMessage(error);
  const message = context ? `${context}: ${baseMessage}` : baseMessage;

  console.error(consoleLabel, error);

  if (e2e && window.__E2E__ && window.viewer) {
    window.viewer.errors ??= [];
    window.viewer.errors.push(message);
  }

  if (toast) {
    showToast(message);
  }

  return message;
}

function fetchObjectFromConfig(_name) {
  //console.log("Fetching config for", _name, core.objectsConfig);
  return core.objectsConfig?.models?.find(model => model.name === _name);
}

function normalizeVec3(v) {
  if (!v) return null;

  if (Array.isArray(v) && v.length === 3) {
    return { x: v[0], y: v[1], z: v[2] };
  }

  if (
    typeof v === "object" &&
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.z === "number"
  ) {
    return v;
  }

  return null;
}


function normalizeGradient(gradient) {
  return {
    type: gradient.type,
    shapeOrDirection: gradient.shapeOrDirection,
    colors: gradient.colors
      .map(normalizeColor)
      .filter(Boolean)
  };
}

function setupObjectHandler(_object, _metadata) {
  if (!_metadata) return;

  const pos = normalizeVec3(_metadata.position ?? _metadata.objPosition);
  if (pos) {
    _object.position.set(pos.x, pos.y, pos.z);
  }

  const scale = normalizeVec3(_metadata.scale ?? _metadata.objScale);
  if (scale) {
    _object.scale.set(scale.x, scale.y, scale.z);
  }

  const rot = normalizeVec3(_metadata.rotation ?? _metadata.objRotation);
  if (rot) {
    _object.rotation.set(
      THREE.MathUtils.degToRad(rot.x),
      THREE.MathUtils.degToRad(rot.y),
      THREE.MathUtils.degToRad(rot.z)
    );
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

function setupCameraHandler(_object, meta) {
  if (!meta) return;

  const target = normalizeVec3(meta.controlsTarget);
  const camPos = normalizeVec3(meta.cameraPosition);

  if (!target && !camPos) return;

  const wasDamping = core.controls.enableDamping;
  core.controls.enableDamping = false;

  if (target) {
    core.controls.target?.set(target.x, target.y, target.z);
  }

  if (camPos) {
    core.camera.position?.set(camPos.x, camPos.y, camPos.z);
  }

  core.camera.updateProjectionMatrix();
  core.controls.update();
  core.controls.saveState();
  core.controls.enableDamping = wasDamping;
}

export const setupObject = (_object, _metadata) => {
  let model;
  if (typeof _object.children === "undefined" || _object.children.length == 0) {
    model = fetchObjectFromConfig(_object.name);
  } else if (_object.children.length > 0) {
    model = fetchObjectFromConfig(_object.children[0].name); //TODO: check for multiple objects
  }

  if (_metadata != null) {
    setupObjectHandler(_object, _metadata);
    setupGeometryHandler(_object);
    setupCameraHandler(_object, _metadata);
  }
  else if (typeof core.objectsConfig !== "undefined" && model) { //Setup from config
    if ((!Array.isArray(core.objectsConfig.models) || core.objectsConfig.models.length === 0) && _metadata == null) {
      if (model.position != null) _object.position.set(model.position.x, model.position.y, model.position.z);

      if (model.scale != null) _object.scale.set(model.scale.x, model.scale.y, model.scale.z);
      
      if (model.rotation != null) _object.rotation.set(THREE.MathUtils.degToRad(model.rotation.x), THREE.MathUtils.degToRad(model.rotation.y), THREE.MathUtils.degToRad(model.rotation.z));
    } else {
      let m = core.objectsConfig.models[core.objectsConfig.setupIndex];
      if (m != undefined && _metadata == null) {
        //console.log("Applying config for index", core.objectsConfig.setupIndex, m);
        setupObjectHandler(_object, m);
      } else if (_metadata != null) {
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
    } else if (!core.PRESENTATION_MODE) {
      boundingBox.setFromObject(_object);
      _object.position.set((boundingBox.max.x - boundingBox.min.x ) / 2, (boundingBox.max.y - boundingBox.min.y) / 2, (boundingBox.max.z - boundingBox.min.z ) / 2);
      _object.updateMatrixWorld();
      _object.needsUpdate = true;
      if (typeof _object.geometry !== "undefined") {
        _object.geometry.computeBoundingBox();
        _object.geometry.computeBoundingSphere();
      }
    } else {
      _object.position.set(0, 0, 0);
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
      boundingBox.setFromObject(_object[i], true);
    }
  } else {
    boundingBox.setFromObject(_object, true);
  }
  var size = new THREE.Vector3();
  boundingBox.getSize(size);
  var center = new THREE.Vector3();
  boundingBox.getCenter(center);
  // Set camera position at the center level, behind the model
  const distance = size.length();
  core.camera.position.set(center.x, center.y, center.z + distance);
  await fitCameraToCenteredObject(_object, true);
}

function parseColor(v) {
  if (Array.isArray(v)) {
    const [r, g, b, a = 1] = v;
    return { r, g, b, a };
  }

  if (typeof v === "string") {
    return parseCssColor(v); // #hex / rgb / rgba
  }

  return null;
}

function parseGradientArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;

  // [r, g, b] → single color
  if (
    arr.length === 3 &&
    arr.every(v => typeof v === "number")
  ) {
    return {
      type: "linear",
      colors: [ { r: arr[0], g: arr[1], b: arr[2], a: 1 } ]
    };
  }

  // list of colors
  const colors = arr
    .map(parseColor)
    .filter(Boolean);

  if (colors.length < 2) return null;

  return {
    type: "linear",
    colors
  };
}

function resolveBackground(meta, sceneId) {
  const raw =
    meta.scenes?.[sceneId]?.background ??
    meta.scene?.background ??
    meta.globals?.background ??
    null;

  if (!raw) return { kind: "default" };

  // object + array of colors
  if (typeof raw === "object" && Array.isArray(raw.value)) {
    const gradient = parseGradientArray(raw.value);
    if (gradient) {
      const normalizedGradient = normalizeGradient(gradient);
      return { kind: "gradient", normalizedGradient };
    }
  }

  // css string
  if (typeof raw === "string") {
    const gradient = parseGradient(raw);
    if (gradient) {
      const normalizedGradient = normalizeGradient(gradient);
      return { kind: "gradient", normalizedGradient };
    }
    return { kind: "color", color: raw };
  }

  return { kind: "default" };
}

export async function setupCamera(_object, _data) {
  const _light = core.lightObjects[0];
  const cfg = _data ?? core.CONFIG ?? null;
  const fallback = _data ?? core.objectsConfig ?? null;

  // --- CAMERA POSITION ---
  const camPos = cfg?.cameraPosition ?? fallback?.camera?.position;

  if (Array.isArray(camPos)) {
    core.camera.position.set(camPos[0], camPos[1], camPos[2]);
  } else if (camPos && typeof camPos === "object") {
    core.camera.position.set(camPos.x, camPos.y, camPos.z);
  } else {
    await setupEmptyCamera(_object);
  }

  // --- CONTROLS TARGET + ZOOM ---
  const target = cfg?.controlsTarget ?? fallback?.camera?.target;

  if (Array.isArray(target)) {
    core.controls.target.set(target[0], target[1], target[2]);
  } else if (target) {
    core.controls?.target.set(target.x, target.y, target.z);
  }

  const customZoom = cfg?.controlsZoom?.[0];

  if (typeof customZoom === "number" && customZoom !== 0) {
    const dir = new THREE.Vector3()
    .subVectors(core.camera.position, core.controls?.target || new THREE.Vector3())
    .normalize();


    core.camera.position
    .copy(core.controls?.target || new THREE.Vector3())
    .add(dir.multiplyScalar(customZoom));
  }

  // --- LIGHTS ---
  if (!cfg && fallback?.scene?.lights) {
    fallback.scene.lights.forEach(light => {
      switch (light.type) {
        case "directional":
        _light.position.set(light.position.x, light.position.y, light.position.z);
        _light.color = new THREE.Color(normalizeColor(light.color));
        _light.intensity = light.intensity;
        break;
        case "ambient":
        core.ambientLight.color = new THREE.Color(normalizeColor(light.color));
        core.ambientLight.intensity = light.intensity;
        break;
        case "point":
        core.cameraLight.color = new THREE.Color(normalizeColor(light.color));
        core.cameraLight.intensity = light.intensity;
        break;
      }
    });
  } 
  else if (cfg) {
    if (cfg.lightAmbientColor) {
      core.ambientLight.color = new THREE.Color(normalizeColor(cfg.lightAmbientColor[0]));
      core.ambientLight.intensity = cfg.lightAmbientIntensity?.[0] ?? core.ambientLight.intensity;
    }

    if (cfg.lightColor) {
      _light.color = new THREE.Color(normalizeColor(cfg.lightColor[0]));
      _light.intensity = cfg.lightIntensity?.[0] ?? _light.intensity;
    }

    if (cfg.lightCameraColor) {
      core.cameraLight.color = new THREE.Color(normalizeColor(cfg.lightCameraColor[0]));
      core.cameraLight.intensity = cfg.lightCameraIntensity?.[0] ?? core.cameraLight.intensity;
    }
  }

  // --- BACKGROUND ---
  //const sceneBg = fallback?.scene?.background;

  if (!core.PRESENTATION_MODE) {
    const bg = resolveBackground(fallback, core.activeScene);

    switch (bg.kind) {
      case "gradient":
      case "radial":
        applyGradientCss(bg.normalizedGradient);
        break;

      case "color":
      case "linear":
        changeBackground("linear", bg.color);
        break;

      case "default":
      case "unknown":
        changeBackground(
          "radial",
          core.colors.BackgroundColor,
          core.colors.BackgroundColorOuter
        );
        break;
    }
  } else {
    const grandient = {type: "radial", colors: [{r: 255, g: 255, b: 255, a: 0}, {r: 255, g: 255, b: 255, a: 0}]};
    applyGradientCss(grandient);
  }

  core.camera.updateProjectionMatrix();
  core.controls?.update();
  fitCameraToCenteredObject(_object, false);
}

  // Show interaction hint on first load
  function showInteractionHint(boxCenter) {
  if (window.__E2E__) return;
  //if (localStorage.getItem("viewerHintSeen")) return;

  if (core.GESTURE == null) return;
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

      core.camera.near = Math.max(maxDistance / 1000, 0.001);
      core.camera.far  = maxDistance * 10;
      core.camera.updateProjectionMatrix();

      if (core.controls) {
        core.controls.maxDistance = maxDistance * 2;
      }
    }
    showInteractionHint(boxCenter);
  });
}

async function fitCameraToCenteredObject(object, _fit) {
  const boundingBox = new THREE.Box3();
  if (Array.isArray(object)) {
    for (let i = 0; i < object.length; i++) {
      const box = new THREE.Box3().setFromObject(object[i], true);
      boundingBox.union(box);
    }
  } else {
    boundingBox.setFromObject(object, true);
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

  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.85;

  // === target position ===
  const dir = new THREE.Vector3(-0.5, -1, 1).normalize(); // 45-degree angle perspective
  dir.multiplyScalar(-distance);

  const finalCameraPos = center.clone().add(dir);
  const finalTarget = center.clone();

  // Store reset position for "Reset camera" action
  core.cameraCoords = finalCameraPos.clone();
  core.controlsTarget = finalTarget.clone();

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
      THREE.MathUtils.radToDeg(core.helperObjects[0]?.rotation.x || 1),
      THREE.MathUtils.radToDeg(core.helperObjects[0]?.rotation.y || 5),
      THREE.MathUtils.radToDeg(core.helperObjects[0]?.rotation.z || 1)
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
  if (!core.PRESENTATION_MODE) {
    setupClippingPlanes(object, {x: boundingBox.max.x*1.1, y: boundingBox.max.y*1.1, z: boundingBox.max.z*1.1});
  }
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

function rgbaToCss(c) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function changeBackgroundHelper(_color1, _color2, _alpha = 100) {
  core.mainCanvas.style.setProperty(
    "background",
    `radial-gradient(circle, ${_color1} 0%, ${_color2} ${_alpha}%)`
  );
}

export function applyGradientCss(gradient) {
  if (!gradient || !Array.isArray(gradient.colors) || gradient.colors.length === 0) {
    return;
  }

  const colors = gradient.colors;

  // 1 color → solid background
  if (colors.length === 1) {
    const c = rgbaToCss(colors[0]);
    changeBackground("linear", c);
    return;
  }

  // 2 colors → legacy helper
  if (colors.length === 2) {
    const c1 = rgbaToCss(colors[0]);
    const c2 = rgbaToCss(colors[1]);
    changeBackground(gradient.type, c1, c2);
    return;
  }

  // >= 3 stops → full CSS gradient
  const stops = colors.map((c, i) => {
    const t = Math.round((i / (colors.length - 1)) * 100);
    return `${rgbaToCss(c)} ${t}%`;
  });

  const css =
    gradient.type === "radial"
      ? `radial-gradient(circle, ${stops.join(", ")})`
      : `linear-gradient(to bottom, ${stops.join(", ")})`;

  core.mainCanvas.style.setProperty("background", css);
}

export function changeBackground(_type, _color1, _color2 = _color1, _alpha = 100) {
  switch (_type) {
    case "linear":
      changeBackgroundHelper(_color1, _color1, _alpha);
      break;
    case "gradient":
    case "radial":
      changeBackgroundHelper(_color1, _color2, _alpha);
      break;
  }
  console.log("Background changed to", _type, _color1, _color2);
}

function setupClippingPlanes(_geom, _distance) {
  /*var _geometry;
  if (_geom.isGroup)
    _geometry = _geom.children;
  else
    _geometry = _geom.geometry.clone();*/
  core.clippingPlanes[0].constant = _distance.x;
  core.clippingPlanes[1].constant = _distance.y;
  core.clippingPlanes[2].constant = _distance.z;
  if (core.EDITOR) {

  if (core.transformControlClippingPlaneX && core.transformControlClippingPlaneY && core.transformControlClippingPlaneZ) {
    core.scene.add(core.transformControlClippingPlaneX?.getHelper());
    core.scene.add(core.transformControlClippingPlaneY?.getHelper());
    core.scene.add(core.transformControlClippingPlaneZ?.getHelper());
  }

  let planeColor = new THREE.Color(0xffffff).getHexString();
  if (core.scene.background != null) planeColor = core.scene.background.getHexString();

  core.planeHelpers = core.clippingPlanes.map(
    (p) => new THREE.PlaneHelper(p, core.gridSize * 2, invertHexColor(planeColor))
  );
  core.planeHelpers.forEach((ph, index) => {
    ph.visible = false;
    ph.name = "PlaneHelper";
    ph.position.copy(core.clippingPlanes[index].normal).multiplyScalar(core.clippingPlanes[index].constant);
    core.scene.add(ph);
  });

  core.distanceGeometry = _distance;
  scaleXYZ(core.distanceGeometry, 2);
  const showClippingPlaneToast = (axisLabel, enabled) => {
    toastHelper("clippingHelperToggle", "info", {
      axis: axisLabel,
      state: enabled
    });
  };
  const refreshClippingHint = () => {
    const update = core.updateClippingHintVisibility;
    if (typeof update === "function") {
      update();
      return;
    }
    if (!core.clippingHint || !core.planeParams?.clippingMode) return;
    const mode = core.planeParams.clippingMode;
    core.clippingHint.hidden = !(mode.x || mode.y || mode.z);
  };
  const tr = (key, fallback) => window?.Viewer?.t?.(key, fallback) ?? fallback;
  let displayHelper = {x: getOrAddGuiController(core.planeParams.planeX, "displayHelperX"), constantX: getOrAddGuiController(core.planeParams.planeX, "constantX"), y: getOrAddGuiController(core.planeParams.planeY, "displayHelperY"), constantY: getOrAddGuiController(core.planeParams.planeY, "constantY"), z: getOrAddGuiController(core.planeParams.planeZ, "displayHelperZ"), constantZ: getOrAddGuiController(core.planeParams.planeZ, "constantZ"), outline: getOrAddGuiController(core.planeParams.outline, "visible")};
  displayHelper.x?.name?.(tr("gui.displayHelperX", "Show X helper"));
  displayHelper.constantX?.name?.(tr("gui.constantX", "Constant X"));
  displayHelper.y?.name?.(tr("gui.displayHelperY", "Show Y helper"));
  displayHelper.constantY?.name?.(tr("gui.constantY", "Constant Y"));
  displayHelper.z?.name?.(tr("gui.displayHelperZ", "Show Z helper"));
  displayHelper.constantZ?.name?.(tr("gui.constantZ", "Constant Z"));
  displayHelper.outline?.name?.(tr("gui.visible", "Visible"));
  displayHelper.x?.onChange((v) => {
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
      showClippingPlaneToast("X", v);
      refreshClippingHint();
    });

    displayHelper?.constantX.min(-core.distanceGeometry.x)
      .max(core.distanceGeometry.x)
      .setValue(core.distanceGeometry.x)
      .step(core.gridSize / 100)
      .listen()
      .onChange((d) => {
        core.clippingPlanes[0].constant = d;
        core.planeHelpers[0].position.copy(core.clippingPlanes[0].normal).multiplyScalar(d);
      });

    displayHelper.y?.onChange((v) => {
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
      showClippingPlaneToast("Y", v);
      refreshClippingHint();
    });
    displayHelper?.constantY
      .min(-core.distanceGeometry.y)
      .max(core.distanceGeometry.y)
      .setValue(core.distanceGeometry.y)
      .step(core.gridSize / 100)
      .listen()
      .onChange((d) => {
        core.clippingPlanes[1].constant = d;
        core.planeHelpers[1].position.copy(core.clippingPlanes[1].normal).multiplyScalar(d);
      });
  
    displayHelper.z?.onChange((v) => {
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
      showClippingPlaneToast("Z", v);
      refreshClippingHint();
    });
    displayHelper?.constantZ
      .min(-core.distanceGeometry.z)
      .max(core.distanceGeometry.z)
      .setValue(core.distanceGeometry.z)
      .step(core.gridSize / 100)
      .listen()
      .onChange((d) => {
        core.clippingPlanes[2].constant = d;
        core.planeHelpers[2].position.copy(core.clippingPlanes[2].normal).multiplyScalar(d);
      });

    displayHelper.outline.onChange((v) => {
      core.outlineClipping.visible = v;
    });
    refreshClippingHint();
  }
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

export function getOrAddGuiController(object, prop) {
  const findController = (folder) => {
    if (!folder) return null;
    const controller = folder.controllers?.find(c => c._name === prop || c.property === prop);
    if (controller) return controller;

    for (const subfolder of folder.folders || []) {
      const found = findController(subfolder);
      if (found) return found;
    }
    return null;
  };

  let controller = findController(core.clippingFolder);
  if (controller) return controller;

  return core.clippingFolder.add(object, prop);
}
