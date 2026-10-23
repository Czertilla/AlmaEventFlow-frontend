<template>
      <div class="page-body">
        <div class="toolbar-row">
          <ion-searchbar v-model="searchQuery" placeholder="Поиск по имени или роли..." />
          <button v-if="roles.length" class="sort-btn" title="Сортировка по ролям" @click="openSort">
            <ion-icon :icon="swapVerticalOutline" />
            <span>Сортировка</span>
          </button>
        </div>
        <div class="member-cards">
          <div
            v-for="m in displayMembers"
            :key="m.id"
            class="member-card member-card--link"
            role="link"
            tabindex="0"
            @click="openProfile(m)"
            @keydown.enter.self="openProfile(m)"
          >
            <div class="member-avatar">{{ initials(m) }}</div>
            <div class="member-info">
              <span class="member-name">{{ displayName(m) }}</span>
              <span class="member-roles">{{ m.roles.map((r) => r.name).join(', ') || 'Без роли' }}</span>
            </div>
            <span class="member-status" :class="m.is_active !== false ? 'member-status--active' : 'member-status--inactive'">
              {{ m.is_active !== false ? 'Активен' : 'Неактивен' }}
            </span>
            <div class="member-actions">
              <button class="icon-btn" title="Профиль и посещаемость" aria-label="Профиль и посещаемость" @click.stop="openProfile(m)">
                <ion-icon :icon="statsChartOutline" />
              </button>
              <button class="icon-btn" title="Редактировать" @click.stop="openEdit(m)">
                <ion-icon :icon="pencilOutline" />
              </button>
              <button class="icon-btn icon-btn--danger" title="Удалить" @click.stop="confirmDelete(m)">
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
          </div>
          <p v-if="!displayMembers.length" class="empty-text">Участники не найдены</p>
        </div>
      </div>

    <!-- Role sort order -->
    <ion-modal :is-open="sortOpen" @ion-modal-did-dismiss="sortOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-buttons v-if="sortMode === 'roles'" slot="start" class="sort-help">
            <HelpTip text="Перетащите роли, чтобы задать порядок участников. Порядок сохраняется для этого коллектива." />
          </ion-buttons>
          <ion-title>Сортировка по ролям</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="sortOpen = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-segment :value="sortMode" class="sort-mode" @ionChange="onSortModeChange">
          <ion-segment-button value="roles"><ion-label>По ролям</ion-label></ion-segment-button>
          <ion-segment-button value="alpha"><ion-label>По алфавиту</ion-label></ion-segment-button>
        </ion-segment>
        <template v-if="sortMode === 'roles'">
          <ion-reorder-group :disabled="false" @ionItemReorder="handleReorder">
            <ion-item v-for="roleId in roleOrder" :key="roleId" lines="full">
              <ion-label>{{ roleName(roleId) }}</ion-label>
              <ion-reorder slot="end" />
            </ion-item>
          </ion-reorder-group>
          <p v-if="!roleOrder.length" class="form-hint">Роли ещё не созданы.</p>
        </template>
      </ion-content>
    </ion-modal>

    <MemberEditorModal
      v-if="collectiveId"
      :is-open="editorOpen"
      :collective-id="collectiveId"
      :member="editingMember"
      :member-name="editingMember ? displayName(editingMember) : ''"
      :roles="roles"
      @close="editorOpen = false"
      @saved="reload"
    />

    <MemberDeleteAlert
      v-if="collectiveId"
      :is-open="deleteOpen"
      :collective-id="collectiveId"
      :member-id="deletingMember?.id ?? null"
      :member-name="deletingMember ? displayName(deletingMember) : ''"
      @close="deleteOpen = false"
      @deleted="reload"
    />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  IonHeader, IonToolbar, IonButtons, IonTitle, IonContent, IonSearchbar,
  IonButton, IonIcon, IonModal, IonReorderGroup, IonReorder,
  IonItem, IonLabel, IonSegment, IonSegmentButton,
} from '@ionic/vue'
import type { ItemReorderEventDetail } from '@ionic/vue'
import { pencilOutline, trashOutline, closeOutline, swapVerticalOutline, statsChartOutline } from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import { usePrincipalNavigate } from '@/composables/usePrincipalNavigate'
import { useLayoutAddButton } from '@/composables/usePrincipalPageActions'
import { reconcileRoleOrder, saveRoleOrder as persistRoleOrder, rankByRoleIds, loadSortMode, saveSortMode, type SortMode } from '@/utils/roleSort'
import { getCollectiveRosterEventV2CollectivesCollectiveIdRosterGet } from '@/api/generated/almaEventFlow'
import HelpTip from '@/components/common/HelpTip.vue'
import MemberDeleteAlert from '@/components/member/MemberDeleteAlert.vue'
import MemberEditorModal from '@/components/member/MemberEditorModal.vue'
import { formatPersonName } from '@/utils/names'
import type { RosterMember, RoleRead } from '@/api/generated/almaEventFlow'

