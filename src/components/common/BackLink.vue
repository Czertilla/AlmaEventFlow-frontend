<template>
  <button type="button" class="back-link">
    <ion-icon :icon="chevronBackOutline" />
    {{ label }}
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { chevronBackOutline } from 'ionicons/icons'

defineProps<{ label: string }>()
</script>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  align-self: flex-start;
  padding: 4px 8px 4px 0;
  border: none;
  background: transparent;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  cursor: pointer;
}

.back-link:hover {
  color: var(--ion-color-primary);
}
</style>
