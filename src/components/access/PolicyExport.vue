<template>
  <div class="ui-sheet-head">
    <h3 class="ui-sheet-title">Выгрузка по политике</h3>
    <button class="ui-icon-btn" aria-label="Закрыть" @click="emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="pe-body">
      <div class="ui-chips">
        <span v-for="field in policy.fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
      </div>
      <template v-if="exported">
        <p class="pe-meta">Выгружено: {{ complete }} из {{ exported.subjects.length }}</p>
        <div v-if="gaps.length" class="ui-card pe-gaps">
          <template v-for="(subject, i) in gaps" :key="subject.person_id">
            <div v-if="i > 0" class="pe-divider" />
            <div class="pe-person">
              <span class="pe-name">{{ names.get(subject.person_id) || 'Участник' }}</span>
              <span class="pe-reason">{{ CONSENT_STATE_LABELS[subject.reason!] }}</span>
            </div>
            <p class="pe-fields">{{ labels(subject.missing_fields) }}</p>
          </template>
        </div>
      </template>
    </div>
  </ion-content>
  <div class="ui-sheet-actions">
    <button class="ui-btn ui-btn--primary" :disabled="exporting" @click="run">
      <ion-spinner v-if="exporting" name="crescent" />
      Выгрузить CSV
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonContent, IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import {
  exportCollectivePolicyProfileV3CollectivesCollectiveIdPolicyExportPost,
  type CollectivePolicyRead,
  type PolicyExportRead,
} from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/date'
import { CONSENT_STATE_LABELS, downloadText, policyExportTable, toCsv } from '@/utils/dataAccess'
import { resolvePersonName } from '@/utils/names'

const props = defineProps<{ collectiveId: string; policy: CollectivePolicyRead }>()
const emit = defineEmits<{ close: [] }>()

const { showError } = useToast()

const exported = ref<PolicyExportRead | null>(null)
const names = ref(new Map<string, string | null>())
const exporting = ref(false)

const gaps = computed(() => exported.value?.subjects.filter((subject) => subject.reason) ?? [])
const complete = computed(() => (exported.value?.subjects.length ?? 0) - gaps.value.length)

function labels(keys: string[]): string {
  const byKey = new Map(props.policy.fields.map((field) => [field.key, field.label]))
  return keys.map((key) => byKey.get(key) ?? key).join(', ')
}

async function run() {
  if (exporting.value) return
  exporting.value = true
  try {
    const { data } = await exportCollectivePolicyProfileV3CollectivesCollectiveIdPolicyExportPost(props.collectiveId)
    const resolved = await Promise.all(
      data.subjects.map(async (subject) => [subject.person_id, await resolvePersonName(subject.person_id)] as const),
    )
    names.value = new Map(resolved)
    exported.value = data
    downloadText(`данные-v${data.version}-${formatDate(data.exported_at, 'YYYY-MM-DD')}.csv`, toCsv(policyExportTable(data, names.value)))
  } catch (err) {
    await showError(err, 'Не удалось выгрузить данные')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.pe-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pe-meta,
.pe-fields {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.pe-gaps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pe-divider {
  height: 1px;
  background: var(--ion-border-color);
}

.pe-person {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.pe-name {
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.pe-reason {
  font-size: var(--fs-sm);
  color: rgb(var(--att-unmarked-rgb));
}
</style>
