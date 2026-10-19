import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import { useUrlState } from '@/composables/useUrlState'
import { patchQuery, readQuery, splitTarget, withQuery } from '@/utils/urlState'

function go(url: string) {
  window.history.replaceState(null, '', url)
}

beforeEach(() => go('/admin/participation'))
afterEach(() => go('/'))

describe('patchQuery', () => {
  test('sets owned keys and leaves foreign ones alone', () => {
    go('/admin/participation?member=m1&q=old')

    patchQuery(['q', 'sort'], { q: 'choir', sort: '' })

    expect(readQuery().get('q')).toBe('choir')
    expect(readQuery().get('member')).toBe('m1')
    expect(readQuery().has('sort')).toBe(false)
  })

  test('drops an owned key whose value is empty', () => {
    go('/admin/participation?q=old')

    patchQuery(['q'], { q: '' })

    expect(window.location.search).toBe('')
  })

  test('does nothing while another page is on screen', () => {
    patchQuery(['q'], { q: 'x' }, '/somewhere/else')

    expect(window.location.search).toBe('')
  })

  test('keeps the history entry count unchanged', () => {
    const before = window.history.length

    patchQuery(['q'], { q: 'x' })

    expect(window.history.length).toBe(before)
  })
})

describe('useUrlState', () => {
  test('starts from the address bar and falls back to defaults', () => {
    go('/admin/participation?status=draft')

    const state = useUrlState({ status: 'active', type: 'all' })

    expect(state.status).toBe('draft')
    expect(state.type).toBe('all')
  })

  test('writes only values that differ from their defaults', async () => {
    const state = useUrlState({ status: 'active', type: 'all' })

    state.type = 'concert'
    await nextTick()
    expect(window.location.search).toBe('?type=concert')

    state.type = 'all'
    await nextTick()
    expect(window.location.search).toBe('')
  })
})

describe('target helpers', () => {
  test('splitTarget separates path and query', () => {
    expect(splitTarget('/admin/members?collective_id=c1')).toEqual({
      path: '/admin/members',
      search: '?collective_id=c1',
    })
  })

  test('withQuery skips empty values', () => {
    expect(withQuery('/admin/members', { collective_id: 'c1', q: '', active: null })).toBe(
      '/admin/members?collective_id=c1',
    )
  })
})
