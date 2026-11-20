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

        <PageState v-else-if="myProfile.failed" text="Не удалось загрузить подробную информацию">
          <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="start">Повторить</button>
        </PageState>

        <template v-else>
          <SlidingTabs
            v-if="editing"
            class="pf-tabs"
            :tabs="tabs"
            :model-value="section"
            :shake="shaking"
            @update:model-value="goTo($event as SectionKey)"
          />

          <div ref="sectionsEl" class="pf-sections">
            <section v-show="shown('about')" class="ui-card pf-card" :class="sectionMotion">
              <div v-if="!editing" class="ui-card-head">
                <h3 class="ui-card-title">
                  О вас
                  <HelpTip text="Эти данные видят руководители ваших коллективов. Позже всё можно изменить." />
                </h3>
              </div>
              <div :class="fieldClass('surname')">
                <UiInput v-model="form.surname" label="Фамилия" autocomplete="family-name" :maxlength="128" :error="errors.surname" />
              </div>
              <div :class="fieldClass('name')">
                <UiInput v-model="form.name" label="Имя" autocomplete="given-name" :maxlength="128" :error="errors.name" />
              </div>
              <div :class="fieldClass('patronymic')">
                <UiInput v-model="form.patronymic" label="Отчество" autocomplete="additional-name" :maxlength="128" />
              </div>
              <div :class="[fieldClass('birthdate'), attentionClass('profile.birthdate')]">
                <DateTimeField v-model="form.birthdate" mode="date" label="Дата рождения" />
              </div>
            </section>

            <section v-show="shown('study')" class="ui-card pf-card" :class="sectionMotion">
              <div v-if="!editing" class="ui-card-head"><h3 class="ui-card-title">Учёба</h3></div>
              <div :class="fieldClass('isStudent')">
                <label class="ui-toggle-row"><span>Я студент</span><ion-toggle v-model="form.isStudent" /></label>
              </div>
              <template v-if="form.isStudent">
                <div :class="fieldClass('studentId')">
                  <UiInput v-model="form.studentId" label="Студенческий билет" :maxlength="64" :error="errors.studentId" />
                </div>
                <div :class="fieldClass('group')">
                  <SearchPicker
                    v-model="form.university.id"
                    v-model:draft="form.university.draft"
                    label="Университет"
                    resource="organization"
                    :fetch="searchUniversities"
                    :locked="universityLocked"
                    :hint="universityLocked ? 'Берётся из факультета' : undefined"
                    creatable
                    browse
                  />
                  <p v-if="errors.university" class="pf-error">{{ errors.university }}</p>
                </div>
                <div :class="fieldClass('group')">
                  <SearchPicker
                    :model-value="form.faculty.id"
                    v-model:draft="form.faculty.draft"
                    label="Факультет"
                    resource="organization"
                    :fetch="searchFaculties"
                    :locked="groupLocked"
                    :hint="groupLocked ? 'Берётся из группы' : undefined"
                    creatable
                    browse
                    @update:model-value="onFaculty"
                  />
                  <p v-if="errors.faculty" class="pf-error">{{ errors.faculty }}</p>
                </div>
                <div :class="fieldClass('group')">
                  <SearchPicker
                    :model-value="form.group.id"
                    v-model:draft="form.group.draft"
                    label="Группа"
                    help="Если группа уже есть в списке, университет, факультет, степень и курс подставятся сами. Если нет, впишите её название: группа добавится при сохранении."
                    resource="group"
                    numeric
                    :fetch="searchGroups"
                    creatable
                    browse
                    @update:model-value="onGroup"
                  />
                  <p v-if="errors.group" class="pf-error">{{ errors.group }}</p>
                </div>
                <div :class="fieldClass('group')">
                  <SearchPicker
                    v-model="form.degree.id"
                    v-model:draft="form.degree.draft"
                    label="Степень"
                    numeric
                    :fetch="searchDegrees"
                    :locked="groupLocked"
                    :hint="groupLocked ? 'Берётся из группы' : undefined"
                    :creatable="auth.isSuperuser"
                    browse
                  />
                  <p v-if="errors.degree" class="pf-error">{{ errors.degree }}</p>
                </div>
                <div :class="fieldClass('group')">
                  <UiInput
                    v-model="form.grade"
                    label="Курс"
                    type="number"
                    inputmode="numeric"
                    :disabled="groupLocked"
                    :hint="groupLocked ? 'Берётся из группы' : undefined"
                    :error="errors.grade"
                  />
                </div>
                <div :class="fieldClass('isBudget')">
                  <label class="ui-toggle-row"><span>Бюджет</span><ion-toggle v-model="form.isBudget" /></label>
                </div>
                <div :class="fieldClass('isFull')">
                  <label class="ui-toggle-row"><span>Очная форма</span><ion-toggle v-model="form.isFull" /></label>
                </div>
              </template>
            </section>

            <section v-show="shown('extra')" class="ui-card pf-card" :class="sectionMotion">
              <div v-if="!editing" class="ui-card-head"><h3 class="ui-card-title">Дополнительно</h3></div>
              <div :class="fieldClass('workplace')">
                <SearchPicker
                  v-model="form.workplace.id"
                  v-model:draft="form.workplace.draft"
                  label="Место работы"
                  resource="organization"
                  :fetch="searchOrganizations"
                  creatable
                />
              </div>
              <div :class="fieldClass('diet')">
                <SearchPicker
                  v-model="form.diet.id"
                  v-model:draft="form.diet.draft"
                  label="Диета"
                  numeric
                  :fetch="searchDiets"
                  creatable
                  browse
                />
              </div>
            </section>

            <section v-show="shown('contacts')" class="ui-card pf-card" :class="sectionMotion">
              <div v-if="!editing" class="ui-card-head"><h3 class="ui-card-title">Контакты</h3></div>
              <div :class="[{ 'pf-field--changed': editing && counts.contacts > 0 }, sectionAttention('contacts')]">
                <ContactsEditor v-model="form.contacts" :account-email="auth.user?.email" :errors="contactErrors" />
              </div>
            </section>

            <section v-show="shown('passport')" class="ui-card pf-card" :class="sectionMotion">
              <div v-if="!editing" class="ui-card-head">
                <h3 class="ui-card-title">
                  Паспорт
                  <HelpTip text="Паспорт хранится зашифрованным. Руководитель коллектива видит его, только если вы согласились на политику доступа к данным; каждый просмотр попадает в журнал." />
                </h3>
              </div>
              <div
                v-for="(row, index) in form.passports"
                :key="row.key"
                class="pf-passport"
                :class="[{ 'pf-field--changed': editing && passportChanged(row) }, sectionAttention('passport')]"
              >
                <div class="pf-passport-head">
                  <h4 class="ui-field-title">{{ index === 0 ? 'Паспорт' : `Паспорт ${index + 1}` }}</h4>
                  <button type="button" class="ui-icon-btn ui-icon-btn--delete" aria-label="Удалить паспорт" @click="removePassport(row.key)">
                    <ion-icon :icon="trashOutline" />
                  </button>
                </div>
                <UiInput v-model="row.number" label="Серия и номер" :maxlength="32" :error="passportErrors[row.key]?.number" />
                <DateTimeField v-model="row.issuedDate" mode="date" label="Дата выдачи" />
                <UiInput v-model="row.issuedAuthority" label="Кем выдан" :maxlength="512" />
                <DateTimeField v-model="row.expireDate" mode="date" label="Действителен до" />
                <label class="ui-toggle-row"><span>Заграничный</span><ion-toggle v-model="row.isForeign" /></label>
                <label class="ui-toggle-row"><span>ФИО в паспорте другое</span><ion-toggle v-model="row.hasVariant" /></label>
                <template v-if="row.hasVariant">
                  <UiInput v-model="row.variant.surname" label="Фамилия в паспорте" :maxlength="128" :error="passportErrors[row.key]?.surname" />
                  <UiInput v-model="row.variant.name" label="Имя в паспорте" :maxlength="128" :error="passportErrors[row.key]?.name" />
                  <UiInput v-model="row.variant.patronymic" label="Отчество в паспорте" :maxlength="128" />
                </template>
              </div>
              <button
                v-if="form.passports.length < MAX_PASSPORTS"
                type="button"
                class="ui-btn ui-btn--ghost ui-btn--sm pf-add"
                @click="addPassport"
              >
                <ion-icon :icon="addOutline" />
                Добавить паспорт
              </button>
            </section>
          </div>

          <p v-if="error" class="pf-error">{{ error }}</p>

          <button type="button" class="ui-btn ui-btn--primary pf-save" :disabled="saving || (editing && !total)" @click="submit">
            {{ saveLabel }}
          </button>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { addOutline, trashOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonIcon, IonSpinner, IonToggle, onIonViewWillEnter,
} from '@ionic/vue'
import {
  getFacultyOrgV1FacultiesFacultyIdGet,
  getManyProfileV1DietsGet,
  getStudentDegreesProfileV1StudentsDegreesGet,
  getStudentGroupsProfileV1StudentsGroupsGet,
  listFacultiesOrgV1FacultiesGet,
  listOrganizationsOrgV1OrganizationsGet,
  listUniversitiesOrgV1UniversitiesGet,
  resolveDietProfileV2DietsPost,
  resolveFacultyProfileV2FacultiesPost,
  resolveOrganizationProfileV2OrganizationsPost,
  resolveStudentDegreeProfileV2StudentDegreesPost,
  resolveStudentGroupProfileV2StudentGroupsPost,
  resolveUniversityProfileV2UniversitiesPost,
} from '@/api/generated/almaEventFlow'
import type { ContactType, MyPassportData, MyProfileReadV3, MyProfileWriteV3 } from '@/api/generated/almaEventFlow'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import BackLink from '@/components/common/BackLink.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import HelpTip from '@/components/common/HelpTip.vue'
import PageState from '@/components/common/PageState.vue'
import SlidingTabs from '@/components/common/SlidingTabs.vue'
import UiInput from '@/components/common/UiInput.vue'
import ContactsEditor, { type ContactRow } from '@/components/profile/ContactsEditor.vue'
import { usePlatform } from '@/composables/usePlatform'
import { useSwipe } from '@/composables/useSwipe'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useMyProfileStore } from '@/stores/myProfile'
import { useTodoStore } from '@/stores/todo'
import { contactError, normalizeContact } from '@/utils/contactTypes'
import { quickStartRoute } from '@/utils/quickStart'
import {
  SECTIONS, groupSignature, sectionCounts, sectionOfField, snapshot, changedFields,
  type FieldKey, type FormSnapshot, type PassportRow, type SectionKey,
} from '@/utils/profileFormDiff'

