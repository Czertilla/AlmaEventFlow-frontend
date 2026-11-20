import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { TodoItem } from '@/api/generated/almaEventFlow'
import TodoModal from '@/components/layout/TodoModal.vue'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { useTodoStore } from '@/stores/todo'
import { groupTodo, mergeTodo, missingFieldKeys } from '@/utils/todoKinds'
import { stubBackend, type Reply } from './helpers/axiosStub'
import { attendance, card, participation } from './helpers/cards'

const TODO = '/event/v3/me/todo'
const passthrough = { template: '<div><slot /></div>' }
const stubs = {
  IonModal: passthrough,
  IonContent: passthrough,
  IonSpinner: true,
  IonIcon: true,
  EventAttendanceChip: true,
  EventCommentChip: true,
  LocationDisplay: true,
  ConsentTodoCard: true,
  FillFieldsTodo: true,
}

const unmarked = card({ participations: [participation({ my_attendance: attendance({ is_attended: null }) })] })

function item(patch: Partial<TodoItem>): TodoItem {
  return { id: 'x', kind: 'attendance', collective_id: null, collective_name: null, event: null, consent: null, fill: null, ...patch }
}

const consent = item({
  id: 'consent:c1:p1',
  kind: 'consent',
  collective_id: 'c1',
  collective_name: 'Хор',
  consent: {
    policy_id: 'p1', version: 1, state: 'consent_missing', comment: null,
    text: 'Текст', text_hash: '0'.repeat(64), fields: [{ key: 'contact.phone', label: 'Телефон' }],
  },
})
const fill = item({
  id: 'fill_fields:c1', kind: 'fill_fields', collective_id: 'c1', collective_name: 'Хор',
  fill: { fields: [{ key: 'passport.number', label: 'Номер паспорта' }] },
})
const mark = item({ id: 'attendance:e1', kind: 'attendance', event: unmarked })

let backend: ReturnType<typeof stubBackend>
let reply: Reply

beforeEach(() => {
  setActivePinia(createPinia())
  reply = { status: 200, data: { items: [], unavailable: [] } }
  backend = stubBackend((config) => (config.url === TODO ? reply : { status: 404 }))
  try { sessionStorage.clear() } catch { /* нет хранилища */ }
})
afterEach(() => backend.restore())

describe('the modal of things to do', () => {
  test('a tap on an event card closes the modal and opens that event', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: passthrough }, { path: '/event/:id', component: passthrough }],
    })
    await router.push('/')
    const todo = useTodoStore()
    todo.items = [mark]
    todo.isOpen = true
    const wrapper = mount(TodoModal, { global: { plugins: [router], stubs } })

    await wrapper.find('.event-card').trigger('click')
    await flushPromises()

    expect(todo.isOpen).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/event/e1')
  })

  test('the kinds go in the order of the registry and an unknown kind is left out', () => {
    const odd = item({ id: 'later', kind: 'later' as TodoItem['kind'] })
    const joining = item({ id: 'onboarding:o1', kind: 'onboarding' })

    expect(groupTodo([mark, odd, fill, joining, consent]).map((group) => group.info.kind)).toEqual([
      'onboarding', 'consent', 'fill_fields', 'attendance',
    ])
  })
})

describe('the list of things to do', () => {
  test('it comes in one request and opens itself once per session and account', async () => {
    reply = { status: 200, data: { items: [consent, mark], unavailable: [] } }
    const todo = useTodoStore()

    await todo.showOnSignIn('u1')
    todo.isOpen = false
    await todo.showOnSignIn('u1')

    expect(backend.to(TODO)).toHaveLength(2)
    expect(todo.count).toBe(2)
    expect(todo.isOpen).toBe(false)
    expect(useEventCalendarStore().events.map((event) => event.id)).toEqual(['e1'])
  })

  test('a marked place is no longer to do', async () => {
    reply = { status: 200, data: { items: [mark], unavailable: [] } }
    const todo = useTodoStore()
    await todo.refresh(true)
    expect(todo.count).toBe(1)

    useEventCalendarStore().upsertCards([
      card({
        updated_at: '2026-10-21T10:00:00Z',
        participations: [participation({ my_attendance: attendance({ is_attended: true }) })],
      }),
    ])

    expect(todo.count).toBe(0)
  })

  test('a source that did not answer keeps what was shown for it', () => {
    expect(mergeTodo([consent, mark], [mark], ['consent', 'fill_fields'])).toEqual([mark, consent])
    expect(mergeTodo([consent, mark], [mark], [])).toEqual([mark])
  })

  test('the empty fields of every policy are known by their keys', () => {
    expect([...missingFieldKeys([consent, fill])]).toEqual(['passport.number'])
  })
})
