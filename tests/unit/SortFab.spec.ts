import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import SortFab from '@/components/common/SortFab.vue'

const OPTIONS = [
  { value: 'date', label: 'По дате' },
  { value: 'name', label: 'По названию' },
]

const mounted: VueWrapper[] = []

function fab(props: Record<string, unknown> = {}) {
  const wrapper = mount(SortFab, {
    props: { options: OPTIONS, modelValue: 'date', order: 'asc', ...props },
    attachTo: document.body,
    global: { stubs: { IonIcon: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

const labels = () => [...document.body.querySelectorAll('.ui-option')].map((node) => node.textContent?.trim())
const row = (index: number) => document.body.querySelectorAll<HTMLElement>('.ui-option')[index]!

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('SortFab', () => {
  test('is a closed floating button until tapped', () => {
    const wrapper = fab()

    expect(wrapper.get('button.app-fab').attributes('aria-label')).toBe('Сортировка')
    expect(labels()).toEqual([])
  })

  test('lists the sorts and the direction, marking the sort in use', async () => {
    const wrapper = fab()

    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()

    expect(labels()).toEqual(['По дате', 'По названию', 'По возрастанию'])
    expect(row(0).classList).toContain('ui-option--selected')
    expect(row(1).classList).not.toContain('ui-option--selected')
  })

  test('shows the direction the list is in', async () => {
    const wrapper = fab({ order: 'desc' })

    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()

    expect(labels()[2]).toBe('По убыванию')
  })

  test('picking a sort reports it and closes the menu', async () => {
    const wrapper = fab()
    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()

    row(1).click()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['name']])
    expect(labels()).toEqual([])
  })

  test('the direction row flips the order and leaves the menu open', async () => {
    const wrapper = fab()
    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()

    row(2).click()
    await nextTick()

    expect(wrapper.emitted('update:order')).toEqual([['desc']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(labels()).toHaveLength(3)
  })

  test('without a sort chosen the direction row is dimmed and does nothing', async () => {
    const wrapper = fab({ modelValue: '' })
    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()

    expect(row(2).classList).toContain('ui-option--disabled')
    row(2).click()
    await nextTick()

    expect(wrapper.emitted('update:order')).toBeUndefined()
    expect(labels()).toHaveLength(3)
  })

  test('a second tap on the button closes the menu', async () => {
    const wrapper = fab()
    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()
    expect(labels()).toHaveLength(3)

    await wrapper.get('button.app-fab').trigger('click')
    await nextTick()

    expect(labels()).toEqual([])
  })

  test('stays on screen while its menu is open even if the bar is tucked away', async () => {
    const wrapper = fab({ tucked: true })
    expect(wrapper.get('button.app-fab').classes()).toContain('app-fab--tucked')

    await wrapper.get('button.app-fab').trigger('click')

    expect(wrapper.get('button.app-fab').classes()).not.toContain('app-fab--tucked')
  })
})
