import { describe, expect, it } from 'vitest'
import type { VisibilityEntryRead } from '@/api/generated/almaEventFlow'
import { audienceOptions, splitEntries } from '@/utils/visibility'

function entry(over: Partial<VisibilityEntryRead>): VisibilityEntryRead {
  return {
    key: 'person.fullname',
    label: 'ФИО',
    configurable: true,
    audience_min: 'context',
    audience_max: 'all_users',
    audience_default: 'context',
    audience: 'context',
    is_default: true,
    ...over,
  }
}

describe('audienceOptions', () => {
  it('offers the levels between the narrowest and the widest allowed', () => {
    expect(audienceOptions(entry({})).map((o) => o.value)).toEqual(['context', 'all_users'])
    expect(audienceOptions(entry({ audience_min: 'private', audience_max: 'context' })).map((o) => o.value)).toEqual(['private', 'context'])
    expect(audienceOptions(entry({ audience_min: 'private', audience_max: 'all_users' })).map((o) => o.value)).toEqual(['private', 'context', 'all_users'])
  })

  it('words the levels in plain Russian', () => {
    expect(audienceOptions(entry({ audience_min: 'private', audience_max: 'all_users' })).map((o) => o.label)).toEqual([
      'Только я',
      'Мои коллективы',
      'Все пользователи',
    ])
  })
})

describe('splitEntries', () => {
  it('keeps the fields that can be opened apart from the always closed ones', () => {
    const open = entry({ key: 'a' })
    const closed = entry({ key: 'b', configurable: false, audience_min: 'private', audience_max: 'private', audience: 'private' })

    expect(splitEntries([open, closed])).toEqual({ open: [open], closed: [closed] })
  })
})
