import vue from 'rollup-plugin-vue'
import buble from '@rollup/plugin-buble'
import { terser } from 'rollup-plugin-terser'
import resolve from '@rollup/plugin-node-resolve'

export default {
  input: 'src/components/Clamp.js',
  output: {
    file: 'dist/vue-clamp.js',
    name: 'VueClamp',
    format: 'umd',
    globals: {
      vue: 'Vue'
    }
  },
  external: [
    'vue'
  ],
  plugins: [
    resolve(),
    vue({
      compileTemplate: true
    }),
    buble(),
    terser()
  ]
}
