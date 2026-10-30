import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8082'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5176,
    hmr: { overlay: false },
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget },
      '/sanctum': { target: apiTarget },
      '/storage': { target: apiTarget },
    },
  },
})
