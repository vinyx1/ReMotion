/*
  /api/phone/lines: where the phone app (software/android) sends what the device says,
  over Wi-Fi, so a session recorded on the phone shows up on the dashboard.

  The phone posts batches of raw serial lines, about once a second:
      { "patient": "vincent", "demo": true, "run": "20261121_104500", "lines": ["D,...", "R,...", ...] }
  "run" is when the phone connected to the device; one run is one logger run (it can
  hold several sessions, split by S lines).

  Each batch is appended to data/phone-incoming/<phone|phone-demo>/<patient>/<run>.txt.
  When a batch finishes a rep or a session (an R or S line), the run is turned into the
  usual files with the logger, into data/phone/<patient>/ (or data/phone-demo/ for demo
  mode), and sessions.json is exported again. The dashboard polls sessions.json, so the
  new rep appears within a few seconds. All the file and data logic stays in Python
  (logger.py, export.py); this only stores lines and runs those two.

  Vite only listens on this computer unless started with `npm run dev -- --host`. With
  --host, anyone on the same network can reach this and /api/summary: use it on a
  network you trust (home Wi-Fi, a teammate's hotspot), not open campus Wi-Fi.
*/
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { appendFile, mkdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import type { Plugin } from 'vite'

const run = promisify(execFile)
const REPO = resolve(process.cwd(), '../..')          // vite runs in software/web
const PYTHON = process.env.REMOTION_PYTHON
  ?? (existsSync(resolve(REPO, '.venv/bin/python')) ? resolve(REPO, '.venv/bin/python') : 'python3')

const PATIENT = /^[a-z0-9-]{1,32}$/
const RUN = /^\d{8}_\d{6}$/
const MAX_BODY = 4_000_000                  // ~40 s of samples at 100 Hz, far more than one batch
const MAX_LINE = 200

interface Batch { patient: string; demo: boolean; run: string; lines: string[] }

function parse(text: string): Batch | string {
  let b: unknown
  try { b = JSON.parse(text) } catch { return 'body is not JSON' }
  const { patient, demo, run: r, lines } = (b ?? {}) as Record<string, unknown>
  if (typeof patient !== 'string' || !PATIENT.test(patient)) return 'patient must be lowercase letters, digits or -'
  if (typeof r !== 'string' || !RUN.test(r)) return 'run must look like 20261121_104500'
  if (!Array.isArray(lines) || !lines.every((l) => typeof l === 'string' && l.length <= MAX_LINE && !/[\r\n]/.test(l))) {
    return 'lines must be single lines of text'
  }
  return { patient, demo: demo === true, run: r, lines }
}

/*
  Turning a run into files and exporting takes a few seconds, so it happens one at a time:
  a run that changes again while waiting is converted once, with everything it has by then.
*/
const waiting = new Set<string>()
let queue: Promise<void> = Promise.resolve()

function convertSoon(b: Batch) {
  const key = `${b.demo}/${b.patient}/${b.run}`
  if (waiting.has(key)) return
  waiting.add(key)
  queue = queue.then(async () => {
    waiting.delete(key)
    const root = b.demo ? 'phone-demo' : 'phone'
    try {
      await run(PYTHON, ['-m', 'software.tools.logger', '--replay', incoming(b), '--out', `data/${root}/${b.patient}`, '--stamp', b.run], { cwd: REPO })
      await run(PYTHON, ['-m', 'software.dashboard.export'], { cwd: REPO })
    } catch (e) {
      console.error(`[phone] couldn't update the dashboard for ${key}:`, e instanceof Error ? e.message : e)
    }
  })
}

const incoming = (b: Batch) => resolve(REPO, 'data/phone-incoming', b.demo ? 'phone-demo' : 'phone', b.patient, `${b.run}.txt`)

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      data += chunk
      if (data.length > MAX_BODY) { req.destroy(); fail(new Error('too big')) }
    })
    req.on('end', () => done(data))
    req.on('error', fail)
  })
}

function send(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') return send(res, 200, { ok: true })       // the app's "can I reach you?"
  if (req.method !== 'POST') return send(res, 405, { error: 'POST lines here' })
  let text: string
  try { text = await readBody(req) } catch { return send(res, 413, { error: 'batch too big' }) }
  const b = parse(text)
  if (typeof b === 'string') return send(res, 400, { error: b })

  if (b.lines.length) {
    const file = incoming(b)
    await mkdir(resolve(file, '..'), { recursive: true })
    await appendFile(file, b.lines.join('\n') + '\n')
    if (b.lines.some((l) => l.startsWith('R,') || l.startsWith('S,'))) convertSoon(b)
  }
  send(res, 200, { ok: true, received: b.lines.length })
}

export function phoneUpload(): Plugin {
  const mount = (server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void } }) => {
    server.middlewares.use('/api/phone/lines', (req, res) => { void handle(req, res).catch(() => send(res, 500, { error: 'could not save the lines' })) })
  }
  return { name: 'remotion-phone-upload', configureServer: mount, configurePreviewServer: mount }
}
