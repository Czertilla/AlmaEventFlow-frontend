<template>
  <EntityPickerField
    v-model:search="query"
    :label="label"
    :placeholder="placeholder || 'Поиск…'"
    :debounce="300"
    :options="options"
    :selected="selected"
    :loading="resolving"
    @search="onSearch"
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
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null, raw?: any] }>()

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

const options = computed(() => results.value.map((raw) => ({ id: String(optionValue(raw)), name: optionLabel(raw), raw })))
const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '')
const selected = computed(() =>
  hasValue.value
    ? { id: String(props.modelValue), name: selectedLabel.value || `#${String(props.modelValue).slice(0, 8)}` }
    : null,
)

async function onSearch() {
  try { results.value = await props.fetch(query.value || '') } catch { results.value = [] }
}

function select(option: { raw: any }) {
  const value = optionValue(option.raw)
  emit('update:modelValue', props.numeric ? Number(value) : value, option.raw)
  selectedLabel.value = optionLabel(option.raw)
  labelFor = String(value)
  query.value = ''
  results.value = []
}

function clear() {
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
