<template>
  <div class="epf">
    <UiField v-if="selected" :label="label" float :hint="hint" :help="help">
      <template v-if="icon" #prefix><ion-icon :icon="icon" /></template>
      <span class="ui-field-value">
        <span v-if="loading" class="skeleton skeleton--text epf-skeleton" aria-busy="true" />
        <template v-else>{{ selected.name }}</template>
      </span>
      <template #suffix>
        <ion-icon v-if="locked" :icon="lockClosedOutline" class="epf-lock" aria-label="Заполнено автоматически" />
        <button v-else type="button" class="ui-icon-btn ui-icon-btn--danger" :aria-label="clearLabel" @click="emit('clear')">
          <ion-icon :icon="closeOutline" />
        </button>
      </template>
    </UiField>
    <template v-else>
      <div ref="anchor">
        <UiInput
          :model-value="search"
          :label="label"
          :placeholder="placeholder"
          autocomplete="off"
          :disabled="disabled"
          :hint="hint"
          :help="help"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="listOpen"
          :aria-controls="listboxId"
          :aria-activedescendant="listOpen && nav.active.value >= 0 ? `${listboxId}-${nav.active.value}` : undefined"
          @update:model-value="onSearch"
          @focus="onFocus"
          @keydown="onKeydown"
        >
          <template #prefix><ion-icon :icon="searchOutline" /></template>
        </UiInput>
      </div>
      <UiSelectMenu
        :open="listOpen"
        :anchor="anchor"
        :options="menuOptions"
        :selected-index="-1"
        :active-index="nav.active.value"
        :listbox-id="listboxId"
        @choose="choose"
        @hover="nav.active.value = $event"
        @close="dismissed = true"
      />
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends PickerOption">
import { computed, onBeforeUnmount, ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { closeOutline, lockClosedOutline, searchOutline } from 'ionicons/icons'
import UiField from '@/components/common/UiField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelectMenu from '@/components/common/UiSelectMenu.vue'
import { useComboNav } from '@/composables/useComboNav'
import { nextFieldId } from '@/composables/useFieldAttrs'
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
    /** Имя выбранного ещё грузится: вместо него скелетон, а не голый id */
    loading?: boolean
    disabled?: boolean
    hint?: string
    help?: string
    /** Выбранное нельзя убрать: его задаёт другое поле */
    locked?: boolean
  }>(),
  {
    placeholder: 'Поиск…', clearLabel: 'Убрать', icon: undefined, debounce: 400,
    loading: false, disabled: false, hint: undefined, help: undefined, locked: false,
  },
)

const emit = defineEmits<{
  'update:search': [value: string]
  search: []
  focus: []
  select: [option: T]
  clear: []
}>()

const listboxId = nextFieldId('ui-listbox')
const anchor = ref<HTMLElement | null>(null)
const dismissed = ref(false)
const nav = useComboNav(computed(() => props.options.length))
const menuOptions = computed(() => props.options.map((option) => ({ value: option.id, label: option.name })))
const listOpen = computed(() => props.options.length > 0 && !dismissed.value)

let timer: ReturnType<typeof setTimeout> | undefined

function onSearch(value: string) {
  dismissed.value = false
  emit('update:search', value)
  clearTimeout(timer)
  timer = setTimeout(() => emit('search'), props.debounce)
}

function onFocus() {
  dismissed.value = false
  emit('focus')
}

function choose(index: number) {
  const option = props.options[index]
  if (option) emit('select', option)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!props.options.length) return
    event.preventDefault()
    if (dismissed.value) dismissed.value = false
    else if (event.key === 'ArrowDown') nav.next()
    else nav.prev()
  } else if (event.key === 'Enter' && listOpen.value && nav.active.value >= 0) {
    event.preventDefault()
    choose(nav.active.value)
  } else if (event.key === 'Escape' && listOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    dismissed.value = true
  } else if (event.key === 'Tab') {
    dismissed.value = true
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.epf-skeleton {
  width: 55%;
  height: 14px;
}

.epf-lock {
  font-size: var(--fs-lg);
  color: var(--ion-color-medium);
}
</style>
