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

        <UiInput v-model="query.q" label="Поиск" type="search" :maxlength="128" />
        <div v-if="universityId" class="ui-chips">
          <button
            type="button"
            class="ui-chip"
            :class="{ 'ui-chip--active': query.mine === '1' }"
            @click="query.mine = query.mine === '1' ? '0' : '1'"
          >
            Мой университет
          </button>
        </div>

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
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonSpinner, onIonViewWillEnter,
} from '@ionic/vue'
import { chevronForwardOutline } from 'ionicons/icons'
import {
  getCollectiveDirectoryEventV3CollectivesGet,
  getFacultyOrgV1FacultiesFacultyIdGet,
  type CollectiveCard,
} from '@/api/generated/almaEventFlow'
import DefaultAvatar from '@/components/common/DefaultAvatar.vue'
import PageState from '@/components/common/PageState.vue'
import UiInput from '@/components/common/UiInput.vue'
import { usePlatform } from '@/composables/usePlatform'
import { useUrlState } from '@/composables/useUrlState'
import { useMyProfileStore } from '@/stores/myProfile'
import { RELATION_LABELS } from '@/utils/onboarding'

const PAGE = 20

const router = useRouter()
const { isDesktop } = usePlatform()
const myProfile = useMyProfileStore()

const query = useUrlState({ q: '', mine: '1' })
const universityId = ref<string | null>(null)
const items = ref<CollectiveCard[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const failed = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let request = 0

const hasMore = computed(() => items.value.length < total.value)

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
      university_id: query.mine === '1' && universityId.value ? universityId.value : undefined,
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
watch(() => query.mine, reload)

onIonViewWillEnter(async () => {
  await findUniversity()
  reload()
})
</script>

<style scoped>
.cl-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  margin: 0;
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
