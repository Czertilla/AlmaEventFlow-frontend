<template>
  <UiField
    v-bind="rootAttrs()"
    :label="label"
    :filled="hasValue"
    :invalid="invalid"
    :disabled="disabled"
    :error="error"
    :hint="hint"
    :counter="counterText"
    :for-id="id"
  >
    <textarea
      :id="id"
      ref="el"
      class="ui-field-control"
      v-bind="controlAttrs()"
      :value="modelValue ?? ''"
      :rows="rows"
      :maxlength="maxlength"
      :disabled="disabled"
      @input="onInput"
    />
  </UiField>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiField from '@/components/common/UiField.vue'
import { nextFieldId, useFieldAttrs } from '@/composables/useFieldAttrs'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    label?: string
    rows?: number
    invalid?: boolean
    disabled?: boolean
    error?: string
    hint?: string
    counter?: boolean
    maxlength?: number
  }>(),
  { rows: 3 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { rootAttrs, controlAttrs } = useFieldAttrs()
const id = nextFieldId('ui-textarea')
const el = ref<HTMLTextAreaElement | null>(null)

defineExpose({ focus: () => el.value?.focus() })

const hasValue = computed(() => (props.modelValue ?? '') !== '')
const counterText = computed(() =>
  props.counter && props.maxlength ? `${(props.modelValue ?? '').length} / ${props.maxlength}` : '',
)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>
