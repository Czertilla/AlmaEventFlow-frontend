import { mount, type VueWrapper } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import type { EventRead } from '@/api/generated/almaEventFlow'

const STEP = 110
const CARD = 100
const WINDOW = 500

let EventList: typeof import('@/components/event/EventList.vue').default

const restores: Array<() => void> = []

function patch<T extends object>(target: T, key: string, descriptor: PropertyDescriptor) {
  const previous = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, { configurable: true, ...descriptor })
  restores.push(() => {
    if (previous) Object.defineProperty(target, key, previous)
    else delete (target as Record<string, unknown>)[key]
  })
}

const indexOf = (el: Element) => (el instanceof HTMLElement && el.dataset.index !== undefined ? Number(el.dataset.index) : null)
const isList = (el: Element) => el.classList.contains('event-list')

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      matches: true,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
    unobserve() {}
  })
  patch(HTMLElement.prototype, 'offsetTop', {
    get(this: HTMLElement) {
      const index = indexOf(this)
      return index === null ? 0 : index * STEP
    },
  })
  patch(HTMLElement.prototype, 'offsetHeight', {
    get(this: HTMLElement) {
      return indexOf(this) === null ? 0 : CARD
    },
  })
  patch(HTMLElement.prototype, 'clientHeight', {
    get(this: HTMLElement) {
      return isList(this) ? WINDOW : 0
    },
  })
  patch(HTMLElement.prototype, 'scrollHeight', {
    get(this: HTMLElement) {
      if (!isList(this)) return 0
      const spacer = this.querySelector<HTMLElement>('.list-bottom-spacer')
      return this.querySelectorAll('[data-index]').length * STEP + (spacer ? parseFloat(spacer.style.height) || 0 : 0)
    },
  })
  patch(Element.prototype, 'getBoundingClientRect', {
    value(this: Element) {
      const index = indexOf(this)
      const list = this.closest('.event-list')
      const top = index === null ? 0 : index * STEP - (list?.scrollTop ?? 0)
      return { top, bottom: top + CARD, left: 0, right: 0, width: 0, height: CARD, x: 0, y: top, toJSON: () => ({}) }
    },
  })
  patch(HTMLElement.prototype, 'scrollTo', {
    value(this: HTMLElement, options: ScrollToOptions) {
      const longest = Math.max(0, this.scrollHeight - this.clientHeight)
      this.scrollTop = Math.min(options.top ?? 0, longest)
    },
  })
  EventList = (await import('@/components/event/EventList.vue')).default
}, 120_000)

afterAll(() => {
  restores.splice(0).reverse().forEach((restore) => restore())
  vi.unstubAllGlobals()
})

const EventPreviewStub = defineComponent({
  props: { event: { type: Object, required: true } },
  setup: (props) => () => h('div', { class: 'card', 'data-index': (props.event as { index: number }).index }),
})

function eventsOnDays(days: string[]): EventRead[] {
  return days.map((date, index) => ({ id: `e${index}`, name: `Событие ${index}`, date, index }) as unknown as EventRead)
}

const OCTOBER = Array.from({ length: 12 }, (_, i) => `2026-10-${String(10 + i).padStart(2, '0')}`)
const day = (n: number) => new Date(2026, 9, n)

const mounted: VueWrapper[] = []

function listOf(events: EventRead[], props: Record<string, unknown> = {}) {
  const wrapper = mount(EventList, {
    props: {
      events,
      attendances: new Map(),
      stageTimes: new Map(),
      isPrincipal: false,
      loading: false,
      loadingUp: false,
      loadingDown: false,
      hasMoreUp: false,
      hasMoreDown: false,
      ...props,
    },
    attachTo: document.body,
    global: { stubs: { EventPreview: EventPreviewStub } },
  })
  mounted.push(wrapper)
  const root = wrapper.get('.event-list').element as HTMLElement
  const exposed = wrapper.vm as unknown as { scrollTo: (day: Date, smooth?: boolean) => Promise<boolean> }
  return { wrapper, root, scrollTo: exposed.scrollTo }
}

async function jump(scrollTo: (day: Date, smooth?: boolean) => Promise<boolean>, to: Date, smooth = false) {
  const done = scrollTo(to, smooth)
  await vi.advanceTimersByTimeAsync(500)
  return done
}

