<template>
  <UiField
    v-bind="rootAttrs()"
    :label="label"
    float
    :invalid="invalid"
    :disabled="disabled"
    :error="error"
    :hint="hint"
  >
    <ion-select
      class="ui-field-control"
      v-bind="controlAttrs()"
      :value="modelValue"
      :placeholder="placeholder"
      :interface="interface"
      :disabled="disabled"
      @ion-change="onChange"
    >
      <slot />
    </ion-select>
  </UiField>
</template>

<script setup lang="ts" generic="T extends string | number | null">
import { IonSelect } from '@ionic/vue'
import UiField from '@/components/common/UiField.vue'
import { useFieldAttrs } from '@/composables/useFieldAttrs'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    modelValue?: T
    label?: string
    placeholder?: string
    interface?: 'popover' | 'alert' | 'action-sheet'
    invalid?: boolean
    disabled?: boolean
    error?: string
    hint?: string
  }>(),
  { interface: 'popover' },
)

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const { rootAttrs, controlAttrs } = useFieldAttrs()

function onChange(event: CustomEvent<{ value: T }>) {
  emit('update:modelValue', event.detail.value)
}
</script>
