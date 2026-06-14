<template>
  <ion-page>
    <ion-content>
      <div class="home-page">
        <div class="home-header">
          <div class="home-header-inner">
            <div>
              <h1 class="home-greeting">{{ greeting }}</h1>
              <p class="home-date">{{ todayFormatted }}</p>
            </div>
            <div class="home-stats">
              <button v-if="pendingCount > 0" class="pending-chip" @click="openPending">
                <ion-icon :icon="alertCircleOutline" />
                <span class="pending-chip-text">
                  <span class="pending-chip-num">{{ pendingCount }}</span>
                  <span class="pending-chip-label">требуют отметки</span>
                </span>
              </button>
              <div class="stat-chip">
                <span class="stat-num">{{ calendar.events.length }}</span>
                <span class="stat-label">мероприятий</span>
              </div>
            </div>
          </div>
        </div>

        <div class="home-content">
          <div class="home-layout" :class="{ 'home-layout--mobile': !isDesktop }">
            <div
              class="calendar-section"
              :class="{ 'calendar-section--hidden': !isDesktop && !mobileCalendarVisible }"
            >
              <div class="section-card calendar-card">
                <div class="section-card-header">
                  <h3>Календарь</h3>
                </div>
                <CalendarGrid
                  v-if="isDesktop"
                  :current-month="calendar.currentMonth"
                  :selected-date="calendar.selectedDate"
                  :event-dates="eventDates"
                  @select-day="onSelectDay"
                  @prev-month="onPrevMonth"
                  @next-month="onNextMonth"
                />
                <MiniCalendar
                  v-else
                  :current-month="calendar.currentMonth"
                  :selected-date="calendar.selectedDate"
                  :event-dates="eventDates"
                  @select-day="onSelectDay"
                  @prev-week="onShiftWeek(-1)"
                  @next-week="onShiftWeek(1)"
                  @toggle-full="showFullCalendar = true"
                />
              </div>

              <div v-if="isDesktop" class="section-card filters-card">
                <div class="section-card-header">
                  <h3>Фильтры</h3>
                </div>
                <div class="filters">
                  <button
                    class="filter-chip filter-chip--all"
                    :class="{ 'filter-chip--active': principal.showAllEvents }"
                    @click="principal.toggleShowAllEvents()"
                  >
                    Все мероприятия
                  </button>
                  <button
                    v-for="c in collectives"
                    :key="c.id"
                    class="filter-chip"
                    :class="{
                      'filter-chip--active': !principal.showAllEvents && principal.isCollectiveSelected(c.id),
                      'filter-chip--blocked': principal.showAllEvents,
                    }"
                    :disabled="principal.showAllEvents"
                    @click="principal.selectCollective(c.id)"
                  >
                    <span class="filter-dot" :style="{ background: c.color || getColor(c.id) }" />
                    <span class="filter-chip-text">
                      <span class="filter-chip-name">{{ c.name }}</span>
                      <span class="filter-chip-role">{{ roleLabel(c.id) }}</span>
                    </span>
                  </button>
                  <span v-if="collectives.length === 0" class="filters-empty">Нет коллективов</span>
                </div>
                <template v-if="principal.isPrincipal">
                  <div class="filters-divider" />
                  <span class="filters-sublabel">Статус мероприятия</span>
                  <div class="filters">
                    <button
                      v-for="s in STATUS_FILTERS"
                      :key="s.value"
                      class="filter-chip"
                      :class="{ 'filter-chip--active': statusFilter === s.value }"
                      @click="statusFilter = s.value"
                    >
                      {{ s.label }}
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <div class="events-section">
              <div class="section-card events-card">
                <div class="section-card-header">
                  <h3>Мероприятия</h3>
                  <span class="events-count" v-if="filteredEvents.length">{{ filteredEvents.length }}</span>
                </div>
                <EventList
                  ref="eventListRef"
                  :events="filteredEvents"
                  :attendances="calendar.attendances"
                  :is-principal="principal.isPrincipal"
                  :loading="loading"
                  :loading-up="loadingUp"
                  :loading-down="loadingDown"
                  :scroll-to-date="calendarScrollTarget"
                  :has-more-up="hasMoreUp"
                  :has-more-down="hasMoreDown"
                  @select-event="onSelectEvent"
                  @load-more-up="loadMoreUp"
                  @load-more-down="loadMoreDown"
                  @toggle-attendance="onToggleAttendance"
                  @save-comment="onSaveComment"
                  @delete-comment="onDeleteComment"
                  @visible-date-changed="onVisibleDateChanged"
                  @calendar-visible-change="onCalendarVisibleChange"
                />
                <div v-if="filteredEvents.length === 0 && loading" class="events-loading">
                  <div class="loading-spinner" />
                  <p>Загрузка мероприятий...</p>
                </div>
                <div v-else-if="filteredEvents.length === 0" class="events-empty">
                  <ion-icon :icon="calendarOutline" />
                  <p>Нет мероприятий на выбранную дату</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>

    <!-- Mobile filter FAB -->
    <ion-fab v-if="!isDesktop" slot="fixed" vertical="bottom" horizontal="end" class="filter-fab">
      <ion-fab-button color="primary" @click="showFilterModal = true">
        <ion-icon :icon="optionsOutline" />
      </ion-fab-button>
    </ion-fab>

    <!-- Mobile filter modal -->
    <ion-modal
      v-if="!isDesktop"
      :is-open="showFilterModal"
      :initial-breakpoint="0.6"
      :breakpoints="[0, 0.6, 1]"
      @ion-modal-did-dismiss="showFilterModal = false"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Фильтры</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="showFilterModal = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="filter-modal-body">
          <div class="filters">
            <button
              class="filter-chip filter-chip--all"
              :class="{ 'filter-chip--active': principal.showAllEvents }"
              @click="principal.toggleShowAllEvents()"
            >
              Все мероприятия
            </button>
            <button
              v-for="c in collectives"
              :key="c.id"
              class="filter-chip"
              :class="{
                'filter-chip--active': !principal.showAllEvents && principal.isCollectiveSelected(c.id),
                'filter-chip--blocked': principal.showAllEvents,
              }"
              :disabled="principal.showAllEvents"
              @click="principal.selectCollective(c.id)"
            >
              <span class="filter-dot" :style="{ background: c.color || getColor(c.id) }" />
              <span class="filter-chip-text">
                <span class="filter-chip-name">{{ c.name }}</span>
                <span class="filter-chip-role">{{ roleLabel(c.id) }}</span>
              </span>
            </button>
            <span v-if="collectives.length === 0" class="filters-empty">Нет коллективов</span>
          </div>
          <template v-if="principal.isPrincipal">
            <div class="filters-divider" />
            <span class="filters-sublabel">Статус мероприятия</span>
            <div class="filters">
              <button
                v-for="s in STATUS_FILTERS"
                :key="s.value"
                class="filter-chip"
                :class="{ 'filter-chip--active': statusFilter === s.value }"
                @click="statusFilter = s.value"
              >
                {{ s.label }}
              </button>
            </div>
          </template>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Pending attendance modal -->
    <PendingAttendanceModal
      :is-open="showPendingModal"
      :loading="pendingLoading"
      :events="pendingEvents"
      :attendances="calendar.attendances"
      :is-principal="principal.isPrincipal"
      :all-done="allPendingDone"
      @close="showPendingModal = false"
      @toggle-attendance="onToggleAttendance"
      @save-comment="onSaveComment"
      @delete-comment="onDeleteComment"
    />

    <ion-modal :is-open="showFullCalendar" @ion-modal-did-dismiss="showFullCalendar = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Календарь</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="showFullCalendar = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <CalendarGrid
          :current-month="calendar.currentMonth"
          :selected-date="calendar.selectedDate"
          :event-dates="eventDates"
          @select-day="onSelectDayMobile"
          @prev-month="onPrevMonth"
          @next-month="onNextMonth"
        />
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { IonPage, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonFab, IonFabButton, onIonViewWillEnter } from '@ionic/vue'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePrincipalStore } from '@/stores/principal'
import { usePlatform } from '@/composables/usePlatform'
import { useCalendarSync } from '@/composables/useCalendarSync'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  getEventsEventV1EventsGet,
  getEventEventV1EventsEventIdGet,
  getAttendancesEventV1AttendancesGet,
  getParticipationsEventV1ParticipationsGet,
  patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch,
  patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch,
} from '@/api/generated/-event'
import type { EventRead, SPageEventRead, EventStatus, AttendanceRead, ParticipationRead } from '@/api/generated/almaEventFlow.schemas'
import { getCollectiveColor } from '@/utils/colors'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import MiniCalendar from '@/components/calendar/MiniCalendar.vue'
import EventList from '@/components/event/EventList.vue'
import PendingAttendanceModal from '@/components/event/PendingAttendanceModal.vue'
import { calendarOutline, closeOutline, optionsOutline, alertCircleOutline } from 'ionicons/icons'

