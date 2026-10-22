# AI assistance

Optional help from an AI assistant (the Claude API), run by the standalone worker (`worker/ai.py`). It is **off by default**; the viewer offers it only when the worker has it on. Point cloud classification (section 4) is a separate worker step that does not use the Claude API.

**Plans:** by default only the **Business and Enterprise** plans may use the assistant (`WORKER_AI_ACCESS=business`): accounts with either plan (Enterprise is granted by an admin, with its price agreed individually), the app's Business subscribers, and admins. A server without plans opens it with `WORKER_AI_ACCESS=users` or `all`. The worker decides; the viewer shows the AI tools when `GET /api/ai/config` says they are enabled for the caller. In the app, a user whose plan does not include them (`restricted`) sees the tools the server has with a **lock**; a tap opens the plans panel at Business. The web viewer, which sells no plans, hides them instead.

The assistant never sees the model files. Each feature sends only derived data (listed below) and gets back a structured (JSON schema) answer. The viewer shows that answer next to the data it came from, marked as AI-generated, and acts on it only when the user asks.

| Feature | Where in the viewer | What is sent | What comes back |
|---|---|---|---|
| `validation` | File > Validation report > "Explain in plain language (AI)" | the model's `validation.json` (issue codes, statistics, bounds, checks) | headline, summary, findings with what to fix |
| `ifc-query` | Model > "Ask the building model (AI)" (converted IFC models) | the question and a summary of the IFC data: classes with counts, storeys, materials, property sets with property names, types, min/max and up to 3 sample values; asked from the context menu ("Ask about this element"), also the picked element's fields, storey and property values | a filter (conditions, aggregate, action) that the viewer runs on the real data |
| `variants` | Reconstruction variants panel > "Compare and review paradata (AI)" | each variant's label, description, source, Level of Certainty (with the scale's levels), node names (at most 30) and the viewer's measurements (size, bottom/top in metres, triangles, shared/exclusive nodes) | summary, differences, paradata review per variant (ok / incomplete / inconsistent, issues, suggestions) |

## Turning it on

On the worker (e.g. in `.env` next to `docker-compose.yml`):

