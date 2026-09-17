<template>
    <div class="page-body">
      <div class="dash-narrow">
      <div class="ev-toolbar">
        <div class="ev-search">
          <ion-icon :icon="searchOutline" class="ev-search-icon" />
          <input
            v-model="searchQuery"
            class="ev-search-input"
            placeholder="Поиск мероприятий или участников..."
          />
          <button v-if="searchQuery" class="ev-search-clear" aria-label="Очистить" @click="searchQuery = ''">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <div class="ev-toolbar-actions">
          <div class="ev-sort">
            <ion-icon :icon="swapVerticalOutline" class="ev-sort-icon" />
            <select v-model="sortKey" class="ev-sort-select" aria-label="Сортировка мероприятий">
              <option value="date">По дате</option>
              <option value="name">По названию</option>
              <option value="status">По статусу</option>
            </select>
            <button
              class="ev-sort-dir"
              :aria-label="sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'"
              @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            >
              <ion-icon :icon="sortOrder === 'asc' ? arrowUpOutline : arrowDownOutline" />
            </button>
          </div>

          <button v-if="roles.length" class="sort-btn" :title="rowSortMode === 'roles' ? 'Сортировка по ролям' : 'Сортировка по алфавиту'" @click="toggleRowSortMode">
            <ion-icon :icon="peopleOutline" />
            <span>{{ rowSortMode === 'roles' ? 'По ролям' : 'По алфавиту' }}</span>
          </button>
        </div>
      </div>

      <!-- На десктопе фильтры показаны прямо на странице, на мобильном --
           вынесены в отдельную менюшку (FAB + модалка), как на главной
           странице (см. HomePage.vue/HomeFilters) -- иначе они съедают весь
           экран ещё до самой матрицы. -->
      <DashboardFilters
        v-if="isDesktop"
        v-model:selected-types="selectedTypes"
        v-model:selected-role-ids="selectedRoleIds"
        v-model:active-filter="activeFilter"
        v-model:date-from="dateFrom"
        v-model:date-to="dateTo"
        :roles="roles"
        :use-custom-range="useCustomRange"
        @apply-date-range="applyDateRange"
        @reset-date-range="resetDateRange"
      />
      </div>

      <!-- Скелетон матрицы вместо спиннера -- переиспользует классы реальной
           таблицы (.matrix-shell/.matrix-col-head/...), поэтому автоматически
           учитывает мобильную компактную раскладку (см. @media ниже). -->
      <div v-if="loading" class="matrix-shell" aria-hidden="true">
        <div class="matrix-wrap">
          <table class="matrix">
            <thead>
              <tr class="matrix-month-row">
                <th class="matrix-corner-month" />
                <th v-for="n in 6" :key="n" class="matrix-month-head" />
              </tr>
              <tr>
                <th class="matrix-corner" />
                <th v-for="n in 6" :key="n" class="matrix-col-head">
                  <span class="skeleton skeleton--text" style="width: 80%;" />
                  <span class="skeleton skeleton--text" style="width: 50%; height: 10px; margin-top: 4px;" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in 7" :key="r">
                <th class="matrix-row-head">
                  <span class="skeleton skeleton--text" :style="{ width: skeletonWidth(r) }" />
                </th>
                <td v-for="n in 6" :key="n" class="matrix-cell">
                  <span class="skeleton skeleton--circle" style="width: 18px; height: 18px; display: inline-block;" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="!filteredEvents.length || !filteredMembers.length" class="page-state dash-narrow">
        <ion-icon :icon="gridOutline" />
        <p>Нет данных для отображения -- измените фильтры или дождитесь мероприятий/участников</p>
      </div>

      <template v-else>
        <div class="matrix-shell">
          <div class="matrix-toolbar">
            <button
              class="matrix-nav-btn"
              :disabled="useCustomRange || !hasMorePast || loadingPast"
              @click="goEarlier"
            >
              <span v-if="loadingPast" class="btn-spinner-sm" />
              <ion-icon v-else :icon="chevronBackOutline" />
              Раньше
            </button>
            <button
              v-if="nextUpcomingEvent"
              class="matrix-today-badge"
              :title="'Ближайшее мероприятие: ' + nextUpcomingEvent.name"
              @click="scrollToNextEvent"
            >
              <ion-icon :icon="timeOutline" />
              <span>Сегодня — {{ todayFormatted }}</span>
            </button>
            <button class="matrix-nav-btn" @click="goLater">
              Позже
              <span v-if="loadingFuture" class="btn-spinner-sm" />
              <ion-icon v-else :icon="chevronForwardOutline" />
            </button>
          </div>
          <div
            ref="matrixWrapRef"
            class="matrix-wrap"
            :class="{ 'matrix-wrap--dragging': isDragging }"
            @mousedown="onMatrixMouseDown"
            @scroll="onMatrixScroll"
          >
          <table class="matrix">
            <thead>
              <tr class="matrix-month-row">
                <th class="matrix-corner-month" />
                <th
                  v-for="(g, gi) in monthGroups"
                  :key="g.key + '-' + gi"
                  :colspan="g.span"
                  class="matrix-month-head"
                >
                  <!-- Подпись месяца -- собственный sticky-left, а не просто
                       text-align в широкой colspan-ячейке: иначе при скролле
                       вглубь месяца подпись уезжает вместе с первой колонкой
                       группы и пропадает из виду (тот же приём, что и у
                       .matrix-group-divider-label ниже, только с отступом под
                       ширину колонки ФИО, а не 12px). -->
                  <span class="matrix-month-label">{{ g.label }}</span>
                </th>
              </tr>
              <tr>
                <th class="matrix-corner" />
                <th
                  v-for="e in filteredEvents"
                  :key="e.id"
                  class="matrix-col-head"
                  :class="{ 'matrix-col-head--next': e.id === nextUpcomingEvent?.id }"
                  :style="{ borderTopColor: typeColor(e.type) }"
                  @click="onEventHeaderClick(e.id)"
                >
                  <!-- Дата на одном уровне у всех колонок не выравниванием "к низу"
                       (flex/absolute это или ломает <th>, или не резолвится в
                       table-cell -- проверено на практике), а проще: название
                       ВСЕГДА резервирует высоту ровно под 2 строки (см. min-height
                       у .matrix-event-name), даже если уместилось в одну. Тогда
                       дата в обычном потоке и так оказывается на одном уровне. -->
                  <span class="matrix-event-name">{{ e.name }}</span>
                  <span class="matrix-event-date">{{ e.date ? formatDate(e.date, settings.dateFormat) : 'Без даты' }}</span>
                  <LocationDisplay
                    v-if="e.location_id && locationsById[e.location_id]"
                    :location="locationsById[e.location_id]"
                    class="matrix-event-location"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in matrixRows" :key="row.member.id">
                <tr v-if="row.groupStart" class="matrix-group-row">
                  <td class="matrix-group-divider" :colspan="filteredEvents.length + 1">
                    <span class="matrix-group-divider-label">{{ row.roleLabel }}</span>
                  </td>
                </tr>
                <tr>
                  <th class="matrix-row-head" :class="{ 'matrix-row-head--inactive': row.member.is_active === false }">
                    <span class="matrix-member-name">{{ rowMemberName(row.member) }}</span>
                    <span v-if="row.roleSubtitle" class="matrix-member-roles">{{ row.roleSubtitle }}</span>
                  </th>
                  <td
                    v-for="(cell, i) in row.cells"
                    :key="filteredEvents[i].id"
                    class="matrix-cell"
                    :class="{ 'matrix-cell--unmarked': cell.unmarked }"
                    :title="cell.title"
                    @click="onCellClick(filteredEvents[i], row.member)"
                  >
                    <span class="matrix-cell-inner">
                      <!-- Кнопка отметки -- собственный клик (см. @click.stop в
                           EventAttendanceChip) не даёт клику по ячейке сработать
                           как переход на страницу мероприятия. -->
                      <EventAttendanceChip
                        v-if="cell.attendance"
                        class="matrix-chip"
                        :is-attended="cell.attendance.is_attended"
                        :edited-at="cell.attendance.edited_at"
                        :verified="cell.attendance.is_verified"
                        :attendance-id="cell.attendance.id"
                        :show-lock="false"
                        @toggle="(v) => onToggleCell(filteredEvents[i], row.member, v)"
                      />
                      <button
                        v-else
                        class="matrix-add-btn"
                        :disabled="isPending(cell.pendingKey)"
                        title="Нет данных об участии -- создать отметку"
                        @click.stop="onCreateCell(filteredEvents[i], row.member)"
                      >
                        <span v-if="isPending(cell.pendingKey)" class="matrix-cell-spinner" />
                        <ion-icon v-else :icon="helpCircleOutline" />
                      </button>
                    </span>
                    <span class="matrix-cell-badges">
                      <ion-icon v-if="cell.hasComment" :icon="chatbubble" class="matrix-cell-badge" />
                      <ion-icon v-if="cell.verified" :icon="lockClosedOutline" class="matrix-cell-badge" />
                    </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          </div>
        </div>

        <div class="dash-narrow">
        <div class="legend">
          <span class="legend-item"><ion-icon :icon="checkmarkCircleOutline" style="color: #00BF92" /> Присутствовал</span>
          <span class="legend-item"><ion-icon :icon="closeCircleOutline" style="color: var(--ion-color-danger)" /> Отсутствовал</span>
          <span class="legend-item"><ion-icon :icon="helpCircleOutline" style="color: var(--ion-color-warning)" /> Не отмечено</span>
          <span class="legend-item"><ion-icon :icon="helpCircleOutline" style="color: var(--ion-color-medium)" /> Нет данных об участии</span>
          <span class="legend-item"><ion-icon :icon="chatbubble" /> Есть комментарий</span>
          <span class="legend-item"><ion-icon :icon="lockClosedOutline" /> Заверено</span>
        </div>
        </div>
      </template>
    </div>

    <!-- Мобильный FAB и модалка фильтров -- та же менюшка, что на главной
         странице (см. HomePage.vue), только с содержимым DashboardFilters. -->
    <AppFab v-if="!isDesktop" :icon="optionsOutline" aria-label="Фильтры" @click="showFilterModal = true" />

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
          <DashboardFilters
            v-model:selected-types="selectedTypes"
            v-model:selected-role-ids="selectedRoleIds"
            v-model:active-filter="activeFilter"
            v-model:date-from="dateFrom"
            v-model:date-to="dateTo"
            :roles="roles"
            :use-custom-range="useCustomRange"
            @apply-date-range="applyDateRange"
            @reset-date-range="resetDateRange"
          />
        </div>
      </ion-content>
    </ion-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonIcon, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
} from '@ionic/vue'
import {
  searchOutline, closeOutline, swapVerticalOutline, arrowUpOutline, arrowDownOutline,
  peopleOutline, gridOutline, checkmarkCircleOutline, closeCircleOutline, helpCircleOutline,
  lockClosedOutline, chevronBackOutline, chevronForwardOutline, chatbubble, timeOutline,
  optionsOutline,
} from 'ionicons/icons'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import LocationDisplay from '@/components/geo/LocationDisplay.vue'
import EventAttendanceChip from '@/components/event/EventAttendanceChip.vue'
import DashboardFilters from '@/components/event/DashboardFilters.vue'
import AppFab from '@/components/common/AppFab.vue'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import { resolvePersonName, shortId, shortenName } from '@/utils/names'
import { usePlatform } from '@/composables/usePlatform'
import { typeOptions, typeColor } from '@/utils/eventLabels'
import { fetchAllPages } from '@/api/pagination'
import {
  reconcileRoleOrder, rankByRoleIds, loadSortMode, saveSortMode, type SortMode,
} from '@/utils/roleSort'
import { loadDashboardFilters, saveDashboardFilters } from '@/utils/dashboardFilters'
import { mergeEventWindow, findUpcomingIndex, buildEventWindow } from '@/utils/eventWindow'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { useToast } from '@/composables/useToast'
import { confirmAction } from '@/utils/confirm'
import {
  getEventsEventV1EventsGet,
  getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet,
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
  getParticipationsEventV1ParticipationsGet,
  getAttendancesEventV1AttendancesGet,
  getLocationGeoV1LocationsLocationIdGet,
  patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch,
  createMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendancePost,
} from '@/api/generated/almaEventFlow'
import type {
  EventRead, EventStatusEnumV1, EventTypeEnumV1, MemberRead, RoleRead, ParticipationRead,
  AttendanceRead, LocationRead,
} from '@/api/generated/almaEventFlow'

