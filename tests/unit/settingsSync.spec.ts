import { describe, expect, test } from 'vitest'
import {
  EMPTY_SYNC_STATE,
  planSync,
  readRemote,
  readSyncState,
  stillDirty,
  type SettingValues,
  type SyncState,
} from '@/utils/settingsSync'

const LOCAL: SettingValues = {
  theme: 'light',
  dateFormat: 'DD.MM.YYYY',
  firstDayOfWeek: 'monday',
  animations: 'auto',
  showHints: true,
  collapseOnScroll: true,
}

const synced = (owner: string, dirty: SyncState['dirty'] = []): SyncState => ({ owner, revision: 3, dirty })

describe('readRemote', () => {
  test('keeps known settings of the right shape', () => {
    expect(readRemote({ theme: 'dark', showHints: false })).toEqual({ theme: 'dark', showHints: false })
  })

  test('drops names this version does not know, so a newer app can keep its own', () => {
    expect(readRemote({ theme: 'dark', somethingNew: 1 })).toEqual({ theme: 'dark' })
  })

  test('drops values of the wrong shape', () => {
    expect(readRemote({ theme: 'purple', showHints: 'yes', dateFormat: 5, animations: null })).toEqual({})
  })

  test('does not trust inherited names', () => {
    expect(readRemote({ constructor: 'x', toString: 'y' })).toEqual({})
  })
})

describe('readSyncState', () => {
  test('starts empty without a stored state or with a broken one', () => {
    expect(readSyncState(null)).toEqual(EMPTY_SYNC_STATE)
    expect(readSyncState('{oops')).toEqual(EMPTY_SYNC_STATE)
  })

  test('keeps only known, distinct dirty names', () => {
    const state = readSyncState(JSON.stringify({ owner: 'u1', revision: 4, dirty: ['theme', 'theme', 'bogus', 7] }))

    expect(state).toEqual({ owner: 'u1', revision: 4, dirty: ['theme'] })
  })
})

describe('planSync', () => {
  test('the server wins for everything this device did not change', () => {
    const plan = planSync({
      account: 'u1',
      state: synced('u1'),
      local: LOCAL,
      chosenHere: ['theme'],
      remote: { theme: 'dark', showHints: false },
    })

    expect(plan.apply).toEqual({ theme: 'dark', showHints: false })
    expect(plan.push).toEqual([])
  })

  test('a setting changed here and not yet sent is sent instead of being overwritten', () => {
    const plan = planSync({
      account: 'u1',
      state: synced('u1', ['theme']),
      local: { ...LOCAL, theme: 'dark' },
      chosenHere: ['theme'],
      remote: { theme: 'light', showHints: false },
    })

    expect(plan.apply).toEqual({ showHints: false })
    expect(plan.push).toEqual(['theme'])
  })

  test('nothing is applied when the server agrees', () => {
    const plan = planSync({
      account: 'u1',
      state: synced('u1'),
      local: LOCAL,
      chosenHere: [],
      remote: { theme: 'light' },
    })

    expect(plan.apply).toEqual({})
  })

  test('a browser that never synced offers what its person chose before, where the server has nothing', () => {
    const plan = planSync({
      account: 'u1',
      state: EMPTY_SYNC_STATE,
      local: { ...LOCAL, dateFormat: 'YYYY-MM-DD', theme: 'dark' },
      chosenHere: ['theme', 'dateFormat'],
      remote: { theme: 'light' },
    })

    expect(plan.apply).toEqual({ theme: 'light' })
    expect(plan.push).toEqual(['dateFormat'])
  })

  test('a browser last used by another account offers nothing and applies what the server has', () => {
    const plan = planSync({
      account: 'u2',
      state: synced('u1', ['theme']),
      local: { ...LOCAL, theme: 'dark' },
      chosenHere: ['theme'],
      remote: { theme: 'light' },
    })

    expect(plan.push).toEqual([])
    expect(plan.apply).toEqual({ theme: 'light' })
  })

  test('an account with no stored settings keeps what the browser shows', () => {
    const plan = planSync({
      account: 'u2',
      state: synced('u1'),
      local: { ...LOCAL, theme: 'dark' },
      chosenHere: ['theme'],
      remote: {},
    })

    expect(plan.apply).toEqual({})
    expect(plan.push).toEqual([])
  })
})

describe('stillDirty', () => {
  test('lists the sent settings that changed again while the request was on its way', () => {
    expect(stillDirty({ theme: 'dark', showHints: true }, { theme: 'light', showHints: true })).toEqual(['theme'])
  })

  test('ignores settings that were not sent', () => {
    expect(stillDirty({ theme: 'dark' }, { theme: 'dark', showHints: false })).toEqual([])
  })
})
