<template>
  <AdminLayout title="Посещаемость">
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(a) => a.member_id"
      :get-subtitle="(a) => a.is_attended ? 'Присутствовал' : 'Отсутствовал'"
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
  getAttendancesEventV1AttendancesGet,
  createAttendanceEventV1AttendancesPost,
  patchAttendanceEventV1AttendancesAttendanceIdPatch,
  deleteAttendanceEventV1AttendancesAttendanceIdDelete,
  getMembersEventV1MembersGet,
  getParticipationsEventV1ParticipationsGet,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'member_id', label: 'Участник' },
  { key: 'participation_id', label: 'Участие' },
  { key: 'is_attended', label: 'Присутствие', render: (a) => a.is_attended ? 'Да' : 'Нет' },
  { key: 'is_verified', label: 'Заверено', render: (a) => a.is_verified ? 'Да' : 'Нет', hideMobile: true },
  { key: 'comment', label: 'Комментарий', hideMobile: true },
]

const formFields: FormField[] = [
  {
    key: 'member_id', label: 'Участник', type: 'search', required: true,
    fetchOptions: async (search) => (await getMembersEventV1MembersGet({ search, limit: 20 } as any)).data.items,
    displayFn: (m: any) => m.person_id || m.id,
  },
  {
    key: 'participation_id', label: 'Участие', type: 'search', required: true,
    fetchOptions: async (search) => (await getParticipationsEventV1ParticipationsGet({ search, limit: 20 } as any)).data.items,
    displayFn: (p: any) => `${p.collective_name || p.collective_id} · ${p.event_id?.slice(0, 8)}`,
  },
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