function userScrollsTo(root: HTMLElement, top: number) {
  root.dispatchEvent(new Event('wheel'))
  root.scrollTop = top
  root.dispatchEvent(new Event('scroll'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('EventList jump to a day', () => {
  test('puts the first card of the day at the top edge', async () => {
    const { root, scrollTo } = listOf(eventsOnDays(OCTOBER))

    await jump(scrollTo, day(15))

    expect(root.scrollTop).toBe(5 * STEP)
  })

  test('says whether the card reached the top edge', async () => {
    const { scrollTo } = listOf(eventsOnDays(OCTOBER), { hasMoreDown: true })

    expect(await jump(scrollTo, day(15))).toBe(true)
  })

  test('says so when the list is too short to bring the card to the top', async () => {
    const { root, scrollTo } = listOf(eventsOnDays(OCTOBER), { hasMoreDown: true })

    expect(await jump(scrollTo, day(21))).toBe(false)
    expect(root.scrollTop).toBe(12 * STEP - WINDOW)
  })

  test('a day without events lands on the next event', async () => {
    const { root, scrollTo } = listOf(eventsOnDays(['2026-10-10', '2026-10-20', '2026-10-28']))

    await jump(scrollTo, day(23))

    expect(root.scrollTop).toBe(2 * STEP)
  })

  test('the day does not change by itself while the list settles or compensates a shift', async () => {
    const { wrapper, root, scrollTo } = listOf(eventsOnDays(OCTOBER))

    await jump(scrollTo, day(15))
    for (let i = 0; i < 5; i++) {
      root.dispatchEvent(new Event('scroll'))
      await vi.advanceTimersByTimeAsync(100)
    }

    expect(wrapper.emitted('visibleDateChanged')).toBeUndefined()
    expect(wrapper.emitted('calendarVisibleChange')).toBeUndefined()
  })

  test('the day does not change either when the scroll events arrive during a smooth jump', async () => {
    const { wrapper, root, scrollTo } = listOf(eventsOnDays(OCTOBER))

    const done = scrollTo(day(19), true)
    await vi.advanceTimersByTimeAsync(40)
    for (const top of [100, 300, 600, 9 * STEP]) {
      root.scrollTop = top
      root.dispatchEvent(new Event('scroll'))
      await vi.advanceTimersByTimeAsync(300)
    }
    await vi.advanceTimersByTimeAsync(1500)
    await done

    expect(wrapper.emitted('visibleDateChanged')).toBeUndefined()
  })

  test('picking the same day again scrolls back to it after the list was moved away', async () => {
    const { root, scrollTo } = listOf(eventsOnDays(OCTOBER))
    await jump(scrollTo, day(15))

    userScrollsTo(root, 9 * STEP)
    await jump(scrollTo, day(15))

    expect(root.scrollTop).toBe(5 * STEP)
  })
})

describe('EventList own scrolling', () => {
  test('reports the day of the card at the top, not of the one in the middle of the window', async () => {
    const { wrapper, root } = listOf(eventsOnDays(OCTOBER))

    userScrollsTo(root, 4 * STEP)

    expect(wrapper.emitted('visibleDateChanged')).toEqual([['2026-10-14']])
  })

  test('follows the person after a jump, and reports a day it already reported before the jump', async () => {
    const { wrapper, root, scrollTo } = listOf(eventsOnDays(OCTOBER))
    userScrollsTo(root, 2 * STEP)
    await jump(scrollTo, day(19))

    userScrollsTo(root, 2 * STEP)

    expect(wrapper.emitted('visibleDateChanged')).toEqual([['2026-10-12'], ['2026-10-12']])
  })

  test('collapses the calendar on the way down and brings it back on the way up', async () => {
    const { wrapper, root } = listOf(eventsOnDays(OCTOBER))

    userScrollsTo(root, 200)
    userScrollsTo(root, 100)

    expect(wrapper.emitted('calendarVisibleChange')).toEqual([[false], [true]])
  })
})

describe('EventList loading more', () => {
  test('waits for a jump to settle before asking for more, then asks once', async () => {
    const { wrapper, root, scrollTo } = listOf(eventsOnDays(OCTOBER), { hasMoreUp: true })

    const done = scrollTo(day(10), true)
    await vi.advanceTimersByTimeAsync(40)
    root.dispatchEvent(new Event('scroll'))
    expect(wrapper.emitted('loadMoreUp')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1500)
    await done
    await nextTick()

    expect(wrapper.emitted('loadMoreUp')).toHaveLength(1)
  })

  test('asks for the later events even when there is nothing earlier to ask for', async () => {
    const { wrapper, root } = listOf(eventsOnDays(OCTOBER), { hasMoreUp: false, hasMoreDown: true })

    userScrollsTo(root, 12 * STEP - WINDOW - 50)

    expect(wrapper.emitted('loadMoreUp')).toBeUndefined()
    expect(wrapper.emitted('loadMoreDown')).toHaveLength(1)
  })
})
