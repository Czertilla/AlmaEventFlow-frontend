<template>
  <div class="pw">
    <slot name="avatar" />
    <div class="pw-who">
      <h2 class="pw-name">{{ name }}</h2>
      <div v-if="tags.length" class="pw-tags">
        <span v-for="tag in tags" :key="tag.label" class="pw-tag" :class="{ 'pw-tag--muted': tag.muted }">{{ tag.label }}</span>
      </div>
      <slot name="sub" />
    </div>
    <div v-if="$slots.actions" class="pw-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ProfileTag {
  label: string
  muted?: boolean
}

withDefaults(defineProps<{
  name: string
  tags?: ProfileTag[]
}>(), { tags: () => [] })
</script>

<style scoped>
.pw {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.pw-who {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.pw-name {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}

.pw-actions {
  display: flex;
  align-self: flex-start;
  flex-shrink: 0;
  gap: 2px;
}

.pw-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pw-tag {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-primary);
}

.pw-tag--muted {
  background: var(--ion-color-step-50, var(--ion-color-light));
  color: var(--ion-color-medium);
}
</style>
