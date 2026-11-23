<template>
  <div class="ob-chat">
    <div v-if="!detail && loading" class="ob-state"><ion-spinner name="crescent" /></div>
    <PageState v-else-if="!detail" text="Не удалось загрузить переписку">
      <ion-button fill="clear" size="small" @click="load()">Повторить</ion-button>
    </PageState>
    <template v-else>
      <div class="ob-status">
        <span class="ui-chip ui-chip--static" :class="{ 'ui-attention': waitsForMe }">{{ waitingText(detail.onboarding) }}</span>
        <span v-if="open" class="ob-expires">до {{ formatDate(new Date(detail.onboarding.expires_at), settings.dateFormat) }}</span>
      </div>

      <ol class="ob-feed">
        <li
          v-for="entry in detail.entries"
          :key="entry.id"
          class="ob-entry"
          :class="{
            'ob-entry--mine': entry.author_side === detail.onboarding.my_side,
            'ob-entry--system': entry.kind !== 'message',
          }"
        >
          <span v-if="entry.kind !== 'message'" class="ob-decision">{{ decisionText(entry.kind, entry.author_side) }}</span>
          <p v-if="entry.body" class="ob-body">{{ entry.body }}</p>
          <span class="ob-time">{{ authorOf(entry) }} · {{ formatDateTime(entry.created_at) }}</span>
        </li>
      </ol>

      <PolicyConsent
        v-if="asksConsent"
        v-model:agreed="agreed"
        v-model:ready="consentReady"
        :collective-id="detail.onboarding.collective_id"
      />

      <div v-if="detail.actions.accept || detail.actions.decline || detail.actions.withdraw" class="ob-actions">
        <button
          v-if="detail.actions.accept"
          type="button"
          class="ui-btn ui-btn--primary ui-btn--sm"
          :disabled="busy || (asksConsent && !consentReady)"
          @click="decide('accept')"
        >
          {{ detail.onboarding.awaiting === 'leader' ? 'Принять в коллектив' : 'Вступить' }}
        </button>
        <button v-if="detail.actions.decline" type="button" class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="busy" @click="decide('decline')">
          Отклонить
        </button>
        <button v-if="detail.actions.withdraw" type="button" class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="busy" @click="decide('withdraw')">
          Отозвать
        </button>
      </div>

      <form v-if="detail.actions.message" class="ob-compose" @submit.prevent="send()">
        <UiTextarea v-model="draft" label="Сообщение" :rows="2" :maxlength="MESSAGE_MAX" counter />
        <button type="submit" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="busy || !draft.trim()">Отправить</button>
      </form>

      <button
        v-if="detail.actions.report && !reported"
        type="button"
        class="ob-report"
        :disabled="busy"
        @click="report()"
      >
        Пожаловаться
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonButton, IonSpinner, alertController } from '@ionic/vue'
import {
  acceptOnboardingEventV3OnboardingsOnboardingIdAcceptPost,
  declineOnboardingEventV3OnboardingsOnboardingIdDeclinePost,
  getOnboardingEventV3OnboardingsOnboardingIdGet,
  reportOnboardingEventV3OnboardingsOnboardingIdReportPost,
  withdrawOnboardingEventV3OnboardingsOnboardingIdWithdrawPost,
  writeOnboardingMessageEventV3OnboardingsOnboardingIdMessagesPost,
  type OnboardingDetail,
  type OnboardingEntry,
} from '@/api/generated/almaEventFlow'
import PageState from '@/components/common/PageState.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import PolicyConsent from '@/components/collective/PolicyConsent.vue'
import { useToast } from '@/composables/useToast'
import { useLiveStore } from '@/stores/live'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/date'
import { formatPersonName } from '@/utils/names'
import { decisionText, isOpen, waitingText } from '@/utils/onboarding'

const MESSAGE_MAX = 1000

const props = defineProps<{ onboardingId: string }>()
const emit = defineEmits<{ changed: [detail: OnboardingDetail] }>()

const live = useLiveStore()
const settings = useSettingsStore()
const { showError, showSuccess } = useToast()

const detail = ref<OnboardingDetail | null>(null)
const loading = ref(false)
const busy = ref(false)
const draft = ref('')
const reported = ref(false)
const agreed = ref(false)
const consentReady = ref(false)

const open = computed(() => (detail.value ? isOpen(detail.value.onboarding.status) : false))
const asksConsent = computed(
  () => !!detail.value?.actions.accept && detail.value.onboarding.my_side === 'candidate',
)
const waitsForMe = computed(() => {
  const onboarding = detail.value?.onboarding
  return !!onboarding?.awaiting && onboarding.awaiting === onboarding.my_side
})

