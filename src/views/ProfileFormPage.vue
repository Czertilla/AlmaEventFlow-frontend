<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pf-page">
        <BackLink v-if="isDesktop" label="Профиль" @click="router.push('/profile')" />
        <h1 v-if="isDesktop" class="pf-title">{{ title }}</h1>

        <div v-if="!ready" class="pf-state"><ion-spinner name="crescent" /></div>

        <PageState v-else-if="myProfile.failed" text="Не удалось загрузить профиль">
          <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="start">Повторить</button>
        </PageState>

        <template v-else>
          <p v-if="!isEdit" class="pf-hint">
            Расскажите о себе один раз: руководители коллективов увидят то, что нужно для работы.
            Всё можно изменить позже.
          </p>

          <section class="ui-card pf-card">
            <div class="ui-card-head"><h3 class="ui-card-title">О вас</h3></div>
            <UiInput v-model="form.surname" label="Фамилия" autocomplete="family-name" :maxlength="128" :error="errors.surname" />
            <UiInput v-model="form.name" label="Имя" autocomplete="given-name" :maxlength="128" :error="errors.name" />
            <UiInput v-model="form.patronymic" label="Отчество" autocomplete="additional-name" :maxlength="128" />
            <DateTimeField v-model="form.birthdate" mode="date" label="Дата рождения" />
          </section>

          <section class="ui-card pf-card">
            <div class="ui-card-head"><h3 class="ui-card-title">Учёба</h3></div>
            <label class="ui-toggle-row"><span>Я студент</span><ion-toggle v-model="form.isStudent" /></label>
            <template v-if="form.isStudent">
              <UiInput v-model="form.studentId" label="Студенческий билет" :maxlength="64" :error="errors.studentId" />
              <SearchPicker v-model="form.groupId" label="Группа" :fetch="searchGroups" :numeric="true" resource="group" placeholder="Поиск группы…" />
              <p v-if="errors.groupId" class="pf-error">{{ errors.groupId }}</p>
              <SearchPicker v-model="form.facultyId" label="Факультет" :fetch="searchOrgs" resource="organization" placeholder="Поиск факультета…" />
              <label class="ui-toggle-row"><span>Бюджет</span><ion-toggle v-model="form.isBudget" /></label>
              <label class="ui-toggle-row"><span>Очная форма</span><ion-toggle v-model="form.isFull" /></label>
            </template>
          </section>

          <section class="ui-card pf-card">
            <div class="ui-card-head"><h3 class="ui-card-title">Дополнительно</h3></div>
            <SearchPicker v-model="form.workplaceId" label="Место работы" :fetch="searchOrgs" resource="organization" placeholder="Поиск организации…" />
            <UiSelect v-model="form.dietId" label="Диета" placeholder="Не выбрано" :options="dietOptions" />
          </section>

          <section class="ui-card pf-card">
            <div class="ui-card-head"><h3 class="ui-card-title">Контакты</h3></div>
            <div v-for="contact in form.contacts" :key="contact.key" class="pf-contact">
              <div class="pf-contact-type">
                <UiSelect v-model="contact.type" label="Тип" placeholder="Выберите" :options="CONTACT_TYPE_OPTIONS" />
              </div>
              <div class="pf-contact-value">
                <UiInput v-model="contact.value" label="Значение" :maxlength="256" />
              </div>
              <button
                type="button"
                class="ui-icon-btn pf-contact-btn"
                :class="{ 'ui-icon-btn--active': contact.is_main }"
                title="Основной"
                aria-label="Основной"
                @click="contact.is_main = !contact.is_main"
              >★</button>
              <button type="button" class="ui-icon-btn ui-icon-btn--danger pf-contact-btn" title="Убрать" aria-label="Убрать контакт" @click="removeContact(contact.key)">
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
            <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm pf-add" @click="addContact">
              <ion-icon :icon="addOutline" /> Добавить контакт
            </button>
          </section>

          <p v-if="error" class="pf-error">{{ error }}</p>

          <button type="button" class="ui-btn ui-btn--primary pf-save" :disabled="saving" @click="submit">
            {{ isEdit ? 'Сохранить' : 'Создать профиль' }}
          </button>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  IonSpinner, IonToggle, onIonViewWillEnter,
} from '@ionic/vue'
import { addOutline, trashOutline } from 'ionicons/icons'
import {
  getManyProfileV1DietsGet,
  getStudentGroupsProfileV1StudentsGroupsGet,
  listOrganizationsOrgV1OrganizationsGet,
} from '@/api/generated/almaEventFlow'
import type { ContactType, DietRead, MyProfileRead, MyProfileWrite } from '@/api/generated/almaEventFlow'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import BackLink from '@/components/common/BackLink.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import PageState from '@/components/common/PageState.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import { usePlatform } from '@/composables/usePlatform'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useMyProfileStore } from '@/stores/myProfile'
import { CONTACT_TYPE_OPTIONS } from '@/utils/contactTypes'
import { withAny } from '@/utils/selectOptions'

interface ContactRow { key: number; id?: string; type: ContactType | ''; value: string; is_main: boolean }

const router = useRouter()
const auth = useAuthStore()
const myProfile = useMyProfileStore()
const { isDesktop } = usePlatform()
const { showError, showSuccess } = useToast()

