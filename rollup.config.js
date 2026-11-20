import url from '@rollup/plugin-url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';
import { transform as transformCss } from 'lightningcss';

// Shown in the credits footer. Docker builds have no .git (see .dockerignore),
// so deploy passes BUILD_ID (the commit's short hash) in explicitly.
function resolveBuildId() {
  if (process.env.BUILD_ID) return process.env.BUILD_ID.trim();
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}
const buildId = resolveBuildId();
// When the bundle was built (ISO 8601, UTC), shown beside BUILD_ID; BUILD_TIME
// overrides it (e.g. the commit's time, for a reproducible build).
const buildTime = process.env.BUILD_TIME?.trim() || new Date().toISOString();

const source = process.env.BUILD_SOURCE ?? "IIIF";
const envBuild = process.env.BUILD ?? "test";
const customModulesEnv = process.env.MODULE_CUSTOM ?? "";
let customModules = customModulesEnv;
const production = process.env.IS_PROD === 'true';
// VIEWER_BUILD_EXTENSION: a module (path from the repository root) that adds
// to the builds - rollup plugins, files, settings - without changing this
// file. It may also claim an app build (isAppBuild(envBuild)): one served
// from inside an app package, so no PHP helpers, admin panel or source maps,
// and its viewer-settings.json comes from extension.appSettings(). Hooks, all
// optional: plugins(ctx), examplesFilter(source, ctx), transformHtml(html),
// appSettings(settings, ctx), writeBundle(ctx); ctx = { envBuild,
// outDistDir, production, appBuild }.
const extensionPath = process.env.VIEWER_BUILD_EXTENSION?.trim();
const extension = extensionPath
  ? await import(pathToFileURL(path.resolve(extensionPath)).href)
  : {};
const appBuild = Boolean(extension.isAppBuild?.(envBuild));

