<template>
  <AdminLayout title="Профили">
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(p) => p.person ? `${p.person.surname} ${p.person.name}` : p.id"
        :get-subtitle="(p) => p.birthdate || 'Нет даты'"
        :fetch-items="fetchProfiles"
        :sort-options="sortOptions"
        default-sort="created_at"
        add-label="Добавить"
        @add="openCreate"
        @edit="openEdit"
        @delete="handleDelete"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать профиль' : 'Редактировать профиль'"
        :fields="isCreating ? createFields : baseFields"
        :item="editingItem"
        :on-save="saveProfile"
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
import { getManyProfileV1ProfilesGet, createProfileProfileV1ProfilesPost, patchProfileProfileV1ProfilesProfileIdPatch, deleteProfileProfileV1ProfilesProfileIdDelete, searchPersonProfileV1PersonsGet } from '@/api/generated/almaEventFlow'
import { listOrganizationsOrgV1OrganizationsGet } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'person', label: 'Персона', render: (p) => p.person ? `${p.person.surname} ${p.person.name}` : '—' },
  { key: 'birthdate', label: 'Дата рождения', render: (p) => p.birthdate || '—' },
  { key: 'created_at', label: 'Создан', sortable: true, render: (p) => new Date(p.created_at).toLocaleDateString() },
]

const sortOptions: SortOption[] = [
  { value: 'created_at', label: 'Дате создания' },
]

// Схема ProfileCreate: id = id персоны (обязателен), birthdate, workplace_id
const baseFields: FormField[] = [
  { key: 'birthdate', label: 'Дата рождения', type: 'text', placeholder: 'YYYY-MM-DD' },
  {
    key: 'workplace_id',
    label: 'Место работы',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await listOrganizationsOrgV1OrganizationsGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
]

const createFields: FormField[] = [
  {
    key: 'id',
    label: 'Персона',
    type: 'search',
    required: true,
    fetchOptions: async (search) => {
      const res = await searchPersonProfileV1PersonsGet({ search, limit: 20 })
      return res.data.items
    },
    displayFn: (p) => [p.surname, p.name, p.patronymic].filter(Boolean).join(' '),
  },
  ...baseFields,
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchProfiles(params: Record<string, any>) {
  return getManyProfileV1ProfilesGet(params as any)
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

async function saveProfile(data: any) {
  if (isCreating.value) {
    await createProfileProfileV1ProfilesPost(data as any)
  } else if (editingItem.value) {
    // ProfilePatch требует id в теле
    await patchProfileProfileV1ProfilesProfileIdPatch(editingItem.value.id, { id: editingItem.value.id, ...data } as any)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteProfileProfileV1ProfilesProfileIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
