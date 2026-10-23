import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { attendance, card, participation } from './helpers/cards'

describe('event calendar store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  test('the marks and the time of an event come out of its card', () => {
    const store = useEventCalendarStore()

    store.setEvents([
      card({ id: 'e1' }),
      card({ id: 'e2', participations: [], starts_at: null, ends_at: null }),
    ])

    expect(store.attendances.get('e1')).toEqual([
      {
        collectiveId: 'c1',
        collectiveName: 'Хор',
        attendance: attendance(),
        attendedCount: 0,
        totalCount: 2,
      },
    ])
    expect(store.attendances.has('e2')).toBe(false)
    expect(store.stageTimes.get('e1')).toEqual({ first: '2026-10-22T15:00:00Z', last: '2026-10-22T17:00:00Z' })
    expect(store.stageTimes.has('e2')).toBe(false)
  })

  test('added cards keep the date order and a known card is left as it is', () => {
    const store = useEventCalendarStore()
    store.setEvents([card({ id: 'b', date: '2026-10-22' })])

    store.addEvents([card({ id: 'a', date: '2026-10-21' }), card({ id: 'b', name: 'Другое' }), card({ id: 'c', date: '2026-10-23' })])

    expect(store.events.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(store.events[1].name).toBe('Репетиция')
  })

  test('cards of one day stay in a stable order by id', () => {
    const store = useEventCalendarStore()

    store.addEvents([card({ id: 'z' }), card({ id: 'a' }), card({ id: 'm' })])

    expect(store.events.map((e) => e.id)).toEqual(['a', 'm', 'z'])
  })

  test('of two copies of a card the newer one wins, an unknown card is added', () => {
    const store = useEventCalendarStore()
    store.setEvents([card({ id: 'e1', name: 'Новая', updated_at: '2026-10-22T12:00:00Z' })])

    store.upsertCards([
      card({ id: 'e1', name: 'Старая', updated_at: '2026-10-22T11:00:00Z' }),
      card({ id: 'e2', date: '2026-10-25' }),
    ])
    expect(store.events.map((e) => [e.id, e.name])).toEqual([['e1', 'Новая'], ['e2', 'Репетиция']])

    store.upsertCards([card({ id: 'e1', name: 'Свежая', updated_at: '2026-10-22T12:00:00Z' })])
    expect(store.events[0].name).toBe('Свежая')
  })

  test('a change of the own place updates its mark and the counters of the participation only', () => {
    const store = useEventCalendarStore()
    store.setEvents([
      card({
        id: 'e1',
        participations: [
          participation({ id: 'p1' }),
          participation({ id: 'p2', collective_id: 'c2', my_attendance: attendance({ id: 'a2', participation_id: 'p2' }) }),
        ],
      }),
      card({ id: 'e2' }),
    ])

    store.applyAttendanceChange({
      attendance: attendance({ is_attended: true, edited_at: '2026-10-22T12:00:00Z' }),
      participation: { id: 'p1', event_id: 'e1', collective_id: 'c1', attended_count: 1, total_count: 2 },
    })

    const [first, other] = store.events
    expect(first.participations[0].my_attendance?.is_attended).toBe(true)
    expect(first.participations[0].attended_count).toBe(1)
    expect(first.participations[1].my_attendance?.is_attended).toBe(false)
    expect(first.updated_at).toBe('2026-10-22T12:00:00Z')
    expect(other.participations[0].attended_count).toBe(0)
  })

  test("another member's place moves the counters but not the own mark", () => {
    const store = useEventCalendarStore()
    store.setEvents([card({ id: 'e1' })])

    store.applyAttendanceChange({
      attendance: attendance({ id: 'someone-else', is_attended: true }),
      participation: { id: 'p1', event_id: 'e1', collective_id: 'c1', attended_count: 2, total_count: 2 },
    })

    expect(store.events[0].participations[0].my_attendance).toEqual(attendance())
    expect(store.events[0].participations[0].attended_count).toBe(2)
  })

  test('a removed card leaves the list and a reset empties it', () => {
    const store = useEventCalendarStore()
    store.setEvents([card({ id: 'e1' }), card({ id: 'e2' })])

    store.removeEvent('e1')
    expect(store.events.map((e) => e.id)).toEqual(['e2'])

    store.reset()
    expect(store.events).toEqual([])
    expect(store.attendances.size).toBe(0)
  })
})
