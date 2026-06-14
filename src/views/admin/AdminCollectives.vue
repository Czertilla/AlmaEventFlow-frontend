<template>
  <AdminLayout title="Коллективы">
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(c) => c.name"
        :get-subtitle="(c) => c.acronym"
        :fetch-items="fetchCollectives"
        :sort-options="sortOptions"
        default-sort="name"
        add-label="Добавить"
        @add="openCreate"
        @edit="openEdit"
        @delete="handleDelete"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать коллектив' : 'Редактировать коллектив'"
        :fields="formFields"
        :item="editingItem"
        :on-save="saveCollective"
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
import { listCollectivesOrgV1CollectivesGet, createCollectiveOrgV1CollectivesPost, patchCollectiveOrgV1CollectivesCollectiveIdPatch, deleteCollectiveOrgV1CollectivesCollectiveIdDelete, listUniversitiesOrgV1UniversitiesGet } from '@/api/generated/-org'
import { searchPersonProfileV1PersonsGet } from '@/api/generated/-profile'
import { getAddressesGeoV1AddressesGet } from '@/api/generated/-geo'
import type { ColumnDef, SortOption } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'acronym', label: 'Аббревиатура', sortable: true },
  { key: 'type', label: 'Тип', sortable: true },
]

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  { value: 'acronym', label: 'Аббревиатуре' },
]

// Поля по схеме CollectiveCreate: name, acronym, university_id, principal_id, address_id
const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'acronym', label: 'Аббревиатура', type: 'text', required: true },
  {
    key: 'university_id',
    label: 'Университет',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await listUniversitiesOrgV1UniversitiesGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
  {
    key: 'principal_id',
    label: 'Руководитель',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await searchPersonProfileV1PersonsGet({ search, limit: 20 })
      return res.data.items
    },
    displayFn: (p) => [p.surname, p.name, p.patronymic].filter(Boolean).join(' '),
  },
  {
    key: 'address_id',
    label: 'Адрес',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await getAddressesGeoV1AddressesGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchCollectives(params: Record<string, any>) {
  return listCollectivesOrgV1CollectivesGet(params as any)
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

async function saveCollective(data: any) {
  if (isCreating.value) {
    // university_id обязателен в схеме (nullable)
    await createCollectiveOrgV1CollectivesPost({ university_id: null, ...data })
  } else if (editingItem.value) {
    await patchCollectiveOrgV1CollectivesCollectiveIdPatch(editingItem.value.id, data)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteCollectiveOrgV1CollectivesCollectiveIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
