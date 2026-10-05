import type { FilterDef, SortOption } from '@/components/admin/ResourceTable.vue'

export const TIMESTAMP_SORT_OPTIONS: SortOption[] = [
  { value: 'created_at', label: 'Дате создания' },
  { value: 'edited_at', label: 'Дате изменения' },
]

export const TIMESTAMP_FILTERS: FilterDef[] = [
  { key: 'created_at__gte', label: 'Создано с', type: 'date' },
  { key: 'created_at__lte', label: 'Создано по', type: 'date' },
  { key: 'edited_at__gte', label: 'Изменено с', type: 'date' },
  { key: 'edited_at__lte', label: 'Изменено по', type: 'date' },
]
