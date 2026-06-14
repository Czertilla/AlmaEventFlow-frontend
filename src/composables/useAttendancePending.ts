import { reactive } from 'vue'

// Глобальный набор attendance id, по которым сейчас идёт PATCH —
// чипы-переключатели показывают спиннер вместо иконки
const pending = reactive(new Set<string>())

export function useAttendancePending() {
  async function withPending(id: string, fn: () => Promise<void>) {
    pending.add(id)
    try {
      await fn()
    } finally {
      pending.delete(id)
    }
  }
  return { pending, withPending }
}
