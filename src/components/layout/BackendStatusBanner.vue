<template>
  <div v-if="anyDown && !route.meta.offline" class="backend-banner" role="status">
    <ion-icon :icon="copy.icon === 'maintenance' ? constructOutline : cloudOfflineOutline" class="backend-banner-icon" />
    <span class="backend-banner-text">{{ copy.banner }}</span>
    <button class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="isChecking" @click="recheck">
      Повторить
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { IonIcon } from '@ionic/vue'
import { cloudOfflineOutline, constructOutline } from 'ionicons/icons'
import { useBackendStatus } from '@/composables/useBackendStatus'
import { backendCopy } from '@/utils/backendCopy'

const route = useRoute()
const { anyDown, reason, isChecking, recheck } = useBackendStatus()
const copy = computed(() => backendCopy(reason.value))
</script>

<style scoped>
.backend-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(var(--ion-color-warning-rgb), 0.16);
  border-bottom: 1px solid var(--ion-color-warning);
  color: var(--ion-text-color);
}

.backend-banner-icon {
  flex-shrink: 0;
  font-size: var(--icon-xl);
  color: var(--ion-color-warning-shade);
}

.backend-banner-text {
  flex: 1;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.backend-banner .ui-btn {
  flex-shrink: 0;
}
</style>
