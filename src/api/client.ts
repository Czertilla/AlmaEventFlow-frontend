import axios from 'axios'
import { isSessionRejected, isUnreachable, serviceOf } from '@/api/availability'
import { markUp, suspect } from '@/composables/useBackendStatus'

const BASE_URL = import.meta.env.VITE_API_URL || ''

// Set global defaults — orval-generated functions use axios directly
axios.defaults.baseURL = BASE_URL
axios.defaults.withCredentials = true
axios.defaults.paramsSerializer = { indexes: null }

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

// Request interceptor — adds Bearer to every request
axios.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshing: Promise<string> | null = null

// Один refresh на всех: бэкенд отзывает всю сессию, если refresh-токен
// предъявлен дважды, поэтому параллельные или повторные вызовы недопустимы.
export function refreshAccessToken(): Promise<string> {
  refreshing ??= axios
    .post('/user/v1/auth/jwt/refresh')
    .then(({ data }) => {
      setAccessToken(data.access_token)
      return data.access_token as string
    })
    .catch((error) => {
      if (isSessionRejected(error)) setAccessToken(null)
      throw error
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

function trackAvailability(url: string | undefined, error?: unknown) {
  const service = serviceOf(url)
  if (!service) return
  if (error && isUnreachable(error)) suspect(service)
  else markUp(service)
}

// Response interceptor — refresh on 401
axios.interceptors.response.use(
  (response) => {
    trackAvailability(response.config.url)
    return response
  },
  async (error) => {
    const originalRequest = error.config
    trackAvailability(originalRequest?.url, error)
    // Don't retry refresh requests — prevents infinite loop
    if (originalRequest.url?.includes('/auth/jwt/refresh')) {
      throw error
    }
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const newToken = await refreshAccessToken()
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return axios(originalRequest)
    }
    throw error
  },
)

// Keep for direct usage
const apiClient = axios

export default apiClient
