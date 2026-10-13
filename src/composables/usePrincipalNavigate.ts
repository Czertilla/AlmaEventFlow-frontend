import { inject, ref, type InjectionKey } from 'vue'
import { useRouter } from 'vue-router'

export const principalNavigateKey: InjectionKey<(path: string) => void> = Symbol('principalNavigate')

export const principalReturnTo = ref<string | null>(null)

export function usePrincipalNavigate() {
  const injected = inject(principalNavigateKey)
  const router = useRouter()
  return injected ?? ((path: string) => { router.push(path) })
}
