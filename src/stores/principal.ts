import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getMyCollectivesEventV1MeCollectivesGet } from '@/api/generated/almaEventFlow'
import { getCollectiveOrgV1CollectivesCollectiveIdGet } from '@/api/generated/almaEventFlow'
import { getMyMembersEventV1MeMembersGet } from '@/api/me'
import { useAuthStore } from './auth'
import { getCollectiveColor } from '@/utils/colors'
import { unwrapList } from '@/api/pagination'

export interface CollectiveInfo {
  id: string
  name: string
  color?: string
}

export const usePrincipalStore = defineStore('principal', () => {
  const auth = useAuthStore()

  // Filter selection on the home page
  const selectedCollectiveIds = ref<string[]>([])
  // «Все мероприятия»: показывает вообще все активные события и блокирует чипы коллективов
  const showAllEvents = ref(false)
  const collectives = ref<CollectiveInfo[]>([])
  const isPrincipal = ref(false)
  const loading = ref(false)
  const principalCollectiveIds = ref<Set<string>>(new Set())
  const userMemberIds = ref<Map<string, string>>(new Map())
  // Active collective in the principal panel — remembered per account (jwt sub)
  const activePrincipalCollectiveId = ref<string | null>(null)

  const principalCollectives = computed(() =>
    collectives.value.filter((c) => principalCollectiveIds.value.has(c.id)),
  )

  function storageKey(base: string): string {
    const sub = auth.jwtPayload?.sub || 'anon'
    return `${base}:${sub}`
  }

  function selectCollective(id: string) {
    const idx = selectedCollectiveIds.value.indexOf(id)
    if (idx >= 0) {
      selectedCollectiveIds.value = selectedCollectiveIds.value.filter((cid) => cid !== id)
    } else {
      selectedCollectiveIds.value = [...selectedCollectiveIds.value, id]
    }
    localStorage.setItem(storageKey('collectiveFilter'), JSON.stringify(selectedCollectiveIds.value))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem(storageKey('collectiveFilter'))
    if (stored) {
      try {
        // Оставляем только актуальные коллективы пользователя
        const ids: string[] = JSON.parse(stored)
        const valid = new Set(collectives.value.map((c) => c.id))
        selectedCollectiveIds.value = ids.filter((id) => valid.has(id))
      } catch {
        selectedCollectiveIds.value = []
      }
    } else {
      // По умолчанию включены все коллективы пользователя
      selectedCollectiveIds.value = collectives.value.map((c) => c.id)
    }
    showAllEvents.value = localStorage.getItem(storageKey('showAllEvents')) === '1'
  }

  function toggleShowAllEvents() {
    showAllEvents.value = !showAllEvents.value
    localStorage.setItem(storageKey('showAllEvents'), showAllEvents.value ? '1' : '0')
  }

  function isCollectiveSelected(id: string): boolean {
    return selectedCollectiveIds.value.includes(id)
  }

  function setActivePrincipalCollective(id: string) {
    activePrincipalCollectiveId.value = id
    localStorage.setItem(storageKey('principalCollective'), id)
  }

  function restoreActivePrincipalCollective(principalIds: string[]) {
    const stored = localStorage.getItem(storageKey('principalCollective'))
    if (stored && principalIds.includes(stored)) {
      activePrincipalCollectiveId.value = stored
    } else {
      activePrincipalCollectiveId.value = principalIds[0] ?? null
    }
  }

  function setCollectives(list: CollectiveInfo[], principalIds: string[] = []) {
    collectives.value = list
    principalCollectiveIds.value = new Set(principalIds)
    isPrincipal.value = principalIds.length > 0
    restoreActivePrincipalCollective(principalIds)
  }

  // Дедупликация параллельных вызовов (App.vue и HomePage могут запросить одновременно)
  let inFlight: Promise<void> | null = null
  function fetchCollectives(): Promise<void> {
    if (inFlight) return inFlight
    inFlight = doFetchCollectives().finally(() => { inFlight = null })
    return inFlight
  }

  async function doFetchCollectives() {
    loading.value = true
    try {
      const myResp = await getMyCollectivesEventV1MeCollectivesGet()
      const myIds = unwrapList<{ id: string }>(myResp.data).map((i) => i.id)

      // Членства пользователя (роль участника) — отдельная ручка me/members,
      // backend сам резолвит person из JWT
      const memberMap = new Map<string, string>()
      const collectiveIdsFromMembers = new Set<string>()

      try {
        const memberList = unwrapList<{ id: string; collective_id: string }>(
          (await getMyMembersEventV1MeMembersGet()).data,
        )
        for (const m of memberList) {
          memberMap.set(m.collective_id, m.id)
          collectiveIdsFromMembers.add(m.collective_id)
        }
      } catch (e) {
        console.warn('fetch memberships failed:', e)
      }

      userMemberIds.value = memberMap

      // Build full set of collective IDs (principal + participant)
      const allCollIds = new Set<string>([...myIds, ...collectiveIdsFromMembers])

      const result: CollectiveInfo[] = await Promise.all(
        Array.from(allCollIds).map(async (id) => {
          try {
            const resp = await getCollectiveOrgV1CollectivesCollectiveIdGet(id)
            const c = resp.data as { id: string; name: string }
            return { id: c.id, name: c.name, color: getCollectiveColor(c.id) }
          } catch {
            return { id, name: `Коллектив ${id.slice(0, 8)}`, color: getCollectiveColor(id) }
          }
        }),
      )

      setCollectives(result, myIds)
      loadFromStorage()
    } catch (e) {
      setCollectives([])
      console.error('fetchCollectives failed:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    selectedCollectiveIds,
    showAllEvents,
    activePrincipalCollectiveId,
    collectives,
    principalCollectives,
    isPrincipal,
    loading,
    principalCollectiveIds,
    userMemberIds,
    selectCollective,
    toggleShowAllEvents,
    setActivePrincipalCollective,
    loadFromStorage,
    setCollectives,
    fetchCollectives,
    isCollectiveSelected,
  }
})
