import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useSwipe } from '@/composables/useSwipe'

const mounted: ReturnType<typeof mount>[] = []

function area(enabled: () => boolean = () => true) {
  const onLeft = vi.fn()
  const onRight = vi.fn()
  const Host = defineComponent({
    setup() {
      const el = ref<HTMLElement | null>(null)
      useSwipe(el, { onLeft, onRight, enabled })
      return () => h('div', { ref: el }, [
        h('p', { class: 'plain' }, 'text'),
        h('p', { class: 'locked', 'data-no-swipe': '' }, 'map'),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  mounted.push(wrapper)
  return { wrapper, onLeft, onRight }
}

type Point = [number, number]

function swipe(node: Element, from: Point, to: Point) {
  const touch = (point: Point) => ({ clientX: point[0], clientY: point[1] }) as Touch
  const fire = (type: string, point: Point) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { touches: type === 'touchend' ? [] : [touch(point)], changedTouches: [touch(point)] })
    node.dispatchEvent(event)
  }
  fire('touchstart', from)
  fire('touchend', to)
}

afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('useSwipe', () => {
  test('a long horizontal move left or right calls the matching handler', () => {
    const { wrapper, onLeft, onRight } = area()
    const node = wrapper.find('.plain').element

    swipe(node, [200, 100], [100, 110])
    swipe(node, [100, 100], [200, 90])

    expect(onLeft).toHaveBeenCalledOnce()
    expect(onRight).toHaveBeenCalledOnce()
  })

  test('a short move and a mostly vertical one are scrolls, not swipes', () => {
    const { wrapper, onLeft, onRight } = area()
    const node = wrapper.find('.plain').element

    swipe(node, [200, 100], [170, 100])
    swipe(node, [200, 100], [120, 260])

    expect(onLeft).not.toHaveBeenCalled()
    expect(onRight).not.toHaveBeenCalled()
  })

  test('nothing happens when it is disabled or the touch began inside a data-no-swipe area', () => {
    let on = false
    const { wrapper, onLeft } = area(() => on)

    swipe(wrapper.find('.plain').element, [200, 100], [100, 100])
    on = true
    swipe(wrapper.find('.locked').element, [200, 100], [100, 100])

    expect(onLeft).not.toHaveBeenCalled()
  })
})
