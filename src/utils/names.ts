import { getPersonProfileV1PersonsPersonIdGet } from '@/api/generated/almaEventFlow'
import { getMemberEventV1MembersMemberIdGet } from '@/api/generated/almaEventFlow'

// Caches survive for the app session — entity names change rarely
const personNameCache = new Map<string, string | null>()
const memberPersonCache = new Map<string, string | null>()

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

/** ФИО персоны по id; null — если недоступно. */
export async function resolvePersonName(personId: string): Promise<string | null> {
  if (personNameCache.has(personId)) return personNameCache.get(personId)!
  try {
    const resp = await getPersonProfileV1PersonsPersonIdGet(personId)
    const name = formatPersonName(resp.data)
    personNameCache.set(personId, name)
    return name
  } catch {
    personNameCache.set(personId, null)
    return null
  }
}

/** ФИО участника коллектива по member id (member → person → ФИО). */
export async function resolveMemberName(memberId: string, knownPersonId?: string): Promise<string | null> {
  let personId = knownPersonId ?? memberPersonCache.get(memberId) ?? null
  if (!personId && !memberPersonCache.has(memberId)) {
    try {
      const resp = await getMemberEventV1MembersMemberIdGet(memberId)
      personId = resp.data.person_id
    } catch {
      personId = null
    }
    memberPersonCache.set(memberId, personId)
  }
  if (!personId) return null
  return resolvePersonName(personId)
}

/** Запоминает соответствие member → person (когда members уже загружены списком). */
export function rememberMemberPerson(memberId: string, personId: string) {
  memberPersonCache.set(memberId, personId)
}
