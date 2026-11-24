/*
  The phone app's install file, so a phone can download it from the dashboard
  (Profile & settings → Connect a phone → "Don't have the app?"). No sign-in: the app is no use
  without a code from a patient's profile, and a phone scanning the QR code has no cookie.

    GET /api/app            { available, version, sizeMB, builtAt }
    GET /api/app/remotion.apk   the file itself

  The file is the release build in the repo (`./gradlew assembleRelease` in software/android),
  or the one REMOTION_APK points at (e.g. on a server without the Android build).
*/
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { HttpError, send } from './http.ts'
import { clientAddress, LIMITS } from './security.ts'

const BUILD = join(import.meta.dirname, '../../android/app/build/outputs/apk/release')
const APK = process.env.REMOTION_APK || join(BUILD, 'app-release.apk')

async function found() {
  try { const s = await stat(APK); return s.isFile() ? s : null } catch { return null }
}

async function version(): Promise<string | null> {
  try {
    const m = JSON.parse(await readFile(join(BUILD, 'output-metadata.json'), 'utf8'))
    return typeof m.elements?.[0]?.versionName === 'string' ? m.elements[0].versionName : null
  } catch { return null }
}

export async function appInfo(res: ServerResponse) {
  const s = await found()
  if (!s) return send(res, 200, { available: false })
  send(res, 200, { available: true, version: await version(), sizeMB: Math.round(s.size / 1e5) / 10, builtAt: s.mtimeMs })
}

export async function appFile(req: IncomingMessage, res: ServerResponse) {
  LIMITS.appDownloads.take(clientAddress(req), 'Too many downloads. Try again later.')
  const s = await found()
  if (!s) throw new HttpError(404, 'The app hasn’t been built on this server.')
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/vnd.android.package-archive')
  res.setHeader('Content-Length', String(s.size))
  res.setHeader('Content-Disposition', 'attachment; filename="ReMotion.apk"')
  res.setHeader('Cache-Control', 'no-cache')
  await new Promise<void>((done, fail) => {
    createReadStream(APK).on('error', fail).on('end', done).pipe(res)
  })
}
