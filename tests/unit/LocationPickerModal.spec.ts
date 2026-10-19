import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import LocationPickerModal from '@/components/geo/LocationPickerModal.vue'
import { forgetResolved } from '@/composables/useLocationResolver'
import axios from 'axios'
import { stubBackend } from './helpers/axiosStub'

const Passthrough = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

const GeoMapStub = defineComponent({
  name: 'GeoMap',
  props: { center: Object, markers: Array, pickedPoint: Object, pickable: Boolean, fit: Boolean },
  emits: ['pick', 'marker-click', 'marker-create', 'interact', 'bbox'],
  setup(props, { expose }) {
    expose({ invalidateSize: () => undefined, refit: () => undefined })
    return () =>
      h('div', {
        class: 'map-stub',
        'data-fit': String(props.fit),
        'data-center': JSON.stringify(props.center ?? null),
        'data-markers': JSON.stringify(props.markers),
      })
  },
})

const CreateFormStub = defineComponent({
  name: 'LocationCreateForm',
  props: { draft: Object },
  setup: (props) => () => h('div', { class: 'create-stub', 'data-draft': JSON.stringify(props.draft) }),
})

const ADDRESS = {
  id: 'a1',
  city_id: 1,
  name: 'Тверская улица, 7',
  locality: 'Москва, Россия',
  spot: { lat: 55.7583, lon: 37.6116 },
}
const NAMED = { id: 'l1', name: 'Актовый зал', address_id: 'a1', address: ADDRESS, display_name: 'Актовый зал' }
const TEXT_LOCATION = { id: 'l3', name: 'ул. Пушкина, 10, Казань', address_id: null, address: null, spot: null }
const PROXY = { id: 'l2', name: null, address_id: 'a1', address: ADDRESS, display_name: 'Тверская улица, 7' }

const axiosUri = (config: Parameters<typeof axios.getUri>[0]) => axios.getUri(config)

let backend: ReturnType<typeof stubBackend>
const mounted: ReturnType<typeof mount>[] = []

const posts = () => backend.calls.filter((call) => call.method === 'post')

const HITS = [
  { kind: 'location', origin: 'local', score: 2, location: NAMED },
  { kind: 'address', origin: 'external', score: null, address: ADDRESS },
]

const RECENT_IDS = [{ location_id: 'l2', used_at: '2026-03-01T10:00:00Z' }, { location_id: 'l1', used_at: '2026-02-01T10:00:00Z' }]

async function openModal(
  items: unknown[] = HITS,
  seed = 'тверская 7',
  place: unknown = null,
  extra: Record<string, unknown> = {},
  recent: unknown[] = RECENT_IDS,
) {
  backend.restore()
  backend = stubBackend((config) => {
    if (config.url?.endsWith('/recent-locations')) return { status: 200, data: recent }
    if (config.url === '/geo/v2/locations' && config.method === 'get') {
      return { status: 200, data: [PROXY, NAMED] }
    }
    if (config.url === '/geo/v2/search') {
      return { status: 200, data: { items, external: { state: 'ok', provider: 'photon' }, place } }
    }
    if (config.url === '/geo/v1/locations/from-address') return { status: 201, data: PROXY }
    if (config.url === '/geo/v2/locations') return { status: 200, data: TEXT_LOCATION }
    return { status: 200, data: { items: [] } }
  })
  const wrapper = mount(LocationPickerModal, {
    props: { open: false, selected: null, seedQuery: '', draft: null, ...extra },
    attachTo: document.body,
    global: {
      stubs: {
        IonModal: Passthrough,
        IonHeader: Passthrough,
        IonToolbar: Passthrough,
        IonTitle: Passthrough,
        IonButtons: Passthrough,
        IonButton: Passthrough,
        IonContent: Passthrough,
        IonIcon: true,
        IonSpinner: true,
        GeoMap: GeoMapStub,
        LocationCreateForm: CreateFormStub,
      },
    },
  })
  mounted.push(wrapper)
  await wrapper.setProps({ open: true, seedQuery: seed })
  await flushPromises()
  return wrapper
}

