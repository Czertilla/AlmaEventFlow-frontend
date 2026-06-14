<template>
  <div
    ref="containerRef"
    class="event-list"
    :style="maxHeight ? { maxHeight: maxHeight + 'px' } : undefined"
    @scroll="handleScroll"
  >
    <div class="sentinel sentinel--top" />
    <div v-if="loadingUp" class="event-list-loading event-list-loading--top">
      <div class="loading-spinner" />
    </div>
    <div v-else-if="!hasMoreUp" class="end-indicator end-indicator--top">
      <span class="end-line" /><span class="end-label">Начало списка</span><span class="end-line" />
    </div>
    <template v-for="(event, idx) in events" :key="event.id">
      <div
        v-if="showMonthSeparator(idx)"
        class="month-separator"
        :class="{ 'month-separator--hidden': idx < activeMonthIdx || (!showLocator && idx === activeMonthIdx) }"
      >
        <span class="month-separator-label">{{ monthLabel(event.date) }}</span>
      </div>
      <EventPreview
        :ref="(el) => setEventRef(event.id, el)"
        :event="event"
        :items="getItems(event)"
        :is-principal="isPrincipal"
        @click="emit('selectEvent', event.id)"
        @toggle-attendance="(id, v) => emit('toggleAttendance', id, v)"
        @save-comment="(id, c) => emit('saveComment', id, c)"
        @delete-comment="(id) => emit('deleteComment', id)"
      />
    </template>
    <div class="sentinel sentinel--bottom" />
    <div v-if="loadingDown" class="event-list-loading event-list-loading--bottom">
      <div class="loading-spinner" />
    </div>
    <div v-else-if="!hasMoreDown" class="list-end">
      <ion-icon :icon="checkmarkDoneOutline" />
      <span>Больше мероприятий нет</span>
    </div>
    <!-- Распорка: чтобы верх последней карточки мог дойти до верха окна списка -->
    <div v-if="!hasMoreDown" class="list-bottom-spacer" :style="{ height: bottomSpacerHeight + 'px' }" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { IonIcon } from '@ionic/vue'
