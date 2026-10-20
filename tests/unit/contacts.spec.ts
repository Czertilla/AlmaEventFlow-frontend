import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import ContactsEditor, { type ContactRow } from '@/components/profile/ContactsEditor.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import { CONTACT_KINDS, contactError, normalizeContact } from '@/utils/contactTypes'

describe('contact normalisation and checks', () => {
  test('a phone is written the same way whatever the user typed', () => {
    for (const typed of ['8 900 123-45-67', '+7 (900) 123 45 67', '79001234567', '9001234567']) {
      expect(normalizeContact('phone', typed)).toBe('+79001234567')
    }
    expect(normalizeContact('phone', '+44 20 7946 0958')).toBe('+442079460958')
    expect(contactError('phone', '12345')).not.toBeNull()
    expect(contactError('phone', '8 900 123-45-67')).toBeNull()
  })

  test('an email must look like one', () => {
    expect(contactError('email', 'maria@example.com')).toBeNull()
    expect(contactError('email', 'maria@example')).not.toBeNull()
    expect(contactError('email', 'maria example.com')).not.toBeNull()
  })

  test('Telegram and VK accept a name, a handle or a link', () => {
    expect(normalizeContact('tg', 'https://t.me/maria_i')).toBe('@maria_i')
    expect(normalizeContact('tg', 'maria_i')).toBe('@maria_i')
    expect(contactError('tg', 'maria_i')).toBeNull()
    expect(contactError('tg', '@ab')).not.toBeNull()
    expect(normalizeContact('vk', 'vk.com/maria.i')).toBe('https://vk.com/maria.i')
    expect(normalizeContact('vk', 'id12345')).toBe('https://vk.com/id12345')
    expect(contactError('vk', 'id12345')).toBeNull()
    expect(contactError('vk', '!')).not.toBeNull()
  })

  test('an address needs to be written out and an empty value is refused for any type', () => {
    expect(contactError('address', 'Москва')).toBeNull()
    expect(contactError('address', 'дом')).not.toBeNull()
    expect(contactError('email', '   ')).not.toBeNull()
  })
})

test('the kinds carry the names a person would use', () => {
  expect(Object.values(CONTACT_KINDS).map((kind) => kind.label)).toEqual([
    'Электронная почта', 'Телефон', 'Telegram', 'ВКонтакте', 'Адрес',
  ])
})

