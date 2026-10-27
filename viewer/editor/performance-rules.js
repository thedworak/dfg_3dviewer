// The weighing of a model against the device (editor/performance.js), pure:
// no three.js, so it runs in tests alone.

// Triangles (or splats) a device of each kind draws smoothly, about.
const TRIANGLE_BUDGET = { low: 1_500_000, phone: 4_000_000, desktop: 15_000_000 };
// GPUs drawn in software.
const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i;

// The kind of device, from what the browser tells: "low", "phone" or
// "desktop". `info`: { coarse, memory, cores, gpu }.
export function deviceTier(info = {}) {
  const { coarse = false, memory = null, cores = null, gpu = "" } = info;
  if (SOFTWARE_GPU.test(gpu || "")) return "low";
  if (coarse && ((memory && memory <= 4) || (cores && cores <= 4))) return "low";
  if (coarse) return "phone";
  if ((memory && memory <= 2) || (cores && cores <= 2)) return "low";
  return "desktop";
}

// The level a model of `triangles` needs on a device of `tier`: null when
// it fits, else "balanced" (up to twice the budget) or "fast".
export function qualityForWeight(triangles, tier) {
  const budget = TRIANGLE_BUDGET[tier] ?? TRIANGLE_BUDGET.desktop;
  if (!(triangles > budget)) return null;
  return triangles > budget * 2 ? "fast" : "balanced";
}
