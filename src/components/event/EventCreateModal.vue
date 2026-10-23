<template>
    <ion-modal :is-open="open" @ion-modal-did-dismiss="close">
      <ion-header>
        <ion-toolbar>
          <ion-title>Новое мероприятие</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="close">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="form">
          <div class="source-combo">
            <UiField v-if="form.sourceId" label="Шаблон или существующее мероприятие" float>
              <template #prefix><ion-icon :icon="isJoinMode ? calendarOutline : copyOutline" /></template>
              <span class="ui-field-value">
                <span class="source-selected-name">{{ selectedSourceLabel }}</span>
                <span class="source-selected-kind">{{ isJoinMode ? 'мероприятие' : 'шаблон' }}</span>
              </span>
              <template #suffix>
                <button type="button" class="ui-icon-btn ui-icon-btn--danger" aria-label="Сбросить" @click="clearSource">
                  <ion-icon :icon="closeOutline" />
                </button>
              </template>
            </UiField>

            <template v-else>
              <UiInput
                v-model="sourceSearch"
                label="Шаблон или существующее мероприятие"
                placeholder="Поиск шаблона или мероприятия…"
                autocomplete="off"
                @focus="onSourceFocus"
                @blur="onSourceBlur"
              >
                <template #prefix><ion-icon :icon="searchOutline" /></template>
                <template #suffix>
                  <button
                    type="button"
                    class="ui-icon-btn"
                    :class="{ 'ui-icon-btn--active': sourceFilterOpen }"
                    aria-label="Фильтры"
                    @click="sourceFilterOpen = !sourceFilterOpen"
                  >
                    <ion-icon :icon="optionsOutline" />
                  </button>
                </template>
              </UiInput>

              <div v-if="sourceFilterOpen" class="source-filters">
                <button
                  type="button"
                  class="ui-chip source-filter-chip"
                  :class="{ 'ui-chip--active': sourceFilters.templates }"
                  @click="sourceFilters.templates = !sourceFilters.templates"
                >
                  <ion-icon :icon="copyOutline" />
                  Шаблоны
                </button>
                <button
                  type="button"
                  class="ui-chip source-filter-chip"
                  :class="{ 'ui-chip--active': sourceFilters.events }"
                  @click="sourceFilters.events = !sourceFilters.events"
                >
                  <ion-icon :icon="calendarOutline" />
                  Мероприятия
                </button>
                <UiSelectPill v-model="sourceFilters.type" size="sm" :options="TYPE_FILTER_OPTIONS" aria-label="Тип" />
                <UiSelectPill v-model="sourceFilters.level" size="sm" :options="LEVEL_FILTER_OPTIONS" aria-label="Уровень" />
              </div>

              <div v-if="sourceDropdownOpen" class="ui-menu">
                <button
                  v-for="item in sourceSuggestions"
                  :key="item.id"
                  type="button"
                  class="ui-menu-item"
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
                <div v-if="sourcesLoading && sourceSuggestions.length === 0" class="source-suggestions-skeleton" aria-busy="true">
                  <span v-for="n in 3" :key="n" class="skeleton skeleton--text" :style="{ width: `${80 - n * 14}%` }" />
                </div>
                <p v-else-if="sourceSuggestions.length === 0" class="source-suggestions-empty">
                  Ничего не найдено
                </p>
              </div>
            </template>

            <p v-if="isJoinMode" class="form-hint">
              Коллектив присоединится к существующему мероприятию: укажите только участников.
            </p>
          </div>

          <template v-if="!isJoinMode">
            <UiInput v-model="form.name" label="Название" :maxlength="EVENT_NAME_MAX" counter />

            <DateTimeField
              v-model="form.date"
              mode="date"
              label="Дата"
              title="Дата мероприятия"
              aria-label="Дата мероприятия"
              @change="onDateChanged"
            />

            <UiTextarea v-model="form.description" label="Описание" :rows="3" :maxlength="EVENT_DESCRIPTION_MAX" counter />

            <EntityPickerField
              v-model:search="organizerSearch"
              label="Организатор"
              placeholder="Поиск организации…"
              clear-label="Убрать организатора"
              :options="organizerOptions"
              :selected="selectedOrganizer"
              @search="searchOrganizers"
              @select="selectOrganizer"
              @clear="clearOrganizer"
            />

            <LocationField
              ref="locationFieldRef"
              v-model="selectedLocation"
              label="Локация"
              :collective-id="principal.activePrincipalCollectiveId"
            />

            <UiSelect
              :model-value="form.status"
              :label="statusTouched ? 'Статус' : 'Статус · авто'"
              :options="STATUS_OPTIONS"
              @update:model-value="onStatusChanged($event)"
            />

            <UiSelect v-model="form.type" label="Тип" placeholder="Не выбран" :options="TYPE_OPTIONS" />

            <UiSelect v-model="form.level" label="Уровень" placeholder="Не выбран" :options="LEVEL_OPTIONS" />

            <UiSelect v-model="form.format" label="Формат" placeholder="Не выбран" :options="FORMAT_OPTIONS" />

            <!-- План: либо одно время начала, либо подробные этапы -->
            <div class="form-field">
              <p class="ui-field-title">
                План мероприятия
                <HelpTip text="«Указать время» создаст один этап «Начало» с этим временем. «Расписать этапы» позволяет задать несколько этапов." />
              </p>
              <div class="ui-chips">
                <button
                  type="button"
                  class="ui-chip"
                  :class="{ 'ui-chip--active': planMode === 'time' }"
                  @click="setPlanMode('time')"
                >
                  Указать время
                </button>
                <button
                  type="button"
                  class="ui-chip"
                  :class="{ 'ui-chip--active': planMode === 'stages' }"
                  @click="setPlanMode('stages')"
                >
                  Расписать этапы
                </button>
              </div>

              <template v-if="planMode === 'time'">
                <DateTimeField v-model="startTime" mode="time" label="Время начала" />
                <p v-if="startTime && !form.date" class="form-hint form-hint-warn">Сначала укажите дату мероприятия.</p>
              </template>
            </div>

            <!-- Этапы: из шаблона (даты пересчитываются со смещением) + свои -->
            <div v-if="planMode === 'stages'" class="form-field">
              <div v-if="form.stages.length" class="stage-list">
                <StageFields
                  v-for="(s, i) in form.stages"
                  :key="i"
                  v-model="form.stages[i]"
                  :start-suggestion="stageStartSuggestion(i)"
                  :auto-name="stageAutoNameList[i]"
                  @remove="removeStage(i)"
                >
                  <span v-if="s.fromTemplate" class="stage-template-badge">из шаблона</span>
                </StageFields>
              </div>
              <button class="add-stage-btn" @click="addStage">
                <ion-icon :icon="addOutline" />
                Добавить этап
              </button>
            </div>
          </template>

          <!-- Declared participants -->
          <div class="form-field">
            <p class="ui-field-title">Заявленные участники</p>
            <div v-if="membersLoading" class="participants-summary" aria-busy="true">
              <span class="skeleton skeleton--text participants-skel" />
            </div>
            <div v-else-if="!participantsExpanded" class="participants-summary">
              <span>Заявлены все {{ activeMembers.length }} активных участников коллектива</span>
              <button class="link-btn" @click="participantsExpanded = true">Настроить</button>
            </div>
            <div v-else class="participants-editor">
              <div class="participants-editor-head">
                <span class="participants-editor-title">Состав</span>
                <button class="link-btn" @click="cancelParticipantsEdit">Отменить</button>
              </div>
              <ion-searchbar v-model="memberSearch" placeholder="Поиск участника..." class="member-search" />
              <div class="ui-chips">
                <button
                  class="ui-chip"
                  :class="{ 'ui-chip--active': allSelected }"
                  @click="toggleAll"
                >
                  Все
                </button>
                <button
                  v-for="r in roles"
                  :key="r.id"
                  class="ui-chip"
                  :class="{ 'ui-chip--active': isRoleFullySelected(r.id) }"
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

          <ion-button expand="block" :disabled="creating || (!isJoinMode && !form.name) || hasStageTimeError" @click="submit">
            {{ isJoinMode ? 'Создать участие' : 'Создать мероприятие' }}
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import {
  IonHeader, IonToolbar, IonButtons, IonTitle, IonContent,
  IonButton, IonIcon, IonModal, IonSearchbar,
} from '@ionic/vue'
import {
  addOutline, calendarOutline, closeOutline,
  optionsOutline, copyOutline, searchOutline,
} from 'ionicons/icons'
import { format as fnsFormat } from 'date-fns'
import { listOrganizationsOrgV1OrganizationsGet } from '@/api/generated/almaEventFlow'
import { getLocationGeoV1LocationsLocationIdGet } from '@/api/generated/almaEventFlow'
import { usePrincipalStore } from '@/stores/principal'
import { useToast } from '@/composables/useToast'
import { useEntityPicker } from '@/composables/useEntityPicker'
import LocationField from '@/components/geo/LocationField.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import HelpTip from '@/components/common/HelpTip.vue'
import StageFields from '@/components/event/StageFields.vue'
import UiField from '@/components/common/UiField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import UiSelectPill from '@/components/common/UiSelectPill.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import { levelOptions, typeOptions, formatOptions } from '@/utils/eventLabels'
import { optionsFromPairs, withAny, type SelectOption } from '@/utils/selectOptions'
import {
  getFeedEventV2FeedGet,
  getMyCollectiveTemplatesEventV1MeCollectivesCollectiveIdTemplatesGet,
  getEventStagesEventV1EventsEventIdStagesGet,
  getCollectiveRosterEventV2CollectivesCollectiveIdRosterGet,
  createMyEventEventV1MeEventsPost,
  createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost,
} from '@/api/generated/almaEventFlow'
import { formatPersonName } from '@/utils/names'
import { stageAutoNames, stageEffectiveNames, stageEndBeforeStart } from '@/utils/stages'
import type { EventRead, EventCard, EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1, RosterMember, RoleRead, LocationRead } from '@/api/generated/almaEventFlow'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created'): void
}>()

