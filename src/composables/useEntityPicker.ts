import { ref } from 'vue'
import type { AxiosResponse } from 'axios'

export interface PickerOption { id: string; name: string }

type PickerFetch = (
  params: { search: string; limit: number },
) => Promise<AxiosResponse<{ items: PickerOption[] }>>

/**
 * Поиск-выбор сущности по справочнику (организатор, локация …): строка поиска,
 * выпадающие варианты, выбранное значение. Вынесено из форм мероприятия, где
 * этот паттерн повторялся для организатора и локации.
 */
export function useEntityPicker(fetchFn: PickerFetch, limit = 10) {
  const search = ref('')
  const options = ref<PickerOption[]>([])
  const selected = ref<PickerOption | null>(null)

  async function runSearch() {
    if (!search.value) {
      options.value = []
      return
    }
    try {
      const res = await fetchFn({ search: search.value, limit })
      options.value = res.data.items ?? []
    } catch {
      options.value = []
    }
  }

  function select(option: PickerOption) {
    selected.value = option
    search.value = ''
    options.value = []
  }

  function clear() {
    selected.value = null
  }

  function reset() {
    selected.value = null
    search.value = ''
    options.value = []
  }

  return { search, options, selected, runSearch, select, clear, reset }
}
