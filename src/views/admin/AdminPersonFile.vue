<template>
    <div class="dossier">
      <button class="back-link" @click="goBack">
        <ion-icon :icon="arrowBackOutline" /> К списку персон
      </button>

      <div v-if="loading" class="state-box"><ion-spinner name="crescent" /></div>

      <template v-else>
        <h2 class="dossier-name">{{ fullName || 'Персона' }}</h2>

        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="tab"
            :class="{ 'tab--active': activeTab === t.key }"
            @click="activeTab = t.key"
          >{{ t.label }}</button>
        </div>

        <!-- Персона -->
        <section v-show="activeTab === 'person'" class="card">
          <TimestampsMeta :created-at="personMeta.created_at" :edited-at="personMeta.edited_at" />
          <UiInput v-model="person.surname" label="Фамилия" />
          <UiInput v-model="person.name" label="Имя" />
          <UiInput v-model="person.patronymic" label="Отчество" />
          <ion-button expand="block" :disabled="savingPerson" @click="savePerson">Сохранить</ion-button>
        </section>

        <!-- Профиль -->
        <section v-show="activeTab === 'profile'" class="card">
          <TimestampsMeta :created-at="profileMeta.created_at" :edited-at="profileMeta.edited_at" />
          <p v-if="!profileExists" class="hint">Профиль ещё не создан — заполните и сохраните.</p>
          <DateTimeField v-model="profile.birthdate" mode="date" label="Дата рождения" />
          <SearchPicker v-model="profile.workplace_id" label="Место работы" :fetch="searchOrgs" placeholder="Поиск организации…" />
          <UiSelect v-model="profile.diet_id" label="Диета" placeholder="Не выбрано">
            <ion-select-option :value="null">Не выбрано</ion-select-option>
            <ion-select-option v-for="d in diets" :key="d.id" :value="d.id">{{ d.name }}</ion-select-option>
          </UiSelect>
          <ion-button expand="block" :disabled="savingProfile" @click="saveProfile">Сохранить</ion-button>
        </section>

        <!-- Студент -->
        <section v-show="activeTab === 'student'" class="card">
          <TimestampsMeta :created-at="studentMeta.created_at" :edited-at="studentMeta.edited_at" />
          <p v-if="!studentExists" class="hint">Студенческая карточка не создана — заполните и сохраните.</p>
          <p v-if="!profileExists" class="hint hint--warn">Сначала создайте профиль.</p>
          <UiInput v-model="student.student_id" label="Студенческий билет" />
          <SearchPicker v-model="student.group_id" label="Группа" :fetch="searchGroups" :numeric="true" placeholder="Поиск группы…" />
          <SearchPicker v-model="student.faculty_id" label="Факультет" :fetch="searchOrgs" placeholder="Поиск факультета…" />
          <label class="ui-toggle-row"><span>Бюджет</span><ion-toggle v-model="student.is_budget" /></label>
          <label class="ui-toggle-row"><span>Очная форма</span><ion-toggle v-model="student.is_full" /></label>
          <label class="ui-toggle-row"><span>Активен</span><ion-toggle v-model="student.is_active" /></label>
          <ion-button expand="block" :disabled="savingStudent || !profileExists" @click="saveStudent">Сохранить</ion-button>
        </section>

        <!-- Контакты -->
        <section v-show="activeTab === 'contacts'" class="card">
          <div v-for="c in contacts" :key="c.id" class="contact">
            <div class="contact-row">
              <UiSelect v-model="c.type" class="contact-type" label="Тип">
                <ion-select-option v-for="[v, l] in contactTypeOptions" :key="v" :value="v">{{ l }}</ion-select-option>
              </UiSelect>
              <UiInput v-model="c.value" class="contact-value" label="Значение" />
              <button type="button" class="ui-icon-btn contact-btn" :class="{ 'ui-icon-btn--active': c.is_main }" title="Основной" aria-label="Основной" @click="c.is_main = !c.is_main">★</button>
              <button type="button" class="ui-icon-btn ui-icon-btn--primary contact-btn" title="Сохранить" aria-label="Сохранить" @click="saveContact(c)"><ion-icon :icon="checkmarkOutline" /></button>
              <button type="button" class="ui-icon-btn ui-icon-btn--danger contact-btn" title="Удалить" aria-label="Удалить" @click="removeContact(c)"><ion-icon :icon="trashOutline" /></button>
            </div>
            <TimestampsMeta :created-at="c.created_at" :edited-at="c.edited_at" />
          </div>
          <div class="contact-row">
            <UiSelect v-model="newContact.type" class="contact-type" label="Тип" placeholder="Выберите">
              <ion-select-option v-for="[v, l] in contactTypeOptions" :key="v" :value="v">{{ l }}</ion-select-option>
            </UiSelect>
            <UiInput v-model="newContact.value" class="contact-value" label="Новый контакт" />
            <button type="button" class="ui-icon-btn ui-icon-btn--primary contact-btn" title="Добавить" aria-label="Добавить контакт" :disabled="!newContact.type || !newContact.value" @click="addContact">
              <ion-icon :icon="addOutline" />
            </button>
          </div>
        </section>
      </template>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useAdminNavigate } from '@/composables/useAdminNavigate'
