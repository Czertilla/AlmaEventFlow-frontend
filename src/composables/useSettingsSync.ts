import { onScopeDispose, watch } from 'vue'
import {
  patchMySettingsUserV2UsersMeSettingsPatch,
  readMySettingsUserV2UsersMeSettingsGet,
} from '@/api/generated/almaEventFlow'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import {
  SETTING_KEYS,
  planSync,
  readRemote,
  readSyncState,
  stillDirty,
  type SettingKey,
  type SettingValues,
} from '@/utils/settingsSync'

const STATE_KEY = 'settingsSync'
const PUSH_DELAY_MS = 700
const PULL_EVERY_MS = 20_000

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Keeps the settings of the signed-in account the same on every device: pulls
 * them after sign-in and whenever the app comes back to the foreground, and
 * sends only the settings changed here, so two devices changing different
 * settings never overwrite each other.
 */
export function useSettingsSync() {
  const auth = useAuthStore()
  const settings = useSettingsStore()
  const store = settings as unknown as Record<SettingKey, unknown>

  let account: string | null = null
  let state = readSyncState(storage()?.getItem(STATE_KEY) ?? null)
  let pushTimer: ReturnType<typeof setTimeout> | undefined
  let lastPull = 0
  let applying = false
  let queue: Promise<void> = Promise.resolve()

  function persist() {
    try {
      storage()?.setItem(STATE_KEY, JSON.stringify(state))
    } catch { /* storage unavailable: the state lives until the page closes */ }
  }

  function snapshot(keys: readonly SettingKey[] = SETTING_KEYS): SettingValues {
    return Object.fromEntries(keys.map((key) => [key, store[key]]))
  }

  function chosenHere(): SettingKey[] {
    return SETTING_KEYS.filter((key) => storage()?.getItem(key) != null)
  }

  function apply(values: SettingValues) {
    applying = true
    try {
      for (const key of SETTING_KEYS) {
        if (key in values) store[key] = values[key]
      }
    } finally {
      applying = false
    }
  }

  function newerOnServer(remote: SettingValues, keep: readonly SettingKey[]): SettingValues {
    const keys = SETTING_KEYS.filter(
      (key) => key in remote && !keep.includes(key) && remote[key] !== store[key],
    )
    return Object.fromEntries(keys.map((key) => [key, remote[key]]))
  }

  function enqueue(task: () => Promise<void>) {
    queue = queue.then(task).catch((error) => {
      console.debug('settings sync failed:', error)
    })
  }

  async function push() {
    if (!account || state.owner !== account || state.dirty.length === 0) return
    const sent = snapshot(state.dirty)
    const { data } = await patchMySettingsUserV2UsersMeSettingsPatch({ values: sent as Record<string, unknown> })
    const changedMeanwhile = new Set(stillDirty(sent, snapshot()))
    const dirty = state.dirty.filter((key) => !(key in sent) || changedMeanwhile.has(key))
    state = { ...state, revision: data.revision, dirty }
    persist()
    apply(newerOnServer(readRemote(data.values), dirty))
  }

  async function sync() {
    const who = account
    if (!who) return
    const { data } = await readMySettingsUserV2UsersMeSettingsGet()
    if (account !== who) return
    const plan = planSync({
      account: who,
      state,
      local: snapshot(),
      chosenHere: chosenHere(),
      remote: readRemote(data.values),
    })
    apply(plan.apply)
    state = { owner: who, revision: data.revision, dirty: plan.push }
    persist()
    lastPull = Date.now()
    await push()
  }

  function schedulePush() {
    clearTimeout(pushTimer)
    pushTimer = setTimeout(() => enqueue(push), PUSH_DELAY_MS)
  }

  function pullIfStale() {
    if (account && Date.now() - lastPull > PULL_EVERY_MS) enqueue(sync)
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') pullIfStale()
  }
  const onOnline = () => {
    if (account) enqueue(sync)
  }

  for (const key of SETTING_KEYS) {
    watch(
      () => store[key],
      () => {
        if (applying || !account) return
        if (!state.dirty.includes(key)) state = { ...state, dirty: [...state.dirty, key] }
        persist()
        schedulePush()
      },
      { flush: 'sync' },
    )
  }

  watch(
    () => auth.jwtPayload?.sub ?? null,
    (sub) => {
      account = sub
      clearTimeout(pushTimer)
      if (!sub) return
      lastPull = 0
      enqueue(sync)
    },
    { immediate: true },
  )

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', pullIfStale)
  window.addEventListener('online', onOnline)
  onScopeDispose(() => {
    clearTimeout(pushTimer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', pullIfStale)
    window.removeEventListener('online', onOnline)
  })
}
