<template>
  <div class="mp" :class="{ 'mp--refreshing': refreshing }">
    <BackLink v-if="showBack" :label="backLabel" @click="goBack" />

    <template v-if="loading">
      <section class="ui-card" aria-hidden="true">
        <div class="mp-skeleton-person">
          <span class="skeleton skeleton--circle" style="width: 56px; height: 56px" />
          <div class="mp-skeleton-who">
            <span class="skeleton skeleton--text" style="width: 60%; height: 18px" />
            <span class="skeleton skeleton--text" style="width: 40%" />
          </div>
        </div>
      </section>
      <AttendanceTiles loading />
      <span class="skeleton mp-card-skeleton" aria-hidden="true" />
    </template>

    <PageState v-else-if="notFound || forbidden || failed" :text="stateText">
      <button v-if="failed" type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="load">Повторить</button>
      <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="goBack">Назад</button>
    </PageState>

    <template v-else-if="profile">
      <AttendanceHead :rate="summary.rate" :period-label="periodLabel" :sub="rateSub">
        <ProfileWho :name="fullName" :tags="roleTags">
          <template #avatar>
            <UserAvatar :user="{ username: initials }" :size="56" />
          </template>
          <template #sub>
            <p class="mp-since">
              {{ profile.member.is_active ? 'Активен' : 'Неактивен' }} · в коллективе с {{ since }} ·
              <button type="button" class="mp-collective" @click="openCollective">{{ collectiveName }}</button>
            </p>
          </template>
          <template v-if="profile.can_manage" #actions>
            <button type="button" class="ui-icon-btn" title="Редактировать" aria-label="Редактировать" @click="editorOpen = true">
              <ion-icon :icon="pencilOutline" />
            </button>
            <button type="button" class="ui-icon-btn ui-icon-btn--danger" title="Удалить" aria-label="Удалить" @click="deleteOpen = true">
              <ion-icon :icon="trashOutline" />
            </button>
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
      >
        <template #day>
          <AttendanceHistory :items="dayItems" :day="selectedDay" @clear-day="selectedDay = null" @open="openEvent" />
        </template>
        <template #empty>
          <p v-if="!profile.items.length" class="mp-empty">В выбранном периоде у участника нет мероприятий</p>
        </template>
      </AttendanceActivity>

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
          <span v-if="profile.items.length" class="ui-count">{{ profile.items.length }}</span>
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
import { flameOutline, lockClosedOutline, pencilOutline, trashOutline } from 'ionicons/icons'
import {
  getMemberProfileEventV2MembersMemberIdProfileGet,
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
} from '@/api/generated/almaEventFlow'
import type { MemberProfileRead, RoleRead } from '@/api/generated/almaEventFlow'
import BackLink from '@/components/common/BackLink.vue'
import PageState from '@/components/common/PageState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import AttendanceActivity from '@/components/member/AttendanceActivity.vue'
import AttendanceHead from '@/components/member/AttendanceHead.vue'
import AttendanceHistory from '@/components/member/AttendanceHistory.vue'
import AttendanceLegend from '@/components/member/AttendanceLegend.vue'
import AttendanceTiles, { type AttendanceTile } from '@/components/member/AttendanceTiles.vue'
import MemberDeleteAlert from '@/components/member/MemberDeleteAlert.vue'
import MemberEditorModal from '@/components/member/MemberEditorModal.vue'
import MonthBars from '@/components/member/MonthBars.vue'
import ProfileWho, { type ProfileTag } from '@/components/member/ProfileWho.vue'
import TypeBars from '@/components/member/TypeBars.vue'
import { useAttendancePeriod } from '@/composables/useAttendancePeriod'
import { usePlatform } from '@/composables/usePlatform'
import { principalNavigateKey, principalReturnTo } from '@/composables/usePrincipalNavigate'
import { useSettingsStore } from '@/stores/settings'
import { usePrincipalStore } from '@/stores/principal'
import { formatDate } from '@/utils/date'
import { formatPersonName } from '@/utils/names'
import { dayKey, groupByDay, monthSeries } from '@/utils/memberAttendance'

const props = defineProps<{ memberId: string }>()

const MEMBERS_PATH = '/principal/members'
const DASHBOARD_PATH = '/principal/dashboard'
const COLLECTIVE_PATH = '/principal/collective'

const router = useRouter()
const panelNavigate = inject(principalNavigateKey, null)
const principal = usePrincipalStore()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()
const { today, period, weekStartsOn, range, periodLabel } = useAttendancePeriod()

const profile = ref<MemberProfileRead | null>(null)
const roles = ref<RoleRead[]>([])
const editorOpen = ref(false)
const deleteOpen = ref(false)
const loading = ref(true)
const refreshing = ref(false)
const notFound = ref(false)
const forbidden = ref(false)
const failed = ref(false)
const selectedDay = ref<string | null>(null)

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
const roleTags = computed<ProfileTag[]>(() => {
  const list = profile.value?.member.roles ?? []
  return list.length ? list.map((role) => ({ label: role.name })) : [{ label: 'Без роли', muted: true }]
})
const collectiveName = computed(() => {
  const id = profile.value?.member.collective_id
  return principal.collectives.find((c) => c.id === id)?.name ?? 'Профиль коллектива'
})
const rateSub = computed(() =>
  summary.value.past
    ? `${summary.value.attended} из ${summary.value.past} прошедших мероприятий`
    : 'Прошедших мероприятий пока нет',
)

const days = computed(() => groupByDay(profile.value?.items ?? []))
const dayItems = computed(() => days.value.get(selectedDay.value ?? '')?.items ?? [])
const buckets = computed(() => monthSeries(range.value.from, range.value.to, profile.value?.by_month ?? []))

const tiles = computed<AttendanceTile[]>(() => {
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

const RETURN_PATHS = [DASHBOARD_PATH, COLLECTIVE_PATH]

const backPath = computed(() => {
  const from = principalReturnTo.value
  return from && RETURN_PATHS.includes(from) ? from : MEMBERS_PATH
})
const showBack = computed(() => !!panelNavigate || isDesktop.value)

const backLabel = computed(() => {
  if (!panelNavigate) return 'Назад'
  if (backPath.value === DASHBOARD_PATH) return 'Дашборд'
  return backPath.value === COLLECTIVE_PATH ? 'Коллектив' : 'Участники'
})

function goBack() {
  if (panelNavigate) panelNavigate(backPath.value)
  else if (window.history.state?.back) router.back()
  else router.replace('/')
}

function openEvent(eventId: string) {
  router.push(`/event/${eventId}`)
}

function openCollective() {
  const id = profile.value?.member.collective_id
  if (!id) return
  if (panelNavigate && principal.principalCollectiveIds.has(id)) panelNavigate(COLLECTIVE_PATH)
  else router.push(`/collective/${id}`)
}

watch(period, load)

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

.mp-skeleton-person {
  display: flex;
  align-items: center;
  gap: 14px;
}

.mp-skeleton-who {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.mp-since {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.mp-collective {
  padding: 0;
  border: none;
  background: transparent;
  font-size: inherit;
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
  cursor: pointer;
}

.mp-card-skeleton {
  display: block;
  height: 200px;
  border-radius: var(--radius-lg);
}

.mp-legend {
  margin-top: 12px;
}

.mp-empty {
  margin: 12px 0 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}
</style>
