/**
 * Собирает id, запрошенные в течение одного тика, в один вызов: десять ячеек таблицы,
 * которым нужно по имени, ждут одного ответа, а не десяти. Неудача вызова отклоняет
 * все ожидающие запросы (чтобы её не закешировали как «нет имени»); id, которого нет
 * в ответе, даёт null.
 */
export function createBatcher<T>(load: (ids: string[]) => Promise<Map<string, T>>, limit = 50) {
  interface Waiter {
    resolve: (value: T | null) => void
    reject: (reason: unknown) => void
  }
  let waiting = new Map<string, Waiter[]>()
  let scheduled = false

  async function flush() {
    const batch = waiting
    waiting = new Map()
    scheduled = false
    const ids = [...batch.keys()]
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += limit) chunks.push(ids.slice(i, i + limit))
    await Promise.all(chunks.map(async (chunk) => {
      try {
        const found = await load(chunk)
        for (const id of chunk) for (const waiter of batch.get(id) ?? []) waiter.resolve(found.get(id) ?? null)
      } catch (error) {
        for (const id of chunk) for (const waiter of batch.get(id) ?? []) waiter.reject(error)
      }
    }))
  }

  return (id: string): Promise<T | null> =>
    new Promise((resolve, reject) => {
      const list = waiting.get(id) ?? []
      list.push({ resolve, reject })
      waiting.set(id, list)
      if (!scheduled) {
        scheduled = true
        setTimeout(flush, 0)
      }
    })
}
