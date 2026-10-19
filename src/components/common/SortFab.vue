<template>
  <AppFab
    ref="fab"
    :secondary="secondary"
    :stack="stack"
    :tucked="tucked && !open"
    :icon="swapVerticalOutline"
    :aria-label="label"
    @click="open = !open"
  />
  <UiSelectMenu
    :open="open"
    :anchor="anchor"
    :options="items"
    :selected-index="selectedIndex"
    :active-index="active"
    :listbox-id="listboxId"
    align="end"
    :min-width="220"
    @choose="choose"
    @hover="active = $event"
    @close="open = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { arrowDownOutline, arrowUpOutline, swapVerticalOutline } from 'ionicons/icons'
import AppFab from '@/components/common/AppFab.vue'
import UiSelectMenu from '@/components/common/UiSelectMenu.vue'
import { nextFieldId } from '@/composables/useFieldAttrs'
import type { SelectOption } from '@/utils/selectOptions'

const ORDER = Symbol('order')

const props = withDefaults(
  defineProps<{
    options: SelectOption<string>[]
    modelValue: string
    order: 'asc' | 'desc'
    label?: string
    secondary?: boolean
    stack?: number
    tucked?: boolean
  }>(),
  { label: 'Сортировка', secondary: true, stack: 0, tucked: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:order': [value: 'asc' | 'desc']
}>()

const fab = ref<InstanceType<typeof AppFab> | null>(null)
const open = ref(false)
const active = ref(-1)
const listboxId = nextFieldId('ui-listbox')

const anchor = computed<HTMLElement | null>(() => (fab.value?.$el as HTMLElement | undefined) ?? null)
const selectedIndex = computed(() => props.options.findIndex((option) => option.value === props.modelValue))
const items = computed<SelectOption<string | symbol>[]>(() => [
  ...props.options.map((option) => ({ value: option.value, label: option.label })),
  {
    value: ORDER as string | symbol,
    label: props.order === 'asc' ? 'По возрастанию' : 'По убыванию',
    icon: props.order === 'asc' ? arrowUpOutline : arrowDownOutline,
    disabled: selectedIndex.value < 0,
  },
])

function choose(index: number) {
  const item = items.value[index]
  if (!item || item.disabled) return
  if (item.value === ORDER) {
    emit('update:order', props.order === 'asc' ? 'desc' : 'asc')
    return
  }
  emit('update:modelValue', item.value as string)
  open.value = false
}
</script>
