<template>
  <div class="resource-table">
    <div class="toolbar-row">
      <ion-searchbar
        v-model="query"
        :placeholder="searchPlaceholder || 'Поиск...'"
        @ion-input="onSearchInput"
        class="search-bar"
        :debounce="300"
        mode="md"
      />
      <div class="toolbar-actions">
        <ion-select
          v-if="sortOptions.length"
          v-model="sortKey"
          interface="popover"
          class="sort-select"
          @ion-change="onSortChange"
          mode="md"
        >
          <ion-select-option
            v-for="opt in sortOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </ion-select-option>
        </ion-select>
        <ion-button
          v-if="addLabel"
          fill="solid"
          color="primary"
          class="add-btn-desktop"
          @click="$emit('add')"
          mode="md"
        >
          <ion-icon :icon="addOutline" slot="start" />
          {{ addLabel }}
        </ion-button>
      </div>
    </div>

    <div v-if="loading && !items.length" class="state-box">
      <ion-spinner name="crescent" />
      <p>Загрузка...</p>
    </div>

    <div v-else-if="error" class="state-box error">
      <ion-icon :icon="alertCircleOutline" size="large" />
      <p>{{ error }}</p>
      <ion-button fill="outline" @click="loadData">Повторить</ion-button>
    </div>

    <div v-else-if="!items.length" class="state-box">
      <ion-icon :icon="searchOutline" size="large" />
      <p>Ничего не найдено</p>
    </div>

    <div v-else class="table-container">
      <table class="resource-desktop-table">
        <thead>
          <tr>
            <th v-for="col in visibleColumns" :key="col.key" @click="col.sortable && toggleSort(col.key)">
              <span class="th-content">
                {{ col.label }}
                <ion-icon
                  v-if="col.sortable && sortKey === col.key"
                  :icon="sortOrder === 'asc' ? arrowUpOutline : arrowDownOutline"
                  class="sort-icon"
                />
              </span>
            </th>
            <th class="actions-cell">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" @click="$emit('edit', item)">
            <td v-for="col in visibleColumns" :key="col.key" :title="getCellValue(item, col)">
              {{ getCellValue(item, col) }}
            </td>
            <td class="actions-cell" @click.stop>
              <ion-button
                v-if="extraAction && (!extraAction.visible || extraAction.visible(item))"
                fill="clear"
                size="small"
                :title="extraAction.title"
                @click="$emit('extra', item)"
              >
                <ion-icon :icon="extraAction.icon" />
              </ion-button>
              <ion-button fill="clear" size="small" @click="$emit('edit', item)">
                <ion-icon :icon="pencilOutline" />
              </ion-button>
              <ion-button fill="clear" size="small" color="danger" @click="confirmDelete(item)">
                <ion-icon :icon="trashOutline" />
              </ion-button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="resource-mobile-list">
        <div v-for="item in items" :key="item.id" class="mobile-card" @click="$emit('edit', item)">
          <div class="mobile-card-main">
            <span class="mobile-card-title">{{ getLabel(item) }}</span>
            <span class="mobile-card-subtitle">{{ getSubtitle(item) }}</span>
          </div>
          <div class="mobile-card-meta">
            <span v-for="col in mobileMetaColumns" :key="col.key" class="mobile-meta-item">
              {{ col.label }}: {{ getCellValue(item, col) }}
            </span>
          </div>
          <div class="mobile-card-actions" @click.stop>
            <ion-button
              v-if="extraAction && (!extraAction.visible || extraAction.visible(item))"
              fill="clear"
              size="small"
              :title="extraAction.title"
              @click="$emit('extra', item)"
            >
              <ion-icon :icon="extraAction.icon" />
            </ion-button>
            <ion-button fill="clear" size="small" @click="$emit('edit', item)">
              <ion-icon :icon="pencilOutline" />
            </ion-button>
            <ion-button fill="clear" size="small" color="danger" @click="confirmDelete(item)">
              <ion-icon :icon="trashOutline" />
            </ion-button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="totalPages > 1 && items.length" class="pagination-bar">
      <ion-button :disabled="page === 0" fill="clear" @click="goToPage(0)">
        <ion-icon :icon="chevronBackOutline" />
      </ion-button>
      <ion-button :disabled="page === 0" fill="clear" @click="goToPage(page - 1)">
        <ion-icon :icon="chevronBackOutline" />
      </ion-button>
      <span class="page-info">{{ page + 1 }} / {{ totalPages }}</span>
      <ion-button :disabled="page >= totalPages - 1" fill="clear" @click="goToPage(page + 1)">
        <ion-icon :icon="chevronForwardOutline" />
      </ion-button>
      <ion-button :disabled="page >= totalPages - 1" fill="clear" @click="goToPage(totalPages - 1)">
        <ion-icon :icon="chevronForwardOutline" />
      </ion-button>
    </div>

    <button
      v-if="addLabel"
      class="add-fab"
      :aria-label="addLabel"
      @click="$emit('add')"
    >
      <ion-icon :icon="addOutline" />
    </button>

    <ion-alert
      :is-open="deleteAlert.open"
      header="Подтверждение"
      message="Вы уверены, что хотите удалить этот элемент?"
      :buttons="deleteAlertButtons"
      @ion-alert-did-dismiss="deleteAlert.open = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonSearchbar, IonSelect, IonSelectOption, IonButton, IonIcon,
  IonSpinner, IonAlert,
} from '@ionic/vue'
import {
  pencilOutline, trashOutline, addOutline,
  arrowUpOutline, arrowDownOutline,
  chevronBackOutline, chevronForwardOutline,
  alertCircleOutline, searchOutline,
} from 'ionicons/icons'
import type { AxiosResponse } from 'axios'

