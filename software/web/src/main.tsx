import './index.css'

import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Loader } from './components/Loader'

// Two pages, chosen by the URL. Each is loaded only when it is visited.
//   /           the landing page
//   /dashboard  the therapist dashboard
//   /pair       where a patient's QR code leads from the phone's camera (Pair.tsx)
const Dashboard = lazy(() => import('./Dashboard'))
const Landing = lazy(() => import('./landing/Landing'))
const Pair = lazy(() => import('./Pair'))

const path = window.location.pathname.replace(/\/+$/, '')
const isDashboard = path === '/dashboard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* the dashboard's code loads after the page: the loader shows meanwhile (the landing paints its own) */}
    <Suspense fallback={isDashboard ? <Loader /> : null}>{isDashboard ? <Dashboard /> : path === '/pair' ? <Pair /> : <Landing />}</Suspense>
  </StrictMode>,
)
