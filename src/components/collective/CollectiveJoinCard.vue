<template>
  <div class="cj">
    <section class="ui-card">
      <div class="cj-head">
        <DefaultAvatar kind="collective" :seed="card.id" :size="48" />
        <div class="cj-title">
          <h2 class="cj-name">{{ card.name }}</h2>
          <span class="cj-meta">{{ meta }}</span>
        </div>
      </div>
    </section>

    <section class="ui-card">
      <div class="ui-card-head">
        <h3 class="ui-card-title">
          Руководитель
          <HelpTip text="Имя и контакты видны, если руководитель открыл их всем пользователям." />
        </h3>
      </div>
      <span v-if="leaderLoading" class="skeleton cj-skeleton" aria-hidden="true" />
      <template v-else>
        <p v-if="leaderName" class="cj-leader">{{ leaderName }}</p>
        <dl v-if="contacts.length" class="cj-contacts">
          <div v-for="contact in contacts" :key="`${contact.type}:${contact.value}`" class="cj-contact">
            <dt>{{ contactTypeLabels[contact.type] ?? contact.type }}</dt>
            <dd>{{ contact.value }}</dd>
          </div>
        </dl>
        <p v-if="!leaderName && !contacts.length" class="cj-muted">Руководитель не открыл свои данные</p>
      </template>
    </section>

    <section class="ui-card">
      <div class="ui-card-head">
        <h3 class="ui-card-title">Вступление</h3>
      </div>
      <OnboardingChat v-if="card.onboarding_id" :onboarding-id="card.onboarding_id" @changed="onChanged" />
      <template v-else-if="card.can_request">
        <UiTextarea v-model="comment" label="Комментарий" :rows="3" :maxlength="1000" counter />
        <button type="button" class="ui-btn ui-btn--primary" :disabled="sending" @click="request()">
          Отправить запрос
        </button>
      </template>
      <template v-else-if="needsDetails">
        <p class="cj-muted">Чтобы отправить запрос, заполните подробную информацию</p>
        <button type="button" class="ui-btn ui-btn--primary" @click="fillDetails()">Заполнить</button>
      </template>
      <p v-else class="cj-muted">{{ unavailableText }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getPersonNamesProfileV2PersonsNamesPost,
  getVisibleContactsProfileV3PersonsPersonIdContactsGet,
  requestOnboardingEventV3CollectivesCollectiveIdOnboardingPost,
  type CollectiveCard,
  type OnboardingDetail,
  type VisibleContactRead,
} from '@/api/generated/almaEventFlow'
import DefaultAvatar from '@/components/common/DefaultAvatar.vue'
import HelpTip from '@/components/common/HelpTip.vue'
import UiTextarea from '@/components/common/UiTextarea.vue'
import OnboardingChat from '@/components/collective/OnboardingChat.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { contactTypeLabels } from '@/utils/contactTypes'
import { formatDate } from '@/utils/date'
import { formatPersonName } from '@/utils/names'
import { isOpen } from '@/utils/onboarding'
import { rememberCollective } from '@/utils/quickStart'

const props = defineProps<{ card: CollectiveCard }>()
const emit = defineEmits<{ changed: [] }>()

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const { showError } = useToast()

const needsDetails = computed(
  () => !auth.jwtPayload?.per && props.card.relation === 'none' && !props.card.retry_after,
)
const comment = ref('')
const sending = ref(false)
const leaderName = ref('')
const contacts = ref<VisibleContactRead[]>([])
const leaderLoading = ref(false)

const meta = computed(() =>
  [props.card.university_name, `участников: ${props.card.member_count}`, props.card.is_verified ? '' : 'Не подтверждён']
    .filter(Boolean)
    .join(' · '),
)

const unavailableText = computed(() => {
  if (props.card.relation === 'former') return 'Вы были участником. Вернуть в коллектив может руководитель.'
  if (props.card.retry_after) {
    return `Новый запрос можно отправить ${formatDate(new Date(props.card.retry_after), settings.dateFormat)}`
  }
  return 'Сейчас отправить запрос нельзя'
})

async function loadLeader(principalId: string | null | undefined) {
  leaderName.value = ''
  contacts.value = []
  if (!principalId) return
  leaderLoading.value = true
  try {
    const [names, found] = await Promise.all([
      getPersonNamesProfileV2PersonsNamesPost({ ids: [principalId] }),
      getVisibleContactsProfileV3PersonsPersonIdContactsGet(principalId),
    ])
    const name = names.data.items.find((item) => item.id === principalId)
    leaderName.value = name?.surname ? formatPersonName({ ...name, surname: name.surname, name: name.name ?? '' }) : ''
    contacts.value = found.data
  } catch {
    /* без имени и контактов карточка всё равно рабочая */
  } finally {
    leaderLoading.value = false
  }
}

async function request() {
  sending.value = true
  try {
    await requestOnboardingEventV3CollectivesCollectiveIdOnboardingPost(props.card.id, {
      comment: comment.value.trim() || null,
    })
    comment.value = ''
    emit('changed')
  } catch (err) {
    await showError(err, 'Не удалось отправить запрос')
    emit('changed')
  } finally {
    sending.value = false
  }
}

function fillDetails() {
  rememberCollective(props.card.id)
  void router.push('/profile/data')
}

function onChanged(detail: OnboardingDetail) {
  if (!isOpen(detail.onboarding.status)) emit('changed')
}

watch(() => props.card.principal_id, loadLeader, { immediate: true })
</script>

<style scoped>
.cj {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cj-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cj-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cj-name {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.cj-meta,
.cj-muted {
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.cj-muted {
  margin: 0;
}

.cj-leader {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  color: var(--ion-text-color);
}

.cj-contacts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cj-contact {
  display: flex;
  gap: 12px;
}

.cj-contact dt {
  min-width: 140px;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.cj-contact dd {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}

.cj-skeleton {
  display: block;
  height: 40px;
}
</style>
