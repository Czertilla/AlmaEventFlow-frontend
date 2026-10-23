import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { EventPageRead, PageAttendance, PageParticipation, RosterMember } from '@/api/generated/almaEventFlow'
import { saveRoleOrder } from '@/utils/roleSort'
import { stubBackend, type Reply } from './helpers/axiosStub'

const replace = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showMessage: vi.fn() }),
}))
vi.mock('@/utils/confirm', () => ({ confirmAction: async () => true }))

const { useEventParticipations } = await import('@/composables/useEventParticipations')
const { usePrincipalStore } = await import('@/stores/principal')

function member(id: string, surname: string, roles: { id: string; name: string }[] = [], active = true): RosterMember {
  return { id, person: { id: `person-${id}`, surname, name: 'Иван', patronymic: 'Петрович' }, is_active: active, roles }
}

function place(id: string, who: RosterMember, patch: Partial<PageAttendance> = {}): PageAttendance {
  return {
    id,
    member_id: who.id,
    participation_id: 'p1',
    is_attended: false,
    is_verified: false,
    comment: null,
    created_at: '2026-10-20T10:00:00Z',
    edited_at: null,
    member: who,
    ...patch,
  }
}

// What the server sends for a place: the row without the member of the page
function row(attendance: PageAttendance, patch: Record<string, unknown> = {}) {
  const plain: Partial<PageAttendance> = { ...attendance }
  delete plain.member
  return { ...plain, ...patch }
}

const TENOR = { id: 'r-tenor', name: 'Тенор' }
const BASS = { id: 'r-bass', name: 'Бас' }
const abramov = member('m1', 'Абрамов', [BASS])
const zorin = member('m2', 'Зорин', [TENOR])
const idle = member('m3', 'Бездельников')
const left = member('m4', 'Ушаков', [], false)

function participation(patch: Partial<PageParticipation> = {}): PageParticipation {
  return {
    id: 'p1',
    collective_id: 'c1',
    collective_name: 'Хор',
    priority_degree: null,
    is_principal: true,
    is_member: false,
    can_view_attendances: true,
    attended_count: 0,
    total_count: 2,
    my_attendance_id: null,
    attendances: [place('a1', zorin), place('a2', abramov)],
    addable_members: [idle],
    ...patch,
  }
}

function page(participations: PageParticipation[] = [participation()]): EventPageRead {
  return {
    event: {
      id: 'e1', name: 'Концерт', date: '2026-10-22', description: null, status: 'active', level: null, type: null,
      format: 'offline', organizer_id: null, location_id: null, location: null,
      created_at: '2026-10-20T10:00:00Z', edited_at: null,
    },
    stages: [],
    participations,
    editable_collective_id: participations.find((p) => p.is_principal)?.collective_id ?? null,
  }
}

let backend: ReturnType<typeof stubBackend>
let served: EventPageRead
let handler: (url: string, method: string, body: Record<string, unknown>) => Reply | undefined

beforeEach(() => {
  localStorage.clear()
  replace.mockClear()
  setActivePinia(createPinia())
  served = page()
  handler = () => undefined
  backend = stubBackend((config) => {
    const body = config.data ? (JSON.parse(config.data as string) as Record<string, unknown>) : {}
    const custom = handler(config.url ?? '', config.method ?? 'get', body)
    if (custom) return custom
    if (config.url === '/event/v2/events/e1') return { status: 200, data: served }
    return { status: 404 }
  })
})
afterEach(() => backend.restore())

async function opened() {
  const events = useEventParticipations('e1')
  await events.loadPage()
  return events
}

