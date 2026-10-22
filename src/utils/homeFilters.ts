import type {
  EventFormatEnumV1,
  EventLevelEnumV1,
  EventRead,
  EventStatusEnumV1,
  EventTypeEnumV1,
  GetEventsEventV1EventsGetParams,
} from '@/api/generated/almaEventFlow'
import { formatOptions, levelOptions, statusOptions, typeOptions } from '@/utils/eventLabels'

export interface HomeFilterState {
  statuses: EventStatusEnumV1[]
  types: EventTypeEnumV1[]
  levels: EventLevelEnumV1[]
  formats: EventFormatEnumV1[]
  upcoming: boolean
}

export type HomeFilterQuery = Record<'statuses' | 'types' | 'levels' | 'formats' | 'upcoming', string>

export const ANY_STATUS = 'any'

export const HOME_FILTER_DEFAULTS: HomeFilterQuery = {
  statuses: 'active',
  types: '',
  levels: '',
  formats: '',
  upcoming: '',
}

export const LISTED_STATUSES: readonly EventStatusEnumV1[] = statusOptions
  .map(([value]) => value)
  .filter((value) => value !== 'template')

const TYPES = typeOptions.map(([value]) => value)
const LEVELS = levelOptions.map(([value]) => value)
const FORMATS = formatOptions.map(([value]) => value)

function parseList<T extends string>(raw: string, allowed: readonly T[]): T[] {
  const wanted = new Set(raw.split(','))
  return allowed.filter((value) => wanted.has(value))
}

export function parseHomeFilters(query: HomeFilterQuery): HomeFilterState {
  return {
    statuses: query.statuses === ANY_STATUS ? [] : parseList(query.statuses, LISTED_STATUSES),
    types: parseList(query.types, TYPES),
    levels: parseList(query.levels, LEVELS),
    formats: parseList(query.formats, FORMATS),
    upcoming: query.upcoming === '1',
  }
}

export function statusesToQuery(statuses: readonly EventStatusEnumV1[]): string {
  return statuses.length ? statuses.join(',') : ANY_STATUS
}

export function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function countActiveFilters(state: HomeFilterState, isPrincipal: boolean): number {
  const statusChanged =
    isPrincipal && !(state.statuses.length === 1 && state.statuses[0] === 'active')
  return [
    statusChanged,
    state.types.length > 0,
    state.levels.length > 0,
    state.formats.length > 0,
    state.upcoming,
  ].filter(Boolean).length
}

/** What the server is asked for; a participant sees active events only, nobody sees templates. */
export function homeFilterParams(
  state: HomeFilterState,
  isPrincipal: boolean,
  today: string,
): GetEventsEventV1EventsGetParams {
  const params: GetEventsEventV1EventsGetParams = {}
  if (isPrincipal) {
    params.status__in = (state.statuses.length ? state.statuses : LISTED_STATUSES).join(',')
  } else {
    params.status = 'active'
  }
  if (state.types.length) params.type__in = state.types.join(',')
  if (state.levels.length) params.level__in = state.levels.join(',')
  if (state.formats.length) params.format__in = state.formats.join(',')
  if (state.upcoming) params.date__gte = today
  return params
}

function includes<T extends string>(list: readonly T[], value: T | null | undefined): boolean {
  return value != null && list.includes(value)
}

export function matchesHomeFilters(
  event: EventRead,
  state: HomeFilterState,
  isPrincipal: boolean,
  today: string,
): boolean {
  if (event.status === 'template') return false
  if (!isPrincipal && event.status !== 'active') return false
  if (isPrincipal && state.statuses.length && !includes(state.statuses, event.status)) return false
  if (state.types.length && !includes(state.types, event.type)) return false
  if (state.levels.length && !includes(state.levels, event.level)) return false
  if (state.formats.length && !includes(state.formats, event.format)) return false
  if (state.upcoming && !(event.date && event.date >= today)) return false
  return true
}
