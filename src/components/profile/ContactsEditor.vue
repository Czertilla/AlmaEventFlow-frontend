<template>
  <div class="ce">
    <ul v-if="rows.length" class="ce-list">
      <li v-for="row in rows" :key="row.key">
        <UiInput
          v-model="row.value"
          :label="typeLabel(row.type)"
          :type="kindOf(row.type)?.inputType"
          :inputmode="kindOf(row.type)?.inputmode"
          :maxlength="kindOf(row.type)?.maxlength ?? 256"
          :error="errors?.[row.key]"
        >
          <template #suffix>
            <button
              type="button"
              class="ui-icon-btn"
              :class="{ 'ui-icon-btn--primary': row.is_main }"
              :title="row.is_main ? 'Основной' : 'Сделать основным'"
              :aria-label="row.is_main ? 'Основной контакт' : 'Сделать основным'"
              :aria-pressed="row.is_main"
              @click="makeMain(row)"
            >
              <ion-icon :icon="row.is_main ? star : starOutline" />
            </button>
            <button type="button" class="ui-icon-btn ui-icon-btn--danger" title="Убрать" aria-label="Убрать контакт" @click="remove(row)">
              <ion-icon :icon="trashOutline" />
            </button>
          </template>
        </UiInput>
      </li>
    </ul>

    <UiSelect
      v-if="!draftKind"
      v-model="draftType"
      label="Добавить контакт"
      :options="CONTACT_TYPE_OPTIONS"
      @update:model-value="onDraftType"
    />

    <div v-else class="ce-draft">
      <UiInput
        ref="draftInput"
        v-model="draftValue"
        :label="draftKind.label"
        :type="draftKind.inputType"
        :inputmode="draftKind.inputmode"
        :autocomplete="draftKind.autocomplete"
        :placeholder="draftKind.placeholder"
        :maxlength="draftKind.maxlength"
        :error="draftError"
        :help="draftHelp"
        @keydown.enter.prevent="addDraft"
      />
      <div class="ce-actions">
        <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="addDraft">Добавить</button>
        <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="cancelDraft">Отмена</button>
      </div>
    </div>

    <button v-if="suggestsAccountEmail && !draftKind" type="button" class="ui-btn ui-btn--ghost ui-btn--sm ce-account" @click="addAccountEmail">
      <ion-icon :icon="mailOutline" /> Добавить почту аккаунта: {{ accountEmail }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { IonIcon } from '@ionic/vue'
import { mailOutline, star, starOutline, trashOutline } from 'ionicons/icons'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import { CONTACT_TYPE_OPTIONS, contactError, contactKind, contactTypeLabels, normalizeContact } from '@/utils/contactTypes'

export interface ContactRow { key: number; id?: string; type: string; value: string; is_main: boolean }

const props = defineProps<{
  accountEmail?: string | null
  errors?: Record<number, string>
}>()

const rows = defineModel<ContactRow[]>({ required: true })

const draftType = ref('')
const draftValue = ref('')
const draftError = ref('')
const draftInput = ref<InstanceType<typeof UiInput> | null>(null)

const draftKind = computed(() => contactKind(draftType.value))
const hasType = (type: string) => rows.value.some((row) => row.type === type)
const draftHelp = computed(() =>
  hasType(draftType.value)
    ? 'Основным останется прежний контакт. Сменить его можно звёздочкой в списке.'
    : 'Станет основным: это первый контакт такого вида.',
)
const hasAccountEmail = computed(() => {
  const mine = props.accountEmail?.trim().toLowerCase()
  return !!mine && rows.value.some((row) => row.type === 'email' && row.value.trim().toLowerCase() === mine)
})
const suggestsAccountEmail = computed(() => !!props.accountEmail && !hasAccountEmail.value)

const typeLabel = (type: string) => contactTypeLabels[type] ?? type
const kindOf = (type: string) => contactKind(type)

function nextKey(): number {
  return Math.max(0, ...rows.value.map((row) => row.key)) + 1
}

function add(type: string, value: string) {
  rows.value = [...rows.value, { key: nextKey(), type, value, is_main: !hasType(type) }]
}

function onDraftType(type: string | number | null) {
  draftError.value = ''
  draftValue.value = type === 'email' && suggestsAccountEmail.value ? (props.accountEmail ?? '') : ''
  nextTick(() => draftInput.value?.focus())
}

function addDraft() {
  const error = contactError(draftType.value, draftValue.value)
  if (error) {
    draftError.value = error
    return
  }
  const value = normalizeContact(draftType.value, draftValue.value)
  if (rows.value.some((row) => row.type === draftType.value && normalizeContact(row.type, row.value) === value)) {
    draftError.value = 'Такой контакт уже есть в списке'
    return
  }
  add(draftType.value, value)
  cancelDraft()
}

function cancelDraft() {
  draftType.value = ''
  draftValue.value = ''
  draftError.value = ''
}

function addAccountEmail() {
  if (props.accountEmail) add('email', props.accountEmail.trim())
}

function makeMain(row: ContactRow) {
  rows.value = rows.value.map((item) => (item.type === row.type ? { ...item, is_main: item.key === row.key } : item))
}

function remove(row: ContactRow) {
  const rest = rows.value.filter((item) => item.key !== row.key)
  const sameType = rest.filter((item) => item.type === row.type)
  rows.value = row.is_main && sameType.length
    ? rest.map((item) => (item.key === sameType[0].key ? { ...item, is_main: true } : item))
    : rest
}
</script>

<style scoped>
.ce {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ce-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ce-draft {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ce-actions {
  display: flex;
  gap: 8px;
}

.ce-account {
  align-self: flex-start;
}
</style>
