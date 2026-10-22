<template>
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(g) => g.name"
      :get-subtitle="(g) => `${g.grade} курс`"
      :sort-options="sortOptions"
      default-sort="name"
      :filters="filters"
      :row-links="rowLinks"
      search-placeholder="Название группы или ID"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать группу' : 'Редактировать группу'"
        :fields="formFields"
        :item="editingItem"
        :links="linksFor(rowLinks, editingItem)"
        :on-save="save"
        @close="editModal = false"
      />
    </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import { schoolOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getStudentGroupsProfileV1StudentsGroupsGet,
  getStudentDegreesProfileV1StudentsDegreesGet,
  createStudentGroupProfileV1StudentsGroupsPost,
  patchStudentGroupProfileV1StudentsGroupsGroupIdPatch,
  deleteStudentGroupProfileV1StudentsGroupsGroupIdDelete,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef, FilterDef, RowLink, SortOption } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { useToast } from '@/composables/useToast'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const MAX_GRADE = 12

const tableRef = ref()
const { showError } = useToast()

const filters: FilterDef[] = [
  { key: 'degree_id', label: 'Степень', type: 'picker', picker: 'degree' },
  { key: 'faculty_id', label: 'Факультет', type: 'picker', picker: 'faculty' },
  {
    key: 'grade',
    label: 'Курс',
    type: 'select',
    options: Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  },
]

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  { value: 'grade', label: 'Курсу' },
]

const rowLinks: RowLink[] = [
  { label: 'Студенты', icon: schoolOutline, to: (g) => withQuery('/admin/students', { group_id: String(g.id) }) },
]

const columns: ColumnDef[] = [
  { key: 'name', label: 'Группа', sortable: true, hideMobile: true },
  { key: 'degree_id', label: 'Степень', resource: (g) => ({ kind: 'degree', id: String(g.degree_id) }) },
  { key: 'faculty_id', label: 'Факультет', resource: (g) => ({ kind: 'organization', id: g.faculty_id }) },
  { key: 'grade', label: 'Курс', sortable: true, hideMobile: true },
]

const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, maxLength: 32 },
  {
    key: 'degree_id', label: 'Степень', type: 'search', required: true,
    fetchOptions: async (search) => (await getStudentDegreesProfileV1StudentsDegreesGet({ search, limit: 20 })).data.items,
    displayField: 'name',
  },
  { key: 'faculty_id', label: 'Факультет', type: 'search', required: true, picker: 'faculty' },
  { key: 'grade', label: 'Курс', type: 'number', required: true },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getStudentGroupsProfileV1StudentsGroupsGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  const grade = Number(data.grade)
  if (!Number.isInteger(grade) || grade < 1 || grade > MAX_GRADE) {
    throw new Error(`Курс: число от 1 до ${MAX_GRADE}`)
  }
  const body = { name: data.name, degree_id: Number(data.degree_id), faculty_id: data.faculty_id, grade }
  if (isCreating.value) {
    await createStudentGroupProfileV1StudentsGroupsPost(body)
  } else if (editingItem.value) {
    await patchStudentGroupProfileV1StudentsGroupsGroupIdPatch(editingItem.value.id, body)
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteStudentGroupProfileV1StudentsGroupsGroupIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) {
    showError(err, 'Не удалось удалить группу')
  }
}
</script>
