<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>{{ event?.name || 'Мероприятие' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="page-state">
        <div class="loading-spinner" />
      </div>

      <div v-else-if="event" class="detail-page">
        <div class="detail-layout">
          <!-- Main info + stages -->
          <div class="detail-info">
            <div class="info-card">
              <div class="info-card-top">
                <h2>{{ event.name }}</h2>
                <div class="info-card-actions">
                  <span v-if="principal.isPrincipal" class="status-badge" :style="{ color: statusColor, background: statusColor + '1A' }">
                    {{ statusLabel }}
                  </span>
                  <button v-if="editableCollectiveId" class="edit-btn" title="Редактировать мероприятие" @click="openEdit">
                    <ion-icon :icon="createOutline" />
                  </button>
                </div>
              </div>
              <div class="info-meta">
                <span class="info-meta-item">
                  <ion-icon :icon="calendarOutline" />
                  {{ event.date ? formatDate(event.date, settings.dateFormat) : 'Дата не назначена' }}
                </span>
                <span v-if="eventTime" class="info-meta-item">
                  <ion-icon :icon="timeOutline" />
                  {{ eventTime }}
                </span>
                <UuidBadge :id="event.id" />
              </div>
              <p class="info-description">{{ event.description || 'Нет описания' }}</p>
            </div>

            <div class="info-card">
              <div class="card-head">
                <h3 class="card-title">Этапы</h3>
                <button v-if="editableCollectiveId" class="link-btn" @click="openStages">
                  <ion-icon :icon="createOutline" /> Редактировать
                </button>
              </div>
              <p v-if="stages.length === 0" class="card-empty">Этапы не добавлены</p>
              <div v-else class="stage-timeline">
                <div v-for="(s, i) in stages" :key="s.id" class="stage-row">
                  <div class="stage-marker">
                    <span class="stage-dot" />
                    <span v-if="i < stages.length - 1" class="stage-line" />
                  </div>
                  <div class="stage-body">
                    <span class="stage-name">{{ s.name }}</span>
                    <span class="stage-time">
                      {{ formatDate(s.start_at, settings.dateFormat) }} {{ formatTime(s.start_at) }}
                      <template v-if="s.end_at"> — {{ formatTime(s.end_at) }}</template>
                    </span>
                    <p v-if="s.description" class="stage-desc">{{ s.description }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Participating collectives -->
          <div class="detail-collectives">
            <h3 class="section-title">Коллективы-участники</h3>
            <p v-if="participationItems.length === 0" class="card-empty">Пока нет участвующих коллективов</p>

            <div v-for="p in participationItems" :key="p.participationId" class="collective-card">
              <div class="collective-card-header">
                <div class="collective-card-title">
                  <span class="collective-dot" :style="{ background: getCollectiveColor(p.collectiveId) }" />
                  <span class="collective-name">{{ p.collectiveName }}</span>
                </div>
                <div class="collective-card-head-right">
                  <span v-if="p.attendances.length" class="collective-counter">
                    {{ p.attendances.filter((a) => a.is_attended).length }}/{{ p.attendances.length }}
                  </span>
                  <button
                    v-if="p.isPrincipal"
                    class="row-icon-btn row-icon-btn--danger"
                    title="Отменить участие"
                    @click="cancelParticipation(p)"
                  >
                    <ion-icon :icon="exitOutline" />
                  </button>
                </div>
              </div>

              <!-- Own attendance pinned for quick access -->
              <div v-if="p.myAttendance" class="my-attendance">
                <span class="my-attendance-label">Моя отметка</span>
                <div class="my-attendance-chips">
                  <EventAttendanceChip
                    :is-attended="p.myAttendance.is_attended"
                    :edited-at="p.myAttendance.edited_at"
                    :verified="p.myAttendance.is_verified"
                    :attendance-id="p.myAttendance.id"
                    @toggle="(v) => toggleAttendance(p, p.myAttendance!, v)"
                  />
                  <EventCommentChip
                    :comment="p.myAttendance.comment"
                    :verified="p.myAttendance.is_verified"
                    @save="(c) => saveComment(p, p.myAttendance!, c)"
                    @delete="deleteComment(p, p.myAttendance!)"
                  />
                </div>
              </div>

              <template v-if="p.canExpand">
                <button class="expand-btn" @click="expanded[p.participationId] = !expanded[p.participationId]">
                  <ion-icon :icon="expanded[p.participationId] ? chevronUpOutline : chevronDownOutline" />
                  {{ expanded[p.participationId] ? 'Скрыть присутствия' : `Присутствия (${p.attendances.length})` }}
                </button>

                <div v-if="expanded[p.participationId]" class="attendance-list">
                  <template v-for="g in attendanceGroups(p)" :key="g.key">
                  <div v-if="g.label" class="attendance-divider">{{ g.label }}</div>
                  <div v-for="a in g.items" :key="a.id" class="attendance-row">
                    <span class="attendance-member">{{ memberLabel(a.member_id) }}</span>
                    <div class="attendance-row-chips">
                      <EventAttendanceChip
                        :is-attended="a.is_attended"
                        :edited-at="a.edited_at"
                        :verified="a.is_verified || (!p.isPrincipal && a.id !== p.myAttendance?.id)"
                        :own="a.id === p.myAttendance?.id"
                        :attendance-id="a.id"
                        @toggle="(v) => toggleAttendance(p, a, v)"
                      />
                      <EventCommentChip
                        v-if="p.isPrincipal && (a.comment || !a.is_verified)"
                        :comment="a.comment"
                        :verified="a.is_verified"
                        @save="(c) => saveComment(p, a, c)"
                        @delete="deleteComment(p, a)"
                      />
                      <template v-if="p.isPrincipal">
                        <button
                          class="row-icon-btn"
                          :class="{ 'row-icon-btn--verified': a.is_verified }"
                          :title="a.is_verified ? 'Снять заверение' : 'Заверить'"
                          :disabled="pending.size > 0"
                          @click="toggleVerify(p, a)"
                        >
                          <span v-if="pending.has(`verify:${a.id}`)" class="btn-spinner" />
                          <ion-icon v-else :icon="a.is_verified ? shieldCheckmark : shieldOutline" />
                        </button>
                        <button class="row-icon-btn row-icon-btn--danger" title="Удалить отметку" @click="removeAttendance(p, a)">
                          <ion-icon :icon="trashOutline" />
                        </button>
                      </template>
                    </div>
                  </div>
                  </template>

                  <!-- Добавление attendance участнику без отметки -->
                  <div v-if="p.isPrincipal && availableMembers(p).length" class="add-attendance">
                    <select v-model="addMemberSel[p.participationId]" class="add-attendance-select">
                      <option value="" disabled>Добавить участника...</option>
                      <option v-for="m in availableMembers(p)" :key="m.id" :value="m.id">
                        {{ memberLabel(m.id) }}
                      </option>
                    </select>
                    <ion-button size="small" :disabled="!addMemberSel[p.participationId]" @click="addAttendance(p)">
                      <ion-icon slot="icon-only" :icon="addOutline" />
                    </ion-button>
                  </div>

                  <ion-button
                    v-if="p.isPrincipal && p.attendances.some((a) => !a.is_verified)"
                    size="small"
                    fill="outline"
                    @click="verifyAll(p)"
                  >
                    <ion-icon slot="start" :icon="shieldCheckmarkOutline" />
                    Заверить все
                  </ion-button>
                </div>
              </template>
            </div>

            <!-- Principal of an outside collective can join the event -->
            <ion-button
              v-if="joinableCollectives.length > 0"
              expand="block"
              fill="outline"
              class="join-btn"
              @click="openJoinModal"
            >
              <ion-icon slot="start" :icon="addOutline" />
              Создать участие своего коллектива
            </ion-button>
          </div>
        </div>
      </div>

      <div v-else class="page-state">
        <ion-icon :icon="alertCircleOutline" />
        <p>Мероприятие не найдено</p>
      </div>

      <!-- Edit event modal — доступно руководителю участвующего коллектива -->
      <ion-modal :is-open="showEditModal" @ion-modal-did-dismiss="showEditModal = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Редактирование</ion-title>
            <ion-buttons slot="end">
              <ion-button aria-label="Закрыть" @click="showEditModal = false">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="form">
            <div class="form-field">
              <label>Название</label>
              <ion-input v-model="editForm.name" placeholder="Название мероприятия" />
            </div>

            <div class="form-field">
              <label>Дата</label>
              <input v-model="editForm.date" type="date" class="native-input" />
            </div>

            <div class="form-field">
              <label>Описание</label>
              <ion-textarea v-model="editForm.description" :rows="3" placeholder="Описание мероприятия" />
            </div>

            <div class="form-field">
              <label>Организатор</label>
              <div v-if="selectedOrganizer" class="chip-selected">
                <span>{{ selectedOrganizer.name }}</span>
                <button class="chip-clear" aria-label="Убрать организатора" @click="selectedOrganizer = null">
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
                <div v-if="organizerOptions.length" class="combo-options">
                  <button v-for="o in organizerOptions" :key="o.id" class="combo-option" @click="selectOrganizer(o)">
                    {{ o.name }}
                  </button>
                </div>
              </template>
            </div>

            <div class="form-field">
              <label>Локация</label>
              <div v-if="selectedLocation" class="chip-selected">
                <span><ion-icon class="inline-icon" :icon="locationOutline" /> {{ selectedLocation.name }}</span>
                <button class="chip-clear" aria-label="Убрать локацию" @click="selectedLocation = null">
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
                <div v-if="locationOptions.length" class="combo-options">
                  <button v-for="l in locationOptions" :key="l.id" class="combo-option" @click="selectLocation(l)">
                    {{ l.name }}
                  </button>
                </div>
              </template>
            </div>

            <div class="form-field">
              <label>Статус</label>
              <ion-select v-model="editForm.status" interface="popover">
                <ion-select-option v-for="[v, l] in statusOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <div class="form-field">
              <label>Тип</label>
              <ion-select v-model="editForm.type" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in typeOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <div class="form-field">
              <label>Уровень</label>
              <ion-select v-model="editForm.level" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in levelOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <div class="form-field">
              <label>Формат</label>
              <ion-select v-model="editForm.format" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in formatOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <ion-button expand="block" :disabled="saving || !editForm.name" @click="submitEdit">
              {{ saving ? 'Сохранение...' : 'Сохранить' }}
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Stages editor — добавление/изменение/удаление этапов -->
      <ion-modal :is-open="showStagesModal" @ion-modal-did-dismiss="showStagesModal = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Этапы мероприятия</ion-title>
            <ion-buttons slot="end">
              <ion-button aria-label="Закрыть" @click="showStagesModal = false">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="form">
            <p v-if="stageForms.length === 0" class="card-empty">Этапов пока нет — добавьте первый.</p>
            <div v-for="(s, i) in stageForms" :key="s.id ?? `new-${i}`" class="stage-edit">
              <div class="stage-edit-row">
                <input v-model="s.name" type="text" class="native-input stage-name-input" placeholder="Название этапа" />
                <button class="row-icon-btn row-icon-btn--danger" title="Удалить этап" @click="deleteStage(i)">
                  <ion-icon :icon="trashOutline" />
                </button>
              </div>
              <div class="stage-edit-row">
                <input v-model="s.start_at" type="datetime-local" class="native-input" />
                <span class="stage-dash">—</span>
                <input v-model="s.end_at" type="datetime-local" class="native-input" placeholder="Окончание" />
              </div>
              <textarea
                v-model="s.description"
                class="native-input stage-desc-input"
                rows="2"
                placeholder="Описание этапа (необязательно)"
              />
              <ion-button
                size="small"
                expand="block"
                :disabled="stagePending || !s.name || !s.start_at"
                @click="saveStage(i)"
              >
                {{ s.id ? 'Сохранить этап' : 'Добавить этап' }}
              </ion-button>
            </div>
            <button class="add-stage-btn" @click="addStageRow">
              <ion-icon :icon="addOutline" />
              Добавить этап
            </button>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Создание участия — модальное окно с заполненным мероприятием -->
      <ion-modal :is-open="showJoinModal" @ion-modal-did-dismiss="showJoinModal = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Участие в мероприятии</ion-title>
            <ion-buttons slot="end">
              <ion-button aria-label="Закрыть" @click="showJoinModal = false">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="form">
            <div class="form-field">
              <label>Мероприятие</label>
              <p class="form-static">{{ event?.name }}</p>
              <p v-if="event?.date" class="form-hint">
                {{ formatDate(event.date, settings.dateFormat) }}
              </p>
            </div>

            <div class="form-field">
              <label>Коллектив</label>
              <ion-select
                v-if="joinableCollectives.length > 1"
                v-model="joinForm.collectiveId"
                interface="popover"
                placeholder="Выберите коллектив"
              >
                <ion-select-option v-for="c in joinableCollectives" :key="c.id" :value="c.id">
                  {{ c.name }}
                </ion-select-option>
              </ion-select>
              <p v-else class="form-static">{{ joinableCollectives[0]?.name }}</p>
            </div>

            <div class="form-field">
              <label>Приоритет</label>
              <ion-select v-model="joinForm.priority" placeholder="Не выбран" interface="popover">
                <ion-select-option v-for="[v, l] in priorityOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </ion-select>
            </div>

            <ion-button expand="block" :disabled="joining || !joinForm.collectiveId" @click="submitJoin">
              {{ joining ? 'Создание...' : 'Создать участие' }}
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonButton, IonIcon, IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonSearchbar, toastController,
} from '@ionic/vue'
import {
  calendarOutline, timeOutline, chevronDownOutline, chevronUpOutline,
  shieldCheckmarkOutline, shieldCheckmark, shieldOutline, trashOutline,
  addOutline, alertCircleOutline, createOutline, closeOutline, locationOutline, exitOutline,
} from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { usePlatform } from '@/composables/usePlatform'
import { confirmAction } from '@/utils/confirm'
import { formatDate, formatTime } from '@/utils/date'
import { getCollectiveColor } from '@/utils/colors'
import {
  getEventEventV1EventsEventIdGet,
  getEventStagesEventV1EventsEventIdStagesGet,
  getParticipationsEventV1ParticipationsGet,
  getAttendancesEventV1AttendancesGet,
  getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet,
  patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch,
  patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch,
  createMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendancePost,
  deleteMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdDelete,
  verifyMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendanceVerifyPost,
  createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost,
  cancelMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsEventIdDelete,
  patchMyCollectiveEventEventV1MeCollectivesCollectiveIdEventsEventIdPatch,
  createMyCollectiveEventStageEventV1MeCollectivesCollectiveIdEventsEventIdStagesPost,
  patchMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdPatch,
  deleteMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdDelete,
  listOrganizationsOrgV1OrganizationsGet,
  getLocationsGeoV1LocationsGet,
} from '@/api/generated/almaEventFlow'
import { format as fnsFormat } from 'date-fns'
import { resolveMemberName, rememberMemberPerson, shortId, shortenName } from '@/utils/names'
import { loadStoredRoleOrder, loadSortMode } from '@/utils/roleSort'
import UuidBadge from '@/components/common/UuidBadge.vue'
import EventAttendanceChip from '@/components/event/EventAttendanceChip.vue'
import EventCommentChip from '@/components/event/EventCommentChip.vue'
import { EventPriorityEnumV1 } from '@/api/generated/almaEventFlow'
import type {
  EventRead, EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1,
  StageRead, AttendanceRead, MemberRead,
} from '@/api/generated/almaEventFlow'

interface ParticipationItem {
  participationId: string
  collectiveId: string
  collectiveName: string
  attendances: AttendanceRead[]
  myAttendance: AttendanceRead | null
  isPrincipal: boolean
  isMember: boolean
  canExpand: boolean
}

const route = useRoute()
const router = useRouter()
const principal = usePrincipalStore()
const settings = useSettingsStore()
const { withPending, pending } = useAttendancePending()
const { isDesktop } = usePlatform()

const eventId = route.params.id as string
const event = ref<EventRead | null>(null)
const stages = ref<StageRead[]>([])
const participationItems = ref<ParticipationItem[]>([])
const expanded = reactive<Record<string, boolean>>({})
const loading = ref(true)

const eventTime = computed(() => {
  const d = event.value?.date
  if (!d || !d.includes('T')) return ''
  const t = formatTime(d)
  return t === '00:00' ? '' : t
})

const statusColor = computed(() => {
  const map: Record<EventStatusEnumV1, string> = {
    draft: '#92949c', template: '#6C63FF', active: '#00D9A6', archived: '#FF4757',
  }
  return map[event.value?.status ?? 'draft']
})

const statusLabel = computed(() => {
  const map: Record<EventStatusEnumV1, string> = {
    draft: 'Черновик', template: 'Шаблон', active: 'Активно', archived: 'Архив',
  }
  return map[event.value?.status ?? 'draft']
})

// Principal's collectives that are not in the event yet
const joinableCollectives = computed(() =>
  principal.principalCollectives.filter(
    (c) => !participationItems.value.some((p) => p.collectiveId === c.id),
  ),
)

// Руководитель может редактировать мероприятие, если его коллектив в нём участвует.
// Бэкенд проверяет ту же связку (verify_collective_principal + ParticipationORM);
// здесь берём любой участвующий коллектив, где пользователь — руководитель.
const editableCollectiveId = computed(
  () => participationItems.value.find((p) => p.isPrincipal)?.collectiveId ?? null,
)

const statusLabels: Record<EventStatusEnumV1, string> = {
  draft: 'Черновик', active: 'Активно', template: 'Шаблон', archived: 'Архив',
}
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
const statusOptions = Object.entries(statusLabels) as [EventStatusEnumV1, string][]
const levelOptions = Object.entries(levelLabels) as [EventLevelEnumV1, string][]
const typeOptions = Object.entries(typeLabels) as [EventTypeEnumV1, string][]
const formatOptions = Object.entries(formatLabels) as [EventFormatEnumV1, string][]

// ---- Редактирование мероприятия ----
const showEditModal = ref(false)
const saving = ref(false)
const editForm = reactive({
  name: '',
  date: '',
  description: '',
  status: 'draft' as EventStatusEnumV1,
  level: null as EventLevelEnumV1 | null,
  type: null as EventTypeEnumV1 | null,
  format: null as EventFormatEnumV1 | null,
})

interface PickOption { id: string; name: string }
const organizerSearch = ref('')
const organizerOptions = ref<PickOption[]>([])
const selectedOrganizer = ref<PickOption | null>(null)
const locationSearch = ref('')
const locationOptions = ref<PickOption[]>([])
const selectedLocation = ref<PickOption | null>(null)

async function searchOrganizers() {
  if (!organizerSearch.value) { organizerOptions.value = []; return }
  try {
    const res = await listOrganizationsOrgV1OrganizationsGet({ search: organizerSearch.value, limit: 10 })
    organizerOptions.value = (res.data.items as PickOption[]) || []
  } catch { organizerOptions.value = [] }
}
function selectOrganizer(o: PickOption) {
  selectedOrganizer.value = o
  organizerSearch.value = ''
  organizerOptions.value = []
}
async function searchLocations() {
  if (!locationSearch.value) { locationOptions.value = []; return }
  try {
    const res = await getLocationsGeoV1LocationsGet({ search: locationSearch.value, limit: 10 })
    locationOptions.value = (res.data.items as PickOption[]) || []
  } catch { locationOptions.value = [] }
}
function selectLocation(l: PickOption) {
  selectedLocation.value = l
  locationSearch.value = ''
  locationOptions.value = []
}

async function openEdit() {
  const e = event.value
  if (!e) return
  editForm.name = e.name
  editForm.date = e.date ? e.date.slice(0, 10) : ''
  editForm.description = e.description || ''
  editForm.status = e.status ?? 'draft'
  editForm.level = e.level ?? null
  editForm.type = e.type ?? null
  editForm.format = e.format ?? null
  selectedOrganizer.value = e.organizer_id ? { id: e.organizer_id, name: 'Организатор' } : null
  selectedLocation.value = e.location_id ? { id: e.location_id, name: 'Локация' } : null
  organizerSearch.value = ''
  organizerOptions.value = []
  locationSearch.value = ''
  locationOptions.value = []
  showEditModal.value = true
  // Подтянуть человекочитаемые названия выбранных организатора/локации
  if (e.organizer_id) {
    try {
      const res = await listOrganizationsOrgV1OrganizationsGet({ limit: 100 })
      const found = (res.data.items as PickOption[]).find((o) => o.id === e.organizer_id)
      if (found) selectedOrganizer.value = found
    } catch { /* имя не критично */ }
  }
  if (e.location_id) {
    try {
      const res = await getLocationsGeoV1LocationsGet({ limit: 100 })
      const found = (res.data.items as PickOption[]).find((l) => l.id === e.location_id)
      if (found) selectedLocation.value = found
    } catch { /* имя не критично */ }
  }
}

async function submitEdit() {
  const collectiveId = editableCollectiveId.value
  if (!collectiveId || !editForm.name) return
  // Бизнес-правило: мероприятие не может быть active без даты
  if (editForm.status === 'active' && !editForm.date) {
    const toast = await toastController.create({
      message: 'Активное мероприятие должно иметь дату',
      duration: 3000,
      color: 'danger',
    })
    toast.present()
    return
  }
  saving.value = true
  try {
    const resp = await patchMyCollectiveEventEventV1MeCollectivesCollectiveIdEventsEventIdPatch(
      collectiveId, eventId, {
        name: editForm.name,
        date: editForm.date || null,
        description: editForm.description || null,
        status: editForm.status,
        level: editForm.level,
        type: editForm.type,
        format: editForm.format,
        organizer_id: selectedOrganizer.value?.id ?? null,
        location_id: selectedLocation.value?.id ?? null,
      },
    )
    event.value = resp.data
    showEditModal.value = false
    const toast = await toastController.create({ message: 'Мероприятие обновлено', duration: 2000, color: 'success' })
    toast.present()
  } catch (err) {
    showError(err, 'Не удалось сохранить изменения')
  } finally {
    saving.value = false
  }
}

// ---- Этапы мероприятия ----
function toLocalInput(iso: string): string {
  return fnsFormat(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}
function toTzIso(localInput: string): string {
  return fnsFormat(new Date(localInput), "yyyy-MM-dd'T'HH:mm:ssxxx")
}

interface StageForm { id?: string; name: string; start_at: string; end_at: string; description: string }
const showStagesModal = ref(false)
const stagePending = ref(false)
const stageForms = ref<StageForm[]>([])

function mapStagesToForms() {
  stageForms.value = stages.value.map((s) => ({
    id: s.id,
    name: s.name,
    start_at: s.start_at ? toLocalInput(s.start_at) : '',
    end_at: s.end_at ? toLocalInput(s.end_at) : '',
    description: s.description ?? '',
  }))
}

function openStages() {
  mapStagesToForms()
  showStagesModal.value = true
}

// Новый этап стартует там, где закончился предыдущий (или в дату мероприятия)
function addStageRow() {
  const prev = stageForms.value[stageForms.value.length - 1]
  let start = ''
  if (prev?.end_at) start = prev.end_at
  else if (prev?.start_at) start = `${prev.start_at.slice(0, 10)}T12:00`
  else if (event.value?.date) start = `${event.value.date.slice(0, 10)}T12:00`
  stageForms.value.push({ name: '', start_at: start, end_at: '', description: '' })
}

async function reloadStages() {
  try {
    const resp = await getEventStagesEventV1EventsEventIdStagesGet(eventId, { limit: 100, order_by: 'start_at' })
    stages.value = resp.data.items
  } catch { /* ignore */ }
}

async function saveStage(i: number) {
  const cid = editableCollectiveId.value
  const s = stageForms.value[i]
  if (!cid || !s.name || !s.start_at) return
  stagePending.value = true
  try {
    const body = {
      name: s.name,
      start_at: toTzIso(s.start_at),
      end_at: s.end_at ? toTzIso(s.end_at) : null,
      description: s.description || null,
    }
    if (s.id) {
      await patchMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdPatch(cid, s.id, body)
    } else {
      await createMyCollectiveEventStageEventV1MeCollectivesCollectiveIdEventsEventIdStagesPost(cid, eventId, body)
    }
    await reloadStages()
    mapStagesToForms()
    const toast = await toastController.create({ message: 'Этап сохранён', duration: 1500, color: 'success' })
    toast.present()
  } catch (err) {
    showError(err, 'Не удалось сохранить этап')
  } finally {
    stagePending.value = false
  }
}

async function deleteStage(i: number) {
  const s = stageForms.value[i]
  if (!s.id) { stageForms.value.splice(i, 1); return }
  const cid = editableCollectiveId.value
  if (!cid) return
  const ok = await confirmAction('Удалить этап?', `Этап «${s.name || 'без названия'}» будет удалён.`)
  if (!ok) return
  stagePending.value = true
  try {
    await deleteMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdDelete(cid, s.id)
    await reloadStages()
    mapStagesToForms()
  } catch (err) {
    showError(err, 'Не удалось удалить этап')
  } finally {
    stagePending.value = false
  }
}

// member_id → ФИО; пока имя не загрузилось, показываем сокращённый id
const memberNames = reactive<Record<string, string>>({})
// Участники коллективов руководителя (для добавления attendance)
const collectiveMembers = reactive<Record<string, MemberRead[]>>({})
const addMemberSel = reactive<Record<string, string>>({})

function availableMembers(p: ParticipationItem): MemberRead[] {
  const members = collectiveMembers[p.collectiveId] || []
  const withAttendance = new Set(p.attendances.map((a) => a.member_id))
  return members.filter((m) => m.is_active !== false && !withAttendance.has(m.id))
}

// Формат «Фамилия И.О.»
function memberLabel(memberId: string): string {
  const full = memberNames[memberId]
  return full ? shortenName(full) : `#${shortId(memberId)}`
}

// Группы отметок присутствия для отображения с разделителями по ролям.
// label=null — группа без подписи (алфавитный режим или участники без роли).
interface AttendanceGroup {
  key: string
  label: string | null
  items: AttendanceRead[]
}

// Сортировка/группировка отметок по тому же порядку ролей, что задан руководителем
// в панели (localStorage, отдельно на коллектив). Роли участников берём из загруженного
// списка членов коллектива — доступно для своих (principal) коллективов.
// В режиме «по ролям» каждый участник попадает только в свою высшую по приоритету роль;
// роли без участников (или чьи участники уже перечислены выше) разделитель не получают.
function attendanceGroups(p: ParticipationItem): AttendanceGroup[] {
  const byName = (a: AttendanceRead, b: AttendanceRead) =>
    memberLabel(a.member_id).localeCompare(memberLabel(b.member_id), 'ru')
  const flat = (): AttendanceGroup[] => [
    { key: 'all', label: null, items: p.attendances.slice().sort(byName) },
  ]

  const members = collectiveMembers[p.collectiveId]
  const order = loadStoredRoleOrder(p.collectiveId)
  if (loadSortMode(p.collectiveId) === 'alpha' || !members?.length || !order.length) {
    return flat()
  }

  const rolesByMember = new Map(members.map((m) => [m.id, m.roles.map((r) => r.id)]))
  const roleNames = new Map<string, string>()
  for (const m of members) for (const r of m.roles) roleNames.set(r.id, r.name)

  const byRole = new Map<string, AttendanceRead[]>()
  const noRole: AttendanceRead[] = []
  for (const a of p.attendances) {
    let bestIdx = Number.POSITIVE_INFINITY
    let bestRole: string | null = null
    for (const rid of rolesByMember.get(a.member_id) || []) {
      const idx = order.indexOf(rid)
      if (idx >= 0 && idx < bestIdx) { bestIdx = idx; bestRole = rid }
    }
    if (bestRole === null) noRole.push(a)
    else (byRole.get(bestRole) ?? byRole.set(bestRole, []).get(bestRole)!).push(a)
  }

  const groups: AttendanceGroup[] = []
  for (const rid of order) {
    const items = byRole.get(rid)
    if (items?.length) groups.push({ key: rid, label: roleNames.get(rid) || '—', items: items.sort(byName) })
  }
  if (noRole.length) groups.push({ key: '__none', label: null, items: noRole.sort(byName) })
  return groups
}

async function loadMemberNames(items: ParticipationItem[]) {
  // For own (principal) collectives the member list gives member→person mapping in one request
  await Promise.all(
    items
      .filter((p) => p.isPrincipal)
      .map(async (p) => {
        try {
          const resp = await getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet(p.collectiveId, { limit: 100 })
          collectiveMembers[p.collectiveId] = resp.data.items
          for (const m of resp.data.items) rememberMemberPerson(m.id, m.person_id)
        } catch { /* ignore */ }
      }),
  )
  const memberIds = new Set([
    ...items.flatMap((p) => p.attendances.map((a) => a.member_id)),
    ...Object.values(collectiveMembers).flat().map((m) => m.id),
  ])
  await Promise.all(
    Array.from(memberIds).map(async (id) => {
      const name = await resolveMemberName(id)
      if (name) memberNames[id] = name
    }),
  )
}

async function showError(err: any, fallback: string) {
  const toast = await toastController.create({
    message: err?.response?.data?.detail || fallback,
    duration: 3000,
    color: 'danger',
  })
  toast.present()
}

// Руководитель меняет attendance через эндпоинт своего коллектива, участник — только свою запись.
// Перезагрузка данных идёт внутри withPending — спиннер исчезает одновременно с обновлением чипа
async function patchAttendance(p: ParticipationItem, a: AttendanceRead, body: { is_attended?: boolean; comment?: string }) {
  await withPending(a.id, async () => {
    if (p.isPrincipal) {
      await patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch(p.collectiveId, a.id, body)
    } else {
      await patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch(a.member_id, a.id, body)
    }
    await loadParticipations()
  })
}

async function toggleAttendance(p: ParticipationItem, a: AttendanceRead, value: boolean) {
  try {
    await patchAttendance(p, a, { is_attended: value })
  } catch (err) {
    showError(err, 'Не удалось изменить отметку')
  }
}

async function saveComment(p: ParticipationItem, a: AttendanceRead, comment: string) {
  try {
    await patchAttendance(p, a, { comment })
  } catch (err) {
    showError(err, 'Не удалось сохранить комментарий')
  }
}

async function deleteComment(p: ParticipationItem, a: AttendanceRead) {
  await saveComment(p, a, '')
}

// Заверение/снятие заверения отдельной отметки — отдельный ключ pending,
// чтобы спиннер появлялся на кнопке-щите, а не на чипе отметки
async function toggleVerify(p: ParticipationItem, a: AttendanceRead) {
  try {
    await withPending(`verify:${a.id}`, async () => {
      await patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch(
        p.collectiveId, a.id, { is_verified: !a.is_verified },
      )
      await loadParticipations()
    })
  } catch (err) {
    showError(err, 'Не удалось изменить заверение')
  }
}

async function addAttendance(p: ParticipationItem) {
  const memberId = addMemberSel[p.participationId]
  if (!memberId) return
  try {
    await createMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendancePost(
      p.collectiveId, p.participationId, { member_id: memberId },
    )
    addMemberSel[p.participationId] = ''
    await loadParticipations()
  } catch (err) {
    showError(err, 'Не удалось добавить отметку')
  }
}

async function removeAttendance(p: ParticipationItem, a: AttendanceRead) {
  const ok = await confirmAction('Удалить отметку?', `Запись присутствия «${memberLabel(a.member_id)}» будет удалена.`)
  if (!ok) return
  try {
    await deleteMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdDelete(p.collectiveId, a.id)
    await loadParticipations()
  } catch (err) {
    showError(err, 'Не удалось удалить отметку')
  }
}

async function verifyAll(p: ParticipationItem) {
  try {
    await verifyMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendanceVerifyPost(
      p.collectiveId,
      p.participationId,
    )
    await loadParticipations()
    const toast = await toastController.create({ message: 'Присутствия заверены', duration: 2000, color: 'success' })
    toast.present()
  } catch (err) {
    showError(err, 'Не удалось заверить присутствия')
  }
}

// ---- Создание участия через модальное окно ----
const showJoinModal = ref(false)
const joining = ref(false)
const joinForm = reactive({
  collectiveId: '',
  priority: null as EventPriorityEnumV1 | null,
})
const priorityLabels: Record<EventPriorityEnumV1, string> = {
  hight: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}
const priorityOptions = Object.entries(priorityLabels) as [EventPriorityEnumV1, string][]

function openJoinModal() {
  joinForm.collectiveId = joinableCollectives.value[0]?.id ?? ''
  joinForm.priority = null
  showJoinModal.value = true
}

async function submitJoin() {
  const collective = joinableCollectives.value.find((c) => c.id === joinForm.collectiveId)
  if (!collective) return
  joining.value = true
  try {
    await createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost(collective.id, {
      event_id: eventId,
      EventPriorityEnumV1: joinForm.priority,
    })
    showJoinModal.value = false
    await loadParticipations()
    const toast = await toastController.create({ message: `Участие «${collective.name}» создано`, duration: 2000, color: 'success' })
    toast.present()
  } catch (err) {
    showError(err, 'Не удалось создать участие')
  } finally {
    joining.value = false
  }
}

// Руководитель отменяет участие своего коллектива. Если это последний
// участвующий коллектив — мероприятие удаляется (бизнес-логика на бэке).
async function cancelParticipation(p: ParticipationItem) {
  const isLast = participationItems.value.length === 1
  const message = isLast
    ? `«${p.collectiveName}» — единственный участник. Мероприятие будет удалено вместе с участием.`
    : `Участие «${p.collectiveName}» будет отменено.`
  const ok = await confirmAction('Отменить участие?', message)
  if (!ok) return
  try {
    await cancelMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsEventIdDelete(
      p.collectiveId, eventId,
    )
    const toast = await toastController.create({
      message: isLast ? 'Мероприятие удалено' : 'Участие отменено',
      duration: 2000,
      color: 'success',
    })
    toast.present()
    if (isLast) {
      router.replace('/')
    } else {
      await loadParticipations()
    }
  } catch (err) {
    showError(err, 'Не удалось отменить участие')
  }
}

async function loadParticipations() {
  const resp = await getParticipationsEventV1ParticipationsGet({ event_id__in: eventId, limit: 100 })
  const participations = resp.data.items

  const myMemberIds = new Set(principal.userMemberIds.values())
  const collectiveNames = new Map(principal.collectives.map((c) => [c.id, c.name]))

  const items: ParticipationItem[] = await Promise.all(
    participations.map(async (part) => {
      const isPrincipal = principal.principalCollectiveIds.has(part.collective_id)
      const isMember = principal.userMemberIds.has(part.collective_id)
      let attendances: AttendanceRead[] = []
      if (isPrincipal || isMember) {
        try {
          const aResp = await getAttendancesEventV1AttendancesGet({ participation_id: part.id, limit: 100 })
          // Стабильный порядок: иначе записи перемешиваются после каждого изменения
          attendances = aResp.data.items
            .slice()
            .sort((a, b) => (memberNames[a.member_id] || a.member_id).localeCompare(memberNames[b.member_id] || b.member_id, 'ru'))
        } catch { /* not allowed to see attendances */ }
      }
      const myAttendance = attendances.find((a) => myMemberIds.has(a.member_id)) || null
      return {
        participationId: part.id,
        collectiveId: part.collective_id,
        collectiveName:
          part.collective_name
          || collectiveNames.get(part.collective_id)
          || `Коллектив ${part.collective_id.slice(0, 8)}`,
        attendances,
        myAttendance,
        isPrincipal,
        isMember,
        canExpand: isPrincipal || isMember,
      }
    }),
  )

  // Свои коллективы первыми, далее стабильно по названию
  items.sort((a, b) =>
    Number(b.canExpand) - Number(a.canExpand) ||
    a.collectiveName.localeCompare(b.collectiveName, 'ru'))
  participationItems.value = items
  loadMemberNames(items).then(() => {
    // Когда ФИО загрузились — пересортировать списки по именам
    for (const p of participationItems.value) {
      p.attendances.sort((a, b) =>
        (memberNames[a.member_id] || a.member_id).localeCompare(memberNames[b.member_id] || b.member_id, 'ru'))
    }
  })
}

onMounted(async () => {
  loading.value = true
  try {
    const [eventResp, stagesResp] = await Promise.all([
      getEventEventV1EventsEventIdGet(eventId),
      getEventStagesEventV1EventsEventIdStagesGet(eventId, { limit: 100, order_by: 'start_at' }).catch(() => null),
    ])
    event.value = eventResp.data
    stages.value = stagesResp?.data.items ?? []
    await loadParticipations()
  } catch (err) {
    console.error('Failed to load event', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

.detail-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.detail-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-collectives {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 767px) {
  .detail-layout {
    flex-direction: column;
  }
  .detail-info,
  .detail-collectives {
    width: 100%;
  }
}

.page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 64px 20px;
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

.info-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 20px;
}

.info-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.info-card-top h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.info-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-badge {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.edit-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

/* Форма редактирования */
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

.member-search {
  padding: 0;
  --border-radius: 10px;
}

.chip-selected {
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

.chip-clear {
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

.chip-clear:hover {
  color: var(--ion-color-danger);
}

.combo-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.combo-option {
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

.combo-option:hover {
  background: var(--ion-background-color);
}

.inline-icon {
  vertical-align: -2px;
  margin-right: 4px;
  color: var(--ion-color-medium);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.card-head .card-title {
  margin: 0;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--ion-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.stage-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
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

.stage-desc-input {
  resize: vertical;
  min-height: 48px;
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

.info-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 10px;
}

.info-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.info-meta-item ion-icon {
  font-size: 15px;
}

.info-description {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ion-text-color);
  white-space: pre-wrap;
}

.card-title {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.section-title {
  margin: 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.card-empty {
  margin: 0;
  font-size: 13px;
  color: var(--ion-color-step-400);
}

.stage-timeline {
  display: flex;
  flex-direction: column;
}

.stage-row {
  display: flex;
  gap: 12px;
}

.stage-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}

.stage-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  flex-shrink: 0;
}

.stage-line {
  flex: 1;
  width: 2px;
  background: var(--ion-border-color);
  margin: 4px 0;
}

.stage-body {
  flex: 1;
  padding-bottom: 18px;
  min-width: 0;
}

.stage-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.stage-time {
  display: block;
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.stage-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.collective-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 16px;
}

.collective-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.collective-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.collective-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.collective-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collective-counter {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(108, 99, 255, 0.08);
  color: var(--ion-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.collective-card-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.form-static {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.form-hint {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.my-attendance {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ion-background-color);
}

.my-attendance-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  margin-bottom: 8px;
}

.my-attendance-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 0;
  border: none;
  background: none;
  color: var(--ion-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.attendance-list {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attendance-divider {
  margin: 6px 0 2px;
  padding: 0 2px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ion-color-medium);
}

.attendance-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--ion-background-color);
}

.attendance-member {
  flex: 1 1 110px;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attendance-row-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

/* Мобильная разметка: имя на первой строке, все чипы и кнопки ровным рядом под ним */
@media (max-width: 480px) {
  .attendance-member {
    flex: 1 1 100%;
  }
  .attendance-row-chips {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
    flex-wrap: nowrap;
  }
}

/* Один порядок и одинаковая ширина чипов в каждой строке — колонки не «гуляют» */
@media (min-width: 481px) {
  .attendance-row-chips :deep(.att-chip) {
    min-width: 136px;
    justify-content: center;
  }
  .attendance-row-chips :deep(.comment-chip) {
    min-width: 124px;
    justify-content: center;
  }
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.row-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.row-icon-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.row-icon-btn--verified {
  border-color: var(--ion-color-primary);
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
}

.row-icon-btn--danger:hover {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
  background: rgba(255, 71, 87, 0.06);
}

.add-attendance {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.add-attendance-select {
  flex: 1;
  min-width: 0;
  appearance: none;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 13px;
  color: var(--ion-text-color);
  padding: 9px 12px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.add-attendance-select:focus {
  border-color: var(--ion-color-primary);
}

.join-btn {
  margin-top: 8px;
}
</style>
