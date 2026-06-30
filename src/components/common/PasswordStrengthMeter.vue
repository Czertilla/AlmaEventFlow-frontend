<template>
  <div v-if="password" class="strength">
    <div class="strength-bar">
      <div class="strength-fill" :style="{ width: strength.percent + '%', background: strength.color }" />
    </div>
    <span class="strength-label" :style="{ color: strength.color }">{{ strength.label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { passwordStrength } from '@/utils/password'

const props = defineProps<{ password: string }>()

const strength = computed(() => passwordStrength(props.password))
</script>

<style scoped>
.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 4px 0;
}

.strength-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--ion-border-color);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-label {
  font-size: 11px;
  font-weight: 600;
  min-width: 56px;
  text-align: right;
}
</style>
