import {
  getLocationsGeoV2LocationsGet,
  getRecentLocationsEventV2CollectivesCollectiveIdRecentLocationsGet,
} from '@/api/generated/almaEventFlow'
import type { LocationRead } from '@/api/generated/almaEventFlow'

export const RECENT_LOCATIONS_LIMIT = 10

export async function fetchRecentLocations(
  collectiveId: string,
  limit = RECENT_LOCATIONS_LIMIT,
): Promise<LocationRead[]> {
  const recent = (await getRecentLocationsEventV2CollectivesCollectiveIdRecentLocationsGet(collectiveId, { limit })).data
  if (recent.length === 0) return []
  const found = await getLocationsGeoV2LocationsGet(
    { id: recent.map((item) => item.location_id) },
    { paramsSerializer: { indexes: null } },
  )
  return found.data
}

export function recentLoader(collectiveId: () => string | null | undefined): () => Promise<LocationRead[]> {
  return async () => {
    const id = collectiveId()
    if (!id) return []
    try {
      return await fetchRecentLocations(id)
    } catch {
      return []
    }
  }
}