// BRAND: a client profile, clients/<BRAND>/ (docs/branding.md). Its
// viewer-settings.json is merged over the build's settings (objects key by
// key, everything else replaced), its brand/ folder is copied to
// <build>/brand/, and branding.title / branding.favicon go into the HTML
// pages' <title> and icon link, so they are right before the script runs.
const brandId = process.env.BRAND?.trim() || '';
if (brandId && !/^[a-z0-9_-]+$/i.test(brandId)) {
  throw new Error(`[rollup] BRAND must be a folder name in clients/ (letters, digits, - and _), not "${brandId}"`);
}
const brandDir = brandId ? path.join('clients', brandId) : '';
async function readBrandSettings() {
  if (!brandDir) return null;
  try {
    await fs.access(brandDir);
  } catch {
    throw new Error(`[rollup] BRAND=${brandId}: ${brandDir}/ does not exist`);
  }
  try {
    return JSON.parse(await fs.readFile(path.join(brandDir, 'viewer-settings.json'), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`[rollup] BRAND=${brandId}: ${brandDir}/viewer-settings.json: ${err.message}`);
  }
}
const brandSettings = await readBrandSettings();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeSettings(target, source) {
  if (!isPlainObject(source)) return target;
  for (const [key, value] of Object.entries(source)) {
    target[key] = isPlainObject(value) && isPlainObject(target[key])
      ? mergeSettings(target[key], value)
      : structuredClone(value);
  }
  return target;
}

const withBrand = (settings) => (brandSettings ? mergeSettings(settings, brandSettings) : settings);

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function brandHtml(html) {
  const branding = brandSettings?.branding;
  if (!branding) return html;
  let out = html;
  if (typeof branding.title === 'string' && branding.title.trim()) {
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(branding.title.trim())}</title>`);
  }
  if (typeof branding.favicon === 'string' && branding.favicon.trim()) {
    // The whole tag: its type (image/png) may not fit the client's icon.
    out = out.replace(/<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>/i,
      `<link rel="icon" href="${escapeHtml(branding.favicon.trim())}">`);
  }
  return out;
}

if (customModules && !customModules.startsWith('/')) {
  customModules = `/${customModules}`;
}

const envSubdir = envBuild === 'drupal'
  ? (customModules ? customModules.replace(/^\//, '') : 'main')
  : '';
const outDistDir = envSubdir
  ? path.join('dist', envBuild, envSubdir)
  : path.join('dist', envBuild);

console.log('[rollup] build:', envBuild);
console.log('[rollup] source:', source);
console.log('[rollup] outDir:', outDistDir);
if (extensionPath) console.log('[rollup] extension:', extensionPath, appBuild ? '(app build)' : '');
if (brandId) console.log('[rollup] brand:', brandDir);

function normalizePathSegment(seg = '') {
  return seg.replace(/^\/+|\/+$/g, '');
}

const modulesPath = normalizePathSegment(customModules);
const drupalModulePrefix = modulesPath ? `/modules/${modulesPath}/dfg_3dviewer` : '/modules/dfg_3dviewer';

console.log('[rollup] modulesPath:', modulesPath);
console.log('[rollup] output subdirectory:', envSubdir);

async function copyDirectory(source, target, filter) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, {
    recursive: true,
    dereference: true,
    filter,
  });
}

// fs.cp filter for copying only the named files from the top of root
// (subdirectories are skipped).
function keepFiles(root, names) {
  const keep = new Set(names);
  const rootPath = path.resolve(root);
  return (source) => {
    const sourcePath = path.resolve(source);
    return sourcePath === rootPath
      || (path.dirname(sourcePath) === rootPath && keep.has(path.basename(sourcePath)));
  };
}

// The favicon source is the 1254 px app icon; a browser tab needs 64 px.
async function shrinkFavicon(file) {
  const { default: sharp } = await import('sharp');
  const resized = await sharp(file).resize(64, 64).png().toBuffer();
  await fs.writeFile(file, resized);
}

// The gallery renders (scripts/render.py, 512 px PNG) as WebP: about a
// twentieth of the size, transparency kept. thumbnail-gallery.js asks for
// .webp in these builds (GALLERY_IMAGE_EXT).
async function convertGalleryToWebp(dir) {
  const { default: sharp } = await import('sharp');
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return;
  }
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map(async (entry) => {
      const source = path.join(entry.parentPath, entry.name);
      await sharp(source).webp({ quality: 80 }).toFile(source.replace(/\.png$/, '.webp'));
      await fs.rm(source);
    }));
}

async function writeDrupalLibrariesFile() {
  if (envBuild !== 'drupal') {
    return;
  }

  const template = await fs.readFile('dfg_3dviewer.libraries.tpl.yml', 'utf8');
  const rendered = template
    .replaceAll('__DRUPAL_MAIN_SUBDIR__', 'main')
    .replaceAll('__DRUPAL_CUSTOM_SUBDIR__', 'custom');
  await fs.writeFile('dfg_3dviewer.libraries.yml', rendered);
}

async function renderSettingsLocalPhp() {
  const template = await fs.readFile('settings.local.php.tpl', 'utf8');
  const dfgEnv = envBuild === 'drupal'
    ? (envSubdir === 'custom' ? 'drupal_custom' : 'drupal')
    : envBuild;

  return template.replaceAll('__DFG_ENV__', dfgEnv);
}

async function writeIfNotExists(filePath, content) {
  try {
    await fs.access(filePath);
    console.log(`[rollup] skip existing: ${filePath}`);
    return false;
  } catch {
    await fs.writeFile(filePath, content);
    console.log(`[rollup] created: ${filePath}`);
    return true;
  }
}

// The entry keeps its name (Drupal's library file points at it), so pages
// load it with the build id, and a cached copy of an older build never meets
// this build's chunks. The same for the stylesheets (fixed names too): a
// cached older main.css next to this build's scripts showed controls it had
// no styles for.
const versionQuery = `?v=${encodeURIComponent(buildId)}`;

function stampEntryVersion(html) {
  return html
    .replace(/(src=["'])(dfg_3dviewer-module\.js|intro\.js|ultra\.js)(["'])/g, `$1$2${versionQuery}$3`)
    .replace(/(href=["'])(assets\/(?:css|intro)\/[^"'?]+\.css)(["'])/g, `$1$2${versionQuery}$3`);
}

// viewer.css (the stylesheet Drupal loads, with its own cache query) pulls
// in the others with @import - those URLs get the build id as well.
async function stampCssImports(file) {
  let css;
  try {
    css = await fs.readFile(file, 'utf8');
  } catch {
    return;
  }
  await fs.writeFile(
    file,
    css.replace(/(@import\s+(?:url\()?["'])([^"'?]+\.css)(["'])/g, `$1$2${versionQuery}$3`)
  );
}

// Production builds (IS_PROD=true) minify the stylesheets they copy, file by
// file: the @import chain stays (Drupal loads viewer.css, which imports the
// rest), so do this after stampCssImports. Already minified files (*.min.css)
// are left alone; one lightningcss cannot parse is copied as it is.
async function minifyCssTree(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return minifyCssTree(file);
    if (!entry.name.endsWith('.css') || entry.name.endsWith('.min.css')) return;
    try {
      const { code } = transformCss({ filename: file, code: await fs.readFile(file), minify: true });
      await fs.writeFile(file, code);
    } catch (err) {
      console.warn(`[rollup] CSS not minified, ${file}: ${err.message}`);
    }
  }));
}

async function copyHtmlWithEntryVersion(source, target) {
  const html = brandHtml(stampEntryVersion(await fs.readFile(source, 'utf8')));
  await fs.writeFile(target, extension.transformHtml ? extension.transformHtml(html) : html);
}

// The admin pages (exadmin/index.html -> <build>/exadmin/index.html): the
// script is pointed at the content-hashed entry chunk this build wrote, the
// stylesheet gets the build id.
async function writeAdminPage(bundle) {
  const entry = Object.values(bundle).find((chunk) => chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'exadmin');
  if (!entry) return;
  const html = (await fs.readFile('exadmin/index.html', 'utf8'))
    .replace('src="../assets/exadmin.js"', `src="../${entry.fileName}"`)
    .replace(/(href=["'])(\.\.\/assets\/css\/[^"'?]+\.css)(["'])/g, `$1$2${versionQuery}$3`);
  await fs.mkdir(path.join(outDistDir, 'exadmin'), { recursive: true });
  await fs.writeFile(path.join(outDistDir, 'exadmin', 'index.html'), html);
}

// Chunks are named by their content hash (see output.chunkFileNames): files
// of one build always fit together. Only chunks sit at the top of assets/
// (libraries, CSS, images and fonts are copied into its folders), so any
// .js / .js.map file there that this build did not write is left over from
// an earlier one - removed, so that no stale chunk can be served.
function removeStaleChunks() {
  return {
    name: 'remove-stale-chunks',
    async writeBundle(_options, bundle) {
      const assetsDir = path.join(outDistDir, 'assets');
      const written = new Set(Object.keys(bundle).map((fileName) => path.basename(fileName)));
      let entries = [];
      try {
        entries = await fs.readdir(assetsDir, { withFileTypes: true });
      } catch {
        return;
      }
      await Promise.all(entries
        .filter((entry) => entry.isFile() && /\.js(\.map)?$/.test(entry.name) && !written.has(entry.name))
        .map((entry) => fs.rm(path.join(assetsDir, entry.name), { force: true })));
    },
  };
}

// Module workers: `new Worker(new URL("./x-worker.js", import.meta.url),
// { type: "module" })` (the form Parcel's dev server bundles as well). The
// worker file becomes a chunk of its own - content-hashed like the others,
// sharing chunks with the page - and the URL points at it.
function moduleWorkers() {
  const pattern = /new URL\((["'])(\.{1,2}\/[^"']+-worker\.js)\1,\s*import\.meta\.url\)/g;
  return {
    name: 'module-workers',
    async transform(code, id) {
      // The viewer's own workers only: a dependency may show the pattern in
      // a comment (geotiff's pool.js).
      if (id.includes('node_modules')) return null;
      if (!code.includes('-worker.js') || !code.includes('import.meta.url')) return null;
      let result = code;
      for (const match of code.matchAll(pattern)) {
        const resolved = await this.resolve(match[2], id);
        if (!resolved) this.error(`Worker not found: ${match[2]} (from ${id})`);
        const ref = this.emitFile({ type: 'chunk', id: resolved.id, name: path.basename(match[2], '.js') });
        result = result.replace(match[0], `new URL(import.meta.ROLLUP_FILE_URL_${ref})`);
      }
      return result === code ? null : { code: result, map: null };
    },
  };
}

const buildContext = { envBuild, outDistDir, production, appBuild };

function copyBuildAssets() {
  return {
    name: 'copy-build-assets',
    async writeBundle(_options, bundle) {
      await fs.mkdir(outDistDir, { recursive: true });
      await Promise.all([
        // Only what is loaded at run time (the rest of these packages is
        // ~25 MB of sources, typings and Node builds): the glTF Draco decoder
        // (loaders.js sets draco/gltf/), web-ifc's wasm (its API is bundled
        // into the IFCLoader chunk; -mt when the page is cross-origin
        // isolated), and the one font the measurement labels use
        // (viewer-helpers.js). Licenses go along.
        copyDirectory(
          'node_modules/three/examples/jsm/libs/draco/gltf',
          path.join(outDistDir, 'assets/draco/gltf')
        ),
        // KTX2/Basis Universal transcoder for KHR_texture_basisu textures.
        copyDirectory(
          'node_modules/three/examples/jsm/libs/basis',
          path.join(outDistDir, 'assets/basis')
        ),
        copyDirectory(
          'node_modules/web-ifc',
          path.join(outDistDir, 'assets/ifc'),
          keepFiles('node_modules/web-ifc', ['web-ifc.wasm', 'web-ifc-mt.wasm', 'LICENSE.md'])
        ),
        copyDirectory('viewer/css', path.join(outDistDir, 'assets/css')),
        copyDirectory('viewer/img', path.join(outDistDir, 'assets/img'))
          .then(() => shrinkFavicon(path.join(outDistDir, 'assets/img/icon.png'))),
        copyDirectory(
          'viewer/fonts',
          path.join(outDistDir, 'assets/fonts'),
          keepFiles('viewer/fonts', ['helvetiker_regular.typeface.json', 'LICENSE', 'README.md'])
        // The interface's Inter and JetBrains Mono (css/fonts.css), after:
        // the copy above clears assets/fonts.
        ).then(() => copyDirectory('viewer/fonts/ui', path.join(outDistDir, 'assets/fonts/ui'))),
        copyDirectory('viewer/js/maps', path.join(outDistDir, 'assets/maps')),
        // The intro page's stylesheet and points (intro.html, viewer/intro/;
        // the points from scripts/build-intro-points.mjs) - in an app build
        // too, which opens with it the first time.
        copyDirectory(
          'viewer/intro',
          path.join(outDistDir, 'assets/intro'),
          keepFiles('viewer/intro', ['intro.css', 'synagogue-points.bin'])
        // The time travel's textures and stages (scripts/build-intro-time.mjs),
        // after: both make assets/intro/.
        ).then(() => Promise.all([
          copyDirectory('viewer/intro/time', path.join(outDistDir, 'assets/intro/time')),
          // Other models for the intro (viewer.intro.scene, docs/intro.md);
          // an app build shows the synagogue only.
          !appBuild && copyDirectory('viewer/intro/scenes', path.join(outDistDir, 'assets/intro/scenes')),
        ])),
        copyDirectory('viewer/examples', path.join(outDistDir, 'examples'),
          extension.examplesFilter && ((source) => extension.examplesFilter(source, buildContext)))
          .then(() => convertGalleryToWebp(path.join(outDistDir, 'examples/gallery'))),
        // manifests/index.json is the example list the viewer fetches at
        // runtime (example-manifests.js).
        copyDirectory('viewer/manifesto/examples', path.join(outDistDir, 'manifests')),
        // Manifest schema, served at the URL in its $id: <site>/schema/AIM3DViewer-schema.json.
        fs.mkdir(path.join(outDistDir, 'schema'), { recursive: true }).then(() => Promise.all(
          ['AIM3DViewer-schema.json', 'AIM3DViewer-schema.md'].map((file) =>
            fs.copyFile(path.join('viewer/manifesto', file), path.join(outDistDir, 'schema', file))))),
        // The client profile's files (BRAND): logos, favicon, brand.css.
        brandDir && fs.access(path.join(brandDir, 'brand')).then(
          () => copyDirectory(path.join(brandDir, 'brand'), path.join(outDistDir, 'brand')),
          () => {}),
        // copy admin panel (but we'll remove any local sqlite DB afterwards)
        !appBuild && copyDirectory('viewer/admin', path.join(outDistDir, 'admin')),
      ]);
      await stampCssImports(path.join(outDistDir, 'assets/css/viewer.css'));
      await stampCssImports(path.join(outDistDir, 'assets/css/exadmin.css'));
      await stampCssImports(path.join(outDistDir, 'assets/intro/intro.css'));
      if (production) {
        await Promise.all(['assets/css', 'assets/intro', 'brand'].map((dir) => minifyCssTree(path.join(outDistDir, dir))));
      }

      const viewerSettingsTarget = path.join(outDistDir, 'viewer-settings.json');
      const settingsPhpTarget = path.join(outDistDir, 'settings.local.php');
      const indexTarget = path.join(outDistDir, 'index.html');
      const embedTarget = path.join(outDistDir, 'embed.html');

      const copyPromises = [
        writeDrupalLibrariesFile(),
        copyHtmlWithEntryVersion('index.html', indexTarget),
        copyHtmlWithEntryVersion('embed.html', embedTarget),
        copyHtmlWithEntryVersion('intro.html', path.join(outDistDir, 'intro.html')),
        copyHtmlWithEntryVersion('ultra.html', path.join(outDistDir, 'ultra.html')),
        writeAdminPage(bundle),
      ];

      if (!appBuild) {
        copyPromises.push(
          renderSettingsLocalPhp().then(content => fs.writeFile(settingsPhpTarget, content))
        );
      }

      let viewerSettingsSource = 'viewer/viewer-settings-example.json';
      const viewerSettings = JSON.parse(
        await fs.readFile(viewerSettingsSource, 'utf8')
      );
      viewerSettings.viewer.lightweight = 1;
      viewerSettingsSource = 'viewer-settings.json';
      // A client profile is the source of its settings: rewritten on every
      // build, where without one an existing file is kept.
      const settingsFlag = brandSettings ? 'w' : 'wx';
      if (envBuild === 'drupal') {
        const viewerSettingsMain = withBrand(JSON.parse(
          await fs.readFile(viewerSettingsSource, 'utf8')
        ));
        viewerSettingsMain.baseModulePath = `${drupalModulePrefix}/dist/${envBuild}/${envSubdir}/assets`;
        viewerSettingsMain.entity.metadata.source = "Drupal";
        copyPromises.push(
          fs.writeFile(
            viewerSettingsTarget,
            JSON.stringify(viewerSettingsMain, null, 2), { flag: settingsFlag }
          ).catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
          })
        );
      } else if (appBuild) {
        // Built from the tracked example (viewer-settings.json is local-only),
        // so the app bundle is the same on every machine and in CI. Always
        // rewritten: a stale copy would otherwise end up in the app.
        const settings = await extension.appSettings(viewerSettings, buildContext);
        copyPromises.push(
          fs.writeFile(viewerSettingsTarget, JSON.stringify(settings, null, 2))
        );
      } else if (envBuild === 'test' || envBuild === 'dev') {
        const viewerSettingsMain = withBrand(JSON.parse(
          await fs.readFile(viewerSettingsSource, 'utf8')
        ));
        viewerSettingsMain.viewer.gallery.build = false;
        viewerSettingsMain.viewer.editor = true;
        viewerSettingsMain.viewer.lightweight = true;
        // Empty (falsy), not the literal string "localhost" - several
        // runtime call sites do `core.CONFIG?.mainUrl || window.location.origin`
        // (viewer-helpers.js, thumbnail-capture.js, thumbnail-gallery.js),
        // and metadata-persistence.js does
        // `core.CONFIG.mainUrl + "/api/editor/save-metadata"` unconditionally.
        // A truthy "localhost" (no scheme) wins over those origin fallbacks
        // and gets treated as a *relative* path segment by fetch()/URL
        // resolution, producing broken same-origin requests like
        // "/localhost/api/editor/save-metadata" instead of
        // "/api/editor/save-metadata" on any real (non-localhost) domain -
        // e.g. the test-viewer/dev-viewer/sandbox-viewer Docker services
        // (see docker-compose.yml), each reachable under its own real
        // hostname. Empty string is falsy, so those call sites correctly
        // fall back to the page's actual origin instead - on a plain local
        // `npm run dev:test` that's already `http://localhost:1234`, so
        // this doesn't change local-dev behavior at all, only fixes it for
        // any other hostname.
        viewerSettingsMain.mainUrl = '';
        viewerSettingsMain.baseModulePath = `${drupalModulePrefix}/dist/${envBuild}/assets`;
        if (envBuild === 'dev') {
          viewerSettingsMain.entity.metadata.sourceType = 'IIIF';
        }
        copyPromises.push(
          fs.writeFile(
            viewerSettingsTarget,
            JSON.stringify(viewerSettingsMain, null, 2), { flag: settingsFlag }
          ).catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
          })
        );
      } else {
        copyPromises.push(
          fs.writeFile(
            viewerSettingsTarget,
            JSON.stringify(withBrand(viewerSettings), null, 2), { flag: settingsFlag }
          ).catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
          })
        );
      }

      await Promise.all(copyPromises);
      await extension.writeBundle?.(buildContext);
      // ensure we don't accidentally publish a local admin sqlite DB
      try {
        const adminDbDest = path.join(outDistDir, 'admin', 'admin.sqlite');
        await fs.rm(adminDbDest, { force: true });
      } catch (e) {
        // ignore
      }
    },
  };
}

