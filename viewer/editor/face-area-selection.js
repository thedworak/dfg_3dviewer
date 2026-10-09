import THREE from "../init.js";
import { core } from "../core.js";

// Area selection of faces in picking mode: Shift + drag draws a rectangle
// and adds every face visible inside it to the selection; Ctrl/Cmd + Shift +
// drag removes them instead.
//
// "Visible" is decided on the GPU: the rectangle is rendered into an
// off-screen ID buffer twice - once with each mesh's index as colour, once
// with each triangle's index - and every non-empty pixel names one visible
// face. That respects occlusion, back-face culling and section planes, and
// costs the same on a million-triangle scan as on a cube.

const MIN_DRAG_PX = 4;
// Upper bound for one side of the ID buffer, in device pixels.
const MAX_BUFFER_SIDE = 2048;

const PICK_VERTEX_SHADER = `
  attribute float faceId;
  flat varying float vFaceId;
  #include <clipping_planes_pars_vertex>
  void main() {
    vFaceId = faceId;
    #include <begin_vertex>
    #include <project_vertex>
    #include <clipping_planes_vertex>
  }
`;

const PICK_FRAGMENT_SHADER = `
  uniform float objectId;
  uniform bool encodeFace;
  flat varying float vFaceId;
  #include <clipping_planes_pars_fragment>
  void main() {
    #include <clipping_planes_fragment>
    float id = encodeFace ? vFaceId + 1.0 : objectId;
    float r = mod(id, 256.0);
    float g = mod(floor(id / 256.0), 256.0);
    float b = floor(id / 65536.0);
    gl_FragColor = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0);
  }
`;

function decodeId(pixels, offset) {
  return pixels[offset] + pixels[offset + 1] * 256 + pixels[offset + 2] * 65536;
}

function isWorldVisible(object) {
  for (let node = object; node; node = node.parent) {
    if (node.visible === false) return false;
  }
  return true;
}

