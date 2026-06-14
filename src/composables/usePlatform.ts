import { ref } from 'vue'

const DESKTOP_BREAKPOINT = 768

// Синглтон с синхронной инициализацией — иначе при первом рендере
// все компоненты считают платформу мобильной до onMounted
const isDesktop = ref(typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT)

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isDesktop.value = window.innerWidth >= DESKTOP_BREAKPOINT
  })
}

export function usePlatform() {
  return { isDesktop }
}