const router = useRouter()
const principal = usePrincipalStore()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()
const { pending, withPending } = useAttendancePending()
const { showError } = useToast()

const showFilterModal = ref(false)

const loading = ref(false)
const events = ref<EventRead[]>([])
const members = ref<MemberRead[]>([])
const roles = ref<RoleRead[]>([])
const participations = ref<ParticipationRead[]>([])
const attendances = ref<AttendanceRead[]>([])
const locationsById = reactive<Record<string, LocationRead>>({})
const personNames = reactive<Record<string, string>>({})

// Ширины скелетон-строк слегка отличаются -- иначе ряд одинаковых полосок
// читается как явная заглушка, а не намёк на будущий текст разной длины.
const SKELETON_WIDTHS = ['70%', '55%', '82%', '48%', '64%', '90%', '58%']
function skeletonWidth(n: number): string {
  return SKELETON_WIDTHS[n % SKELETON_WIDTHS.length]
}

// ---- Фильтры ----
// Настройки (кроме поиска и диапазона дат) сохраняются в localStorage на
// коллектив -- см. loadDashboard()/сохраняющий watch ниже. Сама панель фильтров
// (чипы типов/ролей/участников + период) вынесена в DashboardFilters.vue --
// на десктопе показана инлайн, на мобильном -- в модалке (см. шаблон); здесь
// остаются только refs состояния, которыми она управляет через v-model.
const searchQuery = ref('')
const allTypeValues = typeOptions.map(([v]) => v)
const selectedTypes = ref<Set<EventTypeEnumV1>>(new Set(allTypeValues))
const selectedRoleIds = ref<Set<string>>(new Set())
const activeFilter = ref<'all' | 'active' | 'inactive'>('active')

