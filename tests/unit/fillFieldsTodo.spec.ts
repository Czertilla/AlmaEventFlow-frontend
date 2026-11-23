import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { MyProfileReadV3, TodoItem } from '@/api/generated/almaEventFlow'
import FillFieldsTodo from '@/components/access/FillFieldsTodo.vue'
import { useMyProfileStore } from '@/stores/myProfile'
import { stubBackend } from './helpers/axiosStub'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))

const ABSENT = '/profile/v3/profiles/my/absent-fields'
const MY = '/profile/v3/profiles/my'

const Toggle = defineComponent({
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () =>
    h('input', {
      type: 'checkbox',
      class: 'toggle',
      checked: props.modelValue,
      onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked),
    }),
})

const stubs = { IonSpinner: true, IonToggle: Toggle, SearchPicker: true, DateTimeField: true }

const profile: MyProfileReadV3 = {
  id: 'p1', surname: 'Иванова', name: 'Анна', patronymic: null, birthdate: null,
  workplace_id: null, diet_id: null, diet: null, student: null, contacts: [], passports: [],
  created_at: '2026-11-01T10:00:00Z', edited_at: null,
}

const item: TodoItem = {
  id: 'fill_fields:c1', kind: 'fill_fields', collective_id: 'c1', collective_name: 'Хор',
  event: null, consent: null,
  fill: {
    fields: [
      { key: 'contact.tg', label: 'Telegram', optional: true },
      { key: 'student.group', label: 'Учебная группа', optional: true },
      { key: 'passport.number', label: 'Номер паспорта', optional: false },
    ],
  },
}

let backend: ReturnType<typeof stubBackend>

beforeEach(() => {
  setActivePinia(createPinia())
  backend = stubBackend((config) => (config.url === ABSENT ? { status: 200, data: { keys: [] } } : { status: 200, data: profile }))
  const store = useMyProfileStore()
  store.profile = profile
  store.loaded = true
})
afterEach(() => backend.restore())

describe('filling the fields of a policy in the checklist', () => {
  test('everything is asked in place, with no way out to the form', () => {
    const wrapper = mount(FillFieldsTodo, { props: { item }, global: { stubs } })
    expect(wrapper.text()).not.toContain('Подробной информации')
    expect(wrapper.text()).toContain('Я студент')
    expect(wrapper.findAll('button.ui-chip').map((b) => b.text())).toEqual(['Нет'])
  })

  test('what the person does not have is declared, nothing else is written', async () => {
    const wrapper = mount(FillFieldsTodo, { props: { item }, global: { stubs } })
    await wrapper.get('button.ui-chip').trigger('click')
    await wrapper.get('input.toggle').setValue(false)
    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click')
    await flushPromises()

    const declared = backend.to(ABSENT)
    expect(declared).toHaveLength(1)
    expect(JSON.parse(declared[0].data as string)).toEqual({ keys: ['contact.tg', 'student.group'] })
    expect(backend.to(MY)).toHaveLength(0)
    expect(wrapper.emitted('done')).toEqual([['fill_fields:c1']])
  })
})