const router = useRouter()
const calendar = useEventCalendarStore()
const principal = usePrincipalStore()
const { isDesktop } = usePlatform()
const { syncSelectedDateToCalendar } = useCalendarSync()
const { withPending } = useAttendancePending()
const calendarScrollTarget = ref<string>()

const eventListRef = ref<{ scrollTo: (d: string, smooth?: boolean) => void } | null>(null)
const showFullCalendar = ref(false)
const showFilterModal = ref(false)
const mobileCalendarVisible = ref(true)
const loading = ref(false)
const hasMoreUp = ref(true)
const hasMoreDown = ref(true)

const getColor = getCollectiveColor

const collectives = computed(() => principal.collectives)
const selectedIds = computed(() => principal.selectedCollectiveIds)

const STATUS_ACTIVE: EventStatus = 'active'

// Фильтр статуса доступен только руководителю (участник всегда видит лишь активные)
const STATUS_FILTERS: Array<{ value: EventStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Любой статус' },
  { value: 'active', label: 'Активно' },
  { value: 'draft', label: 'Черновик' },
  { value: 'archived', label: 'Архив' },
]
const statusFilter = ref<EventStatus | 'all'>('all')

// Роль пользователя в коллективе для подписи на чипе фильтра
function roleLabel(collectiveId: string): string {
  const isP = principal.principalCollectiveIds.has(collectiveId)
  const isM = principal.userMemberIds.has(collectiveId)
  if (isP && isM) return 'Руководитель · Участник'
  if (isP) return 'Руководитель'
  return 'Участник'
}

