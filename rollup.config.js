import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'viewer/main.js',
  output: {
    file: 'dist/dfg_3dviewer-module.js',
    format: 'iife', // or 'esm' if you want <script type="module">
    sourcemap: true
  },
  plugins: [
    resolve(), 
    commonjs(),
    json()
  ]
};