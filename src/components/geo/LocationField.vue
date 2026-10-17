<template>
  <div ref="root" class="lf" @focusout="onFocusOut">
    <UiField :label="label" :float="!!modelValue" :filled="!!query">
      <template #prefix>
        <span v-if="modelValue" class="lf-tile"><ion-icon :icon="valueIcon" /></span>
        <ion-icon v-else :icon="searchOutline" />
      </template>

      <span v-if="modelValue" class="lf-value">
        <span class="lf-title">{{ locationLabel(modelValue) }}</span>
        <span v-if="subtitle" class="lf-sub">{{ subtitle }}</span>
      </span>
      <input
        v-else
        v-model="query"
        type="text"
        class="ui-field-control"
        role="combobox"
        autocomplete="off"
        :placeholder="placeholder"
        :disabled="resolving"
        :aria-expanded="showDropdown"
        :aria-controls="listId"
        :aria-activedescendant="active >= 0 ? geoOptionId(listId, active) : undefined"
        @focus="onFocus"
        @keydown="onKeydown"
      />

      <template #suffix>
        <template v-if="modelValue">
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
          <MapLinkMenu v-else-if="searchText" :point="null" :search="searchText" v-slot="{ toggle }">
            <button type="button" class="ui-icon-btn" aria-label="Скопировать адрес или найти его в картах" @click="toggle">
              <ion-icon :icon="openOutline" />
            </button>
          </MapLinkMenu>
          <button type="button" class="ui-icon-btn ui-icon-btn--danger" aria-label="Убрать локацию" @click="clearValue">
            <ion-icon :icon="closeOutline" />
          </button>
        </template>
        <template v-else>
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
      </template>
    </UiField>

    <div v-if="showDropdown" class="lf-popover">
      <AddressActionCard
        v-if="pickedAddress"
        :address="pickedAddress"
        :busy="resolving"
        @use="useAddress"
        @create="openModal({ address: pickedAddress })"
        @cancel="pickedAddress = null"
      />
      <GeoResultList
        v-else
        :id="listId"
        :results="results"
        :query="query"
        :searching="searching"
        :active-index="active"
        :show-create="canCreate"
        @pick="pick"
        @create-from-address="openModal({ address: $event })"
        @create-named="openModal({ name: $event })"
        @use-text="useText"
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
import { computed, ref, watch } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { addOutline, closeOutline, homeOutline, locationOutline, mapOutline, openOutline, searchOutline } from 'ionicons/icons'
import UiField from '@/components/common/UiField.vue'
import AddressActionCard from './AddressActionCard.vue'
import GeoResultList from './GeoResultList.vue'
import LocationPickerModal from './LocationPickerModal.vue'
import MapLinkMenu from './MapLinkMenu.vue'
import type { GeoPoint } from './GeoMap.vue'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import { useComboNav } from '@/composables/useComboNav'
import { useLocationResolver } from '@/composables/useLocationResolver'
import { isAddressOnly, isTextOnly } from '@/utils/geo'
import {
  addressLocality,
  canOfferCreate,
  geoOptionId,
  locationLabel,
  locationSearchText,
  mapLinkLabel,
  useGeoSearch,
} from '@/composables/useGeoSearch'
import type { GeoResult, LocationDraft } from '@/composables/useGeoSearch'

const props = withDefaults(
  defineProps<{ modelValue: LocationRead | null; label?: string; placeholder?: string }>(),
  { label: 'Локация', placeholder: 'Локация или адрес' },
)
const emit = defineEmits<{ 'update:modelValue': [value: LocationRead | null] }>()

const listId = `lf-${Math.random().toString(36).slice(2, 8)}`
const { query, results, searching, clear, refresh } = useGeoSearch({ limit: 8 })
const { resolving, resolve, resolveText } = useLocationResolver()

const root = ref<HTMLElement>()
const dropdownOpen = ref(false)
const pickedAddress = ref<AddressRead | null>(null)
const modalOpen = ref(false)
const modalDraft = ref<LocationDraft | null>(null)
const modalSeed = ref('')

const canCreate = computed(() => canOfferCreate(results.value, query.value))
const optionCount = computed(() => results.value.length + (canCreate.value ? 2 : 0))
const { active, next, prev, reset } = useComboNav(optionCount)

const showDropdown = computed(
  () =>
    !props.modelValue &&
    dropdownOpen.value &&
    (!!pickedAddress.value || !!query.value.trim() || results.value.length > 0 || searching.value),
)
const selectedPoint = computed<GeoPoint | null>(() => {
  const point = props.modelValue?.spot ?? props.modelValue?.address?.spot
  return point ? { lat: point.lat, lon: point.lon } : null
})
const addressOnly = computed(() => !!props.modelValue && isAddressOnly(props.modelValue))
const textOnly = computed(() => !!props.modelValue && isTextOnly(props.modelValue))
const searchText = computed(() => (props.modelValue ? locationSearchText(props.modelValue) : null))
const valueIcon = computed(() => (addressOnly.value ? homeOutline : locationOutline))
const subtitle = computed(() => {
  const location = props.modelValue
  if (!location) return ''
  if (textOnly.value) return 'Адрес текстом, без карты'
  if (addressOnly.value) return addressLocality(location.address) || 'Адрес'
  if (location.name && location.address) return location.address.name
  return 'Точка на карте'
})

function onFocus() {
  dropdownOpen.value = true
  if (!query.value.trim()) refresh()
}

watch(query, () => {
  pickedAddress.value = null
})

function closeSoon() {
  setTimeout(() => {
    dropdownOpen.value = false
    pickedAddress.value = null
    reset()
  }, 150)
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && root.value?.contains(next)) return
  closeSoon()
}

function resetSearch() {
  dropdownOpen.value = false
  pickedAddress.value = null
  clear()
  reset()
}

function pick(result: GeoResult) {
  if (result.kind === 'address') {
    pickedAddress.value = result.item
    dropdownOpen.value = true
    return
  }
  resetSearch()
  emit('update:modelValue', result.item)
}

async function useAddress() {
  const address = pickedAddress.value
  if (!address) return
  const location = await resolve({ kind: 'address', item: address })
  if (!location) return
  resetSearch()
  emit('update:modelValue', location)
}

async function useText(text: string) {
  const location = await resolveText(text)
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
  pickedAddress.value = null
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
    if (!showDropdown.value || pickedAddress.value) return
    const index = active.value >= 0 ? active.value : 0
    if (index < results.value.length) pick(results.value[index])
    else if (canCreate.value && index === results.value.length + 1) useText(query.value)
    else if (canCreate.value) openModal({ name: query.value.trim() })
  } else if (event.key === 'Escape') {
    if (pickedAddress.value) {
      pickedAddress.value = null
      return
    }
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
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.14);
  color: var(--ion-color-primary);
  font-size: var(--fs-xl);
}

.lf-value {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: var(--field-h);
  padding: 6px 10px;
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
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-lg);
  background: var(--ion-card-background);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
}
</style>
