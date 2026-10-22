const MESSAGES: Record<string, string> = {
  PERSON_NOT_FOUND: 'Персона не найдена',
  PERSON_ALREADY_HAS_ACCOUNT: 'У персоны уже есть аккаунт',
  ORGANIZATION_NOT_FOUND: 'Организация не найдена',
  UNIVERSITY_NOT_FOUND: 'Университет не найден',
  UNIVERSITY_HAS_FACULTIES: 'Университет нельзя удалить: у него есть факультеты',
  INVITE_SIGNING_NOT_CONFIGURED: 'Приглашения не настроены: у сервиса профилей нет ключа подписи',
  STUDENT_DEGREE_NOT_FOUND: 'Степень не найдена',
  STUDENT_DEGREE_ALREADY_EXISTS: 'Такая степень уже есть',
  STUDENT_DEGREE_IN_USE: 'Степень нельзя удалить: у неё есть группы',
  STUDENT_GROUP_NOT_FOUND: 'Группа не найдена',
  STUDENT_GROUP_ALREADY_EXISTS: 'На этом факультете уже есть группа с таким названием',
  STUDENT_GROUP_IN_USE: 'Группу нельзя удалить: в ней есть студенты',
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return MESSAGES[detail] ?? detail
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined
    if (typeof first?.msg === 'string') return first.msg
  }
  return fallback
}
