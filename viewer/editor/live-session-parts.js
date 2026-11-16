import THREE from "../init.js";

// What a shared session (editor/live-link.js) carries beside the blocks of
// the manifest: each part is read from the viewer as plain data and shown
// from such data - checked value by value, since it comes from another
// viewer. `read(block)` gets the scene's AIM3DViewer block as written out;
// it gives undefined while there is nothing of the kind. `show(value)`
// gets undefined when the others have none.
const round = (value, step = 1e3) => Math.round(value * step) / step;
const number = (value) => typeof value === "number" && Number.isFinite(value);
const triple = (value) => (Array.isArray(value) && value.length === 3 && value.every(number) ? value : null);
const text = (value, length = 200) => (typeof value === "string" ? value.slice(0, length) : "");
const COLOR = /^#[0-9a-f]{6}$/i;

const AUDIO_PLAYBACK = { volume: 1, rate: 1, preservePitch: true, loop: false, region: null, channelMode: "stereo", filter: { type: "off" }, compressor: false, reverb: "off" };
const VOLUME_KEYS = ["mode", "isoChannel", "iso", "density", "brightness", "sampling"];
const VOLUME_MODES = ["mip", "dvr", "iso"];
const POINT_SHAPES = ["square", "round", "sphere"];

// Of `value`, the keys `like` has, with values of the same kind.
function sameKind(value, like) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  Object.keys(like).forEach((key) => {
    const given = value[key];
    if (typeof given !== typeof like[key] || given === null) return;
    if (typeof given === "number" ? number(given) : typeof given === "boolean" || (typeof given === "string" && given.length <= 200)) result[key] = given;
  });
  return result;
}

