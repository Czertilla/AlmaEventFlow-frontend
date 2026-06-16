<template>
  <ion-page>
    <!-- Mobile: sliding side menu (drawer) with all admin resources -->
    <ion-menu
      v-if="!isDesktop"
      content-id="admin-content"
      menu-id="admin-menu"
      type="overlay"
      class="admin-menu"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Администрирование</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="admin-menu-body">
          <button class="admin-nav-link admin-nav-link--home" @click="go('/')">
            <ion-icon :icon="homeOutline" />
            На главную
          </button>
          <div v-for="group in NAV_GROUPS" :key="group.label" class="admin-nav-group">
            <span class="admin-nav-group-label">{{ group.label }}</span>
            <button
              v-for="item in group.items"
              :key="item.path"
              class="admin-nav-link"
              :class="{ 'admin-nav-link--active': isActive(item.path) }"
              @click="go(item.path)"
            >
              <ion-icon :icon="item.icon" />
              {{ item.label }}
            </button>
          </div>
        </div>
      </ion-content>
    </ion-menu>

    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button menu="admin-menu" />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content id="admin-content">
      <div class="admin-shell">
        <!-- Desktop: persistent sidebar grouped by API microservice -->
        <aside class="admin-sidebar">
          <div v-for="group in NAV_GROUPS" :key="group.label" class="admin-nav-group">
            <span class="admin-nav-group-label">{{ group.label }}</span>
            <button
              v-for="item in group.items"
              :key="item.path"
              class="admin-nav-link"
              :class="{ 'admin-nav-link--active': isActive(item.path) }"
              @click="go(item.path)"
            >
              <ion-icon :icon="item.icon" />
              {{ item.label }}
            </button>
          </div>
        </aside>

        <main class="admin-main">
          <h1 v-if="isDesktop" class="admin-title">{{ title }}</h1>
          <slot />
        </main>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
  IonMenu, IonMenuButton, useIonRouter, menuController,
} from '@ionic/vue'
import {
  peopleOutline, personOutline, businessOutline, peopleCircleOutline,
  idCardOutline, mapOutline, calendarOutline, homeOutline,
} from 'ionicons/icons'
import { useRoute } from 'vue-router'
import { usePlatform } from '@/composables/usePlatform'

defineProps<{ title: string }>()

const { isDesktop } = usePlatform()
const ionRouter = useIonRouter()
const route = useRoute()

// Grouped by API microservice (TZ: навигация с разделением по микросервисам)
const NAV_GROUPS = [
  { label: 'User', items: [
    { path: '/admin/users', label: 'Пользователи', icon: peopleOutline },
  ]},
  { label: 'Org', items: [
    { path: '/admin/organizations', label: 'Организации', icon: businessOutline },
    { path: '/admin/collectives', label: 'Коллективы', icon: peopleCircleOutline },
  ]},
  { label: 'Profile', items: [
    { path: '/admin/persons', label: 'Персоны', icon: personOutline },
    { path: '/admin/profiles', label: 'Профили', icon: idCardOutline },
  ]},
  { label: 'Geo', items: [
    { path: '/admin/geo', label: 'Гео', icon: mapOutline },
  ]},
  { label: 'Event', items: [
    { path: '/admin/events', label: 'Мероприятия', icon: calendarOutline },
  ]},
]

function isActive(path: string): boolean {
  return route.path === path
}

// Switch resources without stacking pages: a root-direction replace resets the
// Ionic navigation stack, so the back button always returns to the home page
// instead of walking the previously visited admin resources.
async function go(path: string) {
  await menuController.close('admin-menu').catch(() => {})
  if (route.path === path) return
  ionRouter.navigate(path, 'root', 'replace')
}
</script>

<style scoped>
.admin-shell {
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  gap: 20px;
  align-items: flex-start;
}

.admin-sidebar {
  display: none;
  width: 220px;
  flex-shrink: 0;
  flex-direction: column;
  gap: 18px;
  position: sticky;
  top: 16px;
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 16px 10px;
}

.admin-menu-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 12px 10px;
}

.admin-nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-nav-group-label {
  padding: 0 12px 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ion-color-step-400);
}

.admin-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-medium);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.admin-nav-link ion-icon {
  font-size: 17px;
}

.admin-nav-link:hover {
  color: var(--ion-text-color);
  background: var(--ion-background-color);
}

.admin-nav-link--active {
  color: var(--ion-color-primary);
  background: rgba(108, 99, 255, 0.08);
  font-weight: 600;
}

.admin-nav-link--home {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.admin-main {
  flex: 1;
  min-width: 0;
}

.admin-title {
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: 700;
  color: var(--ion-text-color);
}

@media (max-width: 767px) {
  .admin-shell {
    flex-direction: column;
    gap: 12px;
  }
}

@media (min-width: 768px) {
  .admin-sidebar {
    display: flex;
  }
}
</style>
