import THREE from "./init.js";
import { core } from "./core.js";
import { t } from "./i18n-utils.js";

// Playback of animation clips shipped with the loaded model (glTF/GLB, FBX,
// DAE, KMZ, three.js JSON). Loaders leave the clips on `object.animations`;
// setupModelAnimations() builds the mixer and a small player bar on top of
// the canvas. Settings (viewer-settings.json → viewer.animation):
//   autoplay (bool, default true), clip (name or index, default first),
//   speed (number, default 1), loop (bool, default true), showPlayer (bool)
// URL overrides: ?animation=<name|index>, ?animationAutoplay=0|1,
// ?animationSpeed=<n>.

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const ALL_CLIPS = "all";

function collectClips(object) {
  const roots = Array.isArray(object) ? object : [object];
  const clips = [];
  roots.forEach((root) => {
    (root?.animations || []).forEach((clip) => {
      if (clip && clip.duration > 0 && clip.tracks?.length) clips.push({ clip, root });
    });
  });
  return clips;
}

function formatSeconds(value) {
  return `${Math.max(0, value).toFixed(1)} s`;
}

export function attachAnimations(Viewer) {
  Object.assign(Viewer, {
    animationState: null,

    getAnimationOptions() {
      const config = core.CONFIG?.viewer?.animation || {};
      const params = new URLSearchParams(window.location.search);
      const autoplayParam = Viewer.parseBooleanParam?.(params.get("animationAutoplay"));
      const speedParam = Viewer.parseFloatParam?.(params.get("animationSpeed"));
      const speed = Number.isFinite(speedParam) ? speedParam : Number(config.speed);
      return {
        autoplay: typeof autoplayParam === "boolean" ? autoplayParam : config.autoplay !== false,
        clip: params.get("animation") ?? config.clip ?? null,
        speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
        loop: config.loop !== false,
        showPlayer: config.showPlayer !== false,
      };
    },

    setupModelAnimations(object) {
      Viewer.disposeAnimations();
      const entries = collectClips(object);
      if (!entries.length) return;

      const options = Viewer.getAnimationOptions();
      // One mixer per root keeps track bindings local to the model that owns them.
      const mixers = new Map();
      const actions = entries.map(({ clip, root }) => {
        if (!mixers.has(root)) mixers.set(root, new THREE.AnimationMixer(root));
        return mixers.get(root).clipAction(clip);
      });

      const state = {
        mixers: [...mixers.values()],
        clips: entries.map((entry) => entry.clip),
        actions,
        selection: 0,
        playing: false,
        speed: options.speed,
        loop: options.loop,
        scrubbing: false,
        ui: null,
      };
      Viewer.animationState = state;
      // Kept for the render loop, which already calls Viewer.mixer.update(delta).
      Viewer.mixer = {
        update: (delta) => state.mixers.forEach((mixer) => mixer.update(delta)),
      };
      state.mixers.forEach((mixer) => {
        mixer.timeScale = state.speed;
        mixer.addEventListener("finished", Viewer.onAnimationFinished);
      });

      const requested = options.clip;
      if (requested != null && requested !== "") {
        const byName = state.clips.findIndex((clip) => clip.name === requested);
        const byIndex = Number.parseInt(requested, 10);
        if (requested === ALL_CLIPS) state.selection = ALL_CLIPS;
        else if (byName >= 0) state.selection = byName;
        else if (Number.isInteger(byIndex) && state.clips[byIndex]) state.selection = byIndex;
      }

      const hidePlayer = !options.showPlayer || Viewer.urlOptions?.hideUi === true || core.PRESENTATION_MODE === true;
      if (!hidePlayer) Viewer.createAnimationPlayer();

      Viewer.selectAnimation(state.selection, { play: options.autoplay });
    },

    getActiveAnimationActions() {
      const state = Viewer.animationState;
      if (!state) return [];
      if (state.selection === ALL_CLIPS) return state.actions;
      return state.actions[state.selection] ? [state.actions[state.selection]] : [];
    },

    getAnimationDuration() {
      return Viewer.getActiveAnimationActions().reduce(
        (max, action) => Math.max(max, action.getClip().duration),
        0
      );
    },

    selectAnimation(selection, { play = true } = {}) {
      const state = Viewer.animationState;
      if (!state) return;
      state.actions.forEach((action) => action.stop());
      state.selection = selection === ALL_CLIPS ? ALL_CLIPS : Number(selection) || 0;

      Viewer.getActiveAnimationActions().forEach((action) => {
        Viewer.applyAnimationLoop(action);
        action.reset();
        action.paused = !play;
        action.play();
      });
      // Pose the model at frame 0 even when not playing.
      state.mixers.forEach((mixer) => mixer.update(0));
      state.playing = play;
      Viewer.syncAnimationPlayer();
    },

    applyAnimationLoop(action) {
      const loop = Viewer.animationState?.loop !== false;
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !loop;
    },

    playAnimation() {
      const state = Viewer.animationState;
      if (!state) return;
      const actions = Viewer.getActiveAnimationActions();
      const finished = actions.length > 0 && actions.every(
        (action) => !action.isRunning() && action.time >= action.getClip().duration - 1e-3
      );
      if (finished) {
        Viewer.selectAnimation(state.selection, { play: true });
        return;
      }
      actions.forEach((action) => {
        action.enabled = true;
        action.paused = false;
        if (!action.isScheduled()) action.play();
      });
      state.playing = true;
      Viewer.syncAnimationPlayer();
    },

    pauseAnimation() {
      const state = Viewer.animationState;
      if (!state) return;
      Viewer.getActiveAnimationActions().forEach((action) => {
        action.paused = true;
      });
      state.playing = false;
      Viewer.syncAnimationPlayer();
    },

    toggleAnimationPlayback() {
      if (!Viewer.animationState) return false;
      if (Viewer.animationState.playing) Viewer.pauseAnimation();
      else Viewer.playAnimation();
      return true;
    },

    setAnimationTime(seconds) {
      const state = Viewer.animationState;
      if (!state) return;
      Viewer.getActiveAnimationActions().forEach((action) => {
        const duration = action.getClip().duration;
        action.enabled = true;
        if (!action.isScheduled()) action.play();
        action.paused = true;
        action.time = Math.min(Math.max(seconds, 0), duration);
      });
      state.mixers.forEach((mixer) => mixer.update(0));
      Viewer.syncAnimationPlayer();
    },

    setAnimationSpeed(speed) {
      const state = Viewer.animationState;
      if (!state || !(speed > 0)) return;
      state.speed = speed;
      state.mixers.forEach((mixer) => {
        mixer.timeScale = speed;
      });
      Viewer.syncAnimationPlayer();
    },

    setAnimationLoop(loop) {
      const state = Viewer.animationState;
      if (!state) return;
      state.loop = loop;
      Viewer.getActiveAnimationActions().forEach((action) => Viewer.applyAnimationLoop(action));
      Viewer.syncAnimationPlayer();
    },

    onAnimationFinished() {
      const state = Viewer.animationState;
      if (!state) return;
      const stillRunning = Viewer.getActiveAnimationActions().some((action) => action.isRunning());
      if (!stillRunning) {
        state.playing = false;
        Viewer.syncAnimationPlayer();
      }
    },

    createAnimationPlayer() {
      const state = Viewer.animationState;
      if (!state || !core.container) return;

      const bar = document.createElement("div");
      bar.id = "viewerAnimationPlayer";
      bar.className = "viewer-animation-player";
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", t("animation.player", "Animation player"));

      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "viewer-animation-player_play";

      const clipSelect = document.createElement("select");
      clipSelect.className = "viewer-animation-player_clip";
      clipSelect.setAttribute("aria-label", t("animation.clip", "Animation clip"));
      state.clips.forEach((clip, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = clip.name || `${t("animation.clip", "Animation clip")} ${index + 1}`;
        clipSelect.appendChild(option);
      });
      if (state.clips.length > 1) {
        const option = document.createElement("option");
        option.value = ALL_CLIPS;
        option.textContent = t("animation.allClips", "All clips");
        clipSelect.appendChild(option);
      } else {
        clipSelect.hidden = true;
      }

      const timeline = document.createElement("input");
      timeline.type = "range";
      timeline.min = "0";
      timeline.step = "0.01";
      timeline.className = "viewer-animation-player_timeline";
      timeline.setAttribute("aria-label", t("animation.timeline", "Animation time"));

      const timeLabel = document.createElement("span");
      timeLabel.className = "viewer-animation-player_time";

      const speedSelect = document.createElement("select");
      speedSelect.className = "viewer-animation-player_speed";
      speedSelect.setAttribute("aria-label", t("animation.speed", "Playback speed"));
      const speeds = SPEEDS.includes(state.speed) ? SPEEDS : [...SPEEDS, state.speed].sort((a, b) => a - b);
      speeds.forEach((speed) => {
        const option = document.createElement("option");
        option.value = String(speed);
        option.textContent = `${speed}×`;
        speedSelect.appendChild(option);
      });

      const loopButton = document.createElement("button");
      loopButton.type = "button";
      loopButton.className = "viewer-animation-player_loop";
      loopButton.textContent = "⟳";

      bar.append(playButton, clipSelect, timeline, timeLabel, speedSelect, loopButton);

      // Keep pointer/keyboard input on the player away from the orbit controls
      // and the viewer's own shortcuts.
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        bar.addEventListener(type, (event) => event.stopPropagation());
      });

      playButton.addEventListener("click", () => Viewer.toggleAnimationPlayback());
      clipSelect.addEventListener("change", () => {
        Viewer.selectAnimation(clipSelect.value, { play: state.playing });
      });
      timeline.addEventListener("pointerdown", () => {
        state.resumeAfterScrub = state.playing;
        state.scrubbing = true;
        if (state.playing) Viewer.pauseAnimation();
      });
      timeline.addEventListener("input", () => {
        Viewer.setAnimationTime(Number.parseFloat(timeline.value));
      });
      timeline.addEventListener("change", () => {
        state.scrubbing = false;
        if (state.resumeAfterScrub) Viewer.playAnimation();
        state.resumeAfterScrub = false;
      });
      speedSelect.addEventListener("change", () => {
        Viewer.setAnimationSpeed(Number.parseFloat(speedSelect.value));
      });
      loopButton.addEventListener("click", () => Viewer.setAnimationLoop(!state.loop));

      core.container.appendChild(bar);
      state.ui = { bar, playButton, clipSelect, timeline, timeLabel, speedSelect, loopButton };
      Viewer.updateAnimationPlayerLabels();
    },

    updateAnimationPlayerLabels() {
      const ui = Viewer.animationState?.ui;
      if (!ui) return;
      ui.bar.setAttribute("aria-label", t("animation.player", "Animation player"));
      ui.clipSelect.setAttribute("aria-label", t("animation.clip", "Animation clip"));
      ui.timeline.setAttribute("aria-label", t("animation.timeline", "Animation time"));
      ui.speedSelect.setAttribute("aria-label", t("animation.speed", "Playback speed"));
      const allOption = ui.clipSelect.querySelector(`option[value="${ALL_CLIPS}"]`);
      if (allOption) allOption.textContent = t("animation.allClips", "All clips");
      Viewer.syncAnimationPlayer();
    },

    syncAnimationPlayer() {
      const state = Viewer.animationState;
      const ui = state?.ui;
      if (!ui) return;
      const playLabel = state.playing ? t("animation.pause", "Pause") : t("animation.play", "Play");
      ui.playButton.textContent = state.playing ? "❚❚" : "▶";
      ui.playButton.setAttribute("aria-label", playLabel);
      ui.playButton.title = playLabel;
      ui.clipSelect.value = String(state.selection);
      ui.speedSelect.value = String(state.speed);
      const loopLabel = state.loop ? t("animation.loopOn", "Loop: on") : t("animation.loopOff", "Loop: off");
      ui.loopButton.setAttribute("aria-pressed", state.loop ? "true" : "false");
      ui.loopButton.setAttribute("aria-label", loopLabel);
      ui.loopButton.title = loopLabel;
      ui.timeline.max = String(Viewer.getAnimationDuration());
      Viewer.updateAnimationTimeline();
    },

    // Called from the render loop; only touches the DOM when the value moved.
    updateAnimationTimeline() {
      const state = Viewer.animationState;
      const ui = state?.ui;
      if (!ui || state.scrubbing) return;
      const [primary] = Viewer.getActiveAnimationActions()
        .slice()
        .sort((a, b) => b.getClip().duration - a.getClip().duration);
      const time = primary ? primary.time : 0;
      const rounded = time.toFixed(2);
      if (ui.timeline.value !== rounded) ui.timeline.value = rounded;
      const label = `${formatSeconds(time)} / ${formatSeconds(Viewer.getAnimationDuration())}`;
      if (ui.timeLabel.textContent !== label) ui.timeLabel.textContent = label;
    },

    disposeAnimations() {
      const state = Viewer.animationState;
      if (state) {
        state.mixers.forEach((mixer) => {
          mixer.removeEventListener("finished", Viewer.onAnimationFinished);
          mixer.stopAllAction();
          mixer.uncacheRoot(mixer.getRoot());
        });
        state.ui?.bar.remove();
      }
      Viewer.animationState = null;
      Viewer.mixer = null;
    },
  });
}
