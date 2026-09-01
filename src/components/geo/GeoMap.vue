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
  }>(),
  {
    zoom: 15,
    markers: () => [],
    pickable: false,
    pickedPoint: null,
  },
)

const emit = defineEmits<{
  pick: [point: GeoPoint]
  'marker-click': [marker: MapMarker]
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
    html: '●',
    iconSize: [16, 16],
  }),
  location: L.divIcon({
    className: 'geo-marker geo-marker--location',
    html: '★',
    iconSize: [18, 18],
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

function renderMarkers() {
  if (!markerLayer) return
  markerLayer.clearLayers()
  for (const m of props.markers) {
    const marker = L.marker([m.lat, m.lon], { icon: icons[m.kind] })
    if (m.label) marker.bindTooltip(m.label)
    marker.on('click', () => emit('marker-click', m))
    marker.addTo(markerLayer!)
  }
}

function renderPick() {
  if (!map) return
  if (pickMarker) {
    pickMarker.remove()
    pickMarker = null
  }
  if (props.pickedPoint) {
    pickMarker = L.marker([props.pickedPoint.lat, props.pickedPoint.lon], {
      icon: icons.pick,
    }).addTo(map)
  }
}

onMounted(() => {
  if (!mapEl.value) return
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
})

onBeforeUnmount(() => {
  if (bboxTimer) clearTimeout(bboxTimer)
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
})
</script>

<style scoped>
.geo-map {
  width: 100%;
  height: 100%;
  min-height: 240px;
}

:deep(.geo-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

:deep(.geo-marker--address) {
  color: var(--ion-color-medium, #666666);
}

:deep(.geo-marker--location) {
  color: var(--ion-color-primary, #3880ff);
}

:deep(.geo-marker--pick) {
  font-size: 22px;
}
</style>
