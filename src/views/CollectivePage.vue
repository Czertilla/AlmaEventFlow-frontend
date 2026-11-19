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
        <div v-if="loading && !card" class="collective-state"><ion-spinner name="crescent" /></div>
        <PageState v-else-if="missing" text="Коллектив не найден" />
        <PageState v-else-if="!card" text="Не удалось загрузить коллектив">
          <ion-button fill="clear" size="small" @click="load()">Повторить</ion-button>
        </PageState>
        <CollectiveProfilePage v-else-if="insider" :key="collectiveId" :collective-id="collectiveId" />
        <CollectiveJoinCard v-else :card="card" @changed="load()" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isAxiosError } from 'axios'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, IonSpinner,
} from '@ionic/vue'
import { getCollectiveCardEventV3CollectivesCollectiveIdGet, type CollectiveCard } from '@/api/generated/almaEventFlow'
import CollectiveProfilePage from '@/views/principal/CollectiveProfilePage.vue'
import CollectiveJoinCard from '@/components/collective/CollectiveJoinCard.vue'
import PageState from '@/components/common/PageState.vue'
import { usePlatform } from '@/composables/usePlatform'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { isDesktop } = usePlatform()

const collectiveId = computed(() => String(route.params.collectiveId))
const card = ref<CollectiveCard | null>(null)
const loading = ref(false)
const missing = ref(false)

/** Руководитель, участник и суперпользователь видят профиль коллектива, прочие — вступление. */
const insider = computed(
  () => auth.isSuperuser || card.value?.relation === 'principal' || card.value?.relation === 'member',
)

async function load() {
  loading.value = true
  missing.value = false
  try {
    const linked = auth.user?.person_id
    if (!auth.jwtPayload?.per && linked) await auth.refreshWhenLinked(linked)
    card.value = (await getCollectiveCardEventV3CollectivesCollectiveIdGet(collectiveId.value)).data
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) missing.value = true
  } finally {
    loading.value = false
  }
}

watch(() => route.params.collectiveId, (id) => {
  if (!id) return
  card.value = null
  void load()
}, { immediate: true })
</script>

<style scoped>
.collective-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
}

.collective-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
</style>
