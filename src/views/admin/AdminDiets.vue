<template>
  <AdminLayout title="Диеты">
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(d) => d.name"
      :get-subtitle="(d) => d.description || ''"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать диету' : 'Редактировать диету'"
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
  getManyProfileV1DietsGet,
  createDietProfileV1DietsPost,
  patchDietProfileV1DietsIdPatch,
  deleteDietProfileV1DietsIdDelete,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'description', label: 'Описание', render: (d) => d.description || '—' },
]

const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'description', label: 'Описание', type: 'textarea' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getManyProfileV1DietsGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createDietProfileV1DietsPost(data as any)
  } else if (editingItem.value) {
    await patchDietProfileV1DietsIdPatch(editingItem.value.id, { id: editingItem.value.id, ...data })
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteDietProfileV1DietsIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
