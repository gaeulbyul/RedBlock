const path = require('path')
const esbuild = require('esbuild')

const dev = /^dev/i.test(process.env.NODE_ENV)

const watchOptions = {
  onRebuild(error, result) {
    if (error) {
      console.error('<esbuild> error: ', error)
    } else {
      const { errors, warnings } = result
      console.log('<esbuild> ok: ', { errors, warnings })
    }
  },
}
const watch = dev ? watchOptions : null

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
  target: [
    'es2022',
    'chrome100',
    'firefox91',
    'edge100',
  ],
  watch,
  minifyWhitespace: !dev,
  minifyIdentifiers: !dev,
  minifySyntax: !dev,
  sourcemap: true,
}).then(result => {
  if (watch) {
    console.log('<esbuild> watching...')
  } else {
    console.log('<esbuild> building...')
  }
})
