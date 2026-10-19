<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>Коллектив</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="collective-page">
        <CollectiveProfilePage :key="collectiveId" :collective-id="collectiveId" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent } from '@ionic/vue'
import CollectiveProfilePage from '@/views/principal/CollectiveProfilePage.vue'
import { usePlatform } from '@/composables/usePlatform'

const route = useRoute()
const { isDesktop } = usePlatform()

const collectiveId = computed(() => String(route.params.collectiveId))
</script>

<style scoped>
.collective-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
}
</style>
