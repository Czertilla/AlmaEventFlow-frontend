<template>
  <div class="ass">
    <div v-if="modelValue" class="ass-control ass-control--selected">
      <span class="ass-tile"><ion-icon :icon="locationOutline" /></span>
      <span class="ass-text">
        <span class="ass-title">{{ modelValue.name }}</span>
        <span class="ass-sub">Адрес</span>
      </span>
      <button type="button" class="ass-clear" aria-label="Выбрать другой адрес" @click="clear">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>

    <template v-else>
      <div class="ass-control">
        <ion-icon class="ass-search-icon" :icon="searchOutline" />
        <input
          v-model="query"
          type="text"
          class="ass-input"
          role="combobox"
          autocomplete="off"
          :placeholder="placeholder"
          :aria-expanded="open"
          :aria-controls="listId"
          :aria-activedescendant="active >= 0 ? geoOptionId(listId, active) : undefined"
          @focus="open = true"
          @blur="closeSoon"
          @keydown="onKeydown"
        />
        <ion-spinner v-if="searching" class="ass-spinner" name="crescent" />
      </div>

      <div v-if="open && query.trim()" class="ass-popover">
        <GeoResultList
          :id="listId"
          :results="results"
          :query="query"
          :searching="searching"
          :active-index="active"
          :address-actions="false"
          @pick="pick"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline, locationOutline, searchOutline } from 'ionicons/icons'
import { getAddressesGeoV1AddressesGet } from '@/api/generated/almaEventFlow'
import type { AddressRead } from '@/api/generated/almaEventFlow'
import GeoResultList from './GeoResultList.vue'
import { useComboNav } from '@/composables/useComboNav'
import { geoOptionId } from '@/composables/useGeoSearch'
import type { GeoResult } from '@/composables/useGeoSearch'

withDefaults(
  defineProps<{ modelValue: AddressRead | null; placeholder?: string }>(),
  { placeholder: 'Начните вводить адрес…' },
)
const emit = defineEmits<{ 'update:modelValue': [value: AddressRead | null] }>()

const listId = `ass-${Math.random().toString(36).slice(2, 8)}`
const query = ref('')
const open = ref(false)
const searching = ref(false)
const addresses = ref<AddressRead[]>([])
const results = computed<GeoResult[]>(() => addresses.value.map((item) => ({ kind: 'address', item })))
const { active, next, prev, reset } = useComboNav(computed(() => results.value.length))

let timer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

async function run() {
  const q = query.value.trim()
  const id = ++requestId
  if (!q) {
    addresses.value = []
    searching.value = false
    return
  }
  searching.value = true
  try {
    const res = await getAddressesGeoV1AddressesGet({ search: q, limit: 8 })
    if (id === requestId) addresses.value = res.data.items
  } catch {
    if (id === requestId) addresses.value = []
  } finally {
    if (id === requestId) searching.value = false
  }
}

watch(query, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(run, 300)
})

function pick(result: GeoResult) {
  if (result.kind !== 'address') return
  emit('update:modelValue', result.item)
  query.value = ''
  addresses.value = []
  open.value = false
  reset()
}

function clear() {
  emit('update:modelValue', null)
}

function closeSoon() {
  setTimeout(() => {
    open.value = false
    reset()
  }, 150)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    open.value = true
    next()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    prev()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const picked = results.value[active.value >= 0 ? active.value : 0]
    if (picked) pick(picked)
  } else if (event.key === 'Escape') {
    open.value = false
    reset()
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  requestId++
})
</script>

<style scoped>
.ass {
  position: relative;
}

.ass-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 8px 0 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ass-control:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

.ass-control--selected {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.ass-search-icon {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--ion-color-medium);
}

.ass-input {
  flex: 1;
  min-width: 0;
  padding: 12px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ion-text-color);
  font-family: inherit;
  font-size: 15px;
}

.ass-input::placeholder {
  color: var(--ion-color-step-400);
}

.ass-spinner {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-right: 4px;
}

.ass-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: 17px;
}

.ass-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 8px 0;
}

.ass-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ass-sub {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.ass-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 18px;
  cursor: pointer;
}

.ass-clear:hover,
.ass-clear:focus-visible {
  background: rgba(var(--ion-color-danger-rgb, 255, 71, 87), 0.1);
  color: var(--ion-color-danger);
  outline: none;
}

.ass-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 30;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--ion-border-color);
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
}
</style>
