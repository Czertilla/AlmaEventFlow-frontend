<template>
  <AdminLayout title="Гео">
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
          @add="openAddressCreate"
          @edit="openAddressEdit"
          @delete="handleAddressDelete"
        />
      </div>

      <div v-else-if="activeTab === 'locations'" class="ion-padding-top">
        <ResourceTable
          ref="locationTableRef"

          :columns="locationColumns"
          :get-label="(l) => l.name || l.address?.name || 'Без названия'"
          :get-subtitle="(l) => l.address_id || 'Своя точка'"
          :fetch-items="fetchLocations"
          :sort-options="sortOptions"
          default-sort="name"
          add-label="Добавить"
          @add="openLocationCreate"
          @edit="openLocationEdit"
          @delete="handleLocationDelete"
        />
      </div>

      <div v-else class="ion-padding-top">
        <GeoMap :markers="mapMarkers" class="admin-map" @bbox="onMapBbox" @marker-click="onMapMarkerClick" />
        <p class="map-hint">
          Переместите/приблизьте карту, чтобы подгрузить объекты в этой
          области -- адреса и места показаны разными метками. Клик по метке
          открывает форму редактирования.
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
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonSegment, IonSegmentButton, IonModal } from '@ionic/vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import GeoMap from '@/components/geo/GeoMap.vue'
import type { MapMarker, MapBBox } from '@/components/geo/GeoMap.vue'
import {
  getAddressesGeoV1AddressesGet, createAddressGeoV1AddressesPost,
  patchAddressGeoV1AddressesAddressIdPatch, deleteAddressGeoV1AddressesAddressIdDelete,
  getLocationsGeoV1LocationsGet, createLocationGeoV1LocationsPost,
  patchLocationGeoV1LocationsLocationIdPatch, deleteLocationGeoV1LocationsLocationIdDelete,
  getCitiesGeoV1CitiesGet, getMapGeoV1MapGet,
} from '@/api/generated/almaEventFlow'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import { shortId } from '@/utils/names'
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
  { key: 'city_id', label: 'Город', render: (a) => a.city_id || '—' },
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

function openAddressCreate() {
  isAddressCreating.value = true
  editingAddress.value = null
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
}

async function handleAddressDelete(item: any) {
  try { await deleteAddressGeoV1AddressesAddressIdDelete(item.id); addressTableRef.value?.loadData() }
  catch (err) { console.error(err) }
}

// Locations
const locationColumns: ColumnDef[] = [
  { key: 'name', label: 'Название', render: (l) => l.name || l.address?.name || 'Без названия', sortable: true },
  { key: 'address_id', label: 'Адрес', render: (l) => l.address_id ? shortId(l.address_id) : '—' },
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

function openLocationCreate() {
  isLocationCreating.value = true
  editingLocation.value = null
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
}

async function handleLocationDelete(item: any) {
  try { await deleteLocationGeoV1LocationsLocationIdDelete(item.id); locationTableRef.value?.loadData() }
  catch (err) { console.error(err) }
}

// Map browse tab
const mapMarkers = ref<MapMarker[]>([])
const mapAddressById = new Map<string, AddressRead>()
const mapLocationById = new Map<string, LocationRead>()

async function onMapBbox(box: MapBBox) {
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
      const point = l.spot || l.address?.spot
      if (!point) continue
      mapLocationById.set(l.id, l)
      markers.push({ id: l.id, kind: 'location', lat: point.lat, lon: point.lon, label: l.name || l.address?.name || 'Без названия' })
    }
    mapMarkers.value = markers
  } catch {
    mapMarkers.value = []
  }
}

function onMapMarkerClick(marker: MapMarker) {
  if (marker.kind === 'address') {
    const addr = mapAddressById.get(marker.id)
    if (addr) openAddressEdit(addr)
  } else {
    const loc = mapLocationById.get(marker.id)
    if (loc) openLocationEdit(loc)
  }
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
</style>