interface Choice<T> { id: T | null; draft: string | null }

const pick = <T,>(id: T | null = null): Choice<T> => ({ id, draft: null })
const MAX_GRADE = 12
const MAX_PASSPORTS = 5

interface PassportFormRow extends PassportRow { key: number }
interface PassportErrors { number?: string; surname?: string; name?: string }
const SHAKE_MS = 600

const router = useRouter()
const auth = useAuthStore()
const myProfile = useMyProfileStore()
const todo = useTodoStore()
const { isDesktop } = usePlatform()
const { showError, showSuccess } = useToast()

const ready = ref(false)
const saving = ref(false)
const editing = ref(false)
const error = ref('')
let nextKey = 0
const originalContacts = new Map<string, string>()

const form = reactive({
  surname: '', name: '', patronymic: '', birthdate: null as string | null,
  isStudent: false, studentId: '', isBudget: false, isFull: false, isActive: true,
  university: pick<string>(), faculty: pick<string>(), group: pick<number>(), degree: pick<number>(),
  grade: '',
  workplace: pick<string>(), diet: pick<number>(),
  contacts: [] as ContactRow[],
  passports: [] as PassportFormRow[],
})
const passportErrors = ref<Record<number, PassportErrors>>({})
const errors = reactive({
  surname: '', name: '', studentId: '', university: '', faculty: '', group: '', degree: '', grade: '',
})
const contactErrors = ref<Record<number, string>>({})

