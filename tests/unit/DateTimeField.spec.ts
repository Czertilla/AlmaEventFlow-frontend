import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { defineComponent, h } from 'vue'
import DateTimeField from '@/components/common/DateTimeField.vue'

const IonDatetime = defineComponent({
  name: 'IonDatetime',
  props: { value: String, min: String, max: String, presentation: String },
  emits: ['ion-change'],
  setup: (props) => () =>
    h('div', {
      class: 'picker',
      'data-value': props.value,
      'data-min': props.min,
      'data-presentation': props.presentation,
    }),
})

const IonModal = defineComponent({
  name: 'IonModal',
  props: { isOpen: Boolean },
  setup: (_, { slots }) => () => h('div', { class: 'modal' }, slots.default?.()),
})

function field(props: Record<string, unknown>) {
  return mount(DateTimeField, {
    props,
    global: { stubs: { IonDatetime, IonModal, IonIcon: true } },
  })
}

type Field = ReturnType<typeof field>

const inputValue = (wrapper: Field) => (wrapper.get('input').element as HTMLInputElement).value

async function type(wrapper: Field, value: string, inputType = 'insertText') {
  const input = wrapper.get('input')
  const element = input.element as HTMLInputElement
  element.value = value
  element.setSelectionRange(value.length, value.length)
  await input.trigger('input', { inputType })
}

describe('DateTimeField typing', () => {
  test('shows the model in the display format', () => {
    expect(inputValue(field({ modelValue: '2026-03-12T15:30', mode: 'datetime' }))).toBe('12.03.2026 15:30')
  })

  test('emits only once the date is complete and real', async () => {
    const wrapper = field({ modelValue: '', mode: 'date' })

    await type(wrapper, '1203')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await type(wrapper, '12032026')
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-03-12']])
    expect(wrapper.emitted('change')).toEqual([['2026-03-12']])
    expect(inputValue(wrapper)).toBe('12.03.2026')
  })

  test('an impossible date is flagged and never emitted', async () => {
    const wrapper = field({ modelValue: '', mode: 'date' })

    await type(wrapper, '31022026')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('.dtf-box').classes()).toContain('dtf-box--invalid')
  })

  test('leaving an incomplete value restores the model', async () => {
    const wrapper = field({ modelValue: '2026-03-12', mode: 'date' })

    await type(wrapper, '1203')
    await wrapper.get('input').trigger('blur')

    expect(inputValue(wrapper)).toBe('12.03.2026')
  })

  test('emptying the input clears the model', async () => {
    const wrapper = field({ modelValue: '2026-03-12', mode: 'date' })

    await type(wrapper, '')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
  })

  test('time mode emits HH:mm', async () => {
    const wrapper = field({ modelValue: '', mode: 'time' })

    await type(wrapper, '0705')

    expect(wrapper.emitted('update:modelValue')).toEqual([['07:05']])
  })

  test('an outside change of the model is reflected in the input', async () => {
    const wrapper = field({ modelValue: '', mode: 'date' })

    await wrapper.setProps({ modelValue: '2026-12-31' })

    expect(inputValue(wrapper)).toBe('31.12.2026')
  })
})

describe('DateTimeField template', () => {
  const rest = (wrapper: Field) =>
    wrapper
      .findAll('.dtf-cell')
      .filter((cell) => cell.attributes('data-hidden') !== 'true')
      .map((cell) => cell.attributes('data-char'))
      .join('')
  const visible = (wrapper: Field) => inputValue(wrapper) + rest(wrapper)

  test('the whole template is shown while the field is empty', () => {
    expect(visible(field({ modelValue: '', mode: 'datetime' }))).toBe('ДД.ММ.ГГГГ ЧЧ:ММ')
    expect(visible(field({ modelValue: '', mode: 'date' }))).toBe('ДД.ММ.ГГГГ')
    expect(visible(field({ modelValue: '', mode: 'time' }))).toBe('ЧЧ:ММ')
  })

  test('typed characters replace the start of the template and the rest stays', async () => {
    const wrapper = field({ modelValue: '', mode: 'datetime' })

    await type(wrapper, '1203')

    expect(visible(wrapper)).toBe('12.03.ГГГГ ЧЧ:ММ')
    expect(rest(wrapper)).toBe('.ГГГГ ЧЧ:ММ')
  })

  test('a complete value leaves nothing of the template', () => {
    const wrapper = field({ modelValue: '2026-03-12T15:30', mode: 'datetime' })

    expect(rest(wrapper)).toBe('')
    expect(visible(wrapper)).toBe('12.03.2026 15:30')
  })

  test('every letter of the template takes the width of a digit, so it does not shift while typing', () => {
    const letters = field({ modelValue: '', mode: 'datetime' }).findAll('.dtf-cell--letter')

    expect(letters).toHaveLength(12)
    expect(letters.every((cell) => cell.find('.dtf-cell-zero').text() === '0')).toBe(true)
  })

  test('the input has no placeholder of its own and is labelled with the format', () => {
    const wrapper = field({ modelValue: '', mode: 'datetime', title: 'Окончание этапа' })

    expect(wrapper.get('input').attributes('placeholder')).toBeUndefined()
    expect(wrapper.get('input').attributes('aria-label')).toBe('Окончание этапа, ДД.ММ.ГГГГ ЧЧ:ММ')
  })
})

