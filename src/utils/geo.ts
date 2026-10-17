import type { LocationRead } from '@/api/generated/almaEventFlow'

export interface Coordinates {
  lat: number
  lon: number
}

const EARTH_RADIUS_M = 6_371_000

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = rad(to.lat - from.lat)
  const dLon = rad(to.lon - from.lon)
  const half =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(half))
}

type Anchors = Pick<LocationRead, 'name' | 'spot' | 'address_id' | 'address'>

/** Where a location is on a map: its own point, else its address's. */
export function locationPoint(location: Pick<LocationRead, 'spot' | 'address'>): Coordinates | null {
  const point = location.spot ?? location.address?.spot
  return point ? { lat: point.lat, lon: point.lon } : null
}

/** Made only to attach an address to an event: it has no name, the address is all it says. */
export function isAddressOnly(location: Anchors): boolean {
  return !location.name && !!(location.address_id || location.address)
}

/** The address written as plain text: a name, and no address or point behind it. */
export function isTextOnly(location: Anchors): boolean {
  return !!location.name && !location.spot && !location.address_id && !location.address
}

export type LocationKind = 'named' | 'address' | 'all'

/** What the location list asks the backend for: the nameless address-only ones are left out unless wanted. */
export function locationKindParams(kind: string | null | undefined): { name__isnull?: boolean } {
  if (kind === 'all') return {}
  return { name__isnull: kind === 'address' }
}

/** "120 м" under a kilometre, "1,2 км" above, "15 км" from ten. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return ''
  const tens = Math.round(meters / 10) * 10
  if (tens < 1000) return `${Math.max(10, tens)} м`
  const km = meters / 1000
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} км` : `${Math.round(km)} км`
}
