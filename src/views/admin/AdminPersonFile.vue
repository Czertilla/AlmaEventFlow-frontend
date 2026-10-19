<template>
  <div class="admin-dossier">
    <BackLink label="К списку персон" @click="goBack" />
    <PersonFile :api="api" />
  </div>
</template>

<script setup lang="ts">
import { useAdminNavigate } from '@/composables/useAdminNavigate'
import BackLink from '@/components/common/BackLink.vue'
import PersonFile from '@/components/profile/PersonFile.vue'
import { adminPersonFileApi } from '@/components/profile/personFileApi'

const props = defineProps<{ personId: string }>()
const adminNavigate = useAdminNavigate()
const api = adminPersonFileApi(props.personId)

function goBack() { adminNavigate('/admin/persons') }
</script>

<style scoped>
.admin-dossier { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
</style>
