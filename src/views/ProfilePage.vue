<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>Профиль</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile-page">
        <h1 v-if="isDesktop" class="page-title">Профиль</h1>

        <div class="profile-card">
          <div class="profile-avatar">{{ initials }}</div>
          <div class="profile-id">
            <span class="profile-name">{{ auth.user?.username || 'Пользователь' }}</span>
            <span class="profile-email">{{ auth.user?.email }}</span>
          </div>
          <UuidBadge v-if="auth.user?.id" :id="auth.user.id" />
        </div>

        <div class="profile-actions">
          <router-link to="/settings" class="profile-action">
            <ion-icon :icon="settingsOutline" />
            <span>Настройки</span>
            <ion-icon :icon="chevronForwardOutline" class="action-arrow" />
          </router-link>
          <button class="profile-action profile-action--danger" @click="handleLogout">
            <ion-icon :icon="logOutOutline" />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlatform } from '@/composables/usePlatform'
import UuidBadge from '@/components/common/UuidBadge.vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
} from '@ionic/vue'
import { settingsOutline, logOutOutline, chevronForwardOutline } from 'ionicons/icons'

const router = useRouter()
const auth = useAuthStore()
const { isDesktop } = usePlatform()

const initials = computed(() => {
  const u = auth.user?.username || auth.user?.email || ''
  return u.slice(0, 2).toUpperCase()
})

async function handleLogout() {
  await auth.logout()
  router.push('/auth/login')
}
</script>

<style scoped>
.profile-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-email {
  font-size: 13px;
  color: var(--ion-color-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  padding: 8px;
}

.profile-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 12px;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
}

.profile-action:hover {
  background: var(--ion-background-color);
}

.profile-action ion-icon:first-child {
  font-size: 20px;
  color: var(--ion-color-medium);
}

.profile-action span {
  flex: 1;
}

.action-arrow {
  font-size: 16px;
  color: var(--ion-color-step-400);
}

.profile-action--danger,
.profile-action--danger ion-icon:first-child {
  color: var(--ion-color-danger);
}
</style>
