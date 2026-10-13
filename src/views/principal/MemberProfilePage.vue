<template>
  <div class="mp" :class="{ 'mp--refreshing': refreshing }">
    <button v-if="showBack" type="button" class="mp-back" @click="goBack">
      <ion-icon :icon="chevronBackOutline" />
      {{ backLabel }}
    </button>

    <template v-if="loading">
      <div class="ui-card mp-head" aria-hidden="true">
        <div class="mp-person">
          <span class="skeleton skeleton--circle" style="width: 56px; height: 56px" />
          <div class="mp-who">
            <span class="skeleton skeleton--text" style="width: 60%; height: 18px" />
            <span class="skeleton skeleton--text" style="width: 40%" />
          </div>
        </div>
      </div>
      <div class="mp-tiles" aria-hidden="true">
        <span v-for="n in 6" :key="n" class="skeleton mp-tile-skeleton" />
      </div>
      <span class="skeleton mp-card-skeleton" aria-hidden="true" />
    </template>

    <div v-else-if="notFound || forbidden || failed" class="ui-card mp-state">
      <ion-icon :icon="alertCircleOutline" class="mp-state-icon" />
      <p class="mp-state-text">{{ stateText }}</p>
      <div class="mp-state-actions">
        <button v-if="failed" type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="load">Повторить</button>
        <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="goBack">Назад</button>
      </div>
    </div>

    <template v-else-if="profile">
      <section class="ui-card mp-head">
        <div class="mp-person">
          <UserAvatar :user="{ username: initials }" :size="56" />
          <div class="mp-who">
            <h2 class="mp-name">{{ fullName }}</h2>
            <div class="mp-roles">
              <span v-for="role in profile.member.roles" :key="role.id" class="mp-role">{{ role.name }}</span>
              <span v-if="!profile.member.roles.length" class="mp-role mp-role--none">Без роли</span>
            </div>
            <p class="mp-since">
              {{ profile.member.is_active ? 'Активен' : 'Неактивен' }} · в коллективе с {{ since }}
            </p>
          </div>
          <div v-if="profile.can_manage" class="mp-actions">
            <button type="button" class="ui-icon-btn" title="Редактировать" aria-label="Редактировать" @click="editorOpen = true">
              <ion-icon :icon="pencilOutline" />
            </button>
            <button type="button" class="ui-icon-btn ui-icon-btn--danger" title="Удалить" aria-label="Удалить" @click="deleteOpen = true">
              <ion-icon :icon="trashOutline" />
            </button>
          </div>
        </div>
        <div class="mp-rate">
          <span class="mp-rate-value">{{ formatRate(summary.rate) }}</span>
          <span class="mp-rate-label">посещаемость · {{ periodLabel }}</span>
          <span class="mp-meter"><span class="mp-meter-fill ui-att--attended" :style="{ width: ratePercent }" /></span>
          <span class="mp-rate-sub">
            {{ summary.past ? `${summary.attended} из ${summary.past} прошедших мероприятий` : 'Прошедших мероприятий пока нет' }}
          </span>
        </div>
      </section>

      <section class="mp-tiles" aria-label="Сводка посещаемости">
        <div v-for="tile in tiles" :key="tile.key" class="mp-tile">
          <span class="mp-tile-label">
            <span v-if="tile.outcome" class="mp-dot" :class="`ui-att--${tile.outcome}`" />
            <ion-icon v-else :icon="tile.icon" />
            {{ tile.label }}
          </span>
          <span class="mp-tile-value">{{ tile.value }}</span>
          <span v-if="tile.sub" class="mp-tile-sub">{{ tile.sub }}</span>
        </div>
      </section>

      <section class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">Активность</h3>
          <div class="ui-chips">
            <button type="button" class="ui-chip" :class="{ 'ui-chip--active': view === 'year' }" @click="setView('year')">Год</button>
            <button type="button" class="ui-chip" :class="{ 'ui-chip--active': view === 'month' }" @click="setView('month')">Месяц</button>
          </div>
        </div>
        <div class="ui-chips mp-periods">
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
          :items="profile.items"
          :from="range.from"
          :to="range.to"
          :selected="selectedDay"
          :week-starts-on="weekStartsOn"
          @select="selectedDay = $event"
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

        <AttendanceLegend class="mp-legend" scale />

        <AttendanceHistory
          v-if="selectedDay"
          class="mp-day"
          :items="dayItems"
          :day="selectedDay"
          @clear-day="selectedDay = null"
          @open="openEvent"
        />
        <p v-else-if="!profile.items.length" class="mp-empty">В выбранном периоде у участника нет мероприятий</p>
      </section>

      <section class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">По месяцам</h3>
        </div>
        <MonthBars :buckets="buckets" />
        <AttendanceLegend class="mp-legend" />
      </section>

      <section v-if="profile.by_type.length" class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">По типам мероприятий</h3>
        </div>
        <TypeBars :groups="profile.by_type" />
      </section>

      <section class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">История посещений</h3>
          <span v-if="profile.items.length" class="mp-count">{{ profile.items.length }}</span>
        </div>
        <AttendanceHistory :items="profile.items" :day="null" @open="openEvent" />
      </section>

      <MemberEditorModal
        v-if="profile.can_manage"
        :is-open="editorOpen"
        :collective-id="profile.member.collective_id"
        :member="profile.member"
        :member-name="fullName"
        :roles="roles"
        @close="editorOpen = false"
        @saved="load"
      />
      <MemberDeleteAlert
        v-if="profile.can_manage"
        :is-open="deleteOpen"
        :collective-id="profile.member.collective_id"
        :member-id="profile.member.id"
        :member-name="fullName"
        @close="deleteOpen = false"
        @deleted="goBack"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IonIcon } from '@ionic/vue'
