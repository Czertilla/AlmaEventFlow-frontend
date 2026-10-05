<template>
  <div
    class="ts-drum"
    :class="{ 'ts-drum--focus': focused }"
    :style="{ '--ts-row': `${ROW}px` }"
    @wheel="onWheel"
  >
    <div
      ref="scroller"
      class="ts-scroller"
      aria-hidden="true"
      @scroll.passive="onScroll"
      @scrollend.passive="settle"
      @touchstart.passive="takeOver"
      @pointerdown="takeOver"
    >
      <button
        v-for="(value, index) in items"
        :key="index"
        type="button"
        tabindex="-1"
        class="ts-item"
        :class="{ 'ts-item--current': index === scrollIndex }"
        @click="onItemClick(index)"
      >
        {{ pad(value) }}
      </button>
    </div>
    <input
      ref="input"
      class="ts-value"
      :class="{ 'ts-value--hidden': scrolling && !typedScroll }"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      role="spinbutton"
      :value="shown"
      :aria-label="label"
      :aria-valuenow="modelValue"
      aria-valuemin="0"
      :aria-valuemax="count - 1"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
      @input="onInput"
    />
    <div class="ts-band" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number
  count: number
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  advance: [carry: string]
  retreat: []
}>()

const ROW = 36
const IDLE_MS = 160
const WHEEL_NOTCH_PX = 100
const WHEEL_NOTCH_LINES = 3
const SAFETY_MS = 700
const PENDING_MAX_MS = 2500
const SEPARATORS = new Set([':', '.', ',', ' ', '-'])

const hasScrollEnd = typeof window !== 'undefined' && 'onscrollend' in window
const hasSnap = typeof CSS !== 'undefined' && !!CSS.supports?.('scroll-snap-type', 'y mandatory')

const pad = (value: number) => String(value).padStart(2, '0')
const mod = (value: number, size: number) => ((value % size) + size) % size

const items = computed(() => Array.from({ length: props.count * 3 }, (_, index) => index % props.count))
const lastIndex = computed(() => props.count * 3 - 1)

const scroller = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const scrollIndex = ref(props.count + props.modelValue)
const scrolling = ref(false)
const typedScroll = ref(false)
const focused = ref(false)
const buffer = ref('')

const shown = computed(() => buffer.value || pad(props.modelValue))

let programmatic = false
let emittedValue = props.modelValue
let pendingTarget: number | null = null
let pendingSince = 0
let settleTimer: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined

function clampIndex(index: number) {
  return Math.min(lastIndex.value, Math.max(0, index))
}

function indexAt(el: HTMLElement) {
  return clampIndex(Math.round(el.scrollTop / ROW))
}

function schedule(delay: number) {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(settle, delay)
}

function scrollToIndex(index: number, smooth: boolean) {
  const el = scroller.value
  if (!el) return
  const top = index * ROW
  if (smooth && typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: 'smooth' })
  else el.scrollTop = top
}

function requestScroll(index: number) {
  pendingTarget = index
  pendingSince = Date.now()
  scrollToIndex(index, true)
  schedule(SAFETY_MS)
}

function recenter(index: number) {
  const el = scroller.value
  const centered = props.count + mod(index, props.count)
  if (el) el.scrollTop = centered * ROW
  scrollIndex.value = centered
  pendingTarget = null
  return centered
}

function nearestIndex(value: number) {
  return [value, props.count + value, 2 * props.count + value].reduce((best, index) =>
    Math.abs(index - scrollIndex.value) < Math.abs(best - scrollIndex.value) ? index : best,
  )
}

function moveTo(value: number) {
  const index = nearestIndex(value)
  const el = scroller.value
  if (!el || Math.abs(el.scrollTop - index * ROW) < 1) {
    scrollIndex.value = index
    pendingTarget = null
    return
  }
  programmatic = true
  requestScroll(index)
}

function syncInstant() {
  const el = scroller.value
  if (!el || el.clientHeight === 0) return
  recenter(props.modelValue)
}

function onScroll() {
  const el = scroller.value
  if (!el) return
  const index = indexAt(el)
  scrollIndex.value = index
  scrolling.value = true
  schedule(hasScrollEnd ? SAFETY_MS : IDLE_MS)
  if (programmatic) return
  const value = index % props.count
  if (value !== emittedValue) {
    emittedValue = value
    emit('update:modelValue', value)
  }
}

function settle() {
  const el = scroller.value
  if (!el) return
  clearTimeout(settleTimer)
  if (pendingTarget !== null) {
    const reached = Math.abs(el.scrollTop - pendingTarget * ROW) <= 1
    if (!reached && Date.now() - pendingSince < PENDING_MAX_MS) {
      schedule(IDLE_MS)
      return
    }
    pendingTarget = null
  }
  programmatic = false
  typedScroll.value = false
  emittedValue = props.modelValue
  const index = indexAt(el)
  if (!hasSnap && Math.abs(el.scrollTop - index * ROW) > 1) {
    scrollToIndex(index, true)
    schedule(IDLE_MS)
    return
  }
  scrolling.value = false
  if (index % props.count !== props.modelValue) {
    moveTo(props.modelValue)
    return
  }
  if (index < props.count || index >= 2 * props.count) recenter(index)
}

function setValue(value: number) {
  if (value === emittedValue) return
  emittedValue = value
  emit('update:modelValue', value)
}

