<template>
  <div class="msf">
    <EntityPickerField
      v-model:search="query"
      :label="label"
      :placeholder="placeholder"
      :debounce="300"
      :options="options"
      :selected="null"
      :disabled="disabled"
      :hint="hint"
      @search="load"
      @focus="onFocus"
      @select="add"
    />
    <div v-if="modelValue.length" class="ui-chips msf-chips">
      <button
        v-for="item in modelValue"
        :key="item.id"
        type="button"
        class="ui-chip ui-chip--active msf-chip"
        :aria-label="`Убрать: ${item.name}`"
        @click="remove(item.id)"
      >
        <span class="msf-chip-text">{{ item.name }}</span>
        <ion-icon :icon="closeOutline" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import type { PickerItem } from '@/utils/adminPickers'

const props = withDefaults(
  defineProps<{
    modelValue?: PickerItem[]
    label: string
    fetch: (search: string) => Promise<PickerItem[]>
    placeholder?: string
    disabled?: boolean
    hint?: string
  }>(),
  { modelValue: () => [], placeholder: undefined, disabled: false, hint: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: PickerItem[]] }>()

const query = ref('')
const results = ref<PickerItem[]>([])

const chosen = computed(() => new Set(props.modelValue.map((item) => item.id)))
const options = computed(() => results.value.filter((item) => !chosen.value.has(item.id)))

async function load() {
  try {
    results.value = await props.fetch(query.value)
  } catch {
    results.value = []
  }
}

async function onFocus() {
  if (!query.value && !results.value.length) await load()
}

function add(option: PickerItem) {
  emit('update:modelValue', [...props.modelValue, { id: option.id, name: option.name }])
}

function remove(id: string) {
  emit('update:modelValue', props.modelValue.filter((item) => item.id !== id))
}
</script>

<style scoped>
.msf-chips {
  margin-top: 8px;
}

.msf-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.msf-chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
