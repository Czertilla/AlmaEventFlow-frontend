import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import LocationField from '@/components/geo/LocationField.vue'
import { forgetResolved } from '@/composables/useLocationResolver'
import { homeOutline, locationOutline } from 'ionicons/icons'
import { stubBackend } from './helpers/axiosStub'

const ModalStub = defineComponent({
  name: 'LocationPickerModal',
  props: { open: Boolean, selected: Object, seedQuery: String, draft: Object },
  setup: (props) => () =>
    h('div', {
      class: 'modal-stub',
      'data-open': String(props.open),
      'data-draft': JSON.stringify(props.draft ?? null),
    }),
})

const ADDRESS = {
  id: 'a1',
  city_id: 1,
  name: 'Тверская улица, 7',
  locality: 'Москва, Россия',
  spot: { lat: 55.7583, lon: 37.6116 },
}
const NAMED = {
  id: 'l1',
  name: 'Актовый зал',
  address_id: 'a1',
  address: ADDRESS,
  display_name: 'Актовый зал',
}
const TEXT_LOCATION = { id: 'l3', name: 'ул. Пушкина, 10, Казань', address_id: null, address: null, spot: null }
const PROXY = { id: 'l2', name: null, address_id: 'a1', address: ADDRESS, display_name: 'Тверская улица, 7' }

let backend: ReturnType<typeof stubBackend>
const mounted: ReturnType<typeof mount>[] = []

function field(modelValue: unknown = null) {
  const wrapper = mount(LocationField, {
    props: { modelValue: modelValue as never },
    attachTo: document.body,
    global: { stubs: { IonIcon: true, IonSpinner: true, LocationPickerModal: ModalStub, MapLinkMenu: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

const posts = () => backend.calls.filter((call) => call.method === 'post')

async function search(wrapper: ReturnType<typeof field>, text = 'тверская 7') {
  await wrapper.get('input').trigger('focus')
  await wrapper.get('input').setValue(text)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

async function chooseAddress(wrapper: ReturnType<typeof field>) {
  await search(wrapper)
  await wrapper.findAll('.grl-item')[1]!.trigger('click')
}

function leaveFocusTo(wrapper: ReturnType<typeof field>, next: Element | null) {
  wrapper
    .get('input')
    .element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: next }))
}

beforeEach(() => {
  vi.useFakeTimers()
  backend = stubBackend((config) => {
    if (config.url === '/geo/v2/search') {
      return {
        status: 200,
        data: {
          items: [
            { kind: 'location', origin: 'local', score: 2, location: NAMED },
            { kind: 'address', origin: 'external', score: null, address: ADDRESS },
          ],
          external: { state: 'ok', provider: 'photon' },
        },
      }
    }
    if (config.url === '/geo/v1/locations/from-address') return { status: 201, data: PROXY }
    if (config.url === '/geo/v2/locations') return { status: 200, data: TEXT_LOCATION }
    return { status: 200, data: { items: [] } }
  })
})

afterEach(() => {
  forgetResolved()
  backend.restore()
  vi.useRealTimers()
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('LocationField suggestions', () => {
  test('an address names its city under the title', async () => {
    const wrapper = field()
    await search(wrapper)

    const subs = wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text) .grl-sub').map((sub) => sub.text())
    expect(subs).toEqual(['Тверская улица, 7 · Москва, Россия', 'Адрес · Москва, Россия'])
  })

  test('clicking an address only selects it: nothing is created or chosen', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)
    await flushPromises()

    expect(wrapper.find('.aac').exists()).toBe(true)
    expect(wrapper.get('.aac-title').text()).toBe('Тверская улица, 7')
    expect(wrapper.get('.aac-sub').text()).toBe('Москва, Россия')
    expect(wrapper.find('.grl').exists()).toBe(false)
    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('"Выбрать адрес" turns the address into the location, once', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    await wrapper.findAll('.aac-actions button')[1]!.trigger('click')
    await flushPromises()

    const [call] = backend.to('/geo/v1/locations/from-address')
    expect(posts()).toHaveLength(1)
    expect(JSON.parse(call!.data)).toEqual({ address_id: 'a1', name: null })
    expect(wrapper.emitted('update:modelValue')).toEqual([[PROXY]])
  })

  test('"Создать локацию" opens the form on that address and creates nothing', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    await wrapper.findAll('.aac-actions button')[0]!.trigger('click')

    const modal = wrapper.get('.modal-stub')
    expect(modal.attributes('data-open')).toBe('true')
    expect(JSON.parse(modal.attributes('data-draft')!).address.id).toBe('a1')
    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('cancelling the address brings the suggestions back', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    await wrapper.get('button[aria-label="Отменить выбор адреса"]').trigger('click')

    expect(wrapper.find('.aac').exists()).toBe(false)
    expect(wrapper.findAll('.grl-item:not(.grl-item--create):not(.grl-item--text)')).toHaveLength(2)
  })

  test('typing again drops the chosen address', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    await wrapper.get('input').setValue('тверская 9')

    expect(wrapper.find('.aac').exists()).toBe(false)
  })

  test('Enter does not turn a chosen address into a location', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(posts()).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('a named location is still chosen by one click', async () => {
    const wrapper = field()
    await search(wrapper)

    await wrapper.findAll('.grl-item')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([[NAMED]])
    expect(posts()).toHaveLength(0)
  })

  test('the card stays while focus moves between its buttons', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    leaveFocusTo(wrapper, wrapper.findAll('.aac-actions button')[0]!.element)
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.find('.aac').exists()).toBe(true)
  })

  test('the card goes when focus leaves the field', async () => {
    const wrapper = field()
    await chooseAddress(wrapper)

    leaveFocusTo(wrapper, document.body)
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.find('.aac').exists()).toBe(false)
  })
})

