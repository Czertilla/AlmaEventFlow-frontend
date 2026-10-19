<template>
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(p) => p.collective_name || p.collective_id"
      :get-subtitle="(p) => p.event_id"
      :subtitle-resource="(p) => ({ kind: 'event', id: p.event_id })"
      search-placeholder="Коллектив, мероприятие или ID"
      :sort-options="sortOptions"
      :filters="filters"
      :row-links="rowLinks"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать участие' : 'Редактировать участие'"
        :fields="formFields"
        :item="editingItem"
        :links="linksFor(rowLinks, editingItem)"
        :on-save="save"
        @close="editModal = false"
      />
    </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import { calendarOutline, checkmarkDoneOutline, peopleCircleOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getParticipationsEventV1ParticipationsGet,
  createParticipationEventV1ParticipationsPost,
  patchParticipationEventV1ParticipationsParticipationIdPatch,
  deleteParticipationEventV1ParticipationsParticipationIdDelete,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef, RowLink } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()

const priorityLabels: Record<string, string> = { hight: 'Высокий', medium: 'Средний', low: 'Низкий' }
const priorityOptions = Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))

const filters: FilterDef[] = [
  { key: 'collective_id', label: 'Коллектив', type: 'picker', picker: 'collective' },
  { key: 'event_id', label: 'Мероприятие', type: 'picker', picker: 'event' },
  { key: 'id', label: 'Участие', type: 'picker', picker: 'participation' },
  { key: 'priority_degree', label: 'Приоритет', type: 'select', options: priorityOptions },
  ...TIMESTAMP_FILTERS,
]

const sortOptions: SortOption[] = [
  { value: 'collective_id', label: 'Коллективу' },
  { value: 'priority_degree', label: 'Приоритету' },
  ...TIMESTAMP_SORT_OPTIONS,
]

const columns: ColumnDef[] = [
  { key: 'collective_name', label: 'Коллектив', render: (p) => p.collective_name || p.collective_id },
  { key: 'event_id', label: 'Мероприятие', resource: (p) => ({ kind: 'event', id: p.event_id }) },
  { key: 'priority_degree', label: 'Приоритет', render: (p) => priorityLabels[p.priority_degree] || '—' },
]

const rowLinks: RowLink[] = [
  { label: 'Посещаемость', icon: checkmarkDoneOutline, to: (p) => withQuery('/admin/attendance', { participation_id: p.id }) },
  { label: 'Коллектив', icon: peopleCircleOutline, to: (p) => withQuery('/admin/collectives', { id: p.collective_id }) },
  { label: 'Мероприятие', icon: calendarOutline, to: (p) => withQuery('/admin/events', { id: p.event_id }) },
]

const formFields: FormField[] = [
  { key: 'collective_id', label: 'Коллектив', type: 'search', required: true, picker: 'collective' },
  { key: 'event_id', label: 'Мероприятие', type: 'search', required: true, picker: 'event' },
  { key: 'priority_degree', label: 'Приоритет', type: 'select', options: priorityOptions },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getParticipationsEventV1ParticipationsGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createParticipationEventV1ParticipationsPost(data as any)
  } else if (editingItem.value) {
    await patchParticipationEventV1ParticipationsParticipationIdPatch(editingItem.value.id, data)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteParticipationEventV1ParticipationsParticipationIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
