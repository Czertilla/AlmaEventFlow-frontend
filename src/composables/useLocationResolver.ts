import { ref } from 'vue'
import {
  createLocationFromAddressGeoV1LocationsFromAddressPost,
  createLocationGeoV2LocationsPost,
} from '@/api/generated/almaEventFlow'
import type { LocationRead } from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import type { GeoResult } from '@/composables/useGeoSearch'

const REMEMBERED = 50

/**
 * What the backend answered for an address or a text already used in this
 * page's session: choosing it again asks nothing. The backend gives one
 * location per address (and per text) anyway, so this only saves the request.
 */
const remembered = new Map<string, LocationRead>()

function remember(key: string, location: LocationRead) {
  remembered.delete(key)
  remembered.set(key, location)
  if (remembered.size > REMEMBERED) remembered.delete(remembered.keys().next().value as string)
}

export function forgetResolved() {
  remembered.clear()
}

export function useLocationResolver() {
  const { showError } = useToast()
  const resolving = ref(false)

  async function resolveOnce(key: string, ask: () => Promise<LocationRead>, failure: string) {
    const known = remembered.get(key)
    if (known) return known
    resolving.value = true
    try {
      const location = await ask()
      remember(key, location)
      return location
    } catch (err) {
      showError(err, failure)
      return null
    } finally {
      resolving.value = false
    }
  }

  async function resolve(result: GeoResult): Promise<LocationRead | null> {
    if (result.kind === 'location') return result.item
    const addressId = result.item.id
    return resolveOnce(
      `address:${addressId}`,
      async () =>
        (await createLocationFromAddressGeoV1LocationsFromAddressPost({ address_id: addressId, name: null })).data,
      'Не удалось выбрать адрес',
    )
  }

  /** The address as plain text, for a place nothing is known about on a map. */
  async function resolveText(text: string): Promise<LocationRead | null> {
    const name = text.trim().replace(/\s+/g, ' ')
    if (!name) return null
    return resolveOnce(
      `text:${name.toLowerCase()}`,
      async () => (await createLocationGeoV2LocationsPost({ name })).data,
      'Не удалось сохранить адрес',
    )
  }

  return { resolving, resolve, resolveText }
}
