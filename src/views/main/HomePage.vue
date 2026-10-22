<template>
  <ion-page>
    <!-- На мобильном список нарочно выше экрана (см. EventList.vue) -- его
         скроллит только сам список, поэтому внешний ion-content скроллить
         не должен, иначе появляется второй, "внешний" скролл. -->
    <ion-content :scroll-y="isDesktop">
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
              :class="{ 'calendar-section--hidden': calendarCollapsed }"
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
                <HomeFilters
                  v-model:statuses="statusFilter"
                  v-model:types="typeFilter"
                  v-model:levels="levelFilter"
                  v-model:formats="formatFilter"
                  v-model:upcoming="upcomingFilter"
                  :loading="principal.loading"
                  :changed="filtersChanged"
                  @reset="resetFilters"
                />
              </div>
            </div>

            <div class="events-section">
              <div class="section-card events-card">
                <div class="section-card-header">
                  <h3>Мероприятия</h3>
                  <span class="events-count" v-if="!loading && filteredEvents.length">{{ filteredEvents.length }}</span>
                </div>
                <!-- EventList монтируется только когда загрузка ПОЛНОСТЬЮ завершена --
                     initLoad()/reloadEventsForFilter() догружают диапазон календаря
                     несколькими внутренними запросами (checkCalendarFill), и если
                     показывать список всё это время, он на глазах донабирает
                     карточки в несколько заходов вместо одного стабильного появления.
                     Пока loading -- скелетон вместо (растущего на глазах) списка. -->
                <EventList
                  v-if="!loading"
                  ref="eventListRef"
                  :events="filteredEvents"
                  :attendances="calendar.attendances"
                  :stage-times="calendar.stageTimes"
                  :is-principal="principal.isPrincipal"
                  :loading="loading"
                  :loading-up="loadingUp"
                  :loading-down="loadingDown"
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
                <!-- Скелетон карточек мероприятий вместо спиннера -- форма будущих
                     карточек с бегущим бликом (.skeleton, theme/variables.css),
                     чтобы список не появлялся рывком после загрузки. -->
                <div v-if="loading" class="events-loading" aria-hidden="true">
                  <div v-for="n in 4" :key="n" class="skel-card">
                    <span class="skeleton skeleton--circle skel-dot" />
                    <div class="skel-info">
                      <span class="skeleton skeleton--text" :style="{ width: skeletonWidth(n) }" />
                      <span class="skeleton skeleton--text skel-date" />
                    </div>
                  </div>
                </div>
                <div v-else-if="filteredEvents.length === 0" class="events-empty">
                  <ion-icon :icon="calendarOutline" />
                  <p>{{ filtersChanged ? 'Ничего не найдено' : 'Мероприятий нет' }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>

    <!-- Mobile filter FAB -->
    <AppFab v-if="!isDesktop" :icon="optionsOutline" aria-label="Фильтры" @click="showFilterModal = true" />

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
          <HomeFilters
            v-model:statuses="statusFilter"
            v-model:types="typeFilter"
            v-model:levels="levelFilter"
            v-model:formats="formatFilter"
            v-model:upcoming="upcomingFilter"
            :loading="principal.loading"
            :changed="filtersChanged"
            @reset="resetFilters"
          />
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
import { ref, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IonPage, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, onIonViewWillEnter } from '@ionic/vue'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import { usePlatform } from '@/composables/usePlatform'
import { useUrlState } from '@/composables/useUrlState'
import { useCalendarSync } from '@/composables/useCalendarSync'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { usePendingAttendance } from '@/composables/usePendingAttendance'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  getEventsEventV1EventsGet,
  patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch,
  patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch,
} from '@/api/generated/almaEventFlow'
import type {
  EventRead, PageV1EventRead, EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1,
  GetEventsEventV1EventsGetParams,
} from '@/api/generated/almaEventFlow'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import MiniCalendar from '@/components/calendar/MiniCalendar.vue'
import EventList from '@/components/event/EventList.vue'
import HomeFilters from '@/components/event/HomeFilters.vue'
import AppFab from '@/components/common/AppFab.vue'
import PendingAttendanceModal from '@/components/event/PendingAttendanceModal.vue'
import { buildEventWindow } from '@/utils/eventWindow'
import type { EventWindow } from '@/utils/eventWindow'
import {
  HOME_FILTER_DEFAULTS, countActiveFilters, homeFilterParams, matchesHomeFilters, parseHomeFilters, statusesToQuery,
} from '@/utils/homeFilters'
import { calendarOutline, closeOutline, optionsOutline, alertCircleOutline } from 'ionicons/icons'

