import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getMyTodoEventV3MeTodoGet } from '@/api/generated/almaEventFlow'
import type { EventCard, TodoItem, TodoKind } from '@/api/generated/almaEventFlow'
import { useEventCalendarStore } from './eventCalendar'
import { mergeTodo, missingFieldKeys } from '@/utils/todoKinds'

const REFRESH_EVERY_MS = 60_000

/**
 * Всё, что человеку надо сделать: отметки на мероприятиях, согласия на политики
 * коллективов, поля, которые эти политики просят. Сервер отдаёт список одним
 * запросом; карточки мероприятий ложатся в стор мероприятий, так что отметка в
 * любом месте сразу убирает дело.
 */
export const useTodoStore = defineStore('todo', () => {
  const calendar = useEventCalendarStore()
  const items = ref<TodoItem[]>([])
  const unavailable = ref<TodoKind[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const isOpen = ref(false)
  let fetchedAt = 0
  let inFlight: Promise<void> | null = null
  let shownFor: string | null = null

  function attendanceDone(event: EventCard | null | undefined): boolean {
    if (!event) return true
    const marks = calendar.attendances.get(event.id)
    if (!marks) return false
    return marks.every((item) => !item.attendance || item.attendance.is_attended != null)
  }

  function isDone(item: TodoItem): boolean {
    return item.kind === 'attendance' && attendanceDone(item.event)
  }

  const open = computed(() => items.value.filter((item) => !isDone(item)))
  const count = computed(() => open.value.length)
  const missingFields = computed(() => missingFieldKeys(items.value))

  async function load() {
    loading.value = true
    try {
      const { data } = await getMyTodoEventV3MeTodoGet()
      const cards = data.items.map((item) => item.event).filter((card): card is EventCard => !!card)
      if (cards.length) calendar.upsertCards(cards)
      items.value = mergeTodo(items.value, data.items, data.unavailable)
      unavailable.value = data.unavailable
      loaded.value = true
      fetchedAt = Date.now()
    } catch {
      /* прежний список остаётся, пока сервер не ответит */
    } finally {
      loading.value = false
    }
  }

  function refresh(force = false): Promise<void> {
    if (!force && loaded.value && Date.now() - fetchedAt < REFRESH_EVERY_MS) return Promise.resolve()
    inFlight ??= load().finally(() => { inFlight = null })
    return inFlight
  }

  /** После входа и после перезагрузки страницы модалка открывается сама один раз на аккаунт. */
  async function showOnSignIn(owner: string) {
    await refresh(true)
    if (count.value === 0 || shownFor === owner) return
    shownFor = owner
    isOpen.value = true
  }

  /** Главная открывает модалку при каждом входе на неё, пока есть дела. */
  async function showOnHome() {
    await refresh(true)
    if (count.value > 0) isOpen.value = true
  }

  /** Карточки отметок возвращаются в стор мероприятий, если список их вытеснил. */
  function ensureCards() {
    const known = new Set(calendar.events.map((event) => event.id))
    const missing = items.value
      .map((item) => item.event)
      .filter((card): card is EventCard => !!card && !known.has(card.id))
    if (missing.length) calendar.upsertCards(missing)
  }

  function done(id: string) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function reset() {
    items.value = []
    unavailable.value = []
    loaded.value = false
    isOpen.value = false
    fetchedAt = 0
  }

  return {
    items, unavailable, loaded, loading, isOpen, open, count, missingFields,
    isDone, refresh, showOnSignIn, showOnHome, ensureCards, done, reset,
  }
})
