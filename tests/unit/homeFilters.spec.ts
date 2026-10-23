import { describe, expect, test } from 'vitest'
import type { EventCard } from '@/api/generated/almaEventFlow'
import {
  HOME_FILTER_DEFAULTS,
  countActiveFilters,
  homeFilterParams,
  matchesHomeFilters,
  parseHomeFilters,
  statusesToQuery,
  toggled,
  type HomeFilterQuery,
} from '@/utils/homeFilters'

const query = (patch: Partial<HomeFilterQuery> = {}): HomeFilterQuery => ({ ...HOME_FILTER_DEFAULTS, ...patch })
const TODAY = '2026-10-22'

function event(patch: Partial<EventCard>): EventCard {
  return {
    id: 'e1',
    name: 'Концерт',
    status: 'active',
    type: 'concert',
    level: 'internal',
    format: 'offline',
    date: TODAY,
    ...patch,
  } as EventCard
}

describe('parseHomeFilters', () => {
  test('the defaults show active events of every kind, past ones too', () => {
    expect(parseHomeFilters(query())).toEqual({
      statuses: ['active'],
      types: [],
      levels: [],
      formats: [],
      upcoming: false,
    })
  })

  test('reads lists and drops unknown names and repeats', () => {
    const state = parseHomeFilters(query({ types: 'play,concert,bogus,concert', levels: 'national', formats: 'online', upcoming: '1' }))

    expect(state.types).toEqual(['concert', 'play'])
    expect(state.levels).toEqual(['national'])
    expect(state.formats).toEqual(['online'])
    expect(state.upcoming).toBe(true)
  })

  test('"any" means every status, and templates can never be asked for', () => {
    expect(parseHomeFilters(query({ statuses: 'any' })).statuses).toEqual([])
    expect(parseHomeFilters(query({ statuses: 'template,draft' })).statuses).toEqual(['draft'])
  })

  test('statuses survive the round trip through the address bar', () => {
    for (const list of [[], ['active'], ['draft', 'archived']] as const) {
      expect(parseHomeFilters(query({ statuses: statusesToQuery(list) })).statuses).toEqual(list)
    }
  })
})

describe('toggled', () => {
  test('adds a missing value and removes a present one without touching the input', () => {
    const list = ['a', 'b']

    expect(toggled(list, 'c')).toEqual(['a', 'b', 'c'])
    expect(toggled(list, 'a')).toEqual(['b'])
    expect(list).toEqual(['a', 'b'])
  })
})

describe('homeFilterParams', () => {
  test('a participant asks for active events only', () => {
    expect(homeFilterParams(parseHomeFilters(query({ statuses: 'any' })), false, TODAY)).toEqual({ status: ['active'] })
  })

  test('a leader asks for the chosen statuses, never for templates', () => {
    expect(homeFilterParams(parseHomeFilters(query({ statuses: 'draft,active' })), true, TODAY).status).toEqual(['draft', 'active'])
    expect(homeFilterParams(parseHomeFilters(query({ statuses: 'any' })), true, TODAY).status).toEqual(['draft', 'active', 'archived'])
  })

  test('several types, levels and formats go as lists', () => {
    const params = homeFilterParams(parseHomeFilters(query({ types: 'concert,play', levels: 'regional,national', formats: 'online' })), false, TODAY)

    expect(params).toMatchObject({ type: ['concert', 'play'], level: ['regional', 'national'], format: ['online'] })
  })

  test('upcoming starts at today, otherwise there is no date bound', () => {
    expect(homeFilterParams(parseHomeFilters(query({ upcoming: '1' })), false, TODAY).date_from).toBe(TODAY)
    expect(homeFilterParams(parseHomeFilters(query()), false, TODAY).date_from).toBeUndefined()
  })
})

describe('matchesHomeFilters', () => {
  const none = parseHomeFilters(query({ statuses: 'any' }))

  test('a template is never listed', () => {
    expect(matchesHomeFilters(event({ status: 'template' }), none, true, TODAY)).toBe(false)
  })

  test('a participant sees active events only', () => {
    expect(matchesHomeFilters(event({ status: 'draft' }), none, false, TODAY)).toBe(false)
    expect(matchesHomeFilters(event({ status: 'draft' }), none, true, TODAY)).toBe(true)
  })

  test('an event matches when it is any one of the chosen values', () => {
    const state = parseHomeFilters(query({ types: 'concert,play', levels: 'national,regional' }))

    expect(matchesHomeFilters(event({ type: 'play', level: 'regional' }), state, false, TODAY)).toBe(true)
    expect(matchesHomeFilters(event({ type: 'festival', level: 'regional' }), state, false, TODAY)).toBe(false)
    expect(matchesHomeFilters(event({ type: 'play', level: 'internal' }), state, false, TODAY)).toBe(false)
  })

  test('upcoming keeps today and the future, and drops the past and undated events', () => {
    const state = parseHomeFilters(query({ upcoming: '1' }))

    expect(matchesHomeFilters(event({ date: TODAY }), state, false, TODAY)).toBe(true)
    expect(matchesHomeFilters(event({ date: '2026-12-01' }), state, false, TODAY)).toBe(true)
    expect(matchesHomeFilters(event({ date: '2026-10-21' }), state, false, TODAY)).toBe(false)
    expect(matchesHomeFilters(event({ date: null }), state, false, TODAY)).toBe(false)
  })
})

describe('countActiveFilters', () => {
  test('the defaults count as nothing changed', () => {
    expect(countActiveFilters(parseHomeFilters(query()), true)).toBe(0)
    expect(countActiveFilters(parseHomeFilters(query()), false)).toBe(0)
  })

  test('counts each changed facet once', () => {
    const state = parseHomeFilters(query({ statuses: 'any', types: 'concert,play', upcoming: '1' }))

    expect(countActiveFilters(state, true)).toBe(3)
    expect(countActiveFilters(state, false)).toBe(2)
  })
})