const STATUS_OPTIONS: SelectOption<EventStatusEnumV1>[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'active', label: 'Активно' },
  { value: 'template', label: 'Шаблон' },
]
const TYPE_OPTIONS = withAny<EventTypeEnumV1 | null>(optionsFromPairs(typeOptions), null, 'Не выбран')
const LEVEL_OPTIONS = withAny<EventLevelEnumV1 | null>(optionsFromPairs(levelOptions), null, 'Не выбран')
const FORMAT_OPTIONS = withAny<EventFormatEnumV1 | null>(optionsFromPairs(formatOptions), null, 'Не выбран')
const TYPE_FILTER_OPTIONS = withAny<'' | EventTypeEnumV1>(optionsFromPairs(typeOptions), '', 'Любой тип')
const LEVEL_FILTER_OPTIONS = withAny<'' | EventLevelEnumV1>(optionsFromPairs(levelOptions), '', 'Любой уровень')

const EVENT_NAME_MAX = 128
const EVENT_DESCRIPTION_MAX = 1024

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
const { showSuccess, showError } = useToast()

const templates = ref<EventRead[]>([])
const upcomingEvents = ref<EventCard[]>([])
const members = ref<RosterMember[]>([])
const roles = ref<RoleRead[]>([])
const sourcesLoading = ref(false)
const membersLoading = ref(false)
const creating = ref(false)

