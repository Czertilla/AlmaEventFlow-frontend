<template>
  <div class="ar-page">
    <div v-if="loading" class="ar-state">
      <ion-spinner name="crescent" />
    </div>

    <PageState v-else-if="failed" text="Не удалось загрузить запросы">
      <ion-button fill="clear" size="small" @click="load()">Повторить</ion-button>
    </PageState>

    <p v-else-if="!requests.length" class="ar-empty">Запросов нет</p>

    <template v-else>
      <button
        v-for="request in requests"
        :key="request.id"
        type="button"
        class="ui-card ar-card"
        @click="opened = request"
      >
        <div class="ui-card-head">
          <h3 class="ui-card-title">{{ formatDate(request.created_at) }}</h3>
          <span class="ar-term">{{ request.is_expired ? 'Срок истёк' : `до ${formatDateTime(request.expires_at)}` }}</span>
        </div>
        <div class="ui-chips">
          <span v-for="field in request.fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
        </div>
        <p class="ar-comment">{{ request.comment }}</p>
        <p class="ar-counts">{{ summary(request) }}</p>
      </button>
    </template>

    <ion-modal :is-open="creating" @ion-modal-did-dismiss="creating = false">
      <AccessRequestForm
        v-if="creating && collectiveId"
        :collective-id="collectiveId"
        @close="creating = false"
        @created="onCreated"
      />
    </ion-modal>

    <ion-modal :is-open="!!opened" @ion-modal-did-dismiss="opened = null">
      <AccessRequestDetail v-if="opened" :request="opened" @close="opened = null" />
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonButton, IonModal, IonSpinner } from '@ionic/vue'
import {
  getMyAccessRequestsProfileV2AccessRequestsGet,
  type AccessRequestRead,
} from '@/api/generated/almaEventFlow'
import AccessRequestDetail from '@/components/access/AccessRequestDetail.vue'
import AccessRequestForm from '@/components/access/AccessRequestForm.vue'
import PageState from '@/components/common/PageState.vue'
import { useLayoutAddButton } from '@/composables/usePrincipalPageActions'
import { useToast } from '@/composables/useToast'
import { usePrincipalStore } from '@/stores/principal'
import { formatDate, formatDateTime } from '@/utils/date'
import { grantCounts } from '@/utils/dataAccess'

const principal = usePrincipalStore()
const { showSuccess } = useToast()

const requests = ref<AccessRequestRead[]>([])
const loading = ref(true)
const failed = ref(false)
const creating = ref(false)
const opened = ref<AccessRequestRead | null>(null)

const collectiveId = computed(() => principal.activePrincipalCollectiveId)

function summary(request: AccessRequestRead): string {
  const counts = grantCounts(request.grants)
  return `Разрешили ${counts.active} · Ждут ${counts.pending} · Отказали ${counts.declined + counts.revoked}`
}

async function load() {
  if (!collectiveId.value) {
    requests.value = []
    loading.value = false
    return
  }
  loading.value = true
  failed.value = false
  try {
    const { data } = await getMyAccessRequestsProfileV2AccessRequestsGet({
      collective_id: collectiveId.value,
      limit: 100,
    })
    requests.value = data.items
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function onCreated(request: AccessRequestRead) {
  creating.value = false
  requests.value = [request, ...requests.value]
  await showSuccess(`Запрос отправлен: ${request.grants.length}`)
}

watch(collectiveId, load, { immediate: true })

useLayoutAddButton('Новый запрос', () => {
  creating.value = true
})
</script>

<style scoped>
.ar-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 88px;
}

.ar-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.ar-empty {
  margin: 0;
  padding: 40px 0;
  text-align: center;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.ar-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  border: none;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.ar-card .ui-card-head {
  margin-bottom: 0;
}

.ar-term {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.ar-comment {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.ar-counts {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
}
</style>
