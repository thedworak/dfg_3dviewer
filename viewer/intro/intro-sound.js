// The intro's sound (viewer/intro/intro.js), made on the fly with the Web
// Audio API - no audio files:
//
// - a low, slowly breathing drone and a little air under everything;
// - soft glassy plucks as the points click into place (a pentatonic scale,
//   higher as the building rises);
// - the last point: a thin, rising glass tone that follows it across the
//   screen; its landing: a quiet bell and a soft low thump;
// - the model: tiny sparks for the vertices, a brushed noise sweep while the
//   edges are drawn, a warm chord opening up as the faces form, and a last
//   bell when it stands;
// - the feature tour: a soft two-note cue for each chapter, ticks between;
// - "Assemble again" and "Enter the viewer": a whoosh.
//
// Browsers let sound start only after a click or key press, so the page
// calls setEnabled(true) from one. update() runs every frame with where the
// intro is; the continuous voices follow it (also backwards), the single
// sounds only play while it runs forward.

const PENTATONIC = [0, 3, 5, 7, 10]; // A minor pentatonic, semitones
const A4 = 440;
const note = (semitones) => A4 * Math.pow(2, semitones / 12);

export function createIntroSound() {
  let ctx = null;
  let enabled = false;
  let voices = null;
  let last = null; // the previous frame's state

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    master.connect(compressor).connect(ctx.destination);

    // A soft room: a convolver with a decaying noise impulse.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.2, 2.6);
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 0.55;
    reverbIn.connect(reverb).connect(master);

    const noise = noiseBuffer(ctx, 3);

    // The drone: two low sines a fifth apart and a soft triangle, through a
    // lowpass that slowly breathes.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 420;
    droneFilter.Q.value = 0.6;
    droneFilter.connect(droneGain).connect(master);
    droneGain.connect(reverbIn);
    for (const [frequency, type, level, detune] of [[55, 'sine', 0.5, 0], [82.41, 'sine', 0.32, 0], [110, 'triangle', 0.12, 6]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(droneFilter);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 160;
    lfo.connect(lfoDepth).connect(droneFilter.frequency);
    lfo.start();
    // Air: quiet band-passed noise.
    const air = loopNoise(ctx, noise);
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 900;
    airFilter.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.18;
    air.connect(airFilter).connect(airGain).connect(droneGain);

    // The last point's glass tone.
    const glass = ctx.createOscillator();
    glass.type = 'sine';
    const glassOvertone = ctx.createOscillator();
    glassOvertone.type = 'triangle';
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.18;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.2;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 5; // cents
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(glass.detune);
    vibratoDepth.connect(glassOvertone.detune);
    const glassGain = ctx.createGain();
    glassGain.gain.value = 0;
    const glassPan = ctx.createStereoPanner();
    glass.connect(glassGain);
    glassOvertone.connect(overtoneGain).connect(glassGain);
    glassGain.connect(glassPan).connect(master);
    glassPan.connect(reverbIn);
    glass.start(); glassOvertone.start(); vibrato.start();

    // The edges being drawn: brushed noise, a band sweeping upwards.
    const brush = loopNoise(ctx, noise);
    const brushFilter = ctx.createBiquadFilter();
    brushFilter.type = 'bandpass';
    brushFilter.Q.value = 2.2;
    brushFilter.frequency.value = 400;
    const brushGain = ctx.createGain();
    brushGain.gain.value = 0;
    brush.connect(brushFilter).connect(brushGain).connect(master);
    brushGain.connect(reverbIn);

    // The faces: a warm A major 9 chord, its filter opening as they form.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 250;
    padFilter.Q.value = 0.8;
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padFilter.connect(padGain).connect(master);
    padGain.connect(reverbIn);
    for (const [semitones, level] of [[-24, 0.3], [-17, 0.22], [-12, 0.2], [-8, 0.14], [-5, 0.12], [-1, 0.08]]) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note(semitones);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = level * 0.5;
        osc.connect(g).connect(padFilter);
        osc.start();
      }
    }

    voices = {
      master, reverbIn, noise, droneGain, droneFilter,
      glass, glassOvertone, glassGain, glassPan,
      brushFilter, brushGain, padFilter, padGain,
    };
  }

  // --- Single sounds ---------------------------------------------------------

  function pluck(frequency, level, pan = 0, decay = 0.7) {
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(level, now + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(voices.master);
    panner.connect(voices.reverbIn);
    for (const [ratio, gain] of [[1, 1], [2, 0.25], [3.01, 0.08]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * ratio;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
  }

  // A bell: inharmonic partials, a long decay.
  function bell(frequency, level, decay = 3) {
    const now = ctx.currentTime;
    for (const [ratio, gain, length] of [[1, 1, 1], [2, 0.5, 0.8], [2.76, 0.35, 0.6], [4.07, 0.2, 0.4], [5.4, 0.12, 0.3]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(level * gain, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay * length);
      osc.connect(g);
      g.connect(voices.master);
      g.connect(voices.reverbIn);
      osc.start(now);
      osc.stop(now + decay + 0.1);
    }
  }

  function thump(level) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    osc.connect(g).connect(voices.master);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  // Noise through a band sweeping from one frequency to another.
  function whoosh(from, to, length, level) {
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = voices.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(to, now + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + length * 0.4);
    g.gain.linearRampToValueAtTime(0, now + length);
    source.connect(filter).connect(g);
    g.connect(voices.master);
    g.connect(voices.reverbIn);
    source.start(now);
    source.stop(now + length + 0.05);
  }

  // --- Following the intro ----------------------------------------------------

  const smooth = (param, value, time = 0.12) => param.setTargetAtTime(value, ctx.currentTime, time);
  const bump = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);

  // state: { dt, forward, fade, progress, arrivedRate, flight, pan, landed,
  //          vertices, edges, faces, glowOut, exit }
  function update(state) {
    if (!enabled || !voices || ctx.state !== 'running') {
      last = state;
      return;
    }
    const v = voices;
    const { dt, forward } = state;

    // The drone: there from the start, quieter once the building stands.
    smooth(v.droneGain.gain, state.fade * (0.16 - state.glowOut * 0.07) * (1 - state.exit), 0.4);
    smooth(v.droneFilter.frequency, 380 + state.progress * 220 + state.faces * 300, 0.6);

    // Points arriving: plucks, as many as are arriving (within reason).
    if (forward && state.arrivedRate > 0) {
      const perSecond = Math.min(11, state.arrivedRate * 32);
      if (Math.random() < perSecond * dt) {
        const octave = Math.floor(state.progress * 2.2 + Math.random() * 1.2);
        const step = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
        pluck(note(step + 12 * octave - 5), 0.035 + Math.random() * 0.025, Math.random() * 1.6 - 0.8, 0.5 + Math.random() * 0.6);
      }
    }

    // The last point: a glass tone, rising as it comes in.
    const flying = state.flight > 0 && !state.landed;
    const glassLevel = flying ? 0.045 * Math.min(1, state.flight * 5) : 0;
    smooth(v.glassGain.gain, glassLevel * (1 - state.exit), flying ? 0.3 : 0.08);
    const glassFrequency = 1046.5 * Math.pow(2, (state.flight * 7) / 12);
    smooth(v.glass.frequency, glassFrequency, 0.2);
    smooth(v.glassOvertone.frequency, glassFrequency * 2.003, 0.2);
    smooth(v.glassPan.pan, Math.max(-0.9, Math.min(0.9, state.pan)), 0.1);
    if (forward && state.landed && last && !last.landed) {
      bell(1318.5, 0.06, 3.2);
      bell(659.25, 0.045, 3.6);
      thump(0.22);
    }

    // Vertices: tiny sparks.
    if (forward && last && state.vertices > last.vertices && state.vertices < 1) {
      const perSecond = Math.min(18, ((state.vertices - last.vertices) / Math.max(dt, 1e-3)) * 40);
      if (Math.random() < perSecond * dt) {
        pluck(2000 + Math.random() * 3200, 0.008 + Math.random() * 0.01, Math.random() * 1.8 - 0.9, 0.12);
      }
    }

    // Edges: the brush, sweeping up while they are drawn.
    smooth(v.brushGain.gain, 0.05 * bump(state.edges) * (1 - state.exit), 0.2);
    smooth(v.brushFilter.frequency, 350 + state.edges * 3200, 0.2);

    // Faces: the chord swells and opens, then settles.
    const padLevel = (Math.min(1, state.faces * 1.6) * (1 - state.glowOut * 0.55)) * 0.07 * (1 - state.exit);
    smooth(v.padGain.gain, padLevel, 0.5);
    smooth(v.padFilter.frequency, 220 + state.faces * 2200 - state.glowOut * 1200, 0.5);
    if (forward && last && state.faces >= 1 && last.faces < 1) {
      bell(880, 0.045, 4);
      bell(1318.5, 0.03, 3.5);
    }
    last = state;
  }

  async function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
      voices.master.gain.cancelScheduledValues(ctx.currentTime);
      voices.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    } else if (ctx) {
      voices.master.gain.cancelScheduledValues(ctx.currentTime);
      voices.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { if (!enabled) ctx.suspend(); }, 800);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enabled) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    get enabled() { return enabled; },
    setEnabled,
    update,
    // The feature tour (feature-tour.js): a soft two-note cue for a new
    // chapter, a small tick for a step within one.
    cue(kind) {
      if (!enabled || !voices || ctx.state !== 'running') return;
      if (kind === 'chapter') {
        pluck(note(7), 0.045, -0.3, 1.1);
        setTimeout(() => { if (enabled) pluck(note(12), 0.04, 0.3, 1.3); }, 110);
      } else {
        pluck(note(19 + Math.floor(Math.random() * 3) * 2), 0.022, Math.random() * 1.2 - 0.6, 0.45);
      }
    },
    rewind() {
      if (enabled && voices && ctx.state === 'running') whoosh(3200, 300, 2.2, 0.08);
    },
    // Into the viewer: a whoosh, everything fading with the picture.
    enter(length) {
      if (!enabled || !voices || ctx.state !== 'running') return;
      whoosh(250, 4200, length, 0.1);
      voices.master.gain.setTargetAtTime(0, ctx.currentTime + length * 0.4, length * 0.3);
    },
  };
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function loopNoise(ctx, buffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
}

function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}
