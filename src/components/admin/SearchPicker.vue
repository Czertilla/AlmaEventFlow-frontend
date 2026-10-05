<template>
  <EntityPickerField
    v-model:search="query"
    :label="label"
    :placeholder="placeholder || 'Поиск…'"
    :debounce="300"
    :options="options"
    :selected="selected"
    @search="onSearch"
    @select="select"
    @clear="clear"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import EntityPickerField from '@/components/common/EntityPickerField.vue'

const props = defineProps<{
  modelValue: string | number | null
  fetch: (search: string) => Promise<any[]>
  label: string
  numeric?: boolean
  placeholder?: string
  displayField?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

const query = ref('')
const results = ref<any[]>([])
const selectedLabel = ref('')
const resolving = ref(false)

function optionLabel(opt: any): string {
  const df = props.displayField || 'name'
  return opt[df] || opt.id || String(opt)
}

const options = computed(() => results.value.map((raw) => ({ id: String(raw.id), name: optionLabel(raw), raw })))
const selected = computed(() =>
  props.modelValue
    ? { id: String(props.modelValue), name: selectedLabel.value || (resolving.value ? '…' : String(props.modelValue)) }
    : null,
)

async function onSearch() {
  try { results.value = await props.fetch(query.value || '') } catch { results.value = [] }
}

function select(option: { raw: any }) {
  emit('update:modelValue', props.numeric ? Number(option.raw.id) : option.raw.id)
  selectedLabel.value = optionLabel(option.raw)
  query.value = ''
  results.value = []
}

function clear() {
  emit('update:modelValue', null)
  selectedLabel.value = ''
}

async function resolveLabel() {
  if (!props.modelValue) { selectedLabel.value = ''; return }
  resolving.value = true
  try {
    const items = await props.fetch('')
    const found = items.find((i) => String(i.id) === String(props.modelValue))
    if (found) selectedLabel.value = optionLabel(found)
  } catch { /* имя не критично */ } finally {
    resolving.value = false
  }
}

onMounted(resolveLabel)
watch(() => props.modelValue, (val, old) => {
  if (val && val !== old && !selectedLabel.value) resolveLabel()
  if (!val) selectedLabel.value = ''
})
</script>
