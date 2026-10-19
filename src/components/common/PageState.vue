<template>
  <div class="ui-card ps">
    <ion-icon :icon="alertCircleOutline" class="ps-icon" />
    <p class="ps-text">{{ text }}</p>
    <div class="ps-actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { alertCircleOutline } from 'ionicons/icons'

defineProps<{ text: string }>()
</script>

<style scoped>
.ps {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 16px;
  text-align: center;
}

.ps-icon {
  font-size: var(--icon-hero);
  color: var(--ion-color-medium);
}

.ps-text {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.ps-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
