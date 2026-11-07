const MESSAGES: Record<string, string> = {
  PERSON_NOT_FOUND: 'Персона не найдена',
  PERSON_ALREADY_HAS_ACCOUNT: 'У персоны уже есть аккаунт',
  ORGANIZATION_NOT_FOUND: 'Организация не найдена',
  UNIVERSITY_NOT_FOUND: 'Университет не найден',
  UNIVERSITY_HAS_FACULTIES: 'Университет нельзя удалить: у него есть факультеты',
  COLLECTIVE_NOT_VERIFIED: 'Коллектив ещё не подтверждён администратором',
  INVITE_SIGNING_NOT_CONFIGURED: 'Приглашения не настроены: у сервиса профилей нет ключа подписи',
  STUDENT_DEGREE_NOT_FOUND: 'Степень не найдена',
  STUDENT_DEGREE_ALREADY_EXISTS: 'Такая степень уже есть',
  STUDENT_DEGREE_IN_USE: 'Степень нельзя удалить: у неё есть группы',
  STUDENT_GROUP_NOT_FOUND: 'Группа не найдена',
  STUDENT_GROUP_ALREADY_EXISTS: 'На этом факультете уже есть группа с таким названием',
  STUDENT_GROUP_IN_USE: 'Группу нельзя удалить: в ней есть студенты',
  ATTACHED_PERSON_REQUIRED: 'Сначала заполните подробную информацию',
  VISIBILITY_FIELD_NOT_FOUND: 'Такого поля нет',
  VISIBILITY_NOT_CONFIGURABLE: 'Это поле нельзя открыть',
  VISIBILITY_OUT_OF_RANGE: 'Этот вариант недоступен для поля',
  VISIBILITY_COOLDOWN: 'Расширить видимость пока нельзя: недавно менялась привязка аккаунта',
  NOT_COLLECTIVE_PRINCIPAL: 'Это может только руководитель коллектива',
  ACCESS_REQUEST_NOT_FOUND: 'Запрос не найден',
  ACCESS_REQUEST_EXPIRED: 'Срок запроса истёк',
  ACCESS_FIELD_NOT_GRANTABLE: 'Эти данные нельзя запросить',
  ACCESS_FIELD_NOT_REQUESTED: 'Этих данных нет в запросе',
  ACCESS_COMMENT_LENGTH: 'Комментарий слишком короткий или слишком длинный',
  ACCESS_EXPIRES_OUT_OF_RANGE: 'Такой срок выбрать нельзя',
  GRANT_NOT_FOUND: 'Запрос не найден',
  GRANT_STATE_CONFLICT: 'На запрос уже ответили',
  GRANT_COOLDOWN: 'Разрешить доступ пока нельзя: недавно менялась привязка аккаунта',
  EVENT_SERVICE_UNAVAILABLE: 'Сервис коллективов не отвечает, попробуйте позже',
  TOO_MANY_REQUESTS: 'Слишком часто, попробуйте позже',
  PERSONAL_DATA_UNAVAILABLE: 'Данные сейчас недоступны, попробуйте позже',
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
