import { reactive, watch } from 'vue'
import { patchQuery, readQuery } from '@/utils/urlState'

/**
 * Reactive record of string values mirrored in the address bar: a value equal to
 * its default stays out of the URL, query parameters this record does not own are
 * left alone. Writes go through History.replaceState, so the state survives a
 * reload and a shared link without adding history entries.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T): T {
  const keys = Object.keys(defaults)
  const params = readQuery()
  const path = window.location.pathname
  const state = reactive({ ...defaults }) as T
  for (const key of keys) {
    const fromUrl = params.get(key)
    if (fromUrl !== null) (state as Record<string, string>)[key] = fromUrl
  }

  watch(
    state,
    () => {
      const changed: Record<string, string> = {}
      for (const key of keys) if (state[key] !== defaults[key]) changed[key] = state[key]
      patchQuery(keys, changed, path)
    },
    { deep: true },
  )
  return state
}
