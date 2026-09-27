import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { apiDev } from './vite/api-dev'

export default defineConfig({
  plugins: [react(), apiDev()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
