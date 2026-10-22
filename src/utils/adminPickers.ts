import {
  getEventsEventV1EventsGet,
  getLocationsGeoV1LocationsGet,
  getMembersEventV1MembersGet,
  getParticipationsEventV1ParticipationsGet,
  getRolesEventV1RolesGet,
  getStudentDegreesProfileV1StudentsDegreesGet,
  getStudentGroupsProfileV1StudentsGroupsGet,
  listCollectivesOrgV1CollectivesGet,
  listFacultiesOrgV1FacultiesGet,
  listOrganizationsOrgV1OrganizationsGet,
  listUniversitiesOrgV1UniversitiesGet,
  searchPersonProfileV1PersonsGet,
} from '@/api/generated/almaEventFlow'
import { formatPersonName, resolvePersonName } from '@/utils/names'
import { resolveResourceLabel, type ResourceKind } from '@/utils/resourceLabels'

export interface PickerItem {
  id: string
  name: string
}

export interface PickerSource {
  kind: ResourceKind
  search: (query: string) => Promise<PickerItem[]>
}

const LIMIT = 20

async function named<T extends { id: string }>(items: T[], label: (item: T) => Promise<string>): Promise<PickerItem[]> {
  return Promise.all(items.map(async (item) => ({ id: item.id, name: await label(item) })))
}

export const PICKERS = {
  collective: {
    kind: 'collective',
    search: async (search) =>
      (await listCollectivesOrgV1CollectivesGet({ search, limit: LIMIT })).data.items.map((c) => ({ id: c.id, name: c.name })),
  },
  organization: {
    kind: 'organization',
    search: async (search) =>
      (await listOrganizationsOrgV1OrganizationsGet({ search, limit: LIMIT })).data.items.map((o) => ({ id: o.id, name: o.name })),
  },
  faculty: {
    kind: 'organization',
    search: async (search) =>
      (await listFacultiesOrgV1FacultiesGet({ search, limit: LIMIT })).data.items.map((f) => ({ id: f.id, name: f.name })),
  },
  university: {
    kind: 'organization',
    search: async (search) =>
      (await listUniversitiesOrgV1UniversitiesGet({ search, limit: LIMIT })).data.items.map((u) => ({ id: u.id, name: u.name })),
  },
  degree: {
    kind: 'degree',
    search: async (search) =>
      (await getStudentDegreesProfileV1StudentsDegreesGet({ search, limit: LIMIT })).data.items.map((d) => ({ id: String(d.id), name: d.name })),
  },
  group: {
    kind: 'group',
    search: async (search) =>
      (await getStudentGroupsProfileV1StudentsGroupsGet({ search, limit: LIMIT })).data.items.map((g) => ({ id: String(g.id), name: g.name })),
  },
  event: {
    kind: 'event',
    search: async (search) =>
      (await getEventsEventV1EventsGet({ search, limit: LIMIT })).data.items.map((e) => ({ id: e.id, name: e.name })),
  },
  person: {
    kind: 'person',
    search: async (search) =>
      (await searchPersonProfileV1PersonsGet({ search, limit: LIMIT })).data.items.map((p) => ({ id: p.id, name: formatPersonName(p) })),
  },
  member: {
    kind: 'memberInCollective',
    search: async (search) => {
      const { data } = await getMembersEventV1MembersGet({ search, limit: LIMIT, include_inactive: true })
      return named(data.items, async (m) => {
        const [person, collective] = await Promise.all([
          resolvePersonName(m.person_id),
          resolveResourceLabel('collective', m.collective_id),
        ])
        return [person, collective].filter(Boolean).join(' · ') || m.id
      })
    },
  },
  participation: {
    kind: 'participation',
    search: async (search) => {
      const { data } = await getParticipationsEventV1ParticipationsGet({ search, limit: LIMIT })
      return named(data.items, async (p) => {
        const [collective, event] = await Promise.all([
          p.collective_name ?? resolveResourceLabel('collective', p.collective_id),
          resolveResourceLabel('event', p.event_id),
        ])
        return [collective, event].filter(Boolean).join(' · ') || p.id
      })
    },
  },
  location: {
    kind: 'location',
    search: async (search) =>
      (await getLocationsGeoV1LocationsGet({ search, limit: LIMIT, name__isnull: false })).data.items.map((l) => ({
        id: l.id,
        name: l.display_name || l.name || l.id,
      })),
  },
  role: {
    kind: 'role',
    search: async (search) => {
      const { data } = await getRolesEventV1RolesGet({ search, limit: LIMIT })
      return named(data.items, async (r) => {
        const collective = await resolveResourceLabel('collective', r.collective_id)
        return [r.name, collective].filter(Boolean).join(' · ')
      })
    },
  },
} satisfies Record<string, PickerSource>

export type PickerName = keyof typeof PICKERS
