<template>
  <button
    class="comment-chip"
    :class="{ 'comment-chip--disabled': !!verified, 'comment-chip--filled': !!comment }"
    @click.stop="openEditor"
  >
    <ion-icon :icon="comment ? chatbubble : chatbubbleOutline" />
    <span class="comment-chip-label">{{ comment ? truncated : 'Комментарий' }}</span>
    <span
      v-if="comment && !verified"
      class="comment-chip-delete"
      role="button"
      aria-label="Удалить комментарий"
      @click.stop="handleDelete"
    >
      <ion-icon :icon="closeOutline" />
    </span>
  </button>

  <ion-modal :is-open="editorOpen" class="comment-modal" @ion-modal-did-dismiss="editorOpen = false">
    <div class="comment-editor">
      <div class="comment-editor-header">
        <h3>Комментарий</h3>
        <button class="comment-editor-close" aria-label="Закрыть" @click="editorOpen = false">
          <ion-icon :icon="closeOutline" />
        </button>
      </div>
      <textarea
        ref="textareaRef"
        v-model="draft"
        class="comment-editor-input"
        rows="4"
        maxlength="512"
        placeholder="Напишите комментарий..."
        :readonly="!!verified"
      />
      <div class="comment-editor-footer">
        <span class="comment-editor-count">{{ draft.length }}/512</span>
        <div class="comment-editor-actions">
          <button class="editor-btn editor-btn--ghost" @click="editorOpen = false">{{ verified ? 'Закрыть' : 'Отмена' }}</button>
          <button v-if="!verified" class="editor-btn editor-btn--primary" @click="save">Сохранить</button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { IonIcon, IonModal } from '@ionic/vue'
import { chatbubbleOutline, chatbubble, closeOutline } from 'ionicons/icons'
import { confirmAction } from '@/utils/confirm'

const props = defineProps<{
  comment: string | null | undefined
  verified: boolean | null | undefined
}>()

const emit = defineEmits<{
  save: [comment: string]
  delete: []
}>()

const editorOpen = ref(false)
const draft = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const truncated = computed(() => {
  if (!props.comment) return ''
  return props.comment.length > 16 ? props.comment.slice(0, 16) + '…' : props.comment
})

function openEditor() {
  // Verified with comment → readonly view; verified without comment → do nothing
  if (props.verified && !props.comment) return
  draft.value = props.comment || ''
  editorOpen.value = true
  nextTick(() => textareaRef.value?.focus())
}

async function handleDelete() {
  if (await confirmAction('Удалить комментарий?', 'Комментарий будет удалён без возможности восстановления.')) {
    emit('delete')
  }
}

function save() {
  editorOpen.value = false
  const value = draft.value.trim()
  if (value !== (props.comment || '')) {
    emit('save', value)
  }
}
</script>

<style scoped>
.comment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid var(--ion-border-color);
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
  max-width: 220px;
}

.comment-chip ion-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.comment-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-chip:not(.comment-chip--disabled):hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.comment-chip--filled {
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  border-color: rgba(var(--ion-color-primary-rgb), 0.3);
  color: var(--ion-color-primary);
}

.comment-chip--disabled {
  cursor: default;
  opacity: 0.55;
}

.comment-chip-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.15s;
}

.comment-chip-delete:hover {
  background: rgba(255, 71, 87, 0.15);
  color: var(--ion-color-danger);
}

/* На мобильных — только иконка, текст скрыт */
@media (max-width: 480px) {
  .comment-chip {
    padding: 7px;
  }
  .comment-chip ion-icon {
    font-size: 16px;
  }
  .comment-chip-label {
    display: none;
  }
}

.comment-modal {
  --width: min(440px, calc(100vw - 32px));
  --height: auto;
  --border-radius: 20px;
  --box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
}

.comment-editor {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--ion-card-background);
}

.comment-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-editor-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.comment-editor-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--ion-background-color);
  color: var(--ion-color-medium);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s;
}

.comment-editor-close:hover {
  background: var(--ion-border-color);
}

.comment-editor-input {
  width: 100%;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  font-family: inherit;
  color: var(--ion-text-color);
  background: var(--ion-background-color);
  resize: vertical;
  min-height: 96px;
  outline: none;
  transition: border-color 0.2s;
}

.comment-editor-input:focus {
  border-color: var(--ion-color-primary);
}

.comment-editor-input[readonly] {
  background: var(--ion-color-step-50, #f4f5f8);
  cursor: default;
  color: var(--ion-color-medium);
}

.comment-editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-editor-count {
  font-size: 12px;
  color: var(--ion-color-step-400);
}

.comment-editor-actions {
  display: flex;
  gap: 8px;
}

.editor-btn {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.editor-btn--ghost {
  background: transparent;
  color: var(--ion-color-medium);
}

.editor-btn--ghost:hover {
  background: var(--ion-background-color);
}

.editor-btn--primary {
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
}

.editor-btn--primary:hover {
  box-shadow: 0 4px 12px rgba(var(--ion-color-primary-rgb), 0.3);
}
</style>
