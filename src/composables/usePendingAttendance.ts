import { ref, computed } from 'vue'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePrincipalStore } from '@/stores/principal'
import { getPendingEventV2FeedPendingGet } from '@/api/generated/almaEventFlow'
import type { EventCard } from '@/api/generated/almaEventFlow'

/**
 * Мероприятия, требующие отметки присутствия пользователем: бейдж-счётчик и
 * модалка. Сервер отдаёт их готовыми карточками одним запросом; пересчёт по
 * стору живёт здесь, страница лишь связывает его с UI.
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
      .filter((e): e is EventCard => !!e),
  )

  // «Готово» активна, когда в зафиксированном списке не осталось своих неотмеченных записей
  const allPendingDone = computed(() =>
    pendingEventIds.value.every((id) => {
      const items = calendar.attendances.get(id)
      if (!items) return true
      return items.every((it) => !it.attendance || it.attendance.is_attended != null)
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
      const pending = items.some((it) => it.attendance && it.attendance.is_attended == null)
      if (pending) ids.push(eventId)
    }
    return ids
  }

  // Дешёвый пересчёт бейджа по стору (активные мероприятия с неотмеченной записью).
  function refreshPendingCount() {
    pendingCount.value = storePendingEventIds().length
  }

  // Мероприятия с неотмеченной записью пользователя, в том числе вне загруженного окна списка.
  async function fetchPending(): Promise<EventCard[]> {
    if (principal.userMemberIds.size === 0) return []
    try {
      return (await getPendingEventV2FeedPendingGet()).data
    } catch {
      return []
    }
  }

  // Кладёт карточки в стор и возвращает id только АКТИВНЫХ мероприятий
  // (модалка работает лишь для них).
  function mergePendingEvents(cards: EventCard[]): string[] {
    if (cards.length > 0) calendar.upsertCards(cards)
    const all = new Set<string>([...storePendingEventIds(), ...cards.map((c) => c.id)])
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
      pendingEventIds.value = mergePendingEvents(await fetchPending())
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
    fetchPending,
    mergePendingEvents,
    maybeAutoShow,
    openPending,
    resetPending,
  }
}
