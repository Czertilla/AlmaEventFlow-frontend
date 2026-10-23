import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePrincipalStore } from '@/stores/principal'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { useToast } from '@/composables/useToast'
import { confirmAction } from '@/utils/confirm'
import { formatPersonName, shortId, shortenName } from '@/utils/names'
import { loadStoredRoleOrder, loadSortMode } from '@/utils/roleSort'
import {
  getEventPageEventV2EventsEventIdGet,
  changeAttendanceEventV2AttendancesAttendanceIdPatch,
  declareAttendanceEventV2AttendancesPost,
  deleteMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdDelete,
  verifyMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendanceVerifyPost,
  cancelMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsEventIdDelete,
} from '@/api/generated/almaEventFlow'
import type {
  AttendanceChanged,
  EventPageRead,
  PageAttendance,
  PageParticipation,
  RosterMember,
} from '@/api/generated/almaEventFlow'

export interface ParticipationItem {
  participationId: string
  collectiveId: string
  collectiveName: string
  attendances: PageAttendance[]
  myAttendance: PageAttendance | null
  isPrincipal: boolean
  isMember: boolean
  canExpand: boolean
  addableMembers: RosterMember[]
}

// label=null — группа без подписи (алфавитный режим или участники без роли).
export interface AttendanceGroup {
  key: string
  label: string | null
  items: PageAttendance[]
}

function toItem(p: PageParticipation): ParticipationItem {
  return {
    participationId: p.id,
    collectiveId: p.collective_id,
    collectiveName: p.collective_name,
    attendances: p.attendances,
    myAttendance: p.attendances.find((a) => a.id === p.my_attendance_id) ?? null,
    isPrincipal: p.is_principal,
    isMember: p.is_member,
    canExpand: p.can_view_attendances,
    addableMembers: p.addable_members,
  }
}

/**
 * Доменная логика страницы мероприятия: одна загрузка страницы целиком (мероприятие,
 * этапы, участия, отметки с именами и ролями), правка отметок по ответу сервера,
 * добавление и удаление отметок, отмена участия. Извлечена из EventDetailPage,
 * чтобы SFC отвечал за представление, а логика была изолирована и тестируема.
 */