const addressRow = (wrapper: Awaited<ReturnType<typeof openModal>>) =>
  wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')[1]!

beforeEach(() => {
  vi.useFakeTimers()
  backend = stubBackend(() => ({ status: 200, data: { items: [] } }))
})

afterEach(() => {
  forgetResolved()
  backend.restore()
  vi.useRealTimers()
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('LocationPickerModal address choice', () => {
  test('the suggestions name the city of an address', async () => {
    const wrapper = await openModal()

    const subs = wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text) .grl-sub').map((sub) => sub.text())
    expect(subs).toEqual(['Тверская улица, 7 · Москва, Россия', 'Адрес · Москва, Россия'])
  })

  test('clicking an address shows its actions and creates nothing', async () => {
    const wrapper = await openModal()

    await addressRow(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.get('.pm-card--address .aac-title').text()).toBe('Тверская улица, 7')
    expect(wrapper.get('.pm-card--address .aac-sub').text()).toBe('Москва, Россия')
    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(wrapper.find('.pm-panel').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('.map-stub').attributes('data-center')!)).toEqual({ lat: 55.7583, lon: 37.6116 })
  })

  test('"Выбрать адрес" makes it the location and closes the window', async () => {
    const wrapper = await openModal()
    await addressRow(wrapper).trigger('click')

    await wrapper.findAll('.aac-actions button')[1]!.trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(1)
    expect(JSON.parse(posts()[0]!.data)).toEqual({ address_id: 'a1', name: null })
    expect(wrapper.emitted('select')).toEqual([[PROXY]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  test('"Создать локацию" opens the form on the address and creates nothing', async () => {
    const wrapper = await openModal()
    await addressRow(wrapper).trigger('click')

    await wrapper.findAll('.aac-actions button')[0]!.trigger('click')
    await flushPromises()

    expect(JSON.parse(wrapper.get('.create-stub').attributes('data-draft')!).address.id).toBe('a1')
    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  test('a named location is chosen by one click', async () => {
    const wrapper = await openModal()

    await wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('select')).toEqual([[NAMED]])
    expect(posts()).toHaveLength(0)
  })

  test('choosing the address on a map marker only selects it too', async () => {
    const wrapper = await openModal()

    wrapper.getComponent(GeoMapStub).vm.$emit('marker-click', {
      id: 'a1',
      kind: 'address',
      lat: 55.7583,
      lon: 37.6116,
    })
    await flushPromises()

    expect(wrapper.find('.pm-card--address').exists()).toBe(true)
    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  test('the marker popup of an address shows its city', async () => {
    const wrapper = await openModal()

    const markers = JSON.parse(wrapper.get('.map-stub').attributes('data-markers')!)
    expect(markers.find((m: { kind: string }) => m.kind === 'address')).toMatchObject({
      label: 'Тверская улица, 7',
      sublabel: 'Москва, Россия',
    })
  })

  test('Enter on a suggestion that is an address selects it, it does not create a location', async () => {
    const wrapper = await openModal([{ kind: 'address', origin: 'local', score: 1, address: ADDRESS }])

    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.find('.pm-card--address').exists()).toBe(true)
    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  test('a point picked on the map replaces the chosen address', async () => {
    const wrapper = await openModal()
    await addressRow(wrapper).trigger('click')

    wrapper.getComponent(GeoMapStub).vm.$emit('pick', { lat: 55.76, lon: 37.62 })
    await flushPromises()

    expect(wrapper.find('.pm-card--address').exists()).toBe(false)
    expect(wrapper.text()).toContain('Точка на карте')
  })

  test('cancelling the address leaves the window as it was', async () => {
    const wrapper = await openModal()
    await addressRow(wrapper).trigger('click')

    await wrapper.get('button[aria-label="Отменить выбор адреса"]').trigger('click')

    expect(wrapper.find('.pm-card--address').exists()).toBe(false)
    expect(posts()).toHaveLength(0)
  })

  test('reopening the window forgets the previous address', async () => {
    const wrapper = await openModal()
    await addressRow(wrapper).trigger('click')

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.find('.pm-card--address').exists()).toBe(false)
  })
})


const BOX_AROUND = (lat: number, lon: number) => ({
  minLat: lat - 0.01,
  maxLat: lat + 0.01,
  minLon: lon - 0.02,
  maxLon: lon + 0.02,
})

async function moveMap(wrapper: Awaited<ReturnType<typeof openModal>>, lat: number, lon: number) {
  wrapper.getComponent(GeoMapStub).vm.$emit('interact')
  wrapper.getComponent(GeoMapStub).vm.$emit('bbox', BOX_AROUND(lat, lon))
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  await wrapper.get('input').trigger('focus')
}

const searches = () => backend.to('/geo/v2/search')
const lastSearch = () => searches().at(-1)!.params as Record<string, unknown>

describe('LocationPickerModal around the map', () => {
  test('lists the places around the centre of the map once it reports where it is', async () => {
    const wrapper = await openModal(HITS, '')
    expect(searches()).toHaveLength(0)

    await moveMap(wrapper, 55.75, 37.6)

    expect(searches()).toHaveLength(1)
    expect(lastSearch()).toMatchObject({ lat: 55.75, lon: 37.6, limit: 30 })
    expect(lastSearch().q).toBeUndefined()
    expect(wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')).toHaveLength(2)
  })

  test('shows how far each place is from that centre', async () => {
    const wrapper = await openModal(HITS, '')

    await moveMap(wrapper, 55.7583, 37.6116)

    const distances = wrapper.findAll('.grl-dist').map((node) => node.text())
    expect(distances).toHaveLength(2)
    expect(distances.every((text) => /^\d+ м$/.test(text))).toBe(true)
  })

  test('a short pan does not ask again, a long one does', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)

    await moveMap(wrapper, 55.75005, 37.6)
    expect(searches()).toHaveLength(1)

    await moveMap(wrapper, 55.76, 37.6)
    expect(searches()).toHaveLength(2)
    expect(lastSearch()).toMatchObject({ lat: 55.76, lon: 37.6 })
  })

  test('a typed text keeps its bias while the map moves on', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)

    await wrapper.get('input').setValue('суздаль')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    await moveMap(wrapper, 56.5, 40.4)

    expect(searches()).toHaveLength(2)
    expect(lastSearch()).toMatchObject({ q: 'суздаль', lat: 55.75, lon: 37.6 })
    expect(wrapper.find('.grl-dist').exists()).toBe(false)
  })

  test('clearing the text lists the places around where the map is now', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)
    await wrapper.get('input').setValue('суздаль')
    await vi.advanceTimersByTimeAsync(300)
    await moveMap(wrapper, 56.5, 40.4)

    await wrapper.get('button[aria-label="Очистить поиск"]').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(lastSearch()).toMatchObject({ lat: 56.5, lon: 40.4 })
    expect(lastSearch().q).toBeUndefined()
  })

  test('a point marked on the map wins over its centre, and cancelling gives it back', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)

    wrapper.getComponent(GeoMapStub).vm.$emit('pick', { lat: 55.8, lon: 37.7 })
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(lastSearch()).toMatchObject({ lat: 55.8, lon: 37.7 })
    await moveMap(wrapper, 55.9, 37.9)
    expect(lastSearch()).toMatchObject({ lat: 55.8, lon: 37.7 })

    await wrapper.findAll('.pm-card .pm-btn--ghost')[0]!.trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(lastSearch()).toMatchObject({ lat: 55.9, lon: 37.9 })
  })

  test('a chosen address makes the places around it the list, cancelling goes back to the map', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.5, 37.0)

    await wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(lastSearch()).toMatchObject({ lat: ADDRESS.spot.lat, lon: ADDRESS.spot.lon })

    await wrapper.get('button[aria-label="Отменить выбор адреса"]').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(lastSearch()).toMatchObject({ lat: 55.5, lon: 37.0 })
  })

  test('the map fits the results of a typed text and leaves browsing alone', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)
    expect(wrapper.get('.map-stub').attributes('data-fit')).toBe('false')

    await wrapper.get('input').setValue('суздаль')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(wrapper.get('.map-stub').attributes('data-fit')).toBe('true')
  })
})

