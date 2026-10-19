import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import EntityPickerField from '@/components/common/EntityPickerField.vue'

const mounted: ReturnType<typeof mount>[] = []

function picker(props: Record<string, unknown> = {}) {
  const wrapper = mount(EntityPickerField, {
    props: {
      label: 'Организатор',
      search: '',
      options: [],
      selected: null,
      ...props,
    },
    attachTo: document.body,
    global: { stubs: { IonIcon: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

function items(): string[] {
  return [...document.body.querySelectorAll('.ui-option')].map((node) => node.textContent?.trim() ?? '')
}

function row(index: number): HTMLElement {
  return document.body.querySelectorAll<HTMLElement>('.ui-option')[index]!
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('EntityPickerField', () => {
  test('typing updates the query at once and asks for a search after the pause', async () => {
    const wrapper = picker({ debounce: 400 })

    await wrapper.get('input').setValue('Уни')
    expect(wrapper.emitted('update:search')).toEqual([['Уни']])
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(399)
    expect(wrapper.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  test('keystrokes inside the pause produce a single search', async () => {
    const wrapper = picker({ debounce: 300 })
    const input = wrapper.get('input')

    await input.setValue('У')
    vi.advanceTimersByTime(200)
    await input.setValue('Ун')
    vi.advanceTimersByTime(200)
    await input.setValue('Уни')
    vi.advanceTimersByTime(300)

    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  test('options float over the page and picking one emits it', async () => {
    const options = [
      { id: '1', name: 'Университет' },
      { id: '2', name: 'Колледж' },
    ]
    const wrapper = picker({ options })
    await nextTick()

    expect(wrapper.find('.ui-menu').exists()).toBe(false)
    expect(items()).toEqual(['Университет', 'Колледж'])
    await row(1).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('select')).toEqual([[options[1]]])
  })

  test('arrows move through the options and Enter picks the active one', async () => {
    const options = [
      { id: '1', name: 'Университет' },
      { id: '2', name: 'Колледж' },
    ]
    const wrapper = picker({ options })
    const input = wrapper.get('input')

    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toBeUndefined()

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(row(1).classList).toContain('ui-option--active')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('select')).toEqual([[options[1]]])
  })

  test('Escape and a press outside close the list, typing or focus brings it back', async () => {
    const wrapper = picker({ options: [{ id: '1', name: 'Университет' }] })
    const input = wrapper.get('input')
    await nextTick()
    expect(items()).toHaveLength(1)

    await input.trigger('keydown', { key: 'Escape' })
    expect(items()).toHaveLength(0)

    await input.trigger('focus')
    expect(items()).toHaveLength(1)

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(items()).toHaveLength(0)

    await input.setValue('Кол')
    expect(items()).toHaveLength(1)
  })

  test('a selected value replaces the search and can be cleared', async () => {
    const wrapper = picker({ selected: { id: '1', name: 'Университет' }, clearLabel: 'Убрать организатора' })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('.ui-field-value').text()).toBe('Университет')
    expect(wrapper.get('.ui-field').classes()).toContain('ui-field--float')

    await wrapper.get('button[aria-label="Убрать организатора"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  test('an empty list shows no menu', async () => {
    picker()
    await nextTick()

    expect(items()).toHaveLength(0)
  })
})
