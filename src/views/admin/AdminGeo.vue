<template>
      <ion-segment v-model="activeTab">
        <ion-segment-button value="addresses">Адреса</ion-segment-button>
        <ion-segment-button value="locations">Места</ion-segment-button>
        <ion-segment-button value="map">Карта</ion-segment-button>
      </ion-segment>

      <div v-if="activeTab === 'addresses'" class="ion-padding-top">
        <ResourceTable
          ref="addressTableRef"

          :columns="addressColumns"
          :get-label="(a) => a.name || 'Адрес'"
          :get-subtitle="(a) => [a.parsed?.street, a.parsed?.house].filter(Boolean).join(', ')"
          :fetch-items="fetchAddresses"
          :sort-options="sortOptions"
          default-sort="name"
          add-label="Добавить"
          @add="openAddressCreate()"
          @edit="openAddressEdit"
          @delete="handleAddressDelete"
        />
      </div>

      <div v-else-if="activeTab === 'locations'" class="ion-padding-top">
        <ResourceTable
          ref="locationTableRef"

          :columns="locationColumns"
          :get-label="(l) => l.name || l.address?.name || 'Без названия'"
          :get-subtitle="(l) => l.address?.name || 'Своя точка'"
          :fetch-items="fetchLocations"
          :sort-options="sortOptions"
          default-sort="name"
          add-label="Добавить"
          @add="openLocationCreate()"
          @edit="openLocationEdit"
          @delete="handleLocationDelete"
        />
      </div>

      <div v-else class="ion-padding-top">
        <ion-searchbar v-model="mapQuery" placeholder="Найти адрес или место на карте..." class="map-search" />
        <GeoMap
          pickable
          :fit="!!mapQuery.trim()"
          :markers="visibleMarkers"
          :picked-point="pickedPoint"
          class="admin-map"
          @bbox="onMapBbox"
          @pick="pickedPoint = $event"
          @marker-click="onMapMarkerClick"
        />
        <div v-if="pickedPoint" class="pick-card">
          <span class="pick-coords">{{ pickedPoint.lat.toFixed(5) }}, {{ pickedPoint.lon.toFixed(5) }}</span>
          <ion-button size="small" @click="createAddressAtPoint">Новый адрес здесь</ion-button>
          <ion-button size="small" fill="outline" @click="createLocationAtPoint">Новое место здесь</ion-button>
          <ion-button size="small" fill="clear" color="medium" @click="pickedPoint = null">Отмена</ion-button>
        </div>
        <p v-else class="map-hint">
          Введите запрос — найденные адреса и места появятся на карте. Без запроса показываются объекты в видимой
          области. Клик по метке открывает форму редактирования, клик по свободному месту — создание нового объекта.
        </p>
      </div>

    <ion-modal :is-open="addressModal" @ion-modal-did-dismiss="addressModal = false">
      <ResourceFormModal
        v-if="addressModal"
        :title="isAddressCreating ? 'Создать адрес' : 'Редактировать адрес'"
        :fields="addressFields"
        :item="editingAddress"
        :on-save="saveAddress"
        @close="addressModal = false"
      />
    </ion-modal>

    <ion-modal :is-open="locationModal" @ion-modal-did-dismiss="locationModal = false">
      <ResourceFormModal
        v-if="locationModal"
        :title="isLocationCreating ? 'Создать место' : 'Редактировать место'"
        :fields="locationFields"
        :item="editingLocation"
        :on-save="saveLocation"
        @close="locationModal = false"
      />
    </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonSegment, IonSegmentButton, IonModal, IonSearchbar, IonButton } from '@ionic/vue'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import GeoMap from '@/components/geo/GeoMap.vue'
import type { GeoPoint, MapMarker, MapBBox } from '@/components/geo/GeoMap.vue'
import { locationMarker, useGeoSearch } from '@/composables/useGeoSearch'
import {
  getAddressesGeoV1AddressesGet, createAddressGeoV1AddressesPost,
  patchAddressGeoV1AddressesAddressIdPatch, deleteAddressGeoV1AddressesAddressIdDelete,
  getLocationsGeoV1LocationsGet, createLocationGeoV1LocationsPost,
  patchLocationGeoV1LocationsLocationIdPatch, deleteLocationGeoV1LocationsLocationIdDelete,
  getCitiesGeoV1CitiesGet, getMapGeoV1MapGet,
} from '@/api/generated/almaEventFlow'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const activeTab = ref('addresses')
const addressTableRef = ref()
const locationTableRef = ref()

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
]

