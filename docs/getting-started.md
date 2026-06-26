# Getting started

## Requirements

- **Node.js 24+** (the CI workflow uses Node 24).
- A modern browser with WebGL.
- Optional: **PHP CLI** and **SQLite** if you want to run the [admin panel](admin-panel.md).

## 1. Install dependencies

```bash
npm install
```

## 2. Create the runtime settings file

The viewer reads `viewer-settings.json` at runtime when running from source. Start from the
example template:

```bash
cp viewer/viewer-settings-example.json viewer-settings.json
```

!!! note
    There are two example templates: `viewer/viewer-settings-example.json` (used by the build
    to seed `dist/.../viewer-settings.json`) and a root `viewer-settings-example.json`. For the
    dev server, copy the file to the repository root as `viewer-settings.json`, which is the
    file the Rollup build and the running app look for. See
    [viewer-settings.json](viewer-settings.md) for the full reference.

## 3. Start the dev server

The dev server is powered by **Parcel** and serves the demo at
[http://localhost:1234](http://localhost:1234):

```bash
npm run dev:test     # BUILD_SOURCE=IIIF BUILD=test
# or
npm run dev:dev      # BUILD_SOURCE=''   BUILD=test
```

Open [http://localhost:1234](http://localhost:1234). `index.html` provides a model picker for
the bundled example models and a dark-mode toggle.

## 4. Build and preview a static bundle

To create a static `dist/` bundle with Rollup and preview it locally:

```bash
npm run build:test   # writes dist/test/
npm run serve:dist   # serves the dist folder via the `serve` package (BUILD=test)
```

See [Build targets](build-targets.md) for every output target and
[npm scripts](npm-scripts.md) for the full script list.

!!! warning "Always serve over HTTP(S)"
    Opening the viewer via `file://` usually fails because of ES module import and `fetch`
    restrictions. Use the dev server or `npm run serve:dist`.