const router = useRouter()
const calendar = useEventCalendarStore()
const principal = usePrincipalStore()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()
const { syncSelectedDateToCalendar } = useCalendarSync()
const { withPending } = useAttendancePending()
const {
  showPendingModal, pendingLoading, pendingCount, pendingEvents, allPendingDone,
  refreshPendingCount, fetchPendingRemoteEventIds, mergePendingEvents, maybeAutoShow,
  openPending, resetPending,
} = usePendingAttendance()

// Ширины скелетон-строк слегка отличаются -- иначе ряд одинаковых полосок
// читается как явная заглушка, а не намёк на будущий текст разной длины.
const SKELETON_WIDTHS = ['62%', '48%', '74%', '56%']
function skeletonWidth(n: number): string {
  return SKELETON_WIDTHS[n % SKELETON_WIDTHS.length]
}

const eventListRef = ref<{ scrollTo: (day: Date, smooth?: boolean) => Promise<boolean> } | null>(null)
const showFullCalendar = ref(false)
const showFilterModal = ref(false)
const mobileCalendarVisible = ref(true)
const loading = ref(false)
const hasMoreUp = ref(true)
const hasMoreDown = ref(true)

const collectives = computed(() => principal.collectives)

// Нет выбора коллективов (и не «Все мероприятия») → показывать нечего
const noSelection = computed(
  () => !principal.showAllEvents && principal.selectedCollectiveIds.length === 0,
)

// Фильтры лежат в адресной строке; сервер получает их же, поэтому страницы
// списка и признаки «есть ли ещё» всегда относятся к одному и тому же набору.
const facetUrl = useUrlState({ ...HOME_FILTER_DEFAULTS })
const filters = computed(() => parseHomeFilters(facetUrl))
const filtersChanged = computed(() => countActiveFilters(filters.value, principal.isPrincipal) > 0)

const statusFilter = computed({
  get: () => filters.value.statuses,
  set: (value: EventStatusEnumV1[]) => { facetUrl.statuses = statusesToQuery(value) },
})
const typeFilter = computed({
  get: () => filters.value.types,
  set: (value: EventTypeEnumV1[]) => { facetUrl.types = value.join(',') },
})
const levelFilter = computed({
  get: () => filters.value.levels,
  set: (value: EventLevelEnumV1[]) => { facetUrl.levels = value.join(',') },
})
const formatFilter = computed({
  get: () => filters.value.formats,
  set: (value: EventFormatEnumV1[]) => { facetUrl.formats = value.join(',') },
})
const upcomingFilter = computed({
  get: () => filters.value.upcoming,
  set: (value: boolean) => { facetUrl.upcoming = value ? '1' : '' },
})

function resetFilters() {
  Object.assign(facetUrl, HOME_FILTER_DEFAULTS)
}

function toDateString(d: Date): string {
  // Local date, not UTC — toISOString would shift the day near midnight
  return format(d, 'yyyy-MM-dd')
}

