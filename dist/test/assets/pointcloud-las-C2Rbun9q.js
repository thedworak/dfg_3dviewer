import { c as core } from './main-CbMQdLrF.js';
import { g4 as THREE } from './three-9zFNDZnr.js';
import './model-thumbnail-CDJe51sy.js';
import './_commonjsHelpers-ChNyZfSg.js';

// Direct loading of LAS / LAZ point clouds (no server conversion), e.g. for
// drag and drop in the sandbox or ?model=scan.laz.
//
// The file is downloaded and decoded in a Web Worker (pointcloud-las-worker.js,
// decoding in pointcloud-las-decode.js) and arrives in batches of 100 000
// points: the cloud appears with the first batch and fills in while the rest
// loads, and the page stays responsive. Uncompressed LAS is even decoded
// while it downloads, without keeping the file in memory. Where a module
// worker cannot start (an old browser, the bundle served from another
// origin), the same decoder runs on the main thread.
//
// Very large clouds are thinned to viewer.pointCloud.maxPoints (default 5
// million) - for full-resolution streaming, convert them to 3D Tiles with the
// worker (worker/pointcloud.py).
//
// Loaded dynamically by loaders.js, so this module (and laz-perf) is only
// downloaded when a LAS/LAZ file is opened.

const DEFAULT_MAX_POINTS = 5_000_000;
const DEFAULT_POINT_SIZE = 2;

function getPointCloudOptions() {
  const config = core.CONFIG?.viewer?.pointCloud || {};
  const maxPoints = Number(config.maxPoints);
  const pointSize = Number(config.pointSize);
  return {
    maxPoints: Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : DEFAULT_MAX_POINTS,
    pointSize: Number.isFinite(pointSize) && pointSize > 0 ? pointSize : DEFAULT_POINT_SIZE,
  };
}

