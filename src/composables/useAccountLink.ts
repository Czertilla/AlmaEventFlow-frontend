import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMyProfileStore } from '@/stores/myProfile'

export const LINK_ATTEMPTS = 6
export const LINK_RETRY_MS = 10_000
export const LINK_SETTLE_MS = 2_000

export type AccountLinkStatus = 'ok' | 'checking' | 'failed'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useAccountLink() {
  const auth = useAuthStore()
  const myProfile = useMyProfileStore()
  const status = ref<AccountLinkStatus>('ok')
  let run = 0

  const unlinked = computed(() => !!myProfile.profile && auth.jwtPayload?.per !== myProfile.profile.id)

  async function attempt(): Promise<boolean> {
    await myProfile.load(true)
    await sleep(LINK_SETTLE_MS)
    await myProfile.syncToken()
    return !unlinked.value
  }

  async function start() {
    const id = ++run
    status.value = 'checking'
    for (let i = 0; i < LINK_ATTEMPTS; i++) {
      if (i > 0) await sleep(LINK_RETRY_MS)
      if (id !== run) return
      if (await attempt()) {
        if (id === run) status.value = 'ok'
        return
      }
      if (id !== run) return
    }
    status.value = 'failed'
  }

  function stop() {
    run++
  }

  async function check() {
    if (unlinked.value) await start()
    else status.value = 'ok'
  }

  return { status, unlinked, start, stop, check }
}
