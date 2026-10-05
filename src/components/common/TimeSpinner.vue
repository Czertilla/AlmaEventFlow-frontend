<template>
  <div class="ts">
    <div class="ts-row">
      <template v-for="(unit, index) in units" :key="unit.key">
        <span v-if="index" class="ts-colon">:</span>
        <div class="ts-unit">
          <button
            type="button"
            class="ts-step"
            :aria-label="`${unit.label}: больше`"
            @pointerdown.prevent="startHold(unit, 1)"
            @pointerup="stopHold"
            @pointerleave="stopHold"
            @pointercancel="stopHold"
            @click="onClick(unit, 1, $event)"
          >
            <ion-icon :icon="addOutline" />
          </button>
          <input
            class="ts-value"
            type="text"
            inputmode="numeric"
            maxlength="2"
            autocomplete="off"
            :value="shown(unit)"
            :aria-label="unit.label"
            @focus="onFocus(unit, $event)"
            @input="onInput(unit, $event)"
            @blur="editing = null"
            @keydown.up.prevent="step(unit, 1)"
            @keydown.down.prevent="step(unit, -1)"
            @wheel.prevent="step(unit, $event.deltaY < 0 ? 1 : -1)"
          />
          <button
            type="button"
            class="ts-step"
            :aria-label="`${unit.label}: меньше`"
            @pointerdown.prevent="startHold(unit, -1)"
            @pointerup="stopHold"
            @pointerleave="stopHold"
            @pointercancel="stopHold"
            @click="onClick(unit, -1, $event)"
          >
            <ion-icon :icon="removeOutline" />
          </button>
        </div>
      </template>
    </div>
    <div v-if="presets.length" class="ts-presets">
      <button
        v-for="minute in presets"
        :key="minute"
        type="button"
        class="ts-preset"
        :class="{ 'ts-preset--on': minutes === minute }"
        @click="setUnit('minutes', minute)"
      >
        :{{ pad(minute) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { addOutline, removeOutline } from 'ionicons/icons'

type UnitKey = 'hours' | 'minutes'

interface Unit {
  key: UnitKey
  label: string
  max: number
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    presets?: number[]
  }>(),
  { modelValue: '', presets: () => [0, 15, 30, 45] },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const units: Unit[] = [
  { key: 'hours', label: 'Часы', max: 23 },
  { key: 'minutes', label: 'Минуты', max: 59 },
]

const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 90

const pad = (value: number) => String(value).padStart(2, '0')

const parts = computed(() => {
  const match = /^(\d{2}):(\d{2})/.exec(props.modelValue ?? '')
  return { hours: match ? Number(match[1]) : 0, minutes: match ? Number(match[2]) : 0 }
})
const minutes = computed(() => parts.value.minutes)

const editing = ref<UnitKey | null>(null)
const typed = ref('')

function shown(unit: Unit) {
  return editing.value === unit.key ? typed.value : pad(parts.value[unit.key])
}

function setUnit(key: UnitKey, value: number) {
  const next = { ...parts.value, [key]: value }
  emit('update:modelValue', `${pad(next.hours)}:${pad(next.minutes)}`)
}

function step(unit: Unit, delta: number) {
  const size = unit.max + 1
  setUnit(unit.key, (parts.value[unit.key] + delta + size) % size)
}

function onFocus(unit: Unit, event: FocusEvent) {
  editing.value = unit.key
  typed.value = pad(parts.value[unit.key])
  ;(event.target as HTMLInputElement).select()
}

function onInput(unit: Unit, event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 2)
  typed.value = digits
  input.value = digits
  if (digits) setUnit(unit.key, Math.min(Number(digits), unit.max))
}

let holdTimer: ReturnType<typeof setTimeout> | undefined
let repeatTimer: ReturnType<typeof setInterval> | undefined
let held = false

function stopHold() {
  clearTimeout(holdTimer)
  clearInterval(repeatTimer)
}

function startHold(unit: Unit, delta: number) {
  stopHold()
  held = true
  step(unit, delta)
  holdTimer = setTimeout(() => {
    repeatTimer = setInterval(() => step(unit, delta), HOLD_REPEAT_MS)
  }, HOLD_DELAY_MS)
}

function onClick(unit: Unit, delta: number, event: MouseEvent) {
  if (held && event.detail > 0) {
    held = false
    return
  }
  held = false
  step(unit, delta)
}

onBeforeUnmount(stopHold)
</script>

<style scoped>
.ts {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ts-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ts-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.ts-step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 36px;
  padding: 0;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--ion-color-primary);
  font-size: 18px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  transition: background 0.15s, border-color 0.15s;
}

.ts-step:hover,
.ts-step:active {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.ts-value {
  width: 60px;
  height: 52px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  color: var(--ion-text-color);
  font-family: inherit;
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: none;
  transition: border-color 0.15s;
}

.ts-value:focus {
  border-color: var(--ion-color-primary);
}

.ts-colon {
  color: var(--ion-color-medium);
  font-size: 24px;
  font-weight: 700;
}

.ts-presets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.ts-preset {
  padding: 4px 10px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-medium);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all 0.15s;
}

.ts-preset:hover,
.ts-preset--on {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

@media (max-width: 575px) {
  .ts-unit {
    flex-direction: row-reverse;
  }

  .ts-step {
    width: 36px;
    height: 44px;
  }

  .ts-value {
    width: 48px;
    height: 44px;
    font-size: 20px;
  }

  .ts-unit {
    gap: 4px;
  }
}
</style>
