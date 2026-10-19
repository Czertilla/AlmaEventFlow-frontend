import axios from 'axios'
import { afterEach, describe, expect, test } from 'vitest'
import { fetchRecentLocations, recentLoader } from '@/composables/useRecentLocations'
import { stubBackend } from './helpers/axiosStub'

const GEO = [{ id: 'l2', name: 'Парк' }, { id: 'l1', name: 'Зал' }]
const USED = [
  { location_id: 'l2', used_at: '2026-03-01T10:00:00Z' },
  { location_id: 'l1', used_at: '2026-02-01T10:00:00Z' },
]

let backend: ReturnType<typeof stubBackend>

afterEach(() => backend.restore())

function serve(used: unknown[] = USED) {
  backend = stubBackend((config) => {
    if (config.url === '/event/v2/collectives/c1/recent-locations') return { status: 200, data: used }
    if (config.url === '/geo/v2/locations') return { status: 200, data: GEO }
    return { status: 404 }
  })
}

describe('fetchRecentLocations', () => {
  test('asks the event service for the collective, then geo for exactly those ids in that order', async () => {
    serve()

    const found = await fetchRecentLocations('c1', 5)

    expect(backend.calls.map((call) => call.url)).toEqual([
      '/event/v2/collectives/c1/recent-locations',
      '/geo/v2/locations',
    ])
    expect(backend.calls[0]!.params).toEqual({ limit: 5 })
    expect(backend.calls[1]!.params).toEqual({ id: ['l2', 'l1'] })
    expect(found).toEqual(GEO)
  })

  test('sends the ids the way FastAPI reads a repeated parameter', async () => {
    serve()

    await fetchRecentLocations('c1')

    const uri = axios.getUri(backend.calls[1]!)
    expect(uri).toContain('id=l2&id=l1')
    expect(uri).not.toContain('id[]')
  })

  test('a collective with no places never calls geo', async () => {
    serve([])

    expect(await fetchRecentLocations('c1')).toEqual([])
    expect(backend.calls.map((call) => call.url)).toEqual(['/event/v2/collectives/c1/recent-locations'])
  })
})

describe('recentLoader', () => {
  test('without a collective it asks nothing and finds nothing', async () => {
    serve()

    expect(await recentLoader(() => null)()).toEqual([])
    expect(backend.calls).toHaveLength(0)
  })

  test('reads the collective at the time it is called', async () => {
    serve()
    let id: string | null = null
    const load = recentLoader(() => id)

    expect(await load()).toEqual([])
    id = 'c1'
    expect(await load()).toEqual(GEO)
  })

  test('a failure is no places, not an error', async () => {
    backend = stubBackend(() => ({ status: 403 }))

    expect(await recentLoader(() => 'c1')()).toEqual([])
  })
})
