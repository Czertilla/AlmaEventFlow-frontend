<template>
  <div class="lf">
    <div class="lf-control" :class="{ 'lf-control--selected': !!modelValue }">
      <template v-if="modelValue">
        <span class="lf-tile"><ion-icon :icon="locationOutline" /></span>
        <span class="lf-value">
          <span class="lf-title">{{ locationLabel(modelValue) }}</span>
          <span v-if="subtitle" class="lf-sub">{{ subtitle }}</span>
        </span>
        <button
          v-if="modelValue.address"
          type="button"
          class="ui-icon-btn"
          aria-label="Создать локацию по этому адресу"
          @click="openModal({ address: modelValue.address })"
        >
          <ion-icon :icon="addOutline" />
        </button>
        <MapLinkMenu v-if="selectedPoint" :point="selectedPoint" :label="mapLinkLabel(modelValue)" v-slot="{ toggle }">
          <button type="button" class="ui-icon-btn" aria-label="Открыть на карте" @click="toggle">
            <ion-icon :icon="openOutline" />
          </button>
        </MapLinkMenu>
        <button type="button" class="ui-icon-btn ui-icon-btn--danger" aria-label="Убрать локацию" @click="clearValue">
          <ion-icon :icon="closeOutline" />
        </button>
      </template>

      <template v-else>
        <ion-icon class="lf-search-icon" :icon="searchOutline" />
        <input
          v-model="query"
          type="text"
          class="lf-input"
          role="combobox"
          autocomplete="off"
          :placeholder="placeholder"
          :disabled="resolving"
          :aria-expanded="showDropdown"
          :aria-controls="listId"
          :aria-activedescendant="active >= 0 ? geoOptionId(listId, active) : undefined"
          @focus="onFocus"
          @blur="closeSoon"
          @keydown="onKeydown"
        />
        <ion-spinner v-if="searching || resolving" class="lf-spinner" name="crescent" />
        <button v-if="query" type="button" class="ui-icon-btn" aria-label="Очистить" @click="clearQuery">
          <ion-icon :icon="closeOutline" />
        </button>
      </template>

      <button
        type="button"
        class="ui-icon-btn ui-icon-btn--primary"
        :class="{ 'ui-icon-btn--active': modalOpen }"
        aria-label="Выбрать на карте"
        :disabled="resolving"
        @click="openModal()"
      >
        <ion-icon :icon="mapOutline" />
      </button>
    </div>

    <div v-if="showDropdown" class="lf-popover">
      <GeoResultList
        :id="listId"
        :results="results"
        :query="query"
        :searching="searching"
        :active-index="active"
        :show-create="canCreate"
        @pick="pick"
        @create-from-address="openModal({ address: $event })"
        @create-named="openModal({ name: $event })"
      />
    </div>

    <LocationPickerModal
      v-model:open="modalOpen"
      :selected="modelValue"
      :seed-query="modalSeed"
      :draft="modalDraft"
      @select="select"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { addOutline, closeOutline, locationOutline, mapOutline, openOutline, searchOutline } from 'ionicons/icons'
import GeoResultList from './GeoResultList.vue'
import LocationPickerModal from './LocationPickerModal.vue'
import MapLinkMenu from './MapLinkMenu.vue'
import type { GeoPoint } from './GeoMap.vue'
import type { LocationRead } from '@/api/generated/almaEventFlow'
import { useComboNav } from '@/composables/useComboNav'
import { useLocationResolver } from '@/composables/useLocationResolver'
import { canOfferCreate, geoOptionId, locationLabel, mapLinkLabel, useGeoSearch } from '@/composables/useGeoSearch'
import type { GeoResult, LocationDraft } from '@/composables/useGeoSearch'

const props = withDefaults(
  defineProps<{ modelValue: LocationRead | null; placeholder?: string }>(),
  { placeholder: 'Локация или адрес' },
)
const emit = defineEmits<{ 'update:modelValue': [value: LocationRead | null] }>()

const listId = `lf-${Math.random().toString(36).slice(2, 8)}`
const { query, results, searching, clear, refresh } = useGeoSearch({ limit: 8 })
const { resolving, resolve } = useLocationResolver()

const dropdownOpen = ref(false)
const modalOpen = ref(false)
const modalDraft = ref<LocationDraft | null>(null)
const modalSeed = ref('')

const canCreate = computed(() => canOfferCreate(results.value, query.value))
const optionCount = computed(() => results.value.length + (canCreate.value ? 1 : 0))
const { active, next, prev, reset } = useComboNav(optionCount)

const showDropdown = computed(
  () => !props.modelValue && dropdownOpen.value && (!!query.value.trim() || results.value.length > 0 || searching.value),
)
const selectedPoint = computed<GeoPoint | null>(() => {
  const point = props.modelValue?.spot ?? props.modelValue?.address?.spot
  return point ? { lat: point.lat, lon: point.lon } : null
})
const subtitle = computed(() => {
  const location = props.modelValue
  if (!location) return ''
  if (location.name && location.address) return location.address.name
  return location.address ? '' : 'Точка на карте'
})

function onFocus() {
  dropdownOpen.value = true
  if (!query.value.trim()) refresh()
}

function closeSoon() {
  setTimeout(() => {
    dropdownOpen.value = false
    reset()
  }, 150)
}

function resetSearch() {
  dropdownOpen.value = false
  clear()
  reset()
}

async function pick(result: GeoResult) {
  const location = await resolve(result)
  if (!location) return
  resetSearch()
  emit('update:modelValue', location)
}

function select(location: LocationRead) {
  resetSearch()
  emit('update:modelValue', location)
}

function openModal(draft: LocationDraft | null = null) {
  modalDraft.value = draft
  modalSeed.value = draft ? '' : query.value
  dropdownOpen.value = false
  modalOpen.value = true
}

function clearQuery() {
  clear()
  reset()
  refresh()
}

function clearValue() {
  emit('update:modelValue', null)
  resetSearch()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    dropdownOpen.value = true
    next()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    prev()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (!showDropdown.value) return
    const index = active.value >= 0 ? active.value : 0
    if (index < results.value.length) pick(results.value[index])
    else if (canCreate.value) openModal({ name: query.value.trim() })
  } else if (event.key === 'Escape') {
    dropdownOpen.value = false
    reset()
  }
}

defineExpose({ reset: clearValue })
</script>

<style scoped>
.lf {
  position: relative;
  width: 100%;
}

.lf-control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 6px 0 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.lf-control:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

.lf-control--selected {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.lf-search-icon {
  flex-shrink: 0;
  font-size: var(--fs-xl);
  color: var(--ion-color-medium);
}

.lf-input {
  flex: 1;
  min-width: 0;
  padding: 12px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ion-text-color);
  font-size: var(--fs-md);
}

.lf-input::placeholder {
  color: var(--ion-color-step-400);
}

.lf-spinner {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.lf-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(var(--ion-color-primary-rgb), 0.14);
  color: var(--ion-color-primary);
  font-size: var(--fs-xl);
}

.lf-value {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 8px 0;
}

.lf-title {
  overflow: hidden;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  line-height: 1.3;
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lf-sub {
  overflow: hidden;
  font-size: var(--fs-xs);
  line-height: 1.3;
  color: var(--ion-color-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lf-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 40;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
}
</style>
