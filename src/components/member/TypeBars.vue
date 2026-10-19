<template>
  <ul class="tb">
    <li v-for="row in rows" :key="row.key" class="tb-row">
      <span class="tb-name">{{ row.label }}</span>
      <span class="tb-track">
        <span class="tb-stack" :style="{ width: `${(row.total / max) * 100}%` }">
          <template v-for="outcome in OUTCOMES" :key="outcome">
            <span
              v-if="row[outcome] > 0"
              class="tb-seg"
              :class="`ui-att--${outcome}`"
              :style="{ flexGrow: row[outcome] }"
              :title="`${labels[outcome]}: ${row[outcome]}`"
            />
          </template>
        </span>
      </span>
      <span class="tb-value">{{ row.value }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AttendanceByType } from '@/api/generated/almaEventFlow'
import { typeLabels } from '@/utils/eventLabels'
import { OUTCOMES, outcomeLabels, type Outcome } from '@/utils/memberAttendance'

const props = withDefaults(defineProps<{
  groups: AttendanceByType[]
  labels?: Record<Outcome, string>
}>(), { labels: () => outcomeLabels })

const rows = computed(() =>
  props.groups.map((row) => {
    const past = row.attended + row.absent + row.unmarked
    return {
      ...row,
      key: row.type ?? 'none',
      label: row.type ? typeLabels[row.type] : 'Без типа',
      total: past + row.upcoming,
      value: past ? `${row.attended} из ${past}` : `предстоит ${row.upcoming}`,
    }
  }),
)

const max = computed(() => Math.max(1, ...rows.value.map((row) => row.total)))
</script>

<style scoped>
.tb {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tb-row {
  display: grid;
  grid-template-columns: minmax(84px, 120px) 1fr auto;
  align-items: center;
  gap: 10px;
}

.tb-name {
  overflow: hidden;
  font-size: var(--fs-sm);
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tb-track {
  display: block;
  min-width: 0;
}

.tb-stack {
  display: flex;
  gap: 2px;
  height: 10px;
  min-width: 4px;
}

.tb-seg {
  flex-basis: 0;
  min-width: 4px;
}

.tb-seg:last-child {
  border-radius: 0 4px 4px 0;
}

@media (max-width: 767px) {
  .tb-row {
    grid-template-columns: minmax(72px, 92px) 1fr auto;
  }
}

.tb-value {
  min-width: 64px;
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-medium);
  text-align: right;
}
</style>
