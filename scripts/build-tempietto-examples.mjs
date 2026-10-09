// Builds the Tempietto examples (viewer/examples/tempietto/): one model in
// every format the viewer opens, made from resources/models/Tempietto.glb.
// They stand in for the box.* samples in the app, so size comes first:
// geometry is rounded to a millimetre, and every format that can point at an
// image file shares one set of textures in tex/ - WebP, the colour atlas at
// 1024 px and the normal map at 512 px; the stained glass stays the source's
// 1024 px palette PNG (smaller than any 512 px re-encode). USDZ, KMZ and 3MF
// must carry their own, at 512 px in what their specs allow (JPEG/PNG).
// Formats without textures get colours sampled from them. FBX comes from
// Blender; without `blender` on PATH the old file is kept.
//
//   node scripts/build-tempietto-examples.mjs
//
// The loaders show most formats as stored, so those are written Y-up like
// glTF; VOX and IFC are Z-up (their loaders turn them), DAE and USD say Y-up.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { deflateSync } from 'fflate';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const SOURCE = 'resources/models/Tempietto.glb';
const OUT = 'viewer/examples/tempietto';
const NAME = 'Tempietto';
const GENERATOR = 'ExPlora4D - scripts/build-tempietto-examples.mjs';
const POINT_COUNT = 12000; // XYZ and PCD
const VOX_RESOLUTION = 48; // voxels along the longest side

// Source material name -> what the writers below know.
const MATERIAL_KINDS = { tempietto_atlas: 'stone', glass: 'glass', stained_glass: 'stained' };
// The glass sphere has no texture: its colour (sRGB) and opacity elsewhere.
const GLASS_RGBA = [214, 232, 240, 64];

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ---------------------------------------------------------------- helpers

const num = (x, digits = 3) => {
  const s = (Math.round(x * 10 ** digits) / 10 ** digits).toString();
  return s === '-0' ? '0' : s;
};
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0').toUpperCase();

// Deterministic randomness, so a rebuild changes nothing it does not have to.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 0xFFFFFFFF;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// A ZIP writer: fflate's zipSync cannot pad entries, which USDZ requires
// (data 64-byte aligned, nothing compressed).
function zip(entries, { align = 0 } = {}) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data, compress } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const stored = compress ? Buffer.from(deflateSync(data, { level: 9 })) : Buffer.from(data);
    const headerSize = 30 + nameBytes.length;
    const pad = align ? (align - ((offset + headerSize + 4) % align)) % align : 0;
    const extra = pad || align ? Buffer.alloc(4 + pad) : Buffer.alloc(0);
    if (extra.length) {
      extra.writeUInt16LE(0x1986, 0); // private padding field, as usdzip writes
      extra.writeUInt16LE(pad, 2);
    }
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034B50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(compress ? 8 : 0, 8);
    header.writeUInt16LE(0x21, 12); // 1980-01-01, fixed for reproducible files
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(stored.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(extra.length, 28);
    local.push(header, nameBytes, extra, stored);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014B50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(compress ? 8 : 0, 10);
    entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(stored.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += headerSize + extra.length + stored.length;
  }
  const centralSize = central.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

// ---------------------------------------------------------------- source

const source = await io.read(SOURCE);
const sourceImages = Object.fromEntries(source.getRoot().listTextures().map((t) => [t.getName(), t.getImage()]));

// Every primitive in world space, rounded: positions to a millimetre,
// normals to 1/1000, UVs to 1/10000 (a tenth of a texel at 1024 px).
const meshes = [];
source.getRoot().listScenes()[0].traverse((node) => {
  const mesh = node.getMesh();
  if (!mesh) return;
  const m = node.getWorldMatrix();
  const transform = (x, y, z, w) => [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
  ];
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION');
    const normal = primitive.getAttribute('NORMAL');
    const uv = primitive.getAttribute('TEXCOORD_0');
    const count = position.getCount();
    const positions = [];
    const normals = [];
    const uvs = uv ? [] : null;
    for (let i = 0; i < count; i++) {
      positions.push(...transform(...position.getElement(i, []), 1).map((v) => Math.round(v * 1000) / 1000));
      const [nx, ny, nz] = transform(...normal.getElement(i, []), 0);
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.push(...[nx, ny, nz].map((v) => Math.round((v / length) * 1000) / 1000));
      if (uv) uvs.push(...uv.getElement(i, []).map((v) => Math.round(v * 10000) / 10000));
    }
    const indices = primitive.getIndices() ? Array.from(primitive.getIndices().getArray()) : [...Array(count).keys()];
    meshes.push({
      name: node.getName(),
      group: node.getParentNode()?.getName() ?? null,
      kind: MATERIAL_KINDS[primitive.getMaterial()?.getName()] ?? 'stone',
      positions, normals, uvs, indices,
    });
  }
});
const ROOT = source.getRoot().listScenes()[0].listChildren()[0].getName();
// The groups under the root, in order, with their meshes (DAE, USD).
const groups = [];
for (const mesh of meshes) {
  const name = mesh.group === ROOT ? null : mesh.group;
  let group = groups.find((g) => g.name === name);
  if (!group) groups.push(group = { name, meshes: [] });
  group.meshes.push(mesh);
}

const vertexCount = (mesh) => mesh.positions.length / 3;
const vec = (array, i, n = 3) => array.slice(i * n, i * n + n);
const triangles = (mesh) => {
  const list = [];
  for (let i = 0; i < mesh.indices.length; i += 3) list.push(mesh.indices.slice(i, i + 3));
  return list;
};
// glTF's UV origin is the top left, nearly every other format's the bottom left.
const flipV = ([u, v]) => [u, 1 - v];
// Y-up (three.js) -> Z-up.
const zUp = ([x, y, z]) => [x, -z, y];

// ---------------------------------------------------------------- textures

async function encode(name, size, format) {
  const image = sharp(sourceImages[name]).resize({ width: size, withoutEnlargement: true });
  if (format === 'webp') return image.webp({ quality: name === 'normal' ? 80 : 75, effort: 6, smartSubsample: true }).toBuffer();
  return image.jpeg({ quality: name === 'normal' ? 85 : 75, mozjpeg: true }).toBuffer();
}

