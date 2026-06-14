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
                <span v-if="principal.isPrincipal" class="status-badge" :style="{ color: statusColor, background: statusColor + '1A' }">
                  {{ statusLabel }}
                </span>
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
              <h3 class="card-title">Этапы</h3>
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
                <span v-if="p.attendances.length" class="collective-counter">
                  {{ p.attendances.filter((a) => a.is_attended).length }}/{{ p.attendances.length }}
                </span>
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
                  <div v-for="a in p.attendances" :key="a.id" class="attendance-row">
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
              @click="joinEvent"
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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonButton, IonIcon, toastController,
} from '@ionic/vue'
import {
  calendarOutline, timeOutline, chevronDownOutline, chevronUpOutline,
  shieldCheckmarkOutline, shieldCheckmark, shieldOutline, trashOutline,
  addOutline, alertCircleOutline,
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
} from '@/api/generated/-event'
import { resolveMemberName, rememberMemberPerson, shortId, shortenName } from '@/utils/names'
import UuidBadge from '@/components/common/UuidBadge.vue'
import EventAttendanceChip from '@/components/event/EventAttendanceChip.vue'
import EventCommentChip from '@/components/event/EventCommentChip.vue'
import type { EventRead, EventStatus, StageRead, AttendanceRead, MemberRead } from '@/api/generated/almaEventFlow.schemas'

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
  const map: Record<EventStatus, string> = {
    draft: '#92949c', template: '#6C63FF', active: '#00D9A6', archived: '#FF4757',
  }
  return map[event.value?.status ?? 'draft']
})

const statusLabel = computed(() => {
  const map: Record<EventStatus, string> = {
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

async function joinEvent() {
  const collective = joinableCollectives.value[0]
  if (!collective) return
  try {
    await createMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsPost(collective.id, {
      event_id: eventId,
    })
    await loadParticipations()
    const toast = await toastController.create({ message: `Участие «${collective.name}» создано`, duration: 2000, color: 'success' })
    toast.present()
  } catch (err) {
    showError(err, 'Не удалось создать участие')
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
        collectiveName: collectiveNames.get(part.collective_id) || `Коллектив ${part.collective_id.slice(0, 8)}`,
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

.status-badge {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
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
