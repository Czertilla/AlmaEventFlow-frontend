import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import UiField from '@/components/common/UiField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiNativeSelect from '@/components/common/UiNativeSelect.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'

const mounted: ReturnType<typeof mount>[] = []

function track<T extends ReturnType<typeof mount>>(wrapper: T): T {
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

const stubs = { IonIcon: true }

describe('UiField', () => {
  const field = (props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) =>
    track(
      mount(UiField, {
        props,
        slots: { default: () => h('input', { class: 'ui-field-control' }), ...slots },
        attachTo: document.body,
        global: { stubs },
      }),
    )

  test('draws the label on the border and repeats it in the notch', () => {
    const wrapper = field({ label: 'Название' })

    expect(wrapper.get('.ui-field-label').text()).toBe('Название')
    expect(wrapper.get('.ui-field-outline legend span').text()).toBe('Название')
    expect(wrapper.get('.ui-field-outline').attributes('aria-hidden')).toBe('true')
    expect(wrapper.classes()).toContain('ui-field--labeled')
  })

  test('without a label there is no label and no notch', () => {
    const wrapper = field()

    expect(wrapper.find('.ui-field-label').exists()).toBe(false)
    expect(wrapper.find('legend').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('ui-field--labeled')
  })

  test('the label rests inside an empty field and floats when it is filled or forced', async () => {
    const wrapper = field({ label: 'Название' })
    expect(wrapper.classes()).not.toContain('ui-field--float')

    await wrapper.setProps({ filled: true })
    expect(wrapper.classes()).toContain('ui-field--float')

    await wrapper.setProps({ filled: false, float: true })
    expect(wrapper.classes()).toContain('ui-field--float')
  })

  test('focus inside the field floats the label and highlights it until focus leaves', async () => {
    const wrapper = field({ label: 'Название' })
    const input = wrapper.get('input')

    await input.trigger('focusin')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-field--focus', 'ui-field--float']))

    await input.trigger('focusout', { relatedTarget: null })
    expect(wrapper.classes()).not.toContain('ui-field--focus')
    expect(wrapper.classes()).not.toContain('ui-field--float')
  })

  test('focus moving to another element inside the field keeps it focused', async () => {
    const wrapper = field({ label: 'Дата' }, { suffix: () => h('button', { class: 'in-field' }) })

    await wrapper.get('input').trigger('focusin')
    await wrapper.get('input').trigger('focusout', { relatedTarget: wrapper.get('.in-field').element })

    expect(wrapper.classes()).toContain('ui-field--focus')
  })

  test('an error marks the field invalid and replaces the hint', () => {
    const wrapper = field({ label: 'Email', error: 'Неверный формат', hint: 'Подсказка' })

    expect(wrapper.classes()).toContain('ui-field--invalid')
    expect(wrapper.get('.ui-field-message').text()).toBe('Неверный формат')
    expect(wrapper.get('.ui-field-message').classes()).toContain('ui-field-message--error')
  })

  test('a success message is shown with its own colour, a hint stays neutral', async () => {
    const wrapper = field({ label: 'Username', success: 'Имя свободно' })
    expect(wrapper.get('.ui-field-message').classes()).toContain('ui-field-message--success')

    await wrapper.setProps({ success: '', hint: 'Подсказка' })
    expect(wrapper.get('.ui-field-message').classes()).not.toContain('ui-field-message--success')
    expect(wrapper.get('.ui-field-message').text()).toBe('Подсказка')
  })

  test('the counter sits in the footer and the prefix and suffix are placed around the control', () => {
    const wrapper = field(
      { label: 'Название', counter: '3 / 128' },
      { prefix: () => h('i', { class: 'pre' }), suffix: () => h('b', { class: 'suf' }) },
    )

    expect(wrapper.get('.ui-field-counter').text()).toBe('3 / 128')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-field--prefix', 'ui-field--suffix']))
    const order = [...wrapper.get('.ui-field-box').element.children].map((child) => child.className.split(' ')[0])
    expect(order.slice(0, 3)).toEqual(['ui-field-prefix', 'ui-field-main', 'ui-field-suffix'])
  })
})

describe('UiInput', () => {
  function host(initial = '', props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
    const model = ref(initial)
    const wrapper = track(
      mount(
        defineComponent({
          setup: () => () =>
            h(UiInput, {
              modelValue: model.value,
              'onUpdate:modelValue': (value: string) => {
                model.value = value
              },
              label: 'Название',
              ...props,
              ...attrs,
            }),
        }),
        { attachTo: document.body, global: { stubs } },
      ),
    )
    return { wrapper, model }
  }

  test('writes what is typed to the model', async () => {
    const { wrapper, model } = host('')
    await wrapper.get('input').setValue('Концерт')

    expect(model.value).toBe('Концерт')
  })

  test('the label floats once the model has a value', async () => {
    const { wrapper, model } = host('')
    expect(wrapper.get('.ui-field').classes()).not.toContain('ui-field--float')

    model.value = 'x'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.ui-field').classes()).toContain('ui-field--float')
  })

  test('a numeric zero counts as a value', () => {
    expect(host('0').wrapper.get('.ui-field').classes()).toContain('ui-field--float')
  })

  test('native attributes go to the input and class and style to the field', () => {
    const { wrapper } = host('', { maxlength: 5 }, { type: 'email', autocomplete: 'username', class: 'mine', style: 'width: 50%' })

    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('autocomplete')).toBe('username')
    expect(input.attributes('maxlength')).toBe('5')
    expect(input.classes()).toContain('ui-field-control')
    expect(wrapper.get('.ui-field').classes()).toContain('mine')
    expect(wrapper.get('.ui-field').attributes('style')).toContain('width: 50%')
    expect(input.classes()).not.toContain('mine')
  })

  test('event listeners reach the input', async () => {
    let blurred = 0
    const { wrapper } = host('', {}, { onBlur: () => blurred++ })

    await wrapper.get('input').trigger('blur')

    expect(blurred).toBe(1)
  })

  test('the counter shows the length against the limit', () => {
    const { wrapper } = host('abc', { maxlength: 128, counter: true })

    expect(wrapper.get('.ui-field-counter').text()).toBe('3 / 128')
  })

  test('the label is bound to the input', () => {
    const { wrapper } = host('')

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'))
  })

  test('focus is available from the outside', () => {
    const ref = { current: null as null | { focus: () => void } }
    track(
      mount(
        defineComponent({
          setup: () => () => h(UiInput, { label: 'x', ref: (el) => (ref.current = el as never) }),
        }),
        { attachTo: document.body, global: { stubs } },
      ),
    )

    ref.current?.focus()

    expect(document.activeElement?.tagName).toBe('INPUT')
  })
})

describe('UiTextarea', () => {
  test('keeps the text, the row count and the counter', async () => {
    const model = ref('')
    const wrapper = track(
      mount(
        defineComponent({
          setup: () => () =>
            h(UiTextarea, {
              modelValue: model.value,
              'onUpdate:modelValue': (value: string | null) => {
                model.value = value ?? ''
              },
              label: 'Описание',
              rows: 2,
              maxlength: 1024,
              counter: true,
            }),
        }),
        { attachTo: document.body, global: { stubs } },
      ),
    )

    await wrapper.get('textarea').setValue('Строка')

    expect(model.value).toBe('Строка')
    expect(wrapper.get('textarea').attributes('rows')).toBe('2')
    expect(wrapper.get('.ui-field-counter').text()).toBe('6 / 1024')
  })
})

describe('UiNativeSelect', () => {
  test('emits the value of the option with its original type', async () => {
    const emitted: unknown[] = []
    const wrapper = track(
      mount(
        defineComponent({
          setup: () => () =>
            h(
              UiNativeSelect,
              { modelValue: 1, label: 'Уровень', 'onUpdate:modelValue': (value: unknown) => emitted.push(value) },
              () => [h('option', { value: 1 }, 'Один'), h('option', { value: 2 }, 'Два')],
            ),
        }),
        { attachTo: document.body, global: { stubs } },
      ),
    )

    const select = wrapper.get('select')
    expect((select.element as HTMLSelectElement).value).toBe('1')
    ;(select.element as HTMLSelectElement).value = '2'
    await select.trigger('change')

    expect(emitted).toEqual([2])
    expect(wrapper.get('.ui-field').classes()).toContain('ui-field--float')
  })
})

describe('UiSelect', () => {
  const IonSelect = defineComponent({
    name: 'IonSelect',
    props: { value: [String, Number], placeholder: String, interface: String },
    emits: ['ion-change'],
    setup: (props, { slots }) => () =>
      h('div', { class: 'ion-select', 'data-value': props.value, 'data-interface': props.interface }, slots.default?.()),
  })

  test('the label is always on the border, the popover is the default interface and the change reaches the model', async () => {
    const emitted: unknown[] = []
    const wrapper = track(
      mount(UiSelect, {
        props: { modelValue: 'draft', label: 'Статус', 'onUpdate:modelValue': (value: unknown) => emitted.push(value) },
        attachTo: document.body,
        global: { stubs: { IonSelect, IonIcon: true } },
      }),
    )

    expect(wrapper.get('.ui-field').classes()).toContain('ui-field--float')
    expect(wrapper.get('.ion-select').attributes('data-value')).toBe('draft')
    expect(wrapper.get('.ion-select').attributes('data-interface')).toBe('popover')

    wrapper.getComponent(IonSelect).vm.$emit('ion-change', { detail: { value: 'active' } })

    expect(emitted).toEqual(['active'])
  })
})
