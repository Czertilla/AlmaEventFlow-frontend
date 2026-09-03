<template>
  <div class="loc-field">
    <!-- Выбрана локация -->
    <div v-if="modelValue" class="loc-chip loc-chip--location">
      <LocationDisplay :location="modelValue" />
      <button class="loc-chip-clear" aria-label="Убрать локацию" @click="clearAll">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>

    <!-- Выбран адрес, локация ещё не создана -->
    <div v-else-if="pendingAddress" class="loc-chip loc-chip--address">
      <ion-icon :icon="locationOutline" />
      <span class="loc-chip-label">{{ pendingAddress.name }}</span>
      <span class="loc-chip-kind">адрес</span>
      <button class="loc-chip-action" :disabled="creating" @click="createFromPendingAddress">
        <ion-spinner v-if="creating" name="crescent" />
        <template v-else>
          <ion-icon :icon="addCircleOutline" />
          Создать локацию
        </template>
      </button>
      <button class="loc-chip-clear" aria-label="Сбросить" @click="clearAll">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>

    <!-- Поиск -->
    <div v-else class="loc-combo">
      <div class="loc-input-wrap">
        <ion-icon class="loc-input-icon" :icon="searchOutline" />
        <input
          v-model="search"
          type="text"
          class="native-input loc-input"
          :placeholder="placeholder"
          @focus="dropdownOpen = true"
          @blur="onBlur"
        />
        <button
          type="button"
          class="loc-map-btn"
          :class="{ 'loc-map-btn--active': mapOpen }"
          aria-label="Открыть карту"
          @click="openMap"
        >
          <ion-icon :icon="mapOutline" />
        </button>
      </div>

      <div v-if="dropdownOpen && search" class="loc-suggestions">
        <button
          v-for="r in results"
          :key="`${r.kind}-${r.item.id}`"
          class="loc-suggestion"
          @mousedown.prevent="pickResult(r)"
        >
          <ion-icon
            class="loc-suggestion-icon"
            :class="`loc-suggestion-icon--${r.kind}`"
            :icon="r.kind === 'location' ? starOutline : locationOutline"
          />
          <span class="loc-suggestion-name">{{ resultLabel(r) }}</span>
          <span class="loc-suggestion-kind">{{ r.kind === 'location' ? 'локация' : 'адрес' }}</span>
        </button>
        <p v-if="!searching && results.length === 0" class="loc-suggestions-empty">Ничего не найдено</p>
      </div>
    </div>

    <!-- Карта: тот же поиск + метки найденных точек + создание новой локации кликом -->
    <ion-modal :is-open="mapOpen" @ion-modal-did-dismiss="mapOpen = false" @did-present="onMapPresented">
      <ion-header>
        <ion-toolbar>
          <ion-title>Локация на карте</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="mapOpen = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
        <ion-toolbar>
          <ion-searchbar v-model="search" placeholder="Поиск локации или адреса..." />
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div v-if="search && results.length" class="loc-map-suggestions">
          <button
            v-for="r in results"
            :key="`m-${r.kind}-${r.item.id}`"
            class="loc-suggestion"
            @click="pickResult(r)"
          >
            <ion-icon
              class="loc-suggestion-icon"
              :class="`loc-suggestion-icon--${r.kind}`"
              :icon="r.kind === 'location' ? starOutline : locationOutline"
            />
            <span class="loc-suggestion-name">{{ resultLabel(r) }}</span>
            <span class="loc-suggestion-kind">{{ r.kind === 'location' ? 'локация' : 'адрес' }}</span>
          </button>
        </div>

        <GeoMap
          ref="geoMapRef"
          pickable
          :markers="mapMarkers"
          :picked-point="pendingPoint"
          :center="mapCenter"
          class="loc-map"
          @pick="onMapPick"
          @marker-click="onMarkerClick"
        />

        <div v-if="pendingPoint" class="loc-new-card">
          <ion-input v-model="pendingName" placeholder="Название локации (необязательно)" mode="md" />
          <div class="loc-new-actions">
            <ion-button fill="outline" size="small" @click="pendingPoint = null">Отмена</ion-button>
            <ion-button size="small" :disabled="creating" @click="createFromPoint">
              <ion-spinner v-if="creating" slot="start" name="crescent" />
              Создать локацию здесь
            </ion-button>
          </div>
        </div>
        <p v-else class="loc-map-hint">
          Кликните по метке, чтобы выбрать, или по свободному месту на карте, чтобы создать новую локацию.
        </p>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  IonIcon, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonSearchbar, IonContent, IonInput, IonSpinner,
} from '@ionic/vue'
import {
  closeOutline, searchOutline, mapOutline, starOutline, locationOutline, addCircleOutline,
} from 'ionicons/icons'
import GeoMap from './GeoMap.vue'
import type { GeoPoint, MapMarker } from './GeoMap.vue'
import LocationDisplay from './LocationDisplay.vue'
import {
  getLocationsGeoV1LocationsGet,
  getAddressesGeoV1AddressesGet,
  createLocationFromAddressGeoV1LocationsFromAddressPost,
  createLocationGeoV1LocationsPost,
} from '@/api/generated/almaEventFlow'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'

type ResultItem =
  | { kind: 'location'; item: LocationRead }
  | { kind: 'address'; item: AddressRead }

withDefaults(
  defineProps<{ modelValue: LocationRead | null; placeholder?: string }>(),
  { placeholder: 'Локация или адрес...' },
)
const emit = defineEmits<{ 'update:modelValue': [value: LocationRead | null] }>()

const { showError } = useToast()

