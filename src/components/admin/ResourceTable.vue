<template>
  <div class="resource-table">
    <div ref="topEl" class="rt-top" :class="{ 'rt-top--hidden': barHidden, 'rt-top--raised': barRaised }">
      <div class="rt-toolbar">
        <div class="rt-search">
          <ion-icon :icon="searchOutline" class="rt-search-icon" />
          <input
            v-model="query"
            class="rt-search-input"
            :placeholder="searchPlaceholder"
            @input="onSearchInput"
          />
          <button v-if="query" class="rt-search-clear" aria-label="Очистить" @click="clearSearch">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <div v-if="isDesktop" class="rt-toolbar-actions">
          <button
            v-if="filters.length"
            class="rt-tool-btn"
            :class="{ 'rt-tool-btn--active': filterOpen || activeFilters.length > 0 }"
            :aria-expanded="filterOpen"
            @click="filterOpen = !filterOpen"
          >
            <ion-icon :icon="optionsOutline" />
            <span class="rt-tool-btn-label">Фильтры</span>
            <span v-if="activeFilters.length" class="rt-tool-badge">{{ activeFilters.length }}</span>
          </button>

          <UiSelectPill
            v-if="sortOptions.length"
            v-model="sortKey"
            :options="sortOptions"
            :icon="swapVerticalOutline"
            aria-label="Сортировка"
            align="end"
            @update:model-value="onSortChange"
          >
            <button
              type="button"
              class="ui-icon-btn"
              :aria-label="sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'"
              @click="toggleOrder"
            >
              <ion-icon :icon="sortOrder === 'asc' ? arrowUpOutline : arrowDownOutline" />
            </button>
          </UiSelectPill>

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

      <div v-if="activeFilters.length && (!isDesktop || !filterOpen)" class="rt-active-filters">
        <button
          v-for="f in activeFilters"
          :key="f.key"
          type="button"
          class="ui-chip ui-chip--active rt-active-chip"
          :aria-label="`Убрать фильтр: ${f.label}`"
          @click="setFilter(f.key, f.type === 'toggle' ? false : '')"
        >
          <span class="rt-active-chip-text">{{ f.label }}: {{ activeValueLabel(f) }}</span>
          <ion-icon :icon="closeOutline" />
        </button>
      </div>
    </div>

    <div v-if="isDesktop && filters.length && filterOpen" class="rt-filter-panel">
      <ResourceFilterFields
        :filters="filters"
        :values="filterValues"
        :active-count="activeFilters.length"
        @set="setFilter"
        @reset="resetFilters"
      />
    </div>

    <!-- Скелетон вместо спиннера на пустом месте: форма будущих строк/карточек
         с бегущим бликом (см. .skeleton в theme/variables.css), чтобы список
         не появлялся рывком, а "проявлялся" на месте уже намеченной раскладки.
         Использует те же классы .resource-desktop-table/.resource-mobile-list,
         что и реальный контент -- нужный вариант сам покажется по media query. -->
    <div v-if="loading && !items.length" class="table-container" aria-hidden="true">
      <table class="resource-desktop-table">
        <thead>
          <tr>
            <th v-for="col in visibleColumns" :key="col.key">{{ col.label }}</th>
            <th class="actions-cell">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in 6" :key="n">
            <td v-for="col in visibleColumns" :key="col.key">
              <div class="skeleton skeleton--text" :style="{ width: skeletonWidth(n) }" />
            </td>
            <td class="actions-cell">
              <div class="skeleton" style="width: 72px; height: 24px; border-radius: 8px; margin-left: auto;" />
            </td>
          </tr>
        </tbody>
      </table>

      <div class="resource-mobile-list">
        <div v-for="n in 6" :key="n" class="mobile-card">
          <div class="mobile-card-main">
            <div class="skeleton skeleton--text" :style="{ width: skeletonWidth(n), height: '15px' }" />
            <div class="skeleton skeleton--text" :style="{ width: skeletonWidth(n + 1), height: '12px' }" />
          </div>
          <div class="mobile-card-meta">
            <div class="skeleton" style="width: 64px; height: 18px; border-radius: 6px;" />
            <div class="skeleton" style="width: 48px; height: 18px; border-radius: 6px;" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="error" class="state-box error">
      <ion-icon :icon="alertCircleOutline" size="large" />
      <p>{{ error }}</p>
      <ion-button fill="outline" @click="reload">Повторить</ion-button>
    </div>

    <div v-else-if="!items.length" class="state-box">
      <ion-icon :icon="searchOutline" size="large" />
      <p>Ничего не найдено</p>
      <ion-button v-if="activeFilters.length || query" fill="outline" @click="resetAll">Сбросить фильтры</ion-button>
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
            <td v-for="col in visibleColumns" :key="col.key" :title="col.resource ? undefined : getCellValue(item, col)">
              <ResourcePreview v-if="col.resource" v-bind="col.resource(item)" />
              <template v-else>{{ getCellValue(item, col) }}</template>
            </td>
            <td class="actions-cell" @click.stop>
              <div class="row-actions">
                <RowActionsMenu v-if="rowActions(item).length > 1" :actions="rowActions(item)" />
                <template v-else>
                  <button
                    v-for="action in rowActions(item)"
                    :key="action.label"
                    type="button"
                    class="ui-icon-btn"
                    :title="action.label"
                    :aria-label="action.label"
                    @click="action.run()"
                  >
                    <ion-icon :icon="action.icon" />
                  </button>
                </template>
                <button type="button" class="ui-icon-btn ui-icon-btn--primary" title="Редактировать" aria-label="Редактировать" @click="$emit('edit', item)">
                  <ion-icon :icon="pencilOutline" />
                </button>
                <button type="button" class="ui-icon-btn ui-icon-btn--delete" title="Удалить" aria-label="Удалить" @click="confirmDelete(item)">
                  <ion-icon :icon="trashOutline" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="resource-mobile-list">
        <div v-for="item in items" :key="item.id" class="mobile-card" @click="$emit('edit', item)">
          <div class="mobile-card-main">
            <span class="mobile-card-title">
              <ResourcePreview v-if="labelResource?.(item)" v-bind="labelResource(item)!" />
              <template v-else>{{ getLabel(item) }}</template>
            </span>
            <span class="mobile-card-subtitle">
              <ResourcePreview v-if="subtitleResource?.(item)" v-bind="subtitleResource(item)!" />
              <template v-else>{{ getSubtitle(item) }}</template>
            </span>
          </div>
          <div class="mobile-card-meta">
            <span v-for="col in mobileMetaColumns" :key="col.key" class="mobile-meta-item">
              <span class="mobile-meta-label">{{ col.label }}:</span>
              <ResourcePreview v-if="col.resource" v-bind="col.resource(item)" />
              <template v-else>{{ getCellValue(item, col) }}</template>
            </span>
          </div>
          <div class="mobile-card-footer" @click.stop>
            <div v-if="rowLinks.length" class="mobile-card-links">
              <button
                v-for="link in rowLinks"
                :key="link.label"
                type="button"
                class="ui-chip mobile-link"
                @click="followLink(link, item)"
              >
                <ion-icon :icon="link.icon || linkOutline" />
                {{ link.label }}
              </button>
            </div>
            <div class="mobile-card-actions">
              <button
                v-if="extraAction && (!extraAction.visible || extraAction.visible(item))"
                type="button"
                class="ui-icon-btn"
                :title="extraAction.title"
                :aria-label="extraAction.title"
                @click="$emit('extra', item)"
              >
                <ion-icon :icon="extraAction.icon" />
              </button>
              <button type="button" class="ui-icon-btn ui-icon-btn--primary" title="Редактировать" aria-label="Редактировать" @click="$emit('edit', item)">
                <ion-icon :icon="pencilOutline" />
              </button>
              <button type="button" class="ui-icon-btn ui-icon-btn--delete" title="Удалить" aria-label="Удалить" @click="confirmDelete(item)">
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Infinite auto-loading (replaces pagination) -->
    <ion-infinite-scroll :disabled="!hasMore || loading" @ion-infinite="onInfinite">
      <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Загрузка..." />
    </ion-infinite-scroll>

    <AppFab v-if="addLabel" :icon="addOutline" :aria-label="addLabel" @click="$emit('add')" />
    <AppFab
      v-if="hasSheet"
      :secondary="!!addLabel"
      :tucked="barHidden && !filterOpen"
      :badge="activeFilters.length"
      :icon="optionsOutline"
      aria-label="Фильтры"
      @click="filterOpen = true"
    />
    <SortFab
      v-if="hasSortFab"
      :model-value="sortKey"
      :order="sortOrder"
      :options="sortOptions"
      :secondary="!!addLabel || hasSheet"
      :stack="addLabel && hasSheet ? 1 : 0"
      :tucked="barHidden"
      @update:model-value="onSortSelect"
      @update:order="onOrderSelect"
    />

    <ion-modal
      v-if="hasSheet"
      :is-open="filterOpen"
      :initial-breakpoint="0.6"
      :breakpoints="[0, 0.6, 1]"
      @ion-modal-did-dismiss="filterOpen = false"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Фильтры</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="filterOpen = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="rt-sheet-body">
          <ResourceFilterFields
            :filters="filters"
            :values="filterValues"
            :active-count="activeFilters.length"
            @set="setFilter"
            @reset="resetFilters"
          />
        </div>
      </ion-content>
    </ion-modal>

    <ion-alert
      :is-open="deleteAlert.open"
      header="Удалить запись?"
      :buttons="deleteAlertButtons"
      @ion-alert-did-dismiss="deleteAlert.open = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  IonButton, IonIcon, IonAlert, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonInfiniteScroll, IonInfiniteScrollContent,
} from '@ionic/vue'
import {
  pencilOutline, trashOutline, addOutline, linkOutline,
  arrowUpOutline, arrowDownOutline, swapVerticalOutline,
  alertCircleOutline, searchOutline, optionsOutline, closeOutline,
} from 'ionicons/icons'
import type { AxiosResponse } from 'axios'
import AppFab from '@/components/common/AppFab.vue'
import SortFab from '@/components/common/SortFab.vue'
import ResourceFilterFields from '@/components/admin/ResourceFilterFields.vue'
import ResourcePreview from '@/components/common/ResourcePreview.vue'
import RowActionsMenu, { type RowAction } from '@/components/admin/RowActionsMenu.vue'
import UiSelectPill from '@/components/common/UiSelectPill.vue'
import { useAdminNavigate } from '@/composables/useAdminNavigate'
import { useHideOnScroll } from '@/composables/useHideOnScroll'
import { usePlatform } from '@/composables/usePlatform'
import { useSettingsStore } from '@/stores/settings'
import { PICKERS, type PickerName } from '@/utils/adminPickers'
import { resolveResourceLabel, type ResourceKind } from '@/utils/resourceLabels'
import { patchQuery, readQuery } from '@/utils/urlState'

