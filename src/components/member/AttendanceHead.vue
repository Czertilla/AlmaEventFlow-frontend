<template>
  <section class="ui-card ahd-head">
    <slot />
    <div class="ahd-rate">
      <span class="ahd-rate-value">{{ formatRate(rate) }}</span>
      <span class="ahd-rate-label">посещаемость · {{ periodLabel }}</span>
      <span class="ahd-meter"><span class="ahd-meter-fill ui-att--attended" :style="{ width: percent }" /></span>
      <span class="ahd-rate-sub">{{ sub }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatRate } from '@/utils/memberAttendance'

const props = defineProps<{
  rate: number | null
  periodLabel: string
  sub: string
}>()

const percent = computed(() => `${Math.round((props.rate ?? 0) * 100)}%`)
</script>

<style scoped>
.ahd-head {
  display: grid;
  gap: 16px;
}

.ahd-rate {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ahd-rate-value {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  line-height: 1.1;
  color: var(--ion-text-color);
}

.ahd-rate-label {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.ahd-meter {
  display: block;
  height: 8px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: rgba(var(--att-attended-rgb), 0.18);
}

.ahd-meter-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
}

.ahd-rate-sub {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

@media (min-width: 768px) {
  .ahd-head {
    grid-template-columns: 1fr minmax(200px, 260px);
    align-items: center;
  }
}
</style>
