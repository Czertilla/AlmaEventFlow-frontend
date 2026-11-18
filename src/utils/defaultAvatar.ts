import { createAvatar } from '@dicebear/core'
import { rings, shapes, thumbs } from '@dicebear/collection'
import type { ResourceKind } from '@/utils/resourceLabels'

export type AvatarKind = 'user' | 'event' | 'collective'

const USER_SHAPES = [
  'ef4444', 'f97316', 'f59e0b', '84cc16', '22c55e', '14b8a6',
  '06b6d4', '3b82f6', '6366f1', '8b5cf6', 'd946ef', 'ec4899',
]
const USER_BACKGROUNDS = [
  'fecaca', 'fed7aa', 'fde68a', 'd9f99d', 'bbf7d0', '99f6e4',
  'a5f3fc', 'bfdbfe', 'c7d2fe', 'ddd6fe', 'f5d0fe', 'fbcfe8',
]

const AVATARS = {
  user: (seed: string) => createAvatar(thumbs, { seed, shapeColor: USER_SHAPES, backgroundColor: USER_BACKGROUNDS }),
  event: (seed: string) => createAvatar(shapes, { seed }),
  collective: (seed: string) => createAvatar(rings, { seed }),
} as const

const cache = new Map<string, string>()

export function defaultAvatarUri(kind: AvatarKind, seed: string): string {
  const key = `${kind}:${seed}`
  let uri = cache.get(key)
  if (!uri) {
    uri = AVATARS[kind](key).toDataUri()
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
