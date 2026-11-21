// Builds the pagoda - an original three-storey pagoda in the Japanese
// manner, the project's own model (geometry and textures made here, no
// outside sources) - and everything the viewer and the intro take from it:
//
//   viewer/examples/pagoda/Pagoda.glb               the model (JPEG textures, 2048 px)
//   viewer/examples/pagoda/Pagoda-progressive.glb   Meshopt + WebP (what the intro and the viewer open)
//   viewer/examples/pagoda/Pagoda-progressive.preview.glb  simplified, small textures
//   viewer/examples/pagoda/4D/Pagoda_4D.glb         the stages 1615-2025 (textures change)
//   viewer/intro/scenes/pagoda/time/                the intro's time travel: time.json and
//                                                   the fresh and mid textures (WebP, 1024 px)
//
//   node scripts/build-pagoda-examples.mjs [--quick]
//
// --quick: 256 px textures, for looking at the geometry. The intro's points
// come after it: node scripts/build-intro-points.mjs 200000
// viewer/examples/pagoda/Pagoda.glb viewer/intro/scenes/pagoda/points.bin
//
// Geometry: scripts/pagoda/pagoda.mjs; textures: scripts/pagoda/textures.mjs.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, weld, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { Builder } from './pagoda/builder.mjs';
import { MATERIALS, buildPagoda } from './pagoda/pagoda.mjs';
import { AGES, TEXTURES, makeTexture } from './pagoda/textures.mjs';

const QUICK = process.argv.includes('--quick');
const OUT = 'viewer/examples/pagoda';
const TIME_OUT = 'viewer/intro/scenes/pagoda/time';
const GENERATOR = 'ExPlora4D - scripts/build-pagoda-examples.mjs';

// The time travel's parts: part -> material name (the same here).
export const TIME_PARTS = { paint: 'paint', plaster: 'plaster', roof: 'roof', bronze: 'bronze', door: 'door' };

// The pagoda's (made up) history: when its parts were new again. Every
// stage gives each part's age; 2025 is the model as it is ("old"). Every
// stage has a short note (the intro shows it under its timeline, one line).
const STAGES = [
  { year: 1615, en: 'c. 1615 - built: new timber, fresh vermilion', pl: 'ok. 1615 – budowa: nowe drewno, świeży cynober', de: 'um 1615 - Bau: neues Holz, frisches Zinnoberrot', parts: { paint: 'fresh', plaster: 'fresh', roof: 'fresh', bronze: 'fresh', door: 'fresh' } },
  { year: 1640, en: '1640 - the vermilion darkens', pl: '1640 – cynober ciemnieje', de: '1640 - das Zinnoberrot dunkelt nach', parts: { paint: 'mid', plaster: 'fresh', roof: 'fresh', bronze: 'fresh', door: 'fresh' } },
  { year: 1685, en: '1685 - paint worn, the bronze browns', pl: '1685 – farba starta, brąz ciemnieje', de: '1685 - Farbe abgerieben, Bronze wird braun', parts: { paint: 'old', plaster: 'mid', roof: 'mid', bronze: 'mid', door: 'mid' } },
  { year: 1702, en: '1702 - first repair: repainted', pl: '1702 – pierwszy remont: nowa farba', de: '1702 - erste Instandsetzung: neu gestrichen', parts: { paint: 'fresh', plaster: 'fresh', roof: 'mid', bronze: 'mid', door: 'mid' } },
  { year: 1765, en: '1765 - moss in the roof tiles', pl: '1765 – mech na dachówkach', de: '1765 - Moos auf den Ziegeln', parts: { paint: 'mid', plaster: 'mid', roof: 'old', bronze: 'mid', door: 'old' } },
  { year: 1830, en: '1830 - new tiles and doors', pl: '1830 – nowe dachówki i drzwi', de: '1830 - neue Ziegel und Türen', parts: { paint: 'old', plaster: 'old', roof: 'fresh', bronze: 'old', door: 'fresh' } },
  { year: 1897, en: '1897 - restoration: paint and plaster', pl: '1897 – restauracja: farba i tynk', de: '1897 - Restaurierung: Farbe und Putz', parts: { paint: 'fresh', plaster: 'fresh', roof: 'mid', bronze: 'old', door: 'mid' } },
  { year: 1935, en: '1935 - the paint fades again', pl: '1935 – farba znów blednie', de: '1935 - die Farbe verblasst wieder', parts: { paint: 'mid', plaster: 'mid', roof: 'old', bronze: 'old', door: 'mid' } },
  { year: 1952, en: '1952 - post-war restoration', pl: '1952 – powojenna restauracja', de: '1952 - Restaurierung nach dem Krieg', parts: { paint: 'fresh', plaster: 'fresh', roof: 'fresh', bronze: 'old', door: 'old' } },
  { year: 1990, en: '1990 - weathered again', pl: '1990 – znów zwietrzała', de: '1990 - wieder verwittert', parts: { paint: 'mid', plaster: 'mid', roof: 'mid', bronze: 'old', door: 'old' } },
  { year: 2025, en: '2025 - today', pl: '2025 – dziś', de: '2025 - heute', parts: { paint: 'old', plaster: 'old', roof: 'old', bronze: 'old', door: 'old' } },
];

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ------------------------------------------------------------- geometry

