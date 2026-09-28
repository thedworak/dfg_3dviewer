# Projection route: REQUIRED (printed panel imagery)
- camera: camera.json (vertical FOV 40, yaw/pitch/roll 0, f = 512/tan(20deg) = 1406.7 px). Panels are back-projected
  from measured image corners along camera rays, so UV = reference pixel coordinate (exact camera match).
- delight_albedo.py run (delit.png, strength 0.2): output is a uniform x0.8 darkening (targetLuma 0 from the transparent
  background). The panel shading is authored artwork, not scene lighting, so the original pixels are projected;
  the de-lit image is recorded but rejected as albedo.
- occluded panel pixels under glyphs/spheres: inpainted per panel (inpaint.py -> panel-texture.png, mask occlusion-mask.png);
  confidence low for those regions (not visible from the reference view).
- bake descriptors: bake-panel-front.json, bake-panel-middle.json, bake-panel-back.json (runtime projection via UVs).
