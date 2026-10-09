import THREE from "./init.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { core } from "./core.js";

// Ambient occlusion (Rendering > Ambient occlusion): three's GTAOPass, fitted
// to this viewer.
//
// - The renderer has a logarithmic depth buffer, which GTAO cannot read: its
//   normal/depth buffer is drawn with three's own normal shader minus the
//   logdepthbuf chunks, so that one pass writes ordinary depth.
// - Only the model occludes: helpers, the ground, gizmos and annotation
//   badges (sprites, which an override material would draw as squares) are
//   hidden while the buffer is drawn.
// - The section planes cut it as they cut the model (they are set per
//   material here, and the override material replaces them all).
// - Radius and thickness are in world units: a share of the model's size.

// Share of the model's largest side (core.gridSize).
const AO_RADIUS = 0.035;
const AO_THICKNESS = 0.07;

function createNormalDepthMaterial() {
  const stripLogDepth = (source) => source.replace(/#include <logdepthbuf_[a-z_]+>/g, "");
  const material = new THREE.ShaderMaterial({
    name: "AONormalDepth",
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.normal.uniforms),
    vertexShader: stripLogDepth(THREE.ShaderLib.normal.vertexShader),
    fragmentShader: stripLogDepth(THREE.ShaderLib.normal.fragmentShader),
    side: THREE.DoubleSide,
    blending: THREE.NoBlending,
    clipping: true,
  });
  return material;
}

export class ModelGTAOPass extends GTAOPass {
  constructor(scene, camera, width, height) {
    super(scene, camera, width, height);
    this.normalMaterial.dispose();
    this.normalMaterial = createNormalDepthMaterial();
    this.modelSize = 0;
  }

  // Follows the current camera (perspective/orthographic switches), the
  // model's size and the section planes; called before each frame.
  sync(scene, camera) {
    this.scene = scene;
    if (this.camera !== camera) {
      this.camera = camera;
      const perspective = camera.isPerspectiveCamera ? 1 : 0;
      if (this.gtaoMaterial.defines.PERSPECTIVE_CAMERA !== perspective) {
        this.gtaoMaterial.defines.PERSPECTIVE_CAMERA = perspective;
        this.gtaoMaterial.needsUpdate = true;
      }
      // The projection matrices are set in setSize() and every render.
      this.setSize(this.width, this.height);
    }
    const size = core.gridSize || 1;
    if (size !== this.modelSize) {
      this.modelSize = size;
      this.updateGtaoMaterial({ radius: size * AO_RADIUS, thickness: size * AO_THICKNESS });
    }
    const planes = core.activeClippingPlanes?.length ? core.activeClippingPlanes : null;
    if (this.normalMaterial.clippingPlanes !== planes) {
      this.normalMaterial.clippingPlanes = planes;
      this.normalMaterial.needsUpdate = true;
    }
  }

  _overrideVisibility() {
    super._overrideVisibility();
    const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
    const roots = new Set(slots.flat().filter((item) => item?.isObject3D));
    const cache = this._visibilityCache;
    // Everything outside the models' subtrees (which are skipped whole).
    const hide = (object) => {
      if (roots.has(object) || !object.visible) return;
      if (object.isMesh || object.isSprite) {
        object.visible = false;
        cache.push(object);
        return;
      }
      object.children.forEach(hide);
    };
    this.scene.children.forEach(hide);
    // Annotation badges inside a model.
    roots.forEach((root) => root.traverseVisible((object) => {
      if (object.isSprite) {
        object.visible = false;
        cache.push(object);
      }
    }));
  }
}