const section = ref<SectionKey>('about')
const direction = ref<'next' | 'prev'>('next')
const shaking = ref<string[]>([])
const sectionsEl = ref<HTMLElement | null>(null)
const baseline = ref<FormSnapshot>(snapshot(form))
let attempted = false
let shakeTimer: ReturnType<typeof setTimeout> | undefined

const title = 'Подробная информация'
const groupLocked = computed(() => form.group.id != null)
const universityLocked = computed(() => form.faculty.id != null && form.university.id != null)

const changed = computed(() => (editing.value ? changedFields(baseline.value, form) : new Set<FieldKey>()))
const counts = computed(() => sectionCounts(baseline.value, form))
const total = computed(() => Object.values(counts.value).reduce((sum, count) => sum + count, 0))
const saveLabel = computed(() => {
  if (!editing.value) return 'Сохранить'
  return total.value ? `Сохранить изменения (${total.value})` : 'Нет изменений'
})

const invalidSections = computed(() => {
  const found = new Set<SectionKey>()
  if (errors.surname || errors.name) found.add('about')
  if (errors.studentId || errors.university || errors.faculty || errors.group || errors.degree || errors.grade) found.add('study')
  if (Object.keys(contactErrors.value).length) found.add('contacts')
  if (Object.keys(passportErrors.value).length) found.add('passport')
  return found
})

