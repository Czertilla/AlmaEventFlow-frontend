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
                <LocationDisplay v-if="displayLocation" :location="displayLocation" class="info-meta-item" />
                <UuidBadge :id="event.id" />
              </div>
              <p class="info-description">{{ event.description || 'Нет описания' }}</p>
              <TimestampsMeta :created-at="event.created_at" :edited-at="event.edited_at" />
            </div>

            <div v-if="stages.length || editableCollectiveId" class="info-card">
              <div class="card-head">
                <h3 class="card-title">Этапы</h3>
                <button v-if="editableCollectiveId" class="link-btn" @click="openStages">
                  <ion-icon :icon="stages.length ? createOutline : addOutline" />
                  {{ stages.length ? 'Редактировать' : 'Добавить' }}
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

            <div v-if="mappedLocation" class="info-card">
              <h3 class="card-title">Место проведения</h3>
              <EventLocationMap :location="mappedLocation" />
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
                  <div v-if="attendancesLoading(p)" class="attendance-list-skeleton" aria-busy="true">
                    <div v-for="n in p.attendances.length" :key="n" class="attendance-row">
                      <span class="skeleton skeleton--text attendance-skel-name" :style="{ width: skeletonWidth(n) }" />
                      <span class="skeleton attendance-skel-chip" />
                    </div>
                  </div>
                  <template v-else>
                  <template v-for="g in attendanceGroups(p)" :key="g.key">
                  <div v-if="g.label" class="attendance-divider">{{ g.label }}</div>
                  <div
                    v-for="a in g.items"
                    :key="a.id"
                    :id="`attendance-row-${a.id}`"
                    class="attendance-row"
                    :class="{ 'attendance-row--highlight': highlightedAttendanceId === a.id }"
                  >
                    <button
                      type="button"
                      class="attendance-member attendance-member--link"
                      title="Профиль и посещаемость"
                      @click="openMember(a.member_id)"
                    >
                      {{ memberText(a.member_id) }}
                    </button>
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
                  </template>

                  <!-- Добавление attendance участнику без отметки -->
                  <div v-if="p.isPrincipal && availableMembers(p).length" class="add-attendance">
                    <UiSelect
                      v-model="addMemberSel[p.participationId]"
                      class="add-attendance-select"
                      label="Добавить участника"
                      placeholder="Выберите участника"
                      :options="memberOptions(p)"
                    />
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

      <EventEditModal
        v-model:open="showEditModal"
        :event="event"
        :collective-id="editableCollectiveId"
        :save="saveEvent"
        @saved="onEventSaved"
      />

      <EventStagesModal
        v-model:open="showStagesModal"
        :event-date="event?.date"
        :api="stageApi"
        @changed="stages = $event"
      />

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
              <p class="ui-field-title">Мероприятие</p>
              <p class="form-static">{{ event?.name }}</p>
              <p v-if="event?.date" class="form-hint">
                {{ formatDate(event.date, settings.dateFormat) }}
              </p>
            </div>

            <UiSelect
              v-if="joinableCollectives.length > 1"
              v-model="joinForm.collectiveId"
              label="Коллектив"
              placeholder="Выберите коллектив"
              :options="joinableCollectiveOptions"
            />
            <div v-else class="form-field">
              <p class="ui-field-title">Коллектив</p>
              <p class="form-static">{{ joinableCollectives[0]?.name }}</p>
            </div>

            <UiSelect v-model="joinForm.priority" label="Приоритет" placeholder="Не выбран" :options="PRIORITY_OPTIONS" />

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
import { ref, computed, reactive, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonButton, IonIcon, IonModal, onIonViewWillEnter,
} from '@ionic/vue'
import {
  calendarOutline, timeOutline, chevronDownOutline, chevronUpOutline,
  shieldCheckmarkOutline, shieldCheckmark, shieldOutline, trashOutline,
  addOutline, alertCircleOutline, createOutline, closeOutline, exitOutline,
} from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import { usePlatform } from '@/composables/usePlatform'
import { useToast } from '@/composables/useToast'
import { useEventParticipations, type ParticipationItem } from '@/composables/useEventParticipations'
import { formatDate, formatTime } from '@/utils/date'
import { locationPoint } from '@/utils/geo'
import { getCollectiveColor } from '@/utils/colors'
import {
  statusColor as statusColorOf, statusLabel as statusLabelOf,
  priorityOptions,
} from '@/utils/eventLabels'
import {
  getEventEventV1EventsEventIdGet,
  getEventStagesEventV1EventsEventIdStagesGet,
  createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost,
  patchMyCollectiveEventEventV1MeCollectivesCollectiveIdEventsEventIdPatch,
  createMyCollectiveEventStageEventV1MeCollectivesCollectiveIdEventsEventIdStagesPost,
  patchMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdPatch,
  deleteMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdDelete,
  getLocationGeoV1LocationsLocationIdGet,
} from '@/api/generated/almaEventFlow'
import UuidBadge from '@/components/common/UuidBadge.vue'
import TimestampsMeta from '@/components/common/TimestampsMeta.vue'
import EventAttendanceChip from '@/components/event/EventAttendanceChip.vue'
import EventCommentChip from '@/components/event/EventCommentChip.vue'
import EventLocationMap from '@/components/geo/EventLocationMap.vue'
import LocationDisplay from '@/components/geo/LocationDisplay.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import EventEditModal, { type EventEditBody } from '@/components/event/EventEditModal.vue'
import EventStagesModal, { type StageApi } from '@/components/event/EventStagesModal.vue'
import { optionsFromPairs, withAny, type SelectOption } from '@/utils/selectOptions'
import type {
  EventRead, EventPriorityEnumV1, StageRead, LocationRead,
} from '@/api/generated/almaEventFlow'

