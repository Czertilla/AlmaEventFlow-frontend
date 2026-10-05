<template>
  <UiField v-bind="rootAttrs()" :label="label" float :disabled="disabled" :invalid="invalid" :error="error">
    <select
      :id="id"
      class="ui-field-control ui-field-select"
      v-bind="controlAttrs()"
      :value="modelValue"
      :disabled="disabled"
      @change="onChange"
    >
      <slot />
    </select>
    <template #suffix><ion-icon class="ui-field-chevron" :icon="caretDownSharp" /></template>
  </UiField>
</template>

<script setup lang="ts" generic="T">
import { IonIcon } from '@ionic/vue'
import { caretDownSharp } from 'ionicons/icons'
import UiField from '@/components/common/UiField.vue'
import { nextFieldId, useFieldAttrs } from '@/composables/useFieldAttrs'

defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue?: T
  label?: string
  disabled?: boolean
  invalid?: boolean
  error?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const { rootAttrs, controlAttrs } = useFieldAttrs()
const id = nextFieldId('ui-select')

function onChange(event: Event) {
  const option = (event.target as HTMLSelectElement).selectedOptions[0] as (HTMLOptionElement & { _value?: T }) | undefined
  emit('update:modelValue', (option && '_value' in option ? option._value : option?.value) as T)
}
</script>
