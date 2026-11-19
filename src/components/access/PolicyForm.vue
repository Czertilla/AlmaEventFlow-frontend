<template>
  <div class="ui-sheet-head">
    <h3 class="ui-sheet-title">
      {{ current ? `Версия ${current.version + 1}` : 'Политика доступа' }}
      <HelpTip>
        <p>Участники соглашаются на политику сами. Новая версия снова просит согласие у каждого.</p>
        <p>Согласие на прежнюю версию по-прежнему открывает поля, которые в ней были.</p>
      </HelpTip>
    </h3>
    <button class="ui-icon-btn" aria-label="Закрыть" @click="emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="pf-form">
      <div>
        <p class="ui-field-title">Данные</p>
        <div v-if="fields.length" class="ui-chips">
          <button
            v-for="field in fields"
            :key="field.key"
            type="button"
            class="ui-chip"
            :class="{ 'ui-chip--active': chosen.has(field.key) }"
            @click="toggle(field.key)"
          >
            {{ field.label }}
          </button>
        </div>
        <ion-spinner v-else name="crescent" />
      </div>

      <div class="pf-purpose">
        <div class="ui-chips">
          <button
            v-for="preset in POLICY_PURPOSES"
            :key="preset"
            type="button"
            class="ui-chip"
            :class="{ 'ui-chip--active': purpose === preset }"
            @click="purpose = preset"
          >
            {{ preset }}
          </button>
        </div>
        <UiTextarea v-model="purpose" label="Цель" :rows="3" counter :maxlength="COMMENT_MAX" :error="purposeError" />
      </div>

      <UiTextarea v-model="comment" label="Комментарий" :rows="3" counter :maxlength="COMMENT_MAX" />
    </div>
  </ion-content>
  <div class="ui-sheet-actions">
    <button class="ui-btn ui-btn--primary" :disabled="saving || !chosen.size" @click="submit">
      <ion-spinner v-if="saving" name="crescent" />
      Опубликовать
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IonContent, IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import {
  getAccessFieldsProfileV2AccessRequestsFieldsGet,
  publishCollectivePolicyProfileV3CollectivesCollectiveIdPoliciesPost,
  type AccessFieldRead,
  type CollectivePolicyRead,
} from '@/api/generated/almaEventFlow'
import HelpTip from '@/components/common/HelpTip.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import { useToast } from '@/composables/useToast'
import { COMMENT_MAX, COMMENT_MIN, POLICY_PURPOSES } from '@/utils/dataAccess'

const props = defineProps<{ collectiveId: string; current: CollectivePolicyRead | null }>()
const emit = defineEmits<{ close: []; published: [policy: CollectivePolicyRead] }>()

const { showError, showMessage } = useToast()

const fields = ref<AccessFieldRead[]>([])
const chosen = ref(new Set<string>(props.current?.fields.map((field) => field.key) ?? []))
const purpose = ref(props.current?.purpose ?? '')
const comment = ref(props.current?.comment ?? '')
const saving = ref(false)
const tried = ref(false)

const purposeError = computed(() => {
  if (!tried.value) return undefined
  return purpose.value.trim().length < COMMENT_MIN ? `Не короче ${COMMENT_MIN} символов` : undefined
})

function toggle(key: string) {
  const next = new Set(chosen.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  chosen.value = next
}

async function submit() {
  tried.value = true
  if (purposeError.value || !chosen.value.size || saving.value) return
  saving.value = true
  try {
    const { data } = await publishCollectivePolicyProfileV3CollectivesCollectiveIdPoliciesPost(props.collectiveId, {
      fields: fields.value.filter((field) => chosen.value.has(field.key)).map((field) => field.key),
      purpose: purpose.value.trim(),
      comment: comment.value.trim() || null,
    })
    emit('published', data)
  } catch (err) {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    if (detail === 'POLICY_UNCHANGED') await showMessage('Ничего не изменилось')
    else await showError(err, 'Не удалось опубликовать политику')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    fields.value = (await getAccessFieldsProfileV2AccessRequestsFieldsGet()).data
  } catch (err) {
    await showError(err, 'Не удалось загрузить список данных')
  }
})
</script>

<style scoped>
.pf-form,
.pf-purpose {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pf-purpose {
  gap: 10px;
}

.ui-sheet-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
