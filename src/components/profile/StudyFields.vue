<template>
  <div :class="mark('isStudent')">
    <label class="ui-toggle-row ui-toggle-row--field"><span>Я студент</span><ion-toggle v-model="form.isStudent" /></label>
  </div>
  <template v-if="form.isStudent">
    <div :class="mark('studentId')">
      <UiInput v-model="form.studentId" label="Студенческий билет" :maxlength="64" :error="errors.studentId" />
    </div>
    <div :class="mark('group')">
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
      <p v-if="errors.university" class="sf-error">{{ errors.university }}</p>
    </div>
    <div :class="mark('group')">
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
      <p v-if="errors.faculty" class="sf-error">{{ errors.faculty }}</p>
    </div>
    <div :class="mark('group')">
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
      <p v-if="errors.group" class="sf-error">{{ errors.group }}</p>
    </div>
    <div :class="mark('group')">
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
      <p v-if="errors.degree" class="sf-error">{{ errors.degree }}</p>
    </div>
    <div :class="mark('group')">
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
    <div :class="mark('isBudget')">
      <label class="ui-toggle-row ui-toggle-row--field"><span>Бюджет</span><ion-toggle v-model="form.isBudget" /></label>
    </div>
    <div :class="mark('isFull')">
      <label class="ui-toggle-row ui-toggle-row--field"><span>Очная форма</span><ion-toggle v-model="form.isFull" /></label>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonToggle } from '@ionic/vue'
import {
  getFacultyOrgV1FacultiesFacultyIdGet,
  getStudentDegreesProfileV1StudentsDegreesGet,
  getStudentGroupsProfileV1StudentsGroupsGet,
  listFacultiesOrgV1FacultiesGet,
  listUniversitiesOrgV1UniversitiesGet,
} from '@/api/generated/almaEventFlow'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import UiInput from '@/components/common/UiInput.vue'
import { useAuthStore } from '@/stores/auth'
import { pick, type StudyErrors, type StudyForm } from '@/utils/studyForm'

export type StudyMarkKey = 'isStudent' | 'studentId' | 'group' | 'isBudget' | 'isFull'

const form = defineModel<StudyForm>({ required: true })
const props = withDefaults(
  defineProps<{
    errors?: StudyErrors
    /** Классы поля: форма подробной информации отмечает так изменённые */
    markClass?: (key: StudyMarkKey) => Record<string, boolean>
  }>(),
  { errors: () => ({}), markClass: undefined },
)

const auth = useAuthStore()

const groupLocked = computed(() => form.value.group.id != null)
const universityLocked = computed(() => form.value.faculty.id != null && form.value.university.id != null)

const mark = (key: StudyMarkKey) => props.markClass?.(key)

async function items<T>(request: Promise<{ data: { items: T[] } }>): Promise<T[]> {
  return (await request).data.items
}

const searchUniversities = (search: string) => items(listUniversitiesOrgV1UniversitiesGet({ search, limit: 20 }))
const searchDegrees = (search: string) => items(getStudentDegreesProfileV1StudentsDegreesGet({ search, limit: 20 }))
const searchFaculties = (search: string) =>
  items(listFacultiesOrgV1FacultiesGet({ search, limit: 20, university_id: form.value.university.id ?? undefined }))
const searchGroups = (search: string) =>
  items(getStudentGroupsProfileV1StudentsGroupsGet({ search, limit: 20, faculty_id: form.value.faculty.id ?? undefined }))

async function universityOf(facultyId: string): Promise<string | null> {
  try {
    return (await getFacultyOrgV1FacultiesFacultyIdGet(facultyId)).data.university_id ?? null
  } catch {
    return null
  }
}

function onFaculty(value: string | number | null, raw?: { university_id?: string | null }) {
  form.value.faculty.id = value as string | null
  if (raw) form.value.university = pick(raw.university_id ?? null)
}

function onGroup(value: string | number | null, raw?: { degree_id: number; faculty_id: string; grade: number }) {
  form.value.group.id = value as number | null
  if (!raw) return
  form.value.degree = pick(raw.degree_id)
  form.value.grade = String(raw.grade)
  form.value.faculty = pick(raw.faculty_id)
  form.value.university = pick<string>()
  const facultyId = raw.faculty_id
  void universityOf(facultyId).then((id) => { if (form.value.faculty.id === facultyId) form.value.university = pick(id) })
}

</script>

<style scoped>
.sf-error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-danger);
}
</style>
