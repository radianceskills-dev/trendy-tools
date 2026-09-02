import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const base = '/tools/omniclip'
const mode = process.argv[2]

function walk(dir, visitor) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) walk(file, visitor)
    else visitor(file)
  }
}

function rewriteText(file) {
  const allowed = new Set(['.html', '.js', '.mjs', '.ts', '.json', '.css'])
  if (!allowed.has(extname(file))) return
  let source = readFileSync(file, 'utf8')
  source = source
    .replaceAll('"/assets/', `"${base}/assets/`)
    .replaceAll("'/assets/", `'${base}/assets/`)
    .replaceAll('`/assets/', `\`${base}/assets/`)
  writeFileSync(file, source)
}

if (mode === 'pre') {
  walk('s', rewriteText)
  const mainFile = 's/main.ts'
  let main = readFileSync(mainFile, 'utf8')
  const telemetry = "posthog.init('phc_CMbHMWGVJSqM1RqGyGxWCyqgaSGbGFKl964fIN3NDwU',"
  if (!main.includes(telemetry)) throw new Error('Omniclip telemetry signature changed')
  main = main.replace(telemetry, `false && ${telemetry}`)
  writeFileSync(mainFile, main)
} else if (mode === 'post') {
  walk('x', rewriteText)
  const importMapFile = 'x/importmap.json'
  const importMap = JSON.parse(readFileSync(importMapFile, 'utf8'))
  const rewrite = (value) => {
    if (typeof value === 'string' && value.startsWith('/')) return `${base}${value}`
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) value[key] = rewrite(value[key])
    }
    return value
  }
  writeFileSync(importMapFile, `${JSON.stringify(rewrite(importMap), null, 2)}\n`)
} else {
  throw new Error('Use: node adapt-omniclip.mjs pre|post')
}
