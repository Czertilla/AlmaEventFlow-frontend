<template>
  <section class="ui-card">
    <div class="ui-card-head">
      <h3 class="ui-card-title">Активность</h3>
      <div class="ui-chips">
        <button type="button" class="ui-chip" :class="{ 'ui-chip--active': view === 'year' }" @click="setView('year')">Год</button>
        <button type="button" class="ui-chip" :class="{ 'ui-chip--active': view === 'month' }" @click="setView('month')">Месяц</button>
      </div>
    </div>
    <div class="ui-chips aa-periods">
      <button type="button" class="ui-chip" :class="{ 'ui-chip--active': period === 'rolling' }" @click="period = 'rolling'">12 месяцев</button>
      <button
        v-for="year in yearOptions"
        :key="year"
        type="button"
        class="ui-chip"
        :class="{ 'ui-chip--active': period === year }"
        @click="period = year"
      >
        {{ year }}
      </button>
    </div>

    <AttendanceHeatmap
      v-if="view === 'year'"
      :days="days"
      :from="range.from"
      :to="range.to"
      :selected="day"
      :week-starts-on="weekStartsOn"
      @select="day = $event"
    />
    <CalendarGrid
      v-else
      :current-month="calendarMonth"
      :selected-date="selectedDate"
      :event-dates="[]"
      :day-marks="dayMarks"
      :can-prev="canPrevMonth"
      :can-next="canNextMonth"
      @select-day="onSelectDay"
      @prev-month="shiftMonth(-1)"
      @next-month="shiftMonth(1)"
    />

    <AttendanceLegend class="aa-legend" scale :scale-labels="scaleLabels" />

    <div v-if="day" class="aa-day">
      <slot name="day" />
    </div>
    <slot v-else name="empty" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addMonths, isAfter, isBefore, startOfMonth } from 'date-fns'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import AttendanceHeatmap from '@/components/member/AttendanceHeatmap.vue'
import AttendanceLegend from '@/components/member/AttendanceLegend.vue'
import { usePlatform } from '@/composables/usePlatform'
import {
  dayKey, dayMarks as dayMarksOf, outcomeLabels, yearChips,
  type DayMark, type DaySummary, type Period, type WeekStart,
} from '@/utils/memberAttendance'

const props = withDefaults(defineProps<{
  days: Map<string, DaySummary>
  years: number[]
  range: { from: Date; to: Date }
  today: Date
  weekStartsOn: WeekStart
  scaleLabels?: [string, string]
}>(), { scaleLabels: () => [outcomeLabels.attended, outcomeLabels.absent] })

const period = defineModel<Period>('period', { required: true })
const day = defineModel<string | null>('day', { required: true })

const NO_SELECTION = new Date(0)
const { isDesktop } = usePlatform()

const view = ref<'year' | 'month'>(isDesktop.value ? 'year' : 'month')
const calendarMonth = ref(new Date())

const yearOptions = computed(() => yearChips(props.years, period.value))

const dayMarks = computed(() => {
  const marks: Record<string, DayMark[]> = {}
  for (const [key, summary] of props.days) marks[key] = dayMarksOf(summary)
  return marks
})

const selectedDate = computed(() => (day.value ? new Date(`${day.value}T00:00:00`) : NO_SELECTION))
const canPrevMonth = computed(() => isAfter(startOfMonth(calendarMonth.value), startOfMonth(props.range.from)))
const canNextMonth = computed(() => isBefore(startOfMonth(calendarMonth.value), startOfMonth(props.range.to)))

function defaultMonth(): Date {
  const { from, to } = props.range
  if (!isBefore(props.today, from) && !isAfter(props.today, to)) return props.today
  return isBefore(props.today, from) ? from : to
}

function setView(next: 'year' | 'month') {
  view.value = next
  if (next === 'month') {
    calendarMonth.value = day.value ? new Date(`${day.value}T00:00:00`) : defaultMonth()
  }
}

function onSelectDay(date: Date) {
  const key = dayKey(date)
  day.value = day.value === key ? null : key
}

function shiftMonth(delta: number) {
  calendarMonth.value = addMonths(calendarMonth.value, delta)
}

watch(period, () => {
  day.value = null
  calendarMonth.value = defaultMonth()
})
</script>

<style scoped>
.aa-periods {
  margin-bottom: 14px;
}

.aa-legend {
  margin-top: 12px;
}

.aa-day {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--ion-border-color);
}
</style>
