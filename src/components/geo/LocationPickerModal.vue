<template>
  <ion-modal class="loc-modal" :is-open="open" @ion-modal-did-dismiss="close" @did-present="onPresented">
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons v-if="view === 'create'" slot="start">
          <ion-button aria-label="Назад" @click="cancelCreate">
            <ion-icon slot="icon-only" :icon="arrowBackOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ view === 'create' ? 'Новая локация' : 'Выбор места' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Закрыть" @click="close">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :scroll-y="view === 'create'">
      <div v-if="view === 'browse'" class="pm-stage">
        <GeoMap
          ref="geoMapRef"
          class="pm-map"
          pickable
          :fit="fitResults"
          :markers="mapMarkers"
          :picked-point="pendingPoint"
          :center="focusPoint"
          @pick="onPick"
          @marker-click="onMarkerClick"
          @marker-create="onMarkerCreate"
          @interact="onMapTouched"
          @bbox="onBbox"
        />

        <div class="pm-top">
          <div class="pm-search">
            <ion-icon class="pm-search-icon" :icon="searchOutline" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              class="pm-search-input"
              role="combobox"
              autocomplete="off"
              placeholder="Поиск локации или адреса"
              aria-expanded="true"
              aria-controls="pm-list"
              :aria-activedescendant="active >= 0 ? geoOptionId('pm-list', active) : undefined"
              @focus="panelCollapsed = false"
              @keydown="onKeydown"
            />
            <ion-spinner v-if="searching || resolving" class="pm-spinner" name="crescent" />
            <button
              v-if="results.length > 0"
              type="button"
              class="pm-search-toggle"
              :aria-label="panelCollapsed ? 'Показать список результатов' : 'Скрыть список и посмотреть карту'"
              @click="panelCollapsed = !panelCollapsed"
            >
              <ion-icon :icon="panelCollapsed ? chevronDownOutline : chevronUpOutline" />
            </button>
            <button v-if="query" type="button" class="pm-search-clear" aria-label="Очистить поиск" @click="clearQuery">
              <ion-icon :icon="closeOutline" />
            </button>
          </div>

          <div v-if="showPanel" class="pm-panel">
            <GeoResultList
              id="pm-list"
              :results="results"
              :query="query"
              :searching="searching"
              :active-index="active"
              :from="query.trim() ? null : near"
              :heading="showingRecent ? 'Недавние места' : ''"
              :show-create="canCreate"
              @pick="pick"
              @create-from-address="startCreate({ address: $event })"
              @create-named="startCreate({ name: $event })"
              @use-text="useText"
            />
          </div>
        </div>

        <div class="pm-bottom">
          <div v-if="pendingPoint" class="pm-card" role="dialog" aria-label="Новая точка на карте">
            <div class="pm-card-text">
              <span class="pm-card-title">Точка на карте</span>
              <span class="pm-card-sub">{{ pendingPoint.lat.toFixed(5) }}, {{ pendingPoint.lon.toFixed(5) }}</span>
            </div>
            <button type="button" class="pm-btn pm-btn--ghost" @click="cancelPending">Отмена</button>
            <button type="button" class="pm-btn pm-btn--primary" @click="startCreate({ spot: pendingPoint })">
              Создать локацию
            </button>
          </div>
          <div v-else-if="pickedAddress" class="pm-card pm-card--address">
            <AddressActionCard
              :address="pickedAddress"
              :busy="resolving"
              @use="useAddress"
              @create="startCreate({ address: pickedAddress })"
              @cancel="cancelAddress"
            />
          </div>
          <p v-else-if="results.length === 0 && !searching && !query.trim()" class="pm-hint">
            Введите адрес или поставьте метку на карте
          </p>
        </div>
      </div>

      <LocationCreateForm v-else :draft="createDraft" @created="finish" @cancel="cancelCreate" />
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon, IonSpinner,
} from '@ionic/vue'
import {
  arrowBackOutline,
  chevronDownOutline,
  chevronUpOutline,
  closeOutline,
  searchOutline,
} from 'ionicons/icons'
import GeoMap from './GeoMap.vue'
import type { GeoPoint, MapBBox, MapMarker } from './GeoMap.vue'
import AddressActionCard from './AddressActionCard.vue'
import GeoResultList from './GeoResultList.vue'
import LocationCreateForm from './LocationCreateForm.vue'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import { useComboNav } from '@/composables/useComboNav'
import { useLocationResolver } from '@/composables/useLocationResolver'
import { recentLoader } from '@/composables/useRecentLocations'
import {
  addressLocality,
  canOfferCreate,
  geoOptionId,
  locationMarker,
  useGeoSearch,
} from '@/composables/useGeoSearch'
import type { GeoResult, LocationDraft } from '@/composables/useGeoSearch'
import { distanceMeters } from '@/utils/geo'

