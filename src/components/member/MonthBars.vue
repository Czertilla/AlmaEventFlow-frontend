<template>
  <div class="mb">
    <div class="mb-plot">
      <span class="mb-max">{{ max }}</span>
      <div class="mb-cols">
        <div
          v-for="(bucket, index) in buckets"
          :key="bucket.key"
          class="mb-col"
          tabindex="0"
          :aria-label="bucketLabel(bucket)"
        >
          <div class="mb-slot">
            <div class="mb-stack" :style="{ height: `${(total(bucket) / max) * 100}%` }">
              <template v-for="outcome in OUTCOMES" :key="outcome">
                <span
                  v-if="bucket[outcome] > 0"
                  class="mb-seg"
                  :class="`ui-att--${outcome}`"
                  :style="{ flexGrow: bucket[outcome] }"
                />
              </template>
            </div>
          </div>
          <span class="mb-label" :class="{ 'mb-label--skip': labelSkipped(index) }">
            {{ bucket.label }}
            <span v-if="showYear(index)" class="mb-year">{{ bucket.key.slice(2, 4) }}</span>
          </span>
          <div class="mb-tip" role="tooltip">
            <strong>{{ bucket.label }} {{ bucket.key.slice(0, 4) }}</strong>
            <span v-for="outcome in OUTCOMES" :key="outcome" class="mb-tip-row">
              <ion-icon :icon="outcomeIcons[outcome]" :class="`ui-att-ink--${outcome}`" />
              {{ labels[outcome] }}: {{ bucket[outcome] }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import {
  OUTCOMES, outcomeIcons, outcomeLabels, type MonthBucket, type Outcome,
} from '@/utils/memberAttendance'

const props = withDefaults(defineProps<{
  buckets: MonthBucket[]
  labels?: Record<Outcome, string>
}>(), { labels: () => outcomeLabels })

function total(bucket: MonthBucket): number {
  return OUTCOMES.reduce((sum, outcome) => sum + bucket[outcome], 0)
}

const max = computed(() => Math.max(1, ...props.buckets.map(total)))

function showYear(index: number): boolean {
  return index === 0 || props.buckets[index].key.slice(5, 7) === '01'
}

function labelSkipped(index: number): boolean {
  if (showYear(index)) return false
  if ((index > 0 && showYear(index - 1)) || (index < props.buckets.length - 1 && showYear(index + 1))) return true
  return index % 2 === 1
}

function bucketLabel(bucket: MonthBucket): string {
  const parts = OUTCOMES.filter((o) => bucket[o] > 0).map((o) => `${props.labels[o]}: ${bucket[o]}`)
  return `${bucket.label} ${bucket.key.slice(0, 4)}. ${parts.join(', ') || 'нет мероприятий'}`
}
</script>

<style scoped>
.mb-plot {
  position: relative;
  padding-top: 8px;
  border-top: 1px solid var(--ion-border-color);
}

.mb-max {
  position: absolute;
  top: -8px;
  left: 0;
  padding-right: 4px;
  background: var(--ion-card-background);
  font-size: var(--fs-2xs);
  color: var(--ion-color-medium);
  line-height: 1;
}

.mb-cols {
  display: flex;
  gap: 2px;
}

.mb-col {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  outline: none;
}

.mb-slot {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 120px;
  border-bottom: 1px solid var(--ion-border-color);
}

.mb-stack {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  width: min(24px, 70%);
}

.mb-seg {
  flex-basis: 0;
  min-height: 4px;
}

.mb-seg:last-child {
  border-radius: 4px 4px 0 0;
}

.mb-col:focus-visible .mb-slot {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

@media (hover: hover) {
  .mb-col:hover .mb-slot {
    background: rgba(var(--ion-color-primary-rgb), 0.06);
  }
}

.mb-label {
  margin-top: 4px;
  font-size: var(--fs-2xs);
  color: var(--ion-color-medium);
  text-align: center;
  text-transform: capitalize;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .mb-label--skip {
    visibility: hidden;
  }
}

.mb-year {
  display: block;
  font-size: var(--fs-2xs);
  opacity: 0.7;
}

.mb-tip {
  position: absolute;
  bottom: calc(100% - 8px);
  left: 50%;
  z-index: 5;
  display: none;
  flex-direction: column;
  gap: 3px;
  width: max-content;
  padding: 8px 10px;
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-sm);
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  font-size: var(--fs-xs);
  color: var(--ion-text-color);
  transform: translateX(-50%);
  pointer-events: none;
}

.mb-col:first-child .mb-tip {
  left: 0;
  transform: none;
}

.mb-col:last-child .mb-tip {
  right: 0;
  left: auto;
  transform: none;
}

.mb-col:focus-visible .mb-tip {
  display: flex;
}

@media (hover: hover) {
  .mb-col:hover .mb-tip {
    display: flex;
  }
}

.mb-tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
