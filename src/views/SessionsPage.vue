<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>Активные сеансы</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="sessions-page">
        <h1 v-if="isDesktop" class="page-title">Активные сеансы</h1>

        <div v-if="loading" class="sessions-loading">
          <ion-spinner name="crescent" />
        </div>

        <template v-else>
          <div class="sessions-card">
            <div
              v-for="(session, index) in sessions"
              :key="session.id"
              class="session-row"
            >
              <div class="session-icon" :class="{ 'session-icon--current': session.is_current }">
                <ion-icon :icon="deviceIcon(session.device_info)" />
              </div>
              <div class="session-text">
                <span class="session-device">
                  {{ deviceLabel(session.device_info) }}
                  <span v-if="session.is_current" class="session-badge">текущий</span>
                </span>
                <span class="session-meta">
                  {{ session.ip_address || 'IP неизвестен' }} ·
                  активность {{ formatDate(session.last_used_at, settings.dateFormat) }}
                  {{ formatTime(session.last_used_at) }}
                </span>
              </div>
              <button
                v-if="!session.is_current"
                class="session-revoke"
                :disabled="busyId === session.id"
                @click="revokeOne(session)"
              >
                <ion-icon :icon="closeOutline" />
              </button>
              <div v-if="index < sessions.length - 1" class="session-divider" />
            </div>

            <div v-if="!sessions.length" class="sessions-empty">
              Нет активных сеансов
            </div>
          </div>

          <button
            v-if="hasOthers"
            class="revoke-all-btn"
            :disabled="busyAll"
            @click="revokeOthers"
          >
            <span v-if="busyAll" class="btn-spinner" />
            <span v-else>Завершить все остальные сеансы</span>
          </button>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePlatform } from '@/composables/usePlatform'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, formatTime } from '@/utils/date'
import { confirmAction } from '@/utils/confirm'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonIcon, IonSpinner, toastController,
} from '@ionic/vue'
import {
  closeOutline, phonePortraitOutline, desktopOutline, tabletPortraitOutline,
} from 'ionicons/icons'
import {
  listMySessionsUserV1UsersMeSessionsGet,
  revokeSessionUserV1UsersMeSessionsSessionIdDelete,
  revokeOtherSessionsUserV1UsersMeSessionsDelete,
} from '@/api/generated/almaEventFlow'
import type { SessionRead } from '@/api/generated/almaEventFlow'

const { isDesktop } = usePlatform()
const settings = useSettingsStore()

const sessions = ref<SessionRead[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)
const busyAll = ref(false)

const hasOthers = computed(() => sessions.value.some((s) => !s.is_current))

function isMobile(ua: string | null | undefined): boolean {
  return !!ua && /android|iphone|mobile/i.test(ua)
}

function isTablet(ua: string | null | undefined): boolean {
  return !!ua && /ipad|tablet/i.test(ua)
}

function deviceIcon(ua: string | null | undefined): string {
  if (isTablet(ua)) return tabletPortraitOutline
  if (isMobile(ua)) return phonePortraitOutline
  return desktopOutline
}

function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return 'Неизвестное устройство'
  const browser =
    /edg/i.test(ua) ? 'Edge'
      : /chrome|crios/i.test(ua) ? 'Chrome'
        : /firefox|fxios/i.test(ua) ? 'Firefox'
          : /safari/i.test(ua) ? 'Safari'
            : 'Браузер'
  const os =
    /windows/i.test(ua) ? 'Windows'
      : /android/i.test(ua) ? 'Android'
        : /iphone|ipad|ipod|ios/i.test(ua) ? 'iOS'
          : /mac os/i.test(ua) ? 'macOS'
            : /linux/i.test(ua) ? 'Linux'
              : ''
  return os ? `${browser} · ${os}` : browser
}

async function toast(message: string, color = 'success') {
  const t = await toastController.create({ message, duration: 2000, color })
  await t.present()
}

async function load() {
  loading.value = true
  try {
    const response = await listMySessionsUserV1UsersMeSessionsGet()
    sessions.value = response.data
  } catch {
    await toast('Не удалось загрузить сеансы', 'danger')
  } finally {
    loading.value = false
  }
}

async function revokeOne(session: SessionRead) {
  const ok = await confirmAction(
    'Завершить сеанс',
    `Завершить сеанс на устройстве «${deviceLabel(session.device_info)}»?`,
  )
  if (!ok) return
  busyId.value = session.id
  try {
    await revokeSessionUserV1UsersMeSessionsSessionIdDelete(session.id)
    sessions.value = sessions.value.filter((s) => s.id !== session.id)
    await toast('Сеанс завершён')
  } catch {
    await toast('Не удалось завершить сеанс', 'danger')
  } finally {
    busyId.value = null
  }
}

async function revokeOthers() {
  const ok = await confirmAction(
    'Завершить остальные сеансы',
    'Все сеансы, кроме текущего, будут завершены. Продолжить?',
  )
  if (!ok) return
  busyAll.value = true
  try {
    await revokeOtherSessionsUserV1UsersMeSessionsDelete()
    sessions.value = sessions.value.filter((s) => s.is_current)
    await toast('Остальные сеансы завершены')
  } catch {
    await toast('Не удалось завершить сеансы', 'danger')
  } finally {
    busyAll.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.sessions-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.sessions-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.sessions-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 4px 16px;
}

.session-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
}

.session-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  background: var(--ion-background-color);
  color: var(--ion-color-medium);
}

.session-icon--current {
  background: rgba(108, 99, 255, 0.1);
  color: #6C63FF;
}

.session-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.session-device {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #6C63FF;
  background: rgba(108, 99, 255, 0.12);
  padding: 2px 8px;
  border-radius: 8px;
}

.session-meta {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.session-revoke {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: none;
  background: rgba(255, 71, 87, 0.1);
  color: var(--ion-color-danger);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.session-revoke:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.session-divider {
  position: absolute;
  left: 54px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--ion-border-color);
}

.sessions-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 14px;
  color: var(--ion-color-medium);
}

.revoke-all-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 71, 87, 0.1);
  color: var(--ion-color-danger);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.revoke-all-btn:hover:not(:disabled) {
  background: rgba(255, 71, 87, 0.16);
}

.revoke-all-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255, 71, 87, 0.3);
  border-top-color: var(--ion-color-danger);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
