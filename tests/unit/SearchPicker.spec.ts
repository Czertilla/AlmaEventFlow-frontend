import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import SearchPicker from '@/components/admin/SearchPicker.vue'

const mounted: ReturnType<typeof mount>[] = []
const GROUPS = [{ id: 1, name: 'ИС-21' }, { id: 2, name: 'ИС-22' }]

function picker(props: Record<string, unknown> = {}) {
  const fetch = vi.fn(async (search: string) => GROUPS.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())))
  const wrapper = mount(SearchPicker, {
    props: { modelValue: null, label: 'Группа', fetch, numeric: true, ...props },
    attachTo: document.body,
    global: { stubs: { IonIcon: true } },
  })
  mounted.push(wrapper)
  return { wrapper, fetch }
}

const options = () => [...document.body.querySelectorAll('.ui-option')].map((node) => node.textContent?.trim() ?? '')
const clickFirst = () => document.body.querySelector<HTMLElement>('.ui-option')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

async function type(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.get('input').setValue(text)
  vi.advanceTimersByTime(300)
  await flushPromises()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('SearchPicker', () => {
  test('without creatable there is nothing to add', async () => {
    const { wrapper } = picker()

    await type(wrapper, 'ИС-23')

    expect(options()).toEqual([])
  })

  test('creatable offers to add what was typed and hands it over as a draft, not an id', async () => {
    const { wrapper } = picker({ creatable: true })

    await type(wrapper, 'ИС-23')
    expect(options()).toEqual(['Добавить «ИС-23»'])
    clickFirst()

    expect(wrapper.emitted('update:draft')).toEqual([['ИС-23']])
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })

  test('a name that already exists is not offered again and an existing pick clears the draft', async () => {
    const { wrapper } = picker({ creatable: true })

    await type(wrapper, 'ис-21')
    expect(options()).toEqual(['ИС-21'])
    clickFirst()

    expect(wrapper.emitted('update:draft')).toEqual([[null]])
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([1, GROUPS[0]])
  })

  test('browse lists the options on focus without typing', async () => {
    const { wrapper, fetch } = picker({ browse: true })

    await wrapper.get('input').trigger('focus')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('')
    expect(options()).toEqual(['ИС-21', 'ИС-22'])
  })

  test('a draft is shown as a new record and a locked value cannot be cleared', async () => {
    const draft = picker({ draft: 'ИС-23', creatable: true })
    expect(draft.wrapper.get('.ui-field-value').text()).toContain('ИС-23 (новая запись)')

    const locked = picker({ modelValue: 5, initialLabel: 'ИС-25', locked: true, hint: 'Берётся из группы' })
    await flushPromises()

    expect(locked.wrapper.get('.ui-field-value').text()).toBe('ИС-25')
    expect(locked.wrapper.find('button.ui-icon-btn--danger').exists()).toBe(false)
  })
})