import {
  alertCircleOutline, chevronBackOutline, flameOutline, lockClosedOutline, pencilOutline, trashOutline,
} from 'ionicons/icons'
import { addMonths, isAfter, isBefore, startOfMonth } from 'date-fns'
import {
  getMemberProfileEventV2MembersMemberIdProfileGet,
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
} from '@/api/generated/almaEventFlow'
import type { MemberProfileRead, RoleRead } from '@/api/generated/almaEventFlow'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import AttendanceHeatmap from '@/components/member/AttendanceHeatmap.vue'
import AttendanceHistory from '@/components/member/AttendanceHistory.vue'
import AttendanceLegend from '@/components/member/AttendanceLegend.vue'
import MemberDeleteAlert from '@/components/member/MemberDeleteAlert.vue'
import MemberEditorModal from '@/components/member/MemberEditorModal.vue'
import MonthBars from '@/components/member/MonthBars.vue'
import TypeBars from '@/components/member/TypeBars.vue'
import { usePlatform } from '@/composables/usePlatform'
import { principalNavigateKey, principalReturnTo } from '@/composables/usePrincipalNavigate'
import { useSettingsStore } from '@/stores/settings'
import { usePrincipalStore } from '@/stores/principal'
import { formatDate } from '@/utils/date'
import { formatPersonName } from '@/utils/names'
import {
  dayKey, dayMarks as dayMarksOf, formatRate, groupByDay, monthSeries, periodRange, yearChips,
  type DayMark, type Outcome, type Period, type WeekStart,
} from '@/utils/memberAttendance'

const props = defineProps<{ memberId: string }>()

const MEMBERS_PATH = '/principal/members'
const DASHBOARD_PATH = '/principal/dashboard'
const NO_SELECTION = new Date(0)

const router = useRouter()
const panelNavigate = inject(principalNavigateKey, null)
const principal = usePrincipalStore()
const settings = useSettingsStore()

const profile = ref<MemberProfileRead | null>(null)
const roles = ref<RoleRead[]>([])
const editorOpen = ref(false)
const deleteOpen = ref(false)
const loading = ref(true)
const refreshing = ref(false)
const notFound = ref(false)
const forbidden = ref(false)
const failed = ref(false)

