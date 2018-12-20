import vue from 'rollup-plugin-vue'
import buble from 'rollup-plugin-buble'
import { terser } from 'rollup-plugin-terser'
import resolve from 'rollup-plugin-node-resolve'

export default {
  entry: 'src/components/Clamp.js',
  external: [
    'vue'
  ],
  globals: {
    vue: 'Vue'
  },
  format: 'umd',
  moduleName: 'VueClamp',
  dest: 'dist/vue-clamp.js',
  plugins: [
    resolve(),
    vue({
      compileTemplate: true
    }),
    buble(),
    terser()
  ]
}