import { IonButton, IonIcon, IonSpinner, IonSelectOption, IonToggle, toastController } from '@ionic/vue'
import { arrowBackOutline, trashOutline, addOutline, checkmarkOutline } from 'ionicons/icons'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import TimestampsMeta from '@/components/common/TimestampsMeta.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import {
  getPersonProfileV1PersonsPersonIdGet,
  patchPersonProfileV1PersonsPersonIdPatch,
  getProfileProfileV1ProfilesProfileIdGet,
  createProfileProfileV1ProfilesPost,
  patchProfileProfileV1ProfilesProfileIdPatch,
  getStudentProfileV1StudentsStudentIdGet,
  createStudentProfileV1StudentsPost,
  patchStudentProfileV1StudentsStudentIdPatch,
  getPersonContactsProfileV1PersonsPersonIdContactsGet,
  createPersonContactProfileV1PersonsPersonIdContactsPost,
  patchContactProfileV1ContactsIdPatch,
  deleteContactProfileV1ContactsIdDelete,
  getManyProfileV1DietsGet,
  listOrganizationsOrgV1OrganizationsGet,
  getStudentGroupsProfileV1StudentsGroupsGet,
} from '@/api/generated/almaEventFlow'
import type { DietRead } from '@/api/generated/almaEventFlow'

const props = defineProps<{ personId: string }>()
const personId = props.personId
const adminNavigate = useAdminNavigate()

const loading = ref(true)
const activeTab = ref<'person' | 'profile' | 'student' | 'contacts'>('person')
const tabs = [
  { key: 'person', label: 'Персона' },
  { key: 'profile', label: 'Профиль' },
  { key: 'student', label: 'Студент' },
  { key: 'contacts', label: 'Контакты' },
] as const

const person = reactive({ surname: '', name: '', patronymic: '' as string | null })
const profile = reactive({ birthdate: '' as string | null, workplace_id: null as string | null, diet_id: null as number | null })
const student = reactive({
  student_id: '', group_id: null as number | null, faculty_id: null as string | null,
  is_budget: false, is_full: false, is_active: true,
})
const personMeta = reactive<Meta>({ created_at: null, edited_at: null })
const profileMeta = reactive<Meta>({ created_at: null, edited_at: null })
const studentMeta = reactive<Meta>({ created_at: null, edited_at: null })
const profileExists = ref(false)

function setMeta(target: Meta, source: { created_at?: string | null; edited_at?: string | null }) {
  target.created_at = source.created_at ?? null
  target.edited_at = source.edited_at ?? null
}
const studentExists = ref(false)
const diets = ref<DietRead[]>([])

interface Meta { created_at: string | null; edited_at: string | null }
interface ContactRow extends Meta { id: string; type: string; value: string; is_main: boolean }
const contacts = ref<ContactRow[]>([])
const newContact = reactive({ type: '' as string, value: '', is_main: false })

const contactTypeLabels: Record<string, string> = {
  email: 'Email', phone: 'Телефон', tg: 'Telegram', vk: 'VK', address: 'Адрес',
}
const contactTypeOptions = Object.entries(contactTypeLabels) as [string, string][]

const savingPerson = ref(false)
const savingProfile = ref(false)
const savingStudent = ref(false)

const fullName = computed(() => [person.surname, person.name, person.patronymic].filter(Boolean).join(' '))

function goBack() { adminNavigate('/admin/persons') }

async function toast(message: string, color = 'success') {
  const t = await toastController.create({ message, duration: 2000, color })
  t.present()
}
function showError(err: any, fallback: string) {
  toast(err?.response?.data?.detail || fallback, 'danger')
}

async function searchOrgs(search: string) {
  return (await listOrganizationsOrgV1OrganizationsGet({ search, limit: 20 })).data.items
}
async function searchGroups(search: string) {
  return (await getStudentGroupsProfileV1StudentsGroupsGet({ search, limit: 20 })).data.items
}

async function savePerson() {
  savingPerson.value = true
  try {
    const res = await patchPersonProfileV1PersonsPersonIdPatch(personId, {
      surname: person.surname, name: person.name, patronymic: person.patronymic || null,
    })
    setMeta(personMeta, res.data)
    toast('Персона сохранена')
  } catch (err) { showError(err, 'Не удалось сохранить персону') } finally { savingPerson.value = false }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const body = { birthdate: profile.birthdate || null, workplace_id: profile.workplace_id || null, diet_id: profile.diet_id ?? null }
    if (profileExists.value) {
      setMeta(profileMeta, (await patchProfileProfileV1ProfilesProfileIdPatch(personId, body)).data)
    } else {
      setMeta(profileMeta, (await createProfileProfileV1ProfilesPost({ id: personId, ...body } as any)).data)
      profileExists.value = true
    }
    toast('Профиль сохранён')
  } catch (err) { showError(err, 'Не удалось сохранить профиль') } finally { savingProfile.value = false }
}

