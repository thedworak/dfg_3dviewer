import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/dfg_3dviewer.js',
    format: 'iife', // or 'esm' if you want <script type="module">
    sourcemap: true
  },
  plugins: [resolve(), commonjs()]
};