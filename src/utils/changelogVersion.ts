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
