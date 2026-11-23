<template>
  <button
    v-if="todo.count > 0"
    type="button"
    class="ui-todo-alert ui-attention"
    :aria-label="`Чек-лист: ${todo.count}`"
    title="Чек-лист"
    @click="todo.isOpen = true"
  >
    <ion-icon :icon="checkboxOutline" />
    <span class="ui-todo-alert-count">{{ todo.count }}</span>
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { checkboxOutline } from 'ionicons/icons'
import { useTodoStore } from '@/stores/todo'

const todo = useTodoStore()
</script>
