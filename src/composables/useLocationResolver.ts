import { ref } from 'vue'
import { createLocationFromAddressGeoV1LocationsFromAddressPost } from '@/api/generated/almaEventFlow'
import type { LocationRead } from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'
import type { GeoResult } from '@/composables/useGeoSearch'

export function useLocationResolver() {
  const { showError } = useToast()
  const resolving = ref(false)

  async function resolve(result: GeoResult): Promise<LocationRead | null> {
    if (result.kind === 'location') return result.item
    resolving.value = true
    try {
      const res = await createLocationFromAddressGeoV1LocationsFromAddressPost({
        address_id: result.item.id,
        name: null,
      })
      return res.data
    } catch (err) {
      showError(err, 'Не удалось выбрать адрес')
      return null
    } finally {
      resolving.value = false
    }
  }

  return { resolving, resolve }
}
