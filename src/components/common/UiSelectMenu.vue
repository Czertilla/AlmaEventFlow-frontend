<template>
  <Teleport to="body">
    <Transition name="ui-pop">
      <div
        v-if="open"
        :id="listboxId"
        ref="menuEl"
        class="ui-popup ui-select-menu"
        :class="{ 'ui-popup--above': placement === 'above' }"
        :style="style"
        role="listbox"
        @mousedown.prevent
      >
        <div
          v-for="(option, index) in options"
          :id="`${listboxId}-${index}`"
          :key="String(option.value)"
          :data-index="index"
          class="ui-option"
          :class="{
            'ui-option--active': index === activeIndex,
            'ui-option--selected': index === selectedIndex,
            'ui-option--disabled': option.disabled,
          }"
          role="option"
          :aria-selected="index === selectedIndex"
          :aria-disabled="option.disabled || undefined"
          @mousemove="onHover(index)"
          @click="onPick(index)"
        >
          <ion-icon v-if="option.icon" class="ui-option-icon" :icon="option.icon" />
          <span class="ui-option-label">{{ option.label }}</span>
          <ion-icon v-if="index === selectedIndex" class="ui-option-check" :icon="checkmarkOutline" />
        </div>
        <p v-if="!options.length" class="ui-option-empty">Нет вариантов</p>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts" generic="T">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { checkmarkOutline } from 'ionicons/icons'
import type { SelectOption } from '@/utils/selectOptions'

const props = withDefaults(
  defineProps<{
    open: boolean
    anchor: HTMLElement | null
    options: SelectOption<T>[]
    selectedIndex: number
    activeIndex: number
    listboxId: string
    minWidth?: number
    align?: 'start' | 'end'
    maxHeight?: number
  }>(),
  { minWidth: 0, align: 'start', maxHeight: 288 },
)

const emit = defineEmits<{
  choose: [index: number]
  hover: [index: number]
  close: []
}>()

const GAP = 6
const EDGE = 8

const menuEl = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({ visibility: 'hidden' })
const placement = ref<'below' | 'above'>('below')

function position() {
  const anchor = props.anchor
  const menu = menuEl.value
  if (!anchor || !menu) return
  const rect = anchor.getBoundingClientRect()
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  const width = Math.min(Math.max(rect.width, props.minWidth), viewportW - 2 * EDGE)
  let left = props.align === 'end' ? rect.right - width : rect.left
  left = Math.min(Math.max(left, EDGE), viewportW - width - EDGE)

  const natural = Math.min(menu.scrollHeight + 2, props.maxHeight)
  const spaceBelow = viewportH - rect.bottom - GAP - EDGE
  const spaceAbove = rect.top - GAP - EDGE
  const below = spaceBelow >= natural || spaceBelow >= spaceAbove
  placement.value = below ? 'below' : 'above'
  const room = Math.max(96, Math.min(props.maxHeight, below ? spaceBelow : spaceAbove))

  style.value = {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${room}px`,
    ...(below
      ? { top: `${rect.bottom + GAP}px`, bottom: 'auto' }
      : { bottom: `${viewportH - rect.top + GAP}px`, top: 'auto' }),
  }
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node
  if (menuEl.value?.contains(target) || props.anchor?.contains(target)) return
  emit('close')
}

function onViewportChange(event: Event) {
  if (event.target instanceof Node && menuEl.value?.contains(event.target)) return
  position()
}

function listen() {
  document.addEventListener('pointerdown', onOutsidePointer, true)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
}

function unlisten() {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      unlisten()
      style.value = { visibility: 'hidden' }
      return
    }
    listen()
    await nextTick()
    position()
    scrollToActive()
  },
  { immediate: true },
)

function scrollToActive() {
  menuEl.value?.querySelector(`[data-index="${props.activeIndex}"]`)?.scrollIntoView?.({ block: 'nearest' })
}

watch(() => props.activeIndex, () => nextTick(scrollToActive))

function onHover(index: number) {
  if (index !== props.activeIndex) emit('hover', index)
}

function onPick(index: number) {
  emit('choose', index)
}

onBeforeUnmount(unlisten)
</script>
