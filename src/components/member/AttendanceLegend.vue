<template>
  <ul class="lg" aria-label="Обозначения">
    <li v-if="scale" class="lg-item lg-item--scale">
      <span class="lg-label">{{ outcomeLabels.attended }}</span>
      <span class="lg-scale" :style="{ background: gradient }" />
      <span class="lg-label">{{ outcomeLabels.absent }}</span>
    </li>
    <li v-for="outcome in swatches" :key="outcome" class="lg-item">
      <span class="lg-swatch" :class="`ui-att--${outcome}`" />
      <span class="lg-label">{{ scale && outcome === 'unmarked' ? 'Есть неотмеченные' : outcomeLabels[outcome] }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OUTCOMES, outcomeLabels, rateGradient, type Outcome } from '@/utils/memberAttendance'

const props = withDefaults(defineProps<{
  shown?: Outcome[]
  scale?: boolean
}>(), { shown: () => OUTCOMES, scale: false })

const gradient = rateGradient()
const swatches = computed(() => (props.scale ? props.shown.filter((o) => o !== 'attended' && o !== 'absent') : props.shown))
</script>

<style scoped>
.lg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lg-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.lg-label {
  margin-left: 3px;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.lg-item--scale {
  gap: 6px;
}

.lg-item--scale .lg-label {
  margin-left: 0;
}

.lg-scale {
  width: 96px;
  height: 10px;
  border-radius: var(--radius-pill);
}

.lg-swatch {
  width: 10px;
  height: 10px;
  border-radius: 25%;
}
</style>
