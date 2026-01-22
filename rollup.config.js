import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import postcss from 'rollup-plugin-postcss';

const source = process.env.BUILD_SOURCE ?? "IIIF";
const envBuild = process.env.BUILD ?? "test";
const customModules = process.env.MODULE_CUSTOM ?? "";
const production = process.env.IS_PROD === 'true';

function normalizePathSegment(seg = '') {
  return seg.replace(/^\/+|\/+$/g, '');
}

const modulesPath = normalizePathSegment(customModules);

const dracoPath =
  envBuild === 'drupal'
    ? `/modules/${modulesPath}/dfg_3dviewer/dist/assets/draco/`
    : '/assets/draco/';

export default {
  input: 'viewer/main.js',
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_SOURCE__: JSON.stringify(source),
        __BUILD__: JSON.stringify(envBuild),
        __DFG_DRACO_PATH__: JSON.stringify(dracoPath),
        __IS_PROD__: JSON.stringify(production),
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
        { src: 'viewer/img/*', dest: 'dist/assets/img' },
        { src: 'node_modules/three/examples/jsm/libs/draco/*', dest: 'dist/assets/draco' },
        { src: 'viewer/js/external_libs/loaders/ifc/*', dest: 'dist/assets/ifc' },
        { src: 'viewer/fonts/*', dest: 'dist/assets/fonts' },
        { src: 'viewer/css/*', dest: 'dist/assets/css' },
        { src: 'css/*', dest: 'dist/assets/css' },
        {
          src: 'viewer/viewer-settings.json',
          dest: 'dist',
          transform: (contents) => {
            const json = JSON.parse(contents);
            json.viewer.lightweight = 1;
            return JSON.stringify(json, null, 2);
          }
        },
        {
          src: 'index.html',
          dest: 'dist',
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
    file: 'dist/dfg_3dviewer-module.js',
    entryFileNames: 'dfg_3dviewer-module.js',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true
  }
};
