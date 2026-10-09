import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import apiClient, { getAccessToken, refreshAccessToken, setAccessToken } from '@/api/client'
import { resetBackendStatus, useBackendStatus } from '@/composables/useBackendStatus'
import { useAuthStore } from '@/stores/auth'
import { jwt, stubBackend, type Reply } from './helpers/axiosStub'

const REFRESH = '/user/v1/auth/jwt/refresh'
const ME = '/user/v1/users/me'
const EVENTS = '/event/v1/events'
const TOKEN = jwt({ sub: 'u1', sup: false })
const signedIn: Reply = { status: 200, data: { access_token: TOKEN } }
const healthy: Reply = { status: 200, data: { status: 'ok' } }

let stub: ReturnType<typeof stubBackend>

function backend(refresh: Reply[], other: () => Reply = () => ({ status: 200 }), health: Reply = healthy) {
  const refreshes = [...refresh]
  stub = stubBackend((config) => {
    if (config.url === REFRESH) return refreshes.shift() ?? { status: 401 }
    if (config.url === ME) return { status: 200, data: { id: 'u1' } }
    if (config.url?.endsWith('/v1/health')) return health
    return other()
  })
  return { auth: useAuthStore(), status: useBackendStatus() }
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  setAccessToken(null)
  resetBackendStatus()
})

afterEach(() => {
  stub.restore()
  vi.useRealTimers()
})

describe('tryRefresh', () => {
  test('signs the user in when the refresh cookie is good', async () => {
    const { auth } = backend([signedIn])

    expect(await auth.tryRefresh()).toBe('signed-in')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user).toEqual({ id: 'u1' })
  })

  test('signs the user out only when the backend rejects the refresh cookie', async () => {
    const { auth } = backend([{ status: 401 }])

    expect(await auth.tryRefresh()).toBe('signed-out')
    expect(auth.isAuthenticated).toBe(false)
  })

  test.each<[string, Reply, boolean]>([
    ['the network is down', 'network', true],
    ['the gateway answers 503', { status: 503 }, true],
    ['the service fails with 500', { status: 500 }, false],
  ])('does not decide anything about the session when %s', async (_name, reply, outage) => {
    const { auth, status } = backend([reply], undefined, 'network')

    expect(await auth.tryRefresh()).toBe('unknown')
    await vi.advanceTimersByTimeAsync(2500)

    expect(auth.isAuthenticated).toBe(false)
    expect(status.isDown('user')).toBe(outage)
  })

  test('a failed refresh is no outage while the health endpoint answers', async () => {
    const { auth, status } = backend(['network'])

    expect(await auth.tryRefresh()).toBe('unknown')
    await vi.advanceTimersByTimeAsync(10000)

    expect(status.isDown('user')).toBe(false)
  })

  test('keeps a signed-in user signed in while the backend is away', async () => {
    const { auth } = backend([signedIn, { status: 503 }])
    await auth.tryRefresh()

    await expect(refreshAccessToken()).rejects.toThrow()

    expect(auth.isAuthenticated).toBe(true)
    expect(getAccessToken()).toBe(TOKEN)
  })

  test('drops the token when the refresh cookie is rejected', async () => {
    const { auth } = backend([signedIn, { status: 401 }])
    await auth.tryRefresh()

    await expect(refreshAccessToken()).rejects.toThrow()

    expect(getAccessToken()).toBeNull()
  })

  test('sends one refresh no matter how many callers ask, because a reused token revokes the session', async () => {
    backend([signedIn])

    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken()])

    expect(tokens).toEqual([TOKEN, TOKEN])
    expect(stub.to(REFRESH)).toHaveLength(1)
  })
})

describe('the response interceptor', () => {
  test('replays a request that got a 401 with the refreshed token', async () => {
    const replies: Reply[] = [{ status: 401 }, { status: 200, data: { ok: true } }]
    backend([signedIn], () => replies.shift() ?? { status: 200 })

    const response = await apiClient.get(EVENTS)

    expect(response.data).toEqual({ ok: true })
    expect(stub.to(EVENTS)[1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  test('fails the request but keeps the token when the refresh cannot reach the backend', async () => {
    const { status } = backend([{ status: 503 }], () => ({ status: 401 }), 'network')
    setAccessToken(TOKEN)

    await expect(apiClient.get(EVENTS)).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(2500)

    expect(getAccessToken()).toBe(TOKEN)
    expect(status.isDown('user')).toBe(true)
  })

  test('marks a service down once its health stays silent, and up again on the next answer', async () => {
    const replies: Reply[] = [{ status: 503 }, { status: 500 }]
    const { status } = backend([], () => replies.shift() ?? { status: 200 }, 'network')

    await expect(apiClient.get(EVENTS)).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(2500)
    expect(status.isDown('event')).toBe(true)

    await expect(apiClient.get(EVENTS)).rejects.toThrow()
    expect(status.isDown('event')).toBe(false)
  })
})