describe('the page of an event', () => {
  test('one request brings the event, the collectives and the places with the names', async () => {
    const events = await opened()

    expect(backend.calls).toHaveLength(1)
    const [item] = events.participationItems.value
    expect(item.collectiveName).toBe('Хор')
    expect(item.isPrincipal && item.canExpand).toBe(true)
    expect(events.memberText('m1')).toBe('Абрамов И.П.')
    expect(events.editableCollectiveId.value).toBe('c1')
    expect(events.availableMembers(item).map((m) => m.id)).toEqual(['m3'])
  })

  test('the own place is found by id and a stranger has no places to open', async () => {
    served = page([
      participation({ id: 'p1', is_principal: false, is_member: true, my_attendance_id: 'a1' }),
      participation({
        id: 'p2', collective_id: 'c2', collective_name: 'Оркестр', is_principal: false, can_view_attendances: false,
        attended_count: null, total_count: null, attendances: [], addable_members: [],
      }),
    ])

    const [mine, other] = (await opened()).participationItems.value

    expect(mine.myAttendance?.id).toBe('a1')
    expect(other.canExpand).toBe(false)
    expect(other.attendances).toEqual([])
  })

  test('places are grouped by the role order the leader set, alphabetically within a group', async () => {
    saveRoleOrder('c1', ['r-tenor', 'r-bass'])
    const events = await opened()

    const groups = events.attendanceGroups(events.participationItems.value[0])

    expect(groups.map((g) => [g.label, g.items.map((a) => a.member_id)])).toEqual([
      ['Тенор', ['m2']],
      ['Бас', ['m1']],
    ])
  })

  test('without a saved order the places are one list by name', async () => {
    const events = await opened()

    const groups = events.attendanceGroups(events.participationItems.value[0])

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((a) => a.member_id)).toEqual(['m1', 'm2'])
  })
})

describe('changing a place', () => {
  test('the answer updates the place and the counters, nothing is loaded again', async () => {
    handler = (url, method, body) =>
      url === '/event/v2/attendances/a1' && method === 'patch'
        ? {
            status: 200,
            data: {
              attendance: row(place('a1', zorin), { is_attended: body.is_attended, edited_at: '2026-10-22T12:00:00Z' }),
              participation: { id: 'p1', event_id: 'e1', collective_id: 'c1', attended_count: 1, total_count: 2 },
            },
          }
        : undefined
    const events = await opened()
    const [item] = events.participationItems.value

    await events.toggleAttendance(item, item.attendances[0], true)

    const [after] = events.participationItems.value
    expect(after.attendances[0]).toMatchObject({ id: 'a1', is_attended: true, edited_at: '2026-10-22T12:00:00Z' })
    expect(after.attendances[0].member.person.surname).toBe('Зорин')
    expect(events.page.value?.participations[0]).toMatchObject({ attended_count: 1, total_count: 2 })
    expect(backend.calls.map((c) => c.method)).toEqual(['get', 'patch'])
  })

  test('the verification goes through the same endpoint under its own pending key', async () => {
    handler = (url, method) =>
      url === '/event/v2/attendances/a1' && method === 'patch'
        ? {
            status: 200,
            data: {
              attendance: row(place('a1', zorin), { is_verified: true }),
              participation: { id: 'p1', event_id: 'e1', collective_id: 'c1', attended_count: 0, total_count: 2 },
            },
          }
        : undefined
    const events = await opened()
    const [item] = events.participationItems.value

    const request = events.toggleVerify(item, item.attendances[0])
    expect(events.pending.has('verify:a1')).toBe(true)
    await request

    expect(events.pending.size).toBe(0)
    expect(JSON.parse(backend.calls[1].data as string)).toEqual({ is_verified: true })
    expect(events.participationItems.value[0].attendances[0].is_verified).toBe(true)
  })
})

