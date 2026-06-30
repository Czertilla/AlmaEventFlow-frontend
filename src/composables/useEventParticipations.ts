import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePrincipalStore } from '@/stores/principal'
import { useAttendancePending } from '@/composables/useAttendancePending'
import { useToast } from '@/composables/useToast'
import { confirmAction } from '@/utils/confirm'
import { resolveMemberName, rememberMemberPerson, shortId, shortenName } from '@/utils/names'
import { loadStoredRoleOrder, loadSortMode } from '@/utils/roleSort'
import {
  getParticipationsEventV1ParticipationsGet,
  getAttendancesEventV1AttendancesGet,
  getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet,
  patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch,
  patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch,
  createMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendancePost,
  deleteMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdDelete,
  verifyMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendanceVerifyPost,
  cancelMyCollectiveParticipationEventV1MeCollectivesCollectiveIdParticipationsEventIdDelete,
} from '@/api/generated/almaEventFlow'
import type { AttendanceRead, MemberRead } from '@/api/generated/almaEventFlow'

export interface ParticipationItem {
  participationId: string
  collectiveId: string
  collectiveName: string
  attendances: AttendanceRead[]
  myAttendance: AttendanceRead | null
  isPrincipal: boolean
  isMember: boolean
  canExpand: boolean
}

// label=null — группа без подписи (алфавитный режим или участники без роли).
export interface AttendanceGroup {
  key: string
  label: string | null
  items: AttendanceRead[]
}

/**
 * Доменная логика страницы мероприятия: загрузка участий и отметок присутствия,
 * группировка по ролям, CRUD отметок и отмена участия. Извлечена из EventDetailPage,
 * чтобы SFC отвечал за представление, а логика была изолирована и тестируема.
 */
