/*
  POST /api/phone/lines: where the phone app (software/android) sends what the device says,
  over Wi-Fi, so a session recorded on the phone shows up on the dashboard.

  The phone posts batches of raw serial lines, about once a second:
      { "patient": "vincent", "demo": true, "run": "20261121_104500", "lines": ["D,...", "R,...", ...] }
  "run" is when the session started on the phone; one run is one logger run.

  Each batch is appended to <account>/incoming/<phone|phone-demo>/<patient>/<run>.txt. When a
  batch finishes a rep or a session (an R or S line), the run is turned into the usual files
  with the logger, in the account's data folder (phone/<patient>/, or phone-demo/ for the
  app's demo device), and the account's sessions.json is exported again. The dashboard
  polls it, so a new rep appears within a few seconds. All the file and data logic stays
  in Python (logger.py, export.py).

  Whose: the phone signs in as one patient with the code from that patient's profile
  (POST /api/phone/pair); its token comes with every batch, and decides the account and the
  patient. Uploads without a valid token are refused.
*/
import { appendFile, mkdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { type Account, accountDir, dataDir, exportSessions } from './accounts.ts'
import { readJson, send } from './http.ts'
import { python } from './python.ts'

const PATIENT = /^[a-z0-9-]{1,32}$/
const RUN = /^\d{8}_\d{6}$/
const MAX_BODY = 4_000_000                  // ~40 s of samples at 100 Hz, far more than one batch
const MAX_LINE = 200

interface Batch { patient: string; demo: boolean; run: string; lines: string[] }

function parse(b: Record<string, unknown>): Batch | string {
  const { patient, demo, run, lines } = b
  if (typeof patient !== 'string' || !PATIENT.test(patient)) return 'patient must be lowercase letters, digits or -'
  if (typeof run !== 'string' || !RUN.test(run)) return 'run must look like 20261121_104500'
  if (!Array.isArray(lines) || !lines.every((l) => typeof l === 'string' && l.length <= MAX_LINE && !/[\r\n]/.test(l))) {
    return 'lines must be single lines of text'
  }
  return { patient, demo: demo === true, run, lines }
}

const kind = (b: Batch) => (b.demo ? 'phone-demo' : 'phone')
const incoming = (a: Account, b: Batch) => join(accountDir(a), 'incoming', kind(b), b.patient, `${b.run}.txt`)

/*
  Converting a run and exporting takes a few seconds, so it happens one at a time (python.ts
  queues them): a run that changes again while waiting is converted once, with everything
  it has by then.
*/
const waiting = new Set<string>()

function convertSoon(a: Account, b: Batch) {
  const key = `${a.id}/${kind(b)}/${b.patient}/${b.run}`
  if (waiting.has(key)) return
  waiting.add(key)
  setImmediate(async () => {
    waiting.delete(key)
    try {
      await python('software.tools.logger', '--replay', incoming(a, b), '--out', join(dataDir(a), kind(b), b.patient), '--stamp', b.run)
      await exportSessions(a)
    } catch (e) {
      console.error(`[phone] couldn't update the dashboard for ${key}:`, e instanceof Error ? e.message : e)
    }
  })
}

export async function phoneLines(req: IncomingMessage, res: ServerResponse, account: Account, patientId: string) {
  if (req.method === 'GET') return send(res, 200, { ok: true })       // the app's "can I reach you?"
  if (req.method !== 'POST') return send(res, 405, { error: 'POST lines here' })
  const b = parse({ ...(await readJson(req, MAX_BODY)), patient: patientId })     // the sign-in says whose, not the phone
  if (typeof b === 'string') return send(res, 400, { error: b })
  if (b.lines.length) {
    const file = incoming(account, b)
    await mkdir(join(file, '..'), { recursive: true })
    await appendFile(file, b.lines.join('\n') + '\n')
    if (b.lines.some((l) => l.startsWith('R,') || l.startsWith('S,'))) convertSoon(account, b)
  }
  send(res, 200, { ok: true, received: b.lines.length })
}
