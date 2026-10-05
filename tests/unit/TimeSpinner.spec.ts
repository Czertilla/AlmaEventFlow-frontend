import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import TimeSpinner from '@/components/common/TimeSpinner.vue'

const mounted: ReturnType<typeof mount>[] = []

function host(initial = '07:05', presets?: number[]) {
  const model = ref(initial)
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(TimeSpinner, {
          modelValue: model.value,
          presets,
          'onUpdate:modelValue': (value: string) => {
            model.value = value
          },
        }),
    }),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { wrapper, model }
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

type Host = ReturnType<typeof host>

const boxes = (wrapper: Host['wrapper']) =>
  wrapper.findAll('.ts-value').map((input) => (input.element as HTMLInputElement).value)

async function typeInto(wrapper: Host['wrapper'], label: string, chars: string) {
  const box = wrapper.findAll('.ts-value').find((input) => input.attributes('aria-label') === label)!
  await box.trigger('focus')
  await box.trigger('input', { data: chars, inputType: 'insertText' })
}

describe('TimeSpinner', () => {
  test('shows the hours and the minutes of the model in two fields', () => {
    expect(boxes(host('07:05').wrapper)).toEqual(['07', '05'])
  })

  test('an empty model starts from 00:00', () => {
    expect(boxes(host('').wrapper)).toEqual(['00', '00'])
  })

  test('there are no plus and minus buttons and only the fields and the presets take focus', () => {
    const { wrapper } = host()

    expect(wrapper.findAll('.ts-step')).toHaveLength(0)
    const focusable = wrapper
      .findAll('input, button')
      .filter((element) => element.attributes('tabindex') !== '-1')
      .map((element) => element.attributes('aria-label') ?? element.text())
    expect(focusable).toEqual(['Часы', 'Минуты', ':00', ':15', ':30', ':45'])
  })

  test('typing the hours changes only the hours', async () => {
    const { wrapper, model } = host('07:05')

    await typeInto(wrapper, 'Часы', '18')

    expect(model.value).toBe('18:05')
  })

  test('typing continues in the minutes without a click or a tab', async () => {
    const { wrapper, model } = host('07:05')

    await typeInto(wrapper, 'Часы', '1845')

    expect(model.value).toBe('18:45')
    expect(document.activeElement).toBe(wrapper.findAll('.ts-value')[1]!.element)
  })

  test('typing digit by digit continues in the minutes too', async () => {
    const { wrapper, model } = host('07:05')
    ;(wrapper.findAll('.ts-value')[0]!.element as HTMLInputElement).focus()

    for (const char of '2145') {
      const active = document.activeElement as HTMLElement
      await wrapper
        .findAll('.ts-value')
        .find((input) => input.element === active)!
        .trigger('input', { data: char, inputType: 'insertText' })
    }

    expect(model.value).toBe('21:45')
  })

  test('an hour that cannot take a second digit hands it to the minutes', async () => {
    const { wrapper, model } = host('07:05')

    await typeInto(wrapper, 'Часы', '25')

    expect(model.value).toBe('02:05')
    expect((wrapper.findAll('.ts-value')[1]!.element as HTMLInputElement).value).toBe('5')
  })

  test('backspace in an untouched minutes field returns to the hours', async () => {
    const { wrapper } = host('07:05')
    await typeInto(wrapper, 'Часы', '18')

    await wrapper.findAll('.ts-value')[1]!.trigger('keydown', { key: 'Backspace' })

    expect(document.activeElement).toBe(wrapper.findAll('.ts-value')[0]!.element)
  })

  test('the arrow keys move between the fields', async () => {
    const { wrapper } = host('07:05')
    const [hours, minutes] = wrapper.findAll('.ts-value')
    await hours!.trigger('focus')

    await hours!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(minutes!.element)

    await minutes!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(hours!.element)
  })

  test('a preset sets the minutes and the current one is highlighted', async () => {
    const { wrapper, model } = host('07:05')

    await wrapper.findAll('.ui-chip').find((chip) => chip.text() === ':30')!.trigger('click')

    expect(model.value).toBe('07:30')
    expect(wrapper.findAll('.ui-chip--active').map((chip) => chip.text())).toEqual([':30'])
  })

  test('presets can be turned off', () => {
    expect(host('07:05', []).wrapper.find('.ts-presets').exists()).toBe(false)
  })
})
