import { mount } from '@vue/test-utils'
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

  test('options are listed and picking one emits it', async () => {
    const options = [
      { id: '1', name: 'Университет' },
      { id: '2', name: 'Колледж' },
    ]
    const wrapper = picker({ options })

    expect(wrapper.findAll('.ui-menu-item').map((item) => item.text())).toEqual(['Университет', 'Колледж'])
    await wrapper.findAll('.ui-menu-item')[1]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[options[1]]])
  })

  test('a selected value replaces the search and can be cleared', async () => {
    const wrapper = picker({ selected: { id: '1', name: 'Университет' }, clearLabel: 'Убрать организатора' })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('.ui-field-value').text()).toBe('Университет')
    expect(wrapper.get('.ui-field').classes()).toContain('ui-field--float')

    await wrapper.get('button[aria-label="Убрать организатора"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  test('an empty list shows no menu', () => {
    expect(picker().find('.ui-menu').exists()).toBe(false)
  })
})
