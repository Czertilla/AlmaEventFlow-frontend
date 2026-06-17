<template>
  <AdminLayout title="Роли">
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(r) => r.name"
      :get-subtitle="(r) => r.collective_id"
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
        :on-save="save"
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
  getRolesEventV1RolesGet,
  createRoleEventV1RolesPost,
  patchRoleEventV1RolesRoleIdPatch,
  deleteRoleEventV1RolesRoleIdDelete,
  listCollectivesOrgV1CollectivesGet,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'collective_id', label: 'Коллектив' },
]

const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  {
    key: 'collective_id', label: 'Коллектив', type: 'search', required: true,
    fetchOptions: async (search) => (await listCollectivesOrgV1CollectivesGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
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