export function attachFaceAreaSelection(Viewer) {
  Object.assign(Viewer, {
    faceAreaSelection: null,
    facePickGeometryCache: new Map(),

    // Capture-phase pointerdown on the canvas: runs before OrbitControls, so
    // it can keep the drag from also panning the camera.
    onFaceAreaPointerDown(event) {
      if (!Viewer.pickingMode || Viewer.RULER_MODE || !event.shiftKey || event.button !== 0) return;
      if (!core.renderer?.domElement) return;
      Viewer.faceAreaSelection = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        endX: event.clientX,
        endY: event.clientY,
        subtract: event.ctrlKey || event.metaKey,
        controlsEnabled: core.controls?.enabled,
        box: null,
      };
      if (core.controls) core.controls.enabled = false;
      core.renderer.domElement.setPointerCapture?.(event.pointerId);
    },

    onFaceAreaPointerMove(event) {
      const state = Viewer.faceAreaSelection;
      if (!state || event.pointerId !== state.pointerId) return;
      state.endX = event.clientX;
      state.endY = event.clientY;
      if (!state.box && Viewer.getFaceAreaDragSize(state) >= MIN_DRAG_PX) {
        state.box = document.createElement("div");
        state.box.className = "viewer-face-area-box";
        state.box.classList.toggle("is-subtract", state.subtract);
        document.body.appendChild(state.box);
      }
      if (state.box) {
        const left = Math.min(state.startX, state.endX);
        const top = Math.min(state.startY, state.endY);
        Object.assign(state.box.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${Math.abs(state.endX - state.startX)}px`,
          height: `${Math.abs(state.endY - state.startY)}px`,
        });
      }
    },

    onFaceAreaPointerUp(event) {
      const state = Viewer.faceAreaSelection;
      if (!state || event.pointerId !== state.pointerId) return;
      state.endX = event.clientX;
      state.endY = event.clientY;
      Viewer.endFaceAreaSelection();
      // A plain Shift + click (no drag) falls through to the normal click
      // handling in picking.js.
      if (event.type !== "pointerup" || Viewer.getFaceAreaDragSize(state) < MIN_DRAG_PX) return;
      const hits = Viewer.pickVisibleFacesInRect(
        Math.min(state.startX, state.endX),
        Math.min(state.startY, state.endY),
        Math.max(state.startX, state.endX),
        Math.max(state.startY, state.endY)
      );
      Viewer.applyFaceSelection(hits, { subtract: state.subtract });
    },

    endFaceAreaSelection() {
      const state = Viewer.faceAreaSelection;
      if (!state) return;
      state.box?.remove();
      if (core.controls && typeof state.controlsEnabled === "boolean") {
        core.controls.enabled = state.controlsEnabled;
      }
      core.renderer?.domElement?.releasePointerCapture?.(state.pointerId);
      Viewer.faceAreaSelection = null;
    },

    getFaceAreaDragSize(state) {
      return Math.max(Math.abs(state.endX - state.startX), Math.abs(state.endY - state.startY));
    },

    bindFaceAreaSelection() {
      const canvas = core.renderer?.domElement;
      if (!canvas) return;
      Viewer.bindEventListener(canvas, "pointerdown", Viewer.onFaceAreaPointerDown, { capture: true });
      Viewer.bindEventListener(canvas, "pointermove", Viewer.onFaceAreaPointerMove);
      Viewer.bindEventListener(canvas, "pointerup", Viewer.onFaceAreaPointerUp, { capture: true });
      Viewer.bindEventListener(canvas, "pointercancel", Viewer.onFaceAreaPointerUp);
    },

    // Position-only, non-indexed copy of a geometry with the source
    // triangle index per vertex, so the fragment shader knows its face.
    getFacePickGeometry(geometry) {
      const cached = Viewer.facePickGeometryCache.get(geometry);
      if (cached) return cached;
      const position = geometry.getAttribute("position");
      if (!position) return null;
      const index = geometry.getIndex();
      const vertexCount = index ? index.count : position.count;
      const triangleCount = Math.floor(vertexCount / 3);
      const positions = new Float32Array(triangleCount * 9);
      const faceIds = new Float32Array(triangleCount * 3);
      for (let i = 0; i < triangleCount * 3; i += 1) {
        const vertex = index ? index.getX(i) : i;
        positions[i * 3] = position.getX(vertex);
        positions[i * 3 + 1] = position.getY(vertex);
        positions[i * 3 + 2] = position.getZ(vertex);
        faceIds[i] = Math.floor(i / 3);
      }
      const pickGeometry = new THREE.BufferGeometry();
      pickGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      pickGeometry.setAttribute("faceId", new THREE.BufferAttribute(faceIds, 1));
      Viewer.facePickGeometryCache.set(geometry, pickGeometry);
      return pickGeometry;
    },

    disposeFacePickCache() {
      Viewer.facePickGeometryCache.forEach((geometry) => geometry.dispose());
      Viewer.facePickGeometryCache.clear();
    },

    getFacePickMeshes() {
      const meshes = [];
      const roots = (core.mainObject || []).flat().filter((object) => object?.isObject3D);
      roots.forEach((root) => {
        root.traverse((object) => {
          if (!object.isMesh || object.isInstancedMesh) return;
          if (Viewer.isPickingOverlayObject(object) || object.userData?.isAnnotationPOI) return;
          if (!object.geometry?.getAttribute?.("position") || !isWorldVisible(object)) return;
          meshes.push(object);
        });
      });
      return meshes;
    },

    // Faces ({ object, faceIndex }) visible inside a rectangle given in
    // client (CSS) pixels.
    pickVisibleFacesInRect(left, top, right, bottom) {
      const renderer = core.renderer;
      const camera = core.camera;
      const canvas = renderer?.domElement;
      if (!renderer || !camera || !canvas) return [];

      const canvasRect = canvas.getBoundingClientRect();
      const x0 = Math.max(0, Math.floor(left - canvasRect.left));
      const y0 = Math.max(0, Math.floor(top - canvasRect.top));
      const x1 = Math.min(canvasRect.width, Math.ceil(right - canvasRect.left));
      const y1 = Math.min(canvasRect.height, Math.ceil(bottom - canvasRect.top));
      const width = x1 - x0;
      const height = y1 - y0;
      if (width < 1 || height < 1) return [];

      const meshes = Viewer.getFacePickMeshes();
      if (!meshes.length) return [];

      const scale = Math.min(renderer.getPixelRatio(), MAX_BUFFER_SIDE / Math.max(width, height));
      const bufferWidth = Math.max(1, Math.round(width * scale));
      const bufferHeight = Math.max(1, Math.round(height * scale));

      const pickScene = new THREE.Scene();
      const materials = [];
      meshes.forEach((mesh, index) => {
        const pickGeometry = Viewer.getFacePickGeometry(mesh.geometry);
        if (!pickGeometry) return;
        const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const material = new THREE.ShaderMaterial({
          vertexShader: PICK_VERTEX_SHADER,
          fragmentShader: PICK_FRAGMENT_SHADER,
          uniforms: {
            objectId: { value: index + 1 },
            encodeFace: { value: false },
          },
          side: sourceMaterial?.side ?? THREE.FrontSide,
          clipping: true,
          clippingPlanes: sourceMaterial?.clippingPlanes || null,
          toneMapped: false,
        });
        materials.push(material);
        const proxy = new THREE.Mesh(pickGeometry, material);
        mesh.updateWorldMatrix(true, false);
        proxy.matrixAutoUpdate = false;
        proxy.matrixWorldAutoUpdate = false;
        proxy.matrix.copy(mesh.matrixWorld);
        proxy.matrixWorld.copy(mesh.matrixWorld);
        proxy.frustumCulled = false;
        pickScene.add(proxy);
      });

      const target = new THREE.WebGLRenderTarget(bufferWidth, bufferHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
      });
      const objectPixels = new Uint8Array(bufferWidth * bufferHeight * 4);
      const facePixels = new Uint8Array(bufferWidth * bufferHeight * 4);

      const previousTarget = renderer.getRenderTarget();
      const previousClearColor = renderer.getClearColor(new THREE.Color());
      const previousClearAlpha = renderer.getClearAlpha();
      camera.setViewOffset(canvasRect.width, canvasRect.height, x0, y0, width, height);
      try {
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        [false, true].forEach((encodeFace) => {
          materials.forEach((material) => { material.uniforms.encodeFace.value = encodeFace; });
          renderer.clear(true, true, true);
          renderer.render(pickScene, camera);
          renderer.readRenderTargetPixels(
            target, 0, 0, bufferWidth, bufferHeight, encodeFace ? facePixels : objectPixels
          );
        });
      } finally {
        camera.clearViewOffset();
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(previousClearColor, previousClearAlpha);
        target.dispose();
        materials.forEach((material) => material.dispose());
      }

      const seen = new Set();
      const hits = [];
      for (let offset = 0; offset < objectPixels.length; offset += 4) {
        const objectId = decodeId(objectPixels, offset);
        if (!objectId) continue;
        const faceId = decodeId(facePixels, offset);
        if (!faceId) continue;
        const key = objectId * 16777216 + faceId;
        if (seen.has(key)) continue;
        seen.add(key);
        const mesh = meshes[objectId - 1];
        if (mesh) hits.push({ object: mesh, faceIndex: faceId - 1 });
      }
      return hits;
    },
  });
}
