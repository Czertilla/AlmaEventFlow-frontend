import { describe, expect, test } from 'vitest'
import {
  applyFieldInput,
  caretAfterDigits,
  clampFieldValue,
  currentFieldValue,
  dayFieldValue,
  formatFieldValue,
  fromPickerValue,
  maskDigits,
  normalizeFieldValue,
  parseFieldText,
} from '@/utils/dateField'

describe('maskDigits', () => {
  test.each([
    ['1', 'date', '1'],
    ['12', 'date', '12'],
    ['123', 'date', '12.3'],
    ['12032026', 'date', '12.03.2026'],
    ['12.03.2026 extra 99', 'date', '12.03.2026'],
    ['ab', 'date', ''],
    ['1230', 'time', '12:30'],
    ['123', 'time', '12:3'],
    ['120320261530', 'datetime', '12.03.2026 15:30'],
    ['12032026153', 'datetime', '12.03.2026 15:3'],
  ] as const)('%s (%s) -> %s', (raw, mode, expected) => {
    expect(maskDigits(raw, mode)).toBe(expected)
  })
})

describe('parseFieldText', () => {
  test.each([
    ['12.03.2026', 'date', '2026-03-12'],
    ['29.02.2024', 'date', '2024-02-29'],
    ['15:30', 'time', '15:30'],
    ['12.03.2026 15:30', 'datetime', '2026-03-12T15:30'],
  ] as const)('%s (%s) -> %s', (text, mode, expected) => {
    expect(parseFieldText(text, mode)).toBe(expected)
  })

  test.each([
    ['31.02.2026', 'date'],
    ['29.02.2025', 'date'],
    ['00.01.2026', 'date'],
    ['12.13.2026', 'date'],
    ['12.03.0026', 'date'],
    ['12.03.20', 'date'],
    ['24:00', 'time'],
    ['12:60', 'time'],
    ['12.03.2026 25:00', 'datetime'],
    ['', 'date'],
  ] as const)('%s (%s) is rejected', (text, mode) => {
    expect(parseFieldText(text, mode)).toBeNull()
  })
})

describe('formatFieldValue', () => {
  test.each([
    ['2026-03-12', 'date', '12.03.2026'],
    ['2026-03-12T00:00:00', 'date', '12.03.2026'],
    ['15:30', 'time', '15:30'],
    ['15:30:45', 'time', '15:30'],
    ['2026-03-12T15:30', 'datetime', '12.03.2026 15:30'],
    ['2026-03-12T15:30:00+03:00', 'datetime', '12.03.2026 15:30'],
    ['', 'date', ''],
    [null, 'datetime', ''],
    ['nonsense', 'time', ''],
  ] as const)('%s (%s) -> %s', (value, mode, expected) => {
    expect(formatFieldValue(value, mode)).toBe(expected)
  })

  test('formatting then parsing returns the normalised value', () => {
    for (const mode of ['date', 'time', 'datetime'] as const) {
      const value = { date: '2026-03-12', time: '07:05', datetime: '2026-03-12T07:05' }[mode]
      expect(parseFieldText(formatFieldValue(value, mode), mode)).toBe(value)
    }
  })
})

describe('normalizeFieldValue / fromPickerValue', () => {
  test('keeps the model formats of the native inputs', () => {
    expect(normalizeFieldValue('2026-03-12T15:30:00', 'datetime')).toBe('2026-03-12T15:30')
    expect(normalizeFieldValue('2026-03-12 15:30', 'datetime')).toBe('2026-03-12T15:30')
    expect(normalizeFieldValue('2026-03-12', 'datetime')).toBe('')
  })

  test.each([
    ['2026-03-12T00:00:00', 'date', '2026-03-12'],
    ['2026-03-12T15:30:00', 'datetime', '2026-03-12T15:30'],
    ['2026-03-12T15:30:00', 'time', '15:30'],
    ['15:30', 'time', '15:30'],
    [undefined, 'date', ''],
    [null, 'datetime', ''],
  ] as const)('picker value %s (%s) -> %s', (picked, mode, expected) => {
    expect(fromPickerValue(picked, mode)).toBe(expected)
  })
})

