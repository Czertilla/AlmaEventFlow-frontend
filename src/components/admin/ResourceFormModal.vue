<template>
  <div class="modal-header">
    <h3>{{ title }}</h3>
    <button class="modal-close" aria-label="Закрыть" @click="$emit('close')">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
  <ion-content class="ion-padding">
    <ion-list lines="none" class="form-list">
      <ion-item v-for="field in fields" :key="field.key" class="form-item">
        <ion-label position="stacked">
          {{ field.label }}
          <span v-if="field.required" class="required">*</span>
        </ion-label>

        <ion-input
          v-if="field.type === 'text' || field.type === 'email' || field.type === 'number'"
          v-model="form[field.key]"
          :type="field.type"
          :placeholder="field.placeholder"
          mode="md"
        />

        <ion-textarea
          v-else-if="field.type === 'textarea'"
          v-model="form[field.key]"
          :placeholder="field.placeholder"
          :rows="3"
          mode="md"
        />

        <ion-toggle
          v-else-if="field.type === 'checkbox'"
          v-model="form[field.key]"
          :checked="!!form[field.key]"
          mode="md"
        />

        <ion-select
          v-else-if="field.type === 'select'"
          v-model="form[field.key]"
          :placeholder="field.placeholder"
          interface="popover"
          mode="md"
        >
          <ion-select-option
            v-for="opt in field.options || []"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </ion-select-option>
        </ion-select>

        <div v-else-if="field.type === 'search'" class="search-field">
          <div v-if="selectedItem[field.key]" class="search-selected" @click="clearSearch(field)">
            <span class="search-selected-label">{{ getSelectedLabel(field) }}</span>
            <ion-button fill="clear" size="small" color="medium">✕</ion-button>
          </div>
          <template v-else>
            <ion-searchbar
              v-model="searchQuery[field.key]"
              :placeholder="field.placeholder || 'Поиск...'"
              :debounce="300"
              @ion-input="onSearch(field)"
              class="search-input-compact"
              mode="md"
            />
            <div v-if="searchResults[field.key]?.length" class="search-results">
              <div
                v-for="opt in searchResults[field.key]"
                :key="opt[field.valueField || 'id']"
                class="search-result-item"
                @click="selectItem(field, opt)"
              >
                {{ getOptionLabel(field, opt) }}
              </div>
            </div>
          </template>
        </div>
      </ion-item>
    </ion-list>

    <div v-if="error" class="form-error">{{ error }}</div>

    <div class="form-actions">
      <ion-button expand="block" class="save-btn" :disabled="saving" @click="submit" mode="md">
        <ion-spinner v-if="saving" slot="start" name="crescent" />
        Сохранить
      </ion-button>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  IonButton, IonIcon,
  IonContent, IonList, IonItem, IonLabel, IonInput,
  IonTextarea, IonToggle, IonSelect, IonSelectOption,
  IonSearchbar, IonSpinner,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'

export interface FormField {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'checkbox' | 'select' | 'textarea' | 'search'
  required?: boolean
  options?: { value: any; label: string }[]
  placeholder?: string
  fetchOptions?: (search: string) => Promise<any[]>
  displayField?: string
  /** Кастомная подпись для результатов поиска (например, ФИО из нескольких полей) */
  displayFn?: (opt: any) => string
  valueField?: string
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

function getSelectedLabel(field: FormField): string {
  const item = selectedItem[field.key]
  if (!item) return ''
  return getOptionLabel(field, item)
}

onMounted(() => {
  for (const field of props.fields) {
    if (field.type === 'checkbox') {
      form[field.key] = props.item?.[field.key] ?? false
    } else if (field.type === 'search') {
      const val = props.item?.[field.key] ?? ''
      form[field.key] = val
      searchQuery[field.key] = ''
      searchResults[field.key] = []
      if (val && field.fetchOptions) {
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
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
  background: var(--ion-card-background);
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--ion-background-color);
  color: var(--ion-color-medium);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s;
}

.modal-close:hover {
  background: var(--ion-border-color);
}

.form-list {
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.form-item ion-label {
  font-size: 13px;
  font-weight: 600;
}

.form-error {
  color: var(--ion-color-danger);
  padding: 4px 16px 0;
  font-size: 0.9rem;
}

.required {
  color: var(--ion-color-danger);
  margin-left: 2px;
}

.form-actions {
  padding: 16px;
}

.save-btn {
  font-weight: 600;
  --border-radius: 10px;
}

/* ── Search field ── */
.search-field {
  width: 100%;
}

.search-input-compact {
  --padding-start: 8px;
  --padding-end: 8px;
  --min-height: 36px;
  font-size: 0.9rem;
  --border-radius: 8px;
  --box-shadow: none;
}

.search-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--ion-color-step-50, #f8f9fa);
  border-radius: 8px;
  padding: 6px 8px 6px 12px;
  gap: 4px;
  cursor: pointer;
  border: 1px solid var(--ion-color-step-150, #e9ecef);
  transition: border-color 0.15s;
}

.search-selected:hover {
  border-color: var(--ion-color-medium);
}

.search-selected-label {
  font-size: 0.9rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ion-text-color, #000);
}

.search-results {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--ion-color-step-150, #e9ecef);
  border-radius: 8px;
  margin-top: 4px;
  background: var(--ion-card-background, #fff);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.search-result-item {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  border-bottom: 1px solid var(--ion-color-step-100, #f0f0f0);
  transition: background 0.12s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--ion-color-light-tint, #f1f3f5);
}
</style>
