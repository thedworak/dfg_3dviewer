import { Group, Scene } from "./build/three.core";
import { Tween } from "./js/jsm/libs/tween.module";

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
    gridSize: null,
    dirLightTarget: null,
    lightHelper: null,
    Scene: new Scene(),
    basicGrid: new Group(),
    cameraCoords: null,
    tween: new Tween(),
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
    // Add other shared state here
};

export const setCore = (key, value) => {
    core[key] = value;
};