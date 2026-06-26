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
const production = process.env.IS_PROD === 'true';
const isDrupalBuild = envBuild === 'drupal';
// The Drupal build has two variants: `main` is the minified bundle Drupal loads
// in production (dist/drupal/main); `custom` is an unminified, fully-featured
// drop (admin panel, demo pages, examples, viewer-settings.json) at
// dist/drupal/custom for site-specific customization.
const drupalVariant = isDrupalBuild ? (process.env.DRUPAL_VARIANT ?? 'main') : '';
const isDrupalCustom = isDrupalBuild && drupalVariant === 'custom';
const includeAdmin = envBuild === 'dev' || envBuild === 'test' || isDrupalCustom;

// Standalone (dev/test/prod) and the customizable Drupal variant ship the demo
// pages, examples and a viewer-settings.json; the minified Drupal `main` bundle
// omits them because Drupal renders its own markup and config.
const includeStandaloneAssets = !isDrupalBuild || isDrupalCustom;

// Only explicit prod builds and the minified Drupal `main` bundle are minified;
// the Drupal `custom` variant ships unminified for easier overriding.
const minify = production || (isDrupalBuild && !isDrupalCustom);
const outDistDir = isDrupalBuild
  ? path.join('dist', 'drupal', drupalVariant)
  : path.join('dist', envBuild);
const entryFileName = isDrupalBuild && !isDrupalCustom
  ? 'dfg_3dviewer.min.js'
  : 'dfg_3dviewer-module.js';

console.log('[rollup] build:', envBuild);
if (isDrupalBuild) {
  console.log('[rollup] drupal variant:', drupalVariant);
}
console.log('[rollup] outDir:', outDistDir);
console.log('[rollup] entry:', entryFileName);
console.log('[rollup] admin panel:', includeAdmin);

async function copyDirectory(sourceDir, target) {
  await fs.cp(sourceDir, target, { recursive: true });
}

function copyBuildAssets() {
  return {
    name: 'copy-build-assets',
    async writeBundle() {
      await fs.mkdir(outDistDir, { recursive: true });

      const assetCopyTasks = [
        copyDirectory('node_modules/three/examples/jsm/libs/draco', path.join(outDistDir, 'assets/draco')),
        copyDirectory('node_modules/web-ifc', path.join(outDistDir, 'assets/ifc')),
        copyDirectory('viewer/css', path.join(outDistDir, 'assets/css')),
        copyDirectory('viewer/img', path.join(outDistDir, 'assets/img')),
        copyDirectory('viewer/fonts', path.join(outDistDir, 'assets/fonts')),
        copyDirectory('viewer/js/maps', path.join(outDistDir, 'assets/maps')),
      ];

      // Standalone bundles and the Drupal `custom` variant ship the demo pages
      // and example models; the minified Drupal `main` build omits them because
      // Drupal renders its own markup.
      if (includeStandaloneAssets) {
        assetCopyTasks.push(
          copyDirectory('viewer/examples', path.join(outDistDir, 'examples')),
          fs.copyFile('index.html', path.join(outDistDir, 'index.html')),
          fs.copyFile('embed.html', path.join(outDistDir, 'embed.html')),
        );
      }

      // The PHP admin panel is only useful for the self-hosted dev/test builds.
      if (includeAdmin) {
        assetCopyTasks.push(copyDirectory('viewer/admin', path.join(outDistDir, 'admin')));
      }

      await Promise.all(assetCopyTasks);

      // Never publish a developer's local admin database.
      if (includeAdmin) {
        await fs.rm(path.join(outDistDir, 'admin', 'admin.sqlite'), { force: true });
      }

      // The minified Drupal `main` build reads its configuration from Drupal
      // (drupalSettings), so it intentionally ships no viewer-settings.json.
      // The `custom` variant ships one so it can run customized/standalone.
      if (isDrupalBuild && !isDrupalCustom) {
        return;
      }

      const viewerSettingsTarget = path.join(outDistDir, 'viewer-settings.json');
      const viewerSettings = JSON.parse(
        await fs.readFile('viewer/viewer-settings-example.json', 'utf8')
      );
      viewerSettings.viewer.lightweight = 1;

      let viewerSettingsMain;
      try {
        viewerSettingsMain = JSON.parse(await fs.readFile('viewer-settings.json', 'utf8'));
      } catch {
        viewerSettingsMain = { ...viewerSettings };
      }

      if (envBuild === 'test' || envBuild === 'dev') {
        viewerSettingsMain.viewer.gallery.build = false;
        viewerSettingsMain.viewer.editor = true;
        viewerSettingsMain.viewer.lightweight = true;
        viewerSettingsMain.mainUrl = 'localhost';
      }

      if (isDrupalCustom) {
        viewerSettingsMain.baseModulePath = '/libraries/dfg-3dviewer/dist/drupal/custom/assets';
        viewerSettingsMain.entity = viewerSettingsMain.entity || {};
        viewerSettingsMain.entity.metadata = viewerSettingsMain.entity.metadata || {};
        viewerSettingsMain.entity.metadata.source = 'Drupal';
      }

      await fs.writeFile(viewerSettingsTarget, JSON.stringify(viewerSettingsMain, null, 2), { flag: 'wx' })
        .catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
        });
    },
  };
}

// The @iiif/3d-manifesto-dev dependency ships TypeScript helper boilerplate
// (__awaiter/__extends) and internal cross-imports that trigger THIS_IS_UNDEFINED
// and CIRCULAR_DEPENDENCY warnings. These are harmless and out of our control, so
// silence them for node_modules while keeping all warnings for our own sources.
function onwarn(warning, warn) {
  const noisyDependencyWarnings = ['THIS_IS_UNDEFINED', 'CIRCULAR_DEPENDENCY'];
  const location = warning.id || warning.ids?.[0] || warning.loc?.file || '';
  if (noisyDependencyWarnings.includes(warning.code) && location.includes('node_modules')) {
    return;
  }
  warn(warning);
}

export default {
  input: 'viewer/main.js',
  onwarn,
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_SOURCE__: JSON.stringify(source),
        __BUILD__: JSON.stringify(envBuild),
        __IS_PROD__: JSON.stringify(production),
        __MODULES_PATH__: JSON.stringify(''),
        __ENV_SUBDIR__: JSON.stringify(isDrupalBuild ? drupalVariant : ''),
      },
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      mainFields: ['module', 'browser', 'main'],
      extensions: ['.js'],
      dedupe: ['three'],
      preserveSymlinks: false,
      exportConditions: ['module'],
    }),
    commonjs({
      include: [/node_modules/],
      exclude: ['node_modules/three/**'],
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto',
    }),
    json(),
    url({
      include: ['viewer/**/*.{svg,png,jpg,gif,hdr}'],
      limit: 0,
      fileName: 'assets/[name][extname]',
      publicPath: 'assets/',
    }),
    copyBuildAssets(),
    minify && terser(),
  ].filter(Boolean),
  output: {
    dir: outDistDir,
    entryFileNames: entryFileName,
    chunkFileNames: 'assets/[name].js',
    assetFileNames: 'assets/[name][extname]',
    sourcemapFileNames: 'assets/[name].js.map',
    format: 'es',
    manualChunks(id) {
      if (id.includes('node_modules/three')) {
        return 'three';
      }
    },
    sourcemap: true,
  },
};