```bash
WORKER_AI_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
```

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_AI_ENABLED` | `false` | Master switch. Nothing is offered without it, even with a key. |
| `ANTHROPIC_API_KEY` | – | The Claude API key (any credential the Anthropic SDK resolves works too). |
| `WORKER_AI_MODEL` | `claude-opus-5-5` | Model used for every feature. |
| `WORKER_AI_FEATURES` | all | Comma-separated subset of `validation`, `ifc-query`, `variants`. |
| `WORKER_AI_ACCESS` | `business` | Who may use it: `business` (the **Business and Enterprise** plans: accounts with either plan, and the app's Business subscribers, who have no account), `users` (anyone logged in), `all`, `admin`. Admins always may. A self-hosted server without plans sets `all` or `users`. |
| `WORKER_AI_REQUESTS_PER_HOUR` | `30` | Per caller (account, else IP), rolling hour, in memory. `0` = unlimited. |
| `WORKER_AI_TIMEOUT` | `90` | Seconds per request, one attempt. Keep it under the proxies' limits: `docker/nginx.conf` waits 100 s on `/api/ai/`, Cloudflare 100 s. |
| `WORKER_AI_FALLBACKS` | `true` | Server-side refusal fallback of the Claude API (beta `server-side-fallback-2026-07-01`). |

The worker image installs the `anthropic` package. Running `worker/server.py` outside Docker requires `pip install "anthropic>=1.15,<2"`. Without the package, the features report themselves as off.

In the viewer, `viewer.ai: false` in `viewer-settings.json` hides the assistance even when the worker offers it.

Identical requests are answered from an in-memory cache (the last 256 answers), so asking the same question again costs nothing.

## API

| Endpoint | Body | Answer |
|---|---|---|
| `GET /api/ai/config` | – | `{enabled, restricted, access, features, model}` for this caller: `restricted` = on, but not for this caller; `features` lists the features the server has (also when restricted, for the app to show them locked) |
| `POST /api/ai/validation/<job id>` | `{lang}` | `{headline, summary, findings: [{level, title, explanation, fix, codes}], model}` |
| `POST /api/ai/ifc-query` | `{question, schema, lang, selection?}` (`schema`: `buildIfcSummary()` of `viewer/ai/ifc-filter.js`; `selection`: the picked element - `guid`, `type`, `name`, `storey`, ..., `psets` - at most 4000 characters, the property sets dropped first) | `{understood, interpretation, match, conditions: [{field, pset, property, op, value}], aggregate: {kind, pset, property, unit}, action, note, model}` |
| `POST /api/ai/variants` | `{label, description, certaintyScale, variants: [...], lang}` (`buildVariantsPayload()` of `viewer/ai/variants-review.js`) | `{summary, differences: [{aspect, detail, variants}], paradata: [{variant, status, issues, suggestions}], model}` |

Errors are `{error, code}`: `404 ai_disabled` / `ai_feature_disabled`, `403 ai_forbidden`, `429 ai_rate_limited` (with `Retry-After`), `422 ai_refusal`, `503 ai_*` when the Claude API fails or answers unusably (never 502/504, whose bodies Cloudflare replaces with its own page), `500 ai_internal` for an unexpected worker error. Problems of the server's setup (`ai_auth`, `ai_permission`, `ai_bad_request` - also an empty credit balance -, `ai_upstream`, `ai_unreachable`, `ai_internal`) answer only "The AI assistant is temporarily unavailable."; the reason is in the worker log (`docker compose logs worker | grep '\[ai\]'`). `lang` is `en`, `pl` or `de` (the viewer's language). The answer's texts are written in that language.

## 1. Validation report explained

The worker's model check (`worker/validate.py`) is thorough but technical: glTF-Validator codes such as `ACCESSOR_NON_UNIT` or `MESH_PRIMITIVE_GENERATED_TANGENT_SPACE`. The assistant turns it into a short verdict and a list of findings, each saying what it means for people viewing the model and what to do (e.g. "the model is probably in millimetres: 12 000 m wide"). Only the report goes out: issue codes and messages (at most 60 groups, 3 pointers each), statistics, bounds and the worker's checks.

The explanation is fetched only on the button. It is included in the report's JSON download as `aiExplanation`.

## 2. Questions to a building model (IFC)

Examples: "load-bearing walls on level 2", "all fire doors", "total slab area", "windows with U-value above 1.1".

The panel (Model menu) appears for IFC models of both kinds. Converted models have their properties next to the GLB in `metadata/<name>_ifc.json` (`scripts/ifc_metadata.py`). For a `.ifc` opened directly (web-ifc), the properties of every element and the storeys are read from the model on the first question (`loadIfcQueryData()` in `viewer/ifc-properties.js`). Such a model is one merged mesh, so the elements found are highlighted by an overlay of their triangles and hidden or isolated by a temporary geometry without the others, restored by "Show all".

1. The viewer summarises the data (`buildIfcSummary`): IFC classes with counts, storeys, materials, type names, and the property sets with each property's type, min/max and a few sample values. GlobalIds and the elements themselves stay in the browser.
2. The assistant answers with a **filter**, not with results. Each condition is `field` + `op` + `value`. The fields are `type`, `name`, `description`, `objectType`, `predefinedType`, `tag`, `material`, `typeName`, `storey`, and `property` (with `pset`/`property`). The ops are `eq`, `ne`, `contains`, `gt`, `gte`, `lt`, `lte`, `exists`, `missing`, `true` and `false`. The conditions are joined with `match`: `all` or `any`. The answer can also ask for an aggregate (`count`, `sum`, `average`, `min`, `max` of a numeric property) and an action (`highlight`, `isolate`, `hide`).
3. The viewer runs the filter on every element (`runIfcFilter`). The elements found, the counts and the sums all come from the data. The panel shows the filter, so the user can check how the question was understood. It also shows how many matches lack the summed property. `IfcWall` also matches `IfcWallStandardCase`; storeys, spaces and the building are only matched when the question asks for them.

The elements found can be highlighted, shown alone or hidden, and the list opens each element's properties.

## 3. Reconstruction variants and paradata

For models with reconstruction variants (`editor/compare.js`: alternative hypotheses such as two possible roofs). The variants panel gets a button that compares the variants and reviews how well each one is documented.

- **Comparison.** The texts say what the researchers claim. The viewer adds what it measures of each variant's nodes: the bounding box in metres (using the model's unit, `editor/model-units.js`), bottom and top height, triangle count, and how many nodes a variant shares with others or has alone. The assistant combines both, e.g. "variant B's roof is 3.2 m higher". It takes numbers only from the measurements.
- **Paradata review**, in the spirit of the London Charter and the Seville Principles. For each variant: is a source cited, does the description say what the hypothesis rests on, and does the Level of Certainty fit the sources and the wording? A high level with no source, or a "speculative" variant rated certain, is marked inconsistent. Each variant gets concrete suggestions.

The assistant judges the documentation, never the scholarship: it does not decide which variant is right. Comparing two scans of the same object (change monitoring) is a different task. It needs a geometric difference (cloud-to-cloud / cloud-to-mesh) computed first, and is not part of this feature.

## 4. Point cloud classification

Not a Claude feature: a step of the worker's point cloud pipeline (`worker/classify.py`), with its own switch. It needs no API key, and no data leaves the server.

A scan straight from a scanner or from photogrammetry has no classes, so the viewer's class filter (Model > Point cloud settings > Classes) has nothing to offer. With classification on, the worker assigns ASPRS classes before it builds the octree: 1 unclassified, 2 ground, 3/4/5 low/medium/high vegetation, 6 building, 7 noise. The tiles carry the classes, and the class list says they were assigned automatically.

```bash
WORKER_POINTCLOUD_CLASSIFY=auto        # off (default) | auto: clouds without classes | always
WORKER_POINTCLOUD_CLASSIFIER=geometric # or: command
```

**Built-in classifier (`geometric`).** Rules on the geometry, in numpy, with no trained model and no GPU:

- **Ground.** A progressive morphological filter (SMRF, Pingel et al. 2013) runs on a grid of the lowest points. A cell whose surface drops under openings of growing size by more than the terrain slope allows is not ground. Points near the resulting surface are ground.
- **Noise.** Points alone in their voxel with no occupied neighbour voxel, and points far below the ground.
- **Above the ground.** For each voxel, the eigenvalues of the points' covariance: planar patches (roofs, walls) are buildings, scattered ones vegetation. Points of a pulse with later returns count as vegetation. Vegetation is graded by height above the ground.

On a synthetic test scene (`worker/tests/test_classify.py`: sloped ground, a building, a tree, stray points) it gets 99 % of the ground, 84 % of the building, 92 % of the tree and all the stray points right. It takes about 6 s and 0.8 GB for 5.5 million points. It suits open terrain with buildings and trees (aerial and mobile scans). It does not suit interiors or single objects (a statue, a vase), where "ground" and "building" mean little; leave classification off for those, or use a model.

**A trained model (`command`).** `WORKER_POINTCLOUD_CLASSIFIER_CMD` runs any program with `{input}` (a LAS/LAZ to read) and `{output}` (a LAS to write). Examples are a segmentation model (Open3D-ML, KPConv, PointNet++, or a model trained on heritage classes such as wall, vault or column) or a PDAL pipeline. The program must keep the points, in the same count and order, and set their `classification`. Class colours and names beyond the ASPRS ones show as "Class N" in the viewer.

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_POINTCLOUD_CLASSIFY` | `off` | `off`, `auto` (only clouds whose classes are all 0/1), `always` |
| `WORKER_POINTCLOUD_CLASSIFIER` | `geometric` | `geometric` or `command` |
| `WORKER_POINTCLOUD_CLASSIFIER_CMD` | – | e.g. `python3 /models/segment.py {input} {output}` |
| `WORKER_POINTCLOUD_CLASSIFY_MAX_POINTS` | `60000000` | Larger clouds are tiled unclassified (the geometric classifier holds the cloud in memory, about 150 bytes per point). |
| `WORKER_POINTCLOUD_GROUND_CELL` | `1.0` | Ground grid cell, in the file's units (metres for most scans). |
| `WORKER_POINTCLOUD_GROUND_WINDOW` | `20.0` | Largest object the ground filter removes, e.g. a building's width. |
| `WORKER_POINTCLOUD_GROUND_SLOPE` | `0.3` | Terrain slope still taken as ground. |
| `WORKER_POINTCLOUD_GROUND_THRESHOLD` | `0.4` | Height above the ground surface still counted as ground. |
| `WORKER_POINTCLOUD_FEATURE_VOXEL` | `1.0` | Voxel size for the shape features. |

