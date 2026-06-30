import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type Theme = 'light' | 'dark'
export type DateFormat = 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
export type FirstDayOfWeek = 'monday' | 'sunday'
export type Animations = 'auto' | 'on' | 'off'

function loadSetting<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key)
  if (stored !== null) {
    try { return JSON.parse(stored) as T } catch { /* ignore */ }
  }
  return fallback
}

function saveSetting(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

const reducedMotionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<Theme>(loadSetting<Theme>('theme', 'light'))
  const dateFormat = ref<DateFormat>(loadSetting<DateFormat>('dateFormat', 'DD.MM.YYYY'))
  const firstDayOfWeek = ref<FirstDayOfWeek>(loadSetting<FirstDayOfWeek>('firstDayOfWeek', 'monday'))
  const animations = ref<Animations>(loadSetting<Animations>('animations', 'auto'))
  const systemReducedMotion = ref(reducedMotionQuery?.matches ?? false)

  reducedMotionQuery?.addEventListener('change', (e) => {
    systemReducedMotion.value = e.matches
  })

  // 'auto' уважает системную настройку экономии движения; 'on'/'off' — ручное
  // переопределение для производительности и энергосбережения.
  const animationsEnabled = computed(() => {
    if (animations.value === 'on') return true
    if (animations.value === 'off') return false
    return !systemReducedMotion.value
  })

  function applyTheme(t: Theme) {
    document.documentElement.classList.toggle('ion-palette-dark', t === 'dark')
  }

  function applyAnimations(enabled: boolean) {
    document.documentElement.classList.toggle('no-animations', !enabled)
    saveSetting('animationsEnabled', enabled)
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  watch(theme, (val) => {
    applyTheme(val)
    saveSetting('theme', val)
  }, { immediate: true })

  watch(dateFormat, (val) => saveSetting('dateFormat', val))
  watch(firstDayOfWeek, (val) => saveSetting('firstDayOfWeek', val))
  watch(animations, (val) => saveSetting('animations', val))
  watch(animationsEnabled, applyAnimations, { immediate: true })

  return {
    theme,
    dateFormat,
    firstDayOfWeek,
    animations,
    animationsEnabled,
    toggleTheme,
    applyTheme,
  }
})
