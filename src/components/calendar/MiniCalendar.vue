<template>
  <div class="mini-calendar">
    <div class="mini-header">
      <ion-button fill="clear" size="small" @click="$emit('prevWeek')">
        <ion-icon :icon="chevronBackOutline" />
      </ion-button>
      <span class="mini-title">{{ weekLabel }}</span>
      <ion-button fill="clear" size="small" @click="$emit('nextWeek')">
        <ion-icon :icon="chevronForwardOutline" />
      </ion-button>
      <ion-button fill="clear" size="small" title="Полный календарь" @click="$emit('toggleFull')">
        <ion-icon :icon="expandOutline" />
      </ion-button>
    </div>
    <div class="mini-weekdays">
      <div v-for="d in weekDays" :key="d" class="mini-wd">{{ d }}</div>
    </div>
    <div class="mini-days">
      <div
        v-for="day in weekDaysRow"
        :key="day.date.getTime()"
        class="mini-day"
        @click="$emit('selectDay', day.date)"
      >
        <span
          class="mini-day-circle"
          :class="{
            'mini-day-circle--today': day.isToday,
            'mini-day-circle--selected': day.isSelected,
          }"
        >
          {{ day.dayNumber }}
        </span>
        <span class="mini-day-dot" :class="{ 'mini-day-dot--visible': day.hasEvents }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSettingsStore } from '@/stores/settings'
import { IonButton, IonIcon } from '@ionic/vue'
import { chevronBackOutline, chevronForwardOutline, expandOutline } from 'ionicons/icons'

const props = defineProps<{
  currentMonth: Date
  selectedDate: Date
  eventDates: Date[]
}>()

defineEmits<{
  selectDay: [date: Date]
  prevWeek: []
  nextWeek: []
  toggleFull: []
}>()

const settings = useSettingsStore()

const weekDays = computed(() => {
  if (settings.firstDayOfWeek === 'monday') return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
})

const weekStartsOn = computed(() => (settings.firstDayOfWeek === 'monday' ? 1 : 0) as 0 | 1)

// Заголовок описывает отображаемую неделю, в т.ч. на стыке месяцев
const weekLabel = computed(() => {
  const start = startOfWeek(props.selectedDate, { weekStartsOn: weekStartsOn.value })
  const end = endOfWeek(props.selectedDate, { weekStartsOn: weekStartsOn.value })
  if (isSameMonth(start, end)) {
    return format(start, 'LLLL yyyy', { locale: ru })
  }
  return `${format(start, 'LLL', { locale: ru })} — ${format(end, 'LLL yyyy', { locale: ru })}`
})

// Неделя строится вокруг выбранной даты
const weekDaysRow = computed(() => {
  const today = new Date()
  const weekStart = startOfWeek(props.selectedDate, { weekStartsOn: weekStartsOn.value })
  const weekEnd = endOfWeek(props.selectedDate, { weekStartsOn: weekStartsOn.value })
  return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((d) => ({
    date: d,
    dayNumber: d.getDate(),
    isToday: isSameDay(d, today),
    isSelected: isSameDay(d, props.selectedDate),
    hasEvents: props.eventDates.some((ed) => isSameDay(ed, d)),
  }))
})
</script>

<style scoped>
.mini-calendar {
  user-select: none;
}

.mini-header {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mini-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  text-transform: capitalize;
  color: var(--ion-text-color);
  text-align: center;
}

.mini-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--ion-color-medium);
  padding: 4px 0 2px;
}

.mini-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.mini-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 2px 0;
}

.mini-day-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-text-color);
  transition: background 0.15s, border-color 0.15s;
}

.mini-day:hover .mini-day-circle {
  background: var(--ion-color-step-50, #f4f5f8);
}

.mini-day-circle--today {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
  font-weight: 700;
}

.mini-day-circle--selected {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary);
  color: #fff;
  font-weight: 600;
}

.mini-day-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  margin-top: 1px;
  background: transparent;
}

.mini-day-dot--visible {
  background: var(--ion-color-primary);
}
</style>
