<template>
  <div class="ah">
    <div v-if="day" class="ah-day">
      <span class="ah-day-text">{{ dayTitle(day) }}</span>
      <button type="button" class="ui-icon-btn" aria-label="Показать все дни" @click="emit('clearDay')">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>

    <div v-if="presentOutcomes.length > 1" class="ui-chips ah-filters">
      <button
        type="button"
        class="ui-chip"
        :class="{ 'ui-chip--active': filter === 'all' }"
        @click="filter = 'all'"
      >
        Все · {{ base.length }}
      </button>
      <button
        v-for="outcome in presentOutcomes"
        :key="outcome"
        type="button"
        class="ui-chip"
        :class="{ 'ui-chip--active': filter === outcome }"
        @click="filter = outcome"
      >
        {{ outcomeLabels[outcome] }} · {{ counts[outcome] }}
      </button>
    </div>

    <ul v-if="visible.length" class="ah-list">
      <li v-for="item in visible" :key="item.attendance_id">
        <button type="button" class="ah-row" @click="emit('open', item.event_id)">
          <ion-icon :icon="outcomeIcons[item.outcome]" class="ah-icon" :class="`ui-att-ink--${item.outcome}`" />
          <span class="ah-main">
            <span class="ah-name">{{ item.event_name }}</span>
            <span class="ah-meta">
              {{ formatDate(new Date(`${item.date}T00:00:00`), settings.dateFormat) }}<template v-if="item.type"> · {{ typeLabels[item.type] }}</template>
            </span>
            <span v-if="item.comment" class="ah-comment">
              <ion-icon :icon="chatbubbleOutline" />
              <span class="ah-comment-text">{{ item.comment }}</span>
            </span>
          </span>
          <span class="ah-state">
            <ion-icon v-if="item.is_verified" :icon="lockClosedOutline" title="Заверено" />
            {{ outcomeLabels[item.outcome] }}
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="ah-empty">Мероприятий нет</p>

    <button v-if="rest > 0" type="button" class="ui-btn ui-btn--ghost ui-btn--sm ah-more" @click="limit += PAGE">
      Показать ещё {{ Math.min(rest, PAGE) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { chatbubbleOutline, closeOutline, lockClosedOutline } from 'ionicons/icons'
import type { MemberAttendanceItem } from '@/api/generated/almaEventFlow'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import { typeLabels } from '@/utils/eventLabels'
import {
  OUTCOMES, dayTitle, emptyCounts, outcomeIcons, outcomeLabels, type Outcome,
} from '@/utils/memberAttendance'

const props = defineProps<{
  items: MemberAttendanceItem[]
  day: string | null
}>()

const emit = defineEmits<{
  clearDay: []
  open: [eventId: string]
}>()

const PAGE = 10
const settings = useSettingsStore()

const filter = ref<Outcome | 'all'>('all')
const limit = ref(PAGE)

const base = computed(() => (props.day ? props.items.filter((item) => item.date === props.day) : props.items))

const counts = computed(() => {
  const found = emptyCounts()
  for (const item of base.value) found[item.outcome] += 1
  return found
})

const presentOutcomes = computed(() => OUTCOMES.filter((outcome) => counts.value[outcome] > 0))

const filtered = computed(() =>
  filter.value === 'all' ? base.value : base.value.filter((item) => item.outcome === filter.value),
)

const visible = computed(() => filtered.value.slice(0, limit.value))
const rest = computed(() => filtered.value.length - visible.value.length)

watch([() => props.day, () => props.items], () => {
  limit.value = PAGE
  if (filter.value !== 'all' && counts.value[filter.value] === 0) filter.value = 'all'
})
watch(filter, () => { limit.value = PAGE })
</script>

<style scoped>
.ah-day {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 6px 6px 12px;
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
}

.ah-filters {
  margin-bottom: 8px;
}

.ah-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ah-list > li + li {
  border-top: 1px solid var(--ion-border-color);
}

.ah-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 10px;
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ah-row:hover .ah-name {
  color: var(--ion-color-primary);
}

.ah-icon {
  margin-top: 1px;
  font-size: var(--fs-xl);
}

.ah-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ah-name {
  overflow: hidden;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-meta {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.ah-comment {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.ah-comment ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.ah-comment-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ah-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  white-space: nowrap;
}

@media (max-width: 767px) {
  .ah-row {
    grid-template-columns: auto 1fr;
  }

  .ah-state {
    grid-column: 2;
  }
}

.ah-empty {
  margin: 0;
  padding: 16px 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
  text-align: center;
}

.ah-more {
  margin: 8px auto 0;
}
</style>
