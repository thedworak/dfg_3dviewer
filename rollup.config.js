import url from '@rollup/plugin-url';
import { rollupPluginCopy } from '@jsxtools/rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import ignore from "rollup-plugin-ignore";
import path from 'path';

const source = process.env.BUILD_SOURCE ?? "IIIF";
const envBuild = process.env.BUILD ?? "test";
const customModules = process.env.MODULE_CUSTOM ?? "";
const production = process.env.IS_PROD === 'true';

const outDistDir = path.join(
  'dist',
  envBuild,
  customModules.replace(/^\//, '')
);

console.log('[rollup] build:', envBuild);
console.log('[rollup] source:', source);
console.log('[rollup] outDir:', outDistDir);

function normalizePathSegment(seg = '') {
  return seg.replace(/^\/+|\/+$/g, '');
}

const modulesPath = normalizePathSegment(customModules);

console.log('[rollup] modulesPath:', modulesPath);

export default {
  input: 'viewer/main.js',
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  },
  plugins: [
    ignore(["**/*.css"]),
    replace({
      preventAssignment: true,
      values: {
        __BUILD_SOURCE__: JSON.stringify(source),
        __BUILD__: JSON.stringify(envBuild),
        __IS_PROD__: JSON.stringify(production),
        __MODULES_PATH__: JSON.stringify(modulesPath),
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

    rollupPluginCopy({
      patterns: [
        {
          from: 'viewer/img/**/*',
          to: `${outDistDir}/assets/img`
        },
        {
          from: 'node_modules/three/examples/jsm/libs/draco/**/*',
          to: `${outDistDir}/assets/draco`
        },
        {
          from: 'viewer/js/external_libs/loaders/ifc/**/*',
          to: `${outDistDir}/assets/ifc`
        },
        {
          from: 'viewer/fonts/**/*',
          to: `${outDistDir}/assets/fonts`
        },
        {
          from: 'viewer/css/**/*',
          to: `${outDistDir}/assets/css`
        },
        {
          from: 'css/**/*',
          to: `${outDistDir}/assets/css`
        },
        {
          from: 'viewer/examples/**/*',
          to: `${outDistDir}/examples`
        },
        {
          from: 'node_modules/toastify-js/src/toastify.css',
          to: `${outDistDir}/assets/css/toastify.css`
        },
        {
          from: 'settings.php',
          to: `${outDistDir}/settings.local.php`
        },
        {
          from: 'viewer/viewer-settings-example.json',
          to: `${outDistDir}/viewer-settings.json`,
          transform: (contents) => {
            const json = JSON.parse(contents.toString());
            json.viewer.lightweight = 1;
            return JSON.stringify(json, null, 2);
          }
        },
        {
          from: 'index.html',
          to: `${outDistDir}/`,
          transform: (contents) => {
            let html = contents.toString();
            html = html.replace(
              /(href|src)="(img|css|fonts)\//g,
              (_, attr, folder) => `${attr}="assets/${folder}/`
            );
            html = html.replace(/viewer\//g, '');
            html = html.replace(/main\.js/g, 'dfg_3dviewer-module.js');
            return html;
          }
        },
      ],
      outputFolder: outDistDir,
      hook: 'writeBundle',
      verbose: true
    }),

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
