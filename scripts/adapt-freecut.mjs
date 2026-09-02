import { readFileSync, writeFileSync } from 'node:fs'

const base = '/tools/freecut'

function patch(file, oldValue, newValue) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes(oldValue)) {
    throw new Error(`Expected upstream text was not found in ${file}`)
  }
  writeFileSync(file, source.replace(oldValue, newValue))
}

// Vite assets and TanStack Router must both know the public mount point.
patch('vite.config.ts', "export default defineConfig({", "export default defineConfig({\n  base: '/tools/freecut/',")
patch('src/app.tsx', 'createRouter({ routeTree, defaultErrorComponent: RouteErrorScreen })', "createRouter({ routeTree, basepath: '/tools/freecut', defaultErrorComponent: RouteErrorScreen })")

// These values are literal root paths in upstream source, so Vite cannot infer a base path.
patch('index.html', 'href="/favicon.svg"', 'href="/tools/freecut/favicon.svg"')
patch('index.html', 'href="/manifest.webmanifest"', 'href="/tools/freecut/manifest.webmanifest"')
patch('src/main.tsx', 'fetch(`/?__freecut_update_check=${Date.now()}`', 'fetch(`/tools/freecut/?__freecut_update_check=${Date.now()}`')
patch('src/main.tsx', ".register('/sw.js')", ".register('/tools/freecut/sw.js', { scope: '/tools/freecut/' })")

// Landing artwork is referenced as literal URL strings rather than imports.
const landing = readFileSync('src/routes/index.tsx', 'utf8')
writeFileSync('src/routes/index.tsx', landing.replaceAll("'/assets/", "'/tools/freecut/assets/"))

// Scope the service worker and offline cache to FreeCut only; it must never claim Trendy Tools root URLs.
let sw = readFileSync('public/sw.js', 'utf8')
sw = sw.replace("const CACHE_VERSION = 'freecut-app-shell-__FREECUT_BUILD_ID__'", "const BASE_PATH = '/tools/freecut'\nconst CACHE_VERSION = 'freecut-app-shell-__FREECUT_BUILD_ID__'")
sw = sw.replace("  '/',\n  '/index.html',\n  '/favicon.svg',\n  '/manifest.webmanifest',\n  '/icons/icon-192.png',\n  '/icons/icon-512.png',\n  '/icons/icon-maskable-512.png',", "  `${BASE_PATH}/`,\n  `${BASE_PATH}/index.html`,\n  `${BASE_PATH}/favicon.svg`,\n  `${BASE_PATH}/manifest.webmanifest`,\n  `${BASE_PATH}/icons/icon-192.png`,\n  `${BASE_PATH}/icons/icon-512.png`,\n  `${BASE_PATH}/icons/icon-maskable-512.png`,")
sw = sw.replace("const EXCLUDED_PATH_PREFIXES = ['/moss-tts/']", "const EXCLUDED_PATH_PREFIXES = [`${BASE_PATH}/moss-tts/`]")
sw = sw.replaceAll("cache.put('/index.html'", "cache.put(`${BASE_PATH}/index.html`").replaceAll("cache.match('/index.html')", "cache.match(`${BASE_PATH}/index.html`)")
writeFileSync('public/sw.js', sw)