const filteredEvents = computed(() => {
  // Руководитель видит мероприятия любого статуса (кроме шаблонов) и может фильтровать,
  // участник — только активные
  const visible = principal.isPrincipal
    ? calendar.events.filter((e) =>
        e.status !== 'template' && (statusFilter.value === 'all' || e.status === statusFilter.value))
    : calendar.events.filter((e) => e.status === STATUS_ACTIVE)
  // «Все мероприятия» — вообще все активные, без фильтра по коллективам
  if (principal.showAllEvents) return visible
  // Иначе — только мероприятия, в которых участвует хотя бы один выбранный коллектив
  return visible.filter((event) => {
    const items = calendar.attendances.get(event.id)
    if (!items || items.length === 0) return false
    return items.some((item) => selectedIds.value.includes(item.collectiveId))
  })
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
})

const todayFormatted = computed(() =>
  format(new Date(), 'EEEE, d MMMM', { locale: ru }).replace(/^./, (c) => c.toUpperCase()),
)

const eventDates = computed(() =>
  calendar.events
    .filter((e) => e.date)
    .map((e) => new Date(e.date as string)),
)

function getCalendarRange(): { start: Date; end: Date } {
  if (isDesktop.value) {
    return {
      start: startOfMonth(calendar.currentMonth),
      end: endOfMonth(calendar.currentMonth),
    }
  }
  return {
    start: startOfWeek(calendar.selectedDate, { weekStartsOn: 1 }),
    end: endOfWeek(calendar.selectedDate, { weekStartsOn: 1 }),
  }
}

