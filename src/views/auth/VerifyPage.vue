<template>
  <ion-page>
    <ion-content class="auth-page">
      <div class="auth-bg" />
      <div class="auth-container">
        <div class="auth-brand">
          <div class="auth-logo">
            <ion-icon :icon="mailUnreadOutline" />
          </div>
          <h1>Подтверждение email</h1>
          <p class="auth-subtitle">Мы отправили письмо на <strong>{{ email }}</strong></p>
        </div>

        <div class="auth-card">
          <div class="auth-card-inner">
            <div class="verify-content">
              <div class="verify-icon">
                <ion-icon :icon="mailOpenOutline" />
              </div>
              <p class="verify-text">Перейдите по ссылке в письме, чтобы подтвердить свой email адрес.</p>

              <div class="verify-timer" :class="{ 'verify-timer--active': remaining > 0 }">
                <template v-if="remaining > 0">
                  <ion-icon :icon="timeOutline" />
                  <span>Отправить повторно через {{ remaining }} сек.</span>
                </template>
                <template v-else>
                  <ion-icon :icon="checkmarkCircleOutline" />
                  <span>Можно отправить снова</span>
                </template>
              </div>

              <button class="auth-btn" :disabled="remaining > 0" @click="resend">
                Отправить снова
              </button>

              <button class="auth-btn auth-btn--outline" @click="goToLogin">
                <ion-icon :icon="arrowBackOutline" />
                Перейти ко входу
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
import { useRoute, useRouter } from 'vue-router'
import { verifyRequestTokenUserV1AuthRequestVerifyTokenPost } from '@/api/generated/-user'
import { IonPage, IonContent, IonIcon } from '@ionic/vue'
import { mailUnreadOutline, mailOpenOutline, timeOutline, checkmarkCircleOutline, arrowBackOutline } from 'ionicons/icons'

const COOLDOWN = 90

const route = useRoute()
const router = useRouter()
const email = ref((route.query.email as string) || '')
const remaining = ref(COOLDOWN)

// Timer end is persisted per email, so a page refresh can't reset the cooldown
const storageKey = () => `verifyTimerEnd:${email.value}`

function getTimerEnd(): number {
  const stored = localStorage.getItem(storageKey())
  if (stored) return parseInt(stored, 10)
  return 0
}

function startTimer() {
  const end = Date.now() + COOLDOWN * 1000
  localStorage.setItem(storageKey(), String(end))
  tick()
}

function tick() {
  const end = getTimerEnd()
  const diff = Math.max(0, Math.floor((end - Date.now()) / 1000))
  remaining.value = diff
  if (diff > 0) setTimeout(tick, 1000)
}

function goToLogin() {
  router.push('/auth/login?email=' + encodeURIComponent(email.value))
}

async function resend() {
  try {
    await verifyRequestTokenUserV1AuthRequestVerifyTokenPost({ email: email.value })
    startTimer()
  } catch (err) {
    console.error('Resend failed', err)
  }
}

onMounted(() => {
  const existing = getTimerEnd()
  if (existing > Date.now()) {
    // Cooldown still running (page refresh) — keep counting, don't resend
    tick()
  } else if (email.value) {
    // First visit after registration — the letter is sent automatically
    resend()
  }
})
</script>

<style scoped>
.auth-page {
  --background: transparent;
}

/* Центрирование формы внутри скролл-области ion-content */
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
  box-shadow: 0 8px 24px rgba(108, 99, 255, 0.3);
}

.auth-logo ion-icon {
  font-size: 32px;
  color: white;
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

.auth-subtitle strong {
  color: var(--ion-text-color);
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
  padding: 32px 24px;
}

.verify-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.verify-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(108, 99, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.verify-icon ion-icon {
  font-size: 36px;
  color: var(--ion-color-primary);
}

.verify-text {
  font-size: 15px;
  color: var(--ion-color-medium);
  line-height: 1.5;
  margin: 0;
}

.verify-timer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium);
  background: var(--ion-background-color);
}

.verify-timer--active {
  color: var(--ion-color-warning);
}

.verify-timer ion-icon {
  font-size: 18px;
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
  gap: 8px;
  min-height: 48px;
}

.auth-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(108, 99, 255, 0.3);
}

.auth-btn:active:not(:disabled) {
  transform: translateY(0);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-btn--outline {
  background: transparent;
  color: var(--ion-color-primary);
  border: 1.5px solid var(--ion-color-primary);
}

.auth-btn--outline:hover:not(:disabled) {
  background: rgba(108, 99, 255, 0.05);
  box-shadow: none;
}
</style>
