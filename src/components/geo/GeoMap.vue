<template>
  <div ref="mapEl" class="geo-map" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface GeoPoint {
  lat: number
  lon: number
}

export interface MapMarker extends GeoPoint {
  id: string
  kind: 'address' | 'location'
  label?: string
}

export interface MapBBox {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

const props = withDefaults(
  defineProps<{
    center?: GeoPoint
    zoom?: number
    markers?: MapMarker[]
    pickable?: boolean
    pickedPoint?: GeoPoint | null
    fit?: boolean
  }>(),
  {
    zoom: 15,
    markers: () => [],
    pickable: false,
    pickedPoint: null,
    fit: false,
  },
)

const emit = defineEmits<{
  pick: [point: GeoPoint]
  'marker-click': [marker: MapMarker]
  'marker-create': [marker: MapMarker]
  interact: []
  bbox: [box: MapBBox]
}>()

// Бесплатный публичный тайл-сервер OSM -- ключ не нужен. При заметной
// нагрузке в проде стоит перейти на выделенного провайдера тайлов;
// переопределяется через VITE_MAP_TILE_URL.
const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

const DEFAULT_CENTER: GeoPoint = { lat: 55.7558, lon: 37.6173 } // Москва

const icons: Record<'address' | 'location' | 'pick', L.DivIcon> = {
  address: L.divIcon({
    className: 'geo-marker geo-marker--address',
    html: '',
    iconSize: [16, 16],
  }),
  location: L.divIcon({
    className: 'geo-marker geo-marker--location',
    html: '★',
    iconSize: [24, 24],
  }),
  pick: L.divIcon({
    className: 'geo-marker geo-marker--pick',
    html: '📍',
    iconSize: [26, 26],
  }),
}

const mapEl = ref<HTMLDivElement>()
let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null
let pickMarker: L.Marker | null = null
let bboxTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

function emitBbox() {
  if (!map) return
  const b = map.getBounds()
  emit('bbox', {
    minLat: b.getSouth(),
    minLon: b.getWest(),
    maxLat: b.getNorth(),
    maxLon: b.getEast(),
  })
}

function scheduleBboxEmit() {
  if (bboxTimer) clearTimeout(bboxTimer)
  bboxTimer = setTimeout(emitBbox, 400)
}

function buildAddressPopup(marker: L.Marker, m: MapMarker): HTMLElement {
  const root = document.createElement('div')
  root.className = 'geo-marker-popup'
  if (m.label) {
    const title = document.createElement('div')
    title.className = 'geo-marker-popup-title'
    title.textContent = m.label
    root.appendChild(title)
  }
  const actions = document.createElement('div')
  actions.className = 'geo-marker-popup-actions'
  const selectBtn = document.createElement('button')
  selectBtn.type = 'button'
  selectBtn.className = 'geo-marker-popup-btn'
  selectBtn.textContent = 'Выбрать'
  selectBtn.addEventListener('click', () => {
    marker.closePopup()
    emit('marker-click', m)
  })
  const createBtn = document.createElement('button')
  createBtn.type = 'button'
  createBtn.className = 'geo-marker-popup-btn geo-marker-popup-btn--primary'
  createBtn.textContent = 'Создать локацию'
  createBtn.addEventListener('click', () => {
    marker.closePopup()
    emit('marker-create', m)
  })
  actions.append(selectBtn, createBtn)
  root.appendChild(actions)
  return root
}

function renderMarkers() {
  if (!markerLayer) return
  markerLayer.clearLayers()
  for (const m of props.markers) {
    const marker = L.marker([m.lat, m.lon], { icon: icons[m.kind] })
    if (m.label) marker.bindTooltip(m.label)
    if (m.kind === 'address') {
      marker.bindPopup(buildAddressPopup(marker, m), { className: 'geo-marker-popup-wrap' })
    } else {
      marker.on('click', () => emit('marker-click', m))
    }
    marker.addTo(markerLayer!)
  }
  fitToMarkers()
}

function fitToMarkers() {
  if (!map || !props.fit || props.markers.length === 0) return
  // A picked point already positioned the view (see renderPick) -- search
  // results always include the full curated location list regardless of
  // where that point is, so fitting bounds to all of them here would yank
  // the map back out to cover everything between the pick and wherever
  // those unrelated locations happen to be.
  if (props.pickedPoint) return
  const bounds = L.latLngBounds(props.markers.map((m) => [m.lat, m.lon] as [number, number]))
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
}

function renderPick() {
  if (!map) return
  if (pickMarker) {
    pickMarker.remove()
    pickMarker = null
  }
  if (props.pickedPoint) {
    const latlng = L.latLng(props.pickedPoint.lat, props.pickedPoint.lon)
    pickMarker = L.marker(latlng, { icon: icons.pick }).addTo(map)
    if (!map.getBounds().contains(latlng)) map.setView(latlng, map.getZoom())
  }
}

function onPointerDown() {
  emit('interact')
}

onMounted(() => {
  if (!mapEl.value) return
  mapEl.value.addEventListener('pointerdown', onPointerDown)
  const c = props.center || props.pickedPoint || DEFAULT_CENTER
  map = L.map(mapEl.value).setView([c.lat, c.lon], props.zoom)
  L.tileLayer(TILE_URL, {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  renderMarkers()
  renderPick()

  if (props.pickable) {
    map.on('click', (e: L.LeafletMouseEvent) => {
      emit('pick', { lat: e.latlng.lat, lon: e.latlng.lng })
    })
  }
  map.on('moveend', scheduleBboxEmit)
  map.on('zoomend', scheduleBboxEmit)
  scheduleBboxEmit()

  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)
})

onBeforeUnmount(() => {
  if (bboxTimer) clearTimeout(bboxTimer)
  resizeObserver?.disconnect()
  resizeObserver = null
  mapEl.value?.removeEventListener('pointerdown', onPointerDown)
  map?.remove()
  map = null
  markerLayer = null
  pickMarker = null
})

watch(() => props.markers, renderMarkers, { deep: true })
watch(() => props.pickedPoint, renderPick, { deep: true })
watch(
  () => props.center,
  (c) => {
    if (map && c) map.setView([c.lat, c.lon], props.zoom)
  },
)

defineExpose({
  /** Leaflet needs this after the map becomes visible inside a modal/tab
   * that was hidden (zero-size) at mount time. */
  invalidateSize: () => map?.invalidateSize(),
  refit: fitToMarkers,
})
</script>

<style scoped>
.geo-map {
  /* contains leaflet's internal panes (z-index up to 700) so they can't paint over sibling dropdowns */
  z-index: 0;
  width: 100%;
  height: 100%;
  min-height: 240px;
}

:deep(.geo-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  color: #ffffff;
  font-size: var(--fs-sm);
  line-height: 1;
}

:deep(.geo-marker--address) {
  background: var(--ion-color-medium, #666666);
}

:deep(.geo-marker--location) {
  background: var(--ion-color-primary, #3880ff);
}

:deep(.geo-marker--pick) {
  border: none;
  background: none;
  box-shadow: none;
  font-size: var(--fs-2xl);
}

:deep(.geo-marker-popup-wrap .leaflet-popup-content-wrapper) {
  border-radius: 12px;
  background: var(--ion-card-background);
  color: var(--ion-text-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
}

:deep(.geo-marker-popup-wrap .leaflet-popup-content) {
  margin: 10px 12px;
}

:deep(.geo-marker-popup-wrap .leaflet-popup-tip) {
  background: var(--ion-card-background);
}

:deep(.geo-marker-popup) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 170px;
}

:deep(.geo-marker-popup-title) {
  overflow: hidden;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  line-height: 1.3;
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.geo-marker-popup-actions) {
  display: flex;
  gap: 6px;
}

:deep(.geo-marker-popup-btn) {
  flex: 1;
  min-height: 32px;
  padding: 0 10px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 8px;
  background: var(--ion-card-background);
  color: var(--ion-text-color);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  cursor: pointer;
}

:deep(.geo-marker-popup-btn--primary) {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
</style>
