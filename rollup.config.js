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

async function copyDirectory(source, target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, {
    recursive: true,
    dereference: true,
  });
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
// this build's chunks.
function stampEntryVersion(html) {
  return html.replace(
    /(src=["'])(dfg_3dviewer-module\.js)(["'])/g,
    `$1$2?v=${encodeURIComponent(buildId)}$3`
  );
}

async function copyHtmlWithEntryVersion(source, target) {
  await fs.writeFile(target, stampEntryVersion(await fs.readFile(source, 'utf8')));
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
        copyDirectory(
          'node_modules/three/examples/jsm/libs/draco',
          path.join(outDistDir, 'assets/draco')
        ),
        // KTX2/Basis Universal transcoder for KHR_texture_basisu textures.
        copyDirectory(
          'node_modules/three/examples/jsm/libs/basis',
          path.join(outDistDir, 'assets/basis')
        ),
        copyDirectory(
          'node_modules/web-ifc',
          path.join(outDistDir, 'assets/ifc')
        ),
        copyDirectory('viewer/css', path.join(outDistDir, 'assets/css')),
        copyDirectory('viewer/img', path.join(outDistDir, 'assets/img')),
        copyDirectory('viewer/fonts', path.join(outDistDir, 'assets/fonts')),
        copyDirectory('viewer/js/maps', path.join(outDistDir, 'assets/maps')),
        copyDirectory('viewer/examples', path.join(outDistDir, 'examples')),
        copyDirectory('viewer/manifesto/examples', path.join(outDistDir, 'manifests')),
        // copy admin panel (but we'll remove any local sqlite DB afterwards)
        !mobile && copyDirectory('viewer/admin', path.join(outDistDir, 'admin')),
      ]);

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
        // default repository (MOBILE_REMOTE_URL); the app can change it, and
        // keeps that on the device. Empty = offline only.
        viewerSettings.mainUrl = '';
        viewerSettings.baseModulePath = '/assets';
        viewerSettings.viewer.forceLocalPreview = true;
        // editor + lightweight = the viewing tools (toolbar: measuring,
        // clipping, ...) without the ones that save to a server.
        viewerSettings.viewer.editor = true;
        viewerSettings.viewer.lightweight = true;
        viewerSettings.viewer.gallery = { ...viewerSettings.viewer.gallery, build: false };
        viewerSettings.mobile = { remoteUrl: process.env.MOBILE_REMOTE_URL ?? '' };
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
