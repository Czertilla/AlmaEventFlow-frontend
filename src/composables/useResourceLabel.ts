import { ref, watchEffect } from 'vue'
import { resolveResourceLabel, type ResourceKind } from '@/utils/resourceLabels'

/** Резолвит id ресурса (person/collective/event/...) в человекочитаемое имя,
 * с реактивным состоянием загрузки -- для плейсхолдера, пока имя не пришло. */
export function useResourceLabel(
  kind: () => ResourceKind,
  id: () => string | null | undefined,
) {
  const label = ref<string | null>(null)
  const loading = ref(false)

  let requestId = 0
  watchEffect(async () => {
    const currentKind = kind()
    const currentId = id()
    const myRequest = ++requestId
    if (!currentId) {
      label.value = null
      loading.value = false
      return
    }
    loading.value = true
    const resolved = await resolveResourceLabel(currentKind, currentId)
    if (myRequest !== requestId) return // id/kind changed while in flight
    label.value = resolved
    loading.value = false
  })

  return { label, loading }
}
