import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react' // https://www.npmjs.com/package/@vitejs/plugin-react
import { defineConfig } from 'vite'
import manifest from './manifest.config.js'

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    crx({ manifest }),
    react({ exclude: [/\/node_modules\//] }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173,
    },
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
