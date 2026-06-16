<template>
  <PrincipalLayout title="Мероприятия" add-label="Новое мероприятие" @add="openCreate">
      <div class="page-body">
        <ion-searchbar v-model="searchQuery" placeholder="Поиск мероприятий..." />

        <div v-if="loading" class="page-state">
          <div class="loading-spinner" />
        </div>
        <div v-else-if="filteredEvents.length === 0" class="page-state">
          <ion-icon :icon="calendarOutline" />
          <p>Коллектив пока не участвует в мероприятиях</p>
        </div>

        <div v-else class="event-rows">
          <button
            v-for="e in filteredEvents"
            :key="e.id"
            class="event-row"
            @click="$router.push(`/event/${e.id}`)"
          >
            <div class="event-row-status" :style="{ background: statusColor(e.status) }" />
            <div class="event-row-info">
              <span class="event-row-name">{{ e.name }}</span>
              <span class="event-row-date">{{ e.date ? formatDate(e.date, settings.dateFormat) : 'Без даты' }}</span>
            </div>
            <span class="event-row-badge" :style="{ color: statusColor(e.status) }">{{ statusLabel(e.status) }}</span>
          </button>
        </div>
      </div>

    <!-- Create event / participation modal -->
    <ion-modal :is-open="showCreateModal" @ion-modal-did-dismiss="showCreateModal = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Новое мероприятие</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="showCreateModal = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="form">
          <div class="form-field">
            <label>Шаблон или существующее мероприятие</label>

            <!-- Выбранный источник -->
            <div v-if="form.sourceId" class="source-selected">
              <ion-icon :icon="isJoinMode ? calendarOutline : copyOutline" />
              <span class="source-selected-name">{{ selectedSourceLabel }}</span>
              <span class="source-selected-kind">{{ isJoinMode ? 'мероприятие' : 'шаблон' }}</span>
              <button class="source-clear" aria-label="Сбросить" @click="clearSource">
                <ion-icon :icon="closeOutline" />
              </button>
            </div>

            <!-- Поисковая строка с фильтром -->
            <div v-else class="source-combo">
              <div class="source-input-wrap">
                <ion-icon class="source-input-icon" :icon="searchOutline" />
                <input
                  v-model="sourceSearch"
                  type="text"
                  class="native-input source-input"
                  placeholder="Поиск шаблона или мероприятия..."
                  @focus="onSourceFocus"
                  @blur="onSourceBlur"
                />
                <button
                  class="source-filter-btn"
                  :class="{ 'source-filter-btn--active': sourceFilterOpen }"
                  aria-label="Фильтры"
                  @click="sourceFilterOpen = !sourceFilterOpen"
                >
                  <ion-icon :icon="optionsOutline" />
                </button>
              </div>

              <!-- Панель фильтров -->
              <div v-if="sourceFilterOpen" class="source-filters">
                <button
                  class="source-filter-chip"
                  :class="{ 'source-filter-chip--active': sourceFilters.templates }"
                  @click="sourceFilters.templates = !sourceFilters.templates"
                >
                  <ion-icon :icon="copyOutline" />
                  Шаблоны
                </button>
                <button
                  class="source-filter-chip"
                  :class="{ 'source-filter-chip--active': sourceFilters.events }"
                  @click="sourceFilters.events = !sourceFilters.events"
                >
                  <ion-icon :icon="calendarOutline" />
                  Мероприятия
                </button>
                <select v-model="sourceFilters.type" class="source-filter-select">
                  <option value="">Любой тип</option>
                  <option v-for="[v, l] in typeOptions" :key="v" :value="v">{{ l }}</option>
                </select>
                <select v-model="sourceFilters.level" class="source-filter-select">
                  <option value="">Любой уровень</option>
                  <option v-for="[v, l] in levelOptions" :key="v" :value="v">{{ l }}</option>
                </select>
              </div>

              <!-- Подсказки -->
              <div v-if="sourceDropdownOpen" class="source-suggestions">
                <button
                  v-for="item in sourceSuggestions"
                  :key="item.id"
                  class="source-suggestion"
                  @mousedown.prevent="pickSource(item)"
                >
                  <ion-icon
                    class="source-suggestion-icon"
                    :class="`source-suggestion-icon--${item.kind}`"
                    :icon="item.kind === 'template' ? copyOutline : calendarOutline"
                  />
                  <span class="source-suggestion-name">{{ item.name }}</span>
                  <span class="source-suggestion-kind">{{ item.kind === 'template' ? 'шаблон' : 'мероприятие' }}</span>
                </button>
                <p v-if="sourceSuggestions.length === 0" class="source-suggestions-empty">
                  Ничего не найдено
                </p>
              </div>
            </div>

            <p v-if="isJoinMode" class="form-hint">
              Будет создано участие коллектива в существующем мероприятии — заполните только список участников.
            </p>
          </div>

          <template v-if="!isJoinMode">
            <div class="form-field">
              <label>Название</label>
              <ion-input v-model="form.name" placeholder="Название мероприятия" />
            </div>

            <div class="form-field">
              <label>Дата</label>
              <input
                v-model="form.date"
                type="date"
                class="native-input"
                @change="onDateChanged"
              />
            </div>

            <div class="form-field">
              <label>Описание</label>
              <ion-textarea v-model="form.description" :rows="3" placeholder="Описание мероприятия" />
            </div>

            <div class="form-field">
              <label>Организатор</label>
              <div v-if="selectedOrganizer" class="organizer-selected">
                <span>{{ selectedOrganizer.name }}</span>
                <button class="organizer-clear" aria-label="Убрать организатора" @click="clearOrganizer">
                  <ion-icon :icon="closeOutline" />
                </button>
              </div>
              <template v-else>
                <ion-searchbar
                  v-model="organizerSearch"
                  placeholder="Поиск организации..."
                  class="member-search"
                  :debounce="400"
                  @ion-input="searchOrganizers"
                />
                <div v-if="organizerOptions.length" class="organizer-options">
                  <button
                    v-for="o in organizerOptions"
                    :key="o.id"
                    class="organizer-option"
                    @click="selectOrganizer(o)"
                  >
                    {{ o.name }}
                  </button>
                </div>
              </template>
            </div>

            <div class="form-field">
              <label>Локация</label>
              <div v-if="selectedLocation" class="organizer-selected">
                <span><ion-icon class="inline-icon" :icon="locationOutline" /> {{ selectedLocation.name }}</span>
                <button class="organizer-clear" aria-label="Убрать локацию" @click="clearLocation">
                  <ion-icon :icon="closeOutline" />
                </button>
              </div>
              <template v-else>
                <ion-searchbar
                  v-model="locationSearch"
                  placeholder="Поиск локации..."
                  class="member-search"
                  :debounce="400"
                  @ion-input="searchLocations"
                />
                <div v-if="locationOptions.length" class="organizer-options">
                  <button
                    v-for="l in locationOptions"
                    :key="l.id"
                    class="organizer-option"
                    @click="selectLocation(l)"
                  >
                    {{ l.name }}
                  </button>
                </div>
              </template>
            </div>

            <div class="form-field">
              <label>
                Статус
                <span v-if="!statusTouched" class="auto-badge">авто</span>
              </label>
              <ion-select
                :value="form.status"
                interface="popover"
                :class="{ 'status-auto': !statusTouched }"
                @ion-change="onStatusChanged($event.detail.value)"
              >
                <ion-select-option value="draft">Черновик</ion-select-option>
                <ion-select-option value="active">Активно</ion-select-option>
                <ion-select-option value="template">Шаблон</ion-select-option>
              </ion-select>
            </div>

            <div class="form-field">
              <label>Тип</label>
              <ion-select v-model="form.type" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in typeOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <div class="form-field">
              <label>Уровень</label>
              <ion-select v-model="form.level" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in levelOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <div class="form-field">
              <label>Формат</label>
              <ion-select v-model="form.format" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in formatOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <!-- План: либо одно время начала, либо подробные этапы -->
            <div class="form-field">
              <label>План мероприятия</label>
              <div class="role-chips">
                <button
                  type="button"
                  class="role-chip"
                  :class="{ 'role-chip--active': planMode === 'time' }"
                  @click="setPlanMode('time')"
                >
                  Указать время
                </button>
                <button
                  type="button"
                  class="role-chip"
                  :class="{ 'role-chip--active': planMode === 'stages' }"
                  @click="setPlanMode('stages')"
                >
                  Расписать этапы
                </button>
              </div>

              <template v-if="planMode === 'time'">
                <input v-model="startTime" type="time" class="native-input" />
                <p class="form-hint">
                  Будет создан один этап «Начало» с указанным временем.
                  <span v-if="startTime && !form.date" class="form-hint-warn">Сначала укажите дату мероприятия.</span>
                </p>
              </template>
            </div>

            <!-- Этапы: из шаблона (даты пересчитываются со смещением) + свои -->
            <div v-if="planMode === 'stages'" class="form-field">
              <div v-if="form.stages.length" class="stage-list">
                <div v-for="(s, i) in form.stages" :key="i" class="stage-edit">
                  <div class="stage-edit-row">
                    <input v-model="s.name" type="text" class="native-input stage-name-input" placeholder="Название этапа" />
                    <button class="row-icon-btn row-icon-btn--danger" title="Удалить этап" @click="removeStage(i)">
                      <ion-icon :icon="trashOutline" />
                    </button>
                  </div>
                  <div class="stage-edit-row">
                    <input v-model="s.start_at" type="datetime-local" class="native-input" />
                    <span class="stage-dash">—</span>
                    <input
                      v-model="s.end_at"
                      type="datetime-local"
                      class="native-input"
                      placeholder="Окончание"
                      @focus="onEndFocus(s)"
                    />
                  </div>
                  <textarea
                    v-model="s.description"
                    class="native-input stage-desc-input"
                    rows="2"
                    placeholder="Описание этапа (необязательно)"
                  />
                  <span v-if="s.fromTemplate" class="stage-template-badge">из шаблона</span>
                </div>
              </div>
              <button class="add-stage-btn" @click="addStage">
                <ion-icon :icon="addOutline" />
                Добавить этап
              </button>
            </div>
          </template>

          <!-- Declared participants -->
          <div class="form-field">
            <label>Заявленные участники</label>
            <div v-if="!participantsExpanded" class="participants-summary">
              <span>Заявлены все {{ activeMembers.length }} активных участников коллектива</span>
              <button class="link-btn" @click="participantsExpanded = true">Настроить</button>
            </div>
            <div v-else class="participants-editor">
              <div class="participants-editor-head">
                <span class="participants-editor-title">Тонкая настройка состава</span>
                <button class="link-btn" @click="cancelParticipantsEdit">Отменить</button>
              </div>
              <ion-searchbar v-model="memberSearch" placeholder="Поиск участника..." class="member-search" />
              <div class="role-chips">
                <button
                  class="role-chip"
                  :class="{ 'role-chip--active': allSelected }"
                  @click="toggleAll"
                >
                  Все
                </button>
                <button
                  v-for="r in roles"
                  :key="r.id"
                  class="role-chip"
                  :class="{ 'role-chip--active': isRoleFullySelected(r.id) }"
                  @click="toggleRole(r.id)"
                >
                  {{ r.name }}
                </button>
              </div>
              <div class="member-list">
                <label v-for="m in filteredMembers" :key="m.id" class="member-item">
                  <input
                    type="checkbox"
                    :checked="selectedMemberIds.has(m.id)"
                    @change="toggleMember(m.id)"
                  />
                  <span>{{ memberName(m) }}</span>
                  <span class="member-roles">{{ m.roles.map((r) => r.name).join(', ') }}</span>
                </label>
              </div>
              <p class="form-hint">Выбрано: {{ selectedMemberIds.size }} из {{ activeMembers.length }}</p>
            </div>
          </div>

          <ion-button expand="block" :disabled="creating || (!isJoinMode && !form.name)" @click="submit">
            {{ isJoinMode ? 'Создать участие' : 'Создать мероприятие' }}
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>
  </PrincipalLayout>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import {
  IonHeader, IonToolbar, IonButtons, IonTitle, IonContent,
  IonButton, IonIcon, IonModal, IonInput, IonTextarea,
  IonSelect, IonSelectOption, IonSearchbar, toastController,
} from '@ionic/vue'
import PrincipalLayout from '@/components/layout/PrincipalLayout.vue'
import {
  addOutline, calendarOutline, closeOutline, trashOutline,
  optionsOutline, copyOutline, locationOutline, searchOutline,
} from 'ionicons/icons'
import { format as fnsFormat } from 'date-fns'
import { listOrganizationsOrgV1OrganizationsGet } from '@/api/generated/almaEventFlow'
import { getLocationsGeoV1LocationsGet } from '@/api/generated/almaEventFlow'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import {
  getEventsEventV1EventsGet,
  getParticipationsEventV1ParticipationsGet,
  getEventStagesEventV1EventsEventIdStagesGet,
  getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet,
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
  createMyEventEventV1MeEventsPost,
  createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost,
} from '@/api/generated/almaEventFlow'
import { resolvePersonName, rememberMemberPerson, shortId } from '@/utils/names'
import type { EventRead, EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1, MemberRead, RoleRead } from '@/api/generated/almaEventFlow'

