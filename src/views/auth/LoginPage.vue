<template>
  <ion-page>
    <ion-content class="auth-page">
      <div class="auth-bg" />
      <div class="auth-container">
        <div class="auth-brand">
          <div class="auth-logo">
            <img src="/aef.svg" class="logo-img" alt="Alma Event Flow" />
          </div>
          <h1>Alma Event Flow</h1>
          <p class="auth-subtitle">Войдите в свою учётную запись</p>
        </div>

        <div class="auth-card">
          <div class="auth-card-inner">
            <div class="auth-tabs">
              <span class="auth-tab active">Вход</span>
              <router-link to="/auth/register" class="auth-tab">Регистрация</router-link>
            </div>

            <div class="auth-form">
              <div class="field-group">
                <label class="field-label">Email</label>
                <div class="field-input" :class="{ 'field-input--error': error && !username }">
                  <ion-icon :icon="personOutline" class="field-icon" />
                  <input v-model="username" type="text" placeholder="Введите email" @keyup.enter="handleLogin" />
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Пароль</label>
                <div class="field-input" :class="{ 'field-input--error': error && !password }">
                  <ion-icon :icon="lockClosedOutline" class="field-icon" />
                  <input v-model="password" type="password" placeholder="Введите пароль" @keyup.enter="handleLogin" />
                </div>
              </div>

              <Transition name="fade">
                <div v-if="error" class="auth-error">
                  <ion-icon :icon="alertCircleOutline" />
                  <span>{{ error }}</span>
                </div>
              </Transition>

              <button class="auth-btn" :disabled="loading" @click="handleLogin">
                <span v-if="loading" class="btn-spinner" />
                <span v-else>Войти</span>
              </button>

              <router-link to="/auth/forgot-password" class="auth-forgot">
                Забыли пароль?
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { IonPage, IonContent, IonIcon, onIonViewDidLeave } from '@ionic/vue'
import { personOutline, lockClosedOutline, alertCircleOutline } from 'ionicons/icons'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref((route.query.email as string) || '')
const password = ref('')
const error = ref('')
const loading = ref(false)

// Не оставляем пароль в памяти/кэше после ухода со страницы входа.
onIonViewDidLeave(() => {
  password.value = ''
  error.value = ''
})

async function handleLogin() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = 'Заполните все поля'
    return
  }
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.detail || 'Неверный логин или пароль'
  } finally {
    loading.value = false
  }
}
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

.auth-tabs {
  display: flex;
  gap: 24px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--ion-border-color);
  padding-bottom: 12px;
}

.auth-tab {
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-decoration: none;
  padding-bottom: 12px;
  margin-bottom: -13px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.auth-tab.active {
  color: var(--ion-color-primary);
  border-bottom-color: var(--ion-color-primary);
}

.auth-tab:hover {
  color: var(--ion-text-color);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.field-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-background-color);
  transition: border-color 0.2s;
}

.field-input:focus-within {
  border-color: var(--ion-color-primary);
}

.field-input--error {
  border-color: var(--ion-color-danger);
}

.field-icon {
  font-size: 18px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.field-input input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  padding: 14px 0;
  color: var(--ion-text-color);
  font-family: inherit;
}

.field-input input::placeholder {
  color: var(--ion-color-step-400);
}

.auth-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 71, 87, 0.1);
  border-radius: 10px;
  color: var(--ion-color-danger);
  font-size: 13px;
  font-weight: 500;
}

.auth-error ion-icon {
  font-size: 18px;
  flex-shrink: 0;
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
}

.auth-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

.auth-btn:active:not(:disabled) {
  transform: translateY(0);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-forgot {
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-primary);
  text-decoration: none;
}

.btn-spinner {
  width: 22px;
  height: 22px;
  border: 2.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