const statusTouched = ref(false)
// План мероприятия: 'time' — одно время начала (этап «Начало»), 'stages' — подробные этапы
const planMode = ref<'time' | 'stages'>('time')
const startTime = ref('')
const participantsExpanded = ref(false)
const memberSearch = ref('')
const selectedMemberIds = ref<Set<string>>(new Set())

const form = ref({
  sourceId: null as string | null,
  templateId: null as string | null,
  name: '',
  date: '',
  description: '',
  status: 'draft' as EventStatusEnumV1,
  level: null as EventLevelEnumV1 | null,
  type: null as EventTypeEnumV1 | null,
  format: null as EventFormatEnumV1 | null,
  stages: [] as StageForm[],
})

// Организатор — поиск по справочнику (общий useEntityPicker).
type OrganizerOption = { id: string; name: string }

const {
  search: organizerSearch, options: organizerOptions, selected: selectedOrganizer,
  runSearch: searchOrganizers, select: selectOrganizer, clear: clearOrganizer,
  reset: resetOrganizer,
} = useEntityPicker((params) => listOrganizationsOrgV1OrganizationsGet(params))

// Локация — единое поле поиска (локации + адреса) с картой, см. LocationField.
const locationFieldRef = ref<InstanceType<typeof LocationField>>()
const selectedLocation = ref<LocationRead | null>(null)

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

