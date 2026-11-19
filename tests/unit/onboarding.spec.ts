import { describe, expect, test } from 'vitest'
import type { OnboardingRead } from '@/api/generated/almaEventFlow'
import { decisionText, isOpen, sortOnboardings, waitingText } from '@/utils/onboarding'

function onboarding(patch: Partial<OnboardingRead>): OnboardingRead {
  return {
    id: 'o1',
    collective_id: 'c1',
    collective_name: 'Хор',
    person: { id: 'p1', surname: 'Иванова', name: 'Анна', patronymic: null },
    status: 'requested',
    opened_by: 'candidate',
    awaiting: 'leader',
    my_side: 'candidate',
    expires_at: '2026-12-19T00:00:00Z',
    closed_at: null,
    member_id: null,
    created_at: '2026-11-19T00:00:00Z',
    edited_at: null,
    last_entry: null,
    ...patch,
  }
}

describe('the words of an onboarding', () => {
  test('who waits is said from the side of the one who looks', () => {
    expect(waitingText(onboarding({}))).toBe('Ждёт ответа руководителя')
    expect(waitingText(onboarding({ my_side: 'leader' }))).toBe('Ждёт вашего ответа')
    expect(waitingText(onboarding({ status: 'accepted', awaiting: null }))).toBe('Принят в коллектив')
  })

  test('a decision is told by who made it', () => {
    expect(decisionText('accept', 'leader')).toBe('Руководитель принял запрос')
    expect(decisionText('accept', 'candidate')).toBe('Приглашение принято')
    expect(decisionText('withdraw', 'candidate')).toBe('Запрос отозван')
    expect(decisionText('expire', 'system')).toBe('Срок ответа вышел')
  })

  test('only a request and an invitation are open', () => {
    expect(isOpen('requested')).toBe(true)
    expect(isOpen('invited')).toBe(true)
    expect(isOpen('declined')).toBe(false)
  })

  test('what waits for the viewer comes first, closed ones last', () => {
    const mine = onboarding({ id: 'mine', my_side: 'leader' })
    const theirs = onboarding({ id: 'theirs', edited_at: '2026-11-20T00:00:00Z' })
    const closed = onboarding({ id: 'closed', status: 'declined', awaiting: null, edited_at: '2026-11-21T00:00:00Z' })

    expect(sortOnboardings([closed, theirs, mine]).map((o) => o.id)).toEqual(['mine', 'theirs', 'closed'])
  })
})
