import { describe, expect, test } from 'vitest'
import type { MyProfileWriteV3 } from '@/api/generated/almaEventFlow'
import { withNameVariant } from '@/utils/profileWrite'
import { emptyStudy, pick, studentWrite, studyErrors } from '@/utils/studyForm'

describe('the study block', () => {
  test('a person who is not a student has nothing to check and no card', () => {
    const form = emptyStudy(false)
    expect(studyErrors(form)).toEqual({})
    expect(studentWrite(form)).toBeNull()
  })

  test('a student needs a card number and a group', () => {
    expect(studyErrors(emptyStudy(true))).toEqual({
      studentId: 'Укажите номер студенческого билета',
      group: 'Укажите группу',
    })
  })

  test('a new group needs its faculty, degree and grade', () => {
    const form = { ...emptyStudy(true), studentId: '42', group: { id: null, draft: 'ИВТ-11' }, grade: '13' }
    expect(studyErrors(form)).toEqual({
      faculty: 'Укажите факультет',
      degree: 'Укажите степень',
      grade: 'Курс от 1 до 12',
    })
  })

  test('a picked group becomes the card', () => {
    const form = { ...emptyStudy(true), studentId: ' 42 ', group: pick(7), faculty: pick('f1'), isBudget: true }
    expect(studyErrors(form)).toEqual({})
    expect(studentWrite(form)).toEqual({
      student_id: '42', group_id: 7, faculty_id: 'f1', is_budget: true, is_full: false, is_active: true,
    })
  })
})

describe('the name in the passport', () => {
  const base: MyProfileWriteV3 = { surname: 'Иванова', name: 'Анна', contacts: [], passports: [] }

  test('goes to the first passport', () => {
    const body = withNameVariant(
      { ...base, passports: [{ number: '4510 246813', is_foreign: false }, { number: 'X', is_foreign: true }] },
      { surname: ' Ivanova ', name: 'Anna', patronymic: '' },
    )
    expect(body.passports?.[0].name_variant).toEqual({ surname: 'Ivanova', name: 'Anna', patronymic: null })
    expect(body.passports?.[1].name_variant).toBeUndefined()
  })

  test('has nowhere to go without a passport', () => {
    expect(withNameVariant(base, { surname: 'Ivanova', name: 'Anna', patronymic: '' })).toBe(base)
  })
})
