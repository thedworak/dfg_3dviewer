# Generated surroundings

A model of a castle on an empty floor says little about where it stood. The
viewer can draw a **typical setting** round it - a settlement, strip fields,
a forest, low hills - worked out from the model's metadata alone: what it is,
its century, its region. Nothing is sent anywhere and no AI is involved: the
metadata become a handful of parameters by rules, and the parameters become a
layout by a seeded procedure.

It is a prototype. Covered so far: **Europe - the centre, the East, the North, the British Isles and the Mediterranean - about 900-2025**.
Other periods and regions get no surroundings rather than wrong ones.

## What it is, and what it is not

The surroundings are a hypothesis about the *kind* of place, not a
reconstruction of *this* place: nothing knows where a real road ran or how
many houses stood there. The viewer keeps that visible:

- **Schematic by default.** Plain, pale, flat-shaded shapes without
  textures; the ground fades out and the forest thins towards the rim. The
  realistic look (below) is a choice, never the default.
- **Marked.** While they are shown, a badge over the view says "Generated
  surroundings: ... A typical setting, not this place's", with a button for
  another layout and one to remove them. On a phone it is one line (a tap
  shows all of it), and it gives way to the window while that is open; the
  window's fold button (the chevron in its header) rolls it up to the year
  and its slider.
- **Not the model.** One group in the scene (`userData.isSurroundings`): no
  picking, no measuring, not in the model's box (camera framing, ground, the
  sizes of the sun and the weather). They do show in renders taken while
  they are on.
- **Stored as generated.** A manifest keeps the parameters only, with
  `"generated": true` (`AIM3DViewer.surroundings`,
  [`AIM3DViewer-schema.md`](../viewer/manifesto/AIM3DViewer-schema.md)).

## From metadata to parameters

*Look > Suggested scene* offers the surroundings as one more suggestion,
with its reasons, outdoors and for a presentation only (a documentation shows
only what was recorded). The rules (`viewer/editor/surroundings-rules.js`,
`suggestSurroundings`) need:

| Fact | From | Without it |
|---|---|---|
| the kind | words in the file name, metadata and manifest texts (English, Polish, German, a few Italian and Spanish): castle / stronghold, monastery / abbey, port / harbour / lighthouse, shtetl / synagogue, manor farm / granary, manor house, town, church, village / mill | not offered |
| the year | the 4D timeline, else the earliest year or century in the texts ("XIV w.", "14th century") | not offered |
| the region | the manifest's place, coordinates in the texts, a town they name: Central Europe or the Mediterranean | taken as Central Europe, less surely |
| the size | the model's box in metres: a building or a site | not offered; with an unknown unit, less surely |
| the season | a season the texts name | summer |

They give `{ kind, period, year, season, seed, density, region }`. The seed is a hash
of the kind, the year and the texts: the same metadata, the same picture.

