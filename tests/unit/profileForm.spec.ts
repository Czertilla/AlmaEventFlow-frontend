import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, onMounted, type Component } from 'vue'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import UiInput from '@/components/common/UiInput.vue'
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

const CREATED: Record<string, unknown> = {
  '/profile/v2/universities': { id: 'uni-1', name: 'КФУ' },
  '/profile/v2/faculties': { id: 'fac-1', name: 'ИТ' },
  '/profile/v2/student-degrees': { id: 7, name: 'Бакалавриат' },
  '/profile/v2/student-groups': { id: 42, name: 'ИС-23' },
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
      if (config.method === 'post' && config.url && config.url in CREATED) return { status: 200, data: CREATED[config.url] }
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

  test('a user without a profile is offered to create it, and who sees the data is behind a help button', async () => {
    const wrapper = await open()

    expect(submit(wrapper).text()).toBe('Создать профиль')
    expect(wrapper.text()).not.toContain('руководители')

    await wrapper.get('.ui-card-title .ui-help').trigger('click')

    expect(document.body.querySelector('.ui-help-tip')?.textContent).toContain('руководители')
  })

  test('the study section explains how a group fills the rest only behind a help button', async () => {
    const wrapper = await open()
    await wrapper.find('input.toggle').setValue(true)

    expect(wrapper.text()).not.toContain('подставятся сами')

    const group = wrapper.findAllComponents(SearchPicker).find((item) => item.props('label') === 'Группа')!
    await group.get('.ui-help').trigger('click')

    expect(document.body.querySelector('.ui-help-tip')?.textContent).toContain('подставятся сами')
  })

  test('nothing is sent while the surname or the name is empty', async () => {
    const wrapper = await open()

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(writes()).toHaveLength(0)
    expect(wrapper.text()).toContain('Укажите фамилию')
    expect(wrapper.text()).toContain('Укажите имя')
  })

  test('one request makes the whole profile, then the token is refreshed once the account shows the profile and the profile page opens', async () => {
    const auth = useAuthStore()
    const refresh = vi.spyOn(auth, 'refreshWhenLinked').mockResolvedValue('signed-in')
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
    expect(refresh).toHaveBeenCalledExactlyOnceWith('p1')
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
    expect(wrapper.text()).toContain('Укажите группу')
  })

  const picker = (wrapper: VueWrapper, label: string) =>
    wrapper.findAllComponents(SearchPicker).find((item) => item.props('label') === label)!
  const field = (wrapper: VueWrapper, label: string) =>
    wrapper.findAllComponents(UiInput).find((item) => item.props('label') === label)!

  test('a group that does not exist yet is created with its faculty, university and degree before the profile', async () => {
    const wrapper = await open()
    await inputs(wrapper)[0].setValue('Иванова')
    await inputs(wrapper)[1].setValue('Мария')
    await wrapper.find('input.toggle').setValue(true)
    await field(wrapper, 'Студенческий билет').get('input').setValue('S-1')
    picker(wrapper, 'Университет').vm.$emit('update:draft', 'КФУ')
    picker(wrapper, 'Факультет').vm.$emit('update:draft', 'ИТ')
    picker(wrapper, 'Степень').vm.$emit('update:draft', 'Бакалавриат')
    picker(wrapper, 'Группа').vm.$emit('update:draft', 'ИС-23')
    await field(wrapper, 'Курс').get('input').setValue('2')

    await submit(wrapper).trigger('click')
    await flushPromises()

    const body = (url: string) => JSON.parse(backend.to(url).find((call) => call.method === 'post')!.data as string)
    expect(body('/profile/v2/universities')).toEqual({ name: 'КФУ' })
    expect(body('/profile/v2/faculties')).toEqual({ name: 'ИТ', university_id: 'uni-1' })
    expect(body('/profile/v2/student-degrees')).toEqual({ name: 'Бакалавриат' })
    expect(body('/profile/v2/student-groups')).toEqual({ name: 'ИС-23', degree_id: 7, faculty_id: 'fac-1', grade: 2 })
    expect(body('/profile/v2/profiles/my').student).toMatchObject({ student_id: 'S-1', group_id: 42, faculty_id: 'fac-1' })
    const order = backend.calls.filter((call) => call.method === 'post').map((call) => call.url)
    expect(order.slice(0, 5)).toEqual([
      '/profile/v2/universities', '/profile/v2/faculties', '/profile/v2/student-degrees',
      '/profile/v2/student-groups', '/profile/v2/profiles/my',
    ])
  })

  test('picking an existing group fills its faculty, degree and grade and locks them', async () => {
    const wrapper = await open()
    await wrapper.find('input.toggle').setValue(true)
    expect(picker(wrapper, 'Факультет').props('locked')).toBe(false)

    picker(wrapper, 'Группа').vm.$emit('update:modelValue', 5, { degree_id: 2, faculty_id: 'f9', grade: 3 })
    await flushPromises()

    expect(picker(wrapper, 'Факультет').props('modelValue')).toBe('f9')
    expect(picker(wrapper, 'Факультет').props('locked')).toBe(true)
    expect(picker(wrapper, 'Степень').props('modelValue')).toBe(2)
    expect(picker(wrapper, 'Степень').props('locked')).toBe(true)
    expect(field(wrapper, 'Курс').get('input').element.value).toBe('3')
    expect(field(wrapper, 'Курс').get('input').attributes('disabled')).toBeDefined()
  })

  test('an existing profile opens as tabs and is saved with a replace that keeps the contact ids', async () => {
    existing = PROFILE
    const wrapper = await open()
    expect(wrapper.findAll('.sliding-tab')).toHaveLength(4)
    expect(submit(wrapper).text()).toBe('Нет изменений')
    expect(submit(wrapper).attributes('disabled')).toBeDefined()

    await inputs(wrapper)[0].setValue('Петрова')
    expect(submit(wrapper).text()).toBe('Сохранить изменения (1)')

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(writes()[0].method).toBe('put')
    expect(sent()).toMatchObject({
      surname: 'Петрова', patronymic: 'Сергеевна', birthdate: '2004-05-06',
      student: { student_id: 'S-77', group_id: 11, is_budget: true, is_active: true },
      contacts: [{ id: 'c1', type: 'email', value: 'm@example.com', is_main: true }],
    })
  })

  test('the chip of a tab shows how many of its fields were changed', async () => {
    existing = PROFILE
    const wrapper = await open()
    const chip = (label: string) => wrapper.findAll('.sliding-tab').find((tab) => tab.text().includes(label))!

    await inputs(wrapper)[0].setValue('Петрова')
    await inputs(wrapper)[1].setValue('Анна')

    expect(chip('О вас').find('.sliding-tab-badge').text()).toBe('2')
    expect(chip('Учёба').find('.sliding-tab-badge').exists()).toBe(false)
  })

  test('a failed save marks the chip of the tab with the missing field and opens that tab', async () => {
    existing = PROFILE
    const wrapper = await open()
    await wrapper.findAll('.sliding-tab').find((tab) => tab.text().includes('Контакты'))!.trigger('click')
    await inputs(wrapper)[0].setValue('')

    await submit(wrapper).trigger('click')
    await flushPromises()

    const about = wrapper.findAll('.sliding-tab').find((tab) => tab.text().includes('О вас'))!
    expect(writes()).toHaveLength(0)
    expect(about.classes()).toContain('sliding-tab--invalid')
    expect(about.classes()).toContain('sliding-tab--active')
  })

  test('turning the student switch off sends no student card', async () => {
    existing = PROFILE
    const wrapper = await open()
    await wrapper.find('input.toggle').setValue(false)

    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(sent().student).toBeNull()
    expect(sent().contacts).toHaveLength(1)
  })
})
