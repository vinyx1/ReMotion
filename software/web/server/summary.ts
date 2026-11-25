/*
  POST /api/summary: writes a short, plain summary of one patient's sessions with
  Claude, for the dashboard's "Generate summary" button.

  Part of the dashboard's API (server/api.ts), so the API key stays on the server and
  never reaches the browser. Credentials come from the environment: ANTHROPIC_API_KEY,
  ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile. Only a signed-in account can ask,
  and a demo account gets at most DEMO_SUMMARIES new ones (the demo is a public page;
  stored notes don't count).

  The browser sends the figures the Overview already shows; nothing else.

  Cache: each summary is stored under a hash of exactly what was sent (plus the model
  and the prompt), in node_modules/.cache/remotion-summaries.json. The same figures
  get the stored note back without calling Claude; new session data changes the
  figures, so the hash changes and Claude writes a fresh one. `{ cachedOnly: true }`
  only looks the note up (for pages that show a stored note without asking for one).
*/
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { type Account, countSummary, DEMO_SUMMARIES } from './accounts.ts'
import { readBody, send } from './http.ts'
import { REPO } from './python.ts'

// Haiku: a short note from a handful of numbers doesn't need a bigger model, and it costs a fraction
const MODEL = 'claude-haiku-5-5'

const SYSTEM = `You are writing a quick progress note that a physiotherapist or occupational therapist will glance at between appointments. The patient is a stroke survivor doing an arm exercise at home (the data names which: a seated forward or sideways reach, hand to mouth, or forearm rotation) with a device that flags a rep as "compensated" when the trunk tilts past a limit (10 degrees by default) for at least 200 ms. "medianReachS" is the typical time for the movement (for hand to mouth, getting the hand to the mouth; for forearm rotation, the turn). The therapist wants to know, in a few seconds, whether the leaning is improving and anything worth checking.

Write it as point-form chart notes:
- Three to five bullet points, each on its own line starting with "- ", each one short (under 15 words). No headings, bold or other markdown.
- The first point gives the overall direction: is the patient leaning less, more, or about the same?
- If the data holds several exercises ("exercises": [...]), the first point is the whole picture across them, then one point per exercise starting with its name and a colon (e.g. "Forward reach: ..."), giving its direction since the first session. With a single exercise, never name it in a point; the therapist is already on its page.
- Use only the few numbers that matter, rounded (e.g. "about 1 in 10 reps", "down from about two thirds"). Do not list every measure.
- Use everyday words ("leaned", "reps", "sessions"; "reaches" only for the reach exercises) rather than metric names like "compensatedPct" or "cleanRepLeanDeg".
- If it matters, mention where the leaning still happens (which target) or how often they practise.
- No preamble, no sign-off, no advice or treatment suggestions; describe what the data shows.
- Use only the numbers given; never invent any.

Example of the format and tone (the numbers here are made up):
- Leaning less: from about 6 in 10 reaches to 1 in 10 over three weeks
- Remaining leaning is mostly at the far red target
- Practising about three times a week`

type Cached = { text: string; createdAt: string }
const CACHE_FILE = process.env.REMOTION_SUMMARY_CACHE ?? join(REPO, 'software/web/node_modules/.cache/remotion-summaries.json')
let cache: Record<string, Cached> | null = null
// identical requests in flight share one Claude call (the Overview and a tab can ask at once)
const inFlight = new Map<string, Promise<Cached>>()

async function loadCache(): Promise<Record<string, Cached>> {
  if (!cache) {
    try { cache = JSON.parse(await readFile(CACHE_FILE, 'utf8')) } catch { cache = {} }
  }
  return cache!
}

async function saveCache() {
  await mkdir(dirname(CACHE_FILE), { recursive: true })
  const tmp = `${CACHE_FILE}.tmp`
  await writeFile(tmp, JSON.stringify(cache, null, 1))
  await rename(tmp, CACHE_FILE)
}

/** JSON with object keys sorted, so the same figures always hash the same. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

async function write(payload: unknown): Promise<string> {
  // a key pasted into a dashboard (Railway's Variables) often brings a space, a line break or quotes
  // with it; any of those makes the request invalid before it's sent, so clean it up first
  const key = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '').trim()
  const client = key ? new Anthropic({ apiKey: key }) : new Anthropic()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // no thinking: a few bullets from given numbers; with it, Haiku can spend the whole budget thinking and return no text
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Session data for one patient, as JSON:\n${JSON.stringify(payload)}` }],
  })
  if (response.stop_reason === 'refusal') throw new SummaryError(502, 'Claude declined to write this summary.')
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
  if (!text) throw new SummaryError(502, `Claude returned no text (stopped: ${response.stop_reason}).`)
  return text
}

class SummaryError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function summarize(req: IncomingMessage, res: ServerResponse, account: Account) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })
  let body: { data?: unknown; cachedOnly?: boolean }
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    return send(res, 400, { error: 'The request body was not valid JSON.' })
  }
  if (!body || typeof body !== 'object' || body.data === undefined) return send(res, 400, { error: 'Send { data }.' })

  const key = createHash('sha256').update(`${MODEL}\n${SYSTEM}\n${stable(body.data)}`).digest('hex')
  const store = await loadCache()
  if (store[key]) return send(res, 200, { ...store[key], cached: true })
  if (body.cachedOnly) return send(res, 200, { text: null })
  if (account.kind === 'demo' && account.summaries >= DEMO_SUMMARIES) {
    return send(res, 429, { error: `This demo has used its ${DEMO_SUMMARIES} summaries.` })
  }

  try {
    let job = inFlight.get(key)
    if (!job) {
      job = write(body.data).then(async (text) => {
        const entry = { text, createdAt: new Date().toISOString() }
        store[key] = entry
        await countSummary(account)
        await saveCache().catch(() => { /* a failed save only costs a later call */ })
        return entry
      }).finally(() => inFlight.delete(key))
      inFlight.set(key, job)
    }
    return send(res, 200, { ...(await job), cached: false })
  } catch (error) {
    if (error instanceof SummaryError) return send(res, error.status, { error: error.message })
    if (error instanceof Anthropic.AuthenticationError) {
      return send(res, 401, { error: 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.' })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return send(res, 429, { error: 'Claude is rate limited right now. Try again in a minute.' })
    }
    if (error instanceof Anthropic.APIConnectionError) {
      console.error('[summary]', error.cause ?? error)
      const cause = error.cause instanceof Error ? error.cause.message : error.message
      return send(res, 502, { error: `Could not reach the Claude API (${cause.slice(0, 160)}). If the key was pasted, check it has no spaces or quotes.` })
    }
    if (error instanceof Anthropic.APIError) {
      return send(res, 502, { error: `Claude API error${error.status ? ` ${error.status}` : ''}: ${error.message}` })
    }
    if (error instanceof Anthropic.AnthropicError) {
      // not an API response: the client could not start, most often because no credentials are set
      return send(res, 503, { error: 'No Claude credentials found on the server. Set ANTHROPIC_API_KEY (or run `ant auth login`) and restart the server.' })
    }
    // anything else (network, DNS, a malformed key header): log it and say what it was
    console.error('[summary]', error)
    const why = error instanceof Error ? error.message : String(error)
    if (/authentication method|api ?key/i.test(why)) {
      return send(res, 503, { error: 'No Claude API key on the server. Set ANTHROPIC_API_KEY in the server\'s environment (on Railway: the service\'s Variables), then redeploy.' })
    }
    return send(res, 502, { error: `Could not reach the Claude API (${why.slice(0, 160)}).` })
  }
}