// Shared: tex/ next to the models.
const SHARED_TEXTURES = {
  base_ao: { file: 'tex/base_ao.webp', mimeType: 'image/webp', data: await encode('base_ao', 1024, 'webp') },
  normal: { file: 'tex/normal.webp', mimeType: 'image/webp', data: await encode('normal', 512, 'webp') },
  glass: { file: 'tex/glass.png', mimeType: 'image/png', data: sourceImages.glass },
};
// Packed into USDZ, KMZ and 3MF.
const EMBEDDED_TEXTURES = {
  base_ao: { file: 'tex/base_ao.jpg', mimeType: 'image/jpeg', data: await encode('base_ao', 512, 'jpeg') },
  normal: { file: 'tex/normal.jpg', mimeType: 'image/jpeg', data: await encode('normal', 512, 'jpeg') },
  glass: { file: 'tex/glass.png', mimeType: 'image/png', data: sourceImages.glass },
};
const texturePaths = (set) => Object.fromEntries(Object.entries(set).map(([name, t]) => [name, t.file]));

// Colours for the formats without textures, sampled at 256 px.
async function pixels(name) {
  const { data, info } = await sharp(sourceImages[name]).resize({ width: 256 }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
const SAMPLED = { stone: await pixels('base_ao'), stained: await pixels('glass') };
function colorAt(kind, uv) {
  const image = SAMPLED[kind];
  if (!image || !uv) return GLASS_RGBA;
  const wrap = (t) => t - Math.floor(t);
  const x = Math.min(image.width - 1, Math.floor(wrap(uv[0]) * image.width));
  const y = Math.min(image.height - 1, Math.floor(wrap(uv[1]) * image.height));
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}

// Area-weighted random points on the surface, with their colour.
const surfaceTriangles = meshes.flatMap((mesh) => triangles(mesh).map((tri) => {
  const [a, b, c] = tri.map((i) => vec(mesh.positions, i));
  const ab = a.map((v, k) => b[k] - v);
  const ac = a.map((v, k) => c[k] - v);
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  return { mesh, tri, a, b, c, area: Math.hypot(...cross) / 2 };
}));
function pointOn(triangle, rand) {
  const r1 = Math.sqrt(rand());
  const r2 = rand();
  const [wa, wb, wc] = [1 - r1, r1 * (1 - r2), r1 * r2];
  const position = triangle.a.map((v, k) => wa * v + wb * triangle.b[k] + wc * triangle.c[k]);
  const uvs = triangle.mesh.uvs;
  const uv = uvs && [0, 1].map((k) => wa * uvs[triangle.tri[0] * 2 + k] + wb * uvs[triangle.tri[1] * 2 + k] + wc * uvs[triangle.tri[2] * 2 + k]);
  return { position, color: colorAt(triangle.mesh.kind, uv) };
}
function samplePoints(list, count, seed) {
  const rand = random(seed);
  const cumulative = [];
  let total = 0;
  for (const t of list) cumulative.push(total += t.area);
  return Array.from({ length: count }, () => {
    const target = rand() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1; else hi = mid;
    }
    return pointOn(list[lo], rand);
  });
}
const average = (colors) => [0, 1, 2, 3].map((k) => colors.reduce((sum, c) => sum + c[k], 0) / colors.length);
const meshColor = (mesh) => average(samplePoints(surfaceTriangles.filter((t) => t.mesh === mesh), 200, 7).map((p) => p.color));
const MESH_COLORS = new Map(meshes.map((mesh) => [mesh, meshColor(mesh)]));

// ---------------------------------------------------------------- GLB

// Meshopt-compressed, with the shared textures as external images: the
// writer leaves out images without data, their URIs go in afterwards.
async function buildGLB() {
  const document = await io.read(SOURCE);
  await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  document.createExtension(EXTTextureWebP).setRequired(true);
  const uris = document.getRoot().listTextures().map((texture) => {
    const shared = SHARED_TEXTURES[texture.getName()];
    texture.setMimeType(shared.mimeType).setImage(null);
    return shared.file;
  });
  const glb = Buffer.from(await io.writeBinary(document));
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
  json.images.forEach((image, i) => { image.uri = uris[i]; });
  json.asset.generator = GENERATOR;
  // A JSON chunk this size (27 meshes) is most of the file: drop defaults.
  for (const accessor of json.accessors) {
    if (accessor.normalized === false) delete accessor.normalized;
    if (accessor.byteOffset === 0) delete accessor.byteOffset;
  }
  for (const view of json.bufferViews) if (view.byteOffset === 0) delete view.byteOffset;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) if (primitive.mode === 4) delete primitive.mode;
  let text = JSON.stringify(json);
  text += ' '.repeat((4 - (text.length % 4)) % 4);
  const header = Buffer.alloc(20);
  const rest = glb.subarray(20 + jsonLength);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + rest.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4E4F534A, 16);
  return Buffer.concat([header, Buffer.from(text), rest]);
}

// ---------------------------------------------------------------- OBJ + MTL

function buildOBJ() {
  const lines = [`# ${NAME} - ${GENERATOR}`, `mtllib ${NAME}.mtl`];
  const pools = { v: new Map(), vt: new Map(), vn: new Map() };
  const ref = (type, key) => {
    const pool = pools[type];
    if (!pool.has(key)) {
      pool.set(key, pool.size + 1);
      lines.push(`${type} ${key}`);
    }
    return pool.get(key);
  };
  for (const mesh of meshes) {
    lines.push(`o ${mesh.name}`);
    const corner = (i) => {
      const v = ref('v', vec(mesh.positions, i).map((x) => num(x)).join(' '));
      const vt = mesh.uvs ? ref('vt', flipV(vec(mesh.uvs, i, 2)).map((x) => num(x, 4)).join(' ')) : '';
      const vn = ref('vn', vec(mesh.normals, i).map((x) => num(x)).join(' '));
      return `${v}/${vt}/${vn}`;
    };
    const faces = triangles(mesh).map((tri) => `f ${tri.map(corner).join(' ')}`);
    lines.push(`usemtl ${mesh.kind}`, ...faces);
  }
  return lines.join('\n') + '\n';
}

// "d" below 1 makes three.js blend, so the stained glass keeps its alpha.
function buildMTL() {
  const t = texturePaths(SHARED_TEXTURES);
  return [
    `# ${NAME} - ${GENERATOR}`,
    'newmtl stone', 'Kd 1 1 1', 'Ks 0.04 0.04 0.04', 'Ns 10', `map_Kd ${t.base_ao}`, `norm ${t.normal}`,
    '', 'newmtl glass', 'Kd 0.84 0.91 0.94', 'Ks 1 1 1', 'Ns 200', `d ${num(GLASS_RGBA[3] / 255, 2)}`,
    '', 'newmtl stained', 'Kd 1 1 1', 'Ks 0.2 0.2 0.2', 'Ns 80', 'Ke 0.55 0.55 0.55', `map_Kd ${t.glass}`, `map_Ke ${t.glass}`, 'd 0.99',
  ].join('\n') + '\n';
}

