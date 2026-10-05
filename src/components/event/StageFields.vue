<template>
  <div class="stage-fields">
    <div class="stage-fields-row">
      <UiInput
        class="stage-fields-name"
        label="Название этапа"
        counter
        :model-value="modelValue.name"
        :placeholder="stageNamePlaceholder(modelValue)"
        :maxlength="STAGE_NAME_MAX"
        @update:model-value="patch({ name: $event })"
      />
      <button
        type="button"
        class="ui-icon-btn ui-icon-btn--danger stage-fields-remove"
        title="Удалить этап"
        aria-label="Удалить этап"
        @click="emit('remove')"
      >
        <ion-icon :icon="trashOutline" />
      </button>
    </div>
    <div class="stage-fields-row stage-fields-range">
      <DateTimeField
        label="Начало"
        title="Начало этапа"
        mode="datetime"
        :model-value="modelValue.start_at"
        :suggest="startSuggestion"
        @update:model-value="patch({ start_at: $event })"
      />
      <DateTimeField
        label="Окончание"
        title="Окончание этапа"
        mode="datetime"
        :model-value="modelValue.end_at"
        :suggest="modelValue.start_at"
        :min="modelValue.start_at"
        :error="stageEndBeforeStart(modelValue) ? 'Окончание не может быть раньше начала' : ''"
        @update:model-value="patch({ end_at: $event })"
      />
    </div>
    <UiTextarea
      label="Описание этапа (необязательно)"
      counter
      :rows="2"
      :model-value="modelValue.description"
      :maxlength="STAGE_DESCRIPTION_MAX"
      @update:model-value="patch({ description: $event })"
    />
    <slot />
  </div>
</template>

<script setup lang="ts" generic="T extends StageDraft">
import { IonIcon } from '@ionic/vue'
import { trashOutline } from 'ionicons/icons'
import DateTimeField from '@/components/common/DateTimeField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import {
  STAGE_DESCRIPTION_MAX,
  STAGE_NAME_MAX,
  stageEndBeforeStart,
  stageNamePlaceholder,
  type StageDraft,
} from '@/utils/stages'

const props = defineProps<{ modelValue: T; startSuggestion?: string }>()

const emit = defineEmits<{ 'update:modelValue': [value: T]; remove: [] }>()

function patch(change: Partial<StageDraft>) {
  emit('update:modelValue', { ...props.modelValue, ...change })
}
</script>

<style scoped>
.stage-fields {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 12px 12px;
  border-radius: var(--radius-md);
  background: var(--ion-background-color);
}

.stage-fields-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.stage-fields-name {
  flex: 1;
}

.stage-fields-remove {
  margin-top: 15px;
}

.stage-fields-range > .dtf {
  flex: 1 1 0;
}

@media (max-width: 520px) {
  .stage-fields-range {
    flex-direction: column;
    align-items: stretch;
  }

  .stage-fields-range > .dtf {
    flex: none;
  }
}
</style>
