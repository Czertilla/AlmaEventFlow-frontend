<template>
  <UiInput
    :model-value="modelValue"
    :label="label"
    :type="revealed ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :placeholder="placeholder"
    :invalid="!!error"
    :error="typeof error === 'string' ? error : undefined"
    :hint="hint"
    @update:model-value="emit('update:modelValue', $event)"
    @keyup.enter="emit('enter')"
  >
    <template #prefix><ion-icon :icon="lockClosedOutline" /></template>
    <template #suffix>
      <button
        type="button"
        class="ui-icon-btn field-reveal"
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
    </template>
  </UiInput>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { lockClosedOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons'
import UiInput from '@/components/common/UiInput.vue'

defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  autocomplete?: string
  error?: boolean | string
  hint?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string]; enter: [] }>()

// Пароль виден, только пока кнопка удерживается -- не переключатель.
const revealed = ref(false)
</script>

<style scoped>
.field-reveal {
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
}
</style>