async function saveStudent() {
  savingStudent.value = true
  try {
    const body = {
      student_id: student.student_id, group_id: student.group_id, faculty_id: student.faculty_id || null,
      is_budget: student.is_budget, is_full: student.is_full, is_active: student.is_active,
    }
    if (studentExists.value) {
      setMeta(studentMeta, (await patchStudentProfileV1StudentsStudentIdPatch(personId, body as any)).data)
    } else {
      setMeta(studentMeta, (await createStudentProfileV1StudentsPost({ id: personId, ...body } as any)).data)
      studentExists.value = true
    }
    toast('Студенческая карточка сохранена')
  } catch (err) { showError(err, 'Не удалось сохранить студента') } finally { savingStudent.value = false }
}

async function saveContact(c: ContactRow) {
  try {
    const res = await patchContactProfileV1ContactsIdPatch(c.id, { type: c.type as any, value: c.value, is_main: c.is_main })
    setMeta(c, res.data)
    toast('Контакт сохранён')
  } catch (err) { showError(err, 'Не удалось сохранить контакт') }
}

async function addContact() {
  try {
    await createPersonContactProfileV1PersonsPersonIdContactsPost(personId, {
      type: newContact.type as any, value: newContact.value, is_main: newContact.is_main,
    })
    newContact.type = ''; newContact.value = ''; newContact.is_main = false
    await loadContacts()
  } catch (err) { showError(err, 'Не удалось добавить контакт') }
}

async function removeContact(c: ContactRow) {
  try {
    await deleteContactProfileV1ContactsIdDelete(c.id)
    await loadContacts()
  } catch (err) { showError(err, 'Не удалось удалить контакт') }
}

async function loadContacts() {
  try {
    const res = await getPersonContactsProfileV1PersonsPersonIdContactsGet(personId, { limit: 100 })
    contacts.value = res.data.items.map((c: any) => ({ id: c.id, type: c.type, value: c.value, is_main: !!c.is_main, created_at: c.created_at ?? null, edited_at: c.edited_at ?? null }))
  } catch { contacts.value = [] }
}

onMounted(async () => {
  loading.value = true
  try {
    const [personRes, dietsRes] = await Promise.all([
      getPersonProfileV1PersonsPersonIdGet(personId),
      getManyProfileV1DietsGet({ limit: 200 }).catch(() => null),
    ])
    person.surname = personRes.data.surname
    person.name = personRes.data.name
    person.patronymic = personRes.data.patronymic ?? ''
    setMeta(personMeta, personRes.data)
    diets.value = dietsRes?.data.items ?? []

    try {
      const p = (await getProfileProfileV1ProfilesProfileIdGet(personId)).data
      profileExists.value = true
      profile.birthdate = p.birthdate ?? ''
      profile.workplace_id = p.workplace_id ?? null
      profile.diet_id = p.diet_id ?? null
      setMeta(profileMeta, p)
    } catch { profileExists.value = false }

    try {
      const s = (await getStudentProfileV1StudentsStudentIdGet(personId)).data
      studentExists.value = true
      student.student_id = s.student_id
      student.group_id = s.group_id
      student.faculty_id = s.faculty_id ?? null
      student.is_budget = s.is_budget ?? false
      student.is_full = s.is_full ?? false
      student.is_active = s.is_active ?? true
      setMeta(studentMeta, s)
    } catch { studentExists.value = false }

    await loadContacts()
  } catch (err) {
    showError(err, 'Не удалось загрузить личное дело')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dossier { max-width: 640px; margin: 0 auto; }
.back-link {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px;
  border: none; background: transparent; color: var(--ion-color-primary);
  font-weight: var(--fw-semibold); font-size: var(--fs-md); cursor: pointer; 
}
.dossier-name { margin: 0 0 14px; font-size: var(--fs-2xl); font-weight: var(--fw-bold); }
.state-box { display: flex; justify-content: center; padding: 60px 0; }
.tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
.tab {
  padding: 8px 16px; border: var(--border-w) solid var(--ion-border-color); border-radius: var(--radius-pill);
  background: transparent; font-weight: var(--fw-semibold); font-size: var(--fs-sm); color: var(--ion-color-medium);
  cursor: pointer; transition: all 0.15s;
}
.tab--active { border-color: var(--ion-color-primary); color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.08); }
.card {
  display: flex; flex-direction: column; gap: 14px; padding: 18px;
  background: var(--ion-card-background); border-radius: var(--radius-lg); box-shadow: var(--ion-card-shadow);
}
.hint { margin: 0; font-size: var(--fs-sm); color: var(--ion-color-medium); }
.hint--warn { color: var(--ion-color-warning, #d9822b); }
.contact { display: flex; flex-direction: column; gap: 2px; }
.contact-row { display: flex; align-items: flex-start; gap: 8px; }
.contact-type { flex: 0 0 140px; }
.contact-value { flex: 1; min-width: 0; }
.contact-btn { margin-top: 15px; }
</style>