// ---------------------------------------------------------------- DAE (and KMZ)

function buildDAE(textures) {
  const sampler = (name) => `
        <newparam sid="${name}-surface"><surface type="2D"><init_from>${name}-image</init_from></surface></newparam>
        <newparam sid="${name}-sampler"><sampler2D><source>${name}-surface</source></sampler2D></newparam>`;
  const texture = (name) => `<texture texture="${name}-sampler" texcoord="UVMap"/>`;
  const effect = (id, params, phong, extra = '') => `
    <effect id="${id}-effect"><profile_COMMON>${params}
      <technique sid="common"><phong>${phong}</phong>${extra}</technique>
    </profile_COMMON></effect>`;
  const color = (rgba) => `<color>${rgba.join(' ')}</color>`;
  const effects = [
    effect('stone', sampler('base_ao') + sampler('normal'),
      `<diffuse>${texture('base_ao')}</diffuse><specular>${color([0.04, 0.04, 0.04, 1])}</specular><shininess><float>10</float></shininess>`,
      `<extra><technique profile="FCOLLADA"><bump>${texture('normal')}</bump></technique></extra>`),
    effect('glass', '',
      `<diffuse>${color([0.84, 0.91, 0.94, 1])}</diffuse><specular>${color([1, 1, 1, 1])}</specular><shininess><float>200</float></shininess>`
      + `<transparent opaque="A_ONE">${color([1, 1, 1, num(GLASS_RGBA[3] / 255, 2)])}</transparent><transparency><float>1</float></transparency>`),
    effect('stained', sampler('glass'),
      `<emission>${color([0.1, 0.1, 0.1, 1])}</emission><diffuse>${texture('glass')}</diffuse><specular>${color([0.2, 0.2, 0.2, 1])}</specular><shininess><float>80</float></shininess>`
      + `<transparent opaque="A_ONE">${texture('glass')}</transparent><transparency><float>1</float></transparency>`),
  ];
  const source = (id, values, params) => `
        <source id="${id}"><float_array id="${id}-array" count="${values.length}">${values.join(' ')}</float_array>
          <technique_common><accessor source="#${id}-array" count="${values.length / params.length}" stride="${params.length}">${params.map((p) => `<param name="${p}" type="float"/>`).join('')}</accessor></technique_common>
        </source>`;
  const geometries = meshes.map((mesh, i) => {
    const id = `geom-${i}`;
    const uvs = mesh.uvs && Array.from({ length: vertexCount(mesh) }, (_, v) => flipV(vec(mesh.uvs, v, 2)).map((x) => num(x, 4))).flat();
    return `
    <geometry id="${id}" name="${mesh.name}"><mesh>${source(`${id}-positions`, mesh.positions.map((x) => num(x)), ['X', 'Y', 'Z'])}${source(`${id}-normals`, mesh.normals.map((x) => num(x)), ['X', 'Y', 'Z'])}${uvs ? source(`${id}-uvs`, uvs, ['S', 'T']) : ''}
        <vertices id="${id}-vertices"><input semantic="POSITION" source="#${id}-positions"/></vertices>
        <triangles material="${mesh.kind}" count="${mesh.indices.length / 3}"><input semantic="VERTEX" source="#${id}-vertices" offset="0"/><input semantic="NORMAL" source="#${id}-normals" offset="0"/>${uvs ? `<input semantic="TEXCOORD" source="#${id}-uvs" offset="0" set="0"/>` : ''}<p>${mesh.indices.join(' ')}</p></triangles>
      </mesh></geometry>`;
  });
  const instance = (mesh) => {
    const i = meshes.indexOf(mesh);
    return `<node id="node-${i}" name="${mesh.name}"><instance_geometry url="#geom-${i}"><bind_material><technique_common><instance_material symbol="${mesh.kind}" target="#${mesh.kind}-material"><bind_vertex_input semantic="UVMap" input_semantic="TEXCOORD" input_set="0"/></instance_material></technique_common></bind_material></instance_geometry></node>`;
  };
  const nodes = groups.map((group) => (group.name
    ? `\n        <node id="${group.name}" name="${group.name}">${group.meshes.map(instance).join('')}</node>`
    : group.meshes.map((mesh) => `\n        ${instance(mesh)}`).join('')));
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset><contributor><authoring_tool>${GENERATOR}</authoring_tool></contributor><created>2026-01-01T00:00:00</created><modified>2026-01-01T00:00:00</modified><unit name="meter" meter="1"/><up_axis>Y_UP</up_axis></asset>
  <library_images>${Object.entries(textures).map(([name, file]) => `<image id="${name}-image" name="${name}"><init_from>${file}</init_from></image>`).join('')}</library_images>
  <library_effects>${effects.join('')}
  </library_effects>
  <library_materials>${['stone', 'glass', 'stained'].map((kind) => `<material id="${kind}-material" name="${kind}"><instance_effect url="#${kind}-effect"/></material>`).join('')}</library_materials>
  <library_geometries>${geometries.join('')}
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="scene" name="${NAME}">
      <node id="${ROOT}" name="${ROOT}">${nodes.join('')}
      </node>
    </visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#scene"/></scene>
</COLLADA>
`;
}

function buildKMZ() {
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${NAME}</name>
    <Model>
      <altitudeMode>relativeToGround</altitudeMode>
      <Location><longitude>0</longitude><latitude>0</latitude><altitude>0</altitude></Location>
      <Link><href>${NAME}.dae</href></Link>
    </Model>
  </Placemark>
</kml>
`;
  return zip([
    { name: 'doc.kml', data: Buffer.from(kml), compress: true },
    { name: `${NAME}.dae`, data: Buffer.from(buildDAE(texturePaths(EMBEDDED_TEXTURES))), compress: true },
    ...Object.values(EMBEDDED_TEXTURES).map((t) => ({ name: t.file, data: t.data, compress: false })),
  ]);
}

// ---------------------------------------------------------------- USDA / USDZ

