<template>
  <ion-chip color="primary" outline>
    <ion-icon :icon="peopleOutline" />
    <span>{{ attended }}/{{ total }}</span>
  </ion-chip>
</template>

<script setup lang="ts">
import { IonChip, IonIcon } from '@ionic/vue'
import { peopleOutline } from 'ionicons/icons'

defineProps<{
  attended: number
  total: number
}>()
</script>
