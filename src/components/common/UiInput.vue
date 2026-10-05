<template>
  <UiField
    v-bind="rootAttrs()"
    :label="label"
    :filled="hasValue"
    :invalid="invalid"
    :disabled="disabled"
    :error="error"
    :hint="hint"
    :success="success"
    :counter="counterText"
    :for-id="id"
  >
    <template v-if="$slots.prefix" #prefix><slot name="prefix" /></template>
    <input
      :id="id"
      ref="el"
      class="ui-field-control"
      v-bind="controlAttrs()"
      :value="modelValue ?? ''"
      :maxlength="maxlength"
      :disabled="disabled"
      @input="onInput"
    />
    <template v-if="$slots.suffix" #suffix><slot name="suffix" /></template>
  </UiField>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiField from '@/components/common/UiField.vue'
import { nextFieldId, useFieldAttrs } from '@/composables/useFieldAttrs'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: string | number | null
  label?: string
  invalid?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  success?: string
  counter?: boolean
  maxlength?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { rootAttrs, controlAttrs } = useFieldAttrs()
const id = nextFieldId('ui-input')
const el = ref<HTMLInputElement | null>(null)

defineExpose({ focus: () => el.value?.focus() })

const hasValue = computed(() => String(props.modelValue ?? '') !== '')
const counterText = computed(() =>
  props.counter && props.maxlength ? `${String(props.modelValue ?? '').length} / ${props.maxlength}` : '',
)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>
