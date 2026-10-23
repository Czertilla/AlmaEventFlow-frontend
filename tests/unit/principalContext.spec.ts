import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePrincipalStore } from '@/stores/principal'
import { stubBackend } from './helpers/axiosStub'

const CONTEXT = '/event/v2/me/context'

function collective(patch: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Хор',
    is_verified: true,
    is_principal: false,
    member_id: null,
    member_is_active: null,
    roles: [],
    ...patch,
  }
}

describe('principal store: the collectives of the account', () => {
  let backend: ReturnType<typeof stubBackend>
  let answer: unknown[]

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    answer = [
      collective({ id: 'c1', name: 'Хор', is_principal: true }),
      collective({ id: 'c2', name: 'Оркестр', member_id: 'm2', member_is_active: true, roles: [{ id: 'r1', name: 'Тенор' }] }),
    ]
    backend = stubBackend((config) =>
      config.url === CONTEXT ? { status: 200, data: { person_id: 'p1', collectives: answer } } : { status: 404 },
    )
    useAuthStore().jwtPayload = { sub: 'u1' } as never
  })
  afterEach(() => backend.restore())

  test('one request gives the names, the leadership and the memberships', async () => {
    const store = usePrincipalStore()

    await store.fetchCollectives()

    expect(backend.to(CONTEXT)).toHaveLength(1)
    expect(backend.calls).toHaveLength(1)
    expect(store.collectives.map((c) => c.name)).toEqual(['Хор', 'Оркестр'])
    expect([...store.principalCollectiveIds]).toEqual(['c1'])
    expect(store.isPrincipal).toBe(true)
    expect([...store.userMemberIds]).toEqual([['c2', 'm2']])
    expect(store.memberships[1].roles).toEqual([{ id: 'r1', name: 'Тенор' }])
    expect(store.selectedCollectiveIds).toEqual(['c1', 'c2'])
  })

  test('calls that overlap share one request and a fresh answer is not asked for again', async () => {
    const store = usePrincipalStore()

    await Promise.all([store.fetchCollectives(), store.fetchCollectives()])
    await store.fetchCollectives()

    expect(backend.to(CONTEXT)).toHaveLength(1)
  })

  test('force asks again, and so does another account', async () => {
    const store = usePrincipalStore()
    await store.fetchCollectives()

    await store.fetchCollectives(true)
    expect(backend.to(CONTEXT)).toHaveLength(2)

    useAuthStore().jwtPayload = { sub: 'u2' } as never
    await store.fetchCollectives()
    expect(backend.to(CONTEXT)).toHaveLength(3)
  })

  test('an answer older than a minute is asked for again', async () => {
    vi.useFakeTimers()
    try {
      const store = usePrincipalStore()
      await store.fetchCollectives()

      vi.advanceTimersByTime(61_000)
      await store.fetchCollectives()

      expect(backend.to(CONTEXT)).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  test('signing out forgets the answer', async () => {
    const store = usePrincipalStore()
    await store.fetchCollectives()

    store.setCollectives([])
    await store.fetchCollectives()

    expect(backend.to(CONTEXT)).toHaveLength(2)
  })

  test('an account without collectives is a loaded state, not an error', async () => {
    answer = []
    const store = usePrincipalStore()

    await store.fetchCollectives()

    expect(store.collectives).toEqual([])
    expect(store.isPrincipal).toBe(false)
    expect(store.userMemberIds.size).toBe(0)
  })
})
