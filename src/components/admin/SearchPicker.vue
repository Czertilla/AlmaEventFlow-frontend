<template>
  <div class="search-picker">
    <div v-if="modelValue" class="picker-selected" @click="clear">
      <span class="picker-label">{{ selectedLabel || String(modelValue) }}</span>
      <ion-icon :icon="closeOutline" />
    </div>
    <template v-else>
      <ion-searchbar
        v-model="query"
        :placeholder="placeholder || 'Поиск...'"
        :debounce="300"
        mode="md"
        class="picker-search"
        @ion-input="onSearch"
      />
      <div v-if="results.length" class="picker-results">
        <button
          v-for="opt in results"
          :key="opt.id"
          class="picker-result"
          @click="select(opt)"
        >{{ label(opt) }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { IonSearchbar, IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'

const props = defineProps<{
  modelValue: string | number | null
  fetch: (search: string) => Promise<any[]>
  numeric?: boolean
  placeholder?: string
  displayField?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

const query = ref('')
const results = ref<any[]>([])
const selectedLabel = ref('')

function label(opt: any): string {
  const df = props.displayField || 'name'
  return opt[df] || opt.id || String(opt)
}

async function onSearch() {
  try { results.value = await props.fetch(query.value || '') } catch { results.value = [] }
}

function select(opt: any) {
  emit('update:modelValue', props.numeric ? Number(opt.id) : opt.id)
  selectedLabel.value = label(opt)
  query.value = ''
  results.value = []
}

function clear() {
  emit('update:modelValue', null)
  selectedLabel.value = ''
}

// Подтянуть человекочитаемое имя для уже выбранного значения (при загрузке)
async function resolveLabel() {
  if (!props.modelValue) { selectedLabel.value = ''; return }
  try {
    const items = await props.fetch('')
    const found = items.find((i) => String(i.id) === String(props.modelValue))
    if (found) selectedLabel.value = label(found)
  } catch { /* имя не критично */ }
}

onMounted(resolveLabel)
watch(() => props.modelValue, (val, old) => {
  if (val && val !== old && !selectedLabel.value) resolveLabel()
  if (!val) selectedLabel.value = ''
})
</script>

<style scoped>
.search-picker { width: 100%; }
.picker-selected {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 12px; border: 1.5px solid var(--ion-border-color); border-radius: 10px;
  background: var(--ion-background-color); cursor: pointer; color: var(--ion-text-color);
}
.picker-selected:hover { border-color: var(--ion-color-medium); }
.picker-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.picker-search { padding: 0; --border-radius: 10px; --box-shadow: none; }
.picker-results {
  margin-top: 4px; max-height: 200px; overflow-y: auto;
  border: 1px solid var(--ion-border-color); border-radius: 10px; background: var(--ion-card-background);
}
.picker-result {
  display: block; width: 100%; text-align: left; padding: 10px 12px; border: none;
  background: transparent; font-family: inherit; font-size: 14px; color: var(--ion-text-color);
  cursor: pointer; border-bottom: 1px solid var(--ion-color-step-100, #f0f0f0);
}
.picker-result:last-child { border-bottom: none; }
.picker-result:hover { background: var(--ion-color-light-tint, #f1f3f5); }
</style>