const route = useRoute()
const router = useRouter()
const principal = usePrincipalStore()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()
const { showError, showSuccess } = useToast()

const eventId = route.params.id as string
const event = ref<EventRead | null>(null)
const stages = ref<StageRead[]>([])
const loading = ref(true)
const displayLocation = ref<LocationRead | null>(null)
const mappedLocation = computed(() =>
  displayLocation.value && locationPoint(displayLocation.value) ? displayLocation.value : null,
)

async function loadDisplayLocation(locationId: string | null | undefined) {
  if (!locationId) {
    displayLocation.value = null
    return
  }
  try {
    const res = await getLocationGeoV1LocationsLocationIdGet(locationId)
    displayLocation.value = res.data
  } catch {
    displayLocation.value = null
  }
}

// Доменная логика участий/посещаемости вынесена в composable
const {
  participationItems, expanded, addMemberSel, pending,
  joinableCollectives, editableCollectiveId,
  availableMembers, memberText, attendancesLoading, whenNamesSettled, attendanceGroups, loadParticipations,
  toggleAttendance, saveComment, deleteComment, toggleVerify,
  addAttendance, removeAttendance, verifyAll, cancelParticipation,
} = useEventParticipations(eventId)

const SKELETON_WIDTHS = ['46%', '34%', '58%', '40%']
function skeletonWidth(n: number): string {
  return SKELETON_WIDTHS[n % SKELETON_WIDTHS.length]
}

const eventTime = computed(() => {
  const d = event.value?.date
  if (!d || !d.includes('T')) return ''
  const t = formatTime(d)
  return t === '00:00' ? '' : t
})

const statusColor = computed(() => statusColorOf(event.value?.status))
const statusLabel = computed(() => statusLabelOf(event.value?.status))

// ---- Редактирование мероприятия и этапов (общие модалки с админкой) ----
const showEditModal = ref(false)
const showStagesModal = ref(false)

function openEdit() {
  showEditModal.value = true
}

function openStages() {
  showStagesModal.value = true
}

async function saveEvent(body: EventEditBody): Promise<EventRead> {
  const collectiveId = editableCollectiveId.value
  if (!collectiveId) throw new Error('Нет коллектива, от имени которого можно редактировать мероприятие')
  const resp = await patchMyCollectiveEventEventV1MeCollectivesCollectiveIdEventsEventIdPatch(collectiveId, eventId, body)
  return resp.data
}

async function onEventSaved(saved: EventRead | void) {
  if (!saved) return
  event.value = saved
  await loadDisplayLocation(saved.location_id)
}

function requireCollectiveId(): string {
  const collectiveId = editableCollectiveId.value
  if (!collectiveId) throw new Error('Нет коллектива, от имени которого можно редактировать этапы')
  return collectiveId
}

const stageApi: StageApi = {
  list: async () =>
    (await getEventStagesEventV1EventsEventIdStagesGet(eventId, { limit: 100, order_by: 'start_at' })).data.items,
  create: (body) =>
    createMyCollectiveEventStageEventV1MeCollectivesCollectiveIdEventsEventIdStagesPost(requireCollectiveId(), eventId, body),
  patch: (stageId, body) =>
    patchMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdPatch(requireCollectiveId(), stageId, body),
  remove: (stageId) =>
    deleteMyCollectiveEventStageEventV1MeCollectivesCollectiveIdStagesStageIdDelete(requireCollectiveId(), stageId),
}

const PRIORITY_OPTIONS = withAny<EventPriorityEnumV1 | null>(optionsFromPairs(priorityOptions), null, 'Не выбран')

const joinableCollectiveOptions = computed<SelectOption<string>[]>(() =>
  joinableCollectives.value.map((c) => ({ value: c.id, label: c.name })),
)

function memberOptions(p: ParticipationItem): SelectOption<string>[] {
  return availableMembers(p).map((m) => ({ value: m.id, label: memberText(m.id) }))
}

