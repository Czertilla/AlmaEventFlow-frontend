<template>
  <ion-modal :is-open="isOpen" @ion-modal-did-dismiss="emit('close')">
    <div class="ui-sheet-head">
      <h3 class="ui-sheet-title">Подробная информация</h3>
      <button type="button" class="ui-icon-btn" aria-label="Закрыть" @click="emit('close')">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>
    <ion-content class="ion-padding">
      <div v-if="loading" class="md-state"><ion-spinner name="crescent" /></div>
      <p v-else-if="failed" class="md-empty">{{ failed }}</p>
      <div v-else-if="data" class="md-body">
        <div class="md-head">
          <span class="md-name">{{ memberName }}</span>
          <span class="md-state-chip" :class="`md-state-chip--${data.state}`">
            {{ CONSENT_STATE_LABELS[data.state] }}
            <HelpTip text="Поле открывается, если участник согласился на любую версию политики, в которой оно есть. Каждое открытие записывается в журнал, участник получает уведомление." />
          </span>
        </div>
        <p v-if="!data.fields.length" class="md-empty">У коллектива нет политики доступа к данным</p>
        <div v-for="field in data.fields" :key="field.key" class="ui-card md-field">
          <div class="md-field-head">
            <span class="md-label">
              <ion-icon :icon="revealed[field.key] ? lockOpenOutline : lockClosedOutline" />
              {{ field.label }}
            </span>
            <button
              v-if="field.available && !revealed[field.key]"
              type="button"
              class="ui-btn ui-btn--ghost ui-btn--sm"
              :disabled="busy === field.key"
              @click="reveal(field.key)"
            >
              <ion-spinner v-if="busy === field.key" name="crescent" />
              Показать
            </button>
            <span v-else-if="!field.available" class="md-locked">Нет согласия</span>
          </div>
          <template v-if="revealed[field.key]">
            <p v-if="!revealed[field.key]!.length" class="md-value md-value--empty">Не заполнено</p>
            <p v-for="(value, i) in revealed[field.key]" :key="i" class="md-value">{{ value }}</p>
          </template>
          <p v-if="errors[field.key]" class="md-error">{{ errors[field.key] }}</p>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/vue'
import { closeOutline, lockClosedOutline, lockOpenOutline } from 'ionicons/icons'
import {
  getMemberDataProfileV3CollectivesCollectiveIdMembersPersonIdDataGet,
  revealMemberFieldProfileV3CollectivesCollectiveIdMembersPersonIdDataFieldKeyPost,
  type MemberDataRead,
} from '@/api/generated/almaEventFlow'
import HelpTip from '@/components/common/HelpTip.vue'
import { CONSENT_STATE_LABELS, formatExportValue } from '@/utils/dataAccess'

const props = defineProps<{ isOpen: boolean; collectiveId: string; personId: string; memberName: string }>()
const emit = defineEmits<{ close: [] }>()

const ERRORS: Record<string, string> = {
  CONSENT_MISSING: 'Согласия на это поле уже нет',
  TOO_MANY_REQUESTS: 'Слишком много просмотров, попробуйте позже',
  PERSONAL_DATA_UNAVAILABLE: 'Данные сейчас недоступны',
  EVENT_SERVICE_UNAVAILABLE: 'Сервис коллективов не отвечает',
}

const data = ref<MemberDataRead | null>(null)
const loading = ref(false)
const failed = ref('')
const busy = ref<string | null>(null)
const revealed = reactive<Record<string, string[] | undefined>>({})
const errors = reactive<Record<string, string>>({})

function detailOf(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

async function load() {
  loading.value = true
  failed.value = ''
  data.value = null
  for (const key of Object.keys(revealed)) delete revealed[key]
  try {
    data.value = (await getMemberDataProfileV3CollectivesCollectiveIdMembersPersonIdDataGet(props.collectiveId, props.personId)).data
  } catch (err) {
    failed.value = ERRORS[detailOf(err) ?? ''] ?? 'Не удалось загрузить'
  } finally {
    loading.value = false
  }
}

async function reveal(key: string) {
  busy.value = key
  delete errors[key]
  try {
    const { data: field } = await revealMemberFieldProfileV3CollectivesCollectiveIdMembersPersonIdDataFieldKeyPost(
      props.collectiveId, props.personId, key,
    )
    revealed[key] = field.values.map((value) => formatExportValue(value)).filter(Boolean)
  } catch (err) {
    errors[key] = ERRORS[detailOf(err) ?? ''] ?? 'Не удалось открыть поле'
  } finally {
    busy.value = null
  }
}

watch(() => props.isOpen, (open) => { if (open) void load() }, { immediate: true })
</script>

<style scoped>
.md-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.md-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.md-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.md-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
}

.md-state-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.md-state-chip--current {
  color: var(--ion-color-success);
}

.md-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.md-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.md-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.md-locked,
.md-empty,
.md-value--empty {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.md-value {
  margin: 0;
  font-size: var(--fs-md);
  overflow-wrap: anywhere;
}

.md-error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-danger);
}
</style>