const attentionSections = computed(() => {
  const found = new Set<SectionKey>()
  for (const key of todo.missingFields) {
    const section = sectionOfField(key)
    if (section) found.add(section)
  }
  return found
})
const sectionAttention = (key: SectionKey) => ({ 'ui-attention pf-attention': attentionSections.value.has(key) })
const attentionClass = (fieldKey: string) => ({ 'ui-attention pf-attention': todo.missingFields.has(fieldKey) })

const tabs = computed(() =>
  SECTIONS.map((item) => ({
    key: item.key,
    label: item.label,
    badge: counts.value[item.key] || undefined,
    invalid: invalidSections.value.has(item.key),
    attention: attentionSections.value.has(item.key),
  })),
)

const sectionMotion = computed(() => (editing.value ? `pf-section--${direction.value}` : ''))
const shown = (key: SectionKey) => !editing.value || section.value === key
const fieldClass = (key: FieldKey) => ({ 'pf-field--changed': changed.value.has(key) })

function goTo(next: SectionKey) {
  const order = SECTIONS.map((item) => item.key)
  direction.value = order.indexOf(next) >= order.indexOf(section.value) ? 'next' : 'prev'
  section.value = next
}

function step(delta: number) {
  const order = SECTIONS.map((item) => item.key)
  const target = order[order.indexOf(section.value) + delta]
  if (target) goTo(target)
}

useSwipe(sectionsEl, {
  onLeft: () => step(1),
  onRight: () => step(-1),
  enabled: () => editing.value && !isDesktop.value,
})

async function universityOf(facultyId: string): Promise<string | null> {
  try {
    return (await getFacultyOrgV1FacultiesFacultyIdGet(facultyId)).data.university_id ?? null
  } catch {
    return null
  }
}

function adoptUniversity(facultyId: string) {
  void universityOf(facultyId).then((id) => {
    if (form.faculty.id !== facultyId) return
    form.university = pick(id)
    baseline.value = { ...baseline.value, fields: { ...baseline.value.fields, group: groupSignature(form) } }
  })
}

