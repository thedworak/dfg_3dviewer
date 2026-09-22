// Parcel's dev server only serves files that are part of its bundle graph
// (referenced via import/href/src) and falls back to the HTML entry for any
// other request (SPA-style), even for a literal existing file on disk. This
// app fetches several files at runtime by constructing plain string paths
// instead of importing them - viewer-settings.json, the example 3D models
// under viewer/examples, and their rendered gallery thumbnails - so without
// this proxy those requests would just get index/dev.html's markup back
// instead of the real file. See https://parceljs.org/features/plugins/#.proxyrc
const fs = require("fs");
const http = require("http");
const path = require("path");

const PROJECT_ROOT = __dirname;

// viewer/ui/upload-panel.js and viewer/status-poller.js call /api/... and
// /files/... as plain same-origin fetch()es, same as the Drupal integration
// and the docker/nginx.conf reverse proxy used by `docker compose up`. This
// dev server has no such proxy by default, so those requests would silently
// fall through to Parcel's SPA fallback (dev.html) instead of 404ing or
// erroring - which authRequest() in upload-panel.js then swallows as "older
// worker without /api/auth/*", making the whole login-required flow behave
// as if accounts were off. Forward them to a worker started separately, e.g.
// `cd worker && WORKER_AUTH_MODE=required python3 server.py` (see
// worker/README.md), or `docker compose up worker`, both of which default to
// :8080.
const WORKER_PROXY_TARGET = new URL(
  process.env.WORKER_DEV_PROXY_URL || `http://127.0.0.1:${process.env.WORKER_PORT || 8080}`
);

function proxyToWorker(req, res) {
  const upstream = http.request(
    {
      hostname: WORKER_PROXY_TARGET.hostname,
      port: WORKER_PROXY_TARGET.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: WORKER_PROXY_TARGET.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Worker unreachable at ${WORKER_PROXY_TARGET}: ${err.message}` }));
  });
  req.pipe(upstream);
}

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
    const urlPath = (req.url || "").split("?")[0];
    if (urlPath.startsWith("/api/") || urlPath.startsWith("/files/")) {
      return proxyToWorker(req, res);
    }
    next();
  });

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
