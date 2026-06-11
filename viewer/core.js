import THREE from "./init.js";
import TWEEN from "three/examples/jsm/libs/tween.module.js";

// core.js
export const core = {
    clippingPlanes: null,
    materialsFolder: null,
    materialsPropertiesText: null,
    camera: null,
    colors: {},
    intensity: {},
    ambientLight: null,
    cameraLight: null,
    mainCanvas: null,
    noticeContainer: null,
    statusNotice: null,
    gridSize: null,
    dirLightTarget: null,
    lightHelper: null,
    scene: new THREE.Scene(),
    basicGrid: new THREE.Group(),
    axesHelper: new THREE.AxesHelper(),
    cameraCoords: null,
    tween: new TWEEN.Tween(),
    controls: null,
    transformControlClippingPlaneY: null,
    transformControlClippingPlaneX: null,
    transformControlClippingPlaneZ: null,
    planeHelpers: null,
    outlineClipping: null,
    sceneBackgroundColor: null,
    distanceGeometry: null,
    planeParams: null,
    clippingFolder: null,
    helperObjects: []
    // Add other shared state here
};

export const setCore = (key, value) => {
    core[key] = value;
};
