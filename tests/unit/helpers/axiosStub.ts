import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

export type Reply = { status: number; data?: unknown } | 'network'

export function jwt(payload: Record<string, unknown>): string {
  return `h.${btoa(JSON.stringify(payload))}.s`
}

export function failure(status?: number, data: unknown = {}, code?: string) {
  const config = { headers: {} } as InternalAxiosRequestConfig
  const response = status ? { status, data, statusText: '', headers: {}, config } : undefined
  return new AxiosError('failed', code, config, {}, response)
}

export function stubBackend(handler: (config: InternalAxiosRequestConfig) => Reply) {
  const original = axios.defaults.adapter
  const calls: InternalAxiosRequestConfig[] = []
  axios.defaults.adapter = async (config) => {
    calls.push(config)
    const reply = handler(config)
    if (reply === 'network') throw new AxiosError('Network Error', 'ERR_NETWORK', config, {})
    const response = { status: reply.status, data: reply.data ?? {}, statusText: '', headers: {}, config }
    if (reply.status >= 200 && reply.status < 300) return response
    throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, {}, response)
  }
  return {
    calls,
    to: (url: string) => calls.filter((call) => call.url === url),
    restore: () => {
      axios.defaults.adapter = original
    },
  }
}
