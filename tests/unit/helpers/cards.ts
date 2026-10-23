import type { AttendanceReadV2, EventCard, EventCardParticipation } from '@/api/generated/almaEventFlow'

export function attendance(patch: Partial<AttendanceReadV2> = {}): AttendanceReadV2 {
  return {
    id: 'a1',
    member_id: 'm1',
    participation_id: 'p1',
    is_attended: false,
    is_verified: false,
    comment: null,
    created_at: '2026-10-20T10:00:00Z',
    edited_at: null,
    ...patch,
  }
}

export function participation(patch: Partial<EventCardParticipation> = {}): EventCardParticipation {
  return {
    id: 'p1',
    collective_id: 'c1',
    collective_name: 'Хор',
    attended_count: 0,
    total_count: 2,
    my_attendance: attendance(),
    ...patch,
  }
}

export function card(patch: Partial<EventCard> = {}): EventCard {
  return {
    id: 'e1',
    name: 'Репетиция',
    date: '2026-10-22',
    status: 'active',
    level: null,
    type: null,
    format: 'offline',
    location: null,
    starts_at: '2026-10-22T15:00:00Z',
    ends_at: '2026-10-22T17:00:00Z',
    participations: [participation()],
    created_at: '2026-10-20T10:00:00Z',
    edited_at: null,
    updated_at: '2026-10-20T10:00:00Z',
    ...patch,
  }
}
