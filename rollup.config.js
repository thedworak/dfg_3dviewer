import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import postcss from 'rollup-plugin-postcss';
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
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_SOURCE__: JSON.stringify(source),
        __BUILD__: JSON.stringify(envBuild),
        __IS_PROD__: JSON.stringify(production),
        __MODULES_PATH__: JSON.stringify(modulesPath),
      },
    }),

    url({
      include: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.gif'],
      limit: 0,
      fileName: 'assets/[name][hash][extname]',
      publicPath: 'dist/assets/'
    }),

    copy({
      targets: [
        {
          src: 'viewer/img/*',
          dest: `${outDistDir}/assets/img`
        },
        {
          src: 'node_modules/three/examples/jsm/libs/draco/*',
          dest: `${outDistDir}/assets/draco`
        },
        {
          src: 'viewer/js/external_libs/loaders/ifc/*',
          dest: `${outDistDir}/assets/ifc`
        },
        {
          src: 'viewer/fonts/*',
          dest: `${outDistDir}/assets/fonts`
        },
        {
          src: 'viewer/css/*',
          dest: `${outDistDir}/assets/css`
        },
        {
          src: 'css/*',
          dest: `${outDistDir}/assets/css`
        },
        {
          src: 'viewer/examples/*',
          dest: `${outDistDir}/examples`
        },
        {
          src: 'settings.php',
          dest: `./`,
          rename: 'settings.local.php',
        },
        {
          src: 'viewer/viewer-settings-example.json',
          dest: `${outDistDir}/`,
          rename: 'viewer-settings.json',
          transform: (contents) => {
            const json = JSON.parse(contents);
            json.viewer.lightweight = 1;
            return JSON.stringify(json, null, 2);
          }
        },
        {
          src: 'index.html',
          dest: `${outDistDir}/`,
          transform: (contents) => {
            let html = contents.toString();
            html = html.replace(/img\//g, 'assets/img/');
            html = html.replace(/fonts\//g, 'assets/fonts/');
            html = html.replace(/css\//g, 'assets/css/');
            html = html.replace(/viewer\//g, '');
            html = html.replace(/main\.js/g, 'dfg_3dviewer-module.js');
            return Buffer.from(html);
          }
        },
      ],
      hook: 'writeBundle',
      verbose: true
    }),

    resolve({
      browser: true,
      preferBuiltins: false,
      mainFields: ['browser', 'module', 'main'],
      extensions: ['.js'],
      dedupe: ['three'],
      preserveSymlinks: false
    }),

    commonjs({
      include: [/node_modules/],
      exclude: ['node_modules/three/**'],
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto'
    }),
    postcss({
      extensions: ['.css'],
      minimize: true
    }),
    json(),
    terser()
  ].filter(Boolean),

  output: {
    dir: outDistDir,
    entryFileNames: 'dfg_3dviewer-module.js',
    chunkFileNames: '[name].[hash].js',
    assetFileNames: '[name][extname]',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true
  }
};
