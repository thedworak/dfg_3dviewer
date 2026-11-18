# Intro page

`intro.html` (built to `<build>/intro.html`) is a promo/landing page for the
viewer, about 90 seconds long:

1. A chaotic cloud of 200 000 points drifts in the dark (1.5 seconds alone)
   and then, like atoms, gathers into the Wołpa Synagogue - foundations
   first, the roofs last.
2. The last point (199 999 / 200 000) takes its time: a glowing atom with a
   trail waits beside the building, a little behind and about the roof's
   height (higher and closer in on a narrow screen), keeping its place in
   the camera's view while the camera circles - so it is in the picture on
   any screen; then it sets off gently (speeding up, then slowing down -
   never a jump) and comes down in an arc to the top of the roof - a flash, a ring, and a
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
   about 72 seconds), each chapter named under the title:
   **sections** (a plane sweeps through the building; the cut glows, the
   walls' insides are filled like a drawing's section), **annotations and
   POIs** (pins with labels, the model's height measured), **shading**
   (wipes across the screen between the modes that keep the textures:
   textures, PBR - gloss and reflections, raking light), **sun study** (the sun's real path over
   Wołpa on 21 June, local time from sunrise to sunset: the sun itself, its
   day's track in the sky, a compass on the ground and the shadows; the
   camera holds still meanwhile) and
   **seasons and weather** (spring petals, summer, autumn leaves, winter snow
   settling on the roofs), **scene cameras** (three cameras drawn as the
   viewer draws them - pyramids with their up triangle and a dashed line to
   where they look, named; the one before the front turns gold and its view
   opens in a frame beside the model), **cooperation mode** (a phone with a
   second session of the scene comes in, "LIVE" on its screen; a finger
   swipes on it and the big picture turns with it - the phone shows the same
   view, live) and **time travel (4D)**: the 4D model's stages,
   1730 to 1936 - back to the raw new timber of the building's construction,
   then stage by stage the wood darkening and greying, the moss, the roof
   renewed in 1781 and 1903, a warm front sweeping up the walls at each
   stage, each stage's year and description under the chapter's name, and a timeline
   of the stages' dates under it with the year running along; each step as
   long as the years it spans (at least 0.4 s), 9 seconds in all; and last
   **surroundings through time** (`viewer/intro/intro-surroundings.js`, about
   30 seconds): the camera rises and draws back, and the viewer's generated
   surroundings ([surroundings.md](surroundings.md) - the same rules and
   seed) grow round the synagogue through all the periods they cover, 900 to
   2025, each period the same time (as on the viewer's year slider) - a
   shtetl of timber houses round its market, each house rising as the place
   grows, rebuilt in a wave out from the model where a period begins (the
   railway and its station in the industrial age), the building's own 4D
   stage following the year (before 1730 its first), a timeline of the
   periods' dates. Then, from above, other kinds of place in other regions,
   one after another, in colour (roughly the realistic look: the regions'
   walls and roofs, grass, crops, water) and with their life moving (people,
   carts, boats; [surroundings.md](surroundings.md)): a town in Central
   Europe (1880), a port on the Mediterranean (1700), a village in the North
   (1850), a monastery in the British Isles (1500). All the while a badge
   says it is a comparative visualisation - how the building might look in
   other surroundings through the ages, generated, typical of the kind of
   place and its time, not a reconstruction of this place.

The camera follows one path through it all, a function of the intro's time
only (`tourCameraPath` in `feature-tour.js`), not of the frames drawn - every
run, on every screen, shows the same: it comes round to the front for the
sections and holds still while the plane cuts, turns slowly on through the
annotations and the shading, holds still for the sun study, follows the
phone's finger in cooperation mode (a turn one way, a shorter one back), and for the time
travel starts at the front's right and goes round in an arc towards the
entrance, a little closer; for the surroundings it rises and draws back over
the settlement, and comes down again at the end. A drag hands the camera to the visitor.

On a phone or tablet (a touch screen, the app too) every second point is
drawn, each a little larger; the counter still counts all 200 000.

From the landing on, the "Enter the viewer" button leads into the viewer with
the synagogue loaded; everything flies apart on the way. On its own page the
intro fetches the viewer's page, scripts, stylesheets and settings while it
plays, so the viewer opens from the browser's cache. The model is
`examples/WolpaSynagogue-progressive.glb` (Meshopt + KTX2, 6.7 MB), loaded
while the points gather - the file the viewer opens next, so it is cached by
then. If it cannot be loaded, the intro ends with the points.

- The logo (at most 200 px wide, a third of a phone's width) fades to a faint watermark once the points are under way (2.5 s in), the tagline with it.
- The progress bar at the bottom: one part per stage (the cloud, the mesh, the tour's chapters), filling as the intro goes; a click jumps to that stage (the later ones once the model is loaded). On a phone only the current part is named.
- Language (EN, PL, DE beside the sound button; on a phone on the left, level with it): the intro is loaded again in that language from the same moment (held with `?at=`: held there), the choice remembered (`localStorage`); inside the viewer page the viewer switches to it too.
- Sound (the button top right; `viewer/intro/intro-sound.js`): made on the fly with the Web Audio API, no audio files - warm and calm, a small ensemble in a hall in D minor: a slow string pad (D minor, B flat, F, C, four seconds each), a soft bass and a harp picking the chord's notes (sparse over the cloud, flowing once the building stands); harp notes as the points arrive, notes climbing the scale and the strings swelling for the last point, a deep soft drum, a bell and the full chord at its landing, harp notes for the vertices, a ripple for the edges, wooden knocks as the faces form, a small bell for each chapter of the tour. Light enough for a phone: a larger audio buffer (`latencyHint: "playback"`), a short reverb, few voices at once. Off by default (`?sound=1` turns it on); browsers start it only with the first click or key press. The visitor's choice is remembered.
- Drag rotates the building; the mouse pushes points aside.
- "Assemble again" runs everything backwards into the cloud and gathers it again.
- "Skip intro" goes straight to the viewer.
- `prefers-reduced-motion`: the building is shown assembled, without the animation.
- No WebGL: the logo and the button only.

## In the viewer

By default (`viewer.intro` in `viewer-settings.json`, see [viewer-settings](viewer-settings.md)) the intro opens in front of the standalone viewer page on the first visit only (a `localStorage` flag; later visits go straight to the viewer), in a full-window layer (`viewer/intro-overlay.js`), while the viewer starts and loads its model underneath. The app build ships the intro too and shows it on its first start. Through the intro the viewer always opens the intro's model (the synagogue; a scene's own `next` model or `model`), whatever was opened last, and remembers it as the last one; without the intro it opens what it would have. Help > Intro shows it again and loads its model underneath while it plays. The back gesture (phones, the app) skips it. An iframe gets no safe area of its own, so the page passes its own (`env(safe-area-inset-*)`: the app's status bar, a notch) to the intro, which keeps its buttons and title clear of it. "Enter the viewer" lets the points fly apart and fades the layer away; "Skip intro" and Escape close it at once. `?intro=1` / `?intro=0` in the page address show it or not, whatever the settings say.

## Parameters

| Parameter | Meaning |
|---|---|
| `next` | Where the button leads; a page of the same site only (default: the scene's `next`; for the synagogue `./?model=./examples/WolpaSynagogue-progressive.glb`) |
| `lang` | `pl`, `en` or `de` (default: the visitor's last choice, then the browser's language, else English) |
| `sound` | `1`: sound on by default |
| `embedded` | `1`: inside the viewer page; the buttons tell it instead of leaving (set by `intro-overlay.js`, in the hash) |
| `insets` | `top,right,bottom,left` in CSS pixels: the viewer page's safe area (set by `intro-overlay.js`, in the hash) |
| `resume` | starts at that second (set by the language switch, then taken out of the address) |
| `at` | Holds the intro at that second (the progress bar then moves the held moment), e.g. `?at=4` (points gathering), `?at=7.5` (the last point), `?at=15` (edges and faces), `?at=21.6` (section), `?at=25.5` (annotations), `?at=27.7` (PBR), `?at=32.3` (noon), `?at=42.4` (winter), `?at=46.8` (a scene camera's view), `?at=50.2` (cooperation mode), `?at=53.8` (1730), `?at=56` (1781), `?at=66` (the surroundings, 1423), `?at=70` (1866), `?at=79` (a town in Central Europe), `?at=82.5` (a port), `?at=85.5` (a village in the North), `?at=88` (a monastery) - for stills and screen recordings |

## Files

- `intro.html` - the page (copied into the build, an app build's too)
- `viewer/intro/intro.js` - the animation (three.js; a rollup entry, built to `intro.js`)
- `viewer/intro/mesh-reveal.js` - the model's act: vertices, edges, faces
- `viewer/intro/feature-tour.js` - the feature tour
- `viewer/intro/intro-surroundings.js` - the surroundings through time (the viewer's layout, drawn light)
- `viewer/intro/intro-scene.js` - the scene: the model and what depends on it (`viewer.intro.scene`, below)
- `viewer/intro/scenes/` - other scenes (built to `assets/intro/scenes/`): `tempietto/`
- `viewer/intro/intro-sound.js` - the sound
- `viewer/intro-overlay.js` - the intro over the viewer page (`viewer.intro`)
- `viewer/intro/intro.css` - its styles (built to `assets/intro/`)
- `viewer/intro/synagogue-points.bin` - the points (built to `assets/intro/`)
- `scripts/build-intro-points.mjs` - samples the points from `viewer/examples/WolpaSynagogue.glb`
- `viewer/intro/time/` - the time travel's stages (`time.json`) and textures (built to `assets/intro/time/`), from `scripts/build-intro-time.mjs`: the 4D model (`viewer/examples/4D/WolpaSynagogue_4D.glb`, 55 MB) differs from stage to stage only in the textures of five exterior parts - fresh, mid or old (old: the intro model's own) - so only the fresh and mid ones are taken, at most 1024 px, as WebP (1.2 MB). Run it again when the 4D model changes.

## Another model

The intro is the same for every deployment - the cloud, the last point, the
reveal, the feature tour, the sound; only its **scene** (the model and what
depends on it) changes, with `viewer.intro.scene` in `viewer-settings.json`:

```json
"intro": { "scene": "assets/intro/scenes/tempietto/scene.json" }
```

A path to a scene file (same site; its own paths resolve against it), or the
scene object itself (paths against the intro page). Without it the intro shows
the Wołpa Synagogue. Two scenes come with the viewer:

| Scene | Value |
|---|---|
| Wołpa Synagogue (default, with the 4D time travel and a shtetl round it) | none |
| Tempietto (`viewer/intro/scenes/tempietto/`, built to `assets/intro/scenes/tempietto/`) | `"assets/intro/scenes/tempietto/scene.json"` |

The intro page takes the deployment's logo (`branding.logo.srcOnDark`, else
`src`) and name (`branding.name`) too; see [branding.md](branding.md).

### The scene file

| Key | Meaning | Without it |
|---|---|---|
| `points` | the point file (below); **required** | the default intro |
| `model` | the glTF/GLB shown after the points, in the same coordinates (Meshopt and KTX2 allowed) | the intro ends with the points |
| `next` | where "Enter the viewer" leads (same site) | the viewer with `model` |
| `unitInMeters` | metres per model unit, for the height label | `1` |
| `front` | the camera's angle around the model at the landing, radians (0: from +Z) | `0` |
| `ground` | the model's ground, y in model units (compass, snow, sections) | the bounding box's bottom |
| `pins` | `[{ "key", "at": [x, y, z], "lift", "kind": "annotation" or "poi", "label": { "pl", "en", "de" } }]` - `at` in model units, `lift` in the intro's (the model is about 3 across) | no pins |
| `measure` | `{ "x", "z", "from", "to" }`: the height line, model units | the bounding box's height at its corner |
| `site` | `{ "latitude", "longitude", "utcOffset", "north", "month", "day" }` for the sun study; `north`: the model's north from -Z, degrees | the default place on 21 June |
| `time` | a folder with `time.json` and the stages' textures (as `viewer/intro/time/`) | no time travel: the chapter is left out |
| `surroundings` | `{ "kind", "region", "masonry", "seed", "density", "years": [from, to], "showcase": [{ "kind", "region", "year" }] }`: the generated surroundings through those years ([surroundings.md](surroundings.md); `kind` and `years` required, 900-2025 at most), then the other places of `showcase` (up to six; none: the chapter ends with the years) | no surroundings: the chapter is left out |
| `texts` | `{ "pl": {...}, "en": {...}, "de": {...} }` over the intro's texts: `tagline`, `hint`, `hintTouch`, `tour.sunDate`, `tour.timeNotes` | neutral texts ("the model") |

Coordinates are the model's own (y up, as in glTF); the bounds the points
script prints help to place pins and the measurement. `?at=<seconds>` holds
the intro at a moment, to check them (`intro?at=...` behind servers that drop
the query on their `intro.html` redirect).

### The points

The points are sampled from the textured model by triangle area, each with its
texture colour and surface normal:

```bash
node scripts/build-intro-points.mjs [count] [model.glb] [out.bin]   # or: pnpm run intro:points
node scripts/build-intro-points.mjs 120000 model.glb clients/acme/brand/intro/points.bin
```

Meshopt-compressed geometry is read; KTX2 textures are not (their points take
the material's base colour) - sample from the uncompressed model and show the
compressed one (`model`). 100 000 - 200 000 points suit a building (12 bytes
each; the Tempietto has 60 000).

### Time travel

`time.json` names the model's materials whose textures change (`parts`:
part -> material name) and the stages (`stages`: `year`, `label` and, per
part, `fresh`, `mid` or `old` - `old` is the model's own texture); the
textures are `<part>_fresh.webp` and `<part>_mid.webp` beside it.
`scripts/build-intro-time.mjs` makes them from the synagogue's 4D model.
