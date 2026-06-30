<template>
  <ion-menu content-id="main-content" side="end" type="overlay" menu-id="profileMenu">
    <ion-header>
      <ion-toolbar>
        <ion-title>Профиль</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile-header">
        <div class="avatar-shadow"><UserAvatar :user="auth.user" :size="64" /></div>
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
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, menuController } from '@ionic/vue'
import { settingsOutline, personCircleOutline, logOutOutline, chevronForwardOutline } from 'ionicons/icons'
import UserAvatar from '@/components/common/UserAvatar.vue'

const router = useRouter()
const auth = useAuthStore()

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

.avatar-shadow {
  border-radius: 50%;
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
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
