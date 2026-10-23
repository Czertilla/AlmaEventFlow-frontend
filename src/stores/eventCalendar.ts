import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, isSameDay, isWithinInterval } from 'date-fns'
import type { AttendanceChanged, AttendanceReadV2, EventCard } from '@/api/generated/almaEventFlow'

export interface EventAttendanceItem {
  collectiveId: string
  collectiveName: string
  attendance: AttendanceReadV2 | null
  attendedCount: number
  totalCount: number
}

export interface EventTimeRange {
  first: string
  last: string
}

function byDate(a: EventCard, b: EventCard): number {
  const diff = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  if (diff !== 0) return diff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** The newer of two copies of one card; the one that came later wins a tie. */
function newer(a: EventCard, b: EventCard): EventCard {
  return b.updated_at >= a.updated_at ? b : a
}

export const useEventCalendarStore = defineStore('eventCalendar', () => {
  const events = ref<EventCard[]>([])
  const selectedDate = ref<Date>(new Date())
  const currentMonth = ref<Date>(new Date())
  const visibleRange = ref<{ start: Date; end: Date }>({
    start: startOfWeek(startOfMonth(new Date()), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(new Date()), { weekStartsOn: 1 }),
  })

  // Отметки и время этапов приходят в самой карточке: отдельных запросов за ними нет.
  const attendances = computed(() => {
    const map = new Map<string, EventAttendanceItem[]>()
    for (const event of events.value) {
      if (event.participations.length === 0) continue
      map.set(event.id, event.participations.map((p) => ({
        collectiveId: p.collective_id,
        collectiveName: p.collective_name,
        attendance: p.my_attendance,
        attendedCount: p.attended_count,
        totalCount: p.total_count,
      })))
    }
    return map
  })

  const stageTimes = computed(() => {
    const map = new Map<string, EventTimeRange>()
    for (const event of events.value) {
      if (event.starts_at && event.ends_at) map.set(event.id, { first: event.starts_at, last: event.ends_at })
    }
    return map
  })

  const eventsForSelectedDate = computed(() =>
    events.value.filter((e) => e.date && isSameDay(new Date(e.date), selectedDate.value)),
  )

  function setSelectedDate(date: Date) {
    selectedDate.value = date
  }

  function setCurrentMonth(date: Date) {
    currentMonth.value = date
    visibleRange.value = {
      start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
    }
  }

  function nextMonth() {
    setCurrentMonth(addMonths(currentMonth.value, 1))
  }

  function prevMonth() {
    setCurrentMonth(addMonths(currentMonth.value, -1))
  }

  function setEvents(list: EventCard[]) {
    events.value = list
  }

  /** New cards join the list; a card the list already has is left as it is. */
  function addEvents(list: EventCard[]) {
    const existingIds = new Set(events.value.map((e) => e.id))
    const fresh = list.filter((e) => !existingIds.has(e.id))
    if (fresh.length === 0) return
    events.value = [...events.value, ...fresh].sort(byDate)
  }

  /** Fresh copies of cards: the newer copy wins, an unknown card is added. */
  function upsertCards(list: EventCard[]) {
    const incoming = new Map(list.map((e) => [e.id, e]))
    const merged = events.value.map((e) => {
      const copy = incoming.get(e.id)
      incoming.delete(e.id)
      return copy ? newer(e, copy) : e
    })
    events.value = [...merged, ...incoming.values()].sort(byDate)
  }

  function removeEvent(eventId: string) {
    events.value = events.value.filter((e) => e.id !== eventId)
  }

  /** A change of one place: the caller's own mark and the counters of its participation. */
  function applyAttendanceChange(change: AttendanceChanged) {
    const { attendance, participation } = change
    events.value = events.value.map((event) => {
      if (event.id !== participation.event_id) return event
      return {
        ...event,
        updated_at: attendance.edited_at && attendance.edited_at > event.updated_at
          ? attendance.edited_at
          : event.updated_at,
        participations: event.participations.map((p) => {
          if (p.id !== participation.id) return p
          const mine = p.my_attendance?.id === attendance.id
          return {
            ...p,
            attended_count: participation.attended_count,
            total_count: participation.total_count,
            my_attendance: mine ? attendance : p.my_attendance,
          }
        }),
      }
    })
  }

  // Полный сброс — вызывается при смене аккаунта, чтобы не показывать чужие отметки
  function reset() {
    events.value = []
    selectedDate.value = new Date()
    setCurrentMonth(new Date())
  }

  function isInVisibleRange(date: Date) {
    return isWithinInterval(date, { start: visibleRange.value.start, end: visibleRange.value.end })
  }

  return {
    events,
    attendances,
    stageTimes,
    selectedDate,
    currentMonth,
    visibleRange,
    eventsForSelectedDate,
    setSelectedDate,
    setCurrentMonth,
    nextMonth,
    prevMonth,
    setEvents,
    addEvents,
    upsertCards,
    removeEvent,
    applyAttendanceChange,
    reset,
    isInVisibleRange,
  }
})
