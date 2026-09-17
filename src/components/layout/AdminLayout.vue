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
          <!-- AdminLayout смонтирована один раз на весь /admin/*, страница
               переключается здесь обычной Vue-реактивностью по activeSection,
               а не через vue-router -- см. go()/utils/inPlaceNav.ts.
               remountTick в ключе форсирует пересоздание (и повторную загрузку
               данных) при возврате в раздел -- см. onIonViewWillEnter выше. -->
          <component :is="currentPage.component" v-if="currentPage" v-bind="personId ? { personId } : {}" :key="`${activeSection}-${remountTick}`" />
        </main>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, provide, ref } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
  IonMenu, IonMenuButton, menuController, onIonViewWillEnter,
} from '@ionic/vue'
import {
  peopleOutline, personOutline, businessOutline, peopleCircleOutline,
  idCardOutline, mapOutline, calendarOutline, homeOutline,
  schoolOutline, restaurantOutline, ribbonOutline, checkmarkDoneOutline,
  personAddOutline,
} from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { usePlatform } from '@/composables/usePlatform'
import { syncAddressBar } from '@/utils/inPlaceNav'
import { adminNavigateKey } from '@/composables/useAdminNavigate'

const { isDesktop } = usePlatform()
const router = useRouter()

interface AdminPageEntry {
  title: string
  component: ReturnType<typeof defineAsyncComponent>
}

const PAGES: Record<string, AdminPageEntry> = {
  '/admin/users': { title: 'Пользователи', component: defineAsyncComponent(() => import('@/views/admin/AdminUsers.vue')) },
  '/admin/organizations': { title: 'Организации', component: defineAsyncComponent(() => import('@/views/admin/AdminOrganizations.vue')) },
  '/admin/collectives': { title: 'Коллективы', component: defineAsyncComponent(() => import('@/views/admin/AdminCollectives.vue')) },
  '/admin/persons': { title: 'Персоны', component: defineAsyncComponent(() => import('@/views/admin/AdminPersons.vue')) },
  '/admin/profiles': { title: 'Профили', component: defineAsyncComponent(() => import('@/views/admin/AdminProfiles.vue')) },
  '/admin/students': { title: 'Студенты', component: defineAsyncComponent(() => import('@/views/admin/AdminStudents.vue')) },
  '/admin/diets': { title: 'Диеты', component: defineAsyncComponent(() => import('@/views/admin/AdminDiets.vue')) },
  '/admin/geo': { title: 'Гео', component: defineAsyncComponent(() => import('@/views/admin/AdminGeo.vue')) },
  '/admin/events': { title: 'Мероприятия', component: defineAsyncComponent(() => import('@/views/admin/AdminEvents.vue')) },
  '/admin/participation': { title: 'Участия', component: defineAsyncComponent(() => import('@/views/admin/AdminParticipation.vue')) },
  '/admin/attendance': { title: 'Посещаемость', component: defineAsyncComponent(() => import('@/views/admin/AdminAttendance.vue')) },
  '/admin/members': { title: 'Участники', component: defineAsyncComponent(() => import('@/views/admin/AdminMembers.vue')) },
  '/admin/roles': { title: 'Роли', component: defineAsyncComponent(() => import('@/views/admin/AdminRoles.vue')) },
}

const personFilePage: AdminPageEntry = {
  title: 'Личное дело',
  component: defineAsyncComponent(() => import('@/views/admin/AdminPersonFile.vue')),
}

const PERSON_FILE_PREFIX = '/admin/persons/'

// Активный раздел живёт в локальном состоянии, а не в route.path -- см.
// utils/inPlaceNav.ts, почему смена route.path здесь недопустима.
// Начальное значение берём из реального адреса (первый заход в /admin/*
// это ОБЫЧНАЯ vue-router навигация, значит window.location уже верный).
const activeSection = ref(window.location.pathname)

function entryFor(path: string): AdminPageEntry | null {
  if (path.startsWith(PERSON_FILE_PREFIX) && path !== PERSON_FILE_PREFIX) return personFilePage
  return PAGES[path] ?? null
}

const currentPage = computed<AdminPageEntry | null>(() => entryFor(activeSection.value))
const personId = computed(() => {
  const p = activeSection.value
  return p.startsWith(PERSON_FILE_PREFIX) ? p.slice(PERSON_FILE_PREFIX.length) : undefined
})

const title = computed(() => currentPage.value?.title ?? '')

function navigate(path: string) {
  activeSection.value = path
  syncAddressBar(path)
}
provide(adminNavigateKey, navigate)

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
    { path: '/admin/students', label: 'Студенты', icon: schoolOutline },
    { path: '/admin/diets', label: 'Диеты', icon: restaurantOutline },
  ]},
  { label: 'Geo', items: [
    { path: '/admin/geo', label: 'Гео', icon: mapOutline },
  ]},
  { label: 'Event', items: [
    { path: '/admin/events', label: 'Мероприятия', icon: calendarOutline },
    { path: '/admin/participation', label: 'Участия', icon: personAddOutline },
    { path: '/admin/attendance', label: 'Посещаемость', icon: checkmarkDoneOutline },
    { path: '/admin/members', label: 'Участники', icon: peopleOutline },
    { path: '/admin/roles', label: 'Роли', icon: ribbonOutline },
  ]},
]

function isActive(path: string): boolean {
  return activeSection.value === path
}

// AdminLayout монтируется один раз на весь /admin/* (см. коммент выше), а
// ion-router-outlet по умолчанию кэширует уже посещённые страницы и не
// размонтирует их при переходе на другую -- поэтому обычный onMounted у
// дочерних страниц сработал бы только один раз за всё время жизни вкладки, а
// не при каждом возврате в раздел. Форсируем пересоздание активной дочерней
// страницы при каждом реальном возврате в раздел (см. :key ниже) -- тот же
// приём, что и в PrincipalLayout.vue.
const remountTick = ref(0)
let firstEnter = true
onIonViewWillEnter(() => {
  if (firstEnter) { firstEnter = false; return }
  remountTick.value++
})

async function go(path: string) {
  if (!isDesktop.value) {
    await menuController.close('admin-menu').catch(() => {})
  }
  if (activeSection.value === path) return
  if (path === '/') {
    // Выход из раздела -- отдельная route-запись (HomePage), здесь уместен
    // обычный push с историей назад.
    router.push(path)
    return
  }
  navigate(path)
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
  background: rgba(var(--ion-color-primary-rgb), 0.08);
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
