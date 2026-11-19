<template>
  <div v-if="onboarding" class="ui-card ot-card">
    <div class="ui-card-head">
      <h3 class="ui-card-title">{{ onboarding.collective_name }}</h3>
    </div>
    <p class="ot-text">{{ text }}</p>
    <p v-if="comment" class="ot-comment">{{ comment }}</p>
    <div class="ot-actions">
      <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="busy" @click="decide('accept')">
        {{ onboarding.my_side === 'leader' ? 'Принять' : 'Вступить' }}
      </button>
      <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="busy" @click="decide('decline')">
        Отклонить
      </button>
      <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="emit('open-path', onboardingPath(onboarding.id))">
        Переписка
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  acceptOnboardingEventV3OnboardingsOnboardingIdAcceptPost,
  declineOnboardingEventV3OnboardingsOnboardingIdDeclinePost,
  type TodoItem,
} from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import { formatPersonName } from '@/utils/names'
import { onboardingPath } from '@/utils/onboarding'

const props = defineProps<{ item: TodoItem }>()
const emit = defineEmits<{ done: [id: string]; 'open-path': [path: string] }>()

const { showError } = useToast()
const busy = ref(false)

const onboarding = computed(() => props.item.onboarding ?? null)
const text = computed(() => {
  const value = onboarding.value
  if (!value) return ''
  return value.my_side === 'leader'
    ? `${formatPersonName(value.person)} просит принять в коллектив`
    : 'Вас приглашают в коллектив'
})
const comment = computed(() => {
  const entry = onboarding.value?.last_entry
  return entry && entry.author_side !== onboarding.value?.my_side ? entry.body ?? '' : ''
})

async function decide(action: 'accept' | 'decline') {
  const value = onboarding.value
  if (!value) return
  busy.value = true
  try {
    const call = action === 'accept'
      ? acceptOnboardingEventV3OnboardingsOnboardingIdAcceptPost
      : declineOnboardingEventV3OnboardingsOnboardingIdDeclinePost
    await call(value.id, { comment: null })
    emit('done', props.item.id)
  } catch (err) {
    await showError(err, 'Не удалось сохранить решение')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.ot-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ot-text {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-text-color);
}

.ot-comment {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ot-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
