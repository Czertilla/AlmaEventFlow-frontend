import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import SlidingTabs from '@/components/common/SlidingTabs.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import UiSelectPill from '@/components/common/UiSelectPill.vue'
import { optionsFromPairs, withAny } from '@/utils/selectOptions'

const stubs = { IonIcon: true }
const mounted: VueWrapper[] = []

function track<T extends VueWrapper>(wrapper: T): T {
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

const OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'active', label: 'Активно' },
  { value: 'archived', label: 'Архив', disabled: true },
]

function select(props: Record<string, unknown> = {}) {
  return track(
    mount(UiSelect, {
      props: { options: OPTIONS, label: 'Статус', ...props },
      attachTo: document.body,
      global: { stubs },
    }),
  )
}

const menu = () => document.body.querySelector<HTMLElement>('.ui-select-menu')
const optionEls = () => Array.from(document.body.querySelectorAll<HTMLElement>('.ui-option'))

describe('UiSelect', () => {
  test('shows the label of the selected option and keeps the label on the border', () => {
    const wrapper = select({ modelValue: 'active' })

    expect(wrapper.get('.ui-select-value').text()).toBe('Активно')
    expect(wrapper.get('.ui-field').classes()).toContain('ui-field--float')
  })

  test('shows the placeholder while nothing is selected', () => {
    const wrapper = select({ modelValue: undefined, placeholder: 'Не выбран' })

    expect(wrapper.get('.ui-select-placeholder').text()).toBe('Не выбран')
  })

  test('opens a listbox of the options in the page body and marks the selected one', async () => {
    const wrapper = select({ modelValue: 'active' })

    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(menu()).not.toBeNull()
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['Черновик', 'Активно', 'Архив'])
    expect(optionEls()[1].classList.contains('ui-option--selected')).toBe(true)
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
  })

  test('picking an option emits the value with its original type and closes the list', async () => {
    const wrapper = select({ modelValue: 1, options: [{ value: 1, label: 'Один' }, { value: 2, label: 'Два' }] })

    await wrapper.get('button').trigger('click')
    await nextTick()
    optionEls()[1].click()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
    expect(menu()).toBeNull()
  })

  test('a disabled option cannot be picked', async () => {
    const wrapper = select({ modelValue: 'draft' })

    await wrapper.get('button').trigger('click')
    await nextTick()
    optionEls()[2].click()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(menu()).not.toBeNull()
  })

  test('arrow keys move through the options, skipping disabled ones, and Enter picks', async () => {
    const wrapper = select({ modelValue: 'draft' })
    const trigger = wrapper.get('button')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['active']])
  })

  test('Escape closes the list without changing the value', async () => {
    const wrapper = select({ modelValue: 'draft' })
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await trigger.trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(menu()).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('typing a letter jumps to the matching option', async () => {
    const wrapper = select({ modelValue: 'draft' })
    const trigger = wrapper.get('button')

    await trigger.trigger('keydown', { key: 'а' })
    await trigger.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['active']])
  })

  test('a disabled select does not open', async () => {
    const wrapper = select({ modelValue: 'draft', disabled: true })

    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(menu()).toBeNull()
  })

  test('shows a message instead of an empty list', async () => {
    const wrapper = select({ options: [] })

    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(menu()?.textContent).toContain('Нет вариантов')
  })
})

describe('UiSelectPill', () => {
  function pill(props: Record<string, unknown> = {}) {
    return track(
      mount(UiSelectPill, {
        props: { options: OPTIONS, ariaLabel: 'Сортировка', ...props },
        slots: { default: '<button class="extra">dir</button>' },
        attachTo: document.body,
        global: { stubs },
      }),
    )
  }

  test('renders the selected label and keeps the slot content inside the pill', () => {
    const wrapper = pill({ modelValue: 'active' })

    expect(wrapper.get('.ui-select-pill-value').text()).toBe('Активно')
    expect(wrapper.get('.ui-select-pill .extra').exists()).toBe(true)
  })

  test('picking an option emits the value', async () => {
    const wrapper = pill({ modelValue: 'draft' })

    await wrapper.get('.ui-select-pill-btn').trigger('click')
    await nextTick()
    optionEls()[1].click()

    expect(wrapper.emitted('update:modelValue')).toEqual([['active']])
  })
})

describe('select options helpers', () => {
  test('withAny puts the empty choice first', () => {
    const options = withAny(optionsFromPairs([['a', 'A']] as const), '' as string, 'Любой')

    expect(options).toEqual([{ value: '', label: 'Любой' }, { value: 'a', label: 'A' }])
  })
})

describe('SlidingTabs', () => {
  const TABS = [
    { key: 'a', label: 'Первая' },
    { key: 'b', label: 'Вторая' },
  ]

  test('marks the active tab and emits the clicked one', async () => {
    const wrapper = track(
      mount(SlidingTabs, { props: { tabs: TABS, modelValue: 'a' }, attachTo: document.body, global: { stubs } }),
    )

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[1].attributes('aria-selected')).toBe('false')

    await tabs[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  test('has a pill that follows the active tab', () => {
    const wrapper = track(
      mount(SlidingTabs, { props: { tabs: TABS, modelValue: 'b' }, attachTo: document.body, global: { stubs } }),
    )

    expect(wrapper.find('.sliding-tabs-pill').exists()).toBe(true)
  })
})