// ---- Создание участия через модальное окно ----
const showJoinModal = ref(false)
const joining = ref(false)
const joinForm = reactive({
  collectiveId: '',
  priority: null as EventPriorityEnumV1 | null,
})

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
      priority_degree: joinForm.priority,
    })
    showJoinModal.value = false
    await loadParticipations()
    showSuccess(`Участие «${collective.name}» создано`)
  } catch (err) {
    showError(err, 'Не удалось создать участие')
  } finally {
    joining.value = false
  }
}

function openMember(memberId: string) {
  router.push(`/member/${memberId}`)
}

// Дашборд руководителя переходит сюда с ?member=&collective= для конкретной
// ячейки посещения -- разворачиваем нужный коллектив, прокручиваем к строке
// этого участника и подсвечиваем её на пару секунд.
const highlightedAttendanceId = ref<string | null>(null)

async function scrollToRequestedAttendance() {
  const memberId = route.query.member
  if (typeof memberId !== 'string' || !memberId) return
  const collectiveId = typeof route.query.collective === 'string' ? route.query.collective : undefined
  const target = participationItems.value.find((p) => !collectiveId || p.collectiveId === collectiveId)
  if (!target) return
  if (target.canExpand) expanded[target.participationId] = true
  const attendance = target.attendances.find((a) => a.member_id === memberId)
  if (!attendance) return
  await whenNamesSettled()
  highlightedAttendanceId.value = attendance.id
  await nextTick()
  document.getElementById(`attendance-row-${attendance.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    if (highlightedAttendanceId.value === attendance.id) highlightedAttendanceId.value = null
  }, 2500)
}

// onIonViewWillEnter, а не onMounted: ion-router-outlet по умолчанию кэширует
// уже посещённые страницы и не размонтирует их при переходе на другую --
// обычный onMounted сработал бы только один раз, и при возврате на эту
// страницу (например, после отметки посещаемости в другом месте) она
// показывала бы старые данные.
onIonViewWillEnter(async () => {
  loading.value = true
  try {
    const [eventResp, stagesResp] = await Promise.all([
      getEventEventV1EventsEventIdGet(eventId),
      getEventStagesEventV1EventsEventIdStagesGet(eventId, { limit: 100, order_by: 'start_at' }).catch(() => null),
      principal.fetchCollectives(),
    ])
    event.value = eventResp.data
    stages.value = stagesResp?.data.items ?? []
    await Promise.all([loadParticipations(), loadDisplayLocation(event.value.location_id)])
    await scrollToRequestedAttendance()
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
  font-size: var(--icon-hero);
  opacity: 0.4;
}

.page-state p {
  margin: 0;
  font-size: var(--fs-md);
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
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
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
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
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
  font-size: var(--fs-lg);
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
  gap: 12px;
  max-width: 560px;
  margin: 0 auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  cursor: pointer;
}

.add-stage-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px dashed var(--ion-border-color);
  border-radius: 10px;
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
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.info-meta-item ion-icon {
  font-size: var(--fs-lg);
}

.info-description {
  margin: 14px 0 0;
  font-size: var(--fs-md);
  line-height: 1.6;
  color: var(--ion-text-color);
  white-space: pre-wrap;
}

.card-title {
  margin: 0 0 14px;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.section-title {
  margin: 4px 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.card-empty {
  margin: 0;
  font-size: var(--fs-sm);
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
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.stage-time {
  display: block;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.stage-desc {
  margin: 6px 0 0;
  font-size: var(--fs-sm);
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
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collective-counter {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  color: var(--ion-color-primary);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
}

.collective-card-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.form-static {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.form-hint {
  margin: 2px 0 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.form-hint-warn {
  color: var(--ion-color-danger);
  font-weight: var(--fw-semibold);
}

.my-attendance {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ion-background-color);
}

.my-attendance-label {
  display: block;
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
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
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  cursor: pointer;
}

.attendance-list {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attendance-list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attendance-skel-name {
  height: 14px;
}

.attendance-skel-chip {
  width: 136px;
  height: 28px;
  margin-left: auto;
  border-radius: var(--radius-pill);
}

.attendance-divider {
  margin: 6px 0 2px;
  padding: 0 2px;
  font-size: var(--fs-2xs);
  font-weight: var(--fw-bold);
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

.attendance-row--highlight {
  animation: attendance-highlight 2.5s ease;
}

@keyframes attendance-highlight {
  0%, 100% { background: var(--ion-background-color); }
  15%, 65% { background: rgba(var(--ion-color-primary-rgb), 0.18); }
}

.attendance-member {
  flex: 1 1 110px;
  min-width: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attendance-member--link {
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.attendance-member--link:hover,
.attendance-member--link:focus-visible {
  outline: none;
  color: var(--ion-color-primary);
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
  font-size: var(--fs-md);
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
  background: rgba(var(--ion-color-primary-rgb), 0.1);
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
}

.add-attendance ion-button {
  margin-top: 8px;
}

.join-btn {
  margin-top: 8px;
}
</style>
