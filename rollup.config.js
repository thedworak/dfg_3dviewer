import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'viewer/main.js',
  output: {
    file: 'dist/dfg_3dviewer-module.js',
    format: 'iife', // or 'esm' if you want <script type="module">
    name: 'Dfg3DViewer',
    globals: {
      three: 'THREE',
      stream: 'Stream',
      http: 'http',
      https: 'Https',
      url: 'Url',
      zlib: 'Zlib',
      punycode: 'Punycode'
    }
  },
  external: ['three'],
  plugins: [
      url({
      include: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.gif'],
      limit: 0, // always copy instead of base64 inline
      fileName: 'assets/[name][hash][extname]', // nice hashed filenames
      publicPath: 'assets/', // path inside dist
    }),
    copy({
      targets: [
        { src: 'viewer/img/*', dest: 'dist/assets' }
      ]
    }),
    resolve(),
    commonjs(),
    json()
  ]
};