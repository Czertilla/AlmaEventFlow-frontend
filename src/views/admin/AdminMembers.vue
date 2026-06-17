<template>
  <AdminLayout title="Участники коллективов">
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(m) => m.person_id"
      :get-subtitle="(m) => (m.roles || []).map((r: any) => r.name).join(', ') || 'Без роли'"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Добавить участника' : 'Редактировать участника'"
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
  getMembersEventV1MembersGet,
  createMemberEventV1MembersPost,
  patchMemberEventV1MembersMemberIdPatch,
  deleteMemberEventV1MembersMemberIdDelete,
  searchPersonProfileV1PersonsGet,
  listCollectivesOrgV1CollectivesGet,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'person_id', label: 'Персона' },
  { key: 'collective_id', label: 'Коллектив' },
  { key: 'roles', label: 'Роли', render: (m) => (m.roles || []).map((r: any) => r.name).join(', ') || '—' },
  { key: 'is_active', label: 'Активен', render: (m) => m.is_active !== false ? 'Да' : 'Нет', hideMobile: true },
]

const personName = (p: any) => [p.surname, p.name, p.patronymic].filter(Boolean).join(' ')

const formFields: FormField[] = [
  {
    key: 'person_id', label: 'Персона', type: 'search', required: true,
    fetchOptions: async (search) => (await searchPersonProfileV1PersonsGet({ search, limit: 20 })).data.items,
    displayFn: personName,
  },
  {
    key: 'collective_id', label: 'Коллектив', type: 'search', required: true,
    fetchOptions: async (search) => (await listCollectivesOrgV1CollectivesGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
  { key: 'is_active', label: 'Активен', type: 'checkbox' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getMembersEventV1MembersGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createMemberEventV1MembersPost(data as any)
  } else if (editingItem.value) {
    await patchMemberEventV1MembersMemberIdPatch(editingItem.value.id, { id: editingItem.value.id, is_active: data.is_active })
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteMemberEventV1MembersMemberIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