function buildUSDA(textures) {
  const materials = `/${NAME}/Materials`;
  const uvTexture = (material, name, file, output, extra = '') => `
            def Shader "${name}"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${file}@
                float2 inputs:st.connect = <${materials}/${material}/UVReader.outputs:result>
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"${extra}
                ${output}
            }`;
  const uvReader = `
            def Shader "UVReader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 outputs:result
            }`;
  const material = (name, inputs, shaders = '') => `
        def Material "${name}"
        {
            token outputs:surface.connect = <${materials}/${name}/Surface.outputs:surface>

            def Shader "Surface"
            {
                uniform token info:id = "UsdPreviewSurface"
${inputs.map((line) => `                ${line}`).join('\n')}
                token outputs:surface
            }${shaders}
        }`;
  const list = (values) => `[${values.join(', ')}]`;
  const tuples = (array, n, digits, map = (v) => v) => list(Array.from({ length: array.length / n }, (_, i) => `(${map(vec(array, i, n)).map((x) => num(x, digits)).join(', ')})`));
  const mesh = (m, indent) => `
${indent}def Mesh "${m.name}"
${indent}{
${indent}    uniform bool doubleSided = 0
${indent}    int[] faceVertexCounts = ${list(Array(m.indices.length / 3).fill(3))}
${indent}    int[] faceVertexIndices = ${list(m.indices)}
${indent}    point3f[] points = ${tuples(m.positions, 3, 3)}
${indent}    normal3f[] normals = ${tuples(m.normals, 3, 3)} (
${indent}        interpolation = "vertex"
${indent}    )${m.uvs ? `
${indent}    texCoord2f[] primvars:st = ${tuples(m.uvs, 2, 4, flipV)} (
${indent}        interpolation = "vertex"
${indent}    )` : ''}
${indent}    uniform token subdivisionScheme = "none"
${indent}    rel material:binding = <${materials}/${m.kind}>
${indent}}`;
  const scene = groups.map((group) => (group.name
    ? `
    def Xform "${group.name}"
    {${group.meshes.map((m) => mesh(m, '        ')).join('\n')}
    }`
    : group.meshes.map((m) => mesh(m, '    ')).join('\n'))).join('\n');
  return `#usda 1.0
(
    customLayerData = {
        string creator = "${GENERATOR}"
    }
    defaultPrim = "${NAME}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "${NAME}" (
    kind = "component"
)
{
    def Scope "Materials"
    {${material('stone', [
      `color3f inputs:diffuseColor.connect = <${materials}/stone/BaseColor.outputs:rgb>`,
      `normal3f inputs:normal.connect = <${materials}/stone/Normal.outputs:rgb>`,
      'float inputs:metallic = 0',
      'float inputs:roughness = 0.8',
    ], uvReader + uvTexture('stone', 'BaseColor', textures.base_ao, 'float3 outputs:rgb', `
                token inputs:sourceColorSpace = "sRGB"`) + uvTexture('stone', 'Normal', textures.normal, 'float3 outputs:rgb', `
                token inputs:sourceColorSpace = "raw"
                float4 inputs:scale = (2, 2, 2, 1)
                float4 inputs:bias = (-1, -1, -1, 0)`))}
${material('glass', [
      'color3f inputs:diffuseColor = (0.84, 0.91, 0.94)',
      'float inputs:metallic = 0',
      'float inputs:roughness = 0.05',
      'float inputs:ior = 1.5',
      `float inputs:opacity = ${num(GLASS_RGBA[3] / 255, 2)}`,
    ])}
${material('stained', [
      `color3f inputs:diffuseColor.connect = <${materials}/stained/Glass.outputs:rgb>`,
      `float inputs:opacity.connect = <${materials}/stained/Glass.outputs:a>`,
      'float inputs:metallic = 0',
      'float inputs:roughness = 0.15',
    ], uvReader + uvTexture('stained', 'Glass', textures.glass, 'float3 outputs:rgb\n                float outputs:a', `
                token inputs:sourceColorSpace = "sRGB"`))}
    }
${scene}
}
`;
}

// The default layer first, every file stored and 64-byte aligned (USDZ spec).
function buildUSDZ() {
  return zip([
    { name: `${NAME}.usda`, data: Buffer.from(buildUSDA(texturePaths(EMBEDDED_TEXTURES))), compress: false },
    ...Object.values(EMBEDDED_TEXTURES).map((t) => ({ name: t.file, data: t.data, compress: false })),
  ], { align: 64 });
}

// ---------------------------------------------------------------- 3MF

// Textured objects reference a texture2dgroup holding their UVs; the glass
// sphere a translucent base material. Opaque either way in three.js.
function build3MF() {
  const resources = [];
  const objects = [];
  const textureIds = { base_ao: 1, glass: 2 };
  resources.push(
    `<m:texture2d id="1" path="/3D/Texture/base_ao.jpg" contenttype="image/jpeg" tilestyleu="wrap" tilestylev="wrap"/>`,
    `<m:texture2d id="2" path="/3D/Texture/glass.png" contenttype="image/png" tilestyleu="wrap" tilestylev="wrap"/>`,
    `<basematerials id="3"><base name="glass" displaycolor="#${GLASS_RGBA.map(hex2).join('')}"/></basematerials>`,
  );
  let nextId = 10;
  meshes.forEach((mesh) => {
    let property = 'pid="3" pindex="0"';
    let triangleProperty = () => '';
    if (mesh.uvs) {
      const groupId = nextId++;
      const texture = textureIds[mesh.kind === 'stained' ? 'glass' : 'base_ao'];
      const coords = Array.from({ length: vertexCount(mesh) }, (_, i) => {
        const [u, v] = flipV(vec(mesh.uvs, i, 2));
        return `<m:tex2coord u="${num(u, 4)}" v="${num(v, 4)}"/>`;
      });
      resources.push(`<m:texture2dgroup id="${groupId}" texid="${texture}">${coords.join('')}</m:texture2dgroup>`);
      property = `pid="${groupId}" pindex="0"`;
      triangleProperty = (tri) => ` p1="${tri[0]}" p2="${tri[1]}" p3="${tri[2]}"`;
    }
    const id = nextId++;
    const vertices = Array.from({ length: vertexCount(mesh) }, (_, i) => {
      const [x, y, z] = vec(mesh.positions, i).map((v) => num(v));
      return `<vertex x="${x}" y="${y}" z="${z}"/>`;
    });
    const tris = triangles(mesh).map((tri) => `<triangle v1="${tri[0]}" v2="${tri[1]}" v3="${tri[2]}"${triangleProperty(tri)}/>`);
    objects.push({ id, xml: `<object id="${id}" type="model" name="${xmlEscape(mesh.name)}" ${property}><mesh><vertices>${vertices.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>` });
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="meter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
<metadata name="Title">${NAME}</metadata>
<metadata name="Application">${GENERATOR}</metadata>
<resources>
${resources.join('\n')}
${objects.map((o) => o.xml).join('\n')}
</resources>
<build>${objects.map((o) => `<item objectid="${o.id}"/>`).join('')}</build>
</model>
`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/></Types>
`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>
`;
  const textureType = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture';
  const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/Texture/base_ao.jpg" Id="rel1" Type="${textureType}"/><Relationship Target="/3D/Texture/glass.png" Id="rel2" Type="${textureType}"/></Relationships>
`;
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes), compress: true },
    { name: '_rels/.rels', data: Buffer.from(rels), compress: true },
    { name: '3D/3dmodel.model', data: Buffer.from(model), compress: true },
    { name: '3D/_rels/3dmodel.model.rels', data: Buffer.from(modelRels), compress: true },
    { name: '3D/Texture/base_ao.jpg', data: EMBEDDED_TEXTURES.base_ao.data, compress: false },
    { name: '3D/Texture/glass.png', data: EMBEDDED_TEXTURES.glass.data, compress: false },
  ]);
}

