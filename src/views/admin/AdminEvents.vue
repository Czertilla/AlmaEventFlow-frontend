<template>
  <AdminLayout title="Мероприятия">
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(e) => e.name"
        :get-subtitle="(e) => e.date || 'Нет даты'"
        :fetch-items="fetchEvents"
        :sort-options="sortOptions"
        :filters="filters"
        default-sort="date"
        add-label="Добавить"
        @add="openCreate"
        @edit="openEdit"
        @delete="handleDelete"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать мероприятие' : 'Редактировать мероприятие'"
        :fields="formFields"
        :item="editingItem"
        :on-save="saveEvent"
        @close="editModal = false"
      />
    </ion-modal>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getEventsEventV1EventsGet,
  createEventEventV1EventsPost,
  patchEventEventV1EventsEventIdPatch,
  deleteEventEventV1EventsEventIdDelete,
  getLocationsGeoV1LocationsGet,
  listOrganizationsOrgV1OrganizationsGet,
} from '@/api/generated/almaEventFlow'
import type { EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1 } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const statusLabels: Record<EventStatusEnumV1, string> = {
  draft: 'Черновик', template: 'Шаблон', active: 'Активно', archived: 'Архив',
}
const levelLabels: Record<EventLevelEnumV1, string> = {
  internal: 'Внутренний', regional: 'Региональный', national: 'Национальный', international: 'Международный',
}
const typeLabels: Record<EventTypeEnumV1, string> = {
  rehearsal: 'Репетиция', competition: 'Конкурс', concert: 'Концерт',
  festival: 'Фестиваль', play: 'Спектакль', performance: 'Выступление',
}
const formatLabels: Record<EventFormatEnumV1, string> = {
  online: 'Онлайн', offline: 'Офлайн',
}

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'date', label: 'Дата', sortable: true, render: (e) => e.date || '—' },
  { key: 'status', label: 'Статус', sortable: true, render: (e) => statusLabels[e.status as EventStatusEnumV1] || e.status || '—' },
  { key: 'type', label: 'Тип', render: (e) => typeLabels[e.type as EventTypeEnumV1] || '—' },
  { key: 'level', label: 'Уровень', render: (e) => levelLabels[e.level as EventLevelEnumV1] || '—' },
  { key: 'format', label: 'Формат', render: (e) => formatLabels[e.format as EventFormatEnumV1] || '—', hideMobile: true },
]

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  { value: 'date', label: 'Дате' },
  { value: 'status', label: 'Статусу' },
]

const filters: FilterDef[] = [
  { key: 'status', label: 'Статус', type: 'select', options: toOptions(statusLabels) },
  { key: 'type', label: 'Тип', type: 'select', options: toOptions(typeLabels) },
  { key: 'level', label: 'Уровень', type: 'select', options: toOptions(levelLabels) },
  { key: 'format', label: 'Формат', type: 'select', options: toOptions(formatLabels) },
  { key: 'date__gte', label: 'Дата с', type: 'date' },
  { key: 'date__lte', label: 'Дата по', type: 'date' },
]

const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'date', label: 'Дата', type: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'status', label: 'Статус', type: 'select', options: toOptions(statusLabels) },
  { key: 'type', label: 'Тип', type: 'select', options: toOptions(typeLabels) },
  { key: 'level', label: 'Уровень', type: 'select', options: toOptions(levelLabels) },
  { key: 'format', label: 'Формат', type: 'select', options: toOptions(formatLabels) },
  {
    key: 'location_id',
    label: 'Место проведения',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await getLocationsGeoV1LocationsGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
  {
    key: 'organizer_id',
    label: 'Организатор',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await listOrganizationsOrgV1OrganizationsGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchEvents(params: Record<string, any>) {
  return getEventsEventV1EventsGet(params as any)
}

function openEdit(item: any) {
  isCreating.value = false
  editingItem.value = item
  editModal.value = true
}

function openCreate() {
  isCreating.value = true
  editingItem.value = null
  editModal.value = true
}

async function saveEvent(data: any) {
  if (isCreating.value) {
    await createEventEventV1EventsPost(data as any)
  } else if (editingItem.value) {
    await patchEventEventV1EventsEventIdPatch(editingItem.value.id, data)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteEventEventV1EventsEventIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