describe('adding and removing places', () => {
  test('a member without a place gets one that waits for a mark and leaves the list of those who can be added', async () => {
    handler = (url, method, body) =>
      url === '/event/v2/attendances' && method === 'post'
        ? {
            status: 200,
            data: {
              attendance: { id: 'a3', member_id: body.member_id, participation_id: body.participation_id, is_attended: null, is_verified: false, comment: null, created_at: '2026-10-22T12:00:00Z', edited_at: null },
              participation: { id: 'p1', event_id: 'e1', collective_id: 'c1', attended_count: 0, total_count: 3 },
            },
          }
        : undefined
    const events = await opened()
    const [item] = events.participationItems.value
    events.addMemberSel.p1 = 'm3'

    await events.addAttendance(item)

    const [after] = events.participationItems.value
    expect(after.attendances.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect(after.attendances[2].is_attended).toBeNull()
    expect(after.attendances[2].member.person.surname).toBe('Бездельников')
    expect(after.addableMembers).toEqual([])
    expect(events.page.value?.participations[0]).toMatchObject({ attended_count: 0, total_count: 3 })
    expect(events.addMemberSel.p1).toBe('')
    expect(JSON.parse(backend.calls[1].data as string)).toEqual({ participation_id: 'p1', member_id: 'm3' })
    expect(backend.calls).toHaveLength(2)
  })

  test('a removed place gives an active member back and not a former one', async () => {
    served = page([participation({ attendances: [place('a1', zorin), place('a4', left)], addable_members: [] })])
    handler = (url, method) =>
      url.startsWith('/event/v1/me/collectives/c1/attendance/') && method === 'delete' ? { status: 200 } : undefined
    const events = await opened()
    const [item] = events.participationItems.value

    await events.removeAttendance(item, item.attendances[0])
    await events.removeAttendance(events.participationItems.value[0], events.participationItems.value[0].attendances[0])

    const [after] = events.participationItems.value
    expect(after.attendances).toEqual([])
    expect(after.addableMembers.map((m) => m.id)).toEqual(['m2'])
    expect(events.page.value?.participations[0].total_count).toBe(0)
  })

  test('verifying every place takes the answer for the rows', async () => {
    handler = (url, method) =>
      url === '/event/v1/me/collectives/c1/participation/p1/attendance/verify' && method === 'post'
        ? {
            status: 200,
            data: [
              { id: 'a1', member_id: 'm2', participation_id: 'p1', is_attended: true, is_verified: true, comment: null, created_at: '2026-10-20T10:00:00Z', edited_at: null },
              { id: 'a2', member_id: 'm1', participation_id: 'p1', is_attended: false, is_verified: true, comment: null, created_at: '2026-10-20T10:00:00Z', edited_at: null },
            ],
          }
        : undefined
    const events = await opened()

    await events.verifyAll(events.participationItems.value[0])

    expect(events.participationItems.value[0].attendances.map((a) => a.is_verified)).toEqual([true, true])
    expect(events.participationItems.value[0].attendances[0].member.person.surname).toBe('Зорин')
  })
})

describe('leaving the event', () => {
  test('the last collective takes the event with it and the page goes home', async () => {
    handler = (url, method) =>
      url === '/event/v1/me/collectives/c1/participations/e1' && method === 'delete' ? { status: 200 } : undefined
    const events = await opened()

    await events.cancelParticipation(events.participationItems.value[0])

    expect(replace).toHaveBeenCalledWith('/')
    expect(backend.calls.map((c) => c.method)).toEqual(['get', 'delete'])
  })

  test('one of several collectives leaves and the page is loaded again', async () => {
    served = page([participation(), participation({ id: 'p2', collective_id: 'c2', collective_name: 'Оркестр', is_principal: false })])
    handler = (url, method) =>
      url === '/event/v1/me/collectives/c1/participations/e1' && method === 'delete'
        ? { status: 200 }
        : undefined
    const events = await opened()
    served = page([participation({ id: 'p2', collective_id: 'c2', collective_name: 'Оркестр', is_principal: false })])

    await events.cancelParticipation(events.participationItems.value[0])

    expect(replace).not.toHaveBeenCalled()
    expect(events.participationItems.value.map((p) => p.collectiveId)).toEqual(['c2'])
  })

  test('the collectives of the leader that are not in the event can join it', async () => {
    const principal = usePrincipalStore()
    principal.setCollectives(
      [{ id: 'c1', name: 'Хор' }, { id: 'c9', name: 'Джаз' }],
      ['c1', 'c9'],
    )

    const events = await opened()

    expect(events.joinableCollectives.value.map((c) => c.id)).toEqual(['c9'])
  })
})
