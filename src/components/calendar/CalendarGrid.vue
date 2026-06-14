<template>
  <div class="calendar-grid">
    <div class="calendar-header">
      <ion-button fill="clear" @click="$emit('prevMonth')">
        <ion-icon :icon="chevronBackOutline" />
      </ion-button>
      <span class="calendar-title">{{ monthYearLabel }}</span>
      <ion-button fill="clear" @click="$emit('nextMonth')">
        <ion-icon :icon="chevronForwardOutline" />
      </ion-button>
    </div>
    <div class="calendar-weekdays">
      <div v-for="d in weekDays" :key="d" class="weekday">{{ d }}</div>
    </div>
    <div class="calendar-days">
      <div
        v-for="(day, i) in days"
        :key="i"
        class="day-cell"
        :class="{ 'day-cell--muted': !day.isCurrentMonth }"
        @click="$emit('selectDay', day.date)"
      >
        <!-- Круг фиксированного размера: не растягивается вместе с ячейкой -->
        <span
          class="day-circle"
          :class="{
            'day-circle--today': day.isToday,
            'day-circle--selected': day.isSelected,
          }"
        >
          {{ day.dayNumber }}
        </span>
        <span class="day-dot" :class="{ 'day-dot--visible': day.hasEvents }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, format,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSettingsStore } from '@/stores/settings'
import { IonButton, IonIcon } from '@ionic/vue'
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons'

const props = defineProps<{
  currentMonth: Date
  selectedDate: Date
  eventDates: Date[]
}>()

defineEmits<{
  selectDay: [date: Date]
  prevMonth: []
  nextMonth: []
}>()

const settings = useSettingsStore()

const weekDays = computed(() => {
  if (settings.firstDayOfWeek === 'monday') return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
})

const monthYearLabel = computed(() =>
  format(props.currentMonth, 'LLLL yyyy', { locale: ru }),
)

const days = computed(() => {
  const monthStart = startOfMonth(props.currentMonth)
  const monthEnd = endOfMonth(props.currentMonth)
  const weekStartsOn = settings.firstDayOfWeek === 'monday' ? 1 : 0
  const calStart = startOfWeek(monthStart, { weekStartsOn })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn })
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd })
  const today = new Date()
  return allDays.map((d) => ({
    date: d,
    dayNumber: d.getDate(),
    isCurrentMonth: isSameMonth(d, props.currentMonth),
    isToday: isSameDay(d, today),
    isSelected: isSameDay(d, props.selectedDate),
    hasEvents: props.eventDates.some((ed) => isSameDay(ed, d)),
  }))
})
</script>

<style scoped>
.calendar-grid {
  user-select: none;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.calendar-title {
  font-weight: 600;
  font-size: 15px;
  text-transform: capitalize;
  color: var(--ion-text-color);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--ion-color-medium);
  padding: 4px 0;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 1px 0 3px;
}

.day-cell--muted {
  opacity: 0.35;
}

.day-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-text-color);
  transition: background 0.15s, border-color 0.15s;
}

.day-cell:hover .day-circle {
  background: var(--ion-color-step-50, #f4f5f8);
}

/* Текущая дата — тонкая обводка (ТЗ) */
.day-circle--today {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
  font-weight: 700;
}

/* Выбранная дата — обводка с заливкой (ТЗ) */
.day-circle--selected {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary);
  color: #fff;
  font-weight: 600;
}

.day-cell:hover .day-circle--selected {
  background: var(--ion-color-primary-shade);
}

.day-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-top: 1px;
  background: transparent;
}

.day-dot--visible {
  background: var(--ion-color-primary);
}
</style>
