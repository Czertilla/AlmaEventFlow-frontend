<template>
  <div class="ui-sheet-head">
    <h3 class="ui-sheet-title">Пригласительная ссылка</h3>
    <button class="ui-icon-btn" aria-label="Закрыть" @click="$emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="invite-form">
      <UiInput v-model.number="expiresIn" label="Время действия (часов)" type="number" min="1" max="720" />

      <button class="ui-btn ui-btn--primary" :disabled="creating" @click="createInvite">
        {{ creating ? 'Создание...' : 'Создать ссылку' }}
      </button>

      <div v-if="inviteLink" class="invite-result">
        <span class="invite-link">{{ inviteLink }}</span>
        <button class="copy-btn" @click="copy">
          <ion-icon :icon="copied ? checkmarkOutline : copyOutline" />
          {{ copied ? 'Скопировано' : 'Копировать' }}
        </button>
      </div>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonContent, IonIcon } from '@ionic/vue'
import { closeOutline, copyOutline, checkmarkOutline } from 'ionicons/icons'
import UiInput from '@/components/common/UiInput.vue'
import { createInviteTokenUserV1UsersInvitePost } from '@/api/generated/almaEventFlow'

defineEmits<{ close: [] }>()

const props = defineProps<{ personId: string }>()

const expiresIn = ref(24)
const inviteLink = ref('')
const creating = ref(false)
const copied = ref(false)

async function createInvite() {
  creating.value = true
  try {
    const res = await createInviteTokenUserV1UsersInvitePost({ person_id: props.personId, expires_in: expiresIn.value * 3600 })
    inviteLink.value = `${window.location.origin}/auth/register?token=${res.data.token}`
  } catch (err) {
    console.error('Failed to create invite', err)
  } finally {
    creating.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard unavailable */ }
}
</script>

<style scoped>
.invite-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.invite-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--ion-background-color);
  border: var(--border-w) solid var(--ion-border-color);
}

.invite-link {
  font-size: var(--fs-xs);
  font-family: var(--font-mono);
  color: var(--ion-text-color);
  word-break: break-all;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 7px 14px;
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  cursor: pointer;
  transition: all 0.15s;
}

.copy-btn:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}
</style>
