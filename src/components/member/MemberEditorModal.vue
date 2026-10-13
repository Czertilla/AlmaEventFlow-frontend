<template>
  <ion-modal :is-open="isOpen" @ion-modal-did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ member ? 'Участник' : 'Новый участник' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Закрыть" @click="emit('close')">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="form">
        <EntityPickerField
          v-if="!member"
          v-model:search="personSearch"
          label="Персона"
          placeholder="Поиск персоны…"
          clear-label="Сбросить персону"
          :options="personPickerOptions"
          :selected="selectedPersonOption"
          @search="searchPersons"
          @select="selectedPerson = $event.raw"
          @clear="selectedPerson = null"
        />
        <UiField v-else label="Персона" float>
          <span class="ui-field-value">{{ memberName }}</span>
        </UiField>

        <div class="form-field">
          <p class="ui-field-title">Роли</p>
          <div class="ui-chips">
            <button
              v-for="r in roles"
              :key="r.id"
              type="button"
              class="ui-chip"
              :class="{ 'ui-chip--active': selectedRoleIds.has(r.id) }"
              @click="toggleRoleSelection(r.id)"
            >
              {{ r.name }}
            </button>
            <span v-if="!roles.length" class="form-hint">Сначала создайте роли в разделе «Роли»</span>
          </div>
        </div>

        <label class="ui-toggle-row">
          <span>Активен</span>
          <ion-toggle v-model="isActive" />
        </label>

        <ion-button expand="block" :disabled="saving || (!member && !selectedPerson)" @click="save">
          Сохранить
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  IonHeader, IonToolbar, IonButtons, IonTitle, IonContent, IonButton, IonIcon, IonModal, IonToggle,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import {
  createMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersPost,
  patchMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdPatch,
  searchPersonProfileV1PersonsGet,
} from '@/api/generated/almaEventFlow'
import type { MemberRead, RoleRead } from '@/api/generated/almaEventFlow'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import UiField from '@/components/common/UiField.vue'
import { useToast } from '@/composables/useToast'
import { formatPersonName } from '@/utils/names'

interface PersonOption { id: string; name: string; surname: string; patronymic?: string | null }

const props = defineProps<{
  isOpen: boolean
  collectiveId: string
  member: MemberRead | null
  memberName: string
  roles: RoleRead[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { showError } = useToast()

const selectedRoleIds = ref<Set<string>>(new Set())
const isActive = ref(true)
const saving = ref(false)

const personSearch = ref('')
const personOptions = ref<PersonOption[]>([])
const selectedPerson = ref<PersonOption | null>(null)

const personPickerOptions = computed(() =>
  personOptions.value.map((raw) => ({ id: raw.id, name: formatPersonName(raw), raw })),
)
const selectedPersonOption = computed(() =>
  selectedPerson.value ? { id: selectedPerson.value.id, name: formatPersonName(selectedPerson.value) } : null,
)

watch(() => props.isOpen, (open) => {
  if (!open) return
  selectedRoleIds.value = new Set(props.member?.roles.map((r) => r.id))
  isActive.value = props.member ? props.member.is_active !== false : true
  selectedPerson.value = null
  personSearch.value = ''
  personOptions.value = []
})

function toggleRoleSelection(roleId: string) {
  const next = new Set(selectedRoleIds.value)
  if (next.has(roleId)) next.delete(roleId)
  else next.add(roleId)
  selectedRoleIds.value = next
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

async function save() {
  saving.value = true
  try {
    const roles = Array.from(selectedRoleIds.value)
    if (props.member) {
      await patchMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdPatch(
        props.collectiveId, props.member.id, { roles, is_active: isActive.value },
      )
    } else if (selectedPerson.value) {
      await createMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersPost(
        props.collectiveId, { person_id: selectedPerson.value.id, roles, is_active: isActive.value },
      )
    }
    emit('close')
    emit('saved')
  } catch (err) {
    showError(err, 'Не удалось сохранить участника')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
  margin: 0 auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-hint {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}
</style>
