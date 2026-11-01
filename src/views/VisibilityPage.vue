<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/settings" />
        </ion-buttons>
        <ion-title>Видимость данных</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="vis-page">
        <h1 v-if="isDesktop" class="page-title">Видимость данных</h1>

        <div v-if="loading" class="vis-state">
          <ion-spinner name="crescent" />
        </div>

        <PageState v-else-if="failed" text="Не удалось загрузить настройки">
          <ion-button fill="clear" size="small" @click="load()">Повторить</ion-button>
        </PageState>

        <template v-else>
          <div class="vis-section">
            <h3 class="vis-section-title">
              Кто видит
              <HelpTip>
                <p>Сузить видимость можно в любой момент. Расширить — не сразу после смены привязки аккаунта.</p>
                <p>Участники ваших коллективов всегда видят ваше ФИО.</p>
              </HelpTip>
            </h3>
            <div class="vis-card">
              <template v-for="(entry, i) in groups.open" :key="entry.key">
                <div v-if="i > 0" class="vis-divider" />
                <div class="vis-row">
                  <span class="vis-row-label">{{ entry.label }}</span>
                  <UiSelectPill
                    :model-value="entry.audience"
                    :options="audienceOptions(entry)"
                    :aria-label="entry.label"
                    :disabled="busy === entry.key"
                    align="end"
                    @update:model-value="choose(entry, $event as Audience)"
                  />
                </div>
              </template>
            </div>
          </div>

          <div v-if="groups.closed.length" class="vis-section">
            <h3 class="vis-section-title">Всегда закрыто</h3>
            <div class="vis-card">
              <template v-for="(entry, i) in groups.closed" :key="entry.key">
                <div v-if="i > 0" class="vis-divider" />
                <div class="vis-row">
                  <span class="vis-row-label">{{ entry.label }}</span>
                  <span class="vis-row-fixed"><ion-icon :icon="lockClosedOutline" />Только я</span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonSpinner, onIonViewWillEnter,
} from '@ionic/vue'
import { lockClosedOutline } from 'ionicons/icons'
import {
  getMyVisibilityProfileV2VisibilityMyGet,
  setMyVisibilityProfileV2VisibilityMyFieldKeyPut,
  type Audience,
  type VisibilityEntryRead,
} from '@/api/generated/almaEventFlow'
import HelpTip from '@/components/common/HelpTip.vue'
import PageState from '@/components/common/PageState.vue'
import UiSelectPill from '@/components/common/UiSelectPill.vue'
import { useToast } from '@/composables/useToast'
import { usePlatform } from '@/composables/usePlatform'
import { audienceOptions, splitEntries } from '@/utils/visibility'

const { isDesktop } = usePlatform()
const { showError } = useToast()

const entries = ref<VisibilityEntryRead[]>([])
const loading = ref(true)
const failed = ref(false)
const busy = ref<string | null>(null)

const groups = computed(() => splitEntries(entries.value))

async function load() {
  loading.value = true
  failed.value = false
  try {
    entries.value = (await getMyVisibilityProfileV2VisibilityMyGet()).data.items
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function choose(entry: VisibilityEntryRead, audience: Audience) {
  if (audience === entry.audience || busy.value) return
  busy.value = entry.key
  try {
    const { data } = await setMyVisibilityProfileV2VisibilityMyFieldKeyPut(entry.key, { audience })
    entries.value = entries.value.map((item) => (item.key === data.key ? data : item))
  } catch (err) {
    await showError(err, 'Не удалось изменить видимость')
  } finally {
    busy.value = null
  }
}

onIonViewWillEnter(load)
</script>

<style scoped>
.vis-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.vis-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.vis-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vis-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 4px;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.vis-card {
  background: var(--ion-card-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--ion-card-shadow);
  padding: 4px 16px;
}

.vis-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
}

.vis-row-label {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  color: var(--ion-text-color);
}

.vis-row-fixed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.vis-row .ui-select-pill {
  flex-shrink: 0;
  min-width: 170px;
}

.vis-row .ui-select-pill-btn {
  flex: 1;
  justify-content: space-between;
}

.vis-divider {
  height: 1px;
  background: var(--ion-border-color);
}
</style>
