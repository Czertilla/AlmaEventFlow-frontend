import type {
  EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1, EventPriorityEnumV1,
} from '@/api/generated/almaEventFlow'

export const statusLabels: Record<EventStatusEnumV1, string> = {
  draft: 'Черновик', active: 'Активно', template: 'Шаблон', archived: 'Архив',
}
export const levelLabels: Record<EventLevelEnumV1, string> = {
  internal: 'Внутренний', regional: 'Региональный', national: 'Национальный', international: 'Международный',
}
export const typeLabels: Record<EventTypeEnumV1, string> = {
  rehearsal: 'Репетиция', competition: 'Конкурс', concert: 'Концерт',
  festival: 'Фестиваль', play: 'Спектакль', performance: 'Выступление',
}
export const formatLabels: Record<EventFormatEnumV1, string> = {
  online: 'Онлайн', offline: 'Офлайн',
}
export const priorityLabels: Record<EventPriorityEnumV1, string> = {
  hight: 'Высокий', medium: 'Средний', low: 'Низкий',
}

export const statusOptions = Object.entries(statusLabels) as [EventStatusEnumV1, string][]
export const levelOptions = Object.entries(levelLabels) as [EventLevelEnumV1, string][]
export const typeOptions = Object.entries(typeLabels) as [EventTypeEnumV1, string][]
export const formatOptions = Object.entries(formatLabels) as [EventFormatEnumV1, string][]
export const priorityOptions = Object.entries(priorityLabels) as [EventPriorityEnumV1, string][]

const statusColors: Record<EventStatusEnumV1, string> = {
  draft: '#92949c', template: '#6C63FF', active: '#00D9A6', archived: '#FF4757',
}

export function statusColor(status: EventStatusEnumV1 | null | undefined): string {
  return statusColors[status ?? 'draft']
}
export function statusLabel(status: EventStatusEnumV1 | null | undefined): string {
  return statusLabels[status ?? 'draft']
}
