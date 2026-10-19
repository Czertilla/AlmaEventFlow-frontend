<template>
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(r) => r.name"
      :get-subtitle="(r) => r.collective_id"
      :subtitle-resource="(r) => ({ kind: 'collective', id: r.collective_id })"
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
        :title="isCreating ? 'Создать роль' : 'Редактировать роль'"
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
import { peopleOutline, peopleCircleOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getRolesEventV1RolesGet,
  createRoleEventV1RolesPost,
  patchRoleEventV1RolesRoleIdPatch,
  deleteRoleEventV1RolesRoleIdDelete,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef, RowLink } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()

const filters: FilterDef[] = [
  { key: 'collective_id', label: 'Коллектив', type: 'picker', picker: 'collective' },
  { key: 'id', label: 'Роль', type: 'picker', picker: 'role' },
  ...TIMESTAMP_FILTERS,
]

const rowLinks: RowLink[] = [
  { label: 'Участники', icon: peopleOutline, to: (r) => withQuery('/admin/members', { role_id: r.id }) },
  { label: 'Коллектив', icon: peopleCircleOutline, to: (r) => withQuery('/admin/collectives', { id: r.collective_id }) },
]

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  ...TIMESTAMP_SORT_OPTIONS,
]

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'collective_id', label: 'Коллектив', resource: (r) => ({ kind: 'collective', id: r.collective_id }) },
]

const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'collective_id', label: 'Коллектив', type: 'search', required: true, picker: 'collective' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getRolesEventV1RolesGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createRoleEventV1RolesPost(data as any)
  } else if (editingItem.value) {
    await patchRoleEventV1RolesRoleIdPatch(editingItem.value.id, { name: data.name })
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteRoleEventV1RolesRoleIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
