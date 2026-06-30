<template>
  <header class="desktop-header">
      <div class="header-content">
        <div class="header-left">
          <router-link to="/" class="header-brand">
            <div class="header-logo">
              <img src="/aef.svg" class="logo-img" alt="Alma Event Flow" />
            </div>
            <span class="header-title">Alma Event Flow <span class="beta-badge">β</span></span>
          </router-link>
          <nav class="header-nav">
            <router-link to="/" class="nav-link" active-class="nav-link--active" exact-active-class="nav-link--active">
              <ion-icon :icon="homeOutline" />
              Главная
            </router-link>
            <div
              v-if="principal.isPrincipal"
              class="nav-dropdown"
              @mouseenter="showPrincipalDropdown = true"
              @mouseleave="showPrincipalDropdown = false"
            >
              <button
                class="nav-link nav-dropdown-trigger"
                :class="{ 'nav-link--active': isPrincipalActive }"
                @click="goToPrincipal"
              >
                <ion-icon :icon="shieldCheckmarkOutline" />
                Руководитель
                <ion-icon :icon="chevronDownOutline" :class="{ rotated: showPrincipalDropdown }" />
              </button>
              <Transition name="dropdown">
                <div v-if="showPrincipalDropdown" class="dropdown-menu">
                  <router-link
                    v-for="c in principal.principalCollectives"
                    :key="c.id"
                    :to="'/principal/members'"
                    class="dropdown-item"
                    :class="{ 'dropdown-item--active': c.id === principal.activePrincipalCollectiveId }"
                    @click="selectCollective(c.id)"
                  >
                    {{ c.name }}
                  </router-link>
                </div>
              </Transition>
            </div>
            <router-link
              v-if="auth.isSuperuser"
              to="/admin/users"
              class="nav-link"
              :class="{ 'nav-link--active': isAdminActive }"
            >
              <ion-icon :icon="settingsOutline" />
              Администрирование
            </router-link>
          </nav>
        </div>
        <div class="header-right">
          <button v-if="auth.isAuthenticated" class="header-profile" id="profile-trigger" @click="toggleProfileMenu">
            <div class="avatar-sm">{{ initials }}</div>
          </button>
          <router-link v-else to="/auth/login" class="nav-link nav-link--login">Войти</router-link>
        </div>
      </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePrincipalStore } from '@/stores/principal'
import { useSectionNav } from '@/composables/useSectionNav'
import { getInitials } from '@/utils/names'
import { IonIcon, menuController } from '@ionic/vue'
import { homeOutline, shieldCheckmarkOutline, settingsOutline, chevronDownOutline } from 'ionicons/icons'

const auth = useAuthStore()
const principal = usePrincipalStore()

// Подсветка разделов и переходы — общие с оболочкой вкладок (useSectionNav).
const { isAdminActive, isPrincipalActive, goToPrincipal: navPrincipal, selectCollective: navSelectCollective } = useSectionNav()

const showPrincipalDropdown = ref(false)

const initials = computed(() => getInitials(auth.user))

// Клик по «Руководитель» открывает последний выбранный коллектив (он восстановлен из хранилища по jwt sub)
function goToPrincipal() {
  showPrincipalDropdown.value = false
  navPrincipal()
}

function selectCollective(id: string) {
  showPrincipalDropdown.value = false
  navSelectCollective(id)
}

function toggleProfileMenu() {
  menuController.open('profileMenu')
}
</script>

<style scoped>
.desktop-header {
  flex-shrink: 0;
  background: var(--ion-card-background);
  box-shadow: 0 1px 0 var(--ion-border-color);
  position: relative;
  z-index: 200;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 0 24px;
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--ion-text-color);
}

.header-logo {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-logo .logo-img {
  width: 22px;
  height: 22px;
  filter: brightness(0) invert(1);
}

.header-title {
  font-size: 16px;
  font-weight: 700;
}

.beta-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: var(--ion-color-primary);
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 4px;
  vertical-align: super;
  line-height: 1.2;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-medium);
  text-decoration: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
}

.nav-link:hover {
  color: var(--ion-text-color);
  background: var(--ion-background-color);
}

.nav-link--active {
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.nav-link--login {
  padding: 8px 20px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  border-radius: 10px;
  font-weight: 600;
}

.nav-link--login:hover {
  box-shadow: 0 4px 12px rgba(var(--ion-color-primary-rgb), 0.3);
  color: white;
}

.nav-dropdown {
  position: relative;
}

.nav-dropdown-trigger ion-icon {
  font-size: 14px;
  transition: transform 0.2s;
}

.nav-dropdown-trigger ion-icon.rotated {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  padding: 4px;
  z-index: 100;
  margin-top: 4px;
}

.ion-palette-dark .dropdown-menu {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.dropdown-item {
  display: block;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--ion-text-color);
  text-decoration: none;
  transition: background 0.15s;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--ion-background-color);
}

.dropdown-item--active {
  color: var(--ion-color-primary);
  font-weight: 600;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.header-right {
  display: flex;
  align-items: center;
}

.header-profile {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-profile:hover {
  transform: scale(1.05);
}

/* Dropdown transition */
.dropdown-enter-active, .dropdown-leave-active {
  transition: all 0.2s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.avatar-sm {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
