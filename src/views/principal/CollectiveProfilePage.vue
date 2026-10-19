<template>
  <div class="cp" :class="{ 'cp--refreshing': refreshing }">
    <BackLink v-if="showBack" label="Назад" @click="goBack" />

    <template v-if="loading">
      <section class="ui-card" aria-hidden="true">
        <div class="cp-skeleton-who">
          <span class="skeleton skeleton--circle" style="width: 56px; height: 56px" />
          <div class="cp-skeleton-text">
            <span class="skeleton skeleton--text" style="width: 60%; height: 18px" />
            <span class="skeleton skeleton--text" style="width: 40%" />
          </div>
        </div>
      </section>
      <AttendanceTiles loading />
      <span class="skeleton cp-card-skeleton" aria-hidden="true" />
    </template>

    <PageState v-else-if="notFound || forbidden || failed" :text="stateText">
      <button v-if="failed" type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="load">Повторить</button>
      <button v-if="showBack" type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="goBack">Назад</button>
    </PageState>

    <template v-else-if="profile">
      <AttendanceHead :rate="summary.rate" :period-label="periodLabel" :sub="rateSub">
        <ProfileWho :name="profile.collective.name" :tags="tags">
          <template #avatar>
            <span class="cp-mark" :style="{ background: color }">{{ initials }}</span>
          </template>
          <template #sub>
            <p class="cp-sub">
              Руководитель: {{ leader }} · участников: {{ profile.collective.active_members }}
            </p>
          </template>
        </ProfileWho>
      </AttendanceHead>

      <AttendanceTiles :tiles="tiles" />

      <AttendanceActivity
        v-model:period="period"
        v-model:day="selectedDay"
        :days="days"
        :years="profile.years"
        :range="range"
        :today="today"
        :week-starts-on="weekStartsOn"
        :scale-labels="SCALE_LABELS"
      >
        <template #day>
          <CollectiveEventList :events="profile.events" :day="selectedDay" @clear-day="selectedDay = null" @open="openEvent" />
        </template>
        <template #empty>
          <p v-if="!profile.events.length" class="cp-empty">В выбранном периоде у коллектива нет мероприятий</p>
        </template>
      </AttendanceActivity>

      <section class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">По месяцам</h3>
        </div>
        <MonthBars :buckets="buckets" :labels="collectiveOutcomeLabels" />
        <AttendanceLegend class="cp-legend" :labels="collectiveOutcomeLabels" />
      </section>

      <section v-if="profile.by_type.length" class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">По типам мероприятий</h3>
        </div>
        <TypeBars :groups="profile.by_type" :labels="collectiveOutcomeLabels" />
      </section>

      <section class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">Участники</h3>
          <span v-if="profile.members.length" class="ui-count">{{ profile.members.length }}</span>
        </div>
        <CollectiveMemberList :members="profile.members" @open="openMember" />
      </section>

      <section class="ui-card">
        <div class="ui-card-head">
          <h3 class="ui-card-title">Мероприятия</h3>
          <span v-if="profile.events.length" class="ui-count">{{ profile.events.length }}</span>
        </div>
        <CollectiveEventList :events="profile.events" :day="null" @open="openEvent" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { calendarOutline, lockClosedOutline } from 'ionicons/icons'
import { getCollectiveProfileEventV2CollectivesCollectiveIdProfileGet } from '@/api/generated/almaEventFlow'
import type { CollectiveProfileRead } from '@/api/generated/almaEventFlow'
import BackLink from '@/components/common/BackLink.vue'
import PageState from '@/components/common/PageState.vue'
import CollectiveEventList from '@/components/collective/CollectiveEventList.vue'
import CollectiveMemberList from '@/components/collective/CollectiveMemberList.vue'
import AttendanceActivity from '@/components/member/AttendanceActivity.vue'
import AttendanceHead from '@/components/member/AttendanceHead.vue'
import AttendanceLegend from '@/components/member/AttendanceLegend.vue'
import AttendanceTiles, { type AttendanceTile } from '@/components/member/AttendanceTiles.vue'
import MonthBars from '@/components/member/MonthBars.vue'
import ProfileWho, { type ProfileTag } from '@/components/member/ProfileWho.vue'
import TypeBars from '@/components/member/TypeBars.vue'
import { useAttendancePeriod } from '@/composables/useAttendancePeriod'
import { usePlatform } from '@/composables/usePlatform'
import { principalNavigateKey } from '@/composables/usePrincipalNavigate'
import { getCollectiveColor } from '@/utils/colors'
import { collectiveDays, collectiveOutcomeLabels, dayKey, monthSeries } from '@/utils/memberAttendance'
import { formatPersonName } from '@/utils/names'

