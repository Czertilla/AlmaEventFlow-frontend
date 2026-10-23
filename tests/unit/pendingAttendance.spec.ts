import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePendingAttendance } from '@/composables/usePendingAttendance'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePrincipalStore } from '@/stores/principal'
import { attendance, card, participation } from './helpers/cards'
import { stubBackend, type Reply } from './helpers/axiosStub'

const PENDING = '/event/v2/feed/pending'

let backend: ReturnType<typeof stubBackend>
let reply: Reply

const unmarked = (patch = {}) => participation({ my_attendance: attendance({ is_attended: null, ...patch }) })

beforeEach(() => {
  setActivePinia(createPinia())
  reply = { status: 200, data: [] }
  backend = stubBackend((config) => (config.url === PENDING ? reply : { status: 404 }))
})
afterEach(() => backend.restore())

function asMember() {
  usePrincipalStore().userMemberIds = new Map([['c1', 'm1']])
}

describe('pending attendance', () => {
  test('an account that is no one\'s member asks for nothing', async () => {
    const pending = usePendingAttendance()

    expect(await pending.fetchPending()).toEqual([])
    expect(backend.calls).toHaveLength(0)
  })

  test('a failed request is an empty list, not an error', async () => {
    asMember()
    reply = 'network'

    expect(await usePendingAttendance().fetchPending()).toEqual([])
  })

  test('the cards join the list and only the active ones are offered', async () => {
    asMember()
    const store = useEventCalendarStore()
    store.setEvents([card({ id: 'near', date: '2026-10-22', participations: [unmarked()] })])
    reply = {
      status: 200,
      data: [
        card({ id: 'old', date: '2026-09-01', participations: [unmarked()] }),
        card({ id: 'draft', date: '2026-09-02', status: 'draft', participations: [unmarked()] }),
      ],
    }
    const pending = usePendingAttendance()

    const ids = pending.mergePendingEvents(await pending.fetchPending())

    expect(store.events.map((e) => e.id)).toEqual(['old', 'draft', 'near'])
    expect(ids.sort()).toEqual(['near', 'old'])
    pending.refreshPendingCount()
    expect(pending.pendingCount.value).toBe(2)
  })

  test('the modal opens with the list fixed and stays done-able until every place is marked', async () => {
    asMember()
    reply = { status: 200, data: [card({ id: 'old', date: '2026-09-01', participations: [unmarked()] })] }
    const pending = usePendingAttendance()

    await pending.openPending()

    expect(pending.showPendingModal.value).toBe(true)
    expect(pending.pendingLoading.value).toBe(false)
    expect(pending.pendingEvents.value.map((e) => e.id)).toEqual(['old'])
    expect(pending.allPendingDone.value).toBe(false)

    useEventCalendarStore().applyAttendanceChange({
      attendance: attendance({ is_attended: true, edited_at: '2026-10-22T12:00:00Z' }),
      participation: { id: 'p1', event_id: 'old', collective_id: 'c1', attended_count: 1, total_count: 2 },
    })

    expect(pending.allPendingDone.value).toBe(true)
    expect(pending.pendingEvents.value.map((e) => e.id)).toEqual(['old'])
  })

  test('the modal is shown by itself once per page visit', () => {
    const pending = usePendingAttendance()

    pending.maybeAutoShow([])
    expect(pending.showPendingModal.value).toBe(false)

    pending.maybeAutoShow(['e1'])
    expect(pending.showPendingModal.value).toBe(true)

    pending.showPendingModal.value = false
    pending.maybeAutoShow(['e1'])
    expect(pending.showPendingModal.value).toBe(false)

    pending.resetPending()
    pending.maybeAutoShow(['e1'])
    expect(pending.showPendingModal.value).toBe(true)
  })
})