export function useEventParticipations(eventId: string) {
  const router = useRouter()
  const principal = usePrincipalStore()
  const { withPending, pending } = useAttendancePending()
  const { showError, showSuccess } = useToast()

  const page = ref<EventPageRead | null>(null)
  const expanded = reactive<Record<string, boolean>>({})
  const addMemberSel = reactive<Record<string, string>>({})

  const participationItems = computed<ParticipationItem[]>(() =>
    (page.value?.participations ?? []).map(toItem),
  )

  // Principal's collectives that are not in the event yet
  const joinableCollectives = computed(() =>
    principal.principalCollectives.filter(
      (c) => !participationItems.value.some((p) => p.collectiveId === c.id),
    ),
  )

  // Руководитель может редактировать мероприятие, если его коллектив в нём участвует.
  const editableCollectiveId = computed(() => page.value?.editable_collective_id ?? null)

  // member_id → ФИО из того, что пришло со страницей
  const memberNames = computed(() => {
    const names = new Map<string, string>()
    for (const p of participationItems.value) {
      for (const a of p.attendances) names.set(a.member_id, formatPersonName(a.member.person))
      for (const m of p.addableMembers) names.set(m.id, formatPersonName(m.person))
    }
    return names
  })

  function availableMembers(p: ParticipationItem): RosterMember[] {
    return p.addableMembers
  }

  function memberText(memberId: string): string {
    const full = memberNames.value.get(memberId)
    return full ? shortenName(full) : `#${shortId(memberId)}`
  }

  // Сортировка/группировка отметок по тому же порядку ролей, что задан руководителем
  // в панели (localStorage, отдельно на коллектив). В режиме «по ролям» каждый участник
  // попадает только в свою высшую по приоритету роль.
  function attendanceGroups(p: ParticipationItem): AttendanceGroup[] {
    const byName = (a: PageAttendance, b: PageAttendance) =>
      memberText(a.member_id).localeCompare(memberText(b.member_id), 'ru')
    const flat = (): AttendanceGroup[] => [
      { key: 'all', label: null, items: p.attendances.slice().sort(byName) },
    ]

    const order = loadStoredRoleOrder(p.collectiveId)
    if (loadSortMode(p.collectiveId) === 'alpha' || !order.length) return flat()

    const roleNames = new Map<string, string>()
    const byRole = new Map<string, PageAttendance[]>()
    const noRole: PageAttendance[] = []
    for (const a of p.attendances) {
      let bestIdx = Number.POSITIVE_INFINITY
      let bestRole: string | null = null
      for (const role of a.member.roles) {
        roleNames.set(role.id, role.name)
        const idx = order.indexOf(role.id)
        if (idx >= 0 && idx < bestIdx) { bestIdx = idx; bestRole = role.id }
      }
      if (bestRole === null) noRole.push(a)
      else (byRole.get(bestRole) ?? byRole.set(bestRole, []).get(bestRole)!).push(a)
    }

    const groups: AttendanceGroup[] = []
    for (const rid of order) {
      const items = byRole.get(rid)
      if (items?.length) groups.push({ key: rid, label: roleNames.get(rid) || '—', items: items.sort(byName) })
    }
    if (noRole.length) groups.push({ key: '__none', label: null, items: noRole.sort(byName) })
    return groups
  }

  async function loadPage() {
    page.value = (await getEventPageEventV2EventsEventIdGet(eventId)).data
  }

  function participationOf(participationId: string): PageParticipation | undefined {
    return page.value?.participations.find((p) => p.id === participationId)
  }

  function recount(p: PageParticipation) {
    p.total_count = p.attendances.length
    p.attended_count = p.attendances.filter((a) => a.is_attended).length
  }

  // Ответ сервера несёт новую отметку и счётчики участия: страницу не нужно загружать заново
  function applyChange(change: AttendanceChanged) {
    const p = participationOf(change.participation.id)
    if (!p) return
    p.attendances = p.attendances.map((a) => (a.id === change.attendance.id ? { ...a, ...change.attendance } : a))
    p.attended_count = change.participation.attended_count
    p.total_count = change.participation.total_count
  }

  async function change(key: string, attendanceId: string, body: { is_attended?: boolean; comment?: string | null; is_verified?: boolean }) {
    await withPending(key, async () => {
      applyChange((await changeAttendanceEventV2AttendancesAttendanceIdPatch(attendanceId, body)).data)
    })
  }

  async function toggleAttendance(_p: ParticipationItem, a: PageAttendance, value: boolean) {
    try {
      await change(a.id, a.id, { is_attended: value })
    } catch (err) {
      showError(err, 'Не удалось изменить отметку')
    }
  }

  async function saveComment(_p: ParticipationItem, a: PageAttendance, comment: string) {
    try {
      await change(a.id, a.id, { comment })
    } catch (err) {
      showError(err, 'Не удалось сохранить комментарий')
    }
  }

  async function deleteComment(p: ParticipationItem, a: PageAttendance) {
    await saveComment(p, a, '')
  }

  // Заверение/снятие заверения отдельной отметки — отдельный ключ pending,
  // чтобы спиннер появлялся на кнопке-щите, а не на чипе отметки
  async function toggleVerify(_p: ParticipationItem, a: PageAttendance) {
    try {
      await change(`verify:${a.id}`, a.id, { is_verified: !a.is_verified })
    } catch (err) {
      showError(err, 'Не удалось изменить заверение')
    }
  }

  async function addAttendance(p: ParticipationItem) {
    const memberId = addMemberSel[p.participationId]
    const target = participationOf(p.participationId)
    const member = p.addableMembers.find((m) => m.id === memberId)
    if (!memberId || !target || !member) return
    try {
      const { data } = await declareAttendanceEventV2AttendancesPost({
        participation_id: p.participationId, member_id: memberId,
      })
      addMemberSel[p.participationId] = ''
      target.attendances = [...target.attendances, { ...data.attendance, member }]
      target.addable_members = target.addable_members.filter((m) => m.id !== memberId)
      target.attended_count = data.participation.attended_count
      target.total_count = data.participation.total_count
    } catch (err) {
      showError(err, 'Не удалось добавить отметку')
    }
  }

  async function removeAttendance(p: ParticipationItem, a: PageAttendance) {
    const ok = await confirmAction('Удалить отметку?', `Запись присутствия «${memberText(a.member_id)}» будет удалена.`)
    if (!ok) return
    const target = participationOf(p.participationId)
    try {
      await deleteMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdDelete(p.collectiveId, a.id)
      if (!target) return
      target.attendances = target.attendances.filter((row) => row.id !== a.id)
      if (a.member.is_active) target.addable_members = [...target.addable_members, a.member]
      recount(target)
    } catch (err) {
      showError(err, 'Не удалось удалить отметку')
    }
  }

  async function verifyAll(p: ParticipationItem) {
    try {
      const { data } = await verifyMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendanceVerifyPost(
        p.collectiveId,
        p.participationId,
      )
      const target = participationOf(p.participationId)
      if (target) {
        const fresh = new Map(data.map((row) => [row.id, row]))
        target.attendances = target.attendances.map((row) => {
          const next = fresh.get(row.id)
          if (!next) return row
          return {
            ...row,
            is_attended: next.is_attended ?? row.is_attended,
            is_verified: next.is_verified ?? row.is_verified,
            edited_at: next.edited_at,
          }
        })
        recount(target)
      }
      showSuccess('Присутствия заверены')
    } catch (err) {
      showError(err, 'Не удалось заверить присутствия')
    }
  }

  // Руководитель отменяет участие своего коллектива. Если это последний
  // участвующий коллектив — мероприятие удаляется (бизнес-логика на бэке).
  async function cancelParticipation(p: ParticipationItem) {
    const isLast = participationItems.value.length === 1
    const message = isLast
      ? `«${p.collectiveName}» — единственный участник. Мероприятие будет удалено вместе с участием.`
      : `Участие «${p.collectiveName}» будет отменено.`
    const ok = await confirmAction('Отменить участие?', message)
    if (!ok) return
    try {
      await cancelMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsEventIdDelete(
        p.collectiveId, eventId,
      )
      showSuccess(isLast ? 'Мероприятие удалено' : 'Участие отменено')
      if (isLast) router.replace('/')
      else await loadPage()
    } catch (err) {
      showError(err, 'Не удалось отменить участие')
    }
  }

  return {
    page,
    participationItems,
    expanded,
    addMemberSel,
    pending,
    joinableCollectives,
    editableCollectiveId,
    availableMembers,
    memberText,
    attendanceGroups,
    loadPage,
    toggleAttendance,
    saveComment,
    deleteComment,
    toggleVerify,
    addAttendance,
    removeAttendance,
    verifyAll,
    cancelParticipation,
  }
}
