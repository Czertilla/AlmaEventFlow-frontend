// Общая логика "окна" мероприятий вокруг даты-якоря (обычно -- сегодня),
// используемая и на главной странице (список, см. HomePage.vue), и в
// дашборде руководителя (матрица, см. DashboardPage.vue): подгрузка окна
// в обе стороны (прошлое/будущее) с дедупом по id (мероприятие "сегодня"
// попадает в оба ответа) и сортировкой по возрастанию даты, плюс поиск
// ближайшего будущего мероприятия для начальной позиции просмотра.

export interface EventWindowItem {
  id: string
  date?: string | null
}

export function mergeEventWindow<T extends EventWindowItem>(...lists: T[][]): T[] {
  const byId = new Map<string, T>()
  for (const list of lists) {
    for (const e of list) byId.set(e.id, e)
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  )
}

// Индекс первого мероприятия с датой >= anchor -- то, что должно быть первым
// видимым и на главной странице, и (когда данных достаточно, чтобы заполнить
// экран) в дашборде. -1, если будущих мероприятий в загруженном окне нет.
export function findUpcomingIndex<T extends EventWindowItem>(events: T[], anchor: Date): number {
  return events.findIndex((e) => !!e.date && new Date(e.date) >= anchor)
}

export interface EventWindow<T> {
  events: T[]
  hasMorePast: boolean
  hasMoreFuture: boolean
}

// Собирает окно из двух направленных запросов (прошлое/будущее, каждый до
// pageSize элементов) и по тому, пришла ли ПОЛНАЯ страница, определяет, есть
// ли ещё данные в эту сторону -- та же догадка, что и при постраничной
// подгрузке (loadMore*): неполная/пустая страница = дальше данных нет.
// Общий шаг инициализации окна для списка на главной и матрицы дашборда.
export function buildEventWindow<T extends EventWindowItem>(
  past: T[],
  future: T[],
  pageSize: number,
): EventWindow<T> {
  return {
    events: mergeEventWindow(past, future),
    hasMorePast: past.length === pageSize,
    hasMoreFuture: future.length === pageSize,
  }
}
