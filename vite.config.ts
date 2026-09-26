import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Publishes the static design prototypes with the app build: /proto/v5/review.html and /proto/journey/.
// The journey page calls the api/ functions; without the model keys it replays recorded runs.
function prototypes(): Plugin {
  const from = path.resolve(__dirname, 'docs/design/proposals')
  return {
    name: 'publish-prototypes',
    apply: 'build',
    closeBundle() {
      for (const dir of ['v5', 'journey']) {
        fs.cpSync(path.join(from, dir), path.resolve(__dirname, 'dist/proto', dir), {
          recursive: true,
          filter: (src) => !src.endsWith('server.mjs'),
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), prototypes()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
