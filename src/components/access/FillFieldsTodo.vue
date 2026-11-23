<template>
  <div class="ui-card ff-card">
    <div class="ui-card-head">
      <h3 class="ui-card-title">{{ item.collective_name }}</h3>
    </div>
    <div class="ui-chips">
      <span v-for="field in fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
    </div>

    <div v-if="!myProfile.loaded && !myProfile.failed" class="ff-state"><ion-spinner name="crescent" /></div>
    <template v-else>
      <template v-for="key in inline" :key="key">
        <UiField v-if="absent[key]" :label="labelOf(key)" float>
          <span class="ui-field-value">Нет</span>
          <template #suffix>
            <button type="button" class="ui-icon-btn" aria-label="Указать" @click="absent[key] = false">
              <ion-icon :icon="closeOutline" />
            </button>
          </template>
        </UiField>
        <DateTimeField
          v-else-if="DATES.has(key)"
          v-model="dates[key]"
          mode="date"
          :label="labelOf(key)"
          :error="errors[key]"
        />
        <UiInput
          v-else
          v-model="values[key]"
          :label="labelOf(key)"
          :maxlength="key === 'passport.issued_authority' ? 512 : 256"
          :error="errors[key]"
        >
          <template v-if="isOptional(key)" #suffix>
            <button type="button" class="ui-chip" @click="absent[key] = true">Нет</button>
          </template>
        </UiInput>
      </template>

      <template v-if="asks(DIET)">
        <UiField v-if="absent[DIET]" :label="labelOf(DIET)" float>
          <span class="ui-field-value">Нет</span>
          <template #suffix>
            <button type="button" class="ui-icon-btn" aria-label="Указать" @click="absent[DIET] = false">
              <ion-icon :icon="closeOutline" />
            </button>
          </template>
        </UiField>
        <SearchPicker
          v-else
          v-model="diet.id"
          v-model:draft="diet.draft"
          :label="labelOf(DIET)"
          numeric
          :fetch="searchDiets"
          creatable
          browse
        >
          <template #suffix>
            <button type="button" class="ui-chip" @click="absent[DIET] = true">Нет</button>
          </template>
        </SearchPicker>
      </template>

      <template v-if="variantAsked">
        <label class="ui-toggle-row ui-toggle-row--field"><span>ФИО в паспорте другое</span><ion-toggle v-model="variant.on" /></label>
        <template v-if="variant.on">
          <UiInput v-model="variant.surname" label="Фамилия в паспорте" :maxlength="128" :error="errors.variantSurname" />
          <UiInput v-model="variant.name" label="Имя в паспорте" :maxlength="128" :error="errors.variantName" />
          <UiInput v-model="variant.patronymic" label="Отчество в паспорте" :maxlength="128" />
        </template>
      </template>

      <StudyFields v-if="studentKeys.length" :model-value="study" :errors="studyErrorsShown" />

      <p v-if="error" class="ff-error">{{ error }}</p>
      <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="saving" @click="save">
        <ion-spinner v-if="saving" name="crescent" />
        Сохранить
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { IonIcon, IonSpinner, IonToggle } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import {
  declareMyAbsentFieldsProfileV3ProfilesMyAbsentFieldsPost,
  getManyProfileV1DietsGet,
  resolveDietProfileV2DietsPost,
} from '@/api/generated/almaEventFlow'
import type { ContactType, FillFieldsTodo, MyProfileWriteV3, TodoItem } from '@/api/generated/almaEventFlow'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import UiField from '@/components/common/UiField.vue'
import UiInput from '@/components/common/UiInput.vue'
import StudyFields from '@/components/profile/StudyFields.vue'
import { useToast } from '@/composables/useToast'
import { useMyProfileStore } from '@/stores/myProfile'
import { contactError } from '@/utils/contactTypes'
import { INLINE_FIELDS, passportKeys, profileWrite, withNameVariant, withValues } from '@/utils/profileWrite'
import { emptyStudy, pick, resolveStudy, studentWrite, studyErrors, type StudyErrors } from '@/utils/studyForm'

const props = defineProps<{ item: TodoItem }>()
const emit = defineEmits<{ done: [id: string] }>()

const DIET = 'profile.diet'
const VARIANT = 'name_variant.fullname'
const DATES = new Set(['profile.birthdate', 'passport.expire_date', 'passport.issued_date'])
const LABELS: Record<string, string> = {
  'passport.number': 'Номер паспорта',
  'passport.expire_date': 'Срок действия паспорта',
}

const myProfile = useMyProfileStore()
const { showSuccess, showError } = useToast()

const values = reactive<Record<string, string>>({})
const dates = reactive<Record<string, string | null>>({})
const absent = reactive<Record<string, boolean>>({})
const errors = reactive<Record<string, string>>({})
const diet = reactive(pick<number>())
const variant = reactive({ on: true, surname: '', name: '', patronymic: '' })
const study = reactive(emptyStudy(true))
const studyErrorsShown = ref<StudyErrors>({})
const error = ref('')
const saving = ref(false)

