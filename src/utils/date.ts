import { format as fnsFormat } from 'date-fns'

export function formatDate(date: string | Date, formatStr: string = 'DD.MM.YYYY'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // Пустая или некорректная дата — пустая строка вместо падения date-fns
  if (!date || isNaN(d.getTime())) return ''
  const map: Record<string, string> = {
    'DD.MM.YYYY': 'dd.MM.yyyy',
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'MM/DD/YYYY': 'MM/dd/yyyy',
  }
  return fnsFormat(d, map[formatStr] || 'dd.MM.yyyy')
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (!date || isNaN(d.getTime())) return ''
  return fnsFormat(d, 'HH:mm')
}
