const path = require('path')
const webpack = require('webpack')

module.exports = {
  // mode: 'development',
  devtool: 'source-map',
  entry: {
    background: './src/scripts/background/entrypoint.ts',
    twitter: './src/scripts/content/twitter.ts',
    tweetdeck: './src/scripts/content/tweetdeck.ts',
    twitter_inject: './src/scripts/inject/twitter-inject.ts',
    blackbird_inject: './src/scripts/inject/blackbird-inject.ts',
    gryphon_inject: './src/scripts/inject/gryphon-inject.ts',
    popup: {
      import: './src/popup/popup-ui.tsx',
      dependOn: 'ui_framework',
    },
    options: {
      import: './src/options/options.tsx',
      dependOn: 'ui_framework',
    },
    ui_framework: ['@mui/material', 'react', 'react-dom'],
  },
  output: {
    path: `${__dirname}/build/bundled`,
    filename: '[name].bun.js',
  },
  optimization: {
    runtimeChunk: 'single',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        // use: 'ts-loader',
        use: require.resolve('swc-loader'),
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '\\': path.resolve(__dirname, 'src/'),
    },
  },
  watchOptions: {
    poll: 1200,
  },
}
