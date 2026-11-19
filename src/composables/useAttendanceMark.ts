import { changeAttendanceEventV2AttendancesAttendanceIdPatch } from '@/api/generated/almaEventFlow'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { useEventCalendarStore } from '@/stores/eventCalendar'

/**
 * Отметка и комментарий своего места. Ответ несёт и новую отметку, и счётчики
 * участия: стор мероприятий обновляется без повторных запросов.
 */
export function useAttendanceMark() {
  const calendar = useEventCalendarStore()
  const { withPending } = useAttendancePending()

  async function patch(attendanceId: string, body: { is_attended?: boolean; comment?: string | null }) {
    await withPending(attendanceId, async () => {
      const { data } = await changeAttendanceEventV2AttendancesAttendanceIdPatch(attendanceId, body)
      calendar.applyAttendanceChange(data)
    })
  }

  async function safely(attendanceId: string, body: { is_attended?: boolean; comment?: string | null }) {
    try {
      await patch(attendanceId, body)
    } catch (error) {
      console.error('attendance change failed:', error)
    }
  }

  return {
    patch,
    toggle: (attendanceId: string, value: boolean) => safely(attendanceId, { is_attended: value }),
    saveComment: (attendanceId: string, comment: string) => safely(attendanceId, { comment }),
    deleteComment: (attendanceId: string) => safely(attendanceId, { comment: null }),
  }
}