// ---- Сортировка мероприятий (колонки) -- та же логика, что на principal/events,
// но по умолчанию по возрастанию: сегодняшняя дата должна быть последней колонкой ----
const sortKey = ref<'date' | 'name' | 'status'>('date')
const sortOrder = ref<'asc' | 'desc'>('asc')
const STATUS_RANK: Record<EventStatusEnumV1, number> = {
  active: 0, draft: 1, template: 2, archived: 3,
}

// Восстановить сохранённые фильтры коллектива (или дефолты, если их ещё нет).
// Роли/типы, которых больше не существует, отбрасываем.
function applyStoredFilters(collectiveId: string) {
  const stored = loadDashboardFilters(collectiveId)
  const validRoleIds = new Set(roles.value.map((r) => r.id))
  if (stored) {
    const validTypes = (stored.types ?? []).filter((t): t is EventTypeEnumV1 => allTypeValues.includes(t as EventTypeEnumV1))
    selectedTypes.value = new Set(validTypes)
    selectedRoleIds.value = new Set((stored.roleIds ?? []).filter((id) => validRoleIds.has(id)))
    activeFilter.value = stored.activeFilter ?? 'active'
    sortKey.value = stored.sortKey ?? 'date'
    sortOrder.value = stored.sortOrder ?? 'asc'
  } else {
    selectedTypes.value = new Set(allTypeValues)
    selectedRoleIds.value = new Set(roles.value.map((r) => r.id))
    activeFilter.value = 'active'
    sortKey.value = 'date'
    sortOrder.value = 'asc'
  }
}

function persistFilters() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  saveDashboardFilters(collectiveId, {
    types: Array.from(selectedTypes.value),
    roleIds: Array.from(selectedRoleIds.value),
    activeFilter: activeFilter.value,
    sortKey: sortKey.value,
    sortOrder: sortOrder.value,
  })
}

watch([selectedTypes, selectedRoleIds, activeFilter, sortKey, sortOrder], persistFilters)

function eventMatchesQuery(e: EventRead, q: string): boolean {
  return e.name.toLowerCase().includes(q)
}

function memberMatchesQuery(m: MemberRead, q: string): boolean {
  return displayName(m).toLowerCase().includes(q) || m.roles.some((r) => r.name.toLowerCase().includes(q))
}

const typeFilteredEvents = computed(() => events.value.filter((e) => !e.type || selectedTypes.value.has(e.type)))

// Поиск ищет "мероприятия ИЛИ участников" -- один и тот же текст не обязан
// совпадать сразу по обеим осям матрицы (typeFilteredEvents и roleFilteredMembers,
// см. ниже). Раньше запрос применялся к обоим спискам независимо, и почти
// любой текст (совпавший, например, только с именем участника) обнулял список
// мероприятий -- а страница считает пустым любой из двух списков "нет данных".
const filteredEvents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = typeFilteredEvents.value
  if (q) {
    const matching = list.filter((e) => eventMatchesQuery(e, q))
    if (matching.length || !roleFilteredMembers.value.some((m) => memberMatchesQuery(m, q))) {
      list = matching
    }
  }

  const dir = sortOrder.value === 'asc' ? 1 : -1
  return list.slice().sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'name') {
      cmp = a.name.localeCompare(b.name, 'ru')
    } else if (sortKey.value === 'status') {
      cmp = STATUS_RANK[a.status ?? 'draft'] - STATUS_RANK[b.status ?? 'draft']
    } else {
      const da = a.date ? new Date(a.date).getTime() : null
      const db = b.date ? new Date(b.date).getTime() : null
      if (da === null && db === null) cmp = 0
      else if (da === null) return 1
      else if (db === null) return -1
      else cmp = da - db
    }
    return cmp * dir
  })
})

// ---- Метки месяцев над колонками (по аналогии с month-separator на главной
// странице, см. EventList.vue) -- группируем ПОСЛЕДОВАТЕЛЬНЫЕ колонки одного
// месяца в одну ячейку с colspan, а не считаем активную метку при скролле
// (там вертикальный список с прокруткой мимо карточек, здесь горизонтальная
// таблица с фиксированными по ширине колонками -- простой colspan подходит
// лучше и не требует отслеживания скролла).
interface MonthGroup { key: string; label: string; span: number }
const monthGroups = computed<MonthGroup[]>(() => {
  const groups: MonthGroup[] = []
  for (const e of filteredEvents.value) {
    let key: string
    let label: string
    if (e.date) {
      const d = parseISO(e.date)
      key = `${d.getFullYear()}-${d.getMonth()}`
      label = format(d, 'LLLL yyyy', { locale: ru }).replace(/^./, (c) => c.toUpperCase())
    } else {
      key = 'none'
      label = 'Без даты'
    }
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.span += 1
    else groups.push({ key, label, span: 1 })
  }
  return groups
})

// ---- Метка "сегодня" / ближайшее мероприятие -- само по себе положение
// колонки в широкой таблице не всегда очевидно с первого взгляда, особенно
// после подгрузки соседних страниц окна. ----
const todayFormatted = computed(() => formatDate(todayStr(), settings.dateFormat))

const nextUpcomingEvent = computed<EventRead | null>(() => {
  const today = new Date(todayStr())
  let best: EventRead | null = null
  for (const e of filteredEvents.value) {
    if (!e.date) continue
    const d = new Date(e.date)
    if (d >= today && (!best || d < new Date(best.date!))) best = e
  }
  return best
})

function scrollToNextEvent() {
  const wrap = matrixWrapRef.value
  const ev = nextUpcomingEvent.value
  if (!wrap || !ev) return
  const idx = filteredEvents.value.findIndex((e) => e.id === ev.id)
  if (idx < 0) return
  const { columnWidth } = measureMatrixMetrics(wrap)
  wrap.scrollTo({ left: idx * columnWidth, behavior: 'smooth' })
}

// ---- Сортировка/группировка участников (строки) -- переиспользует @/utils/roleSort,
// как это уже делают principal/members и страница мероприятия ----
const rowSortMode = ref<SortMode>('roles')
const roleOrder = ref<string[]>([])

function memberRoleRank(m: MemberRead): number {
  return rankByRoleIds(roleOrder.value, m.roles.map((r) => r.id))
}

// Роль с наивысшим приоритетом в заданном порядке -- та же логика, что задаёт
// ранг участника, но возвращает id роли для подписи разделителя группы.
function memberTopRoleId(m: MemberRead): string | null {
  let bestIdx = Number.POSITIVE_INFINITY
  let bestId: string | null = null
  for (const r of m.roles) {
    const idx = roleOrder.value.indexOf(r.id)
    if (idx >= 0 && idx < bestIdx) { bestIdx = idx; bestId = r.id }
  }
  return bestId
}

function roleName(roleId: string): string {
  return roles.value.find((r) => r.id === roleId)?.name || '—'
}

