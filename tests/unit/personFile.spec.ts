import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import PersonFile from '@/components/profile/PersonFile.vue'
import { adminPersonFileApi, type PersonFileApi } from '@/components/profile/personFileApi'
import { stubBackend } from './helpers/axiosStub'

vi.mock('@ionic/vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/vue')>()),
  toastController: { create: vi.fn(async () => ({ present: vi.fn() })) },
}))

const PERSON_ID = '22222222-2222-4222-8222-222222222222'

describe('admin dossier adapter', () => {
  let backend: ReturnType<typeof stubBackend>

  beforeEach(() => {
    backend = stubBackend(() => ({ status: 200, data: { items: [] } }))
  })
  afterEach(() => backend.restore())

  const last = () => backend.calls[backend.calls.length - 1]
  const body = () => JSON.parse(last().data as string)

  test('the admin dossier creates a missing profile or student with the person id and patches an existing one', async () => {
    const api = adminPersonFileApi(PERSON_ID)

    await api.saveProfile({ diet_id: 1 }, false)
    expect([last().method, last().url]).toEqual(['post', '/profile/v1/profiles'])
    expect(body()).toEqual({ id: PERSON_ID, diet_id: 1 })
    await api.saveProfile({ diet_id: 2 }, true)
    expect([last().method, last().url]).toEqual(['patch', `/profile/v1/profiles/${PERSON_ID}`])
    await api.saveStudent({ student_id: 'S-1', group_id: 3 }, false)
    expect([last().method, last().url]).toEqual(['post', '/profile/v1/students'])
    expect(body()).toMatchObject({ id: PERSON_ID, student_id: 'S-1' })
    await api.saveStudent({ student_id: 'S-2', group_id: 3 }, true)
    expect([last().method, last().url]).toEqual(['patch', `/profile/v1/students/${PERSON_ID}`])
    await api.removeStudent()
    expect([last().method, last().url]).toEqual(['delete', `/profile/v1/students/${PERSON_ID}`])
  })
})