/** A pan shorter than this does not ask for the places around the new centre again. */
const FOLLOW_THRESHOLD_M = 150

const props = defineProps<{
  open: boolean
  selected: LocationRead | null
  seedQuery: string
  draft: LocationDraft | null
  /** Whose events' places are offered first: the collective the event is made for. */
  collectiveId?: string | null
}>()
const emit = defineEmits<{ 'update:open': [value: boolean]; select: [location: LocationRead] }>()

const { query, near, marked, results, place, searching, showingRecent, markers, clear, refresh } = useGeoSearch({
  limit: 30,
  recent: recentLoader(() => props.collectiveId),
})
const { resolving, resolve, resolveText } = useLocationResolver()

const view = ref<'browse' | 'create'>('browse')
const createDraft = ref<LocationDraft>({})
const cameFromBrowse = ref(false)
const pendingPoint = ref<GeoPoint | null>(null)
const pickedAddress = ref<AddressRead | null>(null)
const mapCenter = ref<GeoPoint | null>(null)
const panelCollapsed = ref(false)
const mapMoved = ref(false)
const geoMapRef = ref<InstanceType<typeof GeoMap>>()
const searchInput = ref<HTMLInputElement>()

const canCreate = computed(() => canOfferCreate(results.value, query.value))
const optionCount = computed(() => results.value.length + (canCreate.value ? 2 : 0))
const showPanel = computed(
  () => !panelCollapsed.value && (results.value.length > 0 || (canCreate.value && !searching.value)),
)
const { active, next, prev, reset } = useComboNav(optionCount)

const selectedMarker = computed(() => (props.selected ? locationMarker(props.selected) : null))
const selectedPoint = computed<GeoPoint | undefined>(() =>
  selectedMarker.value ? { lat: selectedMarker.value.lat, lon: selectedMarker.value.lon } : undefined,
)
const fitResults = computed(() => !!query.value.trim() || showingRecent.value)
const placePoint = computed<GeoPoint | undefined>(() => {
  const found = place.value
  if (!found || !query.value.trim() || markers.value.length > 0) return undefined
  return { lat: found.lat, lon: found.lon }
})
const focusPoint = computed<GeoPoint | undefined>(() => {
  const spot = pickedAddress.value?.spot
  if (spot) return { lat: spot.lat, lon: spot.lon }
  return placePoint.value ?? selectedPoint.value
})
const mapMarkers = computed<MapMarker[]>(() => {
  const extra: MapMarker[] = []
  const selected = selectedMarker.value
  if (selected && !markers.value.some((m) => m.kind === 'location' && m.id === selected.id)) extra.push(selected)
  const address = pickedAddress.value
  if (address?.spot && !markers.value.some((m) => m.kind === 'address' && m.id === address.id)) {
    extra.push({
      id: address.id,
      kind: 'address',
      lat: address.spot.lat,
      lon: address.spot.lon,
      label: address.name,
      sublabel: addressLocality(address) || undefined,
    })
  }
  return extra.length ? [...markers.value, ...extra] : markers.value
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    pendingPoint.value = null
    pickedAddress.value = null
    mapCenter.value = null
    near.value = null
    marked.value = false
    cameFromBrowse.value = false
    panelCollapsed.value = false
    mapMoved.value = false
    createDraft.value = props.draft ?? {}
    view.value = props.draft ? 'create' : 'browse'
    query.value = props.seedQuery
    refresh()
  },
)

watch(query, (text) => {
  panelCollapsed.value = false
  if (!text.trim()) followMap()
})

function onMapTouched() {
  panelCollapsed.value = true
  mapMoved.value = true
}

function followMap() {
  const centre = mapCenter.value
  if (!mapMoved.value || !centre || query.value.trim() || pendingPoint.value || pickedAddress.value) return
  if (near.value && distanceMeters(near.value, centre) < FOLLOW_THRESHOLD_M) return
  near.value = centre
}

function onBbox(box: MapBBox) {
  mapCenter.value = { lat: (box.minLat + box.maxLat) / 2, lon: (box.minLon + box.maxLon) / 2 }
  followMap()
}

function cancelAddress() {
  pickedAddress.value = null
  followMap()
}

async function onPresented() {
  await nextTick()
  geoMapRef.value?.invalidateSize()
  geoMapRef.value?.refit()
  searchInput.value?.focus()
}

function close() {
  emit('update:open', false)
  clear()
  reset()
  pendingPoint.value = null
  pickedAddress.value = null
}

function finish(location: LocationRead) {
  emit('select', location)
  close()
}

function pick(result: GeoResult) {
  if (result.kind === 'location') {
    finish(result.item)
    return
  }
  pickedAddress.value = result.item
  pendingPoint.value = null
  marked.value = false
  panelCollapsed.value = true
  const spot = result.item.spot
  if (!query.value.trim() && spot) near.value = { lat: spot.lat, lon: spot.lon }
}

