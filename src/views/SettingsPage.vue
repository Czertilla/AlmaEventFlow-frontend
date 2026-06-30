<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>Настройки</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="settings-page">
        <h1 v-if="isDesktop" class="page-title">Настройки</h1>
        <div class="settings-section">
          <h3 class="settings-section-title">Внешний вид</h3>
          <div class="settings-card">
            <div class="settings-row">
              <div class="settings-row-icon" style="background: rgba(108, 99, 255, 0.1); color: #6C63FF;">
                <ion-icon :icon="moonOutline" />
              </div>
              <div class="settings-row-text">
                <span class="settings-row-label">Тёмная тема</span>
                <span class="settings-row-hint">Переключение светлой и тёмной палитры</span>
              </div>
              <ion-toggle :checked="settings.theme === 'dark'" @ion-change="settings.toggleTheme()" />
            </div>
            <div class="settings-divider" />
            <div class="settings-row">
              <div class="settings-row-icon" style="background: rgba(0, 217, 166, 0.1); color: #00BF92;">
                <ion-icon :icon="sparklesOutline" />
              </div>
              <div class="settings-row-text">
                <span class="settings-row-label">Анимации</span>
                <span class="settings-row-hint">Переходы и эффекты. «Авто» учитывает системную экономию движения</span>
              </div>
              <ion-select
                :value="settings.animations"
                interface="popover"
                @ion-change="settings.animations = $event.detail.value"
              >
                <ion-select-option value="auto">Авто</ion-select-option>
                <ion-select-option value="on">Включены</ion-select-option>
                <ion-select-option value="off">Выключены</ion-select-option>
              </ion-select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Дата и время</h3>
          <div class="settings-card">
            <div class="settings-row">
              <div class="settings-row-icon" style="background: rgba(0, 217, 166, 0.1); color: #00BF92;">
                <ion-icon :icon="calendarOutline" />
              </div>
              <div class="settings-row-text">
                <span class="settings-row-label">Формат даты</span>
              </div>
              <ion-select
                :value="settings.dateFormat"
                interface="popover"
                @ion-change="settings.dateFormat = $event.detail.value"
              >
                <ion-select-option value="DD.MM.YYYY">DD.MM.YYYY</ion-select-option>
                <ion-select-option value="YYYY-MM-DD">YYYY-MM-DD</ion-select-option>
                <ion-select-option value="MM/DD/YYYY">MM/DD/YYYY</ion-select-option>
              </ion-select>
            </div>
            <div class="settings-divider" />
            <div class="settings-row">
              <div class="settings-row-icon" style="background: rgba(255, 184, 0, 0.12); color: #D49A00;">
                <ion-icon :icon="todayOutline" />
              </div>
              <div class="settings-row-text">
                <span class="settings-row-label">Первый день недели</span>
              </div>
              <ion-select
                :value="settings.firstDayOfWeek"
                interface="popover"
                @ion-change="settings.firstDayOfWeek = $event.detail.value"
              >
                <ion-select-option value="monday">Понедельник</ion-select-option>
                <ion-select-option value="sunday">Воскресенье</ion-select-option>
              </ion-select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Уведомления</h3>
          <div class="settings-card">
            <button class="settings-row settings-row--link" @click="router.push('/notifications')">
              <div class="settings-row-icon" style="background: rgba(108, 99, 255, 0.1); color: #6C63FF;">
                <ion-icon :icon="notificationsOutline" />
              </div>
              <div class="settings-row-text">
                <span class="settings-row-label">Способы доставки</span>
                <span class="settings-row-hint">Email, web-push и другие каналы уведомлений</span>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="settings-row-arrow" />
            </button>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Календарь</h3>
          <div class="settings-card">
            <button class="settings-row settings-row--link" @click="router.push('/calendar-subscriptions')">
              <div class="settings-row-icon" style="background: rgba(108, 99, 255, 0.1); color: #6C63FF;">
                <ion-icon :icon="calendarNumberOutline" />
              </div>
              <div class="settings-row-text">
                <span class="settings-row-label">Календарные подписки</span>
                <span class="settings-row-hint">Подключение расписания к внешним календарям (ICS)</span>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="settings-row-arrow" />
            </button>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">О приложении</h3>
          <div class="settings-card about-card">
            <div class="about-logo">
              <img src="/aef.svg" alt="Alma Event Flow" />
            </div>
            <div class="about-text">
              <span class="about-name">Alma Event Flow</span>
              <span class="about-version">Приложение {{ appVersion }} · API {{ apiVersion }}</span>
              <span class="about-desc">Управление мероприятиями и присутствиями коллективов</span>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonToggle, IonSelect, IonSelectOption, IonIcon,
} from '@ionic/vue'
import {
  moonOutline, calendarOutline, todayOutline, calendarNumberOutline,
  chevronForwardOutline, notificationsOutline, sparklesOutline,
} from 'ionicons/icons'
import { usePlatform } from '@/composables/usePlatform'

const router = useRouter()
const settings = useSettingsStore()
const { isDesktop } = usePlatform()

// Версия приложения берётся из package.json, версия API — из openapi.json бэкенда
// (оба прокидываются через Vite define; см. vite.config.ts и scripts/fetch-schema.mjs)
const appVersion = __APP_VERSION__
const apiVersion = __API_VERSION__
</script>

<style scoped>
.settings-page {
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

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-section-title {
  margin: 0;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.settings-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 4px 16px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
}

.settings-row-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.settings-row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-row-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
}

.settings-row-hint {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.settings-row--link {
  border: none;
  background: none;
  width: 100%;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.settings-row-arrow {
  font-size: 16px;
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

/* Селекты не должны сжиматься — иначе текст переносится по буквам */
.settings-row ion-select {
  flex-shrink: 0;
  min-width: 150px;
  max-width: 180px;
}

.settings-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin-left: 50px;
}

.about-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
}

.about-logo {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.about-logo img {
  width: 30px;
  height: 32px;
  filter: brightness(0) invert(1);
}

.about-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.about-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.about-version {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.about-desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ion-color-medium);
  line-height: 1.4;
}
</style>
