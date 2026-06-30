<template>
  <button class="app-fab" :aria-label="ariaLabel" @click="$emit('click')">
    <ion-icon :icon="icon" />
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'

defineProps<{
  /** Иконка ionicons */
  icon: string
  ariaLabel?: string
}>()

defineEmits<{ click: [] }>()
</script>

<style scoped>
/*
  Единая плавающая кнопка (мобильный паттерн). Внутри ion-tabs страница (.ion-page)
  уже заканчивается над таб-баром, а fixed считается относительно неё, поэтому
  достаточно 16px — тот же отступ, что и до правого края. На десктопе скрыта.
*/
.app-fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: #fff;
  font-size: 26px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--ion-color-primary-rgb), 0.4);
  transition: transform 0.15s;
}

.app-fab:active {
  transform: scale(0.94);
}

@media (min-width: 768px) {
  .app-fab {
    display: none;
  }
}
</style>
