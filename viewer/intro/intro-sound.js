// The intro's sound (viewer/intro/intro.js), made on the fly with the Web
// Audio API - no audio files. Warm and calm rather than futuristic: a small
// ensemble in a hall, in D minor.
//
// - the music under it all: a slow string pad (Dm - B flat - F - C, a bar of
//   four seconds each), a soft bass, and a harp picking the chord's notes -
//   sparse while the cloud drifts, flowing once the building stands;
// - points arriving: harp notes of the chord, more of them as they come;
// - the last point: the strings swell and open, harp notes climb the scale
//   ever faster, a breath is drawn in; the landing is a deep, soft drum, a
//   bell and the full chord;
// - the model: high harp notes for the vertices, a quick ripple for the
//   edges, soft wooden knocks as the faces form, a bell when it stands;
// - the feature tour: a small bell for each chapter, a harp note between its
//   steps, a chord of bells when it is over;
// - "Assemble again": a breath drawn back; "Enter the viewer": the strings
//   swell into a last chord.
//
// Browsers let sound start only after a click or key press, so the page
// calls setEnabled(true) from one. update() runs every frame with where the
// intro is; the music follows it, the single sounds only play while it runs
// forward.

// Seconds per chord.
const BAR = 4;
// MIDI notes: the pad's voicing (in the middle, where a phone's speaker
// plays it), the bass (a cello's range, not a sub), the harp's notes.
const CHORDS = [
  { pad: [57, 62, 65, 69, 74], bass: 50, harp: [62, 65, 69, 74, 77, 81] }, // D minor
  { pad: [58, 62, 65, 70, 74], bass: 46, harp: [62, 65, 70, 74, 77, 82] }, // B flat
  { pad: [57, 60, 65, 69, 72], bass: 53, harp: [60, 65, 69, 72, 77, 81] }, // F
  { pad: [55, 60, 64, 67, 72], bass: 48, harp: [60, 64, 67, 72, 76, 79] }, // C
];
// D natural minor, for the climbing notes.
const SCALE = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export function createIntroSound() {
  let ctx = null;
  let enabled = false;
  let v = null; // the shared nodes
  let last = null; // the previous frame's state
  const fired = new Set(); // one-off events of the current pass
  // The music's clock and how present it is now (from update()).
  let nextBar = 0;
  let barIndex = 0;
  let scheduler = 0;
  const level = { music: 0, harp: 0.35, swell: 0, exit: 0 };

  function build() {
    // A larger buffer than the default (made for live playing): a phone
    // busy drawing the building would otherwise miss it now and then - a
    // crackle. The intro does not need the low latency.
    const Context = window.AudioContext || window.webkitAudioContext;
    try {
      ctx = new Context({ latencyHint: 'playback' });
    } catch {
      ctx = new Context();
    }
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    // Nothing under 80 Hz: a rumble a small speaker cannot play, that
    // would only push the compressor.
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 80;
    master.connect(lowCut).connect(compressor).connect(ctx.destination);

    // A warm hall: a dark reverb (short enough for a phone to keep up).
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.2, 2.4);
    const reverbTone = ctx.createBiquadFilter();
    reverbTone.type = 'lowpass';
    reverbTone.frequency.value = 3800;
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 0.55;
    reverbIn.connect(reverb).connect(reverbTone).connect(master);

    // The strings: every chord's voices through one lowpass that opens as
    // the music swells.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 1400;
    padFilter.Q.value = 0.7;
    const pad = ctx.createGain();
    pad.gain.value = 0;
    padFilter.connect(pad);
    pad.connect(master);
    pad.connect(reverbIn);
    const noise = noiseBuffer(ctx, 3);
    v = { master, reverbIn, padFilter, pad, noise };
  }

  const now = () => ctx.currentTime;
  const running = () => enabled && v && ctx.state === 'running';

  // --- Voices -----------------------------------------------------------------

  // A string chord: two detuned saws a note, a slow swell in and out.
  function strings(chord, t0, length, gain) {
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 1.3);
    out.gain.setValueAtTime(gain, t0 + length - 0.2);
    out.gain.linearRampToValueAtTime(0, t0 + length + 1.6);
    out.connect(v.padFilter);
    // Each note a soft triangle; the middle note also a quieter saw a little
    // apart (an ensemble's width, few voices for a phone to play); the
    // outer voices quieter than the middle.
    const middle = Math.floor(chord.pad.length / 2);
    chord.pad.forEach((note, index) => {
      const voices = index === middle ? [['triangle', -5, 1], ['sawtooth', 6, 0.45]] : [['triangle', index % 2 ? 4 : -4, 1]];
      for (const [type, detune, level_] of voices) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = hz(note);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.06 * level_ * (index === 0 || index === chord.pad.length - 1 ? 0.7 : 1);
        osc.connect(g).connect(out);
        osc.start(t0);
        osc.stop(t0 + length + 1.8);
      }
    });
  }

  // The bass: a soft, round low note.
  function bass(note, t0, length, gain) {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz(note);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = hz(note) * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.4);
    g.gain.setTargetAtTime(gain * 0.6, t0 + 0.5, 1.2);
    g.gain.linearRampToValueAtTime(0, t0 + length + 0.6);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc.connect(g);
    osc2.connect(g2).connect(g);
    g.connect(v.master);
    osc.start(t0); osc2.start(t0);
    osc.stop(t0 + length + 0.7); osc2.stop(t0 + length + 0.7);
  }

  // A harp note: a few harmonics plucked, a quick bright start dying away.
  function harp(note, gain, pan = 0, when = 0, decay = 1.6) {
    const t0 = Math.max(now(), when || now());
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(v.master);
    panner.connect(v.reverbIn);
    // Two voices: the note (a triangle, soft) and its octave fading sooner.
    for (const [ratio, g] of [[1, 1], [2, 0.3]]) {
      const osc = ctx.createOscillator();
      osc.type = ratio === 1 ? 'triangle' : 'sine';
      osc.frequency.value = hz(note) * ratio;
      const level_ = ctx.createGain();
      level_.gain.value = g;
      osc.connect(level_).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }

  // A small bell: its partials (a church bell's ratios), a long decay.
  function bell(note, gain, pan = 0, when = 0, decay = 3.2) {
    const t0 = now() + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(v.master);
    panner.connect(v.reverbIn);
    for (const [ratio, g, d] of [[0.5, 0.35, 1], [1, 1, 1], [1.19, 0.3, 0.7], [2, 0.2, 0.5]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz(note) * ratio;
      const level_ = ctx.createGain();
      level_.gain.setValueAtTime(g, t0);
      level_.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * d);
      osc.connect(level_).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }

  // A soft wooden knock, or (low and long) a drum.
  function knock(gain, frequency = 180, decay = 0.18, when = 0) {
    const t0 = now() + when;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(frequency * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(frequency, t0 + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(g);
    g.connect(v.master);
    g.connect(v.reverbIn);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }

  // A breath: soft, low noise rising (drawn in) or falling.
  function breath(from, to, length, gain, reversed = false, when = 0) {
    const t0 = now() + when;
    const source = ctx.createBufferSource();
    source.buffer = v.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + length);
    const g = ctx.createGain();
    if (reversed) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + length);
      g.gain.linearRampToValueAtTime(0, t0 + length + 0.15);
    } else {
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + length * 0.3);
      g.gain.linearRampToValueAtTime(0, t0 + length);
    }
    source.connect(filter).connect(g);
    g.connect(v.master);
    g.connect(v.reverbIn);
    source.start(t0, Math.random() * 1.5);
    source.stop(t0 + length + 0.3);
  }

  // --- The music --------------------------------------------------------------

  const chordNow = () => CHORDS[((barIndex - 1) % CHORDS.length + CHORDS.length) % CHORDS.length];
  const randomNote = (notes) => notes[Math.floor(Math.random() * notes.length)];

  // Bars are scheduled ahead (a second and a half: a page busy loading the
  // model leaves no gap): the strings, the bass and the harp's pattern, as
  // present as the intro asks for at that moment.
  function schedule() {
    if (!running()) return;
    while (nextBar < now() + 1.5) {
      const chord = CHORDS[barIndex % CHORDS.length];
      const music = level.music * (1 - level.exit);
      if (music > 0.01) {
        strings(chord, nextBar, BAR, 0.5 * music);
        bass(chord.bass, nextBar, BAR, 0.05 * music);
        // The harp: a rising figure, eighths once the building stands.
        const busy = level.harp > 0.6;
        const steps = busy ? 8 : 3;
        for (let i = 0; i < steps; i++) {
          const note = chord.harp[(busy ? [0, 2, 1, 3, 2, 4, 3, 5][i] : [0, 2, 4][i])];
          harp(note, (busy ? 0.06 : 0.05) * music, (i % 2 ? 0.3 : -0.3), nextBar + i * (BAR / steps), 2.2);
        }
      }
      nextBar += BAR;
      barIndex++;
    }
  }

  // --- Following the intro ----------------------------------------------------

  const smooth = (param, value, time = 0.12) => param.setTargetAtTime(value, ctx.currentTime, time);
  const bump = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
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
    if (state.flight < prev.flight || state.faces < prev.faces) fired.clear();

    // The music: in with the cloud, fuller once the building stands.
    level.music = state.fade;
    level.harp = state.landed ? 1 : 0.35;
    level.exit = state.exit;
    const flying = state.flight > 0 && !state.landed;
    level.swell = flying ? state.flight : Math.max(0, level.swell - dt * 0.8);
    smooth(v.pad.gain, (0.8 + level.swell * 0.7) * (1 - state.exit), 0.3);
    smooth(v.padFilter.frequency, 1300 + state.progress * 300 + level.swell * 1200 + state.faces * 300, 0.3);

    // Points arriving: harp notes of the chord, more as they come.
    if (forward && state.arrivedRate > 0) {
      const perSecond = Math.min(5, state.arrivedRate * 14);
      if (Math.random() < perSecond * dt) {
        harp(randomNote(chordNow().harp), 0.025 + Math.random() * 0.015, Math.random() * 1.6 - 0.8, 0, 1.2);
      }
    }

    // The last point: notes climbing the scale, faster as it nears.
    if (forward && flying) {
      [0.18, 0.36, 0.5, 0.62, 0.72, 0.8, 0.86, 0.91, 0.95, 0.98].forEach((at, i) => {
        if (crossed(`ping${i}`, state.flight, prev.flight, at)) harp(SCALE[i + 3], 0.05, state.pan, 0, 1.8);
      });
      if (crossed('swell', state.flight, prev.flight, 0.84)) breath(300, 2400, 0.6, 0.08, true);
    }
    if (forward && state.landed && !prev.landed) {
      knock(0.3, 92, 1.4);
      bell(74, 0.06, 0, 0, 4.5);
      for (const [i, note] of [50, 57, 62, 65, 69, 74].entries()) harp(note, 0.05, (i - 2.5) * 0.25, now() + i * 0.04, 3);
    }

    // Vertices: high harp notes now and then.
    if (forward && state.vertices > prev.vertices && state.vertices < 1) {
      const perSecond = Math.min(5, ((state.vertices - prev.vertices) / Math.max(dt, 1e-3)) * 12);
      if (Math.random() < perSecond * dt) harp(randomNote(chordNow().harp), 0.018, Math.random() * 1.8 - 0.9, 0, 1.2);
    }
    // Edges: a quick ripple of notes while they are drawn.
    if (forward && state.edges > 0 && state.edges < 1 && Math.random() < bump(state.edges) * 8 * dt) {
      harp(SCALE[Math.floor(state.edges * (SCALE.length - 1))], 0.025, Math.random() * 1.2 - 0.6, 0, 1.2);
    }
    // Faces: soft wooden knocks; a bell when it stands.
    if (forward && state.faces > prev.faces && state.faces < 1) {
      const perSecond = Math.min(5, ((state.faces - prev.faces) / Math.max(dt, 1e-3)) * 16);
      if (Math.random() < perSecond * dt) knock(0.05, 160 + Math.random() * 120);
    }
    if (forward && crossed('locked', state.faces, prev.faces, 1)) {
      knock(0.12, 90, 0.5);
      bell(74, 0.035, -0.2, 0.1);
    }
    last = state;
  }

  async function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
      // The music starts a moment from now, once update() has said how
      // present it is.
      if (nextBar < now()) nextBar = now() + 0.3;
      clearInterval(scheduler);
      scheduler = setInterval(schedule, 100);
      v.master.gain.cancelScheduledValues(ctx.currentTime);
      v.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    } else if (ctx) {
      clearInterval(scheduler);
      v.master.gain.cancelScheduledValues(ctx.currentTime);
      v.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { if (!enabled) ctx.suspend(); }, 800);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enabled) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume().then(() => { if (nextBar < now()) nextBar = now() + 0.1; });
  });

  return {
    get enabled() { return enabled; },
    setEnabled,
    update,
    // The feature tour (feature-tour.js): a small bell for a new chapter, a
    // harp note for a step within one, a chord of bells at the end.
    cue(kind) {
      if (!running()) return;
      const chord = chordNow();
      if (kind === 'end') {
        [62, 65, 69, 74].forEach((note, i) => bell(note, 0.03 - i * 0.004, (i - 1.5) * 0.3, i * 0.14, 4));
      } else if (kind === 'chapter') {
        bell(chord.harp[3], 0.03, 0, 0, 2.6);
        harp(chord.harp[0], 0.03, -0.2, now() + 0.06);
      } else {
        harp(randomNote(chord.harp), 0.03, Math.random() * 1.2 - 0.6);
      }
    },
    rewind() {
      if (!running()) return;
      fired.clear();
      breath(2400, 200, 2.4, 0.07, true);
    },
    // Into the viewer: the strings swell into a last chord, then quiet.
    enter(length) {
      if (!running()) return;
      breath(200, 1600, length * 0.7, 0.06, true);
      setTimeout(() => {
        if (!running()) return;
        knock(0.2, 92, 1.2);
        for (const [i, note] of [50, 57, 62, 65, 69, 74].entries()) harp(note, 0.045, (i - 2.5) * 0.25, now() + i * 0.05, 2.6);
      }, length * 700);
      v.master.gain.setTargetAtTime(0, ctx.currentTime + length * 0.9, length * 0.5);
      clearInterval(scheduler);
    },
  };
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
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