const props = defineProps<{ collectiveId: string | null }>()

const SCALE_LABELS: [string, string] = ['Пришли все', 'Не пришёл никто']

const router = useRouter()
const panelNavigate = inject(principalNavigateKey, null)
const { isDesktop } = usePlatform()
const { today, period, weekStartsOn, range, periodLabel } = useAttendancePeriod()

const profile = ref<CollectiveProfileRead | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const notFound = ref(false)
const forbidden = ref(false)
const failed = ref(false)
const selectedDay = ref<string | null>(null)

const stateText = computed(() => {
  if (notFound.value) return 'Коллектив не найден'
  if (forbidden.value) return 'Профиль коллектива доступен только его руководителю и участникам'
  return 'Не удалось загрузить профиль'
})

const summary = computed(() => profile.value!.summary)
const color = computed(() => getCollectiveColor(profile.value?.collective.id ?? ''))
const initials = computed(() => (profile.value?.collective.name ?? '').slice(0, 2).toUpperCase())
const leader = computed(() => {
  const principal = profile.value?.collective.principal
  return principal ? formatPersonName(principal) : 'не назначен'
})
const tags = computed<ProfileTag[]>(() => [
  profile.value?.collective.is_verified
    ? { label: 'Подтверждён' }
    : { label: 'Не подтверждён', muted: true },
])
const rateSub = computed(() =>
  summary.value.past
    ? `${summary.value.attended} из ${summary.value.past} мест на прошедших мероприятиях`
    : 'Прошедших мероприятий пока нет',
)

const days = computed(() => collectiveDays(profile.value?.days ?? [], profile.value?.events ?? []))
const buckets = computed(() => monthSeries(range.value.from, range.value.to, profile.value?.by_month ?? []))

const tiles = computed<AttendanceTile[]>(() => {
  const s = summary.value
  return [
    { key: 'attended', label: 'Присутствий', value: s.attended, outcome: 'attended' },
    { key: 'absent', label: 'Отсутствий', value: s.absent, outcome: 'absent' },
    { key: 'unmarked', label: 'Не отмечено', value: s.unmarked, outcome: 'unmarked', sub: s.unmarked ? 'нужна отметка' : '' },
    { key: 'upcoming', label: 'Предстоит', value: s.upcoming, outcome: 'upcoming' },
    { key: 'events', label: 'Мероприятий', value: s.events, icon: calendarOutline, sub: `участников: ${profile.value!.collective.active_members}` },
    { key: 'verified', label: 'Заверено', value: s.verified, icon: lockClosedOutline, sub: `из ${s.past}` },
  ]
})

let loadSeq = 0

async function load() {
  if (!props.collectiveId) {
    loading.value = false
    notFound.value = true
    return
  }
  const seq = ++loadSeq
  refreshing.value = true
  failed.value = false
  try {
    const res = await getCollectiveProfileEventV2CollectivesCollectiveIdProfileGet(
      props.collectiveId,
      { date_from: dayKey(range.value.from), date_to: dayKey(range.value.to) },
    )
    if (seq !== loadSeq) return
    profile.value = res.data
    notFound.value = false
    forbidden.value = false
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

const showBack = computed(() => !panelNavigate && isDesktop.value)

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/')
}

function openEvent(eventId: string) {
  router.push(`/event/${eventId}`)
}

function openMember(memberId: string) {
  if (panelNavigate) panelNavigate(`/principal/members/${memberId}`)
  else router.push(`/member/${memberId}`)
}

watch(period, load)
watch(() => props.collectiveId, () => {
  profile.value = null
  loading.value = true
  selectedDay.value = null
  load()
})

onMounted(load)
</script>

<style scoped>
.cp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 32px;
  transition: opacity 0.15s;
}

.cp--refreshing {
  opacity: 0.6;
}

.cp-skeleton-who {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cp-skeleton-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.cp-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  font-size: var(--fs-xl);
  font-weight: var(--fw-bold);
  color: var(--ion-color-primary-contrast);
}

.cp-sub {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.cp-card-skeleton {
  display: block;
  height: 200px;
  border-radius: var(--radius-lg);
}

.cp-legend {
  margin-top: 12px;
}

.cp-empty {
  margin: 12px 0 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}
</style>
