import axios, { isAxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''
const PROBE_TIMEOUT_MS = 8000
const GATEWAY_STATUSES = new Set([502, 503, 504])
const NETWORK_CODES = new Set(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'])
const SERVICE_PATH = /^\/?([a-z]+)\/v\d+\//
const PROXY_NOT_FOUND = /page not found/i

// Запрос не получил ответа сервиса: сеть, таймаут, шлюз (502/503/504) или ответ прокси.
// Это лишь подозрение: браузер выдаёт за сетевую ошибку и 500 без CORS-заголовков,
// поэтому недоступностью её делает только проба health (см. useBackendStatus).
export function isUnreachable(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  const response = error.response
  if (response) {
    // Traefik отвечает текстом "404 page not found", когда у маршрута не осталось здоровых контейнеров
    if (response.status === 404) return typeof response.data === 'string' && PROXY_NOT_FOUND.test(response.data)
    return GATEWAY_STATUSES.has(response.status)
  }
  return !!error.code && NETWORK_CODES.has(error.code)
}

// Только 401 на refresh говорит, что сессии больше нет; всё остальное сессию не отменяет.
export function isSessionRejected(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401
}

export function serviceOf(url: string | undefined): string | null {
  const path = url?.startsWith(BASE_URL) ? url.slice(BASE_URL.length) : url
  return path?.match(SERVICE_PATH)?.[1] ?? null
}

export type OutageReason = 'maintenance' | 'unavailable'

export interface ProbeResult {
  alive: boolean
  reason?: OutageReason
}

// Страницы Traefik (docker/status): 503 с JSON {status: "maintenance" | "unavailable"}.
// Это прямой ответ инфраструктуры, а не помеха связи.
function outageReason(error: { response?: { status: number; data?: unknown } }): OutageReason | undefined {
  if (error.response?.status !== 503) return undefined
  const status = (error.response.data as { status?: unknown } | null)?.status
  return status === 'maintenance' || status === 'unavailable' ? status : undefined
}

// Отдельный инстанс: без интерсепторов и cookie, чтобы проба не запускала refresh.
// Любой ответ самого сервиса (даже 500) значит, что связь есть.
export async function probe(service: string): Promise<ProbeResult> {
  try {
    const { data } = await axios
      .create()
      .get(`${BASE_URL}/${service}/v1/health`, { timeout: PROBE_TIMEOUT_MS, withCredentials: false })
    return { alive: data?.status === 'ok' }
  } catch (error) {
    if (!isAxiosError(error) || !error.response) return { alive: false }
    const reason = outageReason(error)
    if (reason) return { alive: false, reason }
    return { alive: !isUnreachable(error) }
  }
}