function passportRow(passport?: NonNullable<MyProfileReadV3['passports']>[number]): PassportFormRow {
  const variant = passport?.name_variant
  return {
    key: nextKey++,
    id: passport?.id,
    number: passport?.number ?? '',
    expireDate: passport?.expire_date ?? null,
    issuedDate: passport?.issued_date ?? null,
    issuedAuthority: passport?.issued_authority ?? '',
    isForeign: passport?.is_foreign ?? false,
    hasVariant: !!variant,
    variant: { surname: variant?.surname ?? '', name: variant?.name ?? '', patronymic: variant?.patronymic ?? '' },
  }
}

function addPassport() {
  form.passports.push(passportRow())
}

function removePassport(key: number) {
  form.passports = form.passports.filter((row) => row.key !== key)
}

function passportChanged(row: PassportFormRow): boolean {
  if (!row.id) return true
  const before = baseline.value.passports.get(row.id)
  return before !== snapshot({ ...form, passports: [row] }).passports.get(row.id)
}

function fill(profile: MyProfileReadV3 | null) {
  const student = profile?.student
  form.surname = profile?.surname ?? ''
  form.name = profile?.name ?? ''
  form.patronymic = profile?.patronymic ?? ''
  form.birthdate = profile?.birthdate ?? null
  form.workplace = pick(profile?.workplace_id ?? null)
  form.diet = pick(profile?.diet_id ?? null)
  form.isStudent = !!student
  form.studentId = student?.student_id ?? ''
  form.isBudget = student?.is_budget ?? false
  form.isFull = student?.is_full ?? false
  form.isActive = student?.is_active ?? true
  form.group = pick(student?.group_id ?? null)
  form.degree = pick(student?.group?.degree_id ?? null)
  form.grade = student?.group?.grade != null ? String(student.group.grade) : ''
  form.faculty = pick(student?.group?.faculty_id ?? student?.faculty_id ?? null)
  form.university = pick<string>()
  originalContacts.clear()
  for (const contact of profile?.contacts ?? []) originalContacts.set(contact.id, contact.value)
  form.contacts = (profile?.contacts ?? []).map((c) => ({
    key: nextKey++, id: c.id, type: c.type, value: c.value, is_main: !!c.is_main,
  }))
  form.passports = (profile?.passports ?? []).map((p) => passportRow(p))
  passportErrors.value = {}
  error.value = ''
  attempted = false
  Object.keys(errors).forEach((key) => { errors[key as keyof typeof errors] = '' })
  contactErrors.value = {}
  baseline.value = snapshot(form)
  if (form.faculty.id) adoptUniversity(form.faculty.id)
}

async function items<T>(request: Promise<{ data: { items: T[] } }>): Promise<T[]> {
  return (await request).data.items
}

const searchUniversities = (search: string) => items(listUniversitiesOrgV1UniversitiesGet({ search, limit: 20 }))
const searchOrganizations = (search: string) => items(listOrganizationsOrgV1OrganizationsGet({ search, limit: 20 }))
const searchDiets = (search: string) => items(getManyProfileV1DietsGet({ search, limit: 20 }))
const searchDegrees = (search: string) => items(getStudentDegreesProfileV1StudentsDegreesGet({ search, limit: 20 }))
const searchFaculties = (search: string) =>
  items(listFacultiesOrgV1FacultiesGet({ search, limit: 20, university_id: form.university.id ?? undefined }))
const searchGroups = (search: string) =>
  items(getStudentGroupsProfileV1StudentsGroupsGet({ search, limit: 20, faculty_id: form.faculty.id ?? undefined }))

function onFaculty(value: string | number | null, raw?: { university_id?: string | null }) {
  form.faculty.id = value as string | null
  if (raw) form.university = pick(raw.university_id ?? null)
}

function onGroup(
  value: string | number | null,
  raw?: { degree_id: number; faculty_id: string; grade: number },
) {
  form.group.id = value as number | null
  if (!raw) return
  form.degree = pick(raw.degree_id)
  form.grade = String(raw.grade)
  form.faculty = pick(raw.faculty_id)
  form.university = pick<string>()
  const facultyId = raw.faculty_id
  void universityOf(facultyId).then((id) => { if (form.faculty.id === facultyId) form.university = pick(id) })
}

