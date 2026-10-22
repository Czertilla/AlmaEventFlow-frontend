import { describe, expect, test } from 'vitest'
import { cardForDay, eventDay, topCardIndex } from '@/utils/listScroll'

const day = (iso: string) => eventDay(iso)

describe('topCardIndex', () => {
  const cards = [
    { top: 0, height: 100 },
    { top: 110, height: 100 },
    { top: 220, height: 100 },
  ]

  test('is the card whose top was scrolled to', () => {
    expect(topCardIndex(cards, 0)).toBe(0)
    expect(topCardIndex(cards, 110)).toBe(1)
    expect(topCardIndex(cards, 220)).toBe(2)
  })

  test('a card more than half scrolled away gives way to the next one', () => {
    expect(topCardIndex(cards, 40)).toBe(0)
    expect(topCardIndex(cards, 60)).toBe(1)
  })

  test('does not depend on how tall the list window is', () => {
    expect(topCardIndex(cards, 110)).toBe(topCardIndex(cards, 110))
  })

  test('past the end it is the last card, and an empty list has none', () => {
    expect(topCardIndex(cards, 5000)).toBe(2)
    expect(topCardIndex([], 0)).toBe(-1)
  })
})

describe('cardForDay', () => {
  const days = [day('2026-10-20'), day('2026-10-22'), day('2026-10-22'), day('2026-10-28')]

  test('is the first card of the day', () => {
    expect(cardForDay(days, new Date(2026, 9, 22, 15, 30))).toBe(1)
  })

  test('a day with no events points at the next card', () => {
    expect(cardForDay(days, new Date(2026, 9, 23))).toBe(3)
  })

  test('a day before everything points at the first card', () => {
    expect(cardForDay(days, new Date(2026, 8, 1))).toBe(0)
  })

  test('a day after everything points at the last card', () => {
    expect(cardForDay(days, new Date(2026, 11, 31))).toBe(3)
  })

  test('cards without a date are skipped', () => {
    expect(cardForDay([null, day('2026-10-22'), null], new Date(2026, 9, 21))).toBe(1)
    expect(cardForDay([null, null], new Date(2026, 9, 21))).toBe(-1)
    expect(cardForDay([], new Date(2026, 9, 21))).toBe(-1)
  })
})

describe('eventDay', () => {
  test('reads a plain date as the local day, not as UTC midnight', () => {
    const parsed = eventDay('2026-10-25')

    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(9)
    expect(parsed?.getDate()).toBe(25)
    expect(parsed?.getHours()).toBe(0)
  })

  test('has no day for a missing date', () => {
    expect(eventDay(null)).toBeNull()
    expect(eventDay(undefined)).toBeNull()
  })
})
