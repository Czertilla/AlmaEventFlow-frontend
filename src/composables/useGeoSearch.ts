import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getAddressesGeoV1AddressesGet,
  getLocationsGeoV1LocationsGet,
} from '@/api/generated/almaEventFlow'
import type { AddressRead, LocationRead } from '@/api/generated/almaEventFlow'
import type { GeoPoint, MapMarker } from '@/components/geo/GeoMap.vue'

export type GeoResult =
  | { kind: 'location'; item: LocationRead }
  | { kind: 'address'; item: AddressRead }

interface Options {
  limit?: number
  namedLocationsOnly?: boolean
  debounceMs?: number
}

export interface LocationDraft {
  name?: string
  address?: AddressRead | null
  spot?: GeoPoint | null
}

export function geoOptionId(listId: string, index: number): string {
  return `${listId}-opt-${index}`
}

export function locationLabel(location: LocationRead): string {
  return location.name || location.address?.name || 'Локация без названия'
}

export function mapLinkLabel(location: LocationRead): string | undefined {
  return location.address?.name || location.name || undefined
}

export function resultLabel(result: GeoResult): string {
  return result.kind === 'location' ? locationLabel(result.item) : result.item.name
}

export function canOfferCreate(results: GeoResult[], query: string): boolean {
  const q = query.trim().toLowerCase()
  return !!q && !results.some((r) => resultLabel(r).trim().toLowerCase() === q)
}

export function resultPoint(result: GeoResult): GeoPoint | null {
  if (result.kind === 'address') return result.item.spot ?? null
  return result.item.spot ?? result.item.address?.spot ?? null
}

export function locationMarker(location: LocationRead): MapMarker | null {
  const point = location.spot ?? location.address?.spot
  if (!point) return null
  return { id: location.id, kind: 'location', lat: point.lat, lon: point.lon, label: locationLabel(location) }
}

export function resultMarker(result: GeoResult): MapMarker | null {
  if (result.kind === 'location') return locationMarker(result.item)
  const point = result.item.spot
  if (!point) return null
  return { id: result.item.id, kind: 'address', lat: point.lat, lon: point.lon, label: result.item.name }
}

export function useGeoSearch({ limit = 20, namedLocationsOnly = true, debounceMs = 300 }: Options = {}) {
  const query = ref('')
  const near = ref<GeoPoint | null>(null)
  const results = ref<GeoResult[]>([])
  const searching = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let requestId = 0

  async function run() {
    const q = query.value.trim()
    const point = near.value
    const id = ++requestId
    searching.value = true
    try {
      // Locations are a small, curated set (unlike addresses, which are an
      // unbounded imported dataset) -- always list them, even with nothing
      // typed and no point picked, so an already-created location can be
      // found without searching for it first.
      const locationsPromise = getLocationsGeoV1LocationsGet({
        search: q || undefined,
        near_lat: point?.lat,
        near_lon: point?.lon,
        limit,
        ...(namedLocationsOnly ? { name__isnull: false } : {}),
      })
      const addressesPromise = q || point
        ? getAddressesGeoV1AddressesGet({ search: q || undefined, near_lat: point?.lat, near_lon: point?.lon, limit })
        : null
      const [locations, addresses] = await Promise.all([locationsPromise, addressesPromise])
      if (id !== requestId) return
      results.value = [
        ...locations.data.items.map((item) => ({ kind: 'location' as const, item })),
        ...(addresses ? addresses.data.items.map((item) => ({ kind: 'address' as const, item })) : []),
      ]
    } catch {
      if (id === requestId) results.value = []
    } finally {
      if (id === requestId) searching.value = false
    }
  }

  function refresh() {
    if (timer) clearTimeout(timer)
    run()
  }

  watch([query, near], () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, debounceMs)
  })

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    requestId++
  })

  const markers = computed<MapMarker[]>(() =>
    results.value.map(resultMarker).filter((m): m is MapMarker => m !== null),
  )

  function clear() {
    if (timer) clearTimeout(timer)
    requestId++
    query.value = ''
    near.value = null
    results.value = []
    searching.value = false
  }

  return { query, near, results, searching, markers, clear, refresh }
}
