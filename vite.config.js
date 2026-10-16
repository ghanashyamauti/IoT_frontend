import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let base = env.VITE_BASE_PATH || '/'
  if (!base.startsWith('/')) base = '/' + base
  if (!base.endsWith('/')) base = base + '/'

  return {
    base,
    plugins: [react()],
  }
})

