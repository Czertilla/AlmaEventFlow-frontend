<template>
  <ion-page>
    <!-- Мобильная шапка: на десктопе её заменяет глобальная шапка приложения -->
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="principal-shell">
        <h1 v-if="isDesktop" class="principal-title">{{ title }}</h1>

        <div class="principal-top">
          <!-- Выбор коллектива (ТЗ: заголовок панели содержит выпадающий список) -->
          <div class="collective-select">
            <span class="collective-select-dot" :style="{ background: activeColor }" />
            <select
              class="collective-select-input"
              :value="principal.activePrincipalCollectiveId ?? ''"
              @change="onCollectiveChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="c in principal.principalCollectives" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <ion-icon :icon="chevronDownOutline" class="collective-select-arrow" />
          </div>

          <!-- Навигация по разделам панели -->
          <nav class="principal-tabs">
            <router-link
              v-for="tab in TABS"
              :key="tab.path"
              :to="tab.path"
              class="principal-tab"
              active-class="principal-tab--active"
            >
              <ion-icon :icon="tab.icon" />
              {{ tab.label }}
            </router-link>
          </nav>

          <!-- Десктоп: кнопка добавления записи -->
          <button v-if="addLabel && isDesktop" class="add-btn-desktop" @click="$emit('add')">
            <ion-icon :icon="addOutline" />
            {{ addLabel }}
          </button>
        </div>

        <main class="principal-main">
          <slot />
        </main>
      </div>
    </ion-content>

    <!-- Мобильный FAB — вне ion-content, чтобы не скроллился -->
    <AppFab v-if="addLabel && !isDesktop" :icon="addOutline" :aria-label="addLabel" @click="$emit('add')" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
} from '@ionic/vue'
import { peopleOutline, ribbonOutline, calendarOutline, chevronDownOutline, addOutline } from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import { usePlatform } from '@/composables/usePlatform'
import { getCollectiveColor } from '@/utils/colors'
import AppFab from '@/components/common/AppFab.vue'

defineProps<{
  title: string
  addLabel?: string
}>()

defineEmits<{ add: [] }>()

const principal = usePrincipalStore()
const { isDesktop } = usePlatform()

const TABS = [
  { path: '/principal/members', label: 'Участники', icon: peopleOutline },
  { path: '/principal/roles', label: 'Роли', icon: ribbonOutline },
  { path: '/principal/events', label: 'Мероприятия', icon: calendarOutline },
]

const activeColor = computed(() =>
  principal.activePrincipalCollectiveId ? getCollectiveColor(principal.activePrincipalCollectiveId) : '#92949c',
)

function onCollectiveChange(id: string) {
  if (id) principal.setActivePrincipalCollective(id)
}
</script>

<style scoped>
.principal-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
}

.principal-title {
  margin: 4px 0 16px;
  font-size: 22px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.principal-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.collective-select {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.collective-select:focus-within,
.collective-select:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

.collective-select-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.collective-select-input {
  appearance: none;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-text-color);
  padding: 10px 22px 10px 0;
  cursor: pointer;
  max-width: 240px;
  text-overflow: ellipsis;
}

.collective-select-arrow {
  position: absolute;
  right: 10px;
  font-size: 13px;
  color: var(--ion-color-medium);
  pointer-events: none;
}

.principal-tabs {
  display: flex;
  gap: 4px;
  background: var(--ion-card-background);
  border-radius: 12px;
  padding: 4px;
  box-shadow: var(--ion-card-shadow);
  overflow-x: auto;
  scrollbar-width: none;
}

.principal-tabs::-webkit-scrollbar {
  display: none;
}

.principal-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.15s;
}

.principal-tab ion-icon {
  font-size: 15px;
}

.principal-tab:hover {
  color: var(--ion-text-color);
}

.principal-tab--active {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.principal-main {
  min-width: 0;
}

.add-btn-desktop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.add-btn-desktop:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

.add-btn-desktop ion-icon {
  font-size: 17px;
}
</style>