function stepBy(delta: number) {
  const el = scroller.value
  if (!el) return
  typedScroll.value = false
  programmatic = false
  let base = pendingTarget ?? scrollIndex.value
  if (base + delta < 0 || base + delta > lastIndex.value) base = recenter(base)
  requestScroll(clampIndex(base + delta))
}

function takeOver() {
  programmatic = false
  pendingTarget = null
}

function onWheel(event: WheelEvent) {
  if (event.ctrlKey) return
  const lines = event.deltaMode === 1
  const size = Math.abs(event.deltaY)
  if (!lines && size < WHEEL_NOTCH_PX / 2) {
    takeOver()
    return
  }
  const rows = Math.max(1, Math.round(size / (lines ? WHEEL_NOTCH_LINES : WHEEL_NOTCH_PX)))
  event.preventDefault()
  stepBy(Math.sign(event.deltaY) * rows)
}

function onItemClick(index: number) {
  if (index === scrollIndex.value && !scrolling.value) {
    input.value?.focus()
    return
  }
  typedScroll.value = false
  programmatic = false
  requestScroll(index)
}

function typeDigit(char: string): string | null {
  const max = props.count - 1
  const digit = Number(char)
  typedScroll.value = true
  if (buffer.value === '') {
    if (digit * 10 > max) {
      setValue(digit)
      return ''
    }
    buffer.value = char
    setValue(digit)
    return null
  }
  const combined = Number(buffer.value + char)
  buffer.value = ''
  if (combined > max) return char
  setValue(combined)
  return ''
}

function finish(rest: string) {
  buffer.value = ''
  typedScroll.value = true
  emit('advance', rest)
}

function feed(chars: string) {
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!
    if (SEPARATORS.has(char)) return finish(chars.slice(index + 1))
    if (!/\d/.test(char)) continue
    const carry = typeDigit(char)
    if (carry !== null) return finish(carry + chars.slice(index + 1))
  }
}

function backspace() {
  if (buffer.value) buffer.value = buffer.value.slice(0, -1)
  else emit('retreat')
}

function onFocus() {
  focused.value = true
  buffer.value = ''
  setTimeout(() => input.value?.select(), 0)
}

function onBlur() {
  focused.value = false
  buffer.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'ArrowDown') stepBy(1)
  else if (event.key === 'ArrowUp') stepBy(-1)
  else if (event.key === 'ArrowRight') emit('advance', '')
  else if (event.key === 'ArrowLeft') emit('retreat')
  else if (event.key === 'Backspace') backspace()
  else if (SEPARATORS.has(event.key)) emit('advance', '')
  else return
  event.preventDefault()
}

function onInput(event: Event) {
  const { inputType, data } = event as InputEvent
  const el = event.target as HTMLInputElement
  if (inputType?.startsWith('delete')) backspace()
  else feed(data ?? el.value.slice(-1))
  el.value = shown.value
}

function focus(carry = '') {
  input.value?.focus()
  feed(carry)
}

watch(
  () => props.modelValue,
  (value) => {
    emittedValue = value
    if (scrolling.value && !programmatic) return
    if (mod(scrollIndex.value, props.count) === value) return
    moveTo(value)
  },
)

onMounted(() => {
  syncInstant()
  if (typeof ResizeObserver !== 'undefined' && scroller.value) {
    observer = new ResizeObserver(() => {
      if (!scrolling.value) syncInstant()
    })
    observer.observe(scroller.value)
  }
  nextTick(syncInstant)
})

onBeforeUnmount(() => {
  clearTimeout(settleTimer)
  observer?.disconnect()
})

defineExpose({ focus })
</script>

<style scoped>
.ts-drum {
  position: relative;
  width: 64px;
  height: calc(var(--ts-row) * 5);
}

.ts-scroller {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: calc(var(--ts-row) * 2) 0;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.35) 20%,
    #000 40%,
    #000 60%,
    rgba(0, 0, 0, 0.35) 80%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.35) 20%,
    #000 40%,
    #000 60%,
    rgba(0, 0, 0, 0.35) 80%,
    transparent 100%
  );
}

.ts-scroller::-webkit-scrollbar {
  display: none;
}

.ts-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--ts-row);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ion-text-color);
  font-size: var(--fs-xl);
  font-weight: var(--fw-semibold);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  -webkit-tap-highlight-color: transparent;
}

.ts-item:hover {
  color: var(--ion-color-primary);
}

.ts-item--current {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
}

.ts-value {
  position: absolute;
  top: calc(var(--ts-row) * 2);
  right: 0;
  left: 0;
  box-sizing: border-box;
  height: var(--ts-row);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--ion-card-background);
  color: var(--ion-text-color);
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: none;
  pointer-events: none;
  caret-color: var(--ion-color-primary);
}

.ts-value--hidden {
  opacity: 0;
}

.ts-band {
  position: absolute;
  top: calc(var(--ts-row) * 2);
  right: 0;
  left: 0;
  height: var(--ts-row);
  box-sizing: border-box;
  border: var(--border-w) solid rgba(var(--ion-color-primary-rgb), 0.35);
  border-radius: var(--radius-md);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  pointer-events: none;
  transition: border-color 0.15s;
}

.ts-drum--focus .ts-band {
  border-color: var(--ion-color-primary);
}
</style>
