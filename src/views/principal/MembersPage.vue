<template>
  <PrincipalLayout title="Участники" add-label="Добавить участника" @add="openAdd">
      <div class="page-body">
        <ion-searchbar v-model="searchQuery" placeholder="Поиск по имени или роли..." />
        <div class="member-cards">
          <div v-for="m in filteredMembers" :key="m.id" class="member-card">
            <div class="member-avatar">{{ initials(m) }}</div>
            <div class="member-info">
              <span class="member-name">{{ displayName(m) }}</span>
              <span class="member-roles">{{ m.roles.map((r) => r.name).join(', ') || 'Без роли' }}</span>
            </div>
            <span class="member-status" :class="m.is_active !== false ? 'member-status--active' : 'member-status--inactive'">
              {{ m.is_active !== false ? 'Активен' : 'Неактивен' }}
            </span>
            <div class="member-actions">
              <button class="icon-btn" title="Редактировать" @click="openEdit(m)">
                <ion-icon :icon="pencilOutline" />
              </button>
              <button class="icon-btn icon-btn--danger" title="Удалить" @click="confirmDelete(m)">
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
          </div>
          <p v-if="!filteredMembers.length" class="empty-text">Участники не найдены</p>
        </div>
      </div>

    <!-- Add / edit member -->
    <ion-modal :is-open="editorOpen" @ion-modal-did-dismiss="editorOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ editingMember ? 'Участник' : 'Новый участник' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button aria-label="Закрыть" @click="editorOpen = false">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="form">
          <!-- Person picker (only when adding) -->
          <div v-if="!editingMember" class="form-field">
            <label>Персона</label>
            <ion-searchbar v-model="personSearch" placeholder="Поиск персоны..." class="person-search" :debounce="400" @ion-input="searchPersons" />
            <div v-if="personOptions.length" class="person-options">
              <button
                v-for="p in personOptions"
                :key="p.id"
                class="person-option"
                :class="{ 'person-option--selected': selectedPerson?.id === p.id }"
                @click="selectedPerson = p"
              >
                {{ p.surname }} {{ p.name }} {{ p.patronymic || '' }}
              </button>
            </div>
            <p v-if="selectedPerson" class="form-hint">Выбрано: {{ selectedPerson.surname }} {{ selectedPerson.name }}</p>
          </div>
          <div v-else class="form-field">
            <label>Персона</label>
            <p class="form-static">{{ displayName(editingMember) }}</p>
          </div>

          <div class="form-field">
            <label>Роли</label>
            <div class="role-chips">
              <button
                v-for="r in roles"
                :key="r.id"
                class="role-chip"
                :class="{ 'role-chip--active': selectedRoleIds.has(r.id) }"
                @click="toggleRoleSelection(r.id)"
              >
                {{ r.name }}
              </button>
              <span v-if="!roles.length" class="form-hint">Сначала создайте роли в разделе «Роли»</span>
            </div>
          </div>

          <div class="form-field form-field--row">
            <label>Активен</label>
            <ion-toggle v-model="editIsActive" />
          </div>

          <ion-button expand="block" :disabled="saving || (!editingMember && !selectedPerson)" @click="saveMember">
            Сохранить
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <ion-alert
      :is-open="deleteOpen"
      header="Удалить участника?"
      :message="`«${deletingMember ? displayName(deletingMember) : ''}» будет исключён из коллектива.`"
      :buttons="deleteButtons"
      @ion-alert-did-dismiss="deleteOpen = false"
    />
  </PrincipalLayout>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import {
  IonHeader, IonToolbar, IonButtons, IonTitle, IonContent, IonSearchbar,
  IonButton, IonIcon, IonModal, IonToggle, IonAlert, toastController,
} from '@ionic/vue'
import PrincipalLayout from '@/components/layout/PrincipalLayout.vue'
import { addOutline, pencilOutline, trashOutline, closeOutline } from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import {
  getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet,
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
  createMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersPost,
  patchMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdPatch,
  deleteMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdDelete,
} from '@/api/generated/-event'
import { searchPersonProfileV1PersonsGet } from '@/api/generated/-profile'
import { resolvePersonName, shortId } from '@/utils/names'
import type { MemberRead, RoleRead } from '@/api/generated/almaEventFlow.schemas'

interface PersonOption { id: string; name: string; surname: string; patronymic?: string | null }

const principal = usePrincipalStore()
const searchQuery = ref('')
const members = ref<MemberRead[]>([])
const roles = ref<RoleRead[]>([])
const personNames = reactive<Record<string, string>>({})

