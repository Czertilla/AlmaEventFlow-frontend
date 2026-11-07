import { describe, expect, it } from 'vitest'
import type { AccessExportRead } from '@/api/generated/almaEventFlow'
import { exportTable, expiresAfter, formatExportValue, grantCounts, toCsv } from '@/utils/dataAccess'

const EXPORTED: AccessExportRead = {
  request_id: 'r',
  exported_at: '2026-11-03T10:00:00Z',
  fields: [
    { key: 'passport.number', label: 'Номер паспорта' },
    { key: 'passport.expire_date', label: 'Срок действия паспорта' },
    { key: 'name_variant.fullname', label: 'Вариант ФИО из паспорта' },
    { key: 'student.study_terms', label: 'Условия обучения' },
  ],
  subjects: [
    {
      person_id: 'a',
      records: [
        { 'student.study_terms': { is_budget: true, is_full: false } },
        {
          'passport.number': '4510 246813',
          'passport.expire_date': '2031-02-03',
          'name_variant.fullname': { surname: 'Ivanova', name: 'Anna', patronymic: null },
        },
        { 'passport.number': '72 1234567', 'passport.expire_date': '2029-01-01' },
      ],
    },
    { person_id: 'b', records: [] },
  ],
  skipped: [{ person_id: 'c', status: 'pending' }],
}

describe('formatExportValue', () => {
  it('shows dates, flags and the parts of a name the way a person reads them', () => {
    expect(formatExportValue('2031-02-03')).toBe('03.02.2031')
    expect(formatExportValue(true)).toBe('да')
    expect(formatExportValue(null)).toBe('')
    expect(formatExportValue({ surname: 'Ivanova', name: 'Anna', patronymic: null })).toBe('Ivanova Anna')
    expect(formatExportValue({ is_budget: true, is_full: false })).toBe('is_budget: да, is_full: нет')
  })
})

describe('exportTable', () => {
  it('puts every member on one row and keeps the passports in the same order in each column', () => {
    const table = exportTable(EXPORTED, new Map([['a', 'Иванова Анна'], ['b', null]]))

    expect(table.header).toEqual(['ФИО', 'Номер паспорта', 'Срок действия паспорта', 'Вариант ФИО из паспорта', 'Условия обучения'])
    expect(table.rows).toEqual([
      ['Иванова Анна', '4510 246813; 72 1234567', '03.02.2031; 01.01.2029', 'Ivanova Anna', 'is_budget: да, is_full: нет'],
      ['', '', '', '', ''],
    ])
  })
})

describe('toCsv', () => {
  it('quotes separators and defuses what a spreadsheet would run as a formula', () => {
    const csv = toCsv({
      header: ['a', 'b'],
      rows: [['=HYPERLINK("x")', '+7 900 000-00-00'], ['x;y', '-cmd|calc']],
    })

    expect(csv.startsWith('\ufeff')).toBe(true)
    expect(csv).toBe('\ufeffa;b\r\n"\'=HYPERLINK(""x"")";+7 900 000-00-00\r\n"x;y";\'-cmd|calc\r\n')
  })
})

describe('grantCounts and expiresAfter', () => {
  it('counts the answers and sets the term from now', () => {
    expect(grantCounts([{ person_id: 'a', status: 'active' }, { person_id: 'b', status: 'active' }, { person_id: 'c', status: 'pending' }])).toEqual({
      pending: 1,
      active: 2,
      declined: 0,
      revoked: 0,
      expired: 0,
    })
    expect(expiresAfter(7, new Date('2026-11-03T10:00:00Z'))).toBe('2026-11-10T10:00:00.000Z')
  })
})