function stageStartSuggestion(index: number): string {
  const prev = form.value.stages[index - 1]
  return prev?.end_at || prev?.start_at || form.value.date || ''
}

function addStage() {
  const prev = form.value.stages[form.value.stages.length - 1]
  form.value.stages.push({
    name: '',
    start_at: prev?.end_at ?? '',
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

const stageAutoNameList = computed(() => stageAutoNames(form.value.stages))

const hasStageTimeError = computed(() =>
  planMode.value === 'stages' && form.value.stages.some(stageEndBeforeStart),
)
// Original stage timestamps + template date for relative offset recalculation
let templateBase: { date: string | null; stages: Array<{ name: string; start_at: string; end_at?: string | null; description?: string | null }> } | null = null

const isJoinMode = computed(() =>
  !!form.value.sourceId && !templates.value.some((t) => t.id === form.value.sourceId),
)

// Активные мероприятия, в которых коллектив ещё не участвует
const joinableEvents = computed(() =>
  upcomingEvents.value.filter(
    (e) => !e.participations.some((p) => p.collective_id === principal.activePrincipalCollectiveId),
  ),
)

const activeMembers = computed(() => members.value.filter((m) => m.is_active !== false))

function memberName(m: RosterMember): string {
  return formatPersonName(m.person)
}

const filteredMembers = computed(() => {
  if (!memberSearch.value) return activeMembers.value
  const q = memberSearch.value.toLowerCase()
  return activeMembers.value.filter((m) => memberName(m).toLowerCase().includes(q))
})

const allSelected = computed(() =>
  activeMembers.value.length > 0 && activeMembers.value.every((m) => selectedMemberIds.value.has(m.id)),
)

function membersOfRole(roleId: string): RosterMember[] {
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

function resetForm() {
  form.value = { sourceId: null, templateId: null, name: '', date: '', description: '', status: 'draft', level: null, type: null, format: null, stages: [] }
  templateBase = null
  sourceFilters.type = ''
  sourceFilters.level = ''
  resetOrganizer()
  locationFieldRef.value?.reset()
  selectedLocation.value = null
  sourceSearch.value = ''
  sourceDropdownOpen.value = false
  sourceFilterOpen.value = false
  statusTouched.value = false
  planMode.value = 'time'
  startTime.value = ''
  participantsExpanded.value = false
  memberSearch.value = ''
  selectedMemberIds.value = new Set(activeMembers.value.map((m) => m.id))
}

function close() {
  emit('update:open', false)
}

async function onSourceSelected(id: string | null) {
  form.value.sourceId = id
  const template = templates.value.find((t) => t.id === id)
  if (!template) {
    form.value.templateId = null
    templateBase = null
    form.value.stages = []
    return
  }
  // Поля (включая организатора и локацию) копирует backend по template_id --
  // здесь они лишь предзаполняются в форме, чтобы их можно было посмотреть и
  // поправить перед созданием. Этапы backend не копирует принципиально
  // (шаблон — не расписание), их пересчёт остаётся на клиенте, ниже.
  form.value.templateId = template.id
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
  } else {
    clearOrganizer()
  }
  if (template.location_id) {
    try {
      const loc = await getLocationGeoV1LocationsLocationIdGet(template.location_id)
      selectedLocation.value = loc.data
    } catch { /* локация не критична для предпросмотра */ }
  } else {
    locationFieldRef.value?.reset()
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
    showError(null, 'Активное мероприятие должно иметь дату')
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
      const stageNames = stageEffectiveNames(form.value.stages)
      const stages = planMode.value === 'time'
        ? (startTime.value && form.value.date
            ? [{
                name: 'Начало',
                start_at: toTzIso(`${form.value.date}T${startTime.value}`),
                end_at: null,
                description: null,
              }]
            : [])
        : form.value.stages.flatMap((s, i) =>
            stageNames[i] && s.start_at
              ? [{
                  name: stageNames[i],
                  start_at: toTzIso(s.start_at),
                  end_at: s.end_at ? toTzIso(s.end_at) : null,
                  description: s.description ?? null,
                }]
              : [],
          )
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
        template_id: form.value.templateId,
        collective_id: collectiveId,
        member_ids: memberIds,
        stages: stages.length ? stages : null,
      })
    }
    close()
    emit('created')
    showSuccess('Успешно создано')
  } catch (err) {
    showError(err, 'Ошибка при создании')
  } finally {
    creating.value = false
  }
}