function toggleRowSortMode() {
  rowSortMode.value = rowSortMode.value === 'roles' ? 'alpha' : 'roles'
  const collectiveId = principal.activePrincipalCollectiveId
  if (collectiveId) saveSortMode(collectiveId, rowSortMode.value)
}

function displayName(m: MemberRead): string {
  return personNames[m.person_id] || `#${shortId(m.person_id)}`
}

// На мобильном полное ФИО не помещается в узкую sticky-колонку -- показываем
// "Фамилия И.О." (та же сокращалка, что и в остальных местах приложения).
function rowMemberName(m: MemberRead): string {
  const full = displayName(m)
  return isDesktop.value ? full : shortenName(full)
}

const roleFilteredMembers = computed(() => members.value.filter((m) => {
  if (activeFilter.value === 'active' && m.is_active === false) return false
  if (activeFilter.value === 'inactive' && m.is_active !== false) return false
  return m.roles.length === 0 || m.roles.some((r) => selectedRoleIds.value.has(r.id))
}))

const filteredMembers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = roleFilteredMembers.value
  if (q) {
    const matching = list.filter((m) => memberMatchesQuery(m, q))
    if (matching.length || !typeFilteredEvents.value.some((e) => eventMatchesQuery(e, q))) {
      list = matching
    }
  }
  const byName = (a: MemberRead, b: MemberRead) => displayName(a).localeCompare(displayName(b), 'ru')
  if (rowSortMode.value === 'alpha') return list.slice().sort(byName)
  return list.slice().sort((a, b) => memberRoleRank(a) - memberRoleRank(b) || byName(a, b))
})

// ---- Матрица посещений ----
const participationIdByEvent = computed(() => {
  const map = new Map<string, string>()
  for (const p of participations.value) map.set(p.event_id, p.id)
  return map
})

const attendanceByKey = computed(() => {
  const map = new Map<string, AttendanceRead>()
  for (const a of attendances.value) map.set(`${a.participation_id}:${a.member_id}`, a)
  return map
})

interface CellInfo {
  /** Сама отметка -- undefined, если для этого участника на это мероприятие
   * записи ещё не существует ("нет данных об участии"). Ячейка рендерит либо
   * EventAttendanceChip (как на главной странице), либо кнопку создания. */
  attendance: AttendanceRead | undefined
  title: string
  hasComment: boolean
  verified: boolean
  /** Участие заведено, но присутствие ещё не отмечено -- требует внимания
   * руководителя, подсвечивается жёлтым (в отличие от «нет данных об
   * участии вообще», которое серое и действия не требует). */
  unmarked: boolean
  /** Ключ для отслеживания состояния "идёт запрос" (см. pending из
   * useAttendancePending) -- id самой отметки, либо синтетический ключ
   * create:<participationId>:<memberId>, если отметки ещё не существует. */
  pendingKey: string
}

// Комментарий уже приходит вместе с attendance (см. loadAllAttendance) --
// отдельная подгрузка по наведению не нужна, просто добавляем его в title
// (нативная всплывающая подсказка браузера).
function withComment(title: string, a: AttendanceRead): string {
  return a.comment ? `${title}\nКомментарий: ${a.comment}` : title
}

function buildCellInfo(a: AttendanceRead | undefined, participationId: string | undefined, memberId: string): CellInfo {
  if (!a) {
    const pendingKey = participationId ? `create:${participationId}:${memberId}` : ''
    return {
      attendance: undefined,
      title: participationId ? 'Нет данных об участии -- нажмите на кнопку, чтобы создать отметку' : 'Нет данных об участии',
      hasComment: false,
      verified: false,
      unmarked: false,
      pendingKey,
    }
  }
  const hasComment = !!a.comment
  const verified = !!a.is_verified
  const unmarked = a.is_attended == null
  const baseTitle = a.is_attended === true ? 'Присутствовал' : a.is_attended === false ? 'Отсутствовал' : 'Не отмечено'
  return { attendance: a, title: withComment(baseTitle, a), hasComment, verified, unmarked, pendingKey: a.id }
}

interface MatrixRow {
  member: MemberRead
  cells: CellInfo[]
  /** Начинает новую группу ролей -- перед строкой рисуется подпись роли
   * (как разделители на странице мероприятия). Имеет смысл только при
   * сортировке по ролям (rowSortMode === 'roles'). */
  groupStart: boolean
  /** Название роли группы (или "Без роли") -- задано только когда groupStart. */
  roleLabel: string | null
  /** Роли участника под именем -- при группировке по ролям без той, что уже
   * подписана разделителем группы (не дублируем), пусто если роль была
   * единственной. При алфавитной сортировке -- полный список ролей. */
  roleSubtitle: string
}

const matrixRows = computed<MatrixRow[]>(() => {
  const byRoles = rowSortMode.value === 'roles'
  let prevRank: number | null = null
  return filteredMembers.value.map((m, i) => {
    const rank = byRoles ? memberRoleRank(m) : null
    const groupStart = byRoles && (i === 0 || rank !== prevRank)
    prevRank = rank
    const topRoleId = byRoles ? memberTopRoleId(m) : null
    const roleSubtitle = byRoles
      ? m.roles.filter((r) => r.id !== topRoleId).map((r) => r.name).join(', ')
      : (m.roles.map((r) => r.name).join(', ') || 'Без роли')
    return {
      member: m,
      groupStart,
      roleLabel: groupStart ? (topRoleId ? roleName(topRoleId) : 'Без роли') : null,
      roleSubtitle,
      cells: filteredEvents.value.map((e) => {
        const participationId = participationIdByEvent.value.get(e.id)
        const attendance = participationId ? attendanceByKey.value.get(`${participationId}:${m.id}`) : undefined
        return buildCellInfo(attendance, participationId, m.id)
      }),
    }
  })
})

// ---- Окно мероприятий: подгружается порциями по EVENTS_PAGE_SIZE и НАКАПЛИВАЕТСЯ
// в обе стороны (прошлое/будущее), а не заменяется целиком -- как бесконечная
// подгрузка списка на главной странице (см. HomePage/EventList.vue), только по
// горизонтали и с той же общей логикой окна (utils/eventWindow), чтобы не
// дублировать дедуп/сортировку. При скролле таблицы к краю (ближе LOAD_EDGE)
// автоматически подгружается следующая страница, а позиция скролла сохраняется
// при подгрузке слева, чтобы список не «прыгал» (справа -- не требуется, новые
// колонки просто дописываются после текущего конца). ----
const EVENTS_PAGE_SIZE = 20
const LOAD_EDGE = 150
const dateFrom = ref('')
const dateTo = ref('')
const useCustomRange = ref(false)
const hasMorePast = ref(true)
const hasMoreFuture = ref(true)
const loadingPast = ref(false)
const loadingFuture = ref(false)
const matrixWrapRef = ref<HTMLElement | null>(null)
let edgeCooldown = false

