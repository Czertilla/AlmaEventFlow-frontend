<template>
  <div class="resource-table">
    <!-- Unified toolbar: search · filters · sort · add -->
    <div class="rt-toolbar">
      <div class="rt-search">
        <ion-icon :icon="searchOutline" class="rt-search-icon" />
        <input
          v-model="query"
          class="rt-search-input"
          :placeholder="searchPlaceholder || 'Поиск...'"
          @input="onSearchInput"
        />
        <button v-if="query" class="rt-search-clear" aria-label="Очистить" @click="clearSearch">
          <ion-icon :icon="closeOutline" />
        </button>
      </div>

      <div class="rt-toolbar-actions">
        <button
          v-if="filters.length"
          class="rt-tool-btn"
          :class="{ 'rt-tool-btn--active': filterOpen || activeFilterCount > 0 }"
          @click="filterOpen = !filterOpen"
        >
          <ion-icon :icon="optionsOutline" />
          <span class="rt-tool-btn-label">Фильтры</span>
          <span v-if="activeFilterCount" class="rt-tool-badge">{{ activeFilterCount }}</span>
        </button>

        <div v-if="sortOptions.length" class="rt-sort">
          <ion-icon :icon="swapVerticalOutline" class="rt-sort-icon" />
          <select v-model="sortKey" class="rt-sort-select" @change="onSortChange">
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <button
            class="rt-sort-dir"
            :aria-label="sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'"
            @click="toggleOrder"
          >
            <ion-icon :icon="sortOrder === 'asc' ? arrowUpOutline : arrowDownOutline" />
          </button>
        </div>

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

    <!-- Filter panel -->
    <div v-if="filters.length && filterOpen" class="rt-filter-panel">
      <div v-for="f in filters" :key="f.key" class="rt-filter-field">
        <label class="rt-filter-label">{{ f.label }}</label>
        <select
          v-if="f.type === 'select'"
          v-model="filterValues[f.key]"
          class="rt-filter-control"
          @change="applyFilters"
        >
          <option value="">Любой</option>
          <option v-for="opt in f.options || []" :key="String(opt.value)" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <label v-else-if="f.type === 'toggle'" class="rt-filter-toggle">
          <ion-toggle
            :checked="filterValues[f.key] === true"
            mode="md"
            @ion-change="onToggleFilter(f.key, $event)"
          />
        </label>
        <input
          v-else-if="f.type === 'date'"
          v-model="filterValues[f.key]"
          type="date"
          class="rt-filter-control"
          @change="applyFilters"
        />
      </div>
      <button v-if="activeFilterCount" class="rt-filter-reset" @click="resetFilters">
        <ion-icon :icon="closeOutline" />
        Сбросить
      </button>
    </div>

    <div v-if="loading && !items.length" class="state-box">
      <ion-spinner name="crescent" />
      <p>Загрузка...</p>
    </div>

    <div v-else-if="error" class="state-box error">
      <ion-icon :icon="alertCircleOutline" size="large" />
      <p>{{ error }}</p>
      <ion-button fill="outline" @click="reload">Повторить</ion-button>
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

    <!-- Infinite auto-loading (replaces pagination) -->
    <ion-infinite-scroll :disabled="!hasMore || loading" @ion-infinite="onInfinite">
      <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Загрузка..." />
    </ion-infinite-scroll>

    <AppFab v-if="addLabel" :icon="addOutline" :aria-label="addLabel" @click="$emit('add')" />

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
import { ref, reactive, computed, onMounted } from 'vue'
import {
  IonButton, IonIcon, IonSpinner, IonAlert, IonToggle,
  IonInfiniteScroll, IonInfiniteScrollContent,
} from '@ionic/vue'
import {
  pencilOutline, trashOutline, addOutline,
  arrowUpOutline, arrowDownOutline, swapVerticalOutline,
  alertCircleOutline, searchOutline, optionsOutline, closeOutline,
} from 'ionicons/icons'
import type { AxiosResponse } from 'axios'
import AppFab from '@/components/common/AppFab.vue'

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