describe('LocationField text only', () => {
  test('the typed text can be kept as the location without any map data', async () => {
    const wrapper = field()
    await search(wrapper, 'ул. Пушкина, 10, Казань')

    await wrapper.get('.grl-item--text').trigger('click')
    await flushPromises()

    const [call] = backend.to('/geo/v2/locations')
    expect(JSON.parse(call!.data)).toEqual({ name: 'ул. Пушкина, 10, Казань' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[TEXT_LOCATION]])
  })

  test('with nothing found it is still on offer, next to the create row', async () => {
    backend.restore()
    backend = stubBackend((config) =>
      config.url === '/geo/v2/search'
        ? { status: 200, data: { items: [], external: { state: 'unavailable', provider: 'photon' } } }
        : { status: 200, data: TEXT_LOCATION },
    )
    const wrapper = field()
    await search(wrapper, 'ул. Пушкина, 10, Казань')

    expect(wrapper.findAll('.grl-item').map((row) => row.classes().filter((c) => c !== 'grl-item'))).toEqual([
      ['grl-item--create'],
      ['grl-item--text'],
    ])
  })

  test('a chosen text location says it is text and offers the address to copy or look up', () => {
    const wrapper = field(TEXT_LOCATION)

    expect(wrapper.get('.lf-title').text()).toBe('ул. Пушкина, 10, Казань')
    expect(wrapper.get('.lf-sub').text()).toBe('Адрес текстом, без карты')
    expect(wrapper.get('map-link-menu-stub').attributes('search')).toBe('ул. Пушкина, 10, Казань')
  })

  test('a chosen address-only location shows as an address with its city, not as a location', () => {
    const wrapper = field(PROXY)

    expect(wrapper.get('.lf-title').text()).toBe('Тверская улица, 7')
    expect(wrapper.get('.lf-sub').text()).toBe('Москва, Россия')
    expect(wrapper.get('.lf-tile ion-icon-stub').attributes('icon')).toBe(homeOutline)
  })

  test('a named location keeps the location look', () => {
    const wrapper = field(NAMED)

    expect(wrapper.get('.lf-sub').text()).toBe('Тверская улица, 7')
    expect(wrapper.get('.lf-tile ion-icon-stub').attributes('icon')).toBe(locationOutline)
  })
})