export interface ColumnDef {
  key: string
  label: string
  sortable?: boolean
  render?: (item: any) => string
  /** Значение колонки -- foreign key: рендерится мини-превью с резолвом
   * имени и скелетоном на время загрузки, вместо голого uuid. */
  resource?: (item: any) => { kind: ResourceKind; id: string | null | undefined }
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
  type: 'select' | 'toggle' | 'date' | 'picker'
  options?: { value: any; label: string }[]
  /** Подпись пустого значения у select (по умолчанию «Любой») */
  anyLabel?: string
  /** Параметры запроса, которые добавляются, пока фильтр не выбран (например, показать и неактивных) */
  anyParams?: Record<string, any>
  /** picker: справочник, по записи которого фильтруем (см. utils/adminPickers) */
  picker?: PickerName
}

/** Переход со строки на другой раздел админки с уже выставленным фильтром */
export interface RowLink {
  label: string
  icon?: string
  to: (item: any) => string
}

const props = withDefaults(defineProps<{
  columns: ColumnDef[]
  getLabel: (item: any) => string
  getSubtitle: (item: any) => string
  /** Если заголовок/подзаголовок мобильной карточки -- foreign key (например
   * person_id), показывает резолвленное имя со скелетоном вместо голого id. */
  labelResource?: (item: any) => { kind: ResourceKind; id: string | null | undefined } | null
  subtitleResource?: (item: any) => { kind: ResourceKind; id: string | null | undefined } | null
  fetchItems: (params: Record<string, any>) => Promise<AxiosResponse<{ items: any[]; pagination: { total: number; page?: number; limit?: number } }>>
  addLabel?: string
  searchPlaceholder?: string
  sortOptions?: SortOption[]
  defaultSort?: string
  defaultOrder?: 'asc' | 'desc'
  pageSize?: number
  extraAction?: ExtraAction
  filters?: FilterDef[]
  rowLinks?: RowLink[]
  /** Поиск, сортировка и фильтры дублируются в адресной строке (q, sort, order, <ключ фильтра>) */
  urlSync?: boolean
}>(), {
  searchPlaceholder: 'Поиск или ID',
  defaultSort: '',
  defaultOrder: 'asc' as const,
  pageSize: 20,
  sortOptions: () => [],
  filters: () => [],
  rowLinks: () => [],
  urlSync: true,
})

