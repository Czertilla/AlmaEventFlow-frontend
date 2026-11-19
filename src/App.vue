<template>
  <ion-app>
    <!-- Мгновенная реакция на клик по ссылке/карточке: чанк маршрута и данные
         страницы грузятся асинхронно, и до их готовности экран иначе не меняется
         вообще -- полоса загрузки закрывает это окно. -->
    <div v-if="isNavigating" class="nav-progress" />
    <div class="app-shell">
      <BackendStatusBanner />
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
    <div v-if="!isDesktop && auth.isAuthenticated" class="todo-corner"><TodoAlert /></div>
    <TodoModal v-if="auth.isAuthenticated" />
  </ion-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { usePrincipalStore } from '@/stores/principal'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { useTodoStore } from '@/stores/todo'
import { useLiveStore } from '@/stores/live'
import { usePlatform } from '@/composables/usePlatform'
import { useSettingsSync } from '@/composables/useSettingsSync'
import { isNavigating } from '@/composables/useNavigationProgress'
import { changelogAfterUpdate, checkForNewVersion } from '@/utils/changelogVersion'
import BackendStatusBanner from '@/components/layout/BackendStatusBanner.vue'
import DesktopHeader from '@/components/layout/DesktopHeader.vue'
import ProfileMenu from '@/components/layout/ProfileMenu.vue'
import TodoAlert from '@/components/layout/TodoAlert.vue'
import TodoModal from '@/components/layout/TodoModal.vue'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const principal = usePrincipalStore()
const calendar = useEventCalendarStore()
const todo = useTodoStore()
const live = useLiveStore()
const { isDesktop } = usePlatform()

useSettingsSync()

function refreshTodo() {
  if (auth.isAuthenticated && document.visibilityState === 'visible') void todo.refresh()
}

onMounted(() => {
  settings.applyTheme(settings.theme)
  window.addEventListener('focus', refreshTodo)
  document.addEventListener('visibilitychange', refreshTodo)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshTodo)
  document.removeEventListener('visibilitychange', refreshTodo)
  live.stop()
})

// Поток живых обновлений нужен только аккаунту с персоной; при смене аккаунта
// он открывается заново с билетом нового.
watch(() => (auth.isAuthenticated ? auth.personId : null), (personId) => {
  live.stop()
  if (personId) live.start()
}, { immediate: true })

// Идентичность аккаунта (sub из JWT) — меняется при смене аккаунта даже без разлогина,
// в отличие от булева isAuthenticated, который остаётся true
watch(() => auth.jwtPayload?.sub ?? null, async (sub) => {
  if (sub) {
    calendar.reset()
    todo.reset()
    await principal.fetchCollectives()
    void todo.showOnSignIn(sub)
    // /changelog требует авторизации (см. router/index.ts), поэтому проверка
    // живёт здесь, а не сразу при запуске приложения -- один раз на новую
    // версию, а не при каждом открытии (см. utils/changelogVersion.ts). Ждём
    // первую навигацию, чтобы запомнить страницу, на которой человек был.
    if (checkForNewVersion()) {
      await router.isReady()
      router.push(changelogAfterUpdate(router.currentRoute.value.fullPath))
    }
  } else {
    principal.setCollectives([])
    calendar.reset()
    todo.reset()
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

.todo-corner {
  position: fixed;
  top: calc(var(--ion-safe-area-top, 0px) + 10px);
  right: 12px;
  z-index: 20;
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
