export type Guard = (value: unknown) => boolean

const oneOf = (...allowed: string[]): Guard => (value) =>
  typeof value === 'string' && allowed.includes(value)

const isBoolean: Guard = (value) => typeof value === 'boolean'

export const SETTING_GUARDS = {
  theme: oneOf('light', 'dark'),
  dateFormat: oneOf('DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'),
  firstDayOfWeek: oneOf('monday', 'sunday'),
  animations: oneOf('auto', 'on', 'off'),
  showHints: isBoolean,
  collapseOnScroll: isBoolean,
} satisfies Record<string, Guard>

export type SettingKey = keyof typeof SETTING_GUARDS
export type SettingValues = Partial<Record<SettingKey, unknown>>

export const SETTING_KEYS = Object.keys(SETTING_GUARDS) as SettingKey[]

export interface SyncState {
  owner: string | null
  revision: number
  dirty: SettingKey[]
}

export const EMPTY_SYNC_STATE: SyncState = { owner: null, revision: 0, dirty: [] }

function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTING_GUARDS, key)
}

/** The values the app understands: unknown names and values of a wrong shape are dropped. */
export function readRemote(values: Record<string, unknown>): SettingValues {
  const known: SettingValues = {}
  for (const [key, value] of Object.entries(values)) {
    if (isSettingKey(key) && SETTING_GUARDS[key](value)) known[key] = value
  }
  return known
}

export function readSyncState(raw: string | null): SyncState {
  if (!raw) return { ...EMPTY_SYNC_STATE }
  try {
    const parsed = JSON.parse(raw) as Partial<SyncState>
    const dirty = Array.isArray(parsed.dirty) ? parsed.dirty.filter(isSettingKey) : []
    return {
      owner: typeof parsed.owner === 'string' ? parsed.owner : null,
      revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
      dirty: [...new Set(dirty)],
    }
  } catch {
    return { ...EMPTY_SYNC_STATE }
  }
}

export interface SyncPlanInput {
  account: string
  state: SyncState
  local: SettingValues
  chosenHere: SettingKey[]
  remote: SettingValues
}

export interface SyncPlan {
  apply: SettingValues
  push: SettingKey[]
}

/**
 * What to do with the settings once the server has answered. The server wins
 * for every setting this device did not change since the last sync; a change
 * made here is sent instead. A browser that never synced offers the settings
 * its person picked before sync existed, unless another account used it last.
 */
export function planSync({ account, state, local, chosenHere, remote }: SyncPlanInput): SyncPlan {
  const ownedHere = state.owner === null || state.owner === account
  const dirty = new Set<SettingKey>(ownedHere ? state.dirty : [])
  if (state.owner === null) {
    for (const key of chosenHere) {
      if (!(key in remote)) dirty.add(key)
    }
  }
  const apply: SettingValues = {}
  for (const key of SETTING_KEYS) {
    if (dirty.has(key) || !(key in remote)) continue
    if (remote[key] !== local[key]) apply[key] = remote[key]
  }
  return { apply, push: SETTING_KEYS.filter((key) => dirty.has(key)) }
}

/** Keys still waiting after a push: those changed again while the request was on its way. */
export function stillDirty(sent: SettingValues, current: SettingValues): SettingKey[] {
  return SETTING_KEYS.filter((key) => key in sent && sent[key] !== current[key])
}
