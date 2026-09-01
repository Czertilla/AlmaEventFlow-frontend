<template>
  <ion-modal :is-open="isOpen" @ion-modal-did-dismiss="close">
    <ion-header>
      <ion-toolbar>
        <ion-title>Локация мероприятия</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Закрыть" @click="close">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="tab">
          <ion-segment-button value="locations">Локации</ion-segment-button>
          <ion-segment-button value="addresses">Адреса</ion-segment-button>
          <ion-segment-button value="new">Новая</ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Поиск существующих локаций -->
      <div v-if="tab === 'locations'" class="picker-pane">
        <ion-searchbar
          v-model="locationQuery"
          placeholder="Поиск локации..."
          :debounce="400"
          @ion-input="searchLocations"
        />
        <div v-if="locationResults.length" class="picker-results">
          <button
            v-for="loc in locationResults"
            :key="loc.id"
            class="picker-result"
            @click="pickExistingLocation(loc)"
          >
            <ion-icon :icon="starOutline" />
            <span>{{ loc.name || loc.address?.name || 'Без названия' }}</span>
          </button>
        </div>
        <p v-else-if="locationQuery && !locationsLoading" class="picker-empty">
          Ничего не найдено
        </p>
      </div>

      <!-- Поиск адресов -> карточка "создать локацию" -->
      <div v-else-if="tab === 'addresses'" class="picker-pane">
        <template v-if="!selectedAddress">
          <ion-searchbar
            v-model="addressQuery"
            placeholder="Поиск адреса..."
            :debounce="400"
            @ion-input="searchAddresses"
          />
          <div v-if="addressResults.length" class="picker-results">
            <button
              v-for="addr in addressResults"
              :key="addr.id"
              class="picker-result"
              @click="selectAddress(addr)"
            >
              <ion-icon :icon="locationOutline" />
              <span>{{ addr.name }}</span>
            </button>
          </div>
          <p v-else-if="addressQuery && !addressesLoading" class="picker-empty">
            Ничего не найдено
          </p>
        </template>

        <template v-else>
          <div class="address-card">
            <button class="address-card-back" @click="selectedAddress = null">
              <ion-icon :icon="chevronBackOutline" /> Другой адрес
            </button>
            <p class="address-card-text">{{ selectedAddress.name }}</p>
            <ion-input
              v-model="newLocationName"
              placeholder="Название локации (необязательно)"
              mode="md"
            />
            <p class="picker-hint">
              Если не указать название, будет использована сама локация-адрес
              -- при повторном выборе этого же адреса без названия она же и
              переиспользуется.
            </p>
            <GeoMap
              v-if="selectedAddress.spot"
              :center="selectedAddress.spot"
              :markers="[{ id: selectedAddress.id, kind: 'address', lat: selectedAddress.spot.lat, lon: selectedAddress.spot.lon }]"
              class="address-card-map"
            />
            <ion-button expand="block" :disabled="saving" @click="confirmFromAddress">
              <ion-spinner v-if="saving" slot="start" name="crescent" />
              Использовать этот адрес
            </ion-button>
          </div>
        </template>
      </div>

      <!-- Новая локация по точке на карте -->
      <div v-else class="picker-pane">
        <ion-input
          v-model="newLocationName"
          placeholder="Название локации"
          mode="md"
        />
        <GeoMap
          pickable
          :picked-point="pickedPoint"
          class="new-location-map"
          @pick="pickedPoint = $event"
        />
        <p class="picker-hint">Нажмите на карту, чтобы указать точку.</p>
        <ion-button
          expand="block"
          :disabled="saving || !pickedPoint || !newLocationName"
          @click="confirmNew"
        >
          <ion-spinner v-if="saving" slot="start" name="crescent" />
          Создать локацию
        </ion-button>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonSegment, IonSegmentButton, IonSearchbar, IonInput, IonSpinner,
} from '@ionic/vue'
import {
  closeOutline, starOutline, locationOutline, chevronBackOutline,
} from 'ionicons/icons'
import GeoMap from './GeoMap.vue'
import {
  getLocationsGeoV1LocationsGet,
  getAddressesGeoV1AddressesGet,
  createLocationFromAddressGeoV1LocationsFromAddressPost,
  createLocationGeoV1LocationsPost,
} from '@/api/generated/almaEventFlow'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{
  close: []
  selected: [location: LocationRead]
}>()

