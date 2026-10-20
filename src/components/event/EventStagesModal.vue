<template>
  <ion-modal :is-open="open" @ion-modal-did-dismiss="close">
    <ion-header>
      <ion-toolbar>
        <ion-title>Этапы мероприятия</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Закрыть" @click="close">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="form">
        <template v-if="loading">
          <div v-for="n in 2" :key="n" class="skeleton stage-skeleton" aria-busy="true" />
        </template>
        <template v-else>
          <p v-if="stageForms.length === 0" class="card-empty">Этапов пока нет</p>
          <StageFields
            v-for="(s, i) in stageForms"
            :key="s.id ?? `new-${i}`"
            v-model="stageForms[i]"
            :start-suggestion="stageStartSuggestion(i)"
            :auto-name="stageAutoNameList[i]"
            @remove="deleteStage(i)"
          >
            <ion-button
              size="small"
              expand="block"
              :disabled="pending || !stageNameList[i] || !s.start_at || stageEndBeforeStart(s) || !stageIsDirty(s)"
              @click="saveStage(i)"
            >
              {{ s.id ? 'Сохранить этап' : 'Добавить этап' }}
            </ion-button>
          </StageFields>
          <button class="add-stage-btn" @click="addStageRow">
            <ion-icon :icon="addOutline" />
            Добавить этап
          </button>
        </template>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonHeader, IonToolbar, IonButtons, IonTitle, IonContent, IonButton, IonIcon, IonModal } from '@ionic/vue'
import { addOutline, closeOutline } from 'ionicons/icons'
import { format as fnsFormat } from 'date-fns'
import type { StageCreateData, StagePatchData, StageRead } from '@/api/generated/almaEventFlow'
import StageFields from '@/components/event/StageFields.vue'
import { useToast } from '@/composables/useToast'
import { confirmAction } from '@/utils/confirm'
import { stageAutoNames, stageEffectiveNames, stageEndBeforeStart } from '@/utils/stages'

export interface StageApi {
  list: () => Promise<StageRead[]>
  create: (body: StageCreateData) => Promise<unknown>
  patch: (stageId: string, body: StagePatchData) => Promise<unknown>
  remove: (stageId: string) => Promise<unknown>
}

interface StageForm { id?: string; name: string; start_at: string; end_at: string; description: string }

const props = defineProps<{
  open: boolean
  /** Дата мероприятия: подсказка для начала первого этапа */
  eventDate?: string | null
  api: StageApi
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  changed: [stages: StageRead[]]
}>()

const { showSuccess, showError } = useToast()

const loading = ref(false)
const pending = ref(false)
const stageForms = ref<StageForm[]>([])
const stageAutoNameList = computed(() => stageAutoNames(stageForms.value))
const stageNameList = computed(() => stageEffectiveNames(stageForms.value))
const originals = new Map<string, string>()

function toLocalInput(iso: string): string {
  return fnsFormat(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

function toTzIso(localInput: string): string {
  return fnsFormat(new Date(localInput), "yyyy-MM-dd'T'HH:mm:ssxxx")
}

function snapshot(s: StageForm): string {
  return JSON.stringify({ name: s.name, start_at: s.start_at, end_at: s.end_at, description: s.description })
}

function stageIsDirty(s: StageForm): boolean {
  if (!s.id) return true
  return originals.get(s.id) !== snapshot(s)
}

function mapToForms(stages: StageRead[]) {
  originals.clear()
  stageForms.value = stages.map((s) => {
    const form: StageForm = {
      id: s.id,
      name: s.name,
      start_at: s.start_at ? toLocalInput(s.start_at) : '',
      end_at: s.end_at ? toLocalInput(s.end_at) : '',
      description: s.description ?? '',
    }
    originals.set(s.id, snapshot(form))
    return form
  })
}

async function refresh() {
  const stages = await props.api.list()
  mapToForms(stages)
  emit('changed', stages)
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  loading.value = true
  try {
    mapToForms(await props.api.list())
  } catch (err) {
    showError(err, 'Не удалось загрузить этапы')
    stageForms.value = []
  } finally {
    loading.value = false
  }
})

function close() {
  emit('update:open', false)
}

function stageStartSuggestion(index: number): string {
  const prev = stageForms.value[index - 1]
  return prev?.end_at || prev?.start_at || props.eventDate || ''
}

function addStageRow() {
  const prev = stageForms.value[stageForms.value.length - 1]
  stageForms.value.push({ name: '', start_at: prev?.end_at ?? '', end_at: '', description: '' })
}

async function saveStage(i: number) {
  const s = stageForms.value[i]
  const name = stageNameList.value[i]
  if (!name || !s.start_at || stageEndBeforeStart(s)) return
  pending.value = true
  try {
    const body = {
      name,
      start_at: toTzIso(s.start_at),
      end_at: s.end_at ? toTzIso(s.end_at) : null,
      description: s.description || null,
      // IANA-имя зоны этого браузера: offset в start_at/end_at уже даёт корректный
      // момент, но только имя зоны позволяет каналам без собственного рендера
      // (сообщение в Telegram) показать то время, что имел в виду автор.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    if (s.id) await props.api.patch(s.id, body)
    else await props.api.create(body)
    await refresh()
    showSuccess('Этап сохранён', 1500)
  } catch (err) {
    showError(err, 'Не удалось сохранить этап')
  } finally {
    pending.value = false
  }
}

async function deleteStage(i: number) {
  const s = stageForms.value[i]
  if (!s.id) {
    stageForms.value.splice(i, 1)
    return
  }
  const ok = await confirmAction('Удалить этап?', `Этап «${s.name || 'без названия'}» будет удалён.`)
  if (!ok) return
  pending.value = true
  try {
    await props.api.remove(s.id)
    await refresh()
  } catch (err) {
    showError(err, 'Не удалось удалить этап')
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
  margin: 0 auto;
}

.card-empty {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-step-400);
}

.stage-skeleton {
  height: 168px;
  border-radius: var(--radius-lg);
}

.add-stage-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 8px 14px;
  border: var(--border-w) dashed var(--ion-border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.15s;
}

.add-stage-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}
</style>