const filteredEvents = computed(() => {
  const today = toDateString(new Date())
  return calendar.events.filter((e) => matchesHomeFilters(e, filters.value, principal.isPrincipal, today))
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

// Календарь подсвечивает ровно те же события, что видны в списке (все фильтры)
const eventDates = computed(() =>
  filteredEvents.value
    .filter((e) => e.date)
    .map((e) => parseISO(e.date as string)),
)

const calendarCollapsed = computed(
  () => !isDesktop.value && settings.collapseOnScroll && !mobileCalendarVisible.value,
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

function onSelectEvent(id: string) {
  router.push(`/event/${id}`)
}

async function fetchAttendanceForEvents(eventList: Array<{ id: string }>) {
  if (eventList.length === 0) return
  const ids = eventList.map((e) => e.id)
  await Promise.all([
    collectives.value.length > 0
      ? calendar.fetchAttendances(collectives.value, ids, principal.userMemberIds)
      : Promise.resolve(),
    calendar.fetchStageTimes(ids),
  ])
}

const loadingUp = ref(false)
const loadingDown = ref(false)
// Пока initLoad выставляет коллективы (fetchCollectives → выбор), watch фильтра
// не должен запускать параллельную перезагрузку
let initializing = false
// Номер последней загрузки окна: ответ более старой не должен затирать новый список
let loadSeq = 0
let reloadTimer: ReturnType<typeof setTimeout> | undefined

const EVENTS_PAGE_SIZE = 10

// Параметры запроса: фильтры страницы + выбранные коллективы + то, что нужно конкретному запросу
function listParams(extra: GetEventsEventV1EventsGetParams): GetEventsEventV1EventsGetParams {
  const params = homeFilterParams(filters.value, principal.isPrincipal, toDateString(new Date()))
  if (!principal.showAllEvents && principal.selectedCollectiveIds.length) {
    params.participant_id__in = principal.selectedCollectiveIds.join(',')
  }
  return { ...params, ...extra }
}

async function fetchPage(extra: GetEventsEventV1EventsGetParams): Promise<EventRead[]> {
  const response = await getEventsEventV1EventsGet(listParams(extra))
  return (response.data as PageV1EventRead).items
}

// Окно событий вокруг даты: прошлое (<=) и будущее (>=) с теми же фильтрами; дедуп +
// сортировка + признаки "есть ли ещё" -- общая логика с «Участиями» (матрицей),
// см. utils/eventWindow. «Только предстоящие» не уходит раньше сегодня (listParams).
async function fetchEventWindow(anchorStr: string): Promise<EventWindow<EventRead>> {
  const today = toDateString(new Date())
  const noPast = filters.value.upcoming && anchorStr <= today
  const from = filters.value.upcoming && anchorStr < today ? today : anchorStr
  const [past, future] = await Promise.all([
    noPast
      ? Promise.resolve<EventRead[]>([])
      : fetchPage({ date__lte: anchorStr, order_by: '-date', limit: EVENTS_PAGE_SIZE }),
    fetchPage({ date__gte: from, order_by: 'date', limit: EVENTS_PAGE_SIZE }),
  ])
  return buildEventWindow(past, future, EVENTS_PAGE_SIZE)
}

// Новые события специально попадают в calendar.events ПОСЛЕДНИМ шагом, уже
// после того как для них подтянуты attendance и stageTimes -- иначе карточка
// сперва рендерится "пустой" (без отметок/времени этапов), а через сетевой
// круг внезапно дозаполняется контентом. Это само по себе выглядит как рывок
// списка, даже когда scrollTop не прыгает (см. captureAnchor/restoreAnchor
// в EventList.vue, которые гасят только сдвиг позиции, а не смену контента
// уже показанной карточки).
function newEventIds(items: EventRead[]): string[] {
  const existingIds = new Set(calendar.events.map((e) => e.id))
  return items.filter((e) => !existingIds.has(e.id)).map((e) => e.id)
}

// loading (в отличие от loadingUp/loadingDown ниже) сюда намеренно не трогаем:
// эта функция также вызывается в цикле из checkCalendarFill(), и если
// дёргать общий флаг на каждой итерации, он несколько раз мигает false/true --
// список на экране выглядит нестабильным, будто "доезжает" рывками. loading — это
// только внешняя граница initLoad()/reloadWindow(), а повторный вход
// уже прикрыт loadingUp/loadingDown (см. loadAtEdges в EventList).
async function loadMoreUp(): Promise<boolean> {
  if (!hasMoreUp.value || loadingUp.value || noSelection.value) return false
  const seq = loadSeq
  loadingUp.value = true
  try {
    const firstDate = calendar.events[0]?.date
    if (!firstDate) return false
    const items = await fetchPage({ date__lte: firstDate, limit: EVENTS_PAGE_SIZE, order_by: '-date' })
    if (seq !== loadSeq) return false
    hasMoreUp.value = items.length === EVENTS_PAGE_SIZE
    if (items.length === 0) return false
    const ids = newEventIds(items)
    if (ids.length === 0) {
      hasMoreUp.value = false // защита от зацикливания -- вся страница уже была загружена
      return false
    }
    await Promise.all([
      calendar.fetchAttendances(collectives.value, ids, principal.userMemberIds),
      calendar.fetchStageTimes(ids),
    ])
    if (seq !== loadSeq) return false
    calendar.addEvents(items)
    return true
  } finally {
    loadingUp.value = false
  }
}

// см. коммент у loadMoreUp -- loading общий флаг здесь тоже не трогаем.
async function loadMoreDown(): Promise<boolean> {
  if (!hasMoreDown.value || loadingDown.value || noSelection.value) return false
  const seq = loadSeq
  loadingDown.value = true
  try {
    const lastDate = calendar.events[calendar.events.length - 1]?.date
    if (!lastDate) return false
    const items = await fetchPage({ date__gte: lastDate, limit: EVENTS_PAGE_SIZE, order_by: 'date' })
    if (seq !== loadSeq) return false
    hasMoreDown.value = items.length === EVENTS_PAGE_SIZE
    if (items.length === 0) return false
    const ids = newEventIds(items)
    if (ids.length === 0) {
      hasMoreDown.value = false // защита от зацикливания -- вся страница уже была загружена
      return false
    }
    await Promise.all([
      calendar.fetchAttendances(collectives.value, ids, principal.userMemberIds),
      calendar.fetchStageTimes(ids),
    ])
    if (seq !== loadSeq) return false
    calendar.addEvents(items)
    return true
  } finally {
    loadingDown.value = false
  }
}

// Догружает мероприятия, пока видимый диапазон календаря не заполнится
// (ограничение по числу итераций — страховка от зацикливания). Нужна только
// при ПРЫЖКЕ по календарю на произвольную дату (onShiftWeek/onPrevMonth/
// onNextMonth) — туда нельзя доскроллить постепенно, поэтому диапазон
// догружается заранее. Начальная загрузка (initLoad/reloadWindow)
// эту функцию не вызывает: там достаточно одного окна вокруг даты
// (fetchEventWindow) + бесшовной подгрузки по достижении края списка
// (loadMoreUp/loadMoreDown) — тот же принцип, что и в матрице «Участий»
// (см. DashboardPage.vue/positionMatrixScroll + loadMorePast/loadMoreFuture).
async function checkCalendarFill() {
  for (let i = 0; i < 20; i++) {
    let loaded = false
    const { start, end } = getCalendarRange()

    if (calendar.events.length === 0) {
      if (hasMoreDown.value && await loadMoreDown()) loaded = true
      else if (hasMoreUp.value && await loadMoreUp()) loaded = true
    } else {
      const firstDate = parseISO(calendar.events[0].date!)
      if (hasMoreUp.value && firstDate >= start && await loadMoreUp()) loaded = true

      const lastDate = parseISO(calendar.events[calendar.events.length - 1].date!)
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
        const items = await fetchPage({ date__lte: firstDate, limit: 3, order_by: '-date' })
        if (!items.some((e) => e.date && e.date < firstDate)) hasMoreUp.value = false
      } catch { /* ignore */ }
    }
  }
  if (hasMoreDown.value && calendar.events.length > 0) {
    const lastDate = calendar.events[calendar.events.length - 1].date
    if (lastDate) {
      try {
        const items = await fetchPage({ date__gte: lastDate, limit: 3, order_by: 'date' })
        if (!items.some((e) => e.date && e.date > lastDate)) hasMoreDown.value = false
      } catch { /* ignore */ }
    }
  }
}

function whenIdle(flag: { value: boolean }): Promise<void> {
  if (!flag.value) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(flag, (busy) => {
      if (busy) return
      stop()
      resolve()
    })
  })
}

