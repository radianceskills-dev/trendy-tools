import { readFileSync, writeFileSync, readdirSync, statSync, renameSync } from 'node:fs'
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
  main = main.replace("import posthog from 'posthog-js'\n", '').replace(telemetry, `false && ${telemetry}`)
  writeFileSync(mainFile, main)
} else if (mode === 'post') {
  walk('x', rewriteText)
  const importMapFile = 'x/importmap.json'
  const importMap = JSON.parse(readFileSync(importMapFile, 'utf8'))
  // Netlify recursively excludes every directory named node_modules. Rename all
  // dependency directories bottom-up, including nested packages required by import-map scopes.
  function renameDependencyDirs(dir) {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name)
      if (!statSync(file).isDirectory()) continue
      renameDependencyDirs(file)
      if (name === 'node_modules') renameSync(file, join(dir, 'vendor'))
    }
  }
  renameDependencyDirs('x')

  const rewritePath = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/')) return value
    const vendored = value.replaceAll('/node_modules/', '/vendor/')
    return `${base}${vendored}`
  }
  const rewrite = (value) => {
    if (typeof value === 'string') return rewritePath(value)
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') {
      const entries = Object.entries(value).map(([key, child]) => [rewritePath(key), rewrite(child)])
      for (const key of Object.keys(value)) delete value[key]
      for (const [key, child] of entries) value[key] = child
    }
    return value
  }
  writeFileSync(importMapFile, `${JSON.stringify(rewrite(importMap), null, 2)}\n`)
} else {
  throw new Error('Use: node adapt-omniclip.mjs pre|post')
}
