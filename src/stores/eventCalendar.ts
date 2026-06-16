import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, isSameDay, isWithinInterval } from 'date-fns'
import { getParticipationsEventV1ParticipationsGet, getAttendancesEventV1AttendancesGet } from '@/api/generated/almaEventFlow'
import type { EventRead, AttendanceRead } from '@/api/generated/almaEventFlow'
import type { CollectiveInfo } from './principal'

export interface EventAttendanceItem {
  collectiveId: string
  collectiveName: string
  attendance: AttendanceRead | null
  attendedCount: number
  totalCount: number
}

export const useEventCalendarStore = defineStore('eventCalendar', () => {
  const events = ref<EventRead[]>([])
  const attendances = ref<Map<string, EventAttendanceItem[]>>(new Map())
  const selectedDate = ref<Date>(new Date())
  const currentMonth = ref<Date>(new Date())
  const visibleRange = ref<{ start: Date; end: Date }>({
    start: startOfWeek(startOfMonth(new Date()), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(new Date()), { weekStartsOn: 1 }),
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

  function setEvents(list: EventRead[]) {
    events.value = list
  }

  function addEvents(list: EventRead[]) {
    const existingIds = new Set(events.value.map((e) => e.id))
    const newEvents = list.filter((e) => !existingIds.has(e.id))
    events.value = [...events.value, ...newEvents].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
    )
  }

  function setAttendances(map: Map<string, EventAttendanceItem[]>) {
    attendances.value = map
  }

  async function fetchAttendances(
    collectives: CollectiveInfo[],
    eventIds: string[],
    userMemberIds: Map<string, string>,
  ) {
    if (collectives.length === 0 || eventIds.length === 0) return

    const collectiveMap = new Map(collectives.map((c) => [c.id, c.name]))

    // memberIds может быть пустым (руководитель без собственного членства) — участия всё равно нужны
    const memberIds = Array.from(userMemberIds.values())

    const participationsResp = await getParticipationsEventV1ParticipationsGet({
      event_id__in: eventIds.join(','),
      limit: 100,
    })
    const allParticipations = ((participationsResp.data as any)?.items || []) as Array<{ id: string; event_id: string; collective_id: string }>
    // Интересуют только участия коллективов пользователя — чужие не показываем и не считаем
    const participations = allParticipations.filter((p) => collectiveMap.has(p.collective_id))

    const participationByEvent = new Map<string, Array<{ id: string; collective_id: string }>>()
    for (const p of participations) {
      if (!participationByEvent.has(p.event_id)) participationByEvent.set(p.event_id, [])
      participationByEvent.get(p.event_id)!.push(p)
    }

    // Fetch all attendances for the user's member IDs
    const attendancePromises = memberIds.map((memberId) =>
      getAttendancesEventV1AttendancesGet({ member_id: memberId, limit: 100 }).catch(() => null),
    )
    const attendanceResults = await Promise.all(attendancePromises)
    const attendanceByParticipation = new Map<string, AttendanceRead>()
    for (const result of attendanceResults) {
      if (!result) continue
      const items = ((result.data as any)?.items || []) as AttendanceRead[]
      for (const a of items) {
        if (a.participation_id) {
          attendanceByParticipation.set(a.participation_id, a)
        }
      }
    }

    // Count attendances per participation using participation_id filter
    const participationIds = participations.map((p) => p.id)
    const countByParticipation = new Map<string, { attended: number; total: number }>()
    if (participationIds.length > 0) {
      try {
        const countResp = await getAttendancesEventV1AttendancesGet(
          { limit: 100 },
          { params: { participation_id__in: participationIds.join(',') } },
        )
        const allAttendances = ((countResp.data as any)?.items || []) as AttendanceRead[]
        for (const a of allAttendances) {
          const pid = a.participation_id
          if (!pid) continue
          const cur = countByParticipation.get(pid) || { attended: 0, total: 0 }
          cur.total++
          if (a.is_attended) cur.attended++
          countByParticipation.set(pid, cur)
        }
      } catch { /* counts not critical */ }
    }

    const result = new Map<string, EventAttendanceItem[]>()
    for (const eventId of eventIds) {
      const parts = participationByEvent.get(eventId) || []
      const items: EventAttendanceItem[] = []
      for (const p of parts) {
        const collectiveName = collectiveMap.get(p.collective_id) || 'Неизвестный коллектив'
        const attendance = attendanceByParticipation.get(p.id) || null
        const counts = countByParticipation.get(p.id) || { attended: 0, total: 0 }
        items.push({
          collectiveId: p.collective_id,
          collectiveName,
          attendance,
          attendedCount: counts.attended,
          totalCount: counts.total,
        })
      }
      if (items.length > 0) result.set(eventId, items)
    }
    const merged = new Map(attendances.value)
    for (const [k, v] of result) merged.set(k, v)
    attendances.value = merged
  }

  // Полный сброс — вызывается при смене аккаунта, чтобы не показывать чужие attendance
  function reset() {
    events.value = []
    attendances.value = new Map()
    selectedDate.value = new Date()
    setCurrentMonth(new Date())
  }

  function isInVisibleRange(date: Date) {
    return isWithinInterval(date, { start: visibleRange.value.start, end: visibleRange.value.end })
  }

  return {
    events,
    attendances,
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
    setAttendances,
    fetchAttendances,
    reset,
    isInVisibleRange,
  }
})
