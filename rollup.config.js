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

const envSubdir = customModules ? customModules.replace(/^\//, '') : 'main';
const outDistDir = path.join('dist', envBuild, envSubdir);

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
  await fs.cp(source, target, { recursive: true });
}

function copyBuildAssets() {
  return {
    name: 'copy-build-assets',
    async writeBundle() {
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
        copyDirectory('viewer/examples', path.join(outDistDir, 'examples')),
      ]);

      const viewerSettingsSource = 'viewer/viewer-settings-example.json';
      const viewerSettingsTarget = path.join(outDistDir, 'viewer-settings.json');
      const settingsPhpTarget = path.join(outDistDir, 'settings.local.php');
      const indexTarget = path.join(outDistDir, 'index.html');
      const toastifyTarget = path.join(outDistDir, 'assets/css/toastify.css');

      const viewerSettings = JSON.parse(
        await fs.readFile(viewerSettingsSource, 'utf8')
      );
      viewerSettings.viewer.lightweight = 1;
      if (envBuild === 'drupal') {
        viewerSettings.baseModulePath = `${drupalModulePrefix}/dist/${envBuild}/assets`;
      }

      await fs.mkdir(outDistDir, { recursive: true });
      await Promise.all([
        fs.copyFile('settings.php', settingsPhpTarget),
        fs.copyFile('index.html', indexTarget),
        fs.copyFile('node_modules/toastify-js/src/toastify.css', toastifyTarget),
        fs.writeFile(
          viewerSettingsTarget,
          JSON.stringify(viewerSettings, null, 2)
        ),
      ]);
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
      include: ['viewer/**/*.{svg,png,jpg,gif}'],
      limit: 0,
      fileName: 'assets/[name][hash][extname]',
      publicPath: 'assets/'
    }),

    copyBuildAssets(),

    production && terser(),

  ].filter(Boolean),

  output: {
    dir: outDistDir,
    entryFileNames: 'dfg_3dviewer-module.js',
    chunkFileNames: '[name].[hash].js',
    assetFileNames: '[name][extname]',
    format: 'es',
    manualChunks(id) {
      if (id.includes("node_modules/three")) {
        return "three";
      }
    },
    sourcemap: true,
  },
};
