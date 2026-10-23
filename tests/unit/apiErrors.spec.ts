import { describe, expect, test } from 'vitest'
import { apiErrorMessage } from '@/utils/apiErrors'

const failure = (detail: unknown) => ({ response: { data: { detail } } })

describe('apiErrorMessage', () => {
  test('puts a known code into words', () => {
    expect(apiErrorMessage(failure('STUDENT_GROUP_IN_USE'), 'x')).toBe('Группу нельзя удалить: в ней есть студенты')
    expect(apiErrorMessage(failure('PERSON_ALREADY_HAS_ACCOUNT'), 'x')).toBe('У персоны уже есть аккаунт')
    expect(apiErrorMessage(failure('COLLECTIVE_NOT_VERIFIED'), 'x')).toBe('Коллектив ещё не подтверждён администратором')
  })

  test('shows an unknown code as it came', () => {
    expect(apiErrorMessage(failure('SOMETHING_NEW'), 'x')).toBe('SOMETHING_NEW')
  })

  test('takes the first message of a validation error', () => {
    expect(apiErrorMessage(failure([{ msg: 'Field required' }, { msg: 'Other' }]), 'x')).toBe('Field required')
  })

  test('falls back when the answer says nothing usable', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'Не получилось')).toBe('Не получилось')
    expect(apiErrorMessage(failure([]), 'Не получилось')).toBe('Не получилось')
    expect(apiErrorMessage(failure(undefined), 'Не получилось')).toBe('Не получилось')
  })
})
