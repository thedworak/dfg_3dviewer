# Intro page

`intro.html` (built to `<build>/intro.html`) is a promo/landing page for the
viewer, about 25 seconds long:

1. A chaotic cloud of 200 000 points drifts in the dark and, like atoms,
   gathers into the Wołpa Synagogue - foundations first, the roofs last.
2. The last point (199 999 / 200 000) takes its time: a glowing atom with a
   trail spirals in and lands on the top of the roof - a flash, a ring, and a
   wave of light running through the building.
3. The real model takes the points' place (`viewer/intro/mesh-reveal.js`):
   its vertices light up, its edges are drawn, its faces grow out of their
   centres glowing at the edges, and the textured building remains. The
   counter shows vertices and faces.

From the landing on, the "Enter the viewer" button leads into the viewer with
the synagogue loaded; everything flies apart on the way. The model is
`examples/WolpaSynagogue-progressive.glb` (Meshopt + KTX2, 6.7 MB), loaded
while the points gather - the file the viewer opens next, so it is cached by
then. If it cannot be loaded, the intro ends with the points.

- Sound (the button top right; `viewer/intro/intro-sound.js`): made on the fly with the Web Audio API, no audio files - a low drone, soft glassy plucks as the points arrive, a thin rising tone following the last point and a quiet bell at its landing, sparks for the vertices, a brushed sweep for the edges, a warm chord opening as the faces form. Off by default (`?sound=1` turns it on); browsers start it only with the first click or key press. The visitor's choice is remembered.
- Drag rotates the building; the mouse pushes points aside.
- "Assemble again" runs everything backwards into the cloud and gathers it again.
- "Skip intro" goes straight to the viewer.
- `prefers-reduced-motion`: the building is shown assembled, without the animation.
- No WebGL: the logo and the button only.

## In the viewer

With `viewer.intro.enabled` in `viewer-settings.json` (see [viewer-settings](viewer-settings.md)) the intro opens in front of the standalone viewer page, in a full-window layer (`viewer/intro-overlay.js`), while the viewer starts and loads its model underneath. "Enter the viewer" lets the points fly apart and fades the layer away; "Skip intro" and Escape close it at once. `?intro=1` / `?intro=0` in the page address show it or not, whatever the settings say.

## Parameters

| Parameter | Meaning |
|---|---|
| `next` | Where the button leads; a page of the same site only (default `./?model=./examples/WolpaSynagogue-progressive.glb`) |
| `lang` | `pl`, `en` or `de` (default: the browser's language, else English) |
| `sound` | `1`: sound on by default |
| `embedded` | `1`: inside the viewer page; the buttons tell it instead of leaving (set by `intro-overlay.js`, in the hash) |
| `at` | Holds the intro at that second, e.g. `?at=6.5` (points gathering), `?at=11` (the last point), `?at=17` (edges and faces) - for stills and screen recordings |

## Files

- `intro.html` - the page (copied into the build, not in an app build)
- `viewer/intro/intro.js` - the animation (three.js; a rollup entry, built to `intro.js`)
- `viewer/intro/mesh-reveal.js` - the model's act: vertices, edges, faces
- `viewer/intro/intro-sound.js` - the sound
- `viewer/intro-overlay.js` - the intro over the viewer page (`viewer.intro`)
- `viewer/intro/intro.css` - its styles (built to `assets/intro/`)
- `viewer/intro/synagogue-points.bin` - the points (built to `assets/intro/`)
- `scripts/build-intro-points.mjs` - samples the points from `viewer/examples/WolpaSynagogue.glb`

## Another model

The points are sampled from the textured model by triangle area, each with its
texture colour and surface normal:

```bash
node scripts/build-intro-points.mjs [count] [model.glb]   # or: pnpm run intro:points
```

The model must use plain (not KTX2/Meshopt-compressed) textures and geometry.
The caption on the page (`TEXTS` in `viewer/intro/intro.js`), `MODEL_URL` (the
mesh shown at the end; same coordinates as the sampled model) and the default
`next` name the synagogue.
