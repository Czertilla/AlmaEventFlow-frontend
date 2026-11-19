import type { LocationQuery, RouteLocationNormalized } from 'vue-router'
import { START_LOCATION } from 'vue-router'

export const PENDING_COLLECTIVE_KEY = 'pendingCollective'
export const PENDING_COLLECTIVE_TTL_MS = 7 * 24 * 3600 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLLECTIVE_PATH = /^\/collective\/([^/?#]+)\/?$/

export function asCollectiveId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && UUID.test(raw) ? raw.toLowerCase() : null
}

export function collectiveFromQuery(query: LocationQuery): string | null {
  return asCollectiveId(query.collective)
}

export function collectiveFromPath(path: string): string | null {
  const match = COLLECTIVE_PATH.exec(path)
  return match ? asCollectiveId(match[1]) : null
}

export function rememberCollective(id: string, now = Date.now()): void {
  const collective = asCollectiveId(id)
  if (!collective) return
  try {
    localStorage.setItem(PENDING_COLLECTIVE_KEY, JSON.stringify({ id: collective, at: now }))
  } catch {
    /* private mode: the link in the letter still carries the collective */
  }
}

export function pendingCollective(now = Date.now()): string | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(PENDING_COLLECTIVE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const stored = JSON.parse(raw) as { id?: unknown; at?: unknown }
    const id = asCollectiveId(stored.id)
    if (id && typeof stored.at === 'number' && now - stored.at < PENDING_COLLECTIVE_TTL_MS) return id
  } catch {
    /* falls through to forget */
  }
  forgetCollective()
  return null
}

export function forgetCollective(): void {
  try {
    localStorage.removeItem(PENDING_COLLECTIVE_KEY)
  } catch {
    /* nothing to forget */
  }
}

export function collectivePath(id: string): string {
  return `/collective/${id}`
}

export function collectiveJoinLink(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, '')}/auth/register?collective=${id}`
}

export function isEntry(from: RouteLocationNormalized): boolean {
  return from === START_LOCATION || from.matched.length === 0 || from.meta.guest === true
    || from.path === '/auth/link-invite'
}

export interface QuickStartAuth {
  jwtPayload: { per?: string | null } | null
  user: { person_id?: string | null } | null
  refreshWhenLinked(personId: string): Promise<unknown>
}

export async function quickStartRoute(auth: QuickStartAuth, now = Date.now()): Promise<string | null> {
  const id = pendingCollective(now)
  if (!id) return null
  forgetCollective()
  const linked = auth.user?.person_id
  if (!auth.jwtPayload?.per && linked) await auth.refreshWhenLinked(linked)
  return collectivePath(id)
}
