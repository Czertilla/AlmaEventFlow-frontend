<template>
  <div class="event-card" :class="{ 'event-card--pending': hasPendingAttendance }" @click="$emit('click')">
    <div class="event-card-header">
      <div v-if="isPrincipal" class="event-status" :style="{ background: statusColor }" :title="statusLabel" />
      <div class="event-info">
        <h4 class="event-name">{{ event.name }}</h4>
        <span class="event-date">
          <ion-icon :icon="calendarOutline" />
          {{ event.date ? formatDate(event.date, settings.dateFormat) : 'Дата не назначена' }}
          <template v-if="eventTime"> · {{ eventTime }}</template>
        </span>
      </div>
      <div class="event-members" v-if="showAttendanceCount && items.length === 1 && items[0]?.totalCount">
        <span class="member-badge">{{ items[0].attendedCount }}/{{ items[0].totalCount }}</span>
      </div>
    </div>

    <div v-if="items.length > 0" class="event-card-body">
      <template v-for="item in items" :key="item.collectiveId">
        <div v-if="items.length === 1 && item.attendance" class="attendance-row" @click.stop>
          <div class="collective-info">
            <span class="collective-dot" :style="{ background: getColor(item.collectiveId) }" />
            <span class="collective-name">{{ item.collectiveName }}</span>
          </div>
          <div class="attendance-chips">
            <EventAttendanceChip
              :is-attended="item.attendance.is_attended"
              :edited-at="item.attendance.edited_at"
              :verified="item.attendance.is_verified"
              :attendance-id="item.attendance.id"
              :show-lock="false"
              @toggle="(v) => $emit('toggleAttendance', item.attendance!.id, v)"
            />
            <EventCommentChip
              :comment="item.attendance.comment"
              :verified="item.attendance.is_verified"
              @save="(c) => $emit('saveComment', item.attendance!.id, c)"
              @delete="() => $emit('deleteComment', item.attendance!.id)"
            />
            <span v-if="item.attendance.is_verified" class="att-lock" title="Заверено">
              <ion-icon :icon="lockClosed" />
            </span>
          </div>
        </div>
        <div v-else class="collective-row">
          <div class="collective-info">
            <span class="collective-dot" :style="{ background: getColor(item.collectiveId) }" />
            <span class="collective-name">{{ item.collectiveName }}</span>
          </div>
          <div class="collective-badge" v-if="showAttendanceCount && (item.totalCount ?? 0) > 0">
            <span class="member-badge">{{ item.attendedCount }}/{{ item.totalCount }}</span>
          </div>
          <div class="collective-actions" v-if="item.attendance" @click.stop>
            <EventAttendanceChip
              :is-attended="item.attendance.is_attended"
              :edited-at="item.attendance.edited_at"
              :verified="item.attendance.is_verified"
              :attendance-id="item.attendance.id"
              :show-lock="false"
              @toggle="(v) => $emit('toggleAttendance', item.attendance!.id, v)"
            />
            <EventCommentChip
              :comment="item.attendance.comment"
              :verified="item.attendance.is_verified"
              @save="(c) => $emit('saveComment', item.attendance!.id, c)"
              @delete="() => $emit('deleteComment', item.attendance!.id)"
            />
            <span v-if="item.attendance.is_verified" class="att-lock" title="Заверено">
              <ion-icon :icon="lockClosed" />
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, formatTime } from '@/utils/date'
import { getCollectiveColor } from '@/utils/colors'
import EventAttendanceChip from './EventAttendanceChip.vue'
import EventCommentChip from './EventCommentChip.vue'
import type { EventRead, AttendanceRead, EventStatusEnumV1 } from '@/api/generated/almaEventFlow'
import { calendarOutline, lockClosed } from 'ionicons/icons'

export interface CollectiveAttendanceItem {
  collectiveId: string
  collectiveName: string
  attendance: AttendanceRead | null
  attendedCount?: number
  totalCount?: number
}

const getColor = getCollectiveColor

const props = defineProps<{
  event: EventRead
  items: CollectiveAttendanceItem[]
  isPrincipal: boolean
}>()

defineEmits<{
  click: []
  toggleAttendance: [attendanceId: string, value: boolean]
  saveComment: [attendanceId: string, comment: string]
  deleteComment: [attendanceId: string]
}>()

const settings = useSettingsStore()

// Счётчик присутствий показываем руководителю только у активных мероприятий
const showAttendanceCount = computed(() => props.isPrincipal && props.event.status === 'active')

// Есть собственная неотмеченная запись — карточка подсвечивается жёлтым свечением
const hasPendingAttendance = computed(() =>
  props.items.some((i) => i.attendance && i.attendance.edited_at == null && !i.attendance.is_verified),
)

// Show time only when the event date carries a time component
const eventTime = computed(() => {
  const d = props.event.date
  if (!d || !d.includes('T')) return ''
  const t = formatTime(d)
  return t === '00:00' ? '' : t
})

const statusColor = computed(() => {
  const map: Record<EventStatusEnumV1, string> = {
    draft: '#92949c',
    template: '#6C63FF',
    active: '#00D9A6',
    archived: '#FF4757',
  }
  return map[props.event.status ?? 'draft']
})

const statusLabel = computed(() => {
  const map: Record<EventStatusEnumV1, string> = {
    draft: 'Черновик',
    template: 'Шаблон',
    active: 'Активно',
    archived: 'Архив',
  }
  return map[props.event.status ?? 'draft']
})


</script>

<style scoped>
.event-card {
  background: var(--ion-card-background);
  border-radius: 14px;
  box-shadow: var(--ion-card-shadow);
  cursor: pointer;
  transition: all 0.2s;
  margin: 8px 0;
}

.event-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(var(--ion-color-primary-rgb), 0.12);
}

/* Неотмеченное мероприятие — пульсирующее жёлтое свечение */
.event-card--pending {
  animation: pendingGlow 1.8s ease-in-out infinite;
}

.event-card--pending:hover {
  animation: none;
}

@keyframes pendingGlow {
  0%, 100% { box-shadow: var(--ion-card-shadow); }
  50% { box-shadow: var(--ion-card-shadow), 0 0 18px 2px rgba(255, 184, 0, 0.55); }
}

.event-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ion-border-color);
}

.event-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-info {
  flex: 1;
  min-width: 0;
}

.event-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.event-date ion-icon {
  font-size: 13px;
}

.event-members {
  flex-shrink: 0;
}

.member-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  color: var(--ion-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.event-card-body {
  padding: 12px 16px;
}

.attendance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: nowrap;
}

.attendance-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

.collective-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
}

.collective-row + .collective-row {
  border-top: 1px solid var(--ion-border-color);
  margin-top: 6px;
  padding-top: 12px;
}

.collective-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.collective-badge {
  flex-shrink: 0;
  margin-left: auto;
}

.collective-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.collective-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collective-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.att-lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ion-color-step-50, #f4f5f8);
  border: 1.5px solid var(--ion-border-color);
  color: var(--ion-color-medium);
  font-size: 13px;
  flex-shrink: 0;
}
</style>