const levelLabels: Record<EventLevelEnumV1, string> = {
  internal: 'Внутренний', regional: 'Региональный', national: 'Национальный', international: 'Международный',
}
const typeLabels: Record<EventTypeEnumV1, string> = {
  rehearsal: 'Репетиция', competition: 'Конкурс', concert: 'Концерт',
  festival: 'Фестиваль', play: 'Спектакль', performance: 'Выступление',
}
const formatLabels: Record<EventFormatEnumV1, string> = {
  online: 'Онлайн', offline: 'Офлайн',
}
const levelOptions = Object.entries(levelLabels) as [EventLevelEnumV1, string][]
const typeOptions = Object.entries(typeLabels) as [EventTypeEnumV1, string][]
const formatOptions = Object.entries(formatLabels) as [EventFormatEnumV1, string][]

// Редактируемый этап формы: даты в формате datetime-local, fromTemplate помечает
// стадии, перенесённые из шаблона (их даты пересчитываются при смене даты мероприятия)
interface StageForm {
  name: string
  start_at: string
  end_at: string
  description?: string | null
  fromTemplate?: boolean
  templateIdx?: number
}

function toLocalInput(iso: string): string {
  return fnsFormat(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

// datetime-local (наивное локальное время) → ISO с явным смещением tz, напр. 2026-05-03T19:00:00+03:00
function toTzIso(localInput: string): string {
  return fnsFormat(new Date(localInput), "yyyy-MM-dd'T'HH:mm:ssxxx")
}

const principal = usePrincipalStore()
const settings = useSettingsStore()

const events = ref<EventRead[]>([])
const templates = ref<EventRead[]>([])
const allEvents = ref<EventRead[]>([])
const members = ref<MemberRead[]>([])
const roles = ref<RoleRead[]>([])
const loading = ref(false)
const creating = ref(false)
const searchQuery = ref('')

const showCreateModal = ref(false)
const statusTouched = ref(false)
// План мероприятия: 'time' — одно время начала (этап «Начало»), 'stages' — подробные этапы
const planMode = ref<'time' | 'stages'>('time')
const startTime = ref('')
const participantsExpanded = ref(false)
const memberSearch = ref('')
const selectedMemberIds = ref<Set<string>>(new Set())

const form = ref({
  sourceId: null as string | null,
  name: '',
  date: '',
  description: '',
  status: 'draft' as EventStatusEnumV1,
  level: null as EventLevelEnumV1 | null,
  type: null as EventTypeEnumV1 | null,
  format: null as EventFormatEnumV1 | null,
  stages: [] as StageForm[],
})

// Организатор — поиск по всем организациям
interface OrganizerOption { id: string; name: string }
const organizerSearch = ref('')
const organizerOptions = ref<OrganizerOption[]>([])
const selectedOrganizer = ref<OrganizerOption | null>(null)

async function searchOrganizers() {
  if (!organizerSearch.value) {
    organizerOptions.value = []
    return
  }
  try {
    const res = await listOrganizationsOrgV1OrganizationsGet({ search: organizerSearch.value, limit: 10 })
    organizerOptions.value = (res.data.items as OrganizerOption[]) || []
  } catch {
    organizerOptions.value = []
  }
}

function selectOrganizer(o: OrganizerOption) {
  selectedOrganizer.value = o
  organizerSearch.value = ''
  organizerOptions.value = []
}

function clearOrganizer() {
  selectedOrganizer.value = null
}

// Локация — поиск по справочнику локаций
interface LocationOption { id: string; name: string }
const locationSearch = ref('')
const locationOptions = ref<LocationOption[]>([])
const selectedLocation = ref<LocationOption | null>(null)

async function searchLocations() {
  if (!locationSearch.value) {
    locationOptions.value = []
    return
  }
  try {
    const res = await getLocationsGeoV1LocationsGet({ search: locationSearch.value, limit: 10 })
    locationOptions.value = (res.data.items as LocationOption[]) || []
  } catch {
    locationOptions.value = []
  }
}

function selectLocation(l: LocationOption) {
  selectedLocation.value = l
  locationSearch.value = ''
  locationOptions.value = []
}

function clearLocation() {
  selectedLocation.value = null
}

// Комбобокс выбора шаблона / существующего мероприятия как поисковая строка
const sourceSearch = ref('')
const sourceDropdownOpen = ref(false)
const sourceFilterOpen = ref(false)
const sourceFilters = reactive({
  templates: true,
  events: true,
  type: '' as '' | EventTypeEnumV1,
  level: '' as '' | EventLevelEnumV1,
})

// Подсказки: при пустом запросе — все доступные источники, иначе фильтр по названию,
// плюс фильтры по типу/уровню мероприятия
const sourceSuggestions = computed(() => {
  const q = sourceSearch.value.trim().toLowerCase()
  const items: Array<{ id: string; name: string; kind: 'template' | 'event'; type?: EventTypeEnumV1 | null; level?: EventLevelEnumV1 | null }> = []
  if (sourceFilters.templates) {
    for (const t of templates.value) items.push({ id: t.id, name: t.name, kind: 'template', type: t.type, level: t.level })
  }
  if (sourceFilters.events) {
    for (const e of joinableEvents.value) items.push({ id: e.id, name: e.name, kind: 'event', type: e.type, level: e.level })
  }
  let res = items
  if (sourceFilters.type) res = res.filter((i) => i.type === sourceFilters.type)
  if (sourceFilters.level) res = res.filter((i) => i.level === sourceFilters.level)
  if (q) res = res.filter((i) => i.name.toLowerCase().includes(q))
  return res
})

// Текущий выбранный источник для отображения в строке
const selectedSourceLabel = computed(() => {
  if (!form.value.sourceId) return ''
  const t = templates.value.find((t) => t.id === form.value.sourceId)
  if (t) return t.name
  const e = joinableEvents.value.find((e) => e.id === form.value.sourceId)
  return e?.name ?? ''
})

function onSourceFocus() {
  sourceDropdownOpen.value = true
}

function onSourceBlur() {
  // Задержка, чтобы успел отработать клик по подсказке
  setTimeout(() => { sourceDropdownOpen.value = false }, 150)
}

function pickSource(item: { id: string; kind: 'template' | 'event' }) {
  sourceSearch.value = ''
  sourceDropdownOpen.value = false
  onSourceSelected(item.id)
}

function clearSource() {
  sourceSearch.value = ''
  onSourceSelected(null)
}

function addStage() {
  const prev = form.value.stages[form.value.stages.length - 1]
  let start = ''
  if (prev?.end_at) {
    // Максимум информации — старт новой стадии = конец предыдущей
    start = prev.end_at
  } else if (prev?.start_at) {
    // Минимум — берём дату предыдущей стадии (время по умолчанию)
    start = `${prev.start_at.slice(0, 10)}T12:00`
  } else if (form.value.date) {
    start = `${form.value.date}T12:00`
  }
  form.value.stages.push({
    name: '',
    start_at: start,
    end_at: '',
    description: '',
  })
}

function removeStage(i: number) {
  form.value.stages.splice(i, 1)
}

// Переключение режима плана. При переходе к этапам ранее указанное время
// подставляется в первый этап (без названия), как просит ТЗ.
function setPlanMode(mode: 'time' | 'stages') {
  if (mode === planMode.value) return
  if (mode === 'stages' && form.value.stages.length === 0 && startTime.value && form.value.date) {
    form.value.stages.push({
      name: '',
      start_at: `${form.value.date}T${startTime.value}`,
      end_at: '',
      description: '',
    })
  }
  planMode.value = mode
}

// Автоподстановка окончания при первом клике: если пусто — копируем старт стадии
function onEndFocus(stage: StageForm) {
  if (!stage.end_at && stage.start_at) {
    stage.end_at = stage.start_at
  }
}
// Original stage timestamps + template date for relative offset recalculation
let templateBase: { date: string | null; stages: Array<{ name: string; start_at: string; end_at?: string | null; description?: string | null }> } | null = null

const isJoinMode = computed(() =>
  !!form.value.sourceId && !templates.value.some((t) => t.id === form.value.sourceId),
)

const joinableEvents = computed(() =>
  allEvents.value.filter((e) => e.status === 'active' && !events.value.some((ev) => ev.id === e.id)),
)

const activeMembers = computed(() => members.value.filter((m) => m.is_active !== false))

const personNames = reactive<Record<string, string>>({})

function memberName(m: MemberRead): string {
  return personNames[m.person_id] || `#${shortId(m.person_id)}`
}

const filteredMembers = computed(() => {
  if (!memberSearch.value) return activeMembers.value
  const q = memberSearch.value.toLowerCase()
  return activeMembers.value.filter((m) => memberName(m).toLowerCase().includes(q))
})

const allSelected = computed(() =>
  activeMembers.value.length > 0 && activeMembers.value.every((m) => selectedMemberIds.value.has(m.id)),
)

const filteredEvents = computed(() => {
  if (!searchQuery.value) return events.value
  const q = searchQuery.value.toLowerCase()
  return events.value.filter((e) => e.name.toLowerCase().includes(q))
})

function statusColor(status?: EventStatusEnumV1): string {
  const map: Record<EventStatusEnumV1, string> = {
    draft: '#92949c', template: '#6C63FF', active: '#00D9A6', archived: '#FF4757',
  }
  return map[status ?? 'draft']
}

function statusLabel(status?: EventStatusEnumV1): string {
  const map: Record<EventStatusEnumV1, string> = {
    draft: 'Черновик', template: 'Шаблон', active: 'Активно', archived: 'Архив',
  }
  return map[status ?? 'draft']
}

function membersOfRole(roleId: string): MemberRead[] {
  return activeMembers.value.filter((m) => m.roles.some((r) => r.id === roleId))
}

function isRoleFullySelected(roleId: string): boolean {
  const list = membersOfRole(roleId)
  return list.length > 0 && list.every((m) => selectedMemberIds.value.has(m.id))
}

function toggleRole(roleId: string) {
  const list = membersOfRole(roleId)
  const next = new Set(selectedMemberIds.value)
  if (isRoleFullySelected(roleId)) {
    for (const m of list) next.delete(m.id)
  } else {
    for (const m of list) next.add(m.id)
  }
  selectedMemberIds.value = next
}

function toggleAll() {
  selectedMemberIds.value = allSelected.value
    ? new Set()
    : new Set(activeMembers.value.map((m) => m.id))
}

function toggleMember(id: string) {
  const next = new Set(selectedMemberIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedMemberIds.value = next
}

// Отмена тонкой настройки — возврат к дефолту «весь актив»
function cancelParticipantsEdit() {
  participantsExpanded.value = false
  selectedMemberIds.value = new Set(activeMembers.value.map((m) => m.id))
}

function openCreate() {
  form.value = { sourceId: null, name: '', date: '', description: '', status: 'draft', level: null, type: null, format: null, stages: [] }
  templateBase = null
  sourceFilters.type = ''
  sourceFilters.level = ''
  selectedOrganizer.value = null
  organizerSearch.value = ''
  organizerOptions.value = []
  selectedLocation.value = null
  locationSearch.value = ''
  locationOptions.value = []
  sourceSearch.value = ''
  sourceDropdownOpen.value = false
  sourceFilterOpen.value = false
  statusTouched.value = false
  planMode.value = 'time'
  startTime.value = ''
  participantsExpanded.value = false
  selectedMemberIds.value = new Set(activeMembers.value.map((m) => m.id))
  showCreateModal.value = true
}

async function onSourceSelected(id: string | null) {
  form.value.sourceId = id
  const template = templates.value.find((t) => t.id === id)
  if (!template) {
    templateBase = null
    form.value.stages = []
    return
  }
  // С шаблона переносятся все поля, кроме даты (включая стадии, организатора и локацию)
  form.value.name = template.name
  form.value.description = template.description || ''
  form.value.level = template.level ?? null
  form.value.type = template.type ?? null
  form.value.format = template.format ?? null
  if (template.organizer_id) {
    selectedOrganizer.value = { id: template.organizer_id, name: 'Организатор из шаблона' }
    try {
      const res = await listOrganizationsOrgV1OrganizationsGet({ limit: 100 })
      const found = (res.data.items as OrganizerOption[]).find((o) => o.id === template.organizer_id)
      if (found) selectedOrganizer.value = found
    } catch { /* имя организатора не критично */ }
  }
  if (template.location_id) {
    selectedLocation.value = { id: template.location_id, name: 'Локация из шаблона' }
    try {
      const loc = await getLocationsGeoV1LocationsGet({ limit: 100 })
      const found = (loc.data.items as LocationOption[]).find((o) => o.id === template.location_id)
      if (found) selectedLocation.value = found
    } catch { /* имя локации не критично */ }
  }
  // ТЗ: при копировании из шаблона без attendance тонкая настройка остаётся в дефолте
  participantsExpanded.value = false
  try {
    const res = await getEventStagesEventV1EventsEventIdStagesGet(template.id, { limit: 100 })
    const stages = res.data.items.map((s) => ({
      name: s.name, start_at: s.start_at, end_at: s.end_at, description: s.description,
    }))
    templateBase = { date: template.date ?? null, stages }
    form.value.stages = stages.map((s, idx) => ({
      name: s.name,
      start_at: toLocalInput(s.start_at),
      end_at: s.end_at ? toLocalInput(s.end_at) : '',
      description: s.description,
      fromTemplate: true,
      templateIdx: idx,
    }))
    // У шаблона есть этапы — открываем режим подробного плана
    planMode.value = form.value.stages.length ? 'stages' : 'time'
    if (form.value.date) recalcStages()
  } catch {
    templateBase = { date: template.date ?? null, stages: [] }
    form.value.stages = []
  }
  autoStatus()
}

// Локальная полночь из строки даты (yyyy-MM-dd[...]) — без сдвига часового пояса
function localMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ТЗ: к дате шаблона добавляется 00:00:00, дельта меток стадий относительно этой
// полуночи прибавляется к выбранной дате (тоже в полночь). Свои стадии не трогаем.
function recalcStages() {
  if (!templateBase || !form.value.date || !templateBase.date) return
  const offset = localMidnight(form.value.date).getTime() - localMidnight(templateBase.date).getTime()
  for (const stage of form.value.stages) {
    if (!stage.fromTemplate || stage.templateIdx == null) continue
    const base = templateBase.stages[stage.templateIdx]
    if (!base) continue
    stage.start_at = toLocalInput(new Date(new Date(base.start_at).getTime() + offset).toISOString())
    stage.end_at = base.end_at
      ? toLocalInput(new Date(new Date(base.end_at).getTime() + offset).toISOString())
      : ''
  }
}

function onDateChanged() {
  recalcStages()
  autoStatus()
}

function onStatusChanged(value: EventStatusEnumV1) {
  form.value.status = value
  statusTouched.value = true
}

// While the user hasn't touched the status selector, a fully filled form flips draft → active
function autoStatus() {
  if (statusTouched.value) return
  form.value.status = form.value.name && form.value.date ? 'active' : 'draft'
}

watch(() => [form.value.name, form.value.date, form.value.description], autoStatus)

async function submit() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  // Бизнес-правило: мероприятие не может быть active без даты
  if (!isJoinMode.value && form.value.status === 'active' && !form.value.date) {
    const toast = await toastController.create({
      message: 'Активное мероприятие должно иметь дату',
      duration: 3000,
      color: 'danger',
    })
    toast.present()
    return
  }
  creating.value = true
  try {
    if (isJoinMode.value && form.value.sourceId) {
      // Без тонкой настройки — null (берётся весь актив), иначе явный список
      await createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost(collectiveId, {
        event_id: form.value.sourceId,
        member_ids: participantsExpanded.value ? Array.from(selectedMemberIds.value) : null,
      })
    } else {
      // Режим «время» → один этап «Начало»; иначе — подробные этапы формы
      const stages = planMode.value === 'time'
        ? (startTime.value && form.value.date
            ? [{
                name: 'Начало',
                start_at: toTzIso(`${form.value.date}T${startTime.value}`),
                end_at: null,
                description: null,
              }]
            : [])
        : form.value.stages
            .filter((s) => s.name && s.start_at)
            .map((s) => ({
              name: s.name,
              start_at: toTzIso(s.start_at),
              end_at: s.end_at ? toTzIso(s.end_at) : null,
              description: s.description ?? null,
            }))
      // ТЗ: настройка не активирована → member_ids = null (None);
      // но для шаблона — именно пустой список, т.к. шаблон не имеет участников
      let memberIds: string[] | null
      if (participantsExpanded.value) {
        memberIds = Array.from(selectedMemberIds.value)
      } else {
        memberIds = form.value.status === 'template' ? [] : null
      }
      await createMyEventEventV1MeEventsPost({
        name: form.value.name,
        date: form.value.date || null,
        description: form.value.description || null,
        status: form.value.status,
        level: form.value.level,
        type: form.value.type,
        format: form.value.format ?? undefined,
        organizer_id: selectedOrganizer.value?.id ?? null,
        location_id: selectedLocation.value?.id ?? null,
        collective_id: collectiveId,
        member_ids: memberIds,
        stages: stages.length ? stages : null,
      })
    }
    showCreateModal.value = false
    await loadEvents(collectiveId)
    const toast = await toastController.create({ message: 'Успешно создано', duration: 2000, color: 'success' })
    toast.present()
  } catch (err: any) {
    const toast = await toastController.create({
      message: err?.response?.data?.detail || 'Ошибка при создании',
      duration: 3000,
      color: 'danger',
    })
    toast.present()
  } finally {
    creating.value = false
  }
}

async function loadEvents(collectiveId: string) {
  loading.value = true
  try {
    const [participationsResp, eventsResp] = await Promise.all([
      getParticipationsEventV1ParticipationsGet({ collective_id: collectiveId, limit: 100 }),
      getEventsEventV1EventsGet({ limit: 100, order_by: '-date' }),
    ])
    allEvents.value = eventsResp.data.items
    const eventIds = new Set(participationsResp.data.items.map((p) => p.event_id))
    events.value = allEvents.value.filter((e) => eventIds.has(e.id))
    // Шаблоном может быть только мероприятие-шаблон, в котором участвует выбранный коллектив
    templates.value = events.value.filter((e) => e.status === 'template')
  } catch (err) {
    console.error('Failed to load events', err)
  } finally {
    loading.value = false
  }
}

watch(() => principal.activePrincipalCollectiveId, async (collectiveId) => {
  if (!collectiveId) {
    events.value = []
    members.value = []
    roles.value = []
    return
  }
  loadEvents(collectiveId)
  try {
    const [membersResp, rolesResp] = await Promise.all([
      getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet(collectiveId, { limit: 100 }),
      getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet(collectiveId, { limit: 100 }),
    ])
    members.value = membersResp.data.items
    roles.value = rolesResp.data.items
    await Promise.all(membersResp.data.items.map(async (m) => {
      rememberMemberPerson(m.id, m.person_id)
      const name = await resolvePersonName(m.person_id)
      if (name) personNames[m.person_id] = name
    }))
  } catch (err) {
    console.error('Failed to load members/roles', err)
  }
}, { immediate: true })
</script>

<style scoped>
.page-body {
  padding-bottom: 32px;
}

.page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 20px;
  color: var(--ion-color-medium);
}

.page-state ion-icon {
  font-size: 40px;
  opacity: 0.4;
}

.page-state p {
  margin: 0;
  font-size: 14px;
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

.event-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
}

.event-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(108, 99, 255, 0.12);
}

