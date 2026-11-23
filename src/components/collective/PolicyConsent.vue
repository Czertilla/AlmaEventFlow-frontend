<template>
  <div v-if="loading" class="pc-state"><ion-spinner name="crescent" /></div>
  <div v-else-if="failed" class="pc-box">
    <p class="pc-text">Не удалось загрузить политику обработки данных коллектива</p>
    <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="load()">Повторить</button>
  </div>
  <div v-else-if="policy" class="pc-box">
    <h4 class="ui-field-title">Обработка данных</h4>
    <p class="pc-text">
      Руководитель коллектива «{{ policy.collective_name }}» получит доступ к данным:
    </p>
    <ul class="pc-fields">
      <li v-for="field in policy.fields" :key="field.key">{{ field.label }}</li>
    </ul>
    <p v-if="policy.comment" class="pc-text">Комментарий руководителя: {{ policy.comment }}</p>
    <p class="pc-text">Политика вступит в силу, только когда вы станете участником коллектива.</p>
    <button type="button" class="pc-toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      {{ expanded ? 'Скрыть текст' : `Текст политики, версия ${policy.version}` }}
    </button>
    <p v-if="expanded" class="pc-full">{{ policy.text }}</p>
    <ion-checkbox v-model="agreed" label-placement="end" justify="start" class="pc-check">
      Согласен на обработку данных по этой политике
    </ion-checkbox>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonCheckbox, IonSpinner } from '@ionic/vue'
import {
  getCollectivePolicyProfileV3CollectivesCollectiveIdPolicyGet,
  type CollectivePolicyRead,
} from '@/api/generated/almaEventFlow'

const props = defineProps<{ collectiveId: string }>()
const agreed = defineModel<boolean>('agreed', { default: false })
const ready = defineModel<boolean>('ready', { default: false })

const policy = ref<CollectivePolicyRead | null>(null)
const loading = ref(false)
const failed = ref(false)
const expanded = ref(false)

const isReady = computed(() => !loading.value && !failed.value && (!policy.value || agreed.value))

watch(isReady, (value) => { ready.value = value }, { immediate: true })

async function load() {
  loading.value = true
  failed.value = false
  agreed.value = false
  try {
    policy.value = (await getCollectivePolicyProfileV3CollectivesCollectiveIdPolicyGet(props.collectiveId)).data
  } catch {
    policy.value = null
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.collectiveId, () => void load(), { immediate: true })
</script>

<style scoped>
.pc-state {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.pc-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.pc-text,
.pc-full {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-text-color);
}

.pc-full {
  color: var(--ion-color-medium);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pc-fields {
  margin: 0;
  padding-left: 20px;
  font-size: var(--fs-sm);
  color: var(--ion-text-color);
}

.pc-toggle {
  padding: 0;
  border: 0;
  background: none;
  font-size: var(--fs-sm);
  color: var(--ion-color-primary);
  cursor: pointer;
}

.pc-check {
  margin-top: 4px;
  font-size: var(--fs-md);
}
</style>
