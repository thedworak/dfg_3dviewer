# Intro page

`intro.html` (built to `<build>/intro.html`) is a promo/landing page for the
viewer, about 48 seconds long:

1. A chaotic cloud of 200 000 points drifts in the dark (1.5 seconds alone)
   and then, like atoms, gathers into the Wołpa Synagogue - foundations
   first, the roofs last.
2. The last point (199 999 / 200 000) takes its time: a glowing atom with a
   trail spirals in and lands on the top of the roof - a flash, a ring, and a
   wave of light running through the building. The camera turns so that at
   that moment it faces the synagogue's front (the facade with the two corner
   pavilions, a little from the side): up to the landing its angle follows
   the intro's time (`FRONT_THETA` in `intro.js`), whatever the jumps,
   holds and rewinds.
3. The real model takes the points' place (`viewer/intro/mesh-reveal.js`):
   its vertices light up, its edges are drawn, its faces grow out of their
   centres glowing at the edges, and the textured building remains. The
   counter shows vertices and faces.

4. An express tour of the viewer's features (`viewer/intro/feature-tour.js`,
   about 28 seconds), each chapter named under the title:
   **sections** (a plane sweeps through the building; the cut glows, the
   walls' insides are filled like a drawing's section), **annotations and
   POIs** (pins with labels, the model's height measured), **shading**
   (wipes across the screen between the modes that keep the textures:
   textures, PBR - gloss and reflections, raking light), **sun study** (the sun's real path over
   Wołpa on 21 June, local time from sunrise to sunset: the sun itself, its
   day's track in the sky, a compass on the ground and the shadows; the
   camera holds still meanwhile) and
   **seasons and weather** (spring petals, summer, autumn leaves, winter snow
   settling on the roofs) and **time travel (4D)**: the 4D model's stages,
   1730 to 1936 - back to the raw new timber of the building's construction,
   then year by year the wood darkening and greying, the moss, the roof
   renewed in 1781 and 1903, a warm front sweeping up the walls at each
   stage, each stage's year and description in the caption.

From the landing on, the "Enter the viewer" button leads into the viewer with
the synagogue loaded; everything flies apart on the way. The model is
`examples/WolpaSynagogue-progressive.glb` (Meshopt + KTX2, 6.7 MB), loaded
while the points gather - the file the viewer opens next, so it is cached by
then. If it cannot be loaded, the intro ends with the points.

- The progress bar at the bottom: one part per stage (the cloud, the mesh, the tour's chapters), filling as the intro goes; a click jumps to that stage (the later ones once the model is loaded). On a phone only the current part is named.
- Sound (the button top right; `viewer/intro/intro-sound.js`): made on the fly with the Web Audio API, no audio files - futuristic, a machine of glass assembling itself: a deep drone and a crystalline shimmer for the cloud, glass shards clicking into place over a servo's whir as the points arrive, a rising resonant sweep with ever faster glass pings for the last point, a reversed swell drawn in and a deep blast with a ringing glass lock at its landing, data blips for the vertices, a ratchet for the edges, panels locking as the faces form, a sweep and a ping for each chapter of the tour. Off by default (`?sound=1` turns it on); browsers start it only with the first click or key press. The visitor's choice is remembered.
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
| `at` | Holds the intro at that second (the progress bar then moves the held moment), e.g. `?at=4` (points gathering), `?at=7.5` (the last point), `?at=15` (edges and faces), `?at=21.6` (section), `?at=25.5` (annotations), `?at=27.7` (PBR), `?at=32.3` (noon), `?at=38.9` (winter), `?at=40.6` (1730), `?at=44.7` (1903) - for stills and screen recordings |

## Files

- `intro.html` - the page (copied into the build, not in an app build)
- `viewer/intro/intro.js` - the animation (three.js; a rollup entry, built to `intro.js`)
- `viewer/intro/mesh-reveal.js` - the model's act: vertices, edges, faces
- `viewer/intro/feature-tour.js` - the feature tour
- `viewer/intro/intro-sound.js` - the sound
- `viewer/intro-overlay.js` - the intro over the viewer page (`viewer.intro`)
- `viewer/intro/intro.css` - its styles (built to `assets/intro/`)
- `viewer/intro/synagogue-points.bin` - the points (built to `assets/intro/`)
- `scripts/build-intro-points.mjs` - samples the points from `viewer/examples/WolpaSynagogue.glb`
- `viewer/intro/time/` - the time travel's stages (`time.json`) and textures (built to `assets/intro/time/`), from `scripts/build-intro-time.mjs`: the 4D model (`viewer/examples/4D/WolpaSynagogue_4D.glb`, 55 MB) differs from stage to stage only in the textures of five exterior parts - fresh, mid or old (old: the intro model's own) - so only the fresh and mid ones are taken, at most 1024 px, as WebP (1.2 MB). Run it again when the 4D model changes.

## Another model

The points are sampled from the textured model by triangle area, each with its
texture colour and surface normal:

```bash
node scripts/build-intro-points.mjs [count] [model.glb]   # or: pnpm run intro:points
```

The model must use plain (not KTX2/Meshopt-compressed) textures and geometry.
The sun study's place and day (`SITE` in `feature-tour.js`: Wołpa, 53.37° N
24.37° E, UTC+3; the model's north taken as -Z, since its files do not say)
comes from the same astronomy as the viewer's sun study (`viewer/sun-position.js`).
The caption on the page (`TEXTS` in `viewer/intro/intro.js`), the tour's pins (`feature-tour.js`, in the model's units), `MODEL_URL` (the
mesh shown at the end; same coordinates as the sampled model) and the default
`next` name the synagogue.