.event-row-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-row-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-row-date {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.event-row-badge {
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 560px;
  margin: 0 auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field > label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(108, 99, 255, 0.12);
  color: var(--ion-color-primary);
}

.status-auto {
  --highlight-color: var(--ion-color-primary);
  border: 1.5px dashed rgba(108, 99, 255, 0.4);
  border-radius: 10px;
  padding-left: 8px;
}

.form-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.form-hint-warn {
  color: var(--ion-color-danger);
  font-weight: 600;
}

.native-input {
  width: 100%;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.native-input:focus {
  border-color: var(--ion-color-primary);
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.stage-edit {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ion-background-color);
}

.stage-edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage-name-input {
  flex: 1;
}

.stage-dash {
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

.stage-template-badge {
  position: absolute;
  top: -7px;
  right: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(108, 99, 255, 0.12);
  color: var(--ion-color-primary);
}

.row-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.row-icon-btn--danger:hover {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
  background: rgba(255, 71, 87, 0.06);
}

.add-stage-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px dashed var(--ion-border-color);
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.add-stage-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.organizer-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-background-color);
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-text-color);
}

.organizer-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
}

.organizer-clear:hover {
  color: var(--ion-color-danger);
}

.organizer-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.organizer-option {
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: var(--ion-text-color);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.organizer-option:hover {
  background: var(--ion-background-color);
}

.participants-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ion-background-color);
  font-size: 13px;
  color: var(--ion-color-medium);
}

