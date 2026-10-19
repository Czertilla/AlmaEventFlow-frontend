<template>
  <div class="cel">
    <div v-if="day" class="ui-banner cel-day">
      <span>{{ dayTitle(day) }}</span>
      <button type="button" class="ui-icon-btn" aria-label="Показать все дни" @click="emit('clearDay')">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>

    <ul v-if="visible.length" class="cel-list">
      <li v-for="event in visible" :key="event.event_id">
        <button type="button" class="cel-row" @click="emit('open', event.event_id)">
          <span class="cel-main">
            <span class="cel-name">{{ event.event_name }}</span>
            <span class="cel-meta">
              {{ formatDate(new Date(`${event.date}T00:00:00`), settings.dateFormat) }}<template v-if="event.type"> · {{ typeLabels[event.type] }}</template>
            </span>
          </span>
          <span class="cel-stat">
            <span class="cel-rate">{{ eventRateLabel(event) }}</span>
            <span class="cel-track" aria-hidden="true">
              <template v-for="outcome in OUTCOMES" :key="outcome">
                <span
                  v-if="event[outcome] > 0"
                  class="cel-seg"
                  :class="`ui-att--${outcome}`"
                  :style="{ flexGrow: event[outcome] }"
                  :title="`${outcomeLabels[outcome]}: ${event[outcome]}`"
                />
              </template>
            </span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="cel-empty">Мероприятий нет</p>

    <button v-if="rest > 0" type="button" class="ui-btn ui-btn--ghost ui-btn--sm cel-more" @click="limit += PAGE">
      Показать ещё {{ Math.min(rest, PAGE) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import type { CollectiveEventItem } from '@/api/generated/almaEventFlow'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import { typeLabels } from '@/utils/eventLabels'
import { OUTCOMES, dayTitle, eventRateLabel, outcomeLabels } from '@/utils/memberAttendance'

const props = defineProps<{
  events: CollectiveEventItem[]
  day: string | null
}>()

const emit = defineEmits<{
  clearDay: []
  open: [eventId: string]
}>()

const PAGE = 10
const settings = useSettingsStore()
const limit = ref(PAGE)

const base = computed(() => (props.day ? props.events.filter((event) => event.date === props.day) : props.events))
const visible = computed(() => base.value.slice(0, limit.value))
const rest = computed(() => base.value.length - visible.value.length)

watch([() => props.day, () => props.events], () => { limit.value = PAGE })
</script>

<style scoped>
.cel-day {
  margin-bottom: 10px;
}

.cel-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cel-list > li + li {
  border-top: 1px solid var(--ion-border-color);
}

.cel-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.cel-row:hover .cel-name {
  color: var(--ion-color-primary);
}

.cel-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cel-name {
  overflow: hidden;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cel-meta {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.cel-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  width: 96px;
}

.cel-rate {
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.cel-track {
  display: flex;
  gap: 2px;
  width: 100%;
  height: 8px;
}

.cel-seg {
  flex-basis: 0;
  min-width: 4px;
}

.cel-seg:last-child {
  border-radius: 0 4px 4px 0;
}

.cel-empty {
  margin: 0;
  padding: 16px 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
  text-align: center;
}

.cel-more {
  margin: 8px auto 0;
}
</style>
