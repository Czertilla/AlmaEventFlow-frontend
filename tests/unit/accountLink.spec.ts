import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LINK_ATTEMPTS, useAccountLink } from '@/composables/useAccountLink'
import { useAuthStore } from '@/stores/auth'
import { useMyProfileStore } from '@/stores/myProfile'
import { stubBackend } from './helpers/axiosStub'

const PROFILE = {
  id: 'p1', surname: 'Иванова', name: 'Мария', patronymic: null, birthdate: null, workplace_id: null,
  diet_id: null, diet: null, student: null, contacts: [], created_at: '2026-10-20T10:00:00Z', edited_at: null,
}

describe('account link check', () => {
  let backend: ReturnType<typeof stubBackend>
  let tryRefresh: ReturnType<typeof vi.spyOn>
  let linkedAfter: number

  beforeEach(async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    backend = stubBackend((config) =>
      config.url === '/profile/v3/profiles/my' ? { status: 200, data: PROFILE } : { status: 404 },
    )
    const auth = useAuthStore()
    auth.jwtPayload = { per: undefined }
    let refreshes = 0
    tryRefresh = vi.spyOn(auth, 'tryRefresh').mockImplementation(async () => {
      refreshes++
      if (refreshes >= linkedAfter) auth.jwtPayload = { per: 'p1' }
      return 'signed-in'
    })
    await useMyProfileStore().load()
  })

  afterEach(() => {
    backend.restore()
    vi.useRealTimers()
  })

  test('a token that already carries the profile needs no check', async () => {
    useAuthStore().jwtPayload = { per: 'p1' }
    const link = useAccountLink()

    await link.check()

    expect(link.status.value).toBe('ok')
    expect(backend.calls).toHaveLength(1)
  })

  test('asks the profile service again and picks the link up when it lands', async () => {
    linkedAfter = 2
    const link = useAccountLink()

    const done = link.check()
    expect(link.status.value).toBe('checking')
    await vi.runAllTimersAsync()
    await done

    expect(link.status.value).toBe('ok')
    expect(tryRefresh).toHaveBeenCalledTimes(2)
    expect(backend.to('/profile/v3/profiles/my')).toHaveLength(3)
  })

  test('gives up after a bounded number of attempts and can be started again', async () => {
    linkedAfter = Infinity
    const link = useAccountLink()

    const done = link.check()
    await vi.runAllTimersAsync()
    await done

    expect(link.status.value).toBe('failed')
    expect(tryRefresh).toHaveBeenCalledTimes(LINK_ATTEMPTS)

    linkedAfter = 0
    const again = link.start()
    await vi.runAllTimersAsync()
    await again

    expect(link.status.value).toBe('ok')
  })

  test('stop cancels a running check', async () => {
    linkedAfter = Infinity
    const link = useAccountLink()

    const done = link.check()
    link.stop()
    await vi.runAllTimersAsync()
    await done

    expect(link.status.value).toBe('checking')
    expect(tryRefresh.mock.calls.length).toBeLessThan(LINK_ATTEMPTS)
  })
})
