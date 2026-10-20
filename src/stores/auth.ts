import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { setAccessToken, getAccessToken, refreshAccessToken } from '@/api/client'
import { isSessionRejected } from '@/api/availability'
import { decodeJwt, type JwtPayload } from '@/utils/jwt'
import { useEventCalendarStore } from './eventCalendar'
import { useMyProfileStore } from './myProfile'
import {
  loginUserV1AuthJwtLoginPost,
  logoutUserV1AuthJwtLogoutPost,
  usersCurrentUserUserV1UsersMeGet,
  usersPatchCurrentUserUserV1UsersMePatch,
  registerRegisterUserV1AuthRegisterPost,
  resetForgotPasswordUserV1AuthForgotPasswordPost,
  resetResetPasswordUserV1AuthResetPasswordPost,
  loginWithTelegramUserV1AuthTelegramLoginPost,
} from '@/api/generated/almaEventFlow'
import type {
  UserCreate,
  UserRead,
  UserUpdate,
  BodyLoginUserV1AuthJwtLoginPost,
  TelegramWidgetAuth,
} from '@/api/generated/almaEventFlow'

// 'unknown': бэкенд не ответил про сессию (сеть, 5xx) -- её нельзя ни считать, ни сбрасывать
export type RefreshOutcome = 'signed-in' | 'signed-out' | 'unknown'

const LINK_POLL_MS = [200, 400, 800, 1200]

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserRead | null>(null)
  const accessToken = ref<string | null>(getAccessToken())
  const jwtPayload = ref<JwtPayload | null>(null)
  const refreshAttempted = ref(false)

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
    useMyProfileStore().reset()
    setAccess(data.access_token)
    await fetchUser()
  }

  async function loginWithTelegram(payload: TelegramWidgetAuth) {
    const response = await loginWithTelegramUserV1AuthTelegramLoginPost(payload)
    const data = response.data as { access_token: string }
    // Тот же порядок, что и в login(): сброс календаря ДО навигации.
    useEventCalendarStore().reset()
    useMyProfileStore().reset()
    setAccess(data.access_token)
    await fetchUser()
  }

  async function tryRefresh(): Promise<RefreshOutcome> {
    try {
      setAccess(await refreshAccessToken())
    } catch (error) {
      if (!isSessionRejected(error)) return 'unknown'
      clearAuth()
      return 'signed-out'
    }
    await fetchUser()
    return 'signed-in'
  }

  async function refreshWhenLinked(personId: string): Promise<RefreshOutcome> {
    for (let attempt = 0; attempt <= LINK_POLL_MS.length; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, LINK_POLL_MS[attempt - 1]))
      await fetchUser()
      if (user.value?.person_id === personId) break
    }
    return tryRefresh()
  }

  async function fetchUser() {
    try {
      const response = await usersCurrentUserUserV1UsersMeGet()
      user.value = response.data
    } catch (e) {
      // профиль не критичен для рендера, но молча глотать ошибку не стоит
      console.warn('fetchUser failed:', e)
    }
  }

  async function register(userData: UserCreate) {
    const response = await registerRegisterUserV1AuthRegisterPost(userData)
    return response.data
  }

  async function updateProfile(payload: UserUpdate) {
    const response = await usersPatchCurrentUserUserV1UsersMePatch(payload)
    user.value = response.data
    return response.data
  }

  async function forgotPassword(email: string) {
    await resetForgotPasswordUserV1AuthForgotPasswordPost({ email })
  }

  async function resetPassword(token: string, password: string) {
    await resetResetPasswordUserV1AuthResetPasswordPost({ token, password })
  }

  async function logout() {
    try {
      await logoutUserV1AuthJwtLogoutPost()
    } catch {
      // ignore logout errors
    }
    clearAuth()
    useEventCalendarStore().reset()
    useMyProfileStore().reset()
  }

  return {
    user,
    accessToken,
    jwtPayload,
    refreshAttempted,
    isAuthenticated,
    isSuperuser,
    login,
    loginWithTelegram,
    tryRefresh,
    refreshWhenLinked,
    fetchUser,
    register,
    updateProfile,
    forgotPassword,
    resetPassword,
    logout,
    clearAuth,
  }
})