const emit = defineEmits<{
  add: []
  edit: [item: any]
  delete: [item: any]
  extra: [item: any]
}>()

const navigate = useAdminNavigate()
const { isDesktop } = usePlatform()
const topEl = ref<HTMLElement | null>(null)
const settings = useSettingsStore()
const { hidden: barHidden, raised: barRaised } = useHideOnScroll(topEl, () => settings.collapseOnScroll)
const URL_PATH = window.location.pathname
const URL_KEYS = ['q', 'sort', 'order', ...props.filters.map((f) => f.key)]

function emptyFilterValue(f: FilterDef): string | boolean {
  return f.type === 'toggle' ? false : ''
}

function filterFromUrl(f: FilterDef, raw: string | null): string | boolean {
  if (raw === null) return emptyFilterValue(f)
  return f.type === 'toggle' ? raw === 'true' : raw
}

const initial = props.urlSync ? readQuery() : new URLSearchParams()
const query = ref(initial.get('q') ?? '')
const sortKey = ref(initial.get('sort') ?? (props.defaultSort || ''))
const sortOrder = ref<'asc' | 'desc'>(
  initial.get('order') === 'asc' || initial.get('order') === 'desc'
    ? (initial.get('order') as 'asc' | 'desc')
    : props.defaultOrder || 'asc',
)
const page = ref(0)
const limit = computed(() => props.pageSize || 20)
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const deleteAlert = ref<{ open: boolean; item: any }>({ open: false, item: null })

