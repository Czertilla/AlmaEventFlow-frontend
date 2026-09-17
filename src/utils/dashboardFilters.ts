// Настройки фильтров дашборда посещаемости -- как и порядок ролей
// (@/utils/roleSort), хранятся в localStorage отдельно для каждого
// коллектива и пользователя.
import { keySuffix } from './roleSort'

export interface DashboardFilters {
  types: string[]
  roleIds: string[]
  activeFilter: 'all' | 'active' | 'inactive'
  sortKey: 'date' | 'name' | 'status'
  sortOrder: 'asc' | 'desc'
}

function filtersKey(collectiveId: string): string {
  return `dashboardFilters:${keySuffix(collectiveId)}`
}

export function loadDashboardFilters(collectiveId: string): Partial<DashboardFilters> | null {
  try {
    const raw = localStorage.getItem(filtersKey(collectiveId))
    if (raw) return JSON.parse(raw) as Partial<DashboardFilters>
  } catch { /* повреждённое значение игнорируем */ }
  return null
}

export function saveDashboardFilters(collectiveId: string, filters: DashboardFilters): void {
  localStorage.setItem(filtersKey(collectiveId), JSON.stringify(filters))
}
