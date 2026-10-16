import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import AddressActionCard from '@/components/geo/AddressActionCard.vue'
import type { AddressRead } from '@/api/generated/almaEventFlow'

const mounted: ReturnType<typeof mount>[] = []

function card(address: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  const wrapper = mount(AddressActionCard, {
    props: {
      address: { id: 'a1', city_id: 1, name: 'Тверская улица, 7', ...address } as unknown as AddressRead,
      ...props,
    },
    global: { stubs: { IonIcon: true, IonSpinner: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('AddressActionCard', () => {
  test('names the address and its city', () => {
    const wrapper = card({ locality: 'Москва, Россия' })

    expect(wrapper.get('.aac-title').text()).toBe('Тверская улица, 7')
    expect(wrapper.get('.aac-sub').text()).toBe('Москва, Россия')
  })

  test('falls back to a plain "Адрес" when the city is unknown', () => {
    expect(card().get('.aac-sub').text()).toBe('Адрес')
  })

  test('each button asks for exactly one thing', async () => {
    const wrapper = card()
    const [create, use] = wrapper.findAll('.aac-actions button')

    await create!.trigger('click')
    await use!.trigger('click')
    await wrapper.get('button[aria-label="Отменить выбор адреса"]').trigger('click')

    expect(create!.text()).toBe('Создать локацию')
    expect(use!.text()).toBe('Выбрать адрес')
    expect(wrapper.emitted('create')).toHaveLength(1)
    expect(wrapper.emitted('use')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  test('while a location is being made the main button waits', async () => {
    const wrapper = card({}, { busy: true })
    const use = wrapper.findAll('.aac-actions button')[1]!

    expect(use.attributes('disabled')).toBeDefined()
    await use.trigger('click')
    expect(wrapper.emitted('use')).toBeUndefined()
  })
})
