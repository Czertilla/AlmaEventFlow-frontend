<template>
  <button
    ref="trigger"
    type="button"
    class="ui-icon-btn"
    :class="{ 'ui-icon-btn--active': select.open.value }"
    aria-haspopup="listbox"
    :aria-expanded="select.open.value"
    :aria-controls="select.listboxId"
    :aria-label="label"
    :title="label"
    @click="select.toggle"
    @keydown="select.onKeydown"
  >
    <ion-icon :icon="ellipsisHorizontalOutline" />
  </button>
  <UiSelectMenu
    :open="select.open.value"
    :anchor="trigger"
    :options="options"
    :selected-index="-1"
    :active-index="select.activeIndex.value"
    :listbox-id="select.listboxId"
    align="end"
    :min-width="200"
    @choose="select.choose"
    @hover="select.activeIndex.value = $event"
    @close="select.closeMenu"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { ellipsisHorizontalOutline } from 'ionicons/icons'
import UiSelectMenu from '@/components/common/UiSelectMenu.vue'
import { useSelect } from '@/composables/useSelect'

export interface RowAction {
  label: string
  icon: string
  run: () => void
}

const props = withDefaults(defineProps<{ actions: RowAction[]; label?: string }>(), { label: 'Ещё' })

const trigger = ref<HTMLButtonElement | null>(null)
const options = computed(() => props.actions.map((action, index) => ({ value: index, label: action.label, icon: action.icon })))

const select = useSelect<number>({
  options: () => options.value,
  value: () => undefined,
  disabled: () => false,
  onSelect: (index) => props.actions[index]?.run(),
})

watch(trigger, (el) => { select.triggerEl.value = el }, { immediate: true })
</script>
