<template>
  <ion-modal :is-open="open" @ion-modal-did-dismiss="close">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ event ? 'Редактирование' : 'Новое мероприятие' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Закрыть" @click="close">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="form">
        <slot name="links" />

        <UiInput v-model="form.name" label="Название" :maxlength="EVENT_NAME_MAX" counter />

        <DateTimeField v-model="form.date" mode="date" label="Дата" title="Дата мероприятия" />

        <UiTextarea v-model="form.description" label="Описание" :rows="3" :maxlength="EVENT_DESCRIPTION_MAX" counter />

        <EntityPickerField
          v-model:search="organizerSearch"
          label="Организатор"
          placeholder="Поиск организации…"
          clear-label="Убрать организатора"
          :options="organizerOptions"
          :selected="selectedOrganizer"
          :loading="organizerLoading"
          @search="searchOrganizers"
          @select="selectOrganizer"
          @clear="clearOrganizer"
        />

        <LocationField ref="locationFieldRef" v-model="selectedLocation" label="Локация" :collective-id="collectiveId" />

        <UiSelect v-model="form.status" label="Статус" :options="STATUS_OPTIONS" />

        <UiSelect v-model="form.type" label="Тип" placeholder="Не выбран" :options="TYPE_OPTIONS" />

        <UiSelect v-model="form.level" label="Уровень" placeholder="Не выбран" :options="LEVEL_OPTIONS" />

        <UiSelect v-model="form.format" label="Формат" placeholder="Не выбран" :options="FORMAT_OPTIONS" />

        <ion-button expand="block" :disabled="saving || !form.name" @click="submit">
          {{ saving ? 'Сохранение...' : event ? 'Сохранить' : 'Создать' }}
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { IonHeader, IonToolbar, IonButtons, IonTitle, IonContent, IonButton, IonIcon, IonModal } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { listOrganizationsOrgV1OrganizationsGet, getLocationGeoV1LocationsLocationIdGet } from '@/api/generated/almaEventFlow'
import type {
  EventRead, EventStatusEnumV1, EventLevelEnumV1, EventTypeEnumV1, EventFormatEnumV1, LocationRead,
} from '@/api/generated/almaEventFlow'
import LocationField from '@/components/geo/LocationField.vue'
import DateTimeField from '@/components/common/DateTimeField.vue'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import UiInput from '@/components/common/UiInput.vue'
import UiSelect from '@/components/common/UiSelect.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import { useEntityPicker } from '@/composables/useEntityPicker'
import { useToast } from '@/composables/useToast'
import { statusOptions, levelOptions, typeOptions, formatOptions } from '@/utils/eventLabels'
import { resolveResourceLabel } from '@/utils/resourceLabels'
import { optionsFromPairs, withAny } from '@/utils/selectOptions'

export interface EventEditBody {
  name: string
  date: string | null
  description: string | null
  status: EventStatusEnumV1
  level: EventLevelEnumV1 | null
  type: EventTypeEnumV1 | null
  format: EventFormatEnumV1 | null
  organizer_id: string | null
  location_id: string | null
}

const props = defineProps<{
  open: boolean
  /** Редактируемое мероприятие; null -- создание нового */
  event: EventRead | null
  /** Коллектив, чьи прошлые места предлагаются первыми при выборе локации */
  collectiveId?: string | null
  /** Сохраняет форму: PATCH/POST выбирает вызывающий (руководитель и админ ходят в разные эндпоинты) */
  save: (body: EventEditBody) => Promise<EventRead | void>
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [event: EventRead | void]
}>()

const EVENT_NAME_MAX = 128
const EVENT_DESCRIPTION_MAX = 1024

const STATUS_OPTIONS = optionsFromPairs(statusOptions)
const TYPE_OPTIONS = withAny<EventTypeEnumV1 | null>(optionsFromPairs(typeOptions), null, 'Не выбран')
const LEVEL_OPTIONS = withAny<EventLevelEnumV1 | null>(optionsFromPairs(levelOptions), null, 'Не выбран')
const FORMAT_OPTIONS = withAny<EventFormatEnumV1 | null>(optionsFromPairs(formatOptions), null, 'Не выбран')

const { showError, showSuccess, showMessage } = useToast()

const form = reactive({
  name: '',
  date: '',
  description: '',
  status: 'draft' as EventStatusEnumV1,
  level: null as EventLevelEnumV1 | null,
  type: null as EventTypeEnumV1 | null,
  format: null as EventFormatEnumV1 | null,
})
const saving = ref(false)
const organizerLoading = ref(false)
const locationFieldRef = ref<InstanceType<typeof LocationField>>()
const selectedLocation = ref<LocationRead | null>(null)

const {
  search: organizerSearch, options: organizerOptions, selected: selectedOrganizer,
  runSearch: searchOrganizers, select: selectOrganizer, clear: clearOrganizer,
  reset: resetOrganizer,
} = useEntityPicker((params) => listOrganizationsOrgV1OrganizationsGet(params))

function close() {
  emit('update:open', false)
}

async function fill(event: EventRead | null) {
  form.name = event?.name ?? ''
  form.date = event?.date ? event.date.slice(0, 10) : ''
  form.description = event?.description ?? ''
  form.status = event?.status ?? 'draft'
  form.level = event?.level ?? null
  form.type = event?.type ?? null
  form.format = event?.format ?? null
  resetOrganizer()
  selectedLocation.value = null
  locationFieldRef.value?.reset()

  if (event?.organizer_id) {
    const id = event.organizer_id
    selectedOrganizer.value = { id, name: '' }
    organizerLoading.value = true
    const name = await resolveResourceLabel('organization', id)
    organizerLoading.value = false
    if (selectedOrganizer.value?.id === id) selectedOrganizer.value = { id, name: name ?? `#${id.slice(0, 8)}` }
  }
  if (event?.location_id) {
    try {
      selectedLocation.value = (await getLocationGeoV1LocationsLocationIdGet(event.location_id)).data
    } catch { /* локация не критична для предпросмотра */ }
  }
}

watch(() => props.open, (isOpen) => { if (isOpen) fill(props.event) })

async function submit() {
  if (!form.name) return
  if (form.status === 'active' && !form.date) {
    showMessage('Активное мероприятие должно иметь дату', 'danger')
    return
  }
  saving.value = true
  try {
    const saved = await props.save({
      name: form.name,
      date: form.date || null,
      description: form.description || null,
      status: form.status,
      level: form.level,
      type: form.type,
      format: form.format,
      organizer_id: selectedOrganizer.value?.id ?? null,
      location_id: selectedLocation.value?.id ?? null,
    })
    close()
    showSuccess(props.event ? 'Мероприятие обновлено' : 'Мероприятие создано')
    emit('saved', saved)
  } catch (err) {
    showError(err, 'Не удалось сохранить изменения')
  } finally {
    saving.value = false
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
</style>
