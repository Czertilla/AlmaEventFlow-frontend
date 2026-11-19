import type {
  CollectiveRelation,
  OnboardingEntryKind,
  OnboardingRead,
  OnboardingSide,
  OnboardingStatus,
} from '@/api/generated/almaEventFlow'

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  requested: 'Запрос отправлен',
  invited: 'Приглашение отправлено',
  accepted: 'Принят в коллектив',
  declined: 'Отклонено',
  withdrawn: 'Отозвано',
  expired: 'Срок вышел',
  cancelled: 'Закрыто',
}

export const RELATION_LABELS: Record<CollectiveRelation, string> = {
  principal: 'Вы руководитель',
  member: 'Вы участник',
  former: 'Вы были участником',
  requested: 'Запрос отправлен',
  invited: 'Вас пригласили',
  none: '',
}

/** Строка решения в ленте; сообщения показываются своим текстом. */
export function decisionText(kind: OnboardingEntryKind, side: OnboardingSide): string {
  const leader = side === 'leader'
  switch (kind) {
    case 'request': return 'Запрос на вступление'
    case 'invite': return 'Приглашение в коллектив'
    case 'accept': return leader ? 'Руководитель принял запрос' : 'Приглашение принято'
    case 'decline': return leader ? 'Руководитель отклонил запрос' : 'Приглашение отклонено'
    case 'withdraw': return leader ? 'Руководитель отозвал приглашение' : 'Запрос отозван'
    case 'expire': return 'Срок ответа вышел'
    case 'cancel': return 'Закрыто: человек уже в коллективе'
    default: return ''
  }
}

/** Кто ждёт ответа, словами того, кто смотрит. */
export function waitingText(onboarding: OnboardingRead): string {
  if (!onboarding.awaiting) return ONBOARDING_STATUS_LABELS[onboarding.status]
  if (onboarding.awaiting === onboarding.my_side) return 'Ждёт вашего ответа'
  return onboarding.awaiting === 'leader' ? 'Ждёт ответа руководителя' : 'Ждёт ответа кандидата'
}

export function isOpen(status: OnboardingStatus): boolean {
  return status === 'requested' || status === 'invited'
}

export function onboardingPath(id: string): string {
  return `/onboarding/${id}`
}

/** Пока onboarding открыт, наверху то, что ждёт ответа смотрящего. */
export function sortOnboardings(items: OnboardingRead[]): OnboardingRead[] {
  const rank = (o: OnboardingRead) => (o.awaiting && o.awaiting === o.my_side ? 0 : isOpen(o.status) ? 1 : 2)
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || (b.edited_at ?? b.created_at).localeCompare(a.edited_at ?? a.created_at),
  )
}
