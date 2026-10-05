<template>
  <div class="ts">
    <div class="ts-drums">
      <TimeDrum
        ref="hoursDrum"
        label="Часы"
        :count="24"
        :model-value="parts.hours"
        @update:model-value="setUnit('hours', $event)"
        @advance="minutesDrum?.focus($event)"
      />
      <span class="ts-colon">:</span>
      <TimeDrum
        ref="minutesDrum"
        label="Минуты"
        :count="60"
        :model-value="parts.minutes"
        @update:model-value="setUnit('minutes', $event)"
        @retreat="hoursDrum?.focus()"
      />
    </div>
    <div v-if="presets.length" class="ts-presets">
      <button
        v-for="minute in presets"
        :key="minute"
        type="button"
        class="ui-chip"
        :class="{ 'ui-chip--active': parts.minutes === minute }"
        @click="setUnit('minutes', minute)"
      >
        :{{ pad(minute) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import TimeDrum from '@/components/common/TimeDrum.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    presets?: number[]
  }>(),
  { modelValue: '', presets: () => [0, 15, 30, 45] },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const hoursDrum = ref<InstanceType<typeof TimeDrum> | null>(null)
const minutesDrum = ref<InstanceType<typeof TimeDrum> | null>(null)

const pad = (value: number) => String(value).padStart(2, '0')

function parse(value: string | null | undefined) {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '')
  return { hours: match ? Number(match[1]) : 0, minutes: match ? Number(match[2]) : 0 }
}

const parts = reactive(parse(props.modelValue))

watch(
  () => props.modelValue,
  (value) => Object.assign(parts, parse(value)),
)

let syncQueued = false

function setUnit(key: 'hours' | 'minutes', value: number) {
  parts[key] = value
  emit('update:modelValue', `${pad(parts.hours)}:${pad(parts.minutes)}`)
  if (syncQueued) return
  syncQueued = true
  nextTick(() => {
    syncQueued = false
    Object.assign(parts, parse(props.modelValue))
  })
}
</script>

<style scoped>
.ts {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ts-drums {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ts-colon {
  color: var(--ion-color-medium);
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
}

.ts-presets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
</style>
