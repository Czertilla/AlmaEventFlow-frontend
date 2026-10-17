import { describe, expect, test } from 'vitest'
import { buildSearchProviders } from '@/composables/useMapLinks'
import { locationSearchText } from '@/composables/useGeoSearch'
import { isAddressOnly, isTextOnly, locationKindParams } from '@/utils/geo'
import type { LocationRead } from '@/api/generated/almaEventFlow'

const ADDRESS = { id: 'a1', name: 'Тверская улица, 7', locality: 'Москва, Россия' }

function location(overrides: Record<string, unknown> = {}): LocationRead {
  return { id: 'l1', name: null, address_id: null, address: null, spot: null, ...overrides } as LocationRead
}

describe('what kind of location it is', () => {
  test('a location with an address and no name only stands for that address', () => {
    const item = location({ address_id: 'a1', address: ADDRESS })

    expect([isAddressOnly(item), isTextOnly(item)]).toEqual([true, false])
  })

  test('a name alone is an address written as text', () => {
    const item = location({ name: 'ул. Пушкина, 10, Казань' })

    expect([isAddressOnly(item), isTextOnly(item)]).toEqual([false, true])
  })

  test.each([
    ['a named location at an address', { name: 'Актовый зал', address_id: 'a1', address: ADDRESS }],
    ['a named point', { name: 'Двор', spot: { lat: 55.7, lon: 37.6 } }],
    ['a point without a name', { spot: { lat: 55.7, lon: 37.6 } }],
  ])('%s is neither', (_, fields) => {
    const item = location(fields)

    expect([isAddressOnly(item), isTextOnly(item)]).toEqual([false, false])
  })
})

describe('what the list of locations asks for', () => {
  test('the nameless address-only ones are left out unless asked for', () => {
    expect(locationKindParams(undefined)).toEqual({ name__isnull: false })
    expect(locationKindParams('')).toEqual({ name__isnull: false })
    expect(locationKindParams('named')).toEqual({ name__isnull: false })
    expect(locationKindParams('address')).toEqual({ name__isnull: true })
    expect(locationKindParams('all')).toEqual({})
  })
})

describe('looking a place up in a map service by its text', () => {
  test('a location with coordinates needs no text search', () => {
    expect(locationSearchText(location({ name: 'Двор', spot: { lat: 55.7, lon: 37.6 } }))).toBeNull()
    expect(locationSearchText(location({ address_id: 'a1', address: { ...ADDRESS, spot: { lat: 55.7, lon: 37.6 } } }))).toBeNull()
  })

  test('without coordinates the address, with its city, is the query', () => {
    expect(locationSearchText(location({ address_id: 'a1', address: ADDRESS }))).toBe(
      'Тверская улица, 7, Москва, Россия',
    )
  })

  test('without an address the text itself is the query', () => {
    expect(locationSearchText(location({ name: ' ул. Пушкина, 10 ' }))).toBe('ул. Пушкина, 10')
    expect(locationSearchText(location())).toBeNull()
  })

  test('every service gets the text as a search, escaped', () => {
    const urls = buildSearchProviders('ул. Пушкина, 10 & 2').map((provider) => provider.url)

    expect(urls).toEqual(
      expect.arrayContaining([
        'https://yandex.ru/maps/?text=%D1%83%D0%BB.%20%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD%D0%B0%2C%2010%20%26%202',
      ]),
    )
    expect(urls.length).toBeGreaterThanOrEqual(4)
    for (const url of urls) {
      expect(url).toContain('%26')
      expect(url).not.toContain(' ')
    }
  })
})
