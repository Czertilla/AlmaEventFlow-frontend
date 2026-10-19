import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createMyProfileProfileV2ProfilesMyPost,
  getMyProfileProfileV2ProfilesMyGet,
  putMyProfileProfileV2ProfilesMyPut,
} from '@/api/generated/almaEventFlow'
import type { MyProfileRead, MyProfileWrite } from '@/api/generated/almaEventFlow'
import { useAuthStore } from './auth'

export const useMyProfileStore = defineStore('myProfile', () => {
  const profile = ref<MyProfileRead | null>(null)
  const loaded = ref(false)
  const failed = ref(false)
  let inFlight: Promise<void> | null = null

  async function fetchProfile() {
    failed.value = false
    try {
      profile.value = (await getMyProfileProfileV2ProfilesMyGet()).data
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) profile.value = null
      else failed.value = true
    } finally {
      loaded.value = !failed.value
    }
  }

  function load(force = false): Promise<void> {
    if (loaded.value && !force) return Promise.resolve()
    inFlight ??= fetchProfile().finally(() => { inFlight = null })
    return inFlight
  }

  async function save(form: MyProfileWrite): Promise<MyProfileRead> {
    const response = profile.value
      ? await putMyProfileProfileV2ProfilesMyPut(form)
      : await createMyProfileProfileV2ProfilesMyPost(form)
    profile.value = response.data
    loaded.value = true
    return response.data
  }

  async function syncToken() {
    const auth = useAuthStore()
    if (profile.value && auth.jwtPayload?.per !== profile.value.id) await auth.tryRefresh()
  }

  function reset() {
    profile.value = null
    loaded.value = false
    failed.value = false
  }

  return { profile, loaded, failed, load, save, syncToken, reset }
})
