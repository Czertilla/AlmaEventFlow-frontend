import { isBefore, parseISO, startOfDay } from 'date-fns'

export interface CardBox {
  top: number
  height: number
}

/** The card at the top edge of the list: the first one whose middle is still below the scroll position. */
export function topCardIndex(cards: readonly CardBox[], scrollTop: number): number {
  if (cards.length === 0) return -1
  const index = cards.findIndex((card) => card.top + card.height / 2 > scrollTop)
  return index >= 0 ? index : cards.length - 1
}

/** Local day of an event date (`yyyy-MM-dd` or a full ISO string). */
export function eventDay(date: string | null | undefined): Date | null {
  return date ? startOfDay(parseISO(date)) : null
}

/**
 * The card a calendar day points at: the first card of that day, else the
 * first one after it, else the last one. -1 for an empty list.
 */
export function cardForDay(days: readonly (Date | null)[], day: Date): number {
  const target = startOfDay(day)
  let last = -1
  for (let i = 0; i < days.length; i++) {
    const current = days[i]
    if (!current) continue
    last = i
    if (!isBefore(current, target)) return i
  }
  return last
}
