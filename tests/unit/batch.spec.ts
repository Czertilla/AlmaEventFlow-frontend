import { describe, expect, test, vi } from 'vitest'
import { createBatcher } from '@/utils/batch'

describe('createBatcher', () => {
  test('ids asked for in one tick go to one call', async () => {
    const load = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, id.toUpperCase()])))
    const get = createBatcher(load)

    const found = await Promise.all(['a', 'b', 'c'].map(get))

    expect(found).toEqual(['A', 'B', 'C'])
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith(['a', 'b', 'c'])
  })

  test('the same id twice is loaded once and answers both', async () => {
    const load = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, 1])))
    const get = createBatcher(load)

    const found = await Promise.all([get('a'), get('a')])

    expect(found).toEqual([1, 1])
    expect(load).toHaveBeenCalledWith(['a'])
  })

  test('an id the answer does not have is null, and the others still arrive', async () => {
    const get = createBatcher(async () => new Map([['a', 'A']]))

    expect(await Promise.all([get('a'), get('gone')])).toEqual(['A', null])
  })

  test('a long list is cut into calls of the limit', async () => {
    const load = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, id])))
    const get = createBatcher(load, 2)

    await Promise.all(['a', 'b', 'c', 'd', 'e'].map(get))

    expect(load.mock.calls.map(([ids]) => ids)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  test('a failed call rejects its ids only, and the next tick starts clean', async () => {
    let fail = true
    const get = createBatcher(async (ids: string[]) => {
      if (fail) throw new Error('down')
      return new Map(ids.map((id) => [id, id]))
    })

    await expect(Promise.all([get('a'), get('b')])).rejects.toThrow('down')
    fail = false

    expect(await get('a')).toBe('a')
  })

  test('ids from different ticks are different calls', async () => {
    const load = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, id])))
    const get = createBatcher(load)

    await get('a')
    await get('b')

    expect(load.mock.calls.map(([ids]) => ids)).toEqual([['a'], ['b']])
  })
})
