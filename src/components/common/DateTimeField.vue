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
      @click="openPicker"
    >
      <ion-icon :icon="mode === 'time' ? timeOutline : calendarOutline" />
    </button>
    <ion-modal :is-open="open" class="dtf-modal" @did-dismiss="open = false">
      <div class="dtf-sheet">
        <div class="dtf-sheet-head">
          <span class="dtf-sheet-title">{{ title ?? TITLES[mode] }}</span>
          <button type="button" class="dtf-sheet-close" aria-label="Закрыть" @click="open = false">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>
        <div class="dtf-sheet-body">
          <div class="dtf-quick">
            <template v-if="mode === 'time'">
              <button type="button" class="dtf-chip" @click="draft = currentFieldValue('time')">Сейчас</button>
            </template>
            <template v-else>
              <button
                v-for="chip in dayChips"
                :key="chip.label"
                type="button"
                class="dtf-chip"
                :disabled="chip.disabled"
                @click="draft = chip.value"
              >
                {{ chip.label }}
              </button>
            </template>
          </div>
          <ion-datetime
            class="dtf-picker"
            :presentation="mode === 'datetime' ? 'date-time' : mode"
            :prefer-wheel="mode === 'time'"
            :value="draft"
            :min="min || undefined"
            :max="max || undefined"
            size="cover"
            locale="ru-RU"
            hour-cycle="h23"
            :first-day-of-week="1"
            @ion-change="onPick"
          >
            <span slot="time-label">Время</span>
          </ion-datetime>
        </div>
        <div class="dtf-sheet-actions">
          <button type="button" class="dtf-action dtf-action--ghost" @click="clear">Очистить</button>
          <button type="button" class="dtf-action dtf-action--primary" @click="confirm">Готово</button>
        </div>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonDatetime, IonIcon, IonModal } from '@ionic/vue'
import { calendarOutline, closeOutline, timeOutline } from 'ionicons/icons'
import {
  FIELD_HINTS,
  applyFieldInput,
  currentFieldValue,
  dayFieldValue,
  formatFieldValue,
  fromPickerValue,
  normalizeFieldValue,
  parseFieldText,
  type DateFieldMode,
} from '@/utils/dateField'

const TITLES: Record<DateFieldMode, string> = {
  date: 'Дата',
  time: 'Время',
  datetime: 'Дата и время',
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    mode?: DateFieldMode
    title?: string
    placeholder?: string
    ariaLabel?: string
    fallback?: string | null
    min?: string | null
    max?: string | null
    disabled?: boolean
  }>(),
  { modelValue: '', mode: 'date', title: undefined, fallback: '', min: '', max: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const text = ref(formatFieldValue(props.modelValue, props.mode))
const open = ref(false)
const draft = ref('')

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

const dayChips = computed(() => {
  const mode = props.mode === 'datetime' ? 'datetime' : 'date'
  const floor = normalizeFieldValue(props.min, props.mode)
  return [
    { label: 'Сегодня', offset: 0 },
    { label: 'Завтра', offset: 1 },
  ].map(({ label, offset }) => {
    const value = dayFieldValue(mode, offset, draft.value)
    return { label, value, disabled: !!floor && value < floor }
  })
})

function initialDraft() {
  return (
    normalizeFieldValue(props.modelValue, props.mode) ||
    normalizeFieldValue(props.fallback, props.mode) ||
    currentFieldValue(props.mode)
  )
}

function openPicker() {
  draft.value = initialDraft()
  open.value = true
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
  draft.value = fromPickerValue(Array.isArray(picked) ? picked[0] : picked, props.mode) || draft.value
}

function confirm() {
  publish(draft.value)
  open.value = false
}

function clear() {
  publish('')
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
  padding: 10px 44px 10px 12px;
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
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  transform: translateY(-50%);
  border: none;
  border-radius: 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s;
}

.dtf-button:hover:not(:disabled),
.dtf-button:focus-visible {
  background: rgba(var(--ion-color-primary-rgb), 0.2);
}

.dtf-button:disabled {
  cursor: default;
  opacity: 0.5;
}
</style>

<style>
:root {
  --dtf-surface-rgb: 255, 255, 255;
}

.ion-palette-dark {
  --dtf-surface-rgb: 26, 26, 53;
}

ion-modal.dtf-modal {
  --width: min(92vw, 380px);
  --height: fit-content;
  --max-height: 94vh;
  --border-radius: 20px;
  --background: var(--ion-card-background);
  --box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

@media (max-width: 575px) {
  ion-modal.dtf-modal {
    --width: 100%;
    --border-radius: 20px 20px 0 0;
    align-items: flex-end;
  }
}

.dtf-sheet {
  display: flex;
  flex-direction: column;
  max-height: 94vh;
  background: var(--ion-card-background);
  color: var(--ion-text-color);
  font-family: var(--ion-font-family);
}

.dtf-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 12px 4px 20px;
}

.dtf-sheet-title {
  font-size: 17px;
  font-weight: 700;
}

.dtf-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 22px;
  cursor: pointer;
}

.dtf-sheet-close:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.dtf-sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px;
}

.dtf-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 8px 4px;
}

.dtf-chip {
  padding: 6px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.dtf-chip:hover:not(:disabled) {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.dtf-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

ion-datetime.dtf-picker {
  --background: transparent;
  --background-rgb: var(--dtf-surface-rgb);
  --wheel-highlight-background: rgba(var(--ion-color-primary-rgb), 0.12);
  --wheel-highlight-border-radius: 10px;
  --ion-color-step-300: rgba(var(--ion-color-primary-rgb), 0.12);
  --ion-color-step-500: var(--ion-color-medium);
  --ion-color-step-650: var(--ion-text-color);
  width: 100%;
}

ion-datetime.dtf-picker::part(time-button) {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.dtf-sheet-actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}

.dtf-action {
  flex: 1;
  min-height: 48px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.dtf-action--ghost {
  border: 1.5px solid var(--ion-border-color);
  background: transparent;
  color: var(--ion-text-color);
}

.dtf-action--ghost:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.dtf-action--primary {
  border: none;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: #fff;
}

.dtf-action--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}
</style>
