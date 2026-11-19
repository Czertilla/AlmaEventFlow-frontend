<template>
  <div v-if="collectiveId" class="ui-banner clb" role="status">
    <span class="clb-text">
      <ion-icon :icon="peopleOutline" />
      После входа откроется страница коллектива
    </span>
    <button type="button" class="ui-icon-btn" aria-label="Не открывать" @click="dismiss">
      <ion-icon :icon="closeOutline" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonIcon, onIonViewWillEnter } from '@ionic/vue'
import { closeOutline, peopleOutline } from 'ionicons/icons'
import { forgetCollective, pendingCollective } from '@/utils/quickStart'

const collectiveId = ref(pendingCollective())

onIonViewWillEnter(() => {
  collectiveId.value = pendingCollective()
})

function dismiss() {
  forgetCollective()
  collectiveId.value = null
}
</script>

<style scoped>
.clb {
  margin-bottom: 20px;
}

.clb-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