// ---------------------------------------------------------------- AMF

// Colours only (one material per object), zipped as the spec allows.
function buildAMF() {
  const colorOf = (mesh) => {
    const [r, g, b, a] = MESH_COLORS.get(mesh);
    return `<color><r>${num(r / 255)}</r><g>${num(g / 255)}</g><b>${num(b / 255)}</b><a>${num(a / 255)}</a></color>`;
  };
  const parts = meshes.map((mesh, i) => {
    const index = new Map();
    const vertices = [];
    const remap = [];
    for (let v = 0; v < vertexCount(mesh); v++) {
      const key = vec(mesh.positions, v).map((x) => num(x));
      const id = key.join(' ');
      if (!index.has(id)) {
        index.set(id, index.size);
        vertices.push(`<vertex><coordinates><x>${key[0]}</x><y>${key[1]}</y><z>${key[2]}</z></coordinates></vertex>`);
      }
      remap.push(index.get(id));
    }
    const tris = triangles(mesh).map((tri) => `<triangle><v1>${remap[tri[0]]}</v1><v2>${remap[tri[1]]}</v2><v3>${remap[tri[2]]}</v3></triangle>`);
    return {
      material: `<material id="${i + 1}"><metadata type="name">${xmlEscape(mesh.name)}</metadata>${colorOf(mesh)}</material>`,
      object: `<object id="${i + 1}"><metadata type="name">${xmlEscape(mesh.name)}</metadata><mesh><vertices>${vertices.join('')}</vertices><volume materialid="${i + 1}">${tris.join('')}</volume></mesh></object>`,
    };
  });
  const amf = `<?xml version="1.0" encoding="UTF-8"?>
<amf unit="meter" version="1.1">
<metadata type="name">${NAME}</metadata>
<metadata type="cad">${GENERATOR}</metadata>
${parts.map((p) => p.material).join('\n')}
${parts.map((p) => p.object).join('\n')}
</amf>
`;
  return zip([{ name: `${NAME}.amf`, data: Buffer.from(amf), compress: true }]);
}

// ---------------------------------------------------------------- WRL

function buildWRL() {
  const t = texturePaths(SHARED_TEXTURES);
  const appearances = {
    stone: `Appearance { material Material { diffuseColor 1 1 1 specularColor 0.04 0.04 0.04 shininess 0.08 } texture ImageTexture { url "${t.base_ao}" } }`,
    glass: `Appearance { material Material { diffuseColor 0.84 0.91 0.94 specularColor 1 1 1 shininess 1 transparency ${num(1 - GLASS_RGBA[3] / 255, 2)} } }`,
    // A transparency above 0 makes three.js blend, so the alpha of the image counts.
    stained: `Appearance { material Material { diffuseColor 1 1 1 specularColor 0.2 0.2 0.2 shininess 0.6 transparency 0.01 } texture ImageTexture { url "${t.glass}" } }`,
  };
  const defined = new Set();
  const shapes = meshes.map((mesh) => {
    const appearance = defined.has(mesh.kind) ? `USE ${mesh.kind}` : `DEF ${mesh.kind} ${appearances[mesh.kind]}`;
    defined.add(mesh.kind);
    const points = (array, n, digits, map = (v) => v) => Array.from({ length: array.length / n }, (_, i) => map(vec(array, i, n)).map((x) => num(x, digits)).join(' ')).join(', ');
    return `DEF ${mesh.name} Shape {
  appearance ${appearance}
  geometry IndexedFaceSet {
    coord Coordinate { point [ ${points(mesh.positions, 3, 3)} ] }
    normal Normal { vector [ ${points(mesh.normals, 3, 3)} ] }${mesh.uvs ? `
    texCoord TextureCoordinate { point [ ${points(mesh.uvs, 2, 4, flipV)} ] }` : ''}
    coordIndex [ ${triangles(mesh).map((tri) => `${tri.join(' ')} -1`).join(' ')} ]
  }
}`;
  });
  return `#VRML V2.0 utf8
# ${NAME} - ${GENERATOR}
${shapes.join('\n')}
`;
}

// ---------------------------------------------------------------- 3DS

