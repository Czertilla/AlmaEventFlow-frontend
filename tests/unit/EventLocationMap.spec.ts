import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { defineComponent, h } from 'vue'
import EventLocationMap from '@/components/geo/EventLocationMap.vue'
import { locationPoint } from '@/utils/geo'

const GeoMapStub = defineComponent({
  name: 'GeoMap',
  props: { center: Object, markers: Array, zoom: Number, scrollZoom: Boolean, pickable: Boolean },
  setup: (props) => () =>
    h('div', {
      class: 'map-stub',
      'data-center': JSON.stringify(props.center ?? null),
      'data-markers': JSON.stringify(props.markers),
      'data-zoom': String(props.zoom),
      'data-scroll-zoom': String(props.scrollZoom),
      'data-pickable': String(props.pickable),
    }),
})

const ADDRESS = {
  id: 'a1',
  name: 'Тверская улица, 7',
  locality: 'Москва, Россия',
  spot: { lat: 55.7583, lon: 37.6116 },
}

function show(location: Record<string, unknown>) {
  return mount(EventLocationMap, {
    props: { location: location as never },
    global: { stubs: { IonIcon: true, GeoMap: GeoMapStub, MapLinkMenu: true } },
  })
}

describe('EventLocationMap', () => {
  test('a location on a point shows it on a map that does not hijack the page wheel', () => {
    const wrapper = show({ id: 'l1', name: 'Двор', spot: { lat: 55.7, lon: 37.6 }, address: null })

    const map = wrapper.get('.map-stub')
    expect(JSON.parse(map.attributes('data-center')!)).toEqual({ lat: 55.7, lon: 37.6 })
    expect(JSON.parse(map.attributes('data-markers')!)).toMatchObject([{ kind: 'location', lat: 55.7, lon: 37.6, label: 'Двор' }])
    expect(map.attributes('data-scroll-zoom')).toBe('false')
    expect(map.attributes('data-pickable')).toBe('false')
    expect(wrapper.get('.elm-title').text()).toBe('Двор')
    expect(wrapper.get('.elm-sub').text()).toBe('Точка на карте')
  })

  test('a location at an address is put where the address is, with its city', () => {
    const wrapper = show({ id: 'l1', name: 'Актовый зал', address_id: 'a1', address: ADDRESS })

    expect(JSON.parse(wrapper.get('.map-stub').attributes('data-center')!)).toEqual(ADDRESS.spot)
    expect(wrapper.get('.elm-title').text()).toBe('Актовый зал')
    expect(wrapper.get('.elm-sub').text()).toBe('Тверская улица, 7 · Москва, Россия')
  })

  test('an address-only location reads as an address', () => {
    const wrapper = show({ id: 'l2', name: null, address_id: 'a1', address: ADDRESS })

    expect(wrapper.get('.elm-title').text()).toBe('Тверская улица, 7')
    expect(wrapper.get('.elm-sub').text()).toBe('Адрес · Москва, Россия')
  })

  test('its own point wins over the address point', () => {
    const wrapper = show({
      id: 'l3',
      name: 'Служебный вход',
      address_id: 'a1',
      address: ADDRESS,
      spot: { lat: 55.7501, lon: 37.6001 },
    })

    expect(JSON.parse(wrapper.get('.map-stub').attributes('data-center')!)).toEqual({ lat: 55.7501, lon: 37.6001 })
  })

  test.each([
    ['a text-only location', { id: 'l4', name: 'ул. Пушкина, 10, Казань', address: null, spot: null }],
    ['an address without a point', { id: 'l5', name: null, address_id: 'a2', address: { id: 'a2', name: 'Арбат, 1' } }],
  ])('%s has nothing to show on a map', (_, location) => {
    const wrapper = show(location)

    expect(wrapper.find('.elm').exists()).toBe(false)
    expect(locationPoint(location as never)).toBeNull()
  })
})