// Ставит список на дату; если длины списка не хватило довести карточку до верха
// (мало загруженных карточек), догружает вниз и повторяет.
async function aimAt(date: Date, smooth: boolean) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const reached = await eventListRef.value?.scrollTo(date, smooth && attempt === 0)
    if (reached !== false || !hasMoreDown.value) return
    if (loadingDown.value) await whenIdle(loadingDown)
    else if (!(await loadMoreDown())) return
    await nextTick()
  }
}

// Выбор даты в календаре: список встаёт на её первое мероприятие (у пустого дня --
// на ближайшее следующее). Дата за пределами загруженного окна -- новое окно вокруг неё.
async function gotoDate(date: Date) {
  syncSelectedDateToCalendar(date)
  const key = toDateString(date)
  const first = calendar.events[0]?.date
  const last = calendar.events[calendar.events.length - 1]?.date
  const beyondEnd = hasMoreDown.value && (!last || key > last)
  const beyondStart = hasMoreUp.value && (!first || key < first)
  if (beyondEnd || beyondStart) await reloadWindow(key)
  else await aimAt(date, true)
}

function onSelectDay(date: Date) {
  gotoDate(date)
}

function onSelectDayMobile(date: Date) {
  showFullCalendar.value = false
  gotoDate(date)
}