const builder = new Builder(MATERIALS);
const facts = buildPagoda(builder);
const { triangles, vertices } = builder.stats();
console.log(`geometry: ${triangles} triangles, ${vertices} vertices, ${facts.height.toFixed(2)} m high`);

// --------------------------------------------------------------- images

const sizeOf = (name) => (QUICK ? 256 : TEXTURES[name].size);
const images = new Map(); // `${name}:${age}` -> { color: Buffer(jpeg), normal?: Buffer }
async function encode(raw, size, kind, quality) {
  const img = sharp(Buffer.from(raw), { raw: { width: size, height: size, channels: 3 } });
  return kind === 'webp' ? img.webp({ quality }).toBuffer() : img.jpeg({ quality, mozjpeg: true }).toBuffer();
}
async function imagesOf(name, age) {
  const key = `${name}:${age}`;
  if (images.has(key)) return images.get(key);
  const t0 = Date.now();
  const tex = makeTexture(name, age, sizeOf(name));
  const out = {
    color: await encode(tex.color, tex.size, 'jpeg', 88),
    normal: tex.normal ? await encode(tex.normal, tex.size, 'jpeg', 92) : null,
    raw: tex,
  };
  images.set(key, out);
  console.log(`texture ${key} ${tex.size}px ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return out;
}

// ------------------------------------------------------------- document

// A glTF document of the pagoda; materialFor(name) -> Material.
function newDocument() {
  const doc = new Document();
  doc.createBuffer();
  doc.getRoot().getAsset().generator = GENERATOR;
  return doc;
}

async function createMaterial(doc, name, age = 'old', suffix = '') {
  const spec = TEXTURES[name];
  const img = await imagesOf(name, age);
  const material = doc.createMaterial(`${name}${suffix}`)
    .setMetallicFactor(spec.metallic)
    .setRoughnessFactor(spec.roughness);
  const color = doc.createTexture(`${name}${suffix}_color`).setImage(img.color).setMimeType('image/jpeg');
  material.setBaseColorTexture(color);
  if (img.normal) {
    const normal = doc.createTexture(`${name}_normal`).setImage(img.normal).setMimeType('image/jpeg');
    material.setNormalTexture(normal).setNormalScale(1);
  }
  return material;
}

// The meshes (one per part, a primitive per material), sharing accessors
// when given (the 4D stages).
function createMeshes(doc, materialOf, shared = null) {
  const buffer = doc.getRoot().listBuffers()[0];
  const meshes = new Map();
  const accessors = shared || new Map();
  for (const [part, byMaterial] of builder.parts) {
    const mesh = doc.createMesh(part);
    for (const [matName, b] of byMaterial) {
      const key = `${part}/${matName}`;
      let acc = accessors.get(key);
      if (!acc) {
        const count = b.p.length / 3;
        const indices = count > 65535 ? new Uint32Array(b.i) : new Uint16Array(b.i);
        acc = {
          position: doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.p)).setBuffer(buffer),
          normal: doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.n)).setBuffer(buffer),
          uv: doc.createAccessor().setType('VEC2').setArray(new Float32Array(b.uv)).setBuffer(buffer),
          indices: doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer),
        };
        accessors.set(key, acc);
      }
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', acc.position)
        .setAttribute('NORMAL', acc.normal)
        .setAttribute('TEXCOORD_0', acc.uv)
        .setIndices(acc.indices)
        .setMaterial(materialOf(matName));
      mesh.addPrimitive(prim);
    }
    meshes.set(part, mesh);
  }
  return { meshes, accessors };
}

const MODEL_EXTRAS = {
  title: 'Pagoda',
  description: 'An original three-storey pagoda in the Japanese manner, made for ExPlora4D: geometry and textures generated by scripts/build-pagoda-examples.mjs. Not a reconstruction of a real building.',
  license: 'CC0-1.0',
  unit: 'm',
};

async function buildModel() {
  const doc = newDocument();
  const materials = {};
  for (const name of Object.keys(MATERIALS)) materials[name] = await createMaterial(doc, name);
  const { meshes } = createMeshes(doc, (m) => materials[m]);
  const scene = doc.createScene('Pagoda');
  const root = doc.createNode('Pagoda').setExtras(MODEL_EXTRAS);
  for (const [part, mesh] of meshes) root.addChild(doc.createNode(part).setMesh(mesh));
  scene.addChild(root);
  doc.getRoot().setDefaultScene(scene);
  return doc;
}

// The 4D model: a node per stage, every one the whole pagoda with that
// stage's materials (geometry shared), and the timeline in the scene's
// extras (as viewer/timeline.js reads it).
async function buildModel4D() {
  const doc = newDocument();
  const cache = new Map();
  const materialAt = async (name, age) => {
    const key = `${name}:${age}`;
    if (!cache.has(key)) cache.set(key, await createMaterial(doc, name, age, TIME_PARTS[name] ? `_${age}` : ''));
    return cache.get(key);
  };
  for (const name of Object.keys(MATERIALS)) {
    for (const age of TIME_PARTS[name] ? AGES : ['old']) await materialAt(name, age);
  }
  const scene = doc.createScene('Pagoda 4D');
  const root = doc.createNode('Pagoda_4D').setExtras(MODEL_EXTRAS);
  scene.addChild(root);
  let shared = null;
  const first = STAGES[0].year;
  const last = STAGES[STAGES.length - 1].year;
  const timeEnd = 24;
  const stages = [];
  for (const stage of STAGES) {
    const ageOf = (m) => (TIME_PARTS[m] ? stage.parts[m] : 'old');
    const made = createMeshes(doc, (m) => cache.get(`${m}:${ageOf(m)}`), shared);
    shared = made.accessors;
    const time = Math.round((((stage.year - first) / (last - first)) * timeEnd) * 10000) / 10000;
    const node = doc.createNode(`Stage_${stage.year}`).setExtras({ year: stage.year, label: stage.en, time });
    for (const [part, mesh] of made.meshes) {
      mesh.setName(`${part} ${stage.year}`);
      node.addChild(doc.createNode(`${part} ${stage.year}`).setMesh(mesh));
    }
    root.addChild(node);
    stages.push({ year: stage.year, label: stage.en, node: node.getName(), time });
  }
  scene.setExtras({ timeline: { startYear: first, endYear: last, timeStart: 0, timeEnd, stages } });
  doc.getRoot().setDefaultScene(scene);
  return doc;
}

// ---------------------------------------------------------------- write

const report = async (file) => console.log(`${file}  ${((await stat(file)).size / 1024 / 1024).toFixed(2)} MB`);

await mkdir(path.join(OUT, '4D'), { recursive: true });
await mkdir(TIME_OUT, { recursive: true });

const model = await buildModel();
await model.transform(weld(), dedup(), prune());
const modelPath = path.join(OUT, 'Pagoda.glb');
await io.write(modelPath, model);
await report(modelPath);

// Progressive: Meshopt geometry, WebP textures (the viewer and the intro).
const progressive = await io.read(modelPath);
await progressive.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
const progressivePath = path.join(OUT, 'Pagoda-progressive.glb');
await io.write(progressivePath, progressive);
await report(progressivePath);

// Its preview: fewer triangles, 512 px textures.
const preview = await io.read(modelPath);
await preview.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.01, lockBorder: false }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 70, resize: [512, 512] }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
const previewPath = path.join(OUT, 'Pagoda-progressive.preview.glb');
await io.write(previewPath, preview);
await report(previewPath);

// 4D, textures as WebP at 1024 px.
const model4D = await buildModel4D();
await model4D.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 80, resize: [1024, 1024] }),
);
const model4DPath = path.join(OUT, '4D', 'Pagoda_4D.glb');
await io.write(model4DPath, model4D);
await report(model4DPath);

// The intro's time travel: the fresh and mid colour textures and the table.
let timeBytes = 0;
for (const part of Object.keys(TIME_PARTS)) {
  for (const age of ['fresh', 'mid']) {
    const img = await imagesOf(part, age);
    const data = await sharp(img.color).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await writeFile(path.join(TIME_OUT, `${part}_${age}.webp`), data);
    timeBytes += data.length;
  }
}
const time = {
  parts: TIME_PARTS,
  stages: STAGES.map((s) => ({ year: s.year, label: s.pl, parts: s.parts })),
};
await writeFile(path.join(TIME_OUT, 'time.json'), `${JSON.stringify(time, null, 2)}\n`);
console.log(`time travel: ${STAGES.length} stages, textures ${(timeBytes / 1024 / 1024).toFixed(2)} MB -> ${TIME_OUT}`);
console.log(`bells: ${facts.bells.map((p) => p.map((x) => x.toFixed(2)).join(', ')).join('; ')}`);
console.log(`storeys: ${facts.storeys.map((s) => `base ${s.base.toFixed(2)} eaves ${s.yE.toFixed(2)} top ${s.top.toFixed(2)}`).join('; ')}`);