// ---- Перетаскивание полотна мышью (в дополнение к обычному скроллу --
// таблица широкая и высокая, тащить мышью удобнее, чем ловить курсором
// узкую полосу скролла). Клик по ячейке/шапке после реального перетаскивания
// подавляем, иначе mouseup случайно откроет мероприятие или отметку. ----
const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragScrollStartX = 0
let dragScrollStartY = 0
let dragMoved = false

function onMatrixMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  const wrap = matrixWrapRef.value
  if (!wrap) return
  isDragging.value = true
  dragMoved = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragScrollStartX = wrap.scrollLeft
  dragScrollStartY = wrap.scrollTop
  window.addEventListener('mousemove', onMatrixMouseMove)
  window.addEventListener('mouseup', onMatrixMouseUp)
}

function onMatrixMouseMove(e: MouseEvent) {
  const wrap = matrixWrapRef.value
  if (!wrap || !isDragging.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (!dragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) dragMoved = true
  wrap.scrollLeft = dragScrollStartX - dx
  wrap.scrollTop = dragScrollStartY - dy
}

function onMatrixMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMatrixMouseMove)
  window.removeEventListener('mouseup', onMatrixMouseUp)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Окно мероприятий вокруг даты: прошлое (<=) и будущее (>=) -- та же форма
// запроса, что и на главной странице (fetchEventWindow в HomePage.vue), только
// с фильтром по конкретному коллективу вместо набора выбранных.
async function fetchEventsWindow(collectiveId: string, direction: 'past' | 'future', boundary: string): Promise<EventRead[]> {
  const res = await getEventsEventV1EventsGet(
    direction === 'past'
      ? { participant_id: collectiveId, date__lte: boundary, order_by: '-date', limit: EVENTS_PAGE_SIZE }
      : { participant_id: collectiveId, date__gte: boundary, order_by: 'date', limit: EVENTS_PAGE_SIZE },
  )
  return res.data.items.filter((e) => e.status !== 'template')
}

async function loadInitialEvents(collectiveId: string) {
  if (useCustomRange.value && dateFrom.value && dateTo.value) {
    const items = await fetchAllPages<EventRead>((page, limit) =>
      getEventsEventV1EventsGet({
        participant_id: collectiveId, date__gte: dateFrom.value, date__lte: dateTo.value, order_by: 'date', page, limit,
      }))
    events.value = items.filter((e) => e.status !== 'template')
    hasMorePast.value = false
    hasMoreFuture.value = false
  } else {
    const today = todayStr()
    const [past, future] = await Promise.all([
      fetchEventsWindow(collectiveId, 'past', today),
      fetchEventsWindow(collectiveId, 'future', today),
    ])
    const eventWindow = buildEventWindow(past, future, EVENTS_PAGE_SIZE)
    events.value = eventWindow.events
    hasMorePast.value = eventWindow.hasMorePast
    hasMoreFuture.value = eventWindow.hasMoreFuture
  }
  await loadLocations(events.value)
  await positionMatrixScroll()
}

// Подгружает более раннюю страницу мероприятий и добавляет её СЛЕВА к уже
// показанным, сохраняя позицию скролла -- горизонтальный аналог loadMoreUp
// из HomePage/EventList.vue: список растёт, а не заменяется.
async function loadMorePast() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId || useCustomRange.value || !hasMorePast.value || loadingPast.value) return
  const boundary = events.value[0]?.date
  if (!boundary) {
    hasMorePast.value = false
    return
  }
  loadingPast.value = true
  try {
    const items = await fetchEventsWindow(collectiveId, 'past', boundary)
    const before = events.value.length
    const wrap = matrixWrapRef.value
    const prevScrollWidth = wrap?.scrollWidth ?? 0
    const prevScrollLeft = wrap?.scrollLeft ?? 0
    events.value = mergeEventWindow(items, events.value)
    hasMorePast.value = items.length === EVENTS_PAGE_SIZE
    if (events.value.length === before) hasMorePast.value = false
    await loadLocations(events.value)
    await nextTick()
    if (wrap) wrap.scrollLeft = prevScrollLeft + (wrap.scrollWidth - prevScrollWidth)
  } finally {
    loadingPast.value = false
  }
}

// Подгружает более позднюю страницу и добавляет её СПРАВА -- уже показанные
// колонки не двигаются, компенсировать скролл не нужно.
async function loadMoreFuture() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId || useCustomRange.value || !hasMoreFuture.value || loadingFuture.value) return
  const boundary = events.value[events.value.length - 1]?.date
  if (!boundary) {
    hasMoreFuture.value = false
    return
  }
  loadingFuture.value = true
  try {
    const items = await fetchEventsWindow(collectiveId, 'future', boundary)
    const before = events.value.length
    events.value = mergeEventWindow(events.value, items)
    hasMoreFuture.value = items.length === EVENTS_PAGE_SIZE
    if (events.value.length === before) hasMoreFuture.value = false
    await loadLocations(events.value)
  } finally {
    loadingFuture.value = false
  }
}

// Скролл таблицы к краю -- бесшовная подгрузка в обе стороны, как в
// EventList.vue (LOAD_EDGE + edgeCooldown, чтобы не задваивать запросы на
// каждый тик скролла).
function onMatrixScroll() {
  const wrap = matrixWrapRef.value
  if (!wrap || edgeCooldown || useCustomRange.value) return
  if (wrap.scrollLeft < LOAD_EDGE && hasMorePast.value && !loadingPast.value) {
    edgeCooldown = true
    loadMorePast().finally(() => { setTimeout(() => { edgeCooldown = false }, 400) })
  } else if (wrap.scrollWidth - wrap.scrollLeft - wrap.clientWidth < LOAD_EDGE && hasMoreFuture.value && !loadingFuture.value) {
    edgeCooldown = true
    loadMoreFuture().finally(() => { setTimeout(() => { edgeCooldown = false }, 400) })
  }
}

function scrollMatrixBy(deltaPx: number) {
  matrixWrapRef.value?.scrollBy({ left: deltaPx, behavior: 'smooth' })
}

async function goEarlier() {
  if (useCustomRange.value || loadingPast.value || !hasMorePast.value) return
  await loadMorePast()
  scrollMatrixBy(-320)
}

async function goLater() {
  if (!useCustomRange.value && hasMoreFuture.value && !loadingFuture.value) {
    const wrap = matrixWrapRef.value
    if (wrap && wrap.scrollWidth - wrap.scrollLeft - wrap.clientWidth < 320) await loadMoreFuture()
  }
  scrollMatrixBy(320)
}

// Ширина колонки/шапки с именем измеряется из реального DOM, а не фиксируется
// в JS -- на мобильном матрица компактнее (см. CSS @media ниже), и жёстко
// заданное число разошлось бы с реальной раскладкой.
function measureMatrixMetrics(wrap: HTMLElement): { columnWidth: number; rowHeadWidth: number } {
  const columnWidth = wrap.querySelector<HTMLElement>('.matrix-col-head')?.offsetWidth ?? 133
  const rowHeadEl = wrap.querySelector<HTMLElement>('.matrix-row-head') ?? wrap.querySelector<HTMLElement>('.matrix-corner')
  return { columnWidth, rowHeadWidth: rowHeadEl?.offsetWidth ?? 160 }
}

