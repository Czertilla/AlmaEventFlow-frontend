import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import TimestampsMeta from '@/components/common/TimestampsMeta.vue'
import { formatDateTime } from '@/utils/date'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'

describe('formatDateTime', () => {
  test('formats an ISO timestamp as date and time', () => {
    expect(formatDateTime('2026-01-02T03:04:00')).toBe('02.01.2026 03:04')
  })

  test('renders nothing for missing or invalid values', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('not a date')).toBe('')
  })
})

describe('TimestampsMeta', () => {
  test('shows both moments when the row was edited', () => {
    const text = mount(TimestampsMeta, {
      props: { createdAt: '2026-01-02T03:04:00', editedAt: '2026-02-03T04:05:00' },
    }).text()

    expect(text).toContain('Создано 02.01.2026 03:04')
    expect(text).toContain('Изменено 03.02.2026 04:05')
  })

  test('says the row was never edited', () => {
    const text = mount(TimestampsMeta, { props: { createdAt: '2026-01-02T03:04:00' } }).text()

    expect(text).toContain('Не изменялось')
  })

  test('renders nothing without a creation time', () => {
    expect(mount(TimestampsMeta, { props: {} }).html()).toBe('<!--v-if-->')
  })
})

describe('timestamp list options', () => {
  test('sort and range filters use the backend field names', () => {
    expect(TIMESTAMP_SORT_OPTIONS.map((o) => o.value)).toEqual(['created_at', 'edited_at'])
    expect(TIMESTAMP_FILTERS.map((f) => f.key)).toEqual([
      'created_at__gte',
      'created_at__lte',
      'edited_at__gte',
      'edited_at__lte',
    ])
  })
})
