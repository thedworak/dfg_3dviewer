# ExPlora4D website

The homepage of [explora4d.eu](https://explora4d.eu): what the viewer does, the
Level of Certainty scale, the standards and the technology behind it.

It is a separate static site, not part of the viewer: no build step, and it is
left out of every viewer build (`rollup.config.js` copies only listed
folders into `dist/`) and of the Docker build context (`.dockerignore`).

```
website/
  index.html                    the page (English, Polish and German in one file)
  img/                          model screenshots, the two logo variants, favicon
  scripts/capture-screenshots.mjs   re-renders the screenshots from the viewer
```

## Preview and deploy

Open `index.html` directly, or serve the folder:

```bash
npx serve website
```

To publish, copy the folder's contents (`index.html` and `img/`) to the web
root of explora4d.eu. Fonts load from Google Fonts; the viewer links point to
`https://ExPlora4D.thedworak.com`.

## Languages and theme

The English text is the page's own HTML. Polish and German are the `strings`
dictionaries in the script at the end of `index.html`, keyed by the elements'
`data-i18n` (text), `data-i18n-alt` (image alt) and `data-i18n-aria`
(labels) attributes; a key missing from a dictionary falls back to English.
The captions of the six model views are in `notes`.

The first visit follows the browser's language and the system's light or dark
setting; the header switches override both and are remembered
(`localStorage`: `explora4d-lang`, `explora4d-theme`).

## Screenshots

The six views of the Wołpa synagogue (`img/original.webp`, `clay-ao`,
`raking`, `contours`, `normals`, `certainty`) are rendered by the viewer
itself from the example manifests in `viewer/manifesto/examples`. After a
visual change to the viewer, render them again:

```bash
pnpm run build:test
HOST=127.0.0.1 PORT=4173 DIST_DIR=dist/test node scripts/serve-dist.js &
node website/scripts/capture-screenshots.mjs
```

The logos in `img/` are copies of `viewer/img/logo/ExPlora4D*.webp`.
