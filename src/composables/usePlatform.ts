import { ref } from 'vue'

const DESKTOP_BREAKPOINT = 768

const desktopQuery =
  typeof window !== 'undefined'
    ? window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    : null

const isDesktop = ref(desktopQuery?.matches ?? false)

desktopQuery?.addEventListener('change', (e) => {
  isDesktop.value = e.matches
})

export function usePlatform() {
  return { isDesktop }
}
