import { afterEach, describe, expect, test } from 'vitest'
import { isSessionRejected, isUnreachable, probe, serviceOf } from '@/api/availability'
import { failure, stubBackend } from './helpers/axiosStub'

describe('isUnreachable', () => {
  test.each(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'])('a %s without a response is unreachable', (code) => {
    expect(isUnreachable(failure(undefined, {}, code))).toBe(true)
  })

  test.each([502, 503, 504])('a %i from the gateway is unreachable', (status) => {
    expect(isUnreachable(failure(status))).toBe(true)
  })

  test('a 404 that is not JSON comes from the proxy, not from the API', () => {
    expect(isUnreachable(failure(404, '404 page not found'))).toBe(true)
  })

  test('a 404 with an empty or foreign body is an ordinary answer', () => {
    expect(isUnreachable(failure(404, ''))).toBe(false)
    expect(isUnreachable(failure(404, 'no such event'))).toBe(false)
  })

  test.each([400, 401, 403, 404, 422, 500])('a %i answered by the service is reachable', (status) => {
    expect(isUnreachable(failure(status, { detail: 'x' }))).toBe(false)
  })

  test('a cancelled request and a foreign error are not an outage', () => {
    expect(isUnreachable(failure(undefined, {}, 'ERR_CANCELED'))).toBe(false)
    expect(isUnreachable(new Error('boom'))).toBe(false)
  })
})

describe('isSessionRejected', () => {
  test('only a 401 ends the session', () => {
    expect(isSessionRejected(failure(401))).toBe(true)
    for (const status of [403, 500, 502, 503]) expect(isSessionRejected(failure(status))).toBe(false)
    expect(isSessionRejected(failure(undefined, {}, 'ERR_NETWORK'))).toBe(false)
  })
})

describe('serviceOf', () => {
  test('takes the service from the versioned api path', () => {
    expect(serviceOf('/user/v1/auth/jwt/refresh')).toBe('user')
    expect(serviceOf('event/v2/calendar')).toBe('event')
    expect(serviceOf('/openapi.json')).toBeNull()
    expect(serviceOf(undefined)).toBeNull()
  })
})

describe('probe', () => {
  let stub: ReturnType<typeof stubBackend>
  afterEach(() => stub.restore())

  test('is alive only when the service says ok', async () => {
    stub = stubBackend(() => ({ status: 200, data: { status: 'ok', service: 'user' } }))

    expect(await probe('user')).toEqual({ alive: true })
    expect(stub.calls[0].url).toMatch(/\/user\/v1\/health$/)
    expect(stub.calls[0].withCredentials).toBe(false)
  })

  test('is not alive for a page that is not the health answer', async () => {
    stub = stubBackend(() => ({ status: 200, data: '<html></html>' }))

    expect(await probe('user')).toEqual({ alive: false })
  })

  test.each([{ status: 503 }, 'network' as const])('is not alive on %j', async (reply) => {
    stub = stubBackend(() => reply)

    expect(await probe('user')).toEqual({ alive: false })
  })

  test('is alive when the service answers, even with an error of its own', async () => {
    stub = stubBackend(() => ({ status: 500, data: { detail: 'boom' } }))

    expect(await probe('user')).toEqual({ alive: true })
  })

  test.each(['maintenance', 'unavailable'] as const)(
    'reads the reason from the %s page of the proxy',
    async (reason) => {
      stub = stubBackend(() => ({ status: 503, data: { status: reason, message: 'x', retry_after: 30 } }))

      expect(await probe('user')).toEqual({ alive: false, reason })
    },
  )

  test('does not take the own 503 of an application for a page of the proxy', async () => {
    stub = stubBackend(() => ({ status: 503, data: { detail: 'WEBPUSH_NOT_CONFIGURED' } }))

    expect(await probe('user')).toEqual({ alive: false })
  })

  test('ignores a status that only looks like a page when the code is not 503', async () => {
    stub = stubBackend(() => ({ status: 500, data: { status: 'maintenance' } }))

    expect(await probe('user')).toEqual({ alive: true })
  })
})
