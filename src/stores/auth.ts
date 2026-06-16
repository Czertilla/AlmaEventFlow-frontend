import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { setAccessToken, getAccessToken } from '@/api/client'
import { decodeJwt, type JwtPayload } from '@/utils/jwt'
import { useEventCalendarStore } from './eventCalendar'
import {
  loginUserV1AuthJwtLoginPost,
  logoutUserV1AuthJwtLogoutPost,
  refreshUserV1AuthJwtRefreshPost,
  usersCurrentUserUserV1UsersMeGet,
  registerRegisterUserV1AuthRegisterPost,
} from '@/api/generated/almaEventFlow'
import type { UserCreate, UserRead, BodyLoginUserV1AuthJwtLoginPost } from '@/api/generated/almaEventFlow'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserRead | null>(null)
  const accessToken = ref<string | null>(getAccessToken())
  const jwtPayload = ref<JwtPayload | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)
  const isSuperuser = computed(() => jwtPayload.value?.sup === true)

  function setAccess(token: string) {
    accessToken.value = token
    jwtPayload.value = decodeJwt(token)
    setAccessToken(token)
  }

  function clearAuth() {
    accessToken.value = null
    jwtPayload.value = null
    user.value = null
    setAccessToken(null)
  }

  async function login(username: string, password: string) {
    const body: BodyLoginUserV1AuthJwtLoginPost = { username, password }
    const response = await loginUserV1AuthJwtLoginPost(body)
    const data = response.data as { access_token: string }
    // Сбрасываем данные предыдущего аккаунта ДО навигации на главную,
    // чтобы reset не стёр события, загруженные уже новым аккаунтом
    useEventCalendarStore().reset()
    setAccess(data.access_token)
    await fetchUser()
  }

  async function tryRefresh() {
    try {
      const response = await refreshUserV1AuthJwtRefreshPost()
      const data = response.data as { access_token: string }
      setAccess(data.access_token)
      await fetchUser()
      return true
    } catch {
      clearAuth()
      return false
    }
  }

  async function fetchUser() {
    try {
      const response = await usersCurrentUserUserV1UsersMeGet()
      user.value = response.data
    } catch {
      // user not critical
    }
  }

  async function register(userData: UserCreate) {
    const response = await registerRegisterUserV1AuthRegisterPost(userData)
    return response.data
  }

  async function logout() {
    try {
      await logoutUserV1AuthJwtLogoutPost()
    } catch {
      // ignore logout errors
    }
    clearAuth()
    useEventCalendarStore().reset()
  }

  return {
    user,
    accessToken,
    jwtPayload,
    isAuthenticated,
    isSuperuser,
    login,
    tryRefresh,
    fetchUser,
    register,
    logout,
    clearAuth,
  }
})
