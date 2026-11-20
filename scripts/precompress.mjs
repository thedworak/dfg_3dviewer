#!/usr/bin/env node
// Brotli (.br) and gzip (.gz) copies of a build's code, made once at the
// strongest settings, for the Docker image's nginx (docker/nginx.conf):
// .br for a client that accepts Brotli, .gz (gzip_static) for the others,
// instead of nginx's quick on-the-fly gzip (level 5).
//
//   node scripts/precompress.mjs dist/test
//
// What it compresses: the scripts, stylesheets, WebAssembly and SVG images
// of the build - files that change only with a new build. Not the HTML pages,
// viewer-settings.json or manifests/: those are edited on the server (the
// Docker entrypoint, admins), and a stale copy would be served in their
// place. Not the models either (binary or compressed already). A copy is
// kept only when it is at least 10% smaller; older copies are replaced.
import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const COMPRESSIBLE = /\.(js|mjs|css|wasm|svg)$/;
const MIN_BYTES = 1024;
const MAX_RATIO = 0.9;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else if (entry.isFile()) yield file;
  }
}

async function compress(file) {
  const data = await fs.readFile(file);
  if (data.length < MIN_BYTES) return null;
  const [br, gz] = await Promise.all([
    brotli(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
        [zlib.constants.BROTLI_PARAM_MODE]: /\.wasm$/.test(file)
          ? zlib.constants.BROTLI_MODE_GENERIC
          : zlib.constants.BROTLI_MODE_TEXT,
      },
    }),
    gzip(data, { level: zlib.constants.Z_BEST_COMPRESSION }),
  ]);
  const written = { raw: data.length, br: 0, gz: 0 };
  for (const [ext, packed] of [['br', br], ['gz', gz]]) {
    const target = `${file}.${ext}`;
    if (packed.length <= data.length * MAX_RATIO) {
      await fs.writeFile(target, packed);
      written[ext] = packed.length;
    } else {
      await fs.rm(target, { force: true });
    }
  }
  return written;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/precompress.mjs <build directory, e.g. dist/test>');
    process.exit(2);
  }
  const files = [];
  for await (const file of walk(dir)) if (COMPRESSIBLE.test(file)) files.push(file);

  // A few at a time: zlib runs them on libuv's thread pool (4 threads).
  const totals = { files: 0, raw: 0, br: 0, gz: 0 };
  const queue = [...files];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let file; (file = queue.shift()); ) {
      const result = await compress(file);
      if (!result) continue;
      totals.files += 1;
      totals.raw += result.raw;
      totals.br += result.br || result.raw;
      totals.gz += result.gz || result.raw;
    }
  }));
  const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
  console.log(`precompress: ${totals.files} files in ${dir}, ${mb(totals.raw)} -> ${mb(totals.br)} brotli, ${mb(totals.gz)} gzip`);
}

await main();