async function useAddress() {
  const address = pickedAddress.value
  if (!address) return
  const location = await resolve({ kind: 'address', item: address })
  if (location) finish(location)
}

function onPick(point: GeoPoint) {
  pendingPoint.value = point
  pickedAddress.value = null
  marked.value = true
  near.value = point
}

function cancelPending() {
  pendingPoint.value = null
  marked.value = false
  near.value = null
  followMap()
}

async function useText(text: string) {
  const location = await resolveText(text)
  if (location) finish(location)
}

function startCreate(draft: LocationDraft) {
  createDraft.value = draft
  cameFromBrowse.value = true
  pendingPoint.value = null
  pickedAddress.value = null
  marked.value = false
  near.value = null
  view.value = 'create'
}

function cancelCreate() {
  if (cameFromBrowse.value) {
    view.value = 'browse'
    nextTick(() => searchInput.value?.focus())
  } else {
    close()
  }
}

function clearQuery() {
  clear()
  reset()
  followMap()
  refresh()
  searchInput.value?.focus()
}

function findResult(marker: MapMarker): GeoResult | undefined {
  return results.value.find((r) => r.kind === marker.kind && r.item.id === marker.id)
}

function onMarkerClick(marker: MapMarker) {
  if (marker.kind === 'location' && marker.id === props.selected?.id) {
    close()
    return
  }
  const found = findResult(marker)
  if (found) pick(found)
}

function onMarkerCreate(marker: MapMarker) {
  const found = findResult(marker)
  if (found?.kind === 'address') startCreate({ address: found.item })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    panelCollapsed.value = false
    next()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    panelCollapsed.value = false
    prev()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const index = active.value >= 0 ? active.value : 0
    if (index < results.value.length) pick(results.value[index])
    else if (canCreate.value && index === results.value.length + 1) useText(query.value)
    else if (canCreate.value) startCreate({ name: query.value.trim() })
  } else if (event.key === 'Escape' && query.value) {
    clearQuery()
  }
}
</script>

<style>
ion-modal.loc-modal {
  --width: 100%;
  --height: 100%;
}

@media (min-width: 768px) and (min-height: 600px) {
  ion-modal.loc-modal {
    --width: 720px;
    --height: min(720px, 90vh);
    --border-radius: 20px;
  }
}
</style>

<style scoped>
.pm-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.pm-map {
  position: absolute;
  inset: 0;
  z-index: 0;
  min-height: 0;
  isolation: isolate;
}

.pm-top,
.pm-bottom {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 5;
  padding: 12px;
  pointer-events: none;
}

.pm-top {
  top: 0;
}

.pm-bottom {
  bottom: 0;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

.pm-search,
.pm-panel,
.pm-card,
.pm-hint {
  pointer-events: auto;
}

.pm-search {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 0 8px 0 14px;
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  transition: box-shadow 0.15s, border-color 0.15s;
}

.pm-search:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18), 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.18);
}

.pm-search-icon {
  flex-shrink: 0;
  font-size: var(--fs-xl);
  color: var(--ion-color-medium);
}

.pm-search-input {
  flex: 1;
  min-width: 0;
  padding: 13px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ion-text-color);
  font-size: var(--fs-lg);
}

.pm-search-input::placeholder {
  color: var(--ion-color-step-400);
}

.pm-spinner {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.pm-search-clear,
.pm-search-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: var(--fs-xl);
  cursor: pointer;
}

.pm-search-clear:hover,
.pm-search-clear:focus-visible,
.pm-search-toggle:hover,
.pm-search-toggle:focus-visible {
  background: rgba(var(--ion-text-color-rgb), 0.07);
  outline: none;
}

.pm-panel {
  max-height: min(52vh, 400px);
  margin-top: 8px;
  overflow-y: auto;
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  background: var(--ion-card-background);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.pm-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 12px 16px;
  border: 1px solid var(--ion-border-color);
  border-radius: 18px;
  background: var(--ion-card-background);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
}

.pm-card--address {
  display: block;
  padding: 0;
}

.pm-card-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.pm-card-title {
  font-size: var(--fs-md);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.pm-card-sub {
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-medium);
}

.pm-btn {
  min-height: 40px;
  padding: 0 16px;
  border: 1.5px solid transparent;
  border-radius: 12px;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s;
}

.pm-btn--ghost {
  border-color: var(--ion-border-color);
  background: transparent;
  color: var(--ion-text-color);
}

.pm-btn--primary {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.pm-btn--primary:hover {
  background: var(--ion-color-primary-shade);
}

.pm-hint {
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(var(--ion-background-color-rgb), 0.92);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  color: var(--ion-color-medium);
  font-size: var(--fs-xs);
  text-align: center;
  backdrop-filter: blur(6px);
}
</style>
