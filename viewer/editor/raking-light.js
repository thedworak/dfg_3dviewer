import THREE from "../init.js";
import { core } from "../core.js";

// Raking light (Lights > Raking light): one strong light grazing the surface
// the camera looks at, the other lights and the environment dimmed, so
// shallow relief - inscriptions, tool marks, worn ornament - casts readable
// shading. Placed as in RTI viewers, relative to the view: `direction` is
// where on the screen it comes from (0 = right, 90 = top), `height` its
// angle above the surface facing the camera (low = grazing). The sweep
// turns it round the view.

const RAKING_INTENSITY = 3.5;
// What the other lights and the environment keep while it is on.
const DIM_FACTOR = 0.12;
// Degrees per second while sweeping.
const SWEEP_SPEED = 40;

export const RAKING_LIGHT_DEFAULTS = Object.freeze({ direction: 135, height: 12, sweep: false });

const viewDirection = new THREE.Vector3();

export function attachRakingLight(Viewer) {
  Object.assign(Viewer, {
    rakingLight: { enabled: false, ...RAKING_LIGHT_DEFAULTS },
    // The light and its target while on, and what was dimmed.
    rakingLightObjects: null,

    setRakingLight(enabled) {
      const on = enabled === true;
      if (on === Viewer.rakingLight.enabled) return on;
      if (on) Viewer.enableRakingLight();
      else Viewer.disableRakingLight();
      Viewer.updateLightsSubmenuState?.();
      return on;
    },

    // Direction and height in degrees; either may be left out.
    setRakingLightAngles({ direction, height } = {}) {
      const state = Viewer.rakingLight;
      if (Number.isFinite(Number(direction))) state.direction = ((Number(direction) % 360) + 360) % 360;
      if (Number.isFinite(Number(height))) state.height = Math.min(89, Math.max(1, Number(height)));
      Viewer.updateRakingLight(0);
    },

    setRakingLightSweep(sweep) {
      Viewer.rakingLight.sweep = sweep === true;
      Viewer.updateLightsSubmenuState?.();
    },

    enableRakingLight() {
      if (!core.scene) return;
      const dimmed = [];
      core.scene.traverse((object) => {
        if (!object.isLight || object.userData?.isRakingLight) return;
        dimmed.push({ light: object, intensity: object.intensity });
        object.intensity *= DIM_FACTOR;
      });
      const environmentIntensity = core.scene.environmentIntensity;
      core.scene.environmentIntensity = environmentIntensity * DIM_FACTOR;
      const dimmedEnvironment = core.scene.environmentIntensity;

      const light = new THREE.DirectionalLight(0xffffff, RAKING_INTENSITY);
      light.name = "raking-light";
      light.userData.isRakingLight = true;
      const target = new THREE.Object3D();
      target.name = "raking-light-target";
      light.target = target;
      core.scene.add(light, target);

      Viewer.rakingLightObjects = { light, target, dimmed, environmentIntensity, dimmedEnvironment, center: Viewer.getRakingLightCenter() };
      Viewer.rakingLight.enabled = true;
      Viewer.updateRakingLight(0);
    },

    disableRakingLight() {
      const objects = Viewer.rakingLightObjects;
      Viewer.rakingLight.enabled = false;
      Viewer.rakingLightObjects = null;
      if (!objects) return;
      objects.light.removeFromParent();
      objects.target.removeFromParent();
      objects.light.dispose();
      // Lights replaced meanwhile (a manifest's) are left as they are.
      objects.dimmed.forEach(({ light, intensity }) => {
        if (light.parent) light.intensity = intensity;
      });
      if (core.scene) core.scene.environmentIntensity = objects.environmentIntensity;
    },

    // The middle of the loaded models, which the light aims at.
    getRakingLightCenter() {
      const box = new THREE.Box3();
      const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
      slots.flat().filter((item) => item?.isObject3D).forEach((root) => box.expandByObject(root));
      return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    },

    // Every frame (main.js animate): follows the camera, and sweeps.
    updateRakingLight(delta = 0) {
      const objects = Viewer.rakingLightObjects;
      const camera = core.camera;
      if (!objects || !camera) return;
      // The environment set meanwhile (a preset loading, a manifest, the
      // menu): kept as the value to restore, and dimmed.
      if (core.scene && core.scene.environmentIntensity !== objects.dimmedEnvironment) {
        objects.environmentIntensity = core.scene.environmentIntensity;
        core.scene.environmentIntensity *= DIM_FACTOR;
        objects.dimmedEnvironment = core.scene.environmentIntensity;
      }
      const state = Viewer.rakingLight;
      if (state.sweep && delta > 0) {
        state.direction = (state.direction + SWEEP_SPEED * delta) % 360;
        Viewer.syncRakingLightDirectionControl?.();
      }
      const direction = THREE.MathUtils.degToRad(state.direction);
      const height = THREE.MathUtils.degToRad(state.height);
      // In camera space: x right, y up, z towards the viewer.
      viewDirection.set(
        Math.cos(height) * Math.cos(direction),
        Math.cos(height) * Math.sin(direction),
        Math.sin(height)
      ).applyQuaternion(camera.quaternion);
      const distance = Math.max(core.gridSize || 1, 0.001) * 2;
      objects.target.position.copy(objects.center);
      objects.light.position.copy(objects.center).addScaledVector(viewDirection, distance);
      objects.target.updateMatrixWorld();
    },

    // The Direction slider follows the sweep.
    syncRakingLightDirectionControl() {
      const button = Viewer.lightsSubmenuButtons?.lightRakingDirection;
      const slider = button?.querySelector('input[type="range"]');
      if (!slider) return;
      const value = Math.round(Viewer.rakingLight.direction);
      if (Number(slider.value) === value) return;
      slider.value = String(value);
      const label = button.querySelector(".viewer-editor-tool_submenu-value");
      if (label) label.textContent = `${value}°`;
    },

    // AIM3DViewer.rakingLight of an exported manifest: only while it is on.
    getRakingLightForExport() {
      const { enabled, direction, height, sweep } = Viewer.rakingLight;
      if (!enabled) return undefined;
      return { enabled: true, direction: Math.round(direction), height, sweep };
    },

    // A manifest's rakingLight (absent: off). Applied after its lights,
    // which the raking light dims.
    apply3IFManifestRakingLight(config) {
      if (!config || typeof config !== "object" || config.enabled !== true) {
        Viewer.setRakingLight(false);
        return false;
      }
      Viewer.rakingLight.direction = RAKING_LIGHT_DEFAULTS.direction;
      Viewer.rakingLight.height = RAKING_LIGHT_DEFAULTS.height;
      Viewer.setRakingLightAngles({ direction: config.direction, height: config.height });
      Viewer.setRakingLightSweep(config.sweep === true);
      Viewer.setRakingLight(true);
      return true;
    },

    // Before a new model: its lights are rebuilt, the light goes with it.
    disposeRakingLight() {
      Viewer.disableRakingLight();
      Viewer.rakingLight.sweep = false;
      Viewer.updateLightsSubmenuState?.();
    },
  });
}
