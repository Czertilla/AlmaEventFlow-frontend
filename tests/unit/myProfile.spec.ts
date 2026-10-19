import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useMyProfileStore } from '@/stores/myProfile'
import { jwt, stubBackend } from './helpers/axiosStub'

const PROFILE = {
  id: 'p1', surname: 'Иванова', name: 'Мария', patronymic: null, birthdate: null, workplace_id: null,
  diet_id: null, diet: null, student: null, contacts: [], created_at: '2026-10-20T10:00:00Z', edited_at: null,
}
const FORM = { surname: 'Иванова', name: 'Мария' }

describe('my profile store', () => {
  let backend: ReturnType<typeof stubBackend>
  let exists: boolean

  beforeEach(() => {
    setActivePinia(createPinia())
    exists = false
    backend = stubBackend((config) => {
      if (config.url !== '/profile/v2/profiles/my') return { status: 404 }
      if (config.method === 'get') return exists ? { status: 200, data: PROFILE } : { status: 404, data: { detail: 'PROFILE_NOT_FOUND' } }
      exists = true
      return { status: 200, data: PROFILE }
    })
  })
  afterEach(() => backend.restore())

  test('a missing profile is a loaded state with nothing in it, not a failure', async () => {
    const store = useMyProfileStore()

    await store.load()

    expect(store.loaded).toBe(true)
    expect(store.failed).toBe(false)
    expect(store.profile).toBeNull()
  })

  test('a failed request is a failure and is not taken for "no profile"', async () => {
    backend.restore()
    backend = stubBackend(() => ({ status: 500 }))
    const store = useMyProfileStore()

    await store.load()

    expect(store.failed).toBe(true)
    expect(store.loaded).toBe(false)
    expect(store.profile).toBeNull()
  })

  test('the first save creates the profile, the next ones replace it', async () => {
    const store = useMyProfileStore()
    await store.load()

    await store.save(FORM)
    await store.save({ ...FORM, name: 'Анна' })

    const writes = backend.calls.filter((call) => call.method !== 'get')
    expect(writes.map((call) => call.method)).toEqual(['post', 'put'])
    expect(store.profile?.id).toBe('p1')
  })

  test('a profile that is already loaded is not asked for again unless forced', async () => {
    exists = true
    const store = useMyProfileStore()

    await store.load()
    await store.load()
    await store.load(true)

    expect(backend.calls.filter((call) => call.method === 'get')).toHaveLength(2)
  })

  test('the token is refreshed when it does not carry the profile', async () => {
    exists = true
    const auth = useAuthStore()
    const tryRefresh = vi.spyOn(auth, 'tryRefresh').mockResolvedValue('signed-in')
    const store = useMyProfileStore()
    await store.load()

    auth.jwtPayload = { per: 'someone-else' }
    await store.syncToken()
    auth.jwtPayload = { per: 'p1' }
    await store.syncToken()

    expect(tryRefresh).toHaveBeenCalledTimes(1)
    expect(jwt({})).toContain('.')
  })

  test('the stored profile is dropped on reset', async () => {
    exists = true
    const store = useMyProfileStore()
    await store.load()

    store.reset()

    expect(store.profile).toBeNull()
    expect(store.loaded).toBe(false)
  })
})
