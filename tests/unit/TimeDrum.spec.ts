import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import TimeDrum from '@/components/common/TimeDrum.vue'

const ROW = 36

interface Harness {
  wrapper: ReturnType<typeof mount>
  scroller: HTMLElement
  scrollTo: ReturnType<typeof vi.fn>
  position: () => number
  userScroll: (index: number) => void
  emitted: () => number[]
}

function mountDrum(modelValue: number, count = 60, followModel = true): Harness {
  let top = (count + modelValue) * ROW
  const wrapper: ReturnType<typeof mount> = mount(TimeDrum, {
    props: {
      modelValue,
      count,
      label: 'Минуты',
      'onUpdate:modelValue': (value: number) => {
        if (followModel) wrapper.setProps({ modelValue: value })
      },
    },
    attachTo: document.body,
  })
  const scroller = wrapper.get('.ts-scroller').element as HTMLElement
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value
    },
  })
  const scrollTo = vi.fn(({ top: target }: { top: number }) => {
    top = target
    scroller.dispatchEvent(new Event('scroll'))
  })
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo
  return {
    wrapper,
    scroller,
    scrollTo,
    position: () => top,
    userScroll: (index) => {
      scroller.dispatchEvent(new Event('pointerdown'))
      top = index * ROW
      scroller.dispatchEvent(new Event('scroll'))
    },
    emitted: () => (wrapper.emitted('update:modelValue') ?? []).map((args) => args[0] as number),
  }
}

const input = (drum: Harness) => drum.wrapper.get('.ts-value')

async function type(drum: Harness, chars: string, inputType = 'insertText') {
  const element = input(drum).element as HTMLInputElement
  element.value = chars
  await input(drum).trigger('input', { data: chars, inputType })
}

async function key(drum: Harness, name: string) {
  await input(drum).trigger('keydown', { key: name })
}

const wheel = (drum: Harness, deltaY: number, init: WheelEventInit = {}) => {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...init })
  drum.wrapper.element.dispatchEvent(event)
  return event
}

let mounted: Harness[] = []
const drum = (...args: Parameters<typeof mountDrum>) => {
  const harness = mountDrum(...args)
  mounted.push(harness)
  return harness
}

beforeEach(() => {
  vi.useFakeTimers()
  mounted = []
})

afterEach(() => {
  mounted.forEach(({ wrapper }) => wrapper.unmount())
  vi.useRealTimers()
})

describe('TimeDrum list', () => {
  test('renders three copies of the values so the list can wrap around', () => {
    const { wrapper } = drum(5)

    const items = wrapper.findAll('.ts-item').map((item) => item.text())
    expect(items).toHaveLength(180)
    expect(items.slice(0, 3)).toEqual(['00', '01', '02'])
    expect(items.slice(58, 63)).toEqual(['58', '59', '00', '01', '02'])
  })

  test('items cannot take focus', () => {
    const { wrapper } = drum(5)

    expect(wrapper.findAll('.ts-item').every((item) => item.attributes('tabindex') === '-1')).toBe(true)
  })

  test('shows the model in the centre box', () => {
    expect((input(drum(7)).element as HTMLInputElement).value).toBe('07')
  })
})

