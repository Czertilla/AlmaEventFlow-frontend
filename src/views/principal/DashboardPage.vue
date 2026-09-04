<template>
  <PrincipalLayout title="Дашборд" full-width>
    <div class="page-body">
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

      <div class="filter-row">
        <span class="filter-row-label">Тип:</span>
        <div class="role-chips">
          <button class="role-chip" :class="{ 'role-chip--active': allTypesSelected }" @click="selectAllTypes">Все</button>
          <button
            v-for="[value, label] in typeOptions"
            :key="value"
            class="role-chip"
            :class="{ 'role-chip--active': selectedTypes.has(value) }"
            :style="selectedTypes.has(value) ? { borderColor: typeColor(value), color: typeColor(value), background: typeColor(value) + '1A' } : {}"
            @click="toggleType(value)"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <div v-if="roles.length" class="filter-row">
        <span class="filter-row-label">Роль:</span>
        <div class="role-chips">
          <button class="role-chip" :class="{ 'role-chip--active': allRolesSelected }" @click="selectAllRoles">Все</button>
          <button
            v-for="r in roles"
            :key="r.id"
            class="role-chip"
            :class="{ 'role-chip--active': selectedRoleIds.has(r.id) }"
            @click="toggleRoleFilter(r.id)"
          >
            {{ r.name }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-row-label">Участники:</span>
        <div class="role-chips">
          <button class="role-chip" :class="{ 'role-chip--active': activeFilter === 'all' }" @click="activeFilter = 'all'">Все</button>
          <button class="role-chip" :class="{ 'role-chip--active': activeFilter === 'active' }" @click="activeFilter = 'active'">Активные</button>
          <button class="role-chip" :class="{ 'role-chip--active': activeFilter === 'inactive' }" @click="activeFilter = 'inactive'">Неактивные</button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-row-label">Период:</span>
        <input v-model="dateFrom" type="date" class="native-date" aria-label="С даты" />
        <span class="range-dash">—</span>
        <input v-model="dateTo" type="date" class="native-date" aria-label="По дату" />
        <button class="sort-btn" :disabled="!dateFrom || !dateTo" @click="applyDateRange">Применить</button>
        <button v-if="useCustomRange" class="sort-btn" @click="resetDateRange">Сбросить</button>
      </div>

      <div v-if="loading" class="page-state">
        <div class="loading-spinner" />
      </div>
      <div v-else-if="!filteredEvents.length || !filteredMembers.length" class="page-state">
        <ion-icon :icon="gridOutline" />
        <p>Нет данных для отображения -- измените фильтры или дождитесь мероприятий/участников</p>
      </div>

      <template v-else>
        <div class="matrix-shell">
          <button
            class="matrix-page-btn matrix-page-btn--left"
            :disabled="useCustomRange || !canGoEarlier || !!loadingWindow"
            title="Более ранние мероприятия"
            @click="goEarlier"
          >
            <span v-if="loadingWindow === 'earlier'" class="btn-spinner-sm" />
            <ion-icon v-else :icon="chevronBackOutline" />
          </button>
          <div ref="matrixWrapRef" class="matrix-wrap">
          <table class="matrix">
            <thead>
              <tr>
                <th class="matrix-corner" />
                <th
                  v-for="e in filteredEvents"
                  :key="e.id"
                  class="matrix-col-head"
                  :style="{ borderTopColor: typeColor(e.type) }"
                  @click="$router.push(`/event/${e.id}`)"
                >
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
              <tr v-for="row in matrixRows" :key="row.member.id">
                <th class="matrix-row-head" :class="{ 'matrix-row-head--inactive': row.member.is_active === false }">
                  <span class="matrix-member-name">{{ displayName(row.member) }}</span>
                  <span class="matrix-member-roles">{{ row.member.roles.map((r) => r.name).join(', ') || 'Без роли' }}</span>
                </th>
                <td
                  v-for="(cell, i) in row.cells"
                  :key="filteredEvents[i].id"
                  class="matrix-cell"
                  :title="cell.title"
                  @click="onCellClick(filteredEvents[i], row.member)"
                >
                  <span class="matrix-cell-inner">
                    <ion-icon :icon="cell.icon" :style="{ color: cell.color }" />
                    <span v-if="cell.hasComment" class="matrix-cell-dot" />
                    <ion-icon v-if="cell.verified" :icon="lockClosedOutline" class="matrix-cell-lock" />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <button
            class="matrix-page-btn matrix-page-btn--right"
            :disabled="useCustomRange || !canGoLater || !!loadingWindow"
            title="Более поздние мероприятия"
            @click="goLater"
          >
            <span v-if="loadingWindow === 'later'" class="btn-spinner-sm" />
            <ion-icon v-else :icon="chevronForwardOutline" />
          </button>
        </div>

        <div class="legend">
          <span class="legend-item"><ion-icon :icon="checkmarkCircleOutline" style="color: #00BF92" /> Присутствовал</span>
          <span class="legend-item"><ion-icon :icon="closeCircleOutline" style="color: var(--ion-color-danger)" /> Отсутствовал</span>
          <span class="legend-item"><ion-icon :icon="helpCircleOutline" style="color: var(--ion-color-medium)" /> Не отмечено</span>
          <span class="legend-item"><span class="matrix-cell-dot matrix-cell-dot--legend" /> Есть комментарий</span>
          <span class="legend-item"><ion-icon :icon="lockClosedOutline" /> Заверено</span>
        </div>
      </template>
    </div>
  </PrincipalLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { IonIcon } from '@ionic/vue'
import {
  searchOutline, closeOutline, swapVerticalOutline, arrowUpOutline, arrowDownOutline,
  peopleOutline, gridOutline, checkmarkCircleOutline, closeCircleOutline, helpCircleOutline,
  lockClosedOutline, chevronBackOutline, chevronForwardOutline,
} from 'ionicons/icons'
import PrincipalLayout from '@/components/layout/PrincipalLayout.vue'
import LocationDisplay from '@/components/geo/LocationDisplay.vue'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import { resolvePersonName, shortId } from '@/utils/names'
import { typeOptions, typeColor } from '@/utils/eventLabels'
import { fetchAllPages } from '@/api/pagination'
import {
  reconcileRoleOrder, rankByRoleIds, loadSortMode, saveSortMode, type SortMode,
} from '@/utils/roleSort'
import {
  getEventsEventV1EventsGet,
  getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet,
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
  getParticipationsEventV1ParticipationsGet,
  getAttendancesEventV1AttendancesGet,
  getLocationGeoV1LocationsLocationIdGet,
} from '@/api/generated/almaEventFlow'
import type {
  EventRead, EventStatusEnumV1, EventTypeEnumV1, MemberRead, RoleRead, ParticipationRead,
  AttendanceRead, LocationRead,
} from '@/api/generated/almaEventFlow'

const router = useRouter()
const principal = usePrincipalStore()
const settings = useSettingsStore()

const loading = ref(false)
const events = ref<EventRead[]>([])
const members = ref<MemberRead[]>([])
const roles = ref<RoleRead[]>([])
const participations = ref<ParticipationRead[]>([])
const attendances = ref<AttendanceRead[]>([])
const locationsById = reactive<Record<string, LocationRead>>({})
const personNames = reactive<Record<string, string>>({})

// ---- Фильтры ----
const searchQuery = ref('')
const allTypeValues = typeOptions.map(([v]) => v)
const selectedTypes = ref<Set<EventTypeEnumV1>>(new Set(allTypeValues))
const allTypesSelected = computed(() => selectedTypes.value.size === allTypeValues.length)
const selectedRoleIds = ref<Set<string>>(new Set())
const allRolesSelected = computed(() => selectedRoleIds.value.size === roles.value.length)
const activeFilter = ref<'all' | 'active' | 'inactive'>('active')

watch(roles, (list) => {
  selectedRoleIds.value = new Set(list.map((r) => r.id))
})

function toggleType(t: EventTypeEnumV1) {
  const next = new Set(selectedTypes.value)
  if (next.has(t)) next.delete(t)
  else next.add(t)
  selectedTypes.value = next
}
function selectAllTypes() {
  selectedTypes.value = new Set(allTypeValues)
}
function toggleRoleFilter(id: string) {
  const next = new Set(selectedRoleIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedRoleIds.value = next
}
function selectAllRoles() {
  selectedRoleIds.value = new Set(roles.value.map((r) => r.id))
}

// ---- Сортировка мероприятий (колонки) -- та же логика, что на principal/events,
// но по умолчанию по возрастанию: сегодняшняя дата должна быть последней колонкой ----
const sortKey = ref<'date' | 'name' | 'status'>('date')
const sortOrder = ref<'asc' | 'desc'>('asc')
const STATUS_RANK: Record<EventStatusEnumV1, number> = {
  active: 0, draft: 1, template: 2, archived: 3,
}

const filteredEvents = computed(() => {
  let list = events.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q))
  list = list.filter((e) => !e.type || selectedTypes.value.has(e.type))

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

// ---- Сортировка/группировка участников (строки) -- переиспользует @/utils/roleSort,
// как это уже делают principal/members и страница мероприятия ----
const rowSortMode = ref<SortMode>('roles')
const roleOrder = ref<string[]>([])

function memberRoleRank(m: MemberRead): number {
  return rankByRoleIds(roleOrder.value, m.roles.map((r) => r.id))
}
function toggleRowSortMode() {
  rowSortMode.value = rowSortMode.value === 'roles' ? 'alpha' : 'roles'
  const collectiveId = principal.activePrincipalCollectiveId
  if (collectiveId) saveSortMode(collectiveId, rowSortMode.value)
}

function displayName(m: MemberRead): string {
  return personNames[m.person_id] || `#${shortId(m.person_id)}`
}

const filteredMembers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = members.value.filter((m) => {
    if (activeFilter.value === 'active' && m.is_active === false) return false
    if (activeFilter.value === 'inactive' && m.is_active !== false) return false
    if (!(m.roles.length === 0 || m.roles.some((r) => selectedRoleIds.value.has(r.id)))) return false
    if (q) {
      const matches = displayName(m).toLowerCase().includes(q) || m.roles.some((r) => r.name.toLowerCase().includes(q))
      if (!matches) return false
    }
    return true
  })
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
  icon: string
  color: string
  title: string
  hasComment: boolean
  verified: boolean
}

// Комментарий уже приходит вместе с attendance (см. loadAllAttendance) --
// отдельная подгрузка по наведению не нужна, просто добавляем его в title
// (нативная всплывающая подсказка браузера).
function withComment(title: string, a: AttendanceRead): string {
  return a.comment ? `${title}\nКомментарий: ${a.comment}` : title
}

function buildCellInfo(a: AttendanceRead | undefined): CellInfo {
  if (!a) {
    return { icon: helpCircleOutline, color: 'var(--ion-color-step-300, #c7c7c7)', title: 'Нет данных об участии', hasComment: false, verified: false }
  }
  const hasComment = !!a.comment
  const verified = !!a.is_verified
  if (a.is_attended === true) {
    return { icon: checkmarkCircleOutline, color: '#00BF92', title: withComment('Присутствовал', a), hasComment, verified }
  }
  if (a.is_attended === false) {
    return { icon: closeCircleOutline, color: 'var(--ion-color-danger)', title: withComment('Отсутствовал', a), hasComment, verified }
  }
  return { icon: helpCircleOutline, color: 'var(--ion-color-medium)', title: withComment('Не отмечено', a), hasComment, verified }
}

interface MatrixRow {
  member: MemberRead
  cells: CellInfo[]
}

const matrixRows = computed<MatrixRow[]>(() =>
  filteredMembers.value.map((m) => ({
    member: m,
    cells: filteredEvents.value.map((e) => {
      const participationId = participationIdByEvent.value.get(e.id)
      const attendance = participationId ? attendanceByKey.value.get(`${participationId}:${m.id}`) : undefined
      return buildCellInfo(attendance)
    }),
  })),
)

// ---- Окно мероприятий: пагинирующее (порциями по EVENTS_PAGE_SIZE), а не
// фильтрующее -- каждый переход стрелкой ЗАМЕНЯЕТ видимую страницу, а не
// доливает в один бесконечно растущий список. Даты считаются так же, как на
// главной странице (HomePage/eventCalendar: date__lte/date__gte), но
// сегодняшняя дата -- на конце страницы, а не в начале, т.к. дашборд
// посещений в первую очередь смотрит в прошлое. laterStack запоминает уже
// просмотренные более свежие страницы, чтобы «Позже» не перезапрашивало их. ----
const EVENTS_PAGE_SIZE = 20
const dateFrom = ref('')
const dateTo = ref('')
const useCustomRange = ref(false)
const canGoEarlier = ref(true)
const canGoLater = ref(false)
const loadingWindow = ref<'earlier' | 'later' | null>(null)
const laterStack = ref<EventRead[][]>([])
const matrixWrapRef = ref<HTMLElement | null>(null)

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchEventsPage(collectiveId: string, dateLte: string): Promise<EventRead[]> {
  const res = await getEventsEventV1EventsGet({
    participant_id: collectiveId, date__lte: dateLte, order_by: '-date', limit: EVENTS_PAGE_SIZE,
  })
  return res.data.items.filter((e) => e.status !== 'template')
}

async function resetMatrixScroll() {
  await nextTick()
  if (matrixWrapRef.value) matrixWrapRef.value.scrollLeft = 0
}

async function loadInitialEvents(collectiveId: string) {
  laterStack.value = []
  canGoLater.value = false
  if (useCustomRange.value && dateFrom.value && dateTo.value) {
    const items = await fetchAllPages<EventRead>((page, limit) =>
      getEventsEventV1EventsGet({
        participant_id: collectiveId, date__gte: dateFrom.value, date__lte: dateTo.value, order_by: 'date', page, limit,
      }))
    events.value = items.filter((e) => e.status !== 'template')
    canGoEarlier.value = false
  } else {
    const items = await fetchEventsPage(collectiveId, todayStr())
    events.value = items.slice().reverse() // по возрастанию даты -- сегодня последним
    canGoEarlier.value = items.length === EVENTS_PAGE_SIZE
  }
  await loadLocations(events.value)
  await resetMatrixScroll()
}

async function goEarlier() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId || useCustomRange.value || !canGoEarlier.value || loadingWindow.value) return
  const boundary = events.value[0]?.date
  if (!boundary) {
    canGoEarlier.value = false
    return
  }
  loadingWindow.value = 'earlier'
  try {
    // date__lte включает саму границу, поэтому дедупим по id (как на HomePage).
    const items = await fetchEventsPage(collectiveId, boundary)
    const currentIds = new Set(events.value.map((e) => e.id))
    const newOnes = items.filter((e) => !currentIds.has(e.id))
    if (newOnes.length === 0) {
      canGoEarlier.value = false
      return
    }
    laterStack.value.push(events.value)
    events.value = newOnes.slice().reverse()
    canGoEarlier.value = items.length === EVENTS_PAGE_SIZE
    canGoLater.value = true
    await loadLocations(events.value)
    await resetMatrixScroll()
  } finally {
    loadingWindow.value = null
  }
}

