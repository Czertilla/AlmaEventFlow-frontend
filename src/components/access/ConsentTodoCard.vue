<template>
  <div class="ui-card ct-card">
    <div class="ui-card-head">
      <h3 class="ui-card-title">{{ item.collective_name }}</h3>
      <span class="ct-version">Версия {{ consent.version }}</span>
    </div>
    <p class="ct-reason">{{ reason }}</p>
    <div class="ui-chips">
      <span v-for="field in consent.fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
    </div>
    <button type="button" class="ct-toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      {{ expanded ? 'Скрыть текст' : 'Текст политики' }}
    </button>
    <p v-if="expanded" class="ct-text">{{ consent.text }}</p>
    <p v-if="error" class="ct-error">{{ error }}</p>
    <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="busy" @click="agree">
      <ion-spinner v-if="busy" name="crescent" />
      Согласен
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonSpinner } from '@ionic/vue'
import {
  giveConsentProfileV3CollectivesCollectiveIdConsentPost,
  type ConsentTodo,
  type TodoItem,
} from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import { sha256Hex } from '@/utils/dataAccess'

const props = defineProps<{ item: TodoItem }>()
const emit = defineEmits<{ done: [id: string] }>()

const { showSuccess } = useToast()

const expanded = ref(false)
const busy = ref(false)
const error = ref('')

const consent = computed(() => props.item.consent as ConsentTodo)
const reason = computed(() =>
  consent.value.state === 'consent_outdated'
    ? 'Руководитель обновил политику доступа к данным'
    : 'Руководитель коллектива просит согласие на доступ к данным',
)

const ERRORS: Record<string, string> = {
  POLICY_OUTDATED: 'Политика уже обновилась, откройте список заново',
  POLICY_TEXT_MISMATCH: 'Текст политики изменился, откройте список заново',
  CONSENT_COOLDOWN: 'Согласие можно дать позже: недавно сменилась привязка аккаунта',
  NOT_COLLECTIVE_MEMBER: 'Вы уже не в этом коллективе',
}

async function agree() {
  if (busy.value || !props.item.collective_id) return
  busy.value = true
  error.value = ''
  try {
    await giveConsentProfileV3CollectivesCollectiveIdConsentPost(props.item.collective_id, {
      policy_id: consent.value.policy_id,
      text_hash: await sha256Hex(consent.value.text),
    })
    await showSuccess('Согласие сохранено')
    emit('done', props.item.id)
  } catch (err) {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    error.value = (detail && ERRORS[detail]) || 'Не удалось сохранить согласие'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.ct-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.ct-card .ui-card-head {
  width: 100%;
  margin-bottom: 0;
}

.ct-version,
.ct-reason {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.ct-toggle {
  padding: 0;
  border: none;
  background: none;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
  cursor: pointer;
}

.ct-text {
  margin: 0;
  max-height: 240px;
  overflow-y: auto;
  padding: 8px 12px;
  border-left: var(--border-w) solid var(--ion-color-primary);
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  font-size: var(--fs-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ct-error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-danger);
}
</style>
