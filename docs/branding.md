# Branding: one codebase, a look per client

Every deployment of the viewer can carry its own name, logo, colours,
favicon, page title and addresses without a fork: they are settings, in
the `branding` section of `viewer-settings.json` (read at runtime by
`viewer/branding.js`) and in the deployment's other settings (`mainUrl`,
`viewer.credits`, `viewer.bugReport`...). A client's settings and files can
also live in this repository as a **client profile** (`clients/<id>/`),
picked at build time with `BRAND=<id>`.

Without `branding` the viewer looks as it always did.

## What a deployment can change

| What | Setting | Notes |
|---|---|---|
| Name | `branding.name` | logo's `aria-label`, intro frame title (default `ExPlora4D`) |
| Page title | `branding.title` | `document.title`; with `BRAND` also written into the HTML |
| Favicon | `branding.favicon` | replaces `<link rel="icon">`; with `BRAND` also in the HTML |
| Browser bar colour | `branding.themeColor` | `<meta name="theme-color">` |
| Logo over the canvas | `branding.logo.src`, `.srcOnDark`, `.alt`, `.width`, `.height` | `srcOnDark` (optional) fades in over dark backgrounds; `"logo": false` hides the logo |
| Logo on rendered thumbnails | `branding.watermark` | default: the logo (`branding.logo.src`); a path: its own image; `false`: none. Blender renders: `RENDER_WATERMARK` (below) |
| Accent colours | `branding.colors.accent`, `.secondary`, `.strong`, `.glow` | a string for both themes, or `{ "dark": ..., "light": ... }` |
| Any other colour token | `branding.cssVariables` | `--viewer-*` variables (see `viewer/css/main.css`, `.viewer-wrapper`); flat, or split into `dark` / `light` |
| Fonts, layout, anything else | `branding.stylesheet` | a stylesheet loaded last; `branding.id` sets `<html data-brand="<id>">` to scope its rules |
| Backend addresses | `mainUrl`, `metadataUrl`, `baseNamespace`, `entity.*` | [viewer-settings.md](viewer-settings.md) |
| Credits window (logo, authors, funders, contact, changelog link) | `viewer.credits` | `changelog: false` hides the link |
| "Report a bug" target | `viewer.bugReport.url`, `viewer.errorTracking` | [error-tracking.md](error-tracking.md) |
| Model background, ground | `viewer.background`, `viewer.ground` | |
| Intro: its model | `viewer.intro.scene` | the same intro with another model - points, pins, sun study's place, texts ([intro.md](intro.md#another-model)); `enabled: false` turns it off |
| Intro: logo and name | `branding.logo`, `branding.name` | the intro page takes them from the same settings |
| Example lists | `viewer.exampleModelsUrl`, `viewer.exampleManifestsUrl` | |

Relative paths (logo, favicon, stylesheet) resolve against the viewer page,
like `viewer.credits.logo.src`: put the client's files next to
`index.html`, e.g. in `brand/`. Only `http(s)` URLs, relative paths and
`data:image/...` are accepted. A logo or watermark on another host needs
CORS headers to be drawn on thumbnails (without them the thumbnails go out
without it).

### The colour tokens

`branding.colors` sets the viewer's accent variables (`viewer/css/main.css`):

| Key | Variable | Used for | Default dark / light |
|---|---|---|---|
| `accent` | `--viewer-brand-accent` | active buttons, focus rings, loading, selected items | `#f5a524` / `#8a5300` |
| `secondary` | `--viewer-brand-secondary` | slider fills, numbers, secondary accents | `#d9c3a0` / `#4a3d2c` |
| `strong` | `--viewer-brand-strong` | fills behind white text (keep contrast ≥ 4.5:1) | `#4a3d2c` |
| `glow` | `--viewer-brand-glow` | translucent highlights (active rows, glows, the loading bar) | `#ffb300` |

