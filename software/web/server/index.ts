/*
  The production server: the built site (dist/, from `npm run build`) and the API.

      npm run build && npm start          (PORT, default 8080)

  Runs on Node 24 directly from TypeScript. Routes: / is the landing page and /dashboard
  the dashboard (both index.html; main.tsx picks by path), /assets/* the built files,
  /api/* the API (server/api.ts).
*/
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { init, ownerAccount, setOwner } from './accounts.ts'
import { api } from './api.ts'
import { securityHeaders } from './security.ts'

const DIST = join(import.meta.dirname, '../dist')
const PORT = Number(process.env.PORT ?? 8080)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8',
}

await init()

// A new server (Railway) has no owner yet: make one from REMOTION_OWNER_EMAIL / REMOTION_OWNER_PASSWORD.
// Only when there's none, so a restart never resets the password or signs the owner out.
const ownerEmail = process.env.REMOTION_OWNER_EMAIL
const ownerPassword = process.env.REMOTION_OWNER_PASSWORD
if (ownerEmail && ownerPassword && !(await ownerAccount())) {
  await setOwner(ownerEmail, ownerPassword)
  console.log(`Owner account created: ${ownerEmail.toLowerCase()}`)
}

const server = createServer(async (req, res) => {
  try {
    if (await api(req, res)) return
    await page(req, res)
  } catch (e) {
    // never let one bad request take the server down
    console.error('[server]', e)
    if (!res.headersSent) { res.statusCode = 500; res.end() }
  }
})

async function page(req: IncomingMessage, res: ServerResponse) {
  securityHeaders(req, res, true)
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end() }
  let path: string
  try { path = decodeURIComponent((req.url ?? '/').split('?')[0]) } catch { res.statusCode = 400; return res.end() }   // a malformed %-escape
  if (path.includes('\0')) { res.statusCode = 400; return res.end() }
  let file = normalize(join(DIST, path))
  // inside dist/ only: compare with the separator, or /dist-other would pass a plain prefix check
  if (file !== DIST && !file.startsWith(DIST + sep)) { res.statusCode = 403; return res.end() }
  // the app's pages (/, /dashboard, /pair) are index.html; real files are served as they are
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) file = join(DIST, 'index.html')
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  // built assets have a hash in their name, so they can be cached for good; pages can't
  res.setHeader('Cache-Control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).on('error', () => { res.statusCode = 500; res.end() }).pipe(res)
}

// slow-request defences: a client must send its headers within 15 s and the whole request within 60 s
server.headersTimeout = 15_000
server.requestTimeout = 60_000
server.keepAliveTimeout = 5_000
server.maxHeadersCount = 100
server.listen(PORT, () => console.log(`ReMotion on http://localhost:${PORT}`))
