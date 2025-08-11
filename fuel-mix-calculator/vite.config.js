import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Default to root when running locally; CI can override via --base or BASE_PATH env
  base: process.env.BASE_PATH || '/',
})
