import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { periodRange, type Period, type WeekStart } from '@/utils/memberAttendance'

export function useAttendancePeriod() {
  const settings = useSettingsStore()
  const today = new Date()
  const period = ref<Period>('rolling')
  const weekStartsOn = computed<WeekStart>(() => (settings.firstDayOfWeek === 'monday' ? 1 : 0))
  const range = computed(() => periodRange(period.value, today, weekStartsOn.value))
  const periodLabel = computed(() => (period.value === 'rolling' ? 'за 12 месяцев' : `за ${period.value} год`))

  return { today, period, weekStartsOn, range, periodLabel }
}
