// The intro's time travel (viewer/intro/feature-tour.js) from the 4D model,
// viewer/examples/4D/WolpaSynagogue_4D.glb (55 MB - too much for the intro):
// its stages differ only in the textures of five exterior parts, each
// "fresh", "mid" or "old" (the last being the textures of the model the
// intro shows anyway). This takes the fresh and mid textures, smaller and as
// WebP, and the stages' table:
//
//   node scripts/build-intro-time.mjs [4d-model.glb]
//
// Writes viewer/intro/time/<part>_<fresh|mid>.webp and viewer/intro/time/time.json:
//   { parts: { <part>: <the intro model's material name> },
//     stages: [ { year, label, parts: { <part>: "fresh" | "mid" | "old" } } ] }
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const modelPath = process.argv[2] || 'viewer/examples/4D/WolpaSynagogue_4D.glb';
const outDir = 'viewer/intro/time';
const MAX_SIZE = 1024;

// The five parts: their material name in the intro's model
// (WolpaSynagogue-progressive.glb) and the 4D model's image name prefix.
const PARTS = {
  trim: 'wood_cabinet_worn_long_diff_2k',
  roof: 'roof_slates_02_diff_2k',
  walls: 'walls',
  frames: 'window frames',
  door: 'wooden door',
};

const glb = await fs.readFile(modelPath);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8;

function imageBytes(index) {
  const view = json.bufferViews[json.images[index].bufferView];
  const start = binStart + (view.byteOffset || 0);
  return glb.subarray(start, start + view.byteLength);
}

// The variant a texture is: "<part>_fresh", "<part>_mid", or else old.
function variantOf(textureIndex) {
  const name = json.images[json.textures[textureIndex].source].name || '';
  const match = name.match(/^(\w+)_(fresh|mid)$/);
  return match ? match[2] : 'old';
}

await fs.mkdir(outDir, { recursive: true });
let bytes = 0;
for (const [index, image] of json.images.entries()) {
  const match = (image.name || '').match(/^(\w+)_(fresh|mid)$/);
  if (!match || !PARTS[match[1]]) continue;
  const out = path.join(outDir, `${image.name}.webp`);
  const data = await sharp(imageBytes(index))
    .resize({ width: MAX_SIZE, height: MAX_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  await fs.writeFile(out, data);
  bytes += data.length;
}

const stages = [];
for (const node of json.nodes) {
  const extras = node.extras;
  if (!extras || typeof extras.year !== 'number' || node.mesh == null) continue;
  const parts = {};
  for (const primitive of json.meshes[node.mesh].primitives) {
    const material = json.materials[primitive.material];
    const part = (material.name || '').split('_')[0];
    const texture = material.pbrMetallicRoughness?.baseColorTexture?.index;
    if (PARTS[part] && texture != null) parts[part] = variantOf(texture);
  }
  stages.push({ year: extras.year, label: extras.label || String(extras.year), parts });
}
stages.sort((a, b) => a.year - b.year);

await fs.writeFile(path.join(outDir, 'time.json'), `${JSON.stringify({ parts: PARTS, stages }, null, 2)}\n`);
console.log(`${stages.length} stages, textures ${(bytes / 1024 / 1024).toFixed(2)} MB -> ${outDir}`);
