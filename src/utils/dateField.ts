export type DateFieldMode = 'date' | 'time' | 'datetime'

const GROUPS: Record<DateFieldMode, number[]> = {
  date: [2, 2, 4],
  time: [2, 2],
  datetime: [2, 2, 4, 2, 2],
}

const SEPARATORS: Record<DateFieldMode, string[]> = {
  date: ['.', '.'],
  time: [':'],
  datetime: ['.', '.', ' ', ':'],
}

export const FIELD_HINTS: Record<DateFieldMode, string> = {
  date: 'ДД.ММ.ГГГГ',
  time: 'ЧЧ:ММ',
  datetime: 'ДД.ММ.ГГГГ ЧЧ:ММ',
}

const digitsOf = (text: string) => text.replace(/\D/g, '')

const capacity = (mode: DateFieldMode) => GROUPS[mode].reduce((sum, size) => sum + size, 0)

export function maskDigits(raw: string, mode: DateFieldMode): string {
  const digits = digitsOf(raw).slice(0, capacity(mode))
  let masked = ''
  let taken = 0
  GROUPS[mode].forEach((size, index) => {
    const part = digits.slice(taken, taken + size)
    if (!part) return
    masked += (index ? SEPARATORS[mode][index - 1] : '') + part
    taken += size
  })
  return masked
}

export function caretAfterDigits(masked: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let index = 0; index < masked.length; index++) {
    if (/\d/.test(masked[index]!)) seen++
    if (seen === digitCount) return index + 1
  }
  return masked.length
}

export interface FieldEdit {
  text: string
  caret: number
}

export function applyFieldInput(
  previous: string,
  raw: string,
  caret: number,
  inputType: string,
  mode: DateFieldMode,
): FieldEdit {
  let digits = digitsOf(raw)
  let before = digitsOf(raw.slice(0, caret)).length
  const removedSeparator =
    inputType === 'deleteContentBackward' && digits.length === digitsOf(previous).length
  if (removedSeparator && before > 0) {
    digits = digits.slice(0, before - 1) + digits.slice(before)
    before -= 1
  }
  const text = maskDigits(digits, mode)
  return { text, caret: caretAfterDigits(text, before) }
}

const pad = (value: number, size: number) => String(value).padStart(size, '0')

export function parseFieldText(text: string, mode: DateFieldMode): string | null {
  const digits = digitsOf(text)
  if (digits.length !== capacity(mode)) return null
  const dateDigits = mode === 'time' ? '' : digits.slice(0, 8)
  const timeDigits = mode === 'date' ? '' : digits.slice(mode === 'time' ? 0 : 8)

  let date = ''
  if (dateDigits) {
    const day = Number(dateDigits.slice(0, 2))
    const month = Number(dateDigits.slice(2, 4))
    const year = Number(dateDigits.slice(4, 8))
    const probe = new Date(Date.UTC(year, month - 1, day))
    const real =
      year >= 1000 &&
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day
    if (!real) return null
    date = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
  }

  let time = ''
  if (timeDigits) {
    const hours = Number(timeDigits.slice(0, 2))
    const minutes = Number(timeDigits.slice(2, 4))
    if (hours > 23 || minutes > 59) return null
    time = `${pad(hours, 2)}:${pad(minutes, 2)}`
  }

  return mode === 'date' ? date : mode === 'time' ? time : `${date}T${time}`
}

const PATTERNS: Record<DateFieldMode, RegExp> = {
  date: /^(\d{4})-(\d{2})-(\d{2})/,
  time: /^(\d{2}):(\d{2})/,
  datetime: /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/,
}

export function normalizeFieldValue(value: string | null | undefined, mode: DateFieldMode): string {
  const match = PATTERNS[mode].exec(value ?? '')
  if (!match) return ''
  if (mode === 'date') return `${match[1]}-${match[2]}-${match[3]}`
  if (mode === 'time') return `${match[1]}:${match[2]}`
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`
}

export function formatFieldValue(value: string | null | undefined, mode: DateFieldMode): string {
  const normalized = normalizeFieldValue(value, mode)
  if (!normalized) return ''
  const [datePart = '', timePart = ''] = mode === 'time' ? ['', normalized] : normalized.split('T')
  const date = datePart.split('-').reverse().join('.')
  if (mode === 'date') return date
  return mode === 'time' ? timePart : `${date} ${timePart}`
}

export function fromPickerValue(picked: string | null | undefined, mode: DateFieldMode): string {
  if (!picked) return ''
  const source = mode === 'time' && picked.includes('T') ? picked.split('T')[1] : picked
  return normalizeFieldValue(source, mode)
}

export function currentFieldValue(mode: DateFieldMode, now: Date = new Date()): string {
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => pad(part, index ? 2 : 4))
    .join('-')
  const time = `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}`
  if (mode === 'date') return date
  return mode === 'time' ? time : `${date}T${time}`
}

export function dayFieldValue(
  mode: 'date' | 'datetime',
  offsetDays: number,
  keepTimeOf: string,
  now: Date = new Date(),
): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, now.getHours(), now.getMinutes())
  const target = currentFieldValue('datetime', day)
  if (mode === 'date') return target.slice(0, 10)
  const kept = normalizeFieldValue(keepTimeOf, 'datetime')
  return kept ? `${target.slice(0, 10)}${kept.slice(10)}` : target
}

export function clampFieldValue(
  value: string,
  min: string | null | undefined,
  max: string | null | undefined,
  mode: DateFieldMode,
): string {
  const floor = normalizeFieldValue(min, mode)
  const ceiling = normalizeFieldValue(max, mode)
  if (floor && value < floor) return floor
  if (ceiling && value > ceiling) return ceiling
  return value
}