function edited(row: ContactRow): boolean {
  return !row.id || originalContacts.get(row.id) !== row.value
}

function validate(): boolean {
  Object.keys(errors).forEach((key) => { errors[key as keyof typeof errors] = '' })
  errors.surname = form.surname.trim() ? '' : 'Укажите фамилию'
  errors.name = form.name.trim() ? '' : 'Укажите имя'
  if (form.isStudent) {
    const named = (value: Choice<unknown>) => value.id != null || !!value.draft
    if (!form.studentId.trim()) errors.studentId = 'Укажите номер студенческого билета'
    if (!named(form.group)) errors.group = 'Укажите группу'
    if (form.group.id == null && named(form.group)) {
      if (!named(form.faculty)) errors.faculty = 'Укажите факультет'
      else if (form.faculty.id == null && !named(form.university)) errors.university = 'Укажите университет'
      if (!named(form.degree)) errors.degree = 'Укажите степень'
      const grade = Number(form.grade)
      if (!Number.isInteger(grade) || grade < 1 || grade > MAX_GRADE) errors.grade = `Курс от 1 до ${MAX_GRADE}`
    }
  }
  const found: Record<number, string> = {}
  for (const row of form.contacts) {
    const message = edited(row) ? contactError(row.type, row.value) : null
    if (message) found[row.key] = message
  }
  contactErrors.value = found
  const passports: Record<number, PassportErrors> = {}
  for (const row of form.passports) {
    const problems: PassportErrors = {}
    if (!row.number.trim()) problems.number = 'Укажите серию и номер'
    if (row.hasVariant && !row.variant.surname.trim()) problems.surname = 'Укажите фамилию'
    if (row.hasVariant && !row.variant.name.trim()) problems.name = 'Укажите имя'
    if (Object.keys(problems).length) passports[row.key] = problems
  }
  passportErrors.value = passports
  return !Object.values(errors).some(Boolean) && !Object.keys(found).length && !Object.keys(passports).length
}

watch(form, () => { if (attempted) validate() }, { deep: true })

function flagInvalid() {
  attempted = true
  const first = SECTIONS.find((item) => invalidSections.value.has(item.key))
  if (!editing.value || !first) return
  if (!invalidSections.value.has(section.value)) goTo(first.key)
  shaking.value = [...invalidSections.value]
  clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => { shaking.value = [] }, SHAKE_MS)
}

interface Resolved { workplaceId: string | null; dietId: number | null; groupId: number | null; facultyId: string | null }

async function resolveReferences(): Promise<Resolved> {
  if (!form.workplace.id && form.workplace.draft) {
    form.workplace = pick((await resolveOrganizationProfileV2OrganizationsPost({ name: form.workplace.draft })).data.id)
  }
  if (!form.diet.id && form.diet.draft) {
    form.diet = pick((await resolveDietProfileV2DietsPost({ name: form.diet.draft })).data.id)
  }
  if (form.isStudent && form.group.id == null && form.group.draft) {
    if (!form.faculty.id && form.faculty.draft) {
      if (!form.university.id && form.university.draft) {
        form.university = pick((await resolveUniversityProfileV2UniversitiesPost({ name: form.university.draft })).data.id)
      }
      form.faculty = pick((await resolveFacultyProfileV2FacultiesPost({
        name: form.faculty.draft, university_id: form.university.id as string,
      })).data.id)
    }
    if (!form.degree.id && form.degree.draft) {
      form.degree = pick((await resolveStudentDegreeProfileV2StudentDegreesPost({ name: form.degree.draft })).data.id)
    }
    form.group = pick((await resolveStudentGroupProfileV2StudentGroupsPost({
      name: form.group.draft, degree_id: form.degree.id as number,
      faculty_id: form.faculty.id as string, grade: Number(form.grade),
    })).data.id)
  }
  return { workplaceId: form.workplace.id, dietId: form.diet.id, groupId: form.group.id, facultyId: form.faculty.id }
}

