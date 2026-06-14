<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-back-button v-if="showBack" default-href="/" />
      </ion-buttons>
      <ion-title>{{ title }}</ion-title>
    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle } from '@ionic/vue'

defineProps<{
  title: string
  showBack?: boolean
}>()
</script>