// Addresses
const addressColumns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'city_id', label: 'Город', resource: (a) => ({ kind: 'city', id: a.city_id != null ? String(a.city_id) : null }) },
  { key: 'parsed', label: 'Адрес', render: (a) => a.parsed ? [a.parsed.street, a.parsed.house].filter(Boolean).join(', ') : '—' },
  { key: 'spot', label: 'Координаты', render: (a) => a.spot ? `${a.spot.lat.toFixed(4)}, ${a.spot.lon.toFixed(4)}` : '—' },
]

// Схема AddressCreate: city_id, name, parsed { house*, street, building, apartment, district }, spot?
const addressFields: FormField[] = [
  {
    key: 'city_id',
    label: 'Город',
    type: 'search',
    required: true,
    fetchOptions: async (search) => {
      const res = await getCitiesGeoV1CitiesGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
  { key: 'name', label: 'Название', type: 'text' },
  { key: 'street', label: 'Улица', type: 'text' },
  { key: 'house', label: 'Дом', type: 'text' },
  { key: 'building', label: 'Корпус/строение', type: 'text' },
  { key: 'apartment', label: 'Квартира/офис', type: 'text' },
  { key: 'district', label: 'Район', type: 'text' },
  { key: 'spot', label: 'Точка на карте', type: 'map' },
]

const PARSED_KEYS = ['house', 'street', 'building', 'apartment', 'district'] as const

function splitAddressData(data: any) {
  const { city_id, name, spot } = data
  const parsedEntries = PARSED_KEYS
    .filter((k) => data[k] !== undefined && data[k] !== '')
    .map((k) => [k, data[k]])
  const parsed = parsedEntries.length ? Object.fromEntries(parsedEntries) : null
  return { city_id: Number(city_id), name: name || null, parsed, spot: spot ?? null }
}

const addressModal = ref(false)
const editingAddress = ref<any>(null)
const isAddressCreating = ref(false)

async function fetchAddresses(params: Record<string, any>) {
  return getAddressesGeoV1AddressesGet(params as any)
}

function openAddressEdit(item: any) {
  isAddressCreating.value = false
  // Раскладываем parsed по плоским ключам формы; spot уже в нужной форме {lat, lon}
  editingAddress.value = { ...item, ...(item.parsed || {}) }
  addressModal.value = true
}

function openAddressCreate(spot: GeoPoint | null = null) {
  isAddressCreating.value = true
  editingAddress.value = spot ? { spot } : null
  addressModal.value = true
}

async function saveAddress(data: any) {
  const body = splitAddressData(data)
  if (isAddressCreating.value) {
    await createAddressGeoV1AddressesPost(body as any)
  } else if (editingAddress.value) {
    await patchAddressGeoV1AddressesAddressIdPatch(editingAddress.value.id, body as any)
  }
  addressModal.value = false
  addressTableRef.value?.loadData()
  afterMapEdit()
}

async function handleAddressDelete(item: any) {
  try { await deleteAddressGeoV1AddressesAddressIdDelete(item.id); addressTableRef.value?.loadData() }
  catch (err) { console.error(err) }
}

// Locations
const locationColumns: ColumnDef[] = [
  { key: 'name', label: 'Название', render: (l) => l.name || l.address?.name || 'Без названия', sortable: true },
  { key: 'address_id', label: 'Адрес', resource: (l) => ({ kind: 'address', id: l.address_id }) },
  { key: 'spot', label: 'Координаты', render: (l) => l.spot ? `${l.spot.lat.toFixed(4)}, ${l.spot.lon.toFixed(4)}` : '—' },
]

// Схема LocationCreate: name?, address_id? XOR spot? -- ровно один из двух
const locationFields: FormField[] = [
  { key: 'name', label: 'Название (необязательно для адреса-локации)', type: 'text' },
  {
    key: 'address_id',
    label: 'Адрес',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await getAddressesGeoV1AddressesGet({ search, limit: 20 })
      return res.data.items
    },
    initialSelected: (l) => l.address ?? null,
    displayField: 'name',
  },
  { key: 'spot', label: 'Точка на карте (если без адреса)', type: 'map' },
]

const locationModal = ref(false)
const editingLocation = ref<any>(null)
const isLocationCreating = ref(false)

async function fetchLocations(params: Record<string, any>) {
  return getLocationsGeoV1LocationsGet(params as any)
}

function openLocationEdit(item: any) {
  isLocationCreating.value = false
  editingLocation.value = item
  locationModal.value = true
}

function openLocationCreate(spot: GeoPoint | null = null) {
  isLocationCreating.value = true
  editingLocation.value = spot ? { spot } : null
  locationModal.value = true
}

async function saveLocation(data: any) {
  // Бизнес-правило: либо address_id, либо spot, никогда оба сразу
  const body = data.address_id
    ? { name: data.name || null, address_id: data.address_id, spot: null }
    : { name: data.name || null, address_id: null, spot: data.spot ?? null }
  if (isLocationCreating.value) {
    await createLocationGeoV1LocationsPost(body as any)
  } else if (editingLocation.value) {
    await patchLocationGeoV1LocationsLocationIdPatch(editingLocation.value.id, body as any)
  }
  locationModal.value = false
  locationTableRef.value?.loadData()
  afterMapEdit()
}

async function handleLocationDelete(item: any) {
  try { await deleteLocationGeoV1LocationsLocationIdDelete(item.id); locationTableRef.value?.loadData() }
  catch (err) { console.error(err) }
}

// Map tab
const bboxMarkers = ref<MapMarker[]>([])
const mapAddressById = new Map<string, AddressRead>()
const mapLocationById = new Map<string, LocationRead>()
const pickedPoint = ref<GeoPoint | null>(null)
const { query: mapQuery, results: mapResults, markers: searchMarkers } = useGeoSearch({
  limit: 30,
  namedLocationsOnly: false,
})
let lastBox: MapBBox | null = null

const visibleMarkers = computed(() => (mapQuery.value.trim() ? searchMarkers.value : bboxMarkers.value))

async function onMapBbox(box: MapBBox) {
  lastBox = box
  if (mapQuery.value.trim()) return
  try {
    const res = await getMapGeoV1MapGet({
      min_lat: box.minLat, min_lon: box.minLon, max_lat: box.maxLat, max_lon: box.maxLon,
      limit: 100,
    })
    mapAddressById.clear()
    mapLocationById.clear()
    const markers: MapMarker[] = []
    for (const a of res.data.addresses.items) {
      if (!a.spot) continue
      mapAddressById.set(a.id, a)
      markers.push({ id: a.id, kind: 'address', lat: a.spot.lat, lon: a.spot.lon, label: a.name })
    }
    for (const l of res.data.locations.items) {
      const marker = locationMarker(l)
      if (!marker) continue
      mapLocationById.set(l.id, l)
      markers.push(marker)
    }
    bboxMarkers.value = markers
  } catch {
    bboxMarkers.value = []
  }
}

watch(mapQuery, (q) => {
  if (!q.trim() && lastBox) onMapBbox(lastBox)
})

function onMapMarkerClick(marker: MapMarker) {
  pickedPoint.value = null
  const found = mapResults.value.find((r) => r.kind === marker.kind && r.item.id === marker.id)
  const entity = found?.item ?? (marker.kind === 'address' ? mapAddressById.get(marker.id) : mapLocationById.get(marker.id))
  if (!entity) return
  if (marker.kind === 'address') openAddressEdit(entity)
  else openLocationEdit(entity)
}

function createAddressAtPoint() {
  if (pickedPoint.value) openAddressCreate(pickedPoint.value)
}

function createLocationAtPoint() {
  if (pickedPoint.value) openLocationCreate(pickedPoint.value)
}

function afterMapEdit() {
  pickedPoint.value = null
  if (lastBox) onMapBbox(lastBox)
}
</script>

<style scoped>
.admin-map {
  height: 60vh;
  min-height: 360px;
  border-radius: 10px;
  overflow: hidden;
}

.map-hint {
  margin: 8px 4px 0;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.map-search {
  padding: 0 0 8px;
}

.pick-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.pick-coords {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-medium);
}
</style>
