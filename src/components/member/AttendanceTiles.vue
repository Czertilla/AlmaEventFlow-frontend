<template>
  <div v-if="loading" class="at" aria-hidden="true">
    <span v-for="n in 6" :key="n" class="skeleton at-skeleton" />
  </div>
  <section v-else class="at" aria-label="Сводка посещаемости">
    <div v-for="tile in tiles" :key="tile.key" class="at-tile">
      <span class="at-label">
        <span v-if="tile.outcome" class="at-dot" :class="`ui-att--${tile.outcome}`" />
        <ion-icon v-else-if="tile.icon" :icon="tile.icon" />
        {{ tile.label }}
      </span>
      <span class="at-value">{{ tile.value }}</span>
      <span v-if="tile.sub" class="at-sub">{{ tile.sub }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import type { Outcome } from '@/utils/memberAttendance'

export interface AttendanceTile {
  key: string
  label: string
  value: number
  sub?: string
  outcome?: Outcome
  icon?: string
}

withDefaults(defineProps<{
  tiles?: AttendanceTile[]
  loading?: boolean
}>(), { tiles: () => [], loading: false })
</script>

<style scoped>
.at {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.at-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.at-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.at-label ion-icon {
  font-size: var(--fs-md);
}

.at-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 25%;
}

.at-value {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  line-height: 1.1;
  color: var(--ion-text-color);
}

.at-sub {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.at-skeleton {
  height: 78px;
  border-radius: var(--radius-lg);
}

@media (min-width: 768px) {
  .at {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
