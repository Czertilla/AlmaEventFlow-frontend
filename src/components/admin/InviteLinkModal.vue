<template>
  <div class="modal-header">
    <h3>Пригласительная ссылка</h3>
    <button class="modal-close" aria-label="Закрыть" @click="$emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="invite-form">
      <div class="form-field">
        <label>Время действия (часов)</label>
        <input v-model.number="expiresIn" type="number" min="1" max="720" class="native-input" />
      </div>

      <ion-button expand="block" :disabled="creating" @click="createInvite">
        {{ creating ? 'Создание...' : 'Создать ссылку' }}
      </ion-button>

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
import { IonButton, IonContent, IonIcon } from '@ionic/vue'
import { closeOutline, copyOutline, checkmarkOutline } from 'ionicons/icons'
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
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
  background: var(--ion-card-background);
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--ion-background-color);
  color: var(--ion-color-medium);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s;
}

.modal-close:hover {
  background: var(--ion-border-color);
}

.invite-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.native-input {
  width: 100%;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.native-input:focus {
  border-color: var(--ion-color-primary);
}

.invite-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
}

.invite-link {
  font-size: 12px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
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
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.copy-btn:hover {
  background: rgba(108, 99, 255, 0.08);
}
</style>
