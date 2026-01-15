import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        // Use 127.0.0.1 to avoid occasional Windows localhost/IPv6 resolution issues.
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
