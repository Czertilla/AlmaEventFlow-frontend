<template>
  <div class="bottom-nav-container">
    <nav class="bottom-nav">
      <router-link to="/" class="nav-item" active-class="nav-item--active" exact-active-class="nav-item--active">
        <ion-icon :icon="homeOutline" />
        <span class="nav-label">Главная</span>
      </router-link>

      <div
        v-if="principal.isPrincipal"
        class="nav-item nav-item--dropdown"
        :class="{ 'nav-item--active': isPrincipalActive }"
        @click="handlePrincipalClick"
      >
        <ion-icon :icon="shieldCheckmarkOutline" />
        <span class="nav-label">
          Руководитель
          <ion-icon :icon="chevronUpOutline" class="dropdown-arrow" :class="{ rotated: showDropdown }" />
        </span>
      </div>

      <router-link
        v-if="auth.isSuperuser"
        to="/admin/users"
        class="nav-item"
        :class="{ 'nav-item--active': isAdminActive }"
      >
        <ion-icon :icon="settingsOutline" />
        <span class="nav-label">Админ</span>
      </router-link>

      <div class="nav-item" @click="toggleProfileMenu">
        <ion-icon :icon="personOutline" />
        <span class="nav-label">Профиль</span>
      </div>
    </nav>

    <Transition name="slide-up">
      <div v-if="showDropdown" class="collective-sheet">
        <div class="sheet-handle" />
        <div class="sheet-header">Выберите коллектив</div>
        <div class="sheet-list">
          <button
            v-for="c in principal.principalCollectives"
            :key="c.id"
            class="sheet-item"
            :class="{ 'sheet-item--active': c.id === principal.activePrincipalCollectiveId }"
            @click="selectCollective(c.id)"
          >
            <div class="sheet-item-dot" />
            <span>{{ c.name }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePrincipalStore } from '@/stores/principal'
import { useAuthStore } from '@/stores/auth'
import { IonIcon } from '@ionic/vue'
import { homeOutline, shieldCheckmarkOutline, personOutline, chevronUpOutline, settingsOutline } from 'ionicons/icons'

const route = useRoute()
const router = useRouter()
const principal = usePrincipalStore()
const auth = useAuthStore()

const showDropdown = ref(false)

// Подсветка активна на всём поддереве раздела, а не только на стартовом пути.
const isAdminActive = computed(() => route.path.startsWith('/admin'))
const isPrincipalActive = computed(() => route.path.startsWith('/principal'))

function handlePrincipalClick() {
  showDropdown.value = !showDropdown.value
  if (!showDropdown.value && principal.activePrincipalCollectiveId) {
    router.push('/principal/members')
  }
}

function selectCollective(id: string) {
  principal.setActivePrincipalCollective(id)
  showDropdown.value = false
  router.push('/principal/members')
}

function toggleProfileMenu() {
  const menu = document.querySelector('ion-menu[menu-id="profileMenu"]') as any
  if (menu) menu.open()
}
</script>

<style scoped>
.bottom-nav-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.bottom-nav {
  display: flex;
  background: var(--ion-tab-bar-background);
  border-top: 1px solid var(--ion-border-color);
  padding: 6px 0;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0));
  justify-content: space-around;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 16px;
  text-decoration: none;
  color: var(--ion-color-medium);
  transition: color 0.2s;
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
}

.nav-item--active {
  color: var(--ion-color-primary);
}

.nav-item ion-icon {
  font-size: 22px;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 2px;
}

.dropdown-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.collective-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--ion-card-background);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
  padding: 12px 0 calc(12px + env(safe-area-inset-bottom, 0));
  z-index: 101;
}

.ion-palette-dark .collective-sheet {
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--ion-color-step-300);
  margin: 0 auto 12px;
}

.sheet-header {
  padding: 8px 20px 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  border: none;
  background: none;
  border-radius: 12px;
  font-size: 15px;
  color: var(--ion-text-color);
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
  width: 100%;
  text-align: left;
}

.sheet-item:hover {
  background: var(--ion-background-color);
}

.sheet-item--active {
  background: rgba(108, 99, 255, 0.08);
  color: var(--ion-color-primary);
  font-weight: 600;
}

.sheet-item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-step-400);
  flex-shrink: 0;
}

.sheet-item--active .sheet-item-dot {
  background: var(--ion-color-primary);
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
