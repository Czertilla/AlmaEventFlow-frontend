<template>
  <PrincipalLayout title="Роли" add-label="Новая роль" @add="openCreate">
      <div class="page-body">
        <div class="role-cards">
          <div v-for="role in roles" :key="role.id" class="role-card">
            <span class="role-name">{{ role.name }}</span>
            <div class="role-actions">
              <button class="icon-btn" title="Переименовать" @click="openEdit(role)">
                <ion-icon :icon="pencilOutline" />
              </button>
              <button class="icon-btn icon-btn--danger" title="Удалить" @click="confirmDelete(role)">
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
          </div>
          <p v-if="!roles.length" class="empty-text">Ролей пока нет</p>
        </div>
      </div>

    <ion-alert
      :is-open="editorOpen"
      :header="editingRole ? 'Переименовать роль' : 'Новая роль'"
      :inputs="[{ name: 'name', type: 'text', placeholder: 'Название роли', value: editingRole?.name || '' }]"
      :buttons="editorButtons"
      @ion-alert-did-dismiss="editorOpen = false"
    />
    <ion-alert
      :is-open="deleteOpen"
      header="Удалить роль?"
      :message="`Роль «${deletingRole?.name}» будет удалена.`"
      :buttons="deleteButtons"
      @ion-alert-did-dismiss="deleteOpen = false"
    />
  </PrincipalLayout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { IonButton, IonIcon, IonAlert, toastController } from '@ionic/vue'
import PrincipalLayout from '@/components/layout/PrincipalLayout.vue'
import { addOutline, pencilOutline, trashOutline } from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import {
  getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet,
  createMyCollectiveRoleEventV1MeCollectivesCollectiveIdRolesPost,
  patchMyCollectiveRoleEventV1MeCollectivesCollectiveIdRolesRoleIdPatch,
  deleteMyCollectiveRoleEventV1MeCollectivesCollectiveIdRolesRoleIdDelete,
} from '@/api/generated/-event'
import type { RoleRead } from '@/api/generated/almaEventFlow.schemas'

const principal = usePrincipalStore()
const roles = ref<RoleRead[]>([])

const editorOpen = ref(false)
const editingRole = ref<RoleRead | null>(null)
const deleteOpen = ref(false)
const deletingRole = ref<RoleRead | null>(null)

const editorButtons = [
  { text: 'Отмена', role: 'cancel' },
  {
    text: 'Сохранить',
    handler: (data: { name: string }) => { saveRole(data.name?.trim()) },
  },
]

const deleteButtons = [
  { text: 'Отмена', role: 'cancel' },
  { text: 'Удалить', role: 'destructive', handler: () => { deleteRole() } },
]

async function showError(err: any, fallback: string) {
  const toast = await toastController.create({
    message: err?.response?.data?.detail || fallback,
    duration: 3000,
    color: 'danger',
  })
  toast.present()
}

function openCreate() {
  editingRole.value = null
  editorOpen.value = true
}

function openEdit(role: RoleRead) {
  editingRole.value = role
  editorOpen.value = true
}

function confirmDelete(role: RoleRead) {
  deletingRole.value = role
  deleteOpen.value = true
}

async function saveRole(name: string) {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId || !name) return
  try {
    if (editingRole.value) {
      await patchMyCollectiveRoleEventV1MeCollectivesCollectiveIdRolesRoleIdPatch(collectiveId, editingRole.value.id, { name })
    } else {
      await createMyCollectiveRoleEventV1MeCollectivesCollectiveIdRolesPost(collectiveId, { name, collective_id: collectiveId })
    }
    await loadRoles(collectiveId)
  } catch (err) {
    showError(err, 'Не удалось сохранить роль')
  }
}

async function deleteRole() {
  const collectiveId = principal.activePrincipalCollectiveId
  if (!collectiveId || !deletingRole.value) return
  try {
    await deleteMyCollectiveRoleEventV1MeCollectivesCollectiveIdRolesRoleIdDelete(collectiveId, deletingRole.value.id)
    await loadRoles(collectiveId)
  } catch (err) {
    showError(err, 'Не удалось удалить роль')
  }
}

async function loadRoles(collectiveId: string) {
  try {
    const res = await getMyCollectiveRolesEventV1MeCollectivesCollectiveIdRolesGet(collectiveId, { limit: 100 })
    roles.value = res.data.items
  } catch (err) {
    console.error('Failed to load roles', err)
  }
}

watch(() => principal.activePrincipalCollectiveId, async (collectiveId) => {
  if (!collectiveId) {
    roles.value = []
    return
  }
  await loadRoles(collectiveId)
}, { immediate: true })
</script>

<style scoped>
.page-body {
  padding-bottom: 32px;
}

.role-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
}

.role-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.role-actions {
  display: flex;
  gap: 4px;
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
</style>
