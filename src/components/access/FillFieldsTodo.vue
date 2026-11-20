<template>
  <div class="ui-card ff-card">
    <div class="ui-card-head">
      <h3 class="ui-card-title">{{ item.collective_name }}</h3>
    </div>
    <div class="ui-chips">
      <span v-for="field in fields" :key="field.key" class="ui-chip ui-chip--static">{{ field.label }}</span>
    </div>

    <div v-if="!myProfile.loaded && !myProfile.failed" class="ff-state"><ion-spinner name="crescent" /></div>
    <template v-else-if="inline.length">
      <template v-for="key in inline" :key="key">
        <DateTimeField
          v-if="DATES.has(key)"
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
        />
      </template>
      <p v-if="error" class="ff-error">{{ error }}</p>
      <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="saving" @click="save">
        <ion-spinner v-if="saving" name="crescent" />
        Сохранить
      </button>
    </template>
    <button v-if="rest.length || !inline.length" type="button" class="ff-link" @click="emit('open-form')">
      {{ inline.length ? 'Остальное в «Подробной информации»' : 'Заполнить в «Подробной информации»' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { IonSpinner } from '@ionic/vue'
import type { ContactType, FillFieldsTodo, TodoItem } from '@/api/generated/almaEventFlow'
import DateTimeField from '@/components/common/DateTimeField.vue'
import UiInput from '@/components/common/UiInput.vue'
import { useToast } from '@/composables/useToast'
import { useMyProfileStore } from '@/stores/myProfile'
import { contactError } from '@/utils/contactTypes'
import { INLINE_FIELDS, passportKeys, profileWrite, withValues } from '@/utils/profileWrite'

const props = defineProps<{ item: TodoItem }>()
const emit = defineEmits<{ done: [id: string]; 'open-form': [] }>()

const DATES = new Set(['profile.birthdate', 'passport.expire_date', 'passport.issued_date'])
const LABELS: Record<string, string> = {
  'passport.number': 'Номер паспорта',
  'passport.expire_date': 'Срок действия паспорта',
}

const myProfile = useMyProfileStore()
const { showSuccess, showError } = useToast()

const values = reactive<Record<string, string>>({})
const dates = reactive<Record<string, string | null>>({})
const errors = reactive<Record<string, string>>({})
const error = ref('')
const saving = ref(false)

const fields = computed(() => (props.item.fill as FillFieldsTodo).fields)
const missing = computed(() => fields.value.map((field) => field.key))
const hasPassport = computed(() => !!myProfile.profile?.passports?.length)
const inline = computed(() => {
  const keys = missing.value.filter((key) => INLINE_FIELDS.has(key) && !key.startsWith('passport.'))
  return [...keys, ...passportKeys(missing.value, hasPassport.value)]
})
const rest = computed(() => missing.value.filter((key) => !INLINE_FIELDS.has(key)))

function labelOf(key: string): string {
  return fields.value.find((field) => field.key === key)?.label ?? LABELS[key] ?? key
}

function collected(): Record<string, string> {
  const all: Record<string, string> = {}
  for (const key of inline.value) all[key] = (DATES.has(key) ? dates[key] : values[key]) ?? ''
  return all
}

function validate(all: Record<string, string>): boolean {
  for (const key of Object.keys(errors)) delete errors[key]
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('contact.') && value.trim()) {
      const message = contactError(key.slice('contact.'.length) as ContactType, value)
      if (message) errors[key] = message
    }
  }
  if (!hasPassport.value && Object.entries(all).some(([key, value]) => key.startsWith('passport.') && value.trim())) {
    if (!all['passport.number']?.trim()) errors['passport.number'] = 'Нужно для паспорта'
  }
  return !Object.keys(errors).length
}

async function save() {
  if (saving.value || !myProfile.profile) return
  error.value = ''
  const all = collected()
  if (!Object.values(all).some((value) => value.trim())) {
    error.value = 'Заполните хотя бы одно поле'
    return
  }
  if (!validate(all)) return
  saving.value = true
  try {
    await myProfile.save(withValues(profileWrite(myProfile.profile), all))
    await showSuccess('Данные сохранены')
    emit('done', props.item.id)
  } catch (err) {
    await showError(err, 'Не удалось сохранить данные')
  } finally {
    saving.value = false
  }
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

.ff-link {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
  cursor: pointer;
}
</style>
