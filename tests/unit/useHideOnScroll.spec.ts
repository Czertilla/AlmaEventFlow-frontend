import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useHideOnScroll } from '@/composables/useHideOnScroll'

const mounted: ReturnType<typeof mount>[] = []
let scroller: HTMLElement

function scrollTo(top: number) {
  scroller.scrollTop = top
  scroller.dispatchEvent(new Event('scroll'))
}

async function bar(active = true) {
  scroller = document.createElement('div')
  const content = document.createElement('ion-content') as HTMLElement & { getScrollElement: () => Promise<HTMLElement> }
  content.getScrollElement = () => Promise.resolve(scroller)
  document.body.appendChild(content)

  const enabled = ref(active)
  const Probe = defineComponent({
    setup() {
      const host = ref<HTMLElement | null>(null)
      const state = useHideOnScroll(host, () => enabled.value)
      return () => h('div', { ref: host, class: 'probe', 'data-hidden': String(state.hidden.value), 'data-raised': String(state.raised.value) }, [h('input')])
    },
  })
  const wrapper = mount(Probe, { attachTo: content })
  mounted.push(wrapper)
  await nextTick()
  await Promise.resolve()
  return { wrapper, enabled }
}

const hidden = (wrapper: ReturnType<typeof mount>) => wrapper.attributes('data-hidden')
const raised = (wrapper: ReturnType<typeof mount>) => wrapper.attributes('data-raised')

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('useHideOnScroll', () => {
  test('hides on the way down past the reveal zone and comes back at once on the way up', async () => {
    const { wrapper } = await bar()

    scrollTo(30)
    await nextTick()
    expect(hidden(wrapper)).toBe('false')

    scrollTo(120)
    await nextTick()
    expect(hidden(wrapper)).toBe('true')

    scrollTo(100)
    await nextTick()
    expect(hidden(wrapper)).toBe('false')
  })

  test('small movements change nothing', async () => {
    const { wrapper } = await bar()
    scrollTo(300)
    await nextTick()

    scrollTo(304)
    scrollTo(299)
    await nextTick()

    expect(hidden(wrapper)).toBe('true')
  })

  test('the bar is raised only while the page is scrolled', async () => {
    const { wrapper } = await bar()

    scrollTo(5)
    await nextTick()
    expect(raised(wrapper)).toBe('true')

    scrollTo(0)
    await nextTick()
    expect(raised(wrapper)).toBe('false')
  })

  test('it stays put while a text field inside it has the focus', async () => {
    const { wrapper } = await bar()
    ;(wrapper.get('input').element as HTMLInputElement).focus()

    scrollTo(400)
    await nextTick()

    expect(hidden(wrapper)).toBe('false')
  })

  test('switched off, it never hides and drops what it showed', async () => {
    const { wrapper, enabled } = await bar()
    scrollTo(400)
    await nextTick()
    expect(hidden(wrapper)).toBe('true')

    enabled.value = false
    await nextTick()
    expect(hidden(wrapper)).toBe('false')
    expect(raised(wrapper)).toBe('false')

    scrollTo(800)
    await nextTick()
    expect(hidden(wrapper)).toBe('false')
  })

  test('is on unless it is told otherwise', async () => {
    scroller = document.createElement('div')
    const content = document.createElement('ion-content') as HTMLElement & { getScrollElement: () => Promise<HTMLElement> }
    content.getScrollElement = () => Promise.resolve(scroller)
    document.body.appendChild(content)
    const Probe = defineComponent({
      setup() {
        const host = ref<HTMLElement | null>(null)
        const state = useHideOnScroll(host)
        return () => h('div', { ref: host, 'data-hidden': String(state.hidden.value) })
      },
    })
    const wrapper = mount(Probe, { attachTo: content })
    mounted.push(wrapper)
    await nextTick()
    await Promise.resolve()

    scrollTo(300)
    await nextTick()

    expect(hidden(wrapper)).toBe('true')
  })

  test('without an Ionic content around it nothing happens', async () => {
    const Probe = defineComponent({
      setup() {
        const host = ref<HTMLElement | null>(null)
        const state = useHideOnScroll(host, () => true)
        return () => h('div', { ref: host, 'data-hidden': String(state.hidden.value) })
      },
    })
    const wrapper = mount(Probe, { attachTo: document.body })
    mounted.push(wrapper)
    await nextTick()

    expect(wrapper.attributes('data-hidden')).toBe('false')
  })
})