export function useEventParticipations(eventId: string) {
  const router = useRouter()
  const principal = usePrincipalStore()
  const { withPending, pending } = useAttendancePending()
  const { showError, showSuccess } = useToast()

  const participationItems = ref<ParticipationItem[]>([])
  const expanded = reactive<Record<string, boolean>>({})
  // member_id → ФИО; пока имя не загрузилось, показываем сокращённый id
  const memberNames = reactive<Record<string, string>>({})
  // Участники коллективов руководителя (для добавления attendance)
  const collectiveMembers = reactive<Record<string, MemberRead[]>>({})
  const addMemberSel = reactive<Record<string, string>>({})

  // Principal's collectives that are not in the event yet
  const joinableCollectives = computed(() =>
    principal.principalCollectives.filter(
      (c) => !participationItems.value.some((p) => p.collectiveId === c.id),
    ),
  )

  // Руководитель может редактировать мероприятие, если его коллектив в нём участвует.
  const editableCollectiveId = computed(
    () => participationItems.value.find((p) => p.isPrincipal)?.collectiveId ?? null,
  )

  function availableMembers(p: ParticipationItem): MemberRead[] {
    const members = collectiveMembers[p.collectiveId] || []
    const withAttendance = new Set(p.attendances.map((a) => a.member_id))
    return members.filter((m) => m.is_active !== false && !withAttendance.has(m.id))
  }

  // Формат «Фамилия И.О.»
  function memberLabel(memberId: string): string {
    const full = memberNames[memberId]
    return full ? shortenName(full) : `#${shortId(memberId)}`
  }

  // Сортировка/группировка отметок по тому же порядку ролей, что задан руководителем
  // в панели (localStorage, отдельно на коллектив). В режиме «по ролям» каждый участник
  // попадает только в свою высшую по приоритету роль.
  function attendanceGroups(p: ParticipationItem): AttendanceGroup[] {
    const byName = (a: AttendanceRead, b: AttendanceRead) =>
      memberLabel(a.member_id).localeCompare(memberLabel(b.member_id), 'ru')
    const flat = (): AttendanceGroup[] => [
      { key: 'all', label: null, items: p.attendances.slice().sort(byName) },
    ]

    const members = collectiveMembers[p.collectiveId]
    const order = loadStoredRoleOrder(p.collectiveId)
    if (loadSortMode(p.collectiveId) === 'alpha' || !members?.length || !order.length) {
      return flat()
    }

    const rolesByMember = new Map(members.map((m) => [m.id, m.roles.map((r) => r.id)]))
    const roleNames = new Map<string, string>()
    for (const m of members) for (const r of m.roles) roleNames.set(r.id, r.name)

    const byRole = new Map<string, AttendanceRead[]>()
    const noRole: AttendanceRead[] = []
    for (const a of p.attendances) {
      let bestIdx = Number.POSITIVE_INFINITY
      let bestRole: string | null = null
      for (const rid of rolesByMember.get(a.member_id) || []) {
        const idx = order.indexOf(rid)
        if (idx >= 0 && idx < bestIdx) { bestIdx = idx; bestRole = rid }
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

  async function loadMemberNames(items: ParticipationItem[]) {
    // For own (principal) collectives the member list gives member→person mapping in one request
    await Promise.all(
      items
        .filter((p) => p.isPrincipal)
        .map(async (p) => {
          try {
            const resp = await getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet(p.collectiveId, { limit: 100 })
            collectiveMembers[p.collectiveId] = resp.data.items
            for (const m of resp.data.items) rememberMemberPerson(m.id, m.person_id)
          } catch { /* ignore */ }
        }),
    )
    const memberIds = new Set([
      ...items.flatMap((p) => p.attendances.map((a) => a.member_id)),
      ...Object.values(collectiveMembers).flat().map((m) => m.id),
    ])
    await Promise.all(
      Array.from(memberIds).map(async (id) => {
        const name = await resolveMemberName(id)
        if (name) memberNames[id] = name
      }),
    )
  }

  async function loadParticipations() {
    const resp = await getParticipationsEventV1ParticipationsGet({ event_id__in: eventId, limit: 100 })
    const participations = resp.data.items

    const myMemberIds = new Set(principal.userMemberIds.values())
    const collectiveNames = new Map(principal.collectives.map((c) => [c.id, c.name]))

    const items: ParticipationItem[] = await Promise.all(
      participations.map(async (part) => {
        const isPrincipal = principal.principalCollectiveIds.has(part.collective_id)
        const isMember = principal.userMemberIds.has(part.collective_id)
        let attendances: AttendanceRead[] = []
        if (isPrincipal || isMember) {
          try {
            const aResp = await getAttendancesEventV1AttendancesGet({ participation_id: part.id, limit: 100 })
            // Стабильный порядок: иначе записи перемешиваются после каждого изменения
            attendances = aResp.data.items
              .slice()
              .sort((a, b) => (memberNames[a.member_id] || a.member_id).localeCompare(memberNames[b.member_id] || b.member_id, 'ru'))
          } catch { /* not allowed to see attendances */ }
        }
        const myAttendance = attendances.find((a) => myMemberIds.has(a.member_id)) || null
        return {
          participationId: part.id,
          collectiveId: part.collective_id,
          collectiveName:
            part.collective_name
            || collectiveNames.get(part.collective_id)
            || `Коллектив ${part.collective_id.slice(0, 8)}`,
          attendances,
          myAttendance,
          isPrincipal,
          isMember,
          canExpand: isPrincipal || isMember,
        }
      }),
    )

    // Свои коллективы первыми, далее стабильно по названию
    items.sort((a, b) =>
      Number(b.canExpand) - Number(a.canExpand) ||
      a.collectiveName.localeCompare(b.collectiveName, 'ru'))
    participationItems.value = items
    loadMemberNames(items).then(() => {
      // Когда ФИО загрузились — пересортировать списки по именам
      for (const p of participationItems.value) {
        p.attendances.sort((a, b) =>
          (memberNames[a.member_id] || a.member_id).localeCompare(memberNames[b.member_id] || b.member_id, 'ru'))
      }
    })
  }

  // Руководитель меняет attendance через эндпоинт своего коллектива, участник — только свою запись.
  // Перезагрузка данных идёт внутри withPending — спиннер исчезает одновременно с обновлением чипа
  async function patchAttendance(p: ParticipationItem, a: AttendanceRead, body: { is_attended?: boolean; comment?: string }) {
    await withPending(a.id, async () => {
      if (p.isPrincipal) {
        await patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch(p.collectiveId, a.id, body)
      } else {
        await patchMyAttendanceEventV1MeMembersMemberIdAttendanceAttendanceIdPatch(a.member_id, a.id, body)
      }
      await loadParticipations()
    })
  }

  async function toggleAttendance(p: ParticipationItem, a: AttendanceRead, value: boolean) {
    try {
      await patchAttendance(p, a, { is_attended: value })
    } catch (err) {
      showError(err, 'Не удалось изменить отметку')
    }
  }

  async function saveComment(p: ParticipationItem, a: AttendanceRead, comment: string) {
    try {
      await patchAttendance(p, a, { comment })
    } catch (err) {
      showError(err, 'Не удалось сохранить комментарий')
    }
  }

  async function deleteComment(p: ParticipationItem, a: AttendanceRead) {
    await saveComment(p, a, '')
  }

  // Заверение/снятие заверения отдельной отметки — отдельный ключ pending,
  // чтобы спиннер появлялся на кнопке-щите, а не на чипе отметки
  async function toggleVerify(p: ParticipationItem, a: AttendanceRead) {
    try {
      await withPending(`verify:${a.id}`, async () => {
        await patchMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdPatch(
          p.collectiveId, a.id, { is_verified: !a.is_verified },
        )
        await loadParticipations()
      })
    } catch (err) {
      showError(err, 'Не удалось изменить заверение')
    }
  }

  async function addAttendance(p: ParticipationItem) {
    const memberId = addMemberSel[p.participationId]
    if (!memberId) return
    try {
      await createMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendancePost(
        p.collectiveId, p.participationId, { member_id: memberId },
      )
      addMemberSel[p.participationId] = ''
      await loadParticipations()
    } catch (err) {
      showError(err, 'Не удалось добавить отметку')
    }
  }

  async function removeAttendance(p: ParticipationItem, a: AttendanceRead) {
    const ok = await confirmAction('Удалить отметку?', `Запись присутствия «${memberLabel(a.member_id)}» будет удалена.`)
    if (!ok) return
    try {
      await deleteMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdAttendanceAttendanceIdDelete(p.collectiveId, a.id)
      await loadParticipations()
    } catch (err) {
      showError(err, 'Не удалось удалить отметку')
    }
  }

  async function verifyAll(p: ParticipationItem) {
    try {
      await verifyMyCollectiveAttendanceEventV1MeCollectivesCollectiveIdParticipationParticipationIdAttendanceVerifyPost(
        p.collectiveId,
        p.participationId,
      )
      await loadParticipations()
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
      if (isLast) {
        router.replace('/')
      } else {
        await loadParticipations()
      }
    } catch (err) {
      showError(err, 'Не удалось отменить участие')
    }
  }

  return {
    participationItems,
    expanded,
    addMemberSel,
    pending,
    joinableCollectives,
    editableCollectiveId,
    availableMembers,
    memberLabel,
    attendanceGroups,
    loadParticipations,
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
