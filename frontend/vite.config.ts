import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',  // Vite proxy so /api/* calls from the frontend hit your FastAPI backend
      '/uploads': 'http://localhost:8000',  // Sprint 6: photo URLs served by FastAPI static files in dev
    },
  },
})