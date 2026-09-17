import { getPersonProfileV1PersonsPersonIdGet } from '@/api/generated/almaEventFlow'
import { getMemberEventV1MembersMemberIdGet } from '@/api/generated/almaEventFlow'

// Caches survive for the app session — entity names change rarely
const personNameCache = new Map<string, string | null>()
const memberPersonCache = new Map<string, string | null>()
// Промежуточный кэш активных запросов: несколько ячеек таблицы, резолвящих
// один и тот же id одновременно (до того как personNameCache заполнится),
// без этого каждая бьёт по сети отдельно вместо того чтобы дождаться одной.
const personNameInFlight = new Map<string, Promise<string | null>>()
const memberPersonInFlight = new Map<string, Promise<string | null>>()

export function shortId(id: string): string {
  return id.slice(0, 8)
}

/** Инициалы для аватара: первые 2 символа имени пользователя (или email). */
export function getInitials(user: { username?: string | null; email?: string | null } | null | undefined): string {
  const source = user?.username || user?.email || ''
  return source.slice(0, 2).toUpperCase()
}

export function formatPersonName(p: { name: string; surname: string; patronymic?: string | null }): string {
  return [p.surname, p.name, p.patronymic].filter(Boolean).join(' ')
}

/** «Фамилия Имя Отчество» → «Фамилия И.О.» */
export function shortenName(full: string): string {
  const [surname, ...rest] = full.split(' ').filter(Boolean)
  if (!surname) return full
  const initials = rest.map((w) => `${w[0].toUpperCase()}.`).join('')
  return initials ? `${surname} ${initials}` : surname
}

/**
 * ФИО персоны по id; null — если недоступно. Неудачу НЕ кешируем: под резкой
 * нагрузкой (десятки параллельных запросов на странице со списком участников)
 * единичный сетевой сбой не должен навсегда «приклеивать» участнику короткий
 * id вместо имени на всю сессию — следующий вызов должен получить новый шанс.
 */
export function resolvePersonName(personId: string): Promise<string | null> {
  if (personNameCache.has(personId)) return Promise.resolve(personNameCache.get(personId)!)
  const inFlight = personNameInFlight.get(personId)
  if (inFlight) return inFlight
  const promise = (async () => {
    try {
      const resp = await getPersonProfileV1PersonsPersonIdGet(personId)
      const name = formatPersonName(resp.data)
      personNameCache.set(personId, name)
      return name
    } catch {
      return null
    } finally {
      personNameInFlight.delete(personId)
    }
  })()
  personNameInFlight.set(personId, promise)
  return promise
}

/** ФИО участника коллектива по member id (member → person → ФИО). */
export function resolveMemberName(memberId: string, knownPersonId?: string): Promise<string | null> {
  if (knownPersonId) return resolvePersonName(knownPersonId)
  const cachedPersonId = memberPersonCache.get(memberId)
  if (cachedPersonId !== undefined) return cachedPersonId ? resolvePersonName(cachedPersonId) : Promise.resolve(null)
  const inFlight = memberPersonInFlight.get(memberId)
  if (inFlight) return inFlight
  const promise = (async () => {
    try {
      const resp = await getMemberEventV1MembersMemberIdGet(memberId)
      memberPersonCache.set(memberId, resp.data.person_id)
      return resolvePersonName(resp.data.person_id)
    } catch {
      // Не кешируем неудачу -- см. resolvePersonName выше.
      return null
    } finally {
      memberPersonInFlight.delete(memberId)
    }
  })()
  memberPersonInFlight.set(memberId, promise)
  return promise
}

/** Запоминает соответствие member → person (когда members уже загружены списком). */
export function rememberMemberPerson(memberId: string, personId: string) {
  memberPersonCache.set(memberId, personId)
}
