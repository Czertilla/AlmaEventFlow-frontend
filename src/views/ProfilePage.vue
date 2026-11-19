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
          <div v-if="profile && accountLink.status.value !== 'ok'" class="ui-banner profile-link" role="status">
            <span>{{ accountLink.status.value === 'checking' ? 'Привязываем к аккаунту…' : 'Не привязано к аккаунту' }}</span>
            <button
              v-if="accountLink.status.value === 'failed'"
              type="button"
              class="ui-btn ui-btn--ghost ui-btn--sm"
              @click="accountLink.start"
            >
              Повторить
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

        <section class="ui-card">
          <div class="ui-card-head">
            <h3 class="ui-card-title">Мои коллективы</h3>
            <span v-if="collectiveRows.length" class="ui-count">{{ collectiveRows.length }}</span>
            <button
              type="button"
              class="ui-icon-btn ui-icon-btn--primary"
              title="Найти коллектив"
              aria-label="Найти коллектив"
              :disabled="!auth.personId"
              @click="router.push('/collectives')"
            >
              <ion-icon :icon="addOutline" />
            </button>
          </div>
          <p v-if="!auth.personId" class="profile-hint">Коллективы станут доступны после заполнения подробной информации</p>
          <template v-else>
            <ul v-if="collectiveRows.length" class="collective-list">
              <li v-for="row in collectiveRows" :key="row.collectiveId" class="collective-row">
                <DefaultAvatar kind="collective" :seed="row.collectiveId" :size="40" />
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
            <ul v-if="myOnboardings.length" class="collective-list">
              <li v-for="item in myOnboardings" :key="item.id" class="collective-row">
                <DefaultAvatar kind="collective" :seed="item.collective_id" :size="40" />
                <div class="collective-main">
                  <span class="collective-name">{{ item.collective_name }}</span>
                  <span class="collective-meta" :class="{ 'ui-attention': item.awaiting === 'candidate' }">
                    {{ item.opened_by === 'candidate' ? 'Запрос' : 'Приглашение' }} · {{ waitingText(item) }}
                  </span>
                  <div class="collective-actions">
                    <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="router.push(onboardingPath(item.id))">
                      Переписка
                    </button>
                  </div>
                </div>
              </li>
            </ul>
            <p v-if="!collectiveRows.length && !myOnboardings.length" class="profile-hint">Вы пока не состоите в коллективах</p>
            <label class="ui-toggle-row">
              <span>
                Принимать приглашения
                <HelpTip text="Если выключить, руководители не смогут пригласить вас в коллектив. Почему, им не сообщается." />
              </span>
              <ion-toggle
                :checked="acceptsInvites ?? false"
                :disabled="acceptsInvites === null || intakeBusy"
                @ion-change="setAcceptsInvites($event.detail.checked)"
              />
            </label>
          </template>
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
import { computed, ref, watch } from 'vue'
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
import DefaultAvatar from '@/components/common/DefaultAvatar.vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon, IonToggle,
  onIonViewWillEnter, onIonViewWillLeave,
} from '@ionic/vue'
import { useAccountLink } from '@/composables/useAccountLink'
import {
  settingsOutline, logOutOutline, chevronForwardOutline,
  createOutline, shieldCheckmarkOutline, addOutline,
} from 'ionicons/icons'
import { contactTypeLabels } from '@/utils/contactTypes'
import { formatDate } from '@/utils/date'
import { formatPersonName } from '@/utils/names'
import { onboardingPath, sortOnboardings, waitingText } from '@/utils/onboarding'
import {
  getMyIntakeEventV3MeIntakeGet,
  getOnboardingsEventV3OnboardingsGet,
  putMyIntakeEventV3MeIntakePut,
  type OnboardingRead,
} from '@/api/generated/almaEventFlow'
import { useLiveStore } from '@/stores/live'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const principal = usePrincipalStore()
const router = useRouter()
const { isDesktop } = usePlatform()

const myProfile = useMyProfileStore()
const settings = useSettingsStore()
const accountLink = useAccountLink()

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
  memberId: string | null
  meta: string
  order: number
}

const collectiveRows = computed<CollectiveRow[]>(() =>
  principal.memberships
    .map((c) => {
      const inactive = c.member_id !== null && c.member_is_active === false
      const meta = [
        c.is_principal ? 'Руководитель' : '',
        ...c.roles.map((role) => role.name),
        inactive ? 'Неактивен' : '',
      ].filter(Boolean)
      return {
        collectiveId: c.id,
        name: c.name,
        memberId: c.member_id,
        meta: meta.join(' · ') || 'Участник',
        order: inactive ? 1 : 0,
      }
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru')),
)

const live = useLiveStore()
const { showError } = useToast()
const myOnboardings = ref<OnboardingRead[]>([])
const acceptsInvites = ref<boolean | null>(null)
const intakeBusy = ref(false)

async function loadOnboardings() {
  if (!auth.personId) {
    myOnboardings.value = []
    acceptsInvites.value = null
    return
  }
  try {
    const [list, intake] = await Promise.all([
      getOnboardingsEventV3OnboardingsGet({ side: 'candidate', status: ['requested', 'invited'], limit: 50 }),
      getMyIntakeEventV3MeIntakeGet(),
    ])
    myOnboardings.value = sortOnboardings(list.data.items)
    acceptsInvites.value = intake.data.accepts_invites
  } catch {
    /* блок коллективов остаётся с прежними данными */
  }
}

async function setAcceptsInvites(value: boolean) {
  if (value === acceptsInvites.value) return
  intakeBusy.value = true
  try {
    acceptsInvites.value = (await putMyIntakeEventV3MeIntakePut({ accepts_invites: value })).data.accepts_invites
  } catch (err) {
    await showError(err, 'Не удалось сохранить')
  } finally {
    intakeBusy.value = false
  }
}

watch([() => live.tick, () => live.versions], () => void loadOnboardings())

async function loadAll() {
  if (!auth.user) await auth.fetchUser()
  await myProfile.load(true)
  void loadOnboardings()
  if (!myProfile.profile) return
  await myProfile.syncToken()
  void accountLink.check()
  await principal.fetchCollectives(true)
}

onIonViewWillEnter(loadAll)
onIonViewWillLeave(accountLink.stop)

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

.profile-link {
  margin-bottom: 12px;
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
