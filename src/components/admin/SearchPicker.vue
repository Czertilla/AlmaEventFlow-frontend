<template>
  <EntityPickerField
    v-model:search="query"
    :label="label"
    :placeholder="placeholder || 'Поиск…'"
    :debounce="300"
    :options="options"
    :selected="selected"
    :loading="resolving"
    :locked="locked"
    :hint="hint"
    :help="help"
    @search="onSearch"
    @focus="onFocus"
    @select="select"
    @clear="clear"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import { resolveResourceLabel, type ResourceKind } from '@/utils/resourceLabels'

const props = defineProps<{
  modelValue: string | number | null
  fetch: (search: string) => Promise<any[]>
  label: string
  numeric?: boolean
  placeholder?: string
  displayField?: string
  displayFn?: (opt: any) => string
  valueField?: string
  /** Тип ресурса: имя выбранного значения берётся по id, а не ищется среди первых результатов поиска */
  resource?: ResourceKind
  /** Подпись уже известна вызывающему (например, адрес приходит вместе с локацией) */
  initialLabel?: string | null
  /** Если ничего не нашлось, предлагает добавить введённое: оно приходит как draft, а не как id */
  creatable?: boolean
  draft?: string | null
  /** Список открывается сразу по фокусу, без ввода */
  browse?: boolean
  locked?: boolean
  hint?: string
  help?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null, raw?: any]
  'update:draft': [value: string | null]
}>()

const CREATE_ID = '\u0000create'
const MIN_NEW_NAME = 2

const query = ref('')
const results = ref<any[]>([])
const selectedLabel = ref(props.initialLabel ?? '')
const resolving = ref(false)
let labelFor: string | null = props.initialLabel && hasInitial() ? String(props.modelValue) : null

function hasInitial() {
  return props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== ''
}

function optionLabel(opt: any): string {
  if (props.displayFn) return props.displayFn(opt)
  return opt[props.displayField || 'name'] || opt.id || String(opt)
}

function optionValue(opt: any): any {
  return opt[props.valueField || 'id']
}

const options = computed(() => {
  const found = results.value.map((raw) => ({ id: String(optionValue(raw)), name: optionLabel(raw), raw }))
  const typed = query.value.trim()
  const exact = found.some((option) => option.name.trim().toLowerCase() === typed.toLowerCase())
  if (!props.creatable || typed.length < MIN_NEW_NAME || exact) return found
  return [...found, { id: CREATE_ID, name: `Добавить «${typed}»`, raw: null }]
})
const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '')
const selected = computed(() => {
  if (props.draft) return { id: CREATE_ID, name: `${props.draft} (новая запись)` }
  return hasValue.value
    ? { id: String(props.modelValue), name: selectedLabel.value || `#${String(props.modelValue).slice(0, 8)}` }
    : null
})

async function onSearch() {
  try { results.value = await props.fetch(query.value || '') } catch { results.value = [] }
}

function onFocus() {
  if (props.browse && !results.value.length) onSearch()
}

function select(option: { id: string; raw: any }) {
  if (option.id === CREATE_ID) {
    emit('update:draft', query.value.trim())
    emit('update:modelValue', null)
    query.value = ''
    results.value = []
    return
  }
  const value = optionValue(option.raw)
  emit('update:draft', null)
  emit('update:modelValue', props.numeric ? Number(value) : value, option.raw)
  selectedLabel.value = optionLabel(option.raw)
  labelFor = String(value)
  query.value = ''
  results.value = []
}

function clear() {
  emit('update:draft', null)
  emit('update:modelValue', null)
  selectedLabel.value = ''
  labelFor = null
}

async function resolveLabel() {
  if (!hasValue.value) { selectedLabel.value = ''; return }
  const id = String(props.modelValue)
  labelFor = id
  selectedLabel.value = ''
  resolving.value = true
  try {
    if (props.resource) {
      selectedLabel.value = (await resolveResourceLabel(props.resource, id)) ?? ''
    } else {
      const found = (await props.fetch('')).find((item) => String(optionValue(item)) === id)
      if (found) selectedLabel.value = optionLabel(found)
    }
  } catch { /* имя не критично, останется короткий id */ } finally {
    resolving.value = false
  }
}

onMounted(() => { if (!selectedLabel.value) resolveLabel() })
watch(() => props.modelValue, (value) => {
  if (!hasValue.value) { selectedLabel.value = ''; labelFor = null; return }
  if (String(value) !== labelFor) resolveLabel()
})
</script>