export interface FilterDef {
  key: string
  label: string
  type: 'select' | 'toggle' | 'date'
  options?: { value: any; label: string }[]
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
  filters?: FilterDef[]
}>(), {
  searchPlaceholder: 'Поиск...',
  defaultSort: '',
  defaultOrder: 'asc' as const,
  pageSize: 20,
  sortOptions: () => [],
  filters: () => [],
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

const filterOpen = ref(false)
const filterValues = reactive<Record<string, any>>({})
for (const f of props.filters) filterValues[f.key] = f.type === 'toggle' ? false : ''

const hasMore = computed(() => items.value.length < total.value)
const visibleColumns = computed(() => props.columns)
const mobileMetaColumns = computed(() => props.columns.filter(c => !c.hideMobile))

const activeFilterCount = computed(() =>
  props.filters.reduce((n, f) => {
    const v = filterValues[f.key]
    const set = f.type === 'toggle' ? v === true : v !== '' && v !== null && v !== undefined
    return n + (set ? 1 : 0)
  }, 0),
)

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
  reload()
}

function onSortChange() {
  reload()
}

function toggleOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  reload()
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => reload(), 300)
}

function clearSearch() {
  query.value = ''
  reload()
}

function onToggleFilter(key: string, ev: CustomEvent) {
  filterValues[key] = !!(ev.detail as { checked: boolean }).checked
  applyFilters()
}

function applyFilters() {
  reload()
}

function resetFilters() {
  for (const f of props.filters) filterValues[f.key] = f.type === 'toggle' ? false : ''
  reload()
}

function buildParams(): Record<string, any> {
  const params: Record<string, any> = { page: page.value, limit: limit.value }
  if (query.value) params.search = query.value
  if (sortKey.value) {
    params.order_by = sortOrder.value === 'desc' ? `-${sortKey.value}` : sortKey.value
  }
  for (const f of props.filters) {
    const v = filterValues[f.key]
    if (f.type === 'toggle') {
      if (v === true) params[f.key] = true
    } else if (v !== '' && v !== null && v !== undefined) {
      params[f.key] = v
    }
  }
  return params
}

// reload() resets to the first page; loadMore() appends the next page (infinite scroll)
async function loadData(append = false) {
  loading.value = true
  error.value = ''
  try {
    const res = await props.fetchItems(buildParams())
    const fetched = res.data.items
    items.value = append ? [...items.value, ...fetched] : fetched
    total.value = res.data.pagination.total
  } catch (err: any) {
    error.value = err?.message || 'Ошибка загрузки'
    if (!append) items.value = []
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 0
  return loadData(false)
}

async function onInfinite(ev: CustomEvent) {
  if (hasMore.value && !loading.value) {
    page.value += 1
    await loadData(true)
  }
  const target = ev.target as HTMLIonInfiniteScrollElement
  target.complete()
}

onMounted(() => { reload() })

defineExpose({ loadData: reload })
</script>

<style scoped>
.resource-table {
  position: relative;
  min-height: 200px;
}

/* ── Unified toolbar ── */
.rt-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.rt-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 220px;
}

.rt-search-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: var(--ion-color-medium);
  pointer-events: none;
}

.rt-search-input {
  width: 100%;
  height: 44px;
  padding: 0 38px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.rt-search-input:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

.rt-search-clear {
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
  font-size: 15px;
  cursor: pointer;
}

.rt-search-clear:hover {
  background: var(--ion-background-color);
}

.rt-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rt-tool-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.rt-tool-btn ion-icon {
  font-size: 18px;
}

.rt-tool-btn:hover {
  border-color: var(--ion-color-step-400);
  color: var(--ion-text-color);
}

.rt-tool-btn--active {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.rt-tool-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.rt-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 6px 0 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
}

.rt-sort-icon {
  font-size: 17px;
  color: var(--ion-color-medium);
}

.rt-sort-select {
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-text-color);
  outline: none;
  cursor: pointer;
  padding: 0 4px;
}

.rt-sort-dir {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.rt-sort-dir:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.add-btn-desktop {
  display: none;
  font-weight: 600;
  height: 44px;
}

/* ── Filter panel ── */
.rt-filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 14px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.rt-filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}

.rt-filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.rt-filter-control {
  height: 40px;
  padding: 0 10px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-background-color);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  outline: none;
}

.rt-filter-control:focus {
  border-color: var(--ion-color-primary);
}

.rt-filter-toggle {
  display: flex;
  align-items: center;
  height: 40px;
}

.rt-filter-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.rt-filter-reset:hover {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
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
}
</style>
