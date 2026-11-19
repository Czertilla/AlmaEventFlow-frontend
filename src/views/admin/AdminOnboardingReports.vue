<template>
  <div class="or-page">
    <div v-if="loading && !items.length" class="or-state"><ion-spinner name="crescent" /></div>
    <PageState v-else-if="failed" text="Не удалось загрузить жалобы">
      <ion-button fill="clear" size="small" @click="load(0)">Повторить</ion-button>
    </PageState>
    <p v-else-if="!items.length" class="or-empty">Жалоб нет</p>
    <ul v-else class="or-list">
      <li v-for="report in items" :key="report.id" class="ui-card or-row">
        <div class="or-head">
          <span class="or-title">{{ report.collective_name || 'Коллектив удалён' }}</span>
          <span class="or-meta">
            {{ report.reporter_side === 'leader' ? 'От руководителя' : 'От кандидата' }} ·
            {{ formatDate(new Date(report.created_at), settings.dateFormat) }}
          </span>
        </div>
        <p class="or-reason">{{ report.reason }}</p>
        <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm or-open" @click="router.push(onboardingPath(report.onboarding_id))">
          Переписка
        </button>
      </li>
    </ul>
    <button v-if="items.length < total" type="button" class="ui-btn ui-btn--ghost" :disabled="loading" @click="load(page + 1)">
      Показать ещё
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonButton, IonSpinner } from '@ionic/vue'
import { getOnboardingReportsEventV3OnboardingReportsGet, type OnboardingReportRead } from '@/api/generated/almaEventFlow'
import PageState from '@/components/common/PageState.vue'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import { onboardingPath } from '@/utils/onboarding'

const router = useRouter()
const settings = useSettingsStore()

const items = ref<OnboardingReportRead[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const failed = ref(false)

async function load(next: number) {
  loading.value = true
  failed.value = false
  try {
    const { data } = await getOnboardingReportsEventV3OnboardingReportsGet({ page: next, limit: 20 })
    items.value = next === 0 ? data.items : [...items.value, ...data.items]
    total.value = data.pagination.total
    page.value = next
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => load(0))
</script>

<style scoped>
.or-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 32px;
}

.or-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.or-empty {
  margin: 24px 0;
  text-align: center;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.or-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.or-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.or-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.or-title {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.or-meta {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.or-reason {
  margin: 0;
  font-size: var(--fs-md);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.or-open {
  align-self: flex-start;
}
</style>
