<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>Редактирование профиля</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="edit-page">
        <h1 v-if="isDesktop" class="page-title">Редактирование профиля</h1>

        <div class="edit-section">
          <h3 class="edit-section-title">Основные данные</h3>
          <div class="edit-card">
            <div class="field-group">
              <label class="field-label">Имя пользователя</label>
              <div class="field-input">
                <ion-icon :icon="personOutline" class="field-icon" />
                <input v-model="username" type="text" placeholder="Имя пользователя" />
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Email</label>
              <div class="field-input">
                <ion-icon :icon="mailOutline" class="field-icon" />
                <input v-model="email" type="email" placeholder="Email" />
              </div>
              <span v-if="emailChanged" class="field-hint">
                После смены email потребуется повторное подтверждение адреса.
              </span>
            </div>
          </div>
        </div>

        <div class="edit-section">
          <h3 class="edit-section-title">Смена пароля</h3>
          <div class="edit-card">
            <div class="field-group">
              <label class="field-label">Новый пароль</label>
              <div class="field-input">
                <ion-icon :icon="lockClosedOutline" class="field-icon" />
                <input v-model="password" type="password" placeholder="Оставьте пустым, чтобы не менять" />
              </div>
              <PasswordStrengthMeter :password="password" />
            </div>
            <template v-if="password">
              <div class="field-group">
                <label class="field-label">Повторите пароль</label>
                <div class="field-input">
                  <ion-icon :icon="lockClosedOutline" class="field-icon" />
                  <input v-model="confirm" type="password" placeholder="Повторите новый пароль" />
                </div>
              </div>
              <div class="field-group">
                <label class="field-label">Текущий пароль</label>
                <div class="field-input">
                  <ion-icon :icon="keyOutline" class="field-icon" />
                  <input v-model="currentPassword" type="password" placeholder="Введите текущий пароль" />
                </div>
                <span class="field-hint">
                  Для смены пароля подтвердите текущий. Остальные сеансы будут завершены.
                </span>
              </div>
            </template>
          </div>
        </div>

        <Transition name="fade">
          <div v-if="error" class="edit-error">
            <ion-icon :icon="alertCircleOutline" />
            <span>{{ error }}</span>
          </div>
        </Transition>

        <button class="save-btn" :disabled="loading || !dirty" @click="handleSave">
          <span v-if="loading" class="btn-spinner" />
          <span v-else>Сохранить</span>
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlatform } from '@/composables/usePlatform'
import { validatePassword } from '@/utils/password'
import PasswordStrengthMeter from '@/components/common/PasswordStrengthMeter.vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonIcon, toastController,
  onIonViewWillEnter, onIonViewDidLeave,
} from '@ionic/vue'
import {
  personOutline, mailOutline, lockClosedOutline, keyOutline, alertCircleOutline,
} from 'ionicons/icons'
import type { UserUpdate } from '@/api/generated/almaEventFlow'

const router = useRouter()
const auth = useAuthStore()
const { isDesktop } = usePlatform()

const username = ref(auth.user?.username || '')
const email = ref(auth.user?.email || '')
const password = ref('')
const confirm = ref('')
const currentPassword = ref('')
const error = ref('')
const loading = ref(false)

// Каждый показ страницы начинается с актуальных данных пользователя и пустых
// полей пароля; при уходе чувствительные поля очищаются (страница кэшируется).
function resetForm() {
  username.value = auth.user?.username || ''
  email.value = auth.user?.email || ''
  password.value = ''
  confirm.value = ''
  currentPassword.value = ''
  error.value = ''
}

onIonViewWillEnter(resetForm)

onIonViewDidLeave(() => {
  password.value = ''
  confirm.value = ''
  currentPassword.value = ''
})

const emailChanged = computed(() => email.value !== (auth.user?.email || ''))
const dirty = computed(
  () =>
    username.value !== (auth.user?.username || '') ||
    emailChanged.value ||
    !!password.value,
)

async function toast(message: string, color = 'success') {
  const t = await toastController.create({ message, duration: 2000, color })
  await t.present()
}

async function handleSave() {
  error.value = ''
  if (!username.value) {
    error.value = 'Имя пользователя не может быть пустым'
    return
  }
  if (password.value) {
    const passwordError = validatePassword(password.value)
    if (passwordError) {
      error.value = passwordError
      return
    }
    if (password.value !== confirm.value) {
      error.value = 'Пароли не совпадают'
      return
    }
    if (!currentPassword.value) {
      error.value = 'Введите текущий пароль'
      return
    }
  }
  const payload: UserUpdate = { username: username.value }
  if (emailChanged.value) {
    payload.email = email.value
  }
  if (password.value) {
    payload.password = password.value
    payload.current_password = currentPassword.value
  }
  loading.value = true
  try {
    await auth.updateProfile(payload)
    await toast('Профиль обновлён')
    router.push('/profile')
  } catch (err: any) {
    error.value = err?.response?.data?.detail || 'Не удалось сохранить профиль'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.edit-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-title {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.edit-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-section-title {
  margin: 0;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.edit-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  padding: 13px 0;
  color: var(--ion-text-color);
  font-family: inherit;
}

.field-input input::placeholder {
  color: var(--ion-color-step-400);
}

.field-hint {
  font-size: 12px;
  color: var(--ion-color-medium);
  padding: 0 4px;
}

.edit-error {
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

.edit-error ion-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.save-btn {
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

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

.save-btn:disabled {
  opacity: 0.5;
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
