<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/settings" />
        </ion-buttons>
        <ion-title>Календарные подписки</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="calsub-page">
        <h1 v-if="isDesktop" class="page-title">Календарные подписки</h1>

        <div class="calsub-intro">
          <ion-icon :icon="informationCircleOutline" />
          <p>
            Подключите расписание мероприятий к Google Calendar, Apple Calendar,
            Outlook и другим календарям. Создайте подписку и добавьте ссылку как
            подписку по URL: для Google — ссылка <code>https</code>, для Apple —
            <code>webcal</code>. Цвет задаётся в самом календаре — для разных
            коллективов создавайте отдельные подписки.
          </p>
        </div>

        <div v-if="store.loading" class="calsub-empty">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="store.error" class="calsub-empty calsub-error">
          {{ store.error }}
          <ion-button fill="clear" size="small" @click="store.refresh()">Повторить</ion-button>
        </div>

        <template v-else>
          <div v-if="availableNotSubscribed.length" class="calsub-section">
            <h3 class="calsub-section-title">Доступные календари</h3>
            <div class="calsub-card">
              <template v-for="(feed, i) in availableNotSubscribed" :key="descriptorKey(feed)">
                <div v-if="i > 0" class="calsub-divider" />
                <div class="calsub-row">
                  <div class="calsub-row-icon" :style="iconStyle(feed.type)">
                    <ion-icon :icon="iconFor(feed.type)" />
                  </div>
                  <div class="calsub-row-text">
                    <span class="calsub-row-label">{{ feed.title }}</span>
                    <span class="calsub-row-hint">{{ typeLabel(feed.type) }}</span>
                  </div>
                  <ion-button
                    size="small"
                    :disabled="creatingKey === descriptorKey(feed)"
                    @click="onCreate(feed)"
                  >
                    Создать
                  </ion-button>
                </div>
              </template>
            </div>
          </div>

          <div class="calsub-section">
            <h3 class="calsub-section-title">Мои подписки</h3>
            <div v-if="!store.subscriptions.length" class="calsub-empty">
              Пока нет подписок. Создайте одну из доступных календарей выше.
            </div>
            <div v-else class="calsub-card">
              <template v-for="(sub, i) in store.subscriptions" :key="sub.id">
                <div v-if="i > 0" class="calsub-divider" />
                <div class="calsub-sub">
                  <div class="calsub-row">
                    <div class="calsub-row-icon" :style="iconStyle(sub.type)">
                      <ion-icon :icon="iconFor(sub.type)" />
                    </div>
                    <div class="calsub-row-text">
                      <span class="calsub-row-label">{{ sub.title }}</span>
                      <span class="calsub-row-hint">
                        Создана {{ formatDate(sub.created_at, settings.dateFormat) }}
                        <template v-if="sub.last_accessed_at">
                          · синхр. {{ formatDate(sub.last_accessed_at, settings.dateFormat) }}
                        </template>
                      </span>
                    </div>
                  </div>

                  <template v-if="store.feedUrl(sub.id)">
                    <div class="calsub-url">
                      <code>{{ store.feedUrl(sub.id) }}</code>
                      <ion-button fill="clear" size="small" @click="copy(store.feedUrl(sub.id)!)">
                        <ion-icon slot="icon-only" :icon="copyOutline" />
                      </ion-button>
                    </div>
                    <div class="calsub-schemes">
                      <ion-button fill="clear" size="small" @click="copy(store.feedUrl(sub.id)!)">
                        <ion-icon slot="start" :icon="copyOutline" />
                        Google (https)
                      </ion-button>
                      <ion-button fill="clear" size="small" @click="openWebcal(store.feedUrl(sub.id)!)">
                        <ion-icon slot="start" :icon="calendarOutline" />
                        Apple (webcal)
                      </ion-button>
                    </div>
                  </template>
                  <div v-else class="calsub-url-hint">
                    <ion-icon :icon="lockClosedOutline" />
                    Ссылка показывается один раз. Сбросьте токен, чтобы получить новую.
                  </div>

                  <div class="calsub-actions">
                    <ion-button fill="outline" size="small" @click="onRotate(sub)">
                      <ion-icon slot="start" :icon="refreshOutline" />
                      Сбросить токен
                    </ion-button>
                    <ion-button fill="clear" color="danger" size="small" @click="onDelete(sub)">
                      <ion-icon slot="start" :icon="trashOutline" />
                      Отключить
                    </ion-button>
                  </div>
                </div>
              </template>
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
  IonButton, IonIcon, IonSpinner, toastController,
} from '@ionic/vue'
import {
  informationCircleOutline, copyOutline, refreshOutline, trashOutline,
  lockClosedOutline, peopleOutline, personOutline, ribbonOutline,
  calendarOutline,
} from 'ionicons/icons'
import { useCalendarSubscriptionsStore } from '@/stores/calendarSubscriptions'
import { useSettingsStore } from '@/stores/settings'
import { usePlatform } from '@/composables/usePlatform'
import { confirmAction } from '@/utils/confirm'
import { formatDate } from '@/utils/date'
import { CalendarSubscriptionTypeEnum } from '@/api/generated/almaEventFlow'
import type { FeedDescriptor, SubscriptionRead } from '@/api/generated/almaEventFlow'

