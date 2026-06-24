<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/settings" />
        </ion-buttons>
        <ion-title>Уведомления</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="notif-page">
        <h1 v-if="isDesktop" class="page-title">Уведомления</h1>

        <div class="notif-intro">
          <ion-icon :icon="informationCircleOutline" />
          <p>
            Выберите, как получать уведомления. Email — гарантированный канал и
            всегда включён. Можно подключить несколько устройств: каждый браузер
            подписывается на push отдельно.
          </p>
        </div>

        <div v-if="store.loading" class="notif-empty">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="store.error" class="notif-empty notif-error">
          {{ store.error }}
          <ion-button fill="clear" size="small" @click="reload()">Повторить</ion-button>
        </div>

        <template v-else>
          <!-- Способы доставки -->
          <div class="notif-section">
            <h3 class="notif-section-title">Способы доставки</h3>
            <div class="notif-card">
              <template v-for="(t, i) in store.transports" :key="t.type">
                <div v-if="i > 0" class="notif-divider" />
                <div class="notif-row">
                  <div class="notif-row-icon" :style="iconStyle(t.type)">
                    <ion-icon :icon="iconFor(t.type)" />
                  </div>
                  <div class="notif-row-text">
                    <span class="notif-row-label">{{ t.label }}</span>
                    <span class="notif-row-hint">{{ transportHint(t) }}</span>
                  </div>
                  <ion-toggle
                    :checked="store.isEnabled(t.type)"
                    :disabled="t.type === 'email' || !t.available"
                    @ion-change="onToggleTransport(t.type, $event)"
                  />
                </div>
              </template>
            </div>
          </div>

          <!-- Push в этом браузере -->
          <div v-if="hasWebPush" class="notif-section">
            <h3 class="notif-section-title">Push в этом браузере</h3>
            <div class="notif-card">
              <div class="notif-row">
                <div class="notif-row-icon" :style="iconStyle('webpush')">
                  <ion-icon :icon="notificationsOutline" />
                </div>
                <div class="notif-row-text">
                  <span class="notif-row-label">Это устройство</span>
                  <span class="notif-row-hint">
                    {{ thisBrowserClient ? 'Push включён на этом устройстве' : 'Push не подключён' }}
                  </span>
                </div>
                <ion-button
                  v-if="!thisBrowserClient"
                  size="small"
                  :disabled="pushBusy || !webpushAvailable"
                  @click="onEnablePush()"
                >
                  Включить
                </ion-button>
                <ion-button
                  v-else
                  size="small"
                  fill="outline"
                  color="medium"
                  :disabled="pushBusy"
                  @click="onDisableThisBrowser()"
                >
                  Отключить
                </ion-button>
              </div>
            </div>
            <p v-if="!webpushAvailable" class="notif-foot-hint">
              Web Push сейчас недоступен на сервере (не настроены VAPID-ключи).
            </p>
          </div>
          <div v-else class="notif-section">
            <p class="notif-foot-hint">
              Этот браузер не поддерживает web-push. Уведомления придут на email.
            </p>
          </div>

          <!-- Подключённые устройства -->
          <div v-if="webpushClients.length" class="notif-section">
            <h3 class="notif-section-title">Подключённые устройства</h3>
            <div class="notif-card">
              <template v-for="(c, i) in webpushClients" :key="c.id">
                <div v-if="i > 0" class="notif-divider" />
                <div class="notif-row">
                  <div class="notif-row-icon" :style="iconStyle('webpush')">
                    <ion-icon :icon="c.endpoint === thisBrowserEndpoint ? phonePortraitOutline : desktopOutline" />
                  </div>
                  <div class="notif-row-text">
                    <span class="notif-row-label">
                      {{ c.label || 'Устройство' }}
                      <span v-if="c.endpoint === thisBrowserEndpoint" class="notif-badge">это устройство</span>
                    </span>
                    <span class="notif-row-hint">Подключено {{ formatDate(c.created_at, settings.dateFormat) }}</span>
                  </div>
                  <ion-button fill="clear" color="danger" size="small" @click="onRemoveClient(c)">
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </div>
              </template>
            </div>
          </div>

          <!-- Тест -->
          <div class="notif-section">
            <div class="notif-card">
              <button class="notif-row notif-row--link" :disabled="testBusy" @click="onSendTest()">
                <div class="notif-row-icon" style="background: rgba(0, 217, 166, 0.1); color: #00BF92;">
                  <ion-icon :icon="paperPlaneOutline" />
                </div>
                <div class="notif-row-text">
                  <span class="notif-row-label">Отправить тест</span>
                  <span class="notif-row-hint">Проверьте доставку по включённым каналам</span>
                </div>
                <ion-icon :icon="chevronForwardOutline" class="notif-row-arrow" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonSpinner, IonToggle, toastController,
} from '@ionic/vue'
import {
  informationCircleOutline, notificationsOutline, mailOutline, trashOutline,
  phonePortraitOutline, desktopOutline, paperPlaneOutline, chevronForwardOutline,
  chatbubbleEllipsesOutline, flashOutline,
} from 'ionicons/icons'
import { useNotificationsStore } from '@/stores/notifications'
import { useSettingsStore } from '@/stores/settings'
import { usePlatform } from '@/composables/usePlatform'
import { useWebPush, isWebPushSupported } from '@/composables/useWebPush'
import { confirmAction } from '@/utils/confirm'
import { formatDate } from '@/utils/date'
import { deleteMyClient, type ClientRead, type TransportInfo, type TransportType } from '@/api/notify'

