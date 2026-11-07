<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/settings" />
        </ion-buttons>
        <ion-title>Доступ к данным</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="da-page">
        <h1 v-if="isDesktop" class="page-title">Доступ к данным</h1>

        <SlidingTabs v-model="tab" :tabs="tabs" />

        <div v-if="loading" class="da-state">
          <ion-spinner name="crescent" />
        </div>

        <PageState v-else-if="failed" text="Не удалось загрузить">
          <ion-button fill="clear" size="small" @click="load()">Повторить</ion-button>
        </PageState>

        <template v-else-if="tab === 'requests'">
          <p v-if="!grants.length" class="da-empty">Запросов нет</p>
          <article v-for="grant in grants" :key="grant.id" class="ui-card da-card">
            <div class="ui-card-head">
              <h3 class="ui-card-title">{{ grant.collective_name }}</h3>
              <span class="da-status" :class="`da-status--${grant.status}`">{{ GRANT_STATE_LABELS[grant.status] }}</span>
            </div>
            <p class="da-meta">
              {{ grant.grantee_name || 'Руководитель' }} · до {{ formatDateTime(grant.expires_at) }}
            </p>
            <div class="ui-chips">
              <span v-for="field in grant.fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
            </div>
            <p class="da-comment">{{ grant.comment }}</p>
            <div v-if="grant.status === 'pending'" class="da-actions">
              <button class="ui-btn ui-btn--primary ui-btn--sm" :disabled="busy === grant.id" @click="answer(grant, 'approve')">
                Разрешить
              </button>
              <button class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="busy === grant.id" @click="ask(grant, 'decline')">
                Отказать
              </button>
            </div>
            <div v-else-if="grant.status === 'active'" class="da-actions">
              <button class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="busy === grant.id" @click="ask(grant, 'revoke')">
                Отозвать
              </button>
            </div>
          </article>
          <button v-if="grantsMore" class="ui-btn ui-btn--ghost ui-btn--sm da-more" @click="loadGrants(grantsPage + 1)">
            Показать ещё
          </button>
        </template>

        <template v-else>
          <p v-if="!journal.length" class="da-empty">Записей нет</p>
          <div v-else class="ui-card da-journal">
            <template v-for="(entry, i) in journal" :key="entry.id">
              <div v-if="i > 0" class="da-divider" />
              <div class="da-entry">
                <div class="da-entry-head">
                  <span class="da-entry-action">{{ ACCESS_ACTION_LABELS[entry.action] }}</span>
                  <time class="da-entry-time">{{ formatDateTime(entry.created_at) }}</time>
                </div>
                <p class="da-meta">
                  {{ who(entry) }}<template v-if="entry.collective_name"> · {{ entry.collective_name }}</template>
                </p>
                <p class="da-entry-fields">{{ entry.fields.map((field) => field.label).join(', ') }}</p>
                <p v-if="entry.comment" class="da-comment">{{ entry.comment }}</p>
              </div>
            </template>
          </div>
          <button v-if="journalMore" class="ui-btn ui-btn--ghost ui-btn--sm da-more" @click="loadJournal(journalPage + 1)">
            Показать ещё
          </button>
        </template>
      </div>
    </ion-content>

    <ion-alert
      :is-open="!!confirming"
      :header="confirming?.decision === 'revoke' ? 'Отозвать доступ?' : 'Отказать в доступе?'"
      message="Изменить решение будет нельзя: для доступа понадобится новый запрос."
      :buttons="confirmButtons"
      @ion-alert-did-dismiss="confirming = null"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonSpinner, IonAlert, onIonViewWillEnter,
} from '@ionic/vue'
import {
  approveGrantProfileV2GrantsGrantIdApprovePost,
  declineGrantProfileV2GrantsGrantIdDeclinePost,
  getIncomingGrantsProfileV2GrantsIncomingGet,
  getMyAccessLogProfileV2AccessLogMyGet,
  revokeGrantProfileV2GrantsGrantIdRevokePost,
  type AccessLogEntryRead,
  type IncomingGrantRead,
} from '@/api/generated/almaEventFlow'
import PageState from '@/components/common/PageState.vue'
import SlidingTabs from '@/components/common/SlidingTabs.vue'
import { usePlatform } from '@/composables/usePlatform'
import { useToast } from '@/composables/useToast'
import { formatDateTime } from '@/utils/date'
import { ACCESS_ACTION_LABELS, GRANT_STATE_LABELS } from '@/utils/dataAccess'

