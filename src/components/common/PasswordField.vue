<template>
  <div class="field-input" :class="{ 'field-input--error': error }">
    <ion-icon :icon="lockClosedOutline" class="field-icon" />
    <input
      :value="modelValue"
      :type="revealed ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keyup.enter="$emit('enter')"
    />
    <button
      type="button"
      class="field-reveal"
      :aria-label="revealed ? 'Скрыть пароль' : 'Показать пароль (удерживайте)'"
      @mousedown.prevent="revealed = true"
      @mouseup="revealed = false"
      @mouseleave="revealed = false"
      @touchstart.prevent="revealed = true"
      @touchend.prevent="revealed = false"
      @touchcancel="revealed = false"
      @keydown.enter.prevent="revealed = true"
      @keyup.enter="revealed = false"
      @keydown.space.prevent="revealed = true"
      @keyup.space="revealed = false"
      @blur="revealed = false"
    >
      <ion-icon :icon="revealed ? eyeOffOutline : eyeOutline" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { lockClosedOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons'

defineProps<{
  modelValue: string
  placeholder?: string
  autocomplete?: string
  error?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string]; enter: [] }>()

// Пароль виден, только пока кнопка удерживается -- не переключатель.
const revealed = ref(false)
</script>

<style scoped>
.field-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-background-color);
  transition: border-color 0.2s;
}

.field-input:focus-within {
  border-color: var(--ion-color-primary);
}

.field-input--error {
  border-color: var(--ion-color-danger);
}

.field-icon {
  font-size: 18px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.field-input input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  padding: 14px 0;
  color: var(--ion-text-color);
  font-family: inherit;
}

.field-input input::placeholder {
  color: var(--ion-color-step-400);
}

.field-reveal {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 18px;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
}

.field-reveal:hover,
.field-reveal:focus-visible {
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}
</style>