export function liveSessionParts(Viewer) {
  return {
    // The scene's cameras (editor/scene-cameras.js) and the one chosen.
    cameras: {
      read() {
        const list = Viewer.getSceneCameras?.() || [];
        if (!list.length) return undefined;
        return {
          active: Math.max(0, list.indexOf(Viewer.getActiveSceneCamera())),
          list: list.map((camera) => ({
            ...(camera.id ? { id: String(camera.id) } : {}),
            ...(camera.label ? { label: String(camera.label) } : {}),
            type: camera.type,
            position: camera.position.toArray().map((value) => round(value, 1e5)),
            target: camera.target.toArray().map((value) => round(value, 1e5)),
            ...Object.fromEntries(["fov", "viewHeight", "near", "far"].filter((key) => number(camera[key])).map((key) => [key, camera[key]])),
          })),
        };
      },
      show(value) {
        if (!Viewer.setSceneCameras) return;
        const list = (Array.isArray(value?.list) ? value.list.slice(0, 100) : [])
          .filter((camera) => triple(camera?.position) && triple(camera?.target))
          .map((camera) => ({
            id: text(camera.id) || null,
            label: text(camera.label),
            type: camera.type === "OrthographicCamera" ? "OrthographicCamera" : "PerspectiveCamera",
            position: new THREE.Vector3().fromArray(camera.position),
            lookAt: new THREE.Vector3().fromArray(camera.target),
            fieldOfView: camera.fov,
            viewHeight: camera.viewHeight,
            near: camera.near,
            far: camera.far,
          }));
        if (!list.length) {
          if (Viewer.getSceneCameras().length) Viewer.clearSceneCameras();
          return;
        }
        Viewer.setSceneCameras(list, list[Number.isInteger(value.active) ? value.active : 0] ?? null);
      },
    },

    // The historical photo held over the view (editor/photo-overlay.js).
    photo: {
      read() {
        const state = Viewer.photosState;
        const open = state?.openId ? Viewer.getOpenPhoto?.() : null;
        if (!open?.exportable) return undefined;
        return { id: open.id, opacity: round(state.opacity, 100), swipe: state.swipe === true, position: round(state.swipePosition, 100) };
      },
      show(value) {
        const state = Viewer.photosState;
        if (!state) return;
        if (!value || typeof value !== "object" || typeof value.id !== "string") {
          if (state.openId) Viewer.closePhoto();
          return;
        }
        // The camera travels on its own: the photo does not fly it.
        if (state.openId !== value.id && !Viewer.openPhoto(value.id, { fly: false })) return;
        if (number(value.opacity)) Viewer.setPhotoOpacity(value.opacity);
        Viewer.setPhotoSwipe(value.swipe === true, number(value.position) ? value.position : null);
      },
    },

    // A 2D image: which one of its set, and its filters (editor/image-panel.js).
    image: {
      read(block) {
        if (!Viewer.imageState?.api) return undefined;
        return { index: Viewer.getImageIndex(), settings: block.image || {} };
      },
      show(value) {
        const state = Viewer.imageState;
        if (!state?.api || !value || typeof value !== "object") return;
        const defaults = state.api.IMAGE_FILTER_DEFAULTS;
        // Whole: what the others left out is the default again.
        const apply = () => Viewer.imageState === state && Viewer.apply3IFManifestImage({ ...defaults, ...sameKind(value.settings, defaults) });
        if (Number.isInteger(value.index) && value.index >= 0 && value.index < Viewer.getImageSet().length && value.index !== Viewer.getImageIndex()) {
          Promise.resolve(Viewer.showImageAt(value.index)).then(apply);
        } else apply();
      },
    },

    // A sound file's view and playback settings (editor/audio-panel.js) -
    // not whether it plays: each viewer starts its own.
    audio: {
      read(block) {
        if (!Viewer.audioState?.api || !Viewer.audioState.player) return undefined;
        return block.audio || {};
      },
      show(value) {
        const state = Viewer.audioState;
        if (!state?.api || !value || typeof value !== "object") return;
        const given = value.playback && typeof value.playback === "object" ? value.playback : {};
        const { region: _region, filter: _filter, ...plain } = AUDIO_PLAYBACK;
        const region = given.region && number(given.region.start) && number(given.region.end) && given.region.end > given.region.start && given.region.start >= 0
          ? { start: given.region.start, end: given.region.end }
          : null;
        Viewer.apply3IFManifestAudio({
          ...state.api.DEFAULT_AUDIO_SETTINGS,
          ...sameKind(value, state.api.DEFAULT_AUDIO_SETTINGS),
          playback: {
            ...plain,
            ...sameKind(given, plain),
            ...(number(given.reverbMix) ? { reverbMix: given.reverbMix } : {}),
            region,
            filter: { ...AUDIO_PLAYBACK.filter, ...sameKind(given.filter, { type: "", frequency: 0, q: 0 }) },
          },
        });
      },
    },

    // A point cloud's display (editor/point-cloud-panel.js).
    pointCloud: {
      read() {
        const state = Viewer.pointCloudState;
        if (!state) return undefined;
        return {
          size: round(state.size),
          ...(state.kind === "direct" ? { sizeMode: state.sizeMode } : {}),
          shape: state.shape,
          edl: round(state.edl),
          colorMode: state.colorMode,
          hidden: [...state.hiddenClasses].sort((a, b) => a - b),
        };
      },
      show(value) {
        const state = Viewer.pointCloudState;
        if (!state || !value || typeof value !== "object") return;
        if (number(value.size) && value.size !== round(state.size)) Viewer.setPointCloudSize(value.size);
        if ((value.sizeMode === "fixed" || value.sizeMode === "adaptive") && value.sizeMode !== state.sizeMode) Viewer.setPointCloudSizeMode(value.sizeMode);
        if (POINT_SHAPES.includes(value.shape) && value.shape !== state.shape) Viewer.setPointCloudShape(value.shape);
        if (number(value.edl) && value.edl !== round(state.edl)) Viewer.setPointCloudEdl(value.edl);
        if (typeof value.colorMode === "string" && value.colorMode !== state.colorMode) Viewer.setPointCloudColorMode(value.colorMode);
        if (Array.isArray(value.hidden) && Viewer.setPointCloudClassVisible) {
          const hidden = new Set(value.hidden.filter((id) => Number.isInteger(id) && id >= 0 && id < 256));
          [...new Set([...hidden, ...state.hiddenClasses])].forEach((id) => {
            if (hidden.has(id) !== state.hiddenClasses.has(id)) Viewer.setPointCloudClassVisible(id, !hidden.has(id));
          });
        }
      },
    },

    // A volume's rendering (editor/volume-panel.js): the stack, the mode,
    // the channels.
    volume: {
      read() {
        const settings = Viewer.volumeState?.api ? Viewer.volumeState.mesh.userData.volume : null;
        if (!settings) return undefined;
        return {
          seriesIndex: settings.seriesIndex,
          ...Object.fromEntries(VOLUME_KEYS.map((key) => [key, number(settings[key]) ? round(settings[key], 1e5) : settings[key]])),
          channels: (settings.channels || []).map(({ name: _name, ...channel }) => channel),
        };
      },
      show(value) {
        const state = Viewer.volumeState;
        if (!state?.api || !value || typeof value !== "object") return;
        const merge = (settings) => {
          const { mode, ...numbers } = sameKind(value, Object.fromEntries(VOLUME_KEYS.map((key) => [key, settings[key]])));
          Object.assign(settings, numbers, VOLUME_MODES.includes(mode) ? { mode } : {});
          (Array.isArray(value.channels) ? value.channels : []).forEach((channel, index) => {
            const own = settings.channels?.[index];
            if (!own) return;
            const { name: _name, ...like } = own;
            const given = sameKind(channel, like);
            if (given.color !== undefined && !COLOR.test(given.color)) delete given.color;
            Object.assign(own, given);
          });
        };
        const apply = () => Viewer.volumeState === state && Viewer.updateVolumeSettings(merge, { rebuild: true });
        const index = value.seriesIndex;
        if (Number.isInteger(index) && index >= 0 && index !== state.mesh.userData.volume.seriesIndex) {
          Promise.resolve(Viewer.showVolumeSeries(index)).then(apply);
        } else apply();
      },
    },
  };
}