// Перелистывание недели в мобильном мини-календаре
async function onShiftWeek(direction: 1 | -1) {
  await gotoDate(addDays(calendar.selectedDate, direction * 7))
  await checkCalendarFill()
}

function onPrevMonth() {
  calendar.prevMonth()
  showMonth()
}

function onNextMonth() {
  calendar.nextMonth()
  showMonth()
}

async function showMonth() {
  const monthStart = startOfMonth(calendar.currentMonth)
  const monthEnd = endOfMonth(calendar.currentMonth)
  const firstOfMonth = filteredEvents.value.find((e) => {
    if (!e.date) return false
    const d = parseISO(e.date)
    return d >= monthStart && d <= monthEnd
  })
  await gotoDate(firstOfMonth?.date ? parseISO(firstOfMonth.date) : monthStart)
  await checkCalendarFill()
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
  syncSelectedDateToCalendar(parseISO(dateStr))
}

function onCalendarVisibleChange(visible: boolean) {
  if (!isDesktop.value && settings.collapseOnScroll) mobileCalendarVisible.value = visible
}

watch(() => settings.collapseOnScroll, (collapsing) => {
  if (!collapsing) mobileCalendarVisible.value = true
})

async function initLoad() {
  const today = new Date()
  const todayStr = toDateString(today)
  const seq = ++loadSeq
  clearTimeout(reloadTimer)
  initializing = true
  loading.value = true
  hasMoreUp.value = true
  hasMoreDown.value = true
  resetPending()
  // Календарь и список всегда стартуют от сегодняшнего дня
  calendar.setSelectedDate(today)
  calendar.setCurrentMonth(today)

  // Гарантируем, что коллективы текущего аккаунта загружены до запроса посещаемости
  await principal.fetchCollectives()
  initializing = false

  // Резолв ожидающих отметок стартует параллельно с основным списком (только чтение),
  // чтобы модалка появилась как можно раньше — не дожидаясь полной пагинации
  const pendingIdsPromise = fetchPendingRemoteEventIds()

  if (noSelection.value) {
    calendar.setEvents([])
  } else {
    try {
      const eventWindow = await fetchEventWindow(todayStr)
      if (seq !== loadSeq) return
      calendar.setEvents(eventWindow.events)
      hasMoreUp.value = eventWindow.hasMorePast
      hasMoreDown.value = eventWindow.hasMoreFuture
      if (eventWindow.events.length > 0) await fetchAttendanceForEvents(eventWindow.events)
    } catch {
      /* ignore */
    }
  }

  // Сразу показываем модалку, если есть АКТИВНЫЕ мероприятия с неотмеченной записью
  // (статус проверяется внутри mergePendingEvents — для неактивных модалка не нужна)
  const remoteIds = await pendingIdsPromise
  maybeAutoShow(await mergePendingEvents(remoteIds))
  refreshPendingCount()

  if (seq !== loadSeq) return
  loading.value = false
  // Первым видимым делаем самое раннее мероприятие с датой >= сегодня
  await nextTick()
  await aimAt(today, false)
  refreshPendingCount()
}

