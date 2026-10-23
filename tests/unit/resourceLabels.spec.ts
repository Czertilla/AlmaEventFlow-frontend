import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { resolveResourceLabel } from '@/utils/resourceLabels'
import { stubBackend, type Reply } from './helpers/axiosStub'

let backend: ReturnType<typeof stubBackend>
let org: Reply

const ids = (call: { params?: Record<string, string> }) => (call.params?.id__in ?? '').split(',')

beforeEach(() => {
  org = { status: 200, data: { items: [], pagination: { total: 0 } } }
  backend = stubBackend((config) => {
    if (config.url === '/org/v1/collectives') {
      const asked = ids(config as { params?: Record<string, string> })
      const reply = org
      if (reply !== 'network' && reply.status === 200 && (reply.data as { items: unknown[] }).items.length === 0) {
        return {
          status: 200,
          data: { items: asked.map((id) => ({ id, name: `Коллектив ${id}` })), pagination: { total: asked.length } },
        }
      }
      return reply
    }
    if (config.url === '/event/v1/events') {
      const asked = ids(config as { params?: Record<string, string> })
      return { status: 200, data: { items: asked.filter((id) => id !== 'gone').map((id) => ({ id, name: `Событие ${id}` })), pagination: { total: 1 } } }
    }
    return { status: 404 }
  })
})
afterEach(() => backend.restore())

describe('labels of the resources of an admin table', () => {
  test('the rows of one kind ask once for all their ids', async () => {
    const names = await Promise.all(['c1', 'c2', 'c3'].map((id) => resolveResourceLabel('collective', id)))

    expect(names).toEqual(['Коллектив c1', 'Коллектив c2', 'Коллектив c3'])
    expect(backend.calls).toHaveLength(1)
    expect(backend.calls[0].params).toEqual({ id__in: 'c1,c2,c3', limit: 3 })
  })

  test('a name already known is not asked for again', async () => {
    await resolveResourceLabel('collective', 'k1')
    await Promise.all([resolveResourceLabel('collective', 'k1'), resolveResourceLabel('collective', 'k2')])

    expect(backend.calls.map((c) => (c.params as { id__in: string }).id__in)).toEqual(['k1', 'k2'])
  })

  test('different kinds do not wait for each other', async () => {
    const [collective, event] = await Promise.all([
      resolveResourceLabel('collective', 'x1'),
      resolveResourceLabel('event', 'x2'),
    ])

    expect([collective, event]).toEqual(['Коллектив x1', 'Событие x2'])
    expect(backend.calls.map((c) => c.url).sort()).toEqual(['/event/v1/events', '/org/v1/collectives'])
  })

  test('a record that no longer exists has no name, the others do', async () => {
    const [kept, gone] = await Promise.all([resolveResourceLabel('event', 'y1'), resolveResourceLabel('event', 'gone')])

    expect([kept, gone]).toEqual(['Событие y1', null])
  })

  test('a failed request leaves no name behind and the next try asks again', async () => {
    org = 'network'

    expect(await resolveResourceLabel('collective', 'z1')).toBeNull()

    org = { status: 200, data: { items: [], pagination: { total: 0 } } }
    const before = backend.calls.length
    expect(await resolveResourceLabel('collective', 'z1')).toBe('Коллектив z1')
    expect(backend.calls).toHaveLength(before + 1)
  })
})
