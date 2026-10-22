<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>Профиль</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile-page">
        <h1 v-if="isDesktop" class="page-title">Профиль</h1>

        <div class="profile-card">
          <UserAvatar :user="auth.user" :size="56" />
          <div class="profile-id">
            <span class="profile-name">{{ auth.user?.username || 'Пользователь' }}</span>
            <span class="profile-email">{{ auth.user?.email }}</span>
            <TimestampsMeta :created-at="auth.user?.created_at" :edited-at="auth.user?.edited_at" />
          </div>
          <UuidBadge v-if="auth.user?.id" :id="auth.user.id" />
        </div>

        <section class="ui-card">
          <div class="ui-card-head">
            <h3 class="ui-card-title">Подробная информация</h3>
            <button
              v-if="profile"
              type="button"
              class="ui-icon-btn"
              title="Изменить"
              aria-label="Изменить подробную информацию"
              @click="router.push('/profile/data')"
            >
              <ion-icon :icon="createOutline" />
            </button>
          </div>
          <span v-if="!myProfile.loaded && !myProfile.failed" class="skeleton profile-skeleton" aria-hidden="true" />
          <div v-else-if="myProfile.failed" class="profile-cta">
            <p class="profile-hint">Не удалось загрузить подробную информацию.</p>
            <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="loadAll">Повторить</button>
          </div>
          <dl v-else-if="profile" class="profile-lines">
            <div class="profile-line">
              <dt>ФИО</dt>
              <dd>{{ fullName }}</dd>
            </div>
            <div v-if="birthdate" class="profile-line">
              <dt>Дата рождения</dt>
              <dd>{{ birthdate }}</dd>
            </div>
            <div v-if="studentLine" class="profile-line">
              <dt>Учёба</dt>
              <dd>{{ studentLine }}</dd>
            </div>
            <div v-if="profile.diet" class="profile-line">
              <dt>Диета</dt>
              <dd>{{ profile.diet.name }}</dd>
            </div>
            <div v-for="contact in profile.contacts" :key="contact.id" class="profile-line">
              <dt>{{ contactTypeLabels[contact.type] ?? contact.type }}</dt>
              <dd>{{ contact.value }}</dd>
            </div>
          </dl>
          <div v-else class="profile-cta">
            <p class="profile-hint">
              Подробная информация ещё не заполнена
              <HelpTip text="Руководители ваших коллективов видят имя, учёбу и контакты, которые вы укажете." />
            </p>
            <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="router.push('/profile/data')">
              Заполнить
            </button>
          </div>
        </section>

        <section v-if="collectiveRows.length" class="ui-card">
          <div class="ui-card-head">
            <h3 class="ui-card-title">Мои коллективы</h3>
            <span class="ui-count">{{ collectiveRows.length }}</span>
          </div>
          <ul class="collective-list">
            <li v-for="row in collectiveRows" :key="row.collectiveId" class="collective-row">
              <span class="collective-dot" :style="{ background: row.color }" />
              <div class="collective-main">
                <span class="collective-name">{{ row.name }}</span>
                <span class="collective-meta">{{ row.meta }}</span>
                <div class="collective-actions">
                  <button
                    v-if="row.memberId"
                    type="button"
                    class="ui-btn ui-btn--primary ui-btn--sm"
                    @click="router.push(`/member/${row.memberId}`)"
                  >
                    Мой профиль участника
                  </button>
                  <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="router.push(`/collective/${row.collectiveId}`)">
                    О коллективе
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <div class="profile-actions">
          <router-link to="/profile/edit" class="profile-action">
            <ion-icon :icon="createOutline" />
            <span class="action-text">
              Аккаунт
              <small class="action-sub">Имя пользователя, почта, пароль, Telegram</small>
            </span>
            <ion-icon :icon="chevronForwardOutline" class="action-arrow" />
          </router-link>
          <router-link to="/profile/sessions" class="profile-action">
            <ion-icon :icon="shieldCheckmarkOutline" />
            <span>Активные сеансы</span>
            <ion-icon :icon="chevronForwardOutline" class="action-arrow" />
          </router-link>
          <router-link to="/settings" class="profile-action">
            <ion-icon :icon="settingsOutline" />
            <span>Настройки</span>
            <ion-icon :icon="chevronForwardOutline" class="action-arrow" />
          </router-link>
          <button class="profile-action profile-action--danger" @click="handleLogout">
            <ion-icon :icon="logOutOutline" />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePrincipalStore } from '@/stores/principal'