const store = useNotificationsStore()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()
const webpush = useWebPush()

const hasWebPush = isWebPushSupported
const thisBrowserEndpoint = ref<string | null>(null)
const pushBusy = ref(false)
const testBusy = ref(false)

const webpushTransport = computed<TransportInfo | undefined>(() =>
  store.transports.find((t) => t.type === 'webpush'),
)
const webpushAvailable = computed(() => webpushTransport.value?.available ?? false)
const webpushClients = computed(() => store.clientsFor('webpush'))
const thisBrowserClient = computed(() =>
  webpushClients.value.find((c) => c.endpoint === thisBrowserEndpoint.value) ?? null,
)

function iconFor(type: TransportType) {
  switch (type) {
    case 'email': return mailOutline
    case 'webpush': return notificationsOutline
    case 'telegram': return chatbubbleEllipsesOutline
    case 'realtime': return flashOutline
    default: return notificationsOutline
  }
}

function iconStyle(type: TransportType): Record<string, string> {
  switch (type) {
    case 'email': return { background: 'rgba(0, 217, 166, 0.1)', color: '#00BF92' }
    case 'webpush': return { background: 'rgba(108, 99, 255, 0.1)', color: '#6C63FF' }
    default: return { background: 'rgba(255, 184, 0, 0.12)', color: '#D49A00' }
  }
}

function transportHint(t: TransportInfo): string {
  if (t.type === 'email') return 'Гарантированный канал · всегда включён'
  if (!t.available) return 'Сейчас недоступен'
  if (t.requires_client) return 'Push на подключённые устройства'
  return ''
}

async function toast(message: string, color = 'success') {
  const el = await toastController.create({ message, duration: 2000, color })
  await el.present()
}

async function reload() {
  await store.refresh()
  thisBrowserEndpoint.value = await webpush.currentEndpoint()
}

async function onToggleTransport(type: TransportType, ev: CustomEvent) {
  const enabled = (ev as CustomEvent<{ checked: boolean }>).detail.checked
  try {
    await store.setPreference(type, enabled)
    if (type === 'webpush' && enabled && !thisBrowserClient.value && webpushAvailable.value) {
      await onEnablePush()
    }
  } catch {
    await toast('Не удалось сохранить настройку', 'danger')
    await reload()
  }
}

async function onEnablePush() {
  pushBusy.value = true
  try {
    await webpush.subscribe()
    if (!store.isEnabled('webpush')) await store.setPreference('webpush', true)
    await store.refreshClients()
    thisBrowserEndpoint.value = await webpush.currentEndpoint()
    await toast('Push включён на этом устройстве')
  } catch {
    await toast('Не удалось включить push', 'danger')
  } finally {
    pushBusy.value = false
  }
}

async function onDisableThisBrowser() {
  const client = thisBrowserClient.value
  if (!client) return
  pushBusy.value = true
  try {
    await webpush.unsubscribe(client.id)
    await store.refreshClients()
    thisBrowserEndpoint.value = await webpush.currentEndpoint()
    await toast('Push отключён на этом устройстве')
  } catch {
    await toast('Не удалось отключить push', 'danger')
  } finally {
    pushBusy.value = false
  }
}

async function onRemoveClient(client: ClientRead) {
  const isThis = client.endpoint === thisBrowserEndpoint.value
  const ok = await confirmAction(
    'Отключить устройство?',
    'Это устройство перестанет получать push-уведомления.',
  )
  if (!ok) return
  try {
    if (isThis) {
      await webpush.unsubscribe(client.id)
      thisBrowserEndpoint.value = await webpush.currentEndpoint()
    } else {
      await deleteMyClient(client.id)
    }
    await store.refreshClients()
    await toast('Устройство отключено')
  } catch {
    await toast('Не удалось отключить устройство', 'danger')
  }
}

async function onSendTest() {
  testBusy.value = true
  try {
    await store.sendTest()
    await toast('Тестовое уведомление отправлено')
  } catch {
    await toast('Не удалось отправить тест', 'danger')
  } finally {
    testBusy.value = false
  }
}

onMounted(reload)
</script>

<style scoped>
.notif-page {
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

.notif-intro {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
}

.notif-intro ion-icon {
  font-size: 22px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.notif-intro p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.notif-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notif-section-title {
  margin: 0;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.notif-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 4px 16px;
}

.notif-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
}

.notif-row-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.notif-row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-row-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
}

.notif-badge {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: rgba(108, 99, 255, 0.12);
  color: #6C63FF;
}

.notif-row-hint {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.notif-row--link {
  border: none;
  background: none;
  width: 100%;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.notif-row-arrow {
  font-size: 16px;
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

.notif-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin-left: 50px;
}

.notif-foot-hint {
  margin: 0;
  padding: 0 4px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.notif-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  font-size: 14px;
  color: var(--ion-color-medium);
  text-align: center;
}

.notif-error {
  color: var(--ion-color-danger);
}
</style>
