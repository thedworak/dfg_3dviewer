# Image analysis — "4D" app-icon emblem (ref.png, 1024×1024 RGBA, transparent bg)

All coordinates are reference-image pixels (x right, y down). Observations first; inferences marked (inf).

## L1 Identification
- Work type: stylised logotype emblem / app-icon foreground. Broad class: graphic signage object (flat panels + extruded lettering + spheres).
- primaryDomain: object. Confidence 0.9.

## L2 Form & silhouette
- Asymmetric composition, geometric shape language. Bounding box x 82–942, y 132–893.
- Three thin rectangular slabs (panels) with rounded corners, all turned ~55–65° about the vertical axis so their right (proximal) edges are nearer the camera. Vertical edges stay vertical in the image → rotation is purely about world Y; top/bottom edges converge leftward (perspective, vanishing point ≈ (-262, 480) for the front panel).
- One transparent glass slab between front and middle panels.
- Extruded "4" and "D" glyphs, frontal (not rotated), in front of the middle/back panels.
- 11 spheres scattered around the glyphs.

## L3 Decomposition
- macro: panelFront(blue), panelGlass, panelMiddle(red), panelBack(dark blue), glyph4, glyphD, sphereCluster.
- meso: each panel = slab + emissive rim frame; glyph = front cap + bevel + side walls (+ counter hole); sphere cluster = 11 spheres.
- micro: printed imagery on panels (statue head with node/line network, Corinthian column capital, dark sculpted relief), specular highlight bands on glyph caps, specular dots on spheres.

## L4 Spatial relationships (object space)
- <panelFront, in-front-of, panelGlass>; <panelGlass, in-front-of, panelMiddle>; <panelMiddle, in-front-of, panelBack> (depth order front→back).
- Panel image-space corners (TL, TR, BR, BL):
  - front(blue): (90,285) (352,140) (352,885) (90,712)
  - glass:       (250,290) (440,245) (440,840) (250,695)
  - middle(red): (355,238) (520,165) (520,810) (355,740)
  - back(dark):  (520,262) (645,215) (645,770 inf, hidden) (520,730 inf, hidden)
- <glyph4, in-front-of, panelMiddle+panelBack>; <glyphD, right-of, glyph4> gap ~10px; both baselines at y≈830, cap height y≈476.
- glyph4 outline: (600,477)(677,477)(677,830)(600,830)(600,757)(420,757)(407,735)→diagonal to (600,477); triangular counter (603,580)(603,700)(523,700).
- glyphD: bbox x 687–937, y 475–830; straight stem, top/bottom straight until x≈807 then semicircular bowl; counter x 753–863, y 542–763.
- Spheres (cx,cy,r): (670,430,30) (718,398,13) (520,432,11) (545,500,18) (509,552,20) (540,537,6) (928,538,13) (790,656,17) (806,699,18) (570,802,19) (539,829,10). All floating (no contact) — they are free-floating props.

## L5 Materials (PBR)
- Panels: dielectric, low roughness (~0.2), printed albedo image, rim frames emissive (glow halo).
- Glass: transparent dielectric, roughness ~0.05, opacity ~0.15, bright cyan-white rim.
- Glyphs: glossy dielectric (clearcoat), roughness ~0.15, gradient albedo, strong specular bands.
- Spheres: glossy dielectric, roughness ~0.1, one specular highlight upper-left.

## L6 Colour & finish
- Front panel fill: vivid blue (0,38,197) top → (0,130,251) lower; rim cyan (100,220,255).
- Middle panel: vivid red (214,0,18)/(223,5,19); left strip under glass magenta; rim red (255,60,60).
- Back panel: dark desaturated blue (11,78,124)/(3,98,163); rim sky blue (40,170,255).
- Glyph 4: gradient stops top-left cyan (90,250,251) → mid (0,146,250) → right deep blue (0,90,230); stem foot peach/orange (255,170,120).
- Glyph D: stem violet (90,20,230) → centre pink (237,43,130) → bowl right violet (114,17,241); bottom red-coral (251,75,81); rim highlight pink-white (251,186,172).
- Spheres: blue (0,110,245) ×8, red (230,20,40) ×2, violet (143,67,249) ×1.

## L7 Identity features
- Receding panel stack with converging edges (the "angles").
- Printed statue head / column / relief imagery on the three panels.
- Chunky rounded "4D" with triangular counter in the 4 and cyan→blue / violet→pink gradients.
- Satellite spheres.

## L8 Uncertainty
- Back sides of panels and glyphs: hidden — assume back of panel = mirrored-dim printing, glyph back = side colour.
- Lower part of back panel occluded by glyph 4 (inf corners).
- Panel imagery under glyphs/spheres occluded → must be inpainted, low confidence.
- The illustration is not a strictly consistent perspective (glass bottom slope 0.79 vs front 0.66); per-panel back-projection keeps each panel's own measured angles.
- Depth of each panel is not observable; chosen to preserve front-to-back order and avoid interpenetration.