const search = ref('')
const dropdownOpen = ref(false)
const mapOpen = ref(false)
const results = ref<ResultItem[]>([])
const searching = ref(false)
const creating = ref(false)
const pendingAddress = ref<AddressRead | null>(null)
const pendingPoint = ref<GeoPoint | null>(null)
const pendingName = ref('')
const geoMapRef = ref<InstanceType<typeof GeoMap>>()

function resultLabel(r: ResultItem): string {
  return r.kind === 'location' ? (r.item.name || r.item.address?.name || 'Без названия') : r.item.name
}

async function runSearch() {
  const q = search.value.trim()
  if (!q) {
    results.value = []
    return
  }
  searching.value = true
  try {
    const [locRes, addrRes] = await Promise.all([
      getLocationsGeoV1LocationsGet({ search: q, limit: 8 }),
      getAddressesGeoV1AddressesGet({ search: q, limit: 8 }),
    ])
    results.value = [
      ...locRes.data.items.map((item) => ({ kind: 'location' as const, item })),
      ...addrRes.data.items.map((item) => ({ kind: 'address' as const, item })),
    ]
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(runSearch, 300)
})

const mapMarkers = computed<MapMarker[]>(() => {
  const out: MapMarker[] = []
  for (const r of results.value) {
    if (r.kind === 'address') {
      if (!r.item.spot) continue
      out.push({ id: r.item.id, kind: 'address', lat: r.item.spot.lat, lon: r.item.spot.lon, label: r.item.name })
    } else {
      const point = r.item.spot || r.item.address?.spot
      if (!point) continue
      out.push({ id: r.item.id, kind: 'location', lat: point.lat, lon: point.lon, label: r.item.name || r.item.address?.name || 'Без названия' })
    }
  }
  return out
})

const mapCenter = computed<GeoPoint | undefined>(() => {
  const first = mapMarkers.value[0]
  return first ? { lat: first.lat, lon: first.lon } : undefined
})

function onBlur() {
  setTimeout(() => { dropdownOpen.value = false }, 150)
}

function openMap() {
  mapOpen.value = true
  dropdownOpen.value = false
}

async function onMapPresented() {
  await nextTick()
  geoMapRef.value?.invalidateSize()
}

function pickResult(r: ResultItem) {
  dropdownOpen.value = false
  mapOpen.value = false
  search.value = ''
  results.value = []
  pendingPoint.value = null
  pendingName.value = ''
  if (r.kind === 'location') {
    pendingAddress.value = null
    emit('update:modelValue', r.item)
  } else {
    emit('update:modelValue', null)
    pendingAddress.value = r.item
  }
}

function onMarkerClick(marker: MapMarker) {
  const r = results.value.find((r) => r.kind === marker.kind && r.item.id === marker.id)
  if (r) pickResult(r)
}

function onMapPick(point: GeoPoint) {
  pendingPoint.value = point
  pendingName.value = ''
}

async function createFromPendingAddress() {
  if (!pendingAddress.value) return
  creating.value = true
  try {
    const res = await createLocationFromAddressGeoV1LocationsFromAddressPost({
      address_id: pendingAddress.value.id,
      name: null,
    })
    pendingAddress.value = null
    emit('update:modelValue', res.data)
  } catch (err) {
    showError(err, 'Не удалось создать локацию')
  } finally {
    creating.value = false
  }
}

async function createFromPoint() {
  if (!pendingPoint.value) return
  creating.value = true
  try {
    const res = await createLocationGeoV1LocationsPost({
      name: pendingName.value || null,
      spot: pendingPoint.value,
    })
    pendingPoint.value = null
    pendingName.value = ''
    mapOpen.value = false
    emit('update:modelValue', res.data)
  } catch (err) {
    showError(err, 'Не удалось создать локацию')
  } finally {
    creating.value = false
  }
}

function clearAll() {
  emit('update:modelValue', null)
  pendingAddress.value = null
  search.value = ''
  results.value = []
  dropdownOpen.value = false
  mapOpen.value = false
  pendingPoint.value = null
  pendingName.value = ''
}

defineExpose({ reset: clearAll })
</script>

<style scoped>
.loc-field {
  position: relative;
  width: 100%;
}

.loc-combo {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.loc-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.loc-input-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: var(--ion-color-medium);
  pointer-events: none;
}

.loc-input {
  padding-left: 36px;
  padding-right: 44px;
  width: 100%;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  padding-top: 10px;
  padding-bottom: 10px;
  outline: none;
  transition: border-color 0.15s;
}

.loc-input:focus {
  border-color: var(--ion-color-primary);
}

.loc-map-btn {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.loc-map-btn:hover,
.loc-map-btn--active {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.loc-suggestions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 6px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--ion-card-background);
}

.loc-suggestion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.loc-suggestion:hover {
  background: var(--ion-background-color);
}

.loc-suggestion-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.loc-suggestion-icon--location {
  color: var(--ion-color-primary);
}

.loc-suggestion-icon--address {
  color: var(--ion-color-medium);
}

.loc-suggestion-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loc-suggestion-kind {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

.loc-suggestions-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.loc-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  font-size: 14px;
}

.loc-chip--address {
  border-color: var(--ion-color-medium);
  background: var(--ion-background-color);
}

.loc-chip--address > ion-icon:first-child {
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.loc-chip-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.loc-chip-kind {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  flex-shrink: 0;
}

.loc-chip-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.loc-chip-action:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.loc-chip-action ion-spinner {
  width: 14px;
  height: 14px;
}

.loc-chip-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.loc-chip-clear:hover {
  color: var(--ion-color-danger);
}

.loc-map-suggestions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-bottom: 1px solid var(--ion-border-color);
}

.loc-map {
  height: 50vh;
  min-height: 320px;
}

.loc-new-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
}

.loc-new-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.loc-map-hint {
  margin: 0;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--ion-color-medium);
}
</style>