async function loadSources(collectiveId: string) {
  sourcesLoading.value = true
  try {
    const [templatesResp, feedResp] = await Promise.all([
      getMyCollectiveTemplatesEventV1MeCollectivesCollectiveIdTemplatesGet(collectiveId),
      getFeedEventV2FeedGet({
        direction: 'future', anchor: fnsFormat(new Date(), 'yyyy-MM-dd'), status: ['active'], limit: 50,
      }),
    ])
    templates.value = templatesResp.data
    upcomingEvents.value = feedResp.data.items
  } catch (err) {
    console.error('Failed to load event sources', err)
  } finally {
    sourcesLoading.value = false
  }
}

async function loadMembers(collectiveId: string) {
  membersLoading.value = true
  try {
    const { data } = await getCollectiveRosterEventV2CollectivesCollectiveIdRosterGet(collectiveId)
    members.value = data.members
    roles.value = data.roles
    if (!participantsExpanded.value) selectedMemberIds.value = new Set(activeMembers.value.map((m) => m.id))
  } catch (err) {
    console.error('Failed to load members/roles', err)
  } finally {
    membersLoading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  resetForm()
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  loadSources(collectiveId)
  loadMembers(collectiveId)
})
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
  margin: 0 auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-hint {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.form-hint-warn {
  color: var(--ion-color-danger);
  font-weight: var(--fw-semibold);
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.stage-template-badge {
  position: absolute;
  top: -7px;
  right: 12px;
  font-size: var(--fs-2xs);
  font-weight: var(--fw-bold);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.add-stage-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: var(--border-w) dashed var(--ion-border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.add-stage-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.participants-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ion-background-color);
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.link-btn {
  border: none;
  background: none;
  color: var(--ion-color-primary);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  cursor: pointer;
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
  font-size: var(--fs-sm);
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
  font-size: var(--fs-2xs);
  color: var(--ion-color-step-400);
}

/* Source combobox */
.source-combo {
  position: relative;
  display: flex;
  flex-direction: column;
}

.source-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.source-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.source-filter-chip ion-icon {
  font-size: var(--fs-md);
}

.source-suggestion-icon {
  font-size: var(--fs-xl);
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
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

.source-suggestions-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px;
}

.participants-skel {
  width: 60%;
}

.source-suggestions-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.source-selected-name {
  flex: 1;
  min-width: 0;
  font-weight: var(--fw-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-selected-kind {
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.participants-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.participants-editor-title {
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
}
</style>
