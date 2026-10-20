<template>
  <span v-if="settings.showHints" class="ui-help-wrap">
    <button
      ref="button"
      type="button"
      class="ui-help"
      :class="{ 'ui-help--open': open }"
      :aria-label="label"
      :aria-expanded="open"
      :aria-controls="open ? tipId : undefined"
      @mousedown.prevent
      @click.stop.prevent="toggle"
      @keydown.esc="close"
    >
      ?
    </button>
    <Teleport to="body">
      <Transition name="ui-pop">
        <div
          v-if="open"
          :id="tipId"
          ref="tip"
          class="ui-popup ui-help-tip"
          :class="{ 'ui-popup--above': placement === 'above' }"
          :style="style"
          role="tooltip"
        >
          <slot>{{ text }}</slot>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { nextFieldId } from '@/composables/useFieldAttrs'
import { useSettingsStore } from '@/stores/settings'

withDefaults(defineProps<{ text?: string; label?: string }>(), { text: undefined, label: 'Подсказка' })

const GAP = 8
const EDGE = 8

const settings = useSettingsStore()
const tipId = nextFieldId('ui-help-tip')
const button = ref<HTMLElement | null>(null)
const tip = ref<HTMLElement | null>(null)
const open = ref(false)
const placement = ref<'below' | 'above'>('below')
const style = ref<Record<string, string>>({ visibility: 'hidden' })

function position() {
  const anchor = button.value
  const bubble = tip.value
  if (!anchor || !bubble) return
  const rect = anchor.getBoundingClientRect()
  const width = bubble.offsetWidth
  const height = bubble.offsetHeight
  const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE)
  const below = window.innerHeight - rect.bottom - GAP - EDGE >= height || rect.top < height + GAP + EDGE
  placement.value = below ? 'below' : 'above'
  style.value = {
    left: `${left}px`,
    ...(below
      ? { top: `${rect.bottom + GAP}px`, bottom: 'auto' }
      : { bottom: `${window.innerHeight - rect.top + GAP}px`, top: 'auto' }),
  }
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node
  if (tip.value?.contains(target) || button.value?.contains(target)) return
  close()
}

function onScroll(event: Event) {
  if (event.target instanceof Node && tip.value?.contains(event.target)) return
  close()
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function listen() {
  document.addEventListener('pointerdown', onOutsidePointer, true)
  document.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', position)
}

function unlisten() {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', position)
}

async function toggle() {
  if (open.value) return close()
  open.value = true
  listen()
  await nextTick()
  position()
}

function close() {
  open.value = false
  style.value = { visibility: 'hidden' }
  unlisten()
}

watch(() => settings.showHints, (shown) => {
  if (!shown) close()
})

onBeforeUnmount(unlisten)
</script>
