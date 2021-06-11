import vue from 'rollup-plugin-vue'
import buble from '@rollup/plugin-buble'
import { terser } from 'rollup-plugin-terser'
import resolve from '@rollup/plugin-node-resolve'

export default [{
  input: 'src/components/Clamp.js',
  output: {
    file: 'dist/vue-clamp.js',
    name: 'VueClamp',
    format: 'umd',
    globals: {
      vue: 'Vue',
      'resize-detector': 'resizeDetector'
    }
  },
  external: [
    'vue',
    'resize-detector'
  ],
  plugins: [
    resolve(),
    vue(),
    buble(),
    terser()
  ]
}, {
  input: 'src/components/Clamp.js',
  output: {
    file: 'dist/vue-clamp.esm.js',
    format: 'es'
  },
  external: [
    'vue',
    'resize-detector'
  ],
  plugins: [
    resolve(),
    vue(),
    buble(),
    terser()
  ]
}]
