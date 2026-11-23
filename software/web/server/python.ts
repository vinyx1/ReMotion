/*
  Runs the repo's Python tools (the logger, the export, the fake-patient generator) for the
  server, one at a time: two exports writing the same account's sessions.json at once
  would race.
*/
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/** The repo root (this file is software/web/server/python.ts). */
export const REPO = resolve(import.meta.dirname, '../../..')
export const PYTHON = process.env.REMOTION_PYTHON
  ?? (existsSync(resolve(REPO, '.venv/bin/python')) ? resolve(REPO, '.venv/bin/python') : 'python3')

let queue: Promise<unknown> = Promise.resolve()

/** `python -m <module> <args...>` from the repo root, after any run already queued. */
export function python(module: string, ...args: string[]): Promise<void> {
  const job = queue.then(() => exec(PYTHON, ['-m', module, ...args], { cwd: REPO, maxBuffer: 16 << 20 })).then(() => undefined)
  queue = job.catch(() => undefined)
  return job
}
