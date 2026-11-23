<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>Коллективы</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="cl-page">
        <h1 v-if="isDesktop" class="page-title">Коллективы</h1>

        <div class="cl-toolbar">
          <UiInput v-model="query.q" class="cl-search" label="Поиск" type="search" :maxlength="128" />
          <UiSelectPill
            v-if="isDesktop"
            v-model="query.sort"
            size="field"
            :options="SORT_OPTIONS"
            :icon="swapVerticalOutline"
            aria-label="Сортировка"
            align="end"
          >
            <button
              type="button"
              class="ui-icon-btn"
              :aria-label="query.order === 'asc' ? 'По возрастанию' : 'По убыванию'"
              @click="flipOrder"
            >
              <ion-icon :icon="query.order === 'asc' ? arrowUpOutline : arrowDownOutline" />
            </button>
          </UiSelectPill>
        </div>
        <ResourceFilterFields
          v-if="isDesktop"
          :filters="FILTERS"
          :values="filterValues"
          :active-count="activeCount"
          @set="setFilter"
          @reset="resetFilters"
        />

        <div v-if="loading && !items.length" class="cl-state"><ion-spinner name="crescent" /></div>
        <PageState v-else-if="failed" text="Не удалось загрузить коллективы">
          <ion-button fill="clear" size="small" @click="reload()">Повторить</ion-button>
        </PageState>
        <p v-else-if="!items.length" class="cl-empty">Ничего не найдено</p>

        <ul v-else class="cl-list">
          <li v-for="card in items" :key="card.id">
            <button type="button" class="cl-row" @click="router.push(`/collective/${card.id}`)">
              <DefaultAvatar kind="collective" :seed="card.id" :size="40" />
              <span class="cl-main">
                <span class="cl-name">{{ card.name }}</span>
                <span class="cl-meta">{{ metaOf(card) }}</span>
              </span>
              <span v-if="RELATION_LABELS[card.relation]" class="ui-chip ui-chip--static">
                {{ RELATION_LABELS[card.relation] }}
              </span>
              <ion-icon :icon="chevronForwardOutline" class="cl-arrow" />
            </button>
          </li>
        </ul>

        <button v-if="hasMore" type="button" class="ui-btn ui-btn--ghost" :disabled="loading" @click="loadMore()">
          Показать ещё
        </button>
      </div>
    </ion-content>

    <AppFab
      v-if="!isDesktop"
      :badge="activeCount"
      :icon="optionsOutline"
      aria-label="Фильтры"
      @click="filterOpen = true"
    />
    <SortFab
      v-if="!isDesktop"
      v-model="query.sort"
      :order="query.order === 'desc' ? 'desc' : 'asc'"
      :options="SORT_OPTIONS"
      @update:order="query.order = $event"
    />
    <ion-modal
      v-if="!isDesktop"
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
        <ResourceFilterFields
          :filters="FILTERS"
          :values="filterValues"
          :active-count="activeCount"
          @set="setFilter"
          @reset="resetFilters"
        />
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonModal, IonSpinner, onIonViewWillEnter,
} from '@ionic/vue'
import {
  arrowDownOutline, arrowUpOutline, chevronForwardOutline, closeOutline, optionsOutline, swapVerticalOutline,
} from 'ionicons/icons'
import {
  getCollectiveDirectoryEventV3CollectivesGet,
  getFacultyOrgV1FacultiesFacultyIdGet,
  type CollectiveCard,
  type DirectoryOrder,
} from '@/api/generated/almaEventFlow'
import ResourceFilterFields from '@/components/admin/ResourceFilterFields.vue'
import type { FilterDef } from '@/components/admin/ResourceTable.vue'
import AppFab from '@/components/common/AppFab.vue'
import DefaultAvatar from '@/components/common/DefaultAvatar.vue'
import PageState from '@/components/common/PageState.vue'
import SortFab from '@/components/common/SortFab.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelectPill from '@/components/common/UiSelectPill.vue'
import { usePlatform } from '@/composables/usePlatform'
import { useUrlState } from '@/composables/useUrlState'
import { useMyProfileStore } from '@/stores/myProfile'
import { RELATION_LABELS } from '@/utils/onboarding'

const PAGE = 20
const ALL = 'all'

const SORT_OPTIONS = [
  { value: 'name', label: 'Название' },
  { value: 'member_count', label: 'Участники' },
]

