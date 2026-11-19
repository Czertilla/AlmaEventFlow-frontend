/** Событие живого обновления: что изменилось, без самих данных. */
export interface LiveChange {
  topic: 'todo' | 'onboarding'
  id: string | null
  deleted: boolean
}

export const RETRY_MIN_MS = 1_000
export const RETRY_MAX_MS = 60_000
export const POLL_MS = 60_000

export function parseChange(raw: string): LiveChange | null {
  try {
    const data = JSON.parse(raw) as Partial<LiveChange>
    if (data.topic !== 'todo' && data.topic !== 'onboarding') return null
    return { topic: data.topic, id: typeof data.id === 'string' ? data.id : null, deleted: data.deleted === true }
  } catch {
    return null
  }
}

/** Пауза перед следующей попыткой: удваивается до минуты. */
export function nextDelay(current: number): number {
  return Math.min(Math.max(current * 2, RETRY_MIN_MS), RETRY_MAX_MS)
}

export function streamUrl(base: string, ticket: string): string {
  return `${base.replace(/\/$/, '')}/event/v3/me/stream?ticket=${encodeURIComponent(ticket)}`
}
