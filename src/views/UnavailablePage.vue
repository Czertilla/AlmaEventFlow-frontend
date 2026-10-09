<template>
  <ion-page>
    <ion-content class="unavailable-page">
      <div class="unavailable">
        <ion-icon :icon="cloudOfflineOutline" class="unavailable-icon" />
        <template v-if="down">
          <h1>Сервер недоступен</h1>
          <p>
            Не удаётся связаться с сервером. Ваш вход сохранён: как только связь
            восстановится, мы вернём вас на нужную страницу.
          </p>
          <button class="ui-btn ui-btn--primary" :disabled="isChecking" @click="recheck">
            {{ isChecking ? 'Проверяем…' : 'Повторить сейчас' }}
          </button>
        </template>
        <template v-else>
          <h1>Не удалось проверить вход</h1>
          <p>Сервер ответил ошибкой. Ваш вход сохранён: попробуйте ещё раз.</p>
          <button class="ui-btn ui-btn--primary" @click="router.replace(target())">Повторить</button>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonPage, IonContent, IonIcon } from '@ionic/vue'
import { cloudOfflineOutline } from 'ionicons/icons'
import { useBackendStatus } from '@/composables/useBackendStatus'

const route = useRoute()
const router = useRouter()
const { isDown, isChecking, recheck } = useBackendStatus()
const down = computed(() => isDown('user'))

function target(): string {
  const next = route.query.next
  const internal = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
  return internal && !next.startsWith('/unavailable') ? next : '/'
}

watch(down, (isNowDown) => {
  if (!isNowDown) router.replace(target())
})
</script>

<style scoped>
.unavailable-page::part(scroll) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.unavailable {
  width: 100%;
  max-width: 420px;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.unavailable-icon {
  font-size: var(--icon-hero);
  color: var(--ion-color-medium);
}

.unavailable h1 {
  margin: 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
}

.unavailable p {
  margin: 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
}

.unavailable .ui-btn {
  width: 100%;
  margin-top: 8px;
}
</style>