describe('LocationPickerModal places the collective used before', () => {
  const COLLECTIVE = { collectiveId: 'c1' }
  const itemTitles = (wrapper: Awaited<ReturnType<typeof openModal>>) =>
    wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text) .grl-title').map((node) => node.text())

  test('opens on them, latest first, under a heading', async () => {
    const wrapper = await openModal(HITS, '', null, COLLECTIVE)

    expect(backend.to('/event/v2/collectives/c1/recent-locations')).toHaveLength(1)
    expect(backend.to('/event/v2/collectives/c1/recent-locations')[0]!.params).toMatchObject({ limit: 10 })
    expect(backend.to('/geo/v2/locations').filter((call) => call.method === 'get')).toHaveLength(1)
    expect(wrapper.get('.grl-heading').text()).toBe('Недавние места')
    expect(itemTitles(wrapper)).toEqual(['Тверская улица, 7', 'Актовый зал'])
    expect(searches()).toHaveLength(0)
  })

  test('the geo service is asked for exactly the ids the collective used, in that order', async () => {
    await openModal(HITS, '', null, COLLECTIVE)

    const call = backend.to('/geo/v2/locations').find((c) => c.method === 'get')!
    expect(call.params).toEqual({ id: ['l2', 'l1'] })
    expect(axiosUri(call)).toContain('id=l2&id=l1')
  })

  test('the map is fitted to them and the list is not replaced when the map settles', async () => {
    const wrapper = await openModal(HITS, '', null, COLLECTIVE)
    expect(wrapper.get('.map-stub').attributes('data-fit')).toBe('true')

    wrapper.getComponent(GeoMapStub).vm.$emit('bbox', BOX_AROUND(55.75, 37.6))
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(searches()).toHaveLength(0)
    expect(itemTitles(wrapper)).toEqual(['Тверская улица, 7', 'Актовый зал'])
  })

  test('once the user moves the map, the places around it take over', async () => {
    const wrapper = await openModal(HITS, '', null, COLLECTIVE)

    await moveMap(wrapper, 55.5, 37.0)

    expect(searches()).toHaveLength(1)
    expect(lastSearch()).toMatchObject({ lat: 55.5, lon: 37.0 })
    expect(wrapper.find('.grl-heading').exists()).toBe(false)
    expect(wrapper.get('.map-stub').attributes('data-fit')).toBe('false')
  })

  test('clearing the text goes back to them while the map has not been moved', async () => {
    const wrapper = await openModal(HITS, '', null, COLLECTIVE)
    await wrapper.get('input').setValue('суздаль')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    await wrapper.get('button[aria-label="Очистить поиск"]').trigger('click')
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(wrapper.get('.grl-heading').text()).toBe('Недавние места')
    expect(itemTitles(wrapper)).toEqual(['Тверская улица, 7', 'Актовый зал'])
    expect(searches().every((call) => (call.params as Record<string, unknown>).q === 'суздаль')).toBe(true)
  })

  test('a collective that has used nothing keeps the general list of locations', async () => {
    const wrapper = await openModal(HITS, '', null, COLLECTIVE, [])

    expect(backend.to('/geo/v2/locations').filter((call) => call.method === 'get')).toHaveLength(0)
    expect(backend.to('/geo/v1/locations')).toHaveLength(1)
    expect(wrapper.find('.grl-heading').exists()).toBe(false)
  })

  test('without a collective nothing is asked of the event service', async () => {
    await openModal(HITS, '')

    expect(backend.calls.some((call) => call.url?.includes('recent-locations'))).toBe(false)
  })

  test('picking one of them selects that location', async () => {
    const wrapper = await openModal(HITS, '', null, COLLECTIVE)

    await wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('select')).toEqual([[NAMED]])
  })
})

