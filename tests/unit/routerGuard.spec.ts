import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setAccessToken } from '@/api/client'
import { resetBackendStatus, useBackendStatus } from '@/composables/useBackendStatus'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { jwt, stubBackend, type Reply } from './helpers/axiosStub'

vi.mock('@/views/UnavailablePage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/auth/LoginPage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/layout/TabsShell.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/main/HomePage.vue', () => ({ default: { render: () => null } }))

const REFRESH = '/user/v1/auth/jwt/refresh'
const signedIn: Reply = { status: 200, data: { access_token: jwt({ sub: 'u1', sup: false }) } }
const healthy: Reply = { status: 200, data: { status: 'ok' } }

let stub: ReturnType<typeof stubBackend>
let refresh: Reply[]
let health: Reply

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  setAccessToken(null)
  resetBackendStatus()
  health = healthy
  stub = stubBackend((config) => {
    if (config.url === REFRESH) return refresh.shift() ?? { status: 401 }
    if (config.url?.endsWith('/v1/health')) return health
    return { status: 200, data: { id: 'u1' } }
  })
})

afterEach(async () => {
  await router.replace('/unavailable')
  stub.restore()
  vi.useRealTimers()
})

async function go(path: string) {
  const navigation = router.push(path)
  await vi.advanceTimersByTimeAsync(5000)
  await navigation
}

test('holds the visitor on the waiting page, not on the login, while the backend is away', async () => {
  refresh = ['network']
  health = 'network'

  await go('/event/42?tab=info')

  expect(router.currentRoute.value.path).toBe('/unavailable')
  expect(router.currentRoute.value.query.next).toBe('/event/42?tab=info')
  expect(useBackendStatus().isDown('user')).toBe(true)
})

test('a glitch on a reachable backend costs one more try, not a waiting page', async () => {
  refresh = ['network', signedIn]

  await go('/')

  expect(router.currentRoute.value.path).toBe('/')
  expect(useAuthStore().isAuthenticated).toBe(true)
  expect(stub.to(REFRESH)).toHaveLength(2)
})

test('keeps the session when a reachable backend keeps answering the refresh with an error', async () => {
  refresh = [{ status: 500 }, { status: 500 }]

  await go('/')

  expect(router.currentRoute.value.path).toBe('/unavailable')
  expect(useBackendStatus().isDown('user')).toBe(false)
  expect(useAuthStore().isAuthenticated).toBe(false)
})

test('asks again after the backend is back and only then decides about the login', async () => {
  refresh = [{ status: 503 }]
  health = 'network'
  await go('/')
  expect(router.currentRoute.value.path).toBe('/unavailable')

  refresh = [{ status: 401 }]
  await go('/')

  expect(stub.to(REFRESH)).toHaveLength(2)
  expect(router.currentRoute.value.path).toBe('/auth/login')
})
