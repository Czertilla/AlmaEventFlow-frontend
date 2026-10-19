import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import MultiSearchField from '@/components/admin/MultiSearchField.vue'

const SINGER = { id: 'r1', name: 'Солист' }
const CHOIR = { id: 'r2', name: 'Хорист' }
const DRUMMER = { id: 'r3', name: 'Барабанщик' }

const mounted: VueWrapper[] = []
const fetchChoices = vi.fn()

function field(props: Record<string, unknown> = {}) {
  const wrapper = mount(MultiSearchField, {
    props: { modelValue: [], label: 'Роли', fetch: fetchChoices, ...props },
    attachTo: document.body,
    global: { stubs: { IonIcon: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

const options = () => [...document.body.querySelectorAll('.ui-option')].map((node) => node.textContent?.trim())

beforeEach(() => {
  vi.useFakeTimers()
  fetchChoices.mockReset()
  fetchChoices.mockResolvedValue([SINGER, CHOIR, DRUMMER])
})

afterEach(() => {
  vi.useRealTimers()
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('MultiSearchField', () => {
  test('shows what is chosen as chips and removes one on a tap', async () => {
    const wrapper = field({ modelValue: [SINGER, CHOIR] })

    expect(wrapper.findAll('.msf-chip').map((chip) => chip.text())).toEqual(['Солист', 'Хорист'])
    await wrapper.get('button[aria-label="Убрать: Солист"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[[CHOIR]]])
  })

  test('offers the choices as soon as the field gets the focus', async () => {
    const wrapper = field()

    await wrapper.get('input').trigger('focus')
    await flushPromises()

    expect(fetchChoices).toHaveBeenCalledWith('')
    expect(options()).toEqual(['Солист', 'Хорист', 'Барабанщик'])
  })

  test('does not offer what is already chosen', async () => {
    const wrapper = field({ modelValue: [CHOIR] })

    await wrapper.get('input').trigger('focus')
    await flushPromises()

    expect(options()).toEqual(['Солист', 'Барабанщик'])
  })

  test('picking an option adds it after the chosen ones', async () => {
    const wrapper = field({ modelValue: [SINGER] })
    await wrapper.get('input').trigger('focus')
    await flushPromises()

    ;(document.body.querySelectorAll('.ui-option')[0] as HTMLElement).click()

    expect(wrapper.emitted('update:modelValue')).toEqual([[[SINGER, CHOIR]]])
  })

  test('typing searches again after the pause', async () => {
    const wrapper = field()

    await wrapper.get('input').setValue('Бар')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(fetchChoices).toHaveBeenCalledWith('Бар')
  })

  test('a failed search leaves an empty list instead of an error', async () => {
    fetchChoices.mockRejectedValue(new Error('offline'))
    const wrapper = field()

    await wrapper.get('input').trigger('focus')
    await flushPromises()
    await nextTick()

    expect(options()).toEqual([])
  })

  test('a blocked field cannot be typed into and says why', async () => {
    const wrapper = field({ disabled: true, hint: 'Сначала выберите коллектив' })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Сначала выберите коллектив')
  })
})
