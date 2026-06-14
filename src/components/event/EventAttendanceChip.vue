<template>
  <span class="att-chip-group">
    <button
      class="att-chip"
      :class="[`att-chip--${state}`, { 'att-chip--locked': verified }]"
      :disabled="!!verified || loading"
      @click.stop="handleToggle"
    >
      <span v-if="loading" class="att-chip-spinner" />
      <ion-icon v-else :icon="chipIcon" />
      <span class="att-chip-label">{{ label }}</span>
    </button>
    <!-- Заверение — отдельный чип-замочек, состояние отметки остаётся видимым -->
    <span v-if="verified && showLock !== false" class="att-lock" title="Заверено">
      <ion-icon :icon="lockClosed" />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { checkmarkCircle, closeCircle, helpCircle, lockClosed } from 'ionicons/icons'
import { useAttendancePending } from '@/composables/useAttendancePending'

const props = withDefaults(defineProps<{
  isAttended: boolean | null | undefined
  editedAt: string | null | undefined
  verified: boolean | null | undefined
  /** Это отметка текущего пользователя — только для неё показывается состояние «Требует отметки» */
  own?: boolean
  /** id записи attendance — для глобального индикатора загрузки PATCH-запросов */
  attendanceId?: string
  /** false — не рендерить замочек (родитель рендерит его сам после comment-chip) */
  showLock?: boolean
}>(), { own: true })

const emit = defineEmits<{
  toggle: [value: boolean]
}>()

const { pending } = useAttendancePending()
const loading = computed(() => !!props.attendanceId && pending.has(props.attendanceId))
// Пока идёт любой PATCH — все чипы не реагируют (защита от флуда)
const anyBusy = computed(() => pending.size > 0)

type ChipState = 'pending' | 'attended' | 'absent'

// Заверение не скрывает состояние — чип всегда показывает фактическую отметку
const state = computed<ChipState>(() => {
  if (!props.verified && props.own && props.editedAt == null) return 'pending'
  return props.isAttended ? 'attended' : 'absent'
})

const chipIcon = computed(() => ({
  pending: helpCircle,
  attended: checkmarkCircle,
  absent: closeCircle,
}[state.value]))

const label = computed(() => ({
  pending: 'Требует отметки',
  attended: 'Присутствует',
  absent: 'Отсутствует',
}[state.value]))

function handleToggle() {
  if (props.verified || anyBusy.value) return
  // First-time mark always sets "attended"; afterwards it toggles
  emit('toggle', state.value === 'pending' ? true : !props.isAttended)
}
</script>

<style scoped>
.att-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid transparent;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
}

.att-chip ion-icon {
  font-size: 15px;
}

.att-chip-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: att-spin 0.6s linear infinite;
  flex-shrink: 0;
  opacity: 0.8;
}

@keyframes att-spin {
  to { transform: rotate(360deg); }
}

.att-chip:not(:disabled):hover {
  transform: translateY(-1px);
  filter: brightness(0.97);
}

.att-chip:not(:disabled):active {
  transform: translateY(0);
}

.att-chip--pending {
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(124, 58, 237, 0.35);
  color: #7C3AED;
}

.ion-palette-dark .att-chip--pending {
  color: #A78BFA;
}

.att-chip--attended {
  background: rgba(0, 191, 146, 0.12);
  border-color: rgba(0, 191, 146, 0.35);
  color: #00997a;
}

.ion-palette-dark .att-chip--attended {
  color: #2DD4BF;
}

.att-chip--absent {
  background: rgba(255, 71, 87, 0.1);
  border-color: rgba(255, 71, 87, 0.3);
  color: #e0303f;
}

.ion-palette-dark .att-chip--absent {
  color: #FF6B7A;
}

.att-chip-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Заверённая отметка: цвет состояния сохраняется, но чип неактивен */
.att-chip--locked {
  cursor: default;
  opacity: 0.6;
  filter: saturate(0.7);
}

.att-lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ion-color-step-50, #f4f5f8);
  border: 1.5px solid var(--ion-border-color);
  color: var(--ion-color-medium);
  font-size: 13px;
  flex-shrink: 0;
}

/* На мобильных — только иконка-состояние, текст скрыт */
@media (max-width: 480px) {
  .att-chip {
    padding: 7px;
  }
  .att-chip ion-icon {
    font-size: 17px;
  }
  .att-chip-label {
    display: none;
  }
}
</style>
