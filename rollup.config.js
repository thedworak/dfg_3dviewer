import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-node-polyfills';

export default {
  input: 'viewer/main.js',
  output: {
    file: 'dist/dfg_3dviewer-module.js',
    format: 'iife',
    name: 'Dfg3DViewer',
    globals: {
      three: 'THREE'
    },
    intro: 'var global = window; var module = { exports: {} }; var exports = module.exports;'
  },
  external: ['three'],
  plugins: [
    url({
      include: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.gif'],
      limit: 0,
      fileName: 'assets/[name][hash][extname]',
      publicPath: 'assets/',
    }),
    copy({
      targets: [
        { src: 'viewer/img/*', dest: 'dist/assets' },
        { src: 'viewer/js/jsm/libs/draco/gltf/*', dest: 'dist/draco' },
        { src: 'viewer/js/external_libs/loaders/ifc/*', dest: 'dist/ifc' },
        { src: 'viewer/fonts/*', dest: 'dist/fonts' }
      ]
    }),
    nodePolyfills(),
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
    json()
  ]
};
