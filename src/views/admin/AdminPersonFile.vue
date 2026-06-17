<template>
  <AdminLayout title="Личное дело">
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
          <div class="field"><label>Фамилия</label><ion-input v-model="person.surname" mode="md" /></div>
          <div class="field"><label>Имя</label><ion-input v-model="person.name" mode="md" /></div>
          <div class="field"><label>Отчество</label><ion-input v-model="person.patronymic" mode="md" /></div>
          <ion-button expand="block" :disabled="savingPerson" @click="savePerson">Сохранить</ion-button>
        </section>

        <!-- Профиль -->
        <section v-show="activeTab === 'profile'" class="card">
          <p v-if="!profileExists" class="hint">Профиль ещё не создан — заполните и сохраните.</p>
          <div class="field"><label>Дата рождения</label><input v-model="profile.birthdate" type="date" class="native-input" /></div>
          <div class="field">
            <label>Место работы</label>
            <SearchPicker v-model="profile.workplace_id" :fetch="searchOrgs" placeholder="Поиск организации..." />
          </div>
          <div class="field">
            <label>Диета</label>
            <ion-select v-model="profile.diet_id" interface="popover" placeholder="Не выбрано" mode="md">
              <ion-select-option :value="null">Не выбрано</ion-select-option>
              <ion-select-option v-for="d in diets" :key="d.id" :value="d.id">{{ d.name }}</ion-select-option>
            </ion-select>
          </div>
          <ion-button expand="block" :disabled="savingProfile" @click="saveProfile">Сохранить</ion-button>
        </section>

        <!-- Студент -->
        <section v-show="activeTab === 'student'" class="card">
          <p v-if="!studentExists" class="hint">Студенческая карточка не создана — заполните и сохраните.</p>
          <p v-if="!profileExists" class="hint hint--warn">Сначала создайте профиль.</p>
          <div class="field"><label>Студенческий билет</label><ion-input v-model="student.student_id" mode="md" /></div>
          <div class="field">
            <label>Группа</label>
            <SearchPicker v-model="student.group_id" :fetch="searchGroups" :numeric="true" placeholder="Поиск группы..." />
          </div>
          <div class="field">
            <label>Факультет</label>
            <SearchPicker v-model="student.faculty_id" :fetch="searchOrgs" placeholder="Поиск факультета..." />
          </div>
          <div class="field field--row"><label>Бюджет</label><ion-toggle v-model="student.is_budget" /></div>
          <div class="field field--row"><label>Очная форма</label><ion-toggle v-model="student.is_full" /></div>
          <div class="field field--row"><label>Активен</label><ion-toggle v-model="student.is_active" /></div>
          <ion-button expand="block" :disabled="savingStudent || !profileExists" @click="saveStudent">Сохранить</ion-button>
        </section>

        <!-- Контакты -->
        <section v-show="activeTab === 'contacts'" class="card">
          <div v-for="c in contacts" :key="c.id" class="contact-row">
            <ion-select v-model="c.type" interface="popover" mode="md" class="contact-type">
              <ion-select-option v-for="[v, l] in contactTypeOptions" :key="v" :value="v">{{ l }}</ion-select-option>
            </ion-select>
            <ion-input v-model="c.value" mode="md" class="contact-value" placeholder="Значение" />
            <button class="chip-toggle" :class="{ 'chip-toggle--on': c.is_main }" title="Основной" @click="c.is_main = !c.is_main">★</button>
            <button class="icon-btn" title="Сохранить" @click="saveContact(c)"><ion-icon :icon="checkmarkOutline" /></button>
            <button class="icon-btn icon-btn--danger" title="Удалить" @click="removeContact(c)"><ion-icon :icon="trashOutline" /></button>
          </div>
          <div class="contact-row">
            <ion-select v-model="newContact.type" interface="popover" mode="md" class="contact-type" placeholder="Тип">
              <ion-select-option v-for="[v, l] in contactTypeOptions" :key="v" :value="v">{{ l }}</ion-select-option>
            </ion-select>
            <ion-input v-model="newContact.value" mode="md" class="contact-value" placeholder="Новый контакт" />
            <ion-button size="small" :disabled="!newContact.type || !newContact.value" @click="addContact">
              <ion-icon slot="icon-only" :icon="addOutline" />
            </ion-button>
          </div>
        </section>
      </template>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonInput, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption, IonToggle,
  toastController,
} from '@ionic/vue'
import { arrowBackOutline, trashOutline, addOutline, checkmarkOutline } from 'ionicons/icons'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import SearchPicker from '@/components/admin/SearchPicker.vue'
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