// Смена выбора коллективов, фильтров или прыжок на далёкую дату → новое окно
// из бэкенда вокруг даты. Лёгкая: не сбрасывает дату и не трогает модалку pending.
async function reloadWindow(anchorStr: string) {
  const seq = ++loadSeq
  loading.value = true
  hasMoreUp.value = true
  hasMoreDown.value = true
  if (noSelection.value) {
    calendar.setEvents([])
    loading.value = false
    refreshPendingCount()
    return
  }
  try {
    const eventWindow = await fetchEventWindow(anchorStr)
    if (seq !== loadSeq) return
    calendar.setEvents(eventWindow.events)
    hasMoreUp.value = eventWindow.hasMorePast
    hasMoreDown.value = eventWindow.hasMoreFuture
    if (eventWindow.events.length > 0) await fetchAttendanceForEvents(eventWindow.events)
  } catch {
    /* ignore */
  }
  if (seq !== loadSeq) return
  loading.value = false
  refreshPendingCount()
  await nextTick()
  await aimAt(parseISO(anchorStr), false)
}

function reloadSoon() {
  if (initializing) return
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    if (filters.value.upcoming && toDateString(calendar.selectedDate) < toDateString(new Date())) {
      syncSelectedDateToCalendar(new Date())
    }
    reloadWindow(toDateString(calendar.selectedDate))
  }, 120)
}

watch(
  () => [
    principal.showAllEvents,
    principal.selectedCollectiveIds.join(','),
    facetUrl.statuses,
    facetUrl.types,
    facetUrl.levels,
    facetUrl.formats,
    facetUrl.upcoming,
  ],
  reloadSoon,
)

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
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  margin: 0;
  color: var(--ion-text-color);
}

.home-date {
  margin: 4px 0 0;
  font-size: var(--fs-md);
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
  transition: transform 0.15s, box-shadow 0.15s;
}

.pending-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(255, 184, 0, 0.25);
}

.pending-chip ion-icon {
  font-size: var(--fs-xl);
  flex-shrink: 0;
}

.pending-chip-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}

.pending-chip-num {
  font-size: var(--fs-lg);
  font-weight: var(--fw-bold);
}

.pending-chip-label {
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
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
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: var(--fs-2xs);
  color: var(--ion-color-medium);
  font-weight: var(--fw-medium);
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
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
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
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
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

.events-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 20px;
  color: var(--ion-color-medium);
}

.events-empty ion-icon {
  font-size: var(--icon-hero);
  opacity: 0.4;
}


.filter-modal-body {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.events-empty p {
  margin: 0;
  font-size: var(--fs-md);
}

/* Скелетон списка мероприятий -- форма .event-card (см. EventPreview.vue) */
.events-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skel-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--ion-card-background);
  border-radius: 14px;
  box-shadow: var(--ion-card-shadow);
}

.skel-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.skel-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.skel-info .skeleton {
  height: 13px;
}

.skel-date {
  width: 40% !important;
  height: 10px !important;
}
</style>
