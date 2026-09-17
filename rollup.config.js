import url from '@rollup/plugin-url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import path from 'path';
import fs from 'fs/promises';

const source = process.env.BUILD_SOURCE ?? "IIIF";
const envBuild = process.env.BUILD ?? "test";
const customModulesEnv = process.env.MODULE_CUSTOM ?? "";
let customModules = customModulesEnv;
const production = process.env.IS_PROD === 'true';

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
        copyDirectory('viewer/admin', path.join(outDistDir, 'admin')),
      ]);

      const viewerSettingsTarget = path.join(outDistDir, 'viewer-settings.json');
      const settingsPhpTarget = path.join(outDistDir, 'settings.local.php');
      const indexTarget = path.join(outDistDir, 'index.html');
      const embedTarget = path.join(outDistDir, 'embed.html');

      const copyPromises = [
        writeDrupalLibrariesFile(),
        fs.copyFile('index.html', indexTarget),
        fs.copyFile('embed.html', embedTarget),
      ];

      copyPromises.push(
        renderSettingsLocalPhp().then(content => fs.writeFile(settingsPhpTarget, content))
      );

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

    production && terser(),

  ].filter(Boolean),

  output: {
    dir: outDistDir,
    entryFileNames: 'dfg_3dviewer-module.js',
    chunkFileNames: 'assets/[name].js',
    assetFileNames: 'assets/[name][extname]',
    sourcemapFileNames: 'assets/[name].js.map',
    format: 'es',
    manualChunks(id) {
      if (id.includes("node_modules/three")) {
        return "three";
      }
    },
    sourcemap: true,
  },
};