// Runs the decoder in a module worker, else on the main thread; each message
// goes to onMessage. Returns a function that stops it.
function startDecoder(request, onMessage) {
  let worker = null;
  let stopped = false;
  const runOnMainThread = async () => {
    worker = null;
    onMessage({ type: "decoder", name: "main-thread" });
    try {
      const { decodeLasUrl } = await import('./pointcloud-las-decode-Cp410Sel.js');
      await decodeLasUrl(request.url, {
        ...request,
        emit: (message) => {
          if (stopped) throw new Error("stopped");
          onMessage(message);
        },
      });
    } catch (error) {
      if (!stopped) onMessage({ type: "error", message: error?.message || String(error) });
    }
  };

  try {
    worker = new Worker(new URL(new URL('pointcloud-las-worker-B79EWp6-.js', import.meta.url).href), { type: "module" });
  } catch {
    worker = null;
  }
  if (!worker) {
    runOnMainThread();
  } else {
    let started = false;
    worker.onmessage = (event) => {
      if (event.data?.type === "ready") {
        started = true;
        onMessage({ type: "decoder", name: "worker" });
        worker.postMessage(request);
        return;
      }
      onMessage(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      worker?.terminate();
      if (stopped) return;
      // The module did not load (e.g. no module workers): main thread.
      if (!started) runOnMainThread();
      else onMessage({ type: "error", message: event.message || "Point cloud worker failed" });
    };
  }
  return () => {
    stopped = true;
    worker?.terminate();
  };
}

// Colour per point: RGB when the file has it, otherwise intensity, otherwise
// a height ramp, so a cloud without colours is still readable. Decided by
// the first batch; the point cloud panel recolours the whole cloud once it
// is in (with the final intensity range).
function pickColorMode(batch) {
  if (batch.colors?.some((value) => value > 0)) return "rgb";
  if (batch.intensity.some((value) => value > 0)) return "intensity";
  return "height";
}

function writeColors(target, batch, mode, range) {
  const offset = batch.start * 3;
  if (mode === "rgb") {
    target.set(batch.colors, offset);
    return;
  }
  if (mode === "intensity") {
    for (let i = 0; i < batch.count; i += 1) {
      const value = Math.round(40 + Math.min(1, batch.intensity[i] / range.intensityMax) * 215);
      target[offset + i * 3] = target[offset + i * 3 + 1] = target[offset + i * 3 + 2] = value;
    }
    return;
  }
  const color = new THREE.Color();
  const span = range.maxZ - range.minZ || 1;
  for (let i = 0; i < batch.count; i += 1) {
    const t = THREE.MathUtils.clamp((batch.positions[i * 3 + 2] - range.minZ) / span, 0, 1);
    // Blue (low) through green to red (high).
    color.setHSL((1 - t) * 0.66, 0.85, 0.5);
    target[offset + i * 3] = Math.round(color.r * 255);
    target[offset + i * 3 + 1] = Math.round(color.g * 255);
    target[offset + i * 3 + 2] = Math.round(color.b * 255);
  }
}

function setBounds(geometry, [min, max]) {
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
}

// Loads a LAS/LAZ file progressively. Resolves, once the first batch of
// points is in, with { object, done }: object is the model root (a Group,
// left at the origin for the viewer to place, holding the Points re-centred
// and turned from the Z-up LAS convention to Y-up) and fills in as the rest
// arrives; done resolves with the cloud's info (userData.pointCloud) when
// all points are in. Detaching the root from the scene stops the loading.
//
// options: name, onProgress({ loaded, total }) for the download,
// compressed (true for LAZ, false for LAS, or left out to tell by the file).
function loadLasPointCloud(url, { name = "Point cloud", onProgress, compressed } = {}) {
  const { maxPoints, pointSize } = getPointCloudOptions();
  let resolveFirst;
  let rejectFirst;
  let resolveDone;
  let rejectDone;
  const first = new Promise((resolve, reject) => {
    resolveFirst = resolve;
    rejectFirst = reject;
  });
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  // Handled by whoever awaits it; never an unhandled rejection meanwhile.
  done.catch(() => {});

  let header = null;
  let root = null;
  let points = null;
  let mode = null;
  let attached = false;
  let decoder = null;
  const range = { intensityMax: 1, minZ: 0, maxZ: 0 };

  const createCloud = (batch) => {
    const capacity = header.capacity;
    const geometry = new THREE.BufferGeometry();
    const attribute = (array, size, normalized = false) => {
      const result = new THREE.BufferAttribute(array, size, normalized);
      result.setUsage(THREE.DynamicDrawUsage);
      return result;
    };
    geometry.setAttribute("position", attribute(new Float32Array(capacity * 3), 3));
    geometry.setAttribute("color", attribute(new Uint8Array(capacity * 3), 3, true));
    geometry.setAttribute("intensity", attribute(new Uint16Array(capacity), 1));
    geometry.setAttribute("classification", attribute(new Uint8Array(capacity), 1));
    geometry.setDrawRange(0, 0);

    mode = pickColorMode(batch);
    let bounds = header.bounds;
    if (!bounds) {
      // No bounds in the header: those of the first batch, until the end.
      bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
      for (let i = 0; i < batch.count * 3; i += 1) {
        bounds[0][i % 3] = Math.min(bounds[0][i % 3], batch.positions[i]);
        bounds[1][i % 3] = Math.max(bounds[1][i % 3], batch.positions[i]);
      }
    }
    setBounds(geometry, bounds);
    range.minZ = bounds[0][2];
    range.maxZ = bounds[1][2];
    // The slots not loaded yet are not drawn (draw range), but a precise
    // Box3.setFromObject reads the whole buffer: the last two slots hold the
    // corners of the bounds until their points arrive, the rest the centre.
    const position = geometry.getAttribute("position").array;
    if (capacity > batch.count + 1) {
      position.set(bounds[0], (capacity - 2) * 3);
      position.set(bounds[1], (capacity - 1) * 3);
    }

    const material = new THREE.PointsMaterial({
      size: pointSize,
      // Screen-space size: works whatever the units of the scan are.
      sizeAttenuation: false,
      vertexColors: true,
    });
    points = new THREE.Points(geometry, material);
    points.name = name;
    points.rotation.x = -Math.PI / 2;
    points.userData.pointCloud = {
      totalPoints: header.totalPoints,
      loadedPoints: 0,
      skip: header.skip,
      colorMode: mode,
      // Original coordinates of the scene origin, e.g. for exporting measurements.
      originOffset: batch.center,
      // True until all points are in (the point cloud panel waits for it).
      loading: true,
      // "worker" or "main-thread".
      decoder,
    };
    root = new THREE.Group();
    root.name = name;
    root.add(points);
  };

  const appendBatch = (batch) => {
    const geometry = points.geometry;
    const write = (name, data, itemSize) => {
      const attr = geometry.getAttribute(name);
      attr.array.set(data, batch.start * itemSize);
      attr.addUpdateRange(batch.start * itemSize, batch.count * itemSize);
      attr.needsUpdate = true;
    };
    write("position", batch.positions, 3);
    write("intensity", batch.intensity, 1);
    write("classification", batch.classification, 1);
    for (let i = 0; i < batch.count; i += 1) {
      if (batch.intensity[i] > range.intensityMax) range.intensityMax = batch.intensity[i];
    }
    const color = geometry.getAttribute("color");
    writeColors(color.array, batch, mode, range);
    color.addUpdateRange(batch.start * 3, batch.count * 3);
    color.needsUpdate = true;
    const loaded = batch.start + batch.count;
    geometry.setDrawRange(0, loaded);
    points.userData.pointCloud.loadedPoints = loaded;
  };

  // The buffers were sized from the header; a file with fewer points than
  // it announces gets buffers of its real size (the panel and the stats
  // count the attribute lengths).
  const finish = (message) => {
    const geometry = points.geometry;
    const loaded = message.loadedPoints;
    if (loaded < header.capacity) {
      ["position", "color", "intensity", "classification"].forEach((attrName) => {
        const attr = geometry.getAttribute(attrName);
        const trimmed = new THREE.BufferAttribute(attr.array.slice(0, loaded * attr.itemSize), attr.itemSize, attr.normalized);
        geometry.setAttribute(attrName, trimmed);
      });
    }
    geometry.setDrawRange(0, Infinity);
    setBounds(geometry, message.bounds);
    const info = points.userData.pointCloud;
    info.loadedPoints = loaded;
    info.loading = false;
    return info;
  };

  const stop = startDecoder({ url, maxPoints, compressed }, (message) => {
    // The model was removed (another one opened) while it loaded.
    if (root?.parent) attached = true;
    else if (attached) {
      stop();
      rejectDone(new Error("Point cloud loading cancelled"));
      return;
    }
    switch (message.type) {
      case "progress":
        onProgress?.({ loaded: message.loaded, total: message.total });
        break;
      case "decoder":
        decoder = message.name;
        break;
      case "header":
        header = message;
        break;
      case "batch":
        if (!points) createCloud(message);
        appendBatch(message);
        if (message.start === 0) resolveFirst({ object: root, done });
        break;
      case "done":
        stop();
        try {
          resolveDone(finish(message));
        } catch (error) {
          rejectDone(error);
        }
        break;
      case "error": {
        stop();
        const error = new Error(message.message);
        if (points) rejectDone(error);
        else rejectFirst(error);
        break;
      }
    }
  });

  return first;
}

export { loadLasPointCloud };
//# sourceMappingURL=pointcloud-las-DRbWF_l1.js.map
