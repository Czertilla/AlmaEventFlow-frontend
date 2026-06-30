import { ref, computed } from 'vue'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePrincipalStore } from '@/stores/principal'
import { unwrapList } from '@/api/pagination'
import {
  getEventEventV1EventsEventIdGet,
  getAttendancesEventV1AttendancesGet,
  getParticipationsEventV1ParticipationsGet,
} from '@/api/generated/almaEventFlow'
import type { EventRead, AttendanceRead, ParticipationRead } from '@/api/generated/almaEventFlow'

/**
 * Мероприятия, требующие отметки присутствия пользователем: бейдж-счётчик и
 * модалка. Извлечено из HomePage — двухшаговый резолв (удалённый поиск + дозагрузка
 * в стор) и пересчёт по стору живут здесь, страница лишь связывает их с UI.
 */
export function usePendingAttendance() {
  const calendar = useEventCalendarStore()
  const principal = usePrincipalStore()

  const showPendingModal = ref(false)
  const pendingLoading = ref(false)
  const pendingCount = ref(0)
  // Зафиксированный при открытии список — мероприятия остаются видны, даже когда отмечены
  const pendingEventIds = ref<string[]>([])
  let pendingAutoShown = false

  const pendingEvents = computed(() =>
    pendingEventIds.value
      .map((id) => calendar.events.find((e) => e.id === id))
      .filter((e): e is EventRead => !!e),
  )

  // «Готово» активна, когда в зафиксированном списке не осталось своих неотмеченных записей
  const allPendingDone = computed(() =>
    pendingEventIds.value.every((id) => {
      const items = calendar.attendances.get(id)
      if (!items) return true
      return items.every((it) => !it.attendance || it.attendance.edited_at != null || it.attendance.is_verified)
    }),
  )

  // Фича работает только для активных мероприятий
  function isActiveEvent(eventId: string): boolean {
    return calendar.events.find((e) => e.id === eventId)?.status === 'active'
  }

  // Активные мероприятия с неотмеченной собственной записью среди загруженных в стор
  function storePendingEventIds(): string[] {
    const ids: string[] = []
    for (const [eventId, items] of calendar.attendances) {
      if (!isActiveEvent(eventId)) continue
      const pending = items.some((it) => it.attendance && it.attendance.edited_at == null && !it.attendance.is_verified)
      if (pending) ids.push(eventId)
    }
    return ids
  }

  // Дешёвый пересчёт бейджа по стору (активные мероприятия с неотмеченной записью).
  function refreshPendingCount() {
    pendingCount.value = storePendingEventIds().length
  }

  // Шаг 1 (только чтение): event_id мероприятий, где у пользователя есть неотмеченная запись.
  async function fetchPendingRemoteEventIds(): Promise<string[]> {
    const memberIds = Array.from(principal.userMemberIds.values())
    if (memberIds.length === 0 || principal.collectives.length === 0) return []
    try {
      const attResults = await Promise.all(memberIds.map((mid) =>
        getAttendancesEventV1AttendancesGet({ member_id: mid, edited_at__isnull: true, limit: 100 }).catch(() => null),
      ))
      const partIds = new Set<string>()
      for (const r of attResults) {
        for (const a of unwrapList<AttendanceRead>(r?.data)) {
          if (!a.is_verified && a.participation_id) partIds.add(a.participation_id)
        }
      }
      if (partIds.size === 0) return []
      const partResults = await Promise.all(principal.collectives.map((c) =>
        getParticipationsEventV1ParticipationsGet({ collective_id: c.id, limit: 100 }).catch(() => null),
      ))
      const eventIds = new Set<string>()
      for (const r of partResults) {
        for (const p of unwrapList<ParticipationRead>(r?.data)) {
          if (partIds.has(p.id)) eventIds.add(p.event_id)
        }
      }
      return Array.from(eventIds)
    } catch {
      return []
    }
  }

  // Шаг 2: дозагружает ожидающие мероприятия в стор и их attendance.
  // Возвращает id только АКТИВНЫХ мероприятий (модалка работает лишь для них).
  async function mergePendingEvents(remoteIds: string[]): Promise<string[]> {
    if (remoteIds.length > 0) {
      const missing = remoteIds.filter((id) => !calendar.events.some((e) => e.id === id))
      if (missing.length > 0) {
        const fetched = await Promise.all(missing.map((id) =>
          getEventEventV1EventsEventIdGet(id).then((r) => r.data as EventRead).catch(() => null),
        ))
        calendar.addEvents(fetched.filter((e): e is EventRead => !!e))
      }
      await calendar.fetchAttendances(principal.collectives, remoteIds, principal.userMemberIds)
    }
    const all = new Set<string>([...storePendingEventIds(), ...remoteIds])
    return Array.from(all).filter((id) => isActiveEvent(id))
  }

  // Открывает модалку с активными ожидающими мероприятиями, фиксируя список
  function showPending(ids: string[]) {
    if (ids.length === 0) return
    pendingAutoShown = true
    pendingEventIds.value = ids
    showPendingModal.value = true
  }

  // Автопоказ при загрузке — единожды за сессию страницы
  function maybeAutoShow(ids: string[]) {
    if (!pendingAutoShown && ids.length > 0) showPending(ids)
  }

  async function openPending() {
    showPendingModal.value = true
    pendingLoading.value = true
    try {
      pendingEventIds.value = await mergePendingEvents(await fetchPendingRemoteEventIds())
    } finally {
      pendingLoading.value = false
    }
  }

  // Сброс перед перезагрузкой страницы
  function resetPending() {
    pendingAutoShown = false
    showPendingModal.value = false
    pendingEventIds.value = []
  }

  return {
    showPendingModal,
    pendingLoading,
    pendingCount,
    pendingEvents,
    allPendingDone,
    refreshPendingCount,
    fetchPendingRemoteEventIds,
    mergePendingEvents,
    maybeAutoShow,
    openPending,
    resetPending,
  }
}
