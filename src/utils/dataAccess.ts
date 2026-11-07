import type {
  AccessAction,
  AccessExportRead,
  GrantState,
  GrantStateRead,
  SkipReason,
} from '@/api/generated/almaEventFlow'

export const GRANT_STATE_LABELS: Record<GrantState, string> = {
  pending: 'Ждёт ответа',
  active: 'Разрешено',
  declined: 'Отказано',
  revoked: 'Отозвано',
  expired: 'Срок истёк',
}

export const SKIP_LABELS: Record<SkipReason, string> = {
  pending: 'Не ответил',
  declined: 'Отказал',
  revoked: 'Отозвал',
  expired: 'Срок истёк',
  not_member: 'Уже не в коллективе',
}

export const ACCESS_ACTION_LABELS: Record<AccessAction, string> = {
  read: 'Просмотр',
  export: 'Выгрузка',
  request_created: 'Запрос доступа',
  grant_approved: 'Доступ разрешён',
  grant_declined: 'В доступе отказано',
  grant_revoked: 'Доступ отозван',
  key_destroyed: 'Данные уничтожены',
  denied: 'Попытка без доступа',
}

export const TERMS: { days: number; label: string }[] = [
  { days: 3, label: '3 дня' },
  { days: 7, label: 'Неделя' },
  { days: 14, label: '2 недели' },
  { days: 30, label: 'Месяц' },
]

export const COMMENT_MIN = 10
export const COMMENT_MAX = 500

export function grantCounts(grants: GrantStateRead[]): Record<GrantState, number> {
  const counts: Record<GrantState, number> = { pending: 0, active: 0, declined: 0, revoked: 0, expired: 0 }
  for (const grant of grants) counts[grant.status] += 1
  return counts
}

export function expiresAfter(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function formatExportValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (typeof value === 'string') return ISO_DATE.test(value) ? value.split('-').reverse().join('.') : value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
    if (parts.every(([, part]) => part === null || typeof part === 'string')) {
      return parts.map(([, part]) => formatExportValue(part)).filter(Boolean).join(' ')
    }
    return parts.map(([name, part]) => `${name}: ${formatExportValue(part)}`).join(', ')
  }
  return String(value)
}

export interface ExportTable {
  header: string[]
  rows: string[][]
}

/** One row per member: the full name, then each field, values of several records joined. */
export function exportTable(exported: AccessExportRead, names: Map<string, string | null>): ExportTable {
  return {
    header: ['ФИО', ...exported.fields.map((field) => field.label)],
    rows: exported.subjects.map((subject) => [
      names.get(subject.person_id) ?? '',
      ...exported.fields.map((field) =>
        subject.records
          .filter((record) => field.key in record)
          .map((record) => formatExportValue(record[field.key]))
          .join('; '),
      ),
    ]),
  }
}

const FORMULA = /^[=@\t\r]|^[+-](?![\d\s(])/

function csvCell(value: string): string {
  const safe = FORMULA.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV for a spreadsheet: `;`-separated, BOM-prefixed UTF-8, formulas defused. */
export function toCsv(table: ExportTable): string {
  const lines = [table.header, ...table.rows].map((row) => row.map(csvCell).join(';'))
  return `\ufeff${lines.join('\r\n')}\r\n`
}

export function downloadText(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
