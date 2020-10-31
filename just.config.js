const { task, series, parallel, logger } = require('just-scripts')
const util = require('util')
const proc = require('child_process')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const ncp = require('ncp')

const manifest = require('./src/manifest.json')
const name = manifest.name.replace(/[^\w\-]+/gi, '')
const version = manifest.version

const cp = util.promisify(ncp)
const rmrf = util.promisify(rimraf)
const exec = util.promisify(proc.exec)

task('build', async () => {
  await Promise.all([
    cp('src/', 'build/', {
      stopOnErr: true,
      filter(filename) {
        return !/\.tsx?$/.test(filename)
      },
    }),
    exec('tsc'),
  ])
})

task('clean', async () => {
  await rmrf('build/')
})

task('zip', async () => {
  const filename = `${name}-v${version}.zip`
  logger.info(`zipping into "${filename}"...`)
  await mkdirp('dist/')
  await exec(`7z a -r dist/${filename} build/.`)
})

task('srczip', async () => {
  await mkdirp('dist/')
  await exec(`git archive -9 -v -o ./dist/${name}-v${version}.Source.zip HEAD`)
})

task('default', series('clean', 'build'))
task('dist', parallel('zip', 'srczip'))
task('all', series('default', 'dist'))