describe('ContactsEditor', () => {
  const mounted: VueWrapper[] = []
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
    document.body.innerHTML = ''
  })

  function open(rows: ContactRow[] = [], accountEmail: string | null = 'maria@example.com') {
    const model = ref<ContactRow[]>(rows)
    const Host = defineComponent({
      setup: () => () => h(ContactsEditor, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: ContactRow[]) => { model.value = value },
        accountEmail,
      }),
    })
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [createPinia()], stubs: { IonIcon: true } } })
    mounted.push(wrapper)
    return { wrapper, model }
  }

  async function choose(wrapper: VueWrapper, type: string) {
    wrapper.findComponent(UiSelect).vm.$emit('update:modelValue', type)
    await wrapper.vm.$nextTick()
  }

  const valueInput = (wrapper: VueWrapper) => wrapper.find('.ce-draft input')
  const buttons = (wrapper: VueWrapper, text: string) => wrapper.findAll('button').filter((b) => b.text().includes(text))
  const labelOf = (wrapper: VueWrapper) => wrapper.find('.ce-draft label').text()

  async function openHelp(wrapper: VueWrapper) {
    await wrapper.find('.ce-draft .ui-help').trigger('click')
    return document.body.querySelector('.ui-help-tip')?.textContent ?? ''
  }

  test('only the "add contact" selector is shown until a kind is chosen, with nothing explaining it', () => {
    const { wrapper } = open()

    expect(wrapper.findComponent(UiSelect).props('label')).toBe('Добавить контакт')
    expect(wrapper.findComponent(UiSelect).props('placeholder')).toBeUndefined()
    expect(wrapper.find('.ce-draft').exists()).toBe(false)
    expect(wrapper.find('.ce-list').exists()).toBe(false)
    expect(wrapper.find('.ui-field-foot').exists()).toBe(false)
  })

  test('choosing a kind turns the selector into a field named after it', async () => {
    const { wrapper } = open([], null)

    await choose(wrapper, 'email')

    expect(wrapper.findComponent(UiSelect).exists()).toBe(false)
    expect(labelOf(wrapper)).toBe('Электронная почта')
    expect(valueInput(wrapper).attributes('type')).toBe('email')
    expect(wrapper.find('.ce-draft').text()).not.toContain('станет основн')
  })

  test('the field built for a kind has its own input type and example, and says behind a help button that the first one becomes the main one', async () => {
    const { wrapper } = open([], null)

    await choose(wrapper, 'phone')

    expect(valueInput(wrapper).attributes('type')).toBe('tel')
    expect(valueInput(wrapper).attributes('placeholder')).toBe('+7 900 123-45-67')
    expect(await openHelp(wrapper)).toContain('Станет основным')
  })

  test('an invalid value is not added and says why; a good one is added in its canonical form as the main one', async () => {
    const { wrapper, model } = open([], null)
    await choose(wrapper, 'phone')

    await valueInput(wrapper).setValue('12345')
    await buttons(wrapper, 'Добавить')[0].trigger('click')
    expect(model.value).toEqual([])
    expect(wrapper.text()).toContain('10–15 цифр')

    await valueInput(wrapper).setValue('8 900 123-45-67')
    await buttons(wrapper, 'Добавить')[0].trigger('click')

    expect(model.value).toMatchObject([{ type: 'phone', value: '+79001234567', is_main: true }])
    expect(wrapper.find('.ce-draft').exists()).toBe(false)
  })

  test('a second contact of a kind is not the main one and the hint says the main one stays', async () => {
    const { wrapper, model } = open([{ key: 1, type: 'tg', value: '@maria_i', is_main: true }], null)
    await choose(wrapper, 'tg')

    expect(await openHelp(wrapper)).toContain('Основным останется прежний')
    await valueInput(wrapper).setValue('@second_one')
    await buttons(wrapper, 'Добавить')[0].trigger('click')

    expect(model.value.map((row) => [row.value, row.is_main])).toEqual([['@maria_i', true], ['@second_one', false]])
  })

  test('the same contact is not added twice', async () => {
    const { wrapper, model } = open([{ key: 1, type: 'tg', value: '@maria_i', is_main: true }], null)
    await choose(wrapper, 'tg')

    await valueInput(wrapper).setValue('https://t.me/maria_i')
    await buttons(wrapper, 'Добавить')[0].trigger('click')

    expect(model.value).toHaveLength(1)
    expect(wrapper.text()).toContain('Такой контакт уже есть')
  })

  test('the main contact of a kind can be changed and passes to the next one when removed', async () => {
    const { wrapper, model } = open([
      { key: 1, type: 'email', value: 'a@example.com', is_main: true },
      { key: 2, type: 'email', value: 'b@example.com', is_main: false },
      { key: 3, type: 'phone', value: '+79001234567', is_main: true },
    ], null)

    await wrapper.findAll('button[aria-label="Сделать основным"]')[0].trigger('click')
    expect(model.value.map((row) => row.is_main)).toEqual([false, true, true])

    await wrapper.findAll('button[aria-label="Убрать контакт"]')[1].trigger('click')
    expect(model.value.map((row) => [row.value, row.is_main])).toEqual([['a@example.com', true], ['+79001234567', true]])
  })

  test('the email of the account is offered, prefilled for the email kind and added in one tap', async () => {
    const { wrapper, model } = open([], 'maria@example.com')

    await choose(wrapper, 'email')
    expect((valueInput(wrapper).element as HTMLInputElement).value).toBe('maria@example.com')

    await wrapper.find('.ce-actions button.ui-btn--ghost').trigger('click')
    await buttons(wrapper, 'Добавить почту аккаунта')[0].trigger('click')

    expect(model.value).toMatchObject([{ type: 'email', value: 'maria@example.com', is_main: true }])
    expect(buttons(wrapper, 'Добавить почту аккаунта')).toHaveLength(0)
  })
})