describe('PersonFile', () => {
  const IonButtonStub = defineComponent({
    name: 'IonButton',
    props: { disabled: Boolean },
    setup: (props, { slots }) => () => h('button', { disabled: props.disabled }, slots.default?.()),
  })
  const stubs = { IonIcon: true, IonToggle: true, IonSpinner: true, IonButton: IonButtonStub }
  const mounted: VueWrapper[] = []
  let backend: ReturnType<typeof stubBackend>

  beforeEach(() => {
    backend = stubBackend(() => ({ status: 200, data: { items: [], pagination: {} } }))
  })
  afterEach(() => {
    backend.restore()
    while (mounted.length) mounted.pop()!.unmount()
  })

  function fakeApi(overrides: Partial<PersonFileApi> = {}): PersonFileApi {
    const missing = () => Promise.reject({ response: { status: 404 } })
    return {
      getPerson: vi.fn(async () => ({
        id: PERSON_ID, surname: 'Иванова', name: 'Мария', patronymic: null, created_at: '2026-09-01T10:00:00Z', edited_at: null,
      })),
      patchPerson: vi.fn(async (data) => ({
        id: PERSON_ID, surname: 'Иванова', name: 'Мария', patronymic: null, created_at: '2026-09-01T10:00:00Z', edited_at: '2026-09-02T10:00:00Z', ...data,
      })),
      getProfile: vi.fn(missing),
      saveProfile: vi.fn(async (data) => ({ id: PERSON_ID, created_at: '2026-09-01T10:00:00Z', edited_at: null, ...data })),
      getStudent: vi.fn(missing),
      saveStudent: vi.fn(async (data) => ({ id: PERSON_ID, created_at: '2026-09-01T10:00:00Z', edited_at: null, ...data })),
      removeStudent: vi.fn(async () => undefined),
      listContacts: vi.fn(async () => []),
      addContact: vi.fn(async () => undefined),
      saveContact: vi.fn(),
      removeContact: vi.fn(async () => undefined),
      ...overrides,
    } as unknown as PersonFileApi
  }

  async function open(api: PersonFileApi) {
    const wrapper = mount(PersonFile, { props: { api }, attachTo: document.body, global: { stubs } })
    mounted.push(wrapper)
    await flushPromises()
    return wrapper
  }

  const saveButtons = (wrapper: VueWrapper) => wrapper.findAll('button').filter((b) => b.text() === 'Сохранить')

  test('shows the name of the person and tells that the profile is not made yet', async () => {
    const wrapper = await open(fakeApi())

    expect(wrapper.find('.dossier-name').text()).toBe('Иванова Мария')
    expect(wrapper.text()).toContain('Профиль ещё не создан')
    expect(wrapper.text()).toContain('Студенческая карточка не создана')
  })

  test('a profile that does not exist yet is created, the next save changes it', async () => {
    const api = fakeApi()
    const wrapper = await open(api)

    await saveButtons(wrapper)[1].trigger('click')
    await flushPromises()
    await saveButtons(wrapper)[1].trigger('click')
    await flushPromises()

    expect(api.saveProfile).toHaveBeenNthCalledWith(1, { birthdate: null, workplace_id: null, diet_id: null }, false)
    expect(api.saveProfile).toHaveBeenNthCalledWith(2, { birthdate: null, workplace_id: null, diet_id: null }, true)
    expect(wrapper.text()).not.toContain('Профиль ещё не создан')
  })

  test('an existing profile and student card are loaded into the form', async () => {
    const api = fakeApi({
      getProfile: vi.fn(async () => ({ id: PERSON_ID, birthdate: '2004-05-06', workplace_id: null, diet_id: 2, created_at: '2026-09-01T10:00:00Z', edited_at: null })) as never,
      getStudent: vi.fn(async () => ({ id: PERSON_ID, student_id: 'S-77', group_id: 11, faculty_id: null, is_budget: true, is_full: false, is_active: true, created_at: '2026-09-01T10:00:00Z', edited_at: null })) as never,
    })
    const wrapper = await open(api)

    expect(wrapper.text()).not.toContain('Профиль ещё не создан')
    expect(wrapper.text()).not.toContain('Студенческая карточка не создана')
    expect((wrapper.findAll('input').find((i) => (i.element as HTMLInputElement).value === 'S-77'))).toBeTruthy()
    expect(wrapper.text()).toContain('Убрать студенческую карточку')
  })

  test('the person needs a surname and a name, the student card a number and a group', async () => {
    const api = fakeApi({ getPerson: vi.fn(async () => ({ id: PERSON_ID, surname: '', name: '', patronymic: null, created_at: '2026-09-01T10:00:00Z', edited_at: null })) as never })
    const wrapper = await open(api)

    await saveButtons(wrapper)[0].trigger('click')
    await saveButtons(wrapper)[2].trigger('click')
    await flushPromises()

    expect(api.patchPerson).not.toHaveBeenCalled()
    expect(api.saveStudent).not.toHaveBeenCalled()
  })

  test('the student card is removed and the form is empty again', async () => {
    const api = fakeApi({
      getProfile: vi.fn(async () => ({ id: PERSON_ID, birthdate: null, workplace_id: null, diet_id: null, created_at: '2026-09-01T10:00:00Z', edited_at: null })) as never,
      getStudent: vi.fn(async () => ({ id: PERSON_ID, student_id: 'S-77', group_id: 11, faculty_id: null, is_budget: true, is_full: false, is_active: true, created_at: '2026-09-01T10:00:00Z', edited_at: null })) as never,
    })
    const wrapper = await open(api)

    await wrapper.findAll('button').find((b) => b.text() === 'Убрать студенческую карточку')!.trigger('click')
    await flushPromises()

    expect(api.removeStudent).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Студенческая карточка не создана')
    expect(wrapper.text()).not.toContain('Убрать студенческую карточку')
  })
})
