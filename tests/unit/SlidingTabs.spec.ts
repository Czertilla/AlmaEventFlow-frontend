import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import SlidingTabs from '@/components/common/SlidingTabs.vue'

const mounted: ReturnType<typeof mount>[] = []

function tabs(props: Record<string, unknown> = {}) {
  const wrapper = mount(SlidingTabs, {
    props: {
      modelValue: 'a',
      tabs: [{ key: 'a', label: 'Первая' }, { key: 'b', label: 'Вторая' }],
      ...props,
    },
    attachTo: document.body,
    global: { stubs: { IonIcon: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('SlidingTabs', () => {
  test('a click on a tab asks for it', async () => {
    const wrapper = tabs()

    await wrapper.findAll('.sliding-tab')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  test('a badge shows the number and is left out when it is zero', () => {
    const wrapper = tabs({ tabs: [{ key: 'a', label: 'Первая', badge: 3 }, { key: 'b', label: 'Вторая', badge: 0 }] })
    const [first, second] = wrapper.findAll('.sliding-tab')

    expect(first.find('.sliding-tab-badge').text()).toBe('3')
    expect(second.find('.sliding-tab-badge').exists()).toBe(false)
  })

  test('an invalid tab is marked and only the tabs in the shake list tremble', () => {
    const wrapper = tabs({
      tabs: [{ key: 'a', label: 'Первая', invalid: true }, { key: 'b', label: 'Вторая', invalid: true }],
      shake: ['b'],
    })
    const [first, second] = wrapper.findAll('.sliding-tab')

    expect(first.classes()).toContain('sliding-tab--invalid')
    expect(first.classes()).not.toContain('sliding-tab--shake')
    expect(second.classes()).toContain('sliding-tab--shake')
  })
})