const { showError } = useToast()

const tab = ref<'locations' | 'addresses' | 'new'>('locations')

const locationQuery = ref('')
const locationResults = ref<LocationRead[]>([])
const locationsLoading = ref(false)

const addressQuery = ref('')
const addressResults = ref<AddressRead[]>([])
const addressesLoading = ref(false)
const selectedAddress = ref<AddressRead | null>(null)

const newLocationName = ref('')
const pickedPoint = ref<{ lat: number; lon: number } | null>(null)

const saving = ref(false)
const error = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    tab.value = 'locations'
    locationQuery.value = ''
    locationResults.value = []
    addressQuery.value = ''
    addressResults.value = []
    selectedAddress.value = null
    newLocationName.value = ''
    pickedPoint.value = null
    error.value = ''
  },
)

async function searchLocations() {
  if (!locationQuery.value) {
    locationResults.value = []
    return
  }
  locationsLoading.value = true
  try {
    const res = await getLocationsGeoV1LocationsGet({ search: locationQuery.value, limit: 20 })
    locationResults.value = res.data.items
  } catch {
    locationResults.value = []
  } finally {
    locationsLoading.value = false
  }
}

async function searchAddresses() {
  if (!addressQuery.value) {
    addressResults.value = []
    return
  }
  addressesLoading.value = true
  try {
    const res = await getAddressesGeoV1AddressesGet({ search: addressQuery.value, limit: 20 })
    addressResults.value = res.data.items
  } catch {
    addressResults.value = []
  } finally {
    addressesLoading.value = false
  }
}

function pickExistingLocation(loc: LocationRead) {
  emit('selected', loc)
  close()
}

function selectAddress(addr: AddressRead) {
  selectedAddress.value = addr
  newLocationName.value = ''
}

async function confirmFromAddress() {
  if (!selectedAddress.value) return
  saving.value = true
  error.value = ''
  try {
    const res = await createLocationFromAddressGeoV1LocationsFromAddressPost({
      address_id: selectedAddress.value.id,
      name: newLocationName.value || null,
    })
    emit('selected', res.data)
    close()
  } catch (err) {
    showError(err, 'Не удалось создать локацию')
    error.value = 'Не удалось создать локацию'
  } finally {
    saving.value = false
  }
}

async function confirmNew() {
  if (!pickedPoint.value || !newLocationName.value) return
  saving.value = true
  error.value = ''
  try {
    const res = await createLocationGeoV1LocationsPost({
      name: newLocationName.value,
      spot: pickedPoint.value,
    })
    emit('selected', res.data)
    close()
  } catch (err) {
    showError(err, 'Не удалось создать локацию')
    error.value = 'Не удалось создать локацию'
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.picker-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.picker-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}

.picker-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--ion-border-color, #ddd);
  border-radius: 10px;
  background: var(--ion-item-background, #fff);
  text-align: left;
  font-size: 14px;
  cursor: pointer;
}

.picker-result ion-icon {
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.picker-empty,
.picker-hint {
  margin: 4px 0;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.address-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.address-card-back {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--ion-color-primary);
  font-size: 13px;
  padding: 0;
  cursor: pointer;
}

.address-card-text {
  margin: 0;
  font-weight: 600;
}

.address-card-map,
.new-location-map {
  height: 220px;
  border-radius: 10px;
  overflow: hidden;
}

.form-error {
  color: var(--ion-color-danger);
  font-size: 13px;
}
</style>
