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
            <UiInput v-model="username" label="Имя пользователя">
              <template #prefix><ion-icon :icon="personOutline" /></template>
            </UiInput>
            <UiInput
              v-model="email"
              label="Email"
              type="email"
              :hint="emailChanged ? 'После смены email потребуется повторное подтверждение адреса.' : ''"
            >
              <template #prefix><ion-icon :icon="mailOutline" /></template>
            </UiInput>
          </div>
        </div>

        <div class="edit-section">
          <h3 class="edit-section-title">Смена пароля</h3>
          <div class="edit-card">
            <div class="field-group">
              <PasswordField
                v-model="password"
                label="Новый пароль"
                autocomplete="new-password"
                placeholder="Оставьте пустым, чтобы не менять"
              />
              <PasswordStrengthMeter :password="password" />
            </div>
            <template v-if="password">
              <PasswordField v-model="confirm" label="Повторите пароль" autocomplete="new-password" />
              <PasswordField
                v-model="currentPassword"
                label="Текущий пароль"
                autocomplete="current-password"
                hint="Для смены пароля подтвердите текущий. Остальные сеансы будут завершены."
              />
            </template>
          </div>
        </div>

        <div class="edit-section">
          <h3 class="edit-section-title">Telegram</h3>
          <div class="edit-card">
            <div class="telegram-row">
              <ion-icon :icon="paperPlaneOutline" class="telegram-icon" />
              <div class="telegram-text">
                <span class="telegram-title">Привязать аккаунт</span>
                <span class="field-hint">
                  Откроет бота в Telegram — там достаточно нажать «Старт». После
                  этого можно будет входить на сайт через Telegram.
                </span>
              </div>
              <button
                class="telegram-btn"
                :disabled="telegramLoading"
                @click="handleLinkTelegram"
              >
                <span v-if="telegramLoading" class="btn-spinner btn-spinner--small" />
                <span v-else>Привязать</span>
              </button>
            </div>
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
import PasswordField from '@/components/common/PasswordField.vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonIcon, toastController,
  onIonViewWillEnter, onIonViewDidLeave,
} from '@ionic/vue'
import {
  personOutline, mailOutline, alertCircleOutline,
  paperPlaneOutline,
} from 'ionicons/icons'
import { createTelegramLinkTokenUserV1UsersMeTelegramLinkTokenPost } from '@/api/generated/almaEventFlow'
import type { UserUpdate } from '@/api/generated/almaEventFlow'
import UiInput from '@/components/common/UiInput.vue'

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
const telegramLoading = ref(false)

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

async function handleLinkTelegram() {
  telegramLoading.value = true
  try {
    const response = await createTelegramLinkTokenUserV1UsersMeTelegramLinkTokenPost()
    window.open(response.data.deep_link, '_blank')
  } catch (err: any) {
    await toast(
      err?.response?.data?.detail || 'Не удалось получить ссылку для привязки Telegram',
      'danger',
    )
  } finally {
    telegramLoading.value = false
  }
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
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
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
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
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

.field-hint {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
  padding: 0 4px;
}

.telegram-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.telegram-icon {
  font-size: var(--fs-2xl);
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.telegram-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.telegram-title {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.telegram-btn {
  flex-shrink: 0;
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  min-width: 96px;
}

.telegram-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

.telegram-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner--small {
  width: 18px;
  height: 18px;
}

.edit-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 71, 87, 0.1);
  border-radius: 10px;
  color: var(--ion-color-danger);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.edit-error ion-icon {
  font-size: var(--fs-xl);
  flex-shrink: 0;
}

.save-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
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
