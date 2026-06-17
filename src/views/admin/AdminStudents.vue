<template>
  <AdminLayout title="Студенты">
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(s) => s.student_id"
      :get-subtitle="(s) => personName(s.person) || s.id"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать студента' : 'Редактировать студента'"
        :fields="formFields"
        :item="editingItem"
        :on-save="save"
        @close="editModal = false"
      />
    </ion-modal>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { IonModal } from '@ionic/vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getStudentsProfileV1StudentsGet,
  createStudentProfileV1StudentsPost,
  patchStudentProfileV1StudentsStudentIdPatch,
  deleteStudentProfileV1StudentsStudentIdDelete,
  getStudentGroupsProfileV1StudentsGroupsGet,
  searchPersonProfileV1PersonsGet,
  listOrganizationsOrgV1OrganizationsGet,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'

const tableRef = ref()

const personName = (p: any) => p ? [p.surname, p.name, p.patronymic].filter(Boolean).join(' ') : ''

const columns: ColumnDef[] = [
  { key: 'student_id', label: 'Студ. билет', sortable: true },
  { key: 'person', label: 'ФИО', render: (s) => personName(s.person) || '—' },
  { key: 'group', label: 'Группа', render: (s) => s.group?.name || s.group_id || '—' },
  { key: 'is_active', label: 'Активен', render: (s) => s.is_active !== false ? 'Да' : 'Нет', hideMobile: true },
]

const baseFields: FormField[] = [
  { key: 'student_id', label: 'Студенческий билет', type: 'text', required: true },
  {
    key: 'group_id', label: 'Группа', type: 'search', required: true,
    fetchOptions: async (search) => (await getStudentGroupsProfileV1StudentsGroupsGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
  {
    key: 'faculty_id', label: 'Факультет', type: 'search',
    fetchOptions: async (search) => (await listOrganizationsOrgV1OrganizationsGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
  { key: 'is_budget', label: 'Бюджет', type: 'checkbox' },
  { key: 'is_full', label: 'Очная форма', type: 'checkbox' },
  { key: 'is_active', label: 'Активен', type: 'checkbox' },
]

// При создании нужно привязать студента к персоне/профилю (id = person.id)
const createField: FormField = {
  key: 'id', label: 'Персона', type: 'search', required: true,
  fetchOptions: async (search) => (await searchPersonProfileV1PersonsGet({ search, limit: 20 })).data.items,
  displayFn: personName,
}

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)
const formFields = computed<FormField[]>(() =>
  isCreating.value ? [createField, ...baseFields] : baseFields)

async function fetchItems(params: Record<string, any>) {
  return getStudentsProfileV1StudentsGet(params)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createStudentProfileV1StudentsPost(data as any)
  } else if (editingItem.value) {
    const patch = { ...data }
    delete patch.id
    await patchStudentProfileV1StudentsStudentIdPatch(editingItem.value.id, patch)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteStudentProfileV1StudentsStudentIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
