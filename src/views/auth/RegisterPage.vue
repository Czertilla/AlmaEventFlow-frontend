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
          <p class="auth-subtitle">Создайте новую учётную запись</p>
        </div>

        <div class="auth-card">
          <div class="auth-card-inner">
            <div class="auth-tabs">
              <router-link to="/auth/login" class="auth-tab">Вход</router-link>
              <span class="auth-tab active">Регистрация</span>
            </div>

            <div class="auth-form">
              <div class="field-group">
                <label class="field-label">Email</label>
                <div class="field-input" :class="{ 'field-input--error': !!errors.email }">
                  <ion-icon :icon="mailOutline" class="field-icon" />
                  <input v-model="email" type="email" placeholder="Введите email" @keyup.enter="handleRegister" />
                </div>
                <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
              </div>

              <div class="field-group">
                <label class="field-label">Username</label>
                <div class="field-input" :class="{ 'field-input--error': !!errors.username }">
                  <ion-icon :icon="personOutline" class="field-icon" />
                  <input v-model="username" type="text" placeholder="Введите username" @input="onUsernameInput" @keyup.enter="handleRegister" />
                </div>
                <span v-if="usernameStatus" :class="usernameColor === 'danger' ? 'field-error' : 'field-success'">{{ usernameStatus }}</span>
                <span v-else-if="errors.username" class="field-error">{{ errors.username }}</span>
              </div>

              <div class="field-group">
                <label class="field-label">Пароль</label>
                <div class="field-input" :class="{ 'field-input--error': !!errors.password }">
                  <ion-icon :icon="lockClosedOutline" class="field-icon" />
                  <input v-model="password" type="password" placeholder="Придумайте пароль" @keyup.enter="handleRegister" />
                </div>
                <div v-if="password" class="strength">
                  <div class="strength-bar">
                    <div class="strength-fill" :style="{ width: strength.percent + '%', background: strength.color }" />
                  </div>
                  <span class="strength-label" :style="{ color: strength.color }">{{ strength.label }}</span>
                </div>
                <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
              </div>

              <div class="field-group">
                <label class="field-label">Подтвердите пароль</label>
                <div class="field-input" :class="{ 'field-input--error': !!errors.confirmPassword }">
                  <ion-icon :icon="lockClosedOutline" class="field-icon" />
                  <input v-model="confirmPassword" type="password" placeholder="Повторите пароль" @keyup.enter="handleRegister" />
                </div>
                <span v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</span>
              </div>

              <label class="field-checkbox">
                <input v-model="agreed" type="checkbox" class="checkbox-input" />
                <span class="checkbox-custom">
                  <ion-icon :icon="checkmarkOutline" />
                </span>
                <span class="checkbox-label">Я прочитал пользовательское соглашение и политику конфиденциальности</span>
              </label>

              <Transition name="fade">
                <div v-if="error" class="auth-error">
                  <ion-icon :icon="alertCircleOutline" />
                  <span>{{ error }}</span>
                </div>
              </Transition>

              <button class="auth-btn" :disabled="loading || !agreed" @click="handleRegister">
                <span v-if="loading" class="btn-spinner" />
                <span v-else>Зарегистрироваться</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { checkUsernameUserV1UsersCheckUsernameGet } from '@/api/generated/almaEventFlow'
import { IonPage, IonContent, IonIcon } from '@ionic/vue'
import { mailOutline, personOutline, lockClosedOutline, checkmarkOutline, alertCircleOutline } from 'ionicons/icons'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const agreed = ref(false)
const loading = ref(false)
const error = ref('')
const usernameStatus = ref('')
const usernameColor = ref('')
const errors = reactive({
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
})

let checkTimer: ReturnType<typeof setTimeout> | null = null

const strength = computed(() => {
  const p = password.value
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^a-zA-Zа-яА-Я0-9]/.test(p)) score++
  if (score <= 1) return { percent: 20, color: '#FF4757', label: 'Слабый' }
  if (score === 2) return { percent: 45, color: '#FFB800', label: 'Средний' }
  if (score === 3) return { percent: 70, color: '#00BF92', label: 'Хороший' }
  return { percent: 100, color: '#00D9A6', label: 'Надёжный' }
})

function validate() {
  let valid = true
  errors.email = ''
  errors.username = ''
  errors.password = ''
  errors.confirmPassword = ''

  if (!email.value) {
    errors.email = 'Введите email'
    valid = false
  } else if (!/\S+@\S+\.\S+/.test(email.value)) {
    errors.email = 'Некорректный email'
    valid = false
  }
  if (!username.value) {
    errors.username = 'Введите username'
    valid = false
  } else if (username.value.length < 3) {
    errors.username = 'Минимум 3 символа'
    valid = false
  }
  if (!password.value) {
    errors.password = 'Введите пароль'
    valid = false
  } else if (password.value.length < 8) {
    errors.password = 'Минимум 8 символов'
    valid = false
  } else if (!/\d/.test(password.value) || !/[a-zA-Zа-яА-Я]/.test(password.value)) {
    errors.password = 'Пароль должен содержать буквы и цифры'
    valid = false
  }
  if (!confirmPassword.value) {
    errors.confirmPassword = 'Подтвердите пароль'
    valid = false
  } else if (password.value !== confirmPassword.value) {
    errors.confirmPassword = 'Пароли не совпадают'
    valid = false
  }
  return valid
}

function onUsernameInput() {
  if (checkTimer) clearTimeout(checkTimer)
  if (!username.value) {
    usernameStatus.value = ''
    return
  }
  usernameStatus.value = 'Проверка...'
  usernameColor.value = 'warning'
  checkTimer = setTimeout(async () => {
    try {
      const res = await checkUsernameUserV1UsersCheckUsernameGet(username.value)
      if (res.data.exists) {
        usernameStatus.value = 'Username занят'
        usernameColor.value = 'danger'
      } else {
        usernameStatus.value = 'Username свободен'
        usernameColor.value = 'success'
      }
    } catch {
      usernameStatus.value = 'Ошибка проверки'
      usernameColor.value = 'warning'
    }
  }, 500)
}

async function handleRegister() {
  error.value = ''
  if (!validate()) return
  loading.value = true
  try {
    await auth.register({
      email: email.value,
      username: username.value,
      password: password.value,
    })
    router.push('/auth/verify?email=' + encodeURIComponent(email.value))
  } catch (err: any) {
    error.value = err?.response?.data?.detail || 'Ошибка регистрации'
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

.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 4px 0;
}

.strength-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--ion-border-color);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-label {
  font-size: 11px;
  font-weight: 600;
  min-width: 56px;
  text-align: right;
}

.field-error {
  font-size: 12px;
  color: var(--ion-color-danger);
  font-weight: 500;
  padding-left: 4px;
}

.field-success {
  font-size: 12px;
  color: var(--ion-color-success);
  font-weight: 500;
  padding-left: 4px;
}

.field-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid var(--ion-border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all 0.2s;
}

.checkbox-input:checked + .checkbox-custom {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary);
}

.checkbox-custom ion-icon {
  font-size: 12px;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
}

.checkbox-input:checked + .checkbox-custom ion-icon {
  opacity: 1;
}

.checkbox-label {
  font-size: 13px;
  color: var(--ion-color-medium);
  line-height: 1.4;
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
  box-shadow: 0 4px 16px rgba(108, 99, 255, 0.3);
}

.auth-btn:active:not(:disabled) {
  transform: translateY(0);
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
