# Audio files

Sound in the viewer, three ways, and the room it is heard in:

- [an audio file opened on its own](#audio-files-on-their-own), played and
  drawn as a spectrogram landscape;
- [sound in a model's scene](#sound-in-the-scene): ambient, point and spot
  sources heard from where the camera is;
- [narration on annotations](#narration-on-annotations), told by the
  guided tour, with captions;
- [room acoustics](#room-acoustics): the scene's sounds heard with the
  reverberation of the reconstructed room, worked out from its geometry.

## Audio files on their own

The viewer opens sound files the way it opens models: dropped on it, from
the upload panel, by URL or from the example list. A sound is played and
shown at once, in a panel and as a landscape in the 3D scene.

Formats: WAV and Broadcast Wave (`.wav`, `.wave`, `.bwf`), MP3, FLAC, Ogg
Vorbis and Opus (`.ogg`, `.oga`, `.opus`), M4A / AAC and WebM audio
(`.weba`). The browser decodes them itself (Safari also plays AIFF, but
other browsers do not, so it is not offered). The worker keeps them as
uploaded, like the other formats the viewer reads directly. No GLB and no
thumbnails are made.

Example: *Soundscape (audio)* in the example list,
`viewer/examples/audio/soundscape.wav` and `.ogg`. It is synthesised by
`scripts/generate-audio-samples.py` (a bell, a bird call, a chord, wind), so
it can be shared freely. It has tags and four markers.

### What is shown

**The scene** (`viewer/audio.js`) is 12 units wide, whatever the duration:

- the **spectrogram as a landscape**: time runs left to right, frequency
  front to back (low at the back, logarithmic or linear), and the level sets
  both height and colour (the *inferno* colour map, from dark violet to pale
  yellow). Only the levels down to `range` dB below the loudest are shown.
- the **waveform** lies flat in front of it, orange where already played;
- the **playhead**, a pane across both at the current time;
- labels: times along the front, frequencies at the left.

The camera starts higher above it than above a building (the model's
`userData.viewDirection`, used by `fitCameraToCenteredObject`).

**The panel** (`viewer/editor/audio-panel.js`, the toolbar's audio button)
has these parts:

- play / pause (also <kbd>Space</kbd> in the panel), stop, repeat, the time;
- the waveform of the whole file: a click jumps there, and a drag selects a
  part, which then plays alone (and loops with *Repeat*). With the waveform
  focused, <kbd>←</kbd> <kbd>→</kbd> step 2 s, or 10 s with
  <kbd>Shift</kbd>;
- the file's **markers**: WAV cue points with their labels, ID3 `CHAP`
  chapters, Vorbis `CHAPTERxxx` comments. A click jumps to a marker;
- a view of the sound: the **spectrogram** (a click jumps), or, while it
  plays, the **spectrum** or the **oscilloscope** live;
- **playback**: speed ×0.25–×2, with or without keeping the pitch; volume;
  channels (as recorded, mixed to mono, left or right only);
- **effects**: a filter (low-pass, high-pass, band-pass, notch) and its
  frequency, an even loudness (a compressor), a reverberation (room, hall,
  church) and how much of it;
- the **3D view**: the frequency axis, the levels shown, the height, and
  whether the landscape and the waveform are shown;
- what the file is: its tags (title, artist, album, date, genre,
  description, comment, originator, copyright), format and codec, duration,
  sample rate, channels, bit depth, bit rate, size, and the peak and average
  (RMS) level, with the clipped samples, if any.

On phones it starts minimised to its icon and opens as a modal window, like
the volume and point cloud settings.

### How it works

1. The file is read whole: from the `File` when dropped, else downloaded
   (the tags and cue points of a WAV may come after its samples).
2. `viewer/audio-metadata.js` reads the header: the WAV `fmt`, `LIST INFO`,
   `bext`, `cue ` and `LIST adtl` chunks; FLAC `STREAMINFO` and Vorbis
   comments; ID3v2.3/2.4 text, `TXXX`, `COMM` and `CHAP` frames and the
   first MPEG frame; the Ogg identification and comment headers (Vorbis,
   Opus).
3. The browser decodes the file (`decodeAudioData`) at its own sample rate.
   `viewer/audio-analysis.js` then works out, in a Web Worker
   (`audio-analysis-worker.js`, or on the main thread without one):
   - the waveform: per channel, the lowest and highest sample of 4096
     stretches;
   - the spectrogram: up to 2048 moments × (FFT size / 2) frequencies. The
     FFT size is about 43 ms (1024 at 22.05 kHz, 2048 at 48 kHz), with Hann
     windows and the mean power of up to 4 frames around each moment. It is
     in dB below full scale (a full-scale sine is 0 dB), in half-dB steps.
     A long file is sampled rather than read whole: an hour costs about what
     a few minutes do (10 minutes at 48 kHz take about 1.5 s);
   - the peak and RMS level and the clipped samples.

   The decoded samples are dropped then. A file larger than 400 MB is not
   decoded: it is played only, on a plain track.
4. Playing streams the file from a `blob:` URL through an `<audio>` element
   into Web Audio (`AudioPlayer`). The chain is: channels → filter →
   compressor → dry + convolver (reverberation) → volume → analyser (the
   live views) → speakers. The audio context starts with the first play,
   because browsers allow sound only after a click. The nodes are only
   reconnected when the chain itself changes (a filter switched on, another
   reverberation), not when a value changes, so a slider never clicks.
5. The reverberation is generated, not recorded: stereo noise dying away
   by 60 dB over the room's reverberation time (0.7 s room, 2.4 s hall, 5 s
   church), a little later on the right.

The settings of the scene are kept on the root
(`root.userData.audio`: `frequencyScale`, `range`, `heightScale`,
`showTerrain`, `showWaveform`). They are JSON, like all `userData`. The
player, the analysis and the meshes are kept by `audio.js`, which also
releases the player and the `blob:` URL when the model goes
(`disposeAudio`).

The model kind is `audio` (`model-kind.js`). Its toolbar profile brings the
player, the cameras and the projection to the top and leaves out what only
surfaces need (shading, wireframe, materials, weather, seasons, ground,
scene suggestions, section planes, raking light, sun study, up axis).

### In a manifest

A manifest's scene can show an audio file: its painting annotation's body
is a `Sound` (`{ "id": ".../soundscape.wav", "type": "Sound", "format":
"audio/wav" }`). `AIM3DViewer.audio` keeps the 3D view's settings and the
playback's that are not the defaults, e.g. `{ "range": 70, "playback": {
"loop": true, "region": { "start": 2.9, "end": 4.6 }, "reverb": "church" } }`
([AIM3DViewer-schema.md](../viewer/manifesto/AIM3DViewer-schema.md)).

The example manifests are under *Sounds* in the list of manifests:

- the bird call in a loop, in a church's reverberation;
- the soundscape on a linear frequency axis, through a low-pass filter;
- the Tempietto with sounds in the scene and a narrated tour (below).

The two soundscape manifests are written by
`scripts/build-media-manifests.py`.

## Sound in the scene

A model's scene can have sound sources (`viewer/editor/scene-sounds.js`),
heard from where the camera is. Each source plays a sound file in a loop
(or once) at its own volume. There are three kinds, as IIIF Presentation 4
paints them into a Scene:

- **ambient**: heard everywhere at the same level (wind, a room's hum);
- **point**: heard from a point, at full volume up to its *distance*, then
  half as loud with each doubling of it (Web Audio's inverse distance
  model). Used for a fountain or a bell;
- **spot**: heard from a point towards where it aims. It is at full volume
  inside half of its cone and at 15% outside it. Used for a voice or a
  doorway.

A source can be tied to years of the 4D timeline (`years: [from, to]`).
It is then heard only while the timeline shows a year between them, and
fades in and out (0.6 s). Example: the works on a building site, heard only
while it was being built.

**The Sounds window** is at *Look > Sounds*, or on the classic toolbar. It
has these parts:

- play and stop all sources, and their volume; whether they play when the
  scene opens;
- the list of sources: each can be switched on or off, chosen or removed;
- the chosen source: name, kind, volume, full-volume distance, cone, repeat,
  years (with a 4D timeline). *Place with a click* puts it on the model
  where it is clicked, a little off the surface. A spot source also has
  *Aim with a click*;
- *add* a source by URL, or from a file (that one lasts for this session
  only: a file has no URL to save).

While the window is open, point and spot sources show as speaker icons that
stay the same size on screen. The chosen one is gold, with a sphere where it
is at full volume, and a dashed line for a spot source's aim.

Browsers allow sound only after a click. The sources play from the window's
button. With `autoplay` they start at the first click or key press in the
page. The listener follows the camera every frame. Under a narration the
sources play at 35% of their volume.

**In the manifest** they are kept twice. `AIM3DViewer.sounds` holds what
only this viewer reads (see
[AIM3DViewer-schema.md](../viewer/manifesto/AIM3DViewer-schema.md)). The
same sources are also painted into the scene as IIIF `AmbientAudio`,
`PointAudio` and `SpotAudio` annotations, with:

- `source`: the `Audio` file;
- `volume`: a `Quantity`, `relative`;
- `SpotAudio`'s `lookAt` and `angle`;
- `timeMode`: `loop` or `trim`.

Other viewers hear them that way. A manifest that has only those emitters
is read from them.

*Use these settings with another model* keeps the ambient sources and
drops the placed ones, because their coordinates belong to the old model.

## Narration on annotations

An annotation can have a narration (`viewer/editor/narration.js`): a voice
telling about the place, an interview, or a recording made there. Its
captions are an optional WebVTT file. Both are set in the annotation
dialog, with a button to listen.

- **The guided tour** tells the narration once the camera has arrived.
  While the tour plays, it goes on 1.5 s after the narration has been told,
  instead of after the step's duration. Pausing the tour pauses the
  narration. The speaker button in the tour panel leaves the narrations
  out. A narration that could not start (no click yet) is told when the
  tour's play button is pressed.
- **Captions** are shown over the bottom of the scene, one cue at a time,
  for those who cannot hear the narration or have the sound off.
- **In the manifest** the narration is the annotation's
  `AIM3DViewer.audio` (`{ "src", "captions" }`). For other viewers it is
  also a `Sound` body next to the annotation's text, and such a body is
  read back as its narration.

**Example**: *Tempietto - sounds in the scene, a narrated tour* in the list
of example manifests (`tempietto-aim3d-sound.json`). It has three sources:

- wind and birds everywhere;
- a bell on the roof (a point source);
- a hum from the cella, aimed out of the door (a spot source).

Three of the tour's annotations are told by a synthetic voice, with
captions. Everything is generated by
`scripts/generate-scene-sound-samples.py` (numpy, ffmpeg with libvorbis and
flite), so it can be shared freely.

## Room acoustics

How would a sound have been heard in the reconstructed building? The
Sounds window can work the room's reverberation out from the model's
geometry and play the scene's sounds through it (auralization):
`viewer/editor/scene-acoustics.js`, with the computation in
`viewer/room-acoustics.js`, run in a Web Worker
(`room-acoustics-worker.js`).

**In the window**, under *Room acoustics*:

- *Hear the sounds in the room* switches it on;
- *Walls*: what the surfaces are made of when their material's name does
  not say (stone, plaster, brick, wood, glass, fabric, ground). A name does
  say for these words, in English, Polish or German: *wood, oak, plank,
  drewno, Holz...* is wood, *glass, okno, Fenster...* glass, *stone,
  marble, concrete, kamień, Stein...* stone, and so on. *Wall* or
  *ceiling* says where, not what, so it does not count;
- *Floors*: as their material, empty benches or pews, or benches with
  people. People absorb much of the sound: a full church is drier than an
  empty one;
- *Reverberation* 0–200%: louder or quieter than worked out;
- *Work out here*: at the camera. Bring the camera into the building
  first (a section plane helps to see where it is). The sounds work
  it out by themselves when they play and it is on, at the point saved, or
  at the camera.

Each source has *In the room's acoustics*. By default point and spot
sources are, ambient ones are not (wind is outside).

The result is shown under the buttons: the reverberation time of the
middle bands (500 Hz and 1 kHz), the space seen from the listening point,
how much of it is open (to the sky, through doors and empty windows), the
clarity C80, and the distance at which the room is as loud as a source.
Then the reverberation time of each octave band, 125 Hz to 4 kHz. A gold
ring marks the listening point while the window is open.

### How it is worked out

1. The visible meshes of the model are gathered as triangles in world
   coordinates, each with its material's absorption per octave band (the
   usual tabulated values). Section planes do not count: the room is
   whole. A model of more than 3 million triangles is not traced.
2. They go into a bounding volume hierarchy, so that a ray finds its
   wall quickly.
3. 3000 rays leave the listening point in all directions. At each wall a
   ray loses the material's absorption, in each band, and the air takes its
   part on the way (more of the high bands). It goes on mirrored, or (40%)
   scattered in any direction off the wall. A ray that leaves the model is
   lost: an open door, a window without glass, a ruin without a roof absorb
   everything. A ray ends 45 dB down, after 10 s, or after 400 walls. The
   worker traces fewer rays rather than take more than 20 s.
4. From each wall, the share sent back to the listening point, if the
   point can be seen from there ("diffuse rain"), arrives later by the
   length of its path: an energy histogram in 2 ms steps, per band.
5. The reverberation time of each band comes from the histogram's decay
   (Schroeder's backward integration, a line from -5 to -25 dB, times
   three). When the decay is too short to fit, from Eyring's formula, with
   the mean free path and the mean absorption the rays met. It is kept
   between 0.05 and 12 s.
6. The listening point is also where the sound starts. The floor under it
   would send back far more than it does from a source across the room. So
   the early reflections (up to 80 ms) are held to three times the late
   decay carried back to their time. And how loud the reverberation is
   comes from the diffuse field: a room of volume V and reverberation time
   T absorbs like A = 0.161 V / T m², and is as loud as a source's direct
   sound at the critical distance √(A / 16π).
7. The impulse response is noise in each band, shaped by the early
   histogram and then by the band's exponential decay. It is stereo, with
   a different noise in each ear, and its energy is 1. It goes into one
   `ConvolverNode` (not normalised).
8. Each source sends its sound to the convolver before its panner, so the
   reverberation does not fade with the distance as the direct sound does.
   A source at full volume up to *d* sends *d* / critical distance (at
   most 4), times *Reverberation*. An ambient one in the room sends 1.

Lengths go into seconds through the model's unit (the measurement panel's,
or the manifest's `spatialScale`). A model with no unit whose size is
implausible in meters is taken in the unit its size suggests, and the
window says so: the Wołpa synagogue's file is in centimeters.

It is a sketch of the room's sound, not a measurement:

- the room is heard as at the listening point, wherever the camera goes,
  and the reverberation is the same from every source;
- no diffraction, and all walls scatter alike;
- the tabulated absorptions are of today's surfaces, and the guessed ones
  are guesses;
- what the 4D timeline hides does not count: work it out again at another
  year.

**Example**: *Wolpa Synagogue - the prayer hall heard: room acoustics from
the model* in the list of example manifests, under *Sounds*
(`wolpa-synagogue-aim3d-local-acoustics.json`). A synthetic horn call is
played in the middle of the prayer hall and heard a few meters away, with
wooden walls and benches on the floor (about 2 s of reverberation). The
call and the manifest are made by `scripts/generate-acoustics-sample.py`.

## Next

- The waveform and spectrogram worked out once by the worker, for files too
  large for the browser, and AIFF / RF64 converted there.
- Room acoustics: the listening point following the camera (worked out
  again when it moves into another room), and the reverberation of each
  source from where it is (two-point tracing).