function build3DS() {
  const chunk = (id, ...parts) => {
    const body = Buffer.concat(parts);
    const head = Buffer.alloc(6);
    head.writeUInt16LE(id, 0);
    head.writeUInt32LE(6 + body.length, 2);
    return Buffer.concat([head, body]);
  };
  const cstr = (s) => Buffer.from(`${s}\0`, 'latin1');
  const u16 = (...values) => {
    const b = Buffer.alloc(values.length * 2);
    values.forEach((v, i) => b.writeUInt16LE(v, i * 2));
    return b;
  };
  const f32 = (values) => Buffer.from(new Float32Array(values).buffer);
  const color = (r, g, b) => chunk(0x0011, Buffer.from([r, g, b]));
  const percent = (n) => chunk(0x0030, u16(n));
  const map = (file) => chunk(0xA200, percent(100), chunk(0xA300, cstr(file)));
  const t = texturePaths(SHARED_TEXTURES);
  // Name, diffuse, specular, shininess %, transparency %, colour map. A
  // transparency above 0 makes three.js blend (the stained glass's alpha).
  const materialChunks = [
    ['stone', [255, 255, 255], [10, 10, 10], 10, 0, t.base_ao],
    ['glass', [214, 232, 240], [255, 255, 255], 90, Math.round(100 - (GLASS_RGBA[3] / 255) * 100), null],
    ['stained', [255, 255, 255], [50, 50, 50], 60, 1, t.glass],
  ].map(([name, diffuse, specular, shininess, transparency, file]) => chunk(0xAFFF,
    chunk(0xA000, cstr(name)),
    chunk(0xA010, color(...diffuse)),
    chunk(0xA020, color(...diffuse)),
    chunk(0xA030, color(...specular)),
    chunk(0xA040, percent(shininess)),
    chunk(0xA050, percent(transparency)),
    file ? map(file) : Buffer.alloc(0)));
  const objects = meshes.map((mesh) => {
    const faceCount = mesh.indices.length / 3;
    const faces = Buffer.concat(triangles(mesh).map((tri) => u16(...tri, 0)));
    return chunk(0x4000, cstr(mesh.name), chunk(0x4100,
      chunk(0x4110, u16(vertexCount(mesh)), f32(mesh.positions)),
      mesh.uvs ? chunk(0x4140, u16(vertexCount(mesh)), f32(Array.from({ length: vertexCount(mesh) }, (_, i) => flipV(vec(mesh.uvs, i, 2))).flat())) : Buffer.alloc(0),
      chunk(0x4120, u16(faceCount), faces,
        chunk(0x4130, cstr(mesh.kind), u16(faceCount), u16(...Array(faceCount).keys())))));
  });
  return chunk(0x4D4D,
    chunk(0x0002, Buffer.from(new Uint32Array([3]).buffer)),
    chunk(0x3D3D, chunk(0x3D3E, Buffer.from(new Uint32Array([3]).buffer)), chunk(0x0100, f32([1])), ...materialChunks, ...objects));
}

// ---------------------------------------------------------------- STL, PLY

// Binary, with a colour per face (the "COLOR=" header three.js and Magics read).
function buildSTL() {
  const list = surfaceTriangles;
  const buffer = Buffer.alloc(84 + list.length * 50);
  buffer.write(`COLOR=`, 0, 'latin1');
  buffer.writeUInt32BE(0xC8C8C8FF, 6);
  buffer.write(` ${NAME}`, 10, 'latin1');
  buffer.writeUInt32LE(list.length, 80);
  list.forEach((triangle, i) => {
    const o = 84 + i * 50;
    const [a, b, c] = [triangle.a, triangle.b, triangle.c];
    const ab = a.map((v, k) => b[k] - v);
    const ac = a.map((v, k) => c[k] - v);
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const length = Math.hypot(...n) || 1;
    [...n.map((v) => v / length), ...a, ...b, ...c].forEach((v, k) => buffer.writeFloatLE(v, o + k * 4));
    const rand = random(i + 1);
    const [r, g, bl] = average(Array.from({ length: 5 }, () => pointOn(triangle, rand).color));
    const to5 = (v) => Math.round((v / 255) * 31);
    buffer.writeUInt16LE(to5(r) | (to5(g) << 5) | (to5(bl) << 10), o + 48);
  });
  return buffer;
}

// Positions and faces only: the viewer gives PLY meshes its own material.
function buildPLY() {
  const index = new Map();
  const positions = [];
  const faces = [];
  for (const mesh of meshes) {
    const remap = [];
    for (let v = 0; v < vertexCount(mesh); v++) {
      const p = vec(mesh.positions, v);
      const key = p.join(' ');
      if (!index.has(key)) {
        index.set(key, index.size);
        positions.push(...p);
      }
      remap.push(index.get(key));
    }
    faces.push(...triangles(mesh).map((tri) => tri.map((i) => remap[i])));
  }
  const header = `ply
format binary_little_endian 1.0
comment ${NAME} - ${GENERATOR}
element vertex ${positions.length / 3}
property float x
property float y
property float z
element face ${faces.length}
property list uchar int vertex_indices
end_header
`;
  const faceData = Buffer.alloc(faces.length * 13);
  faces.forEach((tri, i) => {
    faceData.writeUInt8(3, i * 13);
    tri.forEach((v, k) => faceData.writeInt32LE(v, i * 13 + 1 + k * 4));
  });
  return Buffer.concat([Buffer.from(header, 'latin1'), Buffer.from(new Float32Array(positions).buffer), faceData]);
}

// ---------------------------------------------------------------- XYZ, PCD

const POINTS = samplePoints(surfaceTriangles, POINT_COUNT, 42);

function buildXYZ() {
  return POINTS.map(({ position, color }) => `${position.map((x) => num(x)).join(' ')} ${color.slice(0, 3).join(' ')}`).join('\n') + '\n';
}

function buildPCD() {
  const header = `# .PCD v0.7 - Point Cloud Data file format
# ${NAME} - ${GENERATOR}
VERSION 0.7
FIELDS x y z rgb
SIZE 4 4 4 4
TYPE F F F U
COUNT 1 1 1 1
WIDTH ${POINTS.length}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${POINTS.length}
DATA binary
`;
  const data = Buffer.alloc(POINTS.length * 16);
  POINTS.forEach(({ position, color }, i) => {
    position.forEach((v, k) => data.writeFloatLE(Math.round(v * 1000) / 1000, i * 16 + k * 4));
    data.writeUInt32LE((color[0] << 16) | (color[1] << 8) | color[2], i * 16 + 12);
  });
  return Buffer.concat([Buffer.from(header, 'latin1'), data]);
}

// ---------------------------------------------------------------- VOX

