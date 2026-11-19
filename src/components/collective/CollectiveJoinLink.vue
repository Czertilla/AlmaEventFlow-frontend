<template>
  <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm cjl-open" @click="open = true">
    <ion-icon :icon="qrCodeOutline" />
    Ссылка и QR-код
  </button>

  <ion-modal :is-open="open" @ion-modal-did-dismiss="open = false">
    <div class="ui-sheet-head">
      <h3 class="ui-sheet-title">
        Ссылка для вступления
        <HelpTip text="По ссылке новый пользователь регистрируется и сразу попадает на страницу коллектива, где отправляет запрос. Вошедший пользователь попадает туда сразу." />
      </h3>
      <button type="button" class="ui-icon-btn" aria-label="Закрыть" @click="open = false">
        <ion-icon :icon="closeOutline" />
      </button>
    </div>
    <div class="ui-sheet-body cjl-body">
      <img class="cjl-qr" :src="qrImage" alt="QR-код ссылки для вступления" width="240" height="240" />
      <UiField label="Ссылка" float :hint="intakeOpen === false ? 'Приём закрыт: по ссылке нельзя отправить запрос' : ''">
        <span class="ui-field-value cjl-link">{{ link }}</span>
        <template #suffix>
          <button type="button" class="ui-icon-btn" :aria-label="copied ? 'Скопировано' : 'Копировать'" @click="copy()">
            <ion-icon :icon="copied ? checkmarkOutline : copyOutline" />
          </button>
        </template>
      </UiField>
    </div>
    <div class="ui-sheet-actions">
      <button type="button" class="ui-btn ui-btn--ghost" @click="download()">Скачать QR-код</button>
      <button type="button" class="ui-btn ui-btn--primary" @click="copy()">
        {{ copied ? 'Скопировано' : 'Копировать ссылку' }}
      </button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonIcon, IonModal } from '@ionic/vue'
import { checkmarkOutline, closeOutline, copyOutline, qrCodeOutline } from 'ionicons/icons'
import HelpTip from '@/components/common/HelpTip.vue'
import UiField from '@/components/common/UiField.vue'
import { qrSvg, svgDataUrl } from '@/utils/qr'
import { collectiveJoinLink } from '@/utils/quickStart'

const props = defineProps<{ collectiveId: string; intakeOpen?: boolean | null }>()

const open = ref(false)
const copied = ref(false)

const link = computed(() => collectiveJoinLink(window.location.origin, props.collectiveId))
const svg = computed(() => qrSvg(link.value))
const qrImage = computed(() => svgDataUrl(svg.value))

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard unavailable */ }
}

function download() {
  const url = URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `collective-${props.collectiveId}.svg`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
</script>

<style scoped>
.cjl-open {
  gap: 6px;
}

.cjl-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cjl-qr {
  width: 240px;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}

.cjl-body :deep(.ui-field) {
  align-self: stretch;
}

.cjl-link {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  word-break: break-all;
}
</style>
