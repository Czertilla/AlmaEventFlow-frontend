<template>
      <ResourceTable
        ref="tableRef"
        :columns="columns"
        :get-label="(c) => c.name"
        :get-subtitle="(c) => c.acronym"
        :fetch-items="fetchCollectives"
        :sort-options="sortOptions"
        :filters="filters"
        :row-links="rowLinks"
        default-sort="name"
        add-label="Добавить"
        @add="openCreate"
        @edit="openEdit"
        @delete="handleDelete"
      />

    <ion-modal :is-open="editModal" @ion-modal-did-dismiss="editModal = false">
      <ResourceFormModal
        v-if="editModal"
        :title="isCreating ? 'Создать коллектив' : 'Редактировать коллектив'"
        :fields="formFields"
        :item="editingItem"
        :links="linksFor(rowLinks, editingItem)"
        :on-save="saveCollective"
        @close="editModal = false"
      />
    </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal } from '@ionic/vue'
import { calendarOutline, checkmarkDoneOutline, peopleOutline, personAddOutline, ribbonOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import ResourceFormModal from '@/components/admin/ResourceFormModal.vue'
import { listCollectivesOrgV1CollectivesGet, createCollectiveOrgV1CollectivesPost, patchCollectiveOrgV1CollectivesCollectiveIdPatch, deleteCollectiveOrgV1CollectivesCollectiveIdDelete, listUniversitiesOrgV1UniversitiesGet } from '@/api/generated/almaEventFlow'
import { getCollectivesEventV1CollectivesGet, patchCollectiveEventV1CollectivesCollectiveIdPatch } from '@/api/generated/almaEventFlow'
import { fetchAllPages } from '@/api/pagination'
import { searchPersonProfileV1PersonsGet } from '@/api/generated/almaEventFlow'
import { getAddressesGeoV1AddressesGet } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef, RowLink } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import type { FormField } from '@/components/admin/ResourceFormModal.vue'
import { linksFor } from '@/utils/adminLinks'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()

const filters: FilterDef[] = [
  { key: 'id', label: 'Коллектив', type: 'picker', picker: 'collective' },
  { key: 'is_verified', label: 'Подтверждён', type: 'select', options: [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }] },
  ...TIMESTAMP_FILTERS,
]

const rowLinks: RowLink[] = [
  { label: 'Участники', icon: personAddOutline, to: (c) => withQuery('/admin/members', { collective_id: c.id }) },
  { label: 'Роли', icon: ribbonOutline, to: (c) => withQuery('/admin/roles', { collective_id: c.id }) },
  { label: 'Участия', icon: peopleOutline, to: (c) => withQuery('/admin/participation', { collective_id: c.id }) },
  { label: 'Мероприятия', icon: calendarOutline, to: (c) => withQuery('/admin/events', { participant_id: c.id }) },
  { label: 'Посещаемость', icon: checkmarkDoneOutline, to: (c) => withQuery('/admin/attendance', { collective_id: c.id }) },
]

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'acronym', label: 'Аббревиатура', sortable: true },
  { key: 'type', label: 'Тип' },
  { key: 'is_verified', label: 'Подтверждён', render: (c) => (c.is_verified ? 'Да' : 'Нет') },
]

const baseSortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  { value: 'acronym', label: 'Аббревиатуре' },
]

const sortOptions: SortOption[] = [...baseSortOptions, ...TIMESTAMP_SORT_OPTIONS]

// Поля по схеме CollectiveCreate: name, acronym (опц.), university_id, principal_id, address_id;
// подтверждение хранит сервис мероприятий, новый коллектив подтверждается при правке
const formFields: FormField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'acronym', label: 'Аббревиатура', type: 'text' },
  { key: 'is_verified', label: 'Подтверждён', type: 'checkbox', visibleWhen: () => !isCreating.value },
  {
    key: 'university_id',
    label: 'Университет',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await listUniversitiesOrgV1UniversitiesGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
  {
    key: 'principal_id',
    label: 'Руководитель',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await searchPersonProfileV1PersonsGet({ search, limit: 20 })
      return res.data.items
    },
    displayFn: (p) => [p.surname, p.name, p.patronymic].filter(Boolean).join(' '),
  },
  {
    key: 'address_id',
    label: 'Адрес',
    type: 'search',
    fetchOptions: async (search) => {
      const res = await getAddressesGeoV1AddressesGet({ search, limit: 20 })
      return res.data.items
    },
    displayField: 'name',
  },
]

const editModal = ref(false)
const editingItem = ref<any>(null)
const isCreating = ref(false)

async function verifiedIds(verified: boolean): Promise<string[]> {
  const rows = await fetchAllPages<{ id: string }>((page, limit) =>
    getCollectivesEventV1CollectivesGet({ is_verified: verified, page, limit }))
  return rows.map((row) => row.id)
}

async function verificationOf(ids: string[]): Promise<Map<string, boolean>> {
  if (ids.length === 0) return new Map()
  const { data } = await getCollectivesEventV1CollectivesGet({ id__in: ids.join(','), limit: ids.length })
  return new Map(data.items.map((c) => [c.id, c.is_verified]))
}

// Список берётся у org, подтверждение -- у сервиса мероприятий: одним запросом на страницу;
// фильтр по подтверждению сначала отбирает id там же.
async function fetchCollectives(params: Record<string, any>) {
  const { is_verified: asked, ...rest } = params
  let query = rest
  if (asked === 'true' || asked === 'false') {
    const ids = await verifiedIds(asked === 'true')
    if (ids.length === 0) {
      return { data: { items: [], pagination: { total: 0, page: rest.page, limit: rest.limit } } } as any
    }
    query = { ...rest, id__in: ids.join(',') }
  }
  const res = await listCollectivesOrgV1CollectivesGet(query as any)
  const verified = await verificationOf(res.data.items.map((c) => c.id))
  res.data.items = res.data.items.map((c) => ({ ...c, is_verified: verified.get(c.id) ?? false }))
  return res
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

async function saveCollective(data: any) {
  const { is_verified: verified, ...fields } = data
  if (isCreating.value) {
    // university_id обязателен в схеме (nullable)
    await createCollectiveOrgV1CollectivesPost({ university_id: null, ...fields })
  } else if (editingItem.value) {
    await patchCollectiveOrgV1CollectivesCollectiveIdPatch(editingItem.value.id, fields)
    if (typeof verified === 'boolean' && verified !== editingItem.value.is_verified) {
      await patchCollectiveEventV1CollectivesCollectiveIdPatch(editingItem.value.id, { is_verified: verified })
    }
  }
  editModal.value = false
  tableRef.value?.loadData()
}

async function handleDelete(item: any) {
  try {
    await deleteCollectiveOrgV1CollectivesCollectiveIdDelete(item.id)
    tableRef.value?.loadData()
  } catch (err) { console.error(err) }
}
</script>
