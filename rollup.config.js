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
const includeAdmin = envBuild === 'dev' || envBuild === 'test';

// The Drupal build is shipped inside the released repo at dist/drupal/main and is
// always minified. Standalone builds (dev, test, prod) keep their own dist folder.
const minify = production || isDrupalBuild;
const outDistDir = isDrupalBuild
  ? path.join('dist', 'drupal', 'main')
  : path.join('dist', envBuild);
const entryFileName = isDrupalBuild
  ? 'dfg_3dviewer.min.js'
  : 'dfg_3dviewer-module.js';

console.log('[rollup] build:', envBuild);
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

      // Standalone bundles ship the demo pages and example models; the Drupal
      // build omits them because Drupal renders its own markup.
      if (!isDrupalBuild) {
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

      // The Drupal build reads its configuration from Drupal (drupalSettings),
      // so it intentionally ships no viewer-settings.json.
      if (isDrupalBuild) {
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

      await fs.writeFile(viewerSettingsTarget, JSON.stringify(viewerSettingsMain, null, 2), { flag: 'wx' })
        .catch(err => {
          if (err.code !== 'EEXIST') {
            throw err;
          }
        });
    },
  };
}

export default {
  input: 'viewer/main.js',
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
        __ENV_SUBDIR__: JSON.stringify(''),
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