import { useMyProfileStore } from '@/stores/myProfile'
import { useSettingsStore } from '@/stores/settings'
import { usePlatform } from '@/composables/usePlatform'
import HelpTip from '@/components/common/HelpTip.vue'
import UuidBadge from '@/components/common/UuidBadge.vue'
import TimestampsMeta from '@/components/common/TimestampsMeta.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue'
import {
  settingsOutline, logOutOutline, chevronForwardOutline,
  createOutline, shieldCheckmarkOutline,
} from 'ionicons/icons'
import { getMyMembersEventV1MeMembersGet } from '@/api/generated/almaEventFlow'
import type { MemberRead } from '@/api/generated/almaEventFlow'
import { unwrapList } from '@/api/pagination'
import { getCollectiveColor } from '@/utils/colors'
import { contactTypeLabels } from '@/utils/contactTypes'
import { formatDate } from '@/utils/date'
import { formatPersonName } from '@/utils/names'

const auth = useAuthStore()
const principal = usePrincipalStore()
const router = useRouter()
const { isDesktop } = usePlatform()

const myProfile = useMyProfileStore()
const settings = useSettingsStore()
const memberships = ref<MemberRead[]>([])

const profile = computed(() => myProfile.profile)
const fullName = computed(() => (profile.value ? formatPersonName(profile.value) : ''))
const birthdate = computed(() =>
  profile.value?.birthdate ? formatDate(new Date(`${profile.value.birthdate}T00:00:00`), settings.dateFormat) : '',
)
const studentLine = computed(() => {
  const student = profile.value?.student
  if (!student) return ''
  return ['Студент', student.group?.name, `билет ${student.student_id}`].filter(Boolean).join(' · ')
})

interface CollectiveRow {
  collectiveId: string
  name: string
  color: string
  memberId: string | null
  meta: string
  order: number
}

const collectiveRows = computed<CollectiveRow[]>(() => {
  const byCollective = new Map(memberships.value.map((m) => [m.collective_id, m]))
  const ids = new Set([...byCollective.keys(), ...principal.principalCollectiveIds])
  return [...ids]
    .map((id) => {
      const member = byCollective.get(id)
      const leader = principal.principalCollectiveIds.has(id)
      const meta = [
        leader ? 'Руководитель' : '',
        ...(member?.roles.map((role) => role.name) ?? []),
        member && !member.is_active ? 'Неактивен' : '',
      ].filter(Boolean)
      return {
        collectiveId: id,
        name: principal.collectives.find((c) => c.id === id)?.name ?? `Коллектив ${id.slice(0, 8)}`,
        color: getCollectiveColor(id),
        memberId: member?.id ?? null,
        meta: meta.join(' · ') || 'Участник',
        order: member && !member.is_active ? 1 : 0,
      }
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'))
})

async function loadAll() {
  if (!auth.user) await auth.fetchUser()
  await myProfile.load(true)
  if (!myProfile.profile) {
    memberships.value = []
    return
  }
  await myProfile.syncToken()
  try {
    await principal.fetchCollectives()
    memberships.value = unwrapList<MemberRead>((await getMyMembersEventV1MeMembersGet()).data)
  } catch {
    memberships.value = []
  }
}

onIonViewWillEnter(loadAll)

async function handleLogout() {
  await auth.logout()
  // Жёсткий переход: см. ProfileMenu.vue -- ion-router-outlet не убирает
  // старый ion-tabs при уходе со страницы с вложенным outlet-ом, новая
  // auth-страница остаётся визуально под ним.
  window.location.href = '/auth/login'
}
</script>

<style scoped>
.profile-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.profile-id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-name {
  font-size: var(--fs-xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-email {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  padding: 8px;
}

.profile-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 12px;
  border: none;
  background: none;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  color: var(--ion-text-color);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
}

.profile-action:hover {
  background: var(--ion-background-color);
}

.profile-action ion-icon:first-child {
  font-size: var(--fs-xl);
  color: var(--ion-color-medium);
}

.profile-action span {
  flex: 1;
}

.profile-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.profile-line {
  display: grid;
  grid-template-columns: minmax(96px, 140px) 1fr;
  gap: 12px;
}

.profile-line dt {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.profile-line dd {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}

.profile-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.profile-hint {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.profile-hint .ui-help-wrap {
  margin-left: 6px;
}

.profile-skeleton {
  display: block;
  height: 72px;
  border-radius: var(--radius-md);
}

.action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.action-sub {
  font-size: var(--fs-xs);
  font-weight: var(--fw-regular);
  color: var(--ion-color-medium);
}

.collective-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.collective-list > li + li {
  border-top: 1px solid var(--ion-border-color);
}

.collective-row {
  display: flex;
  gap: 12px;
  padding: 12px 0;
}

.collective-dot {
  width: 10px;
  height: 10px;
  margin-top: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.collective-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.collective-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}

.collective-meta {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.collective-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.action-arrow {
  font-size: var(--fs-lg);
  color: var(--ion-color-step-400);
}

.profile-action--danger,
.profile-action--danger ion-icon:first-child {
  color: var(--ion-color-danger);
}
</style>
