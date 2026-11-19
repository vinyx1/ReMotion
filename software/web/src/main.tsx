import './index.css'

import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

// Two pages, chosen by the URL. Each is loaded only when it is visited.
//   /           the landing page
//   /dashboard  the therapist dashboard
const Dashboard = lazy(() => import('./Dashboard'))
const Landing = lazy(() => import('./landing/Landing'))

const isDashboard = window.location.pathname.replace(/\/+$/, '') === '/dashboard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isDashboard ? <Dashboard /> : <Landing />}</Suspense>
  </StrictMode>,
)