function formatDateTime(value: string): string {
  const date = new Date(value)
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(date, settings.dateFormat)} ${time}`
}

function authorOf(entry: OnboardingEntry): string {
  if (entry.author_side === 'system') return 'Система'
  if (entry.author_side === detail.value?.onboarding.my_side) return 'Вы'
  if (entry.author_side === 'candidate') return formatPersonName(detail.value!.onboarding.person) || 'Кандидат'
  return 'Руководитель'
}

function adopt(next: OnboardingDetail) {
  detail.value = next
  emit('changed', next)
}

async function load() {
  loading.value = true
  try {
    adopt((await getOnboardingEventV3OnboardingsOnboardingIdGet(props.onboardingId)).data)
  } catch {
    /* прежняя переписка остаётся на экране */
  } finally {
    loading.value = false
  }
}

async function confirm(header: string): Promise<{ ok: boolean; comment: string }> {
  const alert = await alertController.create({
    header,
    inputs: [{
      name: 'comment',
      type: 'textarea',
      placeholder: 'Комментарий',
      value: draft.value.trim(),
      attributes: { maxlength: MESSAGE_MAX },
    }],
    buttons: [
      { text: 'Отмена', role: 'cancel' },
      { text: 'Да', role: 'confirm' },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss<{ values?: { comment?: string } }>()
  return { ok: role === 'confirm', comment: data?.values?.comment?.trim() ?? '' }
}

const HEADERS = {
  accept: 'Принять?',
  decline: 'Отклонить?',
  withdraw: 'Отозвать?',
} as const

async function decide(action: keyof typeof HEADERS) {
  const answer = await confirm(HEADERS[action])
  if (!answer.ok) return
  busy.value = true
  const body = {
    comment: answer.comment || null,
    ...(action === 'accept' && asksConsent.value ? { consent: agreed.value } : {}),
  }
  try {
    const call = {
      accept: acceptOnboardingEventV3OnboardingsOnboardingIdAcceptPost,
      decline: declineOnboardingEventV3OnboardingsOnboardingIdDeclinePost,
      withdraw: withdrawOnboardingEventV3OnboardingsOnboardingIdWithdrawPost,
    }[action]
    adopt((await call(props.onboardingId, body)).data)
    if (answer.comment && answer.comment === draft.value.trim()) draft.value = ''
  } catch (err) {
    await showError(err, 'Не удалось сохранить решение')
    await load()
  } finally {
    busy.value = false
  }
}

async function send() {
  const body = draft.value.trim()
  if (!body) return
  busy.value = true
  try {
    adopt((await writeOnboardingMessageEventV3OnboardingsOnboardingIdMessagesPost(props.onboardingId, { body })).data)
    draft.value = ''
  } catch (err) {
    await showError(err, 'Не удалось отправить сообщение')
  } finally {
    busy.value = false
  }
}

async function report() {
  const alert = await alertController.create({
    header: 'Жалоба',
    inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Что случилось', attributes: { maxlength: MESSAGE_MAX } }],
    buttons: [
      { text: 'Отмена', role: 'cancel' },
      { text: 'Отправить', role: 'confirm' },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss<{ values?: { reason?: string } }>()
  const reason = data?.values?.reason?.trim()
  if (role !== 'confirm' || !reason) return
  busy.value = true
  try {
    await reportOnboardingEventV3OnboardingsOnboardingIdReportPost(props.onboardingId, { reason })
    reported.value = true
    await showSuccess('Жалоба отправлена')
  } catch (err) {
    await showError(err, 'Не удалось отправить жалобу')
  } finally {
    busy.value = false
  }
}

watch(() => props.onboardingId, () => {
  detail.value = null
  reported.value = false
  void load()
}, { immediate: true })

watch(() => live.versionOf(props.onboardingId), (next, prev) => {
  if (next !== prev && !busy.value) void load()
})
</script>

<style scoped>
.ob-chat {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ob-state {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.ob-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ob-expires {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.ob-feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ob-entry {
  align-self: flex-start;
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: rgba(var(--ion-text-color-rgb), 0.07);
  color: var(--ion-text-color);
}

.ob-entry--mine {
  align-self: flex-end;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
}

.ob-entry--system {
  align-self: center;
  max-width: 100%;
  background: none;
  text-align: center;
}

.ob-decision {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
}

.ob-body {
  margin: 0;
  font-size: var(--fs-md);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ob-time {
  font-size: var(--fs-2xs);
  color: var(--ion-color-medium);
}

.ob-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ob-compose {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.ob-compose :deep(.ui-field) {
  align-self: stretch;
}

.ob-report {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
  text-decoration: underline;
  cursor: pointer;
}
</style>
