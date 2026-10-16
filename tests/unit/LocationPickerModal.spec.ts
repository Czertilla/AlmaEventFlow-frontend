import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import LocationPickerModal from '@/components/geo/LocationPickerModal.vue'
import { stubBackend } from './helpers/axiosStub'

const Passthrough = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

const GeoMapStub = defineComponent({
  name: 'GeoMap',
  props: { center: Object, markers: Array, pickedPoint: Object, pickable: Boolean, fit: Boolean },
  emits: ['pick', 'marker-click', 'marker-create', 'interact'],
  setup(props, { expose }) {
    expose({ invalidateSize: () => undefined, refit: () => undefined })
    return () =>
      h('div', {
        class: 'map-stub',
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
const PROXY = { id: 'l2', name: null, address_id: 'a1', address: ADDRESS, display_name: 'Тверская улица, 7' }

let backend: ReturnType<typeof stubBackend>
const mounted: ReturnType<typeof mount>[] = []

const posts = () => backend.calls.filter((call) => call.method === 'post')

async function openModal(items: unknown[] = [
  { kind: 'location', origin: 'local', score: 2, location: NAMED },
  { kind: 'address', origin: 'external', score: null, address: ADDRESS },
]) {
  backend.restore()
  backend = stubBackend((config) => {
    if (config.url === '/geo/v2/search') {
      return { status: 200, data: { items, external: { state: 'ok', provider: 'photon' } } }
    }
    if (config.url === '/geo/v1/locations/from-address') return { status: 201, data: PROXY }
    return { status: 200, data: { items: [] } }
  })
  const wrapper = mount(LocationPickerModal, {
    props: { open: false, selected: null, seedQuery: '', draft: null },
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
  await wrapper.setProps({ open: true, seedQuery: 'тверская 7' })
  await flushPromises()
  return wrapper
}

const addressRow = (wrapper: Awaited<ReturnType<typeof openModal>>) =>
  wrapper.findAll('.grl-item:not(.grl-item--create)')[1]!

beforeEach(() => {
  vi.useFakeTimers()
  backend = stubBackend(() => ({ status: 200, data: { items: [] } }))
})

afterEach(() => {
  backend.restore()
  vi.useRealTimers()
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('LocationPickerModal address choice', () => {
  test('the suggestions name the city of an address', async () => {
    const wrapper = await openModal()

    const subs = wrapper.findAll('.grl-item:not(.grl-item--create) .grl-sub').map((sub) => sub.text())
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

    await wrapper.findAll('.grl-item:not(.grl-item--create)')[0]!.trigger('click')
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