import { checkmarkDoneOutline } from 'ionicons/icons'
import EventPreview from './EventPreview.vue'
import { usePlatform } from '@/composables/usePlatform'
import type { EventRead } from '@/api/generated/almaEventFlow.schemas'
import type { EventAttendanceItem } from '@/stores/eventCalendar'
import type { CollectiveAttendanceItem } from './EventPreview.vue'
import { isSameDay, format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

const props = defineProps<{
  events: EventRead[]
  attendances: Map<string, EventAttendanceItem[]>
  isPrincipal: boolean
  loading: boolean
  loadingUp: boolean
  loadingDown: boolean
  scrollToDate?: string
  hasMoreUp: boolean
  hasMoreDown: boolean
}>()

const emit = defineEmits<{
  selectEvent: [id: string]
  loadMoreUp: []
  loadMoreDown: []
  toggleAttendance: [attendanceId: string, value: boolean]
  saveComment: [attendanceId: string, comment: string]
  deleteComment: [attendanceId: string]
  visibleDateChanged: [date: string]
  calendarVisibleChange: [visible: boolean]
}>()

const LOAD_EDGE = 150
// Сколько места оставить под нижней кромкой списка: на мобильном — высота BottomNav
const BOTTOM_RESERVE_MOBILE = 72
const BOTTOM_RESERVE_DESKTOP = 24

const { isDesktop } = usePlatform()

const containerRef = ref<HTMLElement | null>(null)
// Высота окна списка, вычисляется так, чтобы список доходил до низа экрана / BottomNav
const maxHeight = ref<number>()
const eventRefs = new Map<string, HTMLElement>()
let lastEmittedDate: string | null = null
let isScrolling = false
let edgeCooldown = false
let pendingUp = false
let savedScrollHeight = 0
let savedScrollTop = 0
let lastScrollTop = 0
let calendarVisible = true

// sticky month-separator: активным становится сепаратор, чья предыдущая карточка
// полностью скрыта (bottom edge выше scrollTop). Сепараторы выше активного всегда
// невидимы. Активный показывается при скролле, после HIDE_HOLD затухает (400ms).
const HIDE_HOLD = 400
const showLocator = ref(true)
const activeMonthIdx = ref(0)
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null

function showMonthSeparator(idx: number): boolean {
  if (idx === 0) return true
  const prev = props.events[idx - 1]?.date
  const curr = props.events[idx]?.date
  if (!prev || !curr) return false
  const prevDate = parseISO(prev)
  const currDate = parseISO(curr)
  return prevDate.getMonth() !== currDate.getMonth() || prevDate.getFullYear() !== currDate.getFullYear()
}

function monthLabel(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const d = parseISO(dateStr)
  return format(d, 'LLLL yyyy', { locale: ru }).replace(/^./, (c) => c.toUpperCase())
}

function findActiveMonthIdx(): number {
  if (props.events.length === 0) return -1
  const root = containerRef.value
  if (!root) return 0
  const scrollTop = root.scrollTop
  // Активным становится сепаратор, когда предыдущая карточка полностью скрыта
  // (нижний край карточки выше scrollTop).
  // Первое событие, чей нижний край всё ещё виден — определяет текущую секцию.
  const firstIdx = props.events.findIndex((e) => {
    const el = eventRefs.get(e.id)
    return el && (el.offsetTop + el.offsetHeight) > scrollTop
  })
  const idx = firstIdx >= 0 ? firstIdx : props.events.length - 1
  for (let i = idx; i >= 0; i--) {
    if (i === 0 || showMonthSeparator(i)) return i
  }
  return 0
}

function setEventRef(id: string, el: any) {
  if (el) eventRefs.set(id, el.$el || el)
  else eventRefs.delete(id)
}

// Высота окна списка: на мобильном растягиваем до низа экрана (с запасом под BottomNav),
// на ПК карточка равна своему контенту и не тянется до низа
function updateMaxHeight() {
  if (isDesktop.value) {
    maxHeight.value = undefined
    return
  }
  const root = containerRef.value
  if (!root) return
  const top = root.getBoundingClientRect().top
  maxHeight.value = Math.max(200, Math.round(window.innerHeight - top - BOTTOM_RESERVE_MOBILE))
}

// Распорка снизу: ровно столько, чтобы верх ПОСЛЕДНЕЙ карточки мог дойти до верха окна
// (не больше — иначе появляется лишняя пустота)
const bottomSpacerHeight = ref(0)
function updateBottomSpacer() {
  const root = containerRef.value
  if (!root || props.hasMoreDown) {
    bottomSpacerHeight.value = 0
    return
  }
  const last = props.events[props.events.length - 1]
  const el = last ? eventRefs.get(last.id) : null
  if (!el) {
    bottomSpacerHeight.value = 0
    return
  }
  // Высота контента от верха последней карточки до конца (без текущей распорки)
  const contentNoSpacer = root.scrollHeight - bottomSpacerHeight.value
  const fromLastTop = contentNoSpacer - el.offsetTop
  bottomSpacerHeight.value = Math.max(0, Math.round(root.clientHeight - fromLastTop))
}

onMounted(() => {
  updateMaxHeight()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
})

function onResize() {
  updateMaxHeight()
  nextTick(updateBottomSpacer)
}

// Скроллит ТОЛЬКО контейнер списка (не страницу), ставя нужную дату к верхней кромке.
// Это программная прокрутка — на время неё гасим реакцию на пользовательский скролл.
function scrollListToDate(dateStr: string, smooth = true) {
  isScrolling = true
  let retries = 0
  const MAX_RETRIES = 5
  const tryScroll = () => {
    const root = containerRef.value
    const target = props.events.find((e) => e.date && isSameDay(new Date(e.date), new Date(dateStr)))
    const el = target ? eventRefs.get(target.id) : null
    if (root && el) {
      const delta = el.getBoundingClientRect().top - root.getBoundingClientRect().top
      root.scrollTo({ top: root.scrollTop + delta, behavior: smooth ? 'smooth' : 'auto' })
      lastScrollTop = root.scrollTop + delta
      setTimeout(() => { isScrolling = false }, smooth ? 500 : 80)
    } else if (root && smooth === false && retries < MAX_RETRIES) {
      retries++
      requestAnimationFrame(() => tryScroll())
    } else {
      setTimeout(() => { isScrolling = false }, 80)
    }
  }
  nextTick(() => {
    updateMaxHeight()
    updateBottomSpacer()
    nextTick(() => requestAnimationFrame(() => tryScroll()))
  })
}

watch(() => props.scrollToDate, (val) => {
  if (val) scrollListToDate(val)
})

// Явный вызов из родителя после перезагрузки списка (когда значение даты не изменилось)
defineExpose({ scrollTo: scrollListToDate })

watch([() => props.events.length, () => props.hasMoreDown], () => {
  nextTick(() => {
    updateMaxHeight()
    updateBottomSpacer()
    // Восстановление позиции при подгрузке вверх (чтобы не «прыгало»)
    if (pendingUp && containerRef.value) {
      pendingUp = false
      const root = containerRef.value
      root.scrollTop = savedScrollTop + (root.scrollHeight - savedScrollHeight)
    }
  })
})

function getItems(event: EventRead): CollectiveAttendanceItem[] {
  const items = props.attendances.get(event.id)
  if (!items || items.length === 0) return []
  return items.map((item) => ({
    collectiveId: item.collectiveId,
    collectiveName: item.collectiveName,
    attendance: item.attendance,
    attendedCount: item.attendedCount,
    totalCount: item.totalCount,
  }))
}

function handleScroll() {
  if (isScrolling) return
  const root = containerRef.value
  if (!root || props.events.length === 0) return

  const scrollTop = root.scrollTop

  // Emit calendar visibility: hide when scrolling down past 40px, show when scrolling up
  if (Math.abs(scrollTop - lastScrollTop) > 8) {
    const goingDown = scrollTop > lastScrollTop && scrollTop > 40
    const shouldShow = !goingDown
    if (shouldShow !== calendarVisible) {
      calendarVisible = shouldShow
      emit('calendarVisibleChange', calendarVisible)
      // Список меняет верхнюю кромку при сворачивании календаря — пересчитать высоту
      // после CSS-перехода (~300мс)
      setTimeout(() => { updateMaxHeight(); updateBottomSpacer() }, 320)
    }
    lastScrollTop = scrollTop
  }
  const scrollHeight = root.scrollHeight
  const clientHeight = root.clientHeight
  const viewportMiddle = scrollTop + clientHeight / 2

  let closestEvent: EventRead | null = null
  let closestDistance = Infinity

  for (const event of props.events) {
    const el = eventRefs.get(event.id)
    if (!el || !event.date) continue
    const offsetTop = el.offsetTop
    const distance = Math.abs(offsetTop - viewportMiddle)
    if (distance < closestDistance) {
      closestDistance = distance
      closestEvent = event
    }
  }

  if (closestEvent && closestEvent.date !== lastEmittedDate) {
    lastEmittedDate = closestEvent.date!
    emit('visibleDateChanged', lastEmittedDate)
  }

  // sticky month-separator: сразу при скролле, скрывается через HIDE_HOLD после остановки
  activeMonthIdx.value = findActiveMonthIdx()
  showLocator.value = true
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(() => {
    console.log(`[locator] HIDE (${HIDE_HOLD}ms idle)`)
    showLocator.value = false
  }, HIDE_HOLD)

  if (!edgeCooldown && !props.loading && !props.loadingUp && !props.loadingDown) {
    if (scrollTop < LOAD_EDGE) {
      edgeCooldown = true
      savedScrollHeight = scrollHeight
      savedScrollTop = scrollTop
      pendingUp = true
      emit('loadMoreUp')
      setTimeout(() => { edgeCooldown = false }, 800)
    } else if (scrollHeight - scrollTop - clientHeight < LOAD_EDGE) {
      edgeCooldown = true
      emit('loadMoreDown')
      setTimeout(() => { edgeCooldown = false }, 800)
    }
  }
}
</script>

<style scoped>
.event-list {
  position: relative;
  max-height: 60vh; /* запасной вариант — реальная высота задаётся инлайном */
  overflow-y: auto;
  overflow-x: clip;
  width: 100%;
  min-height: 80px;
  padding: 2px 4px;
  margin: 0 -4px;
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--ion-color-step-200) transparent;
}

