<template>
  <div class="ui-sheet-head">
    <h3 class="ui-sheet-title">Запрос от {{ formatDate(request.created_at) }}</h3>
    <button class="ui-icon-btn" aria-label="Закрыть" @click="emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="ard-body">
      <p class="ard-term">{{ request.is_expired ? 'Срок истёк' : `До ${formatDateTime(request.expires_at)}` }}</p>
      <div class="ui-chips">
        <span v-for="field in request.fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
      </div>
      <p class="ard-comment">{{ request.comment }}</p>

      <div class="ui-card ard-people">
        <p v-if="!request.grants.length" class="ard-empty">В коллективе не было участников</p>
        <template v-for="(grant, i) in request.grants" :key="grant.person_id">
          <div v-if="i > 0" class="ard-divider" />
          <div class="ard-person">
            <span class="ard-name">{{ names.get(grant.person_id) || 'Участник' }}</span>
            <span class="ard-status" :class="`ard-status--${skippedOf(grant.person_id) ?? grant.status}`">
              {{ statusLabel(grant.person_id, grant.status) }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </ion-content>
  <div class="ui-sheet-actions">
    <button class="ui-btn ui-btn--primary" :disabled="exporting || !exportable" @click="exportCsv">
      <ion-spinner v-if="exporting" name="crescent" />
      Выгрузить CSV
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IonContent, IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import {
  exportAccessRequestProfileV2AccessRequestsRequestIdExportPost,
  type AccessRequestRead,
  type GrantState,
  type SkipReason,
} from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import { formatDate, formatDateTime } from '@/utils/date'
import { GRANT_STATE_LABELS, SKIP_LABELS, downloadText, exportTable, grantCounts, toCsv } from '@/utils/dataAccess'
import { resolvePersonName } from '@/utils/names'

const props = defineProps<{ request: AccessRequestRead }>()
const emit = defineEmits<{ close: [] }>()

const { showError, showSuccess } = useToast()

const names = ref(new Map<string, string | null>())
const skipped = ref(new Map<string, SkipReason>())
const exporting = ref(false)

const exportable = computed(() => !props.request.is_expired && grantCounts(props.request.grants).active > 0)

function skippedOf(personId: string): SkipReason | undefined {
  const reason = skipped.value.get(personId)
  return reason === 'not_member' ? reason : undefined
}

function statusLabel(personId: string, status: GrantState): string {
  const reason = skippedOf(personId)
  return reason ? SKIP_LABELS[reason] : GRANT_STATE_LABELS[status]
}

async function exportCsv() {
  if (exporting.value) return
  exporting.value = true
  try {
    const { data } = await exportAccessRequestProfileV2AccessRequestsRequestIdExportPost(props.request.id, null)
    skipped.value = new Map(data.skipped.map((item) => [item.person_id, item.status]))
    const csv = toCsv(exportTable(data, names.value))
    downloadText(`данные-${formatDate(data.exported_at, 'YYYY-MM-DD')}.csv`, csv)
    await showSuccess(`Выгружено: ${data.subjects.length}`)
  } catch (err) {
    await showError(err, 'Не удалось выгрузить данные')
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  const resolved = await Promise.all(
    props.request.grants.map(async (grant) => [grant.person_id, await resolvePersonName(grant.person_id)] as const),
  )
  names.value = new Map(resolved)
})
</script>

<style scoped>
.ard-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ard-term {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.ard-comment {
  margin: 0;
  padding: 8px 12px;
  border-left: var(--border-w) solid var(--ion-color-primary);
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  font-size: var(--fs-md);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ard-people {
  padding: 4px 16px;
}

.ard-empty {
  margin: 0;
  padding: 12px 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.ard-divider {
  height: 1px;
  background: var(--ion-border-color);
}

.ard-person {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.ard-name {
  min-width: 0;
  font-size: var(--fs-lg);
  color: var(--ion-text-color);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ard-status {
  flex-shrink: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
}

.ard-status--active {
  color: var(--ion-color-success);
}

.ard-status--pending {
  color: var(--ion-color-warning-shade);
}

.ard-status--not_member {
  color: var(--ion-color-danger);
}
</style>
