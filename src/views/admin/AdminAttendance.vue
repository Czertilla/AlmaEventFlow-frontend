<template>
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(a) => a.member_id"
      :label-resource="(a) => ({ kind: 'memberInCollective', id: a.member_id })"
      :get-subtitle="(a) => a.is_attended ? 'Присутствовал' : 'Отсутствовал'"
      search-placeholder="ФИО, коллектив, мероприятие, комментарий или ID"
      :sort-options="sortOptions"
      :filters="filters"
      :row-links="rowLinks"
      default-order="desc"
      default-sort="created_at"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать запись' : 'Редактировать запись'"
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
import { peopleOutline, personAddOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getAttendancesEventV1AttendancesGet,
  createAttendanceEventV1AttendancesPost,
  patchAttendanceEventV1AttendancesAttendanceIdPatch,
  deleteAttendanceEventV1AttendancesAttendanceIdDelete,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef, RowLink } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()

const yesNo = [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }]

const filters: FilterDef[] = [
  { key: 'collective_id', label: 'Коллектив', type: 'picker', picker: 'collective' },
  { key: 'event_id', label: 'Мероприятие', type: 'picker', picker: 'event' },
  { key: 'participation_id', label: 'Участие', type: 'picker', picker: 'participation' },
  { key: 'member_id', label: 'Участник коллектива', type: 'picker', picker: 'member' },
  { key: 'person_id', label: 'Персона', type: 'picker', picker: 'person' },
  { key: 'is_attended', label: 'Присутствие', type: 'select', options: yesNo },
  { key: 'is_verified', label: 'Заверено', type: 'select', options: yesNo },
  ...TIMESTAMP_FILTERS,
]

const sortOptions: SortOption[] = [
  { value: 'is_attended', label: 'Присутствию' },
  { value: 'is_verified', label: 'Заверению' },
  ...TIMESTAMP_SORT_OPTIONS,
]

const columns: ColumnDef[] = [
  { key: 'member_id', label: 'Участник', resource: (a) => ({ kind: 'memberInCollective', id: a.member_id }) },
  { key: 'participation_id', label: 'Участие', resource: (a) => ({ kind: 'participation', id: a.participation_id }) },
  { key: 'is_attended', label: 'Присутствие', render: (a) => a.is_attended ? 'Да' : 'Нет' },
  { key: 'is_verified', label: 'Заверено', render: (a) => a.is_verified ? 'Да' : 'Нет', hideMobile: true },
  { key: 'comment', label: 'Комментарий', hideMobile: true },
]

const rowLinks: RowLink[] = [
  { label: 'Участник', icon: personAddOutline, to: (a) => withQuery('/admin/members', { id: a.member_id }) },
  { label: 'Участие', icon: peopleOutline, to: (a) => withQuery('/admin/participation', { id: a.participation_id }) },
]

const formFields: FormField[] = [
  { key: 'member_id', label: 'Участник', type: 'search', required: true, picker: 'member' },
  { key: 'participation_id', label: 'Участие', type: 'search', required: true, picker: 'participation' },
  { key: 'is_attended', label: 'Присутствовал', type: 'checkbox' },
  { key: 'is_verified', label: 'Заверено', type: 'checkbox' },
  { key: 'comment', label: 'Комментарий', type: 'textarea' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getAttendancesEventV1AttendancesGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createAttendanceEventV1AttendancesPost(data as any)
  } else if (editingItem.value) {
    await patchAttendanceEventV1AttendancesAttendanceIdPatch(editingItem.value.id, data)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteAttendanceEventV1AttendancesAttendanceIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
