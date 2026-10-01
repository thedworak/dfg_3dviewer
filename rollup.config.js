import url from '@rollup/plugin-url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';

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

const source = process.env.BUILD_SOURCE ?? "IIIF";
const envBuild = process.env.BUILD ?? "test";
const customModulesEnv = process.env.MODULE_CUSTOM ?? "";
let customModules = customModulesEnv;
const production = process.env.IS_PROD === 'true';
// Capacitor app build (see capacitor.config.json): served from inside the
// app package, so no PHP helpers, admin panel or source maps.
const mobile = envBuild === 'mobile';

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

// The app ships only the progressive Wolpa Synagogue (6.7 MB, Meshopt +
// KTX2): the full-resolution one (40 MB) and its gallery stay out of the
// mobile bundle, and everything that names it opens the progressive one.
const MOBILE_EXCLUDED_MODEL = 'WolpaSynagogue.glb';
const MOBILE_EXCLUDED_MODEL_URL = `./examples/${MOBILE_EXCLUDED_MODEL}`;
const MOBILE_REPLACEMENT_MODEL_URL = './examples/WolpaSynagogue-progressive.glb';

function keepInMobileExamples(source) {
  return path.basename(source) !== MOBILE_EXCLUDED_MODEL;
}

// Drops the full model's option from the example picker (index.html).
function removeExcludedModelOption(html) {
  return html.replace(
    new RegExp(`^[ \\t]*<option value="${MOBILE_EXCLUDED_MODEL_URL.replace(/\./g, '\\.')}">.*</option>\\r?\\n`, 'm'),
    ''
  );
}

