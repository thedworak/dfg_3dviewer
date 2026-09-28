# Icon 4D emblem — Three.js model

A procedural Three.js rebuild of `../icon-foreground.png`, made with the
[img2threejs](https://github.com/img2threejs/img2threejs) pipeline (v2.0.0, generic profile).

## Run it

Serve `viewer/` over HTTP and open `index.html`. three.js 0.186.1 loads from jsDelivr.

```bash
cd resources/icon-3d/viewer && python3 -m http.server 8080
# http://localhost:8080/            orbit with the mouse, "explode" slider, click a part to name it
# http://localhost:8080/?stage=material   intermediate build stages: none | form | material | lighting | interaction | optimization
```

## Files

| Path | What it is |
|------|------------|
| `src/createIcon4dEmblemModel.ts` | Factory generated from the spec (`generate_threejs_factory.py`). Returns a `THREE.Group` with named pivots, sockets, colliders and destruction groups in `userData`. Do not edit by hand: change the spec and regenerate |
| `src/icon4dLookDev.ts` | Hand refinements on top of the factory: glyph bevels, the projected print material, lights, explode and part picking. `applyIcon4dLookDev(group, 'optimization')` |
| `viewer/` | Compiled JS, the page, `panel-texture.png` and `glyph-texture.png` (projection sources), and `maps/` (128 px evidence PBR maps the generated materials load) |
| `object-sculpt-spec.json` | Sculpt spec: components, materials, camera, review history, waivers |
| `evidence/` | Image analysis, suitability, projection route, material analysis, part coverage, final comparison and orbit sheets |

## How it is built

- **Geometry.** Panel corners, glyph outlines and sphere centres were measured on the icon in
  pixels. They were then back-projected through a reference camera (vertical FOV 60°, at
  (0, 0, 11), looking at the origin). The panels are real slabs rotated 49–53° about Y.
- **Surfaces.** The printed panels and the glyph faces use projective texturing from that camera,
  computed per fragment. Each projector follows its own part's rest pose, so the prints stay
  attached when the model is exploded.
- **Choices that are inferred, not observed.** The depth of each panel, the FOV (chosen so panels
  come out about 1.2:1 instead of 1.6:1 when seen from the side), the back faces, and the print
  under the glyphs and spheres (inpainted).

## Verification (final build)

- Tier-1 against the icon: silhouette IoU 0.9546, aspect-ratio delta 0.022, scale delta 0.050.
- Multi-angle check over 6 views: no degenerate view.
- Part coverage: 22 of 22 specified components built, 0 errors, 0 warnings.
- Strict spec validation passes.

**Waived gate.** The Tier-1 per-part colour gate (ΔE ≤ 20 against the render's top 5 colour
clusters) cannot be passed by this emblem, which has 8 or more hues. The icon itself scores 42.2
on it and the render scores 38.6. Cluster to cluster, render and icon differ by ΔE 4–15. The owner
accepted this deviation (`userWaivers` in the spec). Because of the waiver, the pipeline credited
the passes through form refinement. The surface, lighting, interaction and optimization passes were
built and reviewed with the same renders but are recorded under `uncreditedReviews`.

## Known limits

- One reference view only. From steep orbit angles the projected print stretches, and panel backs
  show the print mirrored.
- The glow halo around the rims is not reproduced (there is no bloom pass).
