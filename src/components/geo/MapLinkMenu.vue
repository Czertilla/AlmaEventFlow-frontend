<template>
  <div ref="rootEl" class="mlm">
    <slot :toggle="toggle" :open="open" />
    <div v-if="open" class="mlm-menu" role="menu">
      <button v-if="search" type="button" class="mlm-item mlm-copy" role="menuitem" @click="copy">
        {{ copied ? 'Скопировано' : 'Скопировать адрес' }}
      </button>
      <a
        v-for="provider in providers"
        :key="provider.name"
        class="mlm-item"
        :href="provider.url"
        target="_blank"
        rel="noopener"
        role="menuitem"
        @click="close"
      >
        {{ provider.name }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { GeoPoint } from './GeoMap.vue'
import { buildMapProviders, buildSearchProviders } from '@/composables/useMapLinks'

const props = defineProps<{ point: GeoPoint | null; label?: string; search?: string | null }>()

const open = ref(false)
const copied = ref(false)
const rootEl = ref<HTMLElement>()

const providers = computed(() => {
  if (props.point) return buildMapProviders(props.point.lat, props.point.lon, props.label)
  return props.search ? buildSearchProviders(props.search) : []
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.search ?? '')
    copied.value = true
    setTimeout(() => {
      copied.value = false
      close()
    }, 900)
  } catch {
    close()
  }
}

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && rootEl.value && !rootEl.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.mlm {
  position: relative;
  display: inline-flex;
}

.mlm-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  min-width: 170px;
  padding: 6px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
}

.mlm-item {
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--ion-text-color);
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.mlm-copy {
  border: none;
  background: transparent;
  text-align: left;
}

.mlm-item:hover,
.mlm-item:focus-visible {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  outline: none;
}
</style>
