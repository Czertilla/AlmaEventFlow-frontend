<template>
  <ion-page>
    <ion-content class="auth-page">
      <div class="auth-bg" />
      <div class="auth-container">
        <div class="auth-brand">
          <div class="auth-logo">
            <img src="/aef.svg" class="logo-img" alt="Alma Event Flow" />
          </div>
          <h1>Привязка профиля</h1>
          <p class="auth-subtitle">Вы уже вошли в аккаунт — подтвердите привязку профиля по этой ссылке</p>
        </div>

        <div class="auth-card">
          <div class="auth-card-inner">
            <div v-if="checking" class="link-state">
              <span class="btn-spinner btn-spinner--dark" />
            </div>

            <div v-else-if="error" class="link-state">
              <div class="link-icon link-icon--error">
                <ion-icon :icon="alertCircleOutline" />
              </div>
              <p class="link-text">{{ error }}</p>
              <router-link to="/" class="auth-btn auth-btn--link">На главную</router-link>
            </div>

            <div v-else-if="done" class="link-state">
              <div class="link-icon">
                <ion-icon :icon="checkmarkCircleOutline" />
              </div>
              <p class="link-text">Профиль {{ personName }} привязан к вашему аккаунту.</p>
              <router-link to="/" class="auth-btn auth-btn--link">На главную</router-link>
            </div>

            <div v-else class="link-state">
              <div class="link-icon">
                <ion-icon :icon="linkOutline" />
              </div>
              <p class="link-text">Привязать профиль <strong>{{ personName }}</strong> к вашему аккаунту?</p>
              <button class="auth-btn" :disabled="linking" @click="handleLink">
                <span v-if="linking" class="btn-spinner" />
                <span v-else>Привязать</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { IonPage, IonContent, IonIcon } from '@ionic/vue'
import { alertCircleOutline, checkmarkCircleOutline, linkOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { decodeJwt } from '@/utils/jwt'
import { resolvePersonName } from '@/utils/names'
import { linkInviteUserV1UsersMeLinkInvitePost } from '@/api/generated/almaEventFlow'

const route = useRoute()
const auth = useAuthStore()
const { showError: showErrorToast } = useToast()

const token = ref('')
const personName = ref('')
const checking = ref(true)
const linking = ref(false)
const done = ref(false)
const error = ref('')

onMounted(async () => {
  const raw = route.query.token
  if (typeof raw !== 'string' || !raw) {
    error.value = 'Недействительная пригласительная ссылка'
    checking.value = false
    return
  }
  token.value = raw

  if (!auth.user) await auth.fetchUser()
  if (auth.user?.person_id) {
    error.value = 'Ваш аккаунт уже привязан к профилю'
    checking.value = false
    return
  }

  const payload = decodeJwt(raw)
  const personId = payload?.person_id
  if (!payload || !personId) {
    error.value = 'Недействительная пригласительная ссылка'
    checking.value = false
    return
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    error.value = 'Срок действия пригласительной ссылки истёк'
    checking.value = false
    return
  }
  const name = await resolvePersonName(personId)
  if (!name) {
    error.value = 'Не удалось загрузить профиль для привязки'
    checking.value = false
    return
  }
  personName.value = name
  checking.value = false
})

async function handleLink() {
  linking.value = true
  try {
    await linkInviteUserV1UsersMeLinkInvitePost({ token: token.value })
    await auth.fetchUser()
    done.value = true
  } catch (err) {
    error.value = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      || 'Не удалось привязать профиль'
    showErrorToast(err, 'Не удалось привязать профиль')
  } finally {
    linking.value = false
  }
}
</script>

<style scoped>
.auth-page {
  --background: transparent;
}

.auth-page::part(scroll) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-bg {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #6C63FF 0%, #3F3D9E 50%, #1a1a2e 100%);
  opacity: 0.05;
  z-index: 0;
}

:deep(.ion-palette-dark) .auth-bg {
  opacity: 0.08;
}

.auth-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.auth-brand {
  text-align: center;
  margin-bottom: 32px;
}

.auth-logo {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 24px rgba(var(--ion-color-primary-rgb), 0.3);
}

.auth-logo .logo-img {
  width: 36px;
  height: 40px;
  filter: brightness(0) invert(1);
}

.auth-brand h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--ion-text-color);
}

.auth-subtitle {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin: 0;
}

.auth-card {
  width: 100%;
  background: var(--ion-card-background);
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.ion-palette-dark .auth-card {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.auth-card-inner {
  padding: 24px;
}

.link-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
  padding: 12px 0;
}

.link-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 191, 146, 0.12);
  color: #00BF92;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}

.link-icon--error {
  background: rgba(255, 71, 87, 0.12);
  color: var(--ion-color-danger);
}

.link-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.auth-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  text-decoration: none;
  box-sizing: border-box;
}

.auth-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 22px;
  height: 22px;
  border: 2.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.btn-spinner--dark {
  border: 2.5px solid var(--ion-border-color);
  border-top-color: var(--ion-color-primary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
