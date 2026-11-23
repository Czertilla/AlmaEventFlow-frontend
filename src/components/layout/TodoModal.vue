<template>
  <ion-modal ref="modal" :is-open="todo.isOpen" @ion-modal-did-dismiss="todo.isOpen = false">
    <div class="ui-sheet-head">
      <h3 class="ui-sheet-title">Чек-лист</h3>
      <button type="button" class="ui-icon-btn" aria-label="Закрыть" @click="close()">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>
    <ion-content class="ion-padding">
      <div v-if="todo.loading && !todo.items.length" class="td-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="!groups.length" class="td-state">
        <ion-icon :icon="checkmarkCircleOutline" class="td-done" />
        <p>Всё сделано</p>
      </div>
      <div v-else class="td-groups">
        <p v-if="todo.unavailable.length" class="td-note">Часть дел сейчас не загрузилась, показаны прежние</p>
        <section v-for="group in groups" :key="group.info.kind" class="td-group">
          <h4 class="ui-field-title">{{ group.info.title }}</h4>
          <template v-if="group.info.kind === 'attendance'">
            <EventPreview
              v-for="item in group.items"
              :key="item.id"
              :event="eventOf(item)"
              :items="marksOf(item)"
              :is-principal="principal.isPrincipal"
              @click="openEvent(eventOf(item).id)"
              @toggle-attendance="mark.toggle"
              @save-comment="mark.saveComment"
              @delete-comment="mark.deleteComment"
            />
          </template>
          <template v-else>
            <component
              :is="TODO_RENDERERS[group.info.kind]"
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              @done="onDone"
              @open-path="openPath"
            />
          </template>
        </section>
      </div>
    </ion-content>
    <div class="ui-sheet-actions">
      <button type="button" class="ui-btn ui-btn--primary" @click="close()">Готово</button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/vue'
import { checkmarkCircleOutline, closeOutline } from 'ionicons/icons'
import type { EventCard, TodoItem, TodoKind } from '@/api/generated/almaEventFlow'
import ConsentTodoCard from '@/components/access/ConsentTodoCard.vue'
import FillFieldsTodo from '@/components/access/FillFieldsTodo.vue'
import OnboardingTodo from '@/components/collective/OnboardingTodo.vue'
import EventPreview, { type CollectiveAttendanceItem } from '@/components/event/EventPreview.vue'
import { useAttendanceMark } from '@/composables/useAttendanceMark'
import { useEventCalendarStore } from '@/stores/eventCalendar'
import { usePrincipalStore } from '@/stores/principal'
import { useTodoStore } from '@/stores/todo'
import { groupTodo } from '@/utils/todoKinds'

/** Компонент на каждый тип дела, кроме отметок: они рисуются карточками мероприятий. */
const TODO_RENDERERS: Partial<Record<TodoKind, Component>> = {
  consent: ConsentTodoCard,
  fill_fields: FillFieldsTodo,
  onboarding: OnboardingTodo,
}

const router = useRouter()
const todo = useTodoStore()
const calendar = useEventCalendarStore()
const principal = usePrincipalStore()
const mark = useAttendanceMark()

const modal = ref<{ $el: HTMLIonModalElement } | null>(null)

const groups = computed(() => groupTodo(todo.items))

watch(() => todo.isOpen, (open) => {
  if (open) todo.ensureCards()
})

function eventOf(item: TodoItem): EventCard {
  const card = item.event as EventCard
  return calendar.events.find((event) => event.id === card.id) ?? card
}

function marksOf(item: TodoItem): CollectiveAttendanceItem[] {
  return (calendar.attendances.get(eventOf(item).id) ?? []) as CollectiveAttendanceItem[]
}

async function close() {
  await modal.value?.$el.dismiss?.()
  todo.isOpen = false
}

/** Модалку закрывают до перехода, иначе её подложка остаётся над новой страницей. */
async function openPath(path: string) {
  await close()
  await router.push(path)
}

function openEvent(eventId: string) {
  void openPath(`/event/${eventId}`)
}

function onDone(id: string) {
  todo.done(id)
  void todo.refresh(true)
}
</script>

<style scoped>
.td-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 56px 20px;
  color: var(--ion-color-medium);
}

.td-state p {
  margin: 0;
  font-size: var(--fs-md);
}

.td-done {
  font-size: var(--icon-hero);
  color: var(--ion-color-success);
}

.td-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.td-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.td-note {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}
</style>
