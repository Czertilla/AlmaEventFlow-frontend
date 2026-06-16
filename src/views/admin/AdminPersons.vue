<template>
  <AdminLayout title="Персоны">
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(p) => `${p.surname} ${p.name}${p.patronymic ? ' ' + p.patronymic : ''}`"
        :get-subtitle="() => 'Персона'"
        :fetch-items="fetchPersons"
        :sort-options="sortOptions"
        default-sort="surname"
        add-label="Добавить"
        :extra-action="inviteAction"
        @add="openCreate"
        @edit="openEdit"
        @delete="handleDelete"
        @extra="(p) => openInvite(p.id)"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать персону' : 'Редактировать персону'"
        :fields="formFields"
        :item="editingItem"
        :on-save="savePerson"
        @close="editModal = false"
      />
    </ion-modal>

    <ion-modal :is-open="inviteModal" @ion-modal-did-dismiss="inviteModal = false">
      <InviteLinkModal :person-id="invitePersonId" @close="inviteModal = false" />
    </ion-modal>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { IonModal } from '@ionic/vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { getManyUserV1UsersGet } from '@/api/generated/almaEventFlow'
import type { ExtraAction } from '@/components/admin/ResourceTable.vue'
import { linkOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import InviteLinkModal from '@/components/admin/InviteLinkModal.vue'
import { searchPersonProfileV1PersonsGet, createPersonProfileV1PersonsPost, patchPersonProfileV1PersonsPersonIdPatch, deletePersonProfileV1PersonsPersonIdDelete } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const columns: ColumnDef[] = [
  { key: 'surname', label: 'Фамилия', sortable: true },
  { key: 'name', label: 'Имя', sortable: true },
  { key: 'patronymic', label: 'Отчество', render: (p) => p.patronymic || '—' },
]

const sortOptions: SortOption[] = [
  { value: 'surname', label: 'Фамилии' },
  { value: 'name', label: 'Имени' },
]

const formFields: FormField[] = [
  { key: 'surname', label: 'Фамилия', type: 'text', required: true },
  { key: 'name', label: 'Имя', type: 'text', required: true },
  { key: 'patronymic', label: 'Отчество', type: 'text' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

const inviteModal = ref(false)
const invitePersonId = ref('')

// Персоны, к которым уже прикреплён пользователь — для них ссылка-приглашение не нужна
const personsWithUser = ref<Set<string>>(new Set())

const inviteAction: ExtraAction = {
  icon: linkOutline,
  title: 'Создать пригласительную ссылку',
  visible: (p) => !personsWithUser.value.has(p.id),
}

onMounted(async () => {
  try {
    const linked = new Set<string>()
    for (let page = 0; page < 10; page++) {
      const res = await getManyUserV1UsersGet({ page, limit: 100 } as any)
      for (const u of res.data.items) {
        if (u.person_id) linked.add(u.person_id)
      }
      if (res.data.items.length < 100) break
    }
    personsWithUser.value = linked
  } catch { /* без данных кнопка просто показывается у всех */ }
})

async function fetchPersons(params: Record<string, any>) {
  return searchPersonProfileV1PersonsGet(params as any)
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

function openInvite(personId: string) {
  invitePersonId.value = personId
  inviteModal.value = true
}

async function savePerson(data: any) {
  if (isCreating.value) {
    await createPersonProfileV1PersonsPost(data as any)
  } else if (editingItem.value) {
    await patchPersonProfileV1PersonsPersonIdPatch(editingItem.value.id, data)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deletePersonProfileV1PersonsPersonIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
