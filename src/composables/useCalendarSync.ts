import { isWithinInterval } from 'date-fns'
import { useEventCalendarStore } from '@/stores/eventCalendar'

export function useCalendarSync() {
  const calendar = useEventCalendarStore()

  function syncSelectedDateToCalendar(date: Date) {
    calendar.setSelectedDate(date)
    if (!calendar.isInVisibleRange(date)) {
      calendar.setCurrentMonth(date)
    }
  }

  function checkCalendarFill() {
    const { visibleRange, events } = calendar
    // If events near the edges, load more
    const hasEventsNearStart = events.some(
      (e) => e.date && isWithinInterval(new Date(e.date), {
        start: visibleRange.start,
        end: new Date(visibleRange.start.getTime() + 7 * 24 * 60 * 60 * 1000),
      }),
    )
    const hasEventsNearEnd = events.some(
      (e) => e.date && isWithinInterval(new Date(e.date), {
        start: new Date(visibleRange.end.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: visibleRange.end,
      }),
    )
    return { needsMoreUp: !hasEventsNearStart, needsMoreDown: !hasEventsNearEnd }
  }

  return {
    syncSelectedDateToCalendar,
    checkCalendarFill,
  }
}
