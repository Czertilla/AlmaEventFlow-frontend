<template>
  <ion-app>
    <!-- Мгновенная реакция на клик по ссылке/карточке: чанк маршрута и данные
         страницы грузятся асинхронно, и до их готовности экран иначе не меняется
         вообще -- полоса загрузки закрывает это окно. -->
    <div v-if="isNavigating" class="nav-progress" />
    <div class="app-shell">
      <!-- Desktop Header (normal flow — never overlaps content) -->
      <DesktopHeader v-if="isDesktop && auth.isAuthenticated" />
      <div class="app-outlet">
        <!-- Корневой outlet: рендерит либо страницу авторизации, либо TabsShell
             (с его внутренним ion-tabs + нижней навигацией на мобильных) -->
        <ion-router-outlet id="main-content" />
      </div>
    </div>
    <!-- Profile Menu (all platforms) -->
    <ProfileMenu v-if="auth.isAuthenticated" />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { usePrincipalStore } from '@/stores/principal'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePlatform } from '@/composables/usePlatform'
import { isNavigating } from '@/composables/useNavigationProgress'
import DesktopHeader from '@/components/layout/DesktopHeader.vue'
import ProfileMenu from '@/components/layout/ProfileMenu.vue'

const auth = useAuthStore()
const settings = useSettingsStore()
const principal = usePrincipalStore()
const calendar = useEventCalendarStore()
const { isDesktop } = usePlatform()

onMounted(() => {
  settings.applyTheme(settings.theme)
})

// Идентичность аккаунта (sub из JWT) — меняется при смене аккаунта даже без разлогина,
// в отличие от булева isAuthenticated, который остаётся true
watch(() => auth.jwtPayload?.sub ?? null, async (sub) => {
  if (sub) {
    calendar.reset()
    await principal.fetchCollectives()
  } else {
    principal.setCollectives([])
    calendar.reset()
  }
}, { immediate: true })
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-outlet {
  position: relative;
  flex: 1;
  min-height: 0;
}

.nav-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 99999;
  overflow: hidden;
  background: rgba(var(--ion-color-primary-rgb), 0.15);
}

.nav-progress::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 40%;
  background: var(--ion-color-primary);
  border-radius: 3px;
  animation: nav-progress-slide 1s ease-in-out infinite;
}

@keyframes nav-progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
