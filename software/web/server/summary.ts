/*
  POST /api/summary: writes a short, plain summary of one patient's sessions with
  Claude, for the dashboard's "Generate summary" button.

  It runs inside the Vite dev and preview servers (see vite.config.ts), so the API
  key stays on this machine and never reaches the browser. Credentials come from
  the environment: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login`
  profile. The static production build has no server, so the button there reports
  that summaries need `npm run dev` or `npm run preview`.

  The browser sends the figures the Overview already shows; nothing else.
*/
import Anthropic from '@anthropic-ai/sdk'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// Haiku: a short note from a handful of numbers doesn't need a bigger model, and it costs a fraction
const MODEL = 'claude-haiku-5-5'

const SYSTEM = `You are writing a quick progress note that a physiotherapist or occupational therapist will glance at between appointments. The patient is a stroke survivor doing a seated reaching exercise at home with a device that flags a reach as "compensated" when the trunk leans forward past a limit (10 degrees by default) for at least 200 ms. The therapist wants to know, in a few seconds, whether the leaning is improving and anything worth checking.

Write it the way a colleague would jot it in the chart:
- Two or three short sentences, under 60 words in total. Plain text only: no headings, lists, bold or markdown.
- Lead with the overall direction: is the patient leaning less, more, or about the same?
- Use only the few numbers that matter, rounded (e.g. "about 1 in 10 reaches", "down from about two thirds"). Do not list every measure.
- Use everyday words ("leaned forward", "reaches", "sessions") rather than metric names like "compensatedPct" or "cleanRepLeanDeg".
- If it matters, mention where the leaning still happens (which target) or how often they practise.
- No preamble, no sign-off, no advice or treatment suggestions; describe what the data shows.
- Use only the numbers given; never invent any.
- If the data is marked simulated, end with "(simulated data)".

Example of the tone (the numbers here are made up): "Leaning forward has dropped from about 6 in 10 reaches to 1 in 10 over three weeks. What leaning remains is mostly at the far red target. Practising about three times a week."`

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk; if (data.length > 200_000) req.destroy() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })
  let payload: unknown
  try {
    payload = JSON.parse(await readBody(req))
  } catch {
    return send(res, 400, { error: 'The request body was not valid JSON.' })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Session data for one patient, as JSON:\n${JSON.stringify(payload)}` }],
    })
    if (response.stop_reason === 'refusal') {
      return send(res, 502, { error: 'Claude declined to write this summary.' })
    }
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    if (!text) return send(res, 502, { error: 'Claude returned no text.' })
    return send(res, 200, { text })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return send(res, 401, { error: 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.' })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return send(res, 429, { error: 'Claude is rate limited right now. Try again in a minute.' })
    }
    if (error instanceof Anthropic.APIError) {
      return send(res, 502, { error: `Claude API error${error.status ? ` ${error.status}` : ''}: ${error.message}` })
    }
    if (error instanceof Anthropic.AnthropicError) {
      // not an API response: the client could not start, most often because no credentials are set
      return send(res, 503, { error: 'No Claude credentials found on the server. Set ANTHROPIC_API_KEY (or run `ant auth login`) and restart `npm run dev`.' })
    }
    return send(res, 502, { error: 'Could not reach the Claude API.' })
  }
}

/** Vite plugin: serves POST /api/summary in `vite` (dev) and `vite preview`. */
export function claudeSummary(): Plugin {
  const mount = (server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void } }) => {
    server.middlewares.use('/api/summary', (req, res) => { void handle(req, res) })
  }
  return {
    name: 'remotion-claude-summary',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}
