<template>
  <form class="lcf" @submit.prevent="submit">
    <div class="lcf-field">
      <label class="lcf-label" for="lcf-name">Название</label>
      <input
        id="lcf-name"
        ref="nameInput"
        v-model="name"
        type="text"
        class="lcf-input"
        maxlength="512"
        autocomplete="off"
        placeholder="Например, Актовый зал"
      />
      <p class="lcf-hint">{{ nameHint }}</p>
    </div>

    <div class="lcf-field">
      <span class="lcf-label">Адрес</span>
      <AddressSearchSelect v-model="address" />
    </div>

    <div class="lcf-field">
      <span class="lcf-label">{{ address ? 'Уточнить место на карте' : 'Точка на карте' }}</span>
      <GeoMap
        pickable
        :markers="addressMarker ? [addressMarker] : []"
        :picked-point="spot"
        :center="mapCenter"
        class="lcf-map"
        @pick="spot = $event"
      />
      <div class="lcf-map-foot">
        <span v-if="spot" class="lcf-coords">{{ spot.lat.toFixed(5) }}, {{ spot.lon.toFixed(5) }}</span>
        <span v-else class="lcf-hint lcf-hint--flush">{{ mapHint }}</span>
        <button v-if="spot" type="button" class="lcf-link" @click="spot = null">Сбросить точку</button>
      </div>
    </div>

    <div class="lcf-actions">
      <button type="button" class="lcf-btn lcf-btn--ghost" @click="emit('cancel')">Отмена</button>
      <button type="submit" class="lcf-btn lcf-btn--primary" :disabled="!canSubmit || submitting">
        <ion-spinner v-if="submitting" name="crescent" />
        <span>Создать локацию</span>
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IonSpinner } from '@ionic/vue'
import GeoMap from './GeoMap.vue'
import type { GeoPoint, MapMarker } from './GeoMap.vue'
import AddressSearchSelect from './AddressSearchSelect.vue'
import { createLocationGeoV1LocationsPost } from '@/api/generated/almaEventFlow'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import type { LocationDraft } from '@/composables/useGeoSearch'

const props = defineProps<{ draft: LocationDraft }>()
const emit = defineEmits<{ created: [location: LocationRead]; cancel: [] }>()

const { showError } = useToast()

const name = ref(props.draft.name ?? '')
const address = ref<AddressRead | null>(props.draft.address ?? null)
const spot = ref<GeoPoint | null>(props.draft.spot ?? null)
const submitting = ref(false)
const nameInput = ref<HTMLInputElement>()

const addressMarker = computed<MapMarker | null>(() => {
  const point = address.value?.spot
  if (!address.value || !point) return null
  return { id: address.value.id, kind: 'address', lat: point.lat, lon: point.lon, label: address.value.name }
})
const mapCenter = computed<GeoPoint | undefined>(() => address.value?.spot ?? spot.value ?? undefined)

const nameHint = computed(() =>
  spot.value
    ? 'Обязательно, если уточняете точку на карте.'
    : 'Необязательно — без названия будет использован сам адрес.',
)
const mapHint = computed(() =>
  address.value
    ? 'Нажмите на карту, чтобы уточнить точное место (необязательно).'
    : 'Нажмите на карту, чтобы поставить точку.',
)

const canSubmit = computed(() => {
  const hasAddress = !!address.value
  const hasSpot = !!spot.value
  return (hasAddress || hasSpot) && (!hasSpot || !!name.value.trim())
})

let focusTimer: ReturnType<typeof setTimeout> | null = null
onMounted(() => {
  if (!name.value) focusTimer = setTimeout(() => nameInput.value?.focus(), 350)
})
onBeforeUnmount(() => {
  if (focusTimer) clearTimeout(focusTimer)
})

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  const trimmed = name.value.trim()
  try {
    const res = await createLocationGeoV1LocationsPost({
      name: trimmed || null,
      address_id: address.value?.id ?? null,
      spot: spot.value ?? null,
    })
    emit('created', res.data)
  } catch (err) {
    showError(err, 'Не удалось создать локацию')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.lcf {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding: 20px 20px 0;
}

.lcf-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lcf-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.lcf-input {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  outline: none;
  background: var(--ion-card-background);
  color: var(--ion-text-color);
  font-family: inherit;
  font-size: 15px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.lcf-input::placeholder {
  color: var(--ion-color-step-400);
}

.lcf-input:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

.lcf-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ion-color-medium);
}

.lcf-hint--flush {
  margin: 0;
}

.lcf-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--ion-color-primary);
  font-family: inherit;
  font-size: inherit;
  font-weight: 600;
  cursor: pointer;
}

.lcf-link:hover,
.lcf-link:focus-visible {
  text-decoration: underline;
  outline: none;
}

.lcf-map {
  height: 240px;
  overflow: hidden;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 14px;
}

.lcf-map-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 20px;
}

.lcf-coords {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ion-text-color);
}

.lcf-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  gap: 10px;
  margin: auto -20px 0;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--ion-border-color);
  background: var(--ion-background-color);
}

.lcf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 20px;
  border: 1.5px solid transparent;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s, transform 0.1s;
}

.lcf-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.lcf-btn--ghost {
  border-color: var(--ion-border-color);
  background: transparent;
  color: var(--ion-text-color);
}

.lcf-btn--ghost:hover {
  background: rgba(var(--ion-text-color-rgb), 0.05);
}

.lcf-btn--primary {
  flex: 1;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.lcf-btn--primary:hover:not(:disabled) {
  background: var(--ion-color-primary-shade);
}

.lcf-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.lcf-btn ion-spinner {
  width: 18px;
  height: 18px;
}
</style>
