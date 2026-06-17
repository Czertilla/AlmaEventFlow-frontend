// Порядок ролей для сортировки участников. Настраивается руководителем в панели
// и применяется везде, где показываются участники коллектива (панель + страница
// мероприятия). Хранится в localStorage отдельно для каждого коллектива и пользователя.
import { useAuthStore } from '@/stores/auth'

export type SortMode = 'roles' | 'alpha'

function keySuffix(collectiveId: string): string {
  const auth = useAuthStore()
  const sub = auth.jwtPayload?.sub || 'anon'
  return `${collectiveId}:${sub}`
}

function roleSortKey(collectiveId: string): string {
  return `roleSort:${keySuffix(collectiveId)}`
}

function sortModeKey(collectiveId: string): string {
  return `roleSortMode:${keySuffix(collectiveId)}`
}

// Режим сортировки участников: по ролям (по умолчанию) либо по алфавиту.
export function loadSortMode(collectiveId: string): SortMode {
  return localStorage.getItem(sortModeKey(collectiveId)) === 'alpha' ? 'alpha' : 'roles'
}

export function saveSortMode(collectiveId: string, mode: SortMode): void {
  localStorage.setItem(sortModeKey(collectiveId), mode)
}

export function loadStoredRoleOrder(collectiveId: string): string[] {
  try {
    const raw = localStorage.getItem(roleSortKey(collectiveId))
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* повреждённое значение игнорируем */ }
  return []
}

// Сохранённый порядок + текущие роли: известные сохраняем в их порядке,
// новые добавляем в конец, удалённые отбрасываем.
export function reconcileRoleOrder(collectiveId: string, roleIds: string[]): string[] {
  const stored = loadStoredRoleOrder(collectiveId)
  const known = stored.filter((id) => roleIds.includes(id))
  const missing = roleIds.filter((id) => !known.includes(id))
  return [...known, ...missing]
}

export function saveRoleOrder(collectiveId: string, order: string[]): void {
  localStorage.setItem(roleSortKey(collectiveId), JSON.stringify(order))
}

// Минимальный индекс любой из ролей в заданном порядке; без ролей/неизвестные — в конец.
export function rankByRoleIds(order: string[], roleIds: string[]): number {
  let best = Number.POSITIVE_INFINITY
  for (const id of roleIds) {
    const idx = order.indexOf(id)
    if (idx >= 0 && idx < best) best = idx
  }
  return best
}