const route = useRoute()
const router = useRouter()
const personId = route.params.id as string

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
const profileExists = ref(false)
const studentExists = ref(false)
const diets = ref<DietRead[]>([])

interface ContactRow { id: string; type: string; value: string; is_main: boolean }
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

function goBack() { router.replace('/admin/persons') }

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
    await patchPersonProfileV1PersonsPersonIdPatch(personId, {
      surname: person.surname, name: person.name, patronymic: person.patronymic || null,
    })
    toast('Персона сохранена')
  } catch (err) { showError(err, 'Не удалось сохранить персону') } finally { savingPerson.value = false }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const body = { birthdate: profile.birthdate || null, workplace_id: profile.workplace_id || null, diet_id: profile.diet_id ?? null }
    if (profileExists.value) {
      await patchProfileProfileV1ProfilesProfileIdPatch(personId, body)
    } else {
      await createProfileProfileV1ProfilesPost({ id: personId, ...body } as any)
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
      await patchStudentProfileV1StudentsStudentIdPatch(personId, body as any)
    } else {
      await createStudentProfileV1StudentsPost({ id: personId, ...body } as any)
      studentExists.value = true
    }
    toast('Студенческая карточка сохранена')
  } catch (err) { showError(err, 'Не удалось сохранить студента') } finally { savingStudent.value = false }
}

async function saveContact(c: ContactRow) {
  try {
    await patchContactProfileV1ContactsIdPatch(c.id, { type: c.type as any, value: c.value, is_main: c.is_main })
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
    contacts.value = res.data.items.map((c: any) => ({ id: c.id, type: c.type, value: c.value, is_main: !!c.is_main }))
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
    diets.value = dietsRes?.data.items ?? []

    try {
      const p = (await getProfileProfileV1ProfilesProfileIdGet(personId)).data
      profileExists.value = true
      profile.birthdate = p.birthdate ?? ''
      profile.workplace_id = p.workplace_id ?? null
      profile.diet_id = p.diet_id ?? null
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
  font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit;
}
.dossier-name { margin: 0 0 14px; font-size: 20px; font-weight: 700; }
.state-box { display: flex; justify-content: center; padding: 60px 0; }
.tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
.tab {
  padding: 8px 16px; border: 1.5px solid var(--ion-border-color); border-radius: 999px;
  background: transparent; font-weight: 600; font-size: 13px; color: var(--ion-color-medium);
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.tab--active { border-color: var(--ion-color-primary); color: var(--ion-color-primary); background: rgba(108, 99, 255, 0.08); }
.card {
  display: flex; flex-direction: column; gap: 14px; padding: 18px;
  background: var(--ion-card-background); border-radius: 16px; box-shadow: var(--ion-card-shadow);
}
.field { display: flex; flex-direction: column; gap: 4px; }
.field--row { flex-direction: row; align-items: center; justify-content: space-between; }
.field > label { font-size: 13px; font-weight: 600; color: var(--ion-text-color); }
.native-input {
  width: 100%; padding: 10px 12px; border: 1.5px solid var(--ion-border-color);
  border-radius: 10px; background: var(--ion-background-color); color: var(--ion-text-color);
  font-family: inherit; font-size: 14px;
}
.hint { margin: 0; font-size: 13px; color: var(--ion-color-medium); }
.hint--warn { color: var(--ion-color-warning, #d9822b); }
.contact-row { display: flex; align-items: center; gap: 8px; }
.contact-type { min-width: 110px; }
.contact-value { flex: 1; }
.chip-toggle {
  width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid var(--ion-border-color);
  background: transparent; color: var(--ion-color-medium); cursor: pointer; font-size: 16px;
}
.chip-toggle--on { border-color: var(--ion-color-warning, #f0b429); color: var(--ion-color-warning, #f0b429); }
.icon-btn {
  display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;
  border: none; border-radius: 8px; background: transparent; color: var(--ion-color-medium);
  font-size: 18px; cursor: pointer;
}
.icon-btn--danger:hover { color: var(--ion-color-danger); }
</style>
