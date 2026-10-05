<template>
  <div class="dtf">
    <input
      class="dtf-input"
      :class="{ 'dtf-input--invalid': invalid }"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      :value="text"
      :placeholder="placeholder ?? FIELD_HINTS[mode]"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onInput"
      @blur="onBlur"
    />
    <button
      type="button"
      class="dtf-button"
      :disabled="disabled"
      :aria-label="mode === 'time' ? 'Выбрать время' : 'Выбрать дату'"
      @click="open = true"
    >
      <ion-icon :icon="mode === 'time' ? timeOutline : calendarOutline" />
    </button>
    <ion-modal :is-open="open" class="dtf-modal" @did-dismiss="open = false">
      <div class="dtf-sheet">
        <ion-datetime
          :presentation="mode === 'datetime' ? 'date-time' : mode"
          :value="pickerValue()"
          :min="min || undefined"
          :max="max || undefined"
          locale="ru-RU"
          :first-day-of-week="1"
          show-default-buttons
          show-clear-button
          done-text="Готово"
          cancel-text="Отмена"
          clear-text="Очистить"
          @ion-change="onPick"
        >
          <span slot="time-label">Время</span>
        </ion-datetime>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonDatetime, IonIcon, IonModal } from '@ionic/vue'
import { calendarOutline, timeOutline } from 'ionicons/icons'
import {
  FIELD_HINTS,
  applyFieldInput,
  currentFieldValue,
  formatFieldValue,
  fromPickerValue,
  normalizeFieldValue,
  parseFieldText,
  type DateFieldMode,
} from '@/utils/dateField'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    mode?: DateFieldMode
    placeholder?: string
    ariaLabel?: string
    fallback?: string | null
    min?: string | null
    max?: string | null
    disabled?: boolean
  }>(),
  { modelValue: '', mode: 'date', fallback: '', min: '', max: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const text = ref(formatFieldValue(props.modelValue, props.mode))
const open = ref(false)

watch(
  () => [props.modelValue, props.mode] as const,
  ([value, mode]) => {
    text.value = formatFieldValue(value, mode)
  },
)

const invalid = computed(
  () =>
    text.value.length === FIELD_HINTS[props.mode].length &&
    parseFieldText(text.value, props.mode) === null,
)

function pickerValue() {
  return (
    normalizeFieldValue(props.modelValue, props.mode) ||
    normalizeFieldValue(props.fallback, props.mode) ||
    currentFieldValue(props.mode)
  )
}

function publish(value: string) {
  if (value === (props.modelValue ?? '')) return
  emit('update:modelValue', value)
  emit('change', value)
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const edit = applyFieldInput(
    text.value,
    input.value,
    input.selectionStart ?? input.value.length,
    (event as InputEvent).inputType ?? '',
    props.mode,
  )
  text.value = edit.text
  input.value = edit.text
  input.setSelectionRange(edit.caret, edit.caret)
  if (!edit.text) {
    publish('')
    return
  }
  const parsed = parseFieldText(edit.text, props.mode)
  if (parsed !== null) publish(parsed)
}

function onBlur() {
  text.value = formatFieldValue(props.modelValue, props.mode)
}

function onPick(event: CustomEvent<{ value?: string | string[] | null }>) {
  const picked = event.detail.value
  publish(fromPickerValue(Array.isArray(picked) ? picked[0] : picked, props.mode))
  open.value = false
}
</script>

<style scoped>
.dtf {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
}

.dtf-input {
  width: 100%;
  min-width: 0;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  padding: 10px 40px 10px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.dtf-input:focus {
  border-color: var(--ion-color-primary);
}

.dtf-input--invalid,
.dtf-input--invalid:focus {
  border-color: var(--ion-color-danger);
}

.dtf-input:disabled {
  opacity: 0.6;
}

.dtf-button {
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  transform: translateY(-50%);
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 18px;
  cursor: pointer;
}

.dtf-button:hover:not(:disabled),
.dtf-button:focus-visible {
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.dtf-button:disabled {
  cursor: default;
  opacity: 0.5;
}
</style>

<style>
ion-modal.dtf-modal {
  --width: min(92vw, 360px);
  --height: fit-content;
  --max-height: 96vh;
  --border-radius: 16px;
}

.dtf-sheet {
  max-height: 96vh;
  overflow-y: auto;
}
</style>
