import { readFileSync, writeFileSync } from 'node:fs'

function patch(file, oldValue, newValue) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes(oldValue)) throw new Error(`Expected upstream text not found in ${file}`)
  writeFileSync(file, source.replace(oldValue, newValue))
}

const base = '/tools/excalidraw/'
const config = 'excalidraw-app/vite.config.mts'

// Vite, Workbox and the web-app manifest must share the same mount point.
patch(config, '  return {\n    server:', `  return {\n    base: "${base}",\n    server:`)
patch(config, '          start_url: "/",', `          start_url: "${base}",\n          scope: "${base}",`)
patch(config, '              action: "/",', `              action: "${base}",`)
patch(config, '            action: "/web-share-target",', `            action: "${base}web-share-target",`)

let vite = readFileSync(config, 'utf8')
vite = vite.replaceAll('src: "/screenshots/', `src: "${base}screenshots/`)
writeFileSync(config, vite)

const htmlFile = 'excalidraw-app/index.html'
let html = readFileSync(htmlFile, 'utf8')
html = html
  .replace('<head>', `<head>\n    <script>window.EXCALIDRAW_ASSET_PATH = "${base}";</script>`)
  .replaceAll('href="/apple-touch-icon.png"', `href="${base}apple-touch-icon.png"`)
  .replaceAll('href="/favicon-32x32.png"', `href="${base}favicon-32x32.png"`)
  .replaceAll('href="/favicon-16x16.png"', `href="${base}favicon-16x16.png"`)

// Remove the production analytics injection from the customer-hosted build.
html = html.replace(/\s*<!-- 100% privacy friendly analytics -->[\s\S]*?<!-- end LEGACY GOOGLE ANALYTICS -->/m, '')
writeFileSync(htmlFile, html)
