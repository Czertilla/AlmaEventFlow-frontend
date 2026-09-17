<template>
  <div
    ref="containerRef"
    class="event-list"
    :style="maxHeight ? { maxHeight: maxHeight + 'px' } : undefined"
    @scroll="handleScroll"
  >
    <!-- Отдельная обёртка вокруг ВСЕГО содержимого, которое может менять
         высоту -- ResizeObserver наблюдает именно за ней (см. скрипт), а не
         за самим .event-list: у .event-list зафиксированная inline-высота
         (см. :style выше), поэтому её собственный border-box никогда не
         меняется, и ResizeObserver, повешенный прямо на неё, ничего бы не
         увидел. Распорка (.list-bottom-spacer) намеренно вынесена ЗА эту
         обёртку, иначе её собственное изменение (см. updateBottomSpacer)
         само попадало бы в наблюдаемую область и порождало на каждый раз
         лишний виток ResizeObserver. -->
    <div ref="contentRef" class="event-list-content">
      <div class="sentinel sentinel--top" />
      <!-- Никакого отдельного "индикатора загрузки" -- на месте будущих карточек
           сразу стоят карточки-заглушки той же формы (.skel-card, тот же приём,
           что и в начальной загрузке списка, см. HomePage.vue/.events-loading),
           с тем же отступом margin:8px 0, что и у настоящей .event-card, и без
           обёртки/своего паддинга: они не "сообщают о загрузке", а буквально
           занимают место реальных карточек до их прихода. Несовпадение точной
           высоты заглушки с реальной карточкой гасится anchor-механизмом ниже
           (captureAnchor/restoreAnchor), а не подгонкой размера скелетона. -->
      <template v-if="loadingUp">
        <div v-for="n in 2" :key="`skel-up-${n}`" class="skel-card" aria-hidden="true">
          <span class="skeleton skeleton--circle skel-dot" />
          <div class="skel-info">
            <span class="skeleton skeleton--text" :style="{ width: skeletonWidth(n) }" />
            <span class="skeleton skeleton--text skel-date" />
          </div>
        </div>
      </template>
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
          :time-range="stageTimes.get(event.id)"
          :is-principal="isPrincipal"
          @click="emit('selectEvent', event.id)"
          @toggle-attendance="(id, v) => emit('toggleAttendance', id, v)"
          @save-comment="(id, c) => emit('saveComment', id, c)"
          @delete-comment="(id) => emit('deleteComment', id)"
        />
      </template>
      <div class="sentinel sentinel--bottom" />
      <template v-if="loadingDown">
        <div v-for="n in 2" :key="`skel-down-${n}`" class="skel-card" aria-hidden="true">
          <span class="skeleton skeleton--circle skel-dot" />
          <div class="skel-info">
            <span class="skeleton skeleton--text" :style="{ width: skeletonWidth(n) }" />
            <span class="skeleton skeleton--text skel-date" />
          </div>
        </div>
      </template>
      <div v-else-if="!hasMoreDown" class="list-end">
        <ion-icon :icon="checkmarkDoneOutline" />
        <span>Больше мероприятий нет</span>
      </div>
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
import type { EventRead } from '@/api/generated/almaEventFlow'
import type { EventAttendanceItem, EventTimeRange } from '@/stores/eventCalendar'
import type { CollectiveAttendanceItem } from './EventPreview.vue'
import { isSameDay, format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

const props = defineProps<{
  events: EventRead[]
  attendances: Map<string, EventAttendanceItem[]>
  stageTimes: Map<string, EventTimeRange>
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
// На мобильном список специально делаем выше экрана -- его нижний край никогда
// не должен быть виден (внешний ion-content обрезает лишнее, см. HomePage.vue
// :scroll-y="isDesktop"). Это не зависит от того, свёрнут ли календарь над
// списком (значение не привязано к top), поэтому сворачивание календаря не
// меняет высоту САМОГО блока -- просто открывает больше уже отрисованного
// списка, без видимого «разрастания».
const OFFSCREEN_OVERSHOOT_MOBILE = 400

// Ширины скелетон-строк слегка отличаются -- иначе ряд одинаковых полосок
// читается как явная заглушка (см. тот же приём в HomePage.vue/DashboardPage.vue).
const SKELETON_WIDTHS = ['62%', '48%', '74%', '56%']
function skeletonWidth(n: number): string {
  return SKELETON_WIDTHS[n % SKELETON_WIDTHS.length]
}

const { isDesktop } = usePlatform()

const containerRef = ref<HTMLElement | null>(null)
// Обёртка вокруг содержимого списка -- см. комментарий в шаблоне и
// ResizeObserver ниже (captureAnchor/restoreAnchor).
const contentRef = ref<HTMLElement | null>(null)
// Высота окна списка, вычисляется так, чтобы список доходил до низа экрана / BottomNav
const maxHeight = ref<number>()
const eventRefs = new Map<string, HTMLElement>()
let lastEmittedDate: string | null = null
let isScrolling = false
let edgeCooldown = false
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

// Высота окна списка: на мобильном заведомо больше экрана (см. OFFSCREEN_OVERSHOOT_MOBILE
// выше) и не зависит от текущего положения блока (top), на ПК карточка равна
// своему контенту и не тянется до низа.
function updateMaxHeight() {
  if (isDesktop.value) {
    maxHeight.value = undefined
    return
  }
  maxHeight.value = window.innerHeight + OFFSCREEN_OVERSHOOT_MOBILE
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

let resizeObserver: ResizeObserver | null = null
// ResizeObserver.observe() всегда даёт один "бесплатный" вызов колбэка сразу
// после подписки, отражающий текущий размер -- ДО того, как список успел
// встать на начальную позицию (scrollListToDate из HomePage.vue доезжает
// туда через несколько nextTick/rAF, а не мгновенно). Если в этот момент
// захватить якорь, он окажется привязан к scrollTop=0 (самому верху), и
// первая же настоящая догрузка после этого попытается "восстановить" список
// к ЭТОЙ ложной позиции -- список визуально прыгает наверх, будто там нет
// ничего, хотя выше уже подгружены карточки. positioned взводится только
// после того, как список реально встал на место (см. tryScroll ниже) или
// после первого настоящего скролла пользователя (handleScroll) -- до этого
// ResizeObserver ничего не трогает.
let positioned = false

onMounted(() => {
  updateMaxHeight()
  window.addEventListener('resize', onResize)
  // captureAnchor/restoreAnchor определены ниже в файле, но объявлены через
  // function-декларации -- поднимаются (hoisting), доступны уже здесь.
  resizeObserver = new ResizeObserver(() => {
    if (!positioned) return
    restoreAnchor()
    updateBottomSpacer()
    captureAnchor()
  })
  if (contentRef.value) resizeObserver.observe(contentRef.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  resizeObserver?.disconnect()
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
      // handleScroll (и его captureAnchor) не вызывается, пока isScrolling --
      // без этого якорь остался бы от позиции ДО программного прыжка, и
      // случись догрузка сразу после него, компенсация посчиталась бы от
      // устаревшей точки. positioned взводим здесь же -- ResizeObserver
      // начинает восстанавливать позицию только с этого момента.
      setTimeout(() => { isScrolling = false; positioned = true; captureAnchor() }, smooth ? 500 : 80)
    } else if (root && smooth === false && retries < MAX_RETRIES) {
      retries++
      requestAnimationFrame(() => tryScroll())
    } else {
      setTimeout(() => { isScrolling = false; positioned = true; captureAnchor() }, 80)
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

// ---- Устойчивость к рывкам при догрузке/перерисовке списка -----------------
// Любое изменение содержимого списка (новые карточки сверху/снизу, появление
// или исчезновение скелетона/индикатора конца списка, догрузка attendance/
// stageTimes, из-за которой карточка меняет высоту, да и вообще что угодно
// ещё, что может повлиять на раскладку) способно физически сдвинуть уже
// показанные карточки вверх или вниз -- визуально это рывок, который
// дезориентирует. Раньше это отслеживалось через watch() по конкретному
// списку props (events.length/loadingUp/...) -- ненадёжно, потому что любой
// НЕучтённый источник изменения раскладки (например, сама карточка
// перерисовалась чуть иначе, или сработали сразу два отдельных реактивных
// триггера не одним flush'ем) проходил мимо и рывок оставался. Вместо этого
// ResizeObserver на .event-list-content реагирует на РЕАЛЬНОЕ изменение
// высоты контента, что бы его ни вызвало -- запоминаем экранную позицию
// карточки, которая сейчас видна первой (anchorEventId + её top относительно
// контейнера), а как только ResizeObserver сообщает, что высота
// действительно изменилась, компенсируем scrollTop на ту разницу, на
// которую её реально сдвинуло. captureAnchor дополнительно вызывается и на
// каждый scroll (см. handleScroll), чтобы якорь всегда был свежим к моменту
// следующего изменения раскладки, а не только сразу после предыдущей
// компенсации. Если якорная карточка из нового списка пропала (не догрузка,
// а полная замена -- смена фильтра/коллектива), восстанавливать нечего, и
// скролл просто остаётся как есть.
let anchorEventId: string | null = null
let anchorViewportTop = 0

function captureAnchor() {
  const root = containerRef.value
  if (!root) { anchorEventId = null; return }
  const rootTop = root.getBoundingClientRect().top
  for (const event of props.events) {
    const el = eventRefs.get(event.id)
    if (el && el.offsetTop + el.offsetHeight > root.scrollTop) {
      anchorEventId = event.id
      anchorViewportTop = el.getBoundingClientRect().top - rootTop
      return
    }
  }
  anchorEventId = null
}

function restoreAnchor() {
  const root = containerRef.value
  const id = anchorEventId
  anchorEventId = null
  if (!root || !id) return
  const el = eventRefs.get(id)
  if (!el) return
  const rootTop = root.getBoundingClientRect().top
  const newViewportTop = el.getBoundingClientRect().top - rootTop
  const delta = newViewportTop - anchorViewportTop
  if (delta === 0) return
  root.scrollTop += delta
  // Программная правка scrollTop всё равно асинхронно поднимет собственное
  // 'scroll'-событие -- handleScroll увидит большой скачок относительно
  // lastScrollTop (сохранённого от НАСТОЯЩЕГО скролла пользователя) и примет
  // компенсацию за резкий свайп вниз, спрятав календарь, даже если человек на
  // самом деле листал вверх. Сразу подтягиваем lastScrollTop к уже
  // скорректированному значению, чтобы это будущее событие обработалось как
  // нулевое перемещение и не трогало видимость календаря.
  lastScrollTop = root.scrollTop
}

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
  // Любой скролл, прошедший мимо isScrolling -- либо реальный жест
  // пользователя, либо уже наша собственная компенсация (см. restoreAnchor);
  // в обоих случаях список уже не в "непроинициализированном" состоянии.
  positioned = true
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
      // Высота/распорка списка НЕ зависят от того, свёрнут ли календарь (см.
      // updateMaxHeight) -- пересчитывать их здесь больше не нужно, календарь
      // просто открывает/закрывает уже отрисованный список без изменения его
      // собственной высоты.
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
      emit('loadMoreUp')
      setTimeout(() => { edgeCooldown = false }, 800)
    } else if (scrollHeight - scrollTop - clientHeight < LOAD_EDGE) {
      edgeCooldown = true
      emit('loadMoreDown')
      setTimeout(() => { edgeCooldown = false }, 800)
    }
  }

  // Держим "якорь" свежим на каждый реальный скролл пользователя -- см.
  // ResizeObserver в onMounted: к моменту, когда раскладка правда изменится,
  // должна быть под рукой актуальная (а не устаревшая с прошлой компенсации)
  // опорная карточка и её экранная позиция.
  captureAnchor()
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
  /* Свой JS-механизм (captureAnchor/restoreAnchor выше) уже компенсирует
     сдвиги при догрузке -- нативное scroll anchoring браузера реагирует на
     те же мутации DOM независимо и может докорректировать scrollTop ещё раз
     поверх нашей компенсации, из-за чего рывок не исчезает, а просто меняет
     форму. Отключаем, чтобы источник истины был ровно один. */
  overflow-anchor: none;
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

/* Заглушки будущих карточек -- те же .event-card геометрия и отступ
   (margin: 8px 0, см. EventPreview.vue), никакой отдельной обёртки-"индикатора":
   они стоят в общем потоке списка на месте, где появятся настоящие карточки,
   и просто сменяются ими при готовности данных (см. комментарий в шаблоне). */
.skel-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
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