const filterValues = reactive<Record<string, any>>({})
for (const f of props.filters) filterValues[f.key] = filterFromUrl(f, initial.get(f.key))

function isActive(f: FilterDef): boolean {
  const v = filterValues[f.key]
  return f.type === 'toggle' ? v === true : v !== '' && v !== null && v !== undefined
}

const activeFilters = computed(() => props.filters.filter((f) => isActive(f)))
const filterOpen = ref(isDesktop.value && activeFilters.value.length > 0)
const hasSheet = computed(() => !isDesktop.value && props.filters.length > 0)
const hasSortFab = computed(() => !isDesktop.value && props.sortOptions.length > 0)

const hasMore = computed(() => items.value.length < total.value)
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

const pickerLabels = reactive<Record<string, string>>({})

watch(
  () => props.filters.map((f) => (f.type === 'picker' ? filterValues[f.key] : '')),
  () => {
    for (const f of props.filters) {
      const id = filterValues[f.key]
      if (f.type !== 'picker' || !f.picker || !id || pickerLabels[`${f.key}:${id}`]) continue
      resolveResourceLabel(PICKERS[f.picker].kind, id).then((label) => {
        if (label) pickerLabels[`${f.key}:${id}`] = label
      })
    }
  },
  { immediate: true },
)

function activeValueLabel(f: FilterDef): string {
  const v = filterValues[f.key]
  if (f.type === 'toggle') return 'да'
  if (f.type === 'select') return f.options?.find((o) => String(o.value) === String(v))?.label ?? String(v)
  if (f.type === 'picker') return pickerLabels[`${f.key}:${v}`] ?? '…'
  return String(v)
}

// Ширины скелетон-строк слегка отличаются -- иначе ряд одинаковых полосок
// читается как явная заглушка, а не намёк на будущий текст разной длины.
const SKELETON_WIDTHS = ['72%', '55%', '84%', '48%', '65%', '90%']
function skeletonWidth(n: number): string {
  return SKELETON_WIDTHS[n % SKELETON_WIDTHS.length]
}

function confirmDelete(item: any) {
  deleteAlert.value = { open: true, item }
}

function followLink(link: RowLink, item: any) {
  navigate(link.to(item))
}

