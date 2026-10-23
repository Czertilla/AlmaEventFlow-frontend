import {
  getEventsEventV1EventsGet,
  getMembersEventV1MembersGet,
  getParticipationsEventV1ParticipationsGet,
  getRolesEventV1RolesGet,
  listCollectivesOrgV1CollectivesGet,
  getOrganizationOrgV1OrganizationsOrganizationIdGet,
  getCityGeoV1CitiesCityIdGet,
  getAddressGeoV1AddressesAddressIdGet,
  getLocationGeoV1LocationsLocationIdGet,
  getStudentGroupProfileV1StudentsGroupsGroupIdGet,
  getStudentDegreeProfileV1StudentsDegreesDegreeIdGet,
} from '@/api/generated/almaEventFlow'
import type { ParticipationRead } from '@/api/generated/almaEventFlow'
import { createBatcher } from '@/utils/batch'
import { resolvePersonName, resolveMemberName } from '@/utils/names'

export type ResourceKind =
  | 'person' | 'member' | 'memberInCollective' | 'collective' | 'event'
  | 'organization' | 'participation' | 'city' | 'address' | 'location' | 'role' | 'group' | 'degree'

// Кэш по типу ресурса -- имена меняются редко, как и в utils/names.ts.
// Неудачу не кешируем (см. resolvePersonName) -- единичный сетевой сбой
// не должен навсегда «приклеить» короткий id вместо имени на всю сессию.
const caches: Partial<Record<Exclude<ResourceKind, 'person' | 'member'>, Map<string, string | null>>> = {}
// Несколько ячеек таблицы часто резолвят один и тот же id одновременно (тот
// же коллектив/мероприятие в разных строках) -- без дедупа in-flight каждая
// бьёт по сети отдельно вместо того чтобы дождаться одного запроса.
const inFlight: Partial<Record<Exclude<ResourceKind, 'person' | 'member'>, Map<string, Promise<string | null>>>> = {}

function cacheFor(kind: Exclude<ResourceKind, 'person' | 'member'>): Map<string, string | null> {
  let cache = caches[kind]
  if (!cache) { cache = new Map(); caches[kind] = cache }
  return cache
}

function inFlightFor(kind: Exclude<ResourceKind, 'person' | 'member'>): Map<string, Promise<string | null>> {
  let map = inFlight[kind]
  if (!map) { map = new Map(); inFlight[kind] = map }
  return map
}

function cached(
  kind: Exclude<ResourceKind, 'person' | 'member'>,
  id: string,
  fetch: () => Promise<string | null>,
): Promise<string | null> {
  const cache = cacheFor(kind)
  if (cache.has(id)) return Promise.resolve(cache.get(id)!)
  const pending = inFlightFor(kind)
  const running = pending.get(id)
  if (running) return running
  const promise = (async () => {
    try {
      const name = await fetch()
      cache.set(id, name)
      return name
    } catch {
      return null
    } finally {
      pending.delete(id)
    }
  })()
  pending.set(id, promise)
  return promise
}

// Подписи для таблицы идут пачками: десяток строк с одним видом ресурса -- один запрос
// (списки принимают id__in), а не по запросу на строку.
const collectiveNames = createBatcher<string>(async (ids) => {
  const { data } = await listCollectivesOrgV1CollectivesGet({ id__in: ids.join(','), limit: ids.length })
  return new Map(data.items.map((c) => [c.id, c.name]))
})

const eventNames = createBatcher<string>(async (ids) => {
  const { data } = await getEventsEventV1EventsGet({ id__in: ids.join(','), limit: ids.length })
  return new Map(data.items.map((e) => [e.id, e.name]))
})

const participations = createBatcher<ParticipationRead>(async (ids) => {
  const { data } = await getParticipationsEventV1ParticipationsGet({ id__in: ids.join(','), limit: ids.length })
  return new Map(data.items.map((p) => [p.id, p]))
})