.event-list::-webkit-scrollbar {
  width: 4px;
}

.event-list::-webkit-scrollbar-track {
  background: transparent;
}

.event-list::-webkit-scrollbar-thumb {
  background: var(--ion-color-step-200);
  border-radius: 2px;
}

/* sticky month-separator — висит над списком, затухает при остановке скролла */
.month-separator {
  position: sticky;
  top: 2px;
  z-index: 2;
  display: flex;
  justify-content: center;
  padding: 8px 4px 4px;
  background: transparent;
  pointer-events: none;
  opacity: 1;
  transition: opacity 400ms ease;
}

.month-separator--hidden {
  opacity: 0;
}

.month-separator-label {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 999px;
  background: var(--ion-background-color);
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: capitalize;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.sentinel {
  height: 1px;
}

.end-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 4px;
}

/* «Начало списка» рисуется над прилипающим заголовком месяца */
.end-indicator--top {
  position: relative;
  z-index: 4;
  background: var(--ion-card-background);
}

.end-line {
  flex: 1;
  height: 1px;
  background: var(--ion-border-color);
}

.end-label {
  font-size: 11px;
  color: var(--ion-color-step-400);
  white-space: nowrap;
  font-weight: 500;
}

/* Низ списка: сообщение + распорка до самого низа экрана */
.list-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 4px 12px;
  color: var(--ion-color-step-400);
}

.list-end ion-icon {
  font-size: 32px;
  opacity: 0.5;
}

.list-end span {
  font-size: 13px;
  font-weight: 500;
}

/* Распорка в самом низу — даёт последней карточке дойти до верха окна списка */
.list-bottom-spacer {
  flex-shrink: 0;
}

.event-list-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
  position: relative;
  z-index: 3;
}

/* Верхний спиннер прилипает к верхней кромке во время подгрузки вверх */
.event-list-loading--top {
  position: sticky;
  top: 0;
  padding: 12px 16px 8px;
}

.event-list-loading--bottom {
  padding: 8px 16px 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--ion-border-color);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
