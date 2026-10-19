<template>
  <ResourceTable
    ref="tableRef"
    :columns="columns"
    :get-label="(e) => e.name"
    :get-subtitle="(e) => e.date || 'Нет даты'"
    :fetch-items="fetchEvents"
    :sort-options="sortOptions"
    :filters="filters"
    :row-links="rowLinks"
    :extra-action="{ icon: listOutline, title: 'Этапы' }"
    default-sort="date"
    add-label="Добавить"
    @add="openCreate"
    @edit="openEdit"
    @extra="openStages"
    @delete="handleDelete"
  />

  <EventEditModal v-model:open="editModal" :event="editingItem" :save="saveEvent" @saved="reload">
    <template v-if="editingItem" #links>
      <div class="edit-links">
        <button type="button" class="ui-chip edit-link" @click="openStages(editingItem)">
          <ion-icon :icon="listOutline" />
          Этапы
        </button>
        <button v-for="link in rowLinks" :key="link.label" type="button" class="ui-chip edit-link" @click="follow(link)">
          <ion-icon :icon="link.icon || linkOutline" />
          {{ link.label }}
        </button>
      </div>
    </template>
  </EventEditModal>

  <EventStagesModal
    v-model:open="stagesModal"
    :event-date="stagesEvent?.date"
    :api="stageApi"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonIcon, modalController } from '@ionic/vue'
import { checkmarkDoneOutline, linkOutline, listOutline, peopleOutline } from 'ionicons/icons'
import ResourceTable from '@/components/admin/ResourceTable.vue'
import EventEditModal, { type EventEditBody } from '@/components/event/EventEditModal.vue'
import EventStagesModal, { type StageApi } from '@/components/event/EventStagesModal.vue'
import {
  getEventsEventV1EventsGet,
  createEventEventV1EventsPost,
  patchEventEventV1EventsEventIdPatch,
  deleteEventEventV1EventsEventIdDelete,
  getEventStagesEventV1EventsEventIdStagesGet,
  createStageEventV1StagesPost,
  patchStageEventV1StagesStageIdPatch,
  deleteStageEventV1StagesStageIdDelete,
} from '@/api/generated/almaEventFlow'
import type { EventRead } from '@/api/generated/almaEventFlow'
import type { ColumnDef, SortOption, FilterDef, RowLink } from '@/components/admin/ResourceTable.vue'
import { TIMESTAMP_FILTERS, TIMESTAMP_SORT_OPTIONS } from '@/utils/timestamps'
import { statusLabels, levelLabels, typeLabels, formatLabels } from '@/utils/eventLabels'
import { useAdminNavigate } from '@/composables/useAdminNavigate'
import { withQuery } from '@/utils/urlState'

const tableRef = ref()
const navigate = useAdminNavigate()

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'date', label: 'Дата', sortable: true, render: (e) => e.date || '—' },
  { key: 'status', label: 'Статус', sortable: true, render: (e) => statusLabels[e.status as keyof typeof statusLabels] || e.status || '—' },
  { key: 'type', label: 'Тип', render: (e) => typeLabels[e.type as keyof typeof typeLabels] || '—' },
  { key: 'level', label: 'Уровень', render: (e) => levelLabels[e.level as keyof typeof levelLabels] || '—' },
  { key: 'format', label: 'Формат', render: (e) => formatLabels[e.format as keyof typeof formatLabels] || '—', hideMobile: true },
]

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Названию' },
  { value: 'date', label: 'Дате' },
  { value: 'status', label: 'Статусу' },
  { value: 'level', label: 'Уровню' },
  { value: 'type', label: 'Типу' },
  { value: 'format', label: 'Формату' },
  ...TIMESTAMP_SORT_OPTIONS,
]

const filters: FilterDef[] = [
  { key: 'id', label: 'Мероприятие', type: 'picker', picker: 'event' },
  { key: 'participant_id', label: 'Коллектив-участник', type: 'picker', picker: 'collective' },
  { key: 'organizer_id', label: 'Организатор', type: 'picker', picker: 'organization' },
  { key: 'location_id', label: 'Место проведения', type: 'picker', picker: 'location' },
  { key: 'status', label: 'Статус', type: 'select', options: toOptions(statusLabels) },
  { key: 'type', label: 'Тип', type: 'select', options: toOptions(typeLabels) },
  { key: 'level', label: 'Уровень', type: 'select', options: toOptions(levelLabels) },
  { key: 'format', label: 'Формат', type: 'select', options: toOptions(formatLabels) },
  { key: 'date__gte', label: 'Дата с', type: 'date' },
  { key: 'date__lte', label: 'Дата по', type: 'date' },
  { key: 'date__isnull', label: 'Дата', type: 'select', options: [{ value: 'true', label: 'Не назначена' }, { value: 'false', label: 'Назначена' }] },
  ...TIMESTAMP_FILTERS,
]

const rowLinks: RowLink[] = [
  { label: 'Участия', icon: peopleOutline, to: (e) => withQuery('/admin/participation', { event_id: e.id }) },
  { label: 'Посещаемость', icon: checkmarkDoneOutline, to: (e) => withQuery('/admin/attendance', { event_id: e.id }) },
]

const editModal = ref(false)
const editingItem = ref<EventRead | null>(null)

const stagesModal = ref(false)
const stagesEvent = ref<EventRead | null>(null)

async function fetchEvents(params: Record<string, any>) {
  return getEventsEventV1EventsGet(params as any)
}

function reload() {
  tableRef.value?.loadData()
}

function openEdit(item: EventRead) {
  editingItem.value = item
  editModal.value = true
}

function openCreate() {
  editingItem.value = null
  editModal.value = true
}

function openStages(item: EventRead) {
  stagesEvent.value = item
  stagesModal.value = true
}

async function follow(link: RowLink) {
  if (!editingItem.value) return
  const target = link.to(editingItem.value)
  await modalController.dismiss().catch(() => false)
  navigate(target)
}

async function saveEvent(body: EventEditBody): Promise<EventRead> {
  if (editingItem.value) {
    return (await patchEventEventV1EventsEventIdPatch(editingItem.value.id, body)).data
  }
  return (await createEventEventV1EventsPost({ ...body, format: body.format ?? undefined })).data
}

function requireEventId(): string {
  if (!stagesEvent.value) throw new Error('Мероприятие не выбрано')
  return stagesEvent.value.id
}

const stageApi: StageApi = {
  list: async () =>
    (await getEventStagesEventV1EventsEventIdStagesGet(requireEventId(), { limit: 100, order_by: 'start_at' })).data.items,
  create: (body) => createStageEventV1StagesPost({ ...body, event_id: requireEventId() }),
  patch: (stageId, body) => patchStageEventV1StagesStageIdPatch(stageId, body),
  remove: (stageId) => deleteStageEventV1StagesStageIdDelete(stageId),
}

async function handleDelete(item: EventRead) {
  try {
    await deleteEventEventV1EventsEventIdDelete(item.id)
    reload()
  } catch (err) { console.error(err) }
}

</script>

<style scoped>
.edit-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.edit-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
