import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { remotionApi } from './server/api.ts'

export default defineConfig(({ mode }) => {
  // Server-side secrets for the API's /api/summary: copy ANTHROPIC_* from software/web/.env into
  // this process's environment. They are never exposed to the browser (Vite only
  // exposes VITE_-prefixed values there), and a key already set in the shell wins.
  const env = loadEnv(mode, process.cwd(), 'ANTHROPIC_')
  for (const [k, v] of Object.entries(env)) if (v && !process.env[k]) process.env[k] = v

  return {
    plugins: [react(), tailwindcss(), remotionApi()],
  }
})