.link-btn {
  border: none;
  background: none;
  color: var(--ion-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
}

.participants-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-search {
  padding: 0;
  --border-radius: 10px;
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
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
}

.member-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 6px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--ion-text-color);
  cursor: pointer;
}

.member-item:hover {
  background: var(--ion-background-color);
}

.member-item input {
  accent-color: var(--ion-color-primary);
}

.member-roles {
  margin-left: auto;
  font-size: 11px;
  color: var(--ion-color-step-400);
}

.inline-icon {
  vertical-align: -2px;
  margin-right: 4px;
  color: var(--ion-color-medium);
}

/* Source combobox */
.source-combo {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.source-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.source-input-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: var(--ion-color-medium);
  pointer-events: none;
}

.source-input {
  padding-left: 36px;
  padding-right: 44px;
  width: 100%;
}

.source-filter-btn {
  position: absolute;
  right: 6px;
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

.source-filter-btn:hover,
.source-filter-btn--active {
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
}

.source-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.source-filter-chip ion-icon {
  font-size: 14px;
}

.source-filter-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
}

.source-filter-select {
  height: 32px;
  padding: 0 8px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  outline: none;
}

.source-filter-select:focus {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.source-suggestions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 6px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--ion-card-background);
}

.source-suggestion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.source-suggestion:hover {
  background: var(--ion-background-color);
}

.source-suggestion-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.source-suggestion-icon--template {
  color: var(--ion-color-primary);
}

.source-suggestion-icon--event {
  color: var(--ion-color-secondary);
}

.source-suggestion-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-suggestion-kind {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

.source-suggestions-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.source-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 10px;
  background: rgba(108, 99, 255, 0.06);
  font-size: 14px;
  color: var(--ion-text-color);
}

.source-selected > ion-icon {
  font-size: 18px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.source-selected-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-selected-kind {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.source-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.source-clear:hover {
  color: var(--ion-color-danger);
}

.stage-desc-input {
  resize: vertical;
  min-height: 48px;
}

.participants-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.participants-editor-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
}
</style>
