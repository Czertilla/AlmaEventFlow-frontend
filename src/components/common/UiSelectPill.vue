<template>
  <div class="ui-select-pill" :class="[`ui-select-pill--${size}`, { 'ui-select-pill--open': select.open.value, 'ui-select-pill--set': highlighted }]">
    <button
      ref="trigger"
      type="button"
      class="ui-select-pill-btn"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      :aria-expanded="select.open.value"
      :aria-controls="select.listboxId"
      :aria-activedescendant="select.open.value ? `${select.listboxId}-${select.activeIndex.value}` : undefined"
      :disabled="disabled"
      @click="select.toggle"
      @keydown="select.onKeydown"
    >
      <ion-icon v-if="icon" class="ui-select-pill-icon" :icon="icon" />
      <span class="ui-select-pill-value">{{ select.selectedOption.value?.label ?? placeholder }}</span>
      <ion-icon class="ui-select-pill-chevron" :icon="chevronDownOutline" />
    </button>
    <slot />
  </div>
  <UiSelectMenu
    :open="select.open.value"
    :anchor="anchor"
    :options="options"
    :selected-index="select.selectedIndex.value"
    :active-index="select.activeIndex.value"
    :listbox-id="select.listboxId"
    :min-width="menuMinWidth"
    :align="align"
    @choose="select.choose"
    @hover="select.activeIndex.value = $event"
    @close="select.closeMenu"
  />
</template>

<script setup lang="ts" generic="T extends string | number | null">
import { onMounted, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { chevronDownOutline } from 'ionicons/icons'
import UiSelectMenu from '@/components/common/UiSelectMenu.vue'
import { useSelect } from '@/composables/useSelect'
import type { SelectOption } from '@/utils/selectOptions'

const props = withDefaults(
  defineProps<{
    modelValue?: T
    options: SelectOption<T>[]
    ariaLabel: string
    icon?: string
    placeholder?: string
    size?: 'md' | 'sm'
    align?: 'start' | 'end'
    menuMinWidth?: number
    disabled?: boolean
    /** Подсветить пилюлю, когда выбрано не значение «по умолчанию» (для фильтров) */
    highlighted?: boolean
  }>(),
  { size: 'md', align: 'start', menuMinWidth: 180, placeholder: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const anchor = ref<HTMLElement | null>(null)

const select = useSelect<T>({
  options: () => props.options,
  value: () => props.modelValue,
  disabled: () => !!props.disabled,
  onSelect: (value) => emit('update:modelValue', value),
})

onMounted(() => {
  select.triggerEl.value = trigger.value
  anchor.value = trigger.value?.parentElement ?? trigger.value
})

watch(trigger, (el) => { select.triggerEl.value = el })
</script>
