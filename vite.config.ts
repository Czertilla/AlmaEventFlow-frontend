/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import pkg from './package.json'

// Backend API version comes from the committed OpenAPI schema, refreshed by
// `npm run schema` / `npm run generate`. Falls back gracefully if missing.
function readApiVersion(): string {
  try {
    const schema = JSON.parse(fs.readFileSync('./api_schema/openapi.json', 'utf-8'))
    return schema?.info?.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __API_VERSION__: JSON.stringify(readApiVersion()),
  },
  plugins: [
    vue(),
    legacy()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
