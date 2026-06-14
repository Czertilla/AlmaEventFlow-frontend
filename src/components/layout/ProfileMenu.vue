<template>
  <ion-menu content-id="main-content" side="end" type="overlay" menu-id="profileMenu">
    <ion-header>
      <ion-toolbar>
        <ion-title>Профиль</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile-header">
        <div class="avatar-lg">{{ initials }}</div>
        <div class="profile-info">
          <h3>{{ auth.user?.username || 'Пользователь' }}</h3>
          <p>{{ auth.user?.email || '' }}</p>
        </div>
      </div>

      <div class="profile-menu-list">
        <router-link to="/settings" class="menu-item" @click="closeMenu">
          <ion-icon :icon="settingsOutline" />
          <span>Настройки</span>
          <ion-icon :icon="chevronForwardOutline" class="menu-arrow" />
        </router-link>

        <router-link to="/profile" class="menu-item" @click="closeMenu">
          <ion-icon :icon="personCircleOutline" />
          <span>Профиль</span>
          <ion-icon :icon="chevronForwardOutline" class="menu-arrow" />
        </router-link>

        <button class="menu-item menu-item--danger" @click="logout">
          <ion-icon :icon="logOutOutline" />
          <span>Выйти</span>
        </button>
      </div>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, menuController } from '@ionic/vue'
import { settingsOutline, personCircleOutline, logOutOutline, chevronForwardOutline } from 'ionicons/icons'

const router = useRouter()
const auth = useAuthStore()

const initials = computed(() => {
  const u = auth.user?.username || auth.user?.email || ''
  return u.slice(0, 2).toUpperCase()
})

function closeMenu() {
  menuController.close('profileMenu')
}

async function logout() {
  await auth.logout()
  closeMenu()
  router.push('/auth/login')
}
</script>

<style scoped>
.profile-header {
  padding: 32px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  border-bottom: 1px solid var(--ion-border-color);
}

.avatar-lg {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(108, 99, 255, 0.3);
}

.profile-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.profile-info p {
  margin: 2px 0 0;
  font-size: 14px;
  color: var(--ion-color-medium);
}

.profile-menu-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--ion-text-color);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  border: none;
  background: none;
  width: 100%;
  font-family: inherit;
  text-align: left;
}

.menu-item:hover {
  background: var(--ion-background-color);
}

.menu-item ion-icon:first-child {
  font-size: 20px;
  color: var(--ion-color-medium);
}

.menu-item span {
  flex: 1;
}

.menu-arrow {
  font-size: 16px;
  color: var(--ion-color-step-400);
}

.menu-item--danger {
  color: var(--ion-color-danger);
}

.menu-item--danger ion-icon:first-child {
  color: var(--ion-color-danger);
}
</style>