function onSelectDay(date: Date) {
  syncSelectedDateToCalendar(date)
  calendarScrollTarget.value = date.toISOString()
}

function onSelectDayMobile(date: Date) {
  syncSelectedDateToCalendar(date)
  calendarScrollTarget.value = date.toISOString()
  showFullCalendar.value = false
}

function onSelectEvent(id: string) {
  router.push(`/event/${id}`)
}

function toDateString(d: Date): string {
  // Local date, not UTC — toISOString would shift the day near midnight
  return format(d, 'yyyy-MM-dd')
}

async function fetchAttendanceForEvents(eventList: Array<{ id: string }>) {
  if (collectives.value.length === 0 || eventList.length === 0) return
  const ids = eventList.map((e) => e.id)
  await calendar.fetchAttendances(collectives.value, ids, principal.userMemberIds)
}

const loadingUp = ref(false)
const loadingDown = ref(false)

// --- Мероприятия, требующие отметки присутствия ---
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
// Работает после того, как initLoad подгрузил все ожидающие мероприятия в стор.
function refreshPendingCount() {
  pendingCount.value = storePendingEventIds().length
}

// Шаг 1 (только чтение, без мутаций стора): event_id мероприятий, где у пользователя
// есть неотмеченная запись. Можно запускать параллельно с загрузкой основного списка.
async function fetchPendingRemoteEventIds(): Promise<string[]> {
  const memberIds = Array.from(principal.userMemberIds.values())
  if (memberIds.length === 0 || principal.collectives.length === 0) return []
  try {
    const attResults = await Promise.all(memberIds.map((mid) =>
      getAttendancesEventV1AttendancesGet({ member_id: mid, edited_at__isnull: true, limit: 100 }).catch(() => null),
    ))
    const partIds = new Set<string>()
    for (const r of attResults) {
      const items = ((r?.data as any)?.items || []) as AttendanceRead[]
      for (const a of items) if (!a.is_verified && a.participation_id) partIds.add(a.participation_id)
    }
    if (partIds.size === 0) return []
    const partResults = await Promise.all(principal.collectives.map((c) =>
      getParticipationsEventV1ParticipationsGet({ collective_id: c.id, limit: 100 }).catch(() => null),
    ))
    const eventIds = new Set<string>()
    for (const r of partResults) {
      const parts = ((r?.data as any)?.items || []) as ParticipationRead[]
      for (const p of parts) if (partIds.has(p.id)) eventIds.add(p.event_id)
    }
    return Array.from(eventIds)
  } catch {
    return []
  }
}

// Шаг 2: дозагружает ожидающие мероприятия в стор (addEvents безопасен) и их attendance.
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

// Полный резолв (для кнопки и пересчёта): шаг 1 + шаг 2
async function resolvePendingEventIds(): Promise<string[]> {
  return mergePendingEvents(await fetchPendingRemoteEventIds())
}

// Открывает модалку с активными ожидающими мероприятиями, фиксируя список
function showPending(ids: string[]) {
  if (ids.length === 0) return
  pendingAutoShown = true
  pendingEventIds.value = ids
  showPendingModal.value = true
}

async function openPending() {
  showPendingModal.value = true
  pendingLoading.value = true
  try {
    pendingEventIds.value = await resolvePendingEventIds()
  } finally {
    pendingLoading.value = false
  }
}

async function loadMoreUp(): Promise<boolean> {
  if (!hasMoreUp.value || loadingUp.value) return false
  loadingUp.value = true
  loading.value = true
  try {
    const firstDate = calendar.events[0]?.date
    if (!firstDate) return false
    const response = await getEventsEventV1EventsGet({
      date__lte: firstDate,
      limit: 10,
      order_by: '-date',
    })
    const items = (response.data as SPageEventRead).items
    if (items.length === 0) {
      hasMoreUp.value = false
      return false
    }
    const before = calendar.events.length
    calendar.addEvents(items)
    if (calendar.events.length === before) {
      hasMoreUp.value = false
      return false
    }
    const ids = items.map((e) => e.id)
    await calendar.fetchAttendances(collectives.value, ids, principal.userMemberIds)
    return true
  } finally {
    loading.value = false
    loadingUp.value = false
  }
}

