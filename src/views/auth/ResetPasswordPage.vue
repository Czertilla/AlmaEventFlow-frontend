<template>
  <ion-page>
    <ion-content class="auth-page">
      <div class="auth-bg" />
      <div class="auth-container">
        <div class="auth-brand">
          <div class="auth-logo">
            <img src="/aef.svg" class="logo-img" alt="Alma Event Flow" />
          </div>
          <h1>Новый пароль</h1>
          <p class="auth-subtitle">Задайте новый пароль для своего аккаунта</p>
        </div>

        <div class="auth-card">
          <div class="auth-card-inner">
            <Transition name="fade" mode="out-in">
              <div v-if="!token" key="notoken" class="auth-done">
                <div class="auth-done-icon auth-done-icon--error">
                  <ion-icon :icon="alertCircleOutline" />
                </div>
                <p class="auth-done-text">
                  Ссылка для сброса пароля недействительна или устарела.
                  Запросите восстановление пароля заново.
                </p>
                <router-link to="/auth/forgot-password" class="auth-btn auth-btn--link">
                  Запросить ссылку
                </router-link>
              </div>

              <div v-else-if="done" key="done" class="auth-done">
                <div class="auth-done-icon">
                  <ion-icon :icon="checkmarkCircleOutline" />
                </div>
                <p class="auth-done-text">
                  Пароль успешно изменён. Войдите с новым паролем.
                </p>
                <router-link to="/auth/login" class="auth-btn auth-btn--link">
                  Войти
                </router-link>
              </div>

              <div v-else key="form" class="auth-form">
                <div class="field-group">
                  <label class="field-label">Новый пароль</label>
                  <div class="field-input" :class="{ 'field-input--error': error && !password }">
                    <ion-icon :icon="lockClosedOutline" class="field-icon" />
                    <input v-model="password" type="password" placeholder="Введите новый пароль" @keyup.enter="handleSubmit" />
                  </div>
                  <PasswordStrengthMeter :password="password" />
                </div>

                <div class="field-group">
                  <label class="field-label">Повторите пароль</label>
                  <div class="field-input" :class="{ 'field-input--error': error && password !== confirm }">
                    <ion-icon :icon="lockClosedOutline" class="field-icon" />
                    <input v-model="confirm" type="password" placeholder="Повторите пароль" @keyup.enter="handleSubmit" />
                  </div>
                </div>

                <Transition name="fade">
                  <div v-if="error" class="auth-error">
                    <ion-icon :icon="alertCircleOutline" />
                    <span>{{ error }}</span>
                  </div>
                </Transition>

                <button class="auth-btn" :disabled="loading" @click="handleSubmit">
                  <span v-if="loading" class="btn-spinner" />
                  <span v-else>Сохранить пароль</span>
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { validatePassword } from '@/utils/password'
import PasswordStrengthMeter from '@/components/common/PasswordStrengthMeter.vue'
import { IonPage, IonContent, IonIcon, onIonViewDidLeave } from '@ionic/vue'
import {
  lockClosedOutline, alertCircleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons'

const route = useRoute()
const auth = useAuthStore()

const token = ref((route.query.token as string) || '')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

// Не храним введённые пароли после ухода со страницы.
onIonViewDidLeave(() => {
  password.value = ''
  confirm.value = ''
  error.value = ''
})

async function handleSubmit() {
  error.value = ''
  if (!password.value || !confirm.value) {
    error.value = 'Заполните оба поля'
    return
  }
  const passwordError = validatePassword(password.value)
  if (passwordError) {
    error.value = passwordError
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  loading.value = true
  try {
    await auth.resetPassword(token.value, password.value)
    done.value = true
  } catch (err: any) {
    error.value = err?.response?.data?.detail || 'Не удалось изменить пароль'
  } finally {
    loading.value = false
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
  box-shadow: 0 8px 24px rgba(108, 99, 255, 0.3);
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
  text-decoration: none;
}

.auth-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(108, 99, 255, 0.3);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-btn--link {
  box-sizing: border-box;
}

.auth-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

.auth-done-icon {
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

.auth-done-icon--error {
  background: rgba(255, 71, 87, 0.12);
  color: var(--ion-color-danger);
}

.auth-done-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ion-color-medium);
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