const period = ref<Period>('rolling')
const { isDesktop } = usePlatform()
const view = ref<'year' | 'month'>(isDesktop.value ? 'year' : 'month')
const selectedDay = ref<string | null>(null)
const calendarMonth = ref(new Date())

const today = new Date()
const weekStartsOn = computed<WeekStart>(() => (settings.firstDayOfWeek === 'monday' ? 1 : 0))
const range = computed(() => periodRange(period.value, today, weekStartsOn.value))

const stateText = computed(() => {
  if (notFound.value) return 'Участник не найден'
  if (forbidden.value) return 'Профиль участника доступен только руководителю и участникам его коллектива'
  return 'Не удалось загрузить профиль'
})

const summary = computed(() => profile.value!.summary)
const fullName = computed(() => (profile.value ? formatPersonName(profile.value.person) : ''))
const initials = computed(() => {
  const person = profile.value?.person
  return person ? `${person.surname[0] ?? ''}${person.name[0] ?? ''}` : ''
})
const since = computed(() => (profile.value ? formatDate(profile.value.member.created_at, settings.dateFormat) : ''))
const ratePercent = computed(() => `${Math.round((summary.value.rate ?? 0) * 100)}%`)
const periodLabel = computed(() => (period.value === 'rolling' ? 'за 12 месяцев' : `за ${period.value} год`))
const yearOptions = computed(() => yearChips(profile.value?.years ?? [], period.value))

const days = computed(() => groupByDay(profile.value?.items ?? []))
const dayMarks = computed(() => {
  const marks: Record<string, DayMark[]> = {}
  for (const [key, day] of days.value) marks[key] = dayMarksOf(day)
  return marks
})
const dayItems = computed(() => days.value.get(selectedDay.value ?? '')?.items ?? [])
const selectedDate = computed(() => (selectedDay.value ? new Date(`${selectedDay.value}T00:00:00`) : NO_SELECTION))
const buckets = computed(() => monthSeries(range.value.from, range.value.to, profile.value?.by_month ?? []))

const canPrevMonth = computed(() => isAfter(startOfMonth(calendarMonth.value), startOfMonth(range.value.from)))
const canNextMonth = computed(() => isBefore(startOfMonth(calendarMonth.value), startOfMonth(range.value.to)))

interface Tile {
  key: string
  label: string
  value: number
  sub?: string
  outcome?: Outcome
  icon?: string
}

const tiles = computed<Tile[]>(() => {
  const s = summary.value
  return [
    { key: 'attended', label: 'Присутствовал', value: s.attended, outcome: 'attended' },
    { key: 'absent', label: 'Отсутствовал', value: s.absent, outcome: 'absent' },
    { key: 'unmarked', label: 'Не отмечено', value: s.unmarked, outcome: 'unmarked', sub: s.unmarked ? 'нужна отметка' : '' },
    { key: 'upcoming', label: 'Предстоит', value: s.upcoming, outcome: 'upcoming' },
    { key: 'streak', label: 'Серия подряд', value: s.current_streak, icon: flameOutline, sub: `рекорд: ${s.longest_streak}` },
    { key: 'verified', label: 'Заверено', value: s.verified, icon: lockClosedOutline, sub: `из ${s.past}` },
  ]
})

let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  refreshing.value = true
  failed.value = false
  try {
    const res = await getMemberProfileEventV2MembersMemberIdProfileGet(
      props.memberId,
      { date_from: dayKey(range.value.from), date_to: dayKey(range.value.to) },
    )
    if (seq !== loadSeq) return
    profile.value = res.data
    notFound.value = false
    forbidden.value = false
    if (res.data.can_manage && !roles.value.length) loadRoles(res.data.member.collective_id)
  } catch (err) {
    if (seq !== loadSeq) return
    const status = (err as { response?: { status?: number } })?.response?.status
    notFound.value = status === 404
    forbidden.value = status === 403
    failed.value = !notFound.value && !forbidden.value
  } finally {
    if (seq === loadSeq) {
      loading.value = false
      refreshing.value = false
    }
  }
}

