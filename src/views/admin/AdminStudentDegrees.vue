<template>
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(d) => d.name"
      :get-subtitle="() => ''"
      :sort-options="sortOptions"
      default-sort="name"
      :row-links="rowLinks"
      :fetch-items="fetchItems"
      add-label="Добавить"
      @add="openCreate"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать степень' : 'Редактировать степень'"
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
import { peopleCircleOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getStudentDegreesProfileV1StudentsDegreesGet,
  createStudentDegreeProfileV1StudentsDegreesPost,
  patchStudentDegreeProfileV1StudentsDegreesDegreeIdPatch,
  deleteStudentDegreeProfileV1StudentsDegreesDegreeIdDelete,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef, RowLink, SortOption } from '@/components/admin/ResourceTable.vue'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { useToast } from '@/composables/useToast'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()
const { showError } = useToast()

const sortOptions: SortOption[] = [{ value: 'name', label: 'Названию' }]

const rowLinks: RowLink[] = [
  { label: 'Группы', icon: peopleCircleOutline, to: (d) => withQuery('/admin/student-groups', { degree_id: String(d.id) }) },
]

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true, hideMobile: true },
]

const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, maxLength: 32 },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function fetchItems(params: Record<string, any>) {
  return getStudentDegreesProfileV1StudentsDegreesGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createStudentDegreeProfileV1StudentsDegreesPost({ name: data.name })
  } else if (editingItem.value) {
    await patchStudentDegreeProfileV1StudentsDegreesDegreeIdPatch(editingItem.value.id, { name: data.name })
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteStudentDegreeProfileV1StudentsDegreesDegreeIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) {
    showError(err, 'Не удалось удалить степень')
  }
}
</script>
