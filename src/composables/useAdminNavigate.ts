import { inject, type InjectionKey } from 'vue'
import { useRouter } from 'vue-router'

// AdminLayout переключает свои страницы в обход vue-router (см.
// utils/inPlaceNav.ts) -- если дочерняя страница сама ведёт на другую
// admin-страницу (например список персон -> личное дело), обычный
// router.push туда сломает то же самое, поэтому такой переход должен идти
// через ту же функцию, что и клики по меню. AdminLayout provide'ит её сюда;
// вне AdminLayout (страница используется отдельно) -- откатываемся на push.
export const adminNavigateKey: InjectionKey<(path: string) => void> = Symbol('adminNavigate')

export function useAdminNavigate() {
  const injected = inject(adminNavigateKey)
  const router = useRouter()
  return injected ?? ((path: string) => { router.push(path) })
}
