<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="backHref" />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ob-page">
        <h1 v-if="isDesktop" class="page-title">{{ title }}</h1>
        <div v-if="onboarding" class="ob-head">
          <router-link :to="`/collective/${onboarding.collective_id}`" class="ob-link">
            {{ onboarding.collective_name }}
          </router-link>
          <span v-if="onboarding.my_side !== 'candidate'" class="ob-person">{{ formatPersonName(onboarding.person) }}</span>
        </div>
        <OnboardingChat :key="onboardingId" :onboarding-id="onboardingId" @changed="onboarding = $event.onboarding" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent } from '@ionic/vue'
import type { OnboardingRead } from '@/api/generated/almaEventFlow'
import OnboardingChat from '@/components/collective/OnboardingChat.vue'
import { usePlatform } from '@/composables/usePlatform'
import { formatPersonName } from '@/utils/names'

const route = useRoute()
const { isDesktop } = usePlatform()

const onboardingId = computed(() => String(route.params.onboardingId))
const onboarding = ref<OnboardingRead | null>(null)

const title = computed(() => {
  const value = onboarding.value
  if (!value) return 'Вступление'
  return value.opened_by === 'candidate' ? 'Запрос на вступление' : 'Приглашение в коллектив'
})
const backHref = computed(() =>
  onboarding.value?.my_side === 'leader' ? '/principal/members' : '/profile',
)
</script>

<style scoped>
.ob-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.ob-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ob-link {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
  text-decoration: none;
}

.ob-person {
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}
</style>
