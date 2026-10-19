import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, onMounted, type Component } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { stubBackend, type Reply } from './helpers/axiosStub'

const push = vi.fn()
let ProfileFormPage: Component

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@ionic/vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/vue')>()),
  onIonViewWillEnter: (hook: () => void) => onMounted(hook),
  toastController: { create: vi.fn(async () => ({ present: vi.fn() })) },
}))

const Pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const stubs = {
  IonPage: Pass, IonContent: Pass, IonHeader: true, IonIcon: true, IonSpinner: true, IonBackButton: true,
  IonToggle: defineComponent({
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', {
      type: 'checkbox', class: 'toggle', checked: props.modelValue,
      onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked),
    }),
  }),
}

const PROFILE = {
  id: 'p1', surname: 'Иванова', name: 'Мария', patronymic: 'Сергеевна', birthdate: '2004-05-06', workplace_id: null,
  diet_id: null, diet: null, created_at: '2026-10-20T10:00:00Z', edited_at: null,
  student: { student_id: 'S-77', group_id: 11, faculty_id: null, is_budget: true, is_full: false, is_active: true, group: null },
  contacts: [{ id: 'c1', type: 'email', value: 'm@example.com', is_main: true }],
}

describe('profile form', () => {
  const mounted: VueWrapper[] = []

  beforeAll(async () => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    ProfileFormPage = (await import('@/views/ProfileFormPage.vue')).default
  }, 120000)

  let backend: ReturnType<typeof stubBackend>
  let existing: typeof PROFILE | null

  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
    existing = null
    backend = stubBackend((config): Reply => {
      if (config.url === '/profile/v2/profiles/my') {
        if (config.method === 'get') return existing ? { status: 200, data: existing } : { status: 404, data: { detail: 'PROFILE_NOT_FOUND' } }
        return { status: 200, data: PROFILE }
      }
      return { status: 200, data: { items: [], pagination: {} } }
    })
  })
  afterEach(() => {
    backend.restore()
    while (mounted.length) mounted.pop()!.unmount()
  })

  async function open() {
    const wrapper = mount(ProfileFormPage, { attachTo: document.body, global: { stubs } })
    mounted.push(wrapper)
    await flushPromises()
    return wrapper
  }

  const writes = () => backend.calls.filter((call) => call.method === 'post' || call.method === 'put')
  const sent = () => JSON.parse(writes()[0].data as string)
  const inputs = (wrapper: VueWrapper) => wrapper.findAll('input.ui-field-control')
  const submit = (wrapper: VueWrapper) => wrapper.find('button.pf-save')

  test('a user without a profile is offered to create it', async () => {
    const wrapper = await open()

    expect(wrapper.text()).toContain('Расскажите о себе один раз')
    expect(submit(wrapper).text()).toBe('Создать профиль')
  })

  test('nothing is sent while the surname or the name is empty', async () => {
    const wrapper = await open()

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(writes()).toHaveLength(0)
    expect(wrapper.text()).toContain('Укажите фамилию')
    expect(wrapper.text()).toContain('Укажите имя')
  })

  test('one request makes the whole profile, then the token is refreshed and the profile page opens', async () => {
    const auth = useAuthStore()
    const tryRefresh = vi.spyOn(auth, 'tryRefresh').mockResolvedValue('signed-in')
    const wrapper = await open()
    await inputs(wrapper)[0].setValue(' Иванова ')
    await inputs(wrapper)[1].setValue('Мария')

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(writes()).toHaveLength(1)
    expect(writes()[0].method).toBe('post')
    expect(sent()).toEqual({
      surname: 'Иванова', name: 'Мария', patronymic: null, birthdate: null, workplace_id: null,
      diet_id: null, student: null, contacts: [],
    })
    expect(tryRefresh).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledWith('/profile')
  })

  test('a student card needs a number and a group', async () => {
    const wrapper = await open()
    await inputs(wrapper)[0].setValue('Иванова')
    await inputs(wrapper)[1].setValue('Мария')
    await wrapper.find('input.toggle').setValue(true)

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(writes()).toHaveLength(0)
    expect(wrapper.text()).toContain('Укажите номер студенческого билета')
    expect(wrapper.text()).toContain('Выберите группу')
  })

  test('an existing profile fills the form and is saved with a replace that keeps the contact ids', async () => {
    existing = PROFILE
    const wrapper = await open()
    await wrapper.find('.pf-contact-value input').setValue('new@example.com')

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(submit(wrapper).text()).toBe('Сохранить')
    expect(writes()[0].method).toBe('put')
    expect(sent()).toMatchObject({
      surname: 'Иванова', patronymic: 'Сергеевна', birthdate: '2004-05-06',
      student: { student_id: 'S-77', group_id: 11, is_budget: true, is_active: true },
      contacts: [{ id: 'c1', type: 'email', value: 'new@example.com', is_main: true }],
    })
  })

  test('turning the student switch off sends no student card, and empty contact rows are dropped', async () => {
    existing = PROFILE
    const wrapper = await open()
    await wrapper.find('input.toggle').setValue(false)
    await wrapper.find('button.pf-add').trigger('click')

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(sent().student).toBeNull()
    expect(sent().contacts).toHaveLength(1)
  })
})