async function loadMoreDown(): Promise<boolean> {
  if (!hasMoreDown.value || loadingDown.value) return false
  loadingDown.value = true
  loading.value = true
  try {
    const lastDate = calendar.events[calendar.events.length - 1]?.date
    if (!lastDate) return false
    const response = await getEventsEventV1EventsGet({
      date__gte: lastDate,
      limit: 10,
      order_by: 'date',
    })
    const items = (response.data as SPageEventRead).items
    if (items.length === 0) {
      hasMoreDown.value = false
      return false
    }
    const before = calendar.events.length
    calendar.addEvents(items)
    if (calendar.events.length === before) {
      hasMoreDown.value = false
      return false
    }
    const ids = items.map((e) => e.id)
    await calendar.fetchAttendances(collectives.value, ids, principal.userMemberIds)
    return true
  } finally {
    loading.value = false
    loadingDown.value = false
  }
}

// Догружает мероприятия, пока видимый диапазон календаря не заполнится
// (ограничение по числу итераций — страховка от зацикливания)
async function checkCalendarFill() {
  for (let i = 0; i < 20; i++) {
    let loaded = false
    const { start, end } = getCalendarRange()

    if (calendar.events.length === 0) {
      if (hasMoreDown.value && await loadMoreDown()) loaded = true
      else if (hasMoreUp.value && await loadMoreUp()) loaded = true
    } else {
      const firstDate = new Date(calendar.events[0].date!)
      if (hasMoreUp.value && firstDate >= start && await loadMoreUp()) loaded = true

      const lastDate = new Date(calendar.events[calendar.events.length - 1].date!)
      if (hasMoreDown.value && lastDate <= end && await loadMoreDown()) loaded = true
    }

    if (!loaded) break
  }

  // Edge-probe: проверяем, есть ли события СТРОГО за границей видимого диапазона.
  // date__lt/date__gt нет в API, поэтому фильтруем по строгому сравнению дат в ответе.
  if (hasMoreUp.value && calendar.events.length > 0) {
    const firstDate = calendar.events[0].date
    if (firstDate) {
      try {
        const resp = await getEventsEventV1EventsGet({ date__lte: firstDate, limit: 3, order_by: '-date' })
        const items = (resp.data as SPageEventRead).items
        if (!items.some((e) => e.date && e.date < firstDate)) hasMoreUp.value = false
      } catch { /* ignore */ }
    }
  }
  if (hasMoreDown.value && calendar.events.length > 0) {
    const lastDate = calendar.events[calendar.events.length - 1].date
    if (lastDate) {
      try {
        const resp = await getEventsEventV1EventsGet({ date__gte: lastDate, limit: 3, order_by: 'date' })
        const items = (resp.data as SPageEventRead).items
        if (!items.some((e) => e.date && e.date > lastDate)) hasMoreDown.value = false
      } catch { /* ignore */ }
    }
  }
}

// Перелистывание недели в мобильном мини-календаре
function onShiftWeek(direction: 1 | -1) {
  const next = addDays(calendar.selectedDate, direction * 7)
  syncSelectedDateToCalendar(next)
  calendarScrollTarget.value = next.toISOString()
  checkCalendarFill()
}

function onPrevMonth() {
  calendar.prevMonth()
  scrollToFirstEventOfMonth()
  checkCalendarFill()
}

function onNextMonth() {
  calendar.nextMonth()
  scrollToFirstEventOfMonth()
  checkCalendarFill()
}