async function goLater() {
  if (useCustomRange.value || !laterStack.value.length || loadingWindow.value) return
  loadingWindow.value = 'later'
  try {
    events.value = laterStack.value.pop()!
    canGoLater.value = laterStack.value.length > 0
    canGoEarlier.value = true
    await loadLocations(events.value)
    await resetMatrixScroll()
  } finally {
    loadingWindow.value = null
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

function onCellClick(event: EventRead, member: MemberRead) {
  const collectiveId = principal.activePrincipalCollectiveId
  router.push({
    path: `/event/${event.id}`,
    query: collectiveId ? { member: member.id, collective: collectiveId } : { member: member.id },
  })
}

// ---- Загрузка остальных данных ----

// Батч-фильтра по локациям нет -- один GET на уникальный location_id (по числу
// мероприятий, не мероприятий×участников), пропуская уже известные (страницы
// в laterStack не нужно перезапрашивать при возврате через "Позже").
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
}

watch(() => principal.activePrincipalCollectiveId, (collectiveId) => {
  useCustomRange.value = false
  dateFrom.value = ''
  dateTo.value = ''
  canGoEarlier.value = true
  canGoLater.value = false
  laterStack.value = []
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

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-row-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.native-date {
  height: 36px;
  padding: 0 10px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 13px;
  color: var(--ion-text-color);
  outline: none;
}

.native-date:focus {
  border-color: var(--ion-color-primary);
}

.range-dash {
  color: var(--ion-color-step-400);
  font-size: 13px;
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

.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-chip {
  padding: 6px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.role-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
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

.loading-spinner {
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

/* Матрица */
.matrix-shell {
  position: relative;
}

.matrix-wrap {
  max-height: 70vh;
  overflow: auto;
  border-radius: 14px;
  box-shadow: var(--ion-card-shadow);
  background: var(--ion-card-background);
}

/* Пагинация страниц окна -- листает мероприятия целыми порциями, а не
   доливает их бесконечно; стрелки лежат поверх таблицы по краям. */
.matrix-page-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 50%;
  background: var(--ion-card-background);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  color: var(--ion-text-color);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
}

.matrix-page-btn:hover:not(:disabled) {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.matrix-page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.matrix-page-btn--left {
  left: -14px;
}

.matrix-page-btn--right {
  right: -14px;
}

.matrix {
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
  min-width: 100%;
}

.matrix-corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 3;
  background: var(--ion-card-background);
  min-width: 160px;
}

.matrix-col-head {
  position: sticky;
  top: 0;
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

.matrix-event-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.matrix-event-date {
  display: block;
  margin-top: 2px;
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
  min-width: 160px;
  max-width: 200px;
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

.matrix-member-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  min-width: 132px;
  max-width: 132px;
  height: 44px;
  border-bottom: 1px solid var(--ion-border-color);
  border-left: 1px solid var(--ion-border-color);
  text-align: center;
  cursor: pointer;
  transition: background 0.15s;
}

.matrix-cell:hover {
  background: var(--ion-background-color);
}

.matrix-cell-inner {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.matrix-cell-inner ion-icon {
  font-size: 19px;
}

.matrix-cell-dot {
  position: absolute;
  top: -2px;
  right: -6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ion-color-primary);
}

.matrix-cell-dot--legend {
  position: static;
  display: inline-block;
}

.matrix-cell-lock {
  margin-left: 4px;
  font-size: 12px;
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
</style>
