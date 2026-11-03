// The intro's sound (viewer/intro/intro.js), made on the fly with the Web
// Audio API - no audio files. Futuristic, mechanical and glassy: a machine
// of glass assembling itself.
//
// - the cloud: a deep, slowly turning drone and a high crystalline shimmer;
// - points arriving: glass shards clicking into place - a short metallic
//   click on a tiny resonator and a bright, inharmonic glass tick - over a
//   servo whir that rises with the pace;
// - the last point: a rising, resonant "transforming" sweep with glass pings
//   coming faster as it nears; just before it lands a reversed swell is
//   drawn in, and the landing is a deep distorted brass-like blast, a sub
//   drop and a ringing glass lock;
// - the model: data blips for the vertices, a ratchet speeding up while the
//   edges are drawn, panels locking (a low thunk under a glass tick) as the
//   faces form, and a last locking chord;
// - the feature tour: a quick rising sweep and a ping for each chapter, a
//   glass tick between its steps;
// - "Assemble again": a reversed sweep down; "Enter the viewer": a rising
//   whoosh into a last blast.
//
// Browsers let sound start only after a click or key press, so the page
// calls setEnabled(true) from one. update() runs every frame with where the
// intro is; the continuous voices follow it (also backwards), the single
// sounds only play while it runs forward.

