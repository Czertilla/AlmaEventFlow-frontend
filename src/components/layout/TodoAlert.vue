<template>
  <button
    v-if="todo.count > 0"
    type="button"
    class="ui-todo-alert ui-attention"
    :aria-label="`Что сделать: ${todo.count}`"
    @click="todo.isOpen = true"
  >
    <ion-icon :icon="alertCircleOutline" />
    <span>{{ todo.count }}</span>
    <span class="ta-label">Что сделать</span>
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { alertCircleOutline } from 'ionicons/icons'
import { useTodoStore } from '@/stores/todo'

const todo = useTodoStore()
</script>

<style scoped>
@media (max-width: 420px) {
  .ta-label {
    display: none;
  }
}
</style>
