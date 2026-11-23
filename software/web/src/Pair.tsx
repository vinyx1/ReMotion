/*
  /pair?code=ABC123: where a patient's QR code leads when it's scanned with the phone's own
  camera rather than inside the Re:Motion app. On Android, "Open the Re:Motion app" hands the
  code to the app (its remotion://pair link); anywhere, the code is shown to type in.
*/
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/atkinson-hyperlegible-mono'
import { useEffect } from 'react'
import { WallFacets } from './components/WallFacets'

export default function Pair() {
  const code = (new URLSearchParams(location.search).get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  const app = `intent://pair?code=${code}&server=${encodeURIComponent(location.origin)}#Intent;scheme=remotion;package=ca.remotion.phone;end`
  useEffect(() => { document.title = 'Connect the app · Re:Motion' }, [])
  return (
    <div className="dash-wall flex min-h-dvh flex-col">
      <WallFacets />
      <header className="px-6 pt-6"><a href="/" className="font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-forest">Re:Motion</a></header>
      <main className="mx-auto grid w-full max-w-[27rem] flex-1 items-center px-6 pb-16">
        <div className="flex flex-col gap-5 rounded-[18px] bg-plaster p-6 shadow-[0_0_0_1px_rgb(31_45_39/0.1),0_2px_4px_rgb(31_45_39/0.08),0_16px_36px_-18px_rgb(31_45_39/0.45)] sm:p-8">
          <h1 className="font-display text-[1.75rem] leading-tight font-medium text-forest">Connect the app</h1>
          {code ? (
            <>
              <a href={app} className="inline-flex h-12 items-center justify-center rounded-xl bg-forest px-5 text-[17px] font-bold text-plaster">Open the Re:Motion app</a>
              <p className="text-[16px] text-forest">Or type this code in the app:</p>
              <p className="font-readout text-[2rem] font-semibold tracking-[0.15em] text-forest tabular-nums">{code.slice(0, 3)} {code.slice(3)}</p>
            </>
          ) : (
            <p className="text-[16px] text-forest">This link has no code. Ask for a new one on the patient’s profile.</p>
          )}
        </div>
      </main>
    </div>
  )
}
