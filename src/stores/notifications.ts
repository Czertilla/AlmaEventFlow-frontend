import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getMyClients,
  getMyPreferences,
  getTransports,
  sendTestNotification,
  setMyPreferences,
  type ClientRead,
  type PreferenceItem,
  type TransportInfo,
  type TransportType,
} from '@/api/notify'

const GUARANTEED: TransportType = 'email'

export const useNotificationsStore = defineStore('notifications', () => {
  const transports = ref<TransportInfo[]>([])
  const preferences = ref<PreferenceItem[]>([])
  const clients = ref<ClientRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function isEnabled(transport: TransportType): boolean {
    if (transport === GUARANTEED) return true
    return preferences.value.find((p) => p.transport === transport)?.is_enabled ?? false
  }

  function clientsFor(transport: TransportType): ClientRead[] {
    return clients.value.filter((c) => c.transport === transport)
  }

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const [t, p, c] = await Promise.all([
        getTransports(),
        getMyPreferences(),
        getMyClients(),
      ])
      transports.value = t
      preferences.value = p.preferences
      clients.value = c
    } catch {
      error.value = 'Не удалось загрузить настройки уведомлений'
    } finally {
      loading.value = false
    }
  }

  async function setPreference(transport: TransportType, enabled: boolean) {
    if (transport === GUARANTEED) return
    const map = new Map(preferences.value.map((p) => [p.transport, p.is_enabled]))
    map.set(transport, enabled)
    map.set(GUARANTEED, true)
    for (const t of transports.value) {
      if (!map.has(t.type)) map.set(t.type, t.type === GUARANTEED)
    }
    const items: PreferenceItem[] = [...map].map(([tr, is_enabled]) => ({
      transport: tr,
      is_enabled,
    }))
    const result = await setMyPreferences({ preferences: items })
    preferences.value = result.preferences
  }

  async function refreshClients() {
    clients.value = await getMyClients()
  }

  async function sendTest() {
    await sendTestNotification()
  }

  return {
    transports,
    preferences,
    clients,
    loading,
    error,
    isEnabled,
    clientsFor,
    refresh,
    setPreference,
    refreshClients,
    sendTest,
  }
})