// Начальная позиция скролла: первым видимым мероприятием должно быть ближайшее
// будущее (как на главной странице, см. HomePage.vue/initLoad) -- если данных
// от него до конца загруженного окна хватает, чтобы заполнить экран. Иначе
// (будущих мероприятий мало или нет) показываем самые последние -- правый край,
// чтобы экран не оказался почти пустым.
async function positionMatrixScroll() {
  await nextTick()
  const wrap = matrixWrapRef.value
  if (!wrap) return
  if (useCustomRange.value) {
    wrap.scrollLeft = 0
    return
  }
  const { columnWidth, rowHeadWidth } = measureMatrixMetrics(wrap)
  const anchorIdx = findUpcomingIndex(events.value, new Date(todayStr()))
  const columnsToFill = Math.ceil(Math.max(0, wrap.clientWidth - rowHeadWidth) / columnWidth)
  const columnsFromAnchor = anchorIdx >= 0 ? events.value.length - anchorIdx : 0
  if (anchorIdx < 0 || columnsFromAnchor < columnsToFill) {
    wrap.scrollLeft = wrap.scrollWidth
  } else {
    wrap.scrollLeft = anchorIdx * columnWidth
  }
}

function applyDateRange() {
  if (!dateFrom.value || !dateTo.value) return
  useCustomRange.value = true
  const collectiveId = principal.activePrincipalCollectiveId
  if (collectiveId) loadInitialEvents(collectiveId)
}

function resetDateRange() {
  useCustomRange.value = false
  dateFrom.value = ''
  dateTo.value = ''
  const collectiveId = principal.activePrincipalCollectiveId
  if (collectiveId) loadInitialEvents(collectiveId)
}

// Перезагружает только сами отметки (не участия/участников) -- используется
// после правки/создания одной ячейки, чтобы матрица отразила новое значение.
async function refreshAttendances() {
  attendances.value = await loadAllAttendance(participations.value.map((p) => p.id))
}

// Клик по самой ячейке -- как и раньше, переход на страницу мероприятия
// (с параметрами member/collective для подсветки нужной строки).
function onCellClick(event: EventRead, member: MemberRead) {
  if (dragMoved) return // клик после перетаскивания полотна -- не переход
  const collectiveId = principal.activePrincipalCollectiveId
  router.push({
    path: `/event/${event.id}`,
    query: collectiveId ? { member: member.id, collective: collectiveId } : { member: member.id },
  })
}

// Кнопка отметки внутри ячейки (EventAttendanceChip, та же кнопка, что и на
// главной странице) -- значение уже вычислено самим чипом (handleToggle).
async function onToggleCell(event: EventRead, member: MemberRead, value: boolean) {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  const participationId = participationIdByEvent.value.get(event.id)
  const attendance = participationId ? attendanceByKey.value.get(`${participationId}:${member.id}`) : undefined
  if (!attendance || attendance.is_verified) return
  try {
    await withPending(attendance.id, async () => {
      await patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch(
        collectiveId, attendance.id, { is_attended: value },
      )
      await refreshAttendances()
    })
  } catch (err) {
    showError(err, 'Не удалось изменить отметку')
  }
}

// Кнопка на месте "нет данных об участии" -- предлагает создать отметку
// (как addAttendance на странице мероприятия), не переходя на неё.
async function onCreateCell(event: EventRead, member: MemberRead) {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  const participationId = participationIdByEvent.value.get(event.id)
  if (!participationId) return
  const ok = await confirmAction(
    'Создать отметку присутствия?',
    `У «${displayName(member)}» нет записи об участии в «${event.name}». Создать отметку?`,
    'Создать',
    'confirm',
  )
  if (!ok) return
  try {
    await withPending(`create:${participationId}:${member.id}`, async () => {
      await createMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendancePost(
        collectiveId, participationId, { member_id: member.id },
      )
      await refreshAttendances()
    })
  } catch (err) {
    showError(err, 'Не удалось создать отметку')
  }
}

function isPending(key: string): boolean {
  return !!key && pending.has(key)
}

function onEventHeaderClick(eventId: string) {
  if (dragMoved) return
  router.push(`/event/${eventId}`)
}

// ---- Загрузка остальных данных ----

// Батч-фильтра по локациям нет -- один GET на уникальный location_id (по числу
// мероприятий, не мероприятий×участников), пропуская уже известные (список
// только растёт, поэтому уже показанные мероприятия не перезапрашиваются).
async function loadLocations(eventList: EventRead[]) {
  const ids = [...new Set(eventList.map((e) => e.location_id).filter((id): id is string => !!id))]
    .filter((id) => !locationsById[id])
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await getLocationGeoV1LocationsLocationIdGet(id)
      locationsById[id] = res.data
    } catch { /* локация не критична для дашборда */ }
  }))
}

// AttendanceFilter поддерживает participation_id__in -- один батч-запрос на
// весь коллектив вместо запроса на каждое мероприятие; fetchAllPages
// дочитывает страницы, если строк больше одного лимита.
async function loadAllAttendance(participationIds: string[]): Promise<AttendanceRead[]> {
  if (!participationIds.length) return []
  const participationIdIn = participationIds.join(',')
  return fetchAllPages<AttendanceRead>((page, limit) =>
    getAttendancesEventV1AttendancesGet({ participation_id__in: participationIdIn, page, limit }))
}

async function loadDashboard(collectiveId: string) {
  loading.value = true
  try {
    const [activeRes, inactiveRes, rolesRes, participationsRes] = await Promise.all([
      getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet(collectiveId, { limit: 100, is_active: true }),
      getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet(collectiveId, { limit: 100, is_active: false }),
      getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet(collectiveId, { limit: 100 }),
      getParticipationsEventV1ParticipationsGet({ collective_id: collectiveId, limit: 100 }),
    ])

    members.value = [...activeRes.data.items, ...inactiveRes.data.items]
    roles.value = rolesRes.data.items
    participations.value = participationsRes.data.items
    roleOrder.value = reconcileRoleOrder(collectiveId, roles.value.map((r) => r.id))
    rowSortMode.value = loadSortMode(collectiveId)
    applyStoredFilters(collectiveId)

    await Promise.all([
      loadInitialEvents(collectiveId),
      loadAllAttendance(participations.value.map((p) => p.id)).then((list) => { attendances.value = list }),
      Promise.all(members.value.map(async (m) => {
        const name = await resolvePersonName(m.person_id)
        if (name) personNames[m.person_id] = name
      })),
    ])
  } catch (err) {
    console.error('Failed to load dashboard', err)
  } finally {
    loading.value = false
  }
  // На момент вызова внутри loadInitialEvents таблица ещё скрыта за v-if="loading"
  // (matrixWrapRef -- null), поэтому позиционируем скролл ещё раз, уже после
  // того, как loading сброшен и таблица реально появилась в DOM.
  await positionMatrixScroll()
}