const viewerConfig = {
  // The viewer, the admin pages (viewer/exadmin/) and the intro page
  // (intro.html, viewer/intro/). An app build carries the admin pages too:
  // they administer the repository it is connected to (ui/admin-panel.js).
  input: { 'dfg_3dviewer-module': 'viewer/main.js', exadmin: 'viewer/exadmin/main.js', intro: 'viewer/intro/intro.js' },
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  },
  plugins: [
    ...(extension.plugins?.(buildContext) || []),
    replace({
      preventAssignment: true,
      values: {
        __BUILD_SOURCE__: JSON.stringify(source),
        __BUILD__: JSON.stringify(envBuild),
        __BUILD_ID__: JSON.stringify(buildId),
        __BUILD_TIME__: JSON.stringify(buildTime),
        __IS_PROD__: JSON.stringify(production),
        __MODULES_PATH__: JSON.stringify(modulesPath),
        __ENV_SUBDIR__: JSON.stringify(envSubdir),
      },
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      mainFields: ['module', 'browser', 'main'],
      extensions: ['.js'],
      dedupe: ['three'],
      preserveSymlinks: false,
      exportConditions: ['module']
    }),

    commonjs({
      include: [/node_modules/],
      exclude: ['node_modules/three/**'],
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto'
    }),
    json(),

    url({
      include: ['viewer/**/*.{svg,png,jpg,gif,hdr}'],
      limit: 0,
      fileName: 'assets/[name][extname]',
      publicPath: 'assets/'
    }),

    moduleWorkers(),
    copyBuildAssets(),
    removeStaleChunks(),

    production && terser(),

  ].filter(Boolean),

  output: {
    dir: outDistDir,
    // The viewer's entry keeps its name (Drupal's library file and the
    // pages point at it); the admin pages' is hashed like the chunks
    // (writeAdminPage puts its name into exadmin/index.html).
    entryFileNames: (chunk) => {
      if (chunk.name === 'exadmin') return 'assets/exadmin-[hash].js';
      if (chunk.name === 'intro') return 'intro.js';
      return 'dfg_3dviewer-module.js';
    },
    // Content-hashed: a cache (browser, CDN, the 30-day expiry for module
    // JS in docker/host-nginx.example.conf) can never hand out one build's
    // chunk next to another build's - their minified export names differ,
    // and a mix breaks at run time (e.g. "e.manager.addHandler is not a
    // function" from 3d-tiles-renderer getting another class for
    // LoadingManager).
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name][extname]',
    sourcemapFileNames: 'assets/[name]-[hash].js.map',
    format: 'es',
    manualChunks(id) {
      // The WebGPU renderer, TSL and its effects (?renderer=webgpu,
      // viewer/renderer-backend.js) in a chunk of their own: the default
      // WebGL viewer never downloads them. three.core.js, which both builds
      // share, stays in "three". So do the node versions of the example
      // objects (SkyMesh.js for the weather, editor/weather-webgpu.js): they
      // import three/webgpu, and in "three" they would make the two chunks
      // import each other (EventDispatcher read before it is defined).
      if (/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?three\/(build\/three\.(webgpu|tsl)|examples\/jsm\/tsl\/|examples\/jsm\/objects\/\w+Mesh\.js)/.test(id)) {
        return "three-webgpu";
      }
      // Only three itself (build/) in "three". Its examples (format loaders,
      // their parsers and decoders, controls, passes) are left to Rollup: the
      // ones the viewer imports statically go with it, and the format loaders
      // that loaders.js imports on demand (FBX, USD, Collada, VRML with
      // chevrotain, 3MF, LWO, KTX2, ...) get chunks of their own, downloaded
      // only for a model of that format. In "three" they were all downloaded
      // at start, dynamic import() or not.
      if (/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?three\/build\//.test(id)) {
        return "three";
      }
    },
    sourcemap: !appBuild,
  },
};

