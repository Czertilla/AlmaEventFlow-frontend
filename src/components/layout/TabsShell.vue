<template>
  <ion-tabs>
    <ion-router-outlet />

    <!-- Нижняя навигация только на мобильных: на десктопе её заменяет DesktopHeader -->
    <ion-tab-bar v-if="!isDesktop" slot="bottom" :selected-tab="selectedTab">
      <ion-tab-button tab="home" href="/">
        <ion-icon :icon="homeOutline" />
        <ion-label>Главная</ion-label>
      </ion-tab-button>

      <ion-tab-button v-if="principal.isPrincipal" tab="principal" href="/principal/members">
        <ion-icon :icon="shieldCheckmarkOutline" />
        <ion-label>Руководитель</ion-label>
      </ion-tab-button>

      <ion-tab-button v-if="auth.isSuperuser" tab="admin" href="/admin/users">
        <ion-icon :icon="settingsOutline" />
        <ion-label>Админ</ion-label>
      </ion-tab-button>

      <!-- Кнопка-действие: открывает боковое меню профиля, не участвует в роутинге -->
      <ion-tab-button tab="profile" @click="openProfileMenu">
        <ion-icon :icon="personOutline" />
        <ion-label>Профиль</ion-label>
      </ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonIcon, IonLabel, menuController,
} from '@ionic/vue'
import { homeOutline, shieldCheckmarkOutline, settingsOutline, personOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { usePrincipalStore } from '@/stores/principal'
import { usePlatform } from '@/composables/usePlatform'

const route = useRoute()
const auth = useAuthStore()
const principal = usePrincipalStore()
const { isDesktop } = usePlatform()

// Подсветку задаём явно: ion-tabs не выводит активную вкладку из плоских
// маршрутов с абсолютными дочерними путями, поэтому считаем её из route.path.
const selectedTab = computed(() => {
  if (route.path.startsWith('/admin')) return 'admin'
  if (route.path.startsWith('/principal')) return 'principal'
  if (route.path === '/' || route.path.startsWith('/event')) return 'home'
  return ''
})

function openProfileMenu() {
  menuController.open('profileMenu')
}
</script>