Only **Potree 2** output keeps the classes (the default when PotreeConverter is installed, as in the Docker image). 3D Tiles from py3dtiles carry only position and colour, so classification is skipped for them. The quick preview stays unclassified: it is written before classification, so it is not delayed. A failed classification is logged, and the cloud is then tiled as it was. `tiles/<name>.classification.json` records the classifier used, the points per class and the time taken.

Standalone: `python3 worker/classify.py in.las out.las`.

## 5. Suggested scene

Not a Claude feature either: rules in the viewer (`viewer/editor/scene-rules.js`). They need no worker and no key, and send nothing anywhere. Look > **Suggested scene** picks the sun, the weather, the raking light, the tone mapping and ambient occlusion for the model shown, from what the viewer knows of it:

- the texts: the file name, the metadata shown, and the manifest's labels, summaries, metadata and annotations (keywords in English, Polish and German: "castle", "wnętrze", "Inschrift", "winter", "fog"...; a year or century; coordinates);
- the manifest's place (`AIM3DViewer.location`), else coordinates written in the texts, else a town they name, found by the worker in GeoNames (below);
- the timeline's year;
- the model: its size in metres (in its unit) and proportions, its kind (mesh, point cloud, Gaussian splats, IFC) and its materials (textures, vertex colours, normals);
- the geometry's measures (`viewer/editor/scene-shape.js`, once per model, about 0.2 s for half a million triangles): the share of the surface facing up, down and sideways; the ground (upward faces at the bottom, over the footprint); and the enclosure. For the enclosure, 26 rays go from inside the box through a voxel grid of the surface. Walls turned towards the rays mean an interior (a room, a nave, a crypt); the backs of faces mean a closed building or statue seen from its own inside, which is no interior.

