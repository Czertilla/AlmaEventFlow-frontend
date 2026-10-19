export function readQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

export function patchQuery(
  owned: readonly string[],
  values: Record<string, string | null | undefined>,
  expectedPath?: string,
): void {
  if (expectedPath !== undefined && window.location.pathname !== expectedPath) return
  const params = readQuery()
  for (const key of owned) params.delete(key)
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, value)
  }
  const search = params.toString()
  const next = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) window.history.replaceState(window.history.state, '', next)
}

export function splitTarget(target: string): { path: string; search: string } {
  const url = new URL(target, window.location.origin)
  return { path: url.pathname, search: url.search }
}

export function withQuery(path: string, query: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}
