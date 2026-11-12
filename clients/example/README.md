# Client profile: example

A template for a client's look and addresses. Copy the folder, rename it
(`clients/<id>/`) and edit:

- `viewer-settings.json` - merged over the viewer's settings at build time:
  `branding` (name, title, favicon, logo, colours, stylesheet), addresses
  (`mainUrl`, `metadataUrl`, `viewer.bugReport.url`, `viewer.credits`...)
  and any other setting.
- `brand/` - the client's files, copied to `<build>/brand/`.
- `viewer.intro.scene` - the intro with another model; here the built-in
  Tempietto scene (docs/intro.md, "Another model").

Build with `BRAND=<id>`, e.g. `cross-env BRAND=example BUILD=prod BUILD_SOURCE='' rollup -c`.
See [docs/branding.md](../../docs/branding.md).
