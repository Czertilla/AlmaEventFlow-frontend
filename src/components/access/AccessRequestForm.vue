<template>
  <div class="ui-sheet-head">
    <h3 class="ui-sheet-title">
      Новый запрос
      <HelpTip>
        <p>Каждый участник получит уведомление с комментарием и сам решит, открыть ли данные.</p>
        <p>Кто придёт в коллектив позже, запрос не получит.</p>
      </HelpTip>
    </h3>
    <button class="ui-icon-btn" aria-label="Закрыть" @click="emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="arf-form">
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

      <UiTextarea
        v-model="comment"
        label="Зачем нужны данные"
        :rows="4"
        counter
        :maxlength="COMMENT_MAX"
        :error="commentError"
      />

      <div>
        <p class="ui-field-title">Срок</p>
        <div class="ui-chips">
          <button
            v-for="term in TERMS"
            :key="term.days"
            type="button"
            class="ui-chip"
            :class="{ 'ui-chip--active': days === term.days }"
            @click="days = term.days"
          >
            {{ term.label }}
          </button>
        </div>
      </div>
    </div>
  </ion-content>
  <div class="ui-sheet-actions">
    <button class="ui-btn ui-btn--primary" :disabled="saving || !chosen.size" @click="submit">
      <ion-spinner v-if="saving" name="crescent" />
      Отправить
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IonContent, IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import {
  createAccessRequestProfileV2AccessRequestsPost,
  getAccessFieldsProfileV2AccessRequestsFieldsGet,
  type AccessFieldRead,
  type AccessRequestRead,
} from '@/api/generated/almaEventFlow'
import HelpTip from '@/components/common/HelpTip.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import { useToast } from '@/composables/useToast'
import { COMMENT_MAX, COMMENT_MIN, TERMS, expiresAfter } from '@/utils/dataAccess'

const props = defineProps<{ collectiveId: string }>()
const emit = defineEmits<{ close: []; created: [request: AccessRequestRead] }>()

const { showError } = useToast()

const fields = ref<AccessFieldRead[]>([])
const chosen = ref(new Set<string>())
const comment = ref('')
const days = ref(7)
const saving = ref(false)
const tried = ref(false)

const commentError = computed(() => {
  if (!tried.value) return undefined
  const length = comment.value.trim().length
  return length < COMMENT_MIN ? `Не короче ${COMMENT_MIN} символов` : undefined
})

function toggle(key: string) {
  const next = new Set(chosen.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  chosen.value = next
}

async function submit() {
  tried.value = true
  if (commentError.value || !chosen.value.size || saving.value) return
  saving.value = true
  try {
    const { data } = await createAccessRequestProfileV2AccessRequestsPost({
      collective_id: props.collectiveId,
      fields: fields.value.filter((field) => chosen.value.has(field.key)).map((field) => field.key),
      comment: comment.value.trim(),
      expires_at: expiresAfter(days.value),
    })
    emit('created', data)
  } catch (err) {
    await showError(err, 'Не удалось отправить запрос')
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
.arf-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ui-sheet-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
