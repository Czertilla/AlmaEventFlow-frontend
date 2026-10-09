import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import apiClient from '@/api/client'
import { resetBackendStatus, useBackendStatus } from '@/composables/useBackendStatus'
import { stubBackend, type Reply } from './helpers/axiosStub'

const EVENTS = '/event/v1/events'
const HEALTH = '/event/v1/health'
const alive: Reply = { status: 200, data: { status: 'ok', service: 'event', version: '0' } }

let stub: ReturnType<typeof stubBackend>

function backend(events: () => Reply, health: () => Reply) {
  stub = stubBackend((config) => (config.url?.endsWith(HEALTH) ? health() : events()))
  return useBackendStatus()
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  resetBackendStatus()
})

afterEach(() => {
  stub.restore()
  vi.useRealTimers()
})

describe('a failed request is only a suspicion', () => {
  test.each<[string, Reply]>([
    ['a gateway error', { status: 503 }],
    ['a response the browser hides (a 500 without CORS headers)', 'network'],
  ])('is not an outage while the health endpoint answers: %s', async (_name, reply) => {
    const status = backend(() => reply, () => alive)

    await expect(apiClient.get(EVENTS)).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(10000)

    expect(status.isDown('event')).toBe(false)
    expect(status.anyDown.value).toBe(false)
  })

  test('is not an outage when only some of the health probes fail', async () => {
    const replies: Reply[] = ['network', alive]
    const status = backend(() => 'network', () => replies.shift() ?? alive)

    await expect(apiClient.get(EVENTS)).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(10000)

    expect(status.isDown('event')).toBe(false)
  })

  test('becomes an outage once the health endpoint stays silent too', async () => {
    const status = backend(() => 'network', () => 'network')

    await expect(apiClient.get(EVENTS)).rejects.toThrow()
    expect(status.isDown('event')).toBe(false)
    await vi.advanceTimersByTimeAsync(1999)
    expect(status.isDown('event')).toBe(false)
    await vi.advanceTimersByTimeAsync(500)

    expect(status.isDown('event')).toBe(true)
  })
})
