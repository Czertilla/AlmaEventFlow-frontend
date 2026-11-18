<template>
  <img class="default-avatar" :class="{ 'default-avatar--square': kind !== 'user' }" :src="src" :style="style" alt="" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { defaultAvatarUri, type AvatarKind } from '@/utils/defaultAvatar'

const props = withDefaults(defineProps<{
  kind: AvatarKind
  seed: string
  size?: number
}>(), { size: 40 })

const src = computed(() => defaultAvatarUri(props.kind, props.seed))
const style = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
</script>

<style scoped>
.default-avatar {
  border-radius: 50%;
  flex-shrink: 0;
  display: block;
  object-fit: cover;
}

.default-avatar--square {
  border-radius: var(--radius-md);
}
</style>
