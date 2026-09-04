import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePrincipalStore } from '@/stores/principal'

/**
 * Общая логика подсветки разделов и перехода в панель руководителя.
 * Используется десктопной шапкой и оболочкой вкладок — чтобы не дублировать
 * `route.path.startsWith(...)` и переход к коллективу в нескольких местах.
 */
export function useSectionNav() {
  const route = useRoute()
  const router = useRouter()
  const principal = usePrincipalStore()

  const isAdminActive = computed(() => route.path.startsWith('/admin'))
  const isPrincipalActive = computed(() => route.path.startsWith('/principal'))
  const isHomeActive = computed(
    () => route.path === '/' || route.path.startsWith('/event'),
  )

  function goToPrincipal() {
    router.push('/principal/dashboard')
  }

  function selectCollective(id: string) {
    principal.setActivePrincipalCollective(id)
    router.push('/principal/dashboard')
  }

  return { isAdminActive, isPrincipalActive, isHomeActive, goToPrincipal, selectCollective }
}