type Decision = 'approve' | 'decline' | 'revoke'

const PAGE = 20
const DECIDE = {
  approve: approveGrantProfileV2GrantsGrantIdApprovePost,
  decline: declineGrantProfileV2GrantsGrantIdDeclinePost,
  revoke: revokeGrantProfileV2GrantsGrantIdRevokePost,
}

const { isDesktop } = usePlatform()
const { showError } = useToast()

const tab = ref('requests')
const grants = ref<IncomingGrantRead[]>([])
const grantsPage = ref(0)
const grantsMore = ref(false)
const journal = ref<AccessLogEntryRead[]>([])
const journalPage = ref(0)
const journalMore = ref(false)
const loading = ref(true)
const failed = ref(false)
const busy = ref<string | null>(null)
const confirming = ref<{ grant: IncomingGrantRead; decision: Decision } | null>(null)

const tabs = computed(() => [
  { key: 'requests', label: 'Запросы', badge: grants.value.filter((grant) => grant.status === 'pending').length || undefined },
  { key: 'journal', label: 'Журнал' },
])

const confirmButtons = [
  { text: 'Отмена', role: 'cancel' },
  {
    text: 'Подтвердить',
    role: 'destructive',
    handler: () => {
      if (confirming.value) answer(confirming.value.grant, confirming.value.decision)
    },
  },
]

function who(entry: AccessLogEntryRead): string {
  if (entry.by_self) return 'Вы'
  const name = entry.actor_name || 'Без подробной информации'
  return entry.by_administrator ? `${name}, администратор` : name
}

async function loadGrants(page = 0) {
  const { data } = await getIncomingGrantsProfileV2GrantsIncomingGet({ page, limit: PAGE })
  grants.value = page === 0 ? data.items : [...grants.value, ...data.items]
  grantsPage.value = page
  grantsMore.value = (page + 1) * PAGE < data.pagination.total
}

async function loadJournal(page = 0) {
  const { data } = await getMyAccessLogProfileV2AccessLogMyGet({ page, limit: PAGE })
  journal.value = page === 0 ? data.items : [...journal.value, ...data.items]
  journalPage.value = page
  journalMore.value = (page + 1) * PAGE < data.pagination.total
}

async function load() {
  loading.value = true
  failed.value = false
  try {
    await Promise.all([loadGrants(), loadJournal()])
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function ask(grant: IncomingGrantRead, decision: Decision) {
  confirming.value = { grant, decision }
}

async function answer(grant: IncomingGrantRead, decision: Decision) {
  if (busy.value) return
  busy.value = grant.id
  try {
    const { data } = await DECIDE[decision](grant.id)
    grants.value = grants.value.map((item) => (item.id === data.id ? data : item))
    await loadJournal()
  } catch (err) {
    await showError(err, 'Не удалось ответить на запрос')
  } finally {
    busy.value = null
  }
}

onIonViewWillEnter(load)
</script>

<style scoped>
.da-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.da-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.da-empty {
  margin: 0;
  padding: 40px 0;
  text-align: center;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.da-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.da-card .ui-card-head {
  margin-bottom: 0;
}

.da-status {
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
}

.da-status--pending {
  color: var(--ion-color-warning-shade);
}

.da-status--active {
  color: var(--ion-color-success);
}

.da-meta {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.da-comment {
  margin: 0;
  padding: 8px 12px;
  border-left: var(--border-w) solid var(--ion-color-primary);
  border-radius: var(--radius-sm);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  font-size: var(--fs-md);
  color: var(--ion-text-color);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.da-actions {
  display: flex;
  gap: 8px;
}

.da-more {
  align-self: center;
}

.da-journal {
  padding: 4px 16px;
}

.da-divider {
  height: 1px;
  background: var(--ion-border-color);
}

.da-entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
}

.da-entry-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.da-entry-action {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.da-entry-time {
  flex-shrink: 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.da-entry-fields {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-text-color);
}
</style>