watch(() => principal.activePrincipalCollectiveId, (collectiveId) => {
  useCustomRange.value = false
  dateFrom.value = ''
  dateTo.value = ''
  hasMorePast.value = true
  hasMoreFuture.value = true
  if (!collectiveId) {
    events.value = []
    members.value = []
    roles.value = []
    participations.value = []
    attendances.value = []
    return
  }
  loadDashboard(collectiveId)
}, { immediate: true })
</script>

<style scoped>
.page-body {
  padding-bottom: 32px;
}

/* Дашборд full-width (см. PrincipalLayout PAGES) только ради таблицы -- сам
   тулбар/фильтры/легенда держат ту же колонку 760px, что и остальные
   страницы панели (.principal-main). Матрица (.matrix-shell) сюда намеренно
   не входит. */
.dash-narrow {
  max-width: 760px;
  margin: 0 auto;
}

/* Тулбар и фильтры -- единый язык с principal/events и principal/members */
.ev-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.ev-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 220px;
}

.ev-search-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: var(--ion-color-medium);
  pointer-events: none;
}

.ev-search-input {
  width: 100%;
  height: 44px;
  padding: 0 38px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ev-search-input:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

.ev-search-clear {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 15px;
  cursor: pointer;
}

.ev-search-clear:hover {
  background: var(--ion-background-color);
}

.ev-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ev-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 6px 0 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
}

.ev-sort-icon {
  font-size: 17px;
  color: var(--ion-color-medium);
}

.ev-sort-select {
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-text-color);
  outline: none;
  cursor: pointer;
  padding: 0 4px;
}

.ev-sort-dir {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.ev-sort-dir:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.sort-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.btn-spinner-sm {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid var(--ion-border-color);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Мобильная модалка фильтров -- те же классы/язык, что у HomePage.vue. */
.filter-modal-body {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 20px;
  color: var(--ion-color-medium);
  text-align: center;
}

.page-state ion-icon {
  font-size: 40px;
  opacity: 0.4;
}

.page-state p {
  margin: 0;
  font-size: 14px;
  max-width: 320px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Матрица */
.matrix-shell {
  position: relative;
}

.matrix-wrap {
  max-height: 70vh;
  overflow-x: auto;
  overflow-y: auto;
  border-radius: 14px;
  box-shadow: var(--ion-card-shadow);
  background: var(--ion-card-background);
  cursor: grab;
  /* Скроллбары видны всегда, а не только по ховеру -- иначе на полотне такого
     размера непонятно, что можно скроллить вбок. */
  scrollbar-width: thin;
  /* Только ГОРИЗОНТАЛЬНЫЙ overscroll зажат: на границе слева/справа свайп
     иначе "перетекает" на страницу целиком -- в Firefox это срабатывает как
     переход назад/вперёд по истории. Раньше contain стоял на обе оси сразу и
     из-за этого вертикальная прокрутка тачпадом/колесом мыши, дойдя до верха
     или низа таблицы, просто утыкалась в стену вместо того, чтобы передать
     жест странице -- с большим числом участников (много строк, весь экран
     занят таблицей) страницу вообще было не пролистать, пока курсор над
     матрицей. overscroll-behavior-y оставлен на дефолтном auto, чтобы
     вертикальный скролл на границе всё-таки чейнился на body. */
  overscroll-behavior-x: contain;
}

.matrix-wrap--dragging {
  cursor: grabbing;
  user-select: none;
}

/* Пагинация страниц окна -- листает мероприятия целыми порциями, а не
   доливает их бесконечно. Раньше стрелки лежали поверх таблицы по краям
   (position: absolute, left/right: -14px) -- на full-width дашборде это
   съезжало почти к самому краю экрана и норовило вылезти за него, особенно
   на мобильном. Теперь обычный тулбар-ряд над таблицей, тот же язык кнопок,
   что и .sort-btn. */
.matrix-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.matrix-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
  cursor: pointer;
  transition: all 0.15s;
}

.matrix-nav-btn ion-icon {
  font-size: 16px;
}

.matrix-nav-btn:hover:not(:disabled) {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.matrix-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Метка "сегодня" -- показывает дату и позволяет одним кликом проскроллить
   матрицу к ближайшему будущему мероприятию (см. scrollToNextEvent). */
.matrix-today-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-primary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.matrix-today-badge:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.16);
}

.matrix-today-badge ion-icon {
  font-size: 16px;
}

.matrix {
  --matrix-month-row-h: 26px;
  /* Ширина колонки с ФИО зафиксирована (не min/max-диапазон, как раньше) --
     на неё же завязан левый sticky-отступ подписи месяца (.matrix-month-label),
     подписи должны цепляться ровно за границу этой колонки. */
  --matrix-namecol-w: 200px;
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
  min-width: 100%;
}

/* Строка меток месяцев -- отдельная sticky-строка НАД строкой с названиями
   (по аналогии с month-separator на главной, см. EventList.vue), с фиксированной
   высотой (--matrix-month-row-h), на которую сдвинут top у строки ниже --
   так обе строки складываются друг под другом при вертикальном скролле, а не
   перекрываются (тот же приём, которым раньше уже чинили дату -- никакого
   flex/пересчёта, просто фиксированные смещения). */
.matrix-month-row th {
  position: sticky;
  top: 0;
  z-index: 3;
  height: var(--matrix-month-row-h, 26px);
  box-sizing: border-box;
  padding: 0 10px;
  background: var(--ion-card-background);
  border-bottom: 1px solid var(--ion-border-color);
  border-left: 1px solid var(--ion-border-color);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ion-color-medium);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}

/* Собственный sticky у подписи месяца (а не только у самой th) -- см.
   комментарий в шаблоне. Отступ слева равен ширине колонки ФИО, поэтому
   подпись останавливается ровно на границе с полем ячеек, никогда не
   заезжая на sticky-колонку с фамилиями. */