// The surface voxelised at VOX_RESOLUTION along the longest side, each voxel
// the mean colour of the points in it, the colours cut to MagicaVoxel's 255.
function buildVOX() {
  const zPositions = meshes.flatMap((mesh) => Array.from({ length: vertexCount(mesh) }, (_, i) => zUp(vec(mesh.positions, i))));
  const min = [0, 1, 2].map((k) => Math.min(...zPositions.map((p) => p[k])));
  const max = [0, 1, 2].map((k) => Math.max(...zPositions.map((p) => p[k])));
  const size = Math.max(...max.map((v, k) => v - min[k])) / VOX_RESOLUTION;
  const dims = max.map((v, k) => Math.min(256, Math.floor((v - min[k]) / size) + 1));
  const totalArea = surfaceTriangles.reduce((sum, t) => sum + t.area, 0);
  const cells = new Map();
  for (const { position, color } of samplePoints(surfaceTriangles, Math.ceil((totalArea / (size * size)) * 8), 3)) {
    const cell = zUp(position).map((v, k) => Math.min(dims[k] - 1, Math.floor((v - min[k]) / size)));
    const key = cell.join(',');
    const entry = cells.get(key) ?? { cell, sum: [0, 0, 0], count: 0 };
    color.slice(0, 3).forEach((v, k) => { entry.sum[k] += v; });
    entry.count++;
    cells.set(key, entry);
  }
  // In scan order, which deflates far better than the order of the samples.
  const voxels = [...cells.values()]
    .map(({ cell, sum, count }) => ({ cell, color: sum.map((v) => v / count) }))
    .sort((a, b) => a.cell[2] - b.cell[2] || a.cell[1] - b.cell[1] || a.cell[0] - b.cell[0]);

  // Median cut.
  let boxes = [voxels];
  while (boxes.length < 255) {
    let best = null;
    for (const box of boxes) {
      if (box.length < 2) continue;
      for (let k = 0; k < 3; k++) {
        const values = box.map((v) => v.color[k]);
        const range = Math.max(...values) - Math.min(...values);
        if (!best || range > best.range) best = { box, k, range };
      }
    }
    if (!best || best.range === 0) break;
    const sorted = [...best.box].sort((a, b) => a.color[best.k] - b.color[best.k]);
    const half = sorted.length >> 1;
    boxes = boxes.filter((b) => b !== best.box).concat([sorted.slice(0, half), sorted.slice(half)]);
  }
  const palette = boxes.map((box) => average(box.map((v) => [...v.color, 255])));
  boxes.forEach((box, i) => box.forEach((v) => { v.index = i + 1; }));

  const chunk = (id, content, children = Buffer.alloc(0)) => {
    const head = Buffer.alloc(12);
    head.write(id, 0, 'latin1');
    head.writeUInt32LE(content.length, 4);
    head.writeUInt32LE(children.length, 8);
    return Buffer.concat([head, content, children]);
  };
  const sizeChunk = Buffer.from(new Uint32Array(dims).buffer);
  const xyzi = Buffer.alloc(4 + voxels.length * 4);
  xyzi.writeUInt32LE(voxels.length, 0);
  voxels.forEach((v, i) => xyzi.set([...v.cell, v.index], 4 + i * 4));
  const rgba = Buffer.alloc(256 * 4);
  palette.forEach((c, i) => rgba.set(c.map((v) => Math.round(v)), i * 4));
  const main = chunk('MAIN', Buffer.alloc(0), Buffer.concat([chunk('SIZE', sizeChunk), chunk('XYZI', xyzi), chunk('RGBA', rgba)]));
  const head = Buffer.alloc(8);
  head.write('VOX ', 0, 'latin1');
  head.writeUInt32LE(150, 4);
  return Buffer.concat([head, main]);
}

// ---------------------------------------------------------------- IFC

