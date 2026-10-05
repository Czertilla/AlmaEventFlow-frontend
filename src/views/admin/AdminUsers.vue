<template>
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(u) => u.username"
        :get-subtitle="(u) => u.email"
        :fetch-items="fetchUsers"
        :sort-options="sortOptions"
        :filters="filters"
        default-sort="username"
        @edit="openEdit"
        @delete="handleDelete"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        title="Редактировать пользователя"
        :fields="editFields"
        :item="editingItem"
        :on-save="saveUser"
        @close="editModal = false"
      />
    </ion-modal>

</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import { getManyUserV1UsersGet, usersPatchUserUserV1UsersIdPatch, usersDeleteUserUserV1UsersIdDelete } from '@/api/generated/almaEventFlow'
import type { UserRead } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const filters: FilterDef[] = [
  { key: 'is_active', label: 'Активен', type: 'select', options: [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }] },
  { key: 'is_verified', label: 'Верифицирован', type: 'select', options: [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }] },
  { key: 'is_superuser', label: 'Администратор', type: 'select', options: [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }] },
  { key: 'person_id__isnull', label: 'Персона', type: 'select', options: [{ value: 'true', label: 'Не привязана' }, { value: 'false', label: 'Привязана' }] },
  ...TIMESTAMP_FILTERS,
]

const columns: ColumnDef[] = [
  { key: 'username', label: 'Username', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'is_active', label: 'Активен', render: (u) => u.is_active ? 'Да' : 'Нет', sortable: true },
  { key: 'is_superuser', label: 'Админ', render: (u) => u.is_superuser ? 'Да' : 'Нет' },
  { key: 'is_verified', label: 'Верифицирован', render: (u) => u.is_verified ? 'Да' : 'Нет' },
]

const baseSortOptions: SortOption[] = [
  { value: 'username', label: 'Имени' },
  { value: 'email', label: 'Email' },
  { value: 'is_active', label: 'Активности' },
  { value: 'is_verified', label: 'Верификации' },
  { value: 'is_superuser', label: 'Роли' },
]

const sortOptions: SortOption[] = [...baseSortOptions, ...TIMESTAMP_SORT_OPTIONS]

const editFields: FormField[] = [
  { key: 'username', label: 'Username', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'is_active', label: 'Активен', type: 'checkbox' },
  { key: 'is_superuser', label: 'Администратор', type: 'checkbox' },
  { key: 'is_verified', label: 'Верифицирован', type: 'checkbox' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)

async function fetchUsers(params: Record<string, any>) {
  return getManyUserV1UsersGet(params as any)
}

function openEdit(item: UserRead) {
  editingItem.value = item
  editModal.value = true
}

async function saveUser(data: any) {
  if (!editingItem.value) return
  await usersPatchUserUserV1UsersIdPatch(editingItem.value.id, data)
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: UserRead) {
  try {
    await usersDeleteUserUserV1UsersIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
