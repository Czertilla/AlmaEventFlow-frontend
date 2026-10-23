import {
  addWeeks, eachDayOfInterval, eachMonthOfInterval, endOfWeek, format, startOfMonth,
  startOfWeek, subWeeks,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { checkmarkCircle, closeCircle, helpCircle, time } from 'ionicons/icons'
import type {
  AttendanceByMonth, CollectiveDay, CollectiveEventItem, MemberAttendanceItem,
} from '@/api/generated/almaEventFlow'

export type Outcome = MemberAttendanceItem['outcome']
export type WeekStart = 0 | 1
export type Period = 'rolling' | number

export const OUTCOMES: Outcome[] = ['attended', 'absent', 'unmarked', 'upcoming']

export const outcomeLabels: Record<Outcome, string> = {
  attended: 'Присутствовал',
  absent: 'Отсутствовал',
  unmarked: 'Не отмечено',
  upcoming: 'Предстоит',
}

export const collectiveOutcomeLabels: Record<Outcome, string> = {
  attended: 'Присутствий',
  absent: 'Отсутствий',
  unmarked: 'Не отмечено',
  upcoming: 'Предстоит',
}

export const outcomeIcons: Record<Outcome, string> = {
  attended: checkmarkCircle,
  absent: closeCircle,
  unmarked: helpCircle,
  upcoming: time,
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export function monthShort(date: Date): string {
  return MONTHS_SHORT[date.getMonth()]
}

export const PAST_WEEKS = 52
export const UPCOMING_WEEKS = 3
export const MAX_YEAR_CHIPS = 4

export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function isUnmarkedAttendance(a: { is_attended?: boolean | null }): boolean {
  return a.is_attended == null
}

export function emptyCounts(): Record<Outcome, number> {
  return { attended: 0, absent: 0, unmarked: 0, upcoming: 0 }
}

export interface DayEntry {
  id: string
  label: string
  outcome?: Outcome
  detail?: string
}

export interface DaySummary {
  key: string
  items: MemberAttendanceItem[]
  entries: DayEntry[]
  counts: Record<Outcome, number>
  /** Доля присутствовавших среди отмеченных (присутствовал + отсутствовал) за день; null -- отмеченных нет. */
  rate: number | null
}

export function groupByDay(items: MemberAttendanceItem[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>()
  for (const item of items) {
    let day = days.get(item.date)
    if (!day) {
      day = { key: item.date, items: [], entries: [], counts: emptyCounts(), rate: null }
      days.set(item.date, day)
    }
    day.items.push(item)
    day.entries.push({ id: item.attendance_id, label: item.event_name, outcome: item.outcome })
    day.counts[item.outcome] += 1
  }
  for (const day of days.values()) {
    const marked = day.counts.attended + day.counts.absent
    day.rate = marked ? day.counts.attended / marked : null
  }
  return days
}

export function eventRateLabel(event: CollectiveEventItem): string {
  const marked = event.attended + event.absent
  return marked ? `${event.attended} из ${marked}` : 'не отмечено'
}

export function collectiveDays(days: CollectiveDay[], events: CollectiveEventItem[]): Map<string, DaySummary> {
  const byDate = new Map<string, DayEntry[]>()
  for (const event of events) {
    const entries = byDate.get(event.date) ?? []
    entries.push({ id: event.event_id, label: event.event_name, detail: eventRateLabel(event) })
    byDate.set(event.date, entries)
  }
  const result = new Map<string, DaySummary>()
  for (const day of days) {
    const marked = day.attended + day.absent
    result.set(day.date, {
      key: day.date,
      items: [],
      entries: byDate.get(day.date) ?? [],
      counts: { attended: day.attended, absent: day.absent, unmarked: day.unmarked, upcoming: day.upcoming },
      rate: marked ? day.attended / marked : null,
    })
  }
  return result
}

const RATE_ATTENDED = 'rgb(var(--att-attended-rgb))'
const RATE_MIDDLE = 'rgb(var(--att-unmarked-rgb))'
const RATE_ABSENT = 'rgb(var(--att-absent-rgb))'

function mixColors(from: string, to: string, share: number): string {
  if (share <= 0) return to
  if (share >= 1) return from
  return `color-mix(in oklab, ${from} ${Math.round(share * 1000) / 10}%, ${to})`
}

/** Цвет дня по доле присутствовавших: 1 -- цвет присутствия, 0 -- цвет отсутствия, 0.5 -- цвет «не отмечено». */
export function rateColor(rate: number): string {
  const value = Math.min(Math.max(rate, 0), 1)
  return value >= 0.5
    ? mixColors(RATE_ATTENDED, RATE_MIDDLE, (value - 0.5) / 0.5)
    : mixColors(RATE_MIDDLE, RATE_ABSENT, value / 0.5)
}

const GRADIENT_STOPS = 9

/** Градиент легенды слева направо: от присутствия (зелёный) к отсутствию (красный). */
export function rateGradient(): string {
  const stops = Array.from({ length: GRADIENT_STOPS }, (_, i) => {
    const rate = 1 - i / (GRADIENT_STOPS - 1)
    return `${rateColor(rate)} ${Math.round((i / (GRADIENT_STOPS - 1)) * 100)}%`
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}

export interface DayMark {
  key: string
  color?: string
  outcome?: Outcome
  hatch?: boolean
}

export function dayMarks(day: DaySummary): DayMark[] {
  const marks: DayMark[] = []
  if (day.rate !== null) marks.push({ key: 'rate', color: rateColor(day.rate), hatch: day.counts.unmarked > 0 })
  else if (day.counts.unmarked) marks.push({ key: 'unmarked', outcome: 'unmarked' })
  if (day.counts.upcoming) marks.push({ key: 'upcoming', outcome: 'upcoming' })
  return marks
}

export function dayRateLabel(day: DaySummary): string {
  const marked = day.counts.attended + day.counts.absent
  return day.rate === null ? '' : `${formatRate(day.rate)} (${day.counts.attended} из ${marked})`
}

export function periodRange(
  period: Period, today: Date, weekStartsOn: WeekStart,
): { from: Date; to: Date } {
  if (period !== 'rolling') return { from: new Date(period, 0, 1), to: new Date(period, 11, 31) }
  return {
    from: startOfWeek(subWeeks(today, PAST_WEEKS), { weekStartsOn }),
    to: endOfWeek(addWeeks(today, UPCOMING_WEEKS), { weekStartsOn }),
  }
}

export function weekColumns(from: Date, to: Date, weekStartsOn: WeekStart): Date[][] {
  const days = eachDayOfInterval({
    start: startOfWeek(from, { weekStartsOn }),
    end: endOfWeek(to, { weekStartsOn }),
  })
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

export function inRange(date: Date, from: Date, to: Date): boolean {
  const key = dayKey(date)
  return key >= dayKey(from) && key <= dayKey(to)
}

export function monthLabels(
  weeks: Date[][], from: Date, to: Date,
): { col: number; label: string }[] {
  const labels: { col: number; label: string }[] = []
  let previous = -1
  weeks.forEach((week, col) => {
    const first = week.find((day) => inRange(day, from, to)) ?? week[0]
    const month = first.getFullYear() * 12 + first.getMonth()
    if (month === previous) return
    previous = month
    labels.push({ col, label: monthShort(first) })
  })
  if (labels.length > 1 && labels[1].col - labels[0].col < 3) labels.shift()
  return labels
}

export interface MonthBucket {
  key: string
  label: string
  attended: number
  absent: number
  unmarked: number
  upcoming: number
}

export function monthSeries(from: Date, to: Date, rows: AttendanceByMonth[]): MonthBucket[] {
  const found = new Map(rows.map((row) => [row.month, row]))
  return eachMonthOfInterval({ start: from, end: to }).map((month) => {
    const key = dayKey(startOfMonth(month))
    const row = found.get(key)
    return {
      key,
      label: monthShort(month),
      attended: row?.attended ?? 0,
      absent: row?.absent ?? 0,
      unmarked: row?.unmarked ?? 0,
      upcoming: row?.upcoming ?? 0,
    }
  })
}

export function formatRate(rate: number | null | undefined): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}

export function yearChips(years: number[], active: Period): number[] {
  const chips = years.slice(0, MAX_YEAR_CHIPS)
  if (typeof active === 'number' && !chips.includes(active)) chips.push(active)
  return chips.sort((a, b) => b - a)
}

export function dayTitle(key: string): string {
  return format(new Date(`${key}T00:00:00`), 'd MMMM yyyy, EEEEEE', { locale: ru })
}
