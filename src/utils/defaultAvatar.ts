import { createAvatar } from '@dicebear/core'
import { rings, shapes, thumbs } from '@dicebear/collection'
import type { ResourceKind } from '@/utils/resourceLabels'

export type AvatarKind = 'user' | 'event' | 'collective'

const STYLES = { user: thumbs, event: shapes, collective: rings } as const

const cache = new Map<string, string>()

export function defaultAvatarUri(kind: AvatarKind, seed: string): string {
  const key = `${kind}:${seed}`
  let uri = cache.get(key)
  if (!uri) {
    uri = createAvatar(STYLES[kind], { seed: key }).toDataUri()
    cache.set(key, uri)
  }
  return uri
}

export function userAvatarSeed(user: { id?: string | null; person_id?: string | null }): string | null {
  return user.person_id ?? user.id ?? null
}

export function avatarKindOf(resource: ResourceKind | undefined): AvatarKind | undefined {
  return resource === 'event' || resource === 'collective' ? resource : undefined
}
