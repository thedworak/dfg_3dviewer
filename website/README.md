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
The captions of the model views are in `notes`.

The first visit follows the browser's language and the system's light or dark
setting; the header switches override both and are remembered
(`localStorage`: `explora4d-lang`, `explora4d-theme`).

## Screenshots

The views of the Wołpa synagogue in the hero (`img/original.webp`, `section`,
`annotations`, `clay-ao`, `raking`, `contours`, `normals`, `certainty`,
`golden-hour`, `night`, `wireframe`, `measurement`; `section` is also the phone screen in the Mobile
section) are rendered by the viewer
itself from the example manifests in `viewer/manifesto/examples`. After a
visual change to the viewer, render them again:

```bash
pnpm run build:test
HOST=127.0.0.1 PORT=4173 DIST_DIR=dist/test node scripts/serve-dist.js &
node website/scripts/capture-screenshots.mjs
```

The logos in `img/` are copies of `viewer/img/logo/ExPlora4D*.webp`.

## App store badges and QR codes

The Mobile section links to the app with the official badges (Google Play in
English, Polish and German, swapped with the page's language; App Store in
English) and a QR code for each store. Until the app is published, the links
and codes are examples: Google Play uses the app's id from
`capacitor.config.json` (`com.thedworak.explora4d`), the App Store a
placeholder id. Once the store pages exist, change the two `href`s in the
Mobile section and render the codes again:

```bash
npx -y qrcode@1.5.4 -t svg -e M -q 1 -o website/img/qr-google-play.svg "https://play.google.com/store/apps/details?id=com.thedworak.explora4d"
npx -y qrcode@1.5.4 -t svg -e M -q 1 -o website/img/qr-app-store.svg "https://apps.apple.com/app/<name>/id<number>"
```

Then drop the "examples" sentence (`store.note`, in all three languages).
The badges come from Google's and Apple's badge pages and follow their usage
guidelines: shown unchanged, at the same height, linking to the app.