export interface ColumnDef {
  key: string
  label: string
  sortable?: boolean
  render?: (item: any) => string
  hideMobile?: boolean
}

export interface SortOption {
  value: string
  label: string
}

export interface ExtraAction {
  icon: string
  title: string
  visible?: (item: any) => boolean
}

const props = withDefaults(defineProps<{
  columns: ColumnDef[]
  getLabel: (item: any) => string
  getSubtitle: (item: any) => string
  fetchItems: (params: Record<string, any>) => Promise<AxiosResponse<{ items: any[]; pagination: { total: number; page?: number; limit?: number } }>>
  addLabel?: string
  searchPlaceholder?: string
  sortOptions?: SortOption[]
  defaultSort?: string
  defaultOrder?: 'asc' | 'desc'
  pageSize?: number
  extraAction?: ExtraAction
}>(), {
  searchPlaceholder: 'Поиск...',
  defaultSort: '',
  defaultOrder: 'asc' as const,
  pageSize: 20,
  sortOptions: () => [],
})

const emit = defineEmits<{
  add: []
  edit: [item: any]
  delete: [item: any]
  extra: [item: any]
}>()

const query = ref('')
const sortKey = ref(props.defaultSort || '')
const sortOrder = ref<'asc' | 'desc'>(props.defaultOrder || 'asc')
const page = ref(0)
const limit = computed(() => props.pageSize || 20)
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const deleteAlert = ref<{ open: boolean; item: any }>({ open: false, item: null })

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

const visibleColumns = computed(() => props.columns)

const mobileMetaColumns = computed(() => props.columns.filter(c => !c.hideMobile))

const deleteAlertButtons = [
  { text: 'Отмена', role: 'cancel' },
  { text: 'Удалить', role: 'destructive', handler: () => { emit('delete', deleteAlert.value.item) } },
]

function getCellValue(item: any, col: ColumnDef): string {
  if (col.render) return col.render(item)
  const val = item[col.key]
  if (val === null || val === undefined) return '—'
  return String(val)
}

