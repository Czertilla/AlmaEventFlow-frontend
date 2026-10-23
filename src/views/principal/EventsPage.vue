<template>
      <div class="page-body">
        <div class="ev-toolbar">
          <div class="ev-search">
            <ion-icon :icon="searchOutline" class="ev-search-icon" />
            <input
              v-model="searchQuery"
              class="ev-search-input"
              placeholder="Поиск мероприятий..."
            />
            <button v-if="searchQuery" class="ev-search-clear" aria-label="Очистить" @click="searchQuery = ''">
              <ion-icon :icon="closeOutline" />
            </button>
          </div>

          <div class="ev-toolbar-actions">
            <UiSelectPill
              v-model="statusFilter"
              :options="STATUS_FILTER_OPTIONS"
              :icon="funnelOutline"
              aria-label="Фильтр по статусу"
              align="end"
            />

            <UiSelectPill v-model="sortKey" :options="SORT_OPTIONS" :icon="swapVerticalOutline" aria-label="Сортировка" align="end">
              <button
                type="button"
                class="ui-icon-btn"
                :aria-label="sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'"
                @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
              >
                <ion-icon :icon="sortOrder === 'asc' ? arrowUpOutline : arrowDownOutline" />
              </button>
            </UiSelectPill>
          </div>
        </div>

        <div v-if="loading" class="page-state">
          <div class="loading-spinner" />
        </div>
        <div v-else-if="filteredEvents.length === 0" class="page-state">
          <ion-icon :icon="calendarOutline" />
          <p>Коллектив пока не участвует в мероприятиях</p>
        </div>

        <div v-else class="event-rows">
          <button
            v-for="e in filteredEvents"
            :key="e.id"
            class="event-row"
            @click="$router.push(`/event/${e.id}`)"
          >
            <div class="event-row-status" :style="{ background: statusColor(e.status) }" />
            <div class="event-row-info">
              <span class="event-row-name">{{ e.name }}</span>
              <span class="event-row-date">{{ e.date ? formatDate(e.date, settings.dateFormat) : 'Без даты' }}</span>
            </div>
            <span class="event-row-badge" :style="{ color: statusColor(e.status) }">{{ statusLabel(e.status) }}</span>
          </button>
        </div>
      </div>

      <EventCreateModal v-model:open="showCreateModal" @created="onCreated" />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import {
  closeOutline, searchOutline, calendarOutline,
  swapVerticalOutline, arrowUpOutline, arrowDownOutline, funnelOutline,
} from 'ionicons/icons'
import { useLayoutAddButton } from '@/composables/usePrincipalPageActions'
import { useUrlState } from '@/composables/useUrlState'
import { usePrincipalStore } from '@/stores/principal'
import { useSettingsStore } from '@/stores/settings'
import EventCreateModal from '@/components/event/EventCreateModal.vue'
import UiSelectPill from '@/components/common/UiSelectPill.vue'
import type { SelectOption } from '@/utils/selectOptions'
import { formatDate } from '@/utils/date'
import { statusColor, statusLabel } from '@/utils/eventLabels'
import { getCollectiveEventsEventV2CollectivesCollectiveIdEventsGet } from '@/api/generated/almaEventFlow'
import type { CollectiveEvent, EventStatusEnumV1 } from '@/api/generated/almaEventFlow'

const principal = usePrincipalStore()
const settings = useSettingsStore()

const events = ref<CollectiveEvent[]>([])
const loading = ref(false)
const urlState = useUrlState({ q: '', status: '', sort: 'date', order: 'desc' })
const searchQuery = computed({ get: () => urlState.q, set: (value: string) => { urlState.q = value } })
const statusFilter = computed({
  get: () => urlState.status as '' | EventStatusEnumV1,
  set: (value: '' | EventStatusEnumV1) => { urlState.status = value },
})
const sortKey = computed({
  get: () => urlState.sort as 'date' | 'name' | 'status',
  set: (value: 'date' | 'name' | 'status') => { urlState.sort = value },
})
const sortOrder = computed({
  get: () => urlState.order as 'asc' | 'desc',
  set: (value: 'asc' | 'desc') => { urlState.order = value },
})
const showCreateModal = ref(false)

const STATUS_FILTER_OPTIONS: SelectOption<'' | EventStatusEnumV1>[] = [
  { value: '', label: 'Все статусы' },
  { value: 'active', label: 'Активные' },
  { value: 'draft', label: 'Черновики' },
  { value: 'template', label: 'Шаблоны' },
  { value: 'archived', label: 'Архив' },
]

const SORT_OPTIONS: SelectOption<'date' | 'name' | 'status'>[] = [
  { value: 'date', label: 'По дате' },
  { value: 'name', label: 'По названию' },
  { value: 'status', label: 'По статусу' },
]

// Порядок статусов для сортировки «по статусу»
const STATUS_RANK: Record<EventStatusEnumV1, number> = {
  active: 0, draft: 1, template: 2, archived: 3,
}

const filteredEvents = computed(() => {
  let list = events.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q))
  if (statusFilter.value) list = list.filter((e) => e.status === statusFilter.value)

  const dir = sortOrder.value === 'asc' ? 1 : -1
  return list.slice().sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'name') {
      cmp = a.name.localeCompare(b.name, 'ru')
    } else if (sortKey.value === 'status') {
      cmp = STATUS_RANK[a.status ?? 'draft'] - STATUS_RANK[b.status ?? 'draft']
    } else {
      // date: события без даты — в конец независимо от направления
      const da = a.date ? new Date(a.date).getTime() : null
      const db = b.date ? new Date(b.date).getTime() : null
      if (da === null && db === null) cmp = 0
      else if (da === null) return 1
      else if (db === null) return -1
      else cmp = da - db
    }
    return cmp * dir
  })
})

async function loadEvents(collectiveId: string) {
  loading.value = true
  try {
    events.value = (await getCollectiveEventsEventV2CollectivesCollectiveIdEventsGet(collectiveId)).data.items
  } catch (err) {
    console.error('Failed to load events', err)
  } finally {
    loading.value = false
  }
}

function onCreated() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (collectiveId) loadEvents(collectiveId)
}

watch(() => principal.activePrincipalCollectiveId, (collectiveId) => {
  if (!collectiveId) {
    events.value = []
    return
  }
  loadEvents(collectiveId)
}, { immediate: true })

useLayoutAddButton('Новое мероприятие', () => { showCreateModal.value = true })
</script>

<style scoped>
.page-body {
  padding-bottom: 32px;
}

/* Тулбар списка: поиск · фильтр · сортировка (единый язык с admin-таблицами) */
.ev-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.ev-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 220px;
}

.ev-search-icon {
  position: absolute;
  left: 14px;
  font-size: var(--fs-xl);
  color: var(--ion-color-medium);
  pointer-events: none;
}

.ev-search-input {
  width: 100%;
  height: 44px;
  padding: 0 38px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  font-size: var(--fs-md);
  color: var(--ion-text-color);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ev-search-input:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

.ev-search-clear {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: var(--fs-lg);
  cursor: pointer;
}

.ev-search-clear:hover {
  background: var(--ion-background-color);
}

.ev-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 20px;
  color: var(--ion-color-medium);
}

.page-state ion-icon {
  font-size: var(--icon-hero);
  opacity: 0.4;
}

.page-state p {
  margin: 0;
  font-size: var(--fs-md);
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--ion-border-color);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.event-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
}

.event-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(var(--ion-color-primary-rgb), 0.12);
}

.event-row-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-row-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-row-date {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.event-row-badge {
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  flex-shrink: 0;
}
</style>
