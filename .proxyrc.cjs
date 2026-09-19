// Parcel's dev server only serves files that are part of its bundle graph
// (referenced via import/href/src) and falls back to the HTML entry for any
// other request (SPA-style), even for a literal existing file on disk. This
// app fetches several files at runtime by constructing plain string paths
// instead of importing them - viewer-settings.json, the example 3D models
// under viewer/examples, and their rendered gallery thumbnails - so without
// this proxy those requests would just get index/dev.html's markup back
// instead of the real file. See https://parceljs.org/features/plugins/#.proxyrc
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = __dirname;

const MIME_TYPES = {
  ".json": "application/json",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".hdr": "application/octet-stream",
  ".exr": "application/octet-stream",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".stl": "model/stl",
  ".obj": "text/plain",
  ".mtl": "text/plain",
  ".ply": "text/plain",
  ".dae": "application/xml",
  ".fbx": "application/octet-stream",
  ".ifc": "application/octet-stream",
  ".pcd": "text/plain",
  ".xyz": "text/plain",
  ".3ds": "application/octet-stream",
  ".abc": "application/octet-stream",
  ".usd": "application/octet-stream",
  ".usda": "text/plain",
  ".usdc": "application/octet-stream",
  ".usdz": "model/vnd.usdz+zip",
  ".3mf": "model/3mf",
  ".amf": "application/xml",
  ".wrl": "model/vrml",
  ".kmz": "application/vnd.google-earth.kmz",
  ".vox": "application/octet-stream",
  ".lwo": "application/octet-stream",
  ".wasm": "application/wasm",
};

// Mirrors the copyDirectory() calls in rollup.config.js, which is what
// produces this same "assets/<x>" layout next to the bundled module in every
// real build (dist/test, dist/dev, dist/prod, dist/drupal). viewer-settings.json
// is shared as-is between dist and this dev entry (see main.js's moduleUrl
// fallback), and its "examples/..." paths (e.g. gallery testImages) are
// written for that dist layout, where examples/ sits next to index.html - so
// those need the same "examples/" -> "viewer/examples/" alias here too.
const ASSET_DIR_ALIASES = [
  ["/assets/css/", path.join(PROJECT_ROOT, "viewer", "css") + path.sep],
  ["/assets/img/", path.join(PROJECT_ROOT, "viewer", "img") + path.sep],
  ["/assets/fonts/", path.join(PROJECT_ROOT, "viewer", "fonts") + path.sep],
  ["/assets/maps/", path.join(PROJECT_ROOT, "viewer", "js", "maps") + path.sep],
  ["/assets/ifc/", path.join(PROJECT_ROOT, "node_modules", "web-ifc") + path.sep],
  ["/examples/", path.join(PROJECT_ROOT, "viewer", "examples") + path.sep],
  ["/manifests/", path.join(PROJECT_ROOT, "viewer", "manifesto", "examples") + path.sep],
];

function resolveFilePath(urlPath) {
  if (urlPath === "/viewer-settings.json" || urlPath.startsWith("/viewer/")) {
    return path.normalize(path.join(PROJECT_ROOT, urlPath));
  }
  for (const [prefix, dir] of ASSET_DIR_ALIASES) {
    if (urlPath.startsWith(prefix)) {
      return path.normalize(path.join(dir, urlPath.slice(prefix.length)));
    }
  }
  return null;
}

module.exports = function (app) {
  app.use((req, res, next) => {
    const urlPath = decodeURIComponent((req.url || "").split("?")[0]);
    const filePath = resolveFilePath(urlPath);
    if (!filePath || !filePath.startsWith(PROJECT_ROOT + path.sep)) {
      return next();
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        return next();
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
  });
};
