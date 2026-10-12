import type { OutageReason } from '@/api/availability'

export interface BackendCopy {
  icon: 'offline' | 'maintenance'
  banner: string
  title: string
  text: string
}

const MAINTENANCE: BackendCopy = {
  icon: 'maintenance',
  banner: 'Проводятся технические работы. Вход сохранён, сервис скоро вернётся.',
  title: 'Проводятся технические работы',
  text: 'Сервис обновляется и скоро вернётся. Ваш вход сохранён: как только работы закончатся, мы вернём вас на нужную страницу.',
}

const UNAVAILABLE: BackendCopy = {
  icon: 'offline',
  banner: 'Сервер недоступен по техническим причинам. Вход сохранён.',
  title: 'Сервер недоступен по техническим причинам',
  text: 'Мы уже знаем о проблеме. Ваш вход сохранён: как только сервер заработает, мы вернём вас на нужную страницу. Если ошибка не исчезает, обратитесь в поддержку или к администрации.',
}

const NO_CONNECTION: BackendCopy = {
  icon: 'offline',
  banner: 'Нет связи с сервером. Вход сохранён, переподключаемся.',
  title: 'Сервер недоступен',
  text: 'Не удаётся связаться с сервером. Ваш вход сохранён: как только связь восстановится, мы вернём вас на нужную страницу.',
}

export function backendCopy(reason?: OutageReason | null): BackendCopy {
  if (reason === 'maintenance') return MAINTENANCE
  if (reason === 'unavailable') return UNAVAILABLE
  return NO_CONNECTION
}
