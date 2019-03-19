module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  outputDir: 'demo',
  transpileDependencies: ['resize-detector'],
  chainWebpack: config => {
    config.optimization.clear('splitChunks').splitChunks({
      cacheGroups: {
        vue: {
          name: 'vue',
          test: /[\\/]node_modules[\\/]vue[\\/]/,
          priority: 0,
          chunks: 'initial'
        },
        vendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: 'initial'
        },
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: -20,
          chunks: 'initial',
          reuseExistingChunk: true
        }
      }
    })
  }
}
