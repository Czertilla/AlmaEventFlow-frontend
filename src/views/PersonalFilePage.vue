<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>Личное дело</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="file-page">
        <BackLink v-if="isDesktop" label="Профиль" @click="router.push('/profile')" />
        <h1 v-if="isDesktop" class="page-title">Личное дело</h1>

        <div v-if="!ready" class="file-state"><ion-spinner name="crescent" /></div>

        <PersonFile v-else-if="hasPerson" :key="auth.user?.person_id ?? ''" :api="api" />

        <section v-else class="ui-card file-create">
          <h2 class="ui-card-title">Создайте личное дело</h2>
          <p class="file-hint">
            Укажите, как вас зовут: так вас увидят руководители коллективов. Профиль, студенческую карточку
            и контакты можно добавить следом, в любое время.
          </p>
          <UiInput v-model="draft.surname" label="Фамилия" autocomplete="family-name" :maxlength="128" />
          <UiInput v-model="draft.name" label="Имя" autocomplete="given-name" :maxlength="128" />
          <UiInput v-model="draft.patronymic" label="Отчество" autocomplete="additional-name" :maxlength="128" hint="Если есть" />
          <p v-if="error" class="file-error">{{ error }}</p>
          <ion-button expand="block" :disabled="creating" @click="create">Создать личное дело</ion-button>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton, IonSpinner } from '@ionic/vue'
import { createMyPersonProfileV2PersonsMyPost } from '@/api/generated/almaEventFlow'
import BackLink from '@/components/common/BackLink.vue'
import UiInput from '@/components/common/UiInput.vue'
import PersonFile from '@/components/profile/PersonFile.vue'
import { myPersonFileApi } from '@/components/profile/personFileApi'
import { usePlatform } from '@/composables/usePlatform'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { isDesktop } = usePlatform()
const { showError, showSuccess } = useToast()
const api = myPersonFileApi()

const ready = ref(false)
const creating = ref(false)
const error = ref('')
const draft = reactive({ surname: '', name: '', patronymic: '' })

const hasPerson = computed(() => !!auth.user?.person_id)

async function create() {
  error.value = ''
  if (!draft.surname.trim() || !draft.name.trim()) {
    error.value = 'Укажите фамилию и имя'
    return
  }
  creating.value = true
  try {
    await createMyPersonProfileV2PersonsMyPost({
      surname: draft.surname.trim(),
      name: draft.name.trim(),
      patronymic: draft.patronymic.trim() || null,
    })
  } catch (err) {
    creating.value = false
    error.value = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Не удалось создать личное дело'
    return
  }
  if ((await auth.tryRefresh()) !== 'signed-in') {
    creating.value = false
    showError(null, 'Личное дело создано, но сессию обновить не удалось: войдите заново')
    return
  }
  creating.value = false
  showSuccess('Личное дело создано')
}

onMounted(async () => {
  if (!auth.user) await auth.fetchUser()
  if (auth.user?.person_id && !auth.jwtPayload?.per) await auth.tryRefresh()
  ready.value = true
})
</script>

<style scoped>
.file-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
}

.page-title {
  margin: 4px 0 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.file-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.file-create {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.file-hint {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
}

.file-error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--ion-color-danger);
}
</style>