const roles = createBatcher<{ name: string; collective_id: string }>(async (ids) => {
  const { data } = await getRolesEventV1RolesGet({ id__in: ids.join(','), limit: ids.length })
  return new Map(data.items.map((r) => [r.id, { name: r.name, collective_id: r.collective_id }]))
})

const members = createBatcher<{ person_id: string; collective_id: string }>(async (ids) => {
  const { data } = await getMembersEventV1MembersGet({ id__in: ids.join(','), limit: ids.length, include_inactive: true })
  return new Map(data.items.map((m) => [m.id, { person_id: m.person_id, collective_id: m.collective_id }]))
})

async function resolveCollectiveName(id: string): Promise<string | null> {
  return cached('collective', id, () => collectiveNames(id))
}

async function resolveEventName(id: string): Promise<string | null> {
  return cached('event', id, () => eventNames(id))
}

async function resolveOrganizationName(id: string): Promise<string | null> {
  return cached('organization', id, async () => (await getOrganizationOrgV1OrganizationsOrganizationIdGet(id)).data.name)
}

async function resolveCityName(id: string): Promise<string | null> {
  return cached('city', id, async () => (await getCityGeoV1CitiesCityIdGet(Number(id))).data.name)
}

async function resolveAddressName(id: string): Promise<string | null> {
  return cached('address', id, async () => (await getAddressGeoV1AddressesAddressIdGet(id)).data.name)
}

// Участие само по себе безымянно -- составляем «Коллектив · Мероприятие».
// collective_name часто уже приходит денормализованным в самой записи участия.
async function resolveParticipationLabel(id: string): Promise<string | null> {
  return cached('participation', id, async () => {
    const data = await participations(id)
    if (!data) return null
    const [collective, event] = await Promise.all([
      data.collective_name ? Promise.resolve(data.collective_name) : resolveCollectiveName(data.collective_id),
      resolveEventName(data.event_id),
    ])
    const label = [collective, event].filter(Boolean).join(' · ')
    return label || null
  })
}

async function resolveGroupName(id: string): Promise<string | null> {
  return cached('group', id, async () => (await getStudentGroupProfileV1StudentsGroupsGroupIdGet(Number(id))).data.name)
}

async function resolveDegreeName(id: string): Promise<string | null> {
  return cached('degree', id, async () => (await getStudentDegreeProfileV1StudentsDegreesDegreeIdGet(Number(id))).data.name)
}

async function resolveLocationName(id: string): Promise<string | null> {
  return cached('location', id, async () => {
    const { data } = await getLocationGeoV1LocationsLocationIdGet(id)
    return data.display_name || data.name || data.address?.name || null
  })
}

// Роль живёт внутри коллектива, а названия вроде «Хормейстер» повторяются.
async function resolveRoleName(id: string): Promise<string | null> {
  return cached('role', id, async () => {
    const data = await roles(id)
    if (!data) return null
    const collective = await resolveCollectiveName(data.collective_id)
    return [data.name, collective].filter(Boolean).join(' · ')
  })
}

// Один человек состоит в нескольких коллективах: участник -- это «ФИО · Коллектив».
async function resolveMemberInCollective(id: string): Promise<string | null> {
  return cached('memberInCollective', id, async () => {
    const data = await members(id)
    if (!data) return null
    const [person, collective] = await Promise.all([
      resolvePersonName(data.person_id),
      resolveCollectiveName(data.collective_id),
    ])
    return [person, collective].filter(Boolean).join(' · ') || null
  })
}

const resolvers: Record<ResourceKind, (id: string) => Promise<string | null>> = {
  person: resolvePersonName,
  member: resolveMemberName,
  memberInCollective: resolveMemberInCollective,
  location: resolveLocationName,
  group: resolveGroupName,
  degree: resolveDegreeName,
  role: resolveRoleName,
  collective: resolveCollectiveName,
  event: resolveEventName,
  organization: resolveOrganizationName,
  participation: resolveParticipationLabel,
  city: resolveCityName,
  address: resolveAddressName,
}

export function resolveResourceLabel(kind: ResourceKind, id: string): Promise<string | null> {
  return resolvers[kind](id)
}
