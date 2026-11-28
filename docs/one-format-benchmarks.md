# The One (`.one4d`): what it gains, measured

The same model delivered five ways and opened in the viewer, over three
throttled networks (`scripts/one-bench.mjs`). The model is the Pagoda
(`viewer/examples/pagoda/Pagoda-progressive.glb`, 3.14 MB, a GLB without
Meshopt or Draco) with its lighter preview (0.64 MB).

| Delivery | What the viewer does |
|---|---|
| GLB | downloads the model, shows it |
| GLB + preview.glb | what the viewer does today with a converted model: asks for `<name>.preview.glb` (HEAD), shows it, downloads the model, swaps it in |
| ZIP (deflated) | downloads the archive whole, unpacks it, shows the model |
| .one4d, stored | the preview and the model as two levels of detail in one file, read by range: `one.json`, then the coarse level, then the fine one |
| .one4d, deflated | the same, the parts deflated (they shrink by ~20%: the GLB is not compressed) |

## Results

Measured on 2026-11-28; median of 3 runs; times from the first request for the
model (the viewer's own start-up, the same for all, is left out). "Shown":
the viewer shows something of the model (`viewer.modelLoaded`); "Full": the
full model is shown (`fullModelLoaded`).

### fast (50 Mb/s, 20 ms)

| Delivery | Requests | Shown after | Bytes until shown | Full model after | Bytes in all |
|---|---:|---:|---:|---:|---:|
| GLB | 1 | 3.2 s | 3.14 MB | 5.2 s | 3.14 MB |
| GLB + preview.glb | 3 | 1.7 s | 0.64 MB | 6.7 s | 3.78 MB |
| ZIP (deflated) | 3 | 3.6 s | 2.42 MB | 5.7 s | 2.42 MB |
| .one4d, 2 LoD, stored | 3 | 1.6 s | 0.70 MB | 6.9 s | 3.85 MB |
| .one4d, 2 LoD, deflated | 3 | 1.5 s | 0.60 MB | 7.1 s | 3.01 MB |

### 4G (9 Mb/s, 85 ms)

| Delivery | Requests | Shown after | Bytes until shown | Full model after | Bytes in all |
|---|---:|---:|---:|---:|---:|
| GLB | 1 | 6.2 s | 3.14 MB | 8.3 s | 3.14 MB |
| GLB + preview.glb | 3 | 3.3 s | 0.64 MB | 10.7 s | 3.78 MB |
| ZIP (deflated) | 3 | 6.4 s | 2.42 MB | 8.6 s | 2.42 MB |
| .one4d, 2 LoD, stored | 3 | 3.2 s | 0.70 MB | 10.4 s | 3.85 MB |
| .one4d, 2 LoD, deflated | 3 | 3.3 s | 0.60 MB | 10.0 s | 3.01 MB |

### 3G (1.6 Mb/s, 300 ms)

| Delivery | Requests | Shown after | Bytes until shown | Full model after | Bytes in all |
|---|---:|---:|---:|---:|---:|
| GLB | 1 | 22.4 s | 3.14 MB | 25.2 s | 3.14 MB |
| GLB + preview.glb | 3 | 11.2 s | 0.64 MB | 33.3 s | 3.78 MB |
| ZIP (deflated) | 3 | 22.5 s | 2.42 MB | 25.1 s | 2.42 MB |
| .one4d, 2 LoD, stored | 3 | 11.1 s | 0.70 MB | 32.5 s | 3.85 MB |
| .one4d, 2 LoD, deflated | 3 | 10.6 s | 0.60 MB | 28.7 s | 3.01 MB |

### The files

| Delivery | Files | Size | Range reads | Checksums |
|---|---:|---:|---|---|
| GLB | 1 | 3.14 MB | whole file | none |
| GLB + preview.glb | 2 | 3.78 MB | whole files | none |
| ZIP (deflated) | 1 | 2.42 MB | no (deflated: whole) | CRC-32 |
| .one4d, stored | 1 | 3.78 MB | yes, per part | CRC-32 + SHA-256 per file |
| .one4d, deflated | 1 | 2.95 MB | yes, per part | CRC-32 + SHA-256 per file |

.one4d overhead over its parts: 1250 bytes. One damaged byte detected by verify: yes (intact file verified: yes).

## What this says

**Shown twice as fast as a plain GLB or a ZIP, on every network.** The
`.one4d` shows its coarse level after 1.5 s (fast), 3.2 s (4G), 10.6 s
(3G), against 3.2 s, 6.2 s and 22.4 s for the GLB alone, and about the same
for the ZIP, which must arrive whole before anything can be unpacked.

**As fast as today's progressive loading, in one file instead of two.**
The `.one4d` matches GLB + preview.glb to within the noise (3 requests
each). `one.json` gives every part's place, so the coarse level is the
second request: no probe, no directory at the end of the file.

**Deflated parts make it smaller and the full model come sooner.** For a
GLB without Meshopt/Draco, deflating the parts saves 21% (3.01 MB against
3.78 MB for the two GLBs): on 3G the full model arrives 4.6 s sooner than
with GLB + preview.glb (28.7 s against 33.3 s). A ZIP is smaller still
(2.42 MB, it has no preview) but shows nothing early. With a GLB that is
compressed already (the server's conversion writes Meshopt and KTX2),
deflate gains little and parts stay stored - the writer only deflates
when it saves 10% or more.

**What it costs.** Progressive loading downloads the preview *and* the
full model and parses both: the full model comes later than with the GLB
alone (3G: 28.7 s against 25.2 s, fast: 7.1 s against 5.2 s). This is the
price of showing something early, the same as today's preview.glb. Levels
that refine one another instead of replacing one another (planned:
geometry streamed by level, as in 3D Tiles or COPC) would remove it.

**The files.** One file instead of two (or of a model, a preview, a
manifest, sounds, photos, a data table, a properties file... for a full
scene: *Save as .one4d* puts them all in). 1.25 KB of overhead over the
parts. Every part has a SHA-256 in `one.json`: one damaged byte in the
model is found by `one-pack.mjs verify` (and by `verify()` in the reader),
naming the damaged file; separate files carry no checksum at all. Any ZIP
tool still opens it.

## How it was measured, and its limits

- Headless Chromium (Playwright) with software WebGL (SwiftShader): parsing
  and first rendering take longer than on a device with a GPU, the same
  for every delivery.
- Throttling (Chrome DevTools Protocol) applies to the whole page: the
  viewer's own scripts share the bandwidth with the model in the first
  seconds, which is why "Shown" on 3G (10.6 s for 0.6 MB) is longer than
  the transfer alone.
- One model, a local server, 3 runs per case. Bytes are the response
  bodies and headers of the model's requests.

Run it again (the viewer must be built first):

```sh
pnpm run build:test
node scripts/one-bench.mjs --runs 3 --profiles fast,4g,3g [--model path/to/model.glb]
```

`--model` takes any GLB that has a `<name>.preview.glb` next to it.
