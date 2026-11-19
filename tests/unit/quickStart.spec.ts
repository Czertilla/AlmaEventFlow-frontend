import { beforeEach, describe, expect, test, vi } from 'vitest'
import { qrModules, qrSvg } from '@/utils/qr'
import {
  PENDING_COLLECTIVE_KEY,
  PENDING_COLLECTIVE_TTL_MS,
  asCollectiveId,
  collectiveFromPath,
  collectiveJoinLink,
  pendingCollective,
  quickStartRoute,
  rememberCollective,
  type QuickStartAuth,
} from '@/utils/quickStart'

const ID = '0b5e6a1c-3f2d-4c8e-9a7b-1d2e3f4a5b6c'

function auth(per: string | null, linked: string | null = null): QuickStartAuth & { refreshes: string[] } {
  const state = {
    jwtPayload: { per },
    user: { person_id: linked },
    refreshes: [] as string[],
    async refreshWhenLinked(personId: string) {
      state.refreshes.push(personId)
      state.jwtPayload = { per: personId }
    },
  }
  return state
}

beforeEach(() => {
  localStorage.clear()
})

describe('the collective of a link', () => {
  test('is taken only when it is a uuid', () => {
    expect(asCollectiveId(ID.toUpperCase())).toBe(ID)
    expect(asCollectiveId([ID, 'x'])).toBe(ID)
    expect(asCollectiveId('../admin')).toBeNull()
    expect(asCollectiveId(undefined)).toBeNull()
    expect(collectiveFromPath(`/collective/${ID}`)).toBe(ID)
    expect(collectiveFromPath(`/collective/${ID}/members`)).toBeNull()
  })

  test('survives until it is used or a week has passed', () => {
    rememberCollective(ID, 1000)

    expect(pendingCollective(1000 + PENDING_COLLECTIVE_TTL_MS - 1)).toBe(ID)
    expect(pendingCollective(1000 + PENDING_COLLECTIVE_TTL_MS)).toBeNull()
    expect(localStorage.getItem(PENDING_COLLECTIVE_KEY)).toBeNull()
  })

  test('a damaged entry is dropped instead of being trusted', () => {
    localStorage.setItem(PENDING_COLLECTIVE_KEY, JSON.stringify({ id: 'javascript:alert(1)', at: Date.now() }))
    expect(pendingCollective()).toBeNull()

    localStorage.setItem(PENDING_COLLECTIVE_KEY, '{')
    expect(pendingCollective()).toBeNull()
    expect(localStorage.getItem(PENDING_COLLECTIVE_KEY)).toBeNull()
  })

  test('the shared link opens the registration with the collective', () => {
    expect(collectiveJoinLink('https://aef.example/', ID)).toBe(`https://aef.example/auth/register?collective=${ID}`)
  })
})

describe('the step after signing in', () => {
  test('nothing pending, nothing to do', async () => {
    expect(await quickStartRoute(auth('p1'))).toBeNull()
  })

  test('a person in the token goes straight to the collective, once', async () => {
    rememberCollective(ID)
    const account = auth('p1')

    expect(await quickStartRoute(account)).toBe(`/collective/${ID}`)
    expect(account.refreshes).toEqual([])
    expect(await quickStartRoute(account)).toBeNull()
  })

  test('an invitation linked meanwhile is picked up before the collective opens', async () => {
    rememberCollective(ID)
    const account = auth(null, 'p2')

    expect(await quickStartRoute(account)).toBe(`/collective/${ID}`)
    expect(account.refreshes).toEqual(['p2'])
    expect(account.jwtPayload?.per).toBe('p2')
  })

  test('without a person the collective opens too, its card asks for the details', async () => {
    rememberCollective(ID)
    const account = auth(null)
    const refresh = vi.spyOn(account, 'refreshWhenLinked')

    expect(await quickStartRoute(account)).toBe(`/collective/${ID}`)
    expect(refresh).not.toHaveBeenCalled()
    expect(pendingCollective()).toBeNull()
  })
})

describe('the QR code', () => {
  test('encodes the link into a square with the three finder patterns', () => {
    const modules = qrModules(collectiveJoinLink('https://aef.czertilla.ru', ID))
    const size = modules.length
    const finder = (top: number, left: number) =>
      [0, 6].every((i) => [0, 1, 2, 3, 4, 5, 6].every((j) => modules[top + i][left + j] && modules[top + j][left + i]))

    expect(modules.every((row) => row.length === size)).toBe(true)
    expect((size - 17) % 4).toBe(0)
    expect(finder(0, 0) && finder(0, size - 7) && finder(size - 7, 0)).toBe(true)
    expect(modules[7][7]).toBe(false)
  })

  test('the picture stays dark on light and has a quiet zone', () => {
    const svg = qrSvg('https://aef.czertilla.ru')
    const side = qrModules('https://aef.czertilla.ru').length + 8

    expect(svg).toContain(`viewBox="0 0 ${side} ${side}"`)
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('M4 4h1v1h-1z')
  })
})
