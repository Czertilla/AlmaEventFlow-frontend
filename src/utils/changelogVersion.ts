import type { RouteLocationRaw, Router } from 'vue-router'

const SEEN_VERSION_KEY = 'seenChangelogVersion'

/**
 * true, если текущая версия приложения (__APP_VERSION__, см. vite.config.ts)
 * новее той, что пользователь уже видел -- вызывающий код должен в этом
 * случае открыть /changelog. Всегда обновляет сохранённую версию сразу же,
 * так что повторный вызов до следующего релиза больше не сработает.
 *
 * На самом первом запуске (сохранённой версии ещё нет вовсе) намеренно
 * возвращает false и просто запоминает текущую -- новому пользователю
 * нечего сравнивать, показывать "что нового" ещё не имеет смысла.
 */
export function checkForNewVersion(): boolean {
  const seen = localStorage.getItem(SEEN_VERSION_KEY)
  localStorage.setItem(SEEN_VERSION_KEY, __APP_VERSION__)
  return seen !== null && seen !== __APP_VERSION__
}

const NOT_A_PLACE = ['/changelog', '/auth']

/** Куда возвращать со страницы «Что нового»: только внутренний путь приложения, иначе главная. */
export function returnPath(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/'
  const path = from.split(/[?#]/)[0] ?? ''
  const isNotAPlace = NOT_A_PLACE.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  return isNotAPlace ? '/' : from
}

/** Показ после обновления: только последняя запись и возврат туда, где пользователь был. */
export function changelogAfterUpdate(from: string): RouteLocationRaw {
  return { path: '/changelog', query: { new: '1', from } }
}

/**
 * Закрыть «Что нового» и вернуться на прежнюю страницу. Если она прямо перед
 * нами в истории, идём назад -- так в истории не остаётся лишней копии, а если
 * приложение открыли сразу на этой странице или историю потеряли, просто
 * переходим на неё.
 */
export function leaveChangelog(router: Router, from: unknown): void {
  const target = returnPath(from)
  const previous = router.options.history.state?.back
  if (previous === target) router.back()
  else void router.replace(target)
}