describe('TimeDrum scrolling', () => {
  test('emits the value of the row the list is scrolled to', () => {
    const harness = drum(5)

    harness.userScroll(60 + 7)

    expect(harness.emitted()).toEqual([7])
  })

  test('emits once per value while the list passes through rows', () => {
    const harness = drum(5)

    for (const index of [66, 67, 67, 68, 68, 69]) harness.userScroll(index)

    expect(harness.emitted()).toEqual([6, 7, 8, 9])
  })

  test('maps a row of any copy to its value', () => {
    const harness = drum(5)

    harness.userScroll(3)
    harness.userScroll(125)

    expect(harness.emitted()).toEqual([3, 5])
  })

  test('hides the centre box while the list moves and shows it again when it rests', async () => {
    const harness = drum(5)

    harness.userScroll(70)
    await harness.wrapper.vm.$nextTick()
    expect(input(harness).classes()).toContain('ts-value--hidden')

    await vi.advanceTimersByTimeAsync(1000)
    expect(input(harness).classes()).not.toContain('ts-value--hidden')
  })

  test('moves to the middle copy when it rests in another one', async () => {
    const harness = drum(5)

    harness.userScroll(3)
    await vi.advanceTimersByTimeAsync(1000)

    expect(harness.position()).toBe((60 + 3) * ROW)
    expect(harness.emitted()).toEqual([3])
  })

  test('a change of the model from outside scrolls the list without emitting', async () => {
    const harness = drum(5)

    await harness.wrapper.setProps({ modelValue: 9 })

    expect(harness.scrollTo).toHaveBeenCalledWith({ top: (60 + 9) * ROW, behavior: 'smooth' })
    expect(harness.emitted()).toEqual([])
    await vi.advanceTimersByTimeAsync(800)
    expect(harness.emitted()).toEqual([])
  })

  test('the shortest way is taken across the end of the list', async () => {
    const harness = drum(58)

    await harness.wrapper.setProps({ modelValue: 1 })

    expect(harness.scrollTo).toHaveBeenCalledWith({ top: (120 + 1) * ROW, behavior: 'smooth' })
  })

  test('a value the parent refused can be scrolled to again afterwards', async () => {
    const harness = drum(5, 60, false)

    harness.userScroll(60 + 10)
    await vi.advanceTimersByTimeAsync(1000)
    harness.userScroll(60 + 10)

    expect(harness.emitted()).toEqual([10, 10])
  })

  test('a model that was not updated pulls the list back to it once it rests', async () => {
    const harness = drum(5, 60, false)

    harness.userScroll(60 + 10)
    await vi.advanceTimersByTimeAsync(1000)

    expect(harness.scrollTo).toHaveBeenCalledWith({ top: (60 + 5) * ROW, behavior: 'smooth' })
  })
})

describe('TimeDrum wheel', () => {
  test('one notch of a mouse wheel moves one row', () => {
    const harness = drum(5)

    const event = wheel(harness, 100)

    expect(event.defaultPrevented).toBe(true)
    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 6) * ROW, behavior: 'smooth' })
  })

  test('a bigger delta moves as many rows as notches and up is backwards', () => {
    const harness = drum(5)

    wheel(harness, 300)
    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 8) * ROW, behavior: 'smooth' })

    wheel(harness, -100)
    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 7) * ROW, behavior: 'smooth' })
  })

  test('line based deltas count three lines as one notch', () => {
    const harness = drum(5)

    wheel(harness, 3, { deltaMode: 1 })

    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 6) * ROW, behavior: 'smooth' })
  })

  test('small touchpad deltas and zoom gestures are left to the browser', () => {
    const harness = drum(5)

    expect(wheel(harness, 12).defaultPrevented).toBe(false)
    expect(wheel(harness, 120, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(harness.scrollTo).not.toHaveBeenCalled()
  })

  test('a quick series adds up even before the list starts to move', () => {
    const harness = drum(5)
    harness.scrollTo.mockImplementation(() => undefined)

    for (let i = 0; i < 5; i++) wheel(harness, 100)

    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 10) * ROW, behavior: 'smooth' })
  })

  test('the end of a list is passed by jumping to the equal row of the middle copy', () => {
    const harness = drum(5)
    harness.userScroll(178)

    wheel(harness, 300)

    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (118 + 3) * ROW, behavior: 'smooth' })
  })

  test('the list is not pulled back while it is still travelling to the requested row', async () => {
    const harness = drum(5)
    harness.scrollTo.mockImplementation(() => undefined)

    wheel(harness, 300)
    await vi.advanceTimersByTimeAsync(1500)

    expect(harness.scrollTo).toHaveBeenCalledTimes(1)
  })
})

describe('TimeDrum keyboard', () => {
  test('arrow down is the next value and arrow up the previous one', async () => {
    const harness = drum(5)

    await key(harness, 'ArrowDown')
    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 6) * ROW, behavior: 'smooth' })

    await key(harness, 'ArrowUp')
    await key(harness, 'ArrowUp')
    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 4) * ROW, behavior: 'smooth' })
  })

  test('held arrows add up', async () => {
    const harness = drum(5)
    harness.scrollTo.mockImplementation(() => undefined)

    for (let i = 0; i < 4; i++) await key(harness, 'ArrowDown')

    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 9) * ROW, behavior: 'smooth' })
  })

  test('left and right move to the neighbouring field', async () => {
    const harness = drum(5)

    await key(harness, 'ArrowRight')
    await key(harness, 'ArrowLeft')

    expect(harness.wrapper.emitted('advance')).toEqual([['']])
    expect(harness.wrapper.emitted('retreat')).toHaveLength(1)
  })

  test.each([':', '.', ',', ' '])('"%s" finishes the field', async (separator) => {
    const harness = drum(5)

    await key(harness, separator)

    expect(harness.wrapper.emitted('advance')).toEqual([['']])
  })
})