describe('DateTimeField picker', () => {
  async function opened(props: Record<string, unknown>) {
    const wrapper = field(props)
    await wrapper.get('.dtf-button').trigger('click')
    return wrapper
  }

  const pickDate = async (wrapper: Field, value: string | null) => {
    wrapper.getComponent(IonDatetime).vm.$emit('ion-change', { detail: { value } })
    await wrapper.vm.$nextTick()
  }

  const spinnerValues = (wrapper: Field) =>
    wrapper.findAll('.ts-value').map((input) => (input.element as HTMLInputElement).value).join(':')

  const done = (wrapper: Field) => wrapper.get('.ui-btn--primary').trigger('click')

  const typeInto = async (box: ReturnType<Field['get']>, chars: string) => {
    await box.trigger('focus')
    for (const char of chars) await box.trigger('input', { data: char, inputType: 'insertText' })
  }

  test('a datetime opens on the fallback without writing it into the model', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'datetime', fallback: '2026-03-12T15:30' })

    expect(wrapper.get('.picker').attributes('data-value')).toBe('2026-03-12')
    expect(spinnerValues(wrapper)).toBe('15:30')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(inputValue(wrapper)).toBe('')
  })

  test('the model wins over the fallback', async () => {
    const wrapper = await opened({
      modelValue: '2026-03-13T18:45',
      mode: 'datetime',
      fallback: '2026-03-12T15:30',
    })

    expect(wrapper.get('.picker').attributes('data-value')).toBe('2026-03-13')
    expect(spinnerValues(wrapper)).toBe('18:45')
  })

  test('an empty field opens the picker on the current moment', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'date' })

    expect(wrapper.get('.picker').attributes('data-value')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('only a date is a calendar, only a time is a spinner and a datetime is both', async () => {
    const date = await opened({ mode: 'date' })
    const time = await opened({ mode: 'time' })
    const both = await opened({ mode: 'datetime' })

    expect([date.find('.picker').exists(), date.find('.ts').exists()]).toEqual([true, false])
    expect([time.find('.picker').exists(), time.find('.ts').exists()]).toEqual([false, true])
    expect([both.find('.picker').exists(), both.find('.ts').exists()]).toEqual([true, true])
    expect(both.get('.picker').attributes('data-presentation')).toBe('date')
  })

  test('the calendar gets the date part of min', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'datetime', min: '2026-03-12T15:30' })

    expect(wrapper.get('.picker').attributes('data-min')).toBe('2026-03-12')
  })

  test('a date picked in the calendar is emitted on done', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'date' })

    await pickDate(wrapper, '2026-03-12T00:00:00')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await done(wrapper)

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-03-12']])
    expect(wrapper.emitted('change')).toEqual([['2026-03-12']])
  })

  test('a datetime combines the calendar day with the spinner time', async () => {
    const wrapper = await opened({ modelValue: '2026-03-12T10:00', mode: 'datetime' })

    await pickDate(wrapper, '2026-04-01T00:00:00')
    await typeInto(wrapper.findAll('.ts-value')[0]!, '18')
    await done(wrapper)

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-04-01T18:00']])
  })

  test('a time picked with a preset is emitted as HH:mm', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'time' })

    await wrapper.findAll('.ui-chip').find((chip) => chip.text() === ':30')!.trigger('click')
    await done(wrapper)

    expect(wrapper.emitted('update:modelValue')![0]![0]).toMatch(/^\d{2}:30$/)
  })

  test('done on an untouched picker commits what it showed', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'datetime', fallback: '2026-03-12T15:30' })

    await done(wrapper)

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-03-12T15:30']])
  })

  test('a time typed below min is raised to it', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'datetime', fallback: '2026-03-12T15:30', min: '2026-03-12T15:30' })

    await typeInto(wrapper.findAll('.ts-value')[0]!, '10')

    expect(spinnerValues(wrapper)).toBe('15:30')
  })

  test('closing the sheet keeps the model', async () => {
    const wrapper = await opened({ modelValue: '2026-03-12', mode: 'date' })

    await pickDate(wrapper, '2026-04-01T00:00:00')
    await wrapper.get('.ui-icon-btn[aria-label="Закрыть"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('clear empties the model', async () => {
    const wrapper = await opened({ modelValue: '2026-03-12', mode: 'date' })

    await wrapper.get('.ui-btn--ghost').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
  })

  test('the tomorrow chip keeps the chosen time', async () => {
    const wrapper = await opened({ modelValue: '2026-03-12T18:45', mode: 'datetime' })

    await wrapper.findAll('.ui-chip').find((chip) => chip.text() === 'Завтра')!.trigger('click')

    expect(spinnerValues(wrapper)).toBe('18:45')
    expect(wrapper.get('.picker').attributes('data-value')! > new Date().toISOString().slice(0, 10)).toBe(true)
  })

  test('the now chip sets both the day and the time', async () => {
    const wrapper = await opened({ modelValue: '2000-01-01T01:01', mode: 'datetime' })

    await wrapper.findAll('.ui-chip').find((chip) => chip.text() === 'Сейчас')!.trigger('click')

    expect(wrapper.get('.picker').attributes('data-value')).not.toBe('2000-01-01')
  })

  test('chips before the minimum are disabled', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'date', min: '2999-01-01' })

    expect(wrapper.findAll('.ui-chip').every((chip) => chip.attributes('disabled') !== undefined)).toBe(true)
  })

  test('a time field offers only "now"', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'time' })

    expect(wrapper.findAll('.dtf-quick .ui-chip').map((chip) => chip.text())).toEqual(['Сейчас'])
  })

  test('an explicit title replaces the default one', async () => {
    const wrapper = await opened({ modelValue: '', mode: 'datetime', title: 'Окончание этапа' })

    expect(wrapper.get('.dtf-sheet-title').text()).toBe('Окончание этапа')
  })
})