// Points the bundled manifests' model at the progressive one (only the exact
// model URL - "./examples/WolpaSynagogue.glb/scene" etc. are just ids).
async function retargetMobileManifests(dir) {
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith('.json'));
  await Promise.all(files.map(async (file) => {
    const target = path.join(dir, file);
    const json = await fs.readFile(target, 'utf8');
    const retargeted = json.split(`"${MOBILE_EXCLUDED_MODEL_URL}"`).join(`"${MOBILE_REPLACEMENT_MODEL_URL}"`);
    if (retargeted !== json) await fs.writeFile(target, retargeted);
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
    .replace(/(src=["'])(dfg_3dviewer-module\.js)(["'])/g, `$1$2${versionQuery}$3`)
    .replace(/(href=["'])(assets\/css\/[^"'?]+\.css)(["'])/g, `$1$2${versionQuery}$3`);
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

async function copyHtmlWithEntryVersion(source, target) {
  const html = stampEntryVersion(await fs.readFile(source, 'utf8'));
  await fs.writeFile(target, mobile ? removeExcludedModelOption(html) : html);
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

function copyBuildAssets() {
  return {
    name: 'copy-build-assets',
    async writeBundle() {
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
        ),
        copyDirectory('viewer/js/maps', path.join(outDistDir, 'assets/maps')),
        copyDirectory('viewer/examples', path.join(outDistDir, 'examples'), mobile ? keepInMobileExamples : undefined)
          .then(() => convertGalleryToWebp(path.join(outDistDir, 'examples/gallery'))),
        copyDirectory('viewer/manifesto/examples', path.join(outDistDir, 'manifests'))
          .then(() => mobile && retargetMobileManifests(path.join(outDistDir, 'manifests'))),
        // Manifest schema, served at the URL in its $id: <site>/schema/AIM3DViewer-schema.json.
        fs.mkdir(path.join(outDistDir, 'schema'), { recursive: true }).then(() => Promise.all(
          ['AIM3DViewer-schema.json', 'AIM3DViewer-schema.md'].map((file) =>
            fs.copyFile(path.join('viewer/manifesto', file), path.join(outDistDir, 'schema', file))))),
        // copy admin panel (but we'll remove any local sqlite DB afterwards)
        !mobile && copyDirectory('viewer/admin', path.join(outDistDir, 'admin')),
        // Legal pages for the store listings: <site>/privacy.html and
        // <site>/delete-account.html, with their shared CSS/JS in assets/legal.
        ...(mobile ? [] : [
          ...['privacy.html', 'delete-account.html'].map((page) =>
            fs.copyFile(path.join('viewer/legal', page), path.join(outDistDir, page))),
          fs.mkdir(path.join(outDistDir, 'assets/legal'), { recursive: true }).then(() => Promise.all(
            ['legal.css', 'legal.js'].map((file) =>
              fs.copyFile(path.join('viewer/legal', file), path.join(outDistDir, 'assets/legal', file))))),
        ]),
      ]);
      await stampCssImports(path.join(outDistDir, 'assets/css/viewer.css'));

      const viewerSettingsTarget = path.join(outDistDir, 'viewer-settings.json');
      const settingsPhpTarget = path.join(outDistDir, 'settings.local.php');
      const indexTarget = path.join(outDistDir, 'index.html');
      const embedTarget = path.join(outDistDir, 'embed.html');

      const copyPromises = [
        writeDrupalLibrariesFile(),
        copyHtmlWithEntryVersion('index.html', indexTarget),
        copyHtmlWithEntryVersion('embed.html', embedTarget),
      ];

      if (!mobile) {
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
      if (envBuild === 'drupal') {
        const viewerSettingsMain = JSON.parse(
          await fs.readFile(viewerSettingsSource, 'utf8')
        );
        viewerSettingsMain.baseModulePath = `${drupalModulePrefix}/dist/${envBuild}/${envSubdir}/assets`;
        viewerSettingsMain.entity.metadata.source = "Drupal";
        copyPromises.push(
          fs.writeFile(
            viewerSettingsTarget,
            JSON.stringify(viewerSettingsMain, null, 2), { flag: 'wx' }
          ).catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
          })
        );
      } else if (mobile) {
        // Built from the tracked example (viewer-settings.json is local-only),
        // so the app bundle is the same on every machine and in CI.
        // The app is served from https://localhost (Capacitor's default), so
        // assets resolve against the bundle itself. mobile.remoteUrl is the
        // default repository (MOBILE_REMOTE_URL, default below; set it empty
        // for offline only); the app can change it, and keeps that on the
        // device.
        viewerSettings.mainUrl = '';
        viewerSettings.baseModulePath = '/assets';
        viewerSettings.viewer.forceLocalPreview = true;
        // editor + lightweight = the viewing tools (toolbar: measuring,
        // clipping, ...) without the ones that save to a server.
        viewerSettings.viewer.editor = true;
        viewerSettings.viewer.lightweight = true;
        viewerSettings.viewer.gallery = { ...viewerSettings.viewer.gallery, build: false };
        // Bug reports and crashes go to GlitchTip (docs/error-tracking.md);
        // off without a DSN.
        if (process.env.MOBILE_GLITCHTIP_DSN) {
          viewerSettings.viewer.errorTracking = {
            dsn: process.env.MOBILE_GLITCHTIP_DSN,
            environment: process.env.MOBILE_GLITCHTIP_ENVIRONMENT || 'app',
          };
        }
        viewerSettings.mobile = {
          remoteUrl: process.env.MOBILE_REMOTE_URL ?? 'https://viewer.thedworak.com',
          // First model the app opens, until the user picks another (main.js).
          // The progressive Wolpa Synagogue: the same model as the full one,
          // about a sixth of its size (Meshopt + KTX2).
          defaultModel: process.env.MOBILE_DEFAULT_MODEL || './examples/WolpaSynagogue-progressive.glb',
        };
        // The launch splash artwork for the page (viewer/app-splash.js) -
        // Android's own splash shows only the icon. WebP: the PNGs in
        // resources/ are a few MB each.
        copyPromises.push((async () => {
          const { default: sharp } = await import('sharp');
          await fs.mkdir(path.join(outDistDir, 'assets/img'), { recursive: true });
          await Promise.all([['splash.png', 'app-splash.webp'], ['splash-dark.png', 'app-splash-dark.webp']]
            .map(([source, target]) => sharp(path.join('resources', source))
              .resize(1440, 1440, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 82 })
              .toFile(path.join(outDistDir, 'assets/img', target))));
        })());
        // Plans and ads (viewer/monetization/, docs/mobile-monetization.md).
        // Defaults are Google's AdMob test units and no RevenueCat key (the
        // store stays off); release builds pass their own through the env.
        // testing: test ads, and the plans panel can force a plan.
        // One bundle serves both apps (cap sync copies dist/mobile into
        // android/ and ios/), so the ad units and the RevenueCat key are kept
        // per platform and picked at run time (Capacitor.getPlatform()).
        // MOBILE_* without a platform are Android's, MOBILE_IOS_* iOS's.
        viewerSettings.mobile.monetization = {
          testing: process.env.MOBILE_MONETIZATION_TESTING !== 'false',
          admob: {
            android: {
              bannerId: process.env.MOBILE_ADMOB_BANNER_ID || 'ca-app-pub-3940256099942544/9214589741',
              interstitialId: process.env.MOBILE_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-3940256099942544/1033173712',
            },
            ios: {
              bannerId: process.env.MOBILE_IOS_ADMOB_BANNER_ID || 'ca-app-pub-3940256099942544/2934735716',
              interstitialId: process.env.MOBILE_IOS_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-3940256099942544/4411468910',
            },
            interstitialEvery: Number(process.env.MOBILE_ADMOB_INTERSTITIAL_EVERY || 3),
            interstitialMinIntervalSec: Number(process.env.MOBILE_ADMOB_INTERSTITIAL_MIN_INTERVAL_SEC || 180),
          },
          revenuecat: {
            apiKeys: {
              android: process.env.MOBILE_REVENUECAT_API_KEY || '',
              ios: process.env.MOBILE_IOS_REVENUECAT_API_KEY || '',
            },
            offering: process.env.MOBILE_REVENUECAT_OFFERING || 'default',
            entitlements: { pro: 'pro', business: 'business' },
            products: {
              pro: process.env.MOBILE_PRODUCT_PRO || 'explora_pro',
              business: process.env.MOBILE_PRODUCT_BUSINESS || 'explora_business_monthly',
            },
          },
        };
        // Always rewritten: nothing here is meant to be edited by hand, and a
        // stale copy would otherwise be synced into the app.
        copyPromises.push(
          fs.writeFile(viewerSettingsTarget, JSON.stringify(viewerSettings, null, 2))
        );
      } else if (envBuild === 'test' || envBuild === 'dev') {
        const viewerSettingsMain = JSON.parse(
          await fs.readFile(viewerSettingsSource, 'utf8')
        );
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
            JSON.stringify(viewerSettingsMain, null, 2), { flag: 'wx' }
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
            JSON.stringify(viewerSettings, null, 2), { flag: 'wx' }
          ).catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
          })
        );
      }

      await Promise.all(copyPromises);
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

export default {
  input: 'viewer/main.js',
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_SOURCE__: JSON.stringify(source),
        __BUILD__: JSON.stringify(envBuild),
        __BUILD_ID__: JSON.stringify(buildId),
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

    copyBuildAssets(),
    removeStaleChunks(),

    production && terser(),

  ].filter(Boolean),

  output: {
    dir: outDistDir,
    entryFileNames: 'dfg_3dviewer-module.js',
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
      if (id.includes("node_modules/three")) {
        return "three";
      }
    },
    sourcemap: !mobile,
  },
};
