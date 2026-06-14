import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark'
export type DateFormat = 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
export type FirstDayOfWeek = 'monday' | 'sunday'

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

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<Theme>(loadSetting<Theme>('theme', 'light'))
  const dateFormat = ref<DateFormat>(loadSetting<DateFormat>('dateFormat', 'DD.MM.YYYY'))
  const firstDayOfWeek = ref<FirstDayOfWeek>(loadSetting<FirstDayOfWeek>('firstDayOfWeek', 'monday'))

  function applyTheme(t: Theme) {
    document.documentElement.classList.toggle('ion-palette-dark', t === 'dark')
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

  return {
    theme,
    dateFormat,
    firstDayOfWeek,
    toggleTheme,
    applyTheme,
  }
})
