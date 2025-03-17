const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const terser = require('@rollup/plugin-terser');
const pkg = require('./package.json');

// We don't want to bundle these dependencies
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'fs',
  'path',
  'os',
  'child_process',
  'util'
];

// CommonJS configuration
const config = [
  // CommonJS build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gguf.js',
      format: 'cjs',
      exports: 'auto',
      sourcemap: true
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json()
    ]
  },
  
  // ES module build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gguf.esm.js',
      format: 'es',
      exports: 'auto',
      sourcemap: true
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json()
    ]
  },
  
  // Browser UMD build (bundled)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gguf.browser.js',
      format: 'umd',
      name: 'GGUF',
      exports: 'auto',
      sourcemap: true,
      globals: {
        react: 'React'
      }
    },
    external: ['react'],
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      terser()
    ]
  }
];

module.exports = config;