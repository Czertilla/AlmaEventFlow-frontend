import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/api/availability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/availability')>()),
  probe: vi.fn(),
}))

async function load() {
  vi.resetModules()
  const { probe } = await import('@/api/availability')
  const status = await import('@/composables/useBackendStatus')
  return { probe: vi.mocked(probe).mockReset(), ...status }
}

describe('verifyReachable', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('is reachable on the first answer and marks nothing down', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockResolvedValue({ alive: true })

    expect(await verifyReachable('user')).toBe(true)

    expect(probe).toHaveBeenCalledTimes(1)
    expect(useBackendStatus().anyDown.value).toBe(false)
  })

  test('tolerates silent probes as long as one answers', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockResolvedValueOnce({ alive: false }).mockResolvedValueOnce({ alive: false }).mockResolvedValueOnce({ alive: true })

    const result = verifyReachable('user')
    await vi.advanceTimersByTimeAsync(2000)

    expect(await result).toBe(true)
    expect(probe).toHaveBeenCalledTimes(3)
    expect(useBackendStatus().isDown('user')).toBe(false)
  })

  test('marks the service down only when every probe stays silent', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockResolvedValue({ alive: false })

    const result = verifyReachable('user')
    await vi.advanceTimersByTimeAsync(1999)
    expect(useBackendStatus().isDown('user')).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await result).toBe(false)
    expect(probe).toHaveBeenCalledTimes(3)
    expect(useBackendStatus().isDown('user')).toBe(true)
  })

  test('callers share one verification', async () => {
    const { probe, verifyReachable } = await load()
    probe.mockResolvedValue({ alive: true })

    const results = await Promise.all([verifyReachable('user'), verifyReachable('user')])

    expect(results).toEqual([true, true])
    expect(probe).toHaveBeenCalledTimes(1)
  })
})

describe('suspect', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('only starts a check, so one failed request never shows an outage', async () => {
    const { probe, suspect, useBackendStatus } = await load()
    probe.mockResolvedValue({ alive: true })

    suspect('user')
    await vi.advanceTimersByTimeAsync(10000)

    expect(probe).toHaveBeenCalledTimes(1)
    expect(useBackendStatus().anyDown.value).toBe(false)
  })

  test('does not check again right after the service answered', async () => {
    const { probe, suspect } = await load()
    probe.mockResolvedValue({ alive: true })

    suspect('user')
    await vi.advanceTimersByTimeAsync(0)
    suspect('user')
    await vi.advanceTimersByTimeAsync(2999)
    expect(probe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    suspect('user')
    await vi.advanceTimersByTimeAsync(0)

    expect(probe).toHaveBeenCalledTimes(2)
  })
})

describe('recovery of a service that is down', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function goDown() {
    const loaded = await load()
    loaded.probe.mockResolvedValue({ alive: false })
    const result = loaded.verifyReachable('user')
    await vi.advanceTimersByTimeAsync(2000)
    await result
    loaded.probe.mockClear()
    return loaded
  }

  test('probes again after a second and clears the service once it answers', async () => {
    const { probe, useBackendStatus } = await goDown()
    probe.mockResolvedValue({ alive: true })

    await vi.advanceTimersByTimeAsync(1000)

    expect(probe).toHaveBeenCalledWith('user')
    expect(useBackendStatus().isDown('user')).toBe(false)
  })

  test('backs off between failed probes up to a ceiling of ten seconds', async () => {
    const { probe } = await goDown()

    await vi.advanceTimersByTimeAsync(1000)
    expect(probe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(probe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(probe).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000 + 8000 + 10000 + 10000)
    expect(probe).toHaveBeenCalledTimes(6)
  })

  test('rechecks at once, and only once at a time, on demand', async () => {
    const { probe, recheck } = await goDown()

    await Promise.all([recheck(), recheck()])

    expect(probe).toHaveBeenCalledTimes(1)
  })

  test('a real answer clears the service and restarts the backoff', async () => {
    const { probe, markUp, useBackendStatus } = await goDown()
    await vi.advanceTimersByTimeAsync(1000)
    expect(probe).toHaveBeenCalledTimes(1)

    markUp('user')
    await vi.advanceTimersByTimeAsync(60000)

    expect(probe).toHaveBeenCalledTimes(1)
    expect(useBackendStatus().isDown('user')).toBe(false)
  })

  test('rechecks when the browser comes back online', async () => {
    const { probe, useBackendStatus } = await goDown()
    probe.mockResolvedValue({ alive: true })

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)

    expect(probe).toHaveBeenCalledWith('user')
    expect(useBackendStatus().isDown('user')).toBe(false)
  })
})

describe('the reason the proxy gives', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('is taken at once from a status page of the proxy, without waiting for more probes', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockResolvedValue({ alive: false, reason: 'maintenance' })

    expect(await verifyReachable('user')).toBe(false)

    const status = useBackendStatus()
    expect(probe).toHaveBeenCalledTimes(1)
    expect(status.isDown('user')).toBe(true)
    expect(status.reasonOf('user')).toBe('maintenance')
    expect(status.reason.value).toBe('maintenance')
  })

  test('is unknown when the service is simply silent', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockResolvedValue({ alive: false })

    const result = verifyReachable('user')
    await vi.advanceTimersByTimeAsync(2000)
    await result

    expect(useBackendStatus().reasonOf('user')).toBeNull()
    expect(useBackendStatus().reason.value).toBeNull()
  })

  test('follows the proxy while the service stays down and goes away with it', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockResolvedValue({ alive: false, reason: 'maintenance' })
    await verifyReachable('user')
    const status = useBackendStatus()

    probe.mockResolvedValue({ alive: false, reason: 'unavailable' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(status.reasonOf('user')).toBe('unavailable')

    probe.mockResolvedValue({ alive: true })
    await vi.advanceTimersByTimeAsync(2000)
    expect(status.isDown('user')).toBe(false)
    expect(status.reasonOf('user')).toBeNull()
  })

  test('puts maintenance ahead of an outage when several services are down', async () => {
    const { probe, verifyReachable, useBackendStatus } = await load()
    probe.mockImplementation(async (service: string) => ({
      alive: false,
      reason: service === 'user' ? 'unavailable' : 'maintenance',
    }))

    await Promise.all([verifyReachable('user'), verifyReachable('event')])

    expect(useBackendStatus().reason.value).toBe('maintenance')
  })
})
