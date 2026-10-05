<template>
  <div class="dtf">
    <UiField :label="label" float :invalid="invalid" :error="error" :disabled="disabled">
      <span class="dtf-ghost" aria-hidden="true">
        <span class="dtf-ghost-line">
          <span
            v-for="(cell, index) in ghostCells"
            :key="index"
            class="dtf-cell"
            :class="{ 'dtf-cell--letter': cell.letter, 'dtf-cell--hidden': cell.hidden }"
            :data-char="cell.char"
            :data-hidden="cell.hidden"
          >
            <template v-if="cell.letter"
              ><span class="dtf-cell-zero">0</span><span class="dtf-cell-letter">{{ cell.char }}</span></template
            ><template v-else>{{ cell.char }}</template>
          </span>
        </span>
      </span>
      <input
        ref="inputEl"
        class="ui-field-control dtf-input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :value="text"
        :disabled="disabled"
        :aria-label="`${ariaLabel ?? label ?? title ?? TITLES[mode]}, ${FIELD_HINTS[mode]}`"
        @focus="onFocus"
        @input="onInput"
        @blur="onBlur"
      />
      <template #suffix>
        <button
          type="button"
          class="ui-icon-btn ui-icon-btn--primary"
          :disabled="disabled"
          :aria-label="mode === 'time' ? 'Выбрать время' : 'Выбрать дату'"
          @click="openPicker"
        >
          <ion-icon :icon="mode === 'time' ? timeOutline : calendarOutline" />
        </button>
      </template>
    </UiField>
    <ion-modal :is-open="open" :class="['dtf-modal', `dtf-modal--${mode}`]" @did-dismiss="open = false">
      <div class="ui-sheet">
        <div class="ui-sheet-head">
          <h3 class="ui-sheet-title">{{ title ?? label ?? TITLES[mode] }}</h3>
          <button type="button" class="ui-icon-btn" aria-label="Закрыть" @click="open = false">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>
        <div class="ui-sheet-body">
          <div class="dtf-quick">
            <button
              v-for="chip in chips"
              :key="chip.label"
              type="button"
              class="ui-chip"
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
        <div class="ui-sheet-actions">
          <button type="button" class="ui-btn ui-btn--ghost" @click="clear">Очистить</button>
          <button type="button" class="ui-btn ui-btn--primary" @click="confirm">Готово</button>
        </div>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { IonDatetime, IonIcon, IonModal } from '@ionic/vue'
import { calendarOutline, closeOutline, timeOutline } from 'ionicons/icons'
import TimeSpinner from '@/components/common/TimeSpinner.vue'
import UiField from '@/components/common/UiField.vue'
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
    label?: string
    error?: string
    title?: string
    ariaLabel?: string
    suggest?: string | null
    min?: string | null
    max?: string | null
    disabled?: boolean
  }>(),
  { modelValue: '', mode: 'date', label: undefined, error: undefined, title: undefined, ariaLabel: undefined, suggest: '', min: '', max: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const text = ref(formatFieldValue(props.modelValue, props.mode))
const inputEl = ref<HTMLInputElement | null>(null)
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

const ghostCells = computed(() =>
  [...FIELD_HINTS[props.mode]].map((char, index) => ({
    char,
    letter: /[А-ЯЁ]/.test(char),
    hidden: index < text.value.length,
  })),
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
  const known =
    normalizeFieldValue(props.modelValue, props.mode) || normalizeFieldValue(props.suggest, props.mode)
  if (known) return known
  const day = normalizeFieldValue(props.suggest, 'date')
  if (day && props.mode === 'datetime') return `${day}T${currentFieldValue('time')}`
  return currentFieldValue(props.mode)
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

function onFocus() {
  const day = props.mode === 'datetime' ? formatFieldValue(props.suggest, 'date') : ''
  if (text.value || !day) return
  text.value = `${day} `
  nextTick(() => {
    const el = inputEl.value
    if (!el) return
    el.value = text.value
    el.setSelectionRange(text.value.length, text.value.length)
  })
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
  width: 100%;
  min-width: 0;
}

.dtf-ghost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 var(--field-pad-x);
  overflow: hidden;
  color: var(--ion-color-step-400, var(--ion-color-medium));
  font-size: var(--fs-md);
  font-variant-numeric: tabular-nums;
  white-space: pre;
  pointer-events: none;
}

.dtf-ghost-line {
  white-space: pre;
}

.dtf-cell--letter {
  position: relative;
  display: inline-block;
}

.dtf-cell--hidden {
  visibility: hidden;
}

.dtf-cell-zero {
  visibility: hidden;
}

.dtf-cell-letter {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--fs-xs);
}

.dtf-input {
  position: relative;
  font-variant-numeric: tabular-nums;
  letter-spacing: normal;
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
  --border-radius: var(--radius-xl);
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
    --border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    align-items: flex-end;
  }
}

.dtf-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 8px 4px;
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
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
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

</style>
