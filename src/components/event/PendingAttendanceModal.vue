<template>
  <ion-modal :is-open="isOpen" @ion-modal-did-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Требуют отметки</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Закрыть" @click="$emit('close')">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="pending-state">
        <div class="loading-spinner" />
      </div>

      <div v-else-if="events.length === 0" class="pending-state">
        <ion-icon :icon="checkmarkCircleOutline" />
        <p>Нет мероприятий, требующих отметки</p>
      </div>

      <div v-else class="pending-list">
        <p class="pending-hint">
          Отметьте присутствие на каждом мероприятии. Кнопка «Готово» станет
          активной, когда не останется неотмеченных.
        </p>
        <EventPreview
          v-for="event in events"
          :key="event.id"
          :event="event"
          :items="itemsFor(event.id)"
          :is-principal="isPrincipal"
          @toggle-attendance="(id, v) => $emit('toggleAttendance', id, v)"
          @save-comment="(id, c) => $emit('saveComment', id, c)"
          @delete-comment="(id) => $emit('deleteComment', id)"
        />
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <div class="pending-footer">
          <ion-button
            expand="block"
            :disabled="!allDone"
            @click="$emit('close')"
          >
            Готово
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonIcon, IonContent, IonFooter,
} from '@ionic/vue'
import { closeOutline, checkmarkCircleOutline } from 'ionicons/icons'
import EventPreview, { type CollectiveAttendanceItem } from './EventPreview.vue'
import type { EventRead } from '@/api/generated/almaEventFlow'
import type { EventAttendanceItem } from '@/stores/eventCalendar'

const props = defineProps<{
  isOpen: boolean
  loading: boolean
  events: EventRead[]
  attendances: Map<string, EventAttendanceItem[]>
  isPrincipal: boolean
  allDone: boolean
}>()

defineEmits<{
  close: []
  toggleAttendance: [attendanceId: string, value: boolean]
  saveComment: [attendanceId: string, comment: string]
  deleteComment: [attendanceId: string]
}>()

// EventAttendanceItem структурно совместим с CollectiveAttendanceItem
function itemsFor(eventId: string): CollectiveAttendanceItem[] {
  return (props.attendances.get(eventId) || []) as CollectiveAttendanceItem[]
}
</script>

<style scoped>
.pending-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 56px 20px;
  color: var(--ion-color-medium);
}

.pending-state ion-icon {
  font-size: 44px;
  color: var(--ion-color-success);
  opacity: 0.8;
}

.pending-state p {
  margin: 0;
  font-size: 14px;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pending-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.pending-footer {
  padding: 8px 12px;
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
</style>
