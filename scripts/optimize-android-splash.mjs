// Run by `pnpm run cap:assets` after @capacitor/assets: it writes every
// splash density as PNG, which for a full-bleed, photo-like splash is several
// MB each (tens of MB in the APK). Lossy WebP keeps it at a fraction of that;
// Android reads it natively (minSdk 24), and @drawable/splash still resolves
// because only the extension changes.
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RES_DIR = 'android/app/src/main/res';
const QUALITY = 82;

let before = 0;
let after = 0;
for (const dir of await readdir(RES_DIR)) {
  if (!dir.startsWith('drawable')) continue;
  const png = path.join(RES_DIR, dir, 'splash.png');
  const pngSize = await stat(png).then((s) => s.size, () => 0);
  if (!pngSize) continue;
  const webp = path.join(RES_DIR, dir, 'splash.webp');
  await sharp(png).webp({ quality: QUALITY }).toFile(webp);
  // Two files named "splash" in one folder would not build.
  await unlink(png);
  before += pngSize;
  after += (await stat(webp)).size;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
console.log(`splash: ${mb(before)} MB PNG -> ${mb(after)} MB WebP`);
