/*
  The production server: the built site (dist/, from `npm run build`) and the API.

      npm run build && npm start          (PORT, default 8080)

  Runs on Node 24 directly from TypeScript. Routes: / is the landing page and /dashboard
  the dashboard (both index.html; main.tsx picks by path), /assets/* the built files,
  /api/* the API (server/api.ts).
*/
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { init } from './accounts.ts'
import { api } from './api.ts'

const DIST = join(import.meta.dirname, '../dist')
const PORT = Number(process.env.PORT ?? 8080)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8',
}

await init()

createServer(async (req, res) => {
  if (await api(req, res)) return
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end() }
  const path = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = normalize(join(DIST, path))
  if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end() }
  // the app's pages (/, /dashboard, /pair) are index.html; real files are served as they are
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) file = join(DIST, 'index.html')
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  // built assets have a hash in their name, so they can be cached for good; pages can't
  res.setHeader('Cache-Control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).on('error', () => { res.statusCode = 500; res.end() }).pipe(res)
}).listen(PORT, () => console.log(`Re:Motion on http://localhost:${PORT}`))
