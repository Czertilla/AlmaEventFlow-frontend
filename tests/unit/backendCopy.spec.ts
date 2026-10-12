import { describe, expect, test } from 'vitest'
import { backendCopy } from '@/utils/backendCopy'

describe('backendCopy', () => {
  test('says maintenance for planned work and tells the session is kept', () => {
    const copy = backendCopy('maintenance')

    expect(copy.icon).toBe('maintenance')
    expect(copy.title).toBe('Проводятся технические работы')
    expect(copy.banner).toContain('Вход сохранён')
  })

  test('sends the user to support for an outage the proxy reports', () => {
    const copy = backendCopy('unavailable')

    expect(copy.title).toBe('Сервер недоступен по техническим причинам')
    expect(copy.text).toContain('обратитесь в поддержку')
  })

  test.each([undefined, null])('falls back to a plain lost connection for %s', (reason) => {
    const copy = backendCopy(reason)

    expect(copy.title).toBe('Сервер недоступен')
    expect(copy.banner).toContain('Нет связи с сервером')
    expect(copy.icon).toBe('offline')
  })
})