const yesNo = (yes: string, no: string) => [{ value: 'true', label: yes }, { value: 'false', label: no }]

const FILTERS: FilterDef[] = [
  { key: 'university', label: 'Университет', type: 'picker', picker: 'university' },
  { key: 'joined', label: 'Мои коллективы', type: 'select', anyLabel: 'Все', options: yesNo('Только мои', 'Кроме моих') },
  { key: 'open', label: 'Приём', type: 'select', anyLabel: 'Любой', options: yesNo('Открыт', 'Закрыт') },
  { key: 'verified', label: 'Подтверждение', type: 'select', anyLabel: 'Любое', options: yesNo('Подтверждён', 'Не подтверждён') },
]

const router = useRouter()
const { isDesktop } = usePlatform()
const myProfile = useMyProfileStore()

const query = useUrlState({ q: '', university: '', joined: '', open: '', verified: '', sort: 'name', order: 'asc' })
const universityId = ref<string | null>(null)
const filterOpen = ref(false)
const items = ref<CollectiveCard[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const failed = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let request = 0

const hasMore = computed(() => items.value.length < total.value)

/** Пустое значение в адресе — университет пользователя, поэтому «любой» хранится отдельным словом. */
const university = computed(() => {
  if (query.university === ALL) return null
  return query.university || universityId.value
})

const filterValues = computed(() => ({
  university: university.value ?? '',
  joined: query.joined,
  open: query.open,
  verified: query.verified,
}))

const activeCount = computed(() => Object.values(filterValues.value).filter(Boolean).length)

function setFilter(key: string, value: unknown) {
  const text = value == null ? '' : String(value)
  if (key === 'university') query.university = text || ALL
  else if (key === 'joined' || key === 'open' || key === 'verified') query[key] = text
}

function resetFilters() {
  query.university = ALL
  query.joined = ''
  query.open = ''
  query.verified = ''
}

function flipOrder() {
  query.order = query.order === 'desc' ? 'asc' : 'desc'
}

const flag = (value: string) => (value === '' ? undefined : value === 'true')

function orderBy(): DirectoryOrder {
  const key = query.sort === 'member_count' ? 'member_count' : 'name'
  return `${query.order === 'desc' ? '-' : ''}${key}` as DirectoryOrder
}

function metaOf(card: CollectiveCard): string {
  const members = `${card.member_count} ${plural(card.member_count)}`
  return [card.university_name, members, card.is_verified ? '' : 'Не подтверждён'].filter(Boolean).join(' · ')
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'участник'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника'
  return 'участников'
}

async function fetchPage(next: number) {
  const id = ++request
  loading.value = true
  failed.value = false
  try {
    const { data } = await getCollectiveDirectoryEventV3CollectivesGet({
      search: query.q.trim() || undefined,
      university_id: university.value ?? undefined,
      joined: flag(query.joined),
      is_open: flag(query.open),
      is_verified: flag(query.verified),
      order_by: orderBy(),
      page: next,
      limit: PAGE,
    })
    if (id !== request) return
    items.value = next === 0 ? data.items : [...items.value, ...data.items]
    total.value = data.pagination.total
    page.value = next
  } catch {
    if (id === request) failed.value = true
  } finally {
    if (id === request) loading.value = false
  }
}

function reload() {
  void fetchPage(0)
}

function loadMore() {
  void fetchPage(page.value + 1)
}

async function findUniversity() {
  if (!myProfile.loaded) await myProfile.load()
  const facultyId = myProfile.profile?.student?.faculty_id ?? myProfile.profile?.student?.group?.faculty_id
  if (!facultyId) return
  try {
    universityId.value = (await getFacultyOrgV1FacultiesFacultyIdGet(facultyId)).data.university_id ?? null
  } catch {
    universityId.value = null
  }
}

watch(() => query.q, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(reload, 300)
})
watch(() => [query.university, query.joined, query.open, query.verified, query.sort, query.order], reload)

onIonViewWillEnter(async () => {
  await findUniversity()
  reload()
})
</script>

<style scoped>
.cl-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cl-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.cl-search {
  flex: 1;
  min-width: 0;
}

.page-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.cl-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.cl-empty {
  margin: 24px 0;
  text-align: center;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.cl-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 4px 0;
  border-radius: var(--radius-lg);
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.cl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.cl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cl-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cl-meta {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.cl-arrow {
  color: var(--ion-color-medium);
}
</style>