describe('caretAfterDigits', () => {
  test('puts the caret right after the n-th digit', () => {
    expect(caretAfterDigits('12.03.2026', 0)).toBe(0)
    expect(caretAfterDigits('12.03.2026', 2)).toBe(2)
    expect(caretAfterDigits('12.03.2026', 3)).toBe(4)
    expect(caretAfterDigits('12.03.2026', 99)).toBe(10)
  })
})

describe('applyFieldInput', () => {
  test('typing appends digits and inserts the separators', () => {
    expect(applyFieldInput('12', '123', 3, 'insertText', 'date')).toEqual({ text: '12.3', caret: 4 })
    expect(applyFieldInput('12.03', '12.034', 6, 'insertText', 'date')).toEqual({
      text: '12.03.4',
      caret: 7,
    })
  })

  test('letters and pasted junk are dropped', () => {
    expect(applyFieldInput('12', '12x', 3, 'insertText', 'date')).toEqual({ text: '12', caret: 2 })
    expect(applyFieldInput('', '12/03/2026', 10, 'insertFromPaste', 'date').text).toBe('12.03.2026')
  })

  test('backspace over a separator removes the digit before it', () => {
    expect(applyFieldInput('12.03', '1203', 2, 'deleteContentBackward', 'date')).toEqual({
      text: '10.3',
      caret: 1,
    })
  })

  test('backspace over a digit just deletes it', () => {
    expect(applyFieldInput('12.03', '12.0', 4, 'deleteContentBackward', 'date')).toEqual({
      text: '12.0',
      caret: 4,
    })
  })

  test('an edit in the middle keeps the caret next to the edited digit', () => {
    expect(applyFieldInput('12.03.2026', '12.093.2026', 5, 'insertText', 'date')).toEqual({
      text: '12.09.3202',
      caret: 5,
    })
  })

  test('time and datetime masks', () => {
    expect(applyFieldInput('15', '153', 3, 'insertText', 'time').text).toBe('15:3')
    expect(applyFieldInput('', '120320261530', 12, 'insertFromPaste', 'datetime').text).toBe(
      '12.03.2026 15:30',
    )
  })
})

describe('currentFieldValue', () => {
  const now = new Date(2026, 2, 5, 7, 4)

  test('uses the model formats of each mode', () => {
    expect(currentFieldValue('date', now)).toBe('2026-03-05')
    expect(currentFieldValue('time', now)).toBe('07:04')
    expect(currentFieldValue('datetime', now)).toBe('2026-03-05T07:04')
  })
})

describe('dayFieldValue', () => {
  const now = new Date(2026, 2, 31, 7, 4)

  test('a date offset rolls over the month', () => {
    expect(dayFieldValue('date', 0, '', now)).toBe('2026-03-31')
    expect(dayFieldValue('date', 1, '', now)).toBe('2026-04-01')
  })

  test('a datetime keeps the time of the value it replaces', () => {
    expect(dayFieldValue('datetime', 1, '2026-01-01T18:45', now)).toBe('2026-04-01T18:45')
  })

  test('a datetime without a time to keep takes the current one', () => {
    expect(dayFieldValue('datetime', 1, '', now)).toBe('2026-04-01T07:04')
  })
})

describe('clampFieldValue', () => {
  test('keeps a value inside the bounds', () => {
    expect(clampFieldValue('2026-03-12T12:00', '2026-03-12T10:00', '2026-03-12T14:00', 'datetime')).toBe(
      '2026-03-12T12:00',
    )
  })

  test('raises a value below min to min and lowers one above max to max', () => {
    expect(clampFieldValue('2026-03-12T09:00', '2026-03-12T10:00', '', 'datetime')).toBe('2026-03-12T10:00')
    expect(clampFieldValue('2026-03-12T15:00', '', '2026-03-12T14:00', 'datetime')).toBe('2026-03-12T14:00')
  })

  test('compares in the format of the mode and ignores empty or malformed bounds', () => {
    expect(clampFieldValue('2026-03-01', '2026-03-12T10:00', null, 'date')).toBe('2026-03-12')
    expect(clampFieldValue('07:00', 'nonsense', undefined, 'time')).toBe('07:00')
  })
})
