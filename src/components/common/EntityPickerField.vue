<template>
  <div class="epf">
    <UiField v-if="selected" :label="label" float>
      <template v-if="icon" #prefix><ion-icon :icon="icon" /></template>
      <span class="ui-field-value">{{ selected.name }}</span>
      <template #suffix>
        <button type="button" class="ui-icon-btn ui-icon-btn--danger" :aria-label="clearLabel" @click="emit('clear')">
          <ion-icon :icon="closeOutline" />
        </button>
      </template>
    </UiField>
    <template v-else>
      <UiInput
        :model-value="search"
        :label="label"
        :placeholder="placeholder"
        autocomplete="off"
        @update:model-value="onSearch"
      >
        <template #prefix><ion-icon :icon="searchOutline" /></template>
      </UiInput>
      <div v-if="options.length" class="ui-menu">
        <button v-for="option in options" :key="option.id" type="button" class="ui-menu-item" @click="emit('select', option)">
          {{ option.name }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends PickerOption">
import { onBeforeUnmount } from 'vue'
import { IonIcon } from '@ionic/vue'
import { closeOutline, searchOutline } from 'ionicons/icons'
import UiField from '@/components/common/UiField.vue'
import UiInput from '@/components/common/UiInput.vue'
import type { PickerOption } from '@/composables/useEntityPicker'

const props = withDefaults(
  defineProps<{
    label: string
    search: string
    options: T[]
    selected: PickerOption | null
    placeholder?: string
    clearLabel?: string
    icon?: string
    debounce?: number
  }>(),
  { placeholder: 'Начните вводить название', clearLabel: 'Убрать', icon: undefined, debounce: 400 },
)

const emit = defineEmits<{
  'update:search': [value: string]
  search: []
  select: [option: T]
  clear: []
}>()

let timer: ReturnType<typeof setTimeout> | undefined

function onSearch(value: string) {
  emit('update:search', value)
  clearTimeout(timer)
  timer = setTimeout(() => emit('search'), props.debounce)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>
