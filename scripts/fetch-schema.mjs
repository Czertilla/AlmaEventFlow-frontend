// Fetches the live backend OpenAPI schema and stores it for orval + the
// "О приложении" section. Base URL comes from the Vite env (VITE_API_URL),
// the same variable the app uses at runtime.
//
// Usage: node scripts/fetch-schema.mjs   (runs automatically before `orval`)
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

async function main() {
  const env = loadEnv(process.env.NODE_ENV || 'development', root, '')
  const base = (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
  const url = `${base}/openapi.json`
  const outFile = resolve(root, 'api_schema/openapi.json')

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    const schema = await res.json()
    mkdirSync(dirname(outFile), { recursive: true })
    // 4-space indent matches FastAPI's own /openapi.json formatting
    writeFileSync(outFile, JSON.stringify(schema, null, 4) + '\n')
    console.log(`✓ OpenAPI schema saved from ${url} (API version ${schema?.info?.version ?? 'unknown'})`)
  } catch (err) {
    console.error(`✗ Could not fetch schema from ${url}: ${err.message}`)
    console.error('  Is the backend running? Using the existing api_schema/openapi.json instead.')
    process.exitCode = 1
  }
}

main()
