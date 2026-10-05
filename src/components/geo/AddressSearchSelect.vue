<template>
  <div class="ass">
    <UiField :label="label" :float="!!modelValue" :filled="!!query">
      <template #prefix>
        <span v-if="modelValue" class="ass-tile"><ion-icon :icon="locationOutline" /></span>
        <ion-icon v-else :icon="searchOutline" />
      </template>

      <span v-if="modelValue" class="ass-text">
        <span class="ass-title">{{ modelValue.name }}</span>
        <span class="ass-sub">Адрес</span>
      </span>
      <input
        v-else
        v-model="query"
        type="text"
        class="ui-field-control"
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

      <template v-if="modelValue || searching" #suffix>
        <button v-if="modelValue" type="button" class="ui-icon-btn ui-icon-btn--danger" aria-label="Выбрать другой адрес" @click="clear">
          <ion-icon :icon="closeOutline" />
        </button>
        <ion-spinner v-else class="ass-spinner" name="crescent" />
      </template>
    </UiField>

    <div v-if="!modelValue && open && query.trim()" class="ass-popover">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline, locationOutline, searchOutline } from 'ionicons/icons'
import { getAddressesGeoV1AddressesGet } from '@/api/generated/almaEventFlow'
import type { AddressRead } from '@/api/generated/almaEventFlow'
import UiField from '@/components/common/UiField.vue'
import GeoResultList from './GeoResultList.vue'
import { useComboNav } from '@/composables/useComboNav'
import { geoOptionId } from '@/composables/useGeoSearch'
import type { GeoResult } from '@/composables/useGeoSearch'

withDefaults(
  defineProps<{ modelValue: AddressRead | null; label?: string; placeholder?: string }>(),
  { label: 'Адрес', placeholder: 'Начните вводить адрес…' },
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

.ass-spinner {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.ass-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: var(--fs-xl);
}

.ass-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: var(--field-h);
  padding: 6px 10px;
}

.ass-title {
  overflow: hidden;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ass-sub {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.ass-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 30;
  max-height: 300px;
  overflow-y: auto;
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-lg);
  background: var(--ion-card-background);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
}
</style>
