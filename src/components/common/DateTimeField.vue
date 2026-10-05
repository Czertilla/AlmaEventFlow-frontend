<template>
  <div class="dtf">
    <div class="dtf-box" :class="{ 'dtf-box--invalid': invalid, 'dtf-box--disabled': disabled }">
      <span class="dtf-ghost" aria-hidden="true">
        <span class="dtf-ghost-typed">{{ text }}</span>{{ FIELD_HINTS[mode].slice(text.length) }}
      </span>
      <input
        class="dtf-input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :value="text"
        :disabled="disabled"
        :aria-label="`${ariaLabel ?? title ?? TITLES[mode]}, ${FIELD_HINTS[mode]}`"
        @input="onInput"
        @blur="onBlur"
      />
    </div>
    <button
      type="button"
      class="dtf-button"
      :disabled="disabled"
      :aria-label="mode === 'time' ? 'Выбрать время' : 'Выбрать дату'"
      @click="openPicker"
    >
      <ion-icon :icon="mode === 'time' ? timeOutline : calendarOutline" />
    </button>
    <ion-modal :is-open="open" :class="['dtf-modal', `dtf-modal--${mode}`]" @did-dismiss="open = false">
      <div class="dtf-sheet">
        <div class="dtf-sheet-head">
          <span class="dtf-sheet-title">{{ title ?? TITLES[mode] }}</span>
          <button type="button" class="dtf-sheet-close" aria-label="Закрыть" @click="open = false">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>
        <div class="dtf-sheet-body">
          <div class="dtf-quick">
            <button
              v-for="chip in chips"
              :key="chip.label"
              type="button"
              class="dtf-chip"
              :disabled="chip.disabled"
              @click="setDraft(chip.value)"
            >
              {{ chip.label }}
            </button>
          </div>
          <div class="dtf-body" :class="`dtf-body--${mode}`">
            <ion-datetime
              v-if="mode !== 'time'"
              class="dtf-picker"
              presentation="date"
              :value="draftDate"
              :min="calendarLimit(min) || undefined"
              :max="calendarLimit(max) || undefined"
              size="cover"
              locale="ru-RU"
              :first-day-of-week="1"
              @ion-change="onPickDate"
            />
            <div v-if="mode !== 'date'" class="dtf-time">
              <span v-if="mode === 'datetime'" class="dtf-time-title">Время</span>
              <TimeSpinner :model-value="draftTime" @update:model-value="onPickTime" />
            </div>
          </div>
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
import TimeSpinner from '@/components/common/TimeSpinner.vue'
import {
  FIELD_HINTS,
  applyFieldInput,
  clampFieldValue,
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
    ariaLabel?: string
    fallback?: string | null
    min?: string | null
    max?: string | null
    disabled?: boolean
  }>(),
  { modelValue: '', mode: 'date', title: undefined, ariaLabel: undefined, fallback: '', min: '', max: '' },
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

const draftDate = computed(() => (props.mode === 'time' ? '' : draft.value.slice(0, 10)))
const draftTime = computed(() => (props.mode === 'time' ? draft.value : draft.value.slice(11)))

const chips = computed(() => {
  const withDay = props.mode === 'datetime' ? 'datetime' : 'date'
  const list =
    props.mode === 'time'
      ? [{ label: 'Сейчас', value: currentFieldValue('time') }]
      : [
          ...(props.mode === 'datetime' ? [{ label: 'Сейчас', value: currentFieldValue('datetime') }] : []),
          { label: 'Сегодня', value: dayFieldValue(withDay, 0, draft.value) },
          { label: 'Завтра', value: dayFieldValue(withDay, 1, draft.value) },
        ]
  const floor = normalizeFieldValue(props.min, props.mode)
  const ceiling = normalizeFieldValue(props.max, props.mode)
  return list.map((chip) => ({
    ...chip,
    disabled: (!!floor && chip.value < floor) || (!!ceiling && chip.value > ceiling),
  }))
})

function calendarLimit(value: string | null | undefined) {
  return normalizeFieldValue(value, props.mode).slice(0, 10)
}

function setDraft(value: string) {
  draft.value = clampFieldValue(value, props.min, props.max, props.mode)
}

function initialDraft() {
  return (
    normalizeFieldValue(props.modelValue, props.mode) ||
    normalizeFieldValue(props.fallback, props.mode) ||
    currentFieldValue(props.mode)
  )
}

function openPicker() {
  setDraft(initialDraft())
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

function onPickDate(event: CustomEvent<{ value?: string | string[] | null }>) {
  const picked = event.detail.value
  const day = fromPickerValue(Array.isArray(picked) ? picked[0] : picked, 'date')
  if (day) setDraft(props.mode === 'date' ? day : `${day}T${draftTime.value}`)
}

function onPickTime(time: string) {
  setDraft(props.mode === 'time' ? time : `${draftDate.value}T${time}`)
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

.dtf-box {
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 10px;
  background: var(--dtf-bg, var(--ion-card-background));
}

.dtf-ghost,
.dtf-input {
  box-sizing: border-box;
  width: 100%;
  border: 1.5px solid transparent;
  padding: 10px 48px 10px 12px;
  font-family: inherit;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  letter-spacing: normal;
}

.dtf-ghost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  color: var(--ion-color-step-400, var(--ion-color-medium));
  white-space: pre;
  pointer-events: none;
}

.dtf-ghost-typed {
  visibility: hidden;
}

.dtf-input {
  position: relative;
  display: block;
  min-width: 0;
  border-color: var(--ion-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--ion-text-color);
  outline: none;
  transition: border-color 0.15s;
}

.dtf-input:focus {
  border-color: var(--ion-color-primary);
}

.dtf-box--invalid .dtf-input,
.dtf-box--invalid .dtf-input:focus {
  border-color: var(--ion-color-danger);
}

.dtf-box--disabled {
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

ion-modal.dtf-modal--time {
  --width: min(92vw, 320px);
}

@media (min-width: 576px) {
  ion-modal.dtf-modal--datetime {
    --width: min(92vw, 640px);
  }
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

.dtf-body {
  display: flex;
  flex-direction: column;
}

.dtf-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 12px;
}

.dtf-time-title {
  align-self: flex-start;
  color: var(--ion-color-medium);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

@media (min-width: 576px) {
  .dtf-body--datetime {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 190px;
    align-items: start;
    gap: 8px;
  }

  .dtf-body--datetime .dtf-time {
    margin: 12px 0 0;
    padding: 4px 4px 12px 16px;
    border-left: 1.5px solid var(--ion-border-color);
  }

  .dtf-body--time .dtf-time {
    padding-top: 0;
  }
}

ion-datetime.dtf-picker {
  --background: transparent;
  --background-rgb: var(--dtf-surface-rgb);
  --ion-color-step-500: var(--ion-color-medium);
  --ion-color-step-650: var(--ion-text-color);
  width: 100%;
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