function passportPayload(row: PassportFormRow): MyPassportData {
  return {
    id: row.id,
    number: row.number.trim(),
    expire_date: row.expireDate || null,
    is_foreign: row.isForeign,
    issued_date: row.issuedDate || null,
    issued_authority: row.issuedAuthority.trim() || null,
    name_variant: row.hasVariant
      ? {
          surname: row.variant.surname.trim(),
          name: row.variant.name.trim(),
          patronymic: row.variant.patronymic.trim() || null,
        }
      : null,
  }
}

function payload(refs: Resolved): MyProfileWriteV3 {
  return {
    surname: form.surname.trim(),
    name: form.name.trim(),
    patronymic: form.patronymic.trim() || null,
    birthdate: form.birthdate || null,
    workplace_id: refs.workplaceId,
    diet_id: refs.dietId,
    student: form.isStudent && refs.groupId != null
      ? {
          student_id: form.studentId.trim(), group_id: refs.groupId, faculty_id: refs.facultyId,
          is_budget: form.isBudget, is_full: form.isFull, is_active: form.isActive,
        }
      : null,
    contacts: form.contacts.map((c) => ({
      id: c.id,
      type: c.type as ContactType,
      value: edited(c) ? normalizeContact(c.type, c.value) : c.value,
      is_main: c.is_main,
    })),
    passports: form.passports.map(passportPayload),
  }
}

async function submit() {
  error.value = ''
  if (!validate()) {
    flagInvalid()
    return
  }
  const wasEditing = editing.value
  let personId = ''
  saving.value = true
  try {
    personId = (await myProfile.save(payload(await resolveReferences()))).id
  } catch (err) {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    if (detail === 'PROFILE_ALREADY_EXISTS') {
      await myProfile.load(true)
      editing.value = true
      fill(myProfile.profile)
      error.value = 'Подробная информация уже заполнена, возможно на другом устройстве. Проверьте данные и сохраните их.'
    } else if (detail === 'ACCOUNT_LINK_OUT_OF_SYNC') {
      error.value = 'Не удалось сохранить подробную информацию: с аккаунтом связаны старые данные. Обратитесь к администратору.'
    } else {
      showError(err, 'Не удалось сохранить подробную информацию')
    }
    return
  } finally {
    saving.value = false
  }
  if (!wasEditing) await auth.refreshWhenLinked(personId)
  void todo.refresh(true)
  showSuccess(wasEditing ? 'Изменения сохранены' : 'Подробная информация сохранена')
  router.push((!wasEditing && (await quickStartRoute(auth))) || '/profile')
}

async function start() {
  ready.value = false
  await myProfile.load(true)
  editing.value = !!myProfile.profile
  section.value = 'about'
  fill(myProfile.profile)
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

.pf-sections {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pf-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pf-card .ui-card-head {
  margin-bottom: 0;
}

.pf-field--changed {
  position: relative;
}

.pf-field--changed::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: -10px;
  width: 3px;
  border-radius: var(--radius-pill);
  background: var(--ion-color-primary);
}

.pf-section--next {
  animation: pf-from-right 0.22s ease-out;
}

.pf-section--prev {
  animation: pf-from-left 0.22s ease-out;
}

@keyframes pf-from-right {
  from { opacity: 0; transform: translateX(24px); }
}

@keyframes pf-from-left {
  from { opacity: 0; transform: translateX(-24px); }
}

@media (prefers-reduced-motion: reduce) {
  .pf-section--next,
  .pf-section--prev {
    animation: none;
  }
}

.pf-attention {
  border-radius: var(--radius-md);
}

.pf-passport {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pf-passport + .pf-passport {
  padding-top: 14px;
  border-top: var(--border-w) solid var(--ion-border-color);
}

.pf-passport-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
