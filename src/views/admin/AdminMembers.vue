<template>
    <ResourceTable
      ref="tableRef"
      :columns="columns"
      :get-label="(m) => m.person_id"
      :label-resource="(m) => ({ kind: 'person', id: m.person_id })"
      :get-subtitle="(m) => (m.roles || []).map((r: any) => r.name).join(', ') || 'Без роли'"
      :sort-options="sortOptions"
      default-sort="person__surname"
      :filters="filters"
      :row-links="rowLinks"
      search-placeholder="ФИО участника или ID"
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
        :links="linksFor(rowLinks, editingItem)"
        :on-save="save"
        @close="editModal = false"
      />
    </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import { checkmarkDoneOutline, peopleCircleOutline, personOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import {
  getMembersEventV1MembersGet,
  createMemberEventV1MembersPost,
  patchMemberEventV1MembersMemberIdPatch,
  deleteMemberEventV1MembersMemberIdDelete,
  getRolesEventV1RolesGet,
} from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef, RowLink } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()

const filters: FilterDef[] = [
  { key: 'collective_id', label: 'Коллектив', type: 'picker', picker: 'collective' },
  { key: 'person_id', label: 'Персона', type: 'picker', picker: 'person' },
  { key: 'role_id', label: 'Роль', type: 'picker', picker: 'role' },
  { key: 'id', label: 'Участник', type: 'picker', picker: 'member' },
  {
    key: 'is_active',
    label: 'Активность',
    type: 'select',
    anyLabel: 'Все',
    anyParams: { include_inactive: true },
    options: [{ value: 'true', label: 'Активные' }, { value: 'false', label: 'Неактивные' }],
  },
  ...TIMESTAMP_FILTERS,
]

const rowLinks: RowLink[] = [
  { label: 'Посещаемость', icon: checkmarkDoneOutline, to: (m) => withQuery('/admin/attendance', { member_id: m.id }) },
  { label: 'Коллектив', icon: peopleCircleOutline, to: (m) => withQuery('/admin/collectives', { id: m.collective_id }) },
  { label: 'Личное дело', icon: personOutline, to: (m) => `/admin/persons/${m.person_id}` },
]

const sortOptions: SortOption[] = [
  { value: 'person__surname', label: 'ФИО' },
  { value: 'is_active', label: 'Активности' },
  ...TIMESTAMP_SORT_OPTIONS,
]

const columns: ColumnDef[] = [
  { key: 'person_id', label: 'Персона', resource: (m) => ({ kind: 'person', id: m.person_id }) },
  { key: 'collective_id', label: 'Коллектив', resource: (m) => ({ kind: 'collective', id: m.collective_id }) },
  { key: 'roles', label: 'Роли', render: (m) => (m.roles || []).map((r: any) => r.name).join(', ') || '—' },
  { key: 'is_active', label: 'Активен', render: (m) => m.is_active !== false ? 'Да' : 'Нет', hideMobile: true },
]

const formFields: FormField[] = [
  { key: 'person_id', label: 'Персона', type: 'search', required: true, picker: 'person' },
  { key: 'collective_id', label: 'Коллектив', type: 'search', required: true, picker: 'collective' },
  {
    key: 'roles',
    label: 'Роли',
    type: 'multisearch',
    placeholder: 'Добавить роль',
    dependsOn: 'collective_id',
    dependsHint: 'Сначала выберите коллектив',
    choices: roleChoices,
  },
  { key: 'is_active', label: 'Активен', type: 'checkbox' },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function roleChoices(search: string, form: Record<string, any>) {
  const collectiveId = editingItem.value?.collective_id ?? form.collective_id
  if (!collectiveId) return []
  const { data } = await getRolesEventV1RolesGet({ collective_id: collectiveId, search: search || undefined, limit: 50 })
  return data.items.map((role) => ({ id: role.id, name: role.name }))
}

async function fetchItems(params: Record<string, any>) {
  return getMembersEventV1MembersGet(params as any)
}

function openEdit(item: any) { isCreating.value = false; editingItem.value = item; editModal.value = true }
function openCreate() { isCreating.value = true; editingItem.value = null; editModal.value = true }

async function save(data: any) {
  if (isCreating.value) {
    await createMemberEventV1MembersPost(data as any)
  } else if (editingItem.value) {
    await patchMemberEventV1MembersMemberIdPatch(editingItem.value.id, { is_active: data.is_active, roles: data.roles })
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
