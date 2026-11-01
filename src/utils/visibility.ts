import type { Audience, VisibilityEntryRead } from '@/api/generated/almaEventFlow'
import type { SelectOption } from '@/utils/selectOptions'

const ORDER: Audience[] = ['private', 'context', 'all_users']

export const AUDIENCE_LABELS: Record<Audience, string> = {
  private: 'Только я',
  context: 'Мои коллективы',
  all_users: 'Все пользователи',
}

/** Варианты, допустимые для поля: от самого узкого до самого широкого. */
export function audienceOptions(entry: Pick<VisibilityEntryRead, 'audience_min' | 'audience_max'>): SelectOption<Audience>[] {
  const from = ORDER.indexOf(entry.audience_min)
  const to = ORDER.indexOf(entry.audience_max)
  return ORDER.slice(from, to + 1).map((value) => ({ value, label: AUDIENCE_LABELS[value] }))
}

/** Настраиваемые поля идут первыми, закрытые навсегда — отдельным списком. */
export function splitEntries(entries: VisibilityEntryRead[]): { open: VisibilityEntryRead[]; closed: VisibilityEntryRead[] } {
  return {
    open: entries.filter((entry) => entry.configurable),
    closed: entries.filter((entry) => !entry.configurable),
  }
}
