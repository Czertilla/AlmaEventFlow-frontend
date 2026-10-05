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
        >
          <ion-select-option v-for="opt in field.options || []" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </ion-select-option>
        </UiSelect>

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
            <span v-else class="map-field-hint">Нажмите на карту, чтобы указать точку</span>
            <ion-button v-if="form[field.key]" fill="clear" size="small" @click="form[field.key] = null">
              Очистить
            </ion-button>
          </div>
        </div>

        <EntityPickerField
          v-else-if="field.type === 'search'"
          v-model:search="searchQuery[field.key]"
          :label="fieldLabel(field)"
          :placeholder="field.placeholder || 'Поиск…'"
          :debounce="300"
          :options="pickerOptions(field)"
          :selected="selectedItem[field.key] ? { id: String(form[field.key]), name: getSelectedLabel(field) } : null"
          @search="onSearch(field)"
          @select="selectItem(field, $event.raw)"
          @clear="clearSearch(field)"
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
import { ref, reactive, onMounted } from 'vue'
import { IonButton, IonIcon, IonContent, IonToggle, IonSelectOption, IonSpinner } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import GeoMap from '@/components/geo/GeoMap.vue'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import UuidBadge from '@/components/common/UuidBadge.vue'
import TimestampsMeta from '@/components/common/TimestampsMeta.vue'

export interface FormField {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'checkbox' | 'select' | 'textarea' | 'search' | 'map'
  required?: boolean
  maxLength?: number
  options?: { value: any; label: string }[]
  placeholder?: string
  fetchOptions?: (search: string) => Promise<any[]>
  displayField?: string
  /** Кастомная подпись для результатов поиска (например, ФИО из нескольких полей) */
  displayFn?: (opt: any) => string
  valueField?: string
  initialSelected?: (item: any) => any | null
}

const props = defineProps<{
  title: string
  fields: FormField[]
  item: any | null
  onSave: (data: any) => Promise<void>
}>()

defineEmits<{ close: [] }>()

const saving = ref(false)
const error = ref('')

const form = reactive<Record<string, any>>({})
const selectedItem = reactive<Record<string, any>>({})
const searchQuery = reactive<Record<string, string>>({})
const searchResults = reactive<Record<string, any[]>>({})

function getOptionLabel(field: FormField, opt: any): string {
  if (field.displayFn) return field.displayFn(opt)
  const df = field.displayField || 'name'
  return opt[df] || opt.id || String(opt)
}

function fieldLabel(field: FormField): string {
  return field.required ? `${field.label} *` : field.label
}

function pickerOptions(field: FormField) {
  return (searchResults[field.key] ?? []).map((raw) => ({
    id: String(raw[field.valueField || 'id']),
    name: getOptionLabel(field, raw),
    raw,
  }))
}

function getSelectedLabel(field: FormField): string {
  const item = selectedItem[field.key]
  if (!item) return ''
  return getOptionLabel(field, item)
}

onMounted(() => {
  for (const field of props.fields) {
    if (field.type === 'checkbox') {
      form[field.key] = props.item?.[field.key] ?? false
    } else if (field.type === 'map') {
      form[field.key] = props.item?.[field.key] ?? null
    } else if (field.type === 'search') {
      const val = props.item?.[field.key] ?? ''
      form[field.key] = val
      searchQuery[field.key] = ''
      searchResults[field.key] = []
      const preset = val && props.item ? field.initialSelected?.(props.item) : null
      if (preset) {
        selectedItem[field.key] = preset
      } else if (val && field.fetchOptions) {
        field.fetchOptions('').then((results) => {
          const found = results.find((r: any) => (r[field.valueField || 'id']) === val)
          if (found) selectedItem[field.key] = found
        }).catch(() => {})
      }
    } else {
      form[field.key] = props.item?.[field.key] ?? ''
    }
  }
})

async function onSearch(field: FormField) {
  const q = searchQuery[field.key] || ''
  if (!field.fetchOptions) return
  try {
    searchResults[field.key] = await field.fetchOptions(q)
  } catch {
    searchResults[field.key] = []
  }
}

function selectItem(field: FormField, opt: any) {
  form[field.key] = opt[field.valueField || 'id']
  selectedItem[field.key] = opt
  searchQuery[field.key] = ''
  searchResults[field.key] = []
}

function clearSearch(field: FormField) {
  form[field.key] = ''
  selectedItem[field.key] = null
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const data: Record<string, any> = {}
    for (const field of props.fields) {
      const val = form[field.key]
      if (field.required && (val === '' || val === undefined || val === null)) {
        error.value = `Поле "${field.label}" обязательно`
        saving.value = false
        return
      }
      if (val !== '' && val !== undefined && val !== null) {
        data[field.key] = val
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
