import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getLocationsGeoV1LocationsGet, searchGeoV2SearchGet } from '@/api/generated/almaEventFlow'
import type { AddressHit, AddressRead, LocationHit, LocationRead, Place } from '@/api/generated/almaEventFlow'
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

/** What to look up in a map service for a location with no coordinates: its address, or the text it is. */
export function locationSearchText(location: LocationRead): string | null {
  if (location.spot || location.address?.spot) return null
  const address = location.address
  if (address) return [address.name, addressLocality(address)].filter(Boolean).join(', ')
  return location.name?.trim() || null
}

export function resultLabel(result: GeoResult): string {
  return result.kind === 'location' ? locationLabel(result.item) : result.item.name
}

/** "Москва, Россия": the city line of a v2 address; v1 rows do not carry one. */
export function addressLocality(address: AddressRead | null | undefined): string {
  const value = (address as { locality?: unknown } | null | undefined)?.locality
  return typeof value === 'string' ? value.trim() : ''
}

function withCity(text: string, address: AddressRead | null | undefined): string {
  const city = addressLocality(address)
  return city ? `${text} · ${city}` : text
}

export function resultSubtitle(result: GeoResult): string {
  if (result.kind === 'address') return withCity('Адрес', result.item)
  const { name, address, spot } = result.item
  if (!address) return spot ? 'Точка на карте' : 'Адрес текстом'
  return withCity(name ? address.name : 'Адрес', address)
}

export function toGeoResult(hit: AddressHit | LocationHit): GeoResult {
  return hit.kind === 'address'
    ? { kind: 'address', item: hit.address }
    : { kind: 'location', item: hit.location }
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
  return {
    id: result.item.id,
    kind: 'address',
    lat: point.lat,
    lon: point.lon,
    label: result.item.name,
    sublabel: addressLocality(result.item) || undefined,
  }
}

export function useGeoSearch({ limit = 20, namedLocationsOnly = true, debounceMs = 300 }: Options = {}) {
  const query = ref('')
  const near = ref<GeoPoint | null>(null)
  /** The point was put on the map by the user: only then may a point alone be completed from the outside geocoder. */
  const marked = ref(false)
  const results = ref<GeoResult[]>([])
  const place = ref<Place | null>(null)
  const searching = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let requestId = 0

  async function run() {
    const q = query.value.trim()
    const point = near.value
    const id = ++requestId
    searching.value = true
    try {
      if (!q && !point) {
        // Locations are a small, curated set (unlike addresses, which are an
        // unbounded imported dataset) -- always list them, even with nothing
        // typed and no point picked, so an already-created location can be
        // found without searching for it first. The ranked search needs text
        // or a point.
        const locations = await getLocationsGeoV1LocationsGet({
          limit,
          ...(namedLocationsOnly ? { name__isnull: false } : {}),
        })
        if (id !== requestId) return
        results.value = locations.data.items.map((item) => ({ kind: 'location' as const, item }))
        place.value = null
        return
      }
      const found = await searchGeoV2SearchGet({
        q: q || undefined,
        lat: point?.lat,
        lon: point?.lon,
        limit,
        named_locations_only: namedLocationsOnly,
        ...(q || marked.value ? {} : { external: 'off' as const }),
      })
      if (id !== requestId) return
      results.value = found.data.items.map(toGeoResult)
      place.value = found.data.place ?? null
    } catch {
      if (id === requestId) {
        results.value = []
        place.value = null
      }
    } finally {
      if (id === requestId) searching.value = false
    }
  }

  function refresh() {
    if (timer) clearTimeout(timer)
    run()
  }

  watch([query, near, marked], () => {
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
    marked.value = false
    results.value = []
    place.value = null
    searching.value = false
  }

  return { query, near, marked, results, place, searching, markers, clear, refresh }
}
