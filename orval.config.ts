import { defineConfig } from 'orval'

export default defineConfig({
  almaEventFlow: {
    input: {
      target: './api_schema/openapi.json',
      validation: false,
    },
    output: {
      mode: 'single',
      target: './src/api/generated/almaEventFlow.ts',
      client: 'axios-functions',
      override: { useDates: false },
    },
  },
})
