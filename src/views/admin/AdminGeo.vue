<template>
  <AdminLayout title="Гео">
      <ion-segment v-model="activeTab">
        <ion-segment-button value="addresses">Адреса</ion-segment-button>
        <ion-segment-button value="locations">Места</ion-segment-button>
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

      <div v-else class="ion-padding-top">
        <ResourceTable
          ref="locationTableRef"

          :columns="locationColumns"
          :get-label="(l) => l.name"
          :get-subtitle="(l) => l.address_id || 'Нет адреса'"
          :fetch-items="fetchLocations"
          :sort-options="sortOptions"
          default-sort="name"
          add-label="Добавить"
          @add="openLocationCreate"
          @edit="openLocationEdit"
          @delete="handleLocationDelete"
        />
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
import { getAddressesGeoV1AddressesGet, createAddressGeoV1AddressesPost, patchAddressGeoV1AddressesAddressIdPatch, deleteAddressGeoV1AddressesAddressIdDelete } from '@/api/generated/-geo'
import { getLocationsGeoV1LocationsGet, createLocationGeoV1LocationsPost, patchLocationGeoV1LocationsLocationIdPatch, deleteLocationGeoV1LocationsLocationIdDelete } from '@/api/generated/-geo'
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
]

// Схема AddressCreate: city_id (number), name, parsed { house*, street, building, apartment, district }
const addressFields: FormField[] = [
  { key: 'city_id', label: 'ID города', type: 'number', required: true },
  { key: 'name', label: 'Название', type: 'text' },
  { key: 'street', label: 'Улица', type: 'text' },
  { key: 'house', label: 'Дом', type: 'text' },
  { key: 'building', label: 'Корпус/строение', type: 'text' },
  { key: 'apartment', label: 'Квартира/офис', type: 'text' },
  { key: 'district', label: 'Район', type: 'text' },
]

const PARSED_KEYS = ['house', 'street', 'building', 'apartment', 'district'] as const

function splitAddressData(data: any) {
  const { city_id, name } = data
  const parsedEntries = PARSED_KEYS
    .filter((k) => data[k] !== undefined && data[k] !== '')
    .map((k) => [k, data[k]])
  const parsed = parsedEntries.length ? Object.fromEntries(parsedEntries) : null
  return { city_id: Number(city_id), name: name || null, parsed }
}

const addressModal = ref(false)
const editingAddress = ref<any>(null)
const isAddressCreating = ref(false)

async function fetchAddresses(params: Record<string, any>) {
  return getAddressesGeoV1AddressesGet(params as any)
}

function maskUuid(id: string): string {
  if (id.length < 12) return id
  return `${id.slice(0, 8)}-****-****-${id.slice(id.length - 4)}`
}

function openAddressEdit(item: any) {
  isAddressCreating.value = false
  // Раскладываем parsed по плоским ключам формы
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
  { key: 'name', label: 'Название', sortable: true },
  { key: 'address_id', label: 'Адрес', render: (l) => l.address_id ? maskUuid(l.address_id) : '—' },
  { key: 'spot', label: 'Координаты', render: (l) => l.spot ? `${l.spot.lat}, ${l.spot.lon}` : '—' },
]

// Схема LocationCreate: name, address_id, spot { lat, lon } — обязателен
const locationFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
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
  { key: 'lat', label: 'Широта', type: 'number', required: true, placeholder: '55.7558' },
  { key: 'lon', label: 'Долгота', type: 'number', required: true, placeholder: '37.6173' },
]

const locationModal = ref(false)
const editingLocation = ref<any>(null)
const isLocationCreating = ref(false)

async function fetchLocations(params: Record<string, any>) {
  return getLocationsGeoV1LocationsGet(params as any)
}

function openLocationEdit(item: any) {
  isLocationCreating.value = false
  editingLocation.value = { ...item, lat: item.spot?.lat, lon: item.spot?.lon }
  locationModal.value = true
}

function openLocationCreate() {
  isLocationCreating.value = true
  editingLocation.value = null
  locationModal.value = true
}

async function saveLocation(data: any) {
  const { lat, lon, ...rest } = data
  const body = { ...rest, address_id: rest.address_id ?? null, spot: { lat: Number(lat), lon: Number(lon) } }
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

</script>
