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
    const item = location({ address: null, address_id: null, spot: { lat: 55.7, lon: 37.6 } })

    expect(resultSubtitle({ kind: 'location', item })).toBe('Точка на карте')
  })

  test('a location with neither an address nor a point is an address written as text', () => {
    const item = location({ address: null, address_id: null })

    expect(resultSubtitle({ kind: 'location', item })).toBe('Адрес текстом')
    expect(resultMarker({ kind: 'location', item })).toBeNull()
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

  test('places given as recent are listed first, in their order, and the general list is not asked', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [location({ id: 'general' })] } }))
    const recent = vi.fn(async () => [location({ id: 'r2' }), location({ id: 'r1' })])
    const { api, wrapper } = host({ limit: 8, recent })

    api.refresh()
    await vi.runAllTimersAsync()

    expect(api.results.value.map((r) => r.item.id)).toEqual(['r2', 'r1'])
    expect(api.showingRecent.value).toBe(true)
    expect(backend.calls).toHaveLength(0)
    wrapper.unmount()
  })

  test('with no recent places the general list of locations is listed as before', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [location()] } }))
    const { api, wrapper } = host({ limit: 8, recent: async () => [] })

    api.refresh()
    await vi.runAllTimersAsync()

    expect(api.results.value.map((r) => r.item.id)).toEqual(['l1'])
    expect(api.showingRecent.value).toBe(false)
    wrapper.unmount()
  })

  test('a recent list that cannot be read falls back to the general one', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [location()] } }))
    const { api, wrapper } = host({ recent: () => Promise.reject(new Error('down')) })

    api.refresh()
    await vi.runAllTimersAsync()

    expect(api.results.value.map((r) => r.item.id)).toEqual(['l1'])
    expect(api.showingRecent.value).toBe(false)
    wrapper.unmount()
  })

  test('typing or a point ends the recent list, and clearing starts it again', async () => {
    backend = stubBackend((config) =>
      config.url === '/geo/v2/search'
        ? { status: 200, data: { items: [], external: { state: 'skipped' }, place: null } }
        : { status: 200, data: { items: [] } },
    )
    const { api, wrapper } = host({ recent: async () => [location({ id: 'r1' })] })
    api.refresh()
    await vi.runAllTimersAsync()
    expect(api.showingRecent.value).toBe(true)

    api.near.value = { lat: 55.75, lon: 37.6 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(api.showingRecent.value).toBe(false)

    api.clear()
    api.refresh()
    await vi.runAllTimersAsync()
    expect(api.showingRecent.value).toBe(true)
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

  test('a point alone is only looked up in the stored places, the outside geocoder is not asked', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [], external: { state: 'skipped' } } }))
    const { api, wrapper } = host()

    api.near.value = { lat: 55.75, lon: 37.6 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(backend.calls[0]!.params.external).toBe('off')
    wrapper.unmount()
  })

  test('a point the user marked, and any typed text, may be completed from outside', async () => {
    backend = stubBackend(() => ({ status: 200, data: { items: [], external: { state: 'skipped' } } }))
    const { api, wrapper } = host()

    api.marked.value = true
    api.near.value = { lat: 55.75, lon: 37.6 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    api.clear()
    api.near.value = { lat: 55.76, lon: 37.6 }
    api.query.value = 'тверская'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    api.query.value = ''
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(backend.calls.map((call) => call.params.external)).toEqual([undefined, undefined, 'off'])
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