const ready = ref(false)
const saving = ref(false)
const error = ref('')
const diets = ref<DietRead[]>([])
let nextKey = 0

const form = reactive({
  surname: '', name: '', patronymic: '', birthdate: null as string | null,
  isStudent: false, studentId: '', groupId: null as number | null, facultyId: null as string | null,
  isBudget: false, isFull: false, isActive: true,
  workplaceId: null as string | null, dietId: null as number | null,
  contacts: [] as ContactRow[],
})
const errors = reactive({ surname: '', name: '', studentId: '', groupId: '' })

const isEdit = computed(() => !!myProfile.profile)
const title = computed(() => (isEdit.value ? 'Изменить профиль' : 'Создать профиль'))
const dietOptions = computed(() => withAny<number | null>(diets.value.map((d) => ({ value: d.id, label: d.name })), null, 'Не выбрано'))

function fill(profile: MyProfileRead | null) {
  form.surname = profile?.surname ?? ''
  form.name = profile?.name ?? ''
  form.patronymic = profile?.patronymic ?? ''
  form.birthdate = profile?.birthdate ?? null
  form.isStudent = !!profile?.student
  form.studentId = profile?.student?.student_id ?? ''
  form.groupId = profile?.student?.group_id ?? null
  form.facultyId = profile?.student?.faculty_id ?? null
  form.isBudget = profile?.student?.is_budget ?? false
  form.isFull = profile?.student?.is_full ?? false
  form.isActive = profile?.student?.is_active ?? true
  form.workplaceId = profile?.workplace_id ?? null
  form.dietId = profile?.diet_id ?? null
  form.contacts = (profile?.contacts ?? []).map((c) => ({
    key: nextKey++, id: c.id, type: c.type, value: c.value, is_main: !!c.is_main,
  }))
  error.value = ''
  Object.assign(errors, { surname: '', name: '', studentId: '', groupId: '' })
}

function addContact() {
  form.contacts.push({ key: nextKey++, type: '', value: '', is_main: false })
}

function removeContact(key: number) {
  form.contacts = form.contacts.filter((c) => c.key !== key)
}

async function searchOrgs(search: string) {
  return (await listOrganizationsOrgV1OrganizationsGet({ search, limit: 20 })).data.items
}

async function searchGroups(search: string) {
  return (await getStudentGroupsProfileV1StudentsGroupsGet({ search, limit: 20 })).data.items
}

function validate(): boolean {
  errors.surname = form.surname.trim() ? '' : 'Укажите фамилию'
  errors.name = form.name.trim() ? '' : 'Укажите имя'
  errors.studentId = form.isStudent && !form.studentId.trim() ? 'Укажите номер студенческого билета' : ''
  errors.groupId = form.isStudent && form.groupId == null ? 'Выберите группу' : ''
  return !Object.values(errors).some(Boolean)
}

function payload(): MyProfileWrite {
  return {
    surname: form.surname.trim(),
    name: form.name.trim(),
    patronymic: form.patronymic.trim() || null,
    birthdate: form.birthdate || null,
    workplace_id: form.workplaceId || null,
    diet_id: form.dietId ?? null,
    student: form.isStudent && form.groupId != null
      ? {
          student_id: form.studentId.trim(), group_id: form.groupId, faculty_id: form.facultyId || null,
          is_budget: form.isBudget, is_full: form.isFull, is_active: form.isActive,
        }
      : null,
    contacts: form.contacts
      .filter((c) => c.type && c.value.trim())
      .map((c) => ({ id: c.id, type: c.type as ContactType, value: c.value.trim(), is_main: c.is_main })),
  }
}

async function submit() {
  error.value = ''
  if (!validate()) return
  const wasEdit = isEdit.value
  saving.value = true
  try {
    await myProfile.save(payload())
  } catch (err) {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    if (detail === 'PROFILE_ALREADY_EXISTS') {
      await myProfile.load(true)
      fill(myProfile.profile)
      error.value = 'Профиль уже создан, возможно на другом устройстве. Проверьте данные и сохраните их.'
    } else if (detail === 'ACCOUNT_LINK_OUT_OF_SYNC') {
      error.value = 'Не удалось создать профиль: с аккаунтом связаны старые данные. Обратитесь к администратору.'
    } else {
      showError(err, 'Не удалось сохранить профиль')
    }
    return
  } finally {
    saving.value = false
  }
  if (!wasEdit) await auth.tryRefresh()
  showSuccess(wasEdit ? 'Профиль сохранён' : 'Профиль создан')
  router.push('/profile')
}

async function start() {
  ready.value = false
  await myProfile.load(true)
  fill(myProfile.profile)
  try {
    diets.value = (await getManyProfileV1DietsGet({ limit: 200 })).data.items
  } catch {
    diets.value = []
  }
  ready.value = true
}

onIonViewWillEnter(start)
</script>

<style scoped>
.pf-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px 48px;
}

.pf-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.pf-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.pf-hint {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.pf-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pf-card .ui-card-head {
  margin-bottom: 0;
}

.pf-contact {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.pf-contact-type {
  flex: 0 0 140px;
}

.pf-contact-value {
  flex: 1;
  min-width: 0;
}

.pf-contact-btn {
  margin-top: 15px;
}

.pf-add {
  align-self: flex-start;
}

.pf-error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-danger);
}

.pf-save {
  width: 100%;
}
</style>
