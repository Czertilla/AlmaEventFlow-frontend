import { describe, expect, test } from 'vitest'
import { changedFields, sectionCounts, snapshot, type ProfileFormLike } from '@/utils/profileFormDiff'

const choice = (id: string | number | null = null) => ({ id, draft: null })

function form(): ProfileFormLike {
  return {
    surname: 'Иванова', name: 'Мария', patronymic: '', birthdate: null,
    isStudent: true, studentId: 'S-1', isBudget: false, isFull: false,
    university: choice('u'), faculty: choice('f'), group: choice(1), degree: choice(1), grade: '2',
    workplace: choice(), diet: choice(),
    contacts: [{ id: 'c1', type: 'email', value: 'm@example.com', is_main: true }],
  }
}

describe('profile form diff', () => {
  test('an untouched form has no changes and spaces around text do not count', () => {
    const base = snapshot(form())
    const same = { ...form(), surname: ' Иванова ' }

    expect(changedFields(base, same).size).toBe(0)
    expect(Object.values(sectionCounts(base, same)).every((count) => count === 0)).toBe(true)
  })

  test('changes are counted per section; a new, edited or removed contact each count once', () => {
    const base = snapshot(form())
    const edited = {
      ...form(), name: 'Анна', workplace: choice('w'), grade: '3',
      contacts: [{ id: 'c1', type: 'email', value: 'other@example.com', is_main: true }, { type: 'tg', value: '@m', is_main: true }],
    }

    expect(sectionCounts(base, edited)).toEqual({ about: 1, study: 1, extra: 1, contacts: 2 })
    expect(sectionCounts(base, { ...form(), contacts: [] }).contacts).toBe(1)
  })
})