export function createIntroSound() {
  let ctx = null;
  let enabled = false;
  let v = null; // the voices
  let last = null; // the previous frame's state
  const fired = new Set(); // one-off events of the current pass

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    master.connect(compressor).connect(ctx.destination);

    // A bright, long hall.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.8, 2.2);
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 0.5;
    reverbIn.connect(reverb).connect(master);

    // A tiny metal resonator (a comb): what the clicks ring in.
    const comb = ctx.createDelay(0.05);
    comb.delayTime.value = 0.0021;
    const combFeedback = ctx.createGain();
    combFeedback.gain.value = 0.72;
    comb.connect(combFeedback).connect(comb);
    const combOut = ctx.createGain();
    combOut.gain.value = 0.6;
    comb.connect(combOut);
    combOut.connect(master);
    combOut.connect(reverbIn);

    const noise = noiseBuffer(ctx, 3);

    // The drone: detuned low saws through a slowly moving lowpass.
    const drone = ctx.createGain();
    drone.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;
    droneFilter.Q.value = 3;
    droneFilter.connect(drone);
    drone.connect(master);
    drone.connect(reverbIn);
    for (const [frequency, detune] of [[36.7, -8], [36.7, 8], [55, 0], [73.4, 5]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      osc.connect(droneFilter);
      osc.start();
    }
    const droneLfo = ctx.createOscillator();
    droneLfo.frequency.value = 0.09;
    const droneLfoDepth = ctx.createGain();
    droneLfoDepth.gain.value = 90;
    droneLfo.connect(droneLfoDepth).connect(droneFilter.frequency);
    droneLfo.start();

    // The shimmer: high noise, flickering like crystals turning.
    const shimmer = loopNoise(ctx, noise);
    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.value = 7200;
    shimmerFilter.Q.value = 3;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0;
    const flicker = ctx.createOscillator();
    flicker.type = 'square';
    flicker.frequency.value = 7.3;
    const flickerDepth = ctx.createGain();
    flickerDepth.gain.value = 0.4;
    const shimmerAmp = ctx.createGain();
    shimmerAmp.gain.value = 0.6;
    flicker.connect(flickerDepth).connect(shimmerAmp.gain);
    flicker.start();
    shimmer.connect(shimmerFilter).connect(shimmerAmp).connect(shimmerGain);
    shimmerGain.connect(master);
    shimmerGain.connect(reverbIn);

    // The servo: a buzzing saw through a narrow, moving band - the machine.
    const servo = ctx.createOscillator();
    servo.type = 'sawtooth';
    servo.frequency.value = 70;
    const servoWobble = ctx.createOscillator();
    servoWobble.frequency.value = 11;
    const servoWobbleDepth = ctx.createGain();
    servoWobbleDepth.gain.value = 6;
    servoWobble.connect(servoWobbleDepth).connect(servo.frequency);
    const servoFilter = ctx.createBiquadFilter();
    servoFilter.type = 'bandpass';
    servoFilter.Q.value = 9;
    servoFilter.frequency.value = 600;
    const servoGain = ctx.createGain();
    servoGain.gain.value = 0;
    const servoPan = ctx.createStereoPanner();
    servo.connect(servoFilter).connect(servoGain).connect(servoPan).connect(master);
    servoPan.connect(reverbIn);
    servo.start();
    servoWobble.start();

    // The last point's sweep: two saws, a resonant lowpass opening.
    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    sweepFilter.Q.value = 12;
    sweepFilter.frequency.value = 300;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 0;
    const sweepPan = ctx.createStereoPanner();
    const sweepOscs = [-12, 12].map((detune) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.value = 110;
      osc.connect(sweepFilter);
      osc.start();
      return osc;
    });
    sweepFilter.connect(sweepGain).connect(sweepPan).connect(master);
    sweepPan.connect(reverbIn);

    // The edges' ratchet: clicks from a pulse train, speeding up.
    const ratchet = ctx.createOscillator();
    ratchet.type = 'square';
    ratchet.frequency.value = 12;
    const ratchetShape = ctx.createWaveShaper();
    ratchetShape.curve = pulseCurve();
    const ratchetFilter = ctx.createBiquadFilter();
    ratchetFilter.type = 'highpass';
    ratchetFilter.frequency.value = 2400;
    const ratchetGain = ctx.createGain();
    ratchetGain.gain.value = 0;
    ratchet.connect(ratchetShape).connect(ratchetFilter).connect(ratchetGain);
    ratchetGain.connect(comb);
    ratchetGain.connect(master);
    ratchet.start();

    // The faces: a cold, glassy chord (sines and a soft square) opening up.
    const chordFilter = ctx.createBiquadFilter();
    chordFilter.type = 'lowpass';
    chordFilter.frequency.value = 400;
    const chordGain = ctx.createGain();
    chordGain.gain.value = 0;
    chordFilter.connect(chordGain);
    chordGain.connect(master);
    chordGain.connect(reverbIn);
    for (const [frequency, type, level] of [[110, 'square', 0.12], [164.8, 'sine', 0.3], [246.9, 'sine', 0.22], [329.6, 'sine', 0.16], [493.9, 'sine', 0.1], [740, 'sine', 0.05]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(chordFilter);
      osc.start();
    }

    v = {
      master, reverbIn, comb, noise,
      drone, droneFilter, shimmerGain, shimmerFilter,
      servo, servoFilter, servoGain, servoPan,
      sweepOscs, sweepFilter, sweepGain, sweepPan,
      ratchet, ratchetGain, chordFilter, chordGain,
    };
  }

  // --- Single sounds ---------------------------------------------------------

  const now = () => ctx.currentTime;

  // A glass tick: bright inharmonic partials, a fast decay.
  function glass(frequency, level, pan = 0, decay = 0.35, when = 0) {
    const t0 = now() + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(level, t0 + 0.002);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(v.master);
    panner.connect(v.reverbIn);
    for (const [ratio, gain] of [[1, 1], [2.32, 0.55], [4.25, 0.3], [6.8, 0.14]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = frequency * ratio;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }

  // A metal click: a few milliseconds of noise into the resonator.
  function click(level, tone = 1, when = 0) {
    const t0 = now() + when;
    const source = ctx.createBufferSource();
    source.buffer = v.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200 * tone;
    filter.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
    source.connect(filter).connect(g);
    g.connect(v.comb);
    g.connect(v.master);
    source.start(t0, Math.random() * 2);
    source.stop(t0 + 0.03);
  }

  // A low thunk: a panel locking.
  function thunk(level, frequency = 120, when = 0) {
    const t0 = now() + when;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(frequency * 1.6, t0);
    osc.frequency.exponentialRampToValueAtTime(frequency, t0 + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(g).connect(v.master);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  // A data blip: a short square, quantized pitch.
  function blip(level, pan) {
    const t0 = now();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1200 * Math.pow(2, Math.floor(Math.random() * 8) / 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t0);
    g.gain.setValueAtTime(0, t0 + 0.025);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    osc.connect(g).connect(panner).connect(v.master);
    osc.start(t0);
    osc.stop(t0 + 0.04);
  }

  // Noise through a band sweeping between two frequencies; reversed: the
  // gain swells in instead of dying away.
  function whoosh(from, to, length, level, reversed = false, when = 0) {
    const t0 = now() + when;
    const source = ctx.createBufferSource();
    source.buffer = v.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + length);
    const g = ctx.createGain();
    if (reversed) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + length);
      g.gain.linearRampToValueAtTime(0, t0 + length + 0.03);
    } else {
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(level, t0 + length * 0.3);
      g.gain.linearRampToValueAtTime(0, t0 + length);
    }
    source.connect(filter).connect(g);
    g.connect(v.master);
    g.connect(v.reverbIn);
    source.start(t0);
    source.stop(t0 + length + 0.1);
  }

  // The blast: detuned low saws, overdriven, a lowpass opening and closing.
  function blast(level, root = 55, length = 2.6) {
    const t0 = now();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(180, t0);
    filter.frequency.exponentialRampToValueAtTime(1600, t0 + 0.12);
    filter.frequency.exponentialRampToValueAtTime(220, t0 + length);
    const drive = ctx.createWaveShaper();
    drive.curve = driveCurve(3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    filter.connect(drive).connect(g);
    g.connect(v.master);
    g.connect(v.reverbIn);
    for (const [ratio, detune] of [[1, -10], [1, 10], [1.5, 0], [2, 6]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = root * ratio;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t0);
      osc.stop(t0 + length + 0.1);
    }
    // The sub drop under it.
    const sub = ctx.createOscillator();
    sub.frequency.setValueAtTime(80, t0);
    sub.frequency.exponentialRampToValueAtTime(32, t0 + 0.9);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, t0);
    subGain.gain.linearRampToValueAtTime(level * 1.4, t0 + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    sub.connect(subGain).connect(v.master);
    sub.start(t0);
    sub.stop(t0 + 1.7);
  }

  // A rising UI sweep: an FM blip.
  function fwip(level, pan = 0) {
    const t0 = now();
    const carrier = ctx.createOscillator();
    carrier.frequency.setValueAtTime(420, t0);
    carrier.frequency.exponentialRampToValueAtTime(1700, t0 + 0.14);
    const modulator = ctx.createOscillator();
    modulator.frequency.value = 230;
    const depth = ctx.createGain();
    depth.gain.value = 260;
    modulator.connect(depth).connect(carrier.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    carrier.connect(g).connect(panner);
    panner.connect(v.master);
    panner.connect(v.reverbIn);
    carrier.start(t0); modulator.start(t0);
    carrier.stop(t0 + 0.25); modulator.stop(t0 + 0.25);
  }

  // --- Following the intro ----------------------------------------------------

  const smooth = (param, value, time = 0.12) => param.setTargetAtTime(value, ctx.currentTime, time);
  const bump = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
  const running = () => enabled && v && ctx.state === 'running';
  // Once per pass: crossing `threshold` forwards.
  const crossed = (key, value, previous, threshold) => value >= threshold && previous < threshold && !fired.has(key) && (fired.add(key), true);

  // state: { dt, forward, fade, progress, arrivedRate, flight, pan, landed,
  //          vertices, edges, faces, glowOut, exit }
  function update(state) {
    if (!running()) {
      last = state;
      return;
    }
    const { dt, forward } = state;
    const prev = last || state;
    // Back before an event (rewound, jumped): it may fire again.
    if (state.flight < prev.flight || state.faces < prev.faces) fired.clear();

    // The drone and the shimmer: the cloud's, quieter once the model stands.
    const calm = 1 - state.glowOut * 0.5;
    smooth(v.drone.gain, state.fade * 0.11 * calm * (1 - state.exit), 0.5);
    smooth(v.droneFilter.frequency, 160 + state.progress * 260 + state.faces * 500, 0.6);
    smooth(v.shimmerGain.gain, state.fade * (0.05 + (1 - state.progress) * 0.05) * calm * (1 - state.exit), 0.4);

    // Points arriving: shards clicking into place over the servo's whir.
    const pace = Math.min(1, state.arrivedRate * 2.4);
    smooth(v.servoGain.gain, (pace * 0.05 + bump(state.edges) * 0.035) * (1 - state.exit), 0.15);
    smooth(v.servo.frequency, 55 + state.progress * 70 + state.edges * 90, 0.2);
    smooth(v.servoFilter.frequency, 400 + pace * 1400 + state.edges * 2200, 0.15);
    smooth(v.servoPan.pan, Math.sin(performance.now() / 900) * 0.5, 0.3);
    if (forward && state.arrivedRate > 0) {
      const perSecond = Math.min(22, state.arrivedRate * 60);
      if (Math.random() < perSecond * dt) {
        const pan = Math.random() * 1.8 - 0.9;
        click(0.12 + Math.random() * 0.1, 0.8 + Math.random() * 0.8);
        glass(1800 + Math.random() * 3800 * (0.5 + state.progress), 0.02 + Math.random() * 0.02, pan, 0.18 + Math.random() * 0.3);
      }
    }

    // The last point: the transforming sweep, pings coming faster.
    const flying = state.flight > 0 && !state.landed;
    smooth(v.sweepGain.gain, flying ? 0.05 * Math.min(1, state.flight * 4) * (1 - state.exit) : 0, flying ? 0.2 : 0.05);
    const pitch = 90 * Math.pow(2, state.flight * 2.2);
    for (const osc of v.sweepOscs) smooth(osc.frequency, pitch, 0.15);
    smooth(v.sweepFilter.frequency, 300 + state.flight * state.flight * 4200, 0.15);
    smooth(v.sweepPan.pan, Math.max(-0.9, Math.min(0.9, state.pan)), 0.1);
    if (forward && flying) {
      [0.18, 0.36, 0.5, 0.62, 0.72, 0.8, 0.86, 0.91, 0.95, 0.98].forEach((at, i) => {
        if (crossed(`ping${i}`, state.flight, prev.flight, at)) glass(1400 * Math.pow(2, i / 6), 0.04, state.pan, 0.5);
      });
      // The reversed swell, drawn in just before the landing.
      if (crossed('swell', state.flight, prev.flight, 0.86)) whoosh(500, 6000, 0.5, 0.12, true);
    }
    if (forward && state.landed && !prev.landed) {
      blast(0.2);
      glass(2637, 0.07, 0, 2.2);
      glass(3951, 0.04, 0.3, 1.8, 0.02);
      click(0.4, 1.4);
      click(0.3, 0.9, 0.05);
    }

    // Vertices: data blips.
    if (forward && state.vertices > prev.vertices && state.vertices < 1) {
      const perSecond = Math.min(24, ((state.vertices - prev.vertices) / Math.max(dt, 1e-3)) * 50);
      if (Math.random() < perSecond * dt) blip(0.012 + Math.random() * 0.01, Math.random() * 1.8 - 0.9);
    }

    // Edges: the ratchet, speeding up while they are drawn.
    smooth(v.ratchetGain.gain, 0.07 * bump(state.edges) * (1 - state.exit), 0.1);
    smooth(v.ratchet.frequency, 10 + state.edges * 34, 0.1);

    // Faces: panels locking, a cold chord opening; a last lock.
    smooth(v.chordGain.gain, Math.min(1, state.faces * 1.5) * (1 - state.glowOut * 0.7) * 0.06 * (1 - state.exit), 0.4);
    smooth(v.chordFilter.frequency, 300 + state.faces * 3200 - state.glowOut * 2000, 0.4);
    if (forward && state.faces > prev.faces && state.faces < 1) {
      const perSecond = Math.min(14, ((state.faces - prev.faces) / Math.max(dt, 1e-3)) * 40);
      if (Math.random() < perSecond * dt) {
        thunk(0.09, 90 + Math.random() * 60);
        glass(2200 + Math.random() * 2400, 0.018, Math.random() * 1.6 - 0.8, 0.25, 0.01);
      }
    }
    if (forward && crossed('locked', state.faces, prev.faces, 1)) {
      thunk(0.16, 70);
      thunk(0.12, 95, 0.12);
      glass(1760, 0.05, -0.2, 2.4, 0.12);
      glass(2637, 0.035, 0.2, 2.2, 0.14);
    }
    last = state;
  }

  async function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
      v.master.gain.cancelScheduledValues(ctx.currentTime);
      v.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    } else if (ctx) {
      v.master.gain.cancelScheduledValues(ctx.currentTime);
      v.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
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
    // The feature tour (feature-tour.js): a rising sweep and a ping for a new
    // chapter, a glass tick for a step within one.
    cue(kind) {
      if (!running()) return;
      if (kind === 'chapter') {
        fwip(0.05);
        glass(2093, 0.04, 0, 0.9, 0.08);
        click(0.15, 1.2, 0.08);
      } else {
        glass(2400 + Math.random() * 1600, 0.03, Math.random() * 1.2 - 0.6, 0.4);
        click(0.08, 1.5);
      }
    },
    rewind() {
      if (!running()) return;
      fired.clear();
      whoosh(5000, 220, 2.4, 0.1, true);
      fwip(0.03, -0.4);
    },
    // Into the viewer: a rising whoosh into a last blast, then quiet.
    enter(length) {
      if (!running()) return;
      whoosh(200, 5200, length * 0.7, 0.12, true);
      setTimeout(() => { if (running()) blast(0.16, 41.2, 2); }, length * 700);
      v.master.gain.setTargetAtTime(0, ctx.currentTime + length * 0.9, length * 0.4);
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

// Soft overdrive.
function driveCurve(amount) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

// A square wave's edges only: short clicks.
function pulseCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = x > 0.98 ? 1 : x < -0.98 ? -1 : 0;
  }
  return curve;
}
