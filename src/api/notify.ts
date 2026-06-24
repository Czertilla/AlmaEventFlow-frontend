import apiClient from './client'

export type TransportType = 'email' | 'webpush' | 'telegram' | 'mobile' | 'realtime'

export interface TransportInfo {
  type: TransportType
  label: string
  requires_client: boolean
  delegated: boolean
  available: boolean
}

export interface PreferenceItem {
  transport: TransportType
  is_enabled: boolean
}

export interface PreferencesRead {
  preferences: PreferenceItem[]
}

export interface ClientRead {
  id: string
  transport: TransportType
  endpoint: string
  label: string | null
  is_active: boolean
  created_at: string
}

export interface ClientCreate {
  transport: TransportType
  endpoint: string
  label?: string | null
  payload?: Record<string, string>
}

export interface VapidPublicKey {
  public_key: string
}

const BASE = '/notify/v1'

export async function getTransports(): Promise<TransportInfo[]> {
  const { data } = await apiClient.get<TransportInfo[]>(`${BASE}/transports`)
  return data
}

export async function getMyPreferences(): Promise<PreferencesRead> {
  const { data } = await apiClient.get<PreferencesRead>(`${BASE}/preferences/my`)
  return data
}

export async function setMyPreferences(
  payload: PreferencesRead,
): Promise<PreferencesRead> {
  const { data } = await apiClient.put<PreferencesRead>(
    `${BASE}/preferences/my`,
    payload,
  )
  return data
}

export async function getMyClients(): Promise<ClientRead[]> {
  const { data } = await apiClient.get<ClientRead[]>(`${BASE}/clients/my`)
  return data
}

export async function registerMyClient(payload: ClientCreate): Promise<ClientRead> {
  const { data } = await apiClient.post<ClientRead>(`${BASE}/clients/my`, payload)
  return data
}

export async function deleteMyClient(clientId: string): Promise<void> {
  await apiClient.delete(`${BASE}/clients/my/${clientId}`)
}

export async function getVapidPublicKey(): Promise<string> {
  const { data } = await apiClient.get<VapidPublicKey>(
    `${BASE}/webpush/vapid-public-key`,
  )
  return data.public_key
}

export async function sendTestNotification(): Promise<void> {
  await apiClient.post(`${BASE}/test`)
}
