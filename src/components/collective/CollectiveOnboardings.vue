<template>
  <section class="ui-card co">
    <div class="ui-card-head">
      <h3 class="ui-card-title">
        Вступление
        <HelpTip>
          <p>Кандидаты находят коллектив в поиске и отправляют запрос, вы можете пригласить человека с аккаунтом сами.</p>
          <p>Кандидат видит ваше ФИО и контакты, только если вы открыли их всем пользователям на странице «Видимость данных».</p>
        </HelpTip>
      </h3>
      <span v-if="waiting" class="ui-count">{{ waiting }}</span>
    </div>

    <label class="ui-toggle-row">
      <span>Принимать запросы</span>
      <ion-toggle :checked="intakeOpen ?? false" :disabled="intakeBusy || intakeOpen === null" @ion-change="setIntake($event.detail.checked)" />
    </label>

    <ul v-if="items.length" class="co-list">
      <li v-for="item in items" :key="item.id">
        <button type="button" class="co-row" @click="router.push(onboardingPath(item.id))">
          <span class="co-main">
            <span class="co-name">{{ formatPersonName(item.person) }}</span>
            <span class="co-meta">{{ item.opened_by === 'candidate' ? 'Запрос' : 'Приглашение' }} · {{ waitingText(item) }}</span>
          </span>
          <ion-icon :icon="chevronForwardOutline" class="co-arrow" />
        </button>
      </li>
    </ul>
    <p v-else-if="loaded" class="co-empty">Открытых запросов нет</p>

    <div class="co-actions">
      <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="inviteOpen = true">Пригласить</button>
      <CollectiveJoinLink :collective-id="collectiveId" :intake-open="intakeOpen" />
    </div>

    <ion-modal :is-open="inviteOpen" @ion-modal-did-dismiss="closeInvite">
      <div class="ui-sheet-head">
        <h3 class="ui-sheet-title">Приглашение</h3>
        <button type="button" class="ui-icon-btn" aria-label="Закрыть" @click="closeInvite">
          <ion-icon :icon="closeOutline" />
        </button>
      </div>
      <div class="ui-sheet-body co-form">
        <EntityPickerField
          v-model:search="personSearch"
          label="Человек"
          clear-label="Сбросить"
          :options="personOptions"
          :selected="selected"
          @search="searchPersons"
          @select="selected = { id: $event.id, name: $event.name }"
          @clear="selected = null"
        />
        <UiTextarea v-model="comment" label="Комментарий" :rows="3" :maxlength="1000" counter />
      </div>
      <div class="ui-sheet-actions">
        <button type="button" class="ui-btn ui-btn--primary" :disabled="!selected || sending" @click="invite()">
          Пригласить
        </button>
      </div>
    </ion-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IonIcon, IonModal, IonToggle } from '@ionic/vue'
import { chevronForwardOutline, closeOutline } from 'ionicons/icons'
import {
  getCollectiveIntakeEventV3CollectivesCollectiveIdIntakeGet,
  getOnboardingsEventV3OnboardingsGet,
  inviteToCollectiveEventV3CollectivesCollectiveIdInvitesPost,
  putCollectiveIntakeEventV3CollectivesCollectiveIdIntakePut,
  searchPersonProfileV1PersonsGet,
  type OnboardingRead,
} from '@/api/generated/almaEventFlow'
import CollectiveJoinLink from '@/components/collective/CollectiveJoinLink.vue'
import EntityPickerField from '@/components/common/EntityPickerField.vue'
import HelpTip from '@/components/common/HelpTip.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useLiveStore } from '@/stores/live'
import { formatPersonName } from '@/utils/names'
import { onboardingPath, sortOnboardings, waitingText } from '@/utils/onboarding'

const props = defineProps<{ collectiveId: string }>()

const router = useRouter()
const live = useLiveStore()
const { showError, showSuccess } = useToast()

const items = ref<OnboardingRead[]>([])
const loaded = ref(false)
const intakeOpen = ref<boolean | null>(null)
const intakeBusy = ref(false)
const inviteOpen = ref(false)
const personSearch = ref('')
const found = ref<{ id: string; name: string }[]>([])
const selected = ref<{ id: string; name: string } | null>(null)
const comment = ref('')
const sending = ref(false)

const waiting = computed(() => items.value.filter((item) => item.awaiting === 'leader').length)
const personOptions = computed(() => found.value)

async function load() {
  try {
    const [list, intake] = await Promise.all([
      getOnboardingsEventV3OnboardingsGet({
        side: 'leader',
        collective_id: props.collectiveId,
        status: ['requested', 'invited'],
        limit: 50,
      }),
      getCollectiveIntakeEventV3CollectivesCollectiveIdIntakeGet(props.collectiveId),
    ])
    items.value = sortOnboardings(list.data.items)
    intakeOpen.value = intake.data.is_open
  } catch {
    /* список останется прежним до следующего обновления */
  } finally {
    loaded.value = true
  }
}

async function setIntake(open: boolean) {
  if (open === intakeOpen.value) return
  intakeBusy.value = true
  try {
    intakeOpen.value = (await putCollectiveIntakeEventV3CollectivesCollectiveIdIntakePut(props.collectiveId, { is_open: open })).data.is_open
  } catch (err) {
    await showError(err, 'Не удалось изменить приём запросов')
  } finally {
    intakeBusy.value = false
  }
}

async function searchPersons() {
  const query = personSearch.value.trim()
  if (!query) {
    found.value = []
    return
  }
  try {
    const { data } = await searchPersonProfileV1PersonsGet({ search: query, limit: 10 })
    found.value = data.items.map((person) => ({ id: person.id, name: formatPersonName(person) }))
  } catch {
    found.value = []
  }
}

function closeInvite() {
  inviteOpen.value = false
  selected.value = null
  personSearch.value = ''
  found.value = []
  comment.value = ''
}

async function invite() {
  if (!selected.value) return
  sending.value = true
  try {
    await inviteToCollectiveEventV3CollectivesCollectiveIdInvitesPost(props.collectiveId, {
      person_id: selected.value.id,
      comment: comment.value.trim() || null,
    })
    await showSuccess('Приглашение отправлено')
    closeInvite()
    await load()
  } catch (err) {
    await showError(err, 'Не удалось пригласить')
  } finally {
    sending.value = false
  }
}

watch(() => props.collectiveId, () => {
  items.value = []
  loaded.value = false
  intakeOpen.value = null
  void load()
}, { immediate: true })

watch(() => live.tick, () => void load())
watch(() => live.versions, () => void load())

defineExpose({ openInvite: () => { inviteOpen.value = true } })
</script>

<style scoped>
.co {
  margin-bottom: 16px;
}

.co-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.co-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.co-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.co-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  color: var(--ion-text-color);
}

.co-meta,
.co-empty {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.co-empty {
  margin: 4px 0;
}

.co-arrow {
  color: var(--ion-color-medium);
}

.co-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.co-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
