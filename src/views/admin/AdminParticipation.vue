<template>
  <AdminLayout title="Участия">
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(p) => p.collective_name || p.collective_id"
      :get-subtitle="(p) => p.event_id"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать участие' : 'Редактировать участие'"
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
  getParticipationsEventV1ParticipationsGet,
  createParticipationEventV1ParticipationsPost,
  patchParticipationEventV1ParticipationsParticipationIdPatch,
  deleteParticipationEventV1ParticipationsParticipationIdDelete,
  listCollectivesOrgV1CollectivesGet,
  getEventsEventV1EventsGet,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const priorityLabels: Record<string, string> = { hight: 'Высокий', medium: 'Средний', low: 'Низкий' }
const priorityOptions = Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))

const columns: ColumnDef[] = [
  { key: 'collective_name', label: 'Коллектив', render: (p) => p.collective_name || p.collective_id },
  { key: 'event_id', label: 'Мероприятие' },
  { key: 'EventPriorityEnumV1', label: 'Приоритет', render: (p) => priorityLabels[p.EventPriorityEnumV1] || '—' },
]

const formFields: FormField[] = [
  {
    key: 'collective_id', label: 'Коллектив', type: 'search', required: true,
    fetchOptions: async (search) => (await listCollectivesOrgV1CollectivesGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
  {
    key: 'event_id', label: 'Мероприятие', type: 'search', required: true,
    fetchOptions: async (search) => (await getEventsEventV1EventsGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
  { key: 'EventPriorityEnumV1', label: 'Приоритет', type: 'select', options: priorityOptions },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getParticipationsEventV1ParticipationsGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createParticipationEventV1ParticipationsPost(data as any)
  } else if (editingItem.value) {
    await patchParticipationEventV1ParticipationsParticipationIdPatch(editingItem.value.id, data)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteParticipationEventV1ParticipationsParticipationIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