const store = useCalendarSubscriptionsStore()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()

const creatingKey = ref<string | null>(null)

const availableFeeds = computed<FeedDescriptor[]>(() => {
  const a = store.available
  const list: FeedDescriptor[] = []
  if (a.personal) list.push(a.personal)
  if (a.member_collectives) list.push(...a.member_collectives)
  if (a.principal_collectives) list.push(...a.principal_collectives)
  return list
})

const availableNotSubscribed = computed(() =>
  availableFeeds.value.filter((f) => !store.isSubscribed(f)),
)

function descriptorKey(feed: FeedDescriptor): string {
  return `${feed.type}:${feed.collective_id ?? ''}`
}

function typeLabel(type: CalendarSubscriptionTypeEnum): string {
  switch (type) {
    case CalendarSubscriptionTypeEnum.personal_all:
      return 'Все мои мероприятия'
    case CalendarSubscriptionTypeEnum.personal_collective:
      return 'Мои мероприятия в коллективе'
    case CalendarSubscriptionTypeEnum.principal_collective:
      return 'Управленческий календарь руководителя'
    default:
      return ''
  }
}

function iconFor(type: CalendarSubscriptionTypeEnum) {
  if (type === CalendarSubscriptionTypeEnum.personal_all) return personOutline
  if (type === CalendarSubscriptionTypeEnum.principal_collective) return ribbonOutline
  return peopleOutline
}

function iconStyle(type: CalendarSubscriptionTypeEnum): Record<string, string> {
  if (type === CalendarSubscriptionTypeEnum.personal_all) {
    return { background: 'rgba(108, 99, 255, 0.1)', color: '#6C63FF' }
  }
  if (type === CalendarSubscriptionTypeEnum.principal_collective) {
    return { background: 'rgba(255, 184, 0, 0.12)', color: '#D49A00' }
  }
  return { background: 'rgba(0, 217, 166, 0.1)', color: '#00BF92' }
}

async function toast(message: string, color = 'success') {
  const t = await toastController.create({ message, duration: 2000, color })
  await t.present()
}

async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    await toast('Ссылка скопирована')
  } catch {
    await toast('Не удалось скопировать ссылку', 'danger')
  }
}

function toWebcal(url: string): string {
  return url.replace(/^https?:\/\//i, 'webcal://')
}

async function openWebcal(url: string) {
  const webcal = toWebcal(url)
  try {
    await navigator.clipboard.writeText(webcal)
  } catch {
    // clipboard may be unavailable; opening the scheme still works
  }
  window.location.href = webcal
}

async function onCreate(feed: FeedDescriptor) {
  creatingKey.value = descriptorKey(feed)
  try {
    const created = await store.create({ type: feed.type, collective_id: feed.collective_id })
    await copy(created.feed_url)
  } catch {
    await toast('Не удалось создать подписку', 'danger')
  } finally {
    creatingKey.value = null
  }
}

async function onRotate(sub: SubscriptionRead) {
  const ok = await confirmAction(
    'Сбросить токен?',
    'Старая ссылка перестанет работать. Календари с прежней ссылкой нужно будет переподключить.',
  )
  if (!ok) return
  try {
    const created = await store.rotate(sub.id)
    await copy(created.feed_url)
  } catch {
    await toast('Не удалось сбросить токен', 'danger')
  }
}

async function onDelete(sub: SubscriptionRead) {
  const ok = await confirmAction(
    'Отключить подписку?',
    'Ссылка станет недействительной, а календарь перестанет обновляться.',
  )
  if (!ok) return
  try {
    await store.remove(sub.id)
    await toast('Подписка отключена')
  } catch {
    await toast('Не удалось отключить подписку', 'danger')
  }
}

onMounted(() => store.refresh())
</script>

<style scoped>
.calsub-page {
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

.calsub-intro {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
}

.calsub-intro ion-icon {
  font-size: 22px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.calsub-intro p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.calsub-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calsub-section-title {
  margin: 0;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.calsub-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 4px 16px;
}

.calsub-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
}

.calsub-row-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.calsub-row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.calsub-row-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
}

.calsub-row-hint {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.calsub-divider {
  height: 1px;
  background: var(--ion-border-color);
}

.calsub-sub {
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calsub-sub .calsub-row {
  padding: 2px 0;
}

.calsub-url {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--ion-background-color);
  border-radius: 10px;
}

.calsub-url code {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ion-text-color);
}

.calsub-schemes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.calsub-url-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.calsub-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.calsub-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  font-size: 14px;
  color: var(--ion-color-medium);
  text-align: center;
}

.calsub-error {
  color: var(--ion-color-danger);
}
</style>