function confirmDelete(item: any) {
  deleteAlert.value = { open: true, item }
}

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
  page.value = 0
  loadData()
}

function onSortChange(ev: CustomEvent) {
  const val = ev.detail.value as string
  if (val.startsWith('-')) {
    sortKey.value = val.slice(1)
    sortOrder.value = 'desc'
  } else {
    sortKey.value = val
    sortOrder.value = 'asc'
  }
  page.value = 0
  loadData()
}

function onSearchInput() {
  page.value = 0
  loadData()
}

function goToPage(p: number) {
  page.value = p
  loadData()
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = {
      page: page.value,
      limit: limit.value,
    }
    if (query.value) params.search = query.value
    if (sortKey.value) {
      params.order_by = sortOrder.value === 'desc' ? `-${sortKey.value}` : sortKey.value
    }
    const res = await props.fetchItems(params)
    items.value = res.data.items
    total.value = res.data.pagination.total
  } catch (err: any) {
    error.value = err?.message || 'Ошибка загрузки'
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadData() })

defineExpose({ loadData })
</script>

<style scoped>
.resource-table {
  position: relative;
  min-height: 200px;
}

/* ── Toolbar ── */
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-bar {
  flex: 1;
  min-width: 200px;
  --border-radius: 10px;
  --box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select {
  max-width: 180px;
  --padding-end: 8px;
}

.add-btn-desktop {
  display: none;
  font-weight: 600;
}

/* ── Empty / Error / Loading states ── */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  gap: 14px;
  color: var(--ion-color-medium);
}

.state-box p {
  margin: 0;
  font-size: 1rem;
}

.state-box.error {
  color: var(--ion-color-danger);
}

/* ── Desktop table ── */
.resource-desktop-table {
  display: none;
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.resource-desktop-table thead tr {
  background: var(--ion-color-step-50, #f8f9fa);
}

.resource-desktop-table th,
.resource-desktop-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid var(--ion-color-step-150, #e9ecef);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.resource-desktop-table th {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ion-color-medium);
  transition: color 0.15s;
}

.resource-desktop-table th:hover {
  color: var(--ion-color-primary);
}

.th-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sort-icon {
  font-size: 14px;
  opacity: 0.7;
}

.resource-desktop-table tbody tr {
  cursor: pointer;
  transition: background 0.12s;
  background: var(--ion-card-background, #fff);
}

.resource-desktop-table tbody tr:last-child td {
  border-bottom: none;
}

.resource-desktop-table tbody tr:hover {
  background: var(--ion-color-light-tint, #f1f3f5);
}

.actions-cell {
  width: 100px;
  text-align: right;
  white-space: nowrap;
}

/* ── Mobile cards ── */
.resource-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-card {
  background: var(--ion-card-background, #fff);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s, transform 0.12s;
}

.mobile-card:active {
  transform: scale(0.99);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.mobile-card-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.mobile-card-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--ion-text-color, #000);
}

.mobile-card-subtitle {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.mobile-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.mobile-meta-item {
  white-space: nowrap;
  background: var(--ion-color-step-50, #f8f9fa);
  padding: 2px 8px;
  border-radius: 6px;
}

.mobile-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ion-color-step-100, #f0f0f0);
}

/* ── Pagination ── */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 0 8px;
}

.page-info {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ion-color-medium);
  min-width: 60px;
  text-align: center;
}

/* ── FAB (закреплён над BottomNav) ── */
.add-fab {
  position: fixed;
  right: 16px;
  bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 26px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(108, 99, 255, 0.4);
  transition: transform 0.15s;
}

.add-fab:active {
  transform: scale(0.94);
}

/* ── Responsive ── */
@media (min-width: 768px) {
  .resource-desktop-table {
    display: table;
  }

  .resource-mobile-list {
    display: none;
  }

  .add-btn-desktop {
    display: flex;
  }

  .add-fab {
    display: none;
  }
}
</style>