function scrollToFirstEventOfMonth() {
  const monthStart = new Date(calendar.currentMonth.getFullYear(), calendar.currentMonth.getMonth(), 1)
  const monthEnd = new Date(calendar.currentMonth.getFullYear(), calendar.currentMonth.getMonth() + 1, 0, 23, 59, 59)
  const monthEvents = calendar.events.filter((e) => {
    if (!e.date) return false
    const d = new Date(e.date)
    return d >= monthStart && d <= monthEnd
  })
  if (monthEvents.length > 0 && monthEvents[0].date) {
    calendar.setSelectedDate(new Date(monthEvents[0].date))
    calendarScrollTarget.value = monthEvents[0].date
  } else {
    calendar.setSelectedDate(monthStart)
    calendarScrollTarget.value = monthStart.toISOString()
  }
}

// Находит коллектив и запись attendance по её id среди загруженных
function findAttendanceContext(attendanceId: string): { collectiveId: string; memberId: string } | null {
  for (const items of calendar.attendances.values()) {
    for (const item of items) {
      if (item.attendance?.id === attendanceId) {
        return { collectiveId: item.collectiveId, memberId: item.attendance.member_id }
      }
    }
  }
  return null
}

// Руководитель правит через эндпоинт своего коллектива, участник — только свою запись
async function patchAttendance(attendanceId: string, body: { is_attended?: boolean; comment?: string | null }) {
  const ctx = findAttendanceContext(attendanceId)
  if (!ctx) return
  // Обновление данных внутри withPending: спиннер исчезает вместе со сменой значения чипа
  await withPending(attendanceId, async () => {
    if (principal.principalCollectiveIds.has(ctx.collectiveId)) {
      await patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch(ctx.collectiveId, attendanceId, body)
    } else {
      await patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch(ctx.memberId, attendanceId, body)
    }
    await fetchAttendanceForEvents(calendar.events)
    refreshPendingCount()
  })
}

async function onToggleAttendance(attendanceId: string, isAttended: boolean) {
  try {
    await patchAttendance(attendanceId, { is_attended: isAttended })
  } catch (e) {
    console.error('toggleAttendance failed:', e)
  }
}

async function onSaveComment(attendanceId: string, comment: string) {
  try {
    await patchAttendance(attendanceId, { comment })
  } catch (e) {
    console.error('saveComment failed:', e)
  }
}

async function onDeleteComment(attendanceId: string) {
  try {
    await patchAttendance(attendanceId, { comment: null })
  } catch (e) {
    console.error('deleteComment failed:', e)
  }
}

function onVisibleDateChanged(dateStr: string) {
  syncSelectedDateToCalendar(new Date(dateStr))
}

function onCalendarVisibleChange(visible: boolean) {
  if (!isDesktop.value) mobileCalendarVisible.value = visible
}

async function initLoad() {
  const today = new Date()
  const todayStr = toDateString(today)
  loading.value = true
  hasMoreUp.value = true
  hasMoreDown.value = true
  pendingAutoShown = false
  showPendingModal.value = false
  pendingEventIds.value = []
  // Календарь и список всегда стартуют от сегодняшнего дня
  calendar.setSelectedDate(today)
  calendar.setCurrentMonth(today)

  // Гарантируем, что коллективы текущего аккаунта загружены до запроса посещаемости
  await principal.fetchCollectives()

  // Резолв ожидающих отметок стартует параллельно с основным списком (только чтение),
  // чтобы модалка появилась как можно раньше — не дожидаясь полной пагинации
  const pendingIdsPromise = fetchPendingRemoteEventIds()

  try {
    const [pastResp, futureResp] = await Promise.all([
      getEventsEventV1EventsGet({ date__lte: todayStr, order_by: '-date', limit: 10 }),
      getEventsEventV1EventsGet({ date__gte: todayStr, order_by: 'date', limit: 10 }),
    ])

    const pastList = (pastResp.data as SPageEventRead).items
    const futureList = (futureResp.data as SPageEventRead).items

    // Мероприятия с датой «сегодня» попадают и в date__lte, и в date__gte — дедуп по id
    const byId = new Map<string, EventRead>()
    for (const e of [...pastList, ...futureList]) byId.set(e.id, e)
    const combined = Array.from(byId.values()).sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
    )

    if (combined.length > 0) {
      calendar.setEvents(combined)
      await fetchAttendanceForEvents(combined)
    }
  } catch {
    /* ignore */
  }

  // Сразу показываем модалку, если есть АКТИВНЫЕ мероприятия с неотмеченной записью
  // (статус проверяется внутри mergePendingEvents — для неактивных модалка не нужна)
  const remoteIds = await pendingIdsPromise
  const activePending = await mergePendingEvents(remoteIds)
  if (!pendingAutoShown && activePending.length > 0) showPending(activePending)
  refreshPendingCount()

  // Тяжёлая дозагрузка диапазона календаря — уже после показа модалки
  await checkCalendarFill()

  loading.value = false
  // Первым видимым делаем самое раннее мероприятие с датой >= сегодня
  const todayMidnight = new Date(todayStr)
  const upcoming = calendar.events.find((e) => e.date && new Date(e.date) >= todayMidnight)
  const target = upcoming?.date ?? calendar.selectedDate.toISOString()
  calendarScrollTarget.value = target
  // Прокрутка списка к стартовой позиции — мгновенно, значение могло не измениться
  nextTick(() => eventListRef.value?.scrollTo(target, false))
  refreshPendingCount()
}

