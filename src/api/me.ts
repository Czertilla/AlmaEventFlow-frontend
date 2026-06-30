import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { MemberRead } from '@/api/generated/almaEventFlow'

/**
 * Членства текущего пользователя во всех коллективах (роль участника).
 *
 * Ручная обёртка, пока эндпоинт не попал в сгенерированный клиент: orval
 * читает api_schema/openapi.json, который обновляется только против живого
 * backend (`npm run generate`). После регенерации этот хелпер можно заменить
 * на сгенерированный getMyMembersEventV1MeMembersGet.
 */
export const getMyMembersEventV1MeMembersGet = (
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<MemberRead[]>> =>
  axios.get('/event/v1/me/members', options)
