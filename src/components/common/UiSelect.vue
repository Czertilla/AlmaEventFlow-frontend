<template>
  <UiField
    v-bind="rootAttrs()"
    :label="label"
    :float="floated"
    :invalid="invalid"
    :disabled="disabled"
    :error="error"
    :hint="hint"
  >
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="ui-field-control ui-select-trigger"
      v-bind="controlAttrs()"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="select.open.value"
      :aria-controls="select.listboxId"
      :aria-activedescendant="select.open.value ? `${select.listboxId}-${select.activeIndex.value}` : undefined"
      :disabled="disabled"
      @click="select.toggle"
      @keydown="select.onKeydown"
    >
      <span v-if="select.selectedOption.value" class="ui-select-value">{{ select.selectedOption.value.label }}</span>
      <span v-else class="ui-select-placeholder">{{ placeholder }}</span>
    </button>
    <template #suffix>
      <ion-icon class="ui-field-chevron" :class="{ 'ui-field-chevron--open': select.open.value }" :icon="chevronDownOutline" />
    </template>
  </UiField>
  <UiSelectMenu
    :open="select.open.value"
    :anchor="anchor"
    :options="options"
    :selected-index="select.selectedIndex.value"
    :active-index="select.activeIndex.value"
    :listbox-id="select.listboxId"
    @choose="select.choose"
    @hover="select.activeIndex.value = $event"
    @close="select.closeMenu"
  />
</template>

<script setup lang="ts" generic="T extends string | number | null">
import { computed, onMounted, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { chevronDownOutline } from 'ionicons/icons'
import UiField from '@/components/common/UiField.vue'
import UiSelectMenu from '@/components/common/UiSelectMenu.vue'
import { nextFieldId, useFieldAttrs } from '@/composables/useFieldAttrs'
import { useSelect } from '@/composables/useSelect'
import type { SelectOption } from '@/utils/selectOptions'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: T
  options: SelectOption<T>[]
  label?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  error?: string
  hint?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const { rootAttrs, controlAttrs } = useFieldAttrs()
const id = nextFieldId('ui-select')
const trigger = ref<HTMLButtonElement | null>(null)
const anchor = ref<HTMLElement | null>(null)

const select = useSelect<T>({
  options: () => props.options,
  value: () => props.modelValue,
  disabled: () => !!props.disabled,
  onSelect: (value) => emit('update:modelValue', value),
})

const floated = computed(() => !!select.selectedOption.value || select.open.value || !!props.placeholder)

onMounted(() => {
  select.triggerEl.value = trigger.value
  anchor.value = trigger.value?.closest<HTMLElement>('.ui-field-box') ?? trigger.value
})

watch(trigger, (el) => { select.triggerEl.value = el })
</script>