async function loadRoles(collectiveId: string) {
  try {
    const res = await getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet(collectiveId, { limit: 100 })
    roles.value = res.data.items
  } catch {
    roles.value = []
  }
}

function defaultMonth(): Date {
  const { from, to } = range.value
  if (!isBefore(today, from) && !isAfter(today, to)) return today
  return isBefore(today, from) ? from : to
}

function setView(next: 'year' | 'month') {
  view.value = next
  if (next === 'month') {
    calendarMonth.value = selectedDay.value ? new Date(`${selectedDay.value}T00:00:00`) : defaultMonth()
  }
}

function onSelectDay(date: Date) {
  const key = dayKey(date)
  selectedDay.value = selectedDay.value === key ? null : key
}

function shiftMonth(delta: number) {
  calendarMonth.value = addMonths(calendarMonth.value, delta)
}

const backPath = computed(() => (principalReturnTo.value === DASHBOARD_PATH ? DASHBOARD_PATH : MEMBERS_PATH))
const showBack = computed(() => !!panelNavigate || isDesktop.value)

const backLabel = computed(() => {
  if (!panelNavigate) return 'Назад'
  return backPath.value === DASHBOARD_PATH ? 'Дашборд' : 'Участники'
})

function goBack() {
  if (panelNavigate) panelNavigate(backPath.value)
  else if (window.history.state?.back) router.back()
  else router.replace('/')
}

function openEvent(eventId: string) {
  router.push(`/event/${eventId}`)
}

watch(period, () => {
  selectedDay.value = null
  calendarMonth.value = defaultMonth()
  load()
})

watch(() => principal.activePrincipalCollectiveId, (id, previous) => {
  if (panelNavigate && previous && id !== previous) goBack()
})

onMounted(load)
</script>

<style scoped>
.mp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 32px;
  transition: opacity 0.15s;
}

.mp--refreshing {
  opacity: 0.6;
}

.mp-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  align-self: flex-start;
  padding: 4px 8px 4px 0;
  border: none;
  background: transparent;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  cursor: pointer;
}

.mp-back:hover {
  color: var(--ion-color-primary);
}

.mp-head {
  display: grid;
  gap: 16px;
}

.mp-person {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.mp-who {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.mp-name {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}

.mp-actions {
  display: flex;
  align-self: flex-start;
  flex-shrink: 0;
  gap: 2px;
}

.mp-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mp-role {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
}

.mp-role--none {
  background: var(--ion-color-step-50, var(--ion-color-light));
  color: var(--ion-color-medium);
}

.mp-since {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.mp-rate {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mp-rate-value {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  line-height: 1.1;
  color: var(--ion-text-color);
}

.mp-rate-label {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.mp-meter {
  display: block;
  height: 8px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: rgba(var(--att-attended-rgb), 0.18);
}

.mp-meter-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
}

.mp-rate-sub {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.mp-tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.mp-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.mp-tile-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.mp-tile-label ion-icon {
  font-size: var(--fs-md);
}

.mp-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 25%;
}

.mp-tile-value {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  line-height: 1.1;
  color: var(--ion-text-color);
}

.mp-tile-sub {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.mp-tile-skeleton {
  height: 78px;
  border-radius: var(--radius-lg);
}

.mp-card-skeleton {
  display: block;
  height: 200px;
  border-radius: var(--radius-lg);
}

.mp-periods {
  margin-bottom: 14px;
}

.mp-legend {
  margin-top: 12px;
}

.mp-day {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--ion-border-color);
}

.mp-empty {
  margin: 12px 0 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.mp-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
}

.mp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 16px;
  text-align: center;
}

.mp-state-icon {
  font-size: var(--icon-hero);
  color: var(--ion-color-medium);
}

.mp-state-text {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.mp-state-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

@media (min-width: 768px) {
  .mp-head {
    grid-template-columns: 1fr minmax(200px, 260px);
    align-items: center;
  }

  .mp-tiles {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
