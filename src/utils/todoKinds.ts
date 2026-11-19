import type { TodoItem, TodoKind } from '@/api/generated/almaEventFlow'

/**
 * Типы дел «Что сделать». Новый тип: значение `kind` на сервере, запись здесь и
 * компонент в `TODO_RENDERERS` модалки; механизм (алерт, модалка, счётчик) не
 * меняется.
 */
export interface TodoKindInfo {
  kind: TodoKind
  title: string
  order: number
}

export const TODO_KINDS: Record<TodoKind, TodoKindInfo> = {
  onboarding: { kind: 'onboarding', title: 'Вступление в коллектив', order: -1 },
  consent: { kind: 'consent', title: 'Согласие на доступ к данным', order: 0 },
  fill_fields: { kind: 'fill_fields', title: 'Дополнить данные', order: 1 },
  attendance: { kind: 'attendance', title: 'Отметить присутствие', order: 2 },
}

export interface TodoGroup {
  info: TodoKindInfo
  items: TodoItem[]
}

/** Дела по типам, в порядке реестра; тип, которого клиент не знает, не показывается. */
export function groupTodo(items: TodoItem[]): TodoGroup[] {
  const groups = new Map<TodoKind, TodoItem[]>()
  for (const item of items) {
    if (!(item.kind in TODO_KINDS)) continue
    const list = groups.get(item.kind) ?? []
    list.push(item)
    groups.set(item.kind, list)
  }
  return [...groups.entries()]
    .map(([kind, list]) => ({ info: TODO_KINDS[kind], items: list }))
    .sort((a, b) => a.info.order - b.info.order)
}

/** Ключи полей реестра, которые надо дополнить, из всех дел «Дополнить данные». */
export function missingFieldKeys(items: TodoItem[]): Set<string> {
  const keys = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'fill_fields') continue
    for (const field of item.fill?.fields ?? []) keys.add(field.key)
  }
  return keys
}

/**
 * Ответ сервера с учётом недоступных источников: дела тех типов, которые сейчас
 * не удалось посчитать, остаются прежними, а не пропадают.
 */
export function mergeTodo(previous: TodoItem[], next: TodoItem[], unavailable: TodoKind[]): TodoItem[] {
  if (!unavailable.length) return next
  const known = new Set(next.map((item) => item.id))
  const kept = previous.filter((item) => unavailable.includes(item.kind) && !known.has(item.id))
  return [...next, ...kept]
}
