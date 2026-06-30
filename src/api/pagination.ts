import type { AxiosResponse } from 'axios'

/** Конверт пагинации бэкенда: { items, pagination: { page?, limit?, total } }. */
export interface SPageLike<T> {
  items: T[]
  pagination?: { page?: number; limit?: number; total?: number }
}

/** Максимальный limit, который принимает API (см. @maximum 100 в схеме). */
export const MAX_PAGE_LIMIT = 100

/**
 * Безопасно достаёт список из ответа: поддерживает и конверт { items },
 * и «голый» массив. Заменяет россыпь `(resp.data as any).items` по коду.
 */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const items = (data as { items?: unknown } | null)?.items
  return Array.isArray(items) ? (items as T[]) : []
}

function readTotal(data: unknown): number | null {
  const total = (data as { pagination?: { total?: number } } | null)?.pagination?.total
  return typeof total === 'number' ? total : null
}

/**
 * Постранично выкачивает ВСЕ элементы списка, а не первые `limit`.
 * `fetch(page, limit)` должен вызывать соответствующий generated-эндпоинт.
 * Останавливается по достижении total (если он есть) или по пустой странице.
 */
export async function fetchAllPages<T>(
  fetch: (page: number, limit: number) => Promise<AxiosResponse<unknown>>,
  limit: number = MAX_PAGE_LIMIT,
): Promise<T[]> {
  const first = await fetch(0, limit)
  const all = unwrapList<T>(first.data)
  const total = readTotal(first.data)
  if (total === null) return all // не пагинированный ответ — возвращаем как есть

  let page = 1
  while (all.length < total) {
    const resp = await fetch(page, limit)
    const items = unwrapList<T>(resp.data)
    if (items.length === 0) break
    all.push(...items)
    page++
  }
  return all
}
