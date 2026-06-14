<template>
  <button class="uuid-badge" :title="id" @click.stop="copy">
    <span class="uuid-text">{{ shortId(id) }}</span>
    <ion-icon :icon="copied ? checkmarkOutline : copyOutline" />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { copyOutline, checkmarkOutline } from 'ionicons/icons'
import { shortId } from '@/utils/names'

const props = defineProps<{ id: string }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.id)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard unavailable */ }
}
</script>

<style scoped>
.uuid-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid var(--ion-border-color);
  border-radius: 6px;
  background: var(--ion-background-color);
  color: var(--ion-color-medium);
  font-size: 11px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  cursor: pointer;
  transition: all 0.15s;
}

.uuid-badge:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.uuid-badge ion-icon {
  font-size: 12px;
}
</style>
