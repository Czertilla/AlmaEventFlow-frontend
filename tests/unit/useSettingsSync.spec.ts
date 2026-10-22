import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { useSettingsSync } from '@/composables/useSettingsSync'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { stubBackend, type Reply } from './helpers/axiosStub'

const URL = '/user/v2/users/me/settings'

let server: { values: Record<string, unknown>; revision: number }
let stub: ReturnType<typeof stubBackend>
let scope: EffectScope
let patchFails = false

function backend() {
  stub = stubBackend((config): Reply => {
    if (config.url !== URL) return { status: 404 }
    if (config.method === 'patch') {
      if (patchFails) return 'network'
      const body = JSON.parse(config.data as string) as { values: Record<string, unknown> }
      for (const [key, value] of Object.entries(body.values)) {
        if (value === null) delete server.values[key]
        else server.values[key] = value
      }
      server.revision++
    }
    return { status: 200, data: { values: { ...server.values }, revision: server.revision, edited_at: null } }
  })
}

const patches = () => stub.calls.filter((call) => call.method === 'patch')
const reads = () => stub.calls.filter((call) => call.method === 'get')
const sentValues = (index: number) => (JSON.parse(patches()[index].data as string) as { values: unknown }).values

async function settle(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms)
}

async function signIn(sub = 'u1') {
  scope = effectScope()
  scope.run(() => {
    setActivePinia(pinia)
    useSettingsSync()
  })
  useAuthStore().jwtPayload = { sub } as never
  await settle()
}

let pinia: ReturnType<typeof createPinia>

function appStores() {
  pinia = createPinia()
  setActivePinia(pinia)
  return { settings: useSettingsStore(), auth: useAuthStore() }
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  server = { values: {}, revision: 0 }
  patchFails = false
  backend()
})

afterEach(() => {
  scope?.stop()
  stub.restore()
  vi.useRealTimers()
})

describe('after signing in', () => {
  test('the settings of the account replace the ones of the device', async () => {
    server = { values: { theme: 'dark', showHints: false }, revision: 4 }
    const { settings } = appStores()

    await signIn()

    expect(settings.theme).toBe('dark')
    expect(settings.showHints).toBe(false)
    expect(patches()).toHaveLength(0)
  })

  test('a value of the wrong shape or an unknown name changes nothing', async () => {
    server = { values: { theme: 'purple', futureSetting: 1, dateFormat: 'YYYY-MM-DD' }, revision: 2 }
    const { settings } = appStores()

    await signIn()

    expect(settings.theme).toBe('light')
    expect(settings.dateFormat).toBe('YYYY-MM-DD')
  })

  test('what the person chose here before sync existed is sent, and nothing else', async () => {
    localStorage.setItem('firstDayOfWeek', JSON.stringify('sunday'))
    appStores()

    await signIn()

    expect(patches()).toHaveLength(1)
    expect(sentValues(0)).toEqual({ firstDayOfWeek: 'sunday' })
    expect(server.values).toEqual({ firstDayOfWeek: 'sunday' })
  })

  test('a choice made here loses to the server only where the server has an answer', async () => {
    localStorage.setItem('firstDayOfWeek', JSON.stringify('sunday'))
    localStorage.setItem('showHints', JSON.stringify(false))
    server = { values: { showHints: true }, revision: 1 }
    const { settings } = appStores()

    await signIn()

    expect(settings.showHints).toBe(true)
    expect(settings.firstDayOfWeek).toBe('sunday')
    expect(sentValues(0)).toEqual({ firstDayOfWeek: 'sunday' })
  })

  test('another account on the same browser does not leak its choices into this one', async () => {
    localStorage.setItem('theme', JSON.stringify('dark'))
    localStorage.setItem('settingsSync', JSON.stringify({ owner: 'u1', revision: 3, dirty: ['theme'] }))
    server = { values: { theme: 'light' }, revision: 1 }
    const { settings } = appStores()

    await signIn('u2')

    expect(patches()).toHaveLength(0)
    expect(settings.theme).toBe('light')
  })
})

describe('changing a setting', () => {
  test('sends only that setting, after a short pause', async () => {
    server = { values: { theme: 'dark' }, revision: 1 }
    const { settings } = appStores()
    await signIn()

    settings.firstDayOfWeek = 'sunday'
    await settle(300)
    expect(patches()).toHaveLength(0)

    await settle(600)
    expect(patches()).toHaveLength(1)
    expect(sentValues(0)).toEqual({ firstDayOfWeek: 'sunday' })
    expect(JSON.parse(localStorage.getItem('settingsSync') ?? '{}')).toMatchObject({ owner: 'u1', dirty: [] })
  })

  test('several quick changes go in one request', async () => {
    const { settings } = appStores()
    await signIn()

    settings.showHints = false
    settings.collapseOnScroll = false
    settings.showHints = true
    await settle(1000)

    expect(patches()).toHaveLength(1)
    expect(sentValues(0)).toEqual({ showHints: true, collapseOnScroll: false })
  })

  test('a change nobody made is never sent: applying the server values does not echo', async () => {
    server = { values: { theme: 'dark', animations: 'off' }, revision: 2 }
    appStores()
    await signIn()

    await settle(2000)

    expect(patches()).toHaveLength(0)
  })

  test('a change that could not be sent is sent at the next sync', async () => {
    const { settings } = appStores()
    await signIn()
    patchFails = true

    settings.dateFormat = 'MM/DD/YYYY'
    await settle(1000)
    expect(server.values).toEqual({})

    patchFails = false
    await settle(21_000)
    window.dispatchEvent(new Event('focus'))
    await settle()

    expect(server.values).toEqual({ dateFormat: 'MM/DD/YYYY' })
  })

  test('a setting changed on another device meanwhile is kept when this one sends a different one', async () => {
    const { settings } = appStores()
    await signIn()
    server.values.theme = 'dark'

    settings.showHints = false
    await settle(3000)

    expect(server.values).toEqual({ theme: 'dark', showHints: false })
    expect(settings.theme).toBe('dark')
    expect(patches()).toHaveLength(1)
  })
})

describe('coming back to the app', () => {
  test('picks up a change made on another device once the app has been away a while', async () => {
    const { settings } = appStores()
    await signIn()
    server.values.theme = 'dark'

    await settle(5000)
    window.dispatchEvent(new Event('focus'))
    await settle()
    expect(settings.theme).toBe('light')

    await settle(20_000)
    window.dispatchEvent(new Event('focus'))
    await settle()
    expect(settings.theme).toBe('dark')
    expect(reads().length).toBeGreaterThanOrEqual(2)
  })

  test('does nothing while signed out', async () => {
    appStores()
    scope = effectScope()
    scope.run(() => useSettingsSync())

    window.dispatchEvent(new Event('focus'))
    await settle(30_000)
    window.dispatchEvent(new Event('focus'))
    await settle()

    expect(stub.calls).toHaveLength(0)
  })
})
