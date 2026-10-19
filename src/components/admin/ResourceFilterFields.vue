<template>
  <div class="rtf">
    <div v-for="f in filters" :key="f.key" class="rtf-field">
      <UiSelect
        v-if="f.type === 'select'"
        :model-value="values[f.key]"
        :label="f.label"
        :options="filterOptions(f)"
        @update:model-value="emit('set', f.key, $event)"
      />
      <SearchPicker
        v-else-if="f.type === 'picker' && f.picker"
        :model-value="values[f.key] || null"
        :label="f.label"
        placeholder="Поиск…"
        :fetch="PICKERS[f.picker].search"
        :resource="PICKERS[f.picker].kind"
        @update:model-value="emit('set', f.key, $event ?? '')"
      />
      <label v-else-if="f.type === 'toggle'" class="ui-toggle-row">
        <span>{{ f.label }}</span>
        <ion-toggle :checked="values[f.key] === true" mode="md" @ion-change="onToggle(f.key, $event)" />
      </label>
      <DateTimeField
        v-else-if="f.type === 'date'"
        :model-value="values[f.key]"
        mode="date"
        :label="f.label"
        @update:model-value="emit('set', f.key, $event)"
      />
    </div>
    <button v-if="activeCount" type="button" class="rtf-reset" @click="emit('reset')">
      <ion-icon :icon="closeOutline" />
      Сбросить
    </button>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonToggle } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import SearchPicker from '@/components/admin/SearchPicker.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import type { FilterDef } from '@/components/admin/ResourceTable.vue'
import { PICKERS } from '@/utils/adminPickers'

defineProps<{
  filters: FilterDef[]
  values: Record<string, any>
  activeCount: number
}>()

const emit = defineEmits<{
  set: [key: string, value: any]
  reset: []
}>()

// Значения фильтров живут строками: так они совпадают с тем, что приходит из адресной строки.
function filterOptions(f: FilterDef) {
  return [
    { value: '', label: f.anyLabel || 'Любой' },
    ...(f.options || []).map((o) => ({ value: String(o.value), label: o.label })),
  ]
}

function onToggle(key: string, event: CustomEvent) {
  emit('set', key, !!(event.detail as { checked: boolean }).checked)
}
</script>

<style scoped>
.rtf {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 14px;
}

.rtf-field {
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.rtf-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.rtf-reset:hover {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
}

@media (min-width: 768px) {
  .rtf-field {
    flex: 1 1 200px;
    max-width: 320px;
  }
}
</style>
