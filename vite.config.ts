import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { apiDev } from './vite/api-dev'

export default defineConfig({
  plugins: [react(), apiDev()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // The file readers load on first use; named here so dev does not discover them mid-session and reload the page.
  optimizeDeps: { include: ['pdfjs-dist', 'mammoth', 'read-excel-file/browser'] },
})