describe('TimeDrum typing', () => {
  const hours = (modelValue = 5) => drum(modelValue, 24)

  test('two digits make the value and finish the field', async () => {
    const harness = hours()

    await type(harness, '1')
    await type(harness, '8')

    expect(harness.emitted()).toEqual([1, 18])
    expect(harness.wrapper.emitted('advance')).toEqual([['']])
  })

  test('a digit that cannot start a second one finishes the field at once', async () => {
    const harness = hours()

    await type(harness, '7')

    expect(harness.emitted()).toEqual([7])
    expect(harness.wrapper.emitted('advance')).toEqual([['']])
  })

  test('a second digit that would overflow starts the next field instead', async () => {
    const harness = hours()

    await type(harness, '2')
    await type(harness, '5')

    expect(harness.emitted()).toEqual([2])
    expect(harness.wrapper.emitted('advance')).toEqual([['5']])
  })

  test('pasted digits are shared between the fields', async () => {
    const harness = hours()

    await type(harness, '1845')

    expect(harness.emitted()).toEqual([1, 18])
    expect(harness.wrapper.emitted('advance')).toEqual([['45']])
  })

  test('a separator hands the rest over', async () => {
    const harness = hours()

    await type(harness, '1:30')

    expect(harness.emitted()).toEqual([1])
    expect(harness.wrapper.emitted('advance')).toEqual([['30']])
  })

  test('minutes accept the same rules up to 59', async () => {
    const harness = drum(5, 60)

    await type(harness, '4')
    await type(harness, '5')
    expect(harness.emitted()).toEqual([4, 45])

    await type(harness, '6')
    expect(harness.emitted()).toEqual([4, 45, 6])
  })

  test('letters are ignored and the box keeps showing the value', async () => {
    const harness = hours()

    await type(harness, 'x')

    expect(harness.emitted()).toEqual([])
    expect((input(harness).element as HTMLInputElement).value).toBe('05')
  })

  test('a typed digit is shown while the second one is awaited', async () => {
    const harness = hours()

    await type(harness, '1')

    expect((input(harness).element as HTMLInputElement).value).toBe('1')
  })

  test('the centre box stays visible while the list follows typing', async () => {
    const harness = hours()

    await type(harness, '1')
    await type(harness, '8')
    harness.userScroll(24 + 12)
    await harness.wrapper.vm.$nextTick()

    expect(input(harness).classes()).not.toContain('ts-value--hidden')
  })

  test('backspace takes back a typed digit and then asks for the previous field', async () => {
    const harness = hours()

    await type(harness, '1')
    await key(harness, 'Backspace')
    expect((input(harness).element as HTMLInputElement).value).toBe('01')
    expect(harness.wrapper.emitted('retreat')).toBeUndefined()

    await key(harness, 'Backspace')
    expect(harness.wrapper.emitted('retreat')).toHaveLength(1)
  })

  test('a delete from a mobile keyboard acts like backspace', async () => {
    const harness = hours()

    await type(harness, '', 'deleteContentBackward')

    expect(harness.wrapper.emitted('retreat')).toHaveLength(1)
  })

  test('focus with carried digits types them', () => {
    const harness = drum(5, 60)

    ;(harness.wrapper.vm as unknown as { focus: (carry?: string) => void }).focus('45')

    expect(harness.emitted()).toEqual([4, 45])
    expect(document.activeElement).toBe(input(harness).element)
  })
})

describe('TimeDrum clicks', () => {
  test('a neighbouring value is brought to the centre', async () => {
    const harness = drum(5)

    await harness.wrapper.findAll('.ts-item')[60 + 6]!.trigger('click')

    expect(harness.scrollTo).toHaveBeenLastCalledWith({ top: (60 + 6) * ROW, behavior: 'smooth' })
  })

  test('the value in the centre opens it for typing', async () => {
    const harness = drum(5)

    await harness.wrapper.findAll('.ts-item')[60 + 5]!.trigger('click')

    expect(document.activeElement).toBe(input(harness).element)
  })
})