.matrix-month-label {
  position: sticky;
  left: var(--matrix-namecol-w);
  display: inline-block;
  max-width: calc(100vw - var(--matrix-namecol-w) - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.matrix-corner-month {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 4;
  background: var(--ion-card-background);
  width: var(--matrix-namecol-w);
  min-width: var(--matrix-namecol-w);
}

.matrix-corner {
  position: sticky;
  top: var(--matrix-month-row-h, 26px);
  left: 0;
  z-index: 3;
  background: var(--ion-card-background);
  width: var(--matrix-namecol-w);
  min-width: var(--matrix-namecol-w);
}

.matrix-col-head {
  position: sticky;
  top: var(--matrix-month-row-h, 26px);
  z-index: 2;
  min-width: 132px;
  max-width: 132px;
  padding: 10px 10px 8px;
  background: var(--ion-card-background);
  border-top: 3px solid transparent;
  border-bottom: 1px solid var(--ion-border-color);
  border-left: 1px solid var(--ion-border-color);
  text-align: left;
  vertical-align: top;
  cursor: pointer;
  transition: background 0.15s;
}

.matrix-col-head:hover {
  background: var(--ion-background-color);
}

/* Ближайшее будущее мероприятие -- подсветка колонки, соответствующей метке
   "Сегодня — ..." в тулбаре (см. .matrix-today-badge). Только цвет границы,
   без изменения геометрии ячейки, чтобы не задеть выравнивание дат. */
.matrix-col-head--next {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  border-top-color: var(--ion-color-primary) !important;
}

.matrix-col-head--next:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
}

.matrix-event-name {
  display: -webkit-box;
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  /* Название всегда резервирует высоту под 2 строки, даже если уместилось
     в одну -- тогда дата ниже (в обычном потоке) на одном уровне у всех
     колонок без flex/absolute-трюков, которые либо ломают <th> (display:flex
     прямо на sticky-ячейке -- проверено, ломает расчёт высоты строки), либо
     не резолвятся в table-cell (height: 100% у ребёнка -- тоже проверено). */
  min-height: 34px;
}

.matrix-event-date {
  display: block;
  margin-top: 4px;
  padding-top: 3px;
  border-top: 1px solid var(--ion-border-color);
  font-size: 11px;
  color: var(--ion-color-medium);
}

.matrix-event-location {
  margin-top: 3px;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 112px;
}

.matrix-row-head {
  position: sticky;
  left: 0;
  z-index: 1;
  width: var(--matrix-namecol-w);
  min-width: var(--matrix-namecol-w);
  max-width: var(--matrix-namecol-w);
  padding: 8px 12px;
  background: var(--ion-card-background);
  border-bottom: 1px solid var(--ion-border-color);
  border-right: 1px solid var(--ion-border-color);
  text-align: left;
  vertical-align: middle;
}

.matrix-row-head--inactive {
  opacity: 0.55;
}

/* Подпись группы ролей (сортировка "по ролям") -- та же подача, что
   .attendance-divider на странице мероприятия: строка с названием роли
   над первым участником группы, а не просто линия. */
.matrix-group-row td {
  padding: 0;
  border: none;
  background: transparent;
}

/* Ячейка растянута на всю ширину таблицы (colspan), но сама подпись внутри --
   sticky, поэтому остаётся видна у левого края при горизонтальном скролле
   таблицы, как и колонка с именем участника. */
.matrix-group-divider {
  text-align: left;
}

.matrix-group-divider-label {
  position: sticky;
  left: 12px;
  display: inline-block;
  padding: 10px 0 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

/* ФИО должно поместиться целиком: в отличие от остальных подписей матрицы
   тут не троеточие, а перенос на 2-3 строки -- колонка фиксированной ширины
   (--matrix-namecol-w), поэтому строка сама вырастает под содержимое, не
   ломая соседние ряды (у каждого <tr> высота независимая). */
.matrix-member-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 16px;
  color: var(--ion-text-color);
  white-space: normal;
  overflow-wrap: break-word;
}

.matrix-member-roles {
  display: block;
  font-size: 11px;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.matrix-cell {
  position: relative;
  min-width: 132px;
  max-width: 132px;
  height: 54px;
  border-bottom: 1px solid var(--ion-border-color);
  border-left: 1px solid var(--ion-border-color);
  text-align: center;
  vertical-align: middle;
  cursor: pointer;
  transition: background 0.15s;
}

.matrix-cell:hover {
  background: var(--ion-background-color);
}

/* Участие заведено, но присутствие ещё не отмечено -- нужно, чтобы такие
   ячейки было видно с первого взгляда на широкой таблице. */
.matrix-cell--unmarked {
  background: rgba(255, 184, 0, 0.1);
}

.matrix-cell--unmarked:hover {
  background: rgba(255, 184, 0, 0.18);
}

.matrix-cell-inner {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Кнопка отметки -- тот же EventAttendanceChip, что и на главной странице,
   но сжатый под узкую колонку матрицы: подпись всегда скрыта (на десктопе
   чип обычно показывает текст, здесь для этого просто нет места), а
   собственный клик кнопки (см. @click.stop в компоненте) не даёт клику
   долететь до <td> и открыть страницу мероприятия. */
.matrix-chip :deep(.att-chip) {
  width: 30px;
  height: 30px;
  padding: 0;
  justify-content: center;
  border-radius: 50%;
}

.matrix-chip :deep(.att-chip-label) {
  display: none;
}

.matrix-chip :deep(.att-chip ion-icon) {
  font-size: 18px;
}

/* Кнопка создания отметки -- для ячеек без записи об участии ("нет данных").
   Внешне в языке остальных круглых иконок-кнопок матрицы. */
.matrix-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1.5px dashed var(--ion-color-step-300, #c7c7c7);
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-step-400, #a0a0a0);
  cursor: pointer;
  transition: all 0.15s;
}

.matrix-add-btn:hover:not(:disabled) {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.matrix-add-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

.matrix-add-btn ion-icon {
  font-size: 17px;
}

.matrix-cell-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--ion-color-medium);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Значки в углу ЯЧЕЙКИ (не иконки статуса), поэтому вынесены из .matrix-cell-inner
   отдельным элементом и позиционируются от .matrix-cell (position: relative
   выше) -- нижний правый угол, комментарий и заверение рядом друг с другом,
   а не накладываются. */
.matrix-cell-badges {
  position: absolute;
  right: 4px;
  bottom: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.matrix-cell-badge {
  font-size: 11px;
  color: var(--ion-color-medium);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 14px;
  padding: 0 4px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.legend-item ion-icon {
  font-size: 16px;
}

/* Компактная матрица на мобильном -- чтобы за раз помещалось больше отметок,
   а не 1-2 колонки на весь экран. Брейкпоинт как у usePlatform()/isDesktop
   (768px). Размеры не привязаны в JS (positionMatrixScroll измеряет их из
   DOM), поэтому можно менять их здесь свободно. */
@media (max-width: 767px) {
  .matrix {
    --matrix-month-row-h: 20px;
    --matrix-namecol-w: 130px;
  }

  .matrix-month-row th {
    padding: 0 6px;
    font-size: 9px;
  }

  .matrix-col-head {
    min-width: 88px;
    max-width: 88px;
    padding: 6px 6px 5px;
  }

  .matrix-event-name {
    font-size: 11px;
    line-height: 14px;
    min-height: 28px;
  }

  .matrix-event-date {
    font-size: 10px;
  }

  .matrix-event-location {
    font-size: 10px;
    max-width: 70px;
  }

  .matrix-row-head {
    padding: 6px 8px;
  }

  .matrix-member-name {
    font-size: 12px;
  }

  .matrix-member-roles {
    font-size: 10px;
  }

  .matrix-cell {
    min-width: 88px;
    max-width: 88px;
    height: 46px;
  }

  .matrix-cell-inner ion-icon {
    font-size: 16px;
  }

  .matrix-chip :deep(.att-chip) {
    width: 26px;
    height: 26px;
  }

  .matrix-chip :deep(.att-chip ion-icon) {
    font-size: 16px;
  }

  .matrix-add-btn {
    width: 26px;
    height: 26px;
  }

  .matrix-group-divider-label {
    font-size: 10px;
    padding: 8px 0 3px;
  }
}
</style>