describe('LocationPickerModal settlement names', () => {
  const PLACE = { name: 'Суздаль', region: 'Владимирская область', country: 'Россия', lat: 56.4194, lon: 40.4488 }

  test('a settlement with addresses is shown by fitting them', async () => {
    const wrapper = await openModal(HITS, 'суздаль', PLACE)

    expect(wrapper.get('.map-stub').attributes('data-fit')).toBe('true')
    expect(JSON.parse(wrapper.get('.map-stub').attributes('data-center')!)).toBeNull()
  })

  test('a settlement without any address is still shown: the map goes to its centre', async () => {
    const wrapper = await openModal([], 'суздаль', PLACE)

    expect(JSON.parse(wrapper.get('.map-stub').attributes('data-center')!)).toEqual({
      lat: PLACE.lat,
      lon: PLACE.lon,
    })
  })

  test('a text that is no settlement leaves the map where it was', async () => {
    const wrapper = await openModal([], 'нигдеград', null)

    expect(JSON.parse(wrapper.get('.map-stub').attributes('data-center')!)).toBeNull()
  })
})

describe('LocationPickerModal outside geocoder', () => {
  test('the map moving about never asks for it', async () => {
    const wrapper = await openModal(HITS, '')

    await moveMap(wrapper, 55.75, 37.6)
    await moveMap(wrapper, 56.5, 40.4)

    expect(searches()).toHaveLength(2)
    for (const call of searches()) expect((call.params as Record<string, unknown>).external).toBe('off')
  })

  test('a typed text asks for it', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)

    await wrapper.get('input').setValue('суздаль')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(lastSearch().q).toBe('суздаль')
    expect(lastSearch().external).toBeUndefined()
  })

  test('a marker put on the map asks for it once, cancelling it does not', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.75, 37.6)

    wrapper.getComponent(GeoMapStub).vm.$emit('pick', { lat: 55.8, lon: 37.7 })
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(lastSearch()).toMatchObject({ lat: 55.8, lon: 37.7 })
    expect(lastSearch().external).toBeUndefined()

    await wrapper.findAll('.pm-card .pm-btn--ghost')[0]!.trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(lastSearch().external).toBe('off')
  })

  test('choosing an address lists the places around it from the stored ones only', async () => {
    const wrapper = await openModal(HITS, '')
    await moveMap(wrapper, 55.5, 37.0)

    await wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(lastSearch()).toMatchObject({ lat: ADDRESS.spot.lat, lon: ADDRESS.spot.lon, external: 'off' })
  })
})