const fields = computed(() => (props.item.fill as FillFieldsTodo).fields)
const missing = computed(() => fields.value.map((field) => field.key))
const asks = (key: string) => missing.value.includes(key)
const isOptional = (key: string) => !!fields.value.find((field) => field.key === key)?.optional
const hasPassport = computed(() => !!myProfile.profile?.passports?.length)
const variantAsked = computed(() => asks(VARIANT))
const studentKeys = computed(() => missing.value.filter((key) => key.startsWith('student.')))
const studyStarted = computed(() =>
  studentKeys.value.length > 0 && study.isStudent
  && !!(study.studentId.trim() || study.group.id != null || study.group.draft))
const inline = computed(() => {
  const keys = missing.value.filter((key) => INLINE_FIELDS.has(key) && !key.startsWith('passport.'))
  const passport = [...missing.value.filter((key) => key.startsWith('passport.'))]
  if (variantAsked.value && variant.on && !hasPassport.value) passport.push('passport.number')
  return [...keys, ...passportKeys([...new Set(passport)], hasPassport.value)]
})

function labelOf(key: string): string {
  return fields.value.find((field) => field.key === key)?.label ?? LABELS[key] ?? key
}

function collected(): Record<string, string> {
  const all: Record<string, string> = {}
  for (const key of inline.value) {
    if (absent[key]) continue
    all[key] = (DATES.has(key) ? dates[key] : values[key]) ?? ''
  }
  return all
}

function absentKeys(): string[] {
  const keys = [...inline.value, DIET].filter((key) => asks(key) && isOptional(key) && absent[key])
  if (variantAsked.value && !variant.on) keys.push(VARIANT)
  if (studentKeys.value.length && !study.isStudent) keys.push(...studentKeys.value)
  return keys
}

function validate(all: Record<string, string>): boolean {
  for (const key of Object.keys(errors)) delete errors[key]
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('contact.') && value.trim()) {
      const message = contactError(key.slice('contact.'.length) as ContactType, value)
      if (message) errors[key] = message
    }
  }
  const variantFilled = variantAsked.value && variant.on && !!(variant.surname.trim() || variant.name.trim())
  if (variantFilled) {
    if (!variant.surname.trim()) errors.variantSurname = 'Укажите фамилию'
    if (!variant.name.trim()) errors.variantName = 'Укажите имя'
  }
  const needsNumber = variantFilled
    || Object.entries(all).some(([key, value]) => key.startsWith('passport.') && value.trim())
  if (!hasPassport.value && needsNumber && !all['passport.number']?.trim()) {
    errors['passport.number'] = 'Нужно для паспорта'
  }
  studyErrorsShown.value = studyStarted.value ? studyErrors(study) : {}
  return !Object.keys(errors).length && !Object.keys(studyErrorsShown.value).length
}

function answered(all: Record<string, string>): boolean {
  return Object.values(all).some((value) => value.trim())
    || diet.id != null || !!diet.draft
    || (variantAsked.value && variant.on && !!variant.surname.trim())
    || studyStarted.value
    || absentKeys().length > 0
}

async function written(all: Record<string, string>): Promise<MyProfileWriteV3 | null> {
  let write = withValues(profileWrite(myProfile.profile!), all)
  let changed = Object.values(all).some((value) => value.trim())
  if (asks(DIET) && !absent[DIET] && (diet.id != null || diet.draft)) {
    if (diet.id == null && diet.draft) Object.assign(diet, pick((await resolveDietProfileV2DietsPost({ name: diet.draft })).data.id))
    write = { ...write, diet_id: diet.id }
    changed = true
  }
  if (variantAsked.value && variant.on && variant.surname.trim()) {
    write = withNameVariant(write, variant)
    changed = true
  }
  if (studyStarted.value) {
    await resolveStudy(study)
    write = { ...write, student: studentWrite(study) }
    changed = true
  }
  return changed ? write : null
}

async function save() {
  if (saving.value || !myProfile.profile) return
  error.value = ''
  const all = collected()
  if (!answered(all)) {
    error.value = 'Заполните хотя бы одно поле'
    return
  }
  if (!validate(all)) return
  saving.value = true
  try {
    const write = await written(all)
    if (write) await myProfile.save(write)
    const keys = absentKeys()
    if (keys.length) await declareMyAbsentFieldsProfileV3ProfilesMyAbsentFieldsPost({ keys })
    await showSuccess('Данные сохранены')
    emit('done', props.item.id)
  } catch (err) {
    await showError(err, 'Не удалось сохранить данные')
  } finally {
    saving.value = false
  }
}

async function searchDiets(search: string) {
  return (await getManyProfileV1DietsGet({ search, limit: 20 })).data.items
}

onMounted(() => {
  void myProfile.load()
})
</script>

<style scoped>
.ff-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.ff-card .ui-card-head {
  margin-bottom: 0;
}

.ff-card > .ui-btn {
  align-self: flex-start;
}

.ff-state {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.ff-error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-danger);
}
</style>
