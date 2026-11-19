import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setAccessToken } from '@/api/client'
import { resetBackendStatus } from '@/composables/useBackendStatus'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { pendingCollective, rememberCollective } from '@/utils/quickStart'
import { jwt, stubBackend, type Reply } from './helpers/axiosStub'

vi.mock('@/views/UnavailablePage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/auth/LoginPage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/auth/RegisterPage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/auth/LinkInvitePage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/layout/TabsShell.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/main/HomePage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/CollectivePage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/SettingsPage.vue', () => ({ default: { render: () => null } }))

const ID = '0b5e6a1c-3f2d-4c8e-9a7b-1d2e3f4a5b6c'
const REFRESH = '/user/v1/auth/jwt/refresh'
const LOGIN = '/user/v1/auth/jwt/login'
const ME = '/user/v1/users/me'

const token = (per: string | null): Reply => ({ status: 200, data: { access_token: jwt({ sub: 'u1', per }) } })

let stub: ReturnType<typeof stubBackend>
let refresh: Reply[]
let me: { id: string; person_id: string | null }

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  setActivePinia(createPinia())
  setAccessToken(null)
  resetBackendStatus()
  me = { id: 'u1', person_id: null }
  stub = stubBackend((config) => {
    if (config.url === REFRESH) return refresh.shift() ?? { status: 401 }
    if (config.url === LOGIN) return token(null)
    if (config.url === ME) return { status: 200, data: me }
    if (config.url?.endsWith('/v1/health')) return { status: 200, data: { status: 'ok' } }
    return { status: 200, data: {} }
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

test('a visitor keeps the collective of the link on the registration page', async () => {
  refresh = [{ status: 401 }]

  await go(`/auth/register?collective=${ID}`)

  expect(router.currentRoute.value.path).toBe('/auth/register')
  expect(pendingCollective()).toBe(ID)
})

test('a forged collective in the link is ignored', async () => {
  refresh = [{ status: 401 }]

  await go('/auth/register?collective=%2Fadmin')

  expect(pendingCollective()).toBeNull()
})

test('a visitor sent to the sign-in from a collective page comes back to it', async () => {
  refresh = [{ status: 401 }]

  await go(`/collective/${ID}`)
  expect(router.currentRoute.value.path).toBe('/auth/login')
  expect(pendingCollective()).toBe(ID)

  await useAuthStore().login('ann@example.com', 'secret')
  await go('/')

  expect(router.currentRoute.value.path).toBe(`/collective/${ID}`)
  expect(pendingCollective()).toBeNull()
})

test('a signed-in user who opens the link lands on the collective at once', async () => {
  refresh = [token('p1')]

  await go(`/auth/register?collective=${ID}`)

  expect(router.currentRoute.value.path).toBe(`/collective/${ID}`)
  expect(pendingCollective()).toBeNull()
})

test('the link from the confirmation letter leads through the sign-in to the collective', async () => {
  refresh = [{ status: 401 }]
  await go(`/auth/login?collective=${ID}`)
  expect(router.currentRoute.value.path).toBe('/auth/login')

  me = { id: 'u1', person_id: 'p9' }
  refresh = [token('p9')]
  await useAuthStore().login('ann@example.com', 'secret')
  await go('/')

  expect(router.currentRoute.value.path).toBe(`/collective/${ID}`)
  expect(useAuthStore().jwtPayload?.per).toBe('p9')
  expect(stub.to(REFRESH)).toHaveLength(2)
})

test('the collective opens only once: a later visit home stays home', async () => {
  refresh = [token('p1')]
  await go('/settings')
  rememberCollective(ID)

  await go('/')

  expect(router.currentRoute.value.path).toBe('/')
  expect(pendingCollective()).toBe(ID)
})

test('an invitation link of a signed-in user still goes through linking first', async () => {
  refresh = [token(null)]

  await go(`/auth/register?token=abc&collective=${ID}`)

  expect(router.currentRoute.value.path).toBe('/auth/link-invite')
  expect(pendingCollective()).toBe(ID)

  await go('/')

  expect(router.currentRoute.value.path).toBe(`/collective/${ID}`)
})
