<template>
  <ion-alert
    :is-open="isOpen"
    header="Удалить участника?"
    :message="`«${memberName}» будет исключён из коллектива.`"
    :buttons="buttons"
    @ion-alert-did-dismiss="emit('close')"
  />
</template>

<script setup lang="ts">
import { IonAlert } from '@ionic/vue'
import {
  deleteMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdDelete,
} from '@/api/generated/almaEventFlow'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  isOpen: boolean
  collectiveId: string
  memberId: string | null
  memberName: string
}>()

const emit = defineEmits<{
  close: []
  deleted: []
}>()

const { showError } = useToast()

async function remove() {
  if (!props.memberId) return
  try {
    await deleteMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdDelete(
      props.collectiveId, props.memberId,
    )
    emit('deleted')
  } catch (err) {
    showError(err, 'Не удалось удалить участника')
  }
}

const buttons = [
  { text: 'Отмена', role: 'cancel' },
  { text: 'Удалить', role: 'destructive', handler: () => { remove() } },
]
</script>
