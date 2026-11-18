<template>
  <span v-if="loading" class="resource-preview-skeleton" aria-hidden="true" />
  <span v-else class="resource-preview" :class="{ 'resource-preview--missing': !label }" :title="id ?? undefined">
    <DefaultAvatar v-if="avatarKind && id" class="resource-preview-avatar" :kind="avatarKind" :seed="id" :size="20" />
    {{ label || fallback }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useResourceLabel } from '@/composables/useResourceLabel'
import DefaultAvatar from '@/components/common/DefaultAvatar.vue'
import { avatarKindOf } from '@/utils/defaultAvatar'
import { shortId } from '@/utils/names'
import type { ResourceKind } from '@/utils/resourceLabels'

const props = defineProps<{
  kind: ResourceKind
  id: string | null | undefined
}>()

const { label, loading } = useResourceLabel(() => props.kind, () => props.id)

const avatarKind = computed(() => avatarKindOf(props.kind))
const fallback = computed(() => (props.id ? `#${shortId(props.id)}` : '—'))
</script>

<style scoped>
.resource-preview {
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.resource-preview--missing {
  color: var(--ion-color-medium);
  font-family: var(--font-mono);
  font-size: var(--fs-md);
}

.resource-preview-skeleton {
  display: inline-block;
  width: 84px;
  height: 11px;
  border-radius: 4px;
  background: var(--ion-color-step-200);
  vertical-align: middle;
  animation: resource-preview-pulse 1.4s ease-in-out infinite;
}

@keyframes resource-preview-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
</style>
