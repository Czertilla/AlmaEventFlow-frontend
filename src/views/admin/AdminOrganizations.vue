<template>
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(o) => o.name"
        :get-subtitle="(o) => o.acronym"
        :fetch-items="fetchOrganizations"
        :sort-options="sortOptions"
        :filters="filters"
        default-sort="name"
        add-label="Добавить"
        @add="openCreate"
        @edit="openEdit"
        @delete="handleDelete"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать организацию' : 'Редактировать организацию'"
        :fields="isCreating ? createFields : editFields"
        :item="editingItem"
        :on-save="saveOrganization"
        @close="editModal = false"
      />
    </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  listOrganizationsOrgV1OrganizationsGet,
  createOrganizationOrgV1OrganizationsPost,
  createUniversityOrgV1UniversitiesPost,
  createFacultyOrgV1FacultiesPost,
  createCollectiveOrgV1CollectivesPost,
  patchOrganizationOrgV1OrganizationsOrganizationIdPatch,
  deleteOrganizationOrgV1OrganizationsOrganizationIdDelete,
} from '@/api/generated/almaEventFlow'
import { searchPersonProfileV1PersonsGet } from '@/api/generated/almaEventFlow'
import { getAddressesGeoV1AddressesGet } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const typeLabels: Record<string, string> = {
  organization: 'Организация',
  university: 'Университет',
  faculty: 'Факультет',
  collective: 'Коллектив',
}
const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value, label }))

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'acronym', label: 'Аббревиатура', sortable: true },
  { key: 'type', label: 'Тип', sortable: true, render: (o) => typeLabels[o.type] || o.type || '—' },
]

const baseSortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  { value: 'acronym', label: 'Аббревиатуре' },
  { value: 'type', label: 'Типу' },
]

const sortOptions: SortOption[] = [...baseSortOptions, ...TIMESTAMP_SORT_OPTIONS]

const baseFilters: FilterDef[] = [
  { key: 'type', label: 'Тип', type: 'select', options: typeOptions },
]

const filters: FilterDef[] = [...baseFilters, ...TIMESTAMP_FILTERS]

// Тип задаётся только при создании: у каждого типа свой эндпоинт и своя запись-подтип
const editFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'acronym', label: 'Аббревиатура', type: 'text' },
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

const createFields: FormField[] = [
  editFields[0],
  editFields[1],
  { key: 'type', label: 'Тип', type: 'select', required: true, options: typeOptions },
  ...editFields.slice(2),
]

const creators: Record<string, (body: any) => Promise<unknown>> = {
  organization: createOrganizationOrgV1OrganizationsPost,
  university: createUniversityOrgV1UniversitiesPost,
  faculty: createFacultyOrgV1FacultiesPost,
  collective: createCollectiveOrgV1CollectivesPost,
}

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchOrganizations(params: Record<string, any>) {
  return listOrganizationsOrgV1OrganizationsGet(params as any)
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

async function saveOrganization(data: any) {
  if (isCreating.value) {
    const { type, ...body } = data
    await creators[type || 'organization'](body)
  } else if (editingItem.value) {
    const { name, acronym, principal_id, address_id } = data
    await patchOrganizationOrgV1OrganizationsOrganizationIdPatch(editingItem.value.id, {
      name, acronym, principal_id, address_id,
    })
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteOrganizationOrgV1OrganizationsOrganizationIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
