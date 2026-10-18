import { createRouter, createWebHistory } from 'vue-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { changelogAfterUpdate, leaveChangelog, returnPath } from '@/utils/changelogVersion'

const Blank = { render: () => null }

function browserRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: Blank }],
  })
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('where the changelog sends a person back to', () => {
  test.each([
    ['/', '/'],
    ['/event/42', '/event/42'],
    ['/event/42?tab=stages#top', '/event/42?tab=stages#top'],
    ['/principal/members/7', '/principal/members/7'],
  ])('%s is a page of the app', (from, expected) => {
    expect(returnPath(from)).toBe(expected)
  })

  test.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['an array', ['/event/1']],
    ['another site', 'https://example.com/event/1'],
    ['a protocol-relative address', '//example.com'],
    ['a relative path', 'event/1'],
    ['the changelog itself', '/changelog?new=1'],
    ['the login page', '/auth/login'],
    ['a login subpage', '/auth/verify?token=x'],
  ])('%s sends to the main page', (_, from) => {
    expect(returnPath(from)).toBe('/')
  })

  test('a page that only starts like a login path is still a page', () => {
    expect(returnPath('/authors')).toBe('/authors')
    expect(returnPath('/changelogs')).toBe('/changelogs')
  })

  test('opening after an update remembers the page and asks for the latest entry only', () => {
    expect(changelogAfterUpdate('/event/42?tab=stages')).toEqual({
      path: '/changelog',
      query: { new: '1', from: '/event/42?tab=stages' },
    })
  })
})

describe('leaving the changelog', () => {
  test('goes back when the page is right behind it, leaving no extra history', async () => {
    const router = browserRouter()
    await router.push('/event/42')
    await router.push(changelogAfterUpdate('/event/42'))
    const back = vi.spyOn(router, 'back')
    const replace = vi.spyOn(router, 'replace')

    leaveChangelog(router, '/event/42')

    expect(back).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/event/42'))
  })

  test('goes to the page when the history does not have it behind', async () => {
    const router = browserRouter()
    await router.push(changelogAfterUpdate('/event/42'))
    const back = vi.spyOn(router, 'back')

    leaveChangelog(router, '/event/42')

    expect(back).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/event/42'))
  })

  test('goes to the page when another one is behind', async () => {
    const router = browserRouter()
    await router.push('/profile')
    await router.push(changelogAfterUpdate('/event/42'))
    const back = vi.spyOn(router, 'back')

    leaveChangelog(router, '/event/42')

    expect(back).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/event/42'))
  })

  test('a made-up return address leads to the main page', async () => {
    const router = browserRouter()
    await router.push('/changelog')

    leaveChangelog(router, 'https://example.com')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/'))
  })
})
