import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useLiveStore } from '@/stores/live'
import { useTodoStore } from '@/stores/todo'
import { POLL_MS, RETRY_MAX_MS, nextDelay, parseChange, streamUrl } from '@/utils/live'
import { stubBackend } from './helpers/axiosStub'

const TICKET = '/event/v3/me/stream/ticket'
const TODO = '/event/v3/me/todo'

type Listener = (event: { data: string }) => void

class FakeSource {
  static all: FakeSource[] = []
  listeners = new Map<string, Listener[]>()
  onerror: (() => void) | null = null
  closed = false

  constructor(public url: string) {
    FakeSource.all.push(this)
  }

  addEventListener(name: string, listener: Listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener])
  }

  emit(name: string, data = '{}') {
    for (const listener of this.listeners.get(name) ?? []) listener({ data })
  }

  close() {
    this.closed = true
  }
}

let backend: ReturnType<typeof stubBackend>
let tickets = 0
let ticketsDown = false

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  FakeSource.all = []
  tickets = 0
  ticketsDown = false
  vi.stubGlobal('EventSource', FakeSource)
  backend = stubBackend((config) => {
    if (config.url === TICKET) {
      if (ticketsDown) return 'network'
      tickets += 1
      return { status: 200, data: { ticket: `t${tickets}`, expires_in: 60 } }
    }
    if (config.url === TODO) return { status: 200, data: { items: [], unavailable: [] } }
    return { status: 404 }
  })
})

afterEach(() => {
  useLiveStore().stop()
  backend.restore()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the helpers of live updates', () => {
  test('an event says what changed and nothing else counts', () => {
    expect(parseChange('{"topic":"onboarding","id":"o1","deleted":true}')).toEqual({
      topic: 'onboarding', id: 'o1', deleted: true,
    })
    expect(parseChange('{"topic":"todo","id":null,"deleted":false}')).toEqual({
      topic: 'todo', id: null, deleted: false,
    })
    expect(parseChange('{"topic":"other"}')).toBeNull()
    expect(parseChange('not json')).toBeNull()
  })

  test('the pause doubles up to a minute', () => {
    expect(nextDelay(1_000)).toBe(2_000)
    expect(nextDelay(40_000)).toBe(RETRY_MAX_MS)
  })

  test('the stream is opened with the ticket only', () => {
    expect(streamUrl('https://api.example/', 'a b')).toBe('https://api.example/event/v3/me/stream?ticket=a%20b')
  })
})

describe('the live store', () => {
  test('a stream opens with a fresh ticket and every break gets a new one', async () => {
    const live = useLiveStore()
    live.start()
    await flushPromises()
    const [first] = FakeSource.all
    first.emit('ready')

    first.onerror?.()
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()

    expect(first.url).toContain('ticket=t1')
    expect(first.closed).toBe(true)
    expect(FakeSource.all).toHaveLength(2)
    expect(FakeSource.all[1].url).toContain('ticket=t2')
    expect(live.connected).toBe(false)
  })

  test('a changed onboarding moves its version and a tombstone is kept', async () => {
    const live = useLiveStore()
    const todo = useTodoStore()
    const refresh = vi.spyOn(todo, 'refresh')
    live.start()
    await flushPromises()
    const [stream] = FakeSource.all
    stream.emit('ready')
    const before = live.versionOf('o1')

    stream.emit('changed', '{"topic":"onboarding","id":"o1","deleted":true}')
    stream.emit('changed', '{"topic":"todo","id":null,"deleted":false}')

    expect(live.connected).toBe(true)
    expect(live.versionOf('o1')).toBe(before + 1)
    expect(live.removed.has('o1')).toBe(true)
    expect(refresh).toHaveBeenCalledWith(true)
  })

  test('without a stream the list is polled', async () => {
    ticketsDown = true
    const live = useLiveStore()
    live.start()
    await flushPromises()
    const tick = live.tick

    await vi.advanceTimersByTimeAsync(POLL_MS)

    expect(FakeSource.all).toHaveLength(0)
    expect(live.tick).toBeGreaterThan(tick)
    expect(backend.to(TODO).length).toBeGreaterThan(0)
  })

  test('stopping closes the stream and forgets the versions', async () => {
    const live = useLiveStore()
    live.start()
    await flushPromises()
    const [stream] = FakeSource.all
    live.apply({ topic: 'onboarding', id: 'o1', deleted: false })

    live.stop()

    expect(stream.closed).toBe(true)
    expect(live.versions).toEqual({})
  })
})
