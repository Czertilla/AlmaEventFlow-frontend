<template>
  <nav ref="navRef" class="sliding-tabs" role="tablist">
    <span
      class="sliding-tabs-pill"
      :class="{ 'sliding-tabs-pill--visible': pill.visible, 'sliding-tabs-pill--animated': animated }"
      :style="{ width: `${pill.width}px`, transform: `translateX(${pill.left}px)` }"
      aria-hidden="true"
    />
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :ref="(el) => setTabRef(tab.key, el)"
      type="button"
      role="tab"
      class="sliding-tab"
      :class="{
        'sliding-tab--active': modelValue === tab.key,
        'sliding-tab--invalid': tab.invalid,
        'sliding-tab--shake': shake?.includes(tab.key),
      }"
      :aria-selected="modelValue === tab.key"
      @click="emit('update:modelValue', tab.key)"
    >
      <ion-icon v-if="tab.icon" :icon="tab.icon" />
      {{ tab.label }}
      <span v-if="tab.badge" class="sliding-tab-badge" :aria-label="`Изменено: ${tab.badge}`">{{ tab.badge }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance } from 'vue'
import { IonIcon } from '@ionic/vue'

export interface SlidingTab {
  key: string
  label: string
  icon?: string
  /** Число рядом с названием, например сколько полей изменено */
  badge?: number
  /** Вкладка требует внимания: подписана красным */
  invalid?: boolean
}

const props = defineProps<{
  tabs: SlidingTab[]
  modelValue: string
  /** Вкладки, которые сейчас вздрагивают */
  shake?: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [key: string] }>()

const navRef = ref<HTMLElement>()
const tabEls = new Map<string, HTMLElement>()
const pill = reactive({ left: 0, width: 0, visible: false })
// Первая раскладка ставит пилюлю на место без перехода, иначе она «выезжала» бы из нуля
const animated = ref(false)

function setTabRef(key: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) tabEls.set(key, el)
  else tabEls.delete(key)
}

function revealActive(nav: HTMLElement, tab: HTMLElement) {
  const margin = 8
  const left = tab.offsetLeft - margin
  const right = tab.offsetLeft + tab.offsetWidth + margin
  if (left < nav.scrollLeft) nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: right - nav.clientWidth, behavior: 'smooth' })
}

function measure() {
  const nav = navRef.value
  const tab = tabEls.get(props.modelValue)
  if (!nav || nav.offsetWidth === 0) return
  if (!tab) {
    pill.visible = false
    return
  }
  pill.left = tab.offsetLeft
  pill.width = tab.offsetWidth
  pill.visible = true
  revealActive(nav, tab)
}

let observer: ResizeObserver | undefined

onMounted(async () => {
  await nextTick()
  measure()
  requestAnimationFrame(() => { animated.value = true })
  if (typeof ResizeObserver === 'undefined' || !navRef.value) return
  observer = new ResizeObserver(measure)
  observer.observe(navRef.value)
  for (const el of tabEls.values()) observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => props.modelValue, measure, { flush: 'post' })
</script>

<style scoped>
.sliding-tabs {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  overflow-x: auto;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}

.sliding-tabs::-webkit-scrollbar {
  display: none;
}

/* Вкладки часто не помещаются на мобильном и скроллятся вбок без скроллбара:
   затухание справа подсказывает, что за краем есть ещё. */
@media (max-width: 767px) {
  .sliding-tabs {
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
    mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
  }
}

.sliding-tabs-pill {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  opacity: 0;
  pointer-events: none;
}

.sliding-tabs-pill--visible {
  opacity: 1;
}

.sliding-tabs-pill--animated {
  transition:
    transform 0.32s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.32s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.15s;
}

.sliding-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s;
}

.sliding-tab ion-icon {
  font-size: var(--fs-lg);
}

.sliding-tab:hover {
  color: var(--ion-text-color);
}

.sliding-tab--active,
.sliding-tab--active:hover {
  color: var(--ion-color-primary);
}

.sliding-tab--invalid,
.sliding-tab--invalid:hover,
.sliding-tab--invalid.sliding-tab--active {
  color: var(--ion-color-danger);
}

.sliding-tab-badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--ion-color-primary);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-bold);
  line-height: 18px;
  color: var(--ion-color-primary-contrast);
  text-align: center;
}

.sliding-tab--invalid .sliding-tab-badge {
  background: var(--ion-color-danger);
}

.sliding-tab--shake {
  animation: sliding-tab-shake 0.5s;
}

@keyframes sliding-tab-shake {
  0%, 100% { transform: translateX(0); }
  15%, 45%, 75% { transform: translateX(-4px); }
  30%, 60%, 90% { transform: translateX(4px); }
}

@media (prefers-reduced-motion: reduce) {
  .sliding-tabs-pill--animated {
    transition: none;
  }

  .sliding-tab--shake {
    animation: none;
  }
}
</style>
