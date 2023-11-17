import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
//import typescript from 'rollup-plugin-typescript2'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
//import image from '@rollup/plugin-image'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
//import nodeGlobals from 'rollup-plugin-node-globals'
import json from '@rollup/plugin-json'

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.umd.js',
    format: 'umd',
    name: 'window',
    extend: true,
    inlineDynamicImports: true //Solves: Invalid value "umd" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
    // globals: {
    //   //'node:path': 'path'
    //   buffer: 'Buffer'
    // }
  },
  plugins: [
    // image({
    //   include: ['./assets/images/*.png', './assets/images/*.jpg']
    // }),
    json(),
    filesAsDataURIs({
      include: [
        './src/assets/images/*.png',
        './src/assets/images/*.jpg',
        './src/assets/images/*.svg',
        './src/assets/fonts/*.ttf'
      ]
    }),
    typescript({
      exclude: ['./src/assets/*']
    }),
    //nodeGlobals(),

    CommonJS({
      //ignoreDynamicRequires: true,
      // dynamicRequireTargets: [
      //   '/home/ipkg01/bin/gcw-cli/gamechanger/node_modules/lzma/*.js',
      //   '/home/ipkg01/bin/gcw-cli/gamechanger/node_modules/json-url/*.js'
      // ]
      //include: /node_modules/
    }),
    nodeResolve({
      // preferBuiltins: true,
      // // // //module: false, // <-- this library is not an ES6 module
      // browser: true // <-- suppress node-specific features
    }),
    //CommonJS({ extensions: ['.js', '.ts'] }), // the ".ts" extension is required
    nodePolyfills(),

    terser({
      module: true,
      format: { comments: false }
    })
  ]
}
