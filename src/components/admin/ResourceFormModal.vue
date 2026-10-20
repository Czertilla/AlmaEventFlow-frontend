<template>
  <div class="ui-sheet-head">
    <div class="modal-header-title">
      <h3 class="ui-sheet-title">{{ title }}</h3>
      <UuidBadge v-if="item?.id" :id="item.id" />
    </div>
    <button class="ui-icon-btn" aria-label="Закрыть" @click="$emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <div v-if="item?.created_at" class="modal-meta">
    <TimestampsMeta :created-at="item.created_at" :edited-at="item.edited_at" />
  </div>
  <div v-if="links?.length && item" class="modal-links">
    <button v-for="link in links" :key="link.label" type="button" class="ui-chip modal-link" @click="followLink(link)">
      <ion-icon v-if="link.icon" :icon="link.icon" />
      {{ link.label }}
    </button>
  </div>
  <ion-content class="ion-padding">
    <div class="form-list">
      <template v-for="field in fields" :key="field.key">
        <UiInput
          v-if="field.type === 'text' || field.type === 'email' || field.type === 'number'"
          v-model="form[field.key]"
          :type="field.type"
          :label="fieldLabel(field)"
          :maxlength="field.maxLength"
          :placeholder="field.placeholder"
          :counter="field.type !== 'number'"
        />

        <UiTextarea
          v-else-if="field.type === 'textarea'"
          v-model="form[field.key]"
          :label="fieldLabel(field)"
          :placeholder="field.placeholder"
          :maxlength="field.maxLength"
          :rows="3"
          counter
        />

        <label v-else-if="field.type === 'checkbox'" class="ui-toggle-row">
          <span>{{ fieldLabel(field) }}</span>
          <ion-toggle v-model="form[field.key]" :checked="!!form[field.key]" mode="md" />
        </label>

        <UiSelect
          v-else-if="field.type === 'select'"
          v-model="form[field.key]"
          :label="fieldLabel(field)"
          :placeholder="field.placeholder"
          :options="field.options || []"
        />

        <div v-else-if="field.type === 'map'" class="map-field">
          <p class="ui-field-title">{{ fieldLabel(field) }}</p>
          <GeoMap
            pickable
            :picked-point="form[field.key]"
            class="map-field-map"
            @pick="form[field.key] = $event"
          />
          <div class="map-field-coords">
            <span v-if="form[field.key]">{{ form[field.key].lat.toFixed(5) }}, {{ form[field.key].lon.toFixed(5) }}</span>
            <span v-else class="map-field-hint">Точка не выбрана</span>
            <ion-button v-if="form[field.key]" fill="clear" size="small" @click="form[field.key] = null">
              Очистить
            </ion-button>
          </div>
        </div>

        <MultiSearchField
          v-else-if="field.type === 'multisearch'"
          v-model="form[field.key]"
          :label="fieldLabel(field)"
          :placeholder="field.placeholder"
          :fetch="choicesFor(field)"
          :disabled="isBlocked(field)"
          :hint="isBlocked(field) ? field.dependsHint : undefined"
        />

        <SearchPicker
          v-else-if="field.type === 'search'"
          v-model="form[field.key]"
          :label="fieldLabel(field)"
          :placeholder="field.placeholder || 'Поиск…'"
          :fetch="searchFor(field)"
          :resource="resourceFor(field)"
          :display-field="field.displayField"
          :display-fn="field.displayFn"
          :value-field="field.valueField"
          :initial-label="initialLabel(field)"
        />
      </template>
    </div>

    <div v-if="error" class="form-error">{{ error }}</div>

  </ion-content>
  <div class="ui-sheet-actions">
    <button class="ui-btn ui-btn--primary" :disabled="saving" @click="submit">
      <ion-spinner v-if="saving" name="crescent" />
      Сохранить
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { IonButton, IonIcon, IonContent, IonToggle, IonSpinner, modalController } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import GeoMap from '@/components/geo/GeoMap.vue'
import MultiSearchField from '@/components/admin/MultiSearchField.vue'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import UuidBadge from '@/components/common/UuidBadge.vue'
import TimestampsMeta from '@/components/common/TimestampsMeta.vue'
import { useAdminNavigate } from '@/composables/useAdminNavigate'
import { PICKERS, type PickerItem, type PickerName } from '@/utils/adminPickers'
import type { ResourceKind } from '@/utils/resourceLabels'

export interface FormField {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'checkbox' | 'select' | 'textarea' | 'search' | 'multisearch' | 'map'
  required?: boolean
  maxLength?: number
  options?: { value: any; label: string }[]
  placeholder?: string
  /** Готовый поиск по справочнику (см. utils/adminPickers): заменяет fetchOptions/displayField/resource */
  picker?: PickerName
  fetchOptions?: (search: string) => Promise<any[]>
  displayField?: string
  /** Кастомная подпись для результатов поиска (например, ФИО из нескольких полей) */
  displayFn?: (opt: any) => string
  valueField?: string
  /** Тип ресурса: имя выбранной записи берётся по id, а не ищется среди первых результатов поиска */
  resource?: ResourceKind
  /** Подпись выбранной записи, если она уже есть в самой редактируемой записи (адрес внутри локации) */
  initialSelected?: (item: any) => any | null
  /** multisearch: варианты для добавления; вторым аргументом приходят текущие значения формы */
  choices?: (search: string, form: Record<string, any>) => Promise<PickerItem[]>
  /** multisearch: поле формы, без которого варианты не имеют смысла; при его смене в новой записи выбор сбрасывается */
  dependsOn?: string
  dependsHint?: string
}

