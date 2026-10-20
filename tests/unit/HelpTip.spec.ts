import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { h, nextTick } from 'vue'
import HelpTip from '@/components/common/HelpTip.vue'
import UiField from '@/components/common/UiField.vue'
import { useSettingsStore } from '@/stores/settings'

const mounted: VueWrapper[] = []

function open(props: Record<string, unknown> = { text: 'Первый контакт станет основным' }) {
  const wrapper = mount(HelpTip, { props, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

const tip = () => document.body.querySelector('.ui-help-tip')

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('HelpTip', () => {
  test('is a closed round button until it is pressed', async () => {
    const wrapper = open()

    const button = wrapper.get('button.ui-help')
    expect(button.text()).toBe('?')
    expect(button.attributes('aria-label')).toBe('Подсказка')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(tip()).toBeNull()

    await button.trigger('click')

    expect(tip()?.textContent).toContain('Первый контакт станет основным')
    expect(tip()?.getAttribute('role')).toBe('tooltip')
    expect(button.attributes('aria-expanded')).toBe('true')
  })

  test('a second press, a press elsewhere and Escape close it', async () => {
    const wrapper = open()
    const button = wrapper.get('button.ui-help')

    await button.trigger('click')
    await button.trigger('click')
    expect(tip()).toBeNull()

    await button.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(tip()).toBeNull()

    await button.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(tip()).toBeNull()
  })

  test('a press inside the bubble keeps it open, so its text can be selected', async () => {
    const wrapper = open()
    await wrapper.get('button.ui-help').trigger('click')

    tip()!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(tip()).not.toBeNull()
  })

  test('the slot takes the place of the text', async () => {
    const wrapper = mount(HelpTip, { slots: { default: () => [h('p', 'Первый абзац'), h('p', 'Второй абзац')] }, attachTo: document.body })
    mounted.push(wrapper)

    await wrapper.get('button.ui-help').trigger('click')

    expect([...tip()!.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Первый абзац', 'Второй абзац'])
  })

  test('draws nothing when hints are turned off, and closes an open one at that moment', async () => {
    const wrapper = open()
    const settings = useSettingsStore()
    await wrapper.get('button.ui-help').trigger('click')

    settings.showHints = false
    await nextTick()

    expect(tip()).toBeNull()
    expect(wrapper.find('button.ui-help').exists()).toBe(false)

    settings.showHints = true
    await nextTick()
    expect(wrapper.find('button.ui-help').exists()).toBe(true)
  })
})

describe('the hints setting', () => {
  test('is on by default and remembered', async () => {
    const settings = useSettingsStore()
    expect(settings.showHints).toBe(true)

    settings.showHints = false
    await nextTick()

    expect(localStorage.getItem('showHints')).toBe('false')
    setActivePinia(createPinia())
    expect(useSettingsStore().showHints).toBe(false)
  })
})

describe('a field with a help button', () => {
  const field = (props: Record<string, unknown>) => {
    const wrapper = mount(UiField, {
      props,
      slots: { default: () => h('input', { class: 'ui-field-control' }) },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    return wrapper
  }

  test('carries the button inside its box and the text behind it', async () => {
    const wrapper = field({ label: 'Группа', help: 'Если группа есть в списке, остальное подставится само' })

    expect(wrapper.classes()).toContain('ui-field--help')
    await wrapper.get('.ui-field-box .ui-field-help button.ui-help').trigger('click')
    expect(tip()?.textContent).toContain('подставится само')
  })

  test('has no button without a help text, and no gap left when hints are off', () => {
    expect(field({ label: 'Группа' }).find('.ui-field-help').exists()).toBe(false)

    useSettingsStore().showHints = false
    const hidden = field({ label: 'Группа', help: 'Текст' })

    expect(hidden.find('button.ui-help').exists()).toBe(false)
    expect(hidden.get('.ui-field-help').element.childNodes.length).toBe(1)
    expect(hidden.get('.ui-field-help').element.childNodes[0].nodeType).toBe(Node.COMMENT_NODE)
  })

  test('focusing the button does not make the field look focused', async () => {
    const wrapper = field({ label: 'Группа', help: 'Текст' })

    await wrapper.get('button.ui-help').trigger('focusin')
    expect(wrapper.classes()).not.toContain('ui-field--focus')

    await wrapper.get('input').trigger('focusin')
    expect(wrapper.classes()).toContain('ui-field--focus')
  })
})
