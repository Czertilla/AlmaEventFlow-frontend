<template>
  <div class="ar-page">
    <section class="ui-card ar-policy">
      <div class="ui-card-head">
        <h3 class="ui-card-title">
          Политика доступа
          <HelpTip text="Участники соглашаются на политику коллектива сами. Пока согласие действует, вы открываете перечисленные поля в «Подробной информации» участника и в выгрузке." />
        </h3>
        <span v-if="policy" class="ar-term">Версия {{ policy.version }} · {{ formatDate(policy.created_at) }}</span>
      </div>
      <ion-spinner v-if="policyLoading" name="crescent" />
      <template v-else-if="policy">
        <div class="ui-chips">
          <span v-for="field in policy.fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
        </div>
        <p class="ar-comment">{{ policy.purpose }}</p>
      </template>
      <p v-else class="ar-counts">Политики ещё нет</p>
      <div class="ar-actions">
        <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="policyLoading" @click="editingPolicy = true">
          {{ policy ? 'Изменить' : 'Составить' }}
        </button>
        <button v-if="policy" type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="exportingPolicy = true">
          Выгрузить
        </button>
      </div>
    </section>

    <h3 class="ui-field-title ar-section">Разовые запросы</h3>

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

    <ion-modal :is-open="editingPolicy" @ion-modal-did-dismiss="editingPolicy = false">
      <PolicyForm
        v-if="editingPolicy && collectiveId"
        :collective-id="collectiveId"
        :current="policy"
        @close="editingPolicy = false"
        @published="onPublished"
      />
    </ion-modal>

    <ion-modal :is-open="exportingPolicy" @ion-modal-did-dismiss="exportingPolicy = false">
      <PolicyExport
        v-if="exportingPolicy && collectiveId && policy"
        :collective-id="collectiveId"
        :policy="policy"
        @close="exportingPolicy = false"
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
  getCollectivePoliciesProfileV3CollectivesCollectiveIdPoliciesGet,
  getMyAccessRequestsProfileV2AccessRequestsGet,
  type AccessRequestRead,
  type CollectivePolicyRead,
} from '@/api/generated/almaEventFlow'
import AccessRequestDetail from '@/components/access/AccessRequestDetail.vue'
import AccessRequestForm from '@/components/access/AccessRequestForm.vue'
import PolicyExport from '@/components/access/PolicyExport.vue'
import PolicyForm from '@/components/access/PolicyForm.vue'
import HelpTip from '@/components/common/HelpTip.vue'
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
const policy = ref<CollectivePolicyRead | null>(null)
const policyLoading = ref(false)
const editingPolicy = ref(false)
const exportingPolicy = ref(false)

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

async function loadPolicy() {
  policy.value = null
  if (!collectiveId.value) return
  policyLoading.value = true
  try {
    const { data } = await getCollectivePoliciesProfileV3CollectivesCollectiveIdPoliciesGet(collectiveId.value)
    policy.value = data[0] ?? null
  } catch {
    policy.value = null
  } finally {
    policyLoading.value = false
  }
}

async function onPublished(published: CollectivePolicyRead) {
  editingPolicy.value = false
  policy.value = published
  await showSuccess(`Опубликована версия ${published.version}`)
}

watch(collectiveId, load, { immediate: true })
watch(collectiveId, loadPolicy, { immediate: true })

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

.ar-policy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ar-policy .ui-card-head {
  margin-bottom: 0;
}

.ar-actions {
  display: flex;
  gap: 8px;
}

.ar-section {
  margin: 8px 0 0;
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
