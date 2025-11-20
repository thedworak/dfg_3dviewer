import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';

const source = process.env.BUILD_SOURCE || "IIIF";

export default {
  input: 'viewer/main.js',
  plugins: [
    replace({
      preventAssignment: true,
      BUILD_SOURCE: JSON.stringify(source)
    })
  ],
  output: {
    file: 'dist/dfg_3dviewer-module.js',
    format: 'iife',
    name: 'Dfg3DViewer',
    sourcemap: true,
    globals: {
      three: 'THREE'
    },
    intro: 'var global = window; var module = { exports: {} }; var exports = module.exports;'
  },
  // bundle `three` and other dependencies into the dist so consumers can use the
  // prebuilt files without running a build. Do not mark 'three' as external here.
  // external: ['three'],
  plugins: [
    url({
      include: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.gif'],
      limit: 0,
      fileName: 'assets/[name][hash][extname]',
      publicPath: 'dist/assets/',
    }),
    copy({
      targets: [
        { src: 'viewer/img/*', dest: 'dist/assets/img' },
        { src: 'viewer/js/jsm/libs/draco/gltf/*', dest: 'dist/assets/draco' },
        { src: 'viewer/js/external_libs/loaders/ifc/*', dest: 'dist/assets/ifc' },
        { src: 'viewer/fonts/*', dest: 'dist/assets/fonts' },
        { src: 'viewer/css/*', dest: 'dist/assets/css' },
        { src: 'css/*', dest: 'dist/assets/css' },
        { src: 'viewer/viewer-settings.json', dest: 'dist',
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

            // Rewrite paths inside index.html
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
      mainFields: ['browser', 'module', 'main']
    }),
    commonjs({
      include: [/node_modules/, 'viewer/**'],
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto'
    }),
    json(),
    terser()
  ]
};