describe('LocationPickerModal text only', () => {
  test('the typed text can be kept as the location, with no map at all', async () => {
    const wrapper = await openModal([], 'ул. Пушкина, 10, Казань')

    await wrapper.get('.grl-item--text').trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(1)
    expect(posts()[0]!.url).toBe('/geo/v2/locations')
    expect(JSON.parse(posts()[0]!.data)).toEqual({ name: 'ул. Пушкина, 10, Казань' })
    expect(wrapper.emitted('select')).toEqual([[TEXT_LOCATION]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  test('the row is only offered with a text to keep', async () => {
    const wrapper = await openModal(HITS, '')

    expect(wrapper.find('.grl-item--text').exists()).toBe(false)
  })

  test('the same text chosen again asks nothing', async () => {
    const wrapper = await openModal([], 'ул. Пушкина, 10, Казань')
    await wrapper.get('.grl-item--text').trigger('click')
    await flushPromises()

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true, seedQuery: 'УЛ. Пушкина,   10, Казань' })
    await flushPromises()
    await wrapper.get('.grl-item--text').trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(1)
    expect(wrapper.emitted('select')).toEqual([[TEXT_LOCATION], [TEXT_LOCATION]])
  })

  test('an address chosen twice is resolved once', async () => {
    const wrapper = await openModal()
    await addressRow(wrapper).trigger('click')
    await wrapper.findAll('.aac-actions button')[1]!.trigger('click')
    await flushPromises()

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true, seedQuery: 'тверская 7' })
    await flushPromises()
    await addressRow(wrapper).trigger('click')
    await wrapper.findAll('.aac-actions button')[1]!.trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(1)
    expect(wrapper.emitted('select')).toEqual([[PROXY], [PROXY]])
  })
})
