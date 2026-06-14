<template>
  <ion-app>
    <div class="app-shell" :class="{ 'has-bottom-nav': !isDesktop && auth.isAuthenticated }">
      <!-- Desktop Header (normal flow — never overlaps content) -->
      <DesktopHeader v-if="isDesktop && auth.isAuthenticated" />
      <div class="app-outlet">
        <ion-router-outlet id="main-content" />
      </div>
    </div>
    <!-- Profile Menu (all platforms) -->
    <ProfileMenu v-if="auth.isAuthenticated" />
    <!-- Mobile Bottom Nav -->
    <BottomNav v-if="!isDesktop && auth.isAuthenticated" />
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
import DesktopHeader from '@/components/layout/DesktopHeader.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
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

/* Нижняя навигация фиксирована — контенту страниц нужен отступ снизу */
.has-bottom-nav :deep(ion-content) {
  --padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}
</style>