const principal = usePrincipalStore()
const navigate = usePrincipalNavigate()
const searchQuery = ref('')
const members = ref<RosterMember[]>([])
const roles = ref<RoleRead[]>([])

// ---- Сортировка участников по ролям (порядок настраивается руководителем) ----
// Общая логика порядка/ключей в @/utils/roleSort — тот же порядок применяется
// и на странице мероприятия.
const sortOpen = ref(false)
const roleOrder = ref<string[]>([])
const sortMode = ref<SortMode>('roles')

function roleName(roleId: string): string {
  return roles.value.find((r) => r.id === roleId)?.name || '—'
}

function loadRoleOrder(collectiveId: string) {
  roleOrder.value = reconcileRoleOrder(collectiveId, roles.value.map((r) => r.id))
  sortMode.value = loadSortMode(collectiveId)
}

function onSortModeChange(event: CustomEvent) {
  const mode = (event.detail.value as SortMode) || 'roles'
  sortMode.value = mode
  const collectiveId = principal.activePrincipalCollectiveId
  if (collectiveId) saveSortMode(collectiveId, mode)
}

function saveRoleOrder() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  persistRoleOrder(collectiveId, roleOrder.value)
}

function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
  roleOrder.value = event.detail.complete(roleOrder.value)
  saveRoleOrder()
}

function openSort() {
  sortOpen.value = true
}

// Минимальный индекс роли участника в заданном порядке; без ролей/неизвестные — в конец.
function memberRoleRank(m: RosterMember): number {
  return rankByRoleIds(roleOrder.value, m.roles.map((r) => r.id))
}

const displayMembers = computed(() => {
  const byName = (a: RosterMember, b: RosterMember) =>
    displayName(a).localeCompare(displayName(b), 'ru')
  const former = (a: RosterMember, b: RosterMember) => Number(!a.is_active) - Number(!b.is_active)
  const sorted = filteredMembers.value.slice()
  if (sortMode.value === 'alpha') return sorted.sort((a, b) => former(a, b) || byName(a, b))
  return sorted.sort((a, b) => former(a, b) || memberRoleRank(a) - memberRoleRank(b) || byName(a, b))
})

const collectiveId = computed(() => principal.activePrincipalCollectiveId)

const editorOpen = ref(false)
const editingMember = ref<RosterMember | null>(null)

const deleteOpen = ref(false)
const deletingMember = ref<RosterMember | null>(null)

function displayName(m: RosterMember): string {
  return formatPersonName(m.person)
}

function initials(m: RosterMember): string {
  return displayName(m).split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value
  const q = searchQuery.value.toLowerCase()
  return members.value.filter((m) =>
    displayName(m).toLowerCase().includes(q) ||
    m.roles.some((r) => r.name.toLowerCase().includes(q)),
  )
})

function openAdd() {
  editingMember.value = null
  editorOpen.value = true
}

function openEdit(m: RosterMember) {
  editingMember.value = m
  editorOpen.value = true
}

function openProfile(m: RosterMember) {
  navigate(`/principal/members/${m.id}`)
}

function confirmDelete(m: RosterMember) {
  deletingMember.value = m
  deleteOpen.value = true
}

async function reload() {
  if (collectiveId.value) await loadMembers(collectiveId.value)
}

async function loadMembers(collectiveId: string) {
  try {
    const { data } = await getCollectiveRosterEventV2CollectivesCollectiveIdRosterGet(collectiveId)
    members.value = data.members
    roles.value = data.roles
    loadRoleOrder(collectiveId)
  } catch (err) {
    console.error('Failed to load members', err)
  }
}

watch(() => principal.activePrincipalCollectiveId, async (collectiveId) => {
  if (!collectiveId) {
    members.value = []
    roles.value = []
    return
  }
  await loadMembers(collectiveId)
}, { immediate: true })

useLayoutAddButton('Добавить участника', openAdd)
</script>

<style scoped>
.page-body {
  padding-bottom: 32px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-row ion-searchbar {
  flex: 1;
  padding: 0;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.sort-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.member-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.member-card--link {
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.member-card--link:hover,
.member-card--link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--border-w) var(--ion-color-primary), var(--ion-card-shadow);
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: var(--fs-md);
  font-weight: var(--fw-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-roles {
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.member-status {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
}

.member-status--active {
  background: rgba(0, 191, 146, 0.12);
  color: #00997a;
}

.member-status--inactive {
  background: var(--ion-color-step-50, #f4f5f8);
  color: var(--ion-color-medium);
}

.member-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-color-medium);
  font-size: var(--fs-lg);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--ion-background-color);
  color: var(--ion-color-primary);
}

.icon-btn--danger:hover {
  color: var(--ion-color-danger);
  background: rgba(255, 71, 87, 0.08);
}

.empty-text {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: var(--fs-md);
  padding: 40px 0;
}

.form-hint {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.sort-help {
  padding-left: 12px;
}

</style>
