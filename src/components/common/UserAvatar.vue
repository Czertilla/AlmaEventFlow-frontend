<template>
  <DefaultAvatar v-if="seed" kind="user" :seed="seed" :size="size" />
  <div v-else class="user-avatar" :style="style">{{ initials }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getInitials } from '@/utils/names'
import { userAvatarSeed } from '@/utils/defaultAvatar'
import DefaultAvatar from '@/components/common/DefaultAvatar.vue'

const props = withDefaults(defineProps<{
  user?: { id?: string | null; person_id?: string | null; username?: string | null; email?: string | null } | null
  size?: number
}>(), { size: 40 })

const initials = computed(() => getInitials(props.user))
const seed = computed(() => (props.user ? userAvatarSeed(props.user) : null))

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.35)}px`,
}))
</script>

<style scoped>
.user-avatar {
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: #fff;
  font-weight: var(--fw-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}
</style>