export interface FormLink {
  label: string
  to: string
  icon?: string
}

const props = defineProps<{
  title: string
  fields: FormField[]
  item: any | null
  onSave: (data: any) => Promise<void>
  links?: FormLink[]
}>()

defineEmits<{ close: [] }>()

const navigate = useAdminNavigate()

const saving = ref(false)
const error = ref('')

const form = reactive<Record<string, any>>({})

for (const field of props.fields) {
  const parent = field.dependsOn
  if (field.type !== 'multisearch' || !parent) continue
  watch(
    () => form[parent],
    (now, before) => {
      if (!props.item && before !== undefined && now !== before) form[field.key] = []
    },
  )
}

function choicesFor(field: FormField): (search: string) => Promise<PickerItem[]> {
  return async (search) => (field.choices ? field.choices(search, form) : [])
}

function isBlocked(field: FormField): boolean {
  return !!field.dependsOn && !form[field.dependsOn]
}

// Страница под модалкой пересоздаётся при переходе: уходить надо после того,
// как модалка закрылась, иначе её оверлей остался бы висеть над новой страницей.
async function followLink(link: FormLink) {
  await modalController.dismiss().catch(() => false)
  navigate(link.to)
}

function fieldLabel(field: FormField): string {
  return field.required ? `${field.label} *` : field.label
}

function searchFor(field: FormField): (search: string) => Promise<any[]> {
  if (field.picker) return PICKERS[field.picker].search
  return field.fetchOptions ?? (async () => [])
}

// Ссылочные поля называются одинаково во всех сервисах, поэтому тип ресурса,
// по которому берётся имя выбранной записи, выводится из ключа.
const RESOURCE_BY_KEY: Record<string, ResourceKind> = {
  collective_id: 'collective',
  event_id: 'event',
  person_id: 'person',
  principal_id: 'person',
  organizer_id: 'organization',
  workplace_id: 'organization',
  faculty_id: 'organization',
  university_id: 'organization',
  location_id: 'location',
  address_id: 'address',
  city_id: 'city',
  member_id: 'memberInCollective',
  participation_id: 'participation',
  role_id: 'role',
  group_id: 'group',
}

function resourceFor(field: FormField): ResourceKind | undefined {
  return field.resource ?? (field.picker ? PICKERS[field.picker].kind : RESOURCE_BY_KEY[field.key])
}

function initialLabel(field: FormField): string | null {
  const preset = props.item ? field.initialSelected?.(props.item) : null
  if (!preset) return null
  return field.displayFn ? field.displayFn(preset) : preset[field.displayField || 'name'] ?? null
}

onMounted(() => {
  for (const field of props.fields) {
    if (field.type === 'checkbox') {
      form[field.key] = props.item?.[field.key] ?? false
    } else if (field.type === 'map') {
      form[field.key] = props.item?.[field.key] ?? null
    } else if (field.type === 'search') {
      form[field.key] = props.item?.[field.key] ?? null
    } else if (field.type === 'multisearch') {
      form[field.key] = ((props.item?.[field.key] ?? []) as PickerItem[]).map((entry) => ({ id: entry.id, name: entry.name }))
    } else {
      form[field.key] = props.item?.[field.key] ?? ''
    }
  }
})

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const data: Record<string, any> = {}
    for (const field of props.fields) {
      const val = form[field.key]
      if (field.type === 'multisearch') {
        data[field.key] = ((val ?? []) as PickerItem[]).map((entry) => entry.id)
        continue
      }
      if (field.required && (val === '' || val === undefined || val === null)) {
        error.value = `Поле "${field.label}" обязательно`
        saving.value = false
        return
      }
      if (val !== '' && val !== undefined && val !== null) {
        data[field.key] = val
      } else if (field.type === 'search' && props.item?.[field.key]) {
        data[field.key] = null
      }
    }
    await props.onSave(data)
  } catch (err: any) {
    error.value = err?.response?.data?.detail?.[0]?.msg || err?.message || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-meta {
  padding: 0 20px 10px;
  background: var(--ion-card-background);
}

.modal-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 20px 10px;
  background: var(--ion-card-background);
}

.modal-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.form-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-error {
  margin-top: 12px;
  color: var(--ion-color-danger);
  font-size: var(--fs-md);
}

.map-field-map {
  height: 220px;
  overflow: hidden;
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-md);
}

.map-field-coords {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  color: var(--ion-color-medium);
  font-size: var(--fs-md);
}

.map-field-hint {
  font-size: var(--fs-sm);
}
</style>