| Kind | Layout |
|---|---|
| `castle` | a settlement beside the model, on the road leaving it |
| `town` | streets past the model on every side, a wall with gates |
| `church`, `village` | a village along a road past the model |
| `monastery` | its precinct round the model: a wall with a gate tower where the road leaves, the cloister's three ranges round a court beside the church (when the model is the church alone), a granary and a brewery, an orchard; fishponds beyond the wall; a village farther along the road |
| `manor` | a manor house: an avenue of limes (cypresses in the south) along the drive, a park with a pond behind the house, its farm beside it; a village farther along the road |
| `manor-farm` | a farmyard round the model: long barns on its sides, a cowshed across its far end, a granary under a tall hipped roof, the manor house at its head with a few park trees; a distillery with its chimney after 1800; a village farther along the road |
| `shtetl` | a market square round the model, its four sides lined with narrow timber houses gable to the square under tall shingled roofs (brick, plaster or tin after 1800), a road out of the town from each side, a church off the square, no walls |
| `port` | a town on the shore: the water on one side (the sea or a lake, flat, the town's half on dry land), a quay along it with brick warehouses gable to the water, piers; walls on the land side only; the railway landward |

| Period | |
|---|---|
| `early-medieval` (900-1250) | low timber houses, a small church without a tower, a palisade round a town or the settlement below a stronghold |
| `medieval` (1250-1550) | a masonry church with a tower; in a town, deep houses gable to the street and a masonry wall with towers |
| `industrial` (1800-1914) | four-storey tenements under low roofs along the street (plaster in greys and ochres, brick, tiles, slate or tin), paved streets; no walls but a boulevard with an avenue of trees where they stood; a railway past the settlement with its station and a road to it, factories with sawtooth roofs and round brick chimneys that smoke along the line; a neo-Gothic church with a tall spire |
| `modern` (1914-1945) | as the 19th century, with flat-roofed blocks of flats of five to seven storeys in light render (white, cream, grey) along wider lots |
| `postwar` (1945-1990) | the war's ruins until about 1950 (a share of the houses burnt-out, roofless shells - nearly half in a town); then as before, with a housing estate of prefabricated blocks (five and eleven storeys, in rows) beyond a town's boulevard from the late 1950s; a collective farm's long sheds of silicate brick under asbestos-cement at a village's edge from about 1950; the strips ploughed together into wide fields |
| `contemporary` (1990-2025) | the estates renovated in pastels, detached houses with hipped roofs along the roads round the old edge, a shop with its car park out of town on the main road |

Each period starts in its first year (1800 is already the 19th century).
The window's year slider gives each period the same width, so the decades
after 1914 are as easy to reach as the centuries before; its milestones are
the periods' starts, marked on it with what changes.

| Region | |
|---|---|
| `central` (Central Europe) | as above: timber, brick and stone, steep roofs of thatch, shingle and tiles, strip fields, mixed woods |
| `mediterranean` (Italy, Iberia, southern France, the Adriatic's shore, Greece, Anatolia's west, the Levant) | stone and render in lime, ochre and sienna; low terracotta roofs or flat terraces, eaves to the street; narrower streets; a bell tower standing beside the church; olive groves in rows in every other field; a thinner wood of holm oaks, pines and cypresses; a drier land; masonry always stone |
| `nordic` (Norway, Sweden, Finland) | timber painted Falu red (some ochre or white, more in a town after 1800), turf roofs until about 1800 then tiles, eaves to the street; whitewashed churches; fewer fields, more wood - three in four trees spruce and pine; masonry stone |
| `british` (Great Britain, Ireland) | cottages of stone or whitewash under thatch (slate after 1800), a town's houses rendered or timber-framed, brick and stucco after 1550, red-brick terraces under slate after 1800; churches of stone with a square tower, flat behind its parapet; after the enclosures (about 1750) wider fields in hedgerows with trees; less wood, mostly oak, ash and beech |
| `eastern` (beyond the Bug, to the upper Volga) | log houses gable to the road, half of them whitewashed clay, under thatch (tin after 1914); wooden churches with a bell tower under an onion dome, blue or green, white after 1800; birch and pine; masonry brick |
| `early-modern` (1550-1800) | taller, deeper town houses (plastered in ochre, rose, pale green; mostly tiled), a larger plastered church whose tower has a baroque onion dome (copper gone green, or shingled), and round a town earthen ramparts with bastions - a faced scarp outside, grass on top - instead of a wall with towers |

## Two looks

`style: "schematic"` (the default) or `"realistic"`; the badge's half-filled
circle switches between them. The realistic look
(`viewer/editor/surroundings-realistic.js`) draws the same layout - nothing
more is claimed, and the marks above stay - with what makes a distant view
read as real:

| Technique | What it does |
|---|---|
| Materials of the period | timber and thatch in villages and before about 1250; plaster, brick and tiles in a late medieval town; a brick church with a tiled roof (Central Europe's brick Gothic); each house a little different in colour |
| Detail | roofs with eaves and an underside, doors and windows (rows of them in a town house), merlons on a town wall, pointed stakes on a palisade |
| Baked light | walls darker at the foot; a soft contact shadow round each house, wall, tree and haystack (a transparent layer of its own); tree crowns darker underneath |
| The ground | a meadow varied by noise, trodden earth in the settlement, crops of the season in furrowed strips, earthen roads with grass between the ruts, haystacks in summer and autumn |
| Vegetation | trees of irregular outline and their own colour, conifers in two tiers; spring green, autumn foliage, bare in winter |
| Aerial perspective | colours fade into a haze of the season with the distance; a ring of low wooded hills closes the horizon (the camera's far plane is moved out while they are shown, and put back) |
| Seasons | winter: snow on the ground and the roofs, ice on the water |
| Surface detail | procedural patterns drawn once in the browser (thatch, roof tiles, shingles, brick, plaster, logs, planks, grass, crops, earth, leaves) in one atlas, multiplied into the colours and laid in metres, so a thatch keeps its straws' size; they fade out where a repeat is smaller than a few pixels |
| Cast shadows | the shadows of houses, walls, trees and haystacks, projected onto the ground along the light (the sun of the sun study while it is on, else the key light) and laid on the slope under each; they follow the sun as it moves, weaken as it sinks and fade under fog, rain or snow. Overlapping shadows do not darken twice |
| Wind | trees sway, more at the top; smoke rises from some roofs (more in winter) and drifts; both with the weather's wind and its direction while the weather is on |
| Water | ripples on the water, its colour of the season |

About 130 000 to 160 000 triangles, built in a few tenths of a second. The
detail, the wind, the ripples and the smoke are WebGL shaders; with the
WebGPU renderer the look is drawn without them.

## Water

`water: true` (the default) gives a castle a moat with a bridge where its
road leaves, and a town (three times in four) or a village or a church
(every other time, by the seed) a river: meandering past the model at a
distance, from rim to rim, in a shallow valley, with willows on its banks.
Nothing is built or grows in the water; a road that crosses it gets a
bridge, a road that would run along it ends at the bank, and a town wall
opens where the river passes. The water lies below its banks, its bed below
it. `water: false`: none.

## Real terrain

`terrain: "real"` with `latitude` and `longitude` (the Suggested scene asks
for it wherever it knows the place: the manifest's location, coordinates or
a town named in the texts) draws the surroundings on the place's terrain
(`viewer/editor/surroundings-terrain.js`): elevation tiles in the Terrarium
encoding, by default the open [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
on AWS (SRTM, EU-DEM and others; about 10-30 m in Europe), at a zoom that
covers the surroundings and the hills of the horizon (about 6 m a pixel).
Only the place's tile numbers go out. `viewer.surroundings.elevationUrl`
([settings](viewer-settings.md)) sets another source; `null` switches the
real terrain off.

The heights are relative to the model's place and blended to it near the
model, which keeps standing where it stands; north is the sun study's. The
houses stand on the low side of their slope, the shadows lie on it, and
the hills on the horizon are the real ones. Until the tiles are there - or
if they cannot be loaded - the generated hills stay and the badge says so.
No river is generated on the real terrain: the real ones are drawn instead
(below).

### The ground as it was

Today's elevation shows what was made later. On the real terrain the viewer
asks the same map servers as for the water (`viewer.surroundings.mapUrl`) for
the reservoirs, dams, quarries, landfills, spoil heaps and embankments round
the place, with their `start_date` - else a typical year: reservoirs and dams
1900, quarries, heaps and embankments 1850, landfills 1950. For a year before
one was made, the ground within it is drawn again from the ground round it:
a quarry's pit filled and a heap taken down to the level round them, a dam
or an embankment to the ground on either side, and under a reservoir a
valley sinking towards its middle (the lake hides the old floor; its depth
is guessed from its size, 3-25 m). The badge says what was taken away ("the
ground as it was: later reservoirs, quarries taken away"). It is an
estimate, like the rest; `pastTerrain: false` (or the window's checkbox)
keeps today's ground whatever the year.

## Real water

On the real terrain the water is the place's own
(`viewer/editor/surroundings-map.js`): rivers and streams, lakes and the
coast, from the first of these that has any for the year shown:

1. **The model's own map** (`waterUrl` in the manifest): GeoJSON digitised
   from an old map by whoever made the model - the water as it was. A
   relative path is read next to the manifest. Each feature's properties are
   OSM's tags or a `kind`: `"river"` and `"stream"` (lines; `width` in
   metres, else 14 and 3.5), `"lake"` and `"sea"` (polygons; holes are
   islands), `"coastline"` (a line with the water on its right). `start_date`
   and `end_date` (a year, or a date starting with one) say when it existed.
   ```json
   { "type": "Feature", "properties": { "kind": "river", "width": 40, "end_date": "1690" },
     "geometry": { "type": "LineString", "coordinates": [[19.02, 54.03], [19.05, 54.05]] } }
   ```
   The badge says "the water of {year} from the model's own map".
2. **[OpenHistoricalMap](https://www.openhistoricalmap.org/)** (its Overpass
   API, `viewer.surroundings.historicalMapUrl`): dated features, kept where
   they existed in the year; it counts only if it has water for the place
   in that year. Any kind of water - a medieval fishpond is history too.
   "the water of {year} (© OpenHistoricalMap contributors)".
3. **[OpenStreetMap](https://www.openstreetmap.org/copyright)** (the Overpass
   API): today's water. "today's rivers and lakes (© OpenStreetMap
   contributors)". Left out on purpose:
   - reservoirs, basins, canals, ponds and ditches: mostly dammed or dug in
     modern times (Lake Czorsztyn below Niedzica castle filled in 1997);
   - roads: today's roads say little of medieval ones, so the surroundings'
     roads stay generated.

The source is chosen when the water is loaded, for the year then shown; a
dated source is then filtered by each year (following the timeline, the
surroundings are laid out again when the water of the year differs). Each
source is fetched once per place, and a server that does not answer within
25 s is given up for the next source.

The features become one signed distance to the water's edge (a grid of edges
for speed; inside a lake by its crossings, on the sea's side of the coast by
the way OSM draws it, land on the left), which the layout reads as it reads
the generated river: nothing is built or grows in the water, a castle's
settlement moves to dry land, roads end at the bank or cross by a bridge,
a town wall opens where the water passes. Only the place and a radius go out
in the queries. A castle's moat stays generated (moats are rarely mapped).

### Your own Overpass

`viewer.surroundings.mapUrl` ([settings](viewer-settings.md)) is one server
or a list tried in turn. The Docker setup runs its own
([docker](docker.md), profile `overpass`): a region's extract cut down to
water, asked first, the public server only when it is not running.

## An old map

Where whoever made the model has an old map of the place - a cadastral
plan, a military survey - the surroundings can follow it instead of the
rules (both need the place: `latitude`, `longitude`):

- **Its layout** (`layoutUrl`): GeoJSON digitised from the map, read by
  `viewer/editor/surroundings-map.js` (`readMapLayout`), in the same format
  as the water file (one file can hold both). Kinds: `"road"` (a line,
  `width` in metres), `"field"` (a polygon), `"building"` (a polygon;
  `height` in metres, `roof`: `gable`, `pyramid`, `onion`, `none`; `role`:
  `house`, `church`, `tower`), `"wall"`, `"palisade"`, `"rampart"` (lines);
  `start_date` and `end_date` say when each existed. What the map has takes
  the place of what would be generated of its kind: its roads (and the
  houses are then built along them), its buildings (as they stood: each
  outline's smallest turned rectangle, its ridge along the longer side; no
  houses or church are generated then), its fields (as drawn), its walls.
  Trees, the generated water and the rest stay. Following the timeline, a
  building is there from its start to its end. The badge says "roads and
  buildings of {year} from the old map".
  ```json
  { "type": "Feature", "properties": { "kind": "building", "height": 9, "role": "house", "start_date": "1610" },
    "geometry": { "type": "Polygon", "coordinates": [[[19.0281, 54.0398], [19.0283, 54.0398], [19.0283, 54.0399], [19.0281, 54.0399], [19.0281, 54.0398]]] } }
  ```
- **Its picture** (`mapOverlay`): the map's tiles (XYZ, Web Mercator:
  `{ "url": "https://…/{z}/{x}/{y}.png", "opacity": 0.85, "attribution":
  "…" }`) draped over the ground - over the fields and roads, under what
  stands - fading out at the rim and where the map ends. The tiles are
  fetched at a zoom that covers the surroundings in at most 10 x 10 tiles
  and stitched into one texture; they must allow cross-origin use (CORS).
  The attribution the map's licence asks for is shown in the badge ("on an
  old map (…)"). Georeferenced old maps are served as tiles by archives and
  by tools such as Map Warper or Allmaps; check each map's licence.
- **Its picture read by AI** (optional, where the worker offers the
  `old-map` assistance, [AI](ai.md)): the badge's ✎ sends the draped map's
  picture to the assistant, which reads the roads, buildings, fields, water
  and walls it draws; they then shape the surroundings as a layout file
  would (any terrain), marked "read from the old map by AI - check them",
  and ⤓ saves them as GeoJSON to check, correct and give to the manifest as
  `layoutUrl` / `waterUrl`. Nothing read by AI is stored in the manifest by
  itself.
- **Correcting the reading** in the viewer (the surroundings' window, "The
  old map read by AI"): *Correct* draws what was read over the ground, each
  kind in its colour (roads gold, buildings red, fields yellow, water blue,
  walls violet) with a point at each corner. Drag a point to move it; click
  a line to select its feature and Delete to remove it; *Draw* adds a road,
  building, field, river, lake or wall - click its points on the ground,
  double-click or Enter to finish, Esc to cancel; *Undo* (Ctrl+Z) takes back
  the last change. The surroundings are drawn again after each change. A
  changed feature gets `edited: true`, a drawn one `source: "hand"`, the
  file `checked_by_hand: true`; *Save GeoJSON* saves it as corrected.

Without a file or a reading, on the real terrain, the roads, buildings,
fields and town walls of the year come from **OpenHistoricalMap** where it
has any for the place (`viewer.surroundings.historicalMapUrl`; "roads and
buildings of {year} (© OpenHistoricalMap contributors)"). The order is: the
manifest's file, the AI's reading, OpenHistoricalMap, the rules.

## Brick or stone

`masonry: "brick" | "stone"`: what churches, towers and town walls are built
of in the realistic look. The Suggested scene picks it by the place, roughly:
brick on the northern lowlands (the brick Gothic of Pomerania, Prussia,
Greater Poland, Masovia, Silesia and Lesser Poland's towns), stone south of
the Sudetes and the Carpathians' foothills, in Bohemia and Moravia, in
southern and western Germany (`surroundingsMasonry`). Without a place:
brick.

## Following the timeline

`followTimeline: true` (the Suggested scene sets it when the year comes from
the model's 4D timeline): the surroundings follow the timeline's year. The
period changes with it (timber and a palisade before about 1250, masonry
after), and the settlement grows: `growth`, the share of its houses built,
rises from about a third at a period's start to all of them at its end
(`surroundingsGrowth`). Houses are built in a fixed order, so one standing
in 1300 still stands in 1450, where it stood. In years the surroundings do
not cover (before 900, after 2025) they are hidden and the badge says so.
While the timeline plays they are drawn again at most every 0.7 s.

## From parameters to a layout

`layoutSurroundings(params, { radius })` returns the layout in metres round
the model at the origin: `blocks` (houses, a church, towers), `walls`,
`roads`, `fields`, `trees`, and the radii `clear` (nothing stands this close
to the model), `flat` and `extent`. It is pure (no three.js), so it can be
tested and used elsewhere. `viewer/editor/surroundings.js` draws it as two
meshes, scaled to the model's unit and placed on the model's ground.

## The window

**Look > Generated surroundings** opens their window: switch them on or off,
move the **year** on a slider from 900 to 2025 (the period beside it changes
with it; the surroundings are drawn again once the slider rests) or click one
of its milestones - 1250, 1550, 1800, 1914, 1945, 1990, the periods' starts, each
saying what changes then - pick the kind of place, the region, the look (schematic or realistic), the season, the water, the
place's real terrain (once a place is set, in the sun study) and whether
they follow the timeline's year - then the slider waits for the timeline.
**▶** plays through the years: the slider moves on by itself, a twentieth
of a period at a time, each step drawn before the next, with a longer stop
at each milestone, up to 2025 (from 900 again once there); moving the year
any other way, switching them off or closing the window stops it. A
manifest's `open: true` opens the window with the model, for a
reconstruction told through its stages.
"Another layout" draws the same kind of place with a new seed.

While they are shown the camera may zoom out far enough to see the whole
setting from above (the model's own limit is a few times its size); the
limit is put back when they go. Changes made
elsewhere - the badge, a manifest, the suggested scene - show in the window.

## API

- `Viewer.setSurroundingsOptions({ kind, period, year, season, seed, density, style, water, terrain, latitude, longitude, masonry, followTimeline, growth, waterUrl, layoutUrl, mapOverlay })` - show them (or change what is shown); a `year` without a `period` takes the year's period
- `Viewer.updateSurroundings(delta)` - every frame: the shaders' time and wind, the smoke's size, the shadows as the light moves
- `Viewer.setSurroundings(false)` - remove them
- `Viewer.reshuffleSurroundings()` - another layout of the same kind
- `Viewer.getSurroundingsForExport()` / `Viewer.apply3IFManifestSurroundings(block)`

## Shadows near the model

Under the sun of the sun study, the realistic surroundings within
`viewer.surroundings.shadowReach` metres of the model's footprint (default
80) are a mesh of their own that the sun's shadow map draws: their houses,
walls and trees cast real shadows on each other's walls, on the ground and
on the model, and take the model's. The sun's shadow map then reaches that
far and grows to 4096 pixels (WebGL), so the model's own shadows stay sharp
enough; its bias follows the bigger texels. Farther out the shadows stay
projected onto the ground. `shadowReach: 0` keeps them all projected (and
the sun's map as it was). Not with the WebGPU renderer.

## Life

In the realistic look the surroundings are not empty: people walk to and fro
along the settlement's streets (in the clothes of the period - undyed wool
and linen, then darker cloth, brighter after 1945), carts drawn by horses
and, from the 1920s, more and more cars go along its roads, across its
bridges, and boats are on its water - rowing boats on a river, a moat or a
pond, sailing boats in a port, motorboats after 1945. More in a town, fewer
in winter, no boats on the ice, half as many on a phone. They are as
generated as the houses (`life: false`, or the window's checkbox: none).

## On phones

What stands far out - past about half the setting's radius, deep in the
haze - is drawn simpler on every device: trees with fewer sides and without
their soft or cast shadows, houses without doors, windows or eaves. That
alone halves the triangles and the time to build them (a town of about 1700:
from 160,000 to 70,000 triangles).

On a phone or a weak device (or while the render quality is "fast") they are
drawn **light** (`viewer.surroundings.detail`, default `"auto"`): simpler
from nearer, every other far tree left out, a coarser ground, no smoke or
haystacks, no sun shadow map of their own, and their cast shadows redrawn
less often - again about half (a town: 37,000 triangles, built in under
half the time), which keeps playing through the years smooth.

## Not yet

Shadows on walls beyond the sun's shadow map; regions beyond Europe;
reading descriptions the rules do not understand with the optional AI
assistant; correcting the AI's reading of an old map in the viewer; the
terrain as it was (before reservoirs and quarries); people, carts and boats;
lighter surroundings on phones.
