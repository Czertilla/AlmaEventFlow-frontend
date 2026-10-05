<template>
  <div
    ref="root"
    class="ui-field"
    :class="{
      'ui-field--labeled': !!label,
      'ui-field--float': floated,
      'ui-field--focus': focused,
      'ui-field--invalid': isInvalid,
      'ui-field--disabled': disabled,
      'ui-field--prefix': !!$slots.prefix,
      'ui-field--suffix': !!$slots.suffix,
    }"
    @focusin="focused = true"
    @focusout="onFocusOut"
  >
    <div class="ui-field-box">
      <span v-if="$slots.prefix" class="ui-field-prefix"><slot name="prefix" /></span>
      <div class="ui-field-main"><slot /></div>
      <span v-if="$slots.suffix" class="ui-field-suffix"><slot name="suffix" /></span>
      <label v-if="label" class="ui-field-label" :for="forId">{{ label }}</label>
      <fieldset class="ui-field-outline" aria-hidden="true">
        <legend v-if="label"><span>{{ label }}</span></legend>
      </fieldset>
    </div>
    <div v-if="message || counter" class="ui-field-foot">
      <span
        v-if="message"
        class="ui-field-message"
        :class="{ 'ui-field-message--error': !!error, 'ui-field-message--success': !error && !!success }"
        >{{ message }}</span
      >
      <span v-if="counter" class="ui-field-counter">{{ counter }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  label?: string
  float?: boolean
  filled?: boolean
  invalid?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  success?: string
  counter?: string
  forId?: string
}>()

const root = ref<HTMLElement | null>(null)
const focused = ref(false)

const floated = computed(() => !!props.float || !!props.filled || focused.value)
const isInvalid = computed(() => !!props.invalid || !!props.error)
const message = computed(() => props.error || props.success || props.hint || '')

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !root.value?.contains(next)) focused.value = false
}
</script>
