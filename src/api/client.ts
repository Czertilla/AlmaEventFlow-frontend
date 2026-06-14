import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

// Set global defaults — orval-generated functions use axios directly
axios.defaults.baseURL = BASE_URL
axios.defaults.withCredentials = true

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

let isRefreshing = false
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = []

// Response interceptor — refresh on 401
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    // Don't retry refresh requests — prevents infinite loop
    if (originalRequest.url?.includes('/auth/jwt/refresh')) {
      throw error
    }
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve: () => resolve(axios(originalRequest)), reject })
        })
      }
      originalRequest._retry = true
      isRefreshing = true
      try {
        const { data } = await axios.post('/user/v1/auth/jwt/refresh')
        const newToken: string = data.access_token
        setAccessToken(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        pendingQueue.forEach((p) => p.resolve())
        pendingQueue = []
        return axios(originalRequest)
      } catch (refreshError) {
        setAccessToken(null)
        pendingQueue.forEach((p) => p.reject(refreshError))
        pendingQueue = []
        throw refreshError
      } finally {
        isRefreshing = false
      }
    }
    throw error
  },
)

// Keep for direct usage
const apiClient = axios

export default apiClient
