import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Stamped into index.html so production checks can tell which build Vercel is serving.
process.env.VITE_COMMIT_SHA ||= process.env.VERCEL_GIT_COMMIT_SHA || 'local'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
