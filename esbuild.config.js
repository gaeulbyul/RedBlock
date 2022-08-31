const path = require('path')
const esbuild = require('esbuild')

esbuild.build({
  entryPoints: {
    background: './src/scripts/background/entrypoint.ts',
    twitter: './src/scripts/content/twitter.ts',
    tweetdeck: './src/scripts/content/tweetdeck.ts',
    twitter_inject: './src/scripts/inject/twitter-inject.ts',
    blackbird_inject: './src/scripts/inject/blackbird-inject.ts',
    gryphon_inject: './src/scripts/inject/gryphon-inject.ts',
    popup: './src/popup/popup-ui.tsx',
    options: './src/options/options.tsx',
  },
  outExtension: { '.js': '.bun.js' },
  outdir: './build/bundled',
  bundle: true,
  minifyWhitespace: true,
  minifyIdentifiers: false,
  minifySyntax: false,
  sourcemap: true,
  target: [
    'es2022',
    'chrome100',
    'firefox91',
    'edge100',
  ],
})
