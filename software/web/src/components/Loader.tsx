/*
  While the dashboard loads: the sign-in page's own wall, with the seated figure from the
  phone app's opening reaching for its target and back, the back upright all the while.
  It fades in only after 200 ms, so a fast load never flashes it, and it's pure CSS (index.css,
  .loader), so it keeps moving while the browser is busy loading the dashboard's code.
  The wall is the same as the sign-in page's, so when the page arrives only the figure goes.
*/
import { WallFacets } from './WallFacets'

export function Loader({ label = 'Loading the dashboard' }: { label?: string }) {
  return (
    <div className="dash-wall grid min-h-dvh place-items-center">
      <WallFacets />
      <div role="status" className="loader">
        <span className="sr-only">{label}</span>
        {/* the 108-unit grid of the app icon and the phone's launch screen */}
        <svg viewBox="0 0 108 108" className="size-44" aria-hidden>
          <circle cx="44" cy="36" r="6" fill="var(--color-forest)" />
          <path d="M44 45 L44 70" stroke="var(--color-forest)" strokeWidth="8" strokeLinecap="round" />
          <path className="loader-arm" d="M47 51 L68 52" stroke="var(--color-forest)" strokeWidth="5" strokeLinecap="round" />
          <circle className="loader-target" cx="76" cy="52" r="5" fill="var(--color-eucalyptus)" />
          <circle cx="76" cy="52" r="4.5" fill="none" stroke="var(--color-eucalyptus)" strokeWidth="3" />
          <path d="M30 80 L84 80" stroke="var(--color-forest)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
