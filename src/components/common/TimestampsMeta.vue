<template>
  <div v-if="createdAt" class="timestamps-meta">
    <span class="timestamps-item">
      <ion-icon :icon="timeOutline" />
      Создано {{ formatDateTime(createdAt) }}
    </span>
    <span class="timestamps-item">
      <ion-icon :icon="createOutline" />
      <template v-if="editedAt">Изменено {{ formatDateTime(editedAt) }}</template>
      <template v-else>Не изменялось</template>
    </span>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { timeOutline, createOutline } from 'ionicons/icons'
import { formatDateTime } from '@/utils/date'

defineProps<{
  createdAt?: string | null
  editedAt?: string | null
}>()
</script>

<style scoped>
.timestamps-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.timestamps-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.timestamps-item ion-icon {
  font-size: 13px;
}
</style>