// IFC4, one element per mesh (its class from the name) with a triangulated
// face set and a surface style, in a project/site/building/storey.
function buildIFC() {
  const lines = [];
  let id = 0;
  const add = (entity) => {
    lines.push(`#${++id}=${entity};`);
    return `#${id}`;
  };
  const real = (x) => {
    const s = num(x);
    return s.includes('.') ? s : `${s}.`;
  };
  const GUID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  const guid = (name) => {
    const h = crc32(Buffer.from(`${NAME}/${name}`));
    const rand = random(h);
    return GUID_CHARS[h % 4] + Array.from({ length: 21 }, () => GUID_CHARS[Math.floor(rand() * 64)]).join('');
  };
  const str = (s) => `'${s.replace(/'/g, "''")}'`;
  const classify = (name) => {
    if (/^Column/.test(name)) return ['IFCCOLUMN', '.COLUMN.'];
    if (/^(Wall|Pediment)/.test(name)) return ['IFCWALL', '.SOLIDWALL.'];
    if (/^Slope/.test(name)) return ['IFCSLAB', '.ROOF.'];
    if (/^(Block|Step)/.test(name)) return ['IFCSLAB', '.BASESLAB.'];
    if (name === 'Entablature') return ['IFCBEAM', '.BEAM.'];
    if (/^Window/.test(name)) return ['IFCWINDOW', '.WINDOW.'];
    if (/^Skylight_(Left|Right)/.test(name)) return ['IFCWINDOW', '.SKYLIGHT.'];
    return ['IFCBUILDINGELEMENTPROXY', '.ELEMENT.'];
  };

  const person = add(`IFCPERSON($,$,${str(GENERATOR)},$,$,$,$,$)`);
  const organization = add(`IFCORGANIZATION($,'ExPlora4D',$,$,$)`);
  const owner = add(`IFCPERSONANDORGANIZATION(${person},${organization},$)`);
  const application = add(`IFCAPPLICATION(${organization},'1.0',${str(GENERATOR)},'ExPlora4D')`);
  const history = add(`IFCOWNERHISTORY(${owner},${application},$,.ADDED.,$,$,$,0)`);
  const origin = add('IFCCARTESIANPOINT((0.,0.,0.))');
  const axis = add('IFCAXIS2PLACEMENT3D(' + origin + ',$,$)');
  const placement = add(`IFCLOCALPLACEMENT($,${axis})`);
  const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${axis},$)`);
  const body = add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${context},$,.MODEL_VIEW.,$)`);
  const units = add(`IFCUNITASSIGNMENT((${add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')},${add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},${add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')}))`);
  const project = add(`IFCPROJECT(${str(guid('project'))},${history},${str(NAME)},$,$,$,$,(${context}),${units})`);
  const site = add(`IFCSITE(${str(guid('site'))},${history},'Site',$,$,${placement},$,$,.ELEMENT.,$,$,$,$,$)`);
  const building = add(`IFCBUILDING(${str(guid('building'))},${history},${str(NAME)},$,$,${placement},$,$,.ELEMENT.,$,$,$)`);
  const storey = add(`IFCBUILDINGSTOREY(${str(guid('storey'))},${history},'Ground',$,$,${placement},$,$,.ELEMENT.,0.)`);
  add(`IFCRELAGGREGATES(${str(guid('rel-project'))},${history},$,$,${project},(${site}))`);
  add(`IFCRELAGGREGATES(${str(guid('rel-site'))},${history},$,$,${site},(${building}))`);
  add(`IFCRELAGGREGATES(${str(guid('rel-building'))},${history},$,$,${building},(${storey}))`);

  const styles = new Map();
  const styleFor = (mesh) => {
    const [r, g, b] = MESH_COLORS.get(mesh).map((v) => v / 255);
    const transparency = mesh.kind === 'glass' ? 1 - GLASS_RGBA[3] / 255 : mesh.kind === 'stained' ? 0.4 : 0;
    const key = [r, g, b, transparency].map((v) => num(v, 2)).join(',');
    if (!styles.has(key)) {
      const colour = add(`IFCCOLOURRGB($,${real(r)},${real(g)},${real(b)})`);
      const shading = add(`IFCSURFACESTYLESHADING(${colour},${real(transparency)})`);
      styles.set(key, add(`IFCSURFACESTYLE($,.BOTH.,(${shading}))`));
    }
    return styles.get(key);
  };

  const elements = meshes.map((mesh) => {
    const index = new Map();
    const points = [];
    const remap = [];
    for (let v = 0; v < vertexCount(mesh); v++) {
      const p = zUp(vec(mesh.positions, v)).map(real);
      const key = p.join(',');
      if (!index.has(key)) {
        index.set(key, index.size + 1);
        points.push(`(${key})`);
      }
      remap.push(index.get(key));
    }
    const pointList = add(`IFCCARTESIANPOINTLIST3D((${points.join(',')}),$)`);
    const faceSet = add(`IFCTRIANGULATEDFACESET(${pointList},$,$,(${triangles(mesh).map((tri) => `(${tri.map((i) => remap[i]).join(',')})`).join(',')}),$)`);
    add(`IFCSTYLEDITEM(${faceSet},(${styleFor(mesh)}),$)`);
    const representation = add(`IFCSHAPEREPRESENTATION(${body},'Body','Tessellation',(${faceSet}))`);
    const shape = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`);
    const [entity, type] = classify(mesh.name);
    const common = `${str(guid(mesh.name))},${history},${str(mesh.name)},$,$,${placement},${shape},$`;
    return add(entity === 'IFCWINDOW' ? `${entity}(${common},$,$,${type},$,$)` : `${entity}(${common},${type})`);
  });
  add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${str(guid('rel-storey'))},${history},$,$,(${elements.join(',')}),${storey})`);

  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME(${str(`${NAME}.ifc`)},'2026-01-01T00:00:00',('ExPlora4D'),('ExPlora4D'),${str(GENERATOR)},${str(GENERATOR)},'');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
${lines.join('\n')}
ENDSEC;
END-ISO-10303-21;
`;
}

// ---------------------------------------------------------------- FBX

// Flat (no group nodes) and in metres, the Y-up conversion in the vertices:
// three.js reads neither FBX's unit scale nor Blender's axis rotations on the
// nodes the way Blender writes them.
function buildFBX(target) {
  const script = `
import bpy, json, sys
a = json.loads(sys.argv[sys.argv.index('--') + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a['source'])
for image in list(bpy.data.images):
    if image.name in a['images']:
        image.user_remap(bpy.data.images.load(a['images'][image.name]))
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = world
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.export_scene.fbx(filepath=a['target'], path_mode='RELATIVE', embed_textures=False,
    object_types={'MESH'}, apply_scale_options='FBX_SCALE_ALL', bake_space_transform=True,
    mesh_smooth_type='OFF', use_tspace=False, add_leaf_bones=False, bake_anim=False,
    use_custom_props=False)
`;
  const images = Object.fromEntries(Object.entries(SHARED_TEXTURES).map(([name, t]) => [name, path.resolve(OUT, t.file)]));
  const args = JSON.stringify({ source: path.resolve(SOURCE), target: path.resolve(target), images });
  const result = spawnSync('blender', ['-b', '--factory-startup', '--python-expr', script, '--', args], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    console.warn('blender is not on PATH: keeping the old FBX');
    return false;
  }
  if (result.status !== 0) throw new Error(`Blender failed:\n${result.stdout}\n${result.stderr}`);
  return true;
}

// ---------------------------------------------------------------- write

await rm(path.join(OUT, 'tex'), { recursive: true, force: true });
await mkdir(path.join(OUT, 'tex'), { recursive: true });
for (const t of Object.values(SHARED_TEXTURES)) await writeFile(path.join(OUT, t.file), t.data);

const outputs = {
  glb: await buildGLB(),
  obj: buildOBJ(),
  mtl: buildMTL(),
  dae: buildDAE(texturePaths(SHARED_TEXTURES)),
  usda: buildUSDA(texturePaths(SHARED_TEXTURES)),
  usdz: buildUSDZ(),
  kmz: buildKMZ(),
  '3mf': build3MF(),
  amf: buildAMF(),
  wrl: buildWRL(),
  '3ds': build3DS(),
  stl: buildSTL(),
  ply: buildPLY(),
  xyz: buildXYZ(),
  pcd: buildPCD(),
  vox: buildVOX(),
  ifc: buildIFC(),
};
for (const [ext, data] of Object.entries(outputs)) await writeFile(path.join(OUT, `${NAME}.${ext}`), data);
buildFBX(path.join(OUT, `${NAME}.fbx`));

// Sizes; "packed" is what the file adds to the APK, which deflates
// everything but images.
const files = [...Object.keys(outputs).map((ext) => `${NAME}.${ext}`), `${NAME}.fbx`, ...Object.values(SHARED_TEXTURES).map((t) => t.file)];
let totalRaw = 0;
let totalPacked = 0;
console.log(`${triangles({ indices: meshes.flatMap((m) => m.indices) }).length} triangles, ${meshes.reduce((n, m) => n + vertexCount(m), 0)} vertices`);
for (const file of files) {
  const data = await readFile(path.join(OUT, file)).catch(() => null);
  if (!data) continue;
  const packed = /\.(webp|png|jpg)$/.test(file) ? data.length : Math.min(data.length, deflateSync(data, { level: 9 }).length);
  totalRaw += data.length;
  totalPacked += packed;
  console.log(`${file.padEnd(22)} ${(data.length / 1024).toFixed(1).padStart(7)} KB  packed ${(packed / 1024).toFixed(1).padStart(6)} KB`);
}
console.log(`${'total'.padEnd(22)} ${(totalRaw / 1024).toFixed(1).padStart(7)} KB  packed ${(totalPacked / 1024).toFixed(1).padStart(6)} KB`);