The geometry adds evidence to the setting: walls all round, seen from inside (indoors, the building's size counting with it); a ceiling over a floor (indoors, weakly); an open ground without a ceiling, or a flat, wide box (outdoors). A thin plate (its thinnest side under an eighth of its longest: a tablet, a tombstone, a coin) gets the raking light when documented.

First the **purpose**: *documentation* (an even light that hides nothing, raking light for inscriptions and relief, no weather) or *presentation* (the sun where and when the object stood, late in the afternoon by default, the sky, a weather the texts name). The rules suggest one, and the window switches to the other. Then the **setting**: outdoors, indoors or an object on its own. Scans and splats keep the lighting baked into them: no strong sun and no ambient occlusion. A phone gets no ambient occlusion and lighter weather.

Each suggestion shows how sure the rules are and why. The confident ones that change something are ticked. Nothing changes until **Apply**, and **Undo** restores the scene from before. Where the place is unknown, the window says so: the sun then stands at the default place. A place found with little certainty is shown as a guess, to check in Sun and shadows.

**Place names (GeoNames).** When the window opens and no place is set, the viewer sends the texts once per model to its own worker (`POST /api/geo/places`, `worker/geonames.py`). The worker finds the towns they name in a GeoNames dump, offline: "Zamek w Malborku" gives Malbork (54.04° N, 19.03° E). The texts go no further than the worker, and no key is needed. A worker without the dump, or no worker at all, leaves the place unknown. Setup: "Place search" in `worker/README.md`. GeoNames data is CC BY 4.0, and the window names GeoNames as the source.

**A language model in the browser.** Keywords miss synonyms and phrasing: "nawa główna", "Kreuzgang", "the altar seen from the choir". Below the suggestions, a button reads the texts with a small multilingual model ([multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small), about 120 MB, MIT), run in the browser by [transformers.js](https://huggingface.co/docs/transformers.js) (`viewer/editor/scene-semantic.js`). It cuts the texts into short passages and compares their embeddings with a few descriptions of each class in English, Polish and German: outdoors, an interior or an object on its own; documentation or a reconstruction; relief to read or not. The best matches become probabilities. The rules take them as weaker evidence than words found (a setting at 85 % counts for about as much as a building's name). Where no words decide, they settle the purpose and the raking light.

- Nothing is sent: the library and the weights are downloaded, once, and kept in the browser's cache. The texts stay in the browser.
- The first time, it runs on the user's click. After that the browser remembers the consent, and the model reads the texts by itself whenever the rules are unsure of the setting (below 60 %).
- `viewer.sceneSuggest.semantic` in `viewer-settings.json` turns it off (`false`) or points it at other hosts: the library, the model and ONNX Runtime's `.wasm` files can be served by the deployment itself (see [viewer-settings](viewer-settings.md)). By default they come from jsDelivr and the Hugging Face hub.

A later step can ask Claude when both are unsure. It would get the same facts (the texts and the measured descriptors, never the model) and answer in the same structure.

## Tests

```bash
python3 -m unittest discover -s worker/tests
```

The AI tests replace the Claude client with a stand-in, so they need no key and no network. The classification tests need `numpy` and `laspy` (both in the worker image). The viewer's side is covered by the `AI:` tests and "point clouds classified by the worker" in `tests/viewer.spec.ts`.
