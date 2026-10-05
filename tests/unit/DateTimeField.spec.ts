import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { defineComponent, h } from 'vue'
import DateTimeField from '@/components/common/DateTimeField.vue'

const IonDatetime = defineComponent({
  name: 'IonDatetime',
  props: { value: String, min: String, presentation: String },
  emits: ['ion-change'],
  setup: (props) => () => h('div', { class: 'picker', 'data-value': props.value, 'data-min': props.min }),
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

async function type(wrapper: ReturnType<typeof field>, value: string, inputType = 'insertText') {
  const input = wrapper.get('input')
  const element = input.element as HTMLInputElement
  element.value = value
  element.setSelectionRange(value.length, value.length)
  await input.trigger('input', { inputType })
}

describe('DateTimeField typing', () => {
  test('shows the model in the display format', () => {
    expect(field({ modelValue: '2026-03-12T15:30', mode: 'datetime' }).get('input').element.value).toBe(
      '12.03.2026 15:30',
    )
  })

  test('emits only once the date is complete and real', async () => {
    const wrapper = field({ modelValue: '', mode: 'date' })

    await type(wrapper, '1203')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await type(wrapper, '12032026')
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-03-12']])
    expect(wrapper.emitted('change')).toEqual([['2026-03-12']])
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('12.03.2026')
  })

  test('an impossible date is flagged and never emitted', async () => {
    const wrapper = field({ modelValue: '', mode: 'date' })

    await type(wrapper, '31022026')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('input').classes()).toContain('dtf-input--invalid')
  })

  test('leaving an incomplete value restores the model', async () => {
    const wrapper = field({ modelValue: '2026-03-12', mode: 'date' })

    await type(wrapper, '1203')
    await wrapper.get('input').trigger('blur')

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('12.03.2026')
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

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('31.12.2026')
  })
})

describe('DateTimeField picker', () => {
  test('opens on the fallback without writing it into the model', async () => {
    const wrapper = field({ modelValue: '', mode: 'datetime', fallback: '2026-03-12T15:30' })

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('.picker').attributes('data-value')).toBe('2026-03-12T15:30')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })

  test('the model wins over the fallback', () => {
    const wrapper = field({
      modelValue: '2026-03-13T18:45',
      mode: 'datetime',
      fallback: '2026-03-12T15:30',
    })

    expect(wrapper.get('.picker').attributes('data-value')).toBe('2026-03-13T18:45')
  })

  test('an empty field opens the picker on the current moment', () => {
    const wrapper = field({ modelValue: '', mode: 'date' })

    expect(wrapper.get('.picker').attributes('data-value')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('forwards min to the picker', () => {
    const wrapper = field({ modelValue: '', mode: 'datetime', min: '2026-03-12T15:30' })

    expect(wrapper.get('.picker').attributes('data-min')).toBe('2026-03-12T15:30')
  })

  test.each([
    ['date', '2026-03-12T00:00:00', '2026-03-12'],
    ['datetime', '2026-03-12T18:45:00', '2026-03-12T18:45'],
    ['time', '2026-03-12T18:45:00', '18:45'],
  ] as const)('a %s picked in the picker is emitted in the model format', async (mode, picked, expected) => {
    const wrapper = field({ modelValue: '', mode })

    wrapper.getComponent(IonDatetime).vm.$emit('ion-change', { detail: { value: picked } })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([[expected]])
    expect(wrapper.emitted('change')).toEqual([[expected]])
  })

  test('clearing in the picker empties the model', async () => {
    const wrapper = field({ modelValue: '2026-03-12', mode: 'date' })

    wrapper.getComponent(IonDatetime).vm.$emit('ion-change', { detail: { value: null } })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
  })
})
