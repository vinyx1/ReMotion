/*
  While the dashboard loads: the sign-in page's own wall with "Re", the app's icon, in
  Literata, and a short eucalyptus line sliding under it. Only the line moves. It fades in
  only after 200 ms, so a fast load never flashes it, and it's pure CSS (index.css, .loader),
  so it keeps moving while the browser is busy loading the dashboard's code. The wall is the
  same as the sign-in page's, so when the page arrives only the mark goes.
*/
import { WallFacets } from './WallFacets'

export function Loader({ label = 'Loading the dashboard' }: { label?: string }) {
  return (
    <div className="dash-wall grid min-h-dvh place-items-center">
      <WallFacets />
      <div role="status" className="loader flex flex-col items-center gap-4">
        <span className="sr-only">{label}</span>
        <span aria-hidden className="font-display text-[5.25rem] leading-none font-semibold text-forest">Re</span>
        <span aria-hidden className="loader-track">
          <span className="loader-line" />
        </span>
      </div>
    </div>
  )
}
