import { onBeforeUnmount, onMounted, type Ref } from 'vue'

export interface SwipeOptions {
  onLeft: () => void
  onRight: () => void
  enabled?: () => boolean
  minDistance?: number
}

const MAX_DURATION_MS = 700
const DOMINANCE = 1.5

export function useSwipe(target: Ref<HTMLElement | null>, options: SwipeOptions) {
  const minDistance = options.minDistance ?? 60
  let start: { x: number; y: number; time: number } | null = null

  function onStart(event: TouchEvent) {
    const touch = event.touches[0]
    const blocked = (event.target as HTMLElement | null)?.closest('[data-no-swipe]')
    start = event.touches.length === 1 && touch && !blocked ? { x: touch.clientX, y: touch.clientY, time: Date.now() } : null
  }

  function onEnd(event: TouchEvent) {
    const from = start
    start = null
    const touch = event.changedTouches[0]
    if (!from || !touch || options.enabled?.() === false) return
    const dx = touch.clientX - from.x
    const dy = touch.clientY - from.y
    if (Date.now() - from.time > MAX_DURATION_MS) return
    if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy) * DOMINANCE) return
    if (dx < 0) options.onLeft()
    else options.onRight()
  }

  onMounted(() => {
    target.value?.addEventListener('touchstart', onStart, { passive: true })
    target.value?.addEventListener('touchend', onEnd, { passive: true })
  })

  onBeforeUnmount(() => {
    target.value?.removeEventListener('touchstart', onStart)
    target.value?.removeEventListener('touchend', onEnd)
  })
}
