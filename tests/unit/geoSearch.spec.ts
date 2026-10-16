import axios from 'axios'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import {
  addressLocality,
  resultMarker,
  resultSubtitle,
  useGeoSearch,
} from '@/composables/useGeoSearch'
import type { GeoResult } from '@/composables/useGeoSearch'
import { stubBackend } from './helpers/axiosStub'

function address(overrides: Record<string, unknown> = {}): AddressRead {
  return {
    id: 'a1',
    city_id: 1,
    name: 'Тверская улица, 7',
    created_at: '2026-10-01T00:00:00Z',
    edited_at: null,
    map_uri: null,
    spot: { lat: 55.7583, lon: 37.6116 },
    ...overrides,
  } as AddressRead
}

function location(overrides: Record<string, unknown> = {}): LocationRead {
  return {
    id: 'l1',
    name: 'Актовый зал',
    address_id: 'a1',
    address: address({ locality: 'Москва, Россия' }),
    created_at: '2026-10-01T00:00:00Z',
    edited_at: null,
    map_uri: null,
    display_name: 'Актовый зал',
    ...overrides,
  } as LocationRead
}

describe('what a suggestion says under its title', () => {
  test('an address names its city', () => {
    const result: GeoResult = { kind: 'address', item: address({ locality: 'Казань, Республика Татарстан, Россия' }) }

    expect(resultSubtitle(result)).toBe('Адрес · Казань, Республика Татарстан, Россия')
  })

  test('an address without a city line stays a plain address', () => {
    expect(resultSubtitle({ kind: 'address', item: address() })).toBe('Адрес')
    expect(resultSubtitle({ kind: 'address', item: address({ locality: '  ' }) })).toBe('Адрес')
  })

  test('a named location shows its address and the city', () => {
    expect(resultSubtitle({ kind: 'location', item: location() })).toBe('Тверская улица, 7 · Москва, Россия')
  })

  test('an address-only location is an address with a city', () => {
    const item = location({ name: null })

    expect(resultSubtitle({ kind: 'location', item })).toBe('Адрес · Москва, Россия')
  })

  test('a location without an address is a point', () => {
    expect(resultSubtitle({ kind: 'location', item: location({ address: null, address_id: null }) })).toBe(
      'Точка на карте',
    )
  })

  test('the locality is read from whatever carries it', () => {
    expect(addressLocality(address({ locality: ' Москва, Россия ' }))).toBe('Москва, Россия')
    expect(addressLocality(address())).toBe('')
    expect(addressLocality(null)).toBe('')
  })

  test('an address marker carries the city for its popup', () => {
    const marker = resultMarker({ kind: 'address', item: address({ locality: 'Москва, Россия' }) })

    expect(marker).toMatchObject({ kind: 'address', label: 'Тверская улица, 7', sublabel: 'Москва, Россия' })
  })
})

describe('useGeoSearch', () => {
  let backend: ReturnType<typeof stubBackend>

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    backend.restore()
    vi.useRealTimers()
  })

  function host(options: Parameters<typeof useGeoSearch>[0] = {}) {
    let api!: ReturnType<typeof useGeoSearch>
    const wrapper = mount(
      defineComponent({
        setup() {
          api = useGeoSearch(options)
          return () => h('div')
        },
      }),
    )
    return { api, wrapper }
  }

  test('with nothing typed and no point it lists the curated locations from v1', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [location()] } }))
    const { api, wrapper } = host({ limit: 8 })

    api.refresh()
    await vi.runAllTimersAsync()

    expect(backend.calls.map((call) => call.url)).toEqual(['/geo/v1/locations'])
    expect(backend.calls[0]!.params).toMatchObject({ limit: 8, name__isnull: false })
    expect(api.results.value.map((r) => [r.kind, r.item.id])).toEqual([['location', 'l1']])
    wrapper.unmount()
  })

  test('typed text goes to the ranked v2 search, which carries the city', async () => {
    backend = stubBackend(() => ({
      status: 200,
      data: {
        items: [
          { kind: 'address', origin: 'external', score: null, address: address({ locality: 'Москва, Россия' }) },
          { kind: 'location', origin: 'local', score: 1.2, location: location() },
        ],
        external: { state: 'ok', provider: 'photon' },
      },
    }))
    const { api, wrapper } = host({ limit: 30, namedLocationsOnly: false })

    api.query.value = 'тверская 7'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(backend.calls.map((call) => call.url)).toEqual(['/geo/v2/search'])
    expect(backend.calls[0]!.params).toMatchObject({
      q: 'тверская 7',
      limit: 30,
      named_locations_only: false,
    })
    expect(api.results.value.map((r) => resultSubtitle(r))).toEqual([
      'Адрес · Москва, Россия',
      'Тверская улица, 7 · Москва, Россия',
    ])
    expect(api.markers.value.map((m) => m.kind)).toEqual(['address', 'location'])
    wrapper.unmount()
  })

  test('a point without text is a v2 search around that point', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [], external: { state: 'skipped' } } }))
    const { api, wrapper } = host()

    api.near.value = { lat: 55.75, lon: 37.6 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(backend.calls.map((call) => call.url)).toEqual(['/geo/v2/search'])
    expect(backend.calls[0]!.params).toMatchObject({ lat: 55.75, lon: 37.6 })
    expect(backend.calls[0]!.params.q).toBeUndefined()
    wrapper.unmount()
  })

  test('a failed search leaves an empty list, not an error', async () => {
    backend = stubBackend(() => ({ status: 503 }))
    const { api, wrapper } = host()

    api.query.value = 'тверская'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(api.results.value).toEqual([])
    expect(api.searching.value).toBe(false)
    wrapper.unmount()
  })

  test('an array parameter is sent the way FastAPI reads it', () => {
    const uri = axios.getUri({
      url: '/geo/v2/search',
      params: { q: 'тверская', kinds: ['address'] },
      paramsSerializer: { indexes: null },
    })

    expect(uri).toContain('kinds=address')
    expect(uri).not.toContain('kinds[]')
  })
})
