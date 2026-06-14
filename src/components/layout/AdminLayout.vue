<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="admin-shell">
        <!-- Desktop: persistent sidebar grouped by API microservice -->
        <aside class="admin-sidebar">
          <div v-for="group in NAV_GROUPS" :key="group.label" class="admin-nav-group">
            <span class="admin-nav-group-label">{{ group.label }}</span>
            <router-link
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              class="admin-nav-link"
              active-class="admin-nav-link--active"
            >
              <ion-icon :icon="item.icon" />
              {{ item.label }}
            </router-link>
          </div>
        </aside>

        <!-- Mobile: horizontally scrollable chips -->
        <nav class="admin-chips">
          <router-link
            v-for="item in flatItems"
            :key="item.path"
            :to="item.path"
            class="admin-chip"
            active-class="admin-chip--active"
          >
            <ion-icon :icon="item.icon" />
            {{ item.label }}
          </router-link>
        </nav>

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
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
} from '@ionic/vue'
import {
  peopleOutline, personOutline, businessOutline, peopleCircleOutline,
  idCardOutline, mapOutline, calendarOutline,
} from 'ionicons/icons'
import { usePlatform } from '@/composables/usePlatform'

defineProps<{ title: string }>()

const { isDesktop } = usePlatform()

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

const flatItems = NAV_GROUPS.flatMap((g) => g.items)
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
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-medium);
  text-decoration: none;
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

.admin-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.admin-chips::-webkit-scrollbar {
  display: none;
}

.admin-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1.5px solid var(--ion-border-color);
  background: var(--ion-card-background);
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
}

.admin-chip ion-icon {
  font-size: 15px;
}

.admin-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(108, 99, 255, 0.08);
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
  .admin-chips {
    width: 100%;
  }
}

@media (min-width: 768px) {
  .admin-sidebar {
    display: flex;
  }
  .admin-chips {
    display: none;
  }
}
</style>