// The ultralight viewer (ultra.html, viewer/ultra.js): a glTF / GLB model and
// nothing else. A build of its own, so that it shares no chunk with the full
// viewer: ultra.js next to the pages, and in assets/ultra/ the loaders it
// imports only for a model that needs them (Draco, KTX2, Meshopt). It uses
// the Draco and Basis decoders and the environment map the viewer's build
// copies into assets/, so it is built after it (rollup runs the configs in
// order).
const ultraConfig = {
  input: 'viewer/ultra.js',
  treeshake: viewerConfig.treeshake,
  plugins: [
    resolve({ browser: true, preferBuiltins: false, dedupe: ['three'] }),
    production && terser(),
  ].filter(Boolean),
  output: {
    dir: outDistDir,
    entryFileNames: 'ultra.js',
    chunkFileNames: 'assets/ultra/[name]-[hash].js',
    sourcemapFileNames: 'assets/ultra/[name]-[hash].js.map',
    format: 'es',
    // three in a chunk of its own, which ultra.js and the loaders import: in
    // ultra.js, the loaders would import "ultra.js" while the page loads
    // "ultra.js?v=..." - a second copy of the viewer, started again.
    manualChunks(id) {
      if (/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?three\/build\//.test(id)) return 'three';
    },
    sourcemap: !appBuild,
  },
};

export default [viewerConfig, ultraConfig];