function rowActions(item: any): RowAction[] {
  const actions: RowAction[] = props.rowLinks.map((link) => ({
    label: link.label,
    icon: link.icon || linkOutline,
    run: () => followLink(link, item),
  }))
  const extra = props.extraAction
  if (extra && (!extra.visible || extra.visible(item))) {
    actions.push({ label: extra.title, icon: extra.icon, run: () => emit('extra', item) })
  }
  return actions
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

function onSortSelect(key: string) {
  sortKey.value = key
  reload()
}

function onOrderSelect(order: 'asc' | 'desc') {
  sortOrder.value = order
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

function setFilter(key: string, value: any) {
  filterValues[key] = value
  reload()
}

function resetFilters() {
  for (const f of props.filters) filterValues[f.key] = emptyFilterValue(f)
  reload()
}

function resetAll() {
  query.value = ''
  resetFilters()
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
    } else if (f.anyParams) {
      Object.assign(params, f.anyParams)
    }
  }
  return params
}

function syncUrl() {
  if (!props.urlSync) return
  const values: Record<string, string> = {
    q: query.value,
    sort: sortKey.value !== (props.defaultSort || '') ? sortKey.value : '',
    order: sortOrder.value !== (props.defaultOrder || 'asc') ? sortOrder.value : '',
  }
  for (const f of props.filters) {
    const v = filterValues[f.key]
    if (f.type === 'toggle') {
      if (v === true) values[f.key] = 'true'
    } else if (v !== '' && v !== null && v !== undefined) {
      values[f.key] = String(v)
    }
  }
  patchQuery(URL_KEYS, values, URL_PATH)
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
  syncUrl()
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
  min-width: 0;
  max-width: 100%;
  min-height: 200px;
}

.table-container {
  overflow-x: auto;
}

/* ── Unified toolbar ── */
.rt-top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flow-root;
  margin: -8px 0 0;
  padding: 8px 0 0;
  background: var(--ion-background-color);
  transition: transform 0.25s ease, box-shadow 0.2s ease;
}

.rt-top--hidden {
  transform: translateY(-100%);
  pointer-events: none;
}

.rt-top--raised {
  box-shadow: 0 8px 12px -10px rgba(0, 0, 0, 0.4);
}

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
  flex: 1 1 220px;
  min-width: 0;
}

.rt-search-icon {
  position: absolute;
  left: 14px;
  font-size: var(--fs-xl);
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
  font-size: var(--fs-md);
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
  font-size: var(--fs-lg);
  cursor: pointer;
}

.rt-search-clear:hover {
  background: var(--ion-background-color);
}

.rt-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
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
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.rt-tool-btn ion-icon {
  font-size: var(--fs-xl);
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
  color: var(--ion-color-primary-contrast);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-bold);
}

.add-btn-desktop {
  display: none;
  font-weight: var(--fw-semibold);
  height: 44px;
}

/* ── Filter panel ── */
.rt-filter-panel {
  padding: 16px;
  margin-bottom: 16px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.rt-active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -4px 0 14px;
}

.rt-active-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.rt-active-chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  text-align: center;
}

.state-box p {
  margin: 0;
  font-size: var(--fs-lg);
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
  font-weight: var(--fw-semibold);
  font-size: var(--fs-sm);
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
  font-size: var(--fs-md);
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

.resource-desktop-table .actions-cell {
  width: 1%;
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  text-align: right;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

/* ── Mobile cards ── */
.resource-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.mobile-card {
  min-width: 0;
  background: var(--ion-card-background, #fff);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s, transform 0.12s;
  overflow-wrap: anywhere;
}

.mobile-card:active {
  transform: scale(0.99);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.mobile-card-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin-bottom: 8px;
}

.mobile-card-title {
  font-weight: var(--fw-semibold);
  font-size: var(--fs-lg);
  color: var(--ion-text-color, #000);
}

.mobile-card-subtitle {
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.mobile-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.mobile-meta-item {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 4px;
  max-width: 100%;
  background: var(--ion-color-step-50, #f8f9fa);
  padding: 2px 8px;
  border-radius: 6px;
}

.mobile-card-footer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--ion-color-step-100, #f0f0f0);
}

.mobile-card-links {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.mobile-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
}

.mobile-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

/* ── Responsive ── */
@media (max-width: 767px) {
  .rt-top {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: -12px -12px 0;
    padding: 12px 12px 10px;
  }

  .rt-toolbar,
  .rt-active-filters {
    margin: 0;
  }

  .rt-toolbar {
    flex-wrap: nowrap;
  }

  .rt-search {
    flex: 1 1 0;
  }

  .resource-table {
    padding-bottom: 88px;
  }

  .rt-sheet-body {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}

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
