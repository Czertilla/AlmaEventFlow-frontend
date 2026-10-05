import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import TimeSpinner from '@/components/common/TimeSpinner.vue'

function spinner(modelValue = '07:05', presets?: number[]) {
  return mount(TimeSpinner, {
    props: presets ? { modelValue, presets } : { modelValue },
    global: { stubs: { IonIcon: true } },
  })
}

const step = (wrapper: ReturnType<typeof spinner>, label: string) =>
  wrapper.findAll('.ts-step').find((button) => button.attributes('aria-label') === label)!

const last = (wrapper: ReturnType<typeof spinner>) => wrapper.emitted('update:modelValue')!.at(-1)

describe('TimeSpinner', () => {
  test('shows the hours and minutes of the model', () => {
    const wrapper = spinner('07:05')

    expect(wrapper.findAll('.ts-value').map((input) => (input.element as HTMLInputElement).value)).toEqual([
      '07',
      '05',
    ])
  })

  test('an empty model starts from 00:00', () => {
    const wrapper = spinner('')

    expect(wrapper.findAll('.ts-value').map((input) => (input.element as HTMLInputElement).value)).toEqual([
      '00',
      '00',
    ])
  })

  test.each([
    ['Часы: больше', '23:30', '00:30'],
    ['Часы: меньше', '00:30', '23:30'],
    ['Минуты: больше', '10:59', '10:00'],
    ['Минуты: меньше', '10:00', '10:59'],
    ['Минуты: больше', '10:08', '10:09'],
  ])('%s from %s gives %s without touching the other unit', async (label, from, expected) => {
    const wrapper = spinner(from)

    await step(wrapper, label).trigger('click')

    expect(last(wrapper)).toEqual([expected])
  })

  test('a mouse press steps once and the click that follows does not step again', async () => {
    const wrapper = spinner('10:00')
    const button = step(wrapper, 'Минуты: больше')

    await button.trigger('pointerdown')
    await button.trigger('pointerup')
    button.element.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }))

    expect(wrapper.emitted('update:modelValue')).toEqual([['10:01']])
  })

  describe('holding a step button', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    test('repeats after a delay and stops on release', async () => {
      const wrapper = spinner('10:00')
      const button = step(wrapper, 'Часы: больше')

      await button.trigger('pointerdown')
      expect(wrapper.emitted('update:modelValue')).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(400)
      await vi.advanceTimersByTimeAsync(90 * 3)
      const whileHeld = wrapper.emitted('update:modelValue')!.length
      expect(whileHeld).toBeGreaterThan(2)

      await button.trigger('pointerup')
      await vi.advanceTimersByTimeAsync(1000)
      expect(wrapper.emitted('update:modelValue')).toHaveLength(whileHeld)
    })
  })

  test('typing a unit replaces it and is clamped to its range', async () => {
    const wrapper = spinner('07:05')
    const [hours, minutes] = wrapper.findAll('.ts-value')

    await hours!.trigger('focus')
    ;(hours!.element as HTMLInputElement).value = '18'
    await hours!.trigger('input')
    expect(last(wrapper)).toEqual(['18:05'])

    await minutes!.trigger('focus')
    ;(minutes!.element as HTMLInputElement).value = '75'
    await minutes!.trigger('input')
    expect(last(wrapper)).toEqual(['07:59'])
  })

  test('letters are dropped and an empty box emits nothing', async () => {
    const wrapper = spinner('07:05')
    const hours = wrapper.findAll('.ts-value')[0]!

    await hours.trigger('focus')
    ;(hours.element as HTMLInputElement).value = 'ab'
    await hours.trigger('input')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect((hours.element as HTMLInputElement).value).toBe('')
  })

  test('arrow keys and the mouse wheel step the focused unit', async () => {
    const wrapper = spinner('07:05')
    const minutes = wrapper.findAll('.ts-value')[1]!

    await minutes.trigger('keydown', { key: 'ArrowUp' })
    expect(last(wrapper)).toEqual(['07:06'])

    await minutes.trigger('keydown', { key: 'ArrowDown' })
    expect(last(wrapper)).toEqual(['07:04'])

    await minutes.trigger('wheel', { deltaY: -100 })
    expect(last(wrapper)).toEqual(['07:06'])

    await minutes.trigger('wheel', { deltaY: 100 })
    expect(last(wrapper)).toEqual(['07:04'])
  })

  test('a preset sets the minutes and the current one is highlighted', async () => {
    const wrapper = spinner('07:05')

    await wrapper.findAll('.ts-preset').find((chip) => chip.text() === ':30')!.trigger('click')
    expect(last(wrapper)).toEqual(['07:30'])

    await wrapper.setProps({ modelValue: '07:30' })
    expect(wrapper.findAll('.ts-preset--on').map((chip) => chip.text())).toEqual([':30'])
  })

  test('presets can be turned off', () => {
    expect(spinner('07:05', []).find('.ts-presets').exists()).toBe(false)
  })
})
