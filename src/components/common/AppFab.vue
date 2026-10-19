<template>
  <button
    class="app-fab"
    :class="{ 'app-fab--secondary': secondary, 'app-fab--tucked': tucked }"
    :style="secondaryStyle"
    :aria-label="ariaLabel"
    :tabindex="tucked ? -1 : undefined"
    @click="$emit('click')"
  >
    <ion-icon :icon="icon" />
    <span v-if="badge" class="app-fab-badge">{{ badge }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'

const STEP = 54
const FIRST_BOTTOM = 84
const RETRACT = 62

const props = withDefaults(
  defineProps<{
    /** Иконка ionicons */
    icon: string
    ariaLabel?: string
    /** Вторая кнопка на странице: меньше и выше основной, чтобы они не перекрывались */
    secondary?: boolean
    /** Место среди вторых кнопок: 0 над основной, 1 над ней и так далее */
    stack?: number
    /** Число на кнопке (например, включённые фильтры) */
    badge?: number
    /** Спрятана: вторая уезжает под основную, основная уходит за край экрана */
    tucked?: boolean
  }>(),
  { stack: 0 },
)

defineEmits<{ click: [] }>()

const secondaryStyle = computed(() =>
  props.secondary
    ? {
        bottom: `${FIRST_BOTTOM + props.stack * STEP}px`,
        zIndex: 89 - props.stack,
        '--fab-retract': `${RETRACT + props.stack * STEP}px`,
      }
    : undefined,
)
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
  font-size: var(--icon-xl);
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--ion-color-primary-rgb), 0.4);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
}

.app-fab--secondary {
  right: 22px;
  bottom: 84px;
  width: 44px;
  height: 44px;
  border: var(--border-w) solid var(--ion-border-color);
  background: var(--ion-card-background);
  color: var(--ion-color-primary);
  font-size: var(--fs-2xl);
  box-shadow: var(--ion-card-shadow);
}

.app-fab:active {
  transform: scale(0.94);
}

.app-fab--tucked {
  transform: translateY(calc(100% + 120px));
  opacity: 0;
  pointer-events: none;
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease 0.15s;
}

.app-fab--secondary.app-fab--tucked {
  transform: translateY(var(--fab-retract)) scale(0.5);
}

.app-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border: 2px solid var(--ion-background-color);
  border-radius: 9px;
  box-sizing: content-box;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-bold);
  line-height: 1;
}

@media (min-width: 768px) {
  .app-fab {
    display: none;
  }
}
</style>