// Перезагружаем список при каждом входе на главную: смена аккаунта, возврат
// с деталей мероприятия, создание нового ивента руководителем — всё подхватится
onIonViewWillEnter(initLoad)
</script>

<style scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.home-header {
  padding: 24px 0 8px;
}

.home-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home-greeting {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--ion-text-color);
}

.home-date {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--ion-color-medium);
}

.home-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 184, 0, 0.14);
  color: var(--ion-color-warning);
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s, box-shadow 0.15s;
}

.pending-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(255, 184, 0, 0.25);
}

.pending-chip ion-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.pending-chip-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}

.pending-chip-num {
  font-size: 16px;
  font-weight: 700;
}

.pending-chip-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  opacity: 0.85;
}

.stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: var(--ion-card-background);
  border-radius: 12px;
  box-shadow: var(--ion-card-shadow);
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.home-content {
  padding-bottom: 80px;
}

.home-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.home-layout--mobile {
  flex-direction: column;
}

.calendar-section {
  flex-shrink: 0;
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home-layout--mobile .calendar-section {
  width: 100%;
  transition: max-height 0.3s ease, opacity 0.3s ease, margin-bottom 0.3s ease;
  max-height: 400px;
  overflow: hidden;
}

.home-layout--mobile .calendar-section.calendar-section--hidden {
  max-height: 0;
  opacity: 0;
  margin-bottom: -12px;
}

.section-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 16px;
}

.section-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.events-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.events-section {
  flex: 1;
  min-width: 0;
}

.home-layout--mobile .events-section {
  width: 100%;
}

.events-card .section-card-header {
  margin-bottom: 0;
  padding: 8px 0 12px;
}

.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.filter-chip:hover {
  border-color: var(--ion-color-step-400);
}

.filter-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(108, 99, 255, 0.08);
  color: var(--ion-color-primary);
}

.filter-chip--blocked {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.filter-chip-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.25;
}

.filter-chip-name {
  font-weight: 600;
}

.filter-chip-role {
  font-size: 10px;
  font-weight: 500;
  color: var(--ion-color-step-400);
}

.filter-chip--active .filter-chip-role {
  color: var(--ion-color-primary);
  opacity: 0.75;
}

.filter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.filters-empty {
  font-size: 13px;
  color: var(--ion-color-step-400);
}

.filters-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin: 12px 0 10px;
}

.filters-sublabel {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  margin-bottom: 8px;
}

.events-empty,
.events-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 20px;
  color: var(--ion-color-medium);
}

.events-empty ion-icon {
  font-size: 40px;
  opacity: 0.4;
}

.filter-fab {
  bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.filter-modal-body {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.events-empty p,
.events-loading p {
  margin: 0;
  font-size: 14px;
}

.events-loading .loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--ion-border-color);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
