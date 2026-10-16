<template>
  <div class="aac" role="group" :aria-label="`Адрес ${address.name}`">
    <div class="aac-head">
      <span class="aac-tile"><ion-icon :icon="locationOutline" /></span>
      <span class="aac-text">
        <span class="aac-title">{{ address.name }}</span>
        <span class="aac-sub">{{ city || 'Адрес' }}</span>
      </span>
      <button
        type="button"
        class="ui-icon-btn"
        aria-label="Отменить выбор адреса"
        @mousedown.prevent
        @click="emit('cancel')"
      >
        <ion-icon :icon="closeOutline" />
      </button>
    </div>
    <div class="aac-actions">
      <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @mousedown.prevent @click="emit('create')">
        Создать локацию
      </button>
      <button
        type="button"
        class="ui-btn ui-btn--primary ui-btn--sm"
        :disabled="busy"
        @mousedown.prevent
        @click="emit('use')"
      >
        <ion-spinner v-if="busy" name="crescent" />
        <span>Выбрать адрес</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline, locationOutline } from 'ionicons/icons'
import type { AddressRead } from '@/api/generated/almaEventFlow'
import { addressLocality } from '@/composables/useGeoSearch'

const props = defineProps<{ address: AddressRead; busy?: boolean }>()
const emit = defineEmits<{ use: []; create: []; cancel: [] }>()

const city = computed(() => addressLocality(props.address))
</script>

<style scoped>
.aac {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.aac-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.aac-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-text-color-rgb), 0.07);
  color: var(--ion-color-medium);
  font-size: var(--fs-xl);
}

.aac-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.aac-title {
  overflow: hidden;
  font-size: var(--fs-md);
  font-weight: var(--fw-bold);
  line-height: 1.3;
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aac-sub {
  overflow: hidden;
  font-size: var(--fs-xs);
  line-height: 1.3;
  color: var(--ion-color-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aac-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.aac-actions ion-spinner {
  width: 16px;
  height: 16px;
}
</style>