Text on an accent fill takes `--viewer-on-accent` (dark on the dark theme's
amber, white on the light theme's darker one); set it in `cssVariables` when
an accent needs the other one.

The former names `--viewer-brand-gold`, `--viewer-brand-blue` and
`--viewer-brand-blue-strong` still work in brand stylesheets: they follow the
new ones.

Warnings (notices, hints, the measurement unit check, validation) have their
own orange, apart from the accent, and a triangle icon:
`--viewer-warning`, `--viewer-warning-bg`, `--viewer-warning-border`,
`--viewer-warning-text`. Panels cast `--viewer-panel-shadow`, and what floats
above them `--viewer-panel-shadow-raised`.

Panels, shells and texts have their own tokens (`--viewer-panel-bg`,
`--viewer-panel-text`, `--viewer-shell-bg`, `--metadata-*`...), set with
`branding.cssVariables`. Values may not contain `;`, `{`, `}`, `<`, `>`,
`\` or comments; names must be `--` plus letters, digits and dashes.

The light theme has darker accents than the dark one so they read on light
panels: give both (`{ "dark": "#ffb347", "light": "#b35900" }`) unless one
colour reads on both.

### Example

```json
"branding": {
  "id": "acme",
  "name": "Acme 3D",
  "title": "Acme - 3D collection",
  "favicon": "brand/favicon.svg",
  "themeColor": "#0b3d91",
  "logo": { "src": "brand/logo.svg", "srcOnDark": "brand/logo-on-dark.svg", "alt": "Acme" },
  "colors": {
    "accent": { "dark": "#ffb347", "light": "#b35900" },
    "secondary": { "dark": "#9ec5ff", "light": "#0b3d91" },
    "strong": "#0b3d91",
    "glow": "#ffb347"
  },
  "cssVariables": {
    "dark": { "--viewer-panel-bg": "rgba(8, 18, 38, 0.84)" }
  },
  "stylesheet": "brand/brand.css"
}
```

## Client profiles: `clients/<id>/`

```
clients/acme/
  viewer-settings.json   # merged over the build's settings
  brand/                 # copied to <build>/brand/
    logo.svg  logo-on-dark.svg  favicon.svg  brand.css
```

`clients/example/` is a complete template (with the Tempietto intro). Build with the profile:

```sh
BRAND=acme pnpm run build:prod        # or build:test, build:dev, build:drupal...
BRAND=acme docker compose up --build  # Docker: the BRAND build argument
```

- The profile's `viewer-settings.json` is merged over the settings the build
  starts from (objects key by key, anything else - strings, lists - replaced),
  then the build's own fixes apply (`test`/`dev`: empty `mainUrl`, editor on;
  `drupal`: `baseModulePath`).
- With a profile the generated `viewer-settings.json` is rewritten on every
  build (without one an existing file is kept).
- `branding.title` and `branding.favicon` also go into the built
  `index.html`, `embed.html` and `intro.html`, so the tab is right before the
  script runs.
- Docker keeps `viewer-settings.json` in a volume, seeded on the first start
  only ([docker.md](docker.md)): after switching profiles, remove the volume
  (`docker compose down -v`) or edit the file in it.
- Settings carried by an AIM3D manifest win over `viewer-settings.json`
  ([viewer-settings.md](viewer-settings.md)) - `branding` is not read from
  manifests, but addresses in a profile manifest are.
- A client's profile holds its name and addresses: keep it out of any public
  copy of this repository.

Without a profile, a deployment can do the same by hand: edit the deployed
`viewer-settings.json` and put the files beside it - no rebuild needed.

## Server-side renders

The worker's Blender thumbnails (`scripts/render.py`) draw `scripts/watermark.png`.
`RENDER_WATERMARK` in the worker's environment names another PNG; `""` or
`none` turns the watermark off.

## Not covered yet

- The intro's sound and timing are the same for everyone (the tagline can
  be changed per scene, `texts.<lang>.tagline`).
- The admin pages (`/exadmin/`) keep the default palette.
- Internal names stay as they are: the browser storage keys (`explora4d-*`),
  the Drupal module (`dfg_3dviewer`), the validation schema id. Visitors do
  not see them.
- The colour of the light markers in the editor (`viewer/editor/light-markers.js`).