const editorOpen = ref(false)
const editingMember = ref<MemberRead | null>(null)
const selectedRoleIds = ref<Set<string>>(new Set())
const editIsActive = ref(true)
const saving = ref(false)

const personSearch = ref('')
const personOptions = ref<PersonOption[]>([])
const selectedPerson = ref<PersonOption | null>(null)

const deleteOpen = ref(false)
const deletingMember = ref<MemberRead | null>(null)

const deleteButtons = [
  { text: 'Отмена', role: 'cancel' },
  { text: 'Удалить', role: 'destructive', handler: () => { deleteMember() } },
]

function displayName(m: MemberRead): string {
  return personNames[m.person_id] || `#${shortId(m.person_id)}`
}

function initials(m: MemberRead): string {
  const name = personNames[m.person_id]
  if (!name) return '·'
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value
  const q = searchQuery.value.toLowerCase()
  return members.value.filter((m) =>
    displayName(m).toLowerCase().includes(q) ||
    m.roles.some((r) => r.name.toLowerCase().includes(q)),
  )
})

async function showError(err: any, fallback: string) {
  const toast = await toastController.create({
    message: err?.response?.data?.detail || fallback,
    duration: 3000,
    color: 'danger',
  })
  toast.present()
}

function toggleRoleSelection(roleId: string) {
  const next = new Set(selectedRoleIds.value)
  if (next.has(roleId)) next.delete(roleId)
  else next.add(roleId)
  selectedRoleIds.value = next
}

function openAdd() {
  editingMember.value = null
  selectedPerson.value = null
  personSearch.value = ''
  personOptions.value = []
  selectedRoleIds.value = new Set()
  editIsActive.value = true
  editorOpen.value = true
}

function openEdit(m: MemberRead) {
  editingMember.value = m
  selectedRoleIds.value = new Set(m.roles.map((r) => r.id))
  editIsActive.value = m.is_active !== false
  editorOpen.value = true
}

function confirmDelete(m: MemberRead) {
  deletingMember.value = m
  deleteOpen.value = true
}

async function searchPersons() {
  if (!personSearch.value) {
    personOptions.value = []
    return
  }
  try {
    const res = await searchPersonProfileV1PersonsGet({ search: personSearch.value, limit: 10 })
    personOptions.value = (res.data.items as PersonOption[]) || []
  } catch {
    personOptions.value = []
  }
}

async function saveMember() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId) return
  saving.value = true
  try {
    if (editingMember.value) {
      await patchMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdPatch(collectiveId, editingMember.value.id, {
        roles: Array.from(selectedRoleIds.value),
        is_active: editIsActive.value,
      })
    } else if (selectedPerson.value) {
      await createMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersPost(collectiveId, {
        person_id: selectedPerson.value.id,
        roles: Array.from(selectedRoleIds.value),
        is_active: editIsActive.value,
      })
    }
    editorOpen.value = false
    await loadMembers(collectiveId)
  } catch (err) {
    showError(err, 'Не удалось сохранить участника')
  } finally {
    saving.value = false
  }
}

async function deleteMember() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId || !deletingMember.value) return
  try {
    await deleteMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdDelete(collectiveId, deletingMember.value.id)
    await loadMembers(collectiveId)
  } catch (err) {
    showError(err, 'Не удалось удалить участника')
  }
}

async function loadMembers(collectiveId: string) {
  try {
    const [membersRes, rolesRes] = await Promise.all([
      getMyCollectiveMembersEventV1MeCollectivesCollectiveIdMembersGet(collectiveId, { limit: 100 }),
      getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet(collectiveId, { limit: 100 }),
    ])
    members.value = membersRes.data.items
    roles.value = rolesRes.data.items
    await Promise.all(membersRes.data.items.map(async (m) => {
      const name = await resolvePersonName(m.person_id)
      if (name) personNames[m.person_id] = name
    }))
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
</script>

<style scoped>
.page-body {
  padding-bottom: 32px;
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

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 14px;
  font-weight: 700;
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
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-roles {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.member-status {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
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
  font-size: 16px;
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
  font-size: 14px;
  padding: 40px 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 560px;
  margin: 0 auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.form-field > label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.form-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.form-static {
  margin: 0;
  font-size: 15px;
  color: var(--ion-text-color);
}

.person-search {
  padding: 0;
  --border-radius: 10px;
}

.person-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.person-option {
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: var(--ion-text-color);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.person-option:hover {
  background: var(--ion-background-color);
}

.person-option--selected {
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
  font-weight: 600;
}

.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-chip {
  padding: 6px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.role-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(108, 99, 255, 0.1);
  color: var(--ion-color-primary);
}
</style>
